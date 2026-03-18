import { describe, expect, it } from 'vitest';
import { starterPaints } from '../storage/seedData';
import { analyzeColor } from './colorAnalysis';
import { generateNextAdjustments } from './adjustmentEngine';

describe('adjustmentEngine', () => {
  it('gives deterministic guidance for a vivid green that needs more warmth and chroma support', () => {
    const target = analyzeColor('#18E254');
    const predicted = analyzeColor('#4CCF6A');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-cadmium-yellow-medium', weight: 70, percentage: 70 },
        { paintId: 'paint-phthalo-blue', weight: 20, percentage: 20 },
        { paintId: 'paint-titanium-white', weight: 10, percentage: 10 },
      ],
    });

    expect(suggestions).toEqual([
      'Add a small touch more Cadmium Yellow Medium to warm the green.',
      'Reinforce the green by nudging Cadmium Yellow Medium + Phthalo Blue before adding more support paint.',
      'Keep later white additions small so the hue stays clean and doesn’t chalk out.',
    ]);
  });

  it('guides a muted olive toward lighter, warmer naturalization', () => {
    const target = analyzeColor('#6C7232');
    const predicted = analyzeColor('#4D5727');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-cadmium-yellow-medium', weight: 55, percentage: 55 },
        { paintId: 'paint-ultramarine-blue', weight: 25, percentage: 25 },
        { paintId: 'paint-burnt-umber', weight: 20, percentage: 20 },
      ],
    });

    expect(suggestions).toEqual([
      'Lift value with a small amount of Unbleached Titanium.',
      'Add a small touch more Cadmium Yellow Medium to warm the green.',
    ]);
  });

  it('gives warm-neutral correction without vague advice', () => {
    const target = analyzeColor('#8A8074');
    const predicted = analyzeColor('#74808E');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-unbleached-titanium', weight: 50, percentage: 50 },
        { paintId: 'paint-ultramarine-blue', weight: 20, percentage: 20 },
        { paintId: 'paint-mars-black', weight: 30, percentage: 30 },
      ],
    });

    expect(suggestions).toEqual(['Warm the neutral with Burnt Umber rather than more white.']);
  });

  it('suggests darkening and cooling control for a dark muted miss', () => {
    const target = analyzeColor('#403A31');
    const predicted = analyzeColor('#6C5A48');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-burnt-umber', weight: 45, percentage: 45 },
        { paintId: 'paint-unbleached-titanium', weight: 35, percentage: 35 },
        { paintId: 'paint-cadmium-red', weight: 20, percentage: 20 },
      ],
    });

    expect(suggestions).toEqual([
      'Lower value with a touch of Burnt Umber. Keep it in support, not as the base pile.',
      'Cool the neutral with a trace of Ultramarine Blue before darkening further.',
    ]);
  });
});
