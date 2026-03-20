import { describe, expect, it } from 'vitest';
import type { RankedRecipe } from '../../types/models';
import { starterPaints } from '../storage/seedData';
import { assessAchievability } from './achievability';
import { generateAdjustmentSuggestions } from './adjustmentEngine';
import { generateColorFamily } from './familyGeneration';
import { buildMixPath, buildStabilityWarnings } from './mixPathEngine';
import { analyzeColor } from './colorAnalysis';
import { generateValueLadder } from './valueRange';

const target = analyzeColor('#18E254')!;
const predicted = analyzeColor('#4CCF6A')!;
const recipe: RankedRecipe = {
  id: 'recipe-green',
  predictedHex: '#4CCF6A',
  distanceScore: 0.22,
  components: [
    { paintId: 'paint-cadmium-yellow-medium', weight: 70, percentage: 70 },
    { paintId: 'paint-phthalo-blue', weight: 20, percentage: 20 },
    { paintId: 'paint-titanium-white', weight: 10, percentage: 10 },
  ],
  exactParts: [7, 2, 1],
  exactPercentages: [70, 20, 10],
  exactRatioText: '7:2:1',
  practicalParts: [4, 1, 1],
  practicalPercentages: [67, 17, 16],
  practicalRatioText: '4:1:1',
  parts: [4, 1, 1],
  ratioText: '4:1:1',
  recipeText: '4 parts Cadmium Yellow Medium + 1 part Phthalo Blue + 1 part Titanium White',
  scoreBreakdown: {
    mode: 'painter-friendly-balanced',
    spectralDistance: 0.16,
    valueDifference: 0.04,
    hueDifference: 0.02,
    saturationDifference: 0.03,
    chromaDifference: 0.02,
    complexityPenalty: 0.02,
    hueFamilyPenalty: 0,
    constructionPenalty: 0,
    supportPenalty: 0.02,
    dominancePenalty: 0.02,
    neutralizerPenalty: 0,
    blackPenalty: 0,
    whitePenalty: 0,
    earlyWhitePenalty: 0.03,
    singlePaintPenalty: 0,
    naturalMixBonus: 0,
    chromaticPathBonus: 0.06,
    twoPaintUsabilityBonus: 0,
    vividTargetPenalty: 0,
    hasRequiredHueConstructionPath: true,
    staysInTargetHueFamily: true,
    finalScore: 0.27,
  },
  qualityLabel: 'Strong starting point',
  badges: ['Chromatic build'],
  guidanceText: [],
  nextAdjustments: [],
  detailedAdjustments: [],
  targetAnalysis: target,
  predictedAnalysis: predicted,
  whyThisRanked: [],
  mixStrategy: [],
  mixPath: [],
  stabilityWarnings: [],
  roleNotes: [],
  achievability: { level: 'workable', headline: 'Workable with some refinement', detail: 'The palette can get close.' },
};

describe('workflow color helpers', () => {
  it('creates deterministic family and value ladder targets', () => {
    const family = generateColorFamily('Leaf', '#5E7F3A', starterPaints, 'Leaf family');
    const ladder = generateValueLadder('#5E7F3A', starterPaints);

    expect(family).toHaveLength(4);
    expect(family[0].label).toContain('highlight');
    expect(ladder.lighterHex).toMatch(/^#/);
    expect(ladder.darkerHex).toMatch(/^#/);
    expect(ladder.mutedHex).toMatch(/^#/);
  });

  it('orders richer next-adjustment suggestions deterministically', () => {
    const suggestions = generateAdjustmentSuggestions(target, predicted, starterPaints, recipe);

    expect(suggestions.map((item) => item.priority)).toEqual(['primary', 'secondary', 'optional']);
    expect(suggestions[0].detail).toContain('Cadmium Yellow Medium');
  });

  it('builds a mix path, warnings, and achievability insight', () => {
    const mixPath = buildMixPath(recipe, starterPaints);
    const warnings = buildStabilityWarnings(recipe, starterPaints);
    const achievability = assessAchievability(recipe, starterPaints);

    expect(mixPath[0].instruction).toContain('Start with');
    expect(warnings.some((warning) => warning.includes('Phthalo Blue'))).toBe(true);
    expect(achievability.headline.length).toBeGreaterThan(0);
  });
});
