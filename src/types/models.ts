export type Opacity = 'transparent' | 'semi-transparent' | 'semi-opaque' | 'opaque';
export type TemperatureBias = 'warm' | 'cool' | 'neutral';

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
};

export type RecipeComponent = {
  paintId: string;
  weight: number;
  percentage: number;
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
};

export type UserSettings = {
  weightStep: number;
  maxPaintsPerRecipe: 1 | 2 | 3;
  showPercentages: boolean;
  showPartsRatios: boolean;
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

export type RankedRecipe = {
  predictedHex: string;
  distanceScore: number;
  components: RecipeComponent[];
  parts: number[];
  ratioText: string;
  recipeText: string;
};
