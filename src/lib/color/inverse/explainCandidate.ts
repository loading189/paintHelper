import type { EvaluatedCandidate, TargetProfile } from './types';

export const explainCandidate = (candidate: EvaluatedCandidate, profile: TargetProfile): string[] => {
  const lines = [`Family ${candidate.familyId} was selected for this ${profile.valueBand} ${profile.hueFamily} target.`];

  if (candidate.structure.hasEarth) {
    lines.push('Earth support keeps the mix natural and painterly in shadows/muted passages.');
  }
  if (candidate.structure.hasBlack && !profile.isNearBlackChromatic) {
    lines.push('Black is used only as a support darkener, not as the hue source.');
  }
  if (profile.isVeryLight) {
    lines.push('Value lift is handled by white/lightener while preserving hue structure first.');
  }

  lines.push(`Predicted gap: Δspectral ${candidate.targetGaps.spectralDistance.toFixed(3)}.`);
  return lines.slice(0, 4);
};
