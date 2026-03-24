import type { HueFamily } from '../../types/models';
import type { CandidateFamilyId } from './inverse/types';

export type TargetCaseId =
  | 'pale-yellow-clean'
  | 'warm-light-yellow'
  | 'muted-straw'
  | 'yellow-green-boundary'
  | 'olive-mid'
  | 'dark-olive'
  | 'near-black-yellow-green'
  | 'clean-green'
  | 'muted-green'
  | 'dark-natural-green'
  | 'near-black-chromatic-green'
  | 'clean-orange'
  | 'muted-orange'
  | 'deep-orange-red'
  | 'dark-warm-earth'
  | 'clean-red'
  | 'deep-red'
  | 'dusty-violet'
  | 'blue-violet-boundary'
  | 'cool-muted-neutral'
  | 'warm-muted-neutral';

export type TargetCaseSaturationBand = 'muted' | 'moderate' | 'vivid';

export type TargetCaseDefinition = {
  id: TargetCaseId;
  label: string;
  primaryHueFamilies: HueFamily[];
  minHue?: number;
  maxHue?: number;
  minValue?: number;
  maxValue?: number;
  minChroma?: number;
  maxChroma?: number;
  saturationBands?: TargetCaseSaturationBand[];
  requireNearBoundary?: boolean;
  requireNearNeutral?: boolean;
  requireDarkNaturalGreen?: boolean;
  requireNearBlackChromatic?: boolean;
  preferredCandidateFamilies: CandidateFamilyId[];
};

