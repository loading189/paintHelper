import type { AdjustmentSuggestion, ColorAnalysis, Paint, RankedRecipe } from '../../types/models';

const SMALL_VALUE_DELTA = 0.045;
const SMALL_CHROMA_DELTA = 0.02;
const SMALL_HUE_DELTA = 1;

const hasPaint = (paints: Paint[], matcher: (paint: Paint) => boolean): boolean => paints.some((paint) => matcher(paint));

const findPaintName = (paints: Paint[], matcher: (paint: Paint) => boolean, fallback: string): string =>
  paints.find((paint) => matcher(paint))?.name ?? fallback;

const getBlueAdjustmentPaint = (paints: Paint[], target: ColorAnalysis): string => {
  if (target.saturationClassification === 'vivid') {
    return findPaintName(paints, (paint) => paint.name.includes('Phthalo Blue'), 'Phthalo Blue');
  }
  return findPaintName(paints, (paint) => paint.name.includes('Ultramarine Blue'), 'Ultramarine Blue');
};

const getRedAdjustmentPaint = (paints: Paint[], target: ColorAnalysis): string => {
  if (target.saturationClassification === 'vivid' || target.hueFamily === 'orange') {
    return findPaintName(paints, (paint) => paint.name.includes('Cadmium Red'), 'Cadmium Red');
  }
  return findPaintName(paints, (paint) => paint.name.includes('Alizarin Crimson'), 'Alizarin Crimson');
};

const getYellowAdjustmentPaint = (paints: Paint[]): string =>
  findPaintName(paints, (paint) => paint.name.includes('Cadmium Yellow'), 'Cadmium Yellow Medium');

const isLightYellowTarget = (target: ColorAnalysis): boolean =>
  target.hueFamily === 'yellow' && (target.valueClassification === 'light' || target.valueClassification === 'very light');

const isYellowGreenTarget = (target: ColorAnalysis): boolean =>
  target.hue !== null && target.hue >= 96 && target.hue <= 120;

const getValueLiftPaint = (paints: Paint[], target: ColorAnalysis): string => {
  if (
    target.hueFamily === 'neutral' ||
    target.saturationClassification === 'muted' ||
    target.valueClassification === 'light' ||
    target.valueClassification === 'very light'
  ) {
    return findPaintName(paints, (paint) => paint.name.includes('Unbleached Titanium'), 'Unbleached Titanium');
  }
  return findPaintName(paints, (paint) => paint.isWhite, 'Titanium White');
};

const getDarkeningPaint = (paints: Paint[], target: ColorAnalysis): string => {
  if (target.hueFamily === 'neutral' || target.saturationClassification === 'muted') {
    return findPaintName(paints, (paint) => paint.name.includes('Burnt Umber'), 'Burnt Umber');
  }
  return findPaintName(paints, (paint) => paint.isBlack, 'Mars Black');
};

const makeSuggestion = (priority: AdjustmentSuggestion['priority'], kind: AdjustmentSuggestion['kind'], label: string, detail: string): AdjustmentSuggestion => ({
  priority,
  kind,
  label,
  detail,
});

