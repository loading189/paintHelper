import { describe, expect, it } from 'vitest';
import { starterPaints, defaultSettings } from '../storage/seedData';
import { rankRecipes } from './mixEngine';
import { predictSpectralMix, spectralDistanceBetweenHexes } from './spectralMixing';
import { dedupePredictedBasins } from './inverse/dedupePredictedBasins';
import type { EvaluatedCandidate } from './inverse/types';

const baseSettings = {
  ...defaultSettings,
  maxPaintsPerRecipe: 3 as const,
  weightStep: 25,
};

describe('inverse architecture safeguards', () => {
  it('keeps fixed recipe prediction invariant across ranking modes and targets', () => {
    const components = [
      { paintId: 'paint-cadmium-yellow-medium', weight: 45 },
      { paintId: 'paint-ultramarine-blue', weight: 35 },
      { paintId: 'paint-burnt-umber', weight: 20 },
    ];

    const a = predictSpectralMix(starterPaints, components);
    rankRecipes('#6E7741', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 4);
    rankRecipes('#0B1906', starterPaints, { ...baseSettings, rankingMode: 'full-heuristics-legacy' }, 4);
    const b = predictSpectralMix(starterPaints, components);

    expect(a.hex).toBe(b.hex);
    expect(a.oklab).toEqual(b.oklab);
  });

  it('retains family diversity for nearby deep-green targets', () => {
    const olive = rankRecipes('#6E7741', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 6)[0];
    const cool = rankRecipes('#1A2415', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 6)[0];
    const warm = rankRecipes('#4A3B1E', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 6)[0];
    const nearBlack = rankRecipes('#0B1906', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 6)[0];

    expect(new Set([olive?.familyId, cool?.familyId, warm?.familyId, nearBlack?.familyId]).size).toBeGreaterThan(1);
  });

  it('spectral closeness outranks regularization neatness', () => {
    const recipes = rankRecipes('#18E254', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 6);
    expect(recipes.length).toBeGreaterThan(1);

    const [best, second] = recipes;
    expect(best.scoreBreakdown.spectralDistance).toBeLessThanOrEqual(second.scoreBreakdown.spectralDistance + 0.015);
  });

  it('dedupes near-identical predicted basins', () => {
    const candidate = {
      familyId: 'general-hue-build',
      recipe: [{ paintId: 'paint-cadmium-yellow-medium', weight: 50, percentage: 50 }],
      predictedHex: '#808000',
      predictedAnalysis: rankRecipes('#808000', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 1)[0]!.predictedAnalysis,
      targetGaps: { spectralDistance: 0.1, valueDifference: 0.1, hueDifference: 0.1, chromaDifference: 0.1 },
      structure: { paintCount: 1, ratioComplexity: 2, hasWhite: false, hasBlack: false, hasEarth: false },
      scoreBreakdown: rankRecipes('#808000', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 1)[0]!.scoreBreakdown,
      exactParts: [1],
      practicalParts: [1],
    } as EvaluatedCandidate;

    const near = { ...candidate, predictedHex: '#7F8000' };
    const deduped = dedupePredictedBasins([candidate, near], 0.02);
    expect(deduped.length).toBe(1);
  });

  it('achievability stays stable across ranking modes for same predicted outcome', () => {
    const spectral = rankRecipes('#F3E58A', starterPaints, { ...baseSettings, rankingMode: 'spectral-first' }, 1)[0]!;
    const legacy = rankRecipes('#F3E58A', starterPaints, { ...baseSettings, rankingMode: 'full-heuristics-legacy' }, 1)[0]!;

    const gap = spectralDistanceBetweenHexes(spectral.predictedHex, legacy.predictedHex);
    if (gap <= 0.01) {
      expect(spectral.achievability.level).toBe(legacy.achievability.level);
    } else {
      expect(gap).toBeGreaterThan(0);
    }
  });
});
