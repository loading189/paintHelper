import { describe, expect, it } from 'vitest';
import {
  analyzeColor,
  classifyHueFamily,
  classifySaturation,
  classifyValue,
  generateTargetPaletteInsights,
} from './colorAnalysis';
import { starterPaints } from '../storage/seedData';

describe('colorAnalysis', () => {
  it('classifies value bands deterministically', () => {
    expect(classifyValue(0.05)).toBe('very dark');
    expect(classifyValue(0.2)).toBe('dark');
    expect(classifyValue(0.45)).toBe('mid');
    expect(classifyValue(0.72)).toBe('light');
    expect(classifyValue(0.93)).toBe('very light');
  });

  it('classifies hue families with neutral fallback', () => {
    expect(classifyHueFamily(5, 'moderate')).toBe('red');
    expect(classifyHueFamily(35, 'moderate')).toBe('orange');
    expect(classifyHueFamily(55, 'moderate')).toBe('yellow');
    expect(classifyHueFamily(120, 'moderate')).toBe('green');
    expect(classifyHueFamily(220, 'moderate')).toBe('blue');
    expect(classifyHueFamily(290, 'moderate')).toBe('violet');
    expect(classifyHueFamily(null, 'neutral')).toBe('neutral');
  });

  it('classifies saturation bands deterministically', () => {
    expect(classifySaturation(0.03, 0.01)).toBe('neutral');
    expect(classifySaturation(0.2, 0.15)).toBe('muted');
    expect(classifySaturation(0.4, 0.3)).toBe('moderate');
    expect(classifySaturation(0.8, 0.7)).toBe('vivid');
  });

  it('analyzes a target color into painter-friendly descriptors', () => {
    expect(analyzeColor('#7A8FB3')).toMatchObject({
      normalizedHex: '#7A8FB3',
      hueFamily: 'blue',
      valueClassification: 'dark',
      saturationClassification: 'muted',
    });
  });

  it('generates deterministic target-to-palette insights', () => {
    const target = analyzeColor('#1D2A1F');
    expect(target).not.toBeNull();
    expect(generateTargetPaletteInsights(target!, starterPaints)).toEqual([
      'This target is darker than most chromatic paints in your palette.',
      'A dark green mix will likely need umber, black, or both for support.',
      'This target is muted; earth colors or complements should help control chroma.',
      'Your palette has earth colors available, so a natural neutral is often easier than brute-force complement mixing.',
    ]);
  });
});
