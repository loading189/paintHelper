import type { ColorAnalysis, Paint, RankedRecipe, RecipeBadge, RecipeQualityLabel, RecipeScoreBreakdown } from '../../types/models';

const formatBias = (candidateHue: number | null, targetHue: number | null): string | null => {
  if (candidateHue === null || targetHue === null) {
    return null;
  }

  const delta = ((candidateHue - targetHue + 540) % 360) - 180;
  if (Math.abs(delta) < 8) {
    return 'Very close in hue direction.';
  }

  return delta > 0 ? 'Slightly cooler than the target.' : 'Slightly warmer than the target.';
};

export const determineRecipeQuality = (score: number): RecipeQualityLabel => {
  if (score < 0.16) {
    return 'Excellent starting point';
  }
  if (score < 0.28) {
    return 'Strong starting point';
  }
  if (score < 0.42) {
    return 'Usable starting point';
  }
  return 'Rough direction only';
};

export const buildRecipeWhyThisRanked = (
  scoreBreakdown: RecipeScoreBreakdown,
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
  paints: Paint[],
  componentPaintIds: string[],
): string[] => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const reasons: string[] = [];

  if (scoreBreakdown.valueDifference <= 0.08) {
    reasons.push('Closest in value, which makes it easier to judge later hue tweaks.');
  }

  if (scoreBreakdown.staysInTargetHueFamily && targetAnalysis.hueFamily !== 'neutral') {
    reasons.push(`Stays in the target ${targetAnalysis.hueFamily} family instead of drifting neutral or brown.`);
  }

  if (scoreBreakdown.hasRequiredHueConstructionPath && targetAnalysis.hueFamily !== 'neutral') {
    reasons.push('Uses the expected painterly hue-building path for this color family.');
  }

  if (scoreBreakdown.chromaticPathBonus > 0) {
    reasons.push('Rewards a painterly chromatic path built from the expected hue-building colors.');
  }

  if (scoreBreakdown.earthToneBonus > 0) {
    const earthPaint = componentPaintIds
      .map((paintId) => paintMap.get(paintId))
      .find((paint) => paint?.heuristics?.naturalBias === 'earth');
    if (earthPaint) {
      reasons.push(`Muted naturally with ${earthPaint.name}.`);
    }
  }

  const hueBias = formatBias(predictedAnalysis.hue, targetAnalysis.hue);
  if (hueBias) {
    reasons.push(hueBias);
  }

  if (componentPaintIds.length === 1 && scoreBreakdown.singlePaintPenalty === 0) {
    reasons.push('Very close overall; single-paint shortcut is acceptable here.');
  }

  if (scoreBreakdown.hueFamilyPenalty > 0) {
    reasons.push('Penalized for leaving the target hue family in a painter-oriented mode.');
  }

  if (scoreBreakdown.requiredHueConstructionPenalty > 0) {
    reasons.push('Penalized because the recipe skips the expected color-building paints for this hue family.');
  }

  if (scoreBreakdown.blackDominancePenalty > 0) {
    reasons.push('Penalized because black dominates before the hue family is clearly established.');
  }

  if (scoreBreakdown.blackPenalty > 0) {
    reasons.push('Penalized slightly to avoid a black-only shortcut when a better hue mix exists.');
  }

  if (scoreBreakdown.whitePenalty > 0) {
    reasons.push('Penalized slightly to avoid a white-only shortcut when a better mix is nearby.');
  }

  if (reasons.length === 0) {
    reasons.push('Balanced score across color distance, value, hue, and practical mixing complexity.');
  }

  return reasons.slice(0, 4);
};

