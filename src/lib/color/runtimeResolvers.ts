import type { Paint, RankingMode, SolveMode, UserSettings } from '../../types/models';
import {
  defaultDeveloperCalibration,
  getDeveloperCalibration,
  type InverseSearchCalibration,
  type PaintForwardCalibration,
} from './developerCalibration';

export type RuntimePaint = Paint & {
  runtime: {
    source: 'seed-or-storage';
    forwardCalibration: PaintForwardCalibration;
    enabledForSolve: boolean;
  };
};

export type SolverRuntimeConfig = {
  rankingMode: RankingMode;
  solveMode: SolveMode;
  maxPaintsPerRecipe: number;
  inverseTuning: InverseSearchCalibration;
  traceEnabled: boolean;
};

export type RuntimeResolveTrace = {
  paintResolution: Array<{
    paintId: string;
    enabledForSolve: boolean;
    sourceHex: string;
    forwardCalibration: PaintForwardCalibration;
  }>;
  solverConfig: SolverRuntimeConfig;
};

const DEFAULT_FORWARD: PaintForwardCalibration = {
  tintingStrength: 1,
  darknessBias: 0,
  chromaBias: 0,
  earthStrengthBias: 0,
  whiteLiftBias: 0,
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const mergeForwardCalibration = (
  paintId: string,
  calibration = getDeveloperCalibration(),
): PaintForwardCalibration => {
  const fromDefault = defaultDeveloperCalibration.forwardPigments.paints[paintId];
  const fromCurrent = calibration.forwardPigments.paints[paintId];

  return {
    ...DEFAULT_FORWARD,
    ...(fromDefault ?? {}),
    ...(fromCurrent ?? {}),
  };
};

export const resolveRuntimePaints = (
  paints: Paint[],
  calibration = getDeveloperCalibration(),
): RuntimePaint[] =>
  paints.map((paint) => {
    const forwardCalibration = mergeForwardCalibration(paint.id, calibration);

    return {
      ...paint,
      runtime: {
        source: 'seed-or-storage',
        forwardCalibration,
        enabledForSolve: Boolean(paint.isEnabled),
      },
    };
  });

const normalizeRankingMode = (rankingMode: UserSettings['rankingMode']): RankingMode =>
  rankingMode === 'strict-closest-color' ||
  rankingMode === 'painter-friendly-balanced' ||
  rankingMode === 'simpler-recipes-preferred' ||
  rankingMode === 'full-heuristics-legacy'
    ? rankingMode
    : 'spectral-first';

export const resolveSolverRuntimeConfig = (
  settings: UserSettings,
  calibration = getDeveloperCalibration(),
): SolverRuntimeConfig => ({
  rankingMode: normalizeRankingMode(settings.rankingMode),
  solveMode: settings.solveMode === 'ideal' ? 'ideal' : 'on-hand',
  maxPaintsPerRecipe: Math.max(
    1,
    Math.min(settings.maxPaintsPerRecipe, calibration.inverseSearch.ratioSearch.maxComponents),
  ),
  inverseTuning: clone(calibration.inverseSearch),
  traceEnabled: false,
});

export const createRuntimeResolveTrace = (
  runtimePaints: RuntimePaint[],
  solverConfig: SolverRuntimeConfig,
): RuntimeResolveTrace => ({
  paintResolution: runtimePaints.map((paint) => ({
    paintId: paint.id,
    enabledForSolve: paint.runtime.enabledForSolve,
    sourceHex: paint.hex,
    forwardCalibration: paint.runtime.forwardCalibration,
  })),
  solverConfig,
});
