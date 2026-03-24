import type { AchievabilityInsight, Paint, RankedRecipe } from '../../types/models';

const CLOSE_DISTANCE = 0.18;

export const assessAchievability = (
  recipe: Pick<RankedRecipe, 'scoreBreakdown' | 'targetAnalysis' | 'predictedAnalysis'>,
  paints: Paint[],
): AchievabilityInsight => {
  const spectralGap = recipe.scoreBreakdown.spectralDistance;
  const onHandCount = paints.filter((paint) => paint.isOnHand).length;
  const hasIdealLibrary = paints.some((paint) => paint.isIdealLibrary);

  if (spectralGap <= CLOSE_DISTANCE) {
    return {
      level: 'strong',
      headline: 'Strongly achievable with this palette',
      detail: 'Predicted spectral and value gaps are already close enough for a practical studio start.',
    };
  }

  if (hasIdealLibrary && onHandCount > 0) {
    return {
      level: 'limited',
      headline: 'Limited by available paints',
      detail: 'The solver path is stable, but this palette boundary is keeping the best match farther than ideal.',
    };
  }

  return {
    level: 'limited',
    headline: 'Inherently difficult target',
    detail: 'Even with a realistic expanded palette this target is still spectrally hard and will require compromise.',
  };
};
