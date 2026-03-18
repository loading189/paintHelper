import type {
  ColorAnalysis,
  HueFamily,
  Paint,
  RankedRecipe,
  RecipeComponent,
  RecipeScoreBreakdown,
  UserSettings,
} from '../../types/models';
import { formatRatio, practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';
import { analyzeColor, hueDifference } from './colorAnalysis';
import { assignRecipeBadges, buildMixStrategy, buildRecipeGuidance, buildRecipeWhyThisRanked, determineRecipeQuality } from './guidance';
import { predictSpectralMix, spectralDistanceBetweenHexes } from './spectralMixing';

export type WeightCombination = number[];
export type CandidateMix = { paintIds: string[]; weights: number[] };

type RankedRecipeCandidate = RankedRecipe;

const buildRecipeText = (paintNames: string[], parts: number[]): string =>
  paintNames.map((name, index) => `${parts[index]} part${parts[index] === 1 ? '' : 's'} ${name}`).join(' + ');

const choosePaintGroups = <T,>(items: T[], groupSize: number): T[][] => {
  const groups: T[][] = [];

  const visit = (startIndex: number, path: T[]): void => {
    if (path.length === groupSize) {
      groups.push(path);
      return;
    }

    for (let index = startIndex; index <= items.length - (groupSize - path.length); index += 1) {
      visit(index + 1, [...path, items[index]]);
    }
  };

  visit(0, []);
  return groups;
};

export const generateWeightCombinations = (count: number, step: number): WeightCombination[] => {
  const totalUnits = Math.round(100 / step);
  const combinations: WeightCombination[] = [];

  const visit = (remainingSlots: number, remainingUnits: number, path: number[]): void => {
    if (remainingSlots === 1) {
      if (remainingUnits > 0) {
        combinations.push([...path, remainingUnits * step]);
      }
      return;
    }

    for (let units = 1; units <= remainingUnits - (remainingSlots - 1); units += 1) {
      visit(remainingSlots - 1, remainingUnits - units, [...path, units * step]);
    }
  };

  visit(count, totalUnits, []);
  return combinations;
};

const getPaintRoleFamily = (paint: Paint): HueFamily => {
  const name = paint.name.toLowerCase();
  if (paint.isBlack || paint.isWhite) return 'neutral';
  if (name.includes('yellow')) return 'yellow';
  if (name.includes('blue')) return 'blue';
  if (name.includes('red') || name.includes('crimson')) return 'red';
  return analyzeColor(paint.hex)?.hueFamily ?? 'neutral';
};

const isStrongPaint = (paint: Paint): boolean =>
  paint.heuristics?.tintStrength === 'very-high' || paint.heuristics?.recommendedMaxShare !== undefined;

const componentOverlap = (left: RecipeComponent[], right: RecipeComponent[]): number => {
  const leftIds = new Set(left.map((component) => component.paintId));
  return right.filter((component) => leftIds.has(component.paintId)).length;
};

const recipeSignature = (components: RecipeComponent[]): string =>
  [...components]
    .sort((left, right) => left.paintId.localeCompare(right.paintId))
    .map((component) => `${component.paintId}:${component.percentage}`)
    .join('|');

const buildComponents = (paintIds: string[], weights: number[]): RecipeComponent[] =>
  paintIds
    .map((paintId, index) => ({ paintId, weight: weights[index], percentage: weights[index] }))
    .sort((left, right) => right.percentage - left.percentage || left.paintId.localeCompare(right.paintId));

const getRequiredConstructionFamilies = (targetAnalysis: ColorAnalysis): HueFamily[] => {
  switch (targetAnalysis.hueFamily) {
    case 'green':
      return ['yellow', 'blue'];
    case 'orange':
      return ['yellow', 'red'];
    case 'violet':
      return ['red', 'blue'];
    default:
      return [];
  }
};

const getPaintFamilies = (paints: Paint[], components: RecipeComponent[]): HueFamily[] => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  return [...new Set(components.map((component) => paintMap.get(component.paintId)).filter((paint): paint is Paint => Boolean(paint)).map(getPaintRoleFamily))];
};

const hasRequiredHueConstructionPath = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): boolean => {
  const required = getRequiredConstructionFamilies(targetAnalysis);
  if (required.length === 0) return true;
  const families = getPaintFamilies(paints, components);
  return required.every((family) => families.includes(family));
};

