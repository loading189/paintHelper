import type { Paint } from '../../../types/models';
import { analyzeColor } from '../colorAnalysis';
import type { CandidateTemplate, TargetProfile } from './types';

const getPaintFamily = (paint: Paint): string => {
  const name = paint.name.toLowerCase();

  if (paint.isBlack || paint.isWhite) return 'neutral';
  if (name.includes('yellow')) return 'yellow';
  if (name.includes('green')) return 'green';
  if (name.includes('blue')) return 'blue';
  if (name.includes('red') || name.includes('crimson')) return 'red';
  if (name.includes('violet') || name.includes('purple')) return 'violet';

  return analyzeColor(paint.hex)?.hueFamily ?? 'neutral';
};

const isWarmLightener = (paint: Paint): boolean =>
  paint.name.toLowerCase().includes('unbleached titanium');

const totalWeight = (weights: number[]): number =>
  weights.reduce((sum, weight) => sum + weight, 0);

const shareWhere = (
  paints: Paint[],
  weights: number[],
  predicate: (paint: Paint) => boolean
): number => {
  const total = totalWeight(weights);
  if (total <= 0) return 0;

  const matched = paints.reduce((sum, paint, index) => {
    return predicate(paint) ? sum + (weights[index] ?? 0) : sum;
  }, 0);

  return (matched / total) * 100;
};

export const rejectImplausibleCandidate = (
  template: CandidateTemplate,
  weights: number[],
  paintsById: Map<string, Paint>,
  profile: TargetProfile,
): boolean => {
  const paints = template.paintIds
    .map((id) => paintsById.get(id))
    .filter((paint): paint is Paint => Boolean(paint));

  if (paints.length !== template.paintIds.length) return true;
  if (weights.length !== paints.length) return true;

  const blackShare = shareWhere(paints, weights, (paint) => paint.isBlack);
  const whiteShare = shareWhere(paints, weights, (paint) => paint.isWhite);
  const lightenerShare = shareWhere(
    paints,
    weights,
    (paint) => paint.isWhite || isWarmLightener(paint)
  );
  const earthShare = shareWhere(
    paints,
    weights,
    (paint) => paint.heuristics?.naturalBias === 'earth'
  );

  const greenShare = shareWhere(
    paints,
    weights,
    (paint) => getPaintFamily(paint) === 'green'
  );

  const blueShare = shareWhere(
    paints,
    weights,
    (paint) => getPaintFamily(paint) === 'blue'
  );

  const yellowShare = shareWhere(
    paints,
    weights,
    (paint) => getPaintFamily(paint) === 'yellow'
  );

  const chromaticShare = shareWhere(
    paints,
    weights,
    (paint) =>
      !paint.isBlack &&
      !paint.isWhite &&
      !isWarmLightener(paint) &&
      paint.heuristics?.naturalBias !== 'earth'
  );

  const darkenerShare = blackShare + earthShare;

  const hasGreenPath =
    greenShare > 0 ||
    (yellowShare > 0 && blueShare > 0);

  const hasBlueOrGreenSupport = blueShare > 0 || greenShare > 0;

  if (profile.isVivid && earthShare > 40) return true;
  if ((profile.isLight || profile.isVeryLight) && blackShare > 0) return true;
  if (profile.isNearBlackChromatic && blackShare > 40) return true;
  if (profile.isDarkNaturalGreen && earthShare === 0) return true;
  if (profile.isDarkEarthWarm && earthShare === 0) return true;
  if (profile.isVivid && whiteShare > 35) return true;

  // Protect dark chromatic green / yellow-green targets from neutral collapse.
  const isDarkChromaticGreenTarget =
    (profile.hueFamily === 'green' || profile.isDarkNaturalGreen) &&
    (profile.isDark || profile.isVeryDark) &&
    !profile.isNearNeutral;

  if (isDarkChromaticGreenTarget) {
    if (!hasGreenPath) return true;
    if (darkenerShare > 55) return true;
    if (chromaticShare < 45) return true;
    if (lightenerShare > 10) return true;
  }

  // Protect dark/muted yellow and olive-like targets from drifting into brown soup.
  const isOliveLikeTarget =
    profile.hueFamily === 'yellow' &&
    (profile.isDark || profile.isVeryDark || profile.isMuted) &&
    !profile.isNearNeutral;

  if (isOliveLikeTarget) {
    // These targets need some chromatic support from blue/green, not just earth.
    if (!hasBlueOrGreenSupport && earthShare > 0) {
      return true;
    }

    // Earth + lightener dominance is the exact bad basin we're seeing.
    if (earthShare >= 35 && lightenerShare >= 35) {
      return true;
    }

    // If the whole structure is mostly darkener/lightener with weak chromatic core, reject it.
    if (chromaticShare < 35 && (earthShare + lightenerShare) > 65) {
      return true;
    }

    // Very dark yellow-chromatic targets should not be solved as earth + black only.
    if (profile.isVeryDark && yellowShare > 0 && !hasBlueOrGreenSupport && darkenerShare > 45) {
      return true;
    }
  }

  return false;
};