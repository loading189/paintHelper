import { describe, expect, it } from 'vitest';
import type { Paint, UserSettings } from '../../types/models';
import { defaultSettings, starterPaints } from '../storage/seedData';
import { generateCandidateMixes, generateWeightCombinations, rankRecipes, scoreRecipe } from './mixEngine';
import { analyzeColor } from './colorAnalysis';
import { hexToRgb, srgbRgbToLinearRgb } from './colorMath';

const basicPaints: Paint[] = [
  {
    id: 'white',
    name: 'White',
    hex: '#FFFFFF',
    isEnabled: true,
    isWhite: true,
    isBlack: false,
    heuristics: { tintStrength: 'high', naturalBias: 'neutral', commonUse: ['tinting'], dominancePenalty: 0.8 },
  },
  {
    id: 'black',
    name: 'Black',
    hex: '#000000',
    isEnabled: true,
    isWhite: false,
    isBlack: true,
    heuristics: { tintStrength: 'high', naturalBias: 'neutral', commonUse: ['shadow'], dominancePenalty: 1 },
  },
  {
    id: 'red',
    name: 'Red',
    hex: '#FF0000',
    isEnabled: true,
    isWhite: false,
    isBlack: false,
    heuristics: { tintStrength: 'medium', naturalBias: 'chromatic', commonUse: ['warming'], dominancePenalty: 0.3 },
  },
];

const balancedSettings: UserSettings = {
  ...defaultSettings,
  weightStep: 50,
  maxPaintsPerRecipe: 2,
};

