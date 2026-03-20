import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ActivePaintingPage } from '../active/ActivePaintingPage';
import { PaintingPrepPage } from './PaintingPrepPage';
import type { PaintingSession, RankedRecipe } from '../../types/models';
import { starterPaints } from '../../lib/storage/seedData';
import { analyzeColor } from '../../lib/color/colorAnalysis';

const recipe: RankedRecipe = {
  id: 'recipe-session',
  predictedHex: '#6E8553',
  distanceScore: 0.18,
  components: [
    { paintId: 'paint-cadmium-yellow-medium', weight: 60, percentage: 60 },
    { paintId: 'paint-ultramarine-blue', weight: 25, percentage: 25 },
    { paintId: 'paint-burnt-umber', weight: 15, percentage: 15 },
  ],
  exactParts: [12, 5, 3],
  exactPercentages: [60, 25, 15],
  exactRatioText: '12:5:3',
  practicalParts: [4, 2, 1],
  practicalPercentages: [57, 29, 14],
  practicalRatioText: '4:2:1',
  parts: [4, 2, 1],
  ratioText: '4:2:1',
  recipeText: '4 parts Cadmium Yellow Medium + 2 parts Ultramarine Blue + 1 part Burnt Umber',
  scoreBreakdown: {
    mode: 'painter-friendly-balanced',
    spectralDistance: 0.14,
    valueDifference: 0.03,
    hueDifference: 0.02,
    saturationDifference: 0.03,
    chromaDifference: 0.02,
    complexityPenalty: 0.02,
    hueFamilyPenalty: 0,
    constructionPenalty: 0,
    supportPenalty: 0.03,
    dominancePenalty: 0.02,
    neutralizerPenalty: 0.01,
    blackPenalty: 0,
    whitePenalty: 0,
    earlyWhitePenalty: 0,
    singlePaintPenalty: 0,
    naturalMixBonus: 0.05,
    chromaticPathBonus: 0.06,
    twoPaintUsabilityBonus: 0,
    vividTargetPenalty: 0,
    hasRequiredHueConstructionPath: true,
    staysInTargetHueFamily: true,
    finalScore: 0.22,
  },
  qualityLabel: 'Strong starting point',
  badges: ['Best overall', 'Muted naturally'],
  guidanceText: ['Start with the practical 4:2:1 pile.'],
  nextAdjustments: ['Lift value with a small amount of Unbleached Titanium.'],
  detailedAdjustments: [{ priority: 'primary', kind: 'lightness', label: 'Too dark', detail: 'Lift value with a small amount of Unbleached Titanium.' }],
  targetAnalysis: analyzeColor('#718645')!,
  predictedAnalysis: analyzeColor('#6E8553')!,
  whyThisRanked: ['Builds hue from the painterly source colors.'],
  mixStrategy: ['Build green first, then mute naturally.'],
  mixPath: [{ role: 'base', paintId: 'paint-cadmium-yellow-medium', paintName: 'Cadmium Yellow Medium', instruction: 'Start with Cadmium Yellow Medium as the base pile.' }],
  stabilityWarnings: ['Burnt Umber is acting mainly as a natural mute in this recipe.'],
  roleNotes: ['Burnt Umber is supporting by muting or deepening the mixture.'],
  achievability: { level: 'workable', headline: 'Workable with some refinement', detail: 'The palette can get close, but expect a short correction pass.' },
  layeringSuggestion: 'Consider establishing Cadmium Yellow Medium first, then glazing in blue influence if needed.',
};

const session: PaintingSession = {
  id: 'session-1',
  title: 'Landscape block-in',
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  status: 'active',
  notes: 'Keep shadow greens restrained.',
  subject: 'Backlit landscape',
  lightingNotes: 'Warm evening light',
  moodNotes: 'Calm and quiet',
  canvasNotes: 'Mid-tone ground',
  targetOrder: ['target-1'],
  activeTargetIds: ['target-1'],
  pinnedTargetIds: ['target-1'],
  targets: [
    {
      id: 'target-1',
      label: 'Tree shadow',
      targetHex: '#718645',
      notes: 'Needs naturalized depth.',
      area: 'Foreground tree mass',
      family: 'Leaf family',
      priority: 'primary',
      recipeOptions: [recipe],
      selectedRecipeId: recipe.id,
      selectedRecipe: recipe,
      mixStatus: 'not-mixed',
      prepStatus: 'locked',
      tags: ['tree', 'shadow'],
      valueRole: 'shadow',
    },
  ],
};

describe('workflow pages', () => {
  it('renders the preparation board with target planning language', () => {
    const markup = renderToStaticMarkup(
      <PaintingPrepPage
        sessions={[session]}
        activeSessionId={session.id}
        paints={starterPaints}
        settings={{
          weightStep: 10,
          maxPaintsPerRecipe: 3,
          showPercentages: true,
          showPartsRatios: true,
          rankingMode: 'painter-friendly-balanced',
          singlePaintPenaltySettings: { discourageBlackOnlyMatches: true, discourageWhiteOnlyMatches: true, favorMultiPaintMixesWhenClose: true },
        }}
        onCreateSession={() => undefined}
        onOpenSession={() => undefined}
        onSessionMetaChange={() => undefined}
        onAddTarget={() => undefined}
        onUpdateTarget={() => undefined}
        onRemoveTarget={() => undefined}
        onGenerateRecipes={() => undefined}
        onSelectRecipe={() => undefined}
        onMoveTarget={() => undefined}
        onToggleActiveTarget={() => undefined}
        onAddGeneratedTargets={() => undefined}
      />,
    );

    expect(markup).toContain('Palette planning board');
    expect(markup).toContain('Generate family');
    expect(markup).toContain('Recipe options');
    expect(markup).toContain('Landscape block-in');
  });

  it('renders the active painting dashboard with large recipe guidance', () => {
    const markup = renderToStaticMarkup(
      <ActivePaintingPage
        sessions={[session]}
        activeSessionId={session.id}
        onOpenSession={() => undefined}
        onStatusChange={() => undefined}
        onMixStatusChange={() => undefined}
        onTogglePin={() => undefined}
        onDuplicateForRemix={() => undefined}
        onOpenInPrep={() => undefined}
      />,
    );

    expect(markup).toContain('Board targets');
    expect(markup).toContain('Practical ratio');
    expect(markup).toContain('Duplicate for remix');
    expect(markup).toContain('Tree shadow');
  });
});
