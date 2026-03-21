import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
import { ReferenceSamplerCanvas } from '../reference/ReferenceSamplerCanvas';
import { extractPalette } from '../../lib/color/referenceSampler';
import { rankRecipes } from '../../lib/color/mixEngine';
import { createId } from '../../lib/utils/id';
import type { ExtractedPaletteColor, Paint, PaintingSession, PaintingTarget, ReferenceSample, UserSettings } from '../../types/models';

const createTarget = (hex: string, label: string, source: PaintingTarget['source'], sampleId?: string): PaintingTarget => ({
  id: createId('target'),
  label,
  targetHex: hex,
  priority: 'primary',
  recipeOptions: [],
  selectedRecipeId: undefined,
  selectedRecipe: undefined,
  mixStatus: 'not-mixed',
  prepStatus: 'unreviewed',
  tags: [],
  source,
  sampleId,
});

type PaintingPrepPageProps = {
  session: PaintingSession | null;
  paints: Paint[];
  settings: UserSettings;
  onSessionChange: (session: PaintingSession) => void;
  onCreateProject: () => void;
};

export const PaintingPrepPage = ({ session, paints, settings, onSessionChange, onCreateProject }: PaintingPrepPageProps) => {
  const [hoverHex, setHoverHex] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState(8);
  const [sampleMode, setSampleMode] = useState<'pixel' | 'average' | 'smart'>('average');
  const [sampleRadius, setSampleRadius] = useState(4);
  const [zoom, setZoom] = useState(10);
  const [saveNotice, setSaveNotice] = useState('');

  const selectedPalette = session?.targetOrder.map((id) => session.targets.find((target) => target.id === id)).filter((target): target is PaintingTarget => Boolean(target)) ?? [];
  const sampledCandidates = session?.sampledColors ?? [];
  const extractedCandidates = session?.extractedCandidatePalette ?? [];
  const enabledPaints = paints.filter((paint) => paint.isEnabled);

  const selectedCount = selectedPalette.length;
  const lockedCount = selectedPalette.filter((target) => target.selectedRecipe).length;
  const candidateCount = sampledCandidates.length + extractedCandidates.length;

  const allCandidateHexes = useMemo(() => new Set(selectedPalette.map((target) => target.targetHex)), [selectedPalette]);

  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="space-y-4">
          <div>
            <p className="studio-eyebrow">Prep</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">No painting project yet</h2>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">Create a project to start an image-led palette building workspace.</p>
          </div>
          <div>
            <button className="studio-button studio-button-primary" type="button" onClick={onCreateProject}>Create project</button>
          </div>
        </div>
      </Card>
    );
  }

  const updateSession = (patch: Partial<PaintingSession>) => {
    onSessionChange({ ...session, ...patch, updatedAt: new Date().toISOString() });
  };

  const addCandidateToPalette = (candidate: ReferenceSample | ExtractedPaletteColor, source: PaintingTarget['source']) => {
    if (selectedPalette.some((target) => target.targetHex === candidate.hex)) {
      return;
    }
    const label = 'point' in candidate ? candidate.name : candidate.label;
    const nextTarget = createTarget(candidate.hex, label, source, 'point' in candidate ? candidate.id : undefined);
    updateSession({
      targets: [...session.targets, nextTarget],
      targetOrder: [...session.targetOrder, nextTarget.id],
    });
  };

  const removePaletteColor = (targetId: string) => {
    updateSession({
      targets: session.targets.filter((target) => target.id !== targetId),
      targetOrder: session.targetOrder.filter((id) => id !== targetId),
      activeTargetIds: session.activeTargetIds.filter((id) => id !== targetId),
      pinnedTargetIds: session.pinnedTargetIds.filter((id) => id !== targetId),
    });
  };

  const generateRecipe = (targetId: string) => {
    const target = session.targets.find((item) => item.id === targetId);
    if (!target) {
      return;
    }
    const recipes = rankRecipes(target.targetHex, paints, settings, 4);
    updateSession({
      targets: session.targets.map((item) => item.id === targetId ? {
        ...item,
        recipeOptions: recipes,
        selectedRecipeId: recipes[0]?.id,
        selectedRecipe: recipes[0],
        prepStatus: recipes.length ? 'locked' : item.prepStatus,
      } : item),
      activeTargetIds: recipes.length && !session.activeTargetIds.includes(targetId) ? [...session.activeTargetIds, targetId] : session.activeTargetIds,
    });
  };

  const saveProject = () => {
    updateSession({ status: session.targets.some((target) => target.selectedRecipe) ? 'active' : session.status });
    setSaveNotice('Project saved locally. Reference image, selected palette, recipes, and mix statuses stay on this device.');
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    updateSession({
      referenceImage: {
        id: createId('reference-image'),
        name: file.name,
        mimeType: file.type,
        dataUrl,
        addedAt: new Date().toISOString(),
      },
    });
  };

  const runExtraction = () => {
    if (!session.referenceImage?.dataUrl || typeof document === 'undefined') {
      return;
    }
    const image = new Image();
    image.src = session.referenceImage.dataUrl;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.drawImage(image, 0, 0);
      const data = context.getImageData(0, 0, canvas.width, canvas.height);
      updateSession({
        extractedCandidatePalette: extractPalette({ width: canvas.width, height: canvas.height, data: data.data }, paletteSize),
      });
    };
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="workspace-header workspace-header-compact">
          <div>
            <p className="studio-eyebrow">Prep</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">Painting Prep</h2>
              <span className="studio-chip">{session.status}</span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">Build a selected painting palette from the reference image, then lock recipes to carry into Paint mode.</p>
          </div>

          <div className="workspace-header-actions">
            <div className="workspace-stat-row">
              <div className="studio-mini-stat"><span>Candidates</span><strong>{candidateCount}</strong></div>
              <div className="studio-mini-stat"><span>Selected</span><strong>{selectedCount}</strong></div>
              <div className="studio-mini-stat"><span>Recipes</span><strong>{lockedCount}</strong></div>
            </div>
            <button className="studio-button studio-button-primary" type="button" onClick={saveProject}>Save project</button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 prep-layout">
        <div className="space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="studio-eyebrow">Workspace</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Image-led palette building</h3>
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">Upload the reference, sample directly from the image, and extract candidate colors without leaving the canvas.</p>
              </div>
              <div className="workspace-inline-fields">
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Project title</span>
                  <input className="studio-input" value={session.title} onChange={(event) => updateSession({ title: event.target.value })} />
                </label>
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Status</span>
                  <select className="studio-select" value={session.status} onChange={(event) => updateSession({ status: event.target.value as PaintingSession['status'] })}>
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-5 grid gap-4 prep-reference-grid">
              <div className="space-y-4">
                <label className="studio-upload block">
                  <span className="studio-eyebrow">Reference image</span>
                  <span className="mt-2 block text-base font-semibold text-[color:var(--text-strong)]">{session.referenceImage?.name ?? 'Upload JPG / PNG / WebP'}</span>
                  <p className="mt-2 text-sm text-[color:var(--text-muted)]">Keep the source image large while you pull palette candidates from it.</p>
                  <input className="mt-4 block w-full text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleUpload(event.target.files?.[0])} />
                </label>

                <div className="prep-canvas-card">
                  <ReferenceSamplerCanvas
                    image={session.referenceImage}
                    sampleMode={sampleMode}
                    radius={sampleRadius}
                    zoom={zoom}
                    onHoverHex={setHoverHex}
                    onSample={({ hex, point }) => {
                      const sample: ReferenceSample = {
                        id: createId('sample'),
                        name: `Sample ${session.sampledColors.length + 1}`,
                        hex,
                        point,
                        radius: sampleRadius,
                        mode: sampleMode,
                        addedAt: new Date().toISOString(),
                      };
                      updateSession({ sampledColors: [sample, ...session.sampledColors] });
                    }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="studio-panel studio-panel-muted space-y-4">
                  <div>
                    <p className="studio-eyebrow">Sampling controls</p>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">Click the image to add manual samples to the candidate tray.</p>
                  </div>
                  <label>
                    <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Sampling mode</span>
                    <select className="studio-select" value={sampleMode} onChange={(event) => setSampleMode(event.target.value as typeof sampleMode)}>
                      <option value="pixel">Single pixel</option>
                      <option value="average">Average region</option>
                      <option value="smart">Smart weighted</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label>
                      <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Radius</span>
                      <input className="studio-input" type="number" min={0} max={20} value={sampleRadius} onChange={(event) => setSampleRadius(Number(event.target.value))} />
                    </label>
                    <label>
                      <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Loupe zoom</span>
                      <input className="studio-input" type="number" min={4} max={20} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                    </label>
                  </div>
                  <div className="studio-mini-stat"><span>Hover</span><strong>{hoverHex ?? '—'}</strong></div>
                </div>

                <div className="studio-panel studio-panel-strong space-y-4">
                  <div>
                    <p className="studio-eyebrow">Auto extract</p>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">Pull a compact starting palette from the current reference image.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[5, 8, 12].map((count) => (
                      <button key={count} type="button" className={`studio-button ${paletteSize === count ? 'studio-button-primary' : 'studio-button-secondary'}`} onClick={() => setPaletteSize(count)}>{count} colors</button>
                    ))}
                  </div>
                  <button className="studio-button studio-button-secondary w-full" type="button" onClick={runExtraction} disabled={!session.referenceImage?.dataUrl}>Extract palette</button>
                </div>
              </div>
            </div>

            <details className="studio-disclosure mt-5">
              <summary className="studio-disclosure-summary">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="studio-eyebrow">Project notes</p>
                    <p className="mt-2 text-base font-semibold text-[color:var(--text-strong)]">Keep notes nearby, not dominant</p>
                  </div>
                  <span className="studio-chip">Optional</span>
                </div>
              </summary>
              <div className="mt-4">
                <textarea className="studio-textarea min-h-24" value={session.notes ?? ''} onChange={(event) => updateSession({ notes: event.target.value })} placeholder="What matters most while painting this image?" />
              </div>
            </details>

            {saveNotice ? <p className="mt-4 text-sm text-[color:var(--text-muted)]">{saveNotice}</p> : null}
          </Card>
        </div>

        <div className="prep-sidebar-stack">
          <Card className="p-4 sm:p-5 prep-sidebar-panel prep-sidebar-panel-candidates">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Candidate Tray</p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Candidate colors</h3>
              </div>
              <span className="studio-chip">{candidateCount}</span>
            </div>

            <div className="mt-4 space-y-4 prep-scroll-panel">
              <section>
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">Manual samples</p>
                <div className="mt-3 grid gap-3">
                  {sampledCandidates.length ? sampledCandidates.map((sample) => (
                    <div key={sample.id} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-3.5">
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-2xl border border-black/10" style={{ backgroundColor: sample.hex }} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[color:var(--text-strong)]">{sample.name}</p>
                          <p className="text-sm text-[color:var(--text-muted)]">{sample.hex}</p>
                        </div>
                        <button className="studio-button studio-button-secondary" type="button" disabled={allCandidateHexes.has(sample.hex)} onClick={() => addCandidateToPalette(sample, 'reference-sample')}>Add</button>
                      </div>
                    </div>
                  )) : <p className="text-sm text-[color:var(--text-muted)]">Click the reference image to sample colors.</p>}
                </div>
              </section>

              <section>
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">Extracted palette</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {extractedCandidates.length ? extractedCandidates.map((color) => (
                    <button key={color.id} type="button" className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-3.5 text-left" onClick={() => addCandidateToPalette(color, 'palette-extraction')}>
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-2xl border border-black/10" style={{ backgroundColor: color.hex }} />
                        <div className="min-w-0">
                          <p className="font-semibold text-[color:var(--text-strong)]">{color.label}</p>
                          <p className="text-sm text-[color:var(--text-muted)]">{color.hex}</p>
                        </div>
                      </div>
                    </button>
                  )) : <p className="text-sm text-[color:var(--text-muted)]">Run auto extraction to surface candidate colors.</p>}
                </div>
              </section>
            </div>
          </Card>

          <Card className="p-4 sm:p-5 prep-sidebar-panel prep-sidebar-panel-selected">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Selected Painting Palette</p>
                <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Selected painting palette</h3>
              </div>
              <span className="studio-chip studio-chip-success">{lockedCount} saved</span>
            </div>

            <div className="mt-4 space-y-4 prep-scroll-panel">
              {selectedPalette.length ? selectedPalette.map((target) => (
                <article key={target.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="h-12 w-12 rounded-2xl border border-black/10" style={{ backgroundColor: target.targetHex }} />
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--text-strong)]">{target.label}</p>
                        <p className="text-sm text-[color:var(--text-muted)]">{target.targetHex}</p>
                      </div>
                    </div>
                    <button className="studio-button studio-button-secondary" type="button" onClick={() => removePaletteColor(target.id)}>Remove</button>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className="studio-button studio-button-primary" type="button" onClick={() => generateRecipe(target.id)} disabled={enabledPaints.length === 0}>
                      {target.selectedRecipe ? 'Regenerate recipe' : 'Generate recipe'}
                    </button>
                    {target.selectedRecipe ? <span className="studio-chip studio-chip-success">{target.selectedRecipe.practicalRatioText}</span> : null}
                  </div>

                  {target.selectedRecipe ? (
                    <div className="mt-4 space-y-4">
                      <SwatchComparisonPanel targetHex={target.targetHex} predictedHex={target.selectedRecipe.predictedHex} targetHelper="Selected palette color" predictedHelper="Saved recipe swatch" />
                      <div className="studio-panel studio-panel-muted">
                        <p className="studio-eyebrow">Practical ratio</p>
                        <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{target.selectedRecipe.practicalRatioText}</p>
                        <p className="mt-2 text-sm text-[color:var(--text-muted)]">{target.selectedRecipe.recipeText}</p>
                      </div>
                      <NextAdjustmentBlock adjustments={target.selectedRecipe.detailedAdjustments} />
                      <MixPathBlock steps={target.selectedRecipe.mixPath} warnings={target.selectedRecipe.stabilityWarnings} layeringSuggestion={target.selectedRecipe.layeringSuggestion} />
                    </div>
                  ) : null}
                </article>
              )) : <p className="text-sm text-[color:var(--text-muted)]">Add candidate colors here to build the final painting palette.</p>}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
