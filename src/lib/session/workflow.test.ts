import { describe, expect, it } from 'vitest';
import { starterPaints, defaultSettings } from '../storage/seedData';
import { buildAchievabilitySignal, buildDominanceWarnings, buildMixPath, enrichRankedRecipe, generateRecipeForTarget, generateValueVariants, sortTargets } from './workflow';
import type { PaintingTarget, RankedRecipe } from '../../types/models';

const baseTarget: PaintingTarget = {
  id: 'target-1',
  name: 'Olive Midtone',
  hex: '#7A8451',
  role: 'primary',
  priority: 3,
  source: 'manual',
  addedAt: new Date().toISOString(),
  sortIndex: 0,
  mixStatus: 'not-mixed',
  isPinned: false,
};

describe('session workflow helpers', () => {
  it('generates a top recipe with enriched spectral workflow guidance', () => {
    const recipe = generateRecipeForTarget('#7A8451', starterPaints, defaultSettings);
    expect(recipe?.mixPath?.length).toBeGreaterThan(0);
    expect(recipe?.achievability?.summary).toBeTruthy();
    expect(recipe?.nextAdjustments.length).toBeGreaterThan(0);
  });

  it('builds deterministic family and value variations', () => {
    const variants = generateValueVariants(baseTarget);
    expect(variants.map((variant) => variant.name)).toContain('Olive Midtone Highlight');
    expect(variants.map((variant) => variant.name)).toContain('Olive Midtone Shadow');
  });

  it('sorts targets by priority and family without crashing', () => {
    const targets = [
      baseTarget,
      { ...baseTarget, id: 'target-2', name: 'Sky Note', hex: '#7A93C1', role: 'optional' as const, priority: 1, sortIndex: 1 },
    ];
    expect(sortTargets(targets, 'priority')[0].id).toBe('target-1');
    expect(sortTargets(targets, 'family')).toHaveLength(2);
  });

  it('surfaces mix path and dominance warnings for a ranked recipe', () => {
    const recipe = enrichRankedRecipe(generateRecipeForTarget('#4B855B', starterPaints, defaultSettings) as RankedRecipe, starterPaints);
    expect(buildMixPath(recipe, starterPaints)[0]?.title).toContain('Start');
    expect(buildDominanceWarnings(recipe, starterPaints)).toBeDefined();
    expect(buildAchievabilitySignal(recipe).summary).toBeTruthy();
  });
});
