import '../../styles/pages/mixer.css';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { analyzeColor } from '../../lib/color/colorAnalysis';
import { normalizeHex } from '../../lib/color/colorMath';
import { predictSpectralMix, spectralDistanceBetweenHexes } from '../../lib/color/spectralMixing';
import { solveColorTarget } from '../../lib/color/solvePipeline';
import {
  defaultDeveloperCalibration,
  getDeveloperCalibration,
  resetDeveloperCalibration,
  subscribeDeveloperCalibration,
  updateDeveloperCalibration,
} from '../../lib/color/developerCalibration';
import type { Paint, RankedRecipe, UserSettings } from '../../types/models';

const DEFAULT_TARGET = '#7A8FB3';
const DEFAULT_OBSERVED = '#777777';

type MixerPageProps = {
  paints: Paint[];
  settings: UserSettings;
  recentColors: string[];
  onSettingsChange: (settings: UserSettings) => void;
  onRecentColor: (hex: string) => void;
  onSaveRecipe: (recipe: RankedRecipe, targetHex: string) => void;
  onLoadTargetHex?: string | null;
};

type RecipeRow = { paintId: string; parts: number };

type SavedForwardCase = {
  id: string;
  name: string;
  observedHex: string;
  recipe: RecipeRow[];
};

const FORWARD_CASES_KEY = 'paint-mixer-forward-cases';

const swatch = (hex?: string | null) => ({ backgroundColor: normalizeHex(hex ?? '') ?? '#000000' });

const clampParts = (value: number) => Math.max(1, Math.round(value) || 1);

const parseSavedForwardCases = (): SavedForwardCase[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(FORWARD_CASES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedForwardCase[];
  } catch {
    return [];
  }
};

const persistForwardCases = (cases: SavedForwardCase[]) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FORWARD_CASES_KEY, JSON.stringify(cases));
};

const solveModeLabels: Record<'on-hand' | 'ideal', string> = {
  'on-hand': 'On-hand paints',
  ideal: 'Ideal palette',
};

const toneClassFromValue = (ratio: number) => {
  if (ratio <= 0.45) return 'safe';
  if (ratio <= 0.75) return 'aggressive';
  return 'extreme';
};

const DeltaChip = ({ current, previous }: { current: number | null; previous: number | null }) => {
  if (current == null) return <span className="mixer-delta-chip">ΔE n/a</span>;
  if (previous == null) return <span className="mixer-delta-chip">ΔE {current.toFixed(3)}</span>;
  const movedToward = current < previous;
  const movedAway = current > previous;
  return (
    <span className={`mixer-delta-chip ${movedToward ? 'improved' : movedAway ? 'worsened' : ''}`}>
      ΔE {current.toFixed(3)}
      {movedToward ? ` ↓ ${Math.abs(previous - current).toFixed(3)}` : movedAway ? ` ↑ ${Math.abs(previous - current).toFixed(3)}` : ' · steady'}
    </span>
  );
};

const CalibrationSlider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  resetValue,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  resetValue: number;
  hint?: string;
}) => {
  const range = max - min || 1;
  const ratio = Math.min(1, Math.max(0, (value - min) / range));
  const tone = toneClassFromValue(Math.abs((value - resetValue) / range) * 2);

  return (
    <div className="mixer-slider">
      <div className="mixer-slider-head">
        <p className="mixer-field-label">{label}</p>
        <div className="mixer-slider-meta">
          <span className={`mixer-range-pill ${tone}`}>{tone === 'safe' ? 'safe' : tone === 'aggressive' ? 'aggressive' : 'extreme'}</span>
          <strong>{value.toFixed(2)}</strong>
        </div>
      </div>
      <input
        type="range"
        className={`mixer-range ${tone}`}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ ['--fill' as string]: `${ratio * 100}%` }}
      />
      <div className="mixer-slider-foot">
        <span>{hint ?? `${min} → ${max}`}</span>
        <button type="button" className="mixer-mini-reset" onClick={() => onChange(resetValue)}>Reset</button>
      </div>
    </div>
  );
};