const getHueAdjustment = (target: ColorAnalysis, predicted: ColorAnalysis, paints: Paint[]): AdjustmentSuggestion | null => {
  if (target.hue === null || predicted.hue === null) {
    return null;
  }

  const delta = predicted.hue - target.hue;
  if (Math.abs(delta) < SMALL_HUE_DELTA) {
    return null;
  }

  switch (target.hueFamily) {
    case 'green':
      return delta < 0
        ? makeSuggestion('primary', 'temperature', 'Too warm', `Add a small touch more ${getBlueAdjustmentPaint(paints, target)} to cool the green.`)
        : makeSuggestion('primary', 'temperature', 'Too cool', `Add a small touch more ${getYellowAdjustmentPaint(paints)} to warm the green.`);
    case 'orange':
      return delta < 0
        ? makeSuggestion('primary', 'hue', 'Too red', `Add a small touch more ${getYellowAdjustmentPaint(paints)} to move the orange away from red.`)
        : makeSuggestion('primary', 'hue', 'Too yellow', `Add a small touch more ${getRedAdjustmentPaint(paints, target)} to keep the orange from going lemony.`);
    case 'violet':
      return delta < 0
        ? makeSuggestion('primary', 'temperature', 'Too warm', `Add a small touch more ${getBlueAdjustmentPaint(paints, target)} to cool the violet.`)
        : makeSuggestion('primary', 'temperature', 'Too cool', `Add a small touch more ${getRedAdjustmentPaint(paints, target)} to keep the violet from going too blue.`);
    case 'blue':
      return delta < 0
        ? makeSuggestion('secondary', 'temperature', 'Too warm', `Warm the blue slightly with a touch of ${getRedAdjustmentPaint(paints, target)} if it drifts too green.`)
        : makeSuggestion('secondary', 'temperature', 'Too cool', `Cool the blue with a touch of ${getBlueAdjustmentPaint(paints, target)}.`);
    case 'yellow':
      if (delta < 0) {
        return makeSuggestion('secondary', 'temperature', 'Too cool', `Warm the yellow with a touch of ${getRedAdjustmentPaint(paints, target)} if it starts to green out.`);
      }
      if (isLightYellowTarget(target)) {
        if (isYellowGreenTarget(target)) {
          return makeSuggestion(
            'secondary',
            'temperature',
            'Too warm',
            `Open the value first with ${getValueLiftPaint(paints, target)}, then use only a trace of ${getBlueAdjustmentPaint(paints, target)} if the yellow still needs a slight yellow-green correction.`,
          );
        }
        return makeSuggestion(
          'secondary',
          'temperature',
          'Too warm',
          `Keep the yellow on a lightening path: add a little ${getValueLiftPaint(paints, target)} before making any cooler correction.`,
        );
      }
      return makeSuggestion('secondary', 'temperature', 'Too warm', `Nudge the yellow toward a cooler note with only a trace of ${getBlueAdjustmentPaint(paints, target)} if it still reads too orange.`);
    case 'red':
      return delta < 0
        ? makeSuggestion('secondary', 'temperature', 'Too cool', `Warm the red with a touch of ${getYellowAdjustmentPaint(paints)} if it slips toward violet.`)
        : makeSuggestion(
            'secondary',
            'temperature',
            'Too warm',
            `Cool the red with a touch of ${getBlueAdjustmentPaint(paints, target)} or ${findPaintName(paints, (paint) => paint.name.includes('Alizarin Crimson'), 'Alizarin Crimson')}.`,
          );
    case 'neutral':
    default:
      return null;
  }
};

const getNeutralTemperatureAdjustment = (target: ColorAnalysis, predicted: ColorAnalysis, paints: Paint[]): AdjustmentSuggestion | null => {
  if (target.hueFamily !== 'neutral' || predicted.hue === null) {
    return null;
  }

  if (predicted.hue >= 25 && predicted.hue < 120) {
    return makeSuggestion('primary', 'temperature', 'Too warm', `Cool the neutral with a trace of ${findPaintName(paints, (paint) => paint.name.includes('Ultramarine Blue'), 'Ultramarine Blue')} before darkening further.`);
  }

  if (predicted.hue >= 175 && predicted.hue < 320) {
    return makeSuggestion('primary', 'temperature', 'Too cool', `Warm the neutral with ${findPaintName(paints, (paint) => paint.name.includes('Burnt Umber'), 'Burnt Umber')} rather than more white.`);
  }

  return null;
};

