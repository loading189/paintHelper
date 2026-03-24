import type { Paint, PaletteComparison, RankedRecipe, UserSettings } from '../../types/models';
import { analyzeColor, hueDifference } from './colorAnalysis';
import { spectralDistanceBetweenHexes } from './spectralMixing';
import { solveTarget } from './inverse/solveTarget';
import { getIdealPalette, getOnHandPalette } from './paletteMode';

export type SolveWithPalettesResult = {
  idealResult: RankedRecipe | null;
  onHandResult: RankedRecipe | null;
  comparison: PaletteComparison;
};

const emptyGap = {
  spectralDistance: Number.POSITIVE_INFINITY,
  valueDelta: 1,
  chromaDelta: 1,
  hueDelta: 1,
  targetToIdealDistance: Number.POSITIVE_INFINITY,
};

const computeMissingPaintIds = (ideal: RankedRecipe | null, onHandPalette: Paint[]): string[] => {
  if (!ideal) return [];
  const onHandIds = new Set(onHandPalette.map((paint) => paint.id));
  return ideal.components.map((component) => component.paintId).filter((id) => !onHandIds.has(id));
};

const computeLimitingFactors = (
  targetHex: string,
  ideal: RankedRecipe | null,
  onHand: RankedRecipe | null,
  missingPaintIds: string[],
): string[] => {
  const factors: string[] = [];
  const target = analyzeColor(targetHex);
  if (!target) return factors;

  if (ideal && ideal.distanceScore > 0.2) {
    factors.push('inherently difficult target');
  }
  if (ideal && onHand && ideal.distanceScore <= 0.2 && onHand.distanceScore > 0.2) {
    factors.push('limited by palette');
  }
  if (target.saturationClassification === 'vivid' && onHand && onHand.predictedAnalysis.chroma < target.chroma - 0.025) {
    factors.push('on-hand chroma ceiling');
  }
  if (missingPaintIds.length) {
    factors.push('missing key hue builders');
  }
  if (!factors.length && onHand && onHand.distanceScore <= 0.2) {
    factors.push('strong');
  }

  return factors;
};

export const solveWithPalettes = (targetHex: string, paints: Paint[], settings: UserSettings, limit = 8): SolveWithPalettesResult => {
  const onHandPalette = getOnHandPalette(paints);
  const idealPalette = getIdealPalette(paints);

  const solveSettings: UserSettings = { ...settings, rankingMode: 'spectral-first' };
  const idealResult = solveTarget(targetHex, idealPalette, solveSettings, limit).rankedRecipes[0] ?? null;
  const onHandResult = solveTarget(targetHex, onHandPalette, solveSettings, limit).rankedRecipes[0] ?? null;

  const missingPaintIds = computeMissingPaintIds(idealResult, onHandPalette);

  const gap = idealResult && onHandResult
    ? {
        spectralDistance: spectralDistanceBetweenHexes(idealResult.predictedHex, onHandResult.predictedHex),
        valueDelta: Math.abs(idealResult.predictedAnalysis.value - onHandResult.predictedAnalysis.value),
        chromaDelta: Math.abs(idealResult.predictedAnalysis.chroma - onHandResult.predictedAnalysis.chroma),
        hueDelta: hueDifference(idealResult.predictedAnalysis.hue, onHandResult.predictedAnalysis.hue),
        targetToIdealDistance: spectralDistanceBetweenHexes(targetHex, idealResult.predictedHex),
      }
    : emptyGap;

  return {
    idealResult,
    onHandResult,
    comparison: {
      ideal: idealResult,
      onHand: onHandResult,
      gap,
      limitingFactors: computeLimitingFactors(targetHex, idealResult, onHandResult, missingPaintIds),
      missingPaintIds,
    },
  };
};
