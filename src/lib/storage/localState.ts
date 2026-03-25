import type {
  AchievabilityInsight,
  AdjustmentSuggestion,
  AppState,
  ExtractedPaletteColor,
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
  ReferenceSample,
  SessionStatus,
  UserSettings,
} from '../../types/models';
import { normalizeHex } from '../color/colorMath';
import { defaultSettings, starterPaints } from './seedData';
import { createId } from '../utils/id';

// Editable user/session draft state only (projects, current painting workflow, UI choices).
// Locked mixer configurations live in configRegistry.ts under a separate storage key.
const STORAGE_KEY = 'paint-mix-matcher-state';

const rankingModes: RankingMode[] = [
  'strict-closest-color',
  'painter-friendly-balanced',
  'simpler-recipes-preferred',
];

const sessionStatuses: SessionStatus[] = [
  'planning',
  'active',
  'completed',
  'archived',
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const createStarterSession = (): PaintingSession => ({
  id: createId('session'),
  title: 'Untitled painting project',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  status: 'planning',
  notes: 'Build a reference-led palette in Prep, then carry it into Paint.',
  subject: undefined,
  lightingNotes: undefined,
  moodNotes: undefined,
  canvasNotes: undefined,
  referenceImage: undefined,
  extractedCandidatePalette: [],
  sampledColors: [],
  targetOrder: [],
  targets: [],
  activeTargetIds: [],
  pinnedTargetIds: [],
});

const defaultSamplerState = (): AppState['sampler'] => ({
  image: undefined,
  sampleMode: 'average',
  sampleRadius: 4,
  zoom: 10,
  samples: [],
  extractedPalette: [],
  selectedSampleIds: [],
});

const isPaint = (value: unknown): value is Paint => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.hex === 'string'
  );
};

const isRecipe = (value: unknown): value is MixRecipe => {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.targetHex === 'string' &&
    typeof value.predictedHex === 'string' &&
    Array.isArray(value.components)
  );
};

const isRecentColor = (value: unknown): value is RecentColor => {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.hex === 'string' && typeof value.usedAt === 'string';
};

const sanitizeHeuristics = (
  heuristics: PaintHeuristics | undefined,
): PaintHeuristics | undefined => {
  if (!heuristics) {
    return undefined;
  }

  return {
    tintStrength: heuristics.tintStrength,
    naturalBias: heuristics.naturalBias,
    commonUse: Array.isArray(heuristics.commonUse)
      ? heuristics.commonUse
      : undefined,
    dominancePenalty:
      typeof heuristics.dominancePenalty === 'number'
        ? heuristics.dominancePenalty
        : undefined,
    darkeningStrength:
      typeof heuristics.darkeningStrength === 'number'
        ? heuristics.darkeningStrength
        : undefined,
    mutingStrength:
      typeof heuristics.mutingStrength === 'number'
        ? heuristics.mutingStrength
        : undefined,
    chromaRetention:
      typeof heuristics.chromaRetention === 'number'
        ? heuristics.chromaRetention
        : undefined,
    recommendedMaxShare:
      typeof heuristics.recommendedMaxShare === 'number'
        ? heuristics.recommendedMaxShare
        : undefined,
    preferredRole: heuristics.preferredRole,
  };
};

const sanitizeSpectral = (
  spectral: PaintSpectralProfile | undefined,
): PaintSpectralProfile | undefined => {
  if (!spectral) {
    return undefined;
  }

  return {
    baseHex: spectral.baseHex
      ? normalizeHex(spectral.baseHex) ?? undefined
      : undefined,
    tintingStrength:
      typeof spectral.tintingStrength === 'number'
        ? spectral.tintingStrength
        : undefined,
  };
};

const sanitizePaint = (paint: Paint): Paint => ({
  ...paint,
  hex: normalizeHex(paint.hex) ?? '#000000',
  baseHex: paint.baseHex ? normalizeHex(paint.baseHex) ?? undefined : undefined,
  tintingStrength: typeof paint.tintingStrength === 'number' ? paint.tintingStrength : 1,
  isOnHand: typeof paint.isOnHand === 'boolean' ? paint.isOnHand : true,
  isIdealLibrary: typeof paint.isIdealLibrary === 'boolean' ? paint.isIdealLibrary : false,
  heuristics: sanitizeHeuristics(paint.heuristics),
  spectral: sanitizeSpectral(paint.spectral),
});