const classifyHueFamilyBand = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): 'same' | 'adjacent' | 'wrong' | 'neutralized' => {
  if (targetAnalysis.hueFamily === 'neutral') return 'same';
  if (predictedAnalysis.hueFamily === 'neutral') return 'neutralized';
  if (predictedAnalysis.hueFamily === targetAnalysis.hueFamily) return 'same';

  const adjacent: Record<Exclude<HueFamily, 'neutral'>, HueFamily[]> = {
    red: ['orange', 'violet'],
    orange: ['red', 'yellow'],
    yellow: ['orange', 'green'],
    green: ['yellow', 'blue'],
    blue: ['green', 'violet'],
    violet: ['red', 'blue'],
  };

  if (adjacent[targetAnalysis.hueFamily as Exclude<HueFamily, 'neutral'>]?.includes(predictedAnalysis.hueFamily) && hueDifference(targetAnalysis.hue, predictedAnalysis.hue) <= 0.16) {
    return 'adjacent';
  }

  return 'wrong';
};

const staysInBroadHueFamily = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): boolean => {
  const band = classifyHueFamilyBand(targetAnalysis, predictedAnalysis);
  return band === 'same' || band === 'adjacent';
};

const getComplexityPenalty = (settings: UserSettings, components: RecipeComponent[]): number => {
  if (settings.rankingMode === 'strict-closest-color') {
    return 0;
  }
  const perPaintPenalty = settings.rankingMode === 'simpler-recipes-preferred' ? 0.07 : 0.035;
  return (components.length - 1) * perPaintPenalty;
};

const getSupportPenalty = (paints: Paint[], components: RecipeComponent[]): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  return components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint) return sum;
    const recommendedMax = paint.heuristics?.recommendedMaxShare;
    const overage = recommendedMax ? Math.max(0, component.percentage - recommendedMax) : 0;
    return sum + overage / 300;
  }, 0);
};

const getDominancePenalty = (paints: Paint[], components: RecipeComponent[]): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  return components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    return sum + (paint?.heuristics?.dominancePenalty ?? 0) * (component.percentage / 100) * 0.04;
  }, 0);
};

const getNaturalMixBonus = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (!(targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral')) return 0;
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  return components.some((component) => paintMap.get(component.paintId)?.heuristics?.naturalBias === 'earth') ? 0.05 : 0;
};

const getChromaticPathBonus = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hueFamily === 'neutral') return 0;
  return hasRequiredHueConstructionPath(paints, components, targetAnalysis) ? 0.06 : 0;
};

const getConstructionPenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hueFamily === 'neutral') return 0;
  return hasRequiredHueConstructionPath(paints, components, targetAnalysis) ? 0 : 0.11;
};

const getBlackPenalty = (settings: UserSettings, paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const only = components.length === 1 ? paintMap.get(components[0].paintId) : null;
  if (only?.isBlack && settings.singlePaintPenaltySettings.discourageBlackOnlyMatches) {
    return targetAnalysis.hueFamily === 'neutral' ? 0.04 : 0.16;
  }

  const blackShare = components.find((component) => paintMap.get(component.paintId)?.isBlack)?.percentage ?? 0;
  return targetAnalysis.hueFamily !== 'neutral' && blackShare > 25 ? blackShare / 500 : 0;
};

const getWhitePenalty = (settings: UserSettings, paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const only = components.length === 1 ? paintMap.get(components[0].paintId) : null;
  if (only?.isWhite && settings.singlePaintPenaltySettings.discourageWhiteOnlyMatches) {
    return targetAnalysis.valueClassification === 'very light' && targetAnalysis.hueFamily === 'neutral' ? 0.02 : 0.14;
  }
  return 0;
};

const getSinglePaintPenalty = (settings: UserSettings, paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (!settings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose || components.length !== 1) {
    return 0;
  }
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const paint = paintMap.get(components[0].paintId);
  if (!paint || paint.isBlack || paint.isWhite) {
    return 0;
  }
  return targetAnalysis.saturationClassification === 'vivid' ? 0.05 : 0.03;
};

const getNeutralizerPenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral') {
    return 0;
  }
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const neutralizerShare = components.reduce((sum, component) => {
    const role = paintMap.get(component.paintId)?.heuristics?.preferredRole;
    return sum + (role === 'neutralizer' || paintMap.get(component.paintId)?.isBlack ? component.percentage : 0);
  }, 0);
  return neutralizerShare > 20 ? neutralizerShare / 300 : 0;
};

