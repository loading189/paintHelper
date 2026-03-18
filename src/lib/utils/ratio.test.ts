import { describe, expect, it } from 'vitest';
import { distributePercentages, formatRatio, practicalRatioFromWeights, simplifyRatio } from './ratio';

describe('simplifyRatio', () => {
  it('reduces whole-number weights', () => {
    expect(simplifyRatio([20, 10])).toEqual([2, 1]);
    expect(simplifyRatio([40, 20, 20])).toEqual([2, 1, 1]);
  });

  it('handles empty input', () => {
    expect(simplifyRatio([])).toEqual([]);
  });
});

describe('practicalRatioFromWeights', () => {
  it('approximates awkward exact ratios into small painter-friendly parts', () => {
    expect(practicalRatioFromWeights([85, 15])).toEqual([6, 1]);
  });

  it('keeps straightforward two-paint ratios intact', () => {
    expect(practicalRatioFromWeights([75, 25])).toEqual([3, 1]);
  });

  it('keeps readable three-paint ratios intact when already practical', () => {
    expect(practicalRatioFromWeights([70, 20, 10])).toEqual([7, 2, 1]);
  });

  it('is deterministic for repeated calls', () => {
    const first = practicalRatioFromWeights([65, 35]);
    const second = practicalRatioFromWeights([65, 35]);

    expect(first).toEqual(second);
    expect(formatRatio(first)).toBe(formatRatio(second));
  });
});

describe('distributePercentages', () => {
  it('converts practical parts into whole-number percentages that sum to 100', () => {
    expect(distributePercentages([6, 1])).toEqual([86, 14]);
  });

  it('keeps exact percentages mathematically aligned with equal ratios', () => {
    expect(distributePercentages([1, 1, 1])).toEqual([34, 33, 33]);
  });
});