const sanitizeRecipeComponents = (value: unknown): RecipeComponent[] =>
  Array.isArray(value)
    ? value
        .filter(isObject)
        .map((component) => ({
          paintId:
            typeof component.paintId === 'string'
              ? component.paintId
              : 'unknown-paint',
          weight:
            typeof component.weight === 'number'
              ? component.weight
              : typeof component.percentage === 'number'
                ? component.percentage
                : 0,
          percentage:
            typeof component.percentage === 'number'
              ? component.percentage
              : typeof component.weight === 'number'
                ? component.weight
                : 0,
        }))
    : [];

const sanitizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];

const sanitizeNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : [];

const sanitizeAdjustmentSuggestions = (
  value: unknown,
): AdjustmentSuggestion[] =>
  Array.isArray(value)
    ? value
        .filter(isObject)
        .map((item): AdjustmentSuggestion => ({
          priority:
            item.priority === 'secondary' || item.priority === 'optional'
              ? item.priority
              : 'primary',
          kind:
            item.kind === 'hue' ||
            item.kind === 'temperature' ||
            item.kind === 'chroma' ||
            item.kind === 'muting' ||
            item.kind === 'lightness' ||
            item.kind === 'darkness'
              ? item.kind
              : 'value',
          label:
            typeof item.label === 'string' ? item.label : 'Adjustment',
          detail:
            typeof item.detail === 'string' ? item.detail : '',
        }))
        .filter((item) => item.detail)
    : [];

const defaultScoreBreakdown = (): RecipeScoreBreakdown => ({
  mode: (defaultSettings.rankingMode ?? 'spectral-first'),
  spectralDistance: 0,
  valueDifference: 0,
  hueDifference: 0,
  saturationDifference: 0,
  chromaDifference: 0,
  primaryScore: 0,
  regularizationPenalty: 0,
  regularizationBonus: 0,
  legacyHeuristicPenalty: 0,
  legacyHeuristicBonus: 0,
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
});

const sanitizeScoreBreakdown = (
  value: unknown,
): RecipeScoreBreakdown | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const mode = rankingModes.includes(value.mode as RankingMode)
    ? (value.mode as RankingMode)
    : (defaultSettings.rankingMode ?? 'spectral-first');

  return {
    mode,
    spectralDistance:
      typeof value.spectralDistance === 'number' ? value.spectralDistance : 0,
    valueDifference:
      typeof value.valueDifference === 'number' ? value.valueDifference : 0,
    hueDifference:
      typeof value.hueDifference === 'number' ? value.hueDifference : 0,
    saturationDifference:
      typeof value.saturationDifference === 'number'
        ? value.saturationDifference
        : 0,
    chromaDifference:
      typeof value.chromaDifference === 'number' ? value.chromaDifference : 0,
    primaryScore:
      typeof value.primaryScore === 'number' ? value.primaryScore : 0,
    regularizationPenalty:
      typeof value.regularizationPenalty === 'number' ? value.regularizationPenalty : 0,
    regularizationBonus:
      typeof value.regularizationBonus === 'number' ? value.regularizationBonus : 0,
    legacyHeuristicPenalty:
      typeof value.legacyHeuristicPenalty === 'number' ? value.legacyHeuristicPenalty : 0,
    legacyHeuristicBonus:
      typeof value.legacyHeuristicBonus === 'number' ? value.legacyHeuristicBonus : 0,
    complexityPenalty:
      typeof value.complexityPenalty === 'number' ? value.complexityPenalty : 0,
    hueFamilyPenalty:
      typeof value.hueFamilyPenalty === 'number' ? value.hueFamilyPenalty : 0,
    constructionPenalty:
      typeof value.constructionPenalty === 'number'
        ? value.constructionPenalty
        : 0,
    supportPenalty:
      typeof value.supportPenalty === 'number' ? value.supportPenalty : 0,
    dominancePenalty:
      typeof value.dominancePenalty === 'number' ? value.dominancePenalty : 0,
    neutralizerPenalty:
      typeof value.neutralizerPenalty === 'number'
        ? value.neutralizerPenalty
        : 0,
    blackPenalty:
      typeof value.blackPenalty === 'number' ? value.blackPenalty : 0,
    whitePenalty:
      typeof value.whitePenalty === 'number' ? value.whitePenalty : 0,
    earlyWhitePenalty:
      typeof value.earlyWhitePenalty === 'number' ? value.earlyWhitePenalty : 0,
    singlePaintPenalty:
      typeof value.singlePaintPenalty === 'number'
        ? value.singlePaintPenalty
        : 0,
    naturalMixBonus:
      typeof value.naturalMixBonus === 'number' ? value.naturalMixBonus : 0,
    chromaticPathBonus:
      typeof value.chromaticPathBonus === 'number'
        ? value.chromaticPathBonus
        : 0,
    twoPaintUsabilityBonus:
      typeof value.twoPaintUsabilityBonus === 'number'
        ? value.twoPaintUsabilityBonus
        : 0,
    vividTargetPenalty:
      typeof value.vividTargetPenalty === 'number'
        ? value.vividTargetPenalty
        : 0,
    hasRequiredHueConstructionPath: Boolean(
      value.hasRequiredHueConstructionPath,
    ),
    staysInTargetHueFamily: Boolean(value.staysInTargetHueFamily),
    finalScore: typeof value.finalScore === 'number' ? value.finalScore : 0,
  };
};

