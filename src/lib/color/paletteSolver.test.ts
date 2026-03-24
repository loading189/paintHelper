import { describe, expect, it } from 'vitest';
import { predictSpectralMix } from './spectralMixing';
import { starterPaints, defaultSettings } from '../storage/seedData';
import { solveWithPalettes } from './paletteSolver';
import { getIdealPalette, getOnHandPalette } from './paletteMode';
import { solveTarget } from './inverse/solveTarget';

describe('palette solver architecture', () => {
  it('keeps forward model invariant for the same recipe across modes', () => {
    const recipe = [
      { paintId: starterPaints[0]!.id, weight: 60 },
      { paintId: starterPaints[1]!.id, weight: 40 },
    ];

    const onHandMix = predictSpectralMix(getOnHandPalette(starterPaints), recipe);
    const idealMix = predictSpectralMix(getIdealPalette(starterPaints), recipe);

    expect(onHandMix.hex).toBe(idealMix.hex);
  });

  it('runs dual solves with different palette boundaries', () => {
    const reducedOnHand = starterPaints.map((paint) => ({ ...paint, isOnHand: ['paint-mars-black', 'paint-titanium-white'].includes(paint.id) }));
    const solved = solveWithPalettes('#5FAF49', reducedOnHand, { ...defaultSettings, solveMode: 'on-hand' });

    expect(solved.idealResult).toBeTruthy();
    expect(solved.onHandResult).toBeTruthy();
    expect(solved.idealResult?.predictedHex).not.toBe(solved.onHandResult?.predictedHex);
  });

  it('computes perceptual gap metrics from ideal vs on-hand predictions', () => {
    const reducedOnHand = starterPaints.map((paint) => ({ ...paint, isOnHand: paint.isWhite || paint.isBlack }));
    const solved = solveWithPalettes('#7E8E4A', reducedOnHand, { ...defaultSettings, solveMode: 'ideal' });

    expect(solved.comparison.gap.spectralDistance).toBeGreaterThan(0);
    expect(solved.comparison.gap.valueDelta).toBeGreaterThanOrEqual(0);
    expect(solved.comparison.gap.chromaDelta).toBeGreaterThanOrEqual(0);
    expect(solved.comparison.gap.hueDelta).toBeGreaterThanOrEqual(0);
  });

  it('detects missing ideal paints when on-hand is constrained', () => {
    const reducedOnHand = starterPaints.map((paint) => ({ ...paint, isOnHand: paint.id === 'paint-titanium-white' }));
    const solved = solveWithPalettes('#CC5533', reducedOnHand, { ...defaultSettings, solveMode: 'on-hand' });

    expect(solved.comparison.missingPaintIds.length).toBeGreaterThan(0);
  });


  it('classifies achievability from palette comparison signals', () => {
    const reducedOnHand = starterPaints.map((paint) => ({ ...paint, isOnHand: paint.id === 'paint-mars-black' }));
    const solved = solveWithPalettes('#52A857', reducedOnHand, { ...defaultSettings, solveMode: 'on-hand' });

    expect(solved.comparison.limitingFactors.length).toBeGreaterThan(0);
  });

  it('keeps solver behavior identical for same palette input', () => {
    const palette = getOnHandPalette(starterPaints);
    const first = solveTarget('#809860', palette, { ...defaultSettings, solveMode: 'on-hand' }, 1).rankedRecipes[0];
    const second = solveTarget('#809860', palette, { ...defaultSettings, solveMode: 'ideal' }, 1).rankedRecipes[0];

    expect(first?.predictedHex).toBe(second?.predictedHex);
    expect(first?.scoreBreakdown.spectralDistance).toBe(second?.scoreBreakdown.spectralDistance);
  });
});
