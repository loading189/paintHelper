import type {
  ColorAnalysis,
  HueFamily,
  Paint,
  RankedRecipe,
  RecipeComponent,
  RecipeScoreBreakdown,
  UserSettings,
} from '../../types/models';
import { generateAdjustmentSuggestions, generateNextAdjustments } from './adjustmentEngine';
import {
  analyzeColor,
  hueDifference,
  isBlueVioletBoundaryTarget,
  isCoolMutedNeutralTarget,
  isDarkChromaticWarmTarget,
  isDarkEarthWarmTarget,
  isDarkMutedGreenTarget,
  isDarkNaturalGreenTarget,
  isDarkValueTarget,
  isLightValueTarget,
  isLightWarmNeutralTarget,
  isNearBlackChromaticGreenTarget,
  isNearBlackChromaticTarget,
  isOliveGreenTarget,
  isRedBrownOrangeCrossoverTarget,
  isVeryDarkValueTarget,
  isYellowGreenBoundaryTarget,
} from './colorAnalysis';
import { assessAchievability } from './achievability';
import { assignRecipeBadges, buildMixStrategy, buildRecipeGuidance, buildRecipeWhyThisRanked, determineRecipeQuality } from './guidance';
import { buildLayeringSuggestion, buildMixPath, buildRoleNotes, buildStabilityWarnings } from './mixPathEngine';
import { predictSpectralMix, spectralDistanceBetweenHexes } from './spectralMixing';
import { distributePercentages, formatRatio, practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';
import { getInverseSearchTuning } from './inverseSearchTuning';
import { solveTarget } from './inverse/solveTarget';
import { getIdealPalette, getOnHandPalette } from './paletteMode';
import { solveWithPalettes } from './paletteSolver';

export type WeightCombination = number[];
export type CandidateMix = { paintIds: string[]; weights: number[] };

type RankedRecipeCandidate = RankedRecipe;
type OrderedMixEntry = { paintId: string; weight: number };

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

const buildOrderedEntries = (paintIds: string[], weights: number[]): OrderedMixEntry[] =>
  paintIds
    .map((paintId, index) => ({ paintId, weight: weights[index] }))
    .sort((left, right) => right.weight - left.weight || left.paintId.localeCompare(right.paintId));

const buildComponents = (entries: OrderedMixEntry[]): RecipeComponent[] =>
  entries.map((entry) => ({ paintId: entry.paintId, weight: entry.weight, percentage: entry.weight }));

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

const isEarthPaint = (paint: Paint): boolean => paint.heuristics?.naturalBias === 'earth';

const isStructuralEarthForTarget = (paint: Paint, targetAnalysis: ColorAnalysis): boolean =>
  isEarthPaint(paint) &&
  (isDarkEarthWarmTarget(targetAnalysis) ||
    isDarkNaturalGreenTarget(targetAnalysis) ||
    (isDarkValueTarget(targetAnalysis) && isOliveLikeTarget(targetAnalysis)) ||
    isRedBrownOrangeCrossoverTarget(targetAnalysis));

const isWarmHueBuilderPaint = (paint: Paint): boolean => {
  const family = getPaintRoleFamily(paint);
  return family === 'red' || family === 'yellow' || family === 'orange';
};

const hasTargetAwareConstructionPath = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): boolean => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const families = getPaintFamilies(paints, components);
  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));

  if (isDarkEarthWarmTarget(targetAnalysis)) {
    return families.includes('red') && families.includes('yellow') && stats.earthShare > 0;
  }

  if (isDarkNaturalGreenTarget(targetAnalysis)) {
    const hasOliveNearBlackPath =
      isNearBlackChromaticTarget(targetAnalysis) &&
      isOliveLikeTarget(targetAnalysis) &&
      stats.earthShare > 0 &&
      stats.yellowShare > 0 &&
      stats.blackShare > 0;
    const hasGreenPath = stats.greenShare > 0 || (families.includes('yellow') && families.includes('blue')) || hasOliveNearBlackPath;
    const earthStructured = stats.earthShare > 0;
    const blackOnlySeat = isNearBlackChromaticGreenTarget(targetAnalysis) && stats.blackShare > 0 && stats.blackShare <= 8 && stats.earthShare > 0;
    return hasGreenPath && (earthStructured || blackOnlySeat) && stats.whiteShare + stats.warmLightenerShare === 0;
  }

  if (isNearBlackChromaticTarget(targetAnalysis)) {
    const chromaticShare = components.reduce((sum, component) => {
      const paint = paintMap.get(component.paintId);
      if (!paint || paint.isBlack || paint.isWhite || paint.heuristics?.preferredRole === 'neutralizer') {
        return sum;
      }
      return sum + component.percentage;
    }, 0);

    return hasRequiredHueConstructionPath(paints, components, targetAnalysis) && chromaticShare > stats.blackShare;
  }

  if (isLightWarmNeutralTarget(targetAnalysis)) {
    return stats.whiteShare + stats.warmLightenerShare > 0 && (stats.yellowShare > 0 || stats.redShare > 0 || stats.earthShare > 0);
  }

  if (isCoolMutedNeutralTarget(targetAnalysis)) {
    return stats.blueShare > 0 && (stats.earthShare > 0 || stats.blackShare > 0 || stats.whiteShare > 0);
  }

  return hasRequiredHueConstructionPath(paints, components, targetAnalysis);
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

const isChromaticTarget = (targetAnalysis: ColorAnalysis): boolean => targetAnalysis.hueFamily !== 'neutral';

const isNearYellowGreen = (targetAnalysis: ColorAnalysis): boolean =>
  targetAnalysis.hue !== null && targetAnalysis.hue >= 96;

const isLightYellowFamilyTarget = (targetAnalysis: ColorAnalysis): boolean =>
  targetAnalysis.hueFamily === 'yellow' && isLightValueTarget(targetAnalysis);

const isLightCreamOrOrangeTarget = (targetAnalysis: ColorAnalysis): boolean =>
  isLightValueTarget(targetAnalysis) &&
  (targetAnalysis.hueFamily === 'orange' ||
    (targetAnalysis.hueFamily === 'yellow' && targetAnalysis.saturationClassification !== 'vivid'));

const isPainterFriendlyYellowLighteningTarget = (targetAnalysis: ColorAnalysis): boolean =>
  isLightYellowFamilyTarget(targetAnalysis) || isLightCreamOrOrangeTarget(targetAnalysis);

const isVeryLightYellowFamilyTarget = (targetAnalysis: ColorAnalysis): boolean =>
  targetAnalysis.hueFamily === 'yellow' && targetAnalysis.valueClassification === 'very light';

const isYellowGreenTarget = (targetAnalysis: ColorAnalysis): boolean =>
  isYellowGreenBoundaryTarget(targetAnalysis) ||
  (targetAnalysis.hueFamily === 'green' && targetAnalysis.hue !== null && targetAnalysis.hue <= 132);

const isVividGreenTarget = (targetAnalysis: ColorAnalysis): boolean =>
  targetAnalysis.hueFamily === 'green' && targetAnalysis.saturationClassification === 'vivid';

const shouldHeavilyRestrictBlueForTarget = (targetAnalysis: ColorAnalysis): boolean =>
  isPainterFriendlyYellowLighteningTarget(targetAnalysis) && !isNearYellowGreen(targetAnalysis);

const isOliveLikeTarget = (targetAnalysis: ColorAnalysis): boolean => isOliveGreenTarget(targetAnalysis);

const getBlueFamilyRestrictionMax = (paint: Paint, targetAnalysis: ColorAnalysis): number | null => {
  const name = paint.name.toLowerCase();

  if (name.includes('phthalo blue')) {
    if (shouldHeavilyRestrictBlueForTarget(targetAnalysis)) return 5;
    if (isLightYellowFamilyTarget(targetAnalysis) && isNearYellowGreen(targetAnalysis)) return 10;
  }

  if (name.includes('ultramarine blue')) {
    if (shouldHeavilyRestrictBlueForTarget(targetAnalysis)) return 0;
    if (isLightYellowFamilyTarget(targetAnalysis) && isNearYellowGreen(targetAnalysis)) return 10;
  }

  return null;
};

const isDarkCapablePaint = (paint: Paint, targetAnalysis: ColorAnalysis): boolean =>
  paint.isBlack ||
  isEarthPaint(paint) ||
  (isNearBlackChromaticTarget(targetAnalysis) &&
    !paint.isWhite &&
    paint.heuristics?.preferredRole !== 'neutralizer' &&
    (getPaintRoleFamily(paint) === 'blue' || getPaintRoleFamily(paint) === 'red' || getPaintRoleFamily(paint) === 'green'));

