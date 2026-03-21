import { describe, expect, it } from 'vitest';
import type { Paint, UserSettings } from '../../types/models';
import { defaultSettings, starterPaints } from '../storage/seedData';
import { practicalRatioFromWeights, simplifyRatio } from '../utils/ratio';
import { analyzeColor } from './colorAnalysis';
import { generateCandidateMixes, generateWeightCombinations, rankRecipes, scoreRecipe } from './mixEngine';

const basicPaints: Paint[] = [
  { id: 'white', name: 'White', hex: '#FFFFFF', isEnabled: true, isWhite: true, isBlack: false },
  { id: 'black', name: 'Black', hex: '#000000', isEnabled: true, isWhite: false, isBlack: true },
  { id: 'red', name: 'Red', hex: '#FF0000', isEnabled: true, isWhite: false, isBlack: false },
];

const balancedSettings: UserSettings = {
  ...defaultSettings,
  weightStep: 50,
  maxPaintsPerRecipe: 2,
};

const findRecipe = (recipes: ReturnType<typeof rankRecipes>, paintIds: string[]) =>
  recipes.find((recipe) => paintIds.every((paintId) => recipe.components.some((component) => component.paintId === paintId)));

describe('mixEngine', () => {
  it('generates discrete weight combinations', () => {
    expect(generateWeightCombinations(2, 25)).toEqual([
      [25, 75],
      [50, 50],
      [75, 25],
    ]);
  });

  it('generates candidate mixes up to the requested recipe size', () => {
    const candidates = generateCandidateMixes(basicPaints, 2, 50);
    expect(candidates).toEqual([
      { paintIds: ['white'], weights: [100] },
      { paintIds: ['black'], weights: [100] },
      { paintIds: ['red'], weights: [100] },
      { paintIds: ['white', 'black'], weights: [50, 50] },
      { paintIds: ['white', 'red'], weights: [50, 50] },
      { paintIds: ['black', 'red'], weights: [50, 50] },
    ]);
  });

  it('keeps strict closest color behavior available', () => {
    const ranked = rankRecipes('#F8F8F8', basicPaints, {
      ...balancedSettings,
      rankingMode: 'strict-closest-color',
    });

    expect(ranked[0]?.components.some((component) => component.paintId === 'white')).toBe(true);
    expect(ranked[0]?.scoreBreakdown.mode).toBe('strict-closest-color');
    expect(ranked[0]?.distanceScore).toBeGreaterThan(0);
  });

  it('vivid green targets produce visibly green top candidates', () => {
    const ranked = rankRecipes('#18E254', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    });

    expect(ranked[0]?.predictedAnalysis.hueFamily).toBe('green');
    expect(ranked[0]?.badges).toContain('Best overall');
  });

  it('olive green targets can use yellow + blue plus support paint', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 12);

    const top = ranked[0];
    expect(top?.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium')).toBe(true);
    expect(top?.components.some((component) => component.paintId === 'paint-ultramarine-blue' || component.paintId === 'paint-phthalo-blue')).toBe(true);
    expect(top?.components.some((component) => component.paintId === 'paint-burnt-umber' || component.paintId === 'paint-mars-black')).toBe(true);
  });

  it('yellow-gold candidates do not win Best overall for vivid green targets', () => {
    const ranked = rankRecipes('#18E254', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 20);

    const yellowish = ranked.find((recipe) => recipe.predictedAnalysis.hueFamily === 'yellow' || recipe.predictedAnalysis.hueFamily === 'orange');
    expect(yellowish).toBeTruthy();
    expect(yellowish?.badges).not.toContain('Best overall');
  });

  it('penalizes black-heavy chromatic shortcuts against chromatic builds', () => {
    const target = analyzeColor('#545F27');
    const blackHeavy = analyzeColor('#343126');
    const chromatic = analyzeColor('#5A6831');
    expect(target && blackHeavy && chromatic).toBeTruthy();

    const blackHeavyScore = scoreRecipe(
      { ...defaultSettings, rankingMode: 'painter-friendly-balanced' },
      starterPaints,
      target!,
      blackHeavy!,
      [
        { paintId: 'paint-mars-black', percentage: 50, weight: 50 },
        { paintId: 'paint-cadmium-yellow-medium', percentage: 25, weight: 25 },
        { paintId: 'paint-burnt-umber', percentage: 25, weight: 25 },
      ],
    );

    const chromaticScore = scoreRecipe(
      { ...defaultSettings, rankingMode: 'painter-friendly-balanced' },
      starterPaints,
      target!,
      chromatic!,
      [
        { paintId: 'paint-cadmium-yellow-medium', percentage: 50, weight: 50 },
        { paintId: 'paint-ultramarine-blue', percentage: 25, weight: 25 },
        { paintId: 'paint-burnt-umber', percentage: 25, weight: 25 },
      ],
    );

    expect(blackHeavyScore.blackPenalty).toBeGreaterThan(0);
    expect(chromaticScore.chromaticPathBonus).toBeGreaterThan(0);
    expect(chromaticScore.finalScore).toBeLessThan(blackHeavyScore.finalScore);
  });

  it('strict mode still differs from painter mode', () => {
    const target = analyzeColor('#545F27');
    const predicted = analyzeColor('#5A6831');
    expect(target && predicted).toBeTruthy();

    const components = [
      { paintId: 'paint-cadmium-yellow-medium', percentage: 50, weight: 50 },
      { paintId: 'paint-ultramarine-blue', percentage: 25, weight: 25 },
      { paintId: 'paint-burnt-umber', percentage: 25, weight: 25 },
    ];

    const strict = scoreRecipe(
      { ...defaultSettings, rankingMode: 'strict-closest-color' },
      starterPaints,
      target!,
      predicted!,
      components,
    );
    const painter = scoreRecipe(
      { ...defaultSettings, rankingMode: 'painter-friendly-balanced' },
      starterPaints,
      target!,
      predicted!,
      components,
    );

    expect(strict.finalScore).not.toBe(painter.finalScore);
  });

  it('simplifies awkward ratios into practical deterministic outputs', () => {
    expect(simplifyRatio([85, 15])).toEqual([17, 3]);
    expect(practicalRatioFromWeights([85, 15])).toEqual([6, 1]);
    expect(practicalRatioFromWeights([65, 20, 15])).toEqual(practicalRatioFromWeights([65, 20, 15]));
  });

  it('recipe output keeps exact and practical ratios plus display percentages available', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
    }, 4);

    expect(ranked[0]?.exactRatioText).toBeTruthy();
    expect(ranked[0]?.practicalRatioText).toBeTruthy();
    expect(ranked[0]?.exactPercentages.reduce((sum, part) => sum + part, 0)).toBe(100);
    expect(ranked[0]?.practicalPercentages.reduce((sum, part) => sum + part, 0)).toBe(100);
  });

  it('generate ranking keeps saved-friendly recipe text, guidance, and next adjustments', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
    }, 4);

    expect(ranked[0]?.recipeText.length).toBeGreaterThan(0);
    expect(ranked[0]?.guidanceText.length).toBeGreaterThan(0);
    expect(ranked[0]?.mixStrategy.length).toBeGreaterThan(0);
    expect(ranked[0]?.nextAdjustments.length).toBeGreaterThan(0);
  });

  it('prefers at most one support paint in top olive results', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 8);

    ranked.slice(0, 5).forEach((recipe) => {
      const supportCount = recipe.components.filter((component) =>
        ['paint-mars-black', 'paint-burnt-umber', 'paint-titanium-white', 'paint-unbleached-titanium'].includes(component.paintId),
      ).length;
      expect(supportCount).toBeLessThanOrEqual(1);
    });
  });

  it('clamps phthalo dominance for muted targets during candidate generation', () => {
    const candidates = generateCandidateMixes(starterPaints, 3, 5, '#6C7232');
    const phthaloDominant = candidates.filter((candidate) =>
      candidate.paintIds.includes('paint-phthalo-blue') && candidate.weights[candidate.paintIds.indexOf('paint-phthalo-blue')] > 20,
    );

    expect(phthaloDominant).toEqual([]);
  });

  it('strongly prefers yellow plus lighteners for light yellow painter-friendly targets', () => {
    const ranked = rankRecipes('#F3E58A', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 8);

    const top = ranked[0];
    expect(top?.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium')).toBe(true);
    expect(top?.components.some((component) => ['paint-titanium-white', 'paint-unbleached-titanium'].includes(component.paintId))).toBe(true);
    expect(top?.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue')).toBe(false);
  });

  it('demotes blue-family paths for warm light yellows unless the hue really leans green', () => {
    const ranked = rankRecipes('#F1DE74', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 10);

    expect(ranked.slice(0, 5).every((recipe) =>
      recipe.components.every((component) => component.paintId !== 'paint-phthalo-blue' && component.paintId !== 'paint-ultramarine-blue'),
    )).toBe(true);
  });

  it('keeps pale cream yellows on a warm yellow-lightening path', () => {
    const ranked = rankRecipes('#F5E9BF', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 6);

    const top = ranked[0];
    expect(top?.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium')).toBe(true);
    expect(top?.components.some((component) => component.paintId === 'paint-unbleached-titanium' || component.paintId === 'paint-titanium-white')).toBe(true);
  });

  it('preserves green and olive behavior after yellow-light safeguards', () => {
    const olive = rankRecipes('#8A8B4A', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 6);
    const vivid = rankRecipes('#18E254', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 6);

    expect(olive[0]?.components.some((component) => component.paintId === 'paint-ultramarine-blue' || component.paintId === 'paint-phthalo-blue')).toBe(true);
    expect(vivid[0]?.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue')).toBe(true);
  });

  it('covers painter-common warm orange and violet targets with plausible families', () => {
    const warmOrange = rankRecipes('#F29A3A', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 6);
    const violet = rankRecipes('#8D68C9', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 6);

    expect(warmOrange[0]?.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium')).toBe(true);
    expect(warmOrange[0]?.components.some((component) => component.paintId === 'paint-cadmium-red' || component.paintId === 'paint-unbleached-titanium' || component.paintId === 'paint-titanium-white')).toBe(true);
    expect(violet[0]?.components.some((component) => component.paintId === 'paint-alizarin-crimson' || component.paintId === 'paint-cadmium-red')).toBe(true);
    expect(violet[0]?.components.some((component) => component.paintId === 'paint-ultramarine-blue' || component.paintId === 'paint-phthalo-blue')).toBe(true);
  });

  it('keeps Mars Black in a support role for chromatic painter scores', () => {
    const target = analyzeColor('#18E254');
    const predicted = analyzeColor('#23482D');
    expect(target && predicted).toBeTruthy();

    const score = scoreRecipe(
      { ...defaultSettings, rankingMode: 'painter-friendly-balanced' },
      starterPaints,
      target!,
      predicted!,
      [
        { paintId: 'paint-mars-black', percentage: 40, weight: 40 },
        { paintId: 'paint-cadmium-yellow-medium', percentage: 35, weight: 35 },
        { paintId: 'paint-phthalo-blue', percentage: 25, weight: 25 },
      ],
    );

    expect(score.blackPenalty).toBeGreaterThan(0);
    expect(score.supportPenalty).toBeGreaterThan(0);
  });

  it('applies an early-white penalty to chromatic targets without blocking valid light mixes', () => {
    const target = analyzeColor('#6EB2D9');
    const whiteHeavyPredicted = analyzeColor('#B8D0E2');
    const hueFirstPredicted = analyzeColor('#74A9D2');
    expect(target && whiteHeavyPredicted && hueFirstPredicted).toBeTruthy();

    const whiteHeavy = scoreRecipe(
      { ...defaultSettings, rankingMode: 'painter-friendly-balanced' },
      starterPaints,
      target!,
      whiteHeavyPredicted!,
      [
        { paintId: 'paint-titanium-white', percentage: 35, weight: 35 },
        { paintId: 'paint-phthalo-blue', percentage: 35, weight: 35 },
        { paintId: 'paint-unbleached-titanium', percentage: 30, weight: 30 },
      ],
    );

    const hueFirst = scoreRecipe(
      { ...defaultSettings, rankingMode: 'painter-friendly-balanced' },
      starterPaints,
      target!,
      hueFirstPredicted!,
      [
        { paintId: 'paint-phthalo-blue', percentage: 45, weight: 45 },
        { paintId: 'paint-cadmium-yellow-medium', percentage: 35, weight: 35 },
        { paintId: 'paint-titanium-white', percentage: 20, weight: 20 },
      ],
    );

    expect(whiteHeavy.earlyWhitePenalty).toBeGreaterThan(0);
    expect(hueFirst.earlyWhitePenalty).toBeLessThan(whiteHeavy.earlyWhitePenalty);
    expect(hueFirst.finalScore).toBeLessThan(whiteHeavy.finalScore);
  });
});
