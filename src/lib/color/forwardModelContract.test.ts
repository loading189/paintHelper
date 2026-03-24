import { beforeEach, describe, expect, it } from 'vitest';
import { practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';
import { defaultSettings, starterPaints } from '../storage/seedData';
import { resetDeveloperCalibration, updateDeveloperCalibration } from './developerCalibration';
import { predictSpectralMix } from './spectralMixing';
import { solveColorTarget } from './solvePipeline';

const buildMix = (paintIds: string[], weights: number[]) =>
  predictSpectralMix(
    starterPaints,
    paintIds.map((paintId, index) => ({ paintId, weight: weights[index] })),
  );

describe('forward model contract', () => {
  beforeEach(() => {
    resetDeveloperCalibration();
  });

  it('keeps a fixed recipe mapped to a fixed predicted swatch', () => {
    const recipePaintIds = ['paint-cadmium-yellow-medium', 'paint-ultramarine-blue', 'paint-burnt-umber'];
    const recipeWeights = [45, 30, 25];

    const first = buildMix(recipePaintIds, recipeWeights);
    const second = buildMix(recipePaintIds, recipeWeights);

    expect(first.hex).toBe(second.hex);
    expect(first.oklab).toEqual(second.oklab);
  });

  it('treats normalized equivalent ratios as the same forward prediction', () => {
    const normalized = buildMix(
      ['paint-ultramarine-blue', 'paint-burnt-umber', 'paint-cadmium-yellow-medium'],
      [3, 2, 2],
    );
    const scaled = buildMix(
      ['paint-ultramarine-blue', 'paint-burnt-umber', 'paint-cadmium-yellow-medium'],
      [30, 20, 20],
    );

    expect(normalized.hex).toBe(scaled.hex);
    expect(normalized.oklch).toEqual(scaled.oklch);
  });

  it('stays deterministic when ratio display helpers run on the same recipe', () => {
    const paintIds = ['paint-cadmium-red', 'paint-burnt-umber', 'paint-mars-black'];
    const weights = [65, 20, 15];
    const before = buildMix(paintIds, weights);

    expect(simplifyRatio(weights)).toEqual([13, 4, 3]);
    expect(practicalRatioFromWeights(weights)).toEqual([4, 1, 1]);

    const after = buildMix(paintIds, weights);
    expect(weights).toEqual([65, 20, 15]);
    expect(after.hex).toBe(before.hex);
  });

  it('treats reordered equivalent recipes as the same normalized forward mix', () => {
    const left = buildMix(
      ['paint-cadmium-yellow-medium', 'paint-ultramarine-blue', 'paint-burnt-umber'],
      [40, 35, 25],
    );
    const right = buildMix(
      ['paint-burnt-umber', 'paint-cadmium-yellow-medium', 'paint-ultramarine-blue'],
      [25, 40, 35],
    );

    expect(left.hex).toBe(right.hex);
    expect(left.oklch).toEqual(right.oklch);
  });

  it('derives the predicted swatch only from the recipe paints and weights', () => {
    const components = [
      { paintId: 'paint-ultramarine-blue', weight: 45 },
      { paintId: 'paint-alizarin-crimson', weight: 35 },
      { paintId: 'paint-burnt-umber', weight: 20 },
    ] as const;

    const first = predictSpectralMix(starterPaints, [...components]);
    const second = predictSpectralMix(starterPaints, [...components]);

    expect(second.hex).toBe(first.hex);
    expect(second.rgb).toEqual(first.rgb);
  });

  it('normalizes duplicate paint entries before forward prediction', () => {
    const duplicated = predictSpectralMix(starterPaints, [
      { paintId: 'paint-ultramarine-blue', weight: 25 },
      { paintId: 'paint-burnt-umber', weight: 30 },
      { paintId: 'paint-ultramarine-blue', weight: 15 },
      { paintId: 'paint-cadmium-yellow-medium', weight: 30 },
    ]);

    const canonical = predictSpectralMix(starterPaints, [
      { paintId: 'paint-burnt-umber', weight: 30 },
      { paintId: 'paint-cadmium-yellow-medium', weight: 30 },
      { paintId: 'paint-ultramarine-blue', weight: 40 },
    ]);

    expect(duplicated.hex).toBe(canonical.hex);
    expect(duplicated.oklab).toEqual(canonical.oklab);
  });

  it('does not rewrite predicted output after candidate evaluation', () => {
    const solved = solveColorTarget('#5E7A51', starterPaints, { ...defaultSettings, solveMode: 'on-hand' }, 4);
    expect(solved.rankedRecipes.length).toBeGreaterThan(0);

    solved.rankedRecipes.forEach((recipe) => {
      const recomputed = predictSpectralMix(starterPaints, recipe.components);
      expect(recipe.predictedHex).toBe(recomputed.hex);
    });
  });

  it('does not let inverse search tuning alter recipe to predicted output', () => {
    const paintIds = ['paint-cadmium-yellow-medium', 'paint-ultramarine-blue', 'paint-burnt-umber'];
    const weights = [45, 30, 25];
    const before = buildMix(paintIds, weights);

    updateDeveloperCalibration({
      inverseSearch: {
        darkTargets: {
          minDarkShare: 35,
          maxYellowShare: 35,
          maxLightShare: 0,
          dominantLightShareCap: 35,
          dominantYellowShareCap: 35,
          valuePenaltyScale: 2.2,
          earthStructuralBonus: 0.12,
          offHuePenalty: 0.32,
        },
      } as never,
    });

    const after = buildMix(paintIds, weights);
    expect(after.hex).toBe(before.hex);
    expect(after.oklab).toEqual(before.oklab);
  });

  it('keeps a fixed recipe prediction unchanged across target and solve-mode solves', () => {
    const components = [
      { paintId: 'paint-cadmium-yellow-medium', weight: 45 },
      { paintId: 'paint-ultramarine-blue', weight: 35 },
      { paintId: 'paint-burnt-umber', weight: 20 },
    ] as const;
    const before = predictSpectralMix(starterPaints, [...components]);

    solveColorTarget('#D6D2A2', starterPaints, { ...defaultSettings, solveMode: 'on-hand' }, 3);
    solveColorTarget('#1F2616', starterPaints, { ...defaultSettings, solveMode: 'ideal' }, 3);

    const after = predictSpectralMix(starterPaints, [...components]);
    expect(after.hex).toBe(before.hex);
    expect(after.oklch).toEqual(before.oklch);
  });
});
