import type { AchievabilityInsight, Paint, RankedRecipe } from '../../types/models';

export const assessAchievability = (
  recipe: Pick<RankedRecipe, 'scoreBreakdown' | 'targetAnalysis' | 'predictedAnalysis'>,
  paints: Paint[],
): AchievabilityInsight => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const hasWarmLightener = enabledPaints.some((paint) => paint.name.includes('Unbleached Titanium'));
  const spectralGap = recipe.scoreBreakdown.spectralDistance;
  const valueGap = Math.abs(recipe.targetAnalysis.value - recipe.predictedAnalysis.value);
  const chromaShortfall = Math.max(0, recipe.targetAnalysis.chroma - recipe.predictedAnalysis.chroma);

  if (spectralGap <= 0.18 && valueGap <= 0.12) {
    return {
      level: 'strong',
      headline: 'Strongly achievable with current palette',
      detail: 'The palette can land close enough spectrally and by value to use this recipe directly as a studio start.',
    };
  }

  if (recipe.targetAnalysis.saturationClassification === 'vivid' && chromaShortfall > 0.03) {
    return {
      level: 'limited',
      headline: 'Closest achievable with current palette',
      detail: 'The target pushes chroma beyond current palette reach, so expect a believable but slightly restrained result.',
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
      detail: 'Warm highlight handling is palette-limited; keep hue construction first and accept a modest chroma/value compromise.',
    };
  }

  return {
    level: 'workable',
    headline: 'Workable with refinement',
    detail: 'Palette limits are manageable, but reaching the target cleanly will likely need staged hue/value adjustments.',
  };
};
