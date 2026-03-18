import { describe, expect, it, vi } from 'vitest';
import { defaultSettings, starterPaints } from '../../lib/storage/seedData';
import { createMixerDraftState, generateRecipesFromDraft, hasStaleResults, updateDraftHex } from './mixerState';

describe('mixerState', () => {
  it('changing draft input does not auto-generate', () => {
    const initial = {
      ...createMixerDraftState('#7A8FB3'),
      generatedHex: '#7A8FB3',
      recipes: [{ predictedHex: '#000000' } as never],
    };

    const next = updateDraftHex(initial, '#112233');

    expect(next.draftHex).toBe('#112233');
    expect(next.generatedHex).toBe('#7A8FB3');
    expect(next.recipes).toHaveLength(1);
  });

  it('clicking generate uses the draft target to create recipes', async () => {
    const result = await generateRecipesFromDraft('#545F27', starterPaints, defaultSettings, {
      minimumDurationMs: 0,
      wait: vi.fn().mockResolvedValue(undefined),
    });

    expect(result?.generatedHex).toBe('#545F27');
    expect(result?.recipes.length).toBeGreaterThan(0);
  });

  it('shows stale results only after the draft diverges from the generated target', () => {
    expect(hasStaleResults('#7A8FB3', '#7A8FB3')).toBe(false);
    expect(hasStaleResults('#112233', '#7A8FB3')).toBe(true);
  });

  it('does not generate for an invalid hex', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const result = await generateRecipesFromDraft('not-a-hex', starterPaints, defaultSettings, { wait });

    expect(result).toBeNull();
    expect(wait).not.toHaveBeenCalled();
  });

  it('keeps the loading state perceptible with a minimum duration', async () => {
    const wait = vi.fn().mockResolvedValue(undefined);
    const now = vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1010);

    await generateRecipesFromDraft('#7A8FB3', starterPaints, defaultSettings, {
      minimumDurationMs: 400,
      wait,
      now,
      limit: 1,
    });

    expect(wait).toHaveBeenCalledWith(390);
  });
});
