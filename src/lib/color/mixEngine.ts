import type {
  ColorAnalysis,
  LinearRgbColor,
  Paint,
  RankedRecipe,
  RecipeComponent,
  RecipeScoreBreakdown,
  UserSettings,
} from '../../types/models';
import { simplifyRatio } from '../utils/ratio';
import { analyzeColor, hueDifference } from './colorAnalysis';
import { colorDistance, hexToRgb, linearRgbToSrgbRgb, rgbToHex, srgbRgbToLinearRgb } from './colorMath';
import { assignRecipeBadges, buildMixStrategy, buildRecipeGuidance, buildRecipeWhyThisRanked, determineRecipeQuality } from './guidance';

export type WeightCombination = number[];

export type CandidateMix = {
  paintIds: string[];
  weights: number[];
};

type RankedRecipeCandidate = RankedRecipe & {
  predictedLinear: LinearRgbColor;
};

const mixLinearColors = (colors: LinearRgbColor[], weights: number[]): LinearRgbColor => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return colors.reduce(
    (accumulator, color, index) => ({
      r: accumulator.r + (color.r * weights[index]) / totalWeight,
      g: accumulator.g + (color.g * weights[index]) / totalWeight,
      b: accumulator.b + (color.b * weights[index]) / totalWeight,
    }),
    { r: 0, g: 0, b: 0 },
  );
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

export const generateCandidateMixes = (paints: Paint[], maxPaintsPerRecipe: number, step: number): CandidateMix[] => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const candidates: CandidateMix[] = [];

  for (let size = 1; size <= Math.min(maxPaintsPerRecipe, enabledPaints.length); size += 1) {
    const groups = choosePaintGroups(enabledPaints, size);
    const weightSets = generateWeightCombinations(size, step);

    groups.forEach((group) => {
      weightSets.forEach((weights) => {
        candidates.push({
          paintIds: group.map((paint) => paint.id),
          weights,
        });
      });
    });
  }

  return candidates;
};

const buildRecipeText = (paintNames: string[], parts: number[]): string =>
  paintNames.map((name, index) => `${parts[index]} part${parts[index] === 1 ? '' : 's'} ${name}`).join(' + ');

const recipeSignature = (components: RecipeComponent[]): string =>
  [...components]
    .sort((left, right) => left.paintId.localeCompare(right.paintId))
    .map((component) => `${component.paintId}:${component.percentage}`)
    .join('|');

const componentOverlap = (left: RecipeComponent[], right: RecipeComponent[]): number => {
  const leftIds = new Set(left.map((component) => component.paintId));
  return right.filter((component) => leftIds.has(component.paintId)).length;
};

const buildComponents = (paintIds: string[], weights: number[]): RecipeComponent[] =>
  paintIds
    .map((paintId, index) => ({
      paintId,
      weight: weights[index],
      percentage: weights[index],
    }))
    .sort((left, right) => right.percentage - left.percentage || left.paintId.localeCompare(right.paintId));

const getComplexityPenalty = (settings: UserSettings, paints: Paint[], components: RecipeComponent[]): number => {
  if (settings.rankingMode === 'strict-closest-color') {
    return 0;
  }

  const recipeComplexity = components.length - 1;
  const dominancePenalty = components.reduce((sum, component) => {
    const paint = paints.find((item) => item.id === component.paintId);
    return sum + (paint?.heuristics?.dominancePenalty ?? 0) * (component.percentage / 100);
  }, 0);
  const modeWeight = settings.rankingMode === 'simpler-recipes-preferred' ? 0.07 : 0.022;

  return recipeComplexity * modeWeight + dominancePenalty * 0.015;
};

const getBlackPenalty = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
  if (!settings.singlePaintPenaltySettings.discourageBlackOnlyMatches || components.length !== 1) {
    return 0;
  }

  const paint = paints.find((item) => item.id === components[0]?.paintId);
  if (!paint?.isBlack) {
    return 0;
  }

  const hueWeight = targetAnalysis.hueFamily === 'neutral' ? 0.02 : 0.11;
  const saturationWeight = targetAnalysis.saturationClassification === 'neutral' ? 0.02 : 0.05;
  return hueWeight + saturationWeight;
};

