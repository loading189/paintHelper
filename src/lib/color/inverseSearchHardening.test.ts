import { describe, expect, it } from 'vitest';
import { starterPaints, defaultSettings } from '../storage/seedData';
import { analyzeColor, hueDifference, isNearBlackChromaticTarget } from './colorAnalysis';
import { generateCandidateMixes, rankRecipes } from './mixEngine';

const searchSettings = {
  ...defaultSettings,
  rankingMode: 'painter-friendly-balanced' as const,
  maxPaintsPerRecipe: 3 as const,
  weightStep: 25,
};

const getTopRecipe = (targetHex: string) => {
  const ranked = rankRecipes(targetHex, starterPaints, searchSettings, 6);
  expect(ranked.length).toBeGreaterThan(0);
  return ranked[0]!;
};

describe('inverse search hardening', () => {
  describe('dark targets enforce value-aware recipe structure', () => {
    it.each([
      '#1B1904',
      '#511D04',
      '#1A2415',
      '#1A1D22',
    ])('keeps dark target %s out of obviously light white-heavy recipes', (targetHex) => {
      const target = analyzeColor(targetHex);
      const top = getTopRecipe(targetHex);
      expect(target).toBeTruthy();

      expect(top.predictedAnalysis.value - target!.value).toBeLessThanOrEqual(0.24);
      expect(top.components.some((component) => component.paintId === 'paint-titanium-white' || component.paintId === 'paint-unbleached-titanium')).toBe(false);
      expect(top.components.some((component) => ['paint-burnt-umber', 'paint-mars-black'].includes(component.paintId))).toBe(true);

      if (isNearBlackChromaticTarget(target!)) {
        const blackShare = top.components.find((component) => component.paintId === 'paint-mars-black')?.percentage ?? 0;
        expect(blackShare).toBeLessThanOrEqual(35);
      }
    });

    it('generates dark-first candidate ratios instead of only bright dominant structures', () => {
      const candidates = generateCandidateMixes(starterPaints, 3, 25, '#1A2415');
      const darkStructured = candidates.filter((candidate) =>
        candidate.paintIds.includes('paint-burnt-umber') &&
        candidate.weights.some((weight) => ![25, 50, 75].includes(weight)),
      );

      expect(darkStructured.length).toBeGreaterThan(0);
      expect(darkStructured.some((candidate) => {
        const earthIndex = candidate.paintIds.indexOf('paint-burnt-umber');
        return earthIndex >= 0 && candidate.weights[earthIndex] >= 40;
      })).toBe(true);
    });
  });

  describe('muted and vivid targets keep search/ranking semantics separate from forward truth', () => {
    it.each([
      '#A79D93',
      '#B58D8C',
      '#8A5F52',
    ])('does not reward an overly vivid top result for muted target %s', (targetHex) => {
      const top = getTopRecipe(targetHex);

      expect(top.predictedAnalysis.saturationClassification).not.toBe('vivid');
      expect(top.components.some((component) => ['paint-burnt-umber', 'paint-unbleached-titanium', 'paint-ultramarine-blue'].includes(component.paintId))).toBe(true);
    });

    it.each([
      '#18E254',
      '#A5E22A',
      '#6B54D9',
    ])('keeps vivid target %s away from muddy winners', (targetHex) => {
      const target = analyzeColor(targetHex);
      const top = getTopRecipe(targetHex);
      expect(target).toBeTruthy();

      expect(['muted', 'neutral']).not.toContain(top.predictedAnalysis.saturationClassification);
      expect(top.predictedAnalysis.chroma).toBeGreaterThanOrEqual(target!.chroma - 0.1);
      expect(hueDifference(top.predictedAnalysis.hue, target!.hue)).toBeLessThanOrEqual(0.32);
    });

    it('prefers green-family winners for vivid greens instead of yellowish shortcuts', () => {
      const vividGreen = getTopRecipe('#18E254');
      expect(vividGreen.predictedAnalysis.hueFamily).toBe('green');
      expect(vividGreen.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue')).toBe(true);
    });
  });

  describe('edge-case regression coverage', () => {
    it.each([
      '#F3EE8A', // pale lemon yellow
      '#F0E2B8', // warm cream
      '#BFC9A6', // light sage
      '#9CCF52', // spring green
      '#3E4A21', // dark moss
      '#A6310D', // dark earth warm
      '#8A4E2B', // red-brown / orange-brown boundary
    ])('returns a bounded truthful top recipe for %s', (targetHex) => {
      const top = getTopRecipe(targetHex);

      expect(top.scoreBreakdown.spectralDistance).toBeLessThan(0.25);
      expect(top.components.length).toBeLessThanOrEqual(3);
      expect(top.predictedHex).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});
