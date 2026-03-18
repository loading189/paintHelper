import { describe, expect, it } from 'vitest';
import {
  colorDistance,
  hexToRgb,
  linearChannelToSrgb,
  linearRgbToSrgbRgb,
  normalizeHex,
  rgbToHex,
  srgbChannelToLinear,
  srgbRgbToLinearRgb,
} from './colorMath';

describe('colorMath', () => {
  it('normalizes valid hex values', () => {
    expect(normalizeHex('a1b2c3')).toBe('#A1B2C3');
    expect(normalizeHex('#0f0f0f')).toBe('#0F0F0F');
    expect(normalizeHex('#xyzxyz')).toBeNull();
  });

  it('converts hex to rgb and back', () => {
    expect(hexToRgb('#336699')).toEqual({ r: 51, g: 102, b: 153 });
    expect(rgbToHex({ r: 51, g: 102, b: 153 })).toBe('#336699');
  });

  it('round-trips between srgb and linear rgb', () => {
    const linear = srgbRgbToLinearRgb({ r: 128, g: 64, b: 32 });
    const srgb = linearRgbToSrgbRgb(linear);
    expect(srgb).toEqual({ r: 128, g: 64, b: 32 });
  });

  it('converts single channels between srgb and linear', () => {
    const linear = srgbChannelToLinear(0.5);
    const srgb = linearChannelToSrgb(linear);
    expect(srgb).toBeCloseTo(0.5, 6);
  });

  it('computes euclidean distance in linear rgb', () => {
    expect(colorDistance({ r: 0, g: 0, b: 0 }, { r: 1, g: 0, b: 0 })).toBe(1);
  });
});