const getWhitePenalty = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
  if (!settings.singlePaintPenaltySettings.discourageWhiteOnlyMatches || components.length !== 1) {
    return 0;
  }

  const paint = paints.find((item) => item.id === components[0]?.paintId);
  if (!paint?.isWhite) {
    return 0;
  }

  if (targetAnalysis.valueClassification === 'very light' && targetAnalysis.saturationClassification === 'neutral') {
    return 0.01;
  }

  return targetAnalysis.valueClassification === 'very light' ? 0.06 : 0.14;
};

const getSinglePaintPenalty = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
): number => {
  if (!settings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose || components.length !== 1) {
    return 0;
  }

  const paint = paints.find((item) => item.id === components[0]?.paintId);
  if (!paint || paint.isBlack || paint.isWhite) {
    return 0;
  }

  const mutedMismatch = targetAnalysis.saturationClassification !== predictedAnalysis.saturationClassification ? 0.03 : 0;
  const neutralPreference = targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral' ? 0.02 : 0;
  return mutedMismatch + neutralPreference;
};

const getEarthToneBonus = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const hasEarthPaint = components.some((component) => paints.find((paint) => paint.id === component.paintId)?.heuristics?.naturalBias === 'earth');
  if (!hasEarthPaint) {
    return 0;
  }

  if (targetAnalysis.saturationClassification === 'neutral') {
    return 0.05;
  }

  if (targetAnalysis.saturationClassification === 'muted') {
    return 0.035;
  }

  return 0;
};

export const scoreRecipe = (
  settings: UserSettings,
  paints: Paint[],
  targetAnalysis: ColorAnalysis,
  targetLinear: LinearRgbColor,
  predictedAnalysis: ColorAnalysis,
  predictedLinear: LinearRgbColor,
  components: RecipeComponent[],
): RecipeScoreBreakdown => {
  const baseDistance = colorDistance(targetLinear, predictedLinear);
  const valueDifference = Math.abs(targetAnalysis.value - predictedAnalysis.value);
  const hueDelta = hueDifference(targetAnalysis.hue, predictedAnalysis.hue);
  const saturationDifference = Math.abs(targetAnalysis.saturation - predictedAnalysis.saturation);

  if (settings.rankingMode === 'strict-closest-color') {
    return {
      mode: settings.rankingMode,
      baseDistance,
      valueDifference,
      hueDifference: hueDelta,
      saturationDifference,
      complexityPenalty: 0,
      blackPenalty: 0,
      whitePenalty: 0,
      singlePaintPenalty: 0,
      earthToneBonus: 0,
      finalScore: baseDistance,
    };
  }

  const complexityPenalty = getComplexityPenalty(settings, paints, components);
  const blackPenalty = getBlackPenalty(settings, paints, components, targetAnalysis);
  const whitePenalty = getWhitePenalty(settings, paints, components, targetAnalysis);
  const singlePaintPenalty = getSinglePaintPenalty(settings, paints, components, targetAnalysis, predictedAnalysis);
  const earthToneBonus = getEarthToneBonus(paints, components, targetAnalysis);
  const modeMultiplier = settings.rankingMode === 'simpler-recipes-preferred' ? 1.6 : 1;

  const finalScore =
    baseDistance * 0.62 +
    valueDifference * 0.22 +
    hueDelta * 0.12 +
    saturationDifference * 0.08 +
    complexityPenalty * modeMultiplier +
    blackPenalty +
    whitePenalty +
    singlePaintPenalty -
    earthToneBonus;

  return {
    mode: settings.rankingMode,
    baseDistance,
    valueDifference,
    hueDifference: hueDelta,
    saturationDifference,
    complexityPenalty,
    blackPenalty,
    whitePenalty,
    singlePaintPenalty,
    earthToneBonus,
    finalScore,
  };
};

const shouldReplaceDuplicate = (existing: RankedRecipeCandidate, candidate: RankedRecipeCandidate): boolean => {
  const existingOverlap = componentOverlap(existing.components, candidate.components);
  const nearColor = colorDistance(existing.predictedLinear, candidate.predictedLinear) < 0.03;
  const overlappingSets = existingOverlap >= Math.min(existing.components.length, candidate.components.length) - 1;

  if (!nearColor || !overlappingSets) {
    return false;
  }

  if (candidate.components.length < existing.components.length && candidate.scoreBreakdown.finalScore <= existing.scoreBreakdown.finalScore + 0.03) {
    return true;
  }

  return candidate.scoreBreakdown.finalScore < existing.scoreBreakdown.finalScore;
};

