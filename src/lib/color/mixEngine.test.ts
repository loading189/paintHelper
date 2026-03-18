import { describe, expect, it } from 'vitest';
import { generateCandidateMixes, generateWeightCombinations, rankRecipes } from './mixEngine';
import type { Paint } from '../../types/models';

const paints: Paint[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF', isEnabled: true, isWhite: true, isBlack: false },
  { id: 'black', name: 'Black', hex: '#000000', isEnabled: true, isWhite: false, isBlack: true },
  { id: 'red', name: 'Red', hex: '#FF0000', isEnabled: true, isWhite: false, isBlack: false },
];

describe('mixEngine', () => {
  it('generates discrete weight combinations', () => {
    expect(generateWeightCombinations(2, 25)).toEqual([
      [25, 75],
      [50, 50],
      [75, 25],
    ]);
  });

  it('generates candidate mixes up to the requested recipe size', () => {
    const candidates = generateCandidateMixes(paints, 2, 50);
    expect(candidates).toEqual([
      { paintIds: ['white'], weights: [100] },
      { paintIds: ['black'], weights: [100] },
      { paintIds: ['red'], weights: [100] },
      { paintIds: ['white', 'black'], weights: [50, 50] },
      { paintIds: ['white', 'red'], weights: [50, 50] },
      { paintIds: ['black', 'red'], weights: [50, 50] },
    ]);
  });

  it('ranks recipes deterministically by smallest distance', () => {
    const ranked = rankRecipes('#F8F8F8', paints, 2, 50, 3);
    expect(ranked[0]?.components).toEqual([{ paintId: 'white', weight: 100, percentage: 100 }]);
    expect(ranked[0]?.predictedHex).toBe('#FFFFFF');
    expect(ranked).toHaveLength(3);
  });
});
