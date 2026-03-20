import type { Paint } from '../../types/models';
import { SpectralColor, spectralMix } from '../vendor/spectral';
import { normalizeHex } from './colorMath';

const mixHexes = (leftHex: string, rightHex: string, leftWeight: number, rightWeight: number): string => {
  const left = new SpectralColor(normalizeHex(leftHex) ?? '#000000');
  const right = new SpectralColor(normalizeHex(rightHex) ?? '#000000');
  return spectralMix([left, leftWeight], [right, rightWeight]).toString('hex');
};

const findPaletteHex = (paints: Paint[], matcher: (paint: Paint) => boolean, fallback: string): string =>
  paints.find((paint) => matcher(paint))?.hex ?? fallback;

export const generateValueLadder = (targetHex: string, paints: Paint[]) => {
  const whiteHex = findPaletteHex(paints, (paint) => paint.isWhite, '#F5F4EF');
  const blackHex = findPaletteHex(paints, (paint) => paint.isBlack, '#1A1716');
  const muteHex = findPaletteHex(paints, (paint) => paint.name.includes('Burnt Umber'), '#68442F');

  return {
    lighterHex: mixHexes(targetHex, whiteHex, 82, 18),
    darkerHex: mixHexes(targetHex, blackHex, 84, 16),
    mutedHex: mixHexes(targetHex, muteHex, 82, 18),
  };
};