const getTargetAwareMaxShare = (paint: Paint, targetAnalysis: ColorAnalysis): number => {
  const baseMaxShare = paint.heuristics?.recommendedMaxShare ?? 100;
  const name = paint.name.toLowerCase();
  const saturation = targetAnalysis.saturationClassification;
  const value = targetAnalysis.valueClassification;
  const chromaticTarget = isChromaticTarget(targetAnalysis);

  if (name.includes('phthalo blue')) {
    const restrictedBlueMax = getBlueFamilyRestrictionMax(paint, targetAnalysis);
    if (restrictedBlueMax !== null) {
      return Math.min(baseMaxShare, restrictedBlueMax);
    }
    if (targetAnalysis.hueFamily === 'green' || targetAnalysis.hueFamily === 'blue') {
      if (saturation === 'vivid') return Math.min(baseMaxShare, 35);
      if (saturation === 'moderate') return Math.min(baseMaxShare, 28);
      return Math.min(baseMaxShare, 18);
    }
    if (targetAnalysis.hueFamily === 'violet') {
      return Math.min(baseMaxShare, saturation === 'vivid' ? 26 : 20);
    }
    return Math.min(baseMaxShare, saturation === 'vivid' ? 24 : 16);
  }

  if (name.includes('ultramarine blue')) {
    const restrictedBlueMax = getBlueFamilyRestrictionMax(paint, targetAnalysis);
    if (restrictedBlueMax !== null) {
      return Math.min(baseMaxShare, restrictedBlueMax);
    }
  }

  if (paint.isBlack) {
    if (isNearBlackChromaticTarget(targetAnalysis)) {
      return Math.min(baseMaxShare, isVeryDarkValueTarget(targetAnalysis) ? 35 : 28);
    }
    if (isDarkEarthWarmTarget(targetAnalysis) || isDarkChromaticWarmTarget(targetAnalysis)) {
      return Math.min(baseMaxShare, 12);
    }
    if (!chromaticTarget) {
      return Math.min(baseMaxShare, value === 'very dark' || value === 'dark' ? 25 : 18);
    }
    if (saturation === 'vivid') return Math.min(baseMaxShare, 10);
    if (saturation === 'moderate') return Math.min(baseMaxShare, 12);
    return Math.min(baseMaxShare, value === 'very dark' || value === 'dark' ? 18 : 15);
  }

  if (paint.isWhite) {
    if (!chromaticTarget) {
      return Math.min(baseMaxShare, value === 'very light' ? 60 : 40);
    }
    if (saturation === 'vivid') {
      if (value === 'very light') return Math.min(baseMaxShare, 35);
      if (value === 'light') return Math.min(baseMaxShare, 20);
      return Math.min(baseMaxShare, 10);
    }
    if (saturation === 'moderate') {
      if (isPainterFriendlyYellowLighteningTarget(targetAnalysis)) {
        return Math.min(baseMaxShare, value === 'very light' ? 46 : 34);
      }
      if (value === 'very light') return Math.min(baseMaxShare, 40);
      if (value === 'light') return Math.min(baseMaxShare, 24);
      return Math.min(baseMaxShare, 14);
    }
    if (isPainterFriendlyYellowLighteningTarget(targetAnalysis)) {
      return Math.min(baseMaxShare, value === 'very light' ? 52 : 34);
    }
    return Math.min(baseMaxShare, value === 'very light' ? 45 : 22);
  }

  if (name.includes('unbleached titanium')) {
    if (!chromaticTarget) {
      return Math.min(baseMaxShare, value === 'very light' || value === 'light' ? 60 : 45);
    }
    if (isPainterFriendlyYellowLighteningTarget(targetAnalysis)) {
      return Math.min(baseMaxShare, value === 'very light' ? 45 : 38);
    }
    if (saturation === 'vivid') return Math.min(baseMaxShare, 12);
    if (saturation === 'moderate') return Math.min(baseMaxShare, 18);
    return Math.min(baseMaxShare, value === 'light' || value === 'very light' ? 32 : 24);
  }

  if (name.includes('burnt umber')) {
    if (isDarkEarthWarmTarget(targetAnalysis)) return Math.min(baseMaxShare, 60);
    if (isDarkValueTarget(targetAnalysis) && isOliveLikeTarget(targetAnalysis)) return Math.min(baseMaxShare, 55);
    if (isNearBlackChromaticTarget(targetAnalysis)) return Math.min(baseMaxShare, 32);
    if (saturation === 'vivid') return Math.min(baseMaxShare, 20);
    if (saturation === 'moderate') return Math.min(baseMaxShare, 28);
    return Math.min(baseMaxShare, 45);
  }

  return baseMaxShare;
};

type RecipeStructureStats = {
  yellowShare: number;
  blueShare: number;
  redShare: number;
  greenShare: number;
  earthShare: number;
  blackShare: number;
  whiteShare: number;
  warmLightenerShare: number;
  violetShare: number;
  muddyComplementShare: number;
  yellowBlueStructureShare: number;
};

const getRecipeStructureStats = (paints: Paint[], components: RecipeComponent[]): RecipeStructureStats => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));

  return components.reduce<RecipeStructureStats>((stats, component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint) {
      return stats;
    }

    const share = component.percentage;
    const family = getPaintRoleFamily(paint);
    if (family === 'yellow') {
      stats.yellowShare += share;
    }
    if (family === 'blue') {
      stats.blueShare += share;
    }
    if (family === 'red') {
      stats.redShare += share;
    }
    if (family === 'green') {
      stats.greenShare += share;
    }
    if (family === 'violet') {
      stats.violetShare += share;
    }
    if (paint.heuristics?.naturalBias === 'earth') {
      stats.earthShare += share;
    }
    if (paint.isBlack) {
      stats.blackShare += share;
    }
    if (paint.isWhite) {
      stats.whiteShare += share;
    }
    if (!paint.isWhite && paint.name.toLowerCase().includes('unbleached titanium')) {
      stats.warmLightenerShare += share;
    }
    if (family === 'red' || paint.isBlack || paint.heuristics?.naturalBias === 'earth') {
      stats.muddyComplementShare += share;
    }

    return stats;
  }, {
    yellowShare: 0,
    blueShare: 0,
    redShare: 0,
    greenShare: 0,
    earthShare: 0,
    blackShare: 0,
    whiteShare: 0,
    warmLightenerShare: 0,
    violetShare: 0,
    muddyComplementShare: 0,
    yellowBlueStructureShare: 0,
  });
};

const withDerivedStructureStats = (stats: RecipeStructureStats): RecipeStructureStats => ({
  ...stats,
  yellowBlueStructureShare: Math.min(stats.yellowShare, stats.blueShare) + stats.greenShare,
});

const hasStructurallyPlausibleDarkValue = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): boolean => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!isDarkValueTarget(targetAnalysis)) {
    return true;
  }

  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));
  const dominantComponent = components[0];
  const dominantPaint = dominantComponent ? paintMap.get(dominantComponent.paintId) : null;
  const darkCapableShare = components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    return paint && isDarkCapablePaint(paint, targetAnalysis) ? sum + component.percentage : sum;
  }, 0);
  const lightShare = stats.whiteShare + stats.warmLightenerShare;
  const dominantFamily = dominantPaint ? getPaintRoleFamily(dominantPaint) : null;

  if (lightShare > inverseSearchTuning.darkTargets.maxLightShare) {
    return false;
  }

  if (darkCapableShare < inverseSearchTuning.darkTargets.minDarkShare) {
    return false;
  }

  if (stats.yellowShare > inverseSearchTuning.darkTargets.maxYellowShare && !isOliveGreenTarget(targetAnalysis)) {
    return false;
  }

  if (dominantPaint?.isWhite || dominantPaint?.name.toLowerCase().includes('unbleached titanium')) {
    return false;
  }

  if (dominantComponent && dominantComponent.percentage > inverseSearchTuning.darkTargets.dominantLightShareCap) {
    const dominantIsLightFamily = dominantPaint?.isWhite || dominantPaint?.name.toLowerCase().includes('unbleached titanium');
    if (dominantIsLightFamily) {
      return false;
    }
  }

  if (
    dominantComponent &&
    dominantFamily === 'yellow' &&
    dominantComponent.percentage > inverseSearchTuning.darkTargets.dominantYellowShareCap &&
    !isOliveGreenTarget(targetAnalysis)
  ) {
    return false;
  }

  if (isDarkNaturalGreenTarget(targetAnalysis) && inverseSearchTuning.greenTargets.requireEarthForDarkNatural && stats.earthShare === 0) {
    return false;
  }

  if (isNearBlackChromaticTarget(targetAnalysis) && darkCapableShare < inverseSearchTuning.darkTargets.minDarkShare + 10) {
    return false;
  }

  return true;
};

