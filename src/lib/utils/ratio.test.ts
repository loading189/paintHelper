import { describe, expect, it } from 'vitest';
import { formatRatio, practicalRatioFromWeights, simplifyRatio } from './ratio';

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
