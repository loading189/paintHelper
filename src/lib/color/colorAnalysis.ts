import type {
  ColorAnalysis,
  HueFamily,
  Paint,
  SaturationClassification,
  ValueClassification,
} from '../../types/models';
import { hexToRgb, normalizeHex, srgbRgbToLinearRgb } from './colorMath';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

export const computeValue = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }

  const linear = srgbRgbToLinearRgb(rgb);
  return clamp(0.2126 * linear.r + 0.7152 * linear.g + 0.0722 * linear.b);
};

export const classifyValue = (value: number): ValueClassification => {
  if (value < 0.12) {
    return 'very dark';
  }
  if (value < 0.3) {
    return 'dark';
  }
  if (value < 0.62) {
    return 'mid';
  }
  if (value < 0.84) {
    return 'light';
  }
  return 'very light';
};

export const computeChroma = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }

  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => channel / 255);
  return Math.max(...channels) - Math.min(...channels);
};

export const computeHue = (hex: string): number | null => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return null;
  }

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;

  if (delta < 0.04) {
    return null;
  }

  let hue = 0;
  if (max === r) {
    hue = ((g - b) / delta) % 6;
  } else if (max === g) {
    hue = (b - r) / delta + 2;
  } else {
    hue = (r - g) / delta + 4;
  }

  return (hue * 60 + 360) % 360;
};

export const computeSaturation = (hex: string): number => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return 0;
  }

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return 0;
  }

  return delta / (1 - Math.abs(2 * lightness - 1));
};

export const classifySaturation = (saturation: number, chroma: number): SaturationClassification => {
  if (chroma < 0.05 || saturation < 0.08) {
    return 'neutral';
  }
  if (saturation < 0.28 || chroma < 0.18) {
    return 'muted';
  }
  if (saturation < 0.62) {
    return 'moderate';
  }
  return 'vivid';
};

export const classifyHueFamily = (hue: number | null, saturationClassification: SaturationClassification): HueFamily => {
  if (hue === null || saturationClassification === 'neutral') {
    return 'neutral';
  }
  if (hue < 20 || hue >= 340) {
    return 'red';
  }
  if (hue < 45) {
    return 'orange';
  }
  if (hue < 70) {
    return 'yellow';
  }
  if (hue < 170) {
    return 'green';
  }
  if (hue < 260) {
    return 'blue';
  }
  return 'violet';
};

export const analyzeColor = (hex: string): ColorAnalysis | null => {
  const normalizedHex = normalizeHex(hex);
  const rgb = normalizedHex ? hexToRgb(normalizedHex) : null;
  if (!normalizedHex || !rgb) {
    return null;
  }

  const value = computeValue(normalizedHex);
  const chroma = computeChroma(normalizedHex);
  const saturation = computeSaturation(normalizedHex);
  const saturationClassification = classifySaturation(saturation, chroma);
  const hue = computeHue(normalizedHex);

  return {
    normalizedHex,
    rgb,
    value,
    valueClassification: classifyValue(value),
    hue,
    hueFamily: classifyHueFamily(hue, saturationClassification),
    saturation,
    saturationClassification,
    chroma,
  };
};

export const hueDifference = (leftHue: number | null, rightHue: number | null): number => {
  if (leftHue === null || rightHue === null) {
    return 0;
  }

  const difference = Math.abs(leftHue - rightHue);
  return Math.min(difference, 360 - difference) / 180;
};

export const generateTargetPaletteInsights = (target: ColorAnalysis, paints: Paint[]): string[] => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  if (enabledPaints.length === 0) {
    return [];
  }

  const paintAnalyses = enabledPaints
    .map((paint) => ({ paint, analysis: analyzeColor(paint.hex) }))
    .filter((entry): entry is { paint: Paint; analysis: ColorAnalysis } => entry.analysis !== null);

  const insights: string[] = [];
  const chromaticValues = paintAnalyses
    .filter(({ paint }) => !paint.isBlack && !paint.isWhite)
    .map(({ analysis }) => analysis.value)
    .sort((left, right) => left - right);

  if (chromaticValues.length > 0 && target.value < chromaticValues[0]) {
    insights.push('This target is darker than most chromatic paints in your palette.');
  }

  if (target.hueFamily === 'green' && target.valueClassification !== 'light' && target.valueClassification !== 'very light') {
    insights.push('A dark green mix will likely need umber, black, or both for support.');
  }

  if (target.saturationClassification === 'muted' || target.saturationClassification === 'neutral') {
    insights.push('This target is muted; earth colors or complements should help control chroma.');
  }

  if (target.valueClassification === 'very light' || target.valueClassification === 'light') {
    insights.push('This target is light enough that Titanium White or Unbleached Titanium will likely be involved.');
  }

  const hasEarth = paintAnalyses.some(({ paint }) => paint.heuristics?.naturalBias === 'earth');
  if (hasEarth && target.saturationClassification !== 'vivid') {
    insights.push('Your palette has earth colors available, so a natural neutral is often easier than brute-force complement mixing.');
  }

  return [...new Set(insights)].slice(0, 4);
};
