import type {
  AchievabilityInsight,
  AdjustmentSuggestion,
  AppState,
  MixRecipe,
  Paint,
  PaintingSession,
  PaintingTarget,
  PaintHeuristics,
  PaintSpectralProfile,
  RankedRecipe,
  RankingMode,
  RecentColor,
  RecipeComponent,
  RecipeScoreBreakdown,
  SessionStatus,
  UserSettings,
} from '../../types/models';
import { normalizeHex } from '../color/colorMath';
import { defaultSettings, starterPaints } from './seedData';

const STORAGE_KEY = 'paint-mix-matcher-state';
const rankingModes: RankingMode[] = ['strict-closest-color', 'painter-friendly-balanced', 'simpler-recipes-preferred'];
const sessionStatuses: SessionStatus[] = ['planning', 'active', 'completed', 'archived'];

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

const isPaint = (value: unknown): value is Paint => {
  if (!isObject(value)) {
    return false;
  }
  return typeof value.id === 'string' && typeof value.name === 'string' && typeof value.hex === 'string';
};

const isRecipe = (value: unknown): value is MixRecipe => {
  if (!isObject(value)) {
    return false;
  }
  return typeof value.id === 'string' && typeof value.targetHex === 'string' && typeof value.predictedHex === 'string' && Array.isArray(value.components);
};

const isRecentColor = (value: unknown): value is RecentColor => {
  if (!isObject(value)) {
    return false;
  }
  return typeof value.hex === 'string' && typeof value.usedAt === 'string';
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

const sanitizeRecipeComponents = (value: unknown): RecipeComponent[] =>
  Array.isArray(value)
    ? value
        .filter(isObject)
        .map((component) => ({
          paintId: typeof component.paintId === 'string' ? component.paintId : 'unknown-paint',
          weight: typeof component.weight === 'number' ? component.weight : typeof component.percentage === 'number' ? component.percentage : 0,
          percentage: typeof component.percentage === 'number' ? component.percentage : typeof component.weight === 'number' ? component.weight : 0,
        }))
    : [];

const sanitizeStringArray = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const sanitizeNumberArray = (value: unknown): number[] => (Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []);

const sanitizeAdjustmentSuggestions = (value: unknown): AdjustmentSuggestion[] =>
  Array.isArray(value)
    ? value
        .filter(isObject)
        .map((item): AdjustmentSuggestion => ({
          priority: item.priority === 'secondary' || item.priority === 'optional' ? item.priority : 'primary',
          kind:
            item.kind === 'hue' || item.kind === 'temperature' || item.kind === 'chroma' || item.kind === 'muting' || item.kind === 'lightness' || item.kind === 'darkness'
              ? item.kind
              : 'value',
          label: typeof item.label === 'string' ? item.label : 'Adjustment',
          detail: typeof item.detail === 'string' ? item.detail : '',
        }))
        .filter((item) => item.detail)
    : [];

const sanitizeScoreBreakdown = (value: unknown): RecipeScoreBreakdown | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  const mode = rankingModes.includes(value.mode as RankingMode) ? (value.mode as RankingMode) : defaultSettings.rankingMode;
  return {
    mode,
    spectralDistance: typeof value.spectralDistance === 'number' ? value.spectralDistance : 0,
    valueDifference: typeof value.valueDifference === 'number' ? value.valueDifference : 0,
    hueDifference: typeof value.hueDifference === 'number' ? value.hueDifference : 0,
    saturationDifference: typeof value.saturationDifference === 'number' ? value.saturationDifference : 0,
    chromaDifference: typeof value.chromaDifference === 'number' ? value.chromaDifference : 0,
    complexityPenalty: typeof value.complexityPenalty === 'number' ? value.complexityPenalty : 0,
    hueFamilyPenalty: typeof value.hueFamilyPenalty === 'number' ? value.hueFamilyPenalty : 0,
    constructionPenalty: typeof value.constructionPenalty === 'number' ? value.constructionPenalty : 0,
    supportPenalty: typeof value.supportPenalty === 'number' ? value.supportPenalty : 0,
    dominancePenalty: typeof value.dominancePenalty === 'number' ? value.dominancePenalty : 0,
    neutralizerPenalty: typeof value.neutralizerPenalty === 'number' ? value.neutralizerPenalty : 0,
    blackPenalty: typeof value.blackPenalty === 'number' ? value.blackPenalty : 0,
    whitePenalty: typeof value.whitePenalty === 'number' ? value.whitePenalty : 0,
    earlyWhitePenalty: typeof value.earlyWhitePenalty === 'number' ? value.earlyWhitePenalty : 0,
    singlePaintPenalty: typeof value.singlePaintPenalty === 'number' ? value.singlePaintPenalty : 0,
    naturalMixBonus: typeof value.naturalMixBonus === 'number' ? value.naturalMixBonus : 0,
    chromaticPathBonus: typeof value.chromaticPathBonus === 'number' ? value.chromaticPathBonus : 0,
    twoPaintUsabilityBonus: typeof value.twoPaintUsabilityBonus === 'number' ? value.twoPaintUsabilityBonus : 0,
    vividTargetPenalty: typeof value.vividTargetPenalty === 'number' ? value.vividTargetPenalty : 0,
    hasRequiredHueConstructionPath: Boolean(value.hasRequiredHueConstructionPath),
    staysInTargetHueFamily: Boolean(value.staysInTargetHueFamily),
    finalScore: typeof value.finalScore === 'number' ? value.finalScore : 0,
  };
};

