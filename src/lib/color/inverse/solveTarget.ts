import type { Paint, RankedRecipe, UserSettings } from '../../../types/models';
import { analyzeColor } from '../colorAnalysis';
import { formatRatio } from '../../utils/ratio';
import { buildCandidateFamilies } from './buildCandidateFamilies';
import { analyzeTargetProfile } from './analyzeTargetProfile';
import { generateRatioLattice } from './generateRatioLattice';
import { rejectImplausibleCandidate } from './rejectImplausibleCandidates';
import { evaluateCandidate } from './evaluateCandidates';
import { refineCandidates } from './refineCandidates';
import { dedupePredictedBasins } from './dedupePredictedBasins';
import { rankCandidates } from './rankCandidates';
import { explainCandidate } from './explainCandidate';
import type { CandidateFamilyId, EvaluatedCandidate, SolveTargetResult } from './types';

const beamByFamily = (
  candidates: EvaluatedCandidate[],
  beamSize: number
): EvaluatedCandidate[] => {
  const grouped = new Map<CandidateFamilyId, EvaluatedCandidate[]>();

  candidates.forEach((candidate) => {
    const current = grouped.get(candidate.familyId) ?? [];
    current.push(candidate);
    grouped.set(candidate.familyId, current);
  });

  return [...grouped.values()].flatMap((family) =>
    family
      .sort((a, b) => a.scoreBreakdown.finalScore - b.scoreBreakdown.finalScore)
      .slice(0, beamSize)
  );
};

// Set to true temporarily while debugging target routing.
const DEBUG_SOLVER_TARGETS = true;

const logTargetProfileDebug = (
  targetHex: string,
  targetAnalysis: NonNullable<ReturnType<typeof analyzeColor>>,
  profile: ReturnType<typeof analyzeTargetProfile>
) => {
  if (!DEBUG_SOLVER_TARGETS) return;

  console.log('DEBUG TARGET PROFILE', targetHex, {
    analysis: {
      normalizedHex: targetAnalysis.normalizedHex,
      hueFamily: targetAnalysis.hueFamily,
      valueClassification: targetAnalysis.valueClassification,
      saturationClassification: targetAnalysis.saturationClassification,
      value: targetAnalysis.value,
      chroma: targetAnalysis.chroma,
      hue: targetAnalysis.hue,
      saturation: targetAnalysis.saturation,
    },
    profile: {
      isDark: profile.isDark,
      isVeryDark: profile.isVeryDark,
      isLight: profile.isLight,
      isVeryLight: profile.isVeryLight,
      isMuted: profile.isMuted,
      isVivid: profile.isVivid,
      isNearBoundary: profile.isNearBoundary,
      isNearNeutral: profile.isNearNeutral,
      isNearBlackChromatic: profile.isNearBlackChromatic,
      isDarkNaturalGreen: profile.isDarkNaturalGreen,
      isDarkEarthWarm: profile.isDarkEarthWarm,
      needsWhiteLikely: profile.needsWhiteLikely,
      needsDarkenerLikely: profile.needsDarkenerLikely,
      likelyFamilyIds: profile.likelyFamilyIds,
    },
  });
};

export const solveTarget = (
  targetHex: string,
  paints: Paint[],
  settings: UserSettings,
  limit = 8
): SolveTargetResult => {
  const targetAnalysis = analyzeColor(targetHex);

  if (!targetAnalysis) {
    const fallbackAnalysis = analyzeColor('#000000')!;
    const fallbackProfile = analyzeTargetProfile(fallbackAnalysis);

    return {
      targetAnalysis: fallbackAnalysis,
      profile: fallbackProfile,
      candidates: [],
      rankedRecipes: [],
      familyBeamCounts: {},
    };
  }

  const profile = analyzeTargetProfile(targetAnalysis);
  logTargetProfileDebug(targetHex, targetAnalysis, profile);

  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const templates = buildCandidateFamilies(
    enabledPaints,
    profile,
    Math.max(settings.maxPaintsPerRecipe, 3)
  );
  const paintsById = new Map(enabledPaints.map((paint) => [paint.id, paint]));

  const firstPass: EvaluatedCandidate[] = [];

  templates.forEach((template) => {
    generateRatioLattice(template, profile).forEach((weights) => {
      if (rejectImplausibleCandidate(template, weights, paintsById, profile)) {
        return;
      }

      const evaluated = evaluateCandidate(
        template,
        weights,
        enabledPaints,
        targetHex,
        targetAnalysis,
        'spectral-first',
        profile
      );

      if (evaluated) {
        firstPass.push(evaluated);
      }
    });
  });

  const familyBeam = beamByFamily(firstPass, 8);
  const refined = refineCandidates(
    familyBeam,
    enabledPaints,
    targetHex,
    targetAnalysis,
    'spectral-first',
    profile
  );
  const deduped = dedupePredictedBasins(refined);
  const ranked = rankCandidates(deduped);
  const top = ranked.slice(0, Math.max(limit * 3, limit));

  const rankedRecipes: RankedRecipe[] = top.map((candidate, index) => ({
    id: `recipe-${targetAnalysis.normalizedHex.slice(1)}-${index}`,
    familyId: candidate.familyId,
    predictedHex: candidate.predictedHex,
    distanceScore: candidate.scoreBreakdown.spectralDistance,
    components: candidate.recipe,
    exactParts: candidate.exactParts,
    exactPercentages: candidate.exactParts,
    exactRatioText: formatRatio(candidate.exactParts),
    practicalParts: candidate.practicalParts,
    practicalPercentages: candidate.practicalParts,
    practicalRatioText: formatRatio(candidate.practicalParts),
    parts: candidate.practicalParts,
    ratioText: formatRatio(candidate.practicalParts),
    recipeText: candidate.recipe
      .map(
        (component, recipeIndex) =>
          `${candidate.practicalParts[recipeIndex]} part ${
            paintsById.get(component.paintId)?.name ?? component.paintId
          }`
      )
      .join(' + '),
    scoreBreakdown: candidate.scoreBreakdown,
    qualityLabel:
      candidate.scoreBreakdown.spectralDistance < 0.18
        ? 'Excellent spectral starting point'
        : 'Strong starting point',
    badges: [],
    guidanceText: explainCandidate(candidate, profile),
    nextAdjustments: [],
    detailedAdjustments: [],
    targetAnalysis,
    predictedAnalysis: candidate.predictedAnalysis,
    whyThisRanked: explainCandidate(candidate, profile),
    mixStrategy: explainCandidate(candidate, profile),
    mixPath: [],
    achievability: {
      level:
        candidate.scoreBreakdown.spectralDistance < 0.18
          ? 'strong'
          : candidate.scoreBreakdown.spectralDistance < 0.34
            ? 'workable'
            : 'limited',
      headline: 'Spectral achievability estimate',
      detail:
        'Achievability is based on the truthful predicted gap and palette boundary pressure, not ranking mode.',
    },
  }));

  const familyBeamCounts: Partial<Record<CandidateFamilyId, number>> = {};
  familyBeam.forEach((candidate) => {
    familyBeamCounts[candidate.familyId] =
      (familyBeamCounts[candidate.familyId] ?? 0) + 1;
  });

  return {
    targetAnalysis,
    profile,
    candidates: top,
    rankedRecipes: rankedRecipes.slice(0, limit),
    familyBeamCounts,
  };
};