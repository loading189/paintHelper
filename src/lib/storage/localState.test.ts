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


  it('migrates persisted sessions without crashing and keeps selected recipes stable', () => {
    const storage = createStorage(JSON.stringify({
      paints: [{ id: 'old-paint', name: 'Old Paint', hex: '#123456', isEnabled: true, isWhite: false, isBlack: false }],
      sessions: [
        {
          id: 'session-1',
          title: 'Portrait prep',
          createdAt: '2026-03-20T00:00:00.000Z',
          updatedAt: '2026-03-20T00:00:00.000Z',
          status: 'planning',
          targetOrder: ['target-1'],
          activeTargetIds: ['target-1'],
          pinnedTargetIds: [],
          targets: [
            {
              id: 'target-1',
              label: 'Skin light',
              targetHex: '#D0A280',
              recipeOptions: [
                {
                  id: 'recipe-1',
                  predictedHex: '#CAA27E',
                  components: [],
                  exactParts: [],
                  exactPercentages: [],
                  exactRatioText: '',
                  practicalParts: [],
                  practicalPercentages: [],
                  practicalRatioText: '3:1',
                  parts: [],
                  ratioText: '3:1',
                  recipeText: '3:1',
                  scoreBreakdown: { mode: 'painter-friendly-balanced', spectralDistance: 0, valueDifference: 0, hueDifference: 0, saturationDifference: 0, chromaDifference: 0, complexityPenalty: 0, hueFamilyPenalty: 0, constructionPenalty: 0, supportPenalty: 0, dominancePenalty: 0, neutralizerPenalty: 0, blackPenalty: 0, whitePenalty: 0, earlyWhitePenalty: 0, singlePaintPenalty: 0, naturalMixBonus: 0, chromaticPathBonus: 0, twoPaintUsabilityBonus: 0, vividTargetPenalty: 0, hasRequiredHueConstructionPath: false, staysInTargetHueFamily: false, finalScore: 0 },
                  qualityLabel: 'Strong starting point',
                  badges: [],
                  guidanceText: [],
                  nextAdjustments: [],
                  targetAnalysis: { normalizedHex: '#D0A280', rgb: { r: 208, g: 162, b: 128 }, value: 0.6, valueClassification: 'mid', hue: 50, hueFamily: 'orange', saturation: 0.3, saturationClassification: 'muted', chroma: 0.1 },
                  predictedAnalysis: { normalizedHex: '#CAA27E', rgb: { r: 202, g: 162, b: 126 }, value: 0.6, valueClassification: 'mid', hue: 50, hueFamily: 'orange', saturation: 0.3, saturationClassification: 'muted', chroma: 0.1 },
                  whyThisRanked: [],
                  mixStrategy: [],
                },
              ],
              selectedRecipeId: 'recipe-1',
              selectedRecipe: {
                id: 'recipe-1',
                predictedHex: '#CAA27E',
                components: [],
                exactParts: [],
                exactPercentages: [],
                exactRatioText: '',
                practicalParts: [],
                practicalPercentages: [],
                practicalRatioText: '3:1',
                parts: [],
                ratioText: '3:1',
                recipeText: '3:1',
                scoreBreakdown: { mode: 'painter-friendly-balanced', spectralDistance: 0, valueDifference: 0, hueDifference: 0, saturationDifference: 0, chromaDifference: 0, complexityPenalty: 0, hueFamilyPenalty: 0, constructionPenalty: 0, supportPenalty: 0, dominancePenalty: 0, neutralizerPenalty: 0, blackPenalty: 0, whitePenalty: 0, earlyWhitePenalty: 0, singlePaintPenalty: 0, naturalMixBonus: 0, chromaticPathBonus: 0, twoPaintUsabilityBonus: 0, vividTargetPenalty: 0, hasRequiredHueConstructionPath: false, staysInTargetHueFamily: false, finalScore: 0 },
                qualityLabel: 'Strong starting point',
                badges: [],
                guidanceText: [],
                nextAdjustments: [],
                targetAnalysis: { normalizedHex: '#D0A280', rgb: { r: 208, g: 162, b: 128 }, value: 0.6, valueClassification: 'mid', hue: 50, hueFamily: 'orange', saturation: 0.3, saturationClassification: 'muted', chroma: 0.1 },
                predictedAnalysis: { normalizedHex: '#CAA27E', rgb: { r: 202, g: 162, b: 126 }, value: 0.6, valueClassification: 'mid', hue: 50, hueFamily: 'orange', saturation: 0.3, saturationClassification: 'muted', chroma: 0.1 },
                whyThisRanked: [],
                mixStrategy: [],
              },
              mixStatus: 'mixed',
              prepStatus: 'locked',
            },
          ],
        },
      ],
      activeSessionId: 'session-1',
    }));

    const loaded = loadAppState(storage);
    expect(loaded.sessions[0]?.targets[0]?.selectedRecipeId).toBe('recipe-1');
    expect(loaded.sessions[0]?.targets[0]?.selectedRecipe?.predictedHex).toBe('#CAA27E');
    expect(loaded.activeSessionId).toBe('session-1');
  });

  it('uses the expected storage key', () => {
    expect(storageKey).toBe('paint-mix-matcher-state');
  });
});