export const isPainterValidForTarget = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): boolean => {
  const inverseSearchTuning = getInverseSearchTuning();
  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const orderedPaints = components.map((component) => paintMap.get(component.paintId)).filter((paint): paint is Paint => Boolean(paint));
  const warmHueBuilderCount = orderedPaints.filter((paint) => isWarmHueBuilderPaint(paint)).length;
  const earthCount = orderedPaints.filter(isEarthPaint).length;
  const chromaticNonSupportShare = components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    if (
      !paint ||
      paint.isWhite ||
      paint.isBlack ||
      (paint.heuristics?.preferredRole === 'neutralizer' && !isStructuralEarthForTarget(paint, targetAnalysis))
    ) {
      return sum;
    }
    return sum + component.percentage;
  }, 0);

  if (isLightValueTarget(targetAnalysis) && stats.blackShare > 0) {
    return false;
  }

  if (targetAnalysis.hueFamily === 'yellow') {
    if (stats.yellowShare === 0) {
      return false;
    }
    if (isVeryLightYellowFamilyTarget(targetAnalysis) && stats.whiteShare + stats.warmLightenerShare === 0) {
      return false;
    }
    if (isLightYellowFamilyTarget(targetAnalysis)) {
      if (stats.violetShare > 0 || stats.blackShare > 0) {
        return false;
      }
      const allowedBlueShare = isYellowGreenTarget(targetAnalysis) ? 10 : inverseSearchTuning.yellows.maxBlueShareLight;
      if (stats.blueShare > allowedBlueShare) {
        return false;
      }
    }
  }

  if (isLightCreamOrOrangeTarget(targetAnalysis)) {
    if (stats.yellowShare === 0 || stats.whiteShare + stats.warmLightenerShare === 0) {
      return false;
    }
    if (stats.blackShare > 0) {
      return false;
    }
  }

  if (targetAnalysis.hueFamily === 'green') {
    if (stats.greenShare === 0 && (stats.yellowShare === 0 || stats.blueShare === 0)) {
      return false;
    }
    if (isVividGreenTarget(targetAnalysis) && stats.muddyComplementShare > 0) {
      return false;
    }
  }

  if (isDarkNaturalGreenTarget(targetAnalysis)) {
    const hasOliveNearBlackPath =
      isNearBlackChromaticTarget(targetAnalysis) &&
      isOliveLikeTarget(targetAnalysis) &&
      stats.earthShare > 0 &&
      stats.yellowShare > 0 &&
      stats.blackShare > 0;
    const hasGreenPath = stats.greenShare > 0 || (stats.yellowShare > 0 && stats.blueShare > 0) || hasOliveNearBlackPath;
    if (!hasGreenPath) {
      return false;
    }
    if (stats.whiteShare > 0 || stats.warmLightenerShare > 0) {
      return false;
    }
    if (inverseSearchTuning.greenTargets.requireEarthForDarkNatural && stats.earthShare === 0) {
      return false;
    }
    if (stats.redShare > 18) {
      return false;
    }
    if (isNearBlackChromaticGreenTarget(targetAnalysis) && stats.blackShare > 10) {
      return false;
    }
    if (hasOliveNearBlackPath && stats.blackShare > 35) {
      return false;
    }
  }

  if (isDarkEarthWarmTarget(targetAnalysis)) {
    if (stats.whiteShare > 0 || stats.warmLightenerShare > 0) {
      return false;
    }
    if (stats.earthShare === 0 || earthCount === 0) {
      return false;
    }
    if (warmHueBuilderCount < 2 || stats.redShare === 0 || stats.yellowShare === 0) {
      return false;
    }
    if (stats.blueShare > 10 || stats.violetShare > 0) {
      return false;
    }
    if (stats.earthShare >= stats.redShare + stats.yellowShare) {
      return false;
    }
  }

  if (isDarkChromaticWarmTarget(targetAnalysis) && !isDarkEarthWarmTarget(targetAnalysis)) {
    if (stats.redShare === 0) {
      return false;
    }
    if (targetAnalysis.hueFamily === 'orange' && stats.yellowShare === 0) {
      return false;
    }
    if (stats.whiteShare > 0 && !isRedBrownOrangeCrossoverTarget(targetAnalysis)) {
      return false;
    }
  }

  if (targetAnalysis.hueFamily === 'violet') {
    if (stats.blueShare === 0 || stats.redShare === 0) {
      return false;
    }
    if (targetAnalysis.saturationClassification === 'muted' && stats.yellowShare > 0) {
      return false;
    }
  }

  if (targetAnalysis.hueFamily === 'blue' && targetAnalysis.saturationClassification === 'muted') {
    if (stats.blueShare === 0) {
      return false;
    }
    if (stats.yellowShare > 10) {
      return false;
    }
  }

  if (isLightWarmNeutralTarget(targetAnalysis)) {
    if (stats.whiteShare + stats.warmLightenerShare === 0) {
      return false;
    }
    if (stats.blackShare > 0) {
      return false;
    }
    if (stats.yellowShare + stats.redShare + stats.earthShare === 0) {
      return false;
    }
  }

  if (isCoolMutedNeutralTarget(targetAnalysis)) {
    if (stats.blueShare === 0) {
      return false;
    }
    if (stats.yellowShare > 20 || stats.redShare > 20) {
      return false;
    }
  }

  if (isNearBlackChromaticTarget(targetAnalysis) && chromaticNonSupportShare <= stats.blackShare) {
    return false;
  }

  if (!hasStructurallyPlausibleDarkValue(paints, components, targetAnalysis)) {
    return false;
  }

  return true;
};

const isSupportPaintForTarget = (paint: Paint, targetAnalysis: ColorAnalysis): boolean => {
  if (isStructuralEarthForTarget(paint, targetAnalysis)) return false;
  if (paint.isBlack) return true;
  if (paint.heuristics?.preferredRole === 'neutralizer') return true;
  if (isChromaticTarget(targetAnalysis) && (paint.isWhite || paint.name.includes('Unbleached Titanium') || paint.heuristics?.preferredRole === 'lightener')) {
    return true;
  }
  return false;
};

const getComplexityPenalty = (settings: UserSettings, components: RecipeComponent[]): number => {
  if ((settings.rankingMode ?? 'spectral-first') === 'strict-closest-color') {
    return 0;
  }
  const perPaintPenalty = (settings.rankingMode ?? 'spectral-first') === 'simpler-recipes-preferred' ? 0.06 : 0.03;
  return (components.length - 1) * perPaintPenalty;
};

const getSupportPenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const supportComponents = components.filter((component) => {
    const paint = paintMap.get(component.paintId);
    return paint ? isSupportPaintForTarget(paint, targetAnalysis) : false;
  });

  const supportShare = supportComponents.reduce((sum, component) => sum + component.percentage, 0);
  const hueBuilderShare = components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint || isSupportPaintForTarget(paint, targetAnalysis)) {
      return sum;
    }
    return sum + component.percentage;
  }, 0);

  let penalty = 0;
  supportComponents.forEach((component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint) return;
    const overage = Math.max(0, component.percentage - getTargetAwareMaxShare(paint, targetAnalysis));
    penalty += overage / 180;
  });

  const supportShareSoftCap = isDarkValueTarget(targetAnalysis) ? 42 : 28;

  if (isChromaticTarget(targetAnalysis) && supportComponents.length > 1) {
    penalty += 0.05 + (supportComponents.length - 1) * 0.045;
    if (supportShare > supportShareSoftCap) {
      penalty += (supportShare - supportShareSoftCap) / 180;
    }
  }

  if (isChromaticTarget(targetAnalysis) && supportShare >= hueBuilderShare) {
    penalty += 0.08;
  }

  if (isNearBlackChromaticTarget(targetAnalysis)) {
    const blackShare = supportComponents.reduce((sum, component) => {
      const paint = paintMap.get(component.paintId);
      return paint?.isBlack ? sum + component.percentage : sum;
    }, 0);
    const blackSoftCap = isVeryDarkValueTarget(targetAnalysis) ? 22 : 16;
    if (blackShare > blackSoftCap) {
      penalty += 0.1 + (blackShare - blackSoftCap) / 80;
    }
  }

  return penalty;
};

const getDominancePenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  return components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint) {
      return sum;
    }
    const dominanceBase = (paint.heuristics?.dominancePenalty ?? 0) * (component.percentage / 100) * 0.035;
    const maxShareOverage = Math.max(0, component.percentage - getTargetAwareMaxShare(paint, targetAnalysis));
    return sum + dominanceBase + maxShareOverage / 220;
  }, 0);
};

const getNaturalMixBonus = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!(targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral' || isDarkNaturalGreenTarget(targetAnalysis))) return 0;
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const hasEarth = components.some((component) => paintMap.get(component.paintId)?.heuristics?.naturalBias === 'earth');
  if (!hasEarth) return 0;
  if (isDarkNaturalGreenTarget(targetAnalysis)) return 0.09 + inverseSearchTuning.darkTargets.earthStructuralBonus;
  return 0.05 + (isDarkEarthWarmTarget(targetAnalysis) ? inverseSearchTuning.darkTargets.earthStructuralBonus : 0);
};

const getYellowLightPlausibilityPenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (!isPainterFriendlyYellowLighteningTarget(targetAnalysis)) {
    return 0;
  }

  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));
  let penalty = 0;

  if (stats.yellowShare === 0) {
    penalty += 0.28;
  }

  if (isLightYellowFamilyTarget(targetAnalysis) || isLightCreamOrOrangeTarget(targetAnalysis)) {
    const lightenerShare = stats.whiteShare + stats.warmLightenerShare;
    if (lightenerShare === 0) {
      penalty += 0.18;
    } else if (targetAnalysis.valueClassification === 'very light' && lightenerShare < 20) {
      penalty += 0.08;
    }
  }

  if (stats.blackShare > 0) {
    penalty += 0.28 + stats.blackShare / 140;
  }

  if (targetAnalysis.hueFamily === 'yellow' && stats.violetShare > 0) {
    penalty += 0.24 + stats.violetShare / 160;
  }

  if (stats.blueShare > 0) {
    if (shouldHeavilyRestrictBlueForTarget(targetAnalysis)) {
      penalty += 0.18 + stats.blueShare / 120;
    } else if (isYellowGreenTarget(targetAnalysis)) {
      penalty += stats.blueShare > 10 ? 0.08 + (stats.blueShare - 10) / 160 : 0;
    }
  }

  return penalty;
};

