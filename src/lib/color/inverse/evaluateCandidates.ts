import type { Paint, RecipeComponent, RecipeScoreBreakdown } from '../../../types/models';
import { analyzeColor, hueDifference } from '../colorAnalysis';
import { predictSpectralMix, spectralDistanceBetweenHexes } from '../spectralMixing';
import { practicalRatioFromWeights, simplifyRatio } from '../../utils/ratio';
import { canonicalizeRecipeComponents } from '../recipeCanonicalization';
import type { CandidateTemplate, EvaluatedCandidate, TargetProfile } from './types';

const buildScore = (
  mode: 'spectral-first',
  spectralDistance: number,
  valueDifference: number,
  hueDiff: number,
  saturationDifference: number,
  chromaDifference: number,
  paintCount: number,
  ratioComplexity: number,
  constructionPenalty: number,
  hueFamilyPenalty: number,
): RecipeScoreBreakdown => {
  const primaryScore =
    spectralDistance +
    valueDifference * 0.18 +
    hueDiff * 0.14 +
    chromaDifference * 0.08 +
    saturationDifference * 0.06;

  const regularizationPenalty =
    (paintCount - 2) * 0.01 +
    ratioComplexity * 0.0015 +
    constructionPenalty +
    hueFamilyPenalty;

  const finalScore = primaryScore + regularizationPenalty;

  return {
    mode,
    spectralDistance,
    valueDifference,
    hueDifference: hueDiff,
    saturationDifference,
    chromaDifference,
    primaryScore,
    regularizationPenalty,
    regularizationBonus: 0,
    legacyHeuristicPenalty: 0,
    legacyHeuristicBonus: 0,
    complexityPenalty: (paintCount - 1) * 0.01,
    hueFamilyPenalty,
    constructionPenalty,
    supportPenalty: 0,
    dominancePenalty: 0,
    neutralizerPenalty: 0,
    blackPenalty: 0,
    whitePenalty: 0,
    earlyWhitePenalty: 0,
    singlePaintPenalty: 0,
    naturalMixBonus: 0,
    chromaticPathBonus: 0,
    twoPaintUsabilityBonus: 0,
    vividTargetPenalty: 0,
    hasRequiredHueConstructionPath: constructionPenalty === 0,
    staysInTargetHueFamily: hueFamilyPenalty === 0,
    finalScore,
  };
};

const getPaintByIdMap = (paints: Paint[]): Map<string, Paint> =>
  new Map(paints.map((paint) => [paint.id, paint]));

const getWeightShare = (
  recipe: RecipeComponent[],
  paintsById: Map<string, Paint>,
  predicate: (paint: Paint) => boolean,
): number => {
  const total = recipe.reduce((sum, component) => sum + component.weight, 0);
  if (total <= 0) return 0;

  const matched = recipe.reduce((sum, component) => {
    const paint = paintsById.get(component.paintId);
    if (!paint) return sum;
    return predicate(paint) ? sum + component.weight : sum;
  }, 0);

  return matched / total;
};

const getPaintHueRole = (paint: Paint): 'yellow' | 'green' | 'blue' | 'red' | 'violet' | 'earth' | 'black' | 'white' | 'other' => {
  const name = paint.name.toLowerCase();

  if (paint.isBlack) return 'black';
  if (paint.isWhite || name.includes('unbleached titanium')) return 'white';
  if (paint.heuristics?.naturalBias === 'earth') return 'earth';
  if (name.includes('yellow')) return 'yellow';
  if (name.includes('green')) return 'green';
  if (name.includes('blue')) return 'blue';
  if (name.includes('red') || name.includes('crimson')) return 'red';
  if (name.includes('violet') || name.includes('purple')) return 'violet';

  return 'other';
};

const hasHueRole = (
  recipe: RecipeComponent[],
  paintsById: Map<string, Paint>,
  role: ReturnType<typeof getPaintHueRole>,
): boolean =>
  recipe.some((component) => {
    const paint = paintsById.get(component.paintId);
    return paint ? getPaintHueRole(paint) === role : false;
  });

