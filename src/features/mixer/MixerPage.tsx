import '../../styles/pages/mixer.css';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
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
const MAX_SLOTS = 4;

type MixerPageProps = {
  paints: Paint[];
  settings: UserSettings;
  recentColors: string[];
  onSettingsChange: (settings: UserSettings) => void;
  onRecentColor: (hex: string) => void;
  onSaveRecipe: (recipe: RankedRecipe, targetHex: string) => void;
  onLoadTargetHex?: string | null;
};

type MixSlot = {
  paintId: string | null;
  parts: number;
};

const swatch = (hex?: string | null) => ({ backgroundColor: normalizeHex(hex ?? '') ?? '#101624' });

const solveModeLabels: Record<'on-hand' | 'ideal', string> = {
  'on-hand': 'On-hand paints',
  ideal: 'Ideal palette',
};

const emptySlot = (): MixSlot => ({ paintId: null, parts: 1 });

const clampParts = (value: number) => Math.max(1, Math.min(24, Math.round(value) || 1));

const CalibrationSlider = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  resetValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  resetValue: number;
}) => (
  <label className="mixer-popup-slider">
    <div>
      <span>{label}</span>
      <button type="button" onClick={() => onChange(resetValue)}>Reset</button>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    <strong>{value.toFixed(2)}</strong>
  </label>
);

