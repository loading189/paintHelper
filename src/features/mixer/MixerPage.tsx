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

const MAX_SLOTS = 4;
const DEFAULT_OBSERVED = '#C2793E';
const REALITY_STORAGE_KEY = 'mixer.reality.v1';

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

type LockedReality = {
  slots: MixSlot[];
  observedHex: string;
  lockedAt: string;
};

type DeltaTone = 'excellent' | 'good' | 'warning' | 'poor';

const emptySlot = (): MixSlot => ({ paintId: null, parts: 1 });

const clampParts = (value: number) => Math.max(1, Math.min(24, Math.round(value) || 1));

const swatchStyle = (hex?: string | null): CSSProperties => ({
  backgroundColor: normalizeHex(hex ?? '') ?? '#10131b',
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
  if (value <= 4) return 'Almost indistinguishable';
  if (value <= 8) return 'Convincingly close';
  if (value <= 14) return 'Still visibly apart';
  return 'Far from reality';
};

const formatDelta = (value: number | null) => (value == null ? '—' : value.toFixed(2));

const compareLinkClass = (value: number | null) => {
  if (value == null) return styles.compareLinkFar;
  if (value <= 6) return styles.compareLinkClose;
  if (value <= 12) return styles.compareLinkMid;
  return styles.compareLinkFar;
};

const compareLinkStrength = (value: number | null) => {
  if (value == null) return 0.2;
  return Math.max(0.14, Math.min(0.96, 1 - value / 20));
};

const sliderToneClass = (value: number, min: number, max: number, resetValue: number) => {
  const span = Math.max(Math.abs(max - resetValue), Math.abs(resetValue - min), 0.0001);
  const normalized = Math.abs(value - resetValue) / span;
  if (normalized < 0.33) return styles.sliderSafe;
  if (normalized < 0.66) return styles.sliderWarn;
  return styles.sliderHot;
};

const toForwardComponents = (slots: MixSlot[]) =>
  slots
    .filter((slot) => slot.paintId)
    .map((slot) => ({ paintId: slot.paintId as string, weight: clampParts(slot.parts) }));

const ratioSignature = (slots: MixSlot[]) => {
  const total = slots.reduce((sum, slot) => sum + (slot.paintId ? clampParts(slot.parts) : 0), 0);
  if (!total) return 'n/a';
  return slots
    .filter((slot) => slot.paintId)
    .map((slot) => `${slot.paintId}:${((clampParts(slot.parts) / total) * 100).toFixed(0)}%`)
    .join(' · ');
};

const calibrationDefaults = {
  tintingStrength: 1,
  darknessBias: 0,
  chromaBias: 0,
  earthStrengthBias: 0,
  whiteLiftBias: 0,
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

  const [stageOneSlots, setStageOneSlots] = useState<MixSlot[]>(() =>
    Array.from({ length: MAX_SLOTS }, () => emptySlot()),
  );
  const [stageOneObservedHex, setStageOneObservedHex] = useState(onLoadTargetHex ?? DEFAULT_OBSERVED);
  const [lockedReality, setLockedReality] = useState<LockedReality | null>(null);
  const [activeForwardPaintId, setActiveForwardPaintId] = useState<string | null>(null);
  const [showForwardControls, setShowForwardControls] = useState(true);
  const [stage3Open, setStage3Open] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeDeveloperCalibration((next) => setCalibrationSnapshot(next));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!enabledPaints.length) {
      setStageOneSlots(Array.from({ length: MAX_SLOTS }, () => emptySlot()));
      return;
    }

    setStageOneSlots((current) => {
      const hasAssigned = current.some((slot) => slot.paintId);
      if (hasAssigned) {
        return current.map((slot) =>
          slot.paintId && !enabledPaints.some((paint) => paint.id === slot.paintId) ? emptySlot() : slot,
        );
      }

      const seeded = enabledPaints.slice(0, 3).map((paint, index) => ({
        paintId: paint.id,
        parts: index === 0 ? 2 : 1,
      }));

      return [...seeded, ...Array.from({ length: MAX_SLOTS - seeded.length }, () => emptySlot())];
    });
  }, [enabledPaints]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(REALITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as LockedReality;
      if (!parsed?.slots?.length) return;
      setLockedReality({
        slots: parsed.slots.slice(0, MAX_SLOTS).map((slot) => ({
          paintId: slot.paintId,
          parts: clampParts(slot.parts),
        })),
        observedHex: normalizeHex(parsed.observedHex) ?? DEFAULT_OBSERVED,
        lockedAt: parsed.lockedAt ?? new Date().toISOString(),
      });
      setStageOneSlots(parsed.slots.slice(0, MAX_SLOTS));
      setStageOneObservedHex(normalizeHex(parsed.observedHex) ?? DEFAULT_OBSERVED);
    } catch {
      // noop
    }
  }, []);

  const stageOneFilledCount = useMemo(
    () => stageOneSlots.filter((slot) => slot.paintId).length,
    [stageOneSlots],
  );

  const stageOneValid = stageOneFilledCount > 0 && Boolean(normalizeHex(stageOneObservedHex));

  const lockedComponents = useMemo(
    () => (lockedReality ? toForwardComponents(lockedReality.slots) : []),
    [lockedReality],
  );

  const predictedMix = useMemo(() => {
    if (!lockedComponents.length) return null;
    return predictSpectralMix(paints, lockedComponents);
  }, [paints, lockedComponents, calibrationSnapshot]);

  const normalizedObserved = normalizeHex(lockedReality?.observedHex ?? stageOneObservedHex);
  const forwardDelta =
    normalizedObserved && predictedMix?.hex
      ? spectralDistanceBetweenHexes(normalizedObserved, predictedMix.hex)
      : null;

  const stageTwoBelievable = forwardDelta != null && forwardDelta <= 8;

  useEffect(() => {
    if (stageTwoBelievable) setStage3Open(true);
  }, [stageTwoBelievable]);

  const lockedPaints = useMemo(
    () =>
      lockedComponents
        .map((component) => enabledPaints.find((paint) => paint.id === component.paintId) ?? null)
        .filter((paint): paint is Paint => Boolean(paint)),
    [lockedComponents, enabledPaints],
  );

  useEffect(() => {
    if (!lockedPaints.length) {
      setActiveForwardPaintId(null);
      return;
    }

    setActiveForwardPaintId((current) =>
      current && lockedPaints.some((paint) => paint.id === current) ? current : lockedPaints[0].id,
    );
  }, [lockedPaints]);

  const activeForwardPaint = useMemo(
    () =>
      activeForwardPaintId
        ? lockedPaints.find((paint) => paint.id === activeForwardPaintId) ?? null
        : null,
    [lockedPaints, activeForwardPaintId],
  );

  const activeCalibration =
    activeForwardPaintId
      ? calibrationSnapshot.forwardPigments.paints[activeForwardPaintId] ??
        defaultDeveloperCalibration.forwardPigments.paints[activeForwardPaintId] ??
        calibrationDefaults
      : null;

  const activeCalibrationDefaults =
    activeForwardPaintId
      ? defaultDeveloperCalibration.forwardPigments.paints[activeForwardPaintId] ?? calibrationDefaults
      : null;

  const inverseTargetHex = normalizeHex(lockedReality?.observedHex ?? '') ?? null;
  const inverseResult = useMemo(() => {
    if (!inverseTargetHex) return null;
    return solveColorTarget(inverseTargetHex, paints, settings, 8);
  }, [inverseTargetHex, paints, settings, calibrationSnapshot]);

  const topRecipe = inverseResult?.rankedRecipes[0] ?? null;
  const inverseDelta =
    inverseTargetHex && topRecipe
      ? spectralDistanceBetweenHexes(inverseTargetHex, topRecipe.predictedHex)
      : null;

  const realitySignature = useMemo(() => ratioSignature(lockedReality?.slots ?? []), [lockedReality]);

  const updateStageSlot = (index: number, patch: Partial<MixSlot>) => {
    setStageOneSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index
          ? {
              paintId: patch.paintId === undefined ? slot.paintId : patch.paintId,
              parts: patch.parts === undefined ? slot.parts : clampParts(patch.parts),
            }
          : slot,
      ),
    );
  };

  const lockReality = () => {
    const normalized = normalizeHex(stageOneObservedHex);
    if (!normalized) return;

    const payload: LockedReality = {
      slots: stageOneSlots.map((slot) => ({ paintId: slot.paintId, parts: clampParts(slot.parts) })),
      observedHex: normalized,
      lockedAt: new Date().toISOString(),
    };

    setLockedReality(payload);
    setStage3Open(false);
    localStorage.setItem(REALITY_STORAGE_KEY, JSON.stringify(payload));
  };

  const unlockReality = () => {
    if (!lockedReality) return;
    setStageOneSlots(lockedReality.slots);
    setStageOneObservedHex(lockedReality.observedHex);
    setLockedReality(null);
    setStage3Open(false);
    localStorage.removeItem(REALITY_STORAGE_KEY);
  };

  const updateForward = (paintId: string, key: string, value: number) => {
    updateDeveloperCalibration({
      forwardPigments: {
        paints: {
          [paintId]: {
            ...(calibrationSnapshot.forwardPigments.paints[paintId] ??
              defaultDeveloperCalibration.forwardPigments.paints[paintId] ??
              calibrationDefaults),
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

  return (
    <div className={styles.page}>
      <Card className={styles.shell}>
        <header className={styles.pageHeader}>
          <p className={styles.kicker}>Guided calibration journey</p>
          <h1>Mixer calibration in three stages</h1>
          <p className={styles.intro}>Build reality, align the predicted color, then tune how the system rediscovers your recipe.</p>
          <div className={styles.stageRail}>
            <div className={`${styles.stageChip} ${styles.stageChipActive}`}>1 · Build Reality</div>
            <div className={`${styles.stageChip} ${lockedReality ? styles.stageChipActive : ''}`}>2 · Match the Color</div>
            <div className={`${styles.stageChip} ${stage3Open ? styles.stageChipActive : ''}`}>3 · Match the Recipe</div>
          </div>
        </header>

        <section className={`${styles.stageSection} ${lockedReality ? styles.stageOneLocked : ''}`}>
          <div className={styles.stageHeader}>
            <div>
              <p>Stage 1</p>
              <h2>Build reality</h2>
            </div>
            <span>Capture what you really mixed and the exact color it produced.</span>
          </div>

          <div className={styles.slotGrid}>
            {stageOneSlots.map((slot, index) => {
              const slotPaint = slot.paintId
                ? enabledPaints.find((paint) => paint.id === slot.paintId) ?? null
                : null;

              return (
                <article className={styles.slotCard} key={`stage-slot-${index}`}>
                  <div className={styles.slotTop}>
                    <span className={styles.slotOrb} style={swatchStyle(slotPaint?.hex)} />
                    <div>
                      <strong>{slotPaint?.name ?? `Paint slot ${index + 1}`}</strong>
                      <small>{slotPaint ? 'Active paint' : 'Select a paint'}</small>
                    </div>
                  </div>

                  <select
                    className={styles.slotSelect}
                    value={slot.paintId ?? ''}
                    onChange={(event) => updateStageSlot(index, { paintId: event.target.value || null })}
                  >
                    <option value="">Empty slot</option>
                    {enabledPaints.map((paint) => (
                      <option value={paint.id} key={`${paint.id}-${index}`}>
                        {paint.name}
                      </option>
                    ))}
                  </select>

                  <div className={styles.partsRow}>
                    <button type="button" onClick={() => updateStageSlot(index, { parts: slot.parts - 1 })}>−</button>
                    <b>{slot.parts}</b>
                    <button type="button" onClick={() => updateStageSlot(index, { parts: slot.parts + 1 })}>+</button>
                  </div>

                  <input
                    className={styles.partsSlider}
                    type="range"
                    min={1}
                    max={16}
                    value={slot.parts}
                    onChange={(event) => updateStageSlot(index, { parts: Number(event.target.value) })}
                  />
                </article>
              );
            })}
          </div>

          <div className={styles.realityBar}>
            <label className={styles.realityColorBlock}>
              <span>What did it become?</span>
              <div className={styles.realityColorButton}>
                <span
                  className={styles.realityColorBubble}
                  style={{
                    ...swatchStyle(stageOneObservedHex),
                    '--swatch-glow': normalizeHex(stageOneObservedHex) ?? '#C2793E',
                  } as CSSProperties}
                />
                <input
                  type="color"
                  value={normalizeHex(stageOneObservedHex) ?? '#000000'}
                  onChange={(event) => {
                    setStageOneObservedHex(event.target.value);
                    onRecentColor(event.target.value);
                  }}
                />
                <strong>{normalizeHex(stageOneObservedHex) ?? 'Pick color'}</strong>
              </div>
            </label>

            <button type="button" className={styles.lockButton} onClick={lockReality} disabled={!stageOneValid}>
              Seal this reality
            </button>
          </div>

          {recentColors.length ? (
            <div className={styles.recentRow}>
              {recentColors.slice(0, 6).map((hex) => (
                <button key={`recent-${hex}`} type="button" onClick={() => setStageOneObservedHex(hex)}>
                  <span style={{ backgroundColor: hex }} />
                  {hex}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {lockedReality ? (
          <section className={`${styles.stageSection} ${styles.stageTwo}`}>
            <div className={styles.stageHeader}>
              <div>
                <p>Stage 2</p>
                <h2>Match the color</h2>
              </div>
              <span>The recipe is now fixed. Tune forward pigment behavior until predicted and actual align.</span>
            </div>

            <div className={styles.heroCompare}>
              <div className={styles.arcLayer}>
                {lockedPaints.map((paint, index) => {
                  const spread = lockedPaints.length === 1 ? 90 : 32 + (index / Math.max(1, lockedPaints.length - 1)) * 116;
                  return (
                    <button
                      key={`arc-${paint.id}`}
                      type="button"
                      className={`${styles.arcPaint} ${activeForwardPaintId === paint.id ? styles.arcPaintActive : ''}`}
                      style={{
                        '--paint-hex': paint.hex,
                        '--arc-angle': `${spread}deg`,
                      } as CSSProperties}
                      onClick={() => setActiveForwardPaintId(paint.id)}
                    >
                      <span>{paint.name}</span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.compareRow}>
                <div
                  className={`${styles.compareLink} ${compareLinkClass(forwardDelta)}`}
                  style={{ '--link-strength': compareLinkStrength(forwardDelta) } as CSSProperties}
                />
                <div className={styles.compareCol}>
                  <small>What you mixed</small>
                  <div
                    className={styles.heroCircle}
                    style={{
                      ...swatchStyle(lockedReality.observedHex),
                      '--swatch-glow': lockedReality.observedHex,
                    } as CSSProperties}
                  />
                  <strong>{lockedReality.observedHex}</strong>
                </div>

                <div className={styles.heroBridge}>
                  <div className={`${styles.metricCard} ${styles[compareTone(forwardDelta)]}`}>
                    <span>Alignment</span>
                    <strong>ΔE {formatDelta(forwardDelta)}</strong>
                    <small>{compareCopy(forwardDelta)}</small>
                  </div>
                  <div className={styles.fixedRecipeTag}>Locked recipe · {realitySignature}</div>
                </div>

                <div className={styles.compareCol}>
                  <small>What the model sees</small>
                  <div
                    className={styles.heroCircle}
                    style={{
                      ...swatchStyle(predictedMix?.hex),
                      '--swatch-glow': predictedMix?.hex ?? '#5f78c5',
                    } as CSSProperties}
                  />
                  <strong>{predictedMix?.hex ?? '—'}</strong>
                </div>
              </div>
            </div>

            <section className={styles.forwardRail}>
              <div className={styles.forwardRailHead}>
                <div>
                  <p>Teach the paint</p>
                  <h3>{activeForwardPaint?.name ?? 'Select a paint around the hero'}</h3>
                </div>
                <button type="button" onClick={() => setShowForwardControls((current) => !current)}>
                  {showForwardControls ? 'Soften panel' : 'Open panel'}
                </button>
              </div>

              {showForwardControls && activeForwardPaint && activeCalibration && activeCalibrationDefaults ? (
                <div className={styles.sliderGrid}>
                  <CalibrationSlider
                    label="Tinting strength"
                    value={activeCalibration.tintingStrength}
                    min={0.75}
                    max={1.4}
                    step={0.01}
                    resetValue={activeCalibrationDefaults.tintingStrength}
                    onChange={(value) => updateForward(activeForwardPaint.id, 'tintingStrength', value)}
                  />
                  <CalibrationSlider
                    label="Chroma bias"
                    value={activeCalibration.chromaBias}
                    min={-0.25}
                    max={0.25}
                    step={0.01}
                    resetValue={activeCalibrationDefaults.chromaBias}
                    onChange={(value) => updateForward(activeForwardPaint.id, 'chromaBias', value)}
                  />
                  <CalibrationSlider
                    label="Darkness bias"
                    value={activeCalibration.darknessBias}
                    min={-0.25}
                    max={0.25}
                    step={0.01}
                    resetValue={activeCalibrationDefaults.darknessBias}
                    onChange={(value) => updateForward(activeForwardPaint.id, 'darknessBias', value)}
                  />
                  <CalibrationSlider
                    label="Earth strength bias"
                    value={activeCalibration.earthStrengthBias}
                    min={-0.3}
                    max={0.4}
                    step={0.01}
                    resetValue={activeCalibrationDefaults.earthStrengthBias}
                    onChange={(value) => updateForward(activeForwardPaint.id, 'earthStrengthBias', value)}
                  />
                  <CalibrationSlider
                    label="White lift bias"
                    value={activeCalibration.whiteLiftBias}
                    min={-0.2}
                    max={0.2}
                    step={0.01}
                    resetValue={activeCalibrationDefaults.whiteLiftBias}
                    onChange={(value) => updateForward(activeForwardPaint.id, 'whiteLiftBias', value)}
                  />
                </div>
              ) : null}
            </section>

            <div className={styles.stageTwoActions}>
              <button type="button" className={styles.secondaryButton} onClick={unlockReality}>
                Reopen stage 1
              </button>
              <button type="button" className={styles.secondaryButton} onClick={() => resetDeveloperCalibration()}>
                Reset all tuning
              </button>
              <button
                type="button"
                className={`${styles.primaryButton} ${stage3Open ? styles.primaryButtonLive : ''}`}
                onClick={() => setStage3Open((current) => !current)}
              >
                {stage3Open ? 'Fold stage 3' : 'Continue to stage 3'}
              </button>
            </div>
          </section>
        ) : null}

        {lockedReality && stage3Open ? (
          <section className={`${styles.stageSection} ${styles.stageThree}`}>
            <div className={styles.stageHeader}>
              <div>
                <p>Stage 3</p>
                <h2>Match the recipe</h2>
              </div>
              <span>Now tune inverse search behavior so the solver can rediscover the same or equivalent recipe.</span>
            </div>

            <div className={styles.recipeCompareGrid}>
              <article className={styles.recipePanel}>
                <h4>Locked recipe memory</h4>
                <p>{realitySignature}</p>
              </article>
              <article className={styles.recipePanel}>
                <h4>System interpretation</h4>
                <p>{topRecipe?.practicalRatioText ?? 'No result yet'}</p>
              </article>
              <article className={styles.recipePanel}>
                <h4>How close they feel</h4>
                <p>ΔE {formatDelta(inverseDelta)} · {compareCopy(inverseDelta)}</p>
              </article>
            </div>

            <div className={styles.inverseGrid}>
              <div className={styles.inverseGroup}>
                <h5>How should the system explore?</h5>
                <CalibrationSlider
                  label="Max components"
                  value={calibrationSnapshot.inverseSearch.ratioSearch.maxComponents}
                  min={1}
                  max={4}
                  step={1}
                  resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.maxComponents}
                  onChange={(value) => updateInverseNumber('ratioSearch', 'maxComponents', value)}
                />
                <CalibrationSlider
                  label="Neighborhood radius"
                  value={calibrationSnapshot.inverseSearch.ratioSearch.neighborhoodRadius}
                  min={1}
                  max={6}
                  step={1}
                  resetValue={defaultDeveloperCalibration.inverseSearch.ratioSearch.neighborhoodRadius}
                  onChange={(value) => updateInverseNumber('ratioSearch', 'neighborhoodRadius', value)}
                />
                <CalibrationSlider
                  label="Family beam width"
                  value={calibrationSnapshot.inverseSearch.global.familyBeamWidth}
                  min={3}
                  max={20}
                  step={1}
                  resetValue={defaultDeveloperCalibration.inverseSearch.global.familyBeamWidth}
                  onChange={(value) => updateInverseNumber('global', 'familyBeamWidth', value)}
                />
              </div>

              <div className={styles.inverseGroup}>
                <h5>How should the system think?</h5>
                <CalibrationSlider
                  label="Practical max parts"
                  value={calibrationSnapshot.inverseSearch.global.practicalRatioHardMaxParts}
                  min={6}
                  max={18}
                  step={1}
                  resetValue={defaultDeveloperCalibration.inverseSearch.global.practicalRatioHardMaxParts}
                  onChange={(value) => updateInverseNumber('global', 'practicalRatioHardMaxParts', value)}
                />
                <CalibrationSlider
                  label="Workable match threshold"
                  value={calibrationSnapshot.inverseSearch.global.workableMatchThreshold}
                  min={0.1}
                  max={0.6}
                  step={0.01}
                  resetValue={defaultDeveloperCalibration.inverseSearch.global.workableMatchThreshold}
                  onChange={(value) => updateInverseNumber('global', 'workableMatchThreshold', value)}
                />
                <CalibrationSlider
                  label="Cleanliness penalty"
                  value={calibrationSnapshot.inverseSearch.mutedTargets.cleanlinessPenalty}
                  min={0.5}
                  max={4}
                  step={0.1}
                  resetValue={defaultDeveloperCalibration.inverseSearch.mutedTargets.cleanlinessPenalty}
                  onChange={(value) => updateInverseNumber('mutedTargets', 'cleanlinessPenalty', value)}
                />
                <CalibrationSlider
                  label="Muddiness penalty"
                  value={calibrationSnapshot.inverseSearch.vividTargets.muddinessPenalty}
                  min={0.5}
                  max={4}
                  step={0.1}
                  resetValue={defaultDeveloperCalibration.inverseSearch.vividTargets.muddinessPenalty}
                  onChange={(value) => updateInverseNumber('vividTargets', 'muddinessPenalty', value)}
                />
              </div>
            </div>

            <div className={styles.stageThreeFooter}>
              <label>
                <span>Reasoning mode</span>
                <select
                  value={settings.solveMode ?? 'on-hand'}
                  onChange={(event) =>
                    onSettingsChange({
                      ...settings,
                      solveMode: event.target.value as UserSettings['solveMode'],
                    })
                  }
                >
                  <option value="on-hand">On-hand paints</option>
                  <option value="ideal">Ideal palette</option>
                </select>
              </label>

              {topRecipe && inverseTargetHex ? (
                <button type="button" className={styles.lockButton} onClick={() => onSaveRecipe(topRecipe, inverseTargetHex)}>
                  Save this rediscovered recipe
                </button>
              ) : null}
            </div>
          </section>
        ) : null}
      </Card>
    </div>
  );
};
