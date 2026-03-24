import type { Paint, RankingMode } from '../../../types/models';
import type { ColorAnalysis } from '../../../types/models';
import type { CandidateTemplate, EvaluatedCandidate, TargetProfile } from './types';
import { evaluateCandidate } from './evaluateCandidates';

const mutate = (weights: number[], index: number, delta: number): number[] => {
  const next = [...weights];
  next[index] = Math.max(1, next[index] + delta);
  const sum = next.reduce((acc, value) => acc + value, 0);
  return next.map((value) => Math.max(1, Math.round((value / sum) * 100)));
};

const signature = (template: CandidateTemplate, weights: number[]): string => `${template.paintIds.join('|')}:${weights.join('|')}`;

export const refineCandidates = (
  seed: EvaluatedCandidate[],
  paints: Paint[],
  targetHex: string,
  targetAnalysis: ColorAnalysis,
  rankingMode: RankingMode,
  profile: TargetProfile,
): EvaluatedCandidate[] => {
  const byFamily = new Map(seed.map((candidate) => [candidate.familyId, seed.filter((entry) => entry.familyId === candidate.familyId)]));
  const refined: EvaluatedCandidate[] = [...seed];

  byFamily.forEach((familyCandidates, familyId) => {
    const top = familyCandidates.sort((a, b) => a.scoreBreakdown.finalScore - b.scoreBreakdown.finalScore).slice(0, 3);
    const seen = new Set<string>();

    top.forEach((candidate) => {
      candidate.recipe.forEach((component, index) => {
        [1, -1].forEach((delta) => {
          const mutatedWeights = mutate(candidate.recipe.map((entry) => entry.weight), index, delta);
          const template: CandidateTemplate = { familyId, paintIds: candidate.recipe.map((entry) => entry.paintId) };
          const key = signature(template, mutatedWeights);
          if (seen.has(key)) return;
          seen.add(key);
          const evaluated = evaluateCandidate(template, mutatedWeights, paints, targetHex, targetAnalysis, rankingMode, profile);
          if (evaluated && evaluated.structure.paintCount <= 4) {
            refined.push(evaluated);
          }
        });
      });
    });
  });

  return refined;
};