export const buildRecipeGuidance = (
  scoreBreakdown: RecipeScoreBreakdown,
  targetAnalysis: ColorAnalysis,
  predictedAnalysis: ColorAnalysis,
  paints: Paint[],
  componentPaintIds: string[],
  practicalRatioText: string,
): string[] => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const lines: string[] = [`Start with a practical ${practicalRatioText} mix, then fine-tune by eye.`];

  if ((targetAnalysis.valueClassification === 'dark' || targetAnalysis.valueClassification === 'very dark') && targetAnalysis.hueFamily !== 'neutral') {
    lines.push(`Establish the ${targetAnalysis.hueFamily} hue family first, then darken only as needed.`);
  } else if (scoreBreakdown.valueDifference <= 0.06) {
    lines.push('Closest in value; adjust hue by eye after establishing the value block-in.');
  } else if (predictedAnalysis.value < targetAnalysis.value) {
    lines.push('Good hue direction, but likely needs a touch more light to reach the target value.');
  } else {
    lines.push('Good hue direction, but may need slight darkening to settle the value.');
  }

  if (scoreBreakdown.staysInTargetHueFamily && targetAnalysis.hueFamily !== 'neutral') {
    lines.push(`Keeps a better ${targetAnalysis.hueFamily} bias than a generic neutral shortcut.`);
  }

  if (scoreBreakdown.hasRequiredHueConstructionPath && targetAnalysis.hueFamily !== 'neutral') {
    lines.push(`Builds the ${targetAnalysis.hueFamily} family from the expected painterly color pair first.`);
  }

  if (scoreBreakdown.chromaticPathBonus > 0) {
    lines.push('This mix uses a painterly color-building path rather than relying on value alone.');
  }

  const earthPaint = componentPaintIds
    .map((paintId) => paintMap.get(paintId))
    .find((paint) => paint?.heuristics?.naturalBias === 'earth');
  if (earthPaint && (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral')) {
    lines.push(`Muted naturally with ${earthPaint.name}.`);
  }

  if (componentPaintIds.length === 1 && scoreBreakdown.singlePaintPenalty === 0) {
    lines.push('Single-paint shortcut: useful if you want speed over exact nuance.');
  }

  return [...new Set(lines)].slice(0, 3);
};

export const buildMixStrategy = (
  paints: Paint[],
  components: RankedRecipe['components'],
  targetAnalysis: ColorAnalysis,
  practicalRatioText: string,
): string[] => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const ordered = [...components].sort((left, right) => right.percentage - left.percentage);
  const dominant = ordered[0] ? paintMap.get(ordered[0].paintId) : null;
  const secondary = ordered[1] ? paintMap.get(ordered[1].paintId) : null;
  const hasBlack = ordered.some((component) => paintMap.get(component.paintId)?.isBlack);
  const earthSupport = ordered
    .map((component) => paintMap.get(component.paintId))
    .find((paint) => paint?.heuristics?.naturalBias === 'earth');
  const lines: string[] = [`Use the practical ${practicalRatioText} ratio as your first pile size guide.`];

  const chromaticPaints = ordered
    .map((component) => paintMap.get(component.paintId))
    .filter(
      (paint): paint is Paint =>
        paint !== undefined && !paint.isBlack && !paint.isWhite && paint.heuristics?.naturalBias === 'chromatic',
    );
  const yellowPaint = chromaticPaints.find((paint) => paint.name.toLowerCase().includes('yellow'));
  const bluePaint = chromaticPaints.find((paint) => paint.name.toLowerCase().includes('blue'));
  const isDarkChromaticTarget =
    (targetAnalysis.valueClassification === 'very dark' || targetAnalysis.valueClassification === 'dark') &&
    targetAnalysis.hueFamily !== 'neutral';
  const dominantIsBlackForChromaticTarget = Boolean(dominant?.isBlack && targetAnalysis.hueFamily !== 'neutral');

  if (targetAnalysis.hueFamily === 'green' && isDarkChromaticTarget && yellowPaint && bluePaint) {
    lines.push(
      `Build the green first with ${yellowPaint.name} + ${bluePaint.name}, then mute or darken with ${earthSupport?.name ?? (hasBlack ? 'black' : 'umber or black')}.`,
    );
  } else if (isDarkChromaticTarget && chromaticPaints.length >= 2) {
    lines.push(`Block in the ${targetAnalysis.hueFamily} family with ${chromaticPaints[0].name} + ${chromaticPaints[1].name} before introducing deeper support.`);
  } else if (dominant && !dominantIsBlackForChromaticTarget) {
    lines.push(`Start with ${dominant.name}, then adjust with smaller additions.`);
  } else if (chromaticPaints[0]) {
    lines.push(`Start with ${chromaticPaints[0].name}, then adjust with smaller additions.`);
  }

  if (secondary && !secondary.isBlack) {
    lines.push(`Add ${secondary.name} gradually so you can steer hue without overshooting.`);
  } else if (dominantIsBlackForChromaticTarget && chromaticPaints[1]) {
    lines.push(`Add ${chromaticPaints[1].name} gradually so the hue stays established before deeper darkening.`);
  }

  const highStrengthPaint = ordered
    .map((component) => paintMap.get(component.paintId))
    .find((paint) => paint?.heuristics?.tintStrength === 'very-high' || paint?.heuristics?.tintStrength === 'high');
  if (highStrengthPaint) {
    lines.push(`Use ${highStrengthPaint.name} sparingly; it has strong tinting power.`);
  }

  if ((targetAnalysis.valueClassification === 'very dark' || targetAnalysis.valueClassification === 'dark') && targetAnalysis.hueFamily !== 'neutral') {
    lines.push(`Establish the ${targetAnalysis.hueFamily} family first, then darken or support it with ${earthSupport?.name ?? (hasBlack ? 'black' : 'umber or black')}.`);
  } else if (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral') {
    lines.push('Establish a neutral base first, then push chroma only if needed.');
  } else {
    lines.push('Establish value first, then make small chroma adjustments by eye.');
  }

  if (ordered.some((component) => paintMap.get(component.paintId)?.name === 'Unbleached Titanium')) {
    lines.push('Unbleached Titanium can keep the light area warmer and more natural than pure white.');
  }

  return [...new Set(lines)].slice(0, 4);
};