const getGreenStructureBonus = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hueFamily !== 'green') {
    return 0;
  }

  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));
  let bonus = 0;

  if (stats.yellowBlueStructureShare > 0) {
    bonus += isVividGreenTarget(targetAnalysis) ? 0.12 : 0.08;
  }

  if (isLightValueTarget(targetAnalysis) && stats.whiteShare + stats.warmLightenerShare > 0 && stats.yellowShare > 0 && stats.blueShare > 0) {
    bonus += 0.05;
  }

  if ((targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'moderate') && stats.earthShare > 0) {
    bonus += 0.03;
  }

  if (isDarkNaturalGreenTarget(targetAnalysis)) {
    if (stats.yellowShare > 0 && stats.blueShare > 0 && stats.earthShare > 0) {
      bonus += 0.08;
    } else if (stats.earthShare === 0) {
      bonus -= 0.08;
    }
  }

  if (isVividGreenTarget(targetAnalysis) && stats.muddyComplementShare > 0) {
    bonus -= 0.12;
  }

  return bonus;
};

const getDarkTargetValuePenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!isDarkValueTarget(targetAnalysis) || predictedAnalysis.value <= targetAnalysis.value) {
    return 0;
  }

  const delta = predictedAnalysis.value - targetAnalysis.value;
  const base = isVeryDarkValueTarget(targetAnalysis) ? delta * 2.2 : delta * 1.35;
  const severityBonus = isDarkEarthWarmTarget(targetAnalysis)
    ? delta * 1.2
    : isNearBlackChromaticTarget(targetAnalysis)
      ? delta * 0.75
      : 0;
  const darkGreenBonus = isDarkNaturalGreenTarget(targetAnalysis)
    ? (isNearBlackChromaticGreenTarget(targetAnalysis) ? delta * 2.4 : delta * 1.75) + (delta > 0.06 ? 0.12 + (delta - 0.06) * 1.8 : 0)
    : 0;
  const thresholdBonus = delta > 0.08 ? 0.08 + (delta - 0.08) * 1.2 : 0;
  return (base + severityBonus + darkGreenBonus + thresholdBonus) * inverseSearchTuning.darkTargets.valuePenaltyScale;
};

const getMutedTargetCleanPenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!(targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral' || isDarkNaturalGreenTarget(targetAnalysis))) {
    return 0;
  }

  const chromaOverage = predictedAnalysis.chroma - targetAnalysis.chroma;
  if (chromaOverage <= 0.015 && predictedAnalysis.saturationClassification !== 'vivid' && !isDarkNaturalGreenTarget(targetAnalysis)) {
    return 0;
  }

  let penalty = Math.max(0, chromaOverage) * 1.45;
  if (predictedAnalysis.saturationClassification === 'vivid') {
    penalty += 0.14;
  } else if (predictedAnalysis.saturationClassification === 'moderate' && targetAnalysis.saturationClassification === 'neutral') {
    penalty += 0.08;
  }
  if (isDarkNaturalGreenTarget(targetAnalysis)) {
    if (predictedAnalysis.saturationClassification === 'moderate') {
      penalty += 0.06;
    }
    if (predictedAnalysis.saturationClassification === 'vivid') {
      penalty += 0.1;
    }
    if (predictedAnalysis.hueFamily === 'yellow' || predictedAnalysis.hueFamily === 'orange') {
      penalty += 0.12;
    }
  }
  return penalty * inverseSearchTuning.mutedTargets.cleanlinessPenalty;
};

const getDarkNaturalGreenPenalty = (
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!isDarkNaturalGreenTarget(targetAnalysis)) {
    return 0;
  }

  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));
  const valueDelta = predictedAnalysis.value - targetAnalysis.value;
  let penalty = 0;

  if (stats.earthShare === 0) {
    penalty += isNearBlackChromaticGreenTarget(targetAnalysis) ? 0.2 : 0.26;
  }
  const oliveNearBlackTarget = isNearBlackChromaticTarget(targetAnalysis) && isOliveLikeTarget(targetAnalysis);
  if ((predictedAnalysis.hueFamily === 'yellow' || predictedAnalysis.hueFamily === 'orange') && !oliveNearBlackTarget) {
    penalty += 0.14;
  }
  if (valueDelta > 0.06) {
    penalty += 0.12 + valueDelta * (isNearBlackChromaticGreenTarget(targetAnalysis) ? 2.8 : 2.1);
    if (stats.earthShare === 0) {
      penalty += 0.12;
    }
  }
  if (predictedAnalysis.saturationClassification === 'vivid') {
    penalty += 0.14;
  }
  if (predictedAnalysis.saturationClassification === 'moderate' && targetAnalysis.saturationClassification === 'muted') {
    penalty += 0.06;
  }

  return penalty * inverseSearchTuning.vividTargets.muddinessPenalty;
};

const getVividTargetMudPenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (targetAnalysis.saturationClassification !== 'vivid') {
    return 0;
  }

  const chromaLoss = targetAnalysis.chroma - predictedAnalysis.chroma;
  if (chromaLoss <= 0.02 && predictedAnalysis.saturationClassification !== 'muted' && predictedAnalysis.saturationClassification !== 'neutral') {
    return 0;
  }

  let penalty = Math.max(0, chromaLoss) * 1.2;
  if (predictedAnalysis.saturationClassification === 'muted') {
    penalty += 0.12;
  }
  if (predictedAnalysis.saturationClassification === 'neutral') {
    penalty += 0.18;
  }
  return penalty * inverseSearchTuning.vividTargets.muddinessPenalty;
};

const getGreenVividOffHuePenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!(targetAnalysis.hueFamily === 'green' && targetAnalysis.saturationClassification === 'vivid')) {
    return 0;
  }

  return predictedAnalysis.hueFamily === 'green' ? 0 : Math.max(inverseSearchTuning.greenTargets.vividOffHuePenalty, inverseSearchTuning.darkTargets.offHuePenalty);
};

const getNeutralBalancePenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!(targetAnalysis.hueFamily === 'neutral' || isLightWarmNeutralTarget(targetAnalysis) || isCoolMutedNeutralTarget(targetAnalysis))) {
    return 0;
  }

  let penalty = 0;
  if (targetAnalysis.hueFamily === 'neutral' && predictedAnalysis.hueFamily !== 'neutral' && predictedAnalysis.chroma > Math.max(0.035, targetAnalysis.chroma + 0.01)) {
    penalty += 0.1 + (predictedAnalysis.chroma - targetAnalysis.chroma) * 0.6;
  }
  if (isLightWarmNeutralTarget(targetAnalysis) && predictedAnalysis.hueFamily === 'blue') {
    penalty += 0.12;
  }
  if (isCoolMutedNeutralTarget(targetAnalysis) && (predictedAnalysis.hueFamily === 'orange' || predictedAnalysis.hueFamily === 'yellow')) {
    penalty += 0.12;
  }
  return penalty * inverseSearchTuning.neutrals.balancePenalty;
};

const getBoundaryDriftPenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hue === null || predictedAnalysis.hue === null) {
    return 0;
  }

  let penalty = 0;
  if (isYellowGreenTarget(targetAnalysis)) {
    if (!['yellow', 'green'].includes(predictedAnalysis.hueFamily)) {
      penalty += 0.12;
    }
  }
  if (isBlueVioletBoundaryTarget(targetAnalysis)) {
    if (!['blue', 'violet'].includes(predictedAnalysis.hueFamily)) {
      penalty += 0.12;
    }
  }
  if (isRedBrownOrangeCrossoverTarget(targetAnalysis)) {
    if (!['red', 'orange'].includes(predictedAnalysis.hueFamily)) {
      penalty += 0.12;
    }
  }

  const boundaryDelta = hueDifference(targetAnalysis.hue, predictedAnalysis.hue);
  if (penalty === 0 && boundaryDelta > 0.1 && (isYellowGreenTarget(targetAnalysis) || isBlueVioletBoundaryTarget(targetAnalysis) || isRedBrownOrangeCrossoverTarget(targetAnalysis))) {
    penalty += 0.05 + (boundaryDelta - 0.1) * 0.6;
  }

  return penalty;
};

const getGreenHuePenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hueFamily !== 'green' || predictedAnalysis.hueFamily === 'green') {
    return 0;
  }

  if (targetAnalysis.saturationClassification === 'vivid') {
    return predictedAnalysis.hueFamily === 'yellow' ? 0.28 : 0.22;
  }

  return predictedAnalysis.hueFamily === 'yellow' || predictedAnalysis.hueFamily === 'orange' ? 0.12 : 0.08;
};

