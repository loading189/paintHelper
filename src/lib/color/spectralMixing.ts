import type { Paint, RecipeComponent, RgbColor, SpectralMixResult, TintStrength } from '../../types/models';
import { rgbToHex, normalizeHex, hexToRgb } from './colorMath';
import { SpectralColor, spectralDeltaEOK, spectralMix } from '../vendor/spectral';
import { getForwardCalibrationForPaint } from './developerCalibration';
import { canonicalizeRecipeComponents } from './recipeCanonicalization';

const tintingStrengthMap: Record<TintStrength, number> = {
  low: 0.72,
  medium: 1,
  high: 1.28,
  'very-high': 1.65,
};

const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

const rgbToHsl = ({ r, g, b }: RgbColor): [number, number, number] => {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;

  if (delta === 0) {
    return [0, 0, lightness];
  }

  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue = 0;

  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    hue = (blue - red) / delta + 2;
  } else {
    hue = (red - green) / delta + 4;
  }

  return [hue / 6, saturation, lightness];
};

const hueToRgb = (p: number, q: number, t: number): number => {
  let candidate = t;
  if (candidate < 0) candidate += 1;
  if (candidate > 1) candidate -= 1;
  if (candidate < 1 / 6) return p + (q - p) * 6 * candidate;
  if (candidate < 1 / 2) return q;
  if (candidate < 2 / 3) return p + (q - p) * (2 / 3 - candidate) * 6;
  return p;
};

const hslToRgb = ([hue, saturation, lightness]: [number, number, number]): RgbColor => {
  if (saturation === 0) {
    const neutral = Math.round(lightness * 255);
    return { r: neutral, g: neutral, b: neutral };
  }

  const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  return {
    r: Math.round(hueToRgb(p, q, hue + 1 / 3) * 255),
    g: Math.round(hueToRgb(p, q, hue) * 255),
    b: Math.round(hueToRgb(p, q, hue - 1 / 3) * 255),
  };
};

const getPaintTintingStrength = (paint: Paint): number => {
  const calibration = getForwardCalibrationForPaint(paint);
  const baseTintingStrength = paint.spectral?.tintingStrength ?? (paint.heuristics?.tintStrength ? tintingStrengthMap[paint.heuristics.tintStrength] : 1);
  const earthMultiplier = paint.heuristics?.naturalBias === 'earth' ? 1 + calibration.earthStrengthBias * 0.35 : 1;
  return baseTintingStrength * calibration.tintingStrength * earthMultiplier;
};

const getCalibratedPaintHex = (paint: Paint): string => {
  const calibration = getForwardCalibrationForPaint(paint);
  const baseHex = normalizeHex(calibration.baseHexOverride ?? paint.spectral?.baseHex ?? paint.hex) ?? '#000000';
  const rgb = hexToRgb(baseHex);
  if (!rgb) {
    return baseHex;
  }

  const [hue, baseSaturation, baseLightness] = rgbToHsl(rgb);
  const earthBias = paint.heuristics?.naturalBias === 'earth' ? calibration.earthStrengthBias : 0;
  const saturation = clamp(baseSaturation * (1 + calibration.chromaBias - earthBias * 0.25));
  const lightness = clamp(baseLightness - calibration.darknessBias - earthBias * 0.08 + calibration.whiteLiftBias);

  return rgbToHex(hslToRgb([hue, saturation, lightness]));
};

const createSpectralPaintColor = (paint: Paint): SpectralColor => {
  const color = new SpectralColor(getCalibratedPaintHex(paint));
  color.tintingStrength = getPaintTintingStrength(paint);
  return color;
};

const spectralRgbToObject = (color: SpectralColor): RgbColor => ({
  r: color.sRGB[0],
  g: color.sRGB[1],
  b: color.sRGB[2],
});

export const getSpectralColorForHex = (hex: string): SpectralColor => new SpectralColor(normalizeHex(hex) ?? '#000000');

export const predictSpectralMix = (
  paints: Paint[],
  components: Pick<RecipeComponent, 'paintId' | 'weight'>[],
): SpectralMixResult => {
  // Forward truth contract: this function intentionally accepts no target data.
  // It deterministically mixes the supplied recipe only, using developer
  // forward-pigment calibration as recipe-side input before spectral mixing.
  // No target may directly modify the predicted swatch after this point.
  const canonicalComponents = canonicalizeRecipeComponents(components);
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const entries = canonicalComponents
    .map((component) => {
      const paint = paintMap.get(component.paintId);
      if (!paint) {
        return null;
      }
      return [createSpectralPaintColor(paint), component.weight] as const;
    })
    .filter((entry): entry is readonly [SpectralColor, number] => Boolean(entry));

  const mixed = spectralMix(...entries.map(([color, weight]) => [color, weight] as [SpectralColor, number]));
  const hex = mixed.toString('hex');

  return {
    hex,
    rgb: spectralRgbToObject(mixed),
    oklab: [...mixed.OKLab] as [number, number, number],
    oklch: [...mixed.OKLCh] as [number, number, number],
  };
};

export const spectralDistanceBetweenHexes = (leftHex: string, rightHex: string): number =>
  spectralDeltaEOK(getSpectralColorForHex(leftHex), getSpectralColorForHex(rightHex));
