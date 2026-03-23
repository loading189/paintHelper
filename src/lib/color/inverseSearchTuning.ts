/**
 * Developer-only tuning for inverse recipe search and ranking.
 *
 * These knobs ONLY affect target -> candidate generation -> ranking behavior.
 * They must never be used to alter the truthful spectral forward prediction
 * once a recipe's paints and ratios are chosen.
 */
export const inverseSearchTuning = {
  darkTargets: {
    minDarkShare: 20,
    maxYellowShare: 60,
    maxLightShare: 0,
    dominantLightShareCap: 55,
    dominantYellowShareCap: 55,
    valuePenaltyScale: 1.45,
    earthStructuralBonus: 0.04,
  },
  yellows: {
    maxBlueShareLight: 5,
  },
  mutedTargets: {
    cleanlinessPenalty: 2.1,
  },
  vividTargets: {
    muddinessPenalty: 1.4,
  },
  neutrals: {
    balancePenalty: 2.4,
  },
  greenTargets: {
    requireEarthForDarkNatural: true,
    vividOffHuePenalty: 0.22,
  },
  ratioSearch: {
    maxComponents: 3,
    darkRatioFamiliesEnabled: true,
  },
} as const;

export type InverseSearchTuning = typeof inverseSearchTuning;
