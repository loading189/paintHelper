import type { Paint } from '../../types/models';

const idealLibrarySeed: Paint[] = [
  { id: 'ideal-cadmium-yellow-light', name: 'Cadmium Yellow Light', hex: '#F0C92D', baseHex: '#F0C92D', isWhite: false, isBlack: false, tintingStrength: 1, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-ultramarine-blue', name: 'Ultramarine Blue', hex: '#4948B9', baseHex: '#4948B9', isWhite: false, isBlack: false, tintingStrength: 1.06, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-phthalo-blue', name: 'Phthalo Blue', hex: '#009DB6', baseHex: '#009DB6', isWhite: false, isBlack: false, tintingStrength: 1.82, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-phthalo-green', name: 'Phthalo Green', hex: '#008D5A', baseHex: '#008D5A', isWhite: false, isBlack: false, tintingStrength: 1.88, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-cadmium-red-medium', name: 'Cadmium Red Medium', hex: '#C84835', baseHex: '#C84835', isWhite: false, isBlack: false, tintingStrength: 1.2, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-alizarin-crimson', name: 'Alizarin Crimson', hex: '#AA1F54', baseHex: '#AA1F54', isWhite: false, isBlack: false, tintingStrength: 1.1, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-dioxazine-violet', name: 'Dioxazine Violet', hex: '#5B2E89', baseHex: '#5B2E89', isWhite: false, isBlack: false, tintingStrength: 1.32, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-burnt-umber', name: 'Burnt Umber', hex: '#664330', baseHex: '#664330', isWhite: false, isBlack: false, tintingStrength: 1.05, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-burnt-sienna', name: 'Burnt Sienna', hex: '#8E4F31', baseHex: '#8E4F31', isWhite: false, isBlack: false, tintingStrength: 1, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-mars-black', name: 'Mars Black', hex: '#1A1716', baseHex: '#1A1716', isWhite: false, isBlack: true, tintingStrength: 1.75, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-titanium-white', name: 'Titanium White', hex: '#F6F5F1', baseHex: '#F6F5F1', isWhite: true, isBlack: false, tintingStrength: 1.52, isOnHand: false, isIdealLibrary: true, isEnabled: true },
  { id: 'ideal-unbleached-titanium', name: 'Unbleached Titanium', hex: '#D8C8B3', baseHex: '#D8C8B3', isWhite: false, isBlack: false, tintingStrength: 0.92, isOnHand: false, isIdealLibrary: true, isEnabled: true },
];

export const IDEAL_LIBRARY_PAINTS: Paint[] = idealLibrarySeed;

const withEnabled = (paint: Paint): Paint => ({ ...paint, isEnabled: true });

export const getOnHandPalette = (paints: Paint[]): Paint[] =>
  paints.filter((paint) => paint.isOnHand !== false).map(withEnabled);

export const getIdealPalette = (paints: Paint[]): Paint[] => {
  const onHand = getOnHandPalette(paints);
  const byId = new Map(onHand.map((paint) => [paint.id, paint]));

  IDEAL_LIBRARY_PAINTS.forEach((paint) => {
    if (!byId.has(paint.id) && !onHand.some((owned) => owned.name === paint.name)) {
      byId.set(paint.id, paint);
    }
  });

  paints
    .filter((paint) => paint.isIdealLibrary)
    .forEach((paint) => {
      if (!byId.has(paint.id)) {
        byId.set(paint.id, withEnabled(paint));
      }
    });

  return [...byId.values()].map(withEnabled);
};
