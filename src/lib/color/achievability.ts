import type { AchievabilityInsight, Paint, RankedRecipe } from '../../types/models';

export const assessAchievability = (recipe: Pick<RankedRecipe, 'scoreBreakdown' | 'targetAnalysis' | 'predictedAnalysis'>, paints: Paint[]): AchievabilityInsight => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const hasWarmLightener = enabledPaints.some((paint) => paint.name.includes('Unbleached Titanium'));

  if (recipe.scoreBreakdown.finalScore <= 0.18) {
    return {
      level: 'strong',
      headline: 'Strongly achievable with current palette',
      detail: 'The current on-hand palette can reach this target cleanly enough to use the recipe directly as a working studio start.',
    };
  }

  if (recipe.targetAnalysis.saturationClassification === 'vivid' && recipe.predictedAnalysis.chroma < recipe.targetAnalysis.chroma - 0.03) {
    return {
      level: 'limited',
      headline: 'Closest achievable with current palette',
      detail: 'This target is more saturated than the current paints can cleanly reach, so expect a believable but slightly restrained result.',
    };
  }

  if (
    (recipe.targetAnalysis.valueClassification === 'light' || recipe.targetAnalysis.valueClassification === 'very light') &&
    recipe.targetAnalysis.hueFamily === 'orange' &&
    !hasWarmLightener
  ) {
    return {
      level: 'limited',
      headline: 'Warm-light range is constrained',
      detail: 'This target pushes beyond the warm light range of the current palette, so build the hue first and accept a slightly muted finish.',
    };
  }

  return {
    level: 'workable',
    headline: 'Workable with some refinement',
    detail: 'The palette can get close, but expect to lean on staged adjustments rather than a one-pass perfect pile.',
  };
};