const getConstructionPenalty = (
  recipe: RecipeComponent[],
  paintsById: Map<string, Paint>,
  targetAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  predictedAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  profile: TargetProfile,
): number => {
  const chromaticShare = getWeightShare(
    recipe,
    paintsById,
    (paint) => !paint.isBlack && !paint.isWhite && paint.heuristics?.naturalBias !== 'earth',
  );

  const earthShare = getWeightShare(
    recipe,
    paintsById,
    (paint) => paint.heuristics?.naturalBias === 'earth',
  );

  const blackShare = getWeightShare(
    recipe,
    paintsById,
    (paint) => paint.isBlack,
  );

  const whiteShare = getWeightShare(
    recipe,
    paintsById,
    (paint) => paint.isWhite || paint.name.toLowerCase().includes('unbleached titanium'),
  );

  const hasYellow = hasHueRole(recipe, paintsById, 'yellow');
  const hasGreen = hasHueRole(recipe, paintsById, 'green');
  const hasBlue = hasHueRole(recipe, paintsById, 'blue');

  const hasGreenPath = hasGreen || (hasYellow && hasBlue);
  const darkenerShare = earthShare + blackShare;

  let penalty = 0;

  const isDarkChromaticGreenTarget =
    (profile.hueFamily === 'green' || profile.isDarkNaturalGreen) &&
    (profile.isDark || profile.isVeryDark) &&
    !profile.isNearNeutral;

  const isDarkOliveLikeTarget =
    profile.hueFamily === 'yellow' &&
    (profile.isDark || profile.isVeryDark || profile.isMuted) &&
    !profile.isNearNeutral;

  if (isDarkChromaticGreenTarget) {
    if (!hasGreenPath) {
      penalty += 0.08;
    }

    if (chromaticShare < 0.45) {
      penalty += 0.05;
    }

    if (darkenerShare > 0.55) {
      penalty += 0.05;
    }

    if (whiteShare > 0.1) {
      penalty += 0.03;
    }

    if (predictedAnalysis.chroma < targetAnalysis.chroma * 0.6) {
      penalty += 0.04;
    }
  }

  if (isDarkOliveLikeTarget) {
    const hasBlueOrGreenSupport = hasBlue || hasGreen;

    if (!hasBlueOrGreenSupport && earthShare > 0) {
      penalty += 0.06;
    }

    if (predictedAnalysis.chroma < targetAnalysis.chroma * 0.55) {
      penalty += 0.04;
    }

    if (darkenerShare > 0.6) {
      penalty += 0.04;
    }
  }

  return penalty;
};

const getHueFamilyPenalty = (
  targetAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  predictedAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  profile: TargetProfile,
): number => {
  let penalty = 0;

  const hueDiff = hueDifference(targetAnalysis.hue, predictedAnalysis.hue);

  const isDarkChromaticTarget =
    (profile.isDark || profile.isVeryDark) &&
    !profile.isNearNeutral &&
    (profile.hueFamily === 'green' || profile.hueFamily === 'yellow');

  if (isDarkChromaticTarget && hueDiff > 0.16) {
    penalty += 0.03;
  }

  const chromaCollapse =
    targetAnalysis.chroma > 0.08 &&
    predictedAnalysis.chroma < targetAnalysis.chroma * 0.55;

  if (isDarkChromaticTarget && chromaCollapse) {
    penalty += 0.03;
  }

  return penalty;
};

export const evaluateCandidate = (
  template: CandidateTemplate,
  weights: number[],
  paints: Paint[],
  targetHex: string,
  targetAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  _rankingMode: 'spectral-first',
  profile: TargetProfile,
): EvaluatedCandidate | null => {
  if (template.paintIds.length !== weights.length) return null;

  const recipe: RecipeComponent[] = canonicalizeRecipeComponents(
    template.paintIds.map((paintId, index) => ({
      paintId,
      weight: weights[index],
    })),
  ).map((component) => ({
    ...component,
    percentage: component.weight,
  }));

  const mix = predictSpectralMix(paints, recipe);
  const predictedAnalysis = analyzeColor(mix.hex);
  if (!predictedAnalysis) return null;

  const targetGaps = {
    spectralDistance: spectralDistanceBetweenHexes(targetHex, mix.hex),
    valueDifference: Math.abs(targetAnalysis.value - predictedAnalysis.value),
    hueDifference: hueDifference(targetAnalysis.hue, predictedAnalysis.hue),
    chromaDifference: Math.abs(targetAnalysis.chroma - predictedAnalysis.chroma),
  };

  const exactParts = simplifyRatio(weights);
  const practicalParts = practicalRatioFromWeights(weights, {
    idealMaxParts: weights.length === 3 ? 9 : 8,
    hardMaxParts: 12,
  });

  const ratioComplexity = practicalParts.reduce((sum, value) => sum + value, 0);
  const paintsById = getPaintByIdMap(paints);

  const constructionPenalty = getConstructionPenalty(
    recipe,
    paintsById,
    targetAnalysis,
    predictedAnalysis,
    profile,
  );

  const hueFamilyPenalty = getHueFamilyPenalty(
    targetAnalysis,
    predictedAnalysis,
    profile,
  );

  const scoreBreakdown = buildScore(
    'spectral-first',
    targetGaps.spectralDistance,
    targetGaps.valueDifference,
    targetGaps.hueDifference,
    Math.abs(targetAnalysis.saturation - predictedAnalysis.saturation),
    targetGaps.chromaDifference,
    recipe.length,
    ratioComplexity,
    constructionPenalty,
    hueFamilyPenalty,
  );

  const hasEarth = recipe.some(
    (component) => paintsById.get(component.paintId)?.heuristics?.naturalBias === 'earth',
  );

  return {
    familyId: template.familyId,
    recipe,
    predictedHex: mix.hex,
    predictedAnalysis,
    targetGaps,
    structure: {
      paintCount: recipe.length,
      ratioComplexity,
      hasWhite: recipe.some((component) => paintsById.get(component.paintId)?.isWhite),
      hasBlack: recipe.some((component) => paintsById.get(component.paintId)?.isBlack),
      hasEarth,
    },
    scoreBreakdown,
    exactParts,
    practicalParts,
  };
};