const findRecipeIndexByPaintIds = (recipes: ReturnType<typeof rankRecipes>, paintIds: string[]) =>
  recipes.findIndex((recipe) => paintIds.every((paintId) => recipe.components.some((component) => component.paintId === paintId)));

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

  it('discourages black-only matches when a painterly dark green mix exists', () => {
    const ranked = rankRecipes('#1D2A1F', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    });

    expect(ranked[0]?.recipeText).not.toBe('1 part Mars Black');
    expect(ranked[0]?.recipeText).toContain('Burnt Umber');
  });

  it('discourages white-only matches for warm light targets when a more natural light mix is available', () => {
    const ranked = rankRecipes('#E8D9C2', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 2,
      rankingMode: 'painter-friendly-balanced',
    });

    expect(ranked[0]?.recipeText).not.toBe('1 part Titanium White');
    expect(ranked[0]?.recipeText).toMatch(/Unbleached Titanium|Cadmium Yellow Medium/);
  });

  it('suppresses redundant recipes in favor of simpler equivalents', () => {
    const duplicatedPaints: Paint[] = [
      { id: 'a', name: 'A', hex: '#808080', isEnabled: true, isWhite: false, isBlack: false },
      { id: 'b', name: 'B', hex: '#808080', isEnabled: true, isWhite: false, isBlack: false },
      { id: 'c', name: 'C', hex: '#FFFFFF', isEnabled: true, isWhite: true, isBlack: false },
    ];

    const ranked = rankRecipes('#808080', duplicatedPaints, {
      ...defaultSettings,
      weightStep: 50,
      maxPaintsPerRecipe: 2,
    });

    expect(ranked.some((recipe) => recipe.recipeText === '1 part A + 1 part B')).toBe(false);
    expect(ranked[0]?.components).toHaveLength(1);
  });

  it('generates deterministic guidance text and badges', () => {
    const ranked = rankRecipes('#1D2A1F', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
    });

    expect(ranked[0]?.badges).toContain('Best overall');
    expect(ranked[0]?.guidanceText.length).toBeGreaterThan(0);
    expect(ranked[0]?.whyThisRanked.length).toBeGreaterThan(0);
    expect(ranked[0]?.mixStrategy.length).toBeGreaterThan(0);
  });

  it('switches ordering when ranking mode changes', () => {
    const strict = rankRecipes('#1D2A1F', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'strict-closest-color',
    });
    const painterly = rankRecipes('#1D2A1F', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'simpler-recipes-preferred',
    });

    expect(strict[0]?.recipeText).not.toBe(painterly[0]?.recipeText);
  });



  it('keeps dark olive greens in the green family for painter-friendly balanced mode', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 12);

    expect(ranked[0]?.scoreBreakdown.staysInTargetHueFamily).toBe(true);
    expect(ranked[0]?.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium')).toBe(true);
    expect(ranked[0]?.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue')).toBe(true);
    expect(ranked.some((recipe) => recipe.badges.includes('Best overall') && recipe.scoreBreakdown.staysInTargetHueFamily)).toBe(true);
  });

  it('ranks a valid green-family olive mix above black and unbleached titanium for dark olive targets', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 40);

    const greenFamilyIndex = ranked.findIndex((recipe) => recipe.scoreBreakdown.staysInTargetHueFamily);
    const blackTitaniumIndex = findRecipeIndexByPaintIds(ranked, ['paint-mars-black', 'paint-unbleached-titanium']);

    expect(greenFamilyIndex).toBeGreaterThanOrEqual(0);
    expect(blackTitaniumIndex).toBeGreaterThanOrEqual(0);
    expect(greenFamilyIndex).toBeLessThan(blackTitaniumIndex);
  });

  it('rewards a yellow and blue olive path over black-heavy brownish mixes when scores are close', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 120);

    const yellowBlueRecipe = ranked.find((recipe) =>
      recipe.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium') &&
      recipe.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue'),
    );
    const blackHeavyRecipe = ranked.find((recipe) =>
      recipe.components.some((component) => component.paintId === 'paint-mars-black' && component.percentage >= 75) &&
      !recipe.scoreBreakdown.staysInTargetHueFamily,
    );

    expect(yellowBlueRecipe).toBeTruthy();
    expect(yellowBlueRecipe?.scoreBreakdown.chromaticPathBonus).toBeGreaterThan(0);
    expect(blackHeavyRecipe).toBeTruthy();
    expect((yellowBlueRecipe?.distanceScore ?? Infinity)).toBeLessThan(blackHeavyRecipe?.distanceScore ?? -Infinity);
  });

  it('exposes score components for black and white penalties', () => {
    const darkTarget = analyzeColor('#1D2A1F');
    const blackPredicted = analyzeColor('#1D1A19');
    const darkTargetRgb = hexToRgb('#1D2A1F');
    const blackPredictedRgb = hexToRgb('#1D1A19');
    expect(darkTarget && blackPredicted && darkTargetRgb && blackPredictedRgb).toBeTruthy();

    const blackBreakdown = scoreRecipe(
      defaultSettings,
      starterPaints,
      darkTarget!,
      srgbRgbToLinearRgb(darkTargetRgb!),
      blackPredicted!,
      srgbRgbToLinearRgb(blackPredictedRgb!),
      [{ paintId: 'paint-mars-black', percentage: 100, weight: 100 }],
    );

    const lightTarget = analyzeColor('#E8D9C2');
    const whitePredicted = analyzeColor('#F7F7F3');
    const lightTargetRgb = hexToRgb('#E8D9C2');
    const whitePredictedRgb = hexToRgb('#F7F7F3');
    expect(lightTarget && whitePredicted && lightTargetRgb && whitePredictedRgb).toBeTruthy();

    const whiteBreakdown = scoreRecipe(
      defaultSettings,
      starterPaints,
      lightTarget!,
      srgbRgbToLinearRgb(lightTargetRgb!),
      whitePredicted!,
      srgbRgbToLinearRgb(whitePredictedRgb!),
      [{ paintId: 'paint-titanium-white', percentage: 100, weight: 100 }],
    );

    expect(blackBreakdown.blackPenalty).toBeGreaterThan(0);
    expect(blackBreakdown.blackDominancePenalty).toBeGreaterThan(0);
    expect(blackBreakdown.hueFamilyPenalty).toBeGreaterThan(0);
    expect(whiteBreakdown.whitePenalty).toBeGreaterThan(0);
  });
});
