import { describe, expect, it } from 'vitest';
import {
  analyzeColor,
  classifyHueFamily,
  classifySaturation,
  classifyValue,
  generateTargetPaletteInsights,
  isBlueVioletBoundaryTarget,
  isCoolMutedNeutralTarget,
  isDarkEarthWarmTarget,
  isLightWarmNeutralTarget,
  isNearBlackChromaticTarget,
  isRedBrownOrangeCrossoverTarget,
  isYellowGreenBoundaryTarget,
} from './colorAnalysis';
import { starterPaints } from '../storage/seedData';

describe('colorAnalysis', () => {
  it('classifies value bands deterministically', () => {
    expect(classifyValue(0.05)).toBe('very dark');
    expect(classifyValue(0.3)).toBe('dark');
    expect(classifyValue(0.55)).toBe('mid');
    expect(classifyValue(0.8)).toBe('light');
    expect(classifyValue(0.93)).toBe('very light');
  });

  it('classifies hue families with neutral fallback', () => {
    expect(classifyHueFamily(5, 'moderate')).toBe('red');
    expect(classifyHueFamily(35, 'moderate')).toBe('orange');
    expect(classifyHueFamily(75, 'moderate')).toBe('yellow');
    expect(classifyHueFamily(140, 'moderate')).toBe('green');
    expect(classifyHueFamily(220, 'moderate')).toBe('blue');
    expect(classifyHueFamily(300, 'moderate')).toBe('violet');
    expect(classifyHueFamily(null, 'neutral')).toBe('neutral');
  });

  it('classifies saturation bands deterministically', () => {
    expect(classifySaturation(0.03, 0.01)).toBe('neutral');
    expect(classifySaturation(0.22, 0.03)).toBe('muted');
    expect(classifySaturation(0.5, 0.09)).toBe('moderate');
    expect(classifySaturation(0.8, 0.2)).toBe('vivid');
  });

  it('analyzes a target color into painter-friendly descriptors', () => {
    expect(analyzeColor('#7A8FB3')).toMatchObject({
      normalizedHex: '#7A8FB3',
      hueFamily: 'blue',
      valueClassification: 'mid',
      saturationClassification: 'muted',
    });
  });

  it('generates painterly palette insights for dark greens and vivid greens', () => {
    const darkGreen = analyzeColor('#1D2A1F');
    const vividGreen = analyzeColor('#18E254');
    expect(darkGreen && vividGreen).toBeTruthy();

    const darkInsights = generateTargetPaletteInsights(darkGreen!, starterPaints);
    const vividInsights = generateTargetPaletteInsights(vividGreen!, starterPaints);

    expect(darkInsights.some((line) => line.includes('Olive and natural greens'))).toBe(true);
    expect(vividInsights.some((line) => line.includes('yellow + blue first'))).toBe(true);
    expect(vividInsights.some((line) => line.includes('dark chromatic target'))).toBe(false);
  });

  it('derives edge-case target helpers without expanding public enums', () => {
    const darkEarth = analyzeColor('#511D04');
    const warmLightNeutral = analyzeColor('#E7D8C5');
    const coolMutedNeutral = analyzeColor('#8A909A');
    const nearBlackChromatic = analyzeColor('#15101A');
    const yellowGreenBoundary = analyzeColor('#B9D13A');
    const blueVioletBoundary = analyzeColor('#6669B8');
    expect(darkEarth && warmLightNeutral && coolMutedNeutral && nearBlackChromatic && yellowGreenBoundary && blueVioletBoundary).toBeTruthy();

    expect(isDarkEarthWarmTarget(darkEarth!)).toBe(true);
    expect(isRedBrownOrangeCrossoverTarget(darkEarth!)).toBe(true);
    expect(isLightWarmNeutralTarget(warmLightNeutral!)).toBe(true);
    expect(isCoolMutedNeutralTarget(coolMutedNeutral!)).toBe(true);
    expect(isNearBlackChromaticTarget(nearBlackChromatic!)).toBe(true);
    expect(isYellowGreenBoundaryTarget(yellowGreenBoundary!)).toBe(true);
    expect(isBlueVioletBoundaryTarget(blueVioletBoundary!)).toBe(true);
  });
});
