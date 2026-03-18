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
  | 'Strong spectral starting point'
  | 'Usable spectral starting point'
  | 'Needs hand-tuning';
export type RecipeBadge =
  | 'Best overall'
  | 'Best hue path'
  | 'Simplest'
  | 'Best value setup'
  | 'Muted naturally'
  | 'Chromatic build'
  | 'Single-paint shortcut';

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
  singlePaintPenalty: number;
  naturalMixBonus: number;
  chromaticPathBonus: number;
  vividTargetPenalty: number;
  hasRequiredHueConstructionPath: boolean;
  staysInTargetHueFamily: boolean;
  finalScore: number;
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
  scoreBreakdown?: RecipeScoreBreakdown;
  exactParts?: number[];
  exactRatioText?: string;
  practicalParts?: number[];
  practicalRatioText?: string;
  recipeText?: string;
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

export type AppState = {
  paints: Paint[];
  recipes: MixRecipe[];
  recentTargetColors: RecentColor[];
  settings: UserSettings;
};

export type RankedRecipe = {
  predictedHex: string;
  distanceScore: number;
  components: RecipeComponent[];
  exactParts: number[];
  exactRatioText: string;
  practicalParts: number[];
  practicalRatioText: string;
  parts: number[];
  ratioText: string;
  recipeText: string;
  scoreBreakdown: RecipeScoreBreakdown;
  qualityLabel: RecipeQualityLabel;
  badges: RecipeBadge[];
  guidanceText: string[];
  targetAnalysis: ColorAnalysis;
  predictedAnalysis: ColorAnalysis;
  whyThisRanked: string[];
  mixStrategy: string[];
};