const getPainterPlausibilityPenalty = (
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
  const inverseSearchTuning = getInverseSearchTuning();
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));

  if (isDarkEarthWarmTarget(targetAnalysis)) {
    let penalty = 0;
    if (stats.redShare === 0 || stats.yellowShare === 0) {
      penalty += 0.22;
    }
    if (stats.earthShare === 0) {
      penalty += 0.3;
    } else if (stats.earthShare < 15) {
      penalty += 0.1;
    } else {
      penalty -= 0.05 + inverseSearchTuning.darkTargets.earthStructuralBonus;
    }
    if (stats.whiteShare + stats.warmLightenerShare > 0) {
      penalty += 0.28;
    }
    if (stats.blueShare > 0) {
      penalty += 0.16 + stats.blueShare / 100;
    }
    if (stats.blackShare > 15) {
      penalty += 0.12 + (stats.blackShare - 15) / 100;
    }
    if (stats.redShare + stats.yellowShare <= stats.earthShare) {
      penalty += 0.12;
    }
    return penalty;
  }

  if (targetAnalysis.hueFamily === 'violet') {
    const yellowShare = stats.yellowShare;
    const blueShare = stats.blueShare;
    const neutralizerShare = components.reduce((sum, component) => {
      const paint = paintMap.get(component.paintId);
      return paint && (paint.isBlack || paint.heuristics?.preferredRole === 'neutralizer') ? sum + component.percentage : sum;
    }, 0);

    let penalty = 0;
    if (yellowShare > 0) {
      penalty += 0.14 + yellowShare / 120;
    }
    if (blueShare === 0) {
      penalty += 0.18;
    }
    if (neutralizerShare > 0 && targetAnalysis.saturationClassification !== 'muted') {
      penalty += neutralizerShare / 220;
    }
    return penalty;
  }

  if (targetAnalysis.hueFamily === 'green') {
    const redShare = stats.redShare;
    const blueShare = stats.blueShare;
    const earthShare = stats.earthShare;
    const yellowShare = stats.yellowShare;

    let penalty = 0;
    if (blueShare === 0) {
      penalty += 0.2;
    }
    if (targetAnalysis.saturationClassification === 'vivid' && redShare > 0) {
      penalty += 0.18 + redShare / 120;
    } else if (redShare > 10) {
      penalty += 0.08 + (redShare - 10) / 180;
    }
    if (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral') {
      if (earthShare > 0) {
        penalty -= 0.03;
      } else {
        penalty += 0.04;
      }
    }
    if (isDarkNaturalGreenTarget(targetAnalysis)) {
      if (yellowShare === 0 || blueShare === 0) {
        penalty += 0.24;
      }
      if (earthShare === 0) {
        penalty += isNearBlackChromaticGreenTarget(targetAnalysis) ? 0.22 : 0.28;
      } else if (earthShare >= 12 && earthShare <= 45) {
        penalty -= 0.06 + inverseSearchTuning.darkTargets.earthStructuralBonus;
      }
      if (redShare > 8) {
        penalty += 0.1 + (redShare - 8) / 120;
      }
      if (stats.blackShare > 10) {
        penalty += 0.08 + (stats.blackShare - 10) / 100;
      }
      if (stats.whiteShare + stats.warmLightenerShare > 0) {
        penalty += 0.26;
      }
    }
    return penalty;
  }

  if (isOliveLikeTarget(targetAnalysis)) {
    const redShare = stats.redShare;
    const blueShare = stats.blueShare;
    const earthShare = stats.earthShare;

    let penalty = 0;
    if (blueShare === 0) {
      penalty += 0.2;
    }
    if (earthShare === 0) {
      penalty += 0.05;
    } else {
      penalty -= 0.03;
    }
    if (redShare > 10) {
      penalty += 0.08 + (redShare - 10) / 180;
    }
    return penalty;
  }

  if (!isPainterFriendlyYellowLighteningTarget(targetAnalysis)) {
    return 0;
  }

  let penalty = 0;
  if (stats.blueShare > 0) {
    penalty += shouldHeavilyRestrictBlueForTarget(targetAnalysis)
      ? 0.32 + stats.blueShare / 90
      : 0.08 + stats.blueShare / 160;
  }
  if (stats.yellowShare === 0) {
    penalty += 0.18;
  }
  const lightenerShare = stats.whiteShare + stats.warmLightenerShare;
  if (lightenerShare === 0) {
    penalty += 0.12;
  } else if (lightenerShare >= 20) {
    penalty -= 0.03;
  }

  return penalty;
};

const getChromaticPathBonus = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hueFamily === 'neutral') return 0;
  if (!hasTargetAwareConstructionPath(paints, components, targetAnalysis)) return 0;
  if (isDarkEarthWarmTarget(targetAnalysis)) return 0.09;
  if (isDarkNaturalGreenTarget(targetAnalysis)) return isNearBlackChromaticGreenTarget(targetAnalysis) ? 0.1 : 0.09;
  if (isNearBlackChromaticTarget(targetAnalysis)) return 0.08;
  return 0.06;
};

const getConstructionPenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (targetAnalysis.hueFamily === 'neutral') return 0;
  if (hasTargetAwareConstructionPath(paints, components, targetAnalysis)) return 0;
  return isDarkEarthWarmTarget(targetAnalysis) || isNearBlackChromaticTarget(targetAnalysis) ? 0.18 : 0.11;
};

const getBlackPenalty = (settings: UserSettings, paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const only = components.length === 1 ? paintMap.get(components[0].paintId) : null;
  if (only?.isBlack && settings.singlePaintPenaltySettings.discourageBlackOnlyMatches) {
    return targetAnalysis.hueFamily === 'neutral' ? 0.04 : 0.18;
  }

  const blackShare = components.find((component) => paintMap.get(component.paintId)?.isBlack)?.percentage ?? 0;
  if (targetAnalysis.hueFamily === 'neutral') {
    return 0;
  }
  if (isNearBlackChromaticTarget(targetAnalysis)) {
    const blackSoftCap = isVeryDarkValueTarget(targetAnalysis) ? 22 : 16;
    return blackShare > blackSoftCap ? 0.06 + (blackShare - blackSoftCap) / 110 : 0;
  }
  return blackShare > 12 ? (blackShare - 12) / 160 : 0;
};

const getWhitePenalty = (settings: UserSettings, paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const only = components.length === 1 ? paintMap.get(components[0].paintId) : null;
  if (only?.isWhite && settings.singlePaintPenaltySettings.discourageWhiteOnlyMatches) {
    return targetAnalysis.valueClassification === 'very light' && targetAnalysis.hueFamily === 'neutral' ? 0.02 : 0.14;
  }
  return 0;
};

const getEarlyWhitePenalty = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): number => {
  if (!isChromaticTarget(targetAnalysis) || !['moderate', 'vivid'].includes(targetAnalysis.saturationClassification)) {
    return 0;
  }

  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const whiteShare = components.reduce((sum, component) => (paintMap.get(component.paintId)?.isWhite ? sum + component.percentage : sum), 0);
  if (whiteShare === 0) {
    return 0;
  }

  let softCap = 12;
  if (targetAnalysis.valueClassification === 'light') softCap = 20;
  if (targetAnalysis.valueClassification === 'very light') softCap = 34;
  if (targetAnalysis.saturationClassification === 'moderate') softCap += 4;

  let penalty = whiteShare > softCap ? (whiteShare - softCap) / 130 : 0;
  const strongestComponent = components[0];
  if (strongestComponent && paintMap.get(strongestComponent.paintId)?.isWhite) {
    penalty += 0.08;
  }

  return penalty;
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
  return neutralizerShare > 18 ? (neutralizerShare - 18) / 220 : 0;
};