export const scoreRecipe = (
  settings: UserSettings,
  paints: Paint[],
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
  components: RecipeComponent[],
): RecipeScoreBreakdown => {
  const spectralDistance = spectralDistanceBetweenHexes(targetAnalysis.normalizedHex, predictedAnalysis.normalizedHex);
  const valueDifference = Math.abs(targetAnalysis.value - predictedAnalysis.value);
  const hueDelta = hueDifference(targetAnalysis.hue, predictedAnalysis.hue);
  const saturationDifference = Math.abs(targetAnalysis.saturation - predictedAnalysis.saturation);
  const chromaDifference = Math.abs(targetAnalysis.chroma - predictedAnalysis.chroma) * 2.2;
  const hasConstructionPath = hasRequiredHueConstructionPath(paints, components, targetAnalysis);
  const staysInTargetHueFamily = staysInBroadHueFamily(targetAnalysis, predictedAnalysis);
  const complexityPenalty = getComplexityPenalty(settings, components);
  const hueFamilyPenalty = targetAnalysis.hueFamily === 'neutral' || staysInTargetHueFamily ? 0 : 0.18;
  const constructionPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getConstructionPenalty(paints, components, targetAnalysis);
  const supportPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getSupportPenalty(paints, components);
  const dominancePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getDominancePenalty(paints, components);
  const neutralizerPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getNeutralizerPenalty(paints, components, targetAnalysis);
  const blackPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getBlackPenalty(settings, paints, components, targetAnalysis);
  const whitePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getWhitePenalty(settings, paints, components, targetAnalysis);
  const singlePaintPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getSinglePaintPenalty(settings, paints, components, targetAnalysis);
  const naturalMixBonus = settings.rankingMode === 'strict-closest-color' ? 0 : getNaturalMixBonus(paints, components, targetAnalysis);
  const chromaticPathBonus = settings.rankingMode === 'strict-closest-color' ? 0 : getChromaticPathBonus(paints, components, targetAnalysis);
  const vividTargetPenalty =
    settings.rankingMode === 'strict-closest-color' || targetAnalysis.saturationClassification !== 'vivid' || staysInTargetHueFamily
      ? 0
      : 0.16;

  const base = spectralDistance * 0.92 + valueDifference * 0.42 + hueDelta * 0.28 + saturationDifference * 0.18 + chromaDifference * 0.16;
  const finalScore =
    base +
    complexityPenalty +
    hueFamilyPenalty +
    constructionPenalty +
    supportPenalty +
    dominancePenalty +
    neutralizerPenalty +
    blackPenalty +
    whitePenalty +
    singlePaintPenalty +
    vividTargetPenalty -
    naturalMixBonus -
    chromaticPathBonus;

  return {
    mode: settings.rankingMode,
    spectralDistance,
    valueDifference,
    hueDifference: hueDelta,
    saturationDifference,
    chromaDifference,
    complexityPenalty,
    hueFamilyPenalty,
    constructionPenalty,
    supportPenalty,
    dominancePenalty,
    neutralizerPenalty,
    blackPenalty,
    whitePenalty,
    singlePaintPenalty,
    naturalMixBonus,
    chromaticPathBonus,
    vividTargetPenalty,
    hasRequiredHueConstructionPath: hasConstructionPath,
    staysInTargetHueFamily,
    finalScore,
  };
};

const isCandidateUsefulForTarget = (paints: Paint[], paintIds: string[], weights: number[], target: ColorAnalysis): boolean => {
  const group = paintIds.map((paintId) => paints.find((paint) => paint.id === paintId)).filter((paint): paint is Paint => Boolean(paint));
  if (group.length !== paintIds.length) return false;

  if (group.filter((paint) => paint.isBlack).length > 1 || group.filter((paint) => paint.isWhite).length > 1) {
    return false;
  }

  const roles = group.map((paint) => paint.heuristics?.preferredRole);
  if (roles.filter((role) => role === 'neutralizer').length > 1) {
    return false;
  }

  if (target.hueFamily !== 'neutral') {
    const families = group.map(getPaintRoleFamily);
    const hasHueBuilder = families.includes(target.hueFamily) || getRequiredConstructionFamilies(target).every((family) => families.includes(family));
    if (!hasHueBuilder && group.every((paint) => paint.isBlack || paint.heuristics?.naturalBias !== 'chromatic')) {
      return false;
    }
  }

  return weights.every((weight, index) => weight <= (group[index].heuristics?.recommendedMaxShare ?? 100));
};

