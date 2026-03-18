import type {
  AppState,
  MixRecipe,
  Paint,
  PaintHeuristics,
  RankingMode,
  RecentColor,
  UserSettings,
} from '../../types/models';
import { normalizeHex } from '../color/colorMath';
import { defaultSettings, starterPaints } from './seedData';

const STORAGE_KEY = 'paint-mix-matcher-state';
const rankingModes: RankingMode[] = [
  'strict-closest-color',
  'painter-friendly-balanced',
  'simpler-recipes-preferred',
];

const isPaint = (value: unknown): value is Paint => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.hex === 'string';
};

const isRecipe = (value: unknown): value is MixRecipe => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.targetHex === 'string' &&
    typeof candidate.predictedHex === 'string' &&
    Array.isArray(candidate.components)
  );
};

const isRecentColor = (value: unknown): value is RecentColor => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.hex === 'string' && typeof candidate.usedAt === 'string';
};

const sanitizeHeuristics = (heuristics: PaintHeuristics | undefined): PaintHeuristics | undefined => {
  if (!heuristics) {
    return undefined;
  }

  return {
    tintStrength: heuristics.tintStrength,
    naturalBias: heuristics.naturalBias,
    commonUse: Array.isArray(heuristics.commonUse) ? heuristics.commonUse : undefined,
    dominancePenalty: typeof heuristics.dominancePenalty === 'number' ? heuristics.dominancePenalty : undefined,
  };
};

const sanitizePaint = (paint: Paint): Paint => ({
  ...paint,
  hex: normalizeHex(paint.hex) ?? '#000000',
  heuristics: sanitizeHeuristics(paint.heuristics),
});

export const sanitizeSettings = (settings: Partial<UserSettings> | undefined): UserSettings => ({
  weightStep: settings?.weightStep === 5 ? 5 : 10,
  maxPaintsPerRecipe:
    settings?.maxPaintsPerRecipe === 1 || settings?.maxPaintsPerRecipe === 2 || settings?.maxPaintsPerRecipe === 3
      ? settings.maxPaintsPerRecipe
      : defaultSettings.maxPaintsPerRecipe,
  showPercentages: settings?.showPercentages ?? defaultSettings.showPercentages,
  showPartsRatios: settings?.showPartsRatios ?? defaultSettings.showPartsRatios,
  rankingMode: rankingModes.includes(settings?.rankingMode as RankingMode)
    ? (settings?.rankingMode as RankingMode)
    : defaultSettings.rankingMode,
  singlePaintPenaltySettings: {
    discourageBlackOnlyMatches:
      settings?.singlePaintPenaltySettings?.discourageBlackOnlyMatches ??
      defaultSettings.singlePaintPenaltySettings.discourageBlackOnlyMatches,
    discourageWhiteOnlyMatches:
      settings?.singlePaintPenaltySettings?.discourageWhiteOnlyMatches ??
      defaultSettings.singlePaintPenaltySettings.discourageWhiteOnlyMatches,
    favorMultiPaintMixesWhenClose:
      settings?.singlePaintPenaltySettings?.favorMultiPaintMixesWhenClose ??
      defaultSettings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose,
  },
});

export const getInitialState = (): AppState => ({
  paints: starterPaints,
  recipes: [],
  recentTargetColors: [],
  settings: defaultSettings,
});

export const loadAppState = (storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage): AppState => {
  const fallback = getInitialState();

  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      paints: Array.isArray(parsed.paints) ? parsed.paints.filter(isPaint).map(sanitizePaint) : fallback.paints,
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes.filter(isRecipe) : fallback.recipes,
      recentTargetColors: Array.isArray(parsed.recentTargetColors)
        ? parsed.recentTargetColors.filter(isRecentColor).slice(0, 8)
        : fallback.recentTargetColors,
      settings: sanitizeSettings(parsed.settings),
    };
  } catch {
    return fallback;
  }
};

export const saveAppState = (
  state: AppState,
  storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage,
): void => {
  if (!storage) {
    return;
  }

  storage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const storageKey = STORAGE_KEY;
