import { describe, expect, it } from 'vitest';
import { extractPalette, sampleImageColor } from './referenceSampler';

const image = {
  width: 4,
  height: 4,
  data: new Uint8ClampedArray([
    255, 0, 0, 255,   255, 0, 0, 255,   0, 255, 0, 255,   0, 255, 0, 255,
    255, 0, 0, 255,   255, 0, 0, 255,   0, 255, 0, 255,   0, 255, 0, 255,
    0, 0, 255, 255,   0, 0, 255, 255,   240, 240, 240, 255,   240, 240, 240, 255,
    0, 0, 255, 255,   0, 0, 255, 255,   240, 240, 240, 255,   240, 240, 240, 255,
  ]),
};

describe('referenceSampler', () => {
  it('samples a single pixel deterministically', () => {
    expect(sampleImageColor(image, { x: 0, y: 0 }, 0, 'pixel')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('averages a circular region', () => {
    const sampled = sampleImageColor(image, { x: 1, y: 1 }, 1, 'average');
    expect(sampled.r).toBeGreaterThan(sampled.g);
    expect(sampled.g).toBeGreaterThanOrEqual(sampled.b);
    expect(sampled.r).toBeGreaterThan(150);
  });

  it('extracts a deterministic clustered palette', () => {
    const once = extractPalette(image, 3);
    const twice = extractPalette(image, 3);
    expect(once).toEqual(twice);
    expect(once).toHaveLength(3);
    expect(new Set(once.map((entry) => entry.hex)).size).toBe(3);
    expect(once.map((entry) => entry.hex)).toContain('#0000FF');
    expect(once.map((entry) => entry.hex)).toContain('#00FF00');
  });
});
