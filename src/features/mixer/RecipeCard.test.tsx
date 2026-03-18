import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Paint, RankedRecipe } from '../../types/models';
import { RecipeCard } from './RecipeCard';

const paints: Paint[] = [
  { id: 'paint-a', name: 'Cadmium Yellow Medium', hex: '#F2BC1B', isEnabled: true, isWhite: false, isBlack: false },
  { id: 'paint-b', name: 'Ultramarine Blue', hex: '#374AA5', isEnabled: true, isWhite: false, isBlack: false },
];

const recipe: RankedRecipe = {
  predictedHex: '#80916A',
  distanceScore: 0.12,
  components: [
    { paintId: 'paint-a', weight: 85, percentage: 85 },
    { paintId: 'paint-b', weight: 15, percentage: 15 },
  ],
  exactParts: [17, 3],
  exactRatioText: '17:3',
  practicalParts: [6, 1],
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
    singlePaintPenalty: 0,
    naturalMixBonus: 0,
    chromaticPathBonus: 0.05,
    vividTargetPenalty: 0,
    hasRequiredHueConstructionPath: true,
    staysInTargetHueFamily: true,
    finalScore: 0.12,
  },
  qualityLabel: 'Excellent spectral starting point',
  badges: ['Best overall'],
  guidanceText: ['Start with the practical 6:1 ratio, then adjust in small pile-size increments.'],
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
    valueClassification: 'mid',
    hue: 80,
    hueFamily: 'green',
    saturation: 0.3,
    saturationClassification: 'muted',
    chroma: 0.2,
  },
  whyThisRanked: ['Spectral prediction lands very close overall, not just in flat RGB.'],
  mixStrategy: ['Use 6:1 as the first palette pile guide.'],
};

describe('RecipeCard', () => {
  it('renders the practical ratio instead of an awkward exact one in the main UI', () => {
    const markup = renderToStaticMarkup(
      <RecipeCard rank={1} recipe={recipe} paints={paints} showPercentages showPartsRatios onSave={() => undefined} />,
    );

    expect(markup).toContain('Practical mixing ratio');
    expect(markup).toContain('6:1');
    expect(markup).toContain('Rounded from exact 17:3');
    expect(markup).toContain('Target family');
    expect(markup).toContain('Predicted family');
  });
});
