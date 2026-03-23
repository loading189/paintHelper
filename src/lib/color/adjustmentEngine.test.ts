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

  it('keeps pale lemon yellow guidance on a lightening-first path', () => {
    const target = analyzeColor('#F3EE8A');
    const predicted = analyzeColor('#E0C95A');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-cadmium-yellow-medium', weight: 70, percentage: 70 },
        { paintId: 'paint-unbleached-titanium', weight: 30, percentage: 30 },
      ],
    });

    expect(suggestions).toContain('Lift value with a small amount of Unbleached Titanium before trying to cool the yellow.');
    expect(suggestions.some((line) => line.includes('trace of'))).toBe(false);
  });

  it('limits blue correction language for a light yellow-green edge case', () => {
    const target = analyzeColor('#E8EB8D');
    const predicted = analyzeColor('#DCC36E');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-cadmium-yellow-medium', weight: 60, percentage: 60 },
        { paintId: 'paint-unbleached-titanium', weight: 25, percentage: 25 },
        { paintId: 'paint-titanium-white', weight: 15, percentage: 15 },
      ],
    });

    expect(suggestions).toContain('Open the value first with Unbleached Titanium, then use only a trace of Ultramarine Blue if the yellow still needs a slight yellow-green correction.');
  });

  it('guides dark earth warms toward earth-first darkening instead of black-first collapse', () => {
    const target = analyzeColor('#511D04');
    const predicted = analyzeColor('#8B4A1E');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-cadmium-red', weight: 45, percentage: 45 },
        { paintId: 'paint-cadmium-yellow-medium', weight: 25, percentage: 25 },
        { paintId: 'paint-burnt-umber', weight: 30, percentage: 30 },
      ],
    });

    expect(suggestions[0]).toBe('Lower value with a touch of Burnt Umber. Dark earth warms usually deepen more plausibly with earth color first; keep black as a last resort.');
  });

  it('keeps near-black chromatic adjustment advice from collapsing straight into black', () => {
    const target = analyzeColor('#1A1120');
    const predicted = analyzeColor('#251F27');
    expect(target && predicted).toBeTruthy();

    const suggestions = generateNextAdjustments(target!, predicted!, starterPaints, {
      components: [
        { paintId: 'paint-ultramarine-blue', weight: 40, percentage: 40 },
        { paintId: 'paint-alizarin-crimson', weight: 35, percentage: 35 },
        { paintId: 'paint-mars-black', weight: 25, percentage: 25 },
      ],
    });

    expect(suggestions.some((line) => line.includes('before collapsing into black'))).toBe(true);
  });
});
