import type { Paint } from '../../../types/models';
import type { ColorAnalysis } from '../../../types/models';
import type { CandidateTemplate, EvaluatedCandidate, TargetProfile } from './types';
import { evaluateCandidate } from './evaluateCandidates';

const mutate = (weights: number[], index: number, delta: number): number[] => {
  const next = [...weights];
  next[index] = Math.max(1, next[index] + delta);

  const sum = next.reduce((acc, value) => acc + value, 0);
  return next.map((value) => Math.max(1, Math.round((value / sum) * 100)));
};

const signature = (template: CandidateTemplate, weights: number[]): string =>
  `${template.paintIds.join('|')}:${weights.join('|')}`;

const getPaintRole = (paint: Paint): 'yellow' | 'green' | 'blue' | 'earth' | 'black' | 'white' | 'other' => {
  const name = paint.name.toLowerCase();

  if (paint.isBlack) return 'black';
  if (paint.isWhite || name.includes('unbleached titanium')) return 'white';
  if (paint.heuristics?.naturalBias === 'earth') return 'earth';
  if (name.includes('yellow')) return 'yellow';
  if (name.includes('green')) return 'green';
  if (name.includes('blue')) return 'blue';

  return 'other';
};

export const refineCandidates = (
  seed: EvaluatedCandidate[],
  paints: Paint[],
  targetHex: string,
  targetAnalysis: ColorAnalysis,
  rankingMode: 'spectral-first',
  profile: TargetProfile,
): EvaluatedCandidate[] => {
  const paintsById = new Map(paints.map((paint) => [paint.id, paint]));
  const byFamily = new Map(
    seed.map((candidate) => [
      candidate.familyId,
      seed.filter((entry) => entry.familyId === candidate.familyId),
    ])
  );

  const refined: EvaluatedCandidate[] = [...seed];

  byFamily.forEach((familyCandidates, familyId) => {
    const top = familyCandidates
      .sort((a, b) => a.scoreBreakdown.finalScore - b.scoreBreakdown.finalScore)
      .slice(0, 3);

    const seen = new Set<string>();

    top.forEach((candidate) => {
      const template: CandidateTemplate = {
        familyId,
        paintIds: candidate.recipe.map((entry) => entry.paintId),
      };

      const currentWeights = candidate.recipe.map((entry) => entry.weight);
      const currentPaints = template.paintIds
        .map((id) => paintsById.get(id))
        .filter((paint): paint is Paint => Boolean(paint));

      const roles = currentPaints.map(getPaintRole);

      // Base generic refinement: nudge each component up/down.
      candidate.recipe.forEach((_, index) => {
        [1, -1].forEach((delta) => {
          const mutatedWeights = mutate(currentWeights, index, delta);
          const key = signature(template, mutatedWeights);

          if (seen.has(key)) return;
          seen.add(key);

          const evaluated = evaluateCandidate(
            template,
            mutatedWeights,
            paints,
            targetHex,
            targetAnalysis,
            rankingMode,
            profile
          );

          if (evaluated && evaluated.structure.paintCount <= 4) {
            refined.push(evaluated);
          }
        });
      });

      // New: targeted refinement for dark chromatic green / olive-like targets.
      const isDarkChromaticGreenTarget =
        (profile.hueFamily === 'green' || profile.isDarkNaturalGreen) &&
        (profile.isDark || profile.isVeryDark) &&
        !profile.isNearNeutral;

      if (isDarkChromaticGreenTarget) {
        roles.forEach((role, index) => {
          const deltas: number[] = [];

          // Strengthen the green-building core.
          if (role === 'blue' || role === 'green') {
            deltas.push(2, 1);
          }

          // Often reduce yellow slightly once a dark green path is established.
          if (role === 'yellow') {
            deltas.push(-1);
          }

          // Keep darkeners supportive, not dominant.
          if (role === 'earth' || role === 'black') {
            deltas.push(-1, 1);
          }

          // Lighteners should be pushed out of this target class.
          if (role === 'white') {
            deltas.push(-2, -1);
          }

          deltas.forEach((delta) => {
            const mutatedWeights = mutate(currentWeights, index, delta);
            const key = signature(template, mutatedWeights);

            if (seen.has(key)) return;
            seen.add(key);

            const evaluated = evaluateCandidate(
              template,
              mutatedWeights,
              paints,
              targetHex,
              targetAnalysis,
              rankingMode,
              profile
            );

            if (evaluated && evaluated.structure.paintCount <= 4) {
              refined.push(evaluated);
            }
          });
        });
      }
    });
  });

  return refined;
};