import type { EvaluatedCandidate } from './types';

export const rankCandidates = (candidates: EvaluatedCandidate[]): EvaluatedCandidate[] =>
  [...candidates].sort((left, right) => {
    if (left.scoreBreakdown.primaryScore !== right.scoreBreakdown.primaryScore) return left.scoreBreakdown.primaryScore - right.scoreBreakdown.primaryScore;
    if (left.scoreBreakdown.finalScore !== right.scoreBreakdown.finalScore) return left.scoreBreakdown.finalScore - right.scoreBreakdown.finalScore;
    if (left.structure.paintCount !== right.structure.paintCount) return left.structure.paintCount - right.structure.paintCount;
    return left.familyId.localeCompare(right.familyId);
  });
