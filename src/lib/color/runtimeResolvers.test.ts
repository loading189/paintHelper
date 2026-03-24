import { describe, expect, it } from 'vitest';
import { starterPaints, defaultSettings } from '../storage/seedData';
import { predictSpectralMix } from './spectralMixing';
import { resolveRuntimePaints, resolveSolverRuntimeConfig } from './runtimeResolvers';
import { resetDeveloperCalibration, updateDeveloperCalibration } from './developerCalibration';
import { solveColorTarget } from './solvePipeline';

const sampleRecipe = [
  { paintId: 'paint-ultramarine-blue', weight: 3 },
  { paintId: 'paint-burnt-umber', weight: 2 },
];

describe('runtime resolvers', () => {
  it('resolves stable runtime paints for same seed and overrides', () => {
    resetDeveloperCalibration();
    updateDeveloperCalibration({
      forwardPigments: {
        paints: {
          'paint-ultramarine-blue': { tintingStrength: 1, darknessBias: 0, chromaBias: -0.12, earthStrengthBias: 0, whiteLiftBias: 0 },
        },
      },
    });

    const first = resolveRuntimePaints(starterPaints);
    const second = resolveRuntimePaints(starterPaints);

    expect(first).toEqual(second);
    expect(first.find((paint) => paint.id === 'paint-ultramarine-blue')?.runtime.forwardCalibration.chromaBias).toBe(-0.12);
  });

  it('uses resolved runtime paint calibration during forward prediction', () => {
    resetDeveloperCalibration();
    const baseline = predictSpectralMix(starterPaints, sampleRecipe).hex;

    updateDeveloperCalibration({
      forwardPigments: {
        paints: {
          'paint-ultramarine-blue': { baseHexOverride: '#2740D8', tintingStrength: 1.2, darknessBias: 0, chromaBias: 0, earthStrengthBias: 0, whiteLiftBias: 0 },
        },
      },
    });

    const updated = predictSpectralMix(starterPaints, sampleRecipe).hex;
    expect(updated).not.toBe(baseline);
  });

  it('resolves stable solver config and deterministic solve result', () => {
    resetDeveloperCalibration();
    const configA = resolveSolverRuntimeConfig(defaultSettings);
    const configB = resolveSolverRuntimeConfig(defaultSettings);

    expect(configA).toEqual(configB);

    const target = '#6E7741';
    const resultA = solveColorTarget(target, starterPaints, defaultSettings, 1);
    const resultB = solveColorTarget(target, starterPaints, defaultSettings, 1);

    expect(resultA.solverConfig).toEqual(resultB.solverConfig);
    expect(resultA.rankedRecipes[0]?.recipeText).toBe(resultB.rankedRecipes[0]?.recipeText);
  });

  it('uses resolved max paints and blocks legacy ranking mode from changing active solve path', () => {
    resetDeveloperCalibration();
    updateDeveloperCalibration({ inverseSearch: { ratioSearch: { maxComponents: 2 } } as any });

    const legacyAttempt = solveColorTarget(
      '#4A3B1E',
      starterPaints,
      { ...defaultSettings, rankingMode: 'full-heuristics-legacy', maxPaintsPerRecipe: 3 },
      3,
    );

    expect(legacyAttempt.solverConfig.maxPaintsPerRecipe).toBe(2);
    expect(legacyAttempt.rankedRecipes.every((recipe) => recipe.components.length <= 2)).toBe(true);
  });
});
