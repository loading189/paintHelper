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

  const selectedPalette = session?.targetOrder.map((id) => session.targets.find((target) => target.id === id)).filter((target): target is PaintingTarget => Boolean(target)) ?? [];
  const sampledCandidates = session?.sampledColors ?? [];
  const extractedCandidates = session?.extractedCandidatePalette ?? [];
  const enabledPaints = paints.filter((paint) => paint.isEnabled);

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
    <div className="prep-layout prep-layout-dense">
      <div className="space-y-4">
        <Card className="p-4 sm:p-5 prep-workspace-card">
          <div className="prep-toolbar">
            <label className="studio-upload prep-upload-tile">
              <span className="studio-eyebrow">Reference image</span>
              <span className="mt-2 block text-sm font-semibold text-[color:var(--text-strong)]">{session.referenceImage?.name ?? 'Upload JPG / PNG / WebP'}</span>
              <input className="mt-3 block w-full text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleUpload(event.target.files?.[0])} />
            </label>

            <div className="studio-panel studio-panel-muted prep-control-panel">
              <div className="prep-control-row">
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Mode</span>
                  <select className="studio-select studio-input-compact" value={sampleMode} onChange={(event) => setSampleMode(event.target.value as typeof sampleMode)}>
                    <option value="pixel">Pixel</option>
                    <option value="average">Average</option>
                    <option value="smart">Smart</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Radius</span>
                  <input className="studio-input studio-input-compact" type="number" min={0} max={20} value={sampleRadius} onChange={(event) => setSampleRadius(Number(event.target.value))} />
                </label>
                <label>
                  <span className="mb-2 block text-[12px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Zoom</span>
                  <input className="studio-input studio-input-compact" type="number" min={4} max={20} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                </label>
                <div className="studio-chip">Hover {hoverHex ?? '—'}</div>
              </div>

              <div className="prep-control-row prep-control-row-actions">
                <div className="flex flex-wrap gap-2">
                  {[5, 8, 12].map((count) => (
                    <button key={count} type="button" className={`studio-button ${paletteSize === count ? 'studio-button-primary' : 'studio-button-secondary'} studio-button-compact`} onClick={() => setPaletteSize(count)}>{count}</button>
                  ))}
                </div>
                <button className="studio-button studio-button-secondary studio-button-compact" type="button" onClick={runExtraction} disabled={!session.referenceImage?.dataUrl}>Extract palette</button>
              </div>
            </div>
          </div>

          <div className="mt-4 prep-reference-stage prep-reference-stage-dense">
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
        </Card>

        <details className="studio-disclosure prep-notes-disclosure">
          <summary className="studio-disclosure-summary">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Project notes</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">Collapsed by default to keep the image workspace clear.</p>
              </div>
              <span className="studio-chip">Optional</span>
            </div>
          </summary>
          <div className="mt-4">
            <textarea className="studio-textarea min-h-24" value={session.notes ?? ''} onChange={(event) => updateSession({ notes: event.target.value })} placeholder="Critical reminders for this painting." />
          </div>
        </details>
      </div>

      <div className="prep-sidebar-stack prep-sidebar-dense">
        <Card className="p-4 sm:p-5 prep-sidebar-panel prep-sidebar-panel-selected prep-sidebar-panel-primary">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="studio-eyebrow">Selected Painting Palette</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Main output</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="studio-chip">{selectedPalette.length} colors</span>
              <span className="studio-chip studio-chip-success">{lockedCount} recipes</span>
            </div>
          </div>

          <div className="mt-4 space-y-4 prep-scroll-panel prep-primary-scroll">
            {selectedPalette.length ? selectedPalette.map((target) => (
              <article key={target.id} className="prep-target-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-12 w-12 rounded-2xl border border-black/10" style={{ backgroundColor: target.targetHex }} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[color:var(--text-strong)]">{target.label}</p>
                      <p className="text-sm text-[color:var(--text-muted)]">{target.targetHex}</p>
                    </div>
                  </div>
                  <button className="studio-button studio-button-secondary studio-button-compact" type="button" onClick={() => removePaletteColor(target.id)}>Remove</button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button className="studio-button studio-button-primary studio-button-compact" type="button" onClick={() => generateRecipe(target.id)} disabled={enabledPaints.length === 0}>
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
            )) : <p className="text-sm text-[color:var(--text-muted)]">Add source options below to build the final painting palette.</p>}
          </div>
        </Card>

        <Card className="p-4 sm:p-5 prep-sidebar-panel prep-sidebar-panel-candidates prep-sidebar-panel-secondary">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="studio-eyebrow">Candidate Tray</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Source options</h3>
            </div>
            <span className="studio-chip">{candidateCount}</span>
          </div>

          <div className="mt-4 space-y-4 prep-scroll-panel prep-secondary-scroll">
            <section>
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Manual samples</p>
              <div className="mt-3 grid gap-3">
                {sampledCandidates.length ? sampledCandidates.map((sample) => (
                  <div key={sample.id} className="prep-candidate-card">
                    <div className="flex items-center gap-3">
                      <span className="h-10 w-10 rounded-2xl border border-black/10" style={{ backgroundColor: sample.hex }} />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-[color:var(--text-strong)]">{sample.name}</p>
                        <p className="text-sm text-[color:var(--text-muted)]">{sample.hex}</p>
                      </div>
                      <button className="studio-button studio-button-secondary studio-button-compact" type="button" disabled={allCandidateHexes.has(sample.hex)} onClick={() => addCandidateToPalette(sample, 'reference-sample')}>Add</button>
                    </div>
                  </div>
                )) : <p className="text-sm text-[color:var(--text-muted)]">Click the reference image to sample colors.</p>}
              </div>
            </section>

            <section>
              <p className="text-sm font-semibold text-[color:var(--text-strong)]">Extracted palette</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {extractedCandidates.length ? extractedCandidates.map((color) => (
                  <button key={color.id} type="button" className="prep-candidate-card prep-candidate-button" onClick={() => addCandidateToPalette(color, 'palette-extraction')}>
                    <div className="flex items-center gap-3">
                      <span className="h-10 w-10 rounded-2xl border border-black/10" style={{ backgroundColor: color.hex }} />
                      <div className="min-w-0">
                        <p className="font-semibold text-[color:var(--text-strong)]">{color.label}</p>
                        <p className="text-sm text-[color:var(--text-muted)]">{color.hex}</p>
                      </div>
                    </div>
                  </button>
                )) : <p className="text-sm text-[color:var(--text-muted)]">Run extraction to surface source options.</p>}
              </div>
            </section>
          </div>
        </Card>
      </div>
    </div>
  );
};
