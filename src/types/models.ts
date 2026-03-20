export type Opacity = 'transparent' | 'semi-transparent' | 'semi-opaque' | 'opaque';
export type TemperatureBias = 'warm' | 'cool' | 'neutral';
export type TintStrength = 'low' | 'medium' | 'high' | 'very-high';
export type NaturalBias = 'earth' | 'chromatic' | 'neutral';
export type CommonUse = 'shadow' | 'neutralizing' | 'tinting' | 'warming' | 'cooling' | 'block-in' | 'glazing';
export type ValueClassification = 'very dark' | 'dark' | 'mid' | 'light' | 'very light';
export type HueFamily = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'neutral';
export type SaturationClassification = 'neutral' | 'muted' | 'moderate' | 'vivid';
export type RankingMode = 'strict-closest-color' | 'painter-friendly-balanced' | 'simpler-recipes-preferred';
export type PreferredRole = 'base' | 'hue-builder' | 'support' | 'neutralizer' | 'lightener';
export type RecipeQualityLabel =
  | 'Excellent spectral starting point'
  | 'Strong starting point'
  | 'Usable starting point'
  | 'Rough direction only';
export type RecipeBadge =
  | 'Best overall'
  | 'Best hue path'
  | 'Simplest'
  | 'Best value setup'
  | 'Muted naturally'
  | 'Chromatic build'
  | 'Single-paint shortcut';
export type WorkspaceView = 'mixer' | 'prep' | 'active' | 'sampler' | 'sessions' | 'paints' | 'recipes';
export type MixStatus = 'not-mixed' | 'mixed' | 'adjusted' | 'remix-needed';
export type TargetRole = 'primary' | 'secondary' | 'optional';
export type TargetSortMode = 'custom' | 'light-to-dark' | 'family' | 'priority';
export type SampleMode = 'pixel' | 'average' | 'smart';

export type SessionStatus = 'planning' | 'active' | 'completed' | 'archived';
export type MixStatus = 'not-mixed' | 'mixed' | 'adjusted' | 'remix-needed';
export type PrepStatus = 'unreviewed' | 'reviewed' | 'locked';
export type TargetPriority = 'primary' | 'secondary' | 'optional';
export type TargetValueRole = 'highlight' | 'light' | 'midtone' | 'shadow' | 'accent';
export type AdjustmentPriority = 'primary' | 'secondary' | 'optional';
export type AdjustmentKind = 'value' | 'hue' | 'temperature' | 'chroma' | 'muting' | 'lightness' | 'darkness';
export type AchievabilityLevel = 'strong' | 'workable' | 'limited';
export type MixPathStepRole = 'base' | 'hue-build' | 'support' | 'refine';

export type PaintHeuristics = {
  tintStrength?: TintStrength;
  naturalBias?: NaturalBias;
  commonUse?: CommonUse[];
  dominancePenalty?: number;
  darkeningStrength?: number;
  mutingStrength?: number;
  chromaRetention?: number;
  recommendedMaxShare?: number;
  preferredRole?: PreferredRole;
};

export type PaintSpectralProfile = {
  baseHex?: string;
  tintingStrength?: number;
};

export type Paint = {
  id: string;
  name: string;
  brand?: string;
  hex: string;
  notes?: string;
  isWhite: boolean;
  isBlack: boolean;
  isEnabled: boolean;
  opacity?: Opacity;
  temperatureBias?: TemperatureBias;
  heuristics?: PaintHeuristics;
  spectral?: PaintSpectralProfile;
};

export type RecipeComponent = {
  paintId: string;
  weight: number;
  percentage: number;
};

export type RgbColor = {
  r: number;
  g: number;
  b: number;
};

export type LinearRgbColor = {
  r: number;
  g: number;
  b: number;
};

export type SpectralMixResult = {
  hex: string;
  rgb: RgbColor;
  oklab: [number, number, number];
  oklch: [number, number, number];
};

export type ColorAnalysis = {
  normalizedHex: string;
  rgb: RgbColor;
  value: number;
  valueClassification: ValueClassification;
  hue: number | null;
  hueFamily: HueFamily;
  saturation: number;
  saturationClassification: SaturationClassification;
  chroma: number;
  oklab?: [number, number, number];
  oklch?: [number, number, number];
};

export type RecipeScoreBreakdown = {
  mode: RankingMode;
  spectralDistance: number;
  valueDifference: number;
  hueDifference: number;
  saturationDifference: number;
  chromaDifference: number;
  complexityPenalty: number;
  hueFamilyPenalty: number;
  constructionPenalty: number;
  supportPenalty: number;
  dominancePenalty: number;
  neutralizerPenalty: number;
  blackPenalty: number;
  whitePenalty: number;
  earlyWhitePenalty: number;
  singlePaintPenalty: number;
  naturalMixBonus: number;
  chromaticPathBonus: number;
  twoPaintUsabilityBonus: number;
  vividTargetPenalty: number;
  hasRequiredHueConstructionPath: boolean;
  staysInTargetHueFamily: boolean;
  finalScore: number;
};