const dedupeRankedRecipes = (recipes: RankedRecipeCandidate[], limit: number): RankedRecipe[] => {
  const diverse: RankedRecipeCandidate[] = [];

  recipes.forEach((recipe) => {
    const duplicateIndex = diverse.findIndex((existing) => shouldReplaceDuplicate(existing, recipe) || shouldReplaceDuplicate(recipe, existing));

    if (duplicateIndex === -1) {
      diverse.push(recipe);
      return;
    }

    if (shouldReplaceDuplicate(diverse[duplicateIndex], recipe)) {
      diverse[duplicateIndex] = recipe;
    }
  });

  return diverse.slice(0, limit).map(({ predictedLinear: _predictedLinear, ...recipe }) => recipe);
};

export const rankRecipes = (
  targetHex: string,
  paints: Paint[],
  settings: UserSettings,
  limit = 4,
): RankedRecipe[] => {
  const targetRgb = hexToRgb(targetHex);
  const targetAnalysis = analyzeColor(targetHex);
  if (!targetRgb || !targetAnalysis) {
    return [];
  }

  const targetLinear = srgbRgbToLinearRgb(targetRgb);
  const paintMap = new Map(
    paints.map((paint) => {
      const rgb = hexToRgb(paint.hex);
      return [paint.id, rgb ? srgbRgbToLinearRgb(rgb) : null] as const;
    }),
  );
  const paintNameMap = new Map(paints.map((paint) => [paint.id, paint.name]));

  const ranked = generateCandidateMixes(paints, settings.maxPaintsPerRecipe, settings.weightStep)
    .map((candidate) => {
      const colors = candidate.paintIds.map((paintId) => paintMap.get(paintId));
      if (colors.some((color) => !color)) {
        return null;
      }

      const mixedLinear = mixLinearColors(colors as LinearRgbColor[], candidate.weights);
      const predictedHex = rgbToHex(linearRgbToSrgbRgb(mixedLinear));
      const predictedAnalysis = analyzeColor(predictedHex);
      if (!predictedAnalysis) {
        return null;
      }

      const components = buildComponents(candidate.paintIds, candidate.weights);
      const scoreBreakdown = scoreRecipe(
        settings,
        paints,
        targetAnalysis,
        targetLinear,
        predictedAnalysis,
        mixedLinear,
        components,
      );
      const orderedPaintNames = components.map((component) => paintNameMap.get(component.paintId) ?? component.paintId);
      const orderedWeights = components.map((component) => component.weight);
      const parts = simplifyRatio(orderedWeights);

      const recipe = {
        predictedHex,
        distanceScore: scoreBreakdown.finalScore,
        components,
        parts,
        ratioText: parts.join(':'),
        recipeText: buildRecipeText(orderedPaintNames, parts),
        scoreBreakdown,
        qualityLabel: determineRecipeQuality(scoreBreakdown.finalScore),
        badges: [],
        guidanceText: [],
        targetAnalysis,
        predictedAnalysis,
        whyThisRanked: [],
        mixStrategy: [],
        predictedLinear: mixedLinear,
      } satisfies RankedRecipeCandidate;

      recipe.guidanceText = buildRecipeGuidance(scoreBreakdown, targetAnalysis, predictedAnalysis, paints, components.map((component) => component.paintId));
      recipe.whyThisRanked = buildRecipeWhyThisRanked(scoreBreakdown, targetAnalysis, predictedAnalysis, paints, components.map((component) => component.paintId));
      recipe.mixStrategy = buildMixStrategy(paints, recipe.components, targetAnalysis);

      return recipe;
    })
    .filter((candidate): candidate is RankedRecipeCandidate => candidate !== null)
    .sort((left, right) => {
      if (left.scoreBreakdown.finalScore !== right.scoreBreakdown.finalScore) {
        return left.scoreBreakdown.finalScore - right.scoreBreakdown.finalScore;
      }
      if (left.scoreBreakdown.baseDistance !== right.scoreBreakdown.baseDistance) {
        return left.scoreBreakdown.baseDistance - right.scoreBreakdown.baseDistance;
      }
      return recipeSignature(left.components).localeCompare(recipeSignature(right.components));
    });

  return assignRecipeBadges(dedupeRankedRecipes(ranked, limit));
};