const sanitizeAchievability = (value: unknown): AchievabilityInsight | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  return {
    level: value.level === 'limited' || value.level === 'workable' ? value.level : 'strong',
    headline: typeof value.headline === 'string' ? value.headline : 'Workable with current palette',
    detail: typeof value.detail === 'string' ? value.detail : '',
  };
};

const sanitizeRankedRecipe = (value: unknown): RankedRecipe | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  const targetHex = typeof value.targetAnalysis === 'object' && value.targetAnalysis && typeof (value.targetAnalysis as Record<string, unknown>).normalizedHex === 'string'
    ? ((value.targetAnalysis as Record<string, unknown>).normalizedHex as string)
    : '#000000';
  const predictedHex = typeof value.predictedHex === 'string' ? normalizeHex(value.predictedHex) ?? '#000000' : '#000000';
  return {
    id: typeof value.id === 'string' ? value.id : `recipe-${targetHex.slice(1)}-${predictedHex.slice(1)}`,
    predictedHex,
    distanceScore: typeof value.distanceScore === 'number' ? value.distanceScore : 0,
    components: sanitizeRecipeComponents(value.components),
    exactParts: sanitizeNumberArray(value.exactParts),
    exactPercentages: sanitizeNumberArray(value.exactPercentages),
    exactRatioText: typeof value.exactRatioText === 'string' ? value.exactRatioText : '',
    practicalParts: sanitizeNumberArray(value.practicalParts),
    practicalPercentages: sanitizeNumberArray(value.practicalPercentages),
    practicalRatioText: typeof value.practicalRatioText === 'string' ? value.practicalRatioText : '',
    parts: sanitizeNumberArray(value.parts),
    ratioText: typeof value.ratioText === 'string' ? value.ratioText : typeof value.practicalRatioText === 'string' ? value.practicalRatioText : '',
    recipeText: typeof value.recipeText === 'string' ? value.recipeText : '',
    scoreBreakdown: sanitizeScoreBreakdown(value.scoreBreakdown) ?? {
      mode: defaultSettings.rankingMode,
      spectralDistance: 0,
      valueDifference: 0,
      hueDifference: 0,
      saturationDifference: 0,
      chromaDifference: 0,
      complexityPenalty: 0,
      hueFamilyPenalty: 0,
      constructionPenalty: 0,
      supportPenalty: 0,
      dominancePenalty: 0,
      neutralizerPenalty: 0,
      blackPenalty: 0,
      whitePenalty: 0,
      earlyWhitePenalty: 0,
      singlePaintPenalty: 0,
      naturalMixBonus: 0,
      chromaticPathBonus: 0,
      twoPaintUsabilityBonus: 0,
      vividTargetPenalty: 0,
      hasRequiredHueConstructionPath: false,
      staysInTargetHueFamily: false,
      finalScore: 0,
    },
    qualityLabel: value.qualityLabel === 'Strong starting point' || value.qualityLabel === 'Usable starting point' || value.qualityLabel === 'Rough direction only' ? value.qualityLabel : 'Excellent spectral starting point',
    badges: Array.isArray(value.badges) ? value.badges.filter((badge): badge is RankedRecipe['badges'][number] => typeof badge === 'string') : [],
    guidanceText: sanitizeStringArray(value.guidanceText),
    nextAdjustments: sanitizeStringArray(value.nextAdjustments),
    detailedAdjustments: sanitizeAdjustmentSuggestions(value.detailedAdjustments),
    targetAnalysis: value.targetAnalysis as RankedRecipe['targetAnalysis'],
    predictedAnalysis: value.predictedAnalysis as RankedRecipe['predictedAnalysis'],
    whyThisRanked: sanitizeStringArray(value.whyThisRanked),
    mixStrategy: sanitizeStringArray(value.mixStrategy),
    mixPath: Array.isArray(value.mixPath) ? value.mixPath.filter(isObject).map((step) => ({ role: step.role === 'hue-build' || step.role === 'support' || step.role === 'refine' ? step.role : 'base', paintId: typeof step.paintId === 'string' ? step.paintId : undefined, paintName: typeof step.paintName === 'string' ? step.paintName : 'Paint', instruction: typeof step.instruction === 'string' ? step.instruction : '' })) : [],
    stabilityWarnings: sanitizeStringArray(value.stabilityWarnings),
    roleNotes: sanitizeStringArray(value.roleNotes),
    achievability: sanitizeAchievability(value.achievability) ?? { level: 'workable', headline: 'Workable with current palette', detail: '' },
    layeringSuggestion: typeof value.layeringSuggestion === 'string' ? value.layeringSuggestion : undefined,
  };
};