export const generateAdjustmentSuggestions = (
  target: ColorAnalysis,
  predicted: ColorAnalysis,
  paints: Paint[],
  recipe?: Pick<RankedRecipe, 'components'>,
): AdjustmentSuggestion[] => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const suggestions: AdjustmentSuggestion[] = [];
  const componentIds = new Set(recipe?.components.map((component) => component.paintId) ?? []);
  const whiteName = getValueLiftPaint(enabledPaints, target);
  const darkeningName = getDarkeningPaint(enabledPaints, target);
  const hasBurntUmber = hasPaint(enabledPaints, (paint) => paint.name.includes('Burnt Umber'));

  if (predicted.value < target.value - SMALL_VALUE_DELTA) {
    const detail = isLightYellowTarget(target)
      ? `Lift value with a small amount of ${whiteName} before trying to cool the yellow.`
      : `Lift value with a small amount of ${whiteName}.`;
    suggestions.push(makeSuggestion('primary', 'lightness', 'Too dark', detail));
  } else if (predicted.value > target.value + SMALL_VALUE_DELTA) {
    const detail = darkeningName === 'Mars Black' ? 'Use only a tiny touch so the hue stays readable.' : 'Keep it in support, not as the base pile.';
    suggestions.push(makeSuggestion('primary', 'darkness', 'Too light', `Lower value with a touch of ${darkeningName}. ${detail}`));
  }

  const hueAdjustment = target.hueFamily === 'neutral'
    ? getNeutralTemperatureAdjustment(target, predicted, enabledPaints)
    : getHueAdjustment(target, predicted, enabledPaints);
  if (hueAdjustment) {
    suggestions.push(hueAdjustment);
  }

  if (predicted.chroma > target.chroma + SMALL_CHROMA_DELTA) {
    suggestions.push(
      makeSuggestion(
        'secondary',
        'muting',
        'Too saturated',
        hasBurntUmber
          ? `Mute naturally with ${findPaintName(enabledPaints, (paint) => paint.name.includes('Burnt Umber'), 'Burnt Umber')} before reaching for black.`
          : 'Mute the mix with the smallest possible neutralizing support paint from your palette.',
      ),
    );
  } else if (predicted.chroma < target.chroma - SMALL_CHROMA_DELTA && target.hueFamily !== 'neutral') {
    if (target.hueFamily === 'green') {
      suggestions.push(
        makeSuggestion(
          'secondary',
          'chroma',
          'Too muted',
          `Reinforce the green by nudging ${getYellowAdjustmentPaint(enabledPaints)} + ${getBlueAdjustmentPaint(enabledPaints, target)} before adding more support paint.`,
        ),
      );
    } else if (target.hueFamily === 'orange') {
      suggestions.push(makeSuggestion('secondary', 'chroma', 'Too muted', `Reinforce chroma with a touch of ${getYellowAdjustmentPaint(enabledPaints)} and ${getRedAdjustmentPaint(enabledPaints, target)}.`));
    } else if (target.hueFamily === 'violet') {
      suggestions.push(makeSuggestion('secondary', 'chroma', 'Too muted', `Reinforce chroma with a touch of ${getRedAdjustmentPaint(enabledPaints, target)} and ${getBlueAdjustmentPaint(enabledPaints, target)}.`));
    }
  }

  if (target.hueFamily !== 'neutral' && target.saturationClassification !== 'neutral' && componentIds.has('paint-titanium-white') && suggestions.length < 3) {
    suggestions.push(makeSuggestion('optional', 'value', 'White is dominant', 'Keep later white additions small so the hue stays clean and doesn’t chalk out.'));
  }

  return suggestions.filter((suggestion, index, list) => list.findIndex((item) => item.detail === suggestion.detail) === index).slice(0, 3);
};

export const generateNextAdjustments = (
  target: ColorAnalysis,
  predicted: ColorAnalysis,
  paints: Paint[],
  recipe?: Pick<RankedRecipe, 'components'>,
): string[] => generateAdjustmentSuggestions(target, predicted, paints, recipe).map((suggestion) => suggestion.detail);
