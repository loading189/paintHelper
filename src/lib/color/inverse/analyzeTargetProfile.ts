import type { ColorAnalysis } from '../../../types/models';
import {
  isBlueVioletBoundaryTarget,
  isCoolMutedNeutralTarget,
  isDarkEarthWarmTarget,
  isDarkNaturalGreenTarget,
  isDarkValueTarget,
  isLightValueTarget,
  isNearBlackChromaticGreenTarget,
  isNearBlackChromaticTarget,
  isOliveGreenTarget,
  isVeryDarkValueTarget,
  isYellowGreenBoundaryTarget,
} from '../colorAnalysis';
import type { CandidateFamilyId, TargetProfile } from './types';

const unique = <T,>(values: T[]): T[] => [...new Set(values)];

export const analyzeTargetProfile = (target: ColorAnalysis): TargetProfile => {
  const likelyFamilyIds: CandidateFamilyId[] = ['general-hue-build'];

  const isVeryDark = isVeryDarkValueTarget(target);
  const isDark = isDarkValueTarget(target);
  const isLight = isLightValueTarget(target);
  const isVeryLight = target.valueClassification === 'very light';

  const isMuted =
    target.saturationClassification === 'muted' ||
    target.saturationClassification === 'neutral';

  const isVivid = target.saturationClassification === 'vivid';

  const isNearBoundary =
    isYellowGreenBoundaryTarget(target) ||
    isBlueVioletBoundaryTarget(target) ||
    target.hueFamily === 'orange';

  /**
   * Important:
   * Very dark colors naturally compress chroma, so a flat chroma threshold
   * can incorrectly classify dark chromatic greens/yellows as "near neutral".
   *
   * We protect clearly chromatic dark targets from being downgraded too early.
   */
  const isDarkOliveCandidate =
    target.hueFamily === 'yellow' &&
    (isDark || isVeryDark) &&
    target.saturationClassification !== 'neutral' &&
    target.chroma >= 0.03;

  const isClearlyChromaticDarkTarget =
    (
      target.hueFamily === 'green' ||
      target.hueFamily === 'yellow' ||
      target.hueFamily === 'blue' ||
      target.hueFamily === 'red' ||
      isDarkNaturalGreenTarget(target) ||
      isNearBlackChromaticTarget(target) ||
      isDarkOliveCandidate
    ) &&
    (isDark || isVeryDark) &&
    target.saturationClassification !== 'neutral';

  const isNearNeutral =
    target.hueFamily === 'neutral' ||
    (!isClearlyChromaticDarkTarget && target.chroma < 0.06);

  const isNearBlackChromatic = isNearBlackChromaticTarget(target);
  const isDarkNaturalGreen = isDarkNaturalGreenTarget(target);
  const isDarkEarthWarm = isDarkEarthWarmTarget(target);

  /**
   * Some dark/muted yellow targets behave more like olive construction
   * problems than pure yellow/orange problems.
   */
  const isDarkOliveLikeYellow =
    target.hueFamily === 'yellow' &&
    (isDark || isVeryDark) &&
    !isNearNeutral &&
    (isMuted || target.chroma >= 0.08);

  /**
   * Very dark chromatic yellows should be allowed to explore green/chromatic-dark
   * families rather than collapsing too quickly into earth/black routes.
   */
  const isVeryDarkChromaticYellow =
    target.hueFamily === 'yellow' &&
    isVeryDark &&
    !isNearNeutral &&
    target.chroma >= 0.08;

  if (isVeryLight && target.hueFamily === 'yellow') {
    likelyFamilyIds.push('yellow-light-clean', 'yellow-light-warm');
  }

  if (target.hueFamily === 'green') {
    likelyFamilyIds.push(isMuted ? 'yellow-green-earth' : 'yellow-green-clean');
  }

  if (isDarkOliveLikeYellow) {
    likelyFamilyIds.push('yellow-green-earth', 'olive-muted-dark');
  }

  if (isDarkNaturalGreen) {
    likelyFamilyIds.push('dark-natural-green-earth');
  }

  if (isNearBlackChromaticGreenTarget(target)) {
    likelyFamilyIds.push('near-black-chromatic-green');
  }

  if (isVeryDarkChromaticYellow) {
    likelyFamilyIds.push('near-black-chromatic-green');
  }

  if (isDarkEarthWarm) {
    likelyFamilyIds.push('dark-earth-warm');
  }

  if (isOliveGreenTarget(target) && isDark) {
    likelyFamilyIds.push('olive-muted-dark');
  }

  if (isCoolMutedNeutralTarget(target)) {
    likelyFamilyIds.push('cool-muted-neutral');
  }

  if (isBlueVioletBoundaryTarget(target)) {
    likelyFamilyIds.push('blue-violet-boundary');
  }

  if (isNearBlackChromatic || (isDark && !isNearNeutral)) {
    likelyFamilyIds.push('deep-chromatic-dark');
  }

  if (isLight && target.hueFamily === 'orange' && isMuted) {
    likelyFamilyIds.push('light-warm-muted');
  }

  return {
    hueFamily: target.hueFamily,
    valueBand: target.valueClassification,
    saturationBand:
      target.saturationClassification === 'neutral'
        ? 'muted'
        : target.saturationClassification,
    isDark,
    isVeryDark,
    isLight,
    isVeryLight,
    isMuted,
    isVivid,
    isNearBoundary,
    isNearNeutral,
    isNearBlackChromatic,
    isDarkNaturalGreen,
    isDarkEarthWarm,
    needsWhiteLikely: isLight || isVeryLight,
    needsDarkenerLikely: isDark || isVeryDark,
    likelyFamilyIds: unique(likelyFamilyIds),
  };
};