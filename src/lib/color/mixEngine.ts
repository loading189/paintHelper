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
  isDarkValueTarget,
  isLightValueTarget,
  isLightWarmNeutralTarget,
  isNearBlackChromaticTarget,
  isRedBrownOrangeCrossoverTarget,
  isVeryDarkValueTarget,
  isYellowGreenBoundaryTarget,
} from './colorAnalysis';
import { assessAchievability } from './achievability';
import { assignRecipeBadges, buildMixStrategy, buildRecipeGuidance, buildRecipeWhyThisRanked, determineRecipeQuality } from './guidance';
import { buildLayeringSuggestion, buildMixPath, buildRoleNotes, buildStabilityWarnings } from './mixPathEngine';
import { predictSpectralMix, spectralDistanceBetweenHexes } from './spectralMixing';
import { distributePercentages, formatRatio, practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';

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

const isOliveLikeTarget = (targetAnalysis: ColorAnalysis): boolean =>
  targetAnalysis.hue !== null &&
  targetAnalysis.hue >= 85 &&
  targetAnalysis.hue <= 140 &&
  !isLightValueTarget(targetAnalysis) &&
  (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'moderate');

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
      return Math.min(baseMaxShare, isVeryDarkValueTarget(targetAnalysis) ? 12 : 10);
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

export const isPainterValidForTarget = (paints: Paint[], components: RecipeComponent[], targetAnalysis: ColorAnalysis): boolean => {
  const stats = withDerivedStructureStats(getRecipeStructureStats(paints, components));
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const orderedPaints = components.map((component) => paintMap.get(component.paintId)).filter((paint): paint is Paint => Boolean(paint));
  const warmHueBuilderCount = orderedPaints.filter((paint) => isWarmHueBuilderPaint(paint)).length;
  const earthCount = orderedPaints.filter(isEarthPaint).length;
  const chromaticNonSupportShare = components.reduce((sum, component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint || paint.isWhite || paint.isBlack || paint.heuristics?.preferredRole === 'neutralizer') {
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
      const allowedBlueShare = isYellowGreenTarget(targetAnalysis) ? 10 : 5;
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

  return true;
};

const isSupportPaintForTarget = (paint: Paint, targetAnalysis: ColorAnalysis): boolean => {
  if (isDarkEarthWarmTarget(targetAnalysis) && isEarthPaint(paint)) return false;
  if (paint.isBlack) return true;
  if (paint.heuristics?.preferredRole === 'neutralizer') return true;
  if (isChromaticTarget(targetAnalysis) && (paint.isWhite || paint.name.includes('Unbleached Titanium') || paint.heuristics?.preferredRole === 'lightener')) {
    return true;
  }
  return false;
};

const getComplexityPenalty = (settings: UserSettings, components: RecipeComponent[]): number => {
  if (settings.rankingMode === 'strict-closest-color') {
    return 0;
  }
  const perPaintPenalty = settings.rankingMode === 'simpler-recipes-preferred' ? 0.06 : 0.03;
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

  if (isChromaticTarget(targetAnalysis) && supportComponents.length > 1) {
    penalty += 0.05 + (supportComponents.length - 1) * 0.045;
    if (supportShare > 28) {
      penalty += (supportShare - 28) / 180;
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
    if (blackShare > 8) {
      penalty += 0.12 + (blackShare - 8) / 70;
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
  if (!(targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral')) return 0;
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  return components.some((component) => paintMap.get(component.paintId)?.heuristics?.naturalBias === 'earth') ? 0.05 : 0;
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

  if (isVividGreenTarget(targetAnalysis) && stats.muddyComplementShare > 0) {
    bonus -= 0.12;
  }

  return bonus;
};

const getDarkTargetValuePenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  if (!isDarkValueTarget(targetAnalysis) || predictedAnalysis.value <= targetAnalysis.value) {
    return 0;
  }

  const delta = predictedAnalysis.value - targetAnalysis.value;
  const base = isVeryDarkValueTarget(targetAnalysis) ? delta * 2.2 : delta * 1.35;
  const severityBonus = isDarkEarthWarmTarget(targetAnalysis) ? delta * 1.2 : isNearBlackChromaticTarget(targetAnalysis) ? delta * 0.75 : 0;
  const thresholdBonus = delta > 0.08 ? 0.08 + (delta - 0.08) * 1.2 : 0;
  return base + severityBonus + thresholdBonus;
};

const getMutedTargetCleanPenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
  if (!(targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral')) {
    return 0;
  }

  const chromaOverage = predictedAnalysis.chroma - targetAnalysis.chroma;
  if (chromaOverage <= 0.015 && predictedAnalysis.saturationClassification !== 'vivid') {
    return 0;
  }

  let penalty = Math.max(0, chromaOverage) * 1.45;
  if (predictedAnalysis.saturationClassification === 'vivid') {
    penalty += 0.14;
  } else if (predictedAnalysis.saturationClassification === 'moderate' && targetAnalysis.saturationClassification === 'neutral') {
    penalty += 0.08;
  }
  return penalty;
};

const getVividTargetMudPenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
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
  return penalty;
};

const getNeutralBalancePenalty = (targetAnalysis: ColorAnalysis, predictedAnalysis: ColorAnalysis): number => {
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
  return penalty;
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

const getPainterPlausibilityPenalty = (
  paints: Paint[],
  components: RecipeComponent[],
  targetAnalysis: ColorAnalysis,
): number => {
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
      penalty -= 0.05;
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
    return blackShare > 8 ? 0.08 + (blackShare - 8) / 90 : 0;
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
  if (settings.rankingMode === 'strict-closest-color' || components.length !== 2) {
    return 0;
  }

  const baseBonus = settings.rankingMode === 'simpler-recipes-preferred' ? 0.03 : 0.016;
  return spectralDistance <= 0.14 ? baseBonus : baseBonus * 0.5;
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
  const hasConstructionPath = hasTargetAwareConstructionPath(paints, components, targetAnalysis);
  const staysInTargetHueFamily = staysInBroadHueFamily(targetAnalysis, predictedAnalysis);
  const complexityPenalty = getComplexityPenalty(settings, components);
  const hueFamilyPenalty = targetAnalysis.hueFamily === 'neutral' || staysInTargetHueFamily ? 0 : 0.18;
  const constructionPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getConstructionPenalty(paints, components, targetAnalysis);
  const supportPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getSupportPenalty(paints, components, targetAnalysis);
  const dominancePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getDominancePenalty(paints, components, targetAnalysis);
  const neutralizerPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getNeutralizerPenalty(paints, components, targetAnalysis);
  const blackPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getBlackPenalty(settings, paints, components, targetAnalysis);
  const whitePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getWhitePenalty(settings, paints, components, targetAnalysis);
  const earlyWhitePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getEarlyWhitePenalty(paints, components, targetAnalysis);
  const singlePaintPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getSinglePaintPenalty(settings, paints, components, targetAnalysis);
  const naturalMixBonus = settings.rankingMode === 'strict-closest-color' ? 0 : getNaturalMixBonus(paints, components, targetAnalysis);
  const chromaticPathBonus = settings.rankingMode === 'strict-closest-color' ? 0 : getChromaticPathBonus(paints, components, targetAnalysis);
  const painterPlausibilityPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getPainterPlausibilityPenalty(paints, components, targetAnalysis);
  const yellowLightPlausibilityPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getYellowLightPlausibilityPenalty(paints, components, targetAnalysis);
  const greenStructureBonus = settings.rankingMode === 'strict-closest-color' ? 0 : getGreenStructureBonus(paints, components, targetAnalysis);
  const darkTargetValuePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getDarkTargetValuePenalty(targetAnalysis, predictedAnalysis);
  const mutedTargetCleanPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getMutedTargetCleanPenalty(targetAnalysis, predictedAnalysis);
  const vividTargetMudPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getVividTargetMudPenalty(targetAnalysis, predictedAnalysis);
  const neutralBalancePenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getNeutralBalancePenalty(targetAnalysis, predictedAnalysis);
  const boundaryDriftPenalty = settings.rankingMode === 'strict-closest-color' ? 0 : getBoundaryDriftPenalty(targetAnalysis, predictedAnalysis);
  const twoPaintUsabilityBonus = getTwoPaintUsabilityBonus(settings, components, spectralDistance);
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
    earlyWhitePenalty +
    singlePaintPenalty +
    painterPlausibilityPenalty +
    yellowLightPlausibilityPenalty +
    darkTargetValuePenalty +
    mutedTargetCleanPenalty +
    vividTargetMudPenalty +
    neutralBalancePenalty +
    boundaryDriftPenalty +
    vividTargetPenalty -
    naturalMixBonus -
    chromaticPathBonus -
    greenStructureBonus -
    twoPaintUsabilityBonus;

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
    neutralBalancePenalty,
    boundaryDriftPenalty,
    hasRequiredHueConstructionPath: hasConstructionPath,
    staysInTargetHueFamily,
    finalScore,
  };
};

const isCandidateUsefulForTarget = (paints: Paint[], paintIds: string[], weights: number[], target: ColorAnalysis): boolean => {
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
  if (isChromaticTarget(target) && supportWeights.length > 1 && supportShare > 35) {
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

  if (isNearBlackChromaticTarget(target)) {
    const blackShare = weights.reduce((sum, weight, index) => (group[index].isBlack ? sum + weight : sum), 0);
    const chromaticShare = weights.reduce((sum, weight, index) => (
      !group[index].isBlack && !group[index].isWhite && group[index].heuristics?.preferredRole !== 'neutralizer' ? sum + weight : sum
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
    const entries = buildOrderedEntries(candidate.paintIds, candidate.weights);
    const orderedWeights = entries.map((entry) => entry.weight);
    const components = buildComponents(entries);
    const exactParts = simplifyRatio(orderedWeights);
    const exactPercentages = distributePercentages(orderedWeights);
    const practicalParts = practicalRatioFromWeights(orderedWeights, { idealMaxParts: orderedWeights.length === 3 ? 9 : 8, hardMaxParts: 12 });
    const practicalPercentages = distributePercentages(practicalParts);
    const mix = predictSpectralMix(paints, components);
    const predictedAnalysis = analyzeColor(mix.hex);
    if (!predictedAnalysis) {
      return;
    }
    if (settings.rankingMode !== 'strict-closest-color' && !isPainterValidForTarget(paints, components, targetAnalysis)) {
      return;
    }

    const scoreBreakdown = scoreRecipe(settings, paints, targetAnalysis, predictedAnalysis, components);
    const paintNames = entries.map((entry) => paintMap.get(entry.paintId)?.name ?? entry.paintId);
    const signature = recipeSignature(components);
    const detailedAdjustments = generateAdjustmentSuggestions(targetAnalysis, predictedAnalysis, paints, { components });
    const recipe: RankedRecipeCandidate = {
      id: `recipe-${targetAnalysis.normalizedHex.slice(1)}-${signature}`,
      predictedHex: mix.hex,
      distanceScore: scoreBreakdown.spectralDistance,
      components,
      exactParts,
      exactPercentages,
      exactRatioText: formatRatio(exactParts),
      practicalParts,
      practicalPercentages,
      practicalRatioText: formatRatio(practicalParts),
      parts: practicalParts,
      ratioText: formatRatio(practicalParts),
      recipeText: buildRecipeText(paintNames, practicalParts),
      scoreBreakdown,
      qualityLabel: determineRecipeQuality(scoreBreakdown.finalScore),
      badges: [],
      guidanceText: [],
      nextAdjustments: detailedAdjustments.map((suggestion) => suggestion.detail),
      detailedAdjustments,
      targetAnalysis,
      predictedAnalysis,
      whyThisRanked: [],
      mixStrategy: [],
      mixPath: buildMixPath({ components, targetAnalysis, predictedAnalysis }, paints),
      stabilityWarnings: buildStabilityWarnings({ components }, paints),
      roleNotes: buildRoleNotes({ components }, paints),
      achievability: assessAchievability({ scoreBreakdown, targetAnalysis, predictedAnalysis }, paints),
      layeringSuggestion: buildLayeringSuggestion({ targetAnalysis, scoreBreakdown }, paints),
    };

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
    nextAdjustments: generateNextAdjustments(recipe.targetAnalysis, recipe.predictedAnalysis, paints, recipe),
    detailedAdjustments: generateAdjustmentSuggestions(recipe.targetAnalysis, recipe.predictedAnalysis, paints, recipe),
    mixStrategy: buildMixStrategy(paints, recipe.components, recipe.targetAnalysis, recipe.practicalRatioText),
    mixPath: buildMixPath(recipe, paints),
    stabilityWarnings: buildStabilityWarnings(recipe, paints),
    roleNotes: buildRoleNotes(recipe, paints),
    achievability: assessAchievability(recipe, paints),
    layeringSuggestion: buildLayeringSuggestion(recipe, paints),
  }));

  return assignRecipeBadges(enriched).slice(0, limit);
};
