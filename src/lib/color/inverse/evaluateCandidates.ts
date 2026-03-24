import type { Paint, RankingMode, RecipeComponent, RecipeScoreBreakdown } from '../../../types/models';
import { analyzeColor, hueDifference } from '../colorAnalysis';
import { predictSpectralMix, spectralDistanceBetweenHexes } from '../spectralMixing';
import { practicalRatioFromWeights, simplifyRatio } from '../../utils/ratio';
import type { CandidateTemplate, EvaluatedCandidate, TargetProfile } from './types';

const buildScore = (
  mode: RankingMode,
  spectralDistance: number,
  valueDifference: number,
  hueDiff: number,
  saturationDifference: number,
  chromaDifference: number,
  paintCount: number,
  ratioComplexity: number,
): RecipeScoreBreakdown => {
  const primaryScore = spectralDistance + valueDifference * 0.18 + hueDiff * 0.14 + chromaDifference * 0.08 + saturationDifference * 0.06;
  const regularizationPenalty = mode === 'full-heuristics-legacy' ? 0 : (paintCount - 2) * 0.01 + ratioComplexity * 0.0015;
  const finalScore = mode === 'full-heuristics-legacy' ? primaryScore + (paintCount - 1) * 0.03 : primaryScore + regularizationPenalty;

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
    legacyHeuristicPenalty: mode === 'full-heuristics-legacy' ? (paintCount - 1) * 0.03 : 0,
    legacyHeuristicBonus: 0,
    complexityPenalty: (paintCount - 1) * 0.01,
    hueFamilyPenalty: 0,
    constructionPenalty: 0,
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
    hasRequiredHueConstructionPath: true,
    staysInTargetHueFamily: true,
    finalScore,
  };
};

export const evaluateCandidate = (
  template: CandidateTemplate,
  weights: number[],
  paints: Paint[],
  targetHex: string,
  targetAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  rankingMode: RankingMode,
  _profile: TargetProfile,
): EvaluatedCandidate | null => {
  const recipe: RecipeComponent[] = template.paintIds.map((paintId, index) => ({ paintId, weight: weights[index], percentage: weights[index] }));
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
  const practicalParts = practicalRatioFromWeights(weights, { idealMaxParts: weights.length === 3 ? 9 : 8, hardMaxParts: 12 });
  const ratioComplexity = practicalParts.reduce((sum, value) => sum + value, 0);
  const scoreBreakdown = buildScore(
    rankingMode,
    targetGaps.spectralDistance,
    targetGaps.valueDifference,
    targetGaps.hueDifference,
    Math.abs(targetAnalysis.saturation - predictedAnalysis.saturation),
    targetGaps.chromaDifference,
    recipe.length,
    ratioComplexity,
  );

  const hasEarth = template.paintIds.some((id) => paints.find((paint) => paint.id === id)?.heuristics?.naturalBias === 'earth');

  return {
    familyId: template.familyId,
    recipe,
    predictedHex: mix.hex,
    predictedAnalysis,
    targetGaps,
    structure: {
      paintCount: recipe.length,
      ratioComplexity,
      hasWhite: template.paintIds.some((id) => paints.find((paint) => paint.id === id)?.isWhite),
      hasBlack: template.paintIds.some((id) => paints.find((paint) => paint.id === id)?.isBlack),
      hasEarth,
    },
    scoreBreakdown,
    exactParts,
    practicalParts,
  };
};