const getTwoPaintUsabilityBonus = (settings: UserSettings, components: RecipeComponent[], spectralDistance: number): number => {
  if ((settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' || components.length !== 2) {
    return 0;
  }

  const baseBonus = (settings.rankingMode ?? 'spectral-first') === 'simpler-recipes-preferred' ? 0.03 : 0.016;
  return spectralDistance <= 0.14 ? baseBonus : baseBonus * 0.5;
};

const getPrimaryTruthScore = (
  mode: UserSettings['rankingMode'],
  spectralDistance: number,
  valueDifference: number,
  hueDelta: number,
  saturationDifference: number,
  chromaDifference: number,
): number => {
  if (mode === 'strict-closest-color') {
    return spectralDistance;
  }

  if (mode === 'full-heuristics-legacy') {
    return spectralDistance * 0.92 + valueDifference * 0.42 + hueDelta * 0.28 + saturationDifference * 0.18 + chromaDifference * 0.16;
  }

  return spectralDistance * 0.9 + valueDifference * 0.26 + hueDelta * 0.14 + saturationDifference * 0.06 + chromaDifference * 0.08;
};

const sumNumbers = (values: number[]): number => values.reduce((sum, value) => sum + value, 0);

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
  const hasConstructionPath = hasTargetAwareConstructionPath(paints, components, targetAnalysis);
  const staysInTargetHueFamily = staysInBroadHueFamily(targetAnalysis, predictedAnalysis);
  const complexityPenalty = getComplexityPenalty(settings, components);
  const hueFamilyPenaltyBase = targetAnalysis.hueFamily === 'neutral' || staysInTargetHueFamily ? 0 : 0.18;
  const constructionPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getConstructionPenalty(paints, components, targetAnalysis);
  const supportPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getSupportPenalty(paints, components, targetAnalysis);
  const dominancePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getDominancePenalty(paints, components, targetAnalysis);
  const neutralizerPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getNeutralizerPenalty(paints, components, targetAnalysis);
  const blackPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getBlackPenalty(settings, paints, components, targetAnalysis);
  const whitePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getWhitePenalty(settings, paints, components, targetAnalysis);
  const earlyWhitePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getEarlyWhitePenalty(paints, components, targetAnalysis);
  const singlePaintPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getSinglePaintPenalty(settings, paints, components, targetAnalysis);
  const naturalMixBonusBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getNaturalMixBonus(paints, components, targetAnalysis);
  const chromaticPathBonusBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getChromaticPathBonus(paints, components, targetAnalysis);
  const painterPlausibilityPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getPainterPlausibilityPenalty(paints, components, targetAnalysis);
  const yellowLightPlausibilityPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getYellowLightPlausibilityPenalty(paints, components, targetAnalysis);
  const greenStructureBonusBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getGreenStructureBonus(paints, components, targetAnalysis);
  const darkTargetValuePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getDarkTargetValuePenalty(targetAnalysis, predictedAnalysis);
  const mutedTargetCleanPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getMutedTargetCleanPenalty(targetAnalysis, predictedAnalysis);
  const vividTargetMudPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getVividTargetMudPenalty(targetAnalysis, predictedAnalysis);
  const darkNaturalGreenPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getDarkNaturalGreenPenalty(paints, components, targetAnalysis, predictedAnalysis);
  const neutralBalancePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getNeutralBalancePenalty(targetAnalysis, predictedAnalysis);
  const boundaryDriftPenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getBoundaryDriftPenalty(targetAnalysis, predictedAnalysis);
  const greenVividOffHuePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getGreenVividOffHuePenalty(targetAnalysis, predictedAnalysis);
  const greenHuePenaltyBase = (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' ? 0 : getGreenHuePenalty(targetAnalysis, predictedAnalysis);
  const twoPaintUsabilityBonus = getTwoPaintUsabilityBonus(settings, components, spectralDistance);
  const vividTargetPenaltyBase =
    (settings.rankingMode ?? 'spectral-first') === 'strict-closest-color' || targetAnalysis.saturationClassification !== 'vivid' || staysInTargetHueFamily
      ? 0
      : 0.16;
  const primaryScore = getPrimaryTruthScore(
    (settings.rankingMode ?? 'spectral-first'),
    spectralDistance,
    valueDifference,
    hueDelta,
    saturationDifference,
    chromaDifference,
  );

  // Search-shaping belongs upstream in candidate generation/filtering. Final
  // ranking should be truth-first: predicted-vs-target closeness, then only
  // light regularization. The legacy mode below preserves the older heavier
  // heuristic stack for ablation and comparison.
  let hueFamilyPenalty = 0;
  let constructionPenalty = 0;
  let supportPenalty = 0;
  let dominancePenalty = 0;
  let neutralizerPenalty = 0;
  let blackPenalty = 0;
  let whitePenalty = 0;
  let earlyWhitePenalty = 0;
  let singlePaintPenalty = 0;
  let naturalMixBonus = 0;
  let chromaticPathBonus = 0;
  let painterPlausibilityPenalty = 0;
  let yellowLightPlausibilityPenalty = 0;
  let greenStructureBonus = 0;
  let darkTargetValuePenalty = 0;
  let mutedTargetCleanPenalty = 0;
  let vividTargetMudPenalty = 0;
  let darkNaturalGreenPenalty = 0;
  let neutralBalancePenalty = 0;
  let boundaryDriftPenalty = 0;
  let greenVividOffHuePenalty = 0;
  let greenHuePenalty = 0;
  let vividTargetPenalty = 0;
  let regularizationPenalty = 0;
  let regularizationBonus = 0;
  let legacyHeuristicPenalty = 0;
  let legacyHeuristicBonus = 0;

  if ((settings.rankingMode ?? 'spectral-first') === 'full-heuristics-legacy') {
    hueFamilyPenalty = hueFamilyPenaltyBase;
    constructionPenalty = constructionPenaltyBase;
    supportPenalty = supportPenaltyBase;
    dominancePenalty = dominancePenaltyBase;
    neutralizerPenalty = neutralizerPenaltyBase;
    blackPenalty = blackPenaltyBase;
    whitePenalty = whitePenaltyBase;
    earlyWhitePenalty = earlyWhitePenaltyBase;
    singlePaintPenalty = singlePaintPenaltyBase;
    naturalMixBonus = naturalMixBonusBase;
    chromaticPathBonus = chromaticPathBonusBase;
    painterPlausibilityPenalty = painterPlausibilityPenaltyBase;
    yellowLightPlausibilityPenalty = yellowLightPlausibilityPenaltyBase;
    greenStructureBonus = greenStructureBonusBase;
    darkTargetValuePenalty = darkTargetValuePenaltyBase;
    mutedTargetCleanPenalty = mutedTargetCleanPenaltyBase;
    vividTargetMudPenalty = vividTargetMudPenaltyBase;
    darkNaturalGreenPenalty = darkNaturalGreenPenaltyBase;
    neutralBalancePenalty = neutralBalancePenaltyBase;
    boundaryDriftPenalty = boundaryDriftPenaltyBase;
    greenVividOffHuePenalty = greenVividOffHuePenaltyBase;
    greenHuePenalty = greenHuePenaltyBase;
    vividTargetPenalty = vividTargetPenaltyBase;
    regularizationPenalty = sumNumbers([
      complexityPenalty,
      hueFamilyPenalty,
      supportPenalty,
      dominancePenalty,
      neutralizerPenalty,
      blackPenalty,
      whitePenalty,
      earlyWhitePenalty,
      singlePaintPenalty,
      darkTargetValuePenalty,
      mutedTargetCleanPenalty,
      vividTargetMudPenalty,
      neutralBalancePenalty,
      boundaryDriftPenalty,
      greenHuePenalty,
    ]);
    regularizationBonus = sumNumbers([naturalMixBonus, chromaticPathBonus, greenStructureBonus, twoPaintUsabilityBonus]);
    legacyHeuristicPenalty = sumNumbers([
      constructionPenalty,
      painterPlausibilityPenalty,
      yellowLightPlausibilityPenalty,
      darkNaturalGreenPenalty,
      greenVividOffHuePenalty,
      vividTargetPenalty,
    ]);
    legacyHeuristicBonus = 0;
  } else if ((settings.rankingMode ?? 'spectral-first') === 'painter-friendly-balanced' || (settings.rankingMode ?? 'spectral-first') === 'simpler-recipes-preferred') {
    hueFamilyPenalty = hueFamilyPenaltyBase * 0.22;
    supportPenalty = supportPenaltyBase * 0.3;
    dominancePenalty = dominancePenaltyBase * 0.22;
    neutralizerPenalty = neutralizerPenaltyBase * 0.24;
    blackPenalty = blackPenaltyBase * 0.28;
    whitePenalty = whitePenaltyBase * 0.25;
    earlyWhitePenalty = earlyWhitePenaltyBase * 0.28;
    singlePaintPenalty = singlePaintPenaltyBase;
    naturalMixBonus = naturalMixBonusBase * 0.18;
    chromaticPathBonus = chromaticPathBonusBase * 0.22;
    greenStructureBonus = greenStructureBonusBase * 0.2;
    darkTargetValuePenalty = darkTargetValuePenaltyBase * 0.24;
    mutedTargetCleanPenalty = mutedTargetCleanPenaltyBase * 0.18;
    vividTargetMudPenalty = vividTargetMudPenaltyBase * 0.18;
    neutralBalancePenalty = neutralBalancePenaltyBase * 0.16;
    boundaryDriftPenalty = boundaryDriftPenaltyBase * 0.24;
    greenHuePenalty = greenHuePenaltyBase * 0.2;
    regularizationPenalty = sumNumbers([
      complexityPenalty,
      hueFamilyPenalty,
      supportPenalty,
      dominancePenalty,
      neutralizerPenalty,
      blackPenalty,
      whitePenalty,
      earlyWhitePenalty,
      singlePaintPenalty,
      darkTargetValuePenalty,
      mutedTargetCleanPenalty,
      vividTargetMudPenalty,
      neutralBalancePenalty,
      boundaryDriftPenalty,
      greenHuePenalty,
    ]);
    regularizationBonus = sumNumbers([naturalMixBonus, chromaticPathBonus, greenStructureBonus, twoPaintUsabilityBonus]);
  }

  const finalScore = primaryScore + regularizationPenalty + legacyHeuristicPenalty - regularizationBonus - legacyHeuristicBonus;

  return {
    mode: (settings.rankingMode ?? 'spectral-first'),
    spectralDistance,
    valueDifference,
    hueDifference: hueDelta,
    saturationDifference,
    chromaDifference,
    primaryScore,
    regularizationPenalty,
    regularizationBonus,
    legacyHeuristicPenalty,
    legacyHeuristicBonus,
    complexityPenalty,
    hueFamilyPenalty,
    constructionPenalty,
    supportPenalty,
    dominancePenalty,
    neutralizerPenalty,
    blackPenalty,
    whitePenalty,
    earlyWhitePenalty,
    singlePaintPenalty,
    naturalMixBonus,
    chromaticPathBonus,
    twoPaintUsabilityBonus,
    vividTargetPenalty,
    painterPlausibilityPenalty,
    yellowLightPlausibilityPenalty,
    greenStructureBonus,
    darkTargetValuePenalty,
    mutedTargetCleanPenalty,
    vividTargetMudPenalty,
    darkNaturalGreenPenalty,
    neutralBalancePenalty,
    boundaryDriftPenalty,
    greenVividOffHuePenalty,
    greenHuePenalty,
    hasRequiredHueConstructionPath: hasConstructionPath,
    staysInTargetHueFamily,
    finalScore,
  };
};

export const isCandidateUsefulForTarget = (paints: Paint[], paintIds: string[], weights: number[], target: ColorAnalysis): boolean => {
  const group = paintIds.map((paintId) => paints.find((paint) => paint.id === paintId)).filter((paint): paint is Paint => Boolean(paint));
  if (group.length !== paintIds.length) return false;
  const components = buildComponents(buildOrderedEntries(paintIds, weights));

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

  const overMax = weights.some((weight, index) => weight > getTargetAwareMaxShare(group[index], target));
  if (overMax) {
    return false;
  }

  const supportWeights = weights.filter((_, index) => isSupportPaintForTarget(group[index], target));
  const supportShare = supportWeights.reduce((sum, weight) => sum + weight, 0);
  const blueShare = weights.reduce((sum, weight, index) => (
    getPaintRoleFamily(group[index]) === 'blue' ? sum + weight : sum
  ), 0);
  const supportShareCap = isDarkValueTarget(target) ? 45 : 35;
  if (isChromaticTarget(target) && supportWeights.length > 1 && supportShare > supportShareCap) {
    return false;
  }

  if (shouldHeavilyRestrictBlueForTarget(target) && blueShare > 0) {
    return false;
  }

  if (isDarkEarthWarmTarget(target)) {
    const earthShare = weights.reduce((sum, weight, index) => (
      isEarthPaint(group[index]) ? sum + weight : sum
    ), 0);
    const warmHueBuilderShare = weights.reduce((sum, weight, index) => (
      isWarmHueBuilderPaint(group[index]) ? sum + weight : sum
    ), 0);
    const whiteLikeShare = weights.reduce((sum, weight, index) => (
      group[index].isWhite || group[index].name.toLowerCase().includes('unbleached titanium') ? sum + weight : sum
    ), 0);

    if (earthShare === 0 || warmHueBuilderShare === 0 || whiteLikeShare > 0) {
      return false;
    }
  }

  if (isDarkNaturalGreenTarget(target)) {
    const earthShare = weights.reduce((sum, weight, index) => (isEarthPaint(group[index]) ? sum + weight : sum), 0);
    const whiteLikeShare = weights.reduce((sum, weight, index) => (group[index].isWhite || group[index].name.toLowerCase().includes('unbleached titanium') ? sum + weight : sum), 0);
    const yellowShare = weights.reduce((sum, weight, index) => (getPaintRoleFamily(group[index]) === 'yellow' ? sum + weight : sum), 0);
    const blueShare = weights.reduce((sum, weight, index) => (getPaintRoleFamily(group[index]) === 'blue' ? sum + weight : sum), 0);
    const redShare = weights.reduce((sum, weight, index) => (getPaintRoleFamily(group[index]) === 'red' ? sum + weight : sum), 0);
    const blackShare = weights.reduce((sum, weight, index) => (group[index].isBlack ? sum + weight : sum), 0);
    const hasOliveNearBlackPath = isNearBlackChromaticTarget(target) && isOliveLikeTarget(target) && earthShare > 0 && yellowShare > 0 && blackShare > 0;

    if (whiteLikeShare > 0 || earthShare === 0 || yellowShare === 0 || (blueShare === 0 && !hasOliveNearBlackPath)) {
      return false;
    }
    if (redShare > 20) {
      return false;
    }
    if (isNearBlackChromaticGreenTarget(target)) {
      if (blackShare > 10) {
        return false;
      }
    } else if (!hasOliveNearBlackPath && blackShare > 12) {
      return false;
    }
  }

  if (isNearBlackChromaticTarget(target)) {
    const blackShare = weights.reduce((sum, weight, index) => (group[index].isBlack ? sum + weight : sum), 0);
    const chromaticShare = weights.reduce((sum, weight, index) => (
      !group[index].isBlack &&
      !group[index].isWhite &&
      (group[index].heuristics?.preferredRole !== 'neutralizer' || isStructuralEarthForTarget(group[index], target)) ? sum + weight : sum
    ), 0);
    if (blackShare >= chromaticShare) {
      return false;
    }
  }

  const hueBuilderShare = weights.reduce((sum, weight, index) => {
    return isSupportPaintForTarget(group[index], target) ? sum : sum + weight;
  }, 0);
  if (isChromaticTarget(target) && supportShare >= hueBuilderShare) {
    return false;
  }

  if (!isPainterValidForTarget(paints, components, target)) {
    return false;
  }

  return true;
};

const dedupeWeightSets = (weightSets: number[][]): number[][] => {
  const seen = new Set<string>();
  return weightSets.filter((weights) => {
    const signature = weights.join(':');
    if (seen.has(signature)) {
      return false;
    }
    seen.add(signature);
    return true;
  });
};

const buildDarkTargetWeightSets = (group: Paint[], targetAnalysis: ColorAnalysis): number[][] => {
  const inverseSearchTuning = getInverseSearchTuning();
  if (!inverseSearchTuning.ratioSearch.darkRatioFamiliesEnabled || !isDarkValueTarget(targetAnalysis)) {
    return [];
  }

  const size = group.length;
  const earthIndex = group.findIndex((paint) => isEarthPaint(paint));
  const blackIndex = group.findIndex((paint) => paint.isBlack);
  const yellowIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'yellow');
  const blueIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'blue');
  const redIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'red');
  const greenIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'green');
  const darkStructureIndex = earthIndex >= 0 ? earthIndex : blackIndex;
  const chromaticAnchorIndex = blueIndex >= 0 ? blueIndex : redIndex >= 0 ? redIndex : yellowIndex >= 0 ? yellowIndex : greenIndex;

  if (size === 2) {
    if (darkStructureIndex < 0) {
      return [];
    }

    return [
      [55, 45],
      [60, 40],
      [45, 55],
      [65, 35],
    ].map((weights) => {
      const ordered = [...weights];
      if (darkStructureIndex === 1) {
        ordered.reverse();
      }
      return ordered;
    });
  }

  if (size === 3 && darkStructureIndex >= 0 && chromaticAnchorIndex >= 0) {
    const remainingIndex = [0, 1, 2].find((index) => index !== darkStructureIndex && index !== chromaticAnchorIndex);
    if (remainingIndex === undefined) {
      return [];
    }

    const families: number[][] = [];
    const darkCoreFamilies = [
      { dark: 40, anchor: 35, support: 25 },
      { dark: 35, anchor: 40, support: 25 },
      { dark: 45, anchor: 30, support: 25 },
      { dark: 30, anchor: 45, support: 25 },
      { dark: 38, anchor: 32, support: 30 },
      { dark: 45, anchor: 40, support: 15 },
      { dark: 40, anchor: 45, support: 15 },
      { dark: 50, anchor: 35, support: 15 },
      { dark: 50, anchor: 40, support: 10 },
      { dark: 45, anchor: 45, support: 10 },
      { dark: 55, anchor: 30, support: 15 },
      { dark: 55, anchor: 35, support: 10 },
      { dark: 48, anchor: 42, support: 10 },
      { dark: 42, anchor: 48, support: 10 },
      { dark: 52, anchor: 38, support: 10 },
    ];

    darkCoreFamilies.forEach(({ dark, anchor, support }) => {
      const weights = [0, 0, 0];
      weights[darkStructureIndex] = dark;
      weights[chromaticAnchorIndex] = anchor;
      weights[remainingIndex] = support;
      families.push(weights);
    });

    return families;
  }

  return [];
};

