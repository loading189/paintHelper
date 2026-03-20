import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Paint, RankedRecipe } from '../../types/models';
import { RecipeCard } from './RecipeCard';

const paints: Paint[] = [
  { id: 'paint-a', name: 'Cadmium Yellow Medium', hex: '#F2BC1B', isEnabled: true, isWhite: false, isBlack: false },
  { id: 'paint-b', name: 'Ultramarine Blue', hex: '#374AA5', isEnabled: true, isWhite: false, isBlack: false },
];

const recipe: RankedRecipe = {
  id: 'recipe-1',
  predictedHex: '#80916A',
  distanceScore: 0.12,
  components: [
    { paintId: 'paint-a', weight: 85, percentage: 85 },
    { paintId: 'paint-b', weight: 15, percentage: 15 },
  ],
  exactParts: [17, 3],
  exactPercentages: [85, 15],
  exactRatioText: '17:3',
  practicalParts: [6, 1],
  practicalPercentages: [86, 14],
  practicalRatioText: '6:1',
  parts: [6, 1],
  ratioText: '6:1',
  recipeText: '6 parts Cadmium Yellow Medium + 1 part Ultramarine Blue',
  scoreBreakdown: {
    mode: 'painter-friendly-balanced',
    spectralDistance: 0.1,
    valueDifference: 0.03,
    hueDifference: 0.02,
    saturationDifference: 0.02,
    chromaDifference: 0.01,
    complexityPenalty: 0.01,
    hueFamilyPenalty: 0,
    constructionPenalty: 0,
    supportPenalty: 0,
    dominancePenalty: 0,
    neutralizerPenalty: 0,
    blackPenalty: 0,
    whitePenalty: 0,
    earlyWhitePenalty: 0,
    singlePaintPenalty: 0,
    naturalMixBonus: 0,
    chromaticPathBonus: 0.05,
    twoPaintUsabilityBonus: 0.016,
    vividTargetPenalty: 0,
    hasRequiredHueConstructionPath: true,
    staysInTargetHueFamily: true,
    finalScore: 0.12,
  },
  qualityLabel: 'Excellent spectral starting point',
  badges: ['Best overall'],
  guidanceText: ['Start with the practical 6:1 pile, then adjust in small knife-tip increments.'],
  nextAdjustments: ['Add a small touch more Ultramarine Blue to cool the green.'],
  detailedAdjustments: [{ priority: 'primary', kind: 'temperature', label: 'Too warm', detail: 'Add a small touch more Ultramarine Blue to cool the green.' }],
  targetAnalysis: {
    normalizedHex: '#80916A',
    rgb: { r: 128, g: 145, b: 106 },
    value: 0.5,
    valueClassification: 'mid',
    hue: 80,
    hueFamily: 'green',
    saturation: 0.3,
    saturationClassification: 'muted',
    chroma: 0.2,
  },
  predictedAnalysis: {
    normalizedHex: '#80916A',
    rgb: { r: 128, g: 145, b: 106 },
    value: 0.5,
    hue: 80,
    hueFamily: 'green',
    saturation: 0.3,
    saturationClassification: 'muted',
    chroma: 0.2,
    valueClassification: 'mid',
  },
  whyThisRanked: ['Spectral prediction lands close overall, not just in flat RGB.'],
  mixStrategy: ['Use 6:1 as the first palette pile guide.'],
  mixPath: [{ role: 'base', paintId: 'paint-a', paintName: 'Cadmium Yellow Medium', instruction: 'Start with Cadmium Yellow Medium as the base pile.' }],
  stabilityWarnings: ['Cadmium Yellow Medium is dominant here; tiny additions will shift hue quickly.'],
  roleNotes: ['Cadmium Yellow Medium is part of the hue-building path.'],
  achievability: { level: 'strong', headline: 'Strongly achievable with current palette', detail: 'The current on-hand palette can reach this target cleanly enough to use the recipe directly as a working studio start.' },
  layeringSuggestion: undefined,
};

describe('RecipeCard', () => {
  it('renders practical percentages that agree with the displayed practical ratio', () => {
    const markup = renderToStaticMarkup(
      <RecipeCard rank={1} recipe={recipe} paints={paints} showPercentages showPartsRatios onSave={() => undefined} />,
    );

    expect(markup).toContain('Practical ratio');
    expect(markup).toContain('6:1');
    expect(markup).toContain('86%');
    expect(markup).toContain('14%');
    expect(markup).toContain('Exact percentages: 85% · 15%');
  });

  it('renders comparison, adjustment, and reasoning sections for the redesigned card', () => {
    const markup = renderToStaticMarkup(
      <RecipeCard rank={1} recipe={recipe} paints={paints} showPercentages showPartsRatios onSave={() => undefined} />,
    );

    expect(markup).toContain('Target versus predicted');
    expect(markup).toContain('Difference cue');
    expect(markup).toContain('Next adjustments');
    expect(markup).toContain('Why this ranked');
    expect(markup).toContain('Add a small touch more Ultramarine Blue to cool the green.');
    expect(markup).toContain('Best overall');
  });
});
