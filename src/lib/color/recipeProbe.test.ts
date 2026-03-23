import { beforeEach, describe, expect, it } from 'vitest';
import { starterPaints } from '../storage/seedData';
import { resetDeveloperCalibration } from './developerCalibration';
import { exploreRecipeNeighborhood, generateRecipeNeighborhood, probeRecipe } from './recipeProbe';

describe('recipe probe', () => {
  beforeEach(() => {
    resetDeveloperCalibration();
  });

  it('predicts a manual recipe directly without any target input', () => {
    const result = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 2 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 2 },
    ]);

    expect(result?.predictedHex).toMatch(/^#[0-9A-F]{6}$/);
    expect(result?.normalizedRatioText).toBe('3:2:2');
    expect(result?.analysis.value).toBeGreaterThan(0);
  });

  it('generates a local neighborhood around a base recipe with darker structural variants', () => {
    const variants = generateRecipeNeighborhood(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 2 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 2 },
    ], { maxVariants: 12 });

    const variantSignatures = variants.map((variant) => variant.map((component) => component.parts).join(':'));
    expect(variantSignatures).toContain('3:3:1');
    expect(variantSignatures).toContain('4:3:1');
  });

  it('surfaces nearby probes so darker neighborhoods are inspectable', () => {
    const base = probeRecipe(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 2 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 2 },
    ]);
    const neighborhood = exploreRecipeNeighborhood(starterPaints, [
      { paintId: 'paint-ultramarine-blue', parts: 3 },
      { paintId: 'paint-burnt-umber', parts: 2 },
      { paintId: 'paint-cadmium-yellow-medium', parts: 2 },
    ], { maxVariants: 10 });

    expect(base).toBeTruthy();
    expect(neighborhood.some((variant) => variant.analysis.value < (base?.analysis.value ?? 1))).toBe(true);
  });
});
