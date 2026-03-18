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
    baseDistance: 0.1,
    valueDifference: 0.03,
    hueDifference: 0.02,
    saturationDifference: 0.02,
    complexityPenalty: 0.01,
    blackPenalty: 0,
    whitePenalty: 0,
    singlePaintPenalty: 0,
    earthToneBonus: 0,
    hueFamilyPenalty: 0,
    requiredHueConstructionPenalty: 0,
    painterFamilyConstructionBonus: 0,
    blackDominancePenalty: 0,
    chromaticPathBonus: 0,
    hasRequiredHueConstructionPath: true,
    staysInTargetHueFamily: true,
    finalScore: 0.12,
  },
  qualityLabel: 'Excellent starting point',
  badges: ['Best overall'],
  guidanceText: ['Start with a practical 6:1 mix, then fine-tune by eye.'],
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
  whyThisRanked: ['Balanced score across color distance, value, hue, and practical mixing complexity.'],
  mixStrategy: ['Use the practical 6:1 ratio as your first pile size guide.'],
};

describe('RecipeCard', () => {
  it('renders the practical ratio instead of an awkward exact one in the main UI', () => {
    const markup = renderToStaticMarkup(
      <RecipeCard rank={1} recipe={recipe} paints={paints} showPercentages showPartsRatios onSave={() => undefined} />,
    );

    expect(markup).toContain('Practical mix');
    expect(markup).toContain('6:1');
    expect(markup).toContain('Rounded from exact 17:3');
    expect(markup).not.toContain('Ratio: 17:3');
  });
});
