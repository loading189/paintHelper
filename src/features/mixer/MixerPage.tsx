import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import styles from './MixerPage.module.css';
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
const DEFAULT_OBSERVED = '#C2793E';
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

type DeltaTone = 'excellent' | 'good' | 'warning' | 'poor';
type StabilityTone = 'stable' | 'aggressive' | 'extreme';

const solveModeLabels: Record<'on-hand' | 'ideal', string> = {
  'on-hand': 'On-hand paints',
  ideal: 'Ideal palette',
};

const emptySlot = (): MixSlot => ({ paintId: null, parts: 1 });

const clampParts = (value: number) => Math.max(1, Math.min(24, Math.round(value) || 1));

const swatchStyle = (hex?: string | null): CSSProperties => ({
  backgroundColor: normalizeHex(hex ?? '') ?? '#131722',
});

const compareTone = (value: number | null): DeltaTone => {
  if (value == null) return 'warning';
  if (value <= 4) return 'excellent';
  if (value <= 8) return 'good';
  if (value <= 14) return 'warning';
  return 'poor';
};

const compareCopy = (value: number | null) => {
  if (value == null) return 'Waiting for both colors';
  if (value <= 4) return 'Very close';
  if (value <= 8) return 'Believable';
  if (value <= 14) return 'Still off';
  return 'Needs major correction';
};

const formatDelta = (value: number | null) => (value == null ? '—' : value.toFixed(2));

const sliderToneClass = (value: number, min: number, max: number, resetValue: number) => {
  const span = Math.max(Math.abs(max - resetValue), Math.abs(resetValue - min), 0.0001);
  const normalized = Math.abs(value - resetValue) / span;
  if (normalized < 0.33) return styles.sliderSafe;
  if (normalized < 0.66) return styles.sliderWarn;
  return styles.sliderHot;
};

const computePaintRisk = (
  paintId: string | null,
  calibrationSnapshot: ReturnType<typeof getDeveloperCalibration>,
) => {
  if (!paintId) return 0;

  const current =
    calibrationSnapshot.forwardPigments.paints[paintId] ??
    defaultDeveloperCalibration.forwardPigments.paints[paintId];

  const baseline =
    defaultDeveloperCalibration.forwardPigments.paints[paintId] ?? {
      tintingStrength: 1,
      darknessBias: 0,
      chromaBias: 0,
      earthStrengthBias: 0,
      whiteLiftBias: 0,
    };

  const normalizedDistances = [
    Math.abs((current.tintingStrength ?? 1) - (baseline.tintingStrength ?? 1)) / 0.4,
    Math.abs((current.darknessBias ?? 0) - (baseline.darknessBias ?? 0)) / 0.25,
    Math.abs((current.chromaBias ?? 0) - (baseline.chromaBias ?? 0)) / 0.25,
    Math.abs((current.earthStrengthBias ?? 0) - (baseline.earthStrengthBias ?? 0)) / 0.4,
    Math.abs((current.whiteLiftBias ?? 0) - (baseline.whiteLiftBias ?? 0)) / 0.2,
  ];

  return normalizedDistances.reduce((sum, value) => sum + value, 0) / normalizedDistances.length;
};

const computeGlobalStability = (calibrationSnapshot: ReturnType<typeof getDeveloperCalibration>) => {
  const ids = Object.keys(calibrationSnapshot.forwardPigments.paints);
  if (!ids.length) return 0;

  const scores = ids.map((paintId) => computePaintRisk(paintId, calibrationSnapshot));
  return scores.reduce((sum, value) => sum + value, 0) / scores.length;
};

const stabilityTone = (score: number): StabilityTone => {
  if (score < 0.35) return 'stable';
  if (score < 0.75) return 'aggressive';
  return 'extreme';
};

const stabilityCopy = (score: number) => {
  const tone = stabilityTone(score);
  if (tone === 'stable') return 'Stable';
  if (tone === 'aggressive') return 'Aggressive';
  return 'Extreme';
};

const stabilityNote = (score: number) => {
  const tone = stabilityTone(score);
  if (tone === 'stable') return 'Global pigment model is still healthy';
  if (tone === 'aggressive') return 'You are bending the model noticeably';
  return 'You are pushing the model to an extreme';
};