const sanitizeAchievability = (
  value: unknown,
): AchievabilityInsight | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  return {
    level:
      value.level === 'limited' || value.level === 'workable'
        ? value.level
        : 'strong',
    headline:
      typeof value.headline === 'string'
        ? value.headline
        : 'Workable with current palette',
    detail: typeof value.detail === 'string' ? value.detail : '',
  };
};


const sanitizeReferenceImageMeta = (value: unknown) => {
  if (!isObject(value)) {
    return undefined;
  }

  return {
    id: typeof value.id === 'string' ? value.id : createId('reference-image'),
    name: typeof value.name === 'string' ? value.name : 'Reference image',
    mimeType: typeof value.mimeType === 'string' ? value.mimeType : 'image/png',
    width: typeof value.width === 'number' ? value.width : undefined,
    height: typeof value.height === 'number' ? value.height : undefined,
    objectUrl: typeof value.objectUrl === 'string' ? value.objectUrl : undefined,
    dataUrl: typeof value.dataUrl === 'string' ? value.dataUrl : undefined,
    addedAt: typeof value.addedAt === 'string' ? value.addedAt : new Date().toISOString(),
  };
};

const sanitizeReferenceSample = (
  value: unknown,
): ReferenceSample | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  return {
    ...(candidate as unknown as ReferenceSample),
    id:
      typeof candidate.id === 'string'
        ? candidate.id
        : createId('sample'),
    hex:
      normalizeHex(
        typeof candidate.hex === 'string' ? candidate.hex : '#000000',
      ) ?? '#000000',
  };
};

const sanitizeExtractedPaletteColor = (
  value: unknown,
): ExtractedPaletteColor | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;

  return {
    ...(candidate as unknown as ExtractedPaletteColor),
    id:
      typeof candidate.id === 'string'
        ? candidate.id
        : createId('palette'),
    hex:
      normalizeHex(
        typeof candidate.hex === 'string' ? candidate.hex : '#000000',
      ) ?? '#000000',
  };
};

