import type { Paint } from '../../types/models';

/**
 * Curated "ideal" acrylic palette.
 *
 * This is intentionally small and strategic:
 * - enough to expose meaningful missing-paint gaps
 * - not so large that ideal mode becomes unrealistic or noisy
 *
 * The ideal palette is treated as a complete curated library.
 * The final ideal solve palette is:
 *   on-hand paints + ideal library paints
 *
 * Dedupe is performed by canonical paint identity, not display name.
 */
const idealLibrarySeed: Paint[] = [
  {
    id: 'ideal-cadmium-yellow-light',
    name: 'Cadmium Yellow Light',
    hex: '#F0C92D',
    baseHex: '#F0C92D',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-ultramarine-blue',
    name: 'Ultramarine Blue',
    hex: '#4948B9',
    baseHex: '#4948B9',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.06,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-phthalo-blue',
    name: 'Phthalo Blue',
    hex: '#009DB6',
    baseHex: '#009DB6',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.82,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-phthalo-green',
    name: 'Phthalo Green',
    hex: '#008D5A',
    baseHex: '#008D5A',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.88,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-cadmium-red-medium',
    name: 'Cadmium Red Medium',
    hex: '#C84835',
    baseHex: '#C84835',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.2,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-alizarin-crimson',
    name: 'Alizarin Crimson',
    hex: '#AA1F54',
    baseHex: '#AA1F54',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.1,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-dioxazine-violet',
    name: 'Dioxazine Violet',
    hex: '#5B2E89',
    baseHex: '#5B2E89',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.32,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-burnt-umber',
    name: 'Burnt Umber',
    hex: '#664330',
    baseHex: '#664330',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1.05,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-burnt-sienna',
    name: 'Burnt Sienna',
    hex: '#8E4F31',
    baseHex: '#8E4F31',
    isWhite: false,
    isBlack: false,
    tintingStrength: 1,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-mars-black',
    name: 'Mars Black',
    hex: '#1A1716',
    baseHex: '#1A1716',
    isWhite: false,
    isBlack: true,
    tintingStrength: 1.75,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-titanium-white',
    name: 'Titanium White',
    hex: '#F6F5F1',
    baseHex: '#F6F5F1',
    isWhite: true,
    isBlack: false,
    tintingStrength: 1.52,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
  {
    id: 'ideal-unbleached-titanium',
    name: 'Unbleached Titanium',
    hex: '#D8C8B3',
    baseHex: '#D8C8B3',
    isWhite: false,
    isBlack: false,
    tintingStrength: 0.92,
    isOnHand: false,
    isIdealLibrary: true,
    isEnabled: true,
  },
];

export const IDEAL_LIBRARY_PAINTS: Paint[] = idealLibrarySeed;

/**
 * Backward-compatible on-hand detection.
 *
 * During migration, older saved paints may not have isOnHand yet.
 * We treat missing isOnHand as true so legacy user inventories continue working.
 */
const isOnHandPaint = (paint: Paint): boolean => paint.isOnHand ?? true;

/**
 * Solver palettes should always contain enabled paints.
 * This keeps palette resolution responsible for solve-readiness.
 */
const withEnabled = (paint: Paint): Paint => ({
  ...paint,
  isEnabled: true,
});

/**
 * Optional future-facing identity helpers.
 *
 * If your Paint type later gains one of these fields, this resolver will
 * automatically use them:
 * - pigmentKey: e.g. "PG7"
 * - canonicalName: e.g. "phthalo-green"
 *
 * For now, we safely fall back to normalized display name.
 */
type PaintIdentityLike = Paint & {
  pigmentKey?: string;
  canonicalName?: string;
};

const normalizeKey = (value: string): string =>
  value.trim().toLowerCase().replace(/\s+/g, ' ');

const getCanonicalPaintKey = (paint: PaintIdentityLike): string => {
  if (paint.pigmentKey && paint.pigmentKey.trim()) {
    return `pigment:${normalizeKey(paint.pigmentKey)}`;
  }

  if (paint.canonicalName && paint.canonicalName.trim()) {
    return `canonical:${normalizeKey(paint.canonicalName)}`;
  }

  return `name:${normalizeKey(paint.name)}`;
};

/**
 * Returns the paints the user can actually solve with right now.
 */
export const getOnHandPalette = (paints: Paint[]): Paint[] =>
  paints.filter(isOnHandPaint).map(withEnabled);

/**
 * Returns the full ideal solve palette:
 *   on-hand paints + curated ideal library + any user-added ideal paints
 *
 * Dedupe priority:
 * 1. on-hand paints win
 * 2. built-in ideal library fills missing canonical identities
 * 3. user-added ideal paints fill anything else not already present
 *
 * This makes ideal mode stable, realistic, and extensible.
 */
export const getIdealPalette = (paints: Paint[]): Paint[] => {
  const byKey = new Map<string, Paint>();

  const addIfMissing = (paint: Paint) => {
    const key = getCanonicalPaintKey(paint as PaintIdentityLike);
    if (!byKey.has(key)) {
      byKey.set(key, withEnabled(paint));
    }
  };

  const onHand = getOnHandPalette(paints);
  for (const paint of onHand) {
    addIfMissing(paint);
  }

  for (const paint of IDEAL_LIBRARY_PAINTS) {
    addIfMissing(paint);
  }

  for (const paint of paints.filter((candidate) => candidate.isIdealLibrary)) {
    addIfMissing(paint);
  }

  return [...byKey.values()];
};