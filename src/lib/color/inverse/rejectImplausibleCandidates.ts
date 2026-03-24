import type { Paint } from '../../../types/models';
import type { CandidateTemplate, TargetProfile } from './types';

export const rejectImplausibleCandidate = (
  template: CandidateTemplate,
  weights: number[],
  paintsById: Map<string, Paint>,
  profile: TargetProfile,
): boolean => {
  const paints = template.paintIds.map((id) => paintsById.get(id)).filter((paint): paint is Paint => Boolean(paint));
  if (paints.length !== template.paintIds.length) return true;

  const blackShare = paints.reduce((sum, paint, index) => (paint.isBlack ? sum + weights[index] : sum), 0);
  const whiteShare = paints.reduce((sum, paint, index) => (paint.isWhite ? sum + weights[index] : sum), 0);
  const earthShare = paints.reduce((sum, paint, index) => (paint.heuristics?.naturalBias === 'earth' ? sum + weights[index] : sum), 0);

  if (profile.isVivid && earthShare > 40) return true;
  if ((profile.isLight || profile.isVeryLight) && blackShare > 0) return true;
  if (profile.isNearBlackChromatic && blackShare > 40) return true;
  if (profile.isDarkNaturalGreen && earthShare === 0) return true;
  if (profile.isDarkEarthWarm && earthShare === 0) return true;
  if (profile.isVivid && whiteShare > 35) return true;

  return false;
};
