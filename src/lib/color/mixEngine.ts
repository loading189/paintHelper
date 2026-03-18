import type {
  ColorAnalysis,
  HueFamily,
  LinearRgbColor,
  Paint,
  RankedRecipe,
  RecipeComponent,
  RecipeScoreBreakdown,
  UserSettings,
} from '../../types/models';
import { formatRatio, practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';
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

const isPainterMode = (settings: UserSettings): boolean => settings.rankingMode !== 'strict-closest-color';

const isChromaticTarget = (targetAnalysis: ColorAnalysis): boolean => targetAnalysis.hueFamily !== 'neutral';

const adjacentHueFamilies: Record<Exclude<HueFamily, 'neutral'>, HueFamily[]> = {
  red: ['orange', 'violet'],
  orange: ['red', 'yellow'],
  yellow: ['orange', 'green'],
  green: ['yellow', 'blue'],
  blue: ['green', 'violet'],
  violet: ['red', 'blue'],
};

const classifyHueFamilyBand = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): 'same' | 'adjacent' | 'wrong' | 'neutralized' => {
  if (!isChromaticTarget(targetAnalysis)) {
    return 'same';
  }

  if (predictedAnalysis.hueFamily === 'neutral') {
    return 'neutralized';
  }

  const hueDelta = hueDifference(targetAnalysis.hue, predictedAnalysis.hue);

  if (predictedAnalysis.hueFamily === targetAnalysis.hueFamily) {
    return 'same';
  }

  const adjacentFamilies = adjacentHueFamilies[targetAnalysis.hueFamily as Exclude<HueFamily, 'neutral'>] ?? [];
  if (adjacentFamilies.includes(predictedAnalysis.hueFamily) && hueDelta <= 0.18) {
    return 'adjacent';
  }

  return 'wrong';
};

const getPaintRoleFamily = (paint: Paint): HueFamily => {
  const normalizedName = paint.name.toLowerCase();
  if (paint.isBlack || paint.isWhite) {
    return 'neutral';
  }
  if (normalizedName.includes('yellow')) {
    return 'yellow';
  }
  if (normalizedName.includes('blue')) {
    return 'blue';
  }
  if (normalizedName.includes('violet') || normalizedName.includes('purple')) {
    return 'violet';
  }
  if (normalizedName.includes('green')) {
    return 'green';
  }
  if (normalizedName.includes('orange')) {
    return 'orange';
  }
  if (normalizedName.includes('red') || normalizedName.includes('crimson') || normalizedName.includes('magenta')) {
    return 'red';
  }

  return analyzeColor(paint.hex)?.hueFamily ?? 'neutral';
};

const getPaintHueFamilies = (paints: Paint[], components: RecipeComponent[]): HueFamily[] => {
  const families = components
    .map((component) => paints.find((paint) => paint.id === component.paintId))
    .filter((paint): paint is Paint => Boolean(paint))
    .map((paint) => getPaintRoleFamily(paint));

  return [...new Set(families)];
};

const getRequiredConstructionFamilies = (targetAnalysis: ColorAnalysis): HueFamily[] => {
  if (targetAnalysis.hueFamily === 'green') {
    return ['yellow', 'blue'];
  }

  if (targetAnalysis.hueFamily === 'orange') {
    return ['yellow', 'red'];
  }

  if (targetAnalysis.hueFamily === 'violet') {
    return ['red', 'blue'];
  }

  return [];
};

const hasRequiredHueConstructionPath = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): boolean => {
  const requiredFamilies = getRequiredConstructionFamilies(targetAnalysis);
  if (requiredFamilies.length === 0) {
    return true;
  }

  const chromaticFamilies = getPaintHueFamilies(paints, components);
  return requiredFamilies.every((family) => chromaticFamilies.includes(family));
};

const staysInBroadHueFamily = (
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
): boolean => {
  const band = classifyHueFamilyBand(targetAnalysis, predictedAnalysis);

  // 🔴 VIVID TARGETS → STRICT MATCH ONLY
  if (targetAnalysis.saturationClassification === 'vivid') {
    return band === 'same';
  }

  // 🟡 MODERATE → allow adjacent
  if (targetAnalysis.saturationClassification === 'moderate') {
    return band === 'same' || band === 'adjacent';
  }

  // 🟤 MUTED / NEUTRAL → more forgiving
  return band !== 'wrong';
};

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

