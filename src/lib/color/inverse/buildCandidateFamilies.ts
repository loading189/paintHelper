import type { HueFamily, Paint } from '../../../types/models';
import { analyzeColor } from '../colorAnalysis';
import type { CandidateFamilyId, CandidateTemplate, TargetProfile } from './types';

const getPaintFamily = (paint: Paint): HueFamily => {
  const name = paint.name.toLowerCase();

  if (paint.isBlack || paint.isWhite) return 'neutral';
  if (name.includes('yellow')) return 'yellow';
  if (name.includes('green')) return 'green';
  if (name.includes('blue')) return 'blue';
  if (name.includes('red') || name.includes('crimson')) return 'red';
  if (name.includes('violet') || name.includes('purple')) return 'violet';

  return analyzeColor(paint.hex)?.hueFamily ?? 'neutral';
};

const isEarth = (paint: Paint): boolean =>
  paint.heuristics?.naturalBias === 'earth' && !paint.isWhite;

const isWarmLightener = (paint: Paint): boolean =>
  paint.name.toLowerCase().includes('unbleached titanium');

const pick = (paints: Paint[], predicate: (paint: Paint) => boolean): Paint[] =>
  paints.filter(predicate);

const buildTemplates = (
  familyId: CandidateFamilyId,
  groups: Paint[][]
): CandidateTemplate[] =>
  groups.map((group) => ({
    familyId,
    paintIds: group.map((paint) => paint.id),
  }));

const pair = (left: Paint[], right: Paint[]): Paint[][] =>
  left.flatMap((l) =>
    right
      .filter((r) => r.id !== l.id)
      .map((r) => [l, r])
  );

const triads = (a: Paint[], b: Paint[], c: Paint[]): Paint[][] =>
  a.flatMap((pa) =>
    b.flatMap((pb) =>
      c
        .filter((pc) => pc.id !== pa.id && pc.id !== pb.id)
        .map((pc) => [pa, pb, pc])
    )
  );

const quads = (a: Paint[], b: Paint[], c: Paint[], d: Paint[]): Paint[][] =>
  a.flatMap((pa) =>
    b.flatMap((pb) =>
      c.flatMap((pc) =>
        d
          .filter(
            (pd) =>
              pd.id !== pa.id &&
              pd.id !== pb.id &&
              pd.id !== pc.id
          )
          .map((pd) => [pa, pb, pc, pd])
      )
    )
  );

export const buildCandidateFamilies = (
  enabledPaints: Paint[],
  profile: TargetProfile,
  maxPaints: number
): CandidateTemplate[] => {
  const yellows = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'yellow');
  const greens = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'green');
  const blues = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'blue');
  const reds = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'red');
  const violets = pick(enabledPaints, (paint) => getPaintFamily(paint) === 'violet');

  const whites = pick(enabledPaints, (paint) => paint.isWhite || isWarmLightener(paint));
  const blacks = pick(enabledPaints, (paint) => paint.isBlack);
  const earths = pick(enabledPaints, isEarth);

  const chromatics = pick(
    enabledPaints,
    (paint) => !paint.isBlack && !paint.isWhite && paint.heuristics?.naturalBias !== 'neutral'
  );

  const templates: CandidateTemplate[] = [];
  const allowDarkFourPaint =
    maxPaints >= 4 &&
    (profile.isVeryDark || profile.isNearBlackChromatic) &&
    !profile.isNearNeutral;

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
        templates.push(...buildTemplates(familyId, pair(yellows, greens)));

        if (maxPaints >= 3 && profile.isNearBoundary) {
          templates.push(...buildTemplates(familyId, triads(yellows, blues, whites)));
          templates.push(...buildTemplates(familyId, triads(yellows, greens, whites)));
        }

        if (allowDarkFourPaint && blacks.length > 0) {
          templates.push(...buildTemplates(familyId, quads(yellows, blues, earths, blacks)));
          templates.push(...buildTemplates(familyId, quads(yellows, greens, earths, blacks)));
        }
        break;

      case 'yellow-green-earth':
        templates.push(...buildTemplates(familyId, triads(yellows, blues, earths)));
        templates.push(...buildTemplates(familyId, triads(yellows, greens, earths)));

        if (allowDarkFourPaint && blacks.length > 0) {
          templates.push(...buildTemplates(familyId, quads(yellows, blues, earths, blacks)));
          templates.push(...buildTemplates(familyId, quads(yellows, greens, earths, blacks)));
        }
        break;

      case 'dark-natural-green-earth':
      case 'olive-muted-dark':
        templates.push(...buildTemplates(familyId, triads(yellows, blues, earths)));
        templates.push(...buildTemplates(familyId, triads(yellows, greens, earths)));

        if (allowDarkFourPaint && blacks.length > 0) {
          templates.push(...buildTemplates(familyId, quads(yellows, blues, earths, blacks)));
          templates.push(...buildTemplates(familyId, quads(yellows, greens, earths, blacks)));
        }
        break;

      case 'near-black-chromatic-green':
        templates.push(...buildTemplates(familyId, triads(yellows, blues, blacks)));
        templates.push(...buildTemplates(familyId, triads(yellows, greens, blacks)));

        if (earths.length > 0) {
          templates.push(...buildTemplates(familyId, triads(yellows, blues, earths)));
          templates.push(...buildTemplates(familyId, triads(yellows, greens, earths)));
        }

        if (allowDarkFourPaint && earths.length > 0 && blacks.length > 0) {
          templates.push(...buildTemplates(familyId, quads(yellows, blues, earths, blacks)));
          templates.push(...buildTemplates(familyId, quads(yellows, greens, earths, blacks)));
        }
        break;

      case 'dark-earth-warm':
        templates.push(...buildTemplates(familyId, triads(reds, yellows, earths)));
        break;

      case 'cool-muted-neutral':
        templates.push(...buildTemplates(familyId, triads(blues, earths, whites)));
        templates.push(...buildTemplates(familyId, triads(violets, earths, whites)));
        break;

      case 'blue-violet-boundary':
        templates.push(...buildTemplates(familyId, pair(blues, reds)));
        templates.push(...buildTemplates(familyId, pair(blues, violets)));
        break;

      case 'deep-chromatic-dark':
        templates.push(
          ...buildTemplates(
            familyId,
            triads(chromatics, earths.length > 0 ? earths : blacks, blacks)
          )
        );
        break;

      case 'general-hue-build': {
        const anchors =
          profile.hueFamily === 'green'
            ? [
                ...pair(yellows, blues),
                ...pair(yellows, greens),
              ]
            : profile.hueFamily === 'yellow' && profile.isNearBoundary
              ? [
                  ...pair(yellows, blues),
                  ...pair(yellows, greens),
                ]
              : profile.hueFamily === 'orange'
                ? pair(yellows, reds)
                : profile.hueFamily === 'violet'
                  ? [...pair(blues, reds), ...pair(blues, violets)]
                  : profile.hueFamily === 'blue'
                    ? pair(blues, earths.length > 0 ? earths : whites)
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