const sanitizeRecipe = (recipe: MixRecipe): MixRecipe => ({
  ...recipe,
  targetHex: normalizeHex(recipe.targetHex) ?? '#000000',
  predictedHex: normalizeHex(recipe.predictedHex) ?? '#000000',
  components: sanitizeRecipeComponents(recipe.components),
  exactParts: sanitizeNumberArray(recipe.exactParts),
  exactPercentages: sanitizeNumberArray(recipe.exactPercentages),
  exactRatioText: typeof recipe.exactRatioText === 'string' ? recipe.exactRatioText : undefined,
  practicalParts: sanitizeNumberArray(recipe.practicalParts),
  practicalPercentages: sanitizeNumberArray(recipe.practicalPercentages),
  practicalRatioText: typeof recipe.practicalRatioText === 'string' ? recipe.practicalRatioText : undefined,
  guidanceText: sanitizeStringArray(recipe.guidanceText),
  nextAdjustments: sanitizeStringArray(recipe.nextAdjustments),
  detailedAdjustments: sanitizeAdjustmentSuggestions(recipe.detailedAdjustments),
  mixPath: Array.isArray(recipe.mixPath) ? recipe.mixPath : undefined,
  stabilityWarnings: sanitizeStringArray(recipe.stabilityWarnings),
  roleNotes: sanitizeStringArray(recipe.roleNotes),
  achievability: sanitizeAchievability(recipe.achievability),
  layeringSuggestion: typeof recipe.layeringSuggestion === 'string' ? recipe.layeringSuggestion : undefined,
  scoreBreakdown: sanitizeScoreBreakdown(recipe.scoreBreakdown),
});