export const assignRecipeBadges = (recipes: RankedRecipe[]): RankedRecipe[] => {
  if (recipes.length === 0) {
    return recipes;
  }

  const byPredicted = recipes.map((recipe) => ({ ...recipe, badges: [...recipe.badges] }));
  const targetIsNeutral = byPredicted[0].targetAnalysis.hueFamily === 'neutral';
  const firstHueAligned = byPredicted.find((recipe) =>
    recipe.scoreBreakdown.staysInTargetHueFamily &&
    (targetIsNeutral || recipe.scoreBreakdown.hasRequiredHueConstructionPath),
  );
  const topRecipe = byPredicted[0];

  if (targetIsNeutral) {
    topRecipe.badges.push('Best overall');
  } else {
    if (firstHueAligned) {
      firstHueAligned.badges.push('Best overall');
    }
    if (!topRecipe.scoreBreakdown.staysInTargetHueFamily || !topRecipe.scoreBreakdown.hasRequiredHueConstructionPath) {
      topRecipe.badges.push('Best value block-in');
    }
  }

  const simplest = byPredicted.reduce((best, current) => {
    const currentKey = `${current.components.length}-${current.scoreBreakdown.finalScore.toFixed(6)}`;
    const bestKey = `${best.components.length}-${best.scoreBreakdown.finalScore.toFixed(6)}`;
    return current.components.length < best.components.length || currentKey < bestKey ? current : best;
  }, byPredicted[0]);
  simplest.badges.push('Simplest');

  const bestHue = byPredicted.reduce((best, current) =>
    current.scoreBreakdown.hueDifference < best.scoreBreakdown.hueDifference ? current : best,
  byPredicted[0]);
  bestHue.badges.push('Best hue');

  const bestValue = byPredicted.reduce((best, current) =>
    current.scoreBreakdown.valueDifference < best.scoreBreakdown.valueDifference ? current : best,
  byPredicted[0]);
  bestValue.badges.push('Best value');

  byPredicted.forEach((recipe) => {
    if (recipe.components.length === 1 && recipe.scoreBreakdown.singlePaintPenalty === 0) {
      recipe.badges.push('Single-paint shortcut');
    }
    recipe.badges = [...new Set(recipe.badges)] as RecipeBadge[];
  });

  return byPredicted;
};