const getHueFamilyPenalty = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
): number => {
  if (!isPainterMode(settings) || !isChromaticTarget(targetAnalysis)) {
    return 0;
  }

  if (staysInBroadHueFamily(targetAnalysis, predictedAnalysis)) {
    return 0;
  }

  const hueBand = classifyHueFamilyBand(targetAnalysis, predictedAnalysis);
  if (hueBand === 'adjacent') {
    return 0.08;
  }

  if (hueBand === 'neutralized') {
    return 0.38;
  }

  return 0.32;
};

const getRequiredHueConstructionPenalty = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
  if (!isPainterMode(settings) || !isChromaticTarget(targetAnalysis)) {
    return 0;
  }

  const requiredFamilies = getRequiredConstructionFamilies(targetAnalysis);
  if (requiredFamilies.length === 0 || hasRequiredHueConstructionPath(paints, components, targetAnalysis)) {
    return 0;
  }

  if (targetAnalysis.hueFamily === 'green') {
    return 0.24;
  }

  return 0.16;
};

const getPainterFamilyConstructionBonus = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
  if (!isPainterMode(settings) || !isChromaticTarget(targetAnalysis)) {
    return 0;
  }

  const requiredFamilies = getRequiredConstructionFamilies(targetAnalysis);
  if (requiredFamilies.length === 0 || !hasRequiredHueConstructionPath(paints, components, targetAnalysis)) {
    return 0;
  }

  if (targetAnalysis.hueFamily === 'green') {
    return 0.04;
  }

  return 0.03;
};

const getBlackDominancePenalty = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
): number => {
  if (!isPainterMode(settings) || !isChromaticTarget(targetAnalysis)) {
    return 0;
  }

  const blackShare = components.reduce((sum, component) => {
    const paint = paints.find((item) => item.id === component.paintId);
    return paint?.isBlack ? sum + component.percentage : sum;
  }, 0);

  if (blackShare <= 50) {
    return 0;
  }

  const preservesHueFamily = staysInBroadHueFamily(targetAnalysis, predictedAnalysis);
  const hasConstructionPath = hasRequiredHueConstructionPath(paints, components, targetAnalysis);
  const qualifiesForException = preservesHueFamily && hasConstructionPath;

  if (blackShare > 70) {
    return qualifiesForException ? 0.11 : 0.28;
  }

  return qualifiesForException ? 0.05 : 0.16;
};

const getChromaticPathBonus = (
  settings: UserSettings,
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
  if (!isPainterMode(settings) || !isChromaticTarget(targetAnalysis)) {
    return 0;
  }

  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const componentPaints = components
    .map((component) => paintMap.get(component.paintId))
    .filter((paint): paint is Paint => Boolean(paint));
  const hasEarthSupport = componentPaints.some((paint) => paint.heuristics?.naturalBias === 'earth');
  const hasBlackSupport = componentPaints.some((paint) => paint.isBlack);

  if (!hasRequiredHueConstructionPath(paints, components, targetAnalysis)) {
    return 0;
  }

  if (targetAnalysis.hueFamily === 'green') {
    return targetAnalysis.valueClassification === 'dark' || targetAnalysis.valueClassification === 'very dark'
      ? 0.03 + (hasEarthSupport || hasBlackSupport ? 0.01 : 0)
      : 0.025;
  }

  if (targetAnalysis.hueFamily === 'orange' || targetAnalysis.hueFamily === 'violet') {
    return 0.02;
  }

  return 0;
};