export type MixPathStep = {
  title: string;
  detail: string;
};

export type AchievabilitySignal = {
  level: 'easy' | 'moderate' | 'challenging';
  summary: string;
  detail: string;
};

export type MixWarning = {
  level: 'info' | 'warning';
  text: string;
};

export type MixRecipe = {
  id: string;
  targetHex: string;
  predictedHex: string;
  distanceScore: number;
  components: RecipeComponent[];
  createdAt: string;
  savedName?: string;
  notes?: string;
  rankingMode?: RankingMode;
  qualityLabel?: RecipeQualityLabel;
  guidanceText?: string[];
  nextAdjustments?: string[];
  detailedAdjustments?: AdjustmentSuggestion[];
  scoreBreakdown?: RecipeScoreBreakdown;
  exactParts?: number[];
  exactPercentages?: number[];
  exactRatioText?: string;
  practicalParts?: number[];
  practicalPercentages?: number[];
  practicalRatioText?: string;
  recipeText?: string;
  mixPath?: MixPathStep[];
  stabilityWarnings?: string[];
  roleNotes?: string[];
  achievability?: AchievabilityInsight;
  layeringSuggestion?: string;
};

export type SinglePaintPenaltySettings = {
  discourageBlackOnlyMatches: boolean;
  discourageWhiteOnlyMatches: boolean;
  favorMultiPaintMixesWhenClose: boolean;
};

export type UserSettings = {
  weightStep: number;
  maxPaintsPerRecipe: 1 | 2 | 3;
  showPercentages: boolean;
  showPartsRatios: boolean;
  rankingMode: RankingMode;
  singlePaintPenaltySettings: SinglePaintPenaltySettings;
};

export type RecentColor = {
  hex: string;
  usedAt: string;
};

export type ReferenceImageMeta = {
  id: string;
  name: string;
  mimeType: string;
  width?: number;
  height?: number;
  objectUrl?: string;
  dataUrl?: string;
  addedAt: string;
};

export type ReferenceSample = {
  id: string;
  name: string;
  hex: string;
  point: { x: number; y: number };
  radius: number;
  mode: SampleMode;
  note?: string;
  addedAt: string;
};

export type ExtractedPaletteColor = {
  id: string;
  hex: string;
  population: number;
  label: string;
};

export type ReferenceSamplerState = {
  image?: ReferenceImageMeta;
  sampleMode: SampleMode;
  sampleRadius: number;
  zoom: number;
  samples: ReferenceSample[];
  extractedPalette: ExtractedPaletteColor[];
  selectedSampleIds: string[];
};

export type PaintingTarget = {
  id: string;
  name: string;
  hex: string;
  notes?: string;
  areaTag?: string;
  role: TargetRole;
  priority: number;
  source: 'manual' | 'reference-sample' | 'palette-extraction' | 'family-generator';
  addedAt: string;
  sortIndex: number;
  recipe?: RankedRecipe;
  lockedRecipeId?: string;
  mixStatus: MixStatus;
  isPinned: boolean;
  familyGroup?: string;
  sampleId?: string;
};

export type PaintingSession = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  status: 'planning' | 'active';
  prepNotes?: string;
  referenceImageId?: string;
  targetSortMode: TargetSortMode;
  targets: PaintingTarget[];
};

export type RankedRecipe = {
  id: string;
  predictedHex: string;
  distanceScore: number;
  components: RecipeComponent[];
  exactParts: number[];
  exactPercentages: number[];
  exactRatioText: string;
  practicalParts: number[];
  practicalPercentages: number[];
  practicalRatioText: string;
  parts: number[];
  ratioText: string;
  recipeText: string;
  scoreBreakdown: RecipeScoreBreakdown;
  qualityLabel: RecipeQualityLabel;
  badges: RecipeBadge[];
  guidanceText: string[];
  nextAdjustments: string[];
  detailedAdjustments: AdjustmentSuggestion[];
  targetAnalysis: ColorAnalysis;
  predictedAnalysis: ColorAnalysis;
  whyThisRanked: string[];
  mixStrategy: string[];
  mixPath?: MixPathStep[];
  dominanceWarnings?: MixWarning[];
  achievability?: AchievabilitySignal;
  glazingSuggestion?: string;
};

export type AppState = {
  paints: Paint[];
  recipes: MixRecipe[];
  recentTargetColors: RecentColor[];
  settings: UserSettings;
  sessions: PaintingSession[];
  currentSessionId: string | null;
  sampler: ReferenceSamplerState;
};
