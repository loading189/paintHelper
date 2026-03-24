import type { ColorAnalysis, HueFamily, Paint, RankedRecipe, RecipeComponent, RecipeScoreBreakdown } from '../../../types/models';

export type CandidateFamilyId =
  | 'yellow-light-clean'
  | 'yellow-light-warm'
  | 'yellow-green-clean'
  | 'yellow-green-earth'
  | 'dark-earth-warm'
  | 'dark-natural-green-earth'
  | 'near-black-chromatic-green'
  | 'cool-muted-neutral'
  | 'olive-muted-dark'
  | 'blue-violet-boundary'
  | 'deep-chromatic-dark'
  | 'light-warm-muted'
  | 'general-hue-build';

export type TargetProfile = {
  hueFamily: HueFamily;
  valueBand: 'very light' | 'light' | 'mid' | 'dark' | 'very dark';
  saturationBand: 'muted' | 'moderate' | 'vivid';
  isDark: boolean;
  isVeryDark: boolean;
  isLight: boolean;
  isVeryLight: boolean;
  isMuted: boolean;
  isVivid: boolean;
  isNearBoundary: boolean;
  isNearNeutral: boolean;
  isNearBlackChromatic: boolean;
  isDarkNaturalGreen: boolean;
  isDarkEarthWarm: boolean;
  needsWhiteLikely: boolean;
  needsDarkenerLikely: boolean;
  likelyFamilyIds: CandidateFamilyId[];
};

export type CandidateTemplate = {
  familyId: CandidateFamilyId;
  paintIds: string[];
};

export type TargetGapMetrics = {
  spectralDistance: number;
  valueDifference: number;
  hueDifference: number;
  chromaDifference: number;
};

export type CandidateStructureMeta = {
  paintCount: number;
  ratioComplexity: number;
  hasWhite: boolean;
  hasBlack: boolean;
  hasEarth: boolean;
};

export type EvaluatedCandidate = {
  familyId: CandidateFamilyId;
  recipe: RecipeComponent[];
  predictedHex: string;
  predictedAnalysis: ColorAnalysis;
  targetGaps: TargetGapMetrics;
  structure: CandidateStructureMeta;
  scoreBreakdown: RecipeScoreBreakdown;
  exactParts: number[];
  practicalParts: number[];
};

export type SolveTargetResult = {
  targetAnalysis: ColorAnalysis;
  profile: TargetProfile;
  candidates: EvaluatedCandidate[];
  rankedRecipes: RankedRecipe[];
  familyBeamCounts: Partial<Record<CandidateFamilyId, number>>;
};

export type InversePhaseContext = {
  paints: Paint[];
  targetAnalysis: ColorAnalysis;
  profile: TargetProfile;
};
