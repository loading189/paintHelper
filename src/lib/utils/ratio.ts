const greatestCommonDivisor = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
};

export type PracticalRatioOptions = {
  idealMaxParts?: number;
  hardMaxParts?: number;
};

const EPSILON = 1e-9;

const getNormalizedShares = (weights: number[]): number[] => {
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  if (total <= 0) {
    return weights.map(() => 0);
  }

  return weights.map((weight) => weight / total);
};

const compareLexicographically = (left: number[], right: number[]): number => {
  const maxLength = Math.max(left.length, right.length);

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (left[index] ?? 0) - (right[index] ?? 0);
    if (delta !== 0) {
      return delta;
    }
  }

  return 0;
};

export const simplifyRatio = (weights: number[]): number[] => {
  if (weights.length === 0) {
    return [];
  }

  const rounded = weights.map((weight) => Math.round(weight));
  const divisor = rounded.reduce((accumulator, weight) => greatestCommonDivisor(accumulator, weight), rounded[0]);

  return rounded.map((weight) => weight / divisor);
};

const scorePracticalRatioCandidate = (candidate: number[], targetShares: number[], idealMaxParts: number) => {
  const totalParts = candidate.reduce((sum, part) => sum + part, 0);
  const candidateShares = candidate.map((part) => part / totalParts);
  const shareError = candidateShares.reduce((sum, share, index) => {
    const delta = share - targetShares[index];
    return sum + delta * delta;
  }, 0);
  const idealOverflow = Math.max(0, totalParts - idealMaxParts);
  const readabilityPenalty = totalParts * 0.00025 + Math.max(...candidate) * 0.00005;

  return {
    shareError,
    idealOverflow,
    totalParts,
    maxPart: Math.max(...candidate),
    score: shareError + idealOverflow * 0.0015 + readabilityPenalty,
  };
};

export const practicalRatioFromWeights = (
  weights: number[],
  options: PracticalRatioOptions = {},
): number[] => {
  if (weights.length === 0) {
    return [];
  }

  const idealMaxParts = options.idealMaxParts ?? 8;
  const hardMaxParts = options.hardMaxParts ?? 12;
  const exactRatio = simplifyRatio(weights);
  const exactTotalParts = exactRatio.reduce((sum, part) => sum + part, 0);

  if (exactTotalParts <= hardMaxParts) {
    return exactRatio;
  }

  const targetShares = getNormalizedShares(weights);
  let bestRatio: number[] | null = null;
  let bestScore: ReturnType<typeof scorePracticalRatioCandidate> | null = null;

  const visit = (remainingSlots: number, remainingParts: number, path: number[]): void => {
    if (remainingSlots === 1) {
      const candidate = [...path, remainingParts];
      const score = scorePracticalRatioCandidate(candidate, targetShares, idealMaxParts);

      if (
        !bestRatio ||
        !bestScore ||
        score.score < bestScore.score - EPSILON ||
        (Math.abs(score.score - bestScore.score) <= EPSILON && score.totalParts < bestScore.totalParts) ||
        (Math.abs(score.score - bestScore.score) <= EPSILON && score.totalParts === bestScore.totalParts && score.maxPart < bestScore.maxPart) ||
        (Math.abs(score.score - bestScore.score) <= EPSILON &&
          score.totalParts === bestScore.totalParts &&
          score.maxPart === bestScore.maxPart &&
          compareLexicographically(candidate, bestRatio) < 0)
      ) {
        bestRatio = candidate;
        bestScore = score;
      }
      return;
    }

    const minimumRemaining = remainingSlots - 1;
    for (let part = 1; part <= remainingParts - minimumRemaining; part += 1) {
      visit(remainingSlots - 1, remainingParts - part, [...path, part]);
    }
  };

  for (let totalParts = weights.length; totalParts <= hardMaxParts; totalParts += 1) {
    visit(weights.length, totalParts, []);
  }

  return bestRatio ?? exactRatio;
};

export const formatRatio = (parts: number[]): string => parts.join(':');
