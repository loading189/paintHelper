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

    expect(ranked[0]?.components).toEqual([{ paintId: 'white', weight: 100, percentage: 100 }]);
    expect(ranked[0]?.predictedHex).toBe('#FFFFFF');
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

  it('recipe output keeps exact and practical ratios available', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 5,
      maxPaintsPerRecipe: 3,
    }, 4);

    expect(ranked[0]?.exactRatioText).toBeTruthy();
    expect(ranked[0]?.practicalRatioText).toBeTruthy();
  });

  it('generate ranking keeps saved-friendly recipe text and guidance', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
    }, 4);

    expect(ranked[0]?.recipeText.length).toBeGreaterThan(0);
    expect(ranked[0]?.guidanceText.length).toBeGreaterThan(0);
    expect(ranked[0]?.mixStrategy.length).toBeGreaterThan(0);
  });

  it('still surfaces a black-and-unbleached shortcut lower in the ranking for olive targets', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 40);

    expect(findRecipe(ranked, ['paint-mars-black', 'paint-unbleached-titanium'])).toBeTruthy();
  });
});
