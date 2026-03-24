import { rankRecipesWithPalettes } from '../../lib/color/mixEngine';
import { normalizeHex } from '../../lib/color/colorMath';
import type { Paint, PaletteComparison, RankedRecipe, UserSettings } from '../../types/models';

export const MIN_GENERATION_DURATION_MS = 400;

export type MixerGeneratedState = {
  generatedHex: string | null;
  recipes: RankedRecipe[];
  comparison: PaletteComparison | null;
};

export type MixerDraftState = MixerGeneratedState & {
  draftHex: string;
  touched: boolean;
  isGenerating: boolean;
};

export const createMixerDraftState = (draftHex: string): MixerDraftState => ({
  draftHex,
  generatedHex: null,
  recipes: [],
  comparison: null,
  touched: false,
  isGenerating: false,
});

export const updateDraftHex = (state: MixerDraftState, draftHex: string): MixerDraftState => ({
  ...state,
  draftHex,
  touched: true,
});

export const hasStaleResults = (draftHex: string, generatedHex: string | null): boolean => {
  if (!generatedHex) {
    return false;
  }

  return normalizeHex(draftHex) !== generatedHex;
};

export const canGenerateRecipes = (draftHex: string, enabledPaintCount: number, isGenerating: boolean): boolean =>
  Boolean(normalizeHex(draftHex)) && enabledPaintCount > 0 && !isGenerating;

export const shouldShowInvalidHexMessage = (draftHex: string, touched: boolean): boolean => touched && !normalizeHex(draftHex);

export const generateRecipesFromDraft = async (
  draftHex: string,
  paints: Paint[],
  settings: UserSettings,
  options: {
    minimumDurationMs?: number;
    wait?: (durationMs: number) => Promise<void>;
    now?: () => number;
    limit?: number;
  } = {},
): Promise<MixerGeneratedState | null> => {
  const normalizedHex = normalizeHex(draftHex);
  if (!normalizedHex) {
    return null;
  }

  const minimumDurationMs = options.minimumDurationMs ?? MIN_GENERATION_DURATION_MS;
  const wait = options.wait ?? ((durationMs: number) => new Promise<void>((resolve) => setTimeout(resolve, durationMs)));
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const solved = rankRecipesWithPalettes(normalizedHex, paints, settings, options.limit);
  const recipes = settings.solveMode === 'ideal'
    ? solved.idealResult ? [solved.idealResult] : []
    : solved.onHandResult ? [solved.onHandResult] : [];
  const elapsed = now() - startedAt;
  const remaining = minimumDurationMs - elapsed;

  if (remaining > 0) {
    await wait(remaining);
  }

  return {
    generatedHex: normalizedHex,
    recipes,
    comparison: solved.comparison,
  };
};
