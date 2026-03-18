import { describe, expect, it } from 'vitest';
import { defaultSettings } from './seedData';
import { getInitialState, loadAppState, sanitizeSettings, saveAppState, storageKey } from './localState';

const createStorage = (seed?: string) => {
  let value = seed;
  return {
    getItem: () => value ?? null,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
    read: () => value,
  };
};

describe('localState', () => {
  it('falls back when persisted JSON is corrupted', () => {
    const storage = createStorage('{bad json');
    expect(loadAppState(storage)).toEqual(getInitialState());
  });

  it('saves and reloads app state', () => {
    const storage = createStorage();
    const state = getInitialState();
    saveAppState(state, storage);
    expect(storage.read()).not.toBeUndefined();
    expect(loadAppState(storage)).toEqual(state);
  });

  it('sanitizes new ranking mode settings deterministically', () => {
    expect(
      sanitizeSettings({
        rankingMode: 'simpler-recipes-preferred',
        singlePaintPenaltySettings: {
          discourageBlackOnlyMatches: false,
          discourageWhiteOnlyMatches: false,
          favorMultiPaintMixesWhenClose: true,
        },
      }),
    ).toMatchObject({
      ...defaultSettings,
      rankingMode: 'simpler-recipes-preferred',
      singlePaintPenaltySettings: {
        discourageBlackOnlyMatches: false,
        discourageWhiteOnlyMatches: false,
        favorMultiPaintMixesWhenClose: true,
      },
    });
  });



  it('sanitizes older saved data without crashing when newer spectral fields are missing', () => {
    const storage = createStorage(JSON.stringify({
      paints: [{ id: 'old-paint', name: 'Old Paint', hex: '#123456', isEnabled: true, isWhite: false, isBlack: false }],
      recipes: [{ id: 'recipe-1', targetHex: '#112233', predictedHex: '#445566', components: [] }],
      settings: { rankingMode: 'painter-friendly-balanced' },
    }));

    const loaded = loadAppState(storage);
    expect(loaded.paints[0]?.spectral).toBeUndefined();
    expect(loaded.recipes[0]?.predictedHex).toBe('#445566');
    expect(loaded.settings.rankingMode).toBe('painter-friendly-balanced');
  });

  it('uses the expected storage key', () => {
    expect(storageKey).toBe('paint-mix-matcher-state');
  });
});
