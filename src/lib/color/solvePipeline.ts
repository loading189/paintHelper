import type { Paint, UserSettings } from '../../types/models';
import { getIdealPalette, getOnHandPalette } from './paletteMode';
import { solveTarget } from './inverse/solveTarget';
import {
  createRuntimeResolveTrace,
  resolveRuntimePaints,
  resolveSolverRuntimeConfig,
  type RuntimeResolveTrace,
  type RuntimePaint,
  type SolverRuntimeConfig,
} from './runtimeResolvers';

export type SolvePipelineResult = ReturnType<typeof solveTarget> & {
  runtimePaints: RuntimePaint[];
  solverConfig: SolverRuntimeConfig;
  trace?: RuntimeResolveTrace;
};

const resolvePalette = (
  runtimePaints: RuntimePaint[],
  solveMode: SolverRuntimeConfig['solveMode'],
): RuntimePaint[] =>
  solveMode === 'ideal' ? getIdealPalette(runtimePaints) as RuntimePaint[] : getOnHandPalette(runtimePaints) as RuntimePaint[];

export const solveColorTarget = (
  targetHex: string,
  paints: Paint[],
  settings: UserSettings,
  limit = 8,
): SolvePipelineResult => {
  const runtimePaints = resolveRuntimePaints(paints);
  const solverConfig = resolveSolverRuntimeConfig(settings);
  const palette = resolvePalette(runtimePaints, solverConfig.solveMode);
  const solved = solveTarget(targetHex, palette, solverConfig, limit);

  return {
    ...solved,
    runtimePaints,
    solverConfig,
    trace: solverConfig.traceEnabled
      ? createRuntimeResolveTrace(runtimePaints, solverConfig)
      : undefined,
  };
};
