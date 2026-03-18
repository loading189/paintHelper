import type {
  ColorAnalysis,
  HueFamily,
  Paint,
  SaturationClassification,
  ValueClassification,
} from '../../types/models';
import { getSpectralColorForHex } from './spectralMixing';
import { hexToRgb, normalizeHex } from './colorMath';

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

export const computeValue = (hex: string): number => {
  const spectral = getSpectralColorForHex(hex);
  return clamp(spectral.OKLab[0]);
};

export const classifyValue = (value: number): ValueClassification => {
  if (value < 0.22) {
    return 'very dark';
  }
  if (value < 0.42) {
    return 'dark';
  }
  if (value < 0.7) {
    return 'mid';
  }
  if (value < 0.88) {
    return 'light';
  }
  return 'very light';
};

export const computeChroma = (hex: string): number => {
  const spectral = getSpectralColorForHex(hex);
  return spectral.OKLCh[1];
};

export const computeHue = (hex: string): number | null => {
  const chroma = computeChroma(hex);
  if (chroma < 0.015) {
    return null;
  }

  return getSpectralColorForHex(hex).OKLCh[2];
};

export const computeSaturation = (hex: string): number => {
  const chroma = computeChroma(hex);
  const lightness = computeValue(hex);
  return clamp(chroma / Math.max(0.12, 0.37 - Math.abs(lightness - 0.5) * 0.32));
};

export const classifySaturation = (saturation: number, chroma: number): SaturationClassification => {
  if (chroma < 0.018 || saturation < 0.09) {
    return 'neutral';
  }
  if (chroma < 0.055 || saturation < 0.28) {
    return 'muted';
  }
  if (chroma < 0.12 || saturation < 0.62) {
    return 'moderate';
  }
  return 'vivid';
};

export const classifyHueFamily = (hue: number | null, saturationClassification: SaturationClassification): HueFamily => {
  if (hue === null || saturationClassification === 'neutral') {
    return 'neutral';
  }
  if (hue < 25 || hue >= 345) {
    return 'red';
  }
  if (hue < 60) {
    return 'orange';
  }
  if (hue < 110) {
    return 'yellow';
  }
  if (hue < 175) {
    return 'green';
  }
  if (hue < 285) {
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

  const spectral = getSpectralColorForHex(normalizedHex);
  const value = clamp(spectral.OKLab[0]);
  const chroma = spectral.OKLCh[1];
  const hue = chroma < 0.015 ? null : spectral.OKLCh[2];
  const saturation = computeSaturation(normalizedHex);
  const saturationClassification = classifySaturation(saturation, chroma);

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
    oklab: [...spectral.OKLab] as [number, number, number],
    oklch: [...spectral.OKLCh] as [number, number, number],
  };
};

export const hueDifference = (leftHue: number | null, rightHue: number | null): number => {
  if (leftHue === null || rightHue === null) {
    return 0;
  }

  const difference = Math.abs(leftHue - rightHue);
  return Math.min(difference, 360 - difference) / 180;
};

const findEnabledPaints = (paints: Paint[]): Paint[] => paints.filter((paint) => paint.isEnabled);

export const generateTargetPaletteInsights = (target: ColorAnalysis, paints: Paint[]): string[] => {
  const enabledPaints = findEnabledPaints(paints);
  if (enabledPaints.length === 0) {
    return [];
  }

  const insights: string[] = [];

  if (target.hueFamily === 'green' && target.saturationClassification === 'vivid') {
    insights.push('For vivid green, build yellow + blue first. Only mute or darken after the green is clearly established.');
  }

  if (target.hueFamily === 'green' && target.saturationClassification !== 'vivid') {
    insights.push('Olive and natural greens usually start yellow + blue, then get pushed down with umber, black, or both.');
  }

  if (target.hueFamily === 'orange') {
    insights.push('Warm oranges read better when red and yellow establish hue before white or earth colors are added.');
  }

  if (target.hueFamily === 'violet') {
    insights.push('Expect violet mixes to favor Alizarin Crimson + Ultramarine or Phthalo, with white used only after hue is close.');
  }

  if (target.saturationClassification === 'neutral' || target.saturationClassification === 'muted') {
    insights.push('This target is muted enough that earth colors should help more than brute-force complement cancellation.');
  }

  if (target.valueClassification === 'light' || target.valueClassification === 'very light') {
    insights.push('Plan value lifts late. Titanium White gives the strongest lift; Unbleached Titanium keeps light passages warmer.');
  }

  if (target.valueClassification === 'very dark' && target.hueFamily !== 'neutral') {
    insights.push('This is a dark chromatic target, so keep the hue family visible before leaning on Mars Black.');
  }

  return [...new Set(insights)].slice(0, 4);
};
