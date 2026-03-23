import { beforeEach, describe, expect, it } from 'vitest';
import { defaultSettings, starterPaints } from '../storage/seedData';
import { analyzeColor } from './colorAnalysis';
import { resetDeveloperCalibration } from './developerCalibration';
import { generateCandidateMixes, rankRecipes } from './mixEngine';
import { probeRecipe } from './recipeProbe';

describe('dark mixture calibration', () => {
  beforeEach(() => {
    resetDeveloperCalibration();
  });

  it('keeps ultramarine plus burnt umber darker than adding a larger yellow share', () => {
    const twoPaint = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 3 },
    ]);
    const yellowHeavier = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 2 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 3 },
    ]);

    expect(twoPaint && yellowHeavier).toBeTruthy();
    expect(twoPaint!.analysis.value).toBeLessThan(yellowHeavier!.analysis.value);
  });

  it('keeps burnt-umber-heavy dark greens darker than yellow-heavier versions', () => {
    const umberHeavy = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 4 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 1 },
    ]);
    const yellowHeavy = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 1 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 4 },
    ]);

    expect(umberHeavy && yellowHeavy).toBeTruthy();
    expect(umberHeavy!.analysis.value).toBeLessThan(yellowHeavy!.analysis.value);
  });

  it('expands dark-ratio generation for dark natural green targets', () => {
    const candidates = generateCandidateMixes(starterPaints, 3, 5, '#123119');
    const matching = candidates.filter((candidate) =>
      candidate.paintIds.includes('paint-ultramarine-blue') &&
      candidate.paintIds.includes('paint-burnt-umber') &&
      candidate.paintIds.includes('paint-cadmium-yellow-medium'),
    );

    expect(matching.some((candidate) => {
      const blue = candidate.weights[candidate.paintIds.indexOf('paint-ultramarine-blue')];
      const umber = candidate.weights[candidate.paintIds.indexOf('paint-burnt-umber')];
      const yellow = candidate.weights[candidate.paintIds.indexOf('paint-cadmium-yellow-medium')];
      return umber >= 35 && blue >= 30 && yellow <= 15;
    })).toBe(true);
  });

  it('search results for dark chromatic green stay in a dark green-earth structure', () => {
    const ranked = rankRecipes('#123119', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 10);

    expect(ranked[0]).toBeTruthy();
    expect(ranked[0]?.components.some((component) => component.paintId === 'paint-burnt-umber')).toBe(true);
    expect(ranked[0]?.components.some((component) => component.paintId === 'paint-ultramarine-blue')).toBe(true);
    expect(ranked[0]?.predictedAnalysis.valueClassification === 'dark' || ranked[0]?.predictedAnalysis.valueClassification === 'very dark').toBe(true);
  });

  it('keeps near-black chromatic probes out of the light-value band', () => {
    const result = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 4 },
      { paintId: 'paint-burnt-umber', parts: 4 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 1 },
    ]);

    expect(result).toBeTruthy();
    expect(result!.predictedAnalysis.valueClassification).not.toBe('light');
    expect(result!.predictedAnalysis.valueClassification).not.toBe('very light');
    expect(analyzeColor(result!.predictedHex)?.value).toBeLessThan(0.42);
  });
});
