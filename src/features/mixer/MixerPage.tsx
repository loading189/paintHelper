import React, { useEffect, useMemo, useState } from 'react';
import styles from './MixerPage.module.css';

type StageKey = 'build' | 'matchColor' | 'matchRecipe';

type PaintOption = {
  id: string;
  name: string;
  hex: string;
};

type RealitySlot = {
  paintId: string;
  parts: number;
};

type LockedReality = {
  slots: RealitySlot[];
  actualHex: string;
};

type ForwardTuning = {
  tintingStrength: number;
  chromaBias: number;
  darknessBias: number;
  temperatureBias: number;
};

type InverseTuning = {
  ratioPenalty: number;
  complexityPenalty: number;
  exactMatchBias: number;
  hueFamilyBias: number;
};

type SolverRecipeItem = {
  paintId: string;
  parts: number;
};

type SolveColorTargetResult = {
  recipe: SolverRecipeItem[];
  predictedHex: string;
};

const MAX_SLOTS = 4;

const DEMO_PAINTS: PaintOption[] = [
  { id: 'cad-yellow', name: 'Cadmium Yellow', hex: '#d6a11c' },
  { id: 'ultra-blue', name: 'Ultramarine', hex: '#314a8a' },
  { id: 'mars-black', name: 'Mars Black', hex: '#1c1718' },
  { id: 'burnt-umber', name: 'Burnt Umber', hex: '#6d4733' },
  { id: 'alizarin', name: 'Alizarin Crimson', hex: '#8a2946' },
  { id: 'titanium-white', name: 'Titanium White', hex: '#f2ede4' },
];

const DEFAULT_FORWARD_TUNING: ForwardTuning = {
  tintingStrength: 1,
  chromaBias: 0,
  darknessBias: 0,
  temperatureBias: 0,
};

const DEFAULT_INVERSE_TUNING: InverseTuning = {
  ratioPenalty: 0.45,
  complexityPenalty: 0.5,
  exactMatchBias: 0.7,
  hueFamilyBias: 0.55,
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '').trim();
  if (normalized.length !== 6) return { r: 128, g: 128, b: 128 };
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const toHex = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexesWeighted(colors: { hex: string; weight: number }[]) {
  const total = colors.reduce((sum, c) => sum + c.weight, 0) || 1;
  const mixed = colors.reduce(
    (acc, item) => {
      const rgb = hexToRgb(item.hex);
      const w = item.weight / total;
      return {
        r: acc.r + rgb.r * w,
        g: acc.g + rgb.g * w,
        b: acc.b + rgb.b * w,
      };
    },
    { r: 0, g: 0, b: 0 }
  );
  return rgbToHex(mixed.r, mixed.g, mixed.b);
}

function shiftHexWithBias(hex: string, tuning: ForwardTuning) {
  const { r, g, b } = hexToRgb(hex);

  const tint = tuning.tintingStrength;
  const chroma = tuning.chromaBias * 22;
  const darkness = tuning.darknessBias * 32;
  const temp = tuning.temperatureBias * 18;

  const nr = clamp(r + temp + chroma - darkness + (tint - 1) * 8, 0, 255);
  const ng = clamp(g + (tint - 1) * 5 - darkness * 0.4, 0, 255);
  const nb = clamp(b - temp + chroma - darkness + (tint - 1) * 8, 0, 255);

  return rgbToHex(nr, ng, nb);
}

