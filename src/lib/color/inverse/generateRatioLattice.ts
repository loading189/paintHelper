import type { CandidateTemplate, TargetProfile } from './types';

const BASE_TWO = [
  [1, 1],
  [2, 1],
  [1, 2],
  [3, 1],
  [1, 3],
  [4, 1],
  [1, 4],
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
  [5, 1, 1],
  [4, 2, 1],
];

const DARK_GREEN_THREE = [
  // strong chromatic anchor + supporting secondary + restrained darkener
  [4, 2, 1],
  [5, 2, 1],
  [6, 2, 1],
  [4, 3, 1],
  [5, 3, 1],
  [6, 1, 1],
];

const DARK_FOUR = [
  [4, 2, 1, 1],
  [5, 2, 1, 1],
  [4, 3, 1, 1],
];

const BOUNDARY_TWO = [
  [5, 4],
  [4, 5],
  [6, 5],
  [5, 6],
];

const BOUNDARY_THREE = [
  [3, 2, 1],
  [4, 2, 1],
  [3, 3, 1],
];

const normalize = (parts: number[]): number[] => {
  const sum = parts.reduce((acc, value) => acc + value, 0);
  return parts.map((part) => Math.round((part / sum) * 100));
};

const dedupeRatios = (ratios: number[][]): number[][] => {
  const seen = new Set<string>();
  return ratios.filter((parts) => {
    const key = parts.join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const generateRatioLattice = (
  template: CandidateTemplate,
  profile: TargetProfile
): number[][] => {
  const paintCount = template.paintIds.length;

  let ratios: number[][] =
    paintCount === 2
      ? [...BASE_TWO]
      : paintCount === 3
        ? [...BASE_THREE]
        : [...DARK_FOUR];

  const isDark = profile.isDark || profile.isVeryDark;
  const isGreenLike =
    profile.hueFamily === 'green' ||
    profile.isDarkNaturalGreen;

  const isOliveLike =
    profile.hueFamily === 'yellow' &&
    (profile.isMuted || isDark);

  const isDarkChromaticGreenLike =
    isGreenLike &&
    isDark &&
    !profile.isNearNeutral;

  if (paintCount === 3 && (isDark || profile.isMuted)) {
    ratios = [...ratios, ...DARK_THREE];
  }

  if (paintCount === 3 && isDarkChromaticGreenLike) {
    ratios = [...ratios, ...DARK_GREEN_THREE];
  }

  if (paintCount === 4 && isDarkChromaticGreenLike) {
    ratios = [...ratios, ...DARK_FOUR];
  }

  if (paintCount === 3 && isOliveLike) {
    ratios = [
      ...ratios,
      [4, 2, 1],
      [5, 2, 1],
      [4, 3, 1],
    ];
  }

  if (profile.isVivid && !isDark) {
    // Keep vivid exploration cleaner and less dominated by one component.
    ratios = ratios.filter((parts) => Math.max(...parts) <= 4);
  }

  if (profile.isVeryLight) {
    // Avoid overcomplicated heavy-dark structures for very light targets.
    ratios = ratios.filter((parts) => {
      if (parts.length === 2) return true;
      return parts[0] <= 4 && parts[parts.length - 1] <= 2;
    });
  }

  if (profile.isNearBoundary) {
    if (paintCount === 2) {
      ratios = [...ratios, ...BOUNDARY_TWO];
    }

    if (paintCount === 3) {
      ratios = [...ratios, ...BOUNDARY_THREE];
    }
  }

  return dedupeRatios(ratios).map(normalize);
};