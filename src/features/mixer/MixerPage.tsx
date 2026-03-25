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

  const updateInverseNumber = (section: string, key: string, value: number) => {
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
    <div className="space-y-5 lg:space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="workspace-mode-header">
          <div>
            <p className="studio-eyebrow">Calibration center</p>
            <h2 className="workspace-mode-title">Mixer as model control room</h2>
            <p className="workspace-mode-copy">Forward Recipe Lab calibrates recipe → predicted behavior. Target Solve Lab calibrates target → recipe search behavior.</p>
          </div>
          <div className="workspace-mode-meta">
            <div className="studio-mini-stat"><span>Enabled paints</span><strong>{enabledPaints.length}</strong></div>
            <div className="studio-mini-stat"><span>Solve mode</span><strong>{solveModeLabels[settings.solveMode ?? 'on-hand']}</strong></div>
            <div className="studio-mini-stat"><span>Top ΔE</span><strong>{targetDistance?.toFixed(3) ?? 'n/a'}</strong></div>
          </div>
        </div>
      </Card>

      <div className="mixer-zone-grid">
        <Card className="p-4 sm:p-5">
          <p className="studio-eyebrow">Zone 1</p>
          <h3 className="panel-heading-title">Forward Recipe Lab</h3>
          <p className="panel-heading-copy">Build a known recipe, compare predicted vs observed, then tune pigment controls to close the gap.</p>

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
            <label>
              <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Observed real-world swatch</span>
              <input className="studio-input" value={observedHex} onChange={(event) => setObservedHex(event.target.value)} placeholder="#777777" />
            </label>
            <div className="mixer-swatch-grid">
              <div><p className="mixer-swatch-label">Predicted</p><div className="mixer-swatch" style={swatch(forwardPrediction?.hex)} /><p>{forwardPrediction?.hex ?? 'n/a'}</p></div>
              <div><p className="mixer-swatch-label">Observed</p><div className="mixer-swatch" style={swatch(normalizedObserved)} /><p>{normalizedObserved ?? 'n/a'}</p></div>
            </div>
            <p className="text-xs text-[color:var(--text-muted)]">Forward match ΔE: {forwardDistance?.toFixed(3) ?? 'n/a'} (lower is better).</p>
            <button type="button" className="studio-button" onClick={saveCurrentForwardCase}>Save forward case</button>
            {savedCases.length ? <div className="mixer-chip-row">{savedCases.slice(0, 4).map((saved) => <button className="mixer-recent-chip" type="button" key={saved.id} onClick={() => { setForwardRecipe(saved.recipe); setObservedHex(saved.observedHex); }}>{saved.name}</button>)}</div> : null}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="studio-eyebrow">Zone 2</p>
          <h3 className="panel-heading-title">Target Solve Lab</h3>
          <p className="panel-heading-copy">Tune inverse solver behavior using the real solveColorTarget pipeline.</p>
          <div className="mt-4 space-y-3">
            <input className="studio-input" value={targetHex} onChange={(event) => setTargetHex(event.target.value)} placeholder="#7A8FB3" />
            <input type="color" className="studio-color-input" value={normalizedTarget ?? '#000000'} onChange={(event) => setTargetHex(event.target.value)} />
            <label>
              <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Solve context</span>
              <select className="studio-select" value={settings.solveMode ?? 'on-hand'} onChange={(event) => onSettingsChange({ ...settings, solveMode: event.target.value as UserSettings['solveMode'] })}>
                {Object.entries(solveModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <div className="mixer-swatch-grid">
              <div><p className="mixer-swatch-label">Target</p><div className="mixer-swatch" style={swatch(normalizedTarget)} /><p>{normalizedTarget ?? 'n/a'}</p></div>
              <div><p className="mixer-swatch-label">Predicted from selected recipe</p><div className="mixer-swatch" style={swatch(topRecipe?.predictedHex)} /><p>{topRecipe?.predictedHex ?? 'n/a'}</p></div>
            </div>
            <p className="text-xs text-[color:var(--text-muted)]">Target solve ΔE: {targetDistance?.toFixed(3) ?? 'n/a'} · Best ratio: {topRecipe?.practicalRatioText ?? 'n/a'}</p>
            {topRecipe ? <button type="button" className="studio-button studio-button-primary" onClick={() => normalizedTarget ? onSaveRecipe(topRecipe, normalizedTarget) : null}>Save selected solve recipe</button> : null}
            <div className="mixer-chip-row">{recentColors.slice(0, 6).map((hex) => <button key={hex} className="mixer-recent-chip" type="button" onClick={() => { setTargetHex(hex); onRecentColor(hex); }}><span className="mixer-recent-swatch" style={{ backgroundColor: hex }} />{hex}</button>)}</div>
          </div>
        </Card>
      </div>

      <div className="mixer-zone-grid">
        <Card className="p-4 sm:p-5">
          <div className="mixer-headline-row">
            <div>
              <p className="studio-eyebrow">Zone 3</p>
              <h3 className="panel-heading-title">Pigment Control Board</h3>
              <p className="panel-heading-copy">Forward pigment knobs used by resolveRuntimePaints and predictSpectralMix.</p>
            </div>
            <button className="studio-button" type="button" onClick={() => resetDeveloperCalibration()}>Reset all calibration</button>
          </div>
          <div className="mixer-control-board">
            {enabledPaints.map((paint) => {
              const pigment = calibrationSnapshot.forwardPigments.paints[paint.id] ?? defaultDeveloperCalibration.forwardPigments.paints[paint.id];
              return (
                <section className="mixer-control-card" key={paint.id}>
                  <div className="mixer-headline-row">
                    <div><p className="text-sm font-semibold text-[color:var(--text-strong)]">{paint.name}</p><p className="text-xs text-[color:var(--text-muted)]">{paint.id}</p></div>
                    <span className="mixer-recent-swatch" style={{ backgroundColor: paint.hex, width: 20, height: 20 }} />
                  </div>
                  {(['tintingStrength', 'chromaBias', 'darknessBias', 'earthStrengthBias', 'whiteLiftBias'] as const).map((key) => (
                    <label key={key}>
                      <span className="mixer-field-label">{key}</span>
                      <input className="studio-input" type="number" step="0.01" value={pigment?.[key] ?? 0} onChange={(event) => updateForward(paint.id, key, Number(event.target.value))} />
                    </label>
                  ))}
                  <label>
                    <span className="mixer-field-label">baseHexOverride</span>
                    <input className="studio-input" type="text" value={pigment?.baseHexOverride ?? ''} placeholder={paint.hex} onChange={(event) => updateForward(paint.id, 'baseHexOverride', event.target.value || undefined)} />
                  </label>
                </section>
              );
            })}
          </div>
        </Card>

        <Card className="p-4 sm:p-5">
          <p className="studio-eyebrow">Zone 4</p>
          <h3 className="panel-heading-title">Solver Control Board</h3>
          <p className="panel-heading-copy">Inverse knobs used by resolveSolverRuntimeConfig and solveColorTarget.</p>

          <div className="mixer-control-board">
            <section className="mixer-control-card">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Ratio search + family exploration</p>
              <label><span className="mixer-field-label">ratioSearch.maxComponents</span><input className="studio-input" type="number" min={1} max={4} value={calibrationSnapshot.inverseSearch.ratioSearch.maxComponents} onChange={(event) => updateInverseNumber('ratioSearch', 'maxComponents', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">ratioSearch.neighborhoodRadius</span><input className="studio-input" type="number" min={1} value={calibrationSnapshot.inverseSearch.ratioSearch.neighborhoodRadius} onChange={(event) => updateInverseNumber('ratioSearch', 'neighborhoodRadius', Number(event.target.value))} /></label>
              <label className="mixer-check"><span>ratioSearch.darkRatioFamiliesEnabled</span><input type="checkbox" checked={calibrationSnapshot.inverseSearch.ratioSearch.darkRatioFamiliesEnabled} onChange={(event) => updateInverseBoolean('ratioSearch', 'darkRatioFamiliesEnabled', event.target.checked)} /></label>
              <label><span className="mixer-field-label">global.familyBeamWidth</span><input className="studio-input" type="number" min={1} value={calibrationSnapshot.inverseSearch.global.familyBeamWidth} onChange={(event) => updateInverseNumber('global', 'familyBeamWidth', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.dedupeBasinThreshold</span><input className="studio-input" type="number" step="0.001" value={calibrationSnapshot.inverseSearch.global.dedupeBasinThreshold} onChange={(event) => updateInverseNumber('global', 'dedupeBasinThreshold', Number(event.target.value))} /></label>
            </section>
            <section className="mixer-control-card">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Dark / chromatic guardrails</p>
              {(['minDarkShare', 'maxYellowShare', 'maxLightShare', 'dominantLightShareCap', 'dominantYellowShareCap', 'valuePenaltyScale', 'earthStructuralBonus', 'offHuePenalty'] as const).map((key) => <label key={key}><span className="mixer-field-label">darkTargets.{key}</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.darkTargets[key]} onChange={(event) => updateInverseNumber('darkTargets', key, Number(event.target.value))} /></label>)}
            </section>
            <section className="mixer-control-card">
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Ranking + practical mix shaping</p>
              <label><span className="mixer-field-label">mutedTargets.cleanlinessPenalty</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.mutedTargets.cleanlinessPenalty} onChange={(event) => updateInverseNumber('mutedTargets', 'cleanlinessPenalty', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">vividTargets.muddinessPenalty</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.vividTargets.muddinessPenalty} onChange={(event) => updateInverseNumber('vividTargets', 'muddinessPenalty', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.excellentMatchThreshold</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.global.excellentMatchThreshold} onChange={(event) => updateInverseNumber('global', 'excellentMatchThreshold', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.workableMatchThreshold</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.global.workableMatchThreshold} onChange={(event) => updateInverseNumber('global', 'workableMatchThreshold', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.practicalRatioHardMaxParts</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.global.practicalRatioHardMaxParts} onChange={(event) => updateInverseNumber('global', 'practicalRatioHardMaxParts', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.practicalRatioIdealMaxParts2</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.global.practicalRatioIdealMaxParts2} onChange={(event) => updateInverseNumber('global', 'practicalRatioIdealMaxParts2', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.practicalRatioIdealMaxParts3</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.global.practicalRatioIdealMaxParts3} onChange={(event) => updateInverseNumber('global', 'practicalRatioIdealMaxParts3', Number(event.target.value))} /></label>
              <label><span className="mixer-field-label">global.practicalRatioIdealMaxParts4</span><input className="studio-input" type="number" step="1" value={calibrationSnapshot.inverseSearch.global.practicalRatioIdealMaxParts4} onChange={(event) => updateInverseNumber('global', 'practicalRatioIdealMaxParts4', Number(event.target.value))} /></label>
            </section>
          </div>

          <p className="mt-4 text-xs text-[color:var(--text-muted)]">Live effect: target {normalizeHex(targetHex) ?? 'invalid'} → recipe {topRecipe?.practicalRatioText ?? 'none'} → predicted {topRecipe?.predictedHex ?? 'none'}.</p>
        </Card>
      </div>

      <Card className="p-4 sm:p-5">
        <p className="studio-eyebrow">Live explainability</p>
        <h3 className="panel-heading-title">What changed as you tune knobs</h3>
        <div className="mixer-zone-grid mt-3">
          <div className="studio-panel">
            <p className="text-xs text-[color:var(--text-muted)]">Forward recipe analysis</p>
            <p className="text-sm text-[color:var(--text-strong)]">{forwardPrediction ? `${forwardPrediction.hex} · ${analyzeColor(forwardPrediction.hex)?.hueFamily ?? 'n/a'}` : 'No forward recipe selected'}</p>
          </div>
          <div className="studio-panel">
            <p className="text-xs text-[color:var(--text-muted)]">Inverse solve analysis</p>
            <p className="text-sm text-[color:var(--text-strong)]">{topRecipe ? `${topRecipe.predictedHex} from ${topRecipe.recipeText}` : 'No solve result'}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};
