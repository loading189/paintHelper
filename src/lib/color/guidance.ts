import type { ColorAnalysis, Paint, RankedRecipe, RecipeBadge, RecipeQualityLabel, RecipeScoreBreakdown } from '../../types/models';

const getPaintMap = (paints: Paint[]) => new Map(paints.map((paint) => [paint.id, paint]));

export const determineRecipeQuality = (score: number): RecipeQualityLabel => {
  if (score < 0.18) {
    return 'Excellent spectral starting point';
  }
  if (score < 0.32) {
    return 'Strong spectral starting point';
  }
  if (score < 0.48) {
    return 'Usable spectral starting point';
  }
  return 'Needs hand-tuning';
};

export const buildRecipeWhyThisRanked = (
  scoreBreakdown: RecipeScoreBreakdown,
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
  paints: Paint[],
  componentPaintIds: string[],
): string[] => {
  const paintMap = getPaintMap(paints);
  const reasons: string[] = [];

  if (scoreBreakdown.spectralDistance < 0.08) {
    reasons.push('Spectral prediction lands very close overall, not just in flat RGB.');
  }
  if (scoreBreakdown.staysInTargetHueFamily && targetAnalysis.hueFamily !== 'neutral') {
    reasons.push(`Keeps the result in the target ${targetAnalysis.hueFamily} family.`);
  }
  if (scoreBreakdown.hasRequiredHueConstructionPath && targetAnalysis.hueFamily !== 'neutral') {
    reasons.push('Builds the hue from the painterly source colors you would usually start with on the palette.');
  }
  if (scoreBreakdown.chromaticPathBonus > 0) {
    reasons.push('Rewards a chromatic build before darkening or muting support enters the mix.');
  }
  if (scoreBreakdown.naturalMixBonus > 0) {
    const earthPaint = componentPaintIds.map((id) => paintMap.get(id)).find((paint) => paint?.heuristics?.naturalBias === 'earth');
    if (earthPaint) {
      reasons.push(`Uses ${earthPaint.name} to mute the mix naturally instead of collapsing the hue.`);
    }
  }
  if (scoreBreakdown.vividTargetPenalty > 0) {
    reasons.push('Penalized because vivid targets need a visibly convincing chromatic result.');
  }
  if (scoreBreakdown.blackPenalty > 0 || scoreBreakdown.supportPenalty > 0) {
    reasons.push('Support paints are kept secondary so they do not overpower the main hue path.');
  }
  if (Math.abs(predictedAnalysis.value - targetAnalysis.value) <= 0.05) {
    reasons.push('Value is already close enough that later hand-tuning can stay focused on hue and chroma.');
  }

  return [...new Set(reasons)].slice(0, 4);
};

export const buildRecipeGuidance = (
  scoreBreakdown: RecipeScoreBreakdown,
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
  paints: Paint[],
  componentPaintIds: string[],
  practicalRatioText: string,
): string[] => {
  const paintMap = getPaintMap(paints);
  const orderedPaints = componentPaintIds.map((id) => paintMap.get(id)).filter((paint): paint is Paint => Boolean(paint));
  const lines: string[] = [`Start with the practical ${practicalRatioText} ratio, then adjust in small pile-size increments.`];

  const strongest = orderedPaints.find((paint) => paint.heuristics?.tintStrength === 'very-high' || paint.heuristics?.tintStrength === 'high');
  if (strongest) {
    lines.push(`Add ${strongest.name} cautiously; it has enough tinting strength to swing the mix fast.`);
  }

  if (targetAnalysis.hueFamily !== 'neutral' && scoreBreakdown.hasRequiredHueConstructionPath) {
    lines.push(`Establish the ${targetAnalysis.hueFamily} hue first, then correct value and chroma.`);
  }

  if (predictedAnalysis.value < targetAnalysis.value - 0.04) {
    lines.push('The prediction is slightly dark; lift value after the hue reads correctly.');
  } else if (predictedAnalysis.value > targetAnalysis.value + 0.04) {
    lines.push('The prediction is slightly light; lower value with support paint only after checking the hue.');
  }

  if (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral') {
    lines.push('Because the target is muted, let the earth support do the softening instead of reaching for black too early.');
  }

  return [...new Set(lines)].slice(0, 4);
};