export const MixerPage = ({ paints, settings, recentColors, onSettingsChange, onRecentColor, onSaveRecipe, onLoadTargetHex }: MixerPageProps) => {
  const enabledPaints = useMemo(() => paints.filter((paint) => paint.isEnabled), [paints]);
  const [calibrationSnapshot, setCalibrationSnapshot] = useState(() => getDeveloperCalibration());

  const [mixSlots, setMixSlots] = useState<MixSlot[]>(() => {
    const seeded = enabledPaints.slice(0, 3).map((paint, index) => ({ paintId: paint.id, parts: index === 0 ? 2 : 1 }));
    return [...seeded, ...Array.from({ length: MAX_SLOTS - seeded.length }, () => emptySlot())];
  });
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [activePopupOpen, setActivePopupOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [targetHex, setTargetHex] = useState(onLoadTargetHex ?? DEFAULT_TARGET);
  const [solveResult, setSolveResult] = useState(() => {
    const initial = normalizeHex(onLoadTargetHex ?? DEFAULT_TARGET);
    return initial ? solveColorTarget(initial, paints, settings, 8) : null;
  });

  useEffect(() => {
    const unsubscribe = subscribeDeveloperCalibration((next) => setCalibrationSnapshot(next));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!enabledPaints.length) {
      setMixSlots(Array.from({ length: MAX_SLOTS }, () => emptySlot()));
      return;
    }

    setMixSlots((current) => {
      const hydrated = current.map((slot) => {
        if (!slot.paintId) return slot;
        return enabledPaints.some((paint) => paint.id === slot.paintId)
          ? slot
          : emptySlot();
      });

      if (hydrated.some((slot) => slot.paintId)) return hydrated;

      const seeded = enabledPaints.slice(0, 3).map((paint, index) => ({ paintId: paint.id, parts: index === 0 ? 2 : 1 }));
      return [...seeded, ...Array.from({ length: MAX_SLOTS - seeded.length }, () => emptySlot())];
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

  const filledSlots = useMemo(() => mixSlots.filter((slot) => slot.paintId), [mixSlots]);

  const forwardComponents = useMemo(
    () => filledSlots.map((slot) => ({ paintId: slot.paintId as string, weight: clampParts(slot.parts) })),
    [filledSlots],
  );

  const forwardPrediction = useMemo(() => {
    if (!forwardComponents.length) return null;
    return predictSpectralMix(paints, forwardComponents);
  }, [forwardComponents, paints, calibrationSnapshot]);

  const selectedPaintId = mixSlots[selectedSlot]?.paintId ?? null;
  const activePaintId = selectedPaintId ?? filledSlots[0]?.paintId ?? null;
  const activePaint = activePaintId ? enabledPaints.find((paint) => paint.id === activePaintId) ?? null : null;
  const activeCalibration = activePaintId
    ? calibrationSnapshot.forwardPigments.paints[activePaintId] ?? defaultDeveloperCalibration.forwardPigments.paints[activePaintId]
    : null;
  const activeDefaults = activePaintId
    ? defaultDeveloperCalibration.forwardPigments.paints[activePaintId] ?? { tintingStrength: 1, darknessBias: 0, chromaBias: 0, earthStrengthBias: 0, whiteLiftBias: 0 }
    : null;

  const normalizedTarget = normalizeHex(targetHex);
  const topRecipe = solveResult?.rankedRecipes[0] ?? null;
  const targetDistance = normalizedTarget && topRecipe
    ? spectralDistanceBetweenHexes(normalizedTarget, topRecipe.predictedHex)
    : null;

  const assignPaintToSlot = (paintId: string) => {
    setMixSlots((current) => {
      const next = [...current];
      const firstOpen = next.findIndex((slot) => !slot.paintId);
      const slotIndex = firstOpen >= 0 ? firstOpen : selectedSlot;
      next[slotIndex] = { paintId, parts: next[slotIndex].paintId ? next[slotIndex].parts : 1 };
      return next;
    });
    setActivePopupOpen(false);
  };

  const setSlotParts = (index: number, value: number) => {
    setMixSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, parts: clampParts(value) } : slot)));
  };

  const clearSlot = (index: number) => {
    setMixSlots((current) => current.map((slot, slotIndex) => (slotIndex === index ? emptySlot() : slot)));
    setActivePopupOpen(false);
  };

  const updateForward = (paintId: string, key: string, value: number) => {
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

  const updateInverseNumber = (section: string, key: string, value: number) => {
    updateDeveloperCalibration({
      inverseSearch: {
        [section]: {
          ...(calibrationSnapshot.inverseSearch as Record<string, any>)[section],
          [key]: value,
        },
      } as any,
    });
  };

  const updateInverseBoolean = (section: string, key: string, value: boolean) => {
    updateDeveloperCalibration({
      inverseSearch: {
        [section]: {
          ...(calibrationSnapshot.inverseSearch as Record<string, any>)[section],
          [key]: value,
        },
      } as any,
    });
  };

  return (
    <div className="mixer-redesign-page">
      <Card className="mixer-main-shell">
        <button
          type="button"
          className={`mixer-drawer-handle ${drawerOpen ? 'open' : ''}`}
          onClick={() => setDrawerOpen((current) => !current)}
        >
          {drawerOpen ? 'Close calibration' : 'Advanced calibration'}
        </button>

        <section className="mixer-surface-v2">
          <header className="mixer-surface-header">
            <p>Forward mixing surface</p>
            <h2>What happens when I mix these paints?</h2>
          </header>

          <div className="mixer-active-zone">
            {activePopupOpen && activeCalibration && activeDefaults && activePaint ? (
              <div className="mixer-active-popup">
                <p>
                  Prediction tuning for <strong>{activePaint.name}</strong>
                </p>
                <span>These controls change how this mix is being predicted.</span>
                <CalibrationSlider label="tintingStrength" value={activeCalibration.tintingStrength} min={0.75} max={1.4} step={0.01} resetValue={activeDefaults.tintingStrength} onChange={(value) => updateForward(activePaint.id, 'tintingStrength', value)} />
                <CalibrationSlider label="chromaBias" value={activeCalibration.chromaBias} min={-0.25} max={0.25} step={0.01} resetValue={activeDefaults.chromaBias} onChange={(value) => updateForward(activePaint.id, 'chromaBias', value)} />
                <CalibrationSlider label="darknessBias" value={activeCalibration.darknessBias} min={-0.25} max={0.25} step={0.01} resetValue={activeDefaults.darknessBias} onChange={(value) => updateForward(activePaint.id, 'darknessBias', value)} />
                <CalibrationSlider label="earthStrengthBias" value={activeCalibration.earthStrengthBias} min={-0.3} max={0.4} step={0.01} resetValue={activeDefaults.earthStrengthBias} onChange={(value) => updateForward(activePaint.id, 'earthStrengthBias', value)} />
                <CalibrationSlider label="whiteLiftBias" value={activeCalibration.whiteLiftBias} min={-0.2} max={0.2} step={0.01} resetValue={activeDefaults.whiteLiftBias} onChange={(value) => updateForward(activePaint.id, 'whiteLiftBias', value)} />
              </div>
            ) : null}

            <button
              type="button"
              className="mixer-active-color"
              style={swatch(forwardPrediction?.hex)}
              onClick={() => setActivePopupOpen((current) => !current)}
            >
              <span>{forwardPrediction?.hex ?? 'Pick paints to start mixing'}</span>
            </button>
          </div>

          <div className="mixer-paint-arc-scroll">
            <div className="mixer-paint-arc-track" style={{ minWidth: `${Math.max(680, enabledPaints.length * 72)}px` }}>
              {enabledPaints.map((paint, index) => {
                const angle = enabledPaints.length === 1 ? 90 : 28 + (index / Math.max(1, enabledPaints.length - 1)) * 124;
                const radius = 212;
                const x = Math.cos((angle * Math.PI) / 180) * radius;
                const y = Math.sin((angle * Math.PI) / 180) * radius;
                return (
                  <button
                    type="button"
                    key={paint.id}
                    className={`mixer-arc-paint ${activePaintId === paint.id ? 'active' : ''}`}
                    style={{
                      left: `calc(50% + ${x}px - 28px)`,
                      top: `calc(100% - ${y}px - 28px)`,
                      backgroundColor: paint.hex,
                    }}
                    onClick={() => assignPaintToSlot(paint.id)}
                    title={paint.name}
                  >
                    <span>{paint.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mixer-slots-grid">
            {mixSlots.map((slot, index) => {
              const slotPaint = slot.paintId ? paints.find((paint) => paint.id === slot.paintId) : null;
              return (
                <button
                  type="button"
                  key={`slot-${index}`}
                  className={`mixer-slot ${selectedSlot === index ? 'selected' : ''} ${slot.paintId ? 'filled' : ''}`}
                  onClick={() => {
                    setSelectedSlot(index);
                    setActivePopupOpen(false);
                  }}
                >
                  <span className="mixer-slot-well" style={swatch(slotPaint?.hex ?? null)} />
                  <strong>{slotPaint?.name ?? `Empty slot ${index + 1}`}</strong>
                  <small>{slot.paintId ? `${slot.parts} part${slot.parts > 1 ? 's' : ''}` : 'Tap paint in arc to fill'}</small>
                  {slot.paintId ? (
                    <span
                      className="mixer-slot-clear"
                      onClick={(event) => {
                        event.stopPropagation();
                        clearSlot(index);
                      }}
                    >
                      Clear
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mixer-parts-panel">
            <h3>Mix parts</h3>
            <p>Adjust ratios like physical parts. Every change updates the active color immediately.</p>
            <div className="mixer-parts-list">
              {mixSlots.map((slot, index) => {
                const slotPaint = slot.paintId ? paints.find((paint) => paint.id === slot.paintId) : null;
                if (!slotPaint) return null;

                return (
                  <div key={`parts-${index}`} className="mixer-part-row">
                    <div>
                      <span style={swatch(slotPaint.hex)} />
                      <strong>{slotPaint.name}</strong>
                    </div>
                    <div className="mixer-part-controls">
                      <button type="button" onClick={() => setSlotParts(index, slot.parts - 1)}>-</button>
                      <b>{slot.parts}</b>
                      <button type="button" onClick={() => setSlotParts(index, slot.parts + 1)}>+</button>
                    </div>
                    <input type="range" min={1} max={12} value={slot.parts} onChange={(event) => setSlotParts(index, Number(event.target.value))} />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </Card>

      <aside className={`mixer-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="mixer-drawer-inner">
          <section className="mixer-drawer-left">
            <header>
              <p>Inverse calibration drawer</p>
              <h3>What should I mix to hit this target?</h3>
              <span>These controls tune how the solver chooses recipes inside your calibrated paint behavior.</span>
            </header>

            <div className="mixer-drawer-group">
              <h4>Exploration</h4>
              <CalibrationSlider label="maxComponents" value={calibrationSnapshot.inverseSearch.ratioSearch.maxComponents} min={1} max={4} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.maxComponents} onChange={(value) => updateInverseNumber('ratioSearch', 'maxComponents', value)} />
              <CalibrationSlider label="neighborhoodRadius" value={calibrationSnapshot.inverseSearch.ratioSearch.neighborhoodRadius} min={1} max={6} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.neighborhoodRadius} onChange={(value) => updateInverseNumber('ratioSearch', 'neighborhoodRadius', value)} />
              <CalibrationSlider label="familyBeamWidth" value={calibrationSnapshot.inverseSearch.global.familyBeamWidth} min={3} max={20} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.global.familyBeamWidth} onChange={(value) => updateInverseNumber('global', 'familyBeamWidth', value)} />
              <label className="mixer-inline-check"><span>Enable dark ratio families</span><input type="checkbox" checked={calibrationSnapshot.inverseSearch.ratioSearch.darkRatioFamiliesEnabled} onChange={(event) => updateInverseBoolean('ratioSearch', 'darkRatioFamiliesEnabled', event.target.checked)} /></label>
            </div>

            <div className="mixer-drawer-group">
              <h4>Ranking + practicality</h4>
              <CalibrationSlider label="practicalRatioHardMaxParts" value={calibrationSnapshot.inverseSearch.global.practicalRatioHardMaxParts} min={6} max={18} step={1} resetValue={defaultDeveloperCalibration.inverseSearch.global.practicalRatioHardMaxParts} onChange={(value) => updateInverseNumber('global', 'practicalRatioHardMaxParts', value)} />
              <CalibrationSlider label="workableMatchThreshold" value={calibrationSnapshot.inverseSearch.global.workableMatchThreshold} min={0.1} max={0.6} step={0.01} resetValue={defaultDeveloperCalibration.inverseSearch.global.workableMatchThreshold} onChange={(value) => updateInverseNumber('global', 'workableMatchThreshold', value)} />
              <CalibrationSlider label="cleanlinessPenalty" value={calibrationSnapshot.inverseSearch.mutedTargets.cleanlinessPenalty} min={0.5} max={4} step={0.1} resetValue={defaultDeveloperCalibration.inverseSearch.mutedTargets.cleanlinessPenalty} onChange={(value) => updateInverseNumber('mutedTargets', 'cleanlinessPenalty', value)} />
              <CalibrationSlider label="muddinessPenalty" value={calibrationSnapshot.inverseSearch.vividTargets.muddinessPenalty} min={0.5} max={4} step={0.1} resetValue={defaultDeveloperCalibration.inverseSearch.vividTargets.muddinessPenalty} onChange={(value) => updateInverseNumber('vividTargets', 'muddinessPenalty', value)} />
            </div>

            <div className="mixer-drawer-group">
              <h4>Advanced heuristics</h4>
              <label><span>darkTargets.minDarkShare</span><input className="studio-input" type="number" value={calibrationSnapshot.inverseSearch.darkTargets.minDarkShare} onChange={(event) => updateInverseNumber('darkTargets', 'minDarkShare', Number(event.target.value))} /></label>
              <label><span>darkTargets.maxYellowShare</span><input className="studio-input" type="number" value={calibrationSnapshot.inverseSearch.darkTargets.maxYellowShare} onChange={(event) => updateInverseNumber('darkTargets', 'maxYellowShare', Number(event.target.value))} /></label>
              <label><span>yellows.maxBlueShareLight</span><input className="studio-input" type="number" value={calibrationSnapshot.inverseSearch.yellows.maxBlueShareLight} onChange={(event) => updateInverseNumber('yellows', 'maxBlueShareLight', Number(event.target.value))} /></label>
              <label><span>greenTargets.vividOffHuePenalty</span><input className="studio-input" type="number" step="0.01" value={calibrationSnapshot.inverseSearch.greenTargets.vividOffHuePenalty} onChange={(event) => updateInverseNumber('greenTargets', 'vividOffHuePenalty', Number(event.target.value))} /></label>
            </div>

            <footer>
              <button className="studio-button" type="button" onClick={() => resetDeveloperCalibration()}>Reset calibration defaults</button>
            </footer>
          </section>

          <section className="mixer-drawer-right">
            <h4>Target + result</h4>
            <label>
              <span>Target color</span>
              <input className="studio-input" value={targetHex} onChange={(event) => setTargetHex(event.target.value)} placeholder="#7A8FB3" />
            </label>
            <input
              type="color"
              className="studio-color-input"
              value={normalizedTarget ?? '#000000'}
              onChange={(event) => {
                setTargetHex(event.target.value);
                onRecentColor(event.target.value);
              }}
            />
            <label>
              <span>Solve context</span>
              <select className="studio-select" value={settings.solveMode ?? 'on-hand'} onChange={(event) => onSettingsChange({ ...settings, solveMode: event.target.value as UserSettings['solveMode'] })}>
                {Object.entries(solveModeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <div className="mixer-result-swatches">
              <div>
                <p>Target</p>
                <span style={swatch(normalizedTarget)} />
                <small>{normalizedTarget ?? 'n/a'}</small>
              </div>
              <div>
                <p>Predicted</p>
                <span style={swatch(topRecipe?.predictedHex)} />
                <small>{topRecipe?.predictedHex ?? 'n/a'}</small>
              </div>
            </div>

            <p className="mixer-result-copy">
              Recipe: {topRecipe?.practicalRatioText ?? 'n/a'} · ΔE {targetDistance?.toFixed(3) ?? 'n/a'}
            </p>

            {topRecipe && normalizedTarget ? (
              <button type="button" className="studio-button studio-button-primary" onClick={() => onSaveRecipe(topRecipe, normalizedTarget)}>
                Save solver recipe
              </button>
            ) : null}

            {recentColors.length ? (
              <div className="mixer-recent-row">
                {recentColors.slice(0, 8).map((hex) => (
                  <button key={hex} type="button" onClick={() => setTargetHex(hex)}>
                    <span style={{ backgroundColor: hex }} />
                    {hex}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </aside>
    </div>
  );
};
