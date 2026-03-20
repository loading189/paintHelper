import { describe, expect, it } from 'vitest';
import { defaultSettings, starterPaints } from '../../lib/storage/seedData';
import { addTargetToSession, createPaintingSession, duplicateTargetForRemix, generateRecipesForSessionTarget, selectRecipeForTarget, setTargetMixStatus } from './sessionState';

describe('sessionState', () => {
  it('creates a session, adds a target, generates recipes, and locks a selected recipe', () => {
    let session = createPaintingSession({ title: 'Portrait prep' });
    session = addTargetToSession(session, { label: 'Skin midtone', targetHex: '#B7896A', priority: 'primary', valueRole: 'midtone' });

    expect(session.targets).toHaveLength(1);
    const targetId = session.targets[0].id;

    session = generateRecipesForSessionTarget(session, targetId, starterPaints, { ...defaultSettings, weightStep: 25, maxPaintsPerRecipe: 3 }, 4);
    expect(session.targets[0].recipeOptions.length).toBeGreaterThan(0);

    const recipeId = session.targets[0].recipeOptions[0].id;
    session = selectRecipeForTarget(session, targetId, recipeId, true);

    expect(session.targets[0].selectedRecipeId).toBe(recipeId);
    expect(session.targets[0].prepStatus).toBe('locked');
    expect(session.activeTargetIds).toContain(targetId);
  });

  it('tracks active dashboard mix status and can duplicate a target for remix', () => {
    let session = createPaintingSession({ title: 'Still life prep' });
    session = addTargetToSession(session, { label: 'Copper highlight', targetHex: '#BC8355' });
    const targetId = session.targets[0].id;

    session = setTargetMixStatus(session, targetId, 'mixed');
    expect(session.targets[0].mixStatus).toBe('mixed');

    session = duplicateTargetForRemix(session, targetId);
    expect(session.targets).toHaveLength(2);
    expect(session.targets[1].label).toContain('remix');
    expect(session.targets[1].mixStatus).toBe('not-mixed');
  });
});
