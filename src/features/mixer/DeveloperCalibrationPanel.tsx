import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { analyzeColor } from '../../lib/color/colorAnalysis';
import {
  defaultDeveloperCalibration,
  getDeveloperCalibration,
  resetDeveloperCalibration,
  updateDeveloperCalibration,
} from '../../lib/color/developerCalibration';
import { exploreRecipeNeighborhood, probeRecipe, type ProbeRecipeInput } from '../../lib/color/recipeProbe';
import type { Paint } from '../../types/models';

type DeveloperCalibrationPanelProps = {
  paints: Paint[];
  targetHex?: string | null;
};

const defaultProbeRecipe: ProbeRecipeInput[] = [
  { paintId: 'paint-ultramarine-blue', parts: 3 },
  { paintId: 'paint-burnt-umber', parts: 2 },
  { paintId: 'paint-cadmium-yellow-medium', parts: 2 },
];

const formatDecimal = (value: number): string => value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');

const knobInputClassName = 'studio-input h-10 px-3 py-2 text-sm';

export const DeveloperCalibrationPanel = ({ paints, targetHex }: DeveloperCalibrationPanelProps) => {
  const [calibrationSnapshot, setCalibrationSnapshot] = useState(() => getDeveloperCalibration());
  const [probeRecipeState, setProbeRecipeState] = useState<ProbeRecipeInput[]>(defaultProbeRecipe);
  const enabledPaints = useMemo(() => paints.filter((paint) => paint.isEnabled), [paints]);
  const probe = useMemo(() => probeRecipe(paints, probeRecipeState), [paints, probeRecipeState, calibrationSnapshot]);
  const neighborhood = useMemo(() => exploreRecipeNeighborhood(paints, probeRecipeState, { maxVariants: 10 }), [paints, probeRecipeState, calibrationSnapshot]);
  const targetAnalysis = targetHex ? analyzeColor(targetHex) : null;

  const syncCalibration = () => setCalibrationSnapshot(getDeveloperCalibration());

  const updateInverseNumber = (
    section: string,
    key: string,
    value: number | boolean,
  ) => {
    updateDeveloperCalibration({
      inverseSearch: {
        [section]: {
          ...((calibrationSnapshot.inverseSearch as any)[section] ?? {}),
          [key]: value,
        },
      } as any,
    });
    syncCalibration();
  };

  const updatePaintForwardNumber = (paintId: string, key: string, value: number | string | undefined) => {
    const existing = calibrationSnapshot.forwardPigments.paints[paintId] ?? defaultDeveloperCalibration.forwardPigments.paints[paintId];
    updateDeveloperCalibration({
      forwardPigments: {
        paints: {
          [paintId]: {
            ...existing,
            [key]: value,
          },
        },
      },
    });
    syncCalibration();
  };

  const setProbePaint = (index: number, paintId: string) => {
    setProbeRecipeState((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, paintId } : entry));
  };

  const setProbeParts = (index: number, parts: number) => {
    setProbeRecipeState((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, parts: Math.max(1, Math.round(parts) || 1) } : entry));
  };

  return (
    <Card className="p-4 sm:p-5">
      <div className="space-y-6">
        <div>
          <p className="studio-eyebrow">Developer only</p>
          <h3 className="panel-heading-title">Calibration and control</h3>
          <p className="panel-heading-copy">
            Inverse knobs affect candidate generation and ranking only. Forward pigment knobs affect recipe-to-predicted only. No target data may directly alter the predicted swatch after mixing.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-[color:var(--text-strong)]">Inverse search tuning</h4>
              <p className="text-xs text-[color:var(--text-muted)]">Use these to widen or constrain target-aware candidate generation and ranking pressure.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['darkTargets', 'minDarkShare'],
                ['darkTargets', 'maxYellowShare'],
                ['darkTargets', 'valuePenaltyScale'],
                ['darkTargets', 'earthStructuralBonus'],
                ['darkTargets', 'offHuePenalty'],
                ['mutedTargets', 'cleanlinessPenalty'],
                ['vividTargets', 'muddinessPenalty'],
                ['ratioSearch', 'maxComponents'],
                ['ratioSearch', 'neighborhoodRadius'],
              ].map(([section, key]) => {
                const currentValue = (calibrationSnapshot.inverseSearch[section as keyof typeof calibrationSnapshot.inverseSearch] as Record<string, number | boolean>)[key];
                return (
                  <label key={`${section}.${key}`}>
                    <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">{section}.{key}</span>
                    <input
                      className={knobInputClassName}
                      type="number"
                      step="0.01"
                      value={typeof currentValue === 'number' ? currentValue : Number(currentValue)}
                      onChange={(event) => updateInverseNumber(section, key, Number(event.target.value))}
                    />
                  </label>
                );
              })}

              <label className="sm:col-span-2 flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)]">
                <span>greenTargets.requireEarthForDarkNatural</span>
                <input
                  type="checkbox"
                  checked={calibrationSnapshot.inverseSearch.greenTargets.requireEarthForDarkNatural}
                  onChange={(event) => updateInverseNumber('greenTargets', 'requireEarthForDarkNatural', event.target.checked)}
                />
              </label>
              <label className="sm:col-span-2 flex items-center justify-between rounded-2xl border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)]">
                <span>ratioSearch.darkRatioFamiliesEnabled</span>
                <input
                  type="checkbox"
                  checked={calibrationSnapshot.inverseSearch.ratioSearch.darkRatioFamiliesEnabled}
                  onChange={(event) => updateInverseNumber('ratioSearch', 'darkRatioFamiliesEnabled', event.target.checked)}
                />
              </label>
            </div>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-[color:var(--text-strong)]">Forward pigment calibration</h4>
                <p className="text-xs text-[color:var(--text-muted)]">These flow into spectral mixing before the predicted swatch is computed.</p>
              </div>
              <button type="button" className="studio-button" onClick={() => { resetDeveloperCalibration(); syncCalibration(); }}>
                Reset tuning
              </button>
            </div>
            <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
              {enabledPaints.map((paint) => {
                const config = calibrationSnapshot.forwardPigments.paints[paint.id] ?? defaultDeveloperCalibration.forwardPigments.paints[paint.id];
                return (
                  <div key={paint.id} className="rounded-2xl border border-[color:var(--border-soft)] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--text-strong)]">{paint.name}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">{paint.id}</p>
                      </div>
                      <span className="h-8 w-8 rounded-full border border-[color:var(--border-soft)]" style={{ backgroundColor: paint.hex }} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(['tintingStrength', 'darknessBias', 'chromaBias', 'earthStrengthBias', 'whiteLiftBias'] as const).map((key) => (
                        <label key={key}>
                          <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">{key}</span>
                          <input
                            className={knobInputClassName}
                            type="number"
                            step="0.01"
                            value={config?.[key] ?? 0}
                            onChange={(event) => updatePaintForwardNumber(paint.id, key, Number(event.target.value))}
                          />
                        </label>
                      ))}
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">baseHexOverride</span>
                        <input
                          className={knobInputClassName}
                          type="text"
                          placeholder={paint.hex}
                          value={config?.baseHexOverride ?? ''}
                          onChange={(event) => updatePaintForwardNumber(paint.id, 'baseHexOverride', event.target.value || undefined)}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <section className="space-y-4 border-t border-[color:var(--border-soft)] pt-6">
          <div>
            <h4 className="text-sm font-semibold text-[color:var(--text-strong)]">Recipe probe and neighborhood exploration</h4>
            <p className="text-xs text-[color:var(--text-muted)]">Probe a fixed recipe directly to determine whether a miss is coming from search, forward prediction, or both.</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,28rem)]">
            <div className="space-y-3">
              {probeRecipeState.map((entry, index) => (
                <div key={`${entry.paintId}-${index}`} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                  <label>
                    <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Paint {index + 1}</span>
                    <select className="studio-select" value={entry.paintId} onChange={(event) => setProbePaint(index, event.target.value)}>
                      {enabledPaints.map((paint) => <option key={paint.id} value={paint.id}>{paint.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]">Parts</span>
                    <input className={knobInputClassName} type="number" min="1" step="1" value={entry.parts} onChange={(event) => setProbeParts(index, Number(event.target.value))} />
                  </label>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-[color:var(--border-soft)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-muted)]">Recipe → predicted</p>
              {probe ? (
                <div className="mt-3 space-y-3 text-sm text-[color:var(--text-strong)]">
                  <div className="flex items-center gap-3">
                    <span className="h-16 w-16 rounded-2xl border border-[color:var(--border-soft)]" style={{ backgroundColor: probe.predictedHex }} />
                    <div>
                      <p className="font-semibold">{probe.predictedHex}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">Normalized ratio {probe.normalizedRatioText}</p>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3"><span className="block text-xs text-[color:var(--text-muted)]">Value</span><strong>{formatDecimal(probe.analysis.value)}</strong></div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3"><span className="block text-xs text-[color:var(--text-muted)]">Chroma</span><strong>{formatDecimal(probe.analysis.chroma)}</strong></div>
                    <div className="rounded-2xl bg-[color:var(--surface-soft)] p-3"><span className="block text-xs text-[color:var(--text-muted)]">Hue family</span><strong>{probe.analysis.hueFamily}</strong></div>
                  </div>
                  {targetAnalysis ? <p className="text-xs text-[color:var(--text-muted)]">Current mixer target analysis: {targetAnalysis.hueFamily} · {targetAnalysis.valueClassification} · chroma {formatDecimal(targetAnalysis.chroma)}. This is for comparison only and never rewrites the predicted swatch.</p> : null}
                </div>
              ) : <p className="mt-3 text-sm text-[color:var(--text-muted)]">Select paints and parts to probe a recipe.</p>}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h5 className="text-sm font-semibold text-[color:var(--text-strong)]">Nearby variants</h5>
              <p className="text-xs text-[color:var(--text-muted)]">Use this local neighborhood to see whether search missed a darker nearby candidate or whether the forward model keeps the whole neighborhood too light.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {neighborhood.map((variant) => (
                <div key={`${variant.normalizedRatioText}-${variant.predictedHex}`} className="rounded-2xl border border-[color:var(--border-soft)] p-3 text-sm text-[color:var(--text-strong)]">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="h-10 w-10 rounded-xl border border-[color:var(--border-soft)]" style={{ backgroundColor: variant.predictedHex }} />
                    <div>
                      <p className="font-semibold">{variant.normalizedRatioText}</p>
                      <p className="text-xs text-[color:var(--text-muted)]">{variant.predictedHex}</p>
                    </div>
                  </div>
                  <p className="text-xs text-[color:var(--text-muted)]">{variant.recipe.map((component) => `${enabledPaints.find((paint) => paint.id === component.paintId)?.name ?? component.paintId} ${component.parts}`).join(' · ')}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-xl bg-[color:var(--surface-soft)] p-2"><span className="block text-[color:var(--text-muted)]">Value</span><strong>{formatDecimal(variant.analysis.value)}</strong></div>
                    <div className="rounded-xl bg-[color:var(--surface-soft)] p-2"><span className="block text-[color:var(--text-muted)]">Chroma</span><strong>{formatDecimal(variant.analysis.chroma)}</strong></div>
                    <div className="rounded-xl bg-[color:var(--surface-soft)] p-2"><span className="block text-[color:var(--text-muted)]">Hue</span><strong>{variant.analysis.hueFamily}</strong></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Card>
  );
};
