import type { Paint, RecipeComponent, RgbColor, SpectralMixResult, TintStrength } from '../../types/models';
import { normalizeHex } from './colorMath';
import { SpectralColor, spectralDeltaEOK, spectralMix } from '../vendor/spectral';

const tintingStrengthMap: Record<TintStrength, number> = {
  low: 0.72,
  medium: 1,
  high: 1.28,
  'very-high': 1.65,
};

const getPaintTintingStrength = (paint: Paint): number => {
  if (paint.spectral?.tintingStrength) {
    return paint.spectral.tintingStrength;
  }

  const heuristic = paint.heuristics?.tintStrength;
  return heuristic ? tintingStrengthMap[heuristic] : 1;
};

const getPaintHex = (paint: Paint): string => normalizeHex(paint.spectral?.baseHex ?? paint.hex) ?? '#000000';

const createSpectralPaintColor = (paint: Paint): SpectralColor => {
  const color = new SpectralColor(getPaintHex(paint));
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
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const entries = components
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
