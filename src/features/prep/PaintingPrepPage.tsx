import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SectionTitle } from '../../components/SectionTitle';
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

  const allCandidateHexes = useMemo(() => new Set(selectedPalette.map((target) => target.targetHex)), [selectedPalette]);

  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <SectionTitle eyebrow="Prep" description="Create a painting project to start building a palette from a reference image.">
          No painting project yet
        </SectionTitle>
        <div className="mt-5">
          <button className="studio-button studio-button-primary" type="button" onClick={onCreateProject}>Create project</button>
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
    setSaveNotice('Project saved locally. Reference image, candidate colors, selected palette, and recipes are preserved on this device.');
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
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px] xl:items-end">
          <SectionTitle eyebrow="Prep" description="Build the painting palette from the reference image. Sampling and extraction live here instead of in a separate product area.">
            Painting Prep
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="studio-metric"><p className="studio-eyebrow">Candidate colors</p><p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{sampledCandidates.length + extractedCandidates.length}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Manual samples and extracted options.</p></div>
            <div className="studio-metric"><p className="studio-eyebrow">Selected palette</p><p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{selectedCount}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Colors chosen for the painting.</p></div>
            <div className="studio-metric"><p className="studio-eyebrow">Saved recipes</p><p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{lockedCount}</p><p className="mt-1 text-sm text-[color:var(--text-muted)]">Ready to carry into Paint mode.</p></div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.1fr),420px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <div className="grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Project title</span>
                <input className="studio-input" value={session.title} onChange={(event) => updateSession({ title: event.target.value })} />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Status</span>
                <select className="studio-select" value={session.status} onChange={(event) => updateSession({ status: event.target.value as PaintingSession['status'] })}>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Project notes</span>
                <textarea className="studio-textarea min-h-24" value={session.notes ?? ''} onChange={(event) => updateSession({ notes: event.target.value })} placeholder="What matters most while painting this image?" />
              </label>
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Reference image" description="Upload a reference, sample it manually, and extract a candidate palette.">
              Image-led workflow
            </SectionTitle>
            <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr),220px]">
              <div>
                <label className="studio-upload block">
                  <span className="studio-eyebrow">Reference image</span>
                  <span className="mt-2 block text-base font-semibold text-[color:var(--text-strong)]">{session.referenceImage?.name ?? 'Upload JPG / PNG / WebP'}</span>
                  <input className="mt-4 block w-full text-sm" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleUpload(event.target.files?.[0])} />
                </label>
                <div className="mt-4">
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
                <label>
                  <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Sampling mode</span>
                  <select className="studio-select" value={sampleMode} onChange={(event) => setSampleMode(event.target.value as typeof sampleMode)}>
                    <option value="pixel">Single pixel</option>
                    <option value="average">Average region</option>
                    <option value="smart">Smart weighted</option>
                  </select>
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Radius</span>
                  <input className="studio-input" type="number" min={0} max={20} value={sampleRadius} onChange={(event) => setSampleRadius(Number(event.target.value))} />
                </label>
                <label>
                  <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Loupe zoom</span>
                  <input className="studio-input" type="number" min={4} max={20} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
                </label>
                <div className="studio-mini-stat"><span>Hover</span><strong>{hoverHex ?? '—'}</strong></div>
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-4">
                  <p className="studio-eyebrow">Auto extract</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[5, 8, 12].map((count) => (
                      <button key={count} type="button" className={`studio-button ${paletteSize === count ? 'studio-button-primary' : 'studio-button-secondary'}`} onClick={() => setPaletteSize(count)}>{count} colors</button>
                    ))}
                  </div>
                  <button className="studio-button studio-button-secondary mt-3 w-full" type="button" onClick={runExtraction} disabled={!session.referenceImage?.dataUrl}>Extract palette</button>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Candidate colors" description="These are source options only. Add only the colors you actually want in the painting palette.">
              Candidate tray
            </SectionTitle>
            <div className="mt-5 space-y-5">
              <div>
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">Manual samples</p>
                <div className="mt-3 grid gap-3">
                  {sampledCandidates.length ? sampledCandidates.map((sample) => (
                    <div key={sample.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
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
              </div>

              <div>
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">Extracted palette</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {extractedCandidates.length ? extractedCandidates.map((color) => (
                    <button key={color.id} type="button" className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4 text-left" onClick={() => addCandidateToPalette(color, 'palette-extraction')}>
                      <div className="flex items-center gap-3">
                        <span className="h-10 w-10 rounded-2xl border border-black/10" style={{ backgroundColor: color.hex }} />
                        <div>
                          <p className="font-semibold text-[color:var(--text-strong)]">{color.label}</p>
                          <p className="text-sm text-[color:var(--text-muted)]">{color.hex}</p>
                        </div>
                      </div>
                    </button>
                  )) : <p className="text-sm text-[color:var(--text-muted)]">Run auto extraction to surface candidate colors.</p>}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Selected painting palette" description="This is the saved palette for the project. Generate recipes only for the colors you keep.">
              Palette selection
            </SectionTitle>
            <div className="mt-5 space-y-4">
              {selectedPalette.length ? selectedPalette.map((target) => (
                <article key={target.id} className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="h-12 w-12 rounded-2xl border border-black/10" style={{ backgroundColor: target.targetHex }} />
                      <div>
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
                      <SwatchComparisonPanel targetHex={target.targetHex} predictedHex={target.selectedRecipe.predictedHex} targetHelper="Selected palette color" predictedHelper={target.selectedRecipe.qualityLabel} />
                      <div className="studio-panel studio-panel-muted">
                        <p className="studio-eyebrow">Recipe</p>
                        <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{target.selectedRecipe.recipeText}</p>
                        <p className="mt-2 text-sm text-[color:var(--text-muted)]">Practical ratio {target.selectedRecipe.practicalRatioText}</p>
                      </div>
                      <NextAdjustmentBlock adjustments={target.selectedRecipe.detailedAdjustments} />
                      <MixPathBlock steps={target.selectedRecipe.mixPath} warnings={target.selectedRecipe.stabilityWarnings} layeringSuggestion={target.selectedRecipe.layeringSuggestion} />
                    </div>
                  ) : null}
                </article>
              )) : <p className="text-sm text-[color:var(--text-muted)]">Add candidate colors here to build the final painting palette.</p>}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button className="studio-button studio-button-primary" type="button" onClick={saveProject}>Save project</button>
              {saveNotice ? <p className="text-sm text-[color:var(--text-muted)]">{saveNotice}</p> : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