const sanitizeTarget = (value: unknown): PaintingTarget | undefined => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.label !== 'string' || typeof value.targetHex !== 'string') {
    return undefined;
  }
  const recipeOptions = Array.isArray(value.recipeOptions) ? value.recipeOptions.map(sanitizeRankedRecipe).filter((recipe): recipe is RankedRecipe => Boolean(recipe)) : [];
  const selectedRecipe = sanitizeRankedRecipe(value.selectedRecipe);
  const selectedRecipeId = typeof value.selectedRecipeId === 'string' ? value.selectedRecipeId : selectedRecipe?.id;
  const resolvedSelected = recipeOptions.find((recipe) => recipe.id === selectedRecipeId) ?? selectedRecipe;

  return {
    id: value.id,
    label: value.label.trim() || 'Untitled target',
    targetHex: normalizeHex(value.targetHex) ?? '#000000',
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    area: typeof value.area === 'string' ? value.area : undefined,
    family: typeof value.family === 'string' ? value.family : undefined,
    priority: value.priority === 'secondary' || value.priority === 'optional' ? value.priority : 'primary',
    recipeOptions,
    selectedRecipeId,
    selectedRecipe: resolvedSelected,
    mixStatus: value.mixStatus === 'mixed' || value.mixStatus === 'adjusted' || value.mixStatus === 'remix-needed' ? value.mixStatus : 'not-mixed',
    prepStatus: value.prepStatus === 'reviewed' || value.prepStatus === 'locked' ? value.prepStatus : 'unreviewed',
    tags: sanitizeStringArray(value.tags),
    valueRole: value.valueRole === 'highlight' || value.valueRole === 'light' || value.valueRole === 'midtone' || value.valueRole === 'shadow' || value.valueRole === 'accent' ? value.valueRole : undefined,
  };
};

const sanitizeSession = (value: unknown): PaintingSession | undefined => {
  if (!isObject(value) || typeof value.id !== 'string' || typeof value.title !== 'string') {
    return undefined;
  }
  const targets = Array.isArray(value.targets) ? value.targets.map(sanitizeTarget).filter((target): target is PaintingTarget => Boolean(target)) : [];
  const targetIds = new Set(targets.map((target) => target.id));
  const targetOrder = Array.isArray(value.targetOrder) ? value.targetOrder.filter((id): id is string => typeof id === 'string' && targetIds.has(id)) : targets.map((target) => target.id);

  return {
    id: value.id,
    title: value.title.trim() || 'Untitled painting session',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    status: sessionStatuses.includes(value.status as SessionStatus) ? (value.status as SessionStatus) : 'planning',
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    subject: typeof value.subject === 'string' ? value.subject : undefined,
    lightingNotes: typeof value.lightingNotes === 'string' ? value.lightingNotes : undefined,
    moodNotes: typeof value.moodNotes === 'string' ? value.moodNotes : undefined,
    canvasNotes: typeof value.canvasNotes === 'string' ? value.canvasNotes : undefined,
    targetOrder: targetOrder.length > 0 ? [...new Set([...targetOrder, ...targets.map((target) => target.id)])] : targets.map((target) => target.id),
    targets,
    activeTargetIds: Array.isArray(value.activeTargetIds) ? value.activeTargetIds.filter((id): id is string => typeof id === 'string' && targetIds.has(id)) : [],
    pinnedTargetIds: Array.isArray(value.pinnedTargetIds) ? value.pinnedTargetIds.filter((id): id is string => typeof id === 'string' && targetIds.has(id)) : [],
  };
};

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

export const getInitialState = (): AppState => ({
  paints: starterPaints,
  recipes: [],
  recentTargetColors: [],
  settings: defaultSettings,
  sessions: [],
  activeSessionId: null,
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
    const sessions = Array.isArray(parsed.sessions) ? parsed.sessions.map(sanitizeSession).filter((session): session is PaintingSession => Boolean(session)) : [];
    const activeSessionId = typeof parsed.activeSessionId === 'string' && sessions.some((session) => session.id === parsed.activeSessionId) ? parsed.activeSessionId : sessions[0]?.id ?? null;

    return {
      paints: Array.isArray(parsed.paints) ? parsed.paints.filter(isPaint).map(sanitizePaint) : fallback.paints,
      recipes: Array.isArray(parsed.recipes) ? parsed.recipes.filter(isRecipe).map(sanitizeRecipe) : fallback.recipes,
      recentTargetColors: Array.isArray(parsed.recentTargetColors) ? parsed.recentTargetColors.filter(isRecentColor).slice(0, 8) : fallback.recentTargetColors,
      settings: sanitizeSettings(parsed.settings),
      sessions,
      activeSessionId,
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
