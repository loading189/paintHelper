import { beforeEach, describe, expect, it } from 'vitest';
import { practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';
import { starterPaints } from '../storage/seedData';
import { resetDeveloperCalibration } from './developerCalibration';
import { predictSpectralMix } from './spectralMixing';

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
});
