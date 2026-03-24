import type { RankingMode } from '../../../types/models';
import type { EvaluatedCandidate } from './types';

export const rankCandidates = (candidates: EvaluatedCandidate[], rankingMode: RankingMode): EvaluatedCandidate[] => {
  const sorted = [...candidates].sort((left, right) => {
    if (rankingMode === 'full-heuristics-legacy') {
      if (left.scoreBreakdown.finalScore !== right.scoreBreakdown.finalScore) {
        return left.scoreBreakdown.finalScore - right.scoreBreakdown.finalScore;
      }
    } else {
      if (left.scoreBreakdown.primaryScore !== right.scoreBreakdown.primaryScore) {
        return left.scoreBreakdown.primaryScore - right.scoreBreakdown.primaryScore;
      }
      if (left.scoreBreakdown.finalScore !== right.scoreBreakdown.finalScore) {
        return left.scoreBreakdown.finalScore - right.scoreBreakdown.finalScore;
      }
    }
    if (left.structure.paintCount !== right.structure.paintCount) {
      return left.structure.paintCount - right.structure.paintCount;
    }
    return left.familyId.localeCompare(right.familyId);
  });

  return sorted;
};
