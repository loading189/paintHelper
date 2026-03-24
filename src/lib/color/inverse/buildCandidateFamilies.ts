import type { HueFamily, Paint } from '../../../types/models';
import { analyzeColor } from '../colorAnalysis';
import type { CandidateFamilyId, CandidateTemplate, TargetProfile } from './types';

const getPaintFamily = (paint: Paint): HueFamily => {
  const name = paint.name.toLowerCase();
  if (paint.isBlack || paint.isWhite) return 'neutral';
  if (name.includes('yellow')) return 'yellow';
  if (name.includes('blue')) return 'blue';
  if (name.includes('red') || name.includes('crimson')) return 'red';
  return analyzeColor(paint.hex)?.hueFamily ?? 'neutral';
};

const isEarth = (paint: Paint): boolean => paint.heuristics?.naturalBias === 'earth' && !paint.isWhite;
const isWarmLightener = (paint: Paint): boolean => paint.name.toLowerCase().includes('unbleached titanium');

const pick = (paints: Paint[], predicate: (paint: Paint) => boolean): Paint[] => paints.filter(predicate);

const buildTemplates = (familyId: CandidateFamilyId, groups: Paint[][]): CandidateTemplate[] =>
  groups.map((group) => ({ familyId, paintIds: group.map((paint) => paint.id) }));

const pair = (left: Paint[], right: Paint[]): Paint[][] =>
  left.flatMap((l) => right.filter((r) => r.id !== l.id).map((r) => [l, r]));

const triads = (a: Paint[], b: Paint[], c: Paint[]): Paint[][] =>
  a.flatMap((pa) => b.flatMap((pb) => c.filter((pc) => pc.id !== pa.id && pc.id !== pb.id).map((pc) => [pa, pb, pc])));

export const buildCandidateFamilies = (enabledPaints: Paint[], profile: TargetProfile, maxPaints: number): CandidateTemplate[] => {
  const yellows = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'yellow');
  const blues = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'blue');
  const reds = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'red');
  const whites = pick(enabledPaints, (paint) => paint.isWhite || isWarmLightener(paint));
  const blacks = pick(enabledPaints, (paint) => paint.isBlack);
  const earths = pick(enabledPaints, isEarth);
  const chromatics = pick(enabledPaints, (paint) => !paint.isBlack && !paint.isWhite && paint.heuristics?.naturalBias !== 'neutral');

  const templates: CandidateTemplate[] = [];

  for (const familyId of profile.likelyFamilyIds) {
    switch (familyId) {
      case 'yellow-light-clean':
        templates.push(...buildTemplates(familyId, pair(yellows, whites)));
        break;
      case 'yellow-light-warm':
      case 'light-warm-muted':
        templates.push(...buildTemplates(familyId, triads(yellows, reds, whites)));
        break;
      case 'yellow-green-clean':
        templates.push(...buildTemplates(familyId, pair(yellows, blues)));
        if (maxPaints >= 3 && profile.isNearBoundary) templates.push(...buildTemplates(familyId, triads(yellows, blues, whites)));
        break;
      case 'yellow-green-earth':
      case 'dark-natural-green-earth':
      case 'olive-muted-dark':
        templates.push(...buildTemplates(familyId, triads(yellows, blues, earths)));
        break;
      case 'near-black-chromatic-green':
        templates.push(...buildTemplates(familyId, triads(yellows, earths, blacks)));
        break;
      case 'dark-earth-warm':
        templates.push(...buildTemplates(familyId, triads(reds, yellows, earths)));
        break;
      case 'cool-muted-neutral':
        templates.push(...buildTemplates(familyId, triads(blues, earths, whites)));
        break;
      case 'blue-violet-boundary':
        templates.push(...buildTemplates(familyId, pair(blues, reds)));
        break;
      case 'deep-chromatic-dark':
        templates.push(...buildTemplates(familyId, triads(chromatics, earths.length > 0 ? earths : blacks, blacks)));
        break;
      case 'general-hue-build': {
        const anchors = profile.hueFamily === 'green' ? pair(yellows, blues)
          : profile.hueFamily === 'orange' ? pair(yellows, reds)
            : profile.hueFamily === 'violet' ? pair(blues, reds)
              : profile.hueFamily === 'blue' ? pair(blues, earths.length > 0 ? earths : whites)
                : pair(chromatics, whites.length > 0 ? whites : earths);
        templates.push(...buildTemplates(familyId, anchors));
        break;
      }
      default:
        break;
    }
  }

  const seen = new Set<string>();
  return templates.filter((template) => {
    const ids = [...template.paintIds].sort().join('|');
    const key = `${template.familyId}:${ids}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return template.paintIds.length <= maxPaints;
  });
};