function colorDistance(a: string, b: string) {
  const aa = hexToRgb(a);
  const bb = hexToRgb(b);
  const dr = aa.r - bb.r;
  const dg = aa.g - bb.g;
  const db = aa.b - bb.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function formatDistanceLabel(distance: number) {
  if (distance < 10) return 'nearly aligned';
  if (distance < 24) return 'very close';
  if (distance < 40) return 'close';
  if (distance < 60) return 'approaching';
  return 'still drifting';
}

function getBridgeStrength(distance: number) {
  return clamp(1 - distance / 80, 0.12, 1);
}

function getPaintById(paints: PaintOption[], id: string) {
  return paints.find((p) => p.id === id) ?? null;
}

function buildArcPositions(count: number) {
  const radiusX = 32;
  const radiusY = 19;
  const start = -168;
  const end = -12;

  if (count <= 1) {
    return [{ x: -28, y: -16 }];
  }

  return Array.from({ length: count }).map((_, i) => {
    const t = i / (count - 1);
    const angle = ((start + (end - start) * t) * Math.PI) / 180;

    return {
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
    };
  });
}

/**
 * Replace with your real forward predictor.
 */
function predictForwardColor(args: {
  paints: PaintOption[];
  reality: LockedReality;
  forwardTuningByPaintId: Record<string, ForwardTuning>;
}) {
  const weighted = args.reality.slots
    .filter((slot) => slot.paintId && slot.parts > 0)
    .map((slot) => {
      const paint = getPaintById(args.paints, slot.paintId);
      const tuning = args.forwardTuningByPaintId[slot.paintId] ?? DEFAULT_FORWARD_TUNING;
      return {
        hex: shiftHexWithBias(paint?.hex ?? '#777777', tuning),
        weight: slot.parts,
      };
    });

  return mixHexesWeighted(weighted);
}

/**
 * Replace with your real solveColorTarget(...) call.
 */
function solveColorTargetDemo(args: {
  paints: PaintOption[];
  targetHex: string;
  inverseTuning: InverseTuning;
  lockedReality: LockedReality;
}): SolveColorTargetResult {
  const target = args.targetHex;
  const predictedHex = target;
  const realityRecipe = args.lockedReality.slots.filter((s) => s.paintId && s.parts > 0);

  const drift =
    args.inverseTuning.complexityPenalty > 0.65 || args.inverseTuning.exactMatchBias < 0.5;

  const recipe = drift
    ? realityRecipe.length > 1
      ? [
          realityRecipe[0],
          { paintId: realityRecipe[1].paintId, parts: Math.max(1, realityRecipe[1].parts - 1) },
          {
            paintId: realityRecipe[realityRecipe.length - 1].paintId,
            parts: 1,
          },
        ]
      : realityRecipe
    : realityRecipe;

  return { recipe, predictedHex };
}

function recipeToString(recipe: SolverRecipeItem[], paints: PaintOption[]) {
  return recipe
    .filter((item) => item.paintId && item.parts > 0)
    .map(
      (item) =>
        `${item.parts} part${item.parts > 1 ? 's' : ''} ${getPaintById(paints, item.paintId)?.name ?? 'Unknown'}`
    )
    .join(' · ');
}

function ProgressDots({
  current,
  unlocked,
  onJump,
}: {
  current: StageKey;
  unlocked: StageKey[];
  onJump: (stage: StageKey) => void;
}) {
  const stages: { key: StageKey; label: string; short: string }[] = [
    { key: 'build', label: 'Build Reality', short: '01' },
    { key: 'matchColor', label: 'Match the Color', short: '02' },
    { key: 'matchRecipe', label: 'Match the Recipe', short: '03' },
  ];

  return (
    <div className={styles.progressRail}>
      {stages.map((stage) => {
        const isActive = stage.key === current;
        const isUnlocked = unlocked.includes(stage.key);
        return (
          <button
            key={stage.key}
            type="button"
            onClick={() => isUnlocked && onJump(stage.key)}
            className={[
              styles.progressStep,
              isActive ? styles.progressStepActive : '',
              isUnlocked ? styles.progressStepUnlocked : '',
            ].join(' ')}
            disabled={!isUnlocked}
          >
            <span className={styles.progressIndex}>{stage.short}</span>
            <span className={styles.progressLabel}>{stage.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PaintArcButton({
  paint,
  index,
  total,
  active,
  onClick,
}: {
  paint: PaintOption;
  index: number;
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  const positions = buildArcPositions(total);
  const pos = positions[index];

  return (
    <button
      type="button"
      className={[styles.arcPaint, active ? styles.arcPaintActive : ''].join(' ')}
      style={
        {
          '--arc-x': `${pos.x}rem`,
          '--arc-y': `${pos.y}rem`,
          '--paint-glow': paint.hex,
        } as React.CSSProperties
      }
      onClick={onClick}
      title={paint.name}
    >
      <span className={styles.arcPaintSwatch} style={{ background: paint.hex }} />
      <span className={styles.arcPaintLabel}>{paint.name}</span>
    </button>
  );
}

function TuningSlider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className={styles.tuningField}>
      <div className={styles.tuningFieldTop}>
        <span>{label}</span>
        <strong>{value.toFixed(2)}</strong>
      </div>
      <input
        className={styles.slider}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function MixerPage() {
  const paints = DEMO_PAINTS;

  const [currentStage, setCurrentStage] = useState<StageKey>('build');
  const [unlockedStages, setUnlockedStages] = useState<StageKey[]>(['build']);

  const [realitySlots, setRealitySlots] = useState<RealitySlot[]>(
    Array.from({ length: MAX_SLOTS }).map(() => ({ paintId: '', parts: 1 }))
  );
  const [actualHex, setActualHex] = useState('#7f5ca8');
  const [lockedReality, setLockedReality] = useState<LockedReality | null>(null);

  const [forwardTuningByPaintId, setForwardTuningByPaintId] = useState<Record<string, ForwardTuning>>({});
  const [activeForwardPaintId, setActiveForwardPaintId] = useState<string | null>(null);

  const [inverseTuning, setInverseTuning] = useState<InverseTuning>(DEFAULT_INVERSE_TUNING);
  const [openSlotPickerIndex, setOpenSlotPickerIndex] = useState<number | null>(null);

  const validRealityRecipe = useMemo(
    () => realitySlots.filter((slot) => slot.paintId && slot.parts > 0),
    [realitySlots]
  );

  const lockedRealityPaints = useMemo(() => {
    if (!lockedReality) return [];
    return lockedReality.slots
      .map((slot) => getPaintById(paints, slot.paintId))
      .filter(Boolean) as PaintOption[];
  }, [lockedReality, paints]);

  const predictedStage2Hex = useMemo(() => {
    if (!lockedReality) return '#6f5b93';
    return predictForwardColor({
      paints,
      reality: lockedReality,
      forwardTuningByPaintId,
    });
  }, [lockedReality, paints, forwardTuningByPaintId]);

  const stage2Distance = useMemo(() => {
    if (!lockedReality) return 99;
    return colorDistance(lockedReality.actualHex, predictedStage2Hex);
  }, [lockedReality, predictedStage2Hex]);

  const bridgeStrength = getBridgeStrength(stage2Distance);

  const stage3Solve = useMemo(() => {
    if (!lockedReality) return null;
    return solveColorTargetDemo({
      paints,
      targetHex: lockedReality.actualHex,
      inverseTuning,
      lockedReality,
    });
  }, [lockedReality, paints, inverseTuning]);

  const stage3RecipeMatches = useMemo(() => {
    if (!lockedReality || !stage3Solve) return false;

    const a = [...lockedReality.slots]
      .filter((x) => x.paintId && x.parts > 0)
      .map((x) => `${x.paintId}:${x.parts}`)
      .sort()
      .join('|');

    const b = [...stage3Solve.recipe]
      .filter((x) => x.paintId && x.parts > 0)
      .map((x) => `${x.paintId}:${x.parts}`)
      .sort()
      .join('|');

    return a === b;
  }, [lockedReality, stage3Solve]);

  useEffect(() => {
    if (currentStage !== 'matchColor') {
      setActiveForwardPaintId(null);
    }
    if (currentStage !== 'build') {
      setOpenSlotPickerIndex(null);
    }
  }, [currentStage]);

  function updateRealitySlot(index: number, patch: Partial<RealitySlot>) {
    setRealitySlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, ...patch } : slot))
    );
  }

  function lockReality() {
    if (!validRealityRecipe.length) return;

    const nextReality: LockedReality = {
      slots: validRealityRecipe,
      actualHex,
    };

    const tuningSeed: Record<string, ForwardTuning> = {};
    nextReality.slots.forEach((slot) => {
      tuningSeed[slot.paintId] = forwardTuningByPaintId[slot.paintId] ?? DEFAULT_FORWARD_TUNING;
    });

    setLockedReality(nextReality);
    setForwardTuningByPaintId(tuningSeed);
    setUnlockedStages(['build', 'matchColor']);
    setCurrentStage('matchColor');
  }

  function confirmForwardCalibration() {
    setUnlockedStages(['build', 'matchColor', 'matchRecipe']);
    setCurrentStage('matchRecipe');
  }

  function startOver() {
    setCurrentStage('build');
    setUnlockedStages(['build']);
    setRealitySlots(Array.from({ length: MAX_SLOTS }).map(() => ({ paintId: '', parts: 1 })));
    setActualHex('#7f5ca8');
    setLockedReality(null);
    setForwardTuningByPaintId({});
    setActiveForwardPaintId(null);
    setInverseTuning(DEFAULT_INVERSE_TUNING);
    setOpenSlotPickerIndex(null);
  }

  const activeForwardPaint = activeForwardPaintId
    ? getPaintById(paints, activeForwardPaintId)
    : null;

  const activeForwardTuning = activeForwardPaintId
    ? forwardTuningByPaintId[activeForwardPaintId] ?? DEFAULT_FORWARD_TUNING
    : null;

  function setForwardValue(key: keyof ForwardTuning, value: number) {
    if (!activeForwardPaintId) return;
    setForwardTuningByPaintId((prev) => ({
      ...prev,
      [activeForwardPaintId]: {
        ...(prev[activeForwardPaintId] ?? DEFAULT_FORWARD_TUNING),
        [key]: value,
      },
    }));
  }

  return (
    <div className={styles.page}>
      <div className={styles.ambientOne} />
      <div className={styles.ambientTwo} />
      <div className={styles.pageGlow} />

      <div className={styles.shell}>
        <header className={styles.topBar}>
          <button
            type="button"
            className={styles.startOverButton}
            onClick={startOver}
            aria-label="Start over"
            title="Start over"
          >
            ↺
          </button>


          <div className={styles.topBarRight}>
            <ProgressDots
              current={currentStage}
              unlocked={unlockedStages}
              onJump={setCurrentStage}
            />
          </div>
        </header>

        <main className={styles.stageShell}>
          <div
            key={currentStage}
            className={[
              styles.stageFrame,
              currentStage === 'build' ? styles.stageBuild : '',
              currentStage === 'matchColor' ? styles.stageMatchColor : '',
              currentStage === 'matchRecipe' ? styles.stageMatchRecipe : '',
            ].join(' ')}
          >
            {currentStage === 'build' && (
              <section className={styles.stageLayoutGolden}>

                <div className={styles.goldenLarge}>
                  <div className={styles.paintComposerCompact}>
                    <div className={styles.visualRecipeBuilderCompact}>
                      {realitySlots.map((slot, index) => {
                        const selectedPaint = getPaintById(paints, slot.paintId);

                        return (
                          <div key={index} className={styles.visualSlot}>
                            <button
                              type="button"
                              className={[
                                styles.visualSlotCircle,
                                selectedPaint ? styles.visualSlotCircleFilled : '',
                              ].join(' ')}
                              style={
                                selectedPaint
                                  ? ({ '--slot-color': selectedPaint.hex } as React.CSSProperties)
                                  : undefined
                              }
                              onClick={() =>
                                setOpenSlotPickerIndex((prev) => (prev === index ? null : index))
                              }
                            >
                              {selectedPaint ? (
                                <span className={styles.visualSlotInnerGlow} />
                              ) : (
                                <span className={styles.visualSlotPlus}>+</span>
                              )}
                            </button>

                            <div className={styles.visualSlotLabel}>
                              {selectedPaint ? selectedPaint.name : 'Add paint'}
                            </div>

                            <div className={styles.partsCluster}>
                              <button
                                type="button"
                                className={styles.partsButton}
                                onClick={() =>
                                  updateRealitySlot(index, {
                                    parts: clamp(slot.parts - 1, 1, 12),
                                  })
                                }
                                disabled={!selectedPaint}
                              >
                                −
                              </button>
                              <div className={styles.partsValue}>{slot.parts}</div>
                              <button
                                type="button"
                                className={styles.partsButton}
                                onClick={() =>
                                  updateRealitySlot(index, {
                                    parts: clamp(slot.parts + 1, 1, 12),
                                  })
                                }
                                disabled={!selectedPaint}
                              >
                                +
                              </button>
                            </div>

                            {openSlotPickerIndex === index && (
                              <div className={styles.paintPickerPopover}>
                                <div className={styles.paintPickerGrid}>
                                  {paints.map((paint) => (
                                    <button
                                      key={paint.id}
                                      type="button"
                                      className={styles.paintSwatchOption}
                                      onClick={() => {
                                        updateRealitySlot(index, { paintId: paint.id });
                                        setOpenSlotPickerIndex(null);
                                      }}
                                      title={paint.name}
                                    >
                                      <span
                                        className={styles.paintSwatchOptionCircle}
                                        style={{ background: paint.hex }}
                                      />
                                      <span className={styles.paintSwatchOptionLabel}>
                                        {paint.name}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <aside className={styles.goldenSmall}>
                  <div className={styles.realityOrbPanel}>
                    <div className={styles.orbLabel}>Reality Color</div>

                    <div className={styles.realityOrbWrap}>
                      <div
                        className={styles.realityOrb}
                        style={{
                          background: `radial-gradient(circle at 35% 30%, #fff8 0%, ${actualHex} 36%, ${actualHex} 64%, #0007 100%)`,
                        }}
                      />
                    </div>

                    <div className={styles.hexInputWrap}>
                      <input
                        className={styles.hexInput}
                        type="color"
                        value={actualHex}
                        onChange={(e) => setActualHex(e.target.value)}
                        aria-label="Actual resulting color"
                      />
                      <input
                        className={styles.hexTextInput}
                        type="text"
                        value={actualHex}
                        onChange={(e) => setActualHex(e.target.value)}
                      />
                    </div>

                    <p className={styles.smallWhisper}>
                      Choose the final color that best reflects what your real mixture produced.
                    </p>
                  </div>
                </aside>

                <div className={styles.bottomActionRail}>
                  <div className={styles.bottomActionCopy}>
                    {validRealityRecipe.length
                      ? recipeToString(validRealityRecipe, paints)
                      : 'Choose paints and parts to create your reality recipe.'}
                  </div>

                  <button
                    type="button"
                    className={styles.primaryCta}
                    onClick={lockReality}
                    disabled={!validRealityRecipe.length}
                  >
                    Seal this reality
                  </button>
                </div>
              </section>
            )}

            {currentStage === 'matchColor' && lockedReality && (
              <section className={styles.stageHero}>


                <div className={styles.stageTwoLayout}>
                  <div className={styles.stageTwoCenter}>
                    <div className={styles.circleCluster}>
                      <div className={styles.heroCircleBlock}>
                        <div className={styles.heroCircleLabel}>Actual Mix</div>
                        <div className={styles.heroCircleHalo}>
                          <div
                            className={styles.heroCircle}
                            style={{
                              background: `radial-gradient(circle at 35% 30%, #fff8 0%, ${lockedReality.actualHex} 35%, ${lockedReality.actualHex} 62%, #0008 100%)`,
                            }}
                          />
                        </div>
                      </div>

                      <div
                        className={styles.connectionBridge}
                        style={{ '--bridge-strength': bridgeStrength } as React.CSSProperties}
                      >
                        <div className={styles.connectionBeam} />
                        <div className={styles.connectionLabel}>
                          {formatDistanceLabel(stage2Distance)}
                        </div>
                      </div>

                      <div className={styles.heroCircleBlock}>
                        <div className={styles.heroCircleLabel}>Predicted Mix</div>
                        <div className={styles.heroCircleHalo}>
                          <div
                            className={styles.heroCircle}
                            style={{
                              background: `radial-gradient(circle at 35% 30%, #fff8 0%, ${predictedStage2Hex} 35%, ${predictedStage2Hex} 62%, #0008 100%)`,
                            }}
                          />
                        </div>
                      </div>

                      <div className={styles.arcLayer}>
                        {lockedRealityPaints.map((paint, index) => (
                          <PaintArcButton
                            key={paint.id}
                            paint={paint}
                            index={index}
                            total={lockedRealityPaints.length}
                            active={paint.id === activeForwardPaintId}
                            onClick={() =>
                              setActiveForwardPaintId((prev) => (prev === paint.id ? null : paint.id))
                            }
                          />
                        ))}
                      </div>
                    </div>

                    <div className={styles.heroRail}>
                      <div className={styles.heroRailHeader}>
                        <div>
                          <div className={styles.heroRailKicker}>Locked recipe</div>
                          <div className={styles.heroRailRecipe}>
                            {recipeToString(lockedReality.slots, paints)}
                          </div>
                        </div>
                        <div className={styles.distanceBadge}>Δ {stage2Distance.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>

                  <aside className={styles.stageTwoSide}>
                    {activeForwardPaint && activeForwardTuning ? (
                      <div className={styles.sideTuningPanel}>
                        <div className={styles.sideTuningTop}>
                          <div className={styles.forwardPopupKicker}>Selected Paint</div>
                          <div className={styles.singlePaintOrbWrap}>
                            <div
                              className={styles.singlePaintOrb}
                              style={{
                                background: `radial-gradient(circle at 35% 30%, #fff8 0%, ${activeForwardPaint.hex} 38%, ${activeForwardPaint.hex} 64%, #0008 100%)`,
                              }}
                            />
                          </div>
                          <div className={styles.singlePaintName}>{activeForwardPaint.name}</div>
                          <p className={styles.smallWhisper}>
                            Tune this paint in isolation, then watch how it shifts the predicted
                            mix.
                          </p>
                        </div>

                        <div className={styles.forwardGrid}>
                          <TuningSlider
                            label="Tinting Strength"
                            min={0.6}
                            max={1.4}
                            step={0.01}
                            value={activeForwardTuning.tintingStrength}
                            onChange={(v) => setForwardValue('tintingStrength', v)}
                          />
                          <TuningSlider
                            label="Chroma Bias"
                            min={-1}
                            max={1}
                            step={0.01}
                            value={activeForwardTuning.chromaBias}
                            onChange={(v) => setForwardValue('chromaBias', v)}
                          />
                          <TuningSlider
                            label="Darkness Bias"
                            min={-1}
                            max={1}
                            step={0.01}
                            value={activeForwardTuning.darknessBias}
                            onChange={(v) => setForwardValue('darknessBias', v)}
                          />
                          <TuningSlider
                            label="Temperature Bias"
                            min={-1}
                            max={1}
                            step={0.01}
                            value={activeForwardTuning.temperatureBias}
                            onChange={(v) => setForwardValue('temperatureBias', v)}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className={styles.sideTuningPanelEmpty}>
                        <div className={styles.forwardPopupKicker}>Forward Calibration</div>
                        <p className={styles.smallWhisper}>
                          Select one of the paints orbiting the center to tune how that pigment
                          behaves.
                        </p>
                      </div>
                    )}
                  </aside>
                </div>

                <div className={styles.bottomActionRail}>
                  <div className={styles.bottomActionCopy}>
                    Keep tuning until the predicted circle emotionally matches the real one.
                  </div>
                  <button
                    type="button"
                    className={styles.primaryCta}
                    onClick={confirmForwardCalibration}
                  >
                    This feels right
                  </button>
                </div>
              </section>
            )}

            {currentStage === 'matchRecipe' && lockedReality && stage3Solve && (
              <section className={styles.stageLayoutGolden}>
                <div className={styles.stageCopy}>
                  <span className={styles.stageEyebrow}>Stage 3</span>
                  <h2 className={styles.stageTitle}>Match the Recipe</h2>
                  <p className={styles.stageText}>
                    Now the color is truth. Tune the solver so it rediscovers the same recipe a
                    painter would have reached in reality.
                  </p>
                </div>

                <div className={styles.goldenLarge}>
                  <div className={styles.recipeCompareWrap}>
                    <div className={styles.recipeColumn}>
                      <div className={styles.recipeColumnKicker}>Reality Recipe</div>
                      <div className={styles.recipeColumnTitle}>
                        {recipeToString(lockedReality.slots, paints)}
                      </div>
                      <div className={styles.recipeTokens}>
                        {lockedReality.slots.map((item, index) => {
                          const paint = getPaintById(paints, item.paintId);
                          if (!paint) return null;
                          return (
                            <div key={`${item.paintId}-${index}`} className={styles.recipeToken}>
                              <span
                                className={styles.recipeTokenSwatch}
                                style={{ background: paint.hex }}
                              />
                              <span>
                                {item.parts} × {paint.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className={styles.recipeDivider}>
                      <div className={styles.recipeDividerLine} />
                      <div className={styles.recipeDividerBadge}>
                        {stage3RecipeMatches ? 'Matched' : 'Refining'}
                      </div>
                      <div className={styles.recipeDividerLine} />
                    </div>

                    <div className={styles.recipeColumn}>
                      <div className={styles.recipeColumnKicker}>System Recipe</div>
                      <div className={styles.recipeColumnTitle}>
                        {recipeToString(stage3Solve.recipe, paints)}
                      </div>
                      <div className={styles.recipeTokens}>
                        {stage3Solve.recipe.map((item, index) => {
                          const paint = getPaintById(paints, item.paintId);
                          if (!paint) return null;
                          return (
                            <div key={`${item.paintId}-${index}`} className={styles.recipeToken}>
                              <span
                                className={styles.recipeTokenSwatch}
                                style={{ background: paint.hex }}
                              />
                              <span>
                                {item.parts} × {paint.name}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <aside className={styles.goldenSmall}>
                  <div className={styles.inversePanel}>
                    <div className={styles.inversePanelKicker}>Inverse Tuning</div>

                    <TuningSlider
                      label="Ratio Penalty"
                      min={0}
                      max={1}
                      step={0.01}
                      value={inverseTuning.ratioPenalty}
                      onChange={(v) => setInverseTuning((prev) => ({ ...prev, ratioPenalty: v }))}
                    />
                    <TuningSlider
                      label="Complexity Penalty"
                      min={0}
                      max={1}
                      step={0.01}
                      value={inverseTuning.complexityPenalty}
                      onChange={(v) =>
                        setInverseTuning((prev) => ({ ...prev, complexityPenalty: v }))
                      }
                    />
                    <TuningSlider
                      label="Exact Match Bias"
                      min={0}
                      max={1}
                      step={0.01}
                      value={inverseTuning.exactMatchBias}
                      onChange={(v) =>
                        setInverseTuning((prev) => ({ ...prev, exactMatchBias: v }))
                      }
                    />
                    <TuningSlider
                      label="Hue Family Bias"
                      min={0}
                      max={1}
                      step={0.01}
                      value={inverseTuning.hueFamilyBias}
                      onChange={(v) => setInverseTuning((prev) => ({ ...prev, hueFamilyBias: v }))}
                    />
                  </div>
                </aside>

                <div className={styles.bottomActionRail}>
                  <div className={styles.bottomActionCopy}>
                    Stage 2 taught pigment truth. Stage 3 teaches recipe choice.
                  </div>
                  <button type="button" className={styles.primaryCta}>
                    Calibration complete
                  </button>
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}