const sanitizeRankedRecipe = (value: unknown): RankedRecipe | undefined => {
  if (!isObject(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const targetAnalysis = candidate.targetAnalysis as RankedRecipe['targetAnalysis'];
  const predictedAnalysis =
    candidate.predictedAnalysis as RankedRecipe['predictedAnalysis'];

  const targetHex =
    isObject(targetAnalysis) && typeof targetAnalysis.normalizedHex === 'string'
      ? targetAnalysis.normalizedHex
      : '#000000';

  const predictedHex =
    typeof candidate.predictedHex === 'string'
      ? normalizeHex(candidate.predictedHex) ?? '#000000'
      : '#000000';

  return {
    id:
      typeof candidate.id === 'string'
        ? candidate.id
        : `recipe-${targetHex.slice(1)}-${predictedHex.slice(1)}`,
    predictedHex,
    distanceScore:
      typeof candidate.distanceScore === 'number' ? candidate.distanceScore : 0,
    components: sanitizeRecipeComponents(candidate.components),
    exactParts: sanitizeNumberArray(candidate.exactParts),
    exactPercentages: sanitizeNumberArray(candidate.exactPercentages),
    exactRatioText:
      typeof candidate.exactRatioText === 'string'
        ? candidate.exactRatioText
        : '',
    practicalParts: sanitizeNumberArray(candidate.practicalParts),
    practicalPercentages: sanitizeNumberArray(candidate.practicalPercentages),
    practicalRatioText:
      typeof candidate.practicalRatioText === 'string'
        ? candidate.practicalRatioText
        : '',
    parts: sanitizeNumberArray(candidate.parts),
    ratioText:
      typeof candidate.ratioText === 'string'
        ? candidate.ratioText
        : typeof candidate.practicalRatioText === 'string'
          ? candidate.practicalRatioText
          : '',
    recipeText:
      typeof candidate.recipeText === 'string' ? candidate.recipeText : '',
    scoreBreakdown:
      sanitizeScoreBreakdown(candidate.scoreBreakdown) ??
      defaultScoreBreakdown(),
    qualityLabel:
      candidate.qualityLabel === 'Strong starting point' ||
      candidate.qualityLabel === 'Usable starting point' ||
      candidate.qualityLabel === 'Rough direction only'
        ? candidate.qualityLabel
        : 'Excellent spectral starting point',
    badges: Array.isArray(candidate.badges)
      ? candidate.badges.filter(
          (badge): badge is RankedRecipe['badges'][number] =>
            typeof badge === 'string',
        )
      : [],
    guidanceText: sanitizeStringArray(candidate.guidanceText),
    nextAdjustments: sanitizeStringArray(candidate.nextAdjustments),
    detailedAdjustments: sanitizeAdjustmentSuggestions(
      candidate.detailedAdjustments,
    ),
    targetAnalysis,
    predictedAnalysis,
    whyThisRanked: sanitizeStringArray(candidate.whyThisRanked),
    mixStrategy: sanitizeStringArray(candidate.mixStrategy),
    mixPath: Array.isArray(candidate.mixPath)
      ? candidate.mixPath
          .filter(isObject)
          .map((step) => ({
            role:
              step.role === 'hue-build' ||
              step.role === 'support' ||
              step.role === 'refine'
                ? step.role
                : 'base',
            paintId:
              typeof step.paintId === 'string' ? step.paintId : undefined,
            paintName:
              typeof step.paintName === 'string' ? step.paintName : 'Paint',
            instruction:
              typeof step.instruction === 'string' ? step.instruction : '',
          }))
      : [],
    stabilityWarnings: sanitizeStringArray(candidate.stabilityWarnings),
    roleNotes: sanitizeStringArray(candidate.roleNotes),
    achievability:
      sanitizeAchievability(candidate.achievability) ?? {
        level: 'workable',
        headline: 'Workable with current palette',
        detail: '',
      },
    layeringSuggestion:
      typeof candidate.layeringSuggestion === 'string'
        ? candidate.layeringSuggestion
        : undefined,
  };
};

const sanitizeRecipe = (recipe: MixRecipe): MixRecipe => ({
  ...recipe,
  targetHex: normalizeHex(recipe.targetHex) ?? '#000000',
  predictedHex: normalizeHex(recipe.predictedHex) ?? '#000000',
  components: sanitizeRecipeComponents(recipe.components),
  exactParts: sanitizeNumberArray(recipe.exactParts),
  exactPercentages: sanitizeNumberArray(recipe.exactPercentages),
  exactRatioText:
    typeof recipe.exactRatioText === 'string'
      ? recipe.exactRatioText
      : undefined,
  practicalParts: sanitizeNumberArray(recipe.practicalParts),
  practicalPercentages: sanitizeNumberArray(recipe.practicalPercentages),
  practicalRatioText:
    typeof recipe.practicalRatioText === 'string'
      ? recipe.practicalRatioText
      : undefined,
  guidanceText: sanitizeStringArray(recipe.guidanceText),
  nextAdjustments: sanitizeStringArray(recipe.nextAdjustments),
  detailedAdjustments: sanitizeAdjustmentSuggestions(
    recipe.detailedAdjustments,
  ),
  mixPath: Array.isArray(recipe.mixPath) ? recipe.mixPath : undefined,
  stabilityWarnings: sanitizeStringArray(recipe.stabilityWarnings),
  roleNotes: sanitizeStringArray(recipe.roleNotes),
  achievability: sanitizeAchievability(recipe.achievability),
  layeringSuggestion:
    typeof recipe.layeringSuggestion === 'string'
      ? recipe.layeringSuggestion
      : undefined,
  scoreBreakdown: sanitizeScoreBreakdown(recipe.scoreBreakdown),
});

const sanitizeTarget = (value: unknown): PaintingTarget | undefined => {
  if (
    !isObject(value) ||
    typeof value.id !== 'string' ||
    typeof value.label !== 'string' ||
    typeof value.targetHex !== 'string'
  ) {
    return undefined;
  }

  const recipeOptions = Array.isArray(value.recipeOptions)
    ? value.recipeOptions
        .map(sanitizeRankedRecipe)
        .filter((recipe): recipe is RankedRecipe => Boolean(recipe))
    : [];

  const selectedRecipe = sanitizeRankedRecipe(value.selectedRecipe);
  const selectedRecipeId =
    typeof value.selectedRecipeId === 'string'
      ? value.selectedRecipeId
      : selectedRecipe?.id;

  const resolvedSelected =
    recipeOptions.find((recipe) => recipe.id === selectedRecipeId) ??
    selectedRecipe;

  return {
    id: value.id,
    label: value.label.trim() || 'Untitled target',
    targetHex: normalizeHex(value.targetHex) ?? '#000000',
    notes: typeof value.notes === 'string' ? value.notes : undefined,
    area: typeof value.area === 'string' ? value.area : undefined,
    family: typeof value.family === 'string' ? value.family : undefined,
    priority:
      value.priority === 'secondary' || value.priority === 'optional'
        ? value.priority
        : 'primary',
    recipeOptions,
    selectedRecipeId,
    selectedRecipe: resolvedSelected,
    mixStatus:
      value.mixStatus === 'mixed' ||
      value.mixStatus === 'adjusted' ||
      value.mixStatus === 'remix-needed'
        ? value.mixStatus
        : 'not-mixed',
    prepStatus:
      value.prepStatus === 'reviewed' || value.prepStatus === 'locked'
        ? value.prepStatus
        : 'unreviewed',
    tags: sanitizeStringArray(value.tags),
    valueRole:
      value.valueRole === 'highlight' ||
      value.valueRole === 'light' ||
      value.valueRole === 'midtone' ||
      value.valueRole === 'shadow' ||
      value.valueRole === 'accent'
        ? value.valueRole
        : undefined,
  };
};

const sanitizeSession = (value: unknown): PaintingSession | undefined => {
  if (!isObject(value) || typeof value.id !== 'string') {
    return undefined;
  }

  // Support both newer `title` and older `name`
  const rawTitle =
    typeof value.title === 'string'
      ? value.title
      : typeof value.name === 'string'
        ? value.name
        : 'Untitled painting session';

  const targets = Array.isArray(value.targets)
    ? value.targets
        .map(sanitizeTarget)
        .filter((target): target is PaintingTarget => Boolean(target))
    : [];
  const rawExtractedCandidatePalette: unknown[] = Array.isArray((value as Record<string, unknown>).extractedCandidatePalette)
    ? ((value as Record<string, unknown>).extractedCandidatePalette as unknown[])
    : [];
  const rawSampledColors: unknown[] = Array.isArray((value as Record<string, unknown>).sampledColors)
    ? ((value as Record<string, unknown>).sampledColors as unknown[])
    : [];

  const targetIds = new Set(targets.map((target) => target.id));

  const targetOrder = Array.isArray(value.targetOrder)
    ? value.targetOrder.filter(
        (id): id is string => typeof id === 'string' && targetIds.has(id),
      )
    : targets.map((target) => target.id);

  return {
    id: value.id,
    title: rawTitle.trim() || 'Untitled painting session',
    createdAt:
      typeof value.createdAt === 'string'
        ? value.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof value.updatedAt === 'string'
        ? value.updatedAt
        : new Date().toISOString(),
    status: sessionStatuses.includes(value.status as SessionStatus)
      ? (value.status as SessionStatus)
      : 'planning',
    notes:
      typeof value.notes === 'string'
        ? value.notes
        : typeof value.description === 'string'
          ? value.description
          : undefined,
    subject: typeof value.subject === 'string' ? value.subject : undefined,
    lightingNotes:
      typeof value.lightingNotes === 'string'
        ? value.lightingNotes
        : undefined,
    moodNotes:
      typeof value.moodNotes === 'string' ? value.moodNotes : undefined,
    canvasNotes:
      typeof value.canvasNotes === 'string' ? value.canvasNotes : undefined,
    referenceImage: sanitizeReferenceImageMeta((value as Record<string, unknown>).referenceImage),
    extractedCandidatePalette: rawExtractedCandidatePalette
      .map(sanitizeExtractedPaletteColor)
      .filter((color): color is ExtractedPaletteColor => Boolean(color)),
    sampledColors: rawSampledColors
      .map(sanitizeReferenceSample)
      .filter((sample): sample is ReferenceSample => Boolean(sample)),
    targetOrder:
      targetOrder.length > 0
        ? [...new Set([...targetOrder, ...targets.map((target) => target.id)])]
        : targets.map((target) => target.id),
    targets,
    activeTargetIds: Array.isArray(value.activeTargetIds)
      ? value.activeTargetIds.filter(
          (id): id is string => typeof id === 'string' && targetIds.has(id),
        )
      : [],
    pinnedTargetIds: Array.isArray(value.pinnedTargetIds)
      ? value.pinnedTargetIds.filter(
          (id): id is string => typeof id === 'string' && targetIds.has(id),
        )
      : [],
  };
};

export const sanitizeSettings = (
  settings: Partial<UserSettings> | undefined,
): UserSettings => ({
  weightStep: settings?.weightStep === 5 ? 5 : 10,
  maxPaintsPerRecipe:
    settings?.maxPaintsPerRecipe === 1 ||
    settings?.maxPaintsPerRecipe === 2 ||
    settings?.maxPaintsPerRecipe === 3
      ? settings.maxPaintsPerRecipe
      : defaultSettings.maxPaintsPerRecipe,
  showPercentages:
    settings?.showPercentages ?? defaultSettings.showPercentages,
  showPartsRatios:
    settings?.showPartsRatios ?? defaultSettings.showPartsRatios,
  solveMode: settings?.solveMode === 'ideal' ? 'ideal' : 'on-hand',
  rankingMode: rankingModes.includes(settings?.rankingMode as RankingMode)
    ? (settings?.rankingMode as RankingMode)
    : 'spectral-first',
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

export const loadAppState = (
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): AppState => {
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

    const sessions =
      Array.isArray(parsed.sessions) && parsed.sessions.length > 0
        ? parsed.sessions
            .map(sanitizeSession)
            .filter((session): session is PaintingSession => Boolean(session))
        : fallback.sessions;

    const legacyActiveSessionId = (parsed as Record<string, unknown>).activeSessionId;
    const requestedSessionId =
      typeof parsed.currentSessionId === 'string'
        ? parsed.currentSessionId
        : typeof legacyActiveSessionId === 'string'
          ? legacyActiveSessionId
          : null;

    const currentSessionId =
      requestedSessionId &&
      sessions.some((session) => session.id === requestedSessionId)
        ? requestedSessionId
        : sessions[0]?.id ?? null;

    const sampler = isObject(parsed.sampler)
      ? {
          ...defaultSamplerState(),
          ...parsed.sampler,
          image: parsed.sampler.image,
          samples: Array.isArray(parsed.sampler.samples)
            ? parsed.sampler.samples
                .map(sanitizeReferenceSample)
                .filter(
                  (sample): sample is ReferenceSample => Boolean(sample),
                )
            : [],
          extractedPalette: Array.isArray(parsed.sampler.extractedPalette)
            ? parsed.sampler.extractedPalette
                .map(sanitizeExtractedPaletteColor)
                .filter(
                  (color): color is ExtractedPaletteColor => Boolean(color),
                )
            : [],
          selectedSampleIds: Array.isArray(parsed.sampler.selectedSampleIds)
            ? parsed.sampler.selectedSampleIds.filter(
                (id): id is string => typeof id === 'string',
              )
            : [],
        }
      : defaultSamplerState();

    const migratedSessions = sessions.map((session) => {
      if (session.referenceImage || session.extractedCandidatePalette.length > 0 || session.sampledColors.length > 0) {
        return session;
      }
      if (currentSessionId !== session.id) {
        return session;
      }
      return {
        ...session,
        referenceImage: session.referenceImage ?? sampler.image,
        extractedCandidatePalette:
          session.extractedCandidatePalette.length > 0
            ? session.extractedCandidatePalette
            : sampler.extractedPalette,
        sampledColors:
          session.sampledColors.length > 0 ? session.sampledColors : sampler.samples,
      };
    });

    return {
      paints: Array.isArray(parsed.paints)
        ? parsed.paints.filter(isPaint).map(sanitizePaint)
        : fallback.paints,
      recipes: Array.isArray(parsed.recipes)
        ? parsed.recipes.filter(isRecipe).map(sanitizeRecipe)
        : fallback.recipes,
      recentTargetColors: Array.isArray(parsed.recentTargetColors)
        ? parsed.recentTargetColors.filter(isRecentColor).slice(0, 8)
        : fallback.recentTargetColors,
      settings: sanitizeSettings(parsed.settings),
      sessions: migratedSessions,
      currentSessionId,
      sampler,
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