export const generateCandidateMixes = (paints: Paint[], maxPaintsPerRecipe: number, step: number, targetHex?: string): CandidateMix[] => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const targetAnalysis = targetHex ? analyzeColor(targetHex) : null;
  const candidates: CandidateMix[] = [];

  for (let size = 1; size <= Math.min(maxPaintsPerRecipe, enabledPaints.length); size += 1) {
    const groups = choosePaintGroups(enabledPaints, size);

    groups.forEach((group) => {
      const weightSets = generateWeightCombinations(size, step).filter((weights) => {
        if (targetAnalysis && !isCandidateUsefulForTarget(enabledPaints, group.map((paint) => paint.id), weights, targetAnalysis)) {
          return false;
        }
        const strongCount = group.filter(isStrongPaint).length;
        if (size === 3 && strongCount >= 2 && weights.filter((weight) => weight >= 30).length >= 2) {
          return false;
        }
        return true;
      });

      weightSets.forEach((weights) => {
        candidates.push({ paintIds: group.map((paint) => paint.id), weights });
      });
    });
  }

  return candidates;
};

const compareRecipes = (left: RankedRecipeCandidate, right: RankedRecipeCandidate): number => {
  if (left.scoreBreakdown.finalScore !== right.scoreBreakdown.finalScore) {
    return left.scoreBreakdown.finalScore - right.scoreBreakdown.finalScore;
  }
  if (left.components.length !== right.components.length) {
    return left.components.length - right.components.length;
  }
  return left.recipeText.localeCompare(right.recipeText);
};

export const rankRecipes = (targetHex: string, paints: Paint[], settings: UserSettings, limit = 8): RankedRecipe[] => {
  const targetAnalysis = analyzeColor(targetHex);
  if (!targetAnalysis) {
    return [];
  }

  const candidateMixes = generateCandidateMixes(paints, settings.maxPaintsPerRecipe, settings.weightStep, targetHex);
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const seenSignatures = new Set<string>();
  const ranked: RankedRecipeCandidate[] = [];

  candidateMixes.forEach((candidate) => {
    const components = buildComponents(candidate.paintIds, candidate.weights);
    const exactParts = simplifyRatio(candidate.weights);
    const practicalParts = practicalRatioFromWeights(candidate.weights, { idealMaxParts: candidate.weights.length === 3 ? 9 : 8, hardMaxParts: 12 });
    const mix = predictSpectralMix(paints, components);
    const predictedAnalysis = analyzeColor(mix.hex);
    if (!predictedAnalysis) {
      return;
    }

    const scoreBreakdown = scoreRecipe(settings, paints, targetAnalysis, predictedAnalysis, components);
    const paintNames = components.map((component) => paintMap.get(component.paintId)?.name ?? component.paintId);
    const recipe: RankedRecipeCandidate = {
      predictedHex: mix.hex,
      distanceScore: scoreBreakdown.spectralDistance,
      components,
      exactParts,
      exactRatioText: formatRatio(exactParts),
      practicalParts,
      practicalRatioText: formatRatio(practicalParts),
      parts: practicalParts,
      ratioText: formatRatio(practicalParts),
      recipeText: buildRecipeText(paintNames, practicalParts),
      scoreBreakdown,
      qualityLabel: determineRecipeQuality(scoreBreakdown.finalScore),
      badges: [],
      guidanceText: [],
      targetAnalysis,
      predictedAnalysis,
      whyThisRanked: [],
      mixStrategy: [],
    };

    const signature = recipeSignature(recipe.components);
    if (seenSignatures.has(signature)) {
      return;
    }
    seenSignatures.add(signature);
    ranked.push(recipe);
  });

  ranked.sort(compareRecipes);

  const deduped = ranked.filter((recipe, index, list) => {
    const earlier = list.slice(0, index);
    return !earlier.some((other) => recipe.predictedHex === other.predictedHex && componentOverlap(recipe.components, other.components) === recipe.components.length && other.components.length <= recipe.components.length);
  });

  const enriched = deduped.slice(0, Math.max(limit * 3, limit)).map((recipe) => ({
    ...recipe,
    whyThisRanked: buildRecipeWhyThisRanked(recipe.scoreBreakdown, recipe.targetAnalysis, recipe.predictedAnalysis, paints, recipe.components.map((component) => component.paintId)),
    guidanceText: buildRecipeGuidance(recipe.scoreBreakdown, recipe.targetAnalysis, recipe.predictedAnalysis, paints, recipe.components.map((component) => component.paintId), recipe.practicalRatioText),
    mixStrategy: buildMixStrategy(paints, recipe.components, recipe.targetAnalysis, recipe.practicalRatioText),
  }));

  return assignRecipeBadges(enriched).slice(0, limit);
};
