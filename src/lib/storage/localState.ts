import type {
  AppState,
  ExtractedPaletteColor,
  MixRecipe,
  Paint,
  PaintingSession,
  PaintingTarget,
  PaintHeuristics,
  PaintSpectralProfile,
  RankingMode,
  RecentColor,
  ReferenceSample,
  UserSettings,
} from '../../types/models';
import { normalizeHex } from '../color/colorMath';
import { defaultSettings, starterPaints } from './seedData';
import { createId } from '../utils/id';

const STORAGE_KEY = 'paint-mix-matcher-state';
const rankingModes: RankingMode[] = ['strict-closest-color', 'painter-friendly-balanced', 'simpler-recipes-preferred'];

const createStarterSession = (): PaintingSession => ({
  id: createId('session'),
  name: 'Studio Session',
  description: 'Plan your reference colors, build recipes, and move into painting mode.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'planning',
  targetSortMode: 'custom',
  targets: [],
});

const defaultSamplerState = () => ({
  image: undefined,
  sampleMode: 'average' as const,
  sampleRadius: 4,
  zoom: 10,
  samples: [] as ReferenceSample[],
  extractedPalette: [] as ExtractedPaletteColor[],
  selectedSampleIds: [] as string[],
});

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
  return typeof candidate.id === 'string' && typeof candidate.targetHex === 'string' && typeof candidate.predictedHex === 'string' && Array.isArray(candidate.components);
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
    darkeningStrength: typeof heuristics.darkeningStrength === 'number' ? heuristics.darkeningStrength : undefined,
    mutingStrength: typeof heuristics.mutingStrength === 'number' ? heuristics.mutingStrength : undefined,
    chromaRetention: typeof heuristics.chromaRetention === 'number' ? heuristics.chromaRetention : undefined,
    recommendedMaxShare: typeof heuristics.recommendedMaxShare === 'number' ? heuristics.recommendedMaxShare : undefined,
    preferredRole: heuristics.preferredRole,
  };
};

const sanitizeSpectral = (spectral: PaintSpectralProfile | undefined): PaintSpectralProfile | undefined => {
  if (!spectral) {
    return undefined;
  }

  return {
    baseHex: spectral.baseHex ? normalizeHex(spectral.baseHex) ?? undefined : undefined,
    tintingStrength: typeof spectral.tintingStrength === 'number' ? spectral.tintingStrength : undefined,
  };
};

const sanitizePaint = (paint: Paint): Paint => ({
  ...paint,
  hex: normalizeHex(paint.hex) ?? '#000000',
  heuristics: sanitizeHeuristics(paint.heuristics),
  spectral: sanitizeSpectral(paint.spectral),
});

const sanitizeRecipe = (recipe: MixRecipe): MixRecipe => ({
  ...recipe,
  targetHex: normalizeHex(recipe.targetHex) ?? '#000000',
  predictedHex: normalizeHex(recipe.predictedHex) ?? '#000000',
  exactParts: Array.isArray(recipe.exactParts) ? recipe.exactParts.filter((part) => typeof part === 'number') : undefined,
  exactPercentages: Array.isArray(recipe.exactPercentages) ? recipe.exactPercentages.filter((part) => typeof part === 'number') : undefined,
  exactRatioText: typeof recipe.exactRatioText === 'string' ? recipe.exactRatioText : undefined,
  practicalParts: Array.isArray(recipe.practicalParts) ? recipe.practicalParts.filter((part) => typeof part === 'number') : undefined,
  practicalPercentages: Array.isArray(recipe.practicalPercentages) ? recipe.practicalPercentages.filter((part) => typeof part === 'number') : undefined,
  practicalRatioText: typeof recipe.practicalRatioText === 'string' ? recipe.practicalRatioText : undefined,
  guidanceText: Array.isArray(recipe.guidanceText) ? recipe.guidanceText.filter((line): line is string => typeof line === 'string') : undefined,
  nextAdjustments: Array.isArray(recipe.nextAdjustments) ? recipe.nextAdjustments.filter((line): line is string => typeof line === 'string') : undefined,
});