export const buildMixStrategy = (
  paints: Paint[],
  components: RankedRecipe['components'],
  targetAnalysis: ColorAnalysis,
  practicalRatioText: string,
): string[] => {
  const paintMap = getPaintMap(paints);
  const ordered = [...components].sort((left, right) => right.percentage - left.percentage);
  const orderedPaints = ordered.map((component) => paintMap.get(component.paintId)).filter((paint): paint is Paint => Boolean(paint));
  const dominant = orderedPaints[0];
  const chromatic = orderedPaints.filter((paint) => !paint.isBlack && !paint.isWhite && paint.heuristics?.naturalBias === 'chromatic');
  const support = orderedPaints.find((paint) => paint.heuristics?.preferredRole === 'neutralizer' || paint.isBlack);
  const lines: string[] = [`Use ${practicalRatioText} as the first palette pile guide.`];

  if (targetAnalysis.hueFamily === 'green' && chromatic.length >= 2) {
    const yellow = chromatic.find((paint) => paint.name.includes('Yellow'));
    const blue = chromatic.find((paint) => paint.name.includes('Blue'));
    if (yellow && blue) {
      lines.push(`Make the green with ${yellow.name} + ${blue.name} first, then introduce ${support?.name ?? 'support paint'} only if needed.`);
    }
  } else if (targetAnalysis.hueFamily === 'orange') {
    lines.push('Build orange from yellow and red first. Keep white and earth colors for later correction.');
  } else if (targetAnalysis.hueFamily === 'violet') {
    lines.push('Build violet from your red-blue pair before deciding whether it needs more value or less chroma.');
  } else if (dominant) {
    lines.push(`Start from ${dominant.name} as the base pile, then feed the smaller colors into it.`);
  }

  const strongPaint = orderedPaints.find((paint) => paint.heuristics?.tintStrength === 'very-high');
  if (strongPaint) {
    lines.push(`Touch in ${strongPaint.name} with the knife tip or very small brush-load increments.`);
  }

  if (targetAnalysis.valueClassification === 'very dark' || targetAnalysis.valueClassification === 'dark') {
    lines.push('Do not let dark support paint replace the hue path. Darken after the family reads correctly.');
  } else if (targetAnalysis.valueClassification === 'light' || targetAnalysis.valueClassification === 'very light') {
    lines.push('Keep white additions late and incremental so the hue does not go chalky too early.');
  }

  return [...new Set(lines)].slice(0, 4);
};

export const assignRecipeBadges = (recipes: RankedRecipe[]): RankedRecipe[] => {
  if (recipes.length === 0) {
    return recipes;
  }

  const updated = recipes.map((recipe) => ({ ...recipe, badges: [...recipe.badges] }));
  updated[0].badges.push('Best overall');

  const simplest = updated.reduce((best, current) => (current.components.length < best.components.length ? current : best), updated[0]);
  simplest.badges.push('Simplest');

  const bestHue = updated.reduce((best, current) =>
    current.scoreBreakdown.hueDifference < best.scoreBreakdown.hueDifference ? current : best,
  updated[0]);
  bestHue.badges.push('Best hue path');

  const bestValue = updated.reduce((best, current) =>
    current.scoreBreakdown.valueDifference < best.scoreBreakdown.valueDifference ? current : best,
  updated[0]);
  bestValue.badges.push('Best value setup');

  updated.forEach((recipe) => {
    if (recipe.scoreBreakdown.naturalMixBonus > 0) {
      recipe.badges.push('Muted naturally');
    }
    if (recipe.scoreBreakdown.chromaticPathBonus > 0) {
      recipe.badges.push('Chromatic build');
    }
    if (recipe.components.length === 1 && recipe.scoreBreakdown.singlePaintPenalty === 0) {
      recipe.badges.push('Single-paint shortcut');
    }
    recipe.badges = [...new Set(recipe.badges)] as RecipeBadge[];
  });

  return updated;
};