const buildVividGreenWeightSets = (group: Paint[], targetAnalysis: ColorAnalysis): number[][] => {
  if (!(targetAnalysis.hueFamily === 'green' && targetAnalysis.saturationClassification === 'vivid')) {
    return [];
  }

  const yellowIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'yellow');
  const blueIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'blue');
  if (yellowIndex < 0 || blueIndex < 0) {
    return [];
  }

  if (group.length === 2) {
    return [
      [80, 20],
      [85, 15],
      [70, 30],
    ].map((weights) => {
      const ordered = [0, 0];
      ordered[yellowIndex] = weights[0];
      ordered[blueIndex] = weights[1];
      return ordered;
    });
  }

  return [];
};

const buildYellowLightWeightSets = (group: Paint[], targetAnalysis: ColorAnalysis): number[][] => {
  if (!isPainterFriendlyYellowLighteningTarget(targetAnalysis)) {
    return [];
  }

  const yellowIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'yellow');
  const whiteIndex = group.findIndex((paint) => paint.isWhite);
  const warmLightenerIndex = group.findIndex((paint) => paint.name.toLowerCase().includes('unbleached titanium'));
  const blueIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'blue');

  if (yellowIndex < 0) {
    return [];
  }

  if (group.length === 2) {
    const lightenerIndex = whiteIndex >= 0 ? whiteIndex : warmLightenerIndex;
    if (lightenerIndex < 0) {
      return [];
    }

    return [
      [75, 25],
      [70, 30],
      [65, 35],
      [60, 40],
    ].map(([yellow, lightener]) => {
      const ordered = [0, 0];
      ordered[yellowIndex] = yellow;
      ordered[lightenerIndex] = lightener;
      return ordered;
    });
  }

  if (group.length === 3) {
    const lightenerIndices = [whiteIndex, warmLightenerIndex].filter((index): index is number => index >= 0);
    if (lightenerIndices.length === 0 || blueIndex >= 0) {
      return [];
    }

    const [firstLightener, secondLightener] = lightenerIndices;
    const supportIndex = secondLightener ?? group.findIndex((_, index) => index !== yellowIndex && index !== firstLightener);
    if (firstLightener === undefined || supportIndex < 0) {
      return [];
    }

    return [
      { yellow: 55, primaryLightener: 30, supportLightener: 15 },
      { yellow: 60, primaryLightener: 25, supportLightener: 15 },
      { yellow: 50, primaryLightener: 35, supportLightener: 15 },
    ].map(({ yellow, primaryLightener, supportLightener }) => {
      const weights = [0, 0, 0];
      weights[yellowIndex] = yellow;
      weights[firstLightener] = primaryLightener;
      weights[supportIndex] = supportLightener;
      return weights;
    });
  }

  return [];
};