export const sanitizeSettings = (settings: Partial<UserSettings> | undefined): UserSettings => ({
  weightStep: settings?.weightStep === 5 ? 5 : 10,
  maxPaintsPerRecipe: settings?.maxPaintsPerRecipe === 1 || settings?.maxPaintsPerRecipe === 2 || settings?.maxPaintsPerRecipe === 3 ? settings.maxPaintsPerRecipe : defaultSettings.maxPaintsPerRecipe,
  showPercentages: settings?.showPercentages ?? defaultSettings.showPercentages,
  showPartsRatios: settings?.showPartsRatios ?? defaultSettings.showPartsRatios,
  rankingMode: rankingModes.includes(settings?.rankingMode as RankingMode) ? (settings?.rankingMode as RankingMode) : defaultSettings.rankingMode,
  singlePaintPenaltySettings: {
    discourageBlackOnlyMatches: settings?.singlePaintPenaltySettings?.discourageBlackOnlyMatches ?? defaultSettings.singlePaintPenaltySettings.discourageBlackOnlyMatches,
    discourageWhiteOnlyMatches: settings?.singlePaintPenaltySettings?.discourageWhiteOnlyMatches ?? defaultSettings.singlePaintPenaltySettings.discourageWhiteOnlyMatches,
    favorMultiPaintMixesWhenClose: settings?.singlePaintPenaltySettings?.favorMultiPaintMixesWhenClose ?? defaultSettings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose,
  },
});

const sanitizeTarget = (target: PaintingTarget, index: number): PaintingTarget => ({
  ...target,
  id: typeof target.id === 'string' ? target.id : createId('target'),
  name: typeof target.name === 'string' ? target.name : `Target ${index + 1}`,
  hex: normalizeHex(target.hex) ?? '#000000',
  role: target.role ?? 'secondary',
  priority: typeof target.priority === 'number' ? target.priority : 1,
  source: target.source ?? 'manual',
  addedAt: typeof target.addedAt === 'string' ? target.addedAt : new Date().toISOString(),
  sortIndex: typeof target.sortIndex === 'number' ? target.sortIndex : index,
  mixStatus: target.mixStatus ?? 'not-mixed',
  isPinned: Boolean(target.isPinned),
  recipe: target.recipe,
});

const sanitizeSession = (session: PaintingSession): PaintingSession => ({
  ...session,
  id: typeof session.id === 'string' ? session.id : createId('session'),
  name: typeof session.name === 'string' ? session.name : 'Studio Session',
  createdAt: typeof session.createdAt === 'string' ? session.createdAt : new Date().toISOString(),
  updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : new Date().toISOString(),
  status: session.status === 'active' ? 'active' : 'planning',
  targetSortMode: session.targetSortMode ?? 'custom',
  targets: Array.isArray(session.targets) ? session.targets.map((target, index) => sanitizeTarget(target, index)) : [],
});

export const getInitialState = (): AppState => {
  const starterSession = createStarterSession();
  return {
    paints: starterPaints,
    recipes: [],
    recentTargetColors: [],
    settings: defaultSettings,
    sessions: [starterSession],
    currentSessionId: starterSession.id,
    sampler: defaultSamplerState(),
  };
};

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
    const sessions = Array.isArray(parsed.sessions) && parsed.sessions.length > 0
      ? parsed.sessions.map((session) => sanitizeSession(session))
      : fallback.sessions;
    const currentSessionId = typeof parsed.currentSessionId === 'string' && sessions.some((session) => session.id === parsed.currentSessionId)
      ? parsed.currentSessionId
      : sessions[0]?.id ?? null;

    return {
      paints: Array.isArray(parsed.paints) ? parsed.paints.filter(isPaint).map(sanitizePaint) : fallback.paints,
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes.filter(isRecipe).map(sanitizeRecipe) : fallback.recipes,
      recentTargetColors: Array.isArray(parsed.recentTargetColors) ? parsed.recentTargetColors.filter(isRecentColor).slice(0, 8) : fallback.recentTargetColors,
      settings: sanitizeSettings(parsed.settings),
      sessions,
      currentSessionId,
      sampler: {
        ...defaultSamplerState(),
        ...(parsed.sampler ?? {}),
        image: parsed.sampler?.image,
        samples: Array.isArray(parsed.sampler?.samples) ? parsed.sampler?.samples : [],
        extractedPalette: Array.isArray(parsed.sampler?.extractedPalette) ? parsed.sampler.extractedPalette : [],
        selectedSampleIds: Array.isArray(parsed.sampler?.selectedSampleIds) ? parsed.sampler.selectedSampleIds.filter((id): id is string => typeof id === 'string') : [],
      },
    };
  } catch {
    return fallback;
  }
};

export const saveAppState = (state: AppState, storage: Pick<Storage, 'setItem'> | undefined = globalThis.localStorage): void => {
  if (!storage) {
    return;
  }
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const storageKey = STORAGE_KEY;