export const TARGET_CASE_LIBRARY: TargetCaseDefinition[] = [
  {
    id: 'pale-yellow-clean',
    label: 'Pale Yellow Clean',
    primaryHueFamilies: ['yellow'],
    minValue: 0.78,
    minChroma: 0.04,
    saturationBands: ['muted', 'moderate'],
    preferredCandidateFamilies: ['yellow-light-clean', 'general-hue-build'],
  },
  {
    id: 'warm-light-yellow',
    label: 'Warm Light Yellow',
    primaryHueFamilies: ['yellow'],
    minValue: 0.72,
    minChroma: 0.05,
    saturationBands: ['moderate'],
    preferredCandidateFamilies: ['yellow-light-warm', 'yellow-light-clean'],
  },
  {
    id: 'muted-straw',
    label: 'Muted Straw',
    primaryHueFamilies: ['yellow'],
    minValue: 0.45,
    maxValue: 0.75,
    minChroma: 0.05,
    maxChroma: 0.12,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['yellow-green-earth', 'general-hue-build'],
  },
  {
    id: 'yellow-green-boundary',
    label: 'Yellow-Green Boundary',
    primaryHueFamilies: ['yellow'],
    minHue: 90,
    maxHue: 120,
    minValue: 0.35,
    maxValue: 0.72,
    minChroma: 0.08,
    saturationBands: ['moderate', 'vivid'],
    preferredCandidateFamilies: ['yellow-green-clean', 'yellow-green-earth'],
  },
  {
    id: 'olive-mid',
    label: 'Olive Mid',
    primaryHueFamilies: ['yellow'],
    minHue: 90,
    maxHue: 120,
    minValue: 0.35,
    maxValue: 0.68,
    minChroma: 0.07,
    maxChroma: 0.16,
    saturationBands: ['muted', 'moderate'],
    preferredCandidateFamilies: ['yellow-green-earth', 'yellow-green-clean', 'olive-muted-dark'],
  },
  {
    id: 'dark-olive',
    label: 'Dark Olive',
    primaryHueFamilies: ['yellow', 'green'],
    minHue: 90,
    maxHue: 125,
    maxValue: 0.38,
    minChroma: 0.03,
    saturationBands: ['muted', 'moderate'],
    preferredCandidateFamilies: ['olive-muted-dark', 'yellow-green-earth', 'near-black-chromatic-green'],
  },
  {
    id: 'near-black-yellow-green',
    label: 'Near-Black Yellow Green',
    primaryHueFamilies: ['yellow', 'green'],
    maxValue: 0.26,
    minChroma: 0.03,
    saturationBands: ['muted', 'moderate'],
    preferredCandidateFamilies: ['near-black-chromatic-green', 'olive-muted-dark', 'deep-chromatic-dark'],
  },
  {
    id: 'clean-green',
    label: 'Clean Green',
    primaryHueFamilies: ['green'],
    minValue: 0.38,
    minChroma: 0.1,
    saturationBands: ['moderate', 'vivid'],
    preferredCandidateFamilies: ['yellow-green-clean', 'general-hue-build'],
  },
  {
    id: 'muted-green',
    label: 'Muted Green',
    primaryHueFamilies: ['green'],
    minValue: 0.32,
    minChroma: 0.05,
    maxChroma: 0.12,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['yellow-green-earth', 'general-hue-build'],
  },
  {
    id: 'dark-natural-green',
    label: 'Dark Natural Green',
    primaryHueFamilies: ['green'],
    maxValue: 0.36,
    minChroma: 0.03,
    saturationBands: ['muted', 'moderate'],
    requireDarkNaturalGreen: true,
    preferredCandidateFamilies: ['dark-natural-green-earth', 'yellow-green-earth'],
  },
  {
    id: 'near-black-chromatic-green',
    label: 'Near-Black Chromatic Green',
    primaryHueFamilies: ['green', 'yellow'],
    maxValue: 0.24,
    minChroma: 0.03,
    saturationBands: ['muted', 'moderate'],
    requireNearBlackChromatic: true,
    preferredCandidateFamilies: ['near-black-chromatic-green', 'dark-natural-green-earth', 'deep-chromatic-dark'],
  },
  {
    id: 'clean-orange',
    label: 'Clean Orange',
    primaryHueFamilies: ['orange'],
    minValue: 0.4,
    minChroma: 0.12,
    saturationBands: ['moderate', 'vivid'],
    preferredCandidateFamilies: ['general-hue-build'],
  },
  {
    id: 'muted-orange',
    label: 'Muted Orange',
    primaryHueFamilies: ['orange'],
    minValue: 0.38,
    minChroma: 0.06,
    maxChroma: 0.12,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['light-warm-muted', 'general-hue-build'],
  },
  {
    id: 'deep-orange-red',
    label: 'Deep Orange Red',
    primaryHueFamilies: ['orange', 'red'],
    maxValue: 0.34,
    minChroma: 0.06,
    saturationBands: ['muted', 'moderate'],
    preferredCandidateFamilies: ['dark-earth-warm', 'deep-chromatic-dark'],
  },
  {
    id: 'dark-warm-earth',
    label: 'Dark Warm Earth',
    primaryHueFamilies: ['yellow', 'orange', 'red'],
    maxValue: 0.3,
    maxChroma: 0.09,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['dark-earth-warm'],
  },
  {
    id: 'clean-red',
    label: 'Clean Red',
    primaryHueFamilies: ['red'],
    minValue: 0.32,
    minChroma: 0.1,
    saturationBands: ['moderate', 'vivid'],
    preferredCandidateFamilies: ['general-hue-build'],
  },
  {
    id: 'deep-red',
    label: 'Deep Red',
    primaryHueFamilies: ['red'],
    maxValue: 0.3,
    minChroma: 0.06,
    saturationBands: ['muted', 'moderate'],
    preferredCandidateFamilies: ['deep-chromatic-dark', 'dark-earth-warm'],
  },
  {
    id: 'dusty-violet',
    label: 'Dusty Violet',
    primaryHueFamilies: ['violet'],
    minValue: 0.25,
    minChroma: 0.05,
    maxChroma: 0.12,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['blue-violet-boundary', 'cool-muted-neutral'],
  },
  {
    id: 'blue-violet-boundary',
    label: 'Blue Violet Boundary',
    primaryHueFamilies: ['blue', 'violet'],
    requireNearBoundary: true,
    minChroma: 0.08,
    saturationBands: ['moderate', 'vivid'],
    preferredCandidateFamilies: ['blue-violet-boundary', 'general-hue-build'],
  },
  {
    id: 'cool-muted-neutral',
    label: 'Cool Muted Neutral',
    primaryHueFamilies: ['neutral', 'blue', 'violet'],
    requireNearNeutral: true,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['cool-muted-neutral'],
  },
  {
    id: 'warm-muted-neutral',
    label: 'Warm Muted Neutral',
    primaryHueFamilies: ['neutral', 'yellow', 'orange', 'red'],
    requireNearNeutral: true,
    saturationBands: ['muted'],
    preferredCandidateFamilies: ['dark-earth-warm', 'cool-muted-neutral'],
  },
];