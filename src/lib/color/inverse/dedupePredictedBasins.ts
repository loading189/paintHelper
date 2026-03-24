import { spectralDistanceBetweenHexes } from '../spectralMixing';
import type { EvaluatedCandidate } from './types';

const compare = (left: EvaluatedCandidate, right: EvaluatedCandidate): number => {
  if (left.scoreBreakdown.spectralDistance !== right.scoreBreakdown.spectralDistance) {
    return left.scoreBreakdown.spectralDistance - right.scoreBreakdown.spectralDistance;
  }
  if (left.structure.paintCount !== right.structure.paintCount) {
    return left.structure.paintCount - right.structure.paintCount;
  }
  if (left.structure.ratioComplexity !== right.structure.ratioComplexity) {
    return left.structure.ratioComplexity - right.structure.ratioComplexity;
  }
  return left.scoreBreakdown.finalScore - right.scoreBreakdown.finalScore;
};

export const dedupePredictedBasins = (candidates: EvaluatedCandidate[], threshold = 0.01): EvaluatedCandidate[] => {
  const sorted = [...candidates].sort(compare);
  const kept: EvaluatedCandidate[] = [];

  sorted.forEach((candidate) => {
    const basinMatch = kept.find((existing) => spectralDistanceBetweenHexes(existing.predictedHex, candidate.predictedHex) <= threshold);
    if (!basinMatch) {
      kept.push(candidate);
    }
  });

  return kept;
};