const buildDarkEarthWarmWeightSets = (group: Paint[], targetAnalysis: ColorAnalysis): number[][] => {
  if (!isDarkEarthWarmTarget(targetAnalysis) || group.length !== 3) {
    return [];
  }

  const earthIndex = group.findIndex(isEarthPaint);
  const yellowIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'yellow');
  const redIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'red');

  if (earthIndex < 0 || yellowIndex < 0 || redIndex < 0) {
    return [];
  }

  return [
    { earth: 35, yellow: 30, red: 35 },
    { earth: 40, yellow: 25, red: 35 },
    { earth: 30, yellow: 35, red: 35 },
    { earth: 38, yellow: 32, red: 30 },
  ].map(({ earth, yellow, red }) => {
    const weights = [0, 0, 0];
    weights[earthIndex] = earth;
    weights[yellowIndex] = yellow;
    weights[redIndex] = red;
    return weights;
  });
};

const buildOliveNearBlackWeightSets = (group: Paint[], targetAnalysis: ColorAnalysis): number[][] => {
  if (!(isDarkNaturalGreenTarget(targetAnalysis) || (isOliveLikeTarget(targetAnalysis) && isDarkValueTarget(targetAnalysis))) || group.length !== 3) {
    return [];
  }

  const earthIndex = group.findIndex(isEarthPaint);
  const yellowIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'yellow');
  const blackIndex = group.findIndex((paint) => paint.isBlack);
  const blueIndex = group.findIndex((paint) => getPaintRoleFamily(paint) === 'blue');

  if (earthIndex < 0 || yellowIndex < 0) {
    return [];
  }

  if (blackIndex >= 0 && isNearBlackChromaticTarget(targetAnalysis)) {
    return [
      { earth: 45, yellow: 45, support: 10 },
      { earth: 40, yellow: 50, support: 10 },
      { earth: 50, yellow: 40, support: 10 },
      { earth: 42, yellow: 46, support: 12 },
    ].map(({ earth, yellow, support }) => {
      const weights = [0, 0, 0];
      weights[earthIndex] = earth;
      weights[yellowIndex] = yellow;
      weights[blackIndex] = support;
      return weights;
    });
  }

  if (blueIndex >= 0) {
    return [
      { earth: 35, yellow: 40, blue: 25 },
      { earth: 40, yellow: 35, blue: 25 },
      { earth: 30, yellow: 45, blue: 25 },
    ].map(({ earth, yellow, blue }) => {
      const weights = [0, 0, 0];
      weights[earthIndex] = earth;
      weights[yellowIndex] = yellow;
      weights[blueIndex] = blue;
      return weights;
    });
  }

  return [];
};

const shouldRejectGroupForTarget = (group: Paint[], target: ColorAnalysis): boolean => {
  const families = group.map(getPaintRoleFamily);
  const blueCount = families.filter((family) => family === 'blue').length;
  const lightenerCount = group.filter((paint) => paint.isWhite || paint.name.toLowerCase().includes('unbleached titanium')).length;
  const earthCount = group.filter(isEarthPaint).length;
  const blackCount = group.filter((paint) => paint.isBlack).length;

  if (isPainterFriendlyYellowLighteningTarget(target)) {
    if (!families.includes('yellow')) {
      return true;
    }
    if (lightenerCount === 0) {
      return true;
    }
    if (shouldHeavilyRestrictBlueForTarget(target) && blueCount > 0) {
      return true;
    }
  }

  if (isDarkEarthWarmTarget(target)) {
    if (earthCount === 0 || !families.includes('yellow') || !families.includes('red')) {
      return true;
    }
  }

  if (isDarkNaturalGreenTarget(target)) {
    if (earthCount === 0 || !families.includes('yellow')) {
      return true;
    }
    if (!families.includes('blue') && !(isNearBlackChromaticTarget(target) && blackCount > 0)) {
      return true;
    }
  }

  return false;
};

export const generateCandidateMixes = (paints: Paint[], maxPaintsPerRecipe: number, step: number, targetHex?: string): CandidateMix[] => {
  if (!targetHex) {
    const enabledPaints = paints.filter((paint) => paint.isEnabled);
    const candidates: CandidateMix[] = [];
    for (let size = 1; size <= Math.min(maxPaintsPerRecipe, enabledPaints.length); size += 1) {
      const groups = choosePaintGroups(enabledPaints, size);
      groups.forEach((group) => {
        generateWeightCombinations(size, step).forEach((weights) => {
          candidates.push({ paintIds: group.map((paint) => paint.id), weights });
        });
      });
    }
    return candidates;
  }

  const solved = solveTarget(targetHex, paints, {
    ...({
      weightStep: step,
      maxPaintsPerRecipe: Math.min(3, Math.max(1, maxPaintsPerRecipe)) as 1 | 2 | 3,
      rankingMode: 'spectral-first',
      showPercentages: true,
      showPartsRatios: true,
      singlePaintPenaltySettings: {
        discourageBlackOnlyMatches: true,
        discourageWhiteOnlyMatches: true,
        favorMultiPaintMixesWhenClose: true,
      },
    } satisfies UserSettings),
  }, 200);

  return solved.candidates.map((candidate) => ({
    paintIds: candidate.recipe.map((component) => component.paintId),
    weights: candidate.recipe.map((component) => component.weight),
  }));
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

/**
 * Inverse optimization entry point.
 *
 * Target data is allowed to generate, filter, and rank candidate recipes, but
 * it must never rewrite the predicted swatch after forward mixing. The recipe
 * swatch below always comes from recipe-side spectral mixing only.
 */
export const rankRecipes = (targetHex: string, paints: Paint[], settings: UserSettings, limit = 8): RankedRecipe[] => {
  const palette = settings.solveMode === 'ideal' ? getIdealPalette(paints) : getOnHandPalette(paints);
  const solved = solveTarget(targetHex, palette, { ...settings, rankingMode: 'spectral-first' }, limit);
  const enriched = solved.rankedRecipes.map((recipe) => ({
    ...recipe,
    qualityLabel: determineRecipeQuality(recipe.scoreBreakdown.finalScore),
    whyThisRanked: buildRecipeWhyThisRanked(
      recipe.scoreBreakdown,
      recipe.targetAnalysis,
      recipe.predictedAnalysis,
      palette,
      recipe.components.map((component) => component.paintId),
    ),
    guidanceText: buildRecipeGuidance(
      recipe.scoreBreakdown,
      recipe.targetAnalysis,
      recipe.predictedAnalysis,
      palette,
      recipe.components.map((component) => component.paintId),
      recipe.practicalRatioText,
    ),
    nextAdjustments: generateNextAdjustments(recipe.targetAnalysis, recipe.predictedAnalysis, palette, recipe),
    detailedAdjustments: generateAdjustmentSuggestions(recipe.targetAnalysis, recipe.predictedAnalysis, palette, recipe),
    mixStrategy: buildMixStrategy(palette, recipe.components, recipe.targetAnalysis, recipe.practicalRatioText),
    mixPath: buildMixPath(recipe, palette),
    stabilityWarnings: buildStabilityWarnings(recipe, palette),
    roleNotes: buildRoleNotes(recipe, palette),
    achievability: assessAchievability(recipe, palette),
    layeringSuggestion: buildLayeringSuggestion(recipe, palette),
  }));

  return assignRecipeBadges(enriched).slice(0, limit);
};

export const rankRecipesWithPalettes = (targetHex: string, paints: Paint[], settings: UserSettings, limit = 8) =>
  solveWithPalettes(targetHex, paints, settings, limit);
