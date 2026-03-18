import { describe, expect, it } from 'vitest';
import { simplifyRatio } from './ratio';

describe('simplifyRatio', () => {
  it('reduces whole-number weights', () => {
    expect(simplifyRatio([20, 10])).toEqual([2, 1]);
    expect(simplifyRatio([40, 20, 20])).toEqual([2, 1, 1]);
  });

  it('handles empty input', () => {
    expect(simplifyRatio([])).toEqual([]);
  });
});
