# Color Engine Architecture Trace (Source-of-Truth Consolidation)

## 1) End-to-end active pipeline

1. **Seed + persisted app state**
   - Seed paints and default settings: `src/lib/storage/seedData.ts`
   - Persisted state load/sanitize: `src/lib/storage/localState.ts` (`loadAppState`, `sanitizePaint`, `sanitizeSettings`)
2. **Runtime resolver step (new single entry)**
   - `resolveRuntimePaints`: `src/lib/color/runtimeResolvers.ts`
   - `resolveSolverRuntimeConfig`: `src/lib/color/runtimeResolvers.ts`
   - Solve orchestration entrypoint: `solveColorTarget` in `src/lib/color/solvePipeline.ts`
3. **Palette resolution**
   - `getOnHandPalette` / `getIdealPalette`: `src/lib/color/paletteMode.ts`
4. **Inverse search**
   - `solveTarget`: `src/lib/color/inverse/solveTarget.ts`
   - `analyzeTargetProfile`: `src/lib/color/analyzeTargetProfile.ts`
   - `buildCandidateFamilies`: `src/lib/color/inverse/buildCandidateFamilies.ts`
   - `generateRatioLattice`: `src/lib/color/inverse/generateRatioLattice.ts`
   - `rejectImplausibleCandidate`: `src/lib/color/inverse/rejectImplausibleCandidates.ts`
   - `evaluateCandidate`: `src/lib/color/inverse/evaluateCandidates.ts`
   - `refineCandidates`: `src/lib/color/inverse/refineCandidates.ts`
   - `rankCandidates`: `src/lib/color/inverse/rankCandidates.ts`
5. **Forward spectral truth**
   - `predictSpectralMix` → `createSpectralPaintColor`: `src/lib/color/spectralMixing.ts`
6. **UI solve path**
   - `generateRecipesFromDraft`: `src/features/mixer/mixerState.ts`
   - `rankRecipesWithPalettes`: `src/lib/color/mixEngine.ts`
   - dual solve wrapper: `src/lib/color/paletteSolver.ts`
   - page render: `src/features/mixer/MixerPage.tsx`

## 2) Runtime source of truth (post-refactor)

### Paints / forward calibration
- **Base source**: seed + persisted paints (`seedData`, `localState`)
- **Override layer**: developer calibration (`developerCalibration.forwardPigments`)
- **Runtime source**: `resolveRuntimePaints` output (`RuntimePaint.runtime.forwardCalibration`)
- **Consumer contract**:
  - `predictSpectralMix` resolves paints through `resolveRuntimePaints`
  - `getForwardCalibrationForPaint` first reads `paint.runtime.forwardCalibration`

### Inverse tuning / solver settings
- **Base source**: default user settings (`defaultSettings`) + default developer inverse tuning
- **Override layers**: user settings + developer inverse tuning overrides
- **Runtime source**: `resolveSolverRuntimeConfig`
- **Consumer contract**:
  - `solveTarget` now consumes resolved `SolverRuntimeConfig` directly

### Palette mode and max paints
- **Base source**: `settings.solveMode`, `settings.maxPaintsPerRecipe`
- **Override layers**:
  - runtime cap by inverse tuning `ratioSearch.maxComponents`
  - target-dependent 4-paint expansion in dark/near-black contexts
- **Runtime source**: `SolverRuntimeConfig` + target profile computed in `solveTarget`

## 3) Interference report

- **Critical**
  - Previous always-on debug in inverse solver (`DEBUG_SOLVER_TARGETS = true`) risked noisy non-deterministic console behavior. Replaced with `traceEnabled` gate.
  - Forward calibration previously read globally at mix time only. Now runtime paint model carries explicit effective calibration.
- **Medium**
  - Mixed call surfaces (`solveTarget` direct vs wrapper flows) risked bypassing centralized settings. Solves now routed through `solveColorTarget` in active paths.
  - Potential divergence of max paints between settings and inverse tuning. Now explicitly resolved in `resolveSolverRuntimeConfig`.
- **Low**
  - Legacy global style ownership in monolithic `styles.css`. Began split into `styles/global.css`, `styles/app-shell.css`, and `styles/pages/mixer.css` while preserving visuals.

## 4) Developer levers (explicit)

- **Forward pigment calibration**: `developerCalibration.forwardPigments`
- **Inverse tuning**: `developerCalibration.inverseSearch`
- **Palette mode**: user setting `solveMode`
- **Debug tracing**: `SolverRuntimeConfig.traceEnabled` (default off)

## 5) Legacy/inactive path notes

- Legacy ranking mode labels still exist for compatibility in settings and tests, but active inverse solve path is normalized through `solveColorTarget` and resolved runtime config.
- `generateCandidateMixes` remains compatibility-focused but now runs through resolved solve pipeline (`solveColorTarget`).