const CalibrationSlider = ({
  label,
  value,
  min,
  max,
  step,
  resetValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  resetValue: number;
  onChange: (value: number) => void;
}) => (
  <label className={styles.slider}>
    <div className={styles.sliderHeader}>
      <span>{label}</span>
      <button type="button" onClick={() => onChange(resetValue)}>
        Reset
      </button>
    </div>

    <div className={styles.sliderRail}>
      <input
        className={`${styles.sliderInput} ${sliderToneClass(value, min, max, resetValue)}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <strong>{value.toFixed(2)}</strong>
    </div>
  </label>
);

export const MixerPage = ({
  paints,
  settings,
  recentColors,
  onSettingsChange,
  onRecentColor,
  onSaveRecipe,
  onLoadTargetHex,
}: MixerPageProps) => {
  const enabledPaints = useMemo(() => paints.filter((paint) => paint.isEnabled), [paints]);
  const [calibrationSnapshot, setCalibrationSnapshot] = useState(() => getDeveloperCalibration());

  const [mixSlots, setMixSlots] = useState<MixSlot[]>(() => {
    const seeded = enabledPaints.slice(0, 3).map((paint, index) => ({
      paintId: paint.id,
      parts: index === 0 ? 2 : 1,
    }));
    return [...seeded, ...Array.from({ length: MAX_SLOTS - seeded.length }, () => emptySlot())];
  });

  const [selectedSlot, setSelectedSlot] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activePopupOpen, setActivePopupOpen] = useState(false);

  const [observedHex, setObservedHex] = useState(DEFAULT_OBSERVED);
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
        return enabledPaints.some((paint) => paint.id === slot.paintId) ? slot : emptySlot();
      });

      if (hydrated.some((slot) => slot.paintId)) return hydrated;

      const seeded = enabledPaints.slice(0, 3).map((paint, index) => ({
        paintId: paint.id,
        parts: index === 0 ? 2 : 1,
      }));

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
    () =>
      filledSlots.map((slot) => ({
        paintId: slot.paintId as string,
        weight: clampParts(slot.parts),
      })),
    [filledSlots],
  );

  const forwardPrediction = useMemo(() => {
    if (!forwardComponents.length) return null;
    return predictSpectralMix(paints, forwardComponents);
  }, [forwardComponents, paints, calibrationSnapshot]);

  const selectedPaintId = mixSlots[selectedSlot]?.paintId ?? null;
  const activePaintId = selectedPaintId ?? filledSlots[0]?.paintId ?? null;
  const activePaint = activePaintId
    ? enabledPaints.find((paint) => paint.id === activePaintId) ?? null
    : null;

  const activeCalibration = activePaintId
    ? calibrationSnapshot.forwardPigments.paints[activePaintId] ??
      defaultDeveloperCalibration.forwardPigments.paints[activePaintId]
    : null;

  const activeDefaults = activePaintId
    ? defaultDeveloperCalibration.forwardPigments.paints[activePaintId] ?? {
        tintingStrength: 1,
        darknessBias: 0,
        chromaBias: 0,
        earthStrengthBias: 0,
        whiteLiftBias: 0,
      }
    : null;

  const normalizedObserved = normalizeHex(observedHex);
  const normalizedTarget = normalizeHex(targetHex);
  const topRecipe = solveResult?.rankedRecipes[0] ?? null;

  const forwardDelta =
    normalizedObserved && forwardPrediction?.hex
      ? spectralDistanceBetweenHexes(normalizedObserved, forwardPrediction.hex)
      : null;

  const targetDistance =
    normalizedTarget && topRecipe
      ? spectralDistanceBetweenHexes(normalizedTarget, topRecipe.predictedHex)
      : null;

  const activePaintRisk = useMemo(
    () => computePaintRisk(activePaintId, calibrationSnapshot),
    [activePaintId, calibrationSnapshot],
  );

  const globalStability = useMemo(
    () => computeGlobalStability(calibrationSnapshot),
    [calibrationSnapshot],
  );

  const assignPaintToSlot = (paintId: string) => {
    setMixSlots((current) => {
      const next = [...current];
      const firstOpen = next.findIndex((slot) => !slot.paintId);
      const slotIndex = firstOpen >= 0 ? firstOpen : selectedSlot;

      next[slotIndex] = {
        paintId,
        parts: next[slotIndex].paintId ? next[slotIndex].parts : 1,
      };

      return next;
    });
  };

  const setSlotParts = (index: number, value: number) => {
    setMixSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, parts: clampParts(value) } : slot,
      ),
    );
  };

  const clearSlot = (index: number) => {
    setMixSlots((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? emptySlot() : slot)),
    );
    setActivePopupOpen(false);
  };

  const updateForward = (paintId: string, key: string, value: number) => {
    updateDeveloperCalibration({
      forwardPigments: {
        paints: {
          [paintId]: {
            ...(calibrationSnapshot.forwardPigments.paints[paintId] ??
              defaultDeveloperCalibration.forwardPigments.paints[paintId]),
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
    <div className={styles.page}>
      <Card className={styles.shell}>
        <button
          type="button"
          className={`${styles.drawerHandle} ${drawerOpen ? styles.drawerHandleOpen : ''}`}
          onClick={() => setDrawerOpen((current) => !current)}
        >
          {drawerOpen ? 'Close recipe tuning' : 'Open recipe tuning'}
        </button>

        <section className={styles.forwardSurface}>
          <header className={styles.heroHeader}>
            <p>Forward calibration</p>
            <h2>Compare what the model predicts to what your real mix actually made.</h2>
            <span>
              Build the exact real-world recipe below, choose the actual observed result, and then
              tune the active paint carefully without pushing the global model too far.
            </span>
          </header>

          <section className={styles.comparisonBand}>
            <div className={styles.comparisonColumn}>
              <span className={styles.columnEyebrow}>System Predicts</span>
              <div
                className={styles.heroCircle}
                style={
                  {
                    ...swatchStyle(forwardPrediction?.hex),
                    '--swatch-glow': forwardPrediction?.hex ?? '#5f78c5',
                  } as CSSProperties
                }
              />
              <strong>{forwardPrediction?.hex ?? 'Pick paints to start'}</strong>
              <small>Current forward model output</small>
            </div>

            <div className={styles.bridgeColumn}>
              <div className={`${styles.metricCard} ${styles[compareTone(forwardDelta)]}`}>
                <span>Match</span>
                <strong>ΔE {formatDelta(forwardDelta)}</strong>
                <small>{compareCopy(forwardDelta)}</small>
              </div>

              <div className={`${styles.metricCard} ${styles[stabilityTone(globalStability)]}`}>
                <span>Global stability</span>
                <strong>{stabilityCopy(globalStability)}</strong>
                <small>{stabilityNote(globalStability)}</small>
              </div>

              <div className={`${styles.metricCard} ${styles[stabilityTone(activePaintRisk)]}`}>
                <span>Active paint risk</span>
                <strong>{stabilityCopy(activePaintRisk)}</strong>
                <small>
                  {activePaint
                    ? `${activePaint.name} is the paint you are bending right now`
                    : 'Select a paint in your recipe'}
                </small>
              </div>

              <div className={styles.bridgeLine} aria-hidden="true" />
            </div>

            <div className={styles.comparisonColumn}>
              <span className={styles.columnEyebrow}>Actual Real Mix</span>
              <label className={styles.actualCircleButton}>
                <div
                  className={styles.heroCircle}
                  style={
                    {
                      ...swatchStyle(normalizedObserved),
                      '--swatch-glow': normalizedObserved ?? '#d78a57',
                    } as CSSProperties
                  }
                />
                <input
                  className={styles.colorInputOverlay}
                  type="color"
                  value={normalizedObserved ?? '#000000'}
                  onChange={(event) => {
                    setObservedHex(event.target.value);
                    onRecentColor(event.target.value);
                  }}
                />
              </label>
              <strong>{normalizedObserved ?? 'Pick observed color'}</strong>
              <small>What the physical mixture looked like</small>
            </div>
          </section>

          <section className={styles.calibrationStrip}>
            <div className={styles.calibrationStripHeader}>
              <div>
                <p>Tuning active paint</p>
                <h3>{activePaint?.name ?? 'Select a paint in your recipe'}</h3>
              </div>

              {activePaint ? (
                <button
                  type="button"
                  className={styles.calibrationToggle}
                  onClick={() => setActivePopupOpen((current) => !current)}
                >
                  {activePopupOpen ? 'Hide controls' : 'Adjust paint behavior'}
                </button>
              ) : null}
            </div>

            {activePopupOpen && activeCalibration && activeDefaults && activePaint ? (
              <div className={styles.calibrationPopup}>
                <div className={styles.popupIntro}>
                  <span
                    className={styles.popupSwatch}
                    style={swatchStyle(activePaint.hex)}
                    aria-hidden="true"
                  />
                  <div>
                    <strong>Tuning: {activePaint.name}</strong>
                    <small>
                      These controls change how this paint behaves globally in the model. Your job
                      is to improve this case without pushing the pigment world out of balance.
                    </small>
                  </div>
                </div>

                <div className={styles.sliderGrid}>
                  <CalibrationSlider
                    label="tintingStrength"
                    value={activeCalibration.tintingStrength}
                    min={0.75}
                    max={1.4}
                    step={0.01}
                    resetValue={activeDefaults.tintingStrength}
                    onChange={(value) => updateForward(activePaint.id, 'tintingStrength', value)}
                  />
                  <CalibrationSlider
                    label="chromaBias"
                    value={activeCalibration.chromaBias}
                    min={-0.25}
                    max={0.25}
                    step={0.01}
                    resetValue={activeDefaults.chromaBias}
                    onChange={(value) => updateForward(activePaint.id, 'chromaBias', value)}
                  />
                  <CalibrationSlider
                    label="darknessBias"
                    value={activeCalibration.darknessBias}
                    min={-0.25}
                    max={0.25}
                    step={0.01}
                    resetValue={activeDefaults.darknessBias}
                    onChange={(value) => updateForward(activePaint.id, 'darknessBias', value)}
                  />
                  <CalibrationSlider
                    label="earthStrengthBias"
                    value={activeCalibration.earthStrengthBias}
                    min={-0.3}
                    max={0.4}
                    step={0.01}
                    resetValue={activeDefaults.earthStrengthBias}
                    onChange={(value) =>
                      updateForward(activePaint.id, 'earthStrengthBias', value)
                    }
                  />
                  <CalibrationSlider
                    label="whiteLiftBias"
                    value={activeCalibration.whiteLiftBias}
                    min={-0.2}
                    max={0.2}
                    step={0.01}
                    resetValue={activeDefaults.whiteLiftBias}
                    onChange={(value) => updateForward(activePaint.id, 'whiteLiftBias', value)}
                  />
                </div>
              </div>
            ) : null}
          </section>

          <section className={styles.recipeBand}>
            <div className={styles.recipeBandHeader}>
              <div>
                <p>Real mix</p>
                <h3>Build the exact recipe you mixed in real life.</h3>
              </div>
              <span>
                These wells are the known cause. The comparison above is the effect you are trying
                to calibrate.
              </span>
            </div>

            <div className={styles.paintArcScroller}>
              <div
                className={styles.paintArcTrack}
                style={{ minWidth: `${Math.max(760, enabledPaints.length * 84)}px` }}
              >
                {enabledPaints.map((paint, index) => {
                  const angle =
                    enabledPaints.length === 1
                      ? 90
                      : 28 + (index / Math.max(1, enabledPaints.length - 1)) * 124;
                  const radius = 230;
                  const x = Math.cos((angle * Math.PI) / 180) * radius;
                  const y = Math.sin((angle * Math.PI) / 180) * radius;

                  return (
                    <button
                      type="button"
                      key={paint.id}
                      className={`${styles.arcPaint} ${
                        activePaintId === paint.id ? styles.arcPaintActive : ''
                      }`}
                      style={{
                        left: `calc(50% + ${x}px - 34px)`,
                        top: `calc(100% - ${y}px - 34px)`,
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

            <div className={styles.slotsGrid}>
              {mixSlots.map((slot, index) => {
                const slotPaint = slot.paintId
                  ? paints.find((paint) => paint.id === slot.paintId) ?? null
                  : null;

                return (
                  <button
                    type="button"
                    key={`slot-${index}`}
                    className={`${styles.slot} ${
                      selectedSlot === index ? styles.slotSelected : ''
                    } ${slot.paintId ? styles.slotFilled : ''}`}
                    onClick={() => {
                      setSelectedSlot(index);
                      setActivePopupOpen(false);
                    }}
                  >
                    <span className={styles.slotWell} style={swatchStyle(slotPaint?.hex ?? null)} />
                    <strong>{slotPaint?.name ?? `Empty well ${index + 1}`}</strong>
                    <small>
                      {slot.paintId
                        ? `${slot.parts} part${slot.parts > 1 ? 's' : ''}`
                        : 'Tap a paint above to fill'}
                    </small>

                    {slot.paintId ? (
                      <span
                        className={styles.slotClear}
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

            <div className={styles.partsPanel}>
              <div className={styles.partsHeader}>
                <div>
                  <p>Mix parts</p>
                  <h3>Adjust the real recipe in physical parts.</h3>
                </div>
              </div>

              <div className={styles.partsList}>
                {mixSlots.map((slot, index) => {
                  const slotPaint = slot.paintId
                    ? paints.find((paint) => paint.id === slot.paintId) ?? null
                    : null;

                  if (!slotPaint) return null;

                  return (
                    <div key={`parts-${index}`} className={styles.partRow}>
                      <div className={styles.partLabel}>
                        <span style={swatchStyle(slotPaint.hex)} />
                        <div>
                          <strong>{slotPaint.name}</strong>
                          <small>Slot {index + 1}</small>
                        </div>
                      </div>

                      <div className={styles.partStepper}>
                        <button type="button" onClick={() => setSlotParts(index, slot.parts - 1)}>
                          −
                        </button>
                        <b>{slot.parts}</b>
                        <button type="button" onClick={() => setSlotParts(index, slot.parts + 1)}>
                          +
                        </button>
                      </div>

                      <input
                        className={styles.partSlider}
                        type="range"
                        min={1}
                        max={12}
                        value={slot.parts}
                        onChange={(event) => setSlotParts(index, Number(event.target.value))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </section>
      </Card>

      <aside className={`${styles.drawer} ${drawerOpen ? styles.drawerOpen : ''}`}>
        <div className={styles.drawerInner}>
          <section className={styles.drawerLeft}>
            <header className={styles.drawerHeader}>
              <p>Recipe tuning</p>
              <h3>Tune how the solver chooses inside your calibrated paint world.</h3>
              <span>
                Stage 2 starts only after the forward model is believable. These controls affect
                recipe judgment — not paint behavior.
              </span>
            </header>

            <div className={styles.drawerGroup}>
              <h4>Exploration</h4>

              <CalibrationSlider
                label="maxComponents"
                value={calibrationSnapshot.inverseSearch.ratioSearch.maxComponents}
                min={1}
                max={4}
                step={1}
                resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.maxComponents}
                onChange={(value) => updateInverseNumber('ratioSearch', 'maxComponents', value)}
              />
              <CalibrationSlider
                label="neighborhoodRadius"
                value={calibrationSnapshot.inverseSearch.ratioSearch.neighborhoodRadius}
                min={1}
                max={6}
                step={1}
                resetValue={
                  defaultDeveloperCalibration.inverseSearch.ratioSearch.neighborhoodRadius
                }
                onChange={(value) =>
                  updateInverseNumber('ratioSearch', 'neighborhoodRadius', value)
                }
              />
              <CalibrationSlider
                label="familyBeamWidth"
                value={calibrationSnapshot.inverseSearch.global.familyBeamWidth}
                min={3}
                max={20}
                step={1}
                resetValue={defaultDeveloperCalibration.inverseSearch.global.familyBeamWidth}
                onChange={(value) => updateInverseNumber('global', 'familyBeamWidth', value)}
              />

              <label className={styles.inlineCheck}>
                <span>Enable dark ratio families</span>
                <input
                  type="checkbox"
                  checked={calibrationSnapshot.inverseSearch.ratioSearch.darkRatioFamiliesEnabled}
                  onChange={(event) =>
                    updateInverseBoolean(
                      'ratioSearch',
                      'darkRatioFamiliesEnabled',
                      event.target.checked,
                    )
                  }
                />
              </label>
            </div>

            <div className={styles.drawerGroup}>
              <h4>Ranking + practicality</h4>

              <CalibrationSlider
                label="practicalRatioHardMaxParts"
                value={calibrationSnapshot.inverseSearch.global.practicalRatioHardMaxParts}
                min={6}
                max={18}
                step={1}
                resetValue={
                  defaultDeveloperCalibration.inverseSearch.global.practicalRatioHardMaxParts
                }
                onChange={(value) =>
                  updateInverseNumber('global', 'practicalRatioHardMaxParts', value)
                }
              />
              <CalibrationSlider
                label="workableMatchThreshold"
                value={calibrationSnapshot.inverseSearch.global.workableMatchThreshold}
                min={0.1}
                max={0.6}
                step={0.01}
                resetValue={defaultDeveloperCalibration.inverseSearch.global.workableMatchThreshold}
                onChange={(value) =>
                  updateInverseNumber('global', 'workableMatchThreshold', value)
                }
              />
              <CalibrationSlider
                label="cleanlinessPenalty"
                value={calibrationSnapshot.inverseSearch.mutedTargets.cleanlinessPenalty}
                min={0.5}
                max={4}
                step={0.1}
                resetValue={
                  defaultDeveloperCalibration.inverseSearch.mutedTargets.cleanlinessPenalty
                }
                onChange={(value) =>
                  updateInverseNumber('mutedTargets', 'cleanlinessPenalty', value)
                }
              />
              <CalibrationSlider
                label="muddinessPenalty"
                value={calibrationSnapshot.inverseSearch.vividTargets.muddinessPenalty}
                min={0.5}
                max={4}
                step={0.1}
                resetValue={defaultDeveloperCalibration.inverseSearch.vividTargets.muddinessPenalty}
                onChange={(value) =>
                  updateInverseNumber('vividTargets', 'muddinessPenalty', value)
                }
              />
            </div>

            <div className={styles.drawerGroup}>
              <h4>Advanced heuristics</h4>

              <label className={styles.numericField}>
                <span>darkTargets.minDarkShare</span>
                <input
                  type="number"
                  value={calibrationSnapshot.inverseSearch.darkTargets.minDarkShare}
                  onChange={(event) =>
                    updateInverseNumber('darkTargets', 'minDarkShare', Number(event.target.value))
                  }
                />
              </label>

              <label className={styles.numericField}>
                <span>darkTargets.maxYellowShare</span>
                <input
                  type="number"
                  value={calibrationSnapshot.inverseSearch.darkTargets.maxYellowShare}
                  onChange={(event) =>
                    updateInverseNumber(
                      'darkTargets',
                      'maxYellowShare',
                      Number(event.target.value),
                    )
                  }
                />
              </label>

              <label className={styles.numericField}>
                <span>yellows.maxBlueShareLight</span>
                <input
                  type="number"
                  value={calibrationSnapshot.inverseSearch.yellows.maxBlueShareLight}
                  onChange={(event) =>
                    updateInverseNumber(
                      'yellows',
                      'maxBlueShareLight',
                      Number(event.target.value),
                    )
                  }
                />
              </label>

              <label className={styles.numericField}>
                <span>greenTargets.vividOffHuePenalty</span>
                <input
                  type="number"
                  step="0.01"
                  value={calibrationSnapshot.inverseSearch.greenTargets.vividOffHuePenalty}
                  onChange={(event) =>
                    updateInverseNumber(
                      'greenTargets',
                      'vividOffHuePenalty',
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>

            <footer className={styles.drawerFooter}>
              <button className={styles.resetButton} type="button" onClick={() => resetDeveloperCalibration()}>
                Reset calibration defaults
              </button>
            </footer>
          </section>

          <section className={styles.drawerRight}>
            <h4>Target + outcome</h4>

            <label className={styles.targetField}>
              <span>Target color</span>
              <input
                value={targetHex}
                onChange={(event) => setTargetHex(event.target.value)}
                placeholder="#7A8FB3"
              />
            </label>

            <input
              type="color"
              className={styles.targetColorInput}
              value={normalizedTarget ?? '#000000'}
              onChange={(event) => {
                setTargetHex(event.target.value);
                onRecentColor(event.target.value);
              }}
            />

            <label className={styles.targetField}>
              <span>Solve context</span>
              <select
                value={settings.solveMode ?? 'on-hand'}
                onChange={(event) =>
                  onSettingsChange({
                    ...settings,
                    solveMode: event.target.value as UserSettings['solveMode'],
                  })
                }
              >
                {Object.entries(solveModeLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.resultSwatches}>
              <div>
                <p>Target</p>
                <span style={swatchStyle(normalizedTarget)} />
                <small>{normalizedTarget ?? 'n/a'}</small>
              </div>
              <div>
                <p>Predicted</p>
                <span style={swatchStyle(topRecipe?.predictedHex)} />
                <small>{topRecipe?.predictedHex ?? 'n/a'}</small>
              </div>
            </div>

            <div className={`${styles.metricCard} ${styles[compareTone(targetDistance)]}`}>
              <span>Solver match</span>
              <strong>ΔE {formatDelta(targetDistance)}</strong>
              <small>{compareCopy(targetDistance)}</small>
            </div>

            <p className={styles.recipeCopy}>
              Recipe: {topRecipe?.practicalRatioText ?? 'n/a'}
            </p>

            {topRecipe && normalizedTarget ? (
              <button
                type="button"
                className={styles.saveButton}
                onClick={() => onSaveRecipe(topRecipe, normalizedTarget)}
              >
                Save solver recipe
              </button>
            ) : null}

            {recentColors.length ? (
              <div className={styles.recentRow}>
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