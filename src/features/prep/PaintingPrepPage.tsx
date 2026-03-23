import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
import { ReferenceSamplerCanvas } from '../reference/ReferenceSamplerCanvas';
import { extractPalette } from '../../lib/color/referenceSampler';
import { rankRecipes } from '../../lib/color/mixEngine';
import { createId } from '../../lib/utils/id';
import type {
  ExtractedPaletteColor,
  Paint,
  PaintingSession,
  PaintingTarget,
  ReferenceSample,
  UserSettings,
} from '../../types/models';

const createTarget = (
  hex: string,
  label: string,
  source: PaintingTarget['source'],
  sampleId?: string,
): PaintingTarget => ({
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

export const PaintingPrepPage = ({
  session,
  paints,
  settings,
  onSessionChange,
  onCreateProject,
}: PaintingPrepPageProps) => {
  const [hoverHex, setHoverHex] = useState<string | null>(null);
  const [paletteSize, setPaletteSize] = useState(8);
  const [sampleMode, setSampleMode] = useState<'pixel' | 'average' | 'smart'>(
    'average',
  );
  const [sampleRadius, setSampleRadius] = useState(4);
  const [zoom, setZoom] = useState(10);

  const selectedPalette =
    session?.targetOrder
      .map((id) => session.targets.find((target) => target.id === id))
      .filter((target): target is PaintingTarget => Boolean(target)) ?? [];

  const sampledCandidates = session?.sampledColors ?? [];
  const extractedCandidates = session?.extractedCandidatePalette ?? [];
  const candidateCount = sampledCandidates.length + extractedCandidates.length;
  const enabledPaints = paints.filter((paint) => paint.isEnabled);

  const selectedHexes = useMemo(
    () => new Set(selectedPalette.map((target) => target.targetHex)),
    [selectedPalette],
  );

  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="space-y-4">
          <div>
            <p className="studio-kicker">Prep</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">
              No project selected
            </h2>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">
              Create a project and start building a palette directly from a
              reference image.
            </p>
          </div>
          <button
            className="studio-button studio-button-primary"
            type="button"
            onClick={onCreateProject}
          >
            Create project
          </button>
        </div>
      </Card>
    );
  }

  const updateSession = (patch: Partial<PaintingSession>) => {
    onSessionChange({
      ...session,
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  };

  const addCandidateToPalette = (
    candidate: ReferenceSample | ExtractedPaletteColor,
    source: PaintingTarget['source'],
  ) => {
    if (selectedPalette.some((target) => target.targetHex === candidate.hex)) {
      return;
    }

    const label = 'point' in candidate ? candidate.name : candidate.label;
    const nextTarget = createTarget(
      candidate.hex,
      label,
      source,
      'point' in candidate ? candidate.id : undefined,
    );

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

  const previewRecipe = (targetId: string) => {
    const target = session.targets.find((item) => item.id === targetId);
    if (!target) return;

    const recipes = rankRecipes(target.targetHex, paints, settings, 4);

    updateSession({
      targets: session.targets.map((item) =>
        item.id === targetId
          ? {
              ...item,
              recipeOptions: recipes,
              selectedRecipeId: recipes[0]?.id,
              selectedRecipe: recipes[0],
              prepStatus: recipes.length ? 'locked' : item.prepStatus,
            }
          : item,
      ),
      activeTargetIds:
        recipes.length && !session.activeTargetIds.includes(targetId)
          ? [...session.activeTargetIds, targetId]
          : session.activeTargetIds,
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
        extractedCandidatePalette: extractPalette(
          { width: canvas.width, height: canvas.height, data: data.data },
          paletteSize,
        ),
      });
    };
  };

  return (
    <div className="prep-workspace-shell">
      <div className="prep-workspace-grid">
        <section className="prep-main-column">
          <Card className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <p className="studio-kicker">Reference</p>
                <h2 className="mt-1 text-[1.02rem] font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">
                  Sample from the painting and build the final palette.
                </h2>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="studio-chip studio-chip-info">
                  {selectedPalette.length} selected
                </span>
                <span className="studio-chip">{candidateCount} candidates</span>
                <label className="studio-button studio-button-secondary studio-button-compact cursor-pointer">
                  Upload
                  <input
                    className="hidden"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) =>
                      void handleUpload(event.target.files?.[0])
                    }
                  />
                </label>
              </div>
            </div>

            <div className="prep-image-stage mt-4">
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

                  updateSession({
                    sampledColors: [sample, ...session.sampledColors],
                  });
                }}
              />
            </div>

            <div className="prep-control-strip mt-4">
              <div className="prep-control-group">
                <span className="prep-control-label">Mode</span>
                <div className="studio-segmented-control" role="group">
                  {(['pixel', 'average', 'smart'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`studio-segmented-option ${
                        sampleMode === mode
                          ? 'studio-segmented-option-active'
                          : ''
                      }`}
                      onClick={() => setSampleMode(mode)}
                    >
                      {mode === 'pixel'
                        ? 'Pixel'
                        : mode === 'average'
                          ? 'Average'
                          : 'Smart'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="prep-control-group prep-control-group-small">
                <label>
                  <span className="prep-control-label">Radius</span>
                  <input
                    className="studio-input studio-input-compact"
                    type="number"
                    min={0}
                    max={20}
                    value={sampleRadius}
                    onChange={(event) =>
                      setSampleRadius(Number(event.target.value))
                    }
                  />
                </label>
              </div>

              <div className="prep-control-group prep-control-group-small">
                <label>
                  <span className="prep-control-label">Loupe</span>
                  <input
                    className="studio-input studio-input-compact"
                    type="number"
                    min={4}
                    max={20}
                    value={zoom}
                    onChange={(event) => setZoom(Number(event.target.value))}
                  />
                </label>
              </div>

              <div className="prep-control-group">
                <span className="prep-control-label">Extract</span>
                <div className="studio-segmented-control" role="group">
                  {[5, 8, 12].map((count) => (
                    <button
                      key={count}
                      type="button"
                      className={`studio-segmented-option ${
                        paletteSize === count
                          ? 'studio-segmented-option-active'
                          : ''
                      }`}
                      onClick={() => setPaletteSize(count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <button
                className="studio-button studio-button-secondary studio-button-compact"
                type="button"
                onClick={runExtraction}
                disabled={!session.referenceImage?.dataUrl}
              >
                Extract
              </button>

              <div className="studio-chip studio-chip-muted ml-auto">
                Hover {hoverHex ?? '—'}
              </div>
            </div>
          </Card>
        </section>

        <aside className="prep-side-column">
          <Card className="p-4 sm:p-5 prep-selected-card">
            <div className="panel-heading-row">
              <div>
                <p className="studio-kicker">Selected palette</p>
                <h3 className="panel-heading-title">Working colors</h3>
              </div>
              <span className="studio-chip studio-chip-success">
                {selectedPalette.length}
              </span>
            </div>

            <div className="mt-4 space-y-3 prep-selected-scroll">
              {selectedPalette.length ? (
                selectedPalette.map((target) => (
                  <article
                    key={target.id}
                    className="prep-target-card prep-target-card-selected"
                  >
                    <div className="prep-target-card__topline">
                      <div className="prep-target-card__identity">
                        <span
                          className="prep-target-swatch"
                          style={{ backgroundColor: target.targetHex }}
                        />
                        <div className="min-w-0">
                          <p className="prep-target-label">{target.label}</p>
                          <p className="prep-target-hex">{target.targetHex}</p>
                        </div>
                      </div>

                      <button
                        className="studio-button studio-button-secondary studio-button-compact"
                        type="button"
                        onClick={() => removePaletteColor(target.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="prep-target-card__controls">
                      <button
                        className="studio-button studio-button-secondary studio-button-compact"
                        type="button"
                        onClick={() => previewRecipe(target.id)}
                        disabled={enabledPaints.length === 0}
                      >
                        {target.selectedRecipe ? 'Refresh' : 'Preview'}
                      </button>

                      {target.selectedRecipe ? (
                        <span className="studio-chip studio-chip-success">
                          {target.selectedRecipe.practicalRatioText}
                        </span>
                      ) : (
                        <span className="studio-chip studio-chip-muted">
                          No recipe
                        </span>
                      )}
                    </div>

                    {target.selectedRecipe ? (
                      <div className="mt-3 space-y-3">
                        <SwatchComparisonPanel
                          targetHex={target.targetHex}
                          predictedHex={target.selectedRecipe.predictedHex}
                          targetHelper="Target"
                          predictedHelper="Recipe"
                        />

                        <div className="prep-ratio-panel studio-panel-strong">
                          <p className="studio-kicker">Recipe</p>
                          <p className="prep-ratio-hero">
                            {target.selectedRecipe.practicalRatioText}
                          </p>
                          <p className="prep-ratio-copy">
                            {target.selectedRecipe.recipeText}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </article>
                ))
              ) : (
                <p className="text-sm text-[color:var(--text-muted)]">
                  Add colors from the candidate tray below.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4 sm:p-5 prep-candidate-card-shell">
            <div className="panel-heading-row">
              <div>
                <p className="studio-kicker">Candidate colors</p>
                <h3 className="panel-heading-title">Source tray</h3>
              </div>
              <span className="studio-chip">{candidateCount}</span>
            </div>

            <div className="mt-4 space-y-4 prep-candidate-scroll">
              <section>
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">
                  Manual samples
                </p>
                <div className="mt-3 grid gap-3">
                  {sampledCandidates.length ? (
                    sampledCandidates.map((sample) => (
                      <div key={sample.id} className="prep-candidate-card">
                        <div className="flex items-center gap-3">
                          <span
                            className="prep-candidate-swatch"
                            style={{ backgroundColor: sample.hex }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-[color:var(--text-strong)]">
                              {sample.name}
                            </p>
                            <p className="text-sm text-[color:var(--text-muted)]">
                              {sample.hex}
                            </p>
                          </div>
                          <button
                            className="studio-button studio-button-secondary studio-button-compact"
                            type="button"
                            disabled={selectedHexes.has(sample.hex)}
                            onClick={() =>
                              addCandidateToPalette(sample, 'reference-sample')
                            }
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--text-muted)]">
                      Click the image to sample colors.
                    </p>
                  )}
                </div>
              </section>

              <section>
                <p className="text-sm font-semibold text-[color:var(--text-strong)]">
                  Extracted palette
                </p>
                <div className="mt-3 grid gap-3">
                  {extractedCandidates.length ? (
                    extractedCandidates.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        className="prep-candidate-card prep-candidate-button"
                        onClick={() =>
                          addCandidateToPalette(color, 'palette-extraction')
                        }
                        disabled={selectedHexes.has(color.hex)}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="prep-candidate-swatch"
                            style={{ backgroundColor: color.hex }}
                          />
                          <div className="min-w-0 text-left">
                            <p className="font-semibold text-[color:var(--text-strong)]">
                              {color.label}
                            </p>
                            <p className="text-sm text-[color:var(--text-muted)]">
                              {color.hex}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-[color:var(--text-muted)]">
                      Extract the image palette to get broader candidates.
                    </p>
                  )}
                </div>
              </section>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
};