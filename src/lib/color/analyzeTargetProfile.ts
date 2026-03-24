import type { ColorAnalysis } from '../../types/models';
import type { TargetProfile } from './inverse/types';
import {
  TARGET_CASE_LIBRARY,
  type TargetCaseDefinition,
  type TargetCaseId,
} from './targetCaseLibrary';

export type MatchedTargetCase = {
  id: TargetCaseId;
  label: string;
  score: number;
  preferredCandidateFamilies: TargetCaseDefinition['preferredCandidateFamilies'];
};

const saturationBandMatches = (
  targetBand: ColorAnalysis['saturationClassification'],
  allowed?: Array<'muted' | 'moderate' | 'vivid'>
): boolean => {
  if (!allowed || allowed.length === 0) return true;
  if (targetBand === 'neutral') return allowed.includes('muted');
  return allowed.includes(targetBand);
};

const hueInRange = (hue: number | null | undefined, minHue?: number, maxHue?: number): boolean => {
  if (hue == null) return true;
  if (minHue === undefined && maxHue === undefined) return true;
  if (minHue === undefined) return hue <= (maxHue as number);
  if (maxHue === undefined) return hue >= minHue;
  return hue >= minHue && hue <= maxHue;
};

const matchesCase = (
  target: ColorAnalysis,
  profile: TargetProfile,
  definition: TargetCaseDefinition
): boolean => {
  if (!definition.primaryHueFamilies.includes(target.hueFamily)) return false;
  if (!hueInRange(target.hue, definition.minHue, definition.maxHue)) return false;

  if (definition.minValue !== undefined && target.value < definition.minValue) return false;
  if (definition.maxValue !== undefined && target.value > definition.maxValue) return false;

  if (definition.minChroma !== undefined && target.chroma < definition.minChroma) return false;
  if (definition.maxChroma !== undefined && target.chroma > definition.maxChroma) return false;

  if (!saturationBandMatches(target.saturationClassification, definition.saturationBands)) {
    return false;
  }

  if (definition.requireNearBoundary && !profile.isNearBoundary) return false;
  if (definition.requireNearNeutral && !profile.isNearNeutral) return false;
  if (definition.requireDarkNaturalGreen && !profile.isDarkNaturalGreen) return false;
  if (definition.requireNearBlackChromatic && !profile.isNearBlackChromatic) return false;

  return true;
};

const scoreCase = (
  target: ColorAnalysis,
  profile: TargetProfile,
  definition: TargetCaseDefinition
): number => {
  let score = 0;

  if (definition.primaryHueFamilies.includes(target.hueFamily)) score += 3;
  if (hueInRange(target.hue, definition.minHue, definition.maxHue)) score += 2;
  if (saturationBandMatches(target.saturationClassification, definition.saturationBands)) score += 2;

  if (definition.minValue !== undefined || definition.maxValue !== undefined) score += 1;
  if (definition.minChroma !== undefined || definition.maxChroma !== undefined) score += 1;

  if (definition.requireNearBoundary && profile.isNearBoundary) score += 2;
  if (definition.requireNearNeutral && profile.isNearNeutral) score += 2;
  if (definition.requireDarkNaturalGreen && profile.isDarkNaturalGreen) score += 3;
  if (definition.requireNearBlackChromatic && profile.isNearBlackChromatic) score += 3;

  return score;
};

export const matchTargetCases = (
  target: ColorAnalysis,
  profile: TargetProfile,
  limit = 3
): MatchedTargetCase[] => {
  return TARGET_CASE_LIBRARY
    .filter((definition) => matchesCase(target, profile, definition))
    .map((definition) => ({
      id: definition.id,
      label: definition.label,
      score: scoreCase(target, profile, definition),
      preferredCandidateFamilies: definition.preferredCandidateFamilies,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
};