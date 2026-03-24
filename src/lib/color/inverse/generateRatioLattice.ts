import type { CandidateTemplate, TargetProfile } from './types';

const BASE_TWO = [
  [1, 1],
  [2, 1],
  [1, 2],
  [3, 1],
  [1, 3],
  [4, 1],
];

const BASE_THREE = [
  [2, 1, 1],
  [3, 1, 1],
  [2, 2, 1],
];

const DARK_THREE = [
  [5, 2, 1],
  [6, 2, 1],
  [4, 3, 1],
];

const normalize = (parts: number[]): number[] => {
  const sum = parts.reduce((acc, value) => acc + value, 0);
  return parts.map((part) => Math.round((part / sum) * 100));
};

export const generateRatioLattice = (template: CandidateTemplate, profile: TargetProfile): number[][] => {
  const paintCount = template.paintIds.length;
  let ratios: number[][] = paintCount === 2 ? [...BASE_TWO] : [...BASE_THREE];

  if (paintCount === 3 && (profile.isDark || profile.isMuted)) {
    ratios = [...ratios, ...DARK_THREE];
  }

  if (profile.isVivid && !profile.isDark) {
    ratios = ratios.filter((parts) => Math.max(...parts) <= 4);
  }

  if (profile.isVeryLight) {
    ratios = ratios.filter((parts) => parts.length === 2 || parts[0] <= 4);
  }

  if (profile.isNearBoundary && paintCount === 2) {
    ratios = [...ratios, [5, 4], [4, 5]];
  }

  return ratios.map(normalize);
};
