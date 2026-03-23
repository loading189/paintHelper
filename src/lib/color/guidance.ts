import type { ColorAnalysis, Paint, RankedRecipe, RecipeBadge, RecipeQualityLabel, RecipeScoreBreakdown } from '../../types/models';
import { isDarkEarthWarmTarget, isDarkNaturalGreenTarget, isLightWarmNeutralTarget, isNearBlackChromaticGreenTarget, isNearBlackChromaticTarget } from './colorAnalysis';

const getPaintMap = (paints: Paint[]) => new Map(paints.map((paint) => [paint.id, paint]));

export const determineRecipeQuality = (score: number): RecipeQualityLabel => {
  if (score < 0.18) {
    return 'Excellent spectral starting point';
  }
  if (score < 0.32) {
    return 'Strong starting point';
  }
  if (score < 0.48) {
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
  const paintMap = getPaintMap(paints);
  const reasons: string[] = [];

  if (scoreBreakdown.spectralDistance < 0.08) {
    reasons.push('Spectral prediction lands close overall, not just in flat RGB.');
  }
  if (scoreBreakdown.staysInTargetHueFamily && targetAnalysis.hueFamily !== 'neutral') {
    reasons.push(`Keeps the result inside the target ${targetAnalysis.hueFamily} family.`);
  }
  if (scoreBreakdown.hasRequiredHueConstructionPath && targetAnalysis.hueFamily !== 'neutral') {
    reasons.push('Builds hue from the painterly source colors you would normally establish first.');
  }
  if (scoreBreakdown.chromaticPathBonus > 0) {
    reasons.push('Rewards a hue-first build before support paint starts muting or lightening the mix.');
  }
  if (scoreBreakdown.naturalMixBonus > 0) {
    const earthPaint = componentPaintIds.map((id) => paintMap.get(id)).find((paint) => paint?.heuristics?.naturalBias === 'earth');
    if (earthPaint) {
      reasons.push(isDarkNaturalGreenTarget(targetAnalysis)
        ? `Uses ${earthPaint.name} as part of the core green structure so the shadow stays natural instead of going bright then muddy.`
        : `Uses ${earthPaint.name} to naturalize the mix instead of flattening it with black.`);
    }
  }
  if (scoreBreakdown.darkTargetValuePenalty && scoreBreakdown.darkTargetValuePenalty > 0.08) {
    reasons.push('Dark targets are being held to a stricter value check so an over-light mix does not outrank a believable dark build.');
  }
  if (scoreBreakdown.boundaryDriftPenalty && scoreBreakdown.boundaryDriftPenalty > 0) {
    reasons.push('Keeps the mix on the correct side of a hue-boundary target instead of drifting into the next family.');
  }
  if (scoreBreakdown.earlyWhitePenalty > 0) {
    reasons.push('White was kept in a support role so the chromatic path stays believable.');
  }
  if (scoreBreakdown.vividTargetPenalty > 0) {
    reasons.push('Vivid targets need a visibly convincing chromatic result, not only a close number.');
  }
  if (scoreBreakdown.blackPenalty > 0 || scoreBreakdown.supportPenalty > 0) {
    reasons.push(isDarkNaturalGreenTarget(targetAnalysis)
      ? 'Black is being kept subordinate so the earth-green structure carries the color family.'
      : 'Support paints stay secondary so they do not take over the recipe.');
  }
  if (Math.abs(predictedAnalysis.value - targetAnalysis.value) <= 0.05) {
    reasons.push('Value is already close enough that your next pass can stay focused on hue and chroma.');
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
  const lines: string[] = [`Start with the practical ${practicalRatioText} pile, then adjust in small knife-tip increments.`];

  const strongest = orderedPaints.find((paint) => paint.heuristics?.tintStrength === 'very-high' || paint.heuristics?.tintStrength === 'high');
  if (strongest) {
    lines.push(`Add ${strongest.name} cautiously; it can swing the mix fast.`);
  }

  if (targetAnalysis.hueFamily !== 'neutral' && scoreBreakdown.hasRequiredHueConstructionPath) {
    lines.push(`Establish the ${targetAnalysis.hueFamily} first, then correct value and chroma.`);
  }

  if (predictedAnalysis.value < targetAnalysis.value - 0.04) {
    lines.push('The prediction sits slightly dark, so lift value only after the hue reads correctly.');
  } else if (predictedAnalysis.value > targetAnalysis.value + 0.04) {
    lines.push(isDarkEarthWarmTarget(targetAnalysis)
      ? 'The prediction runs light, so deepen it with earth support first and use black only if the warm dark still is not seated.'
      : isDarkNaturalGreenTarget(targetAnalysis)
        ? 'The prediction runs light, so bring Burnt Umber into the core green build first; only use black as the last value seat if the dark still is not there.'
        : 'The prediction runs a touch light, so lower value with support paint only after checking hue.');
  }

  if (targetAnalysis.saturationClassification === 'muted' || targetAnalysis.saturationClassification === 'neutral') {
    lines.push(isDarkNaturalGreenTarget(targetAnalysis)
      ? 'For dark natural greens, let the earth pigment do part of the hue-building and darkening before you reach for black.'
      : 'For muted targets, let the earth support do the softening before you reach for black.');
  }

  if (isLightWarmNeutralTarget(targetAnalysis)) {
    lines.push('Keep this on a warm-light path: Unbleached Titanium or white should manage value before stronger cooling corrections enter.');
  }

  if (isNearBlackChromaticTarget(targetAnalysis)) {
    lines.push(isNearBlackChromaticGreenTarget(targetAnalysis)
      ? 'Keep the green identity visible in the dark. Burnt Umber can help build the shadow structure; Mars Black should only finish the deepest value.'
      : 'Keep the hue identity visible in the dark. Mars Black should only finish the value, not build the color family.');
  }

  const surprisingPaint = orderedPaints.find((paint) =>
    paint.name.includes('Phthalo Blue') ||
    (paint.name.includes('Ultramarine Blue') && (targetAnalysis.hueFamily === 'yellow' || targetAnalysis.hueFamily === 'orange')),
  );
  if (surprisingPaint) {
    lines.push(`${surprisingPaint.name} is only here as a very small temperature correction, so add it last and in trace amounts.`);
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
  const support = orderedPaints.find((paint) => paint.heuristics?.preferredRole === 'neutralizer' || paint.isBlack || paint.isWhite);
  const lines: string[] = [`Use ${practicalRatioText} as the first palette pile guide.`];

  if (targetAnalysis.hueFamily === 'green' && chromatic.length >= 2) {
    const yellow = chromatic.find((paint) => paint.name.includes('Yellow'));
    const blue = chromatic.find((paint) => paint.name.includes('Blue'));
    const earth = orderedPaints.find((paint) => paint.heuristics?.naturalBias === 'earth' && !paint.isWhite && !paint.name.includes('Unbleached Titanium'));
    if (yellow && blue) {
      lines.push(isDarkNaturalGreenTarget(targetAnalysis) && earth
        ? `Build the green with ${yellow.name} + ${blue.name}, then seat the shadow with ${earth.name} as part of the core mix before you consider black.`
        : `Build the green with ${yellow.name} + ${blue.name} first, then bring in ${support?.name ?? 'support paint'} only if it is still needed.`);
    }
  } else if (targetAnalysis.hueFamily === 'orange') {
    lines.push('Build orange from yellow and red first. Save white and earth colors for correction passes.');
  } else if (isDarkEarthWarmTarget(targetAnalysis)) {
    lines.push('Build the warm dark from red + yellow + earth. Let Burnt Umber seat the value before you consider black.');
  } else if (targetAnalysis.hueFamily === 'violet') {
    lines.push('Build violet from the red-blue pair before deciding whether it needs value or chroma adjustment.');
  } else if (dominant) {
    lines.push(`Start from ${dominant.name} as the base pile, then feed the smaller colors into it.`);
  }

  const strongPaint = orderedPaints.find((paint) => paint.heuristics?.tintStrength === 'very-high');
  if (strongPaint) {
    lines.push(`Touch in ${strongPaint.name} with very small increments.`);
  }

  if (targetAnalysis.valueClassification === 'very dark' || targetAnalysis.valueClassification === 'dark') {
    lines.push(isDarkEarthWarmTarget(targetAnalysis)
      ? 'Do not let a clean orange pile stand in for a dark earth. The earth component is part of the core build here.'
      : isDarkNaturalGreenTarget(targetAnalysis)
        ? 'Do not let a bright chromatic green stand in for a dark natural shadow. The earth component is part of the core build here.'
        : 'Do not let dark support replace the hue path. Darken only after the family reads correctly.');
  } else if (targetAnalysis.valueClassification === 'light' || targetAnalysis.valueClassification === 'very light') {
    lines.push(isLightWarmNeutralTarget(targetAnalysis)
      ? 'Keep value lifts warm and incremental so the color stays believable instead of turning chalky or cold.'
      : 'Keep white additions late and incremental so the color stays lively instead of chalky.');
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
