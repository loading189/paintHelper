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

    expect(ranked[0]?.badges).toContain('Best value block-in');
    expect(ranked[0]?.guidanceText.length).toBeGreaterThan(0);
    expect(ranked[0]?.whyThisRanked.length).toBeGreaterThan(0);
    expect(ranked[0]?.mixStrategy.length).toBeGreaterThan(0);
    expect(ranked.every((recipe) =>
      !recipe.badges.includes('Best overall') ||
      (recipe.scoreBreakdown.staysInTargetHueFamily && recipe.scoreBreakdown.hasRequiredHueConstructionPath),
    )).toBe(true);
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



  it('does not let dark olive construction-path mixes count as hue-family matches when the prediction is visibly off', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 12);

    expect(ranked[0]?.scoreBreakdown.staysInTargetHueFamily).toBe(false);
    expect(ranked[0]?.scoreBreakdown.hasRequiredHueConstructionPath).toBe(true);
    expect(ranked[0]?.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium')).toBe(true);
    expect(ranked[0]?.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue')).toBe(true);
    expect(ranked[0]?.badges).toContain('Best value block-in');
    expect(ranked.some((recipe) => recipe.badges.includes('Best overall'))).toBe(false);
  });

  it('still ranks yellow-plus-blue olive constructions ahead of black and unbleached titanium shortcuts for dark olive targets', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 40);

    const yellowBlueIndex = ranked.findIndex((recipe) => recipe.scoreBreakdown.hasRequiredHueConstructionPath);
    const blackTitaniumIndex = findRecipeIndexByPaintIds(ranked, ['paint-mars-black', 'paint-unbleached-titanium']);

    expect(yellowBlueIndex).toBeGreaterThanOrEqual(0);
    expect(blackTitaniumIndex).toBeGreaterThanOrEqual(0);
    expect(yellowBlueIndex).toBeLessThan(blackTitaniumIndex);
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
    const blackYellowOnlyRecipe = ranked.find((recipe) =>
      recipe.components.some((component) => component.paintId === 'paint-mars-black') &&
      recipe.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium') &&
      !recipe.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue'),
    );

    expect(yellowBlueRecipe).toBeTruthy();
    expect(yellowBlueRecipe?.scoreBreakdown.chromaticPathBonus).toBeGreaterThan(0);
    expect(yellowBlueRecipe?.scoreBreakdown.hasRequiredHueConstructionPath).toBe(true);
    expect(blackYellowOnlyRecipe).toBeTruthy();
    expect(yellowBlueRecipe?.distanceScore).toBeLessThan(blackYellowOnlyRecipe?.distanceScore ?? Infinity);
    expect(blackYellowOnlyRecipe?.scoreBreakdown.requiredHueConstructionPenalty).toBeGreaterThan(0);
  });

  it('does not award Best overall to a black-dominant green mix without blue', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 120);

    const blackDominantWithoutBlue = ranked.find((recipe) =>
      recipe.components.some((component) => component.paintId === 'paint-mars-black' && component.percentage >= 50) &&
      recipe.components.some((component) => component.paintId === 'paint-cadmium-yellow-medium') &&
      !recipe.components.some((component) => component.paintId === 'paint-phthalo-blue' || component.paintId === 'paint-ultramarine-blue'),
    );

    expect(blackDominantWithoutBlue).toBeTruthy();
    expect(blackDominantWithoutBlue?.badges).not.toContain('Best overall');
    expect(blackDominantWithoutBlue?.scoreBreakdown.requiredHueConstructionPenalty).toBeGreaterThan(0);
  });

  it('advises dark green recipes to build green before darkening', () => {
    const ranked = rankRecipes('#545F27', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 3,
      rankingMode: 'painter-friendly-balanced',
    }, 12);

    expect(ranked[0]?.mixStrategy.join(' ')).toMatch(/Build the green first|Block in the green family/);
    expect(ranked[0]?.mixStrategy[0]).not.toMatch(/Start with Mars Black/);
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
    expect(blackBreakdown.requiredHueConstructionPenalty).toBeGreaterThan(0);
    expect(whiteBreakdown.whitePenalty).toBeGreaterThan(0);
  });

  it('does not treat a yellow-gold yellow-plus-blue swatch as staying in the target green family for #18E254', () => {
    const target = analyzeColor('#18E254');
    const predicted = analyzeColor('#C0A61A');
    const targetRgb = hexToRgb('#18E254');
    const predictedRgb = hexToRgb('#C0A61A');
    expect(target && predicted && targetRgb && predictedRgb).toBeTruthy();

    const breakdown = scoreRecipe(
      {
        ...defaultSettings,
        rankingMode: 'painter-friendly-balanced',
      },
      starterPaints,
      target!,
      srgbRgbToLinearRgb(targetRgb!),
      predicted!,
      srgbRgbToLinearRgb(predictedRgb!),
      [
        { paintId: 'paint-cadmium-yellow-medium', percentage: 75, weight: 75 },
        { paintId: 'paint-phthalo-blue', percentage: 25, weight: 25 },
      ],
    );

    expect(breakdown.hasRequiredHueConstructionPath).toBe(true);
    expect(breakdown.staysInTargetHueFamily).toBe(false);
    expect(breakdown.vividTargetSanityPenalty).toBeGreaterThan(0);
  });

  it('does not award Best overall to visibly yellow-gold candidates for vivid green target #18E254', () => {
    const ranked = rankRecipes('#18E254', starterPaints, {
      ...defaultSettings,
      weightStep: 25,
      maxPaintsPerRecipe: 2,
      rankingMode: 'painter-friendly-balanced',
    }, 20);

    const yellowGoldWithConstructionPath = ranked.find((recipe) =>
      recipe.scoreBreakdown.hasRequiredHueConstructionPath &&
      recipe.predictedAnalysis.hueFamily !== 'green',
    );

    expect(yellowGoldWithConstructionPath).toBeTruthy();
    expect(yellowGoldWithConstructionPath?.badges).not.toContain('Best overall');
    expect(ranked.some((recipe) => recipe.badges.includes('Best overall'))).toBe(false);
  });
});