const getVividTargetSanityPenalty = (
  settings: UserSettings,
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
): number => {
  if (
    !isPainterMode(settings) ||
    !isChromaticTarget(targetAnalysis) ||
    targetAnalysis.saturationClassification !== 'vivid'
  ) {
    return 0;
  }

    // extra punishment if hue is drifting toward yellow for green targets
  if (
    targetAnalysis.hueFamily === 'green' &&
    predictedAnalysis.hue !== null &&
    predictedAnalysis.hue < 90 // drifting toward yellow
  ) {
    return 0.25;
  }

  const hueBand = classifyHueFamilyBand(targetAnalysis, predictedAnalysis);
  if (hueBand === 'same') {
    return 0;
  }

  if (hueBand === 'adjacent') {
    return 0.14;
  }

  if (hueBand === 'neutralized') {
    return 0.42;
  }

  return 0.34;
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
      hueFamilyPenalty: 0,
      requiredHueConstructionPenalty: 0,
      painterFamilyConstructionBonus: 0,
      blackDominancePenalty: 0,
      chromaticPathBonus: 0,
      vividTargetSanityPenalty: 0,
      hasRequiredHueConstructionPath: hasRequiredHueConstructionPath(paints, components, targetAnalysis),
      staysInTargetHueFamily: staysInBroadHueFamily(targetAnalysis, predictedAnalysis),
      finalScore: baseDistance,
    };
  }

  const complexityPenalty = getComplexityPenalty(settings, paints, components);
  const blackPenalty = getBlackPenalty(settings, paints, components, targetAnalysis);
  const whitePenalty = getWhitePenalty(settings, paints, components, targetAnalysis);
  const singlePaintPenalty = getSinglePaintPenalty(settings, paints, components, targetAnalysis, predictedAnalysis);
  const earthToneBonus = getEarthToneBonus(paints, components, targetAnalysis);
  const hueFamilyPenalty = getHueFamilyPenalty(settings, paints, components, targetAnalysis, predictedAnalysis);
  const requiredHueConstructionPenalty = getRequiredHueConstructionPenalty(settings, paints, components, targetAnalysis);
  const painterFamilyConstructionBonus = getPainterFamilyConstructionBonus(settings, paints, components, targetAnalysis);
  const blackDominancePenalty = getBlackDominancePenalty(settings, paints, components, targetAnalysis, predictedAnalysis);
  const chromaticPathBonus = getChromaticPathBonus(settings, paints, components, targetAnalysis);
  const vividTargetSanityPenalty = getVividTargetSanityPenalty(settings, targetAnalysis, predictedAnalysis);
  const modeMultiplier = settings.rankingMode === 'simpler-recipes-preferred' ? 1.6 : 1;
  const staysInTargetHueFamily = staysInBroadHueFamily(targetAnalysis, predictedAnalysis);
  const hasConstructionPath = hasRequiredHueConstructionPath(paints, components, targetAnalysis);

  const finalScore =
    baseDistance * 0.33 +
    valueDifference * 0.2 +
    hueDelta * 0.24 +
    saturationDifference * 0.16 +
    complexityPenalty * modeMultiplier +
    blackPenalty +
    whitePenalty +
    singlePaintPenalty +
    hueFamilyPenalty +
    requiredHueConstructionPenalty +
    blackDominancePenalty -
    earthToneBonus -
    painterFamilyConstructionBonus -
    chromaticPathBonus +
    vividTargetSanityPenalty;

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
    hueFamilyPenalty,
    requiredHueConstructionPenalty,
    painterFamilyConstructionBonus,
    blackDominancePenalty,
    chromaticPathBonus,
    vividTargetSanityPenalty,
    hasRequiredHueConstructionPath: hasConstructionPath,
    staysInTargetHueFamily,
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
      const exactParts = simplifyRatio(orderedWeights);
      const practicalParts = practicalRatioFromWeights(orderedWeights);
      const exactRatioText = formatRatio(exactParts);
      const practicalRatioText = formatRatio(practicalParts);

      const recipe: RankedRecipeCandidate = {
        predictedHex,
        distanceScore: scoreBreakdown.finalScore,
        components,
        exactParts,
        exactRatioText,
        practicalParts,
        practicalRatioText,
        parts: practicalParts,
        ratioText: practicalRatioText,
        recipeText: buildRecipeText(orderedPaintNames, practicalParts),
        scoreBreakdown,
        qualityLabel: determineRecipeQuality(scoreBreakdown.finalScore),
        badges: [],
        guidanceText: [],
        targetAnalysis,
        predictedAnalysis,
        whyThisRanked: [],
        mixStrategy: [],
        predictedLinear: mixedLinear,
      };

      recipe.guidanceText = buildRecipeGuidance(
        scoreBreakdown,
        targetAnalysis,
        predictedAnalysis,
        paints,
        components.map((component) => component.paintId),
        practicalRatioText,
      );
      recipe.whyThisRanked = buildRecipeWhyThisRanked(scoreBreakdown, targetAnalysis, predictedAnalysis, paints, components.map((component) => component.paintId));
      recipe.mixStrategy = buildMixStrategy(paints, recipe.components, targetAnalysis, practicalRatioText);

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