export const MixerPage = ({ paints, settings, recentColors, onSettingsChange, onRecentColor, onSaveRecipe, onLoadTargetHex }: MixerPageProps) => {
  const enabledPaints = useMemo(() => paints.filter((paint) => paint.isEnabled), [paints]);
  const [calibrationSnapshot, setCalibrationSnapshot] = useState(() => getDeveloperCalibration());

  const [forwardRecipe, setForwardRecipe] = useState<RecipeRow[]>(() => enabledPaints.slice(0, 3).map((paint, index) => ({ paintId: paint.id, parts: index === 0 ? 3 : 2 })));
  const [observedHex, setObservedHex] = useState(DEFAULT_OBSERVED);
  const [savedCases, setSavedCases] = useState<SavedForwardCase[]>(() => parseSavedForwardCases());

  const [targetHex, setTargetHex] = useState(onLoadTargetHex ?? DEFAULT_TARGET);
  const [solveResult, setSolveResult] = useState(() => {
    const initial = normalizeHex(onLoadTargetHex ?? DEFAULT_TARGET);
    return initial ? solveColorTarget(initial, paints, settings, 8) : null;
  });

  const [previousForwardDistance, setPreviousForwardDistance] = useState<number | null>(null);
  const [previousTargetDistance, setPreviousTargetDistance] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeDeveloperCalibration((next) => {
      setCalibrationSnapshot(next);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!enabledPaints.length) return;
    setForwardRecipe((current) => {
      const safeRows = current.map((row) => ({ ...row, paintId: enabledPaints.some((paint) => paint.id === row.paintId) ? row.paintId : enabledPaints[0].id }));
      return safeRows.length ? safeRows : [{ paintId: enabledPaints[0].id, parts: 1 }];
    });
  }, [enabledPaints]);

  useEffect(() => {
    if (!onLoadTargetHex) return;
    setTargetHex(onLoadTargetHex);
  }, [onLoadTargetHex]);

  useEffect(() => {
    const normalized = normalizeHex(targetHex);
    if (!normalized) return;
    setSolveResult(solveColorTarget(normalized, paints, settings, 8));
  }, [targetHex, paints, settings, calibrationSnapshot]);

  const forwardComponents = useMemo(() => forwardRecipe.map((entry) => ({ paintId: entry.paintId, weight: clampParts(entry.parts) })), [forwardRecipe]);

  const forwardPrediction = useMemo(() => {
    if (!enabledPaints.length || !forwardComponents.length) return null;
    return predictSpectralMix(paints, forwardComponents);
  }, [forwardComponents, paints, enabledPaints.length, calibrationSnapshot]);

  const normalizedObserved = normalizeHex(observedHex);
  const forwardDistance = forwardPrediction && normalizedObserved
    ? spectralDistanceBetweenHexes(forwardPrediction.hex, normalizedObserved)
    : null;

  const normalizedTarget = normalizeHex(targetHex);
  const topRecipe = solveResult?.rankedRecipes[0] ?? null;
  const targetDistance = normalizedTarget && topRecipe
    ? spectralDistanceBetweenHexes(normalizedTarget, topRecipe.predictedHex)
    : null;

  useEffect(() => {
    if (forwardDistance != null) setPreviousForwardDistance((current) => (current == null ? forwardDistance : current));
  }, [forwardDistance]);

  useEffect(() => {
    if (targetDistance != null) setPreviousTargetDistance((current) => (current == null ? targetDistance : current));
  }, [targetDistance]);

  const updateInverseNumber = (section: string, key: string, value: number) => {
    if (targetDistance != null) setPreviousTargetDistance(targetDistance);
    updateDeveloperCalibration({
      inverseSearch: {
        [section]: {
          ...(calibrationSnapshot.inverseSearch as any)[section],
          [key]: value,
        },
      } as any,
    });
  };

  const updateInverseBoolean = (section: string, key: string, value: boolean) => {
    if (targetDistance != null) setPreviousTargetDistance(targetDistance);
    updateDeveloperCalibration({
      inverseSearch: {
        [section]: {
          ...(calibrationSnapshot.inverseSearch as any)[section],
          [key]: value,
        },
      } as any,
    });
  };

  const updateForward = (paintId: string, key: string, value: number | string | undefined) => {
    if (forwardDistance != null) setPreviousForwardDistance(forwardDistance);
    updateDeveloperCalibration({
      forwardPigments: {
        paints: {
          [paintId]: {
            ...(calibrationSnapshot.forwardPigments.paints[paintId] ?? defaultDeveloperCalibration.forwardPigments.paints[paintId]),
            [key]: value,
          },
        },
      },
    });
  };

  const saveCurrentForwardCase = () => {
    const next: SavedForwardCase = {
      id: `case-${Date.now()}`,
      name: `Case ${savedCases.length + 1}`,
      observedHex: normalizeHex(observedHex) ?? DEFAULT_OBSERVED,
      recipe: forwardRecipe,
    };
    const combined = [next, ...savedCases].slice(0, 12);
    setSavedCases(combined);
    persistForwardCases(combined);
  };

  return (
    <div className="mixer-training-flow">
      <Card className="p-4 sm:p-5">
        <div className="mixer-stage-intro">
          <div>
            <p className="studio-eyebrow">Guided training</p>
            <h2 className="workspace-mode-title">Mixer calibration in 2 stages</h2>
            <p className="workspace-mode-copy">Stage 1 teaches paint behavior. Stage 2 then tunes how recipe selection works inside that paint model.</p>
          </div>
          <div className="mixer-stage-nav">
            <span className="mixer-stage-pill active">1 · Train Paint Behavior</span>
            <span className="mixer-stage-pill">2 · Tune Recipe Selection</span>
          </div>
        </div>
      </Card>

      <section className="mixer-stage mixer-stage-forward">
        <div className="mixer-stage-header">
          <p className="studio-eyebrow">Stage 1</p>
          <h3 className="panel-heading-title">Train Paint Behavior</h3>
          <p className="panel-heading-copy">Known real mix is fixed input. Observed color is truth. Adjust pigment controls until model prediction converges.</p>
          <DeltaChip current={forwardDistance} previous={previousForwardDistance} />
        </div>

        <div className="mixer-stage-grid">
          <Card className="p-4 sm:p-5 mixer-surface">
            <h4 className="mixer-subheading">Real Mix</h4>
            <p className="mixer-support-copy">Enter the exact paints and parts used physically.</p>
            <div className="mt-4 space-y-3">
              {forwardRecipe.map((row, index) => (
                <div className="mixer-row" key={`${index}-${row.paintId}`}>
                  <select className="studio-select" value={row.paintId} onChange={(event) => setForwardRecipe((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, paintId: event.target.value } : entry))}>
                    {enabledPaints.map((paint) => <option key={paint.id} value={paint.id}>{paint.name}</option>)}
                  </select>
                  <input className="studio-input" type="number" min={1} step={1} value={row.parts} onChange={(event) => setForwardRecipe((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, parts: clampParts(Number(event.target.value)) } : entry))} />
                  <button className="studio-button" type="button" onClick={() => setForwardRecipe((current) => current.filter((_, entryIndex) => entryIndex !== index))} disabled={forwardRecipe.length <= 1}>Remove</button>
                </div>
              ))}
              <button className="studio-button" type="button" onClick={() => enabledPaints[0] ? setForwardRecipe((current) => [...current, { paintId: enabledPaints[0].id, parts: 1 }]) : null}>Add paint row</button>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 mixer-surface">
            <h4 className="mixer-subheading">Observed Color vs Model Prediction</h4>
            <p className="mixer-support-copy">Move prediction toward observed swatch by tuning pigment behavior.</p>
            <div className="mt-4 space-y-3">
              <label>
                <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Observed color from real mix</span>
                <input className="studio-input" value={observedHex} onChange={(event) => setObservedHex(event.target.value)} placeholder="#777777" />
              </label>
              <div className="mixer-swatch-grid">
                <div><p className="mixer-swatch-label">Model Prediction</p><div className="mixer-swatch" style={swatch(forwardPrediction?.hex)} /><p>{forwardPrediction?.hex ?? 'n/a'}</p></div>
                <div><p className="mixer-swatch-label">Observed Color</p><div className="mixer-swatch" style={swatch(normalizedObserved)} /><p>{normalizedObserved ?? 'n/a'}</p></div>
              </div>
              <p className="text-xs text-[color:var(--text-muted)]">Forward match ΔE {forwardDistance?.toFixed(3) ?? 'n/a'} · lower means prediction is learning your physical paint behavior.</p>
              <button type="button" className="studio-button" onClick={saveCurrentForwardCase}>Save forward case</button>
              {savedCases.length ? <div className="mixer-chip-row">{savedCases.slice(0, 6).map((saved) => <button className="mixer-recent-chip" type="button" key={saved.id} onClick={() => { setForwardRecipe(saved.recipe); setObservedHex(saved.observedHex); }}>{saved.name}</button>)}</div> : null}
            </div>
          </Card>
        </div>

        <Card className="p-4 sm:p-5 mixer-surface">
          <div className="mixer-headline-row">
            <div>
              <h4 className="mixer-subheading">Pigment Controls</h4>
              <p className="mixer-support-copy">These only affect paint behavior in resolveRuntimePaints → predictSpectralMix.</p>
            </div>
            <button className="studio-button" type="button" onClick={() => resetDeveloperCalibration()}>Reset all calibration</button>
          </div>
          <div className="mixer-control-board">
            {enabledPaints.map((paint) => {
              const pigment = calibrationSnapshot.forwardPigments.paints[paint.id] ?? defaultDeveloperCalibration.forwardPigments.paints[paint.id];
              const defaults = defaultDeveloperCalibration.forwardPigments.paints[paint.id] ?? { tintingStrength: 1, darknessBias: 0, chromaBias: 0, earthStrengthBias: 0, whiteLiftBias: 0 };
              return (
                <section className="mixer-control-card" key={paint.id}>
                  <div className="mixer-headline-row">
                    <div><p className="text-sm font-semibold text-[color:var(--text-strong)]">{paint.name}</p><p className="text-xs text-[color:var(--text-muted)]">{paint.id}</p></div>
                    <span className="mixer-recent-swatch" style={{ backgroundColor: paint.hex, width: 20, height: 20 }} />
                  </div>
                  <CalibrationSlider label="tintingStrength" value={pigment.tintingStrength} min={0.75} max={1.4} step={0.01} resetValue={defaults.tintingStrength} onChange={(value) => updateForward(paint.id, 'tintingStrength', value)} />
                  <CalibrationSlider label="darknessBias" value={pigment.darknessBias} min={-0.25} max={0.25} step={0.01} resetValue={defaults.darknessBias} onChange={(value) => updateForward(paint.id, 'darknessBias', value)} />
                  <CalibrationSlider label="chromaBias" value={pigment.chromaBias} min={-0.25} max={0.25} step={0.01} resetValue={defaults.chromaBias} onChange={(value) => updateForward(paint.id, 'chromaBias', value)} />
                  <CalibrationSlider label="earthStrengthBias" value={pigment.earthStrengthBias} min={-0.3} max={0.4} step={0.01} resetValue={defaults.earthStrengthBias} onChange={(value) => updateForward(paint.id, 'earthStrengthBias', value)} />
                  <CalibrationSlider label="whiteLiftBias" value={pigment.whiteLiftBias} min={-0.2} max={0.2} step={0.01} resetValue={defaults.whiteLiftBias} onChange={(value) => updateForward(paint.id, 'whiteLiftBias', value)} />
                  <label>
                    <span className="mixer-field-label">baseHexOverride</span>
                    <input className="studio-input" type="text" value={pigment?.baseHexOverride ?? ''} placeholder={paint.hex} onChange={(event) => updateForward(paint.id, 'baseHexOverride', event.target.value || undefined)} />
                  </label>
                </section>
              );
            })}
          </div>
        </Card>
      </section>

      <Card className="p-4 sm:p-5 mixer-stage-handoff">
        <p className="studio-eyebrow">Stage handoff</p>
        <p>Once the forward model reflects how your paints actually behave, move into recipe tuning to teach the solver how to choose the best path to each target.</p>
      </Card>

      <section className="mixer-stage mixer-stage-inverse">
        <div className="mixer-stage-header">
          <p className="studio-eyebrow">Stage 2</p>
          <h3 className="panel-heading-title">Tune Recipe Selection</h3>
          <p className="panel-heading-copy">Target stays fixed. Solver chooses recipe. Forward model predicts outcome. Adjust solver logic—not pigment behavior.</p>
          <DeltaChip current={targetDistance} previous={previousTargetDistance} />
        </div>

        <div className="mixer-stage-grid">
          <Card className="p-4 sm:p-5 mixer-surface">
            <h4 className="mixer-subheading">Target Color</h4>
            <div className="mt-4 space-y-3">
              <input className="studio-input" value={targetHex} onChange={(event) => setTargetHex(event.target.value)} placeholder="#7A8FB3" />
              <input type="color" className="studio-color-input" value={normalizedTarget ?? '#000000'} onChange={(event) => setTargetHex(event.target.value)} />
              <label>
                <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Solve context</span>
                <select className="studio-select" value={settings.solveMode ?? 'on-hand'} onChange={(event) => onSettingsChange({ ...settings, solveMode: event.target.value as UserSettings['solveMode'] })}>
                  {Object.entries(solveModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <div className="mixer-chip-row">{recentColors.slice(0, 8).map((hex) => <button key={hex} className="mixer-recent-chip" type="button" onClick={() => { setTargetHex(hex); onRecentColor(hex); }}><span className="mixer-recent-swatch" style={{ backgroundColor: hex }} />{hex}</button>)}</div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 mixer-surface">
            <h4 className="mixer-subheading">Solver Recipe + Predicted Match</h4>
            <div className="mt-4 space-y-3">
              <div className="mixer-swatch-grid">
                <div><p className="mixer-swatch-label">Target Color</p><div className="mixer-swatch" style={swatch(normalizedTarget)} /><p>{normalizedTarget ?? 'n/a'}</p></div>
                <div><p className="mixer-swatch-label">Predicted Match</p><div className="mixer-swatch" style={swatch(topRecipe?.predictedHex)} /><p>{topRecipe?.predictedHex ?? 'n/a'}</p></div>
              </div>
              <p className="text-xs text-[color:var(--text-muted)]">Solver recipe: {topRecipe?.recipeText ?? 'n/a'} · Practical ratio: {topRecipe?.practicalRatioText ?? 'n/a'} · ΔE {targetDistance?.toFixed(3) ?? 'n/a'}</p>
              {topRecipe ? <button type="button" className="studio-button studio-button-primary" onClick={() => normalizedTarget ? onSaveRecipe(topRecipe, normalizedTarget) : null}>Save selected solve recipe</button> : null}
              <div className="studio-panel">
                <p className="text-xs text-[color:var(--text-muted)]">Live solver explanation</p>
                <p className="text-sm text-[color:var(--text-strong)]">{topRecipe ? `${topRecipe.predictedHex} from ${topRecipe.recipeText}` : 'No solve result yet'}</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-4 sm:p-5 mixer-surface">
          <h4 className="mixer-subheading">Solver Controls</h4>
          <p className="mixer-support-copy">These affect recipe exploration, ranking, and practicality inside resolveSolverRuntimeConfig → solveColorTarget.</p>

          <div className="mixer-control-board">
            <section className="mixer-control-card">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Recipe exploration</p>
              <CalibrationSlider label="ratioSearch.maxComponents" value={calibrationSnapshot.inverseSearch.ratioSearch.maxComponents} min={1} max={4} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.maxComponents} onChange={(value) => updateInverseNumber('ratioSearch', 'maxComponents', value)} />
              <CalibrationSlider label="ratioSearch.neighborhoodRadius" value={calibrationSnapshot.inverseSearch.ratioSearch.neighborhoodRadius} min={1} max={6} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.neighborhoodRadius} onChange={(value) => updateInverseNumber('ratioSearch', 'neighborhoodRadius', value)} />
              <CalibrationSlider label="global.familyBeamWidth" value={calibrationSnapshot.inverseSearch.global.familyBeamWidth} min={3} max={20} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.global.familyBeamWidth} onChange={(value) => updateInverseNumber('global', 'familyBeamWidth', value)} />
              <label className="mixer-check"><span>ratioSearch.darkRatioFamiliesEnabled</span><input type="checkbox" checked={calibrationSnapshot.inverseSearch.ratioSearch.darkRatioFamiliesEnabled} onChange={(event) => updateInverseBoolean('ratioSearch', 'darkRatioFamiliesEnabled', event.target.checked)} /></label>
            </section>
            <section className="mixer-control-card">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Ranking / practicality</p>
              <CalibrationSlider label="global.practicalRatioHardMaxParts" value={calibrationSnapshot.inverseSearch.global.practicalRatioHardMaxParts} min={6} max={18} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.global.practicalRatioHardMaxParts} onChange={(value) => updateInverseNumber('global', 'practicalRatioHardMaxParts', value)} />
              <CalibrationSlider label="global.workableMatchThreshold" value={calibrationSnapshot.inverseSearch.global.workableMatchThreshold} min={0.1} max={0.6} step={0.01} resetValue={defaultDeveloperCalibration.inverseSearch.global.workableMatchThreshold} onChange={(value) => updateInverseNumber('global', 'workableMatchThreshold', value)} />
              <CalibrationSlider label="mutedTargets.cleanlinessPenalty" value={calibrationSnapshot.inverseSearch.mutedTargets.cleanlinessPenalty} min={0.5} max={4} step={0.1} resetValue={defaultDeveloperCalibration.inverseSearch.mutedTargets.cleanlinessPenalty} onChange={(value) => updateInverseNumber('mutedTargets', 'cleanlinessPenalty', value)} />
              <CalibrationSlider label="vividTargets.muddinessPenalty" value={calibrationSnapshot.inverseSearch.vividTargets.muddinessPenalty} min={0.5} max={4} step={0.1} resetValue={defaultDeveloperCalibration.inverseSearch.vividTargets.muddinessPenalty} onChange={(value) => updateInverseNumber('vividTargets', 'muddinessPenalty', value)} />
            </section>
            <section className="mixer-control-card">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Advanced solver constants surfaced</p>
              <label><span className="mixer-field-label">darkTargets.minDarkShare</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.darkTargets.minDarkShare} onChange={(event) => updateInverseNumber('darkTargets', 'minDarkShare', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">darkTargets.maxYellowShare</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.darkTargets.maxYellowShare} onChange={(event) => updateInverseNumber('darkTargets', 'maxYellowShare', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">neutrals.balancePenalty</span><input className="studio-input" type="number" step="0.1" value={calibrationSnapshot.inverseSearch.neutrals.balancePenalty} onChange={(event) => updateInverseNumber('neutrals', 'balancePenalty', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">yellows.maxBlueShareLight</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.yellows.maxBlueShareLight} onChange={(event) => updateInverseNumber('yellows', 'maxBlueShareLight', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">greenTargets.vividOffHuePenalty</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.greenTargets.vividOffHuePenalty} onChange={(event) => updateInverseNumber('greenTargets', 'vividOffHuePenalty', Number(event.target.value))} /></label>
              <label className="mixer-check"><span>greenTargets.requireEarthForDarkNatural</span><input type="checkbox" checked={calibrationSnapshot.inverseSearch.greenTargets.requireEarthForDarkNatural} onChange={(event) => updateInverseBoolean('greenTargets', 'requireEarthForDarkNatural', event.target.checked)} /></label>
            </section>
          </div>

          <p className="mt-4 text-xs text-[color:var(--text-muted)]">Live pipeline: target {normalizeHex(targetHex) ?? 'invalid'} → solver recipe {topRecipe?.practicalRatioText ?? 'none'} → forward prediction {topRecipe?.predictedHex ?? 'none'}.</p>
        </Card>
      </section>

      <Card className="p-4 sm:p-5">
        <p className="studio-eyebrow">Calibration persistence</p>
        <p className="text-sm text-[color:var(--text-strong)]">Forward pigment and solver tuning edits persist in browser localStorage via developerCalibration and feed runtime resolvers app-wide.</p>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">Forward case snapshots also persist locally; no backend calibration path was introduced in this pass.</p>
        <p className="text-xs text-[color:var(--text-muted)] mt-1">Current forward prediction profile: {forwardPrediction ? `${forwardPrediction.hex} · ${analyzeColor(forwardPrediction.hex)?.hueFamily ?? 'n/a'}` : 'No forward recipe selected'}.</p>
      </Card>
    </div>
  );
};
