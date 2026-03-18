import { describe, expect, it } from 'vitest';
import { starterPaints } from '../storage/seedData';
import { analyzeColor } from './colorAnalysis';
import { predictSpectralMix } from './spectralMixing';

const buildMix = (paintIds: string[], weights: number[]) =>
  predictSpectralMix(
    starterPaints,
    paintIds.map((paintId, index) => ({ paintId, weight: weights[index] })),
  );

describe('spectralMixing', () => {
  it('is deterministic for the same weighted recipe', () => {
    const first = buildMix(['paint-cadmium-yellow-medium', 'paint-ultramarine-blue'], [70, 30]);
    const second = buildMix(['paint-cadmium-yellow-medium', 'paint-ultramarine-blue'], [70, 30]);

    expect(first).toEqual(second);
  });

  it('keeps basic mixing sanity for yellow and blue', () => {
    const result = buildMix(['paint-cadmium-yellow-medium', 'paint-ultramarine-blue'], [55, 45]);
    const analysis = analyzeColor(result.hex);

    expect(analysis?.hueFamily).toBe('green');
  });

  it('yields orange-family results for red plus yellow', () => {
    const result = buildMix(['paint-cadmium-yellow-medium', 'paint-cadmium-red'], [55, 45]);
    const analysis = analyzeColor(result.hex);

    expect(analysis?.hueFamily).toBe('orange');
  });

  it('yields violet-family results for red plus blue', () => {
    const result = buildMix(['paint-alizarin-crimson', 'paint-ultramarine-blue'], [55, 45]);
    const analysis = analyzeColor(result.hex);

    expect(analysis?.hueFamily).toBe('violet');
  });
});
