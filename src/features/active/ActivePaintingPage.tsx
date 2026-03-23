import { Card } from '../../components/Card';
import { MixStatusChip } from '../../components/MixStatusChip';
import { duplicateTargetForRemix } from '../sessions/sessionState';
import type { MixStatus, PaintingSession } from '../../types/models';

const mixStatuses: Array<{ value: MixStatus; label: string }> = [
  { value: 'not-mixed', label: 'Not mixed' },
  { value: 'mixed', label: 'Mixed' },
  { value: 'adjusted', label: 'Adjusted' },
  { value: 'remix-needed', label: 'Remix needed' },
];

type ActivePaintingPageProps = {
  session: PaintingSession | null;
  onSessionChange: (session: PaintingSession) => void;
  onReopenInPrep: () => void;
};

export const ActivePaintingPage = ({ session, onSessionChange, onReopenInPrep }: ActivePaintingPageProps) => {
  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="space-y-3">
          <p className="studio-eyebrow">Paint</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">No painting project selected</h2>
          <p className="text-sm text-[color:var(--text-muted)]">Open a project in Prep first, then Paint becomes the large-image recipe board.</p>
        </div>
      </Card>
    );
  }

  const activeTargets = (session.activeTargetIds.length ? session.activeTargetIds : session.targetOrder)
    .map((id) => session.targets.find((target) => target.id === id))
    .filter((target): target is NonNullable<typeof target> => Boolean(target?.selectedRecipe));
  const pendingTargets = session.targetOrder
    .map((id) => session.targets.find((target) => target.id === id))
    .filter((target): target is NonNullable<typeof target> => Boolean(target && !target.selectedRecipe));

  const updateMixStatus = (targetId: string, status: MixStatus) => {
    onSessionChange({
      ...session,
      updatedAt: new Date().toISOString(),
      targets: session.targets.map((target) => target.id === targetId ? { ...target, mixStatus: status } : target),
    });
  };

  const handleRemix = (targetId: string) => {
    onSessionChange(duplicateTargetForRemix(session, targetId));
  };

  const completedCount = activeTargets.filter((target) => target.mixStatus === 'mixed' || target.mixStatus === 'adjusted').length;

  return (
    <div className="paint-workspace space-y-5">
      <div className="grid gap-5 paint-layout paint-layout-workspace">
        <Card className="p-4 sm:p-5 paint-reference-card paint-reference-shell">
          <div className="paint-reference-topline">
            <div>
              <p className="studio-eyebrow">Paint</p>
              <h2 className="paint-hero-title">Keep the image in front. Mix from the board.</h2>
              <p className="paint-hero-copy">A quiet execution space: reference image on the left, deliberate recipe cards on the right, no analytical clutter competing with the act of painting.</p>
            </div>
            <div className="paint-reference-meta">
              <span className="studio-chip studio-chip-info">{activeTargets.length} colors on board</span>
              <span className="studio-chip studio-chip-success">{completedCount} progressed</span>
            </div>
          </div>

          <div className="mt-4 paint-reference-stage paint-reference-stage-workspace">
            {session.referenceImage?.dataUrl ? (
              <img src={session.referenceImage.dataUrl} alt={session.referenceImage.name} className="paint-reference-image paint-reference-image-workspace" />
            ) : (
              <div className="paint-reference-empty">Add a reference image in Prep to keep it here while painting.</div>
            )}
          </div>

          <div className="mt-4 paint-reference-footer">
            <div>
              <p className="studio-eyebrow">Painting image</p>
              <p className="mt-2 text-sm text-[color:var(--text-body)]">This is the image you are matching while you paint.</p>
            </div>
            <div className="paint-reference-palette-strip" aria-label="Selected palette colors">
              {activeTargets.length ? activeTargets.map((target) => (
                <div key={target.id} className="paint-reference-palette-pill">
                  <span className="paint-reference-palette-swatch" style={{ backgroundColor: target.targetHex }} />
                  <span className="truncate">{target.label}</span>
                </div>
              )) : <span className="text-sm text-[color:var(--text-muted)]">Selected palette recipes will appear here.</span>}
            </div>
          </div>
        </Card>

        <div className="paint-board paint-board-workspace">
          <Card className="p-4 sm:p-5 paint-board-header-card">
            <div className="paint-board-header-row">
              <div>
                <p className="studio-eyebrow">Working palette</p>
                <h3 className="panel-heading-title">Selected recipe board</h3>
                <p className="panel-heading-copy">Compact cards built for glancing, mixing, and subtle status tracking.</p>
              </div>
              <div className="paint-board-summary">
                <div className="studio-mini-stat"><span>Ready</span><strong>{activeTargets.length}</strong></div>
                <div className="studio-mini-stat"><span>Progressed</span><strong>{completedCount}</strong></div>
              </div>
            </div>
          </Card>

          {pendingTargets.length ? (
            <Card className="p-4 sm:p-5">
              <p className="studio-eyebrow">Needs prep attention</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">These selected palette colors still need a recipe before they can appear on the paint board.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingTargets.map((target) => (
                  <span key={target.id} className="studio-chip">{target.label}</span>
                ))}
              </div>
            </Card>
          ) : null}

          {activeTargets.length === 0 ? (
            <Card className="p-6 sm:p-7">
              <p className="studio-eyebrow">Nothing ready yet</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Generate and save recipes in Prep to populate Paint mode.</p>
            </Card>
          ) : null}

          {activeTargets.map((target) => {
            const recipe = target.selectedRecipe!;
            const adjustment = recipe.detailedAdjustments[0];

            return (
              <Card key={target.id} className="p-4 paint-recipe-card paint-recipe-card-minimal">
                <div className="paint-recipe-card-shell">
                  <div className="paint-recipe-card-topline">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{target.label}</h4>
                        <MixStatusChip status={target.mixStatus} />
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Target {target.targetHex}</p>
                    </div>
                    <div className="paint-card-actions">
                      <button className="studio-button studio-button-secondary studio-button-compact" type="button" onClick={onReopenInPrep}>Reopen</button>
                      <button className="studio-button studio-button-secondary studio-button-compact" type="button" onClick={() => handleRemix(target.id)}>Remix</button>
                    </div>
                  </div>

                  <div className="paint-card-hero-grid">
                    <div className="paint-card-swatch-frame">
                      <div className="paint-card-swatch paint-card-swatch-target" style={{ backgroundColor: target.targetHex }} />
                      <div className="paint-card-swatch-labels">
                        <span>Target</span>
                        <span>{target.targetHex}</span>
                      </div>
                    </div>
                    <div className="paint-card-swatch-frame">
                      <div className="paint-card-swatch paint-card-swatch-predicted" style={{ backgroundColor: recipe.predictedHex }} />
                      <div className="paint-card-swatch-labels">
                        <span>Predicted</span>
                        <span>{recipe.predictedHex}</span>
                      </div>
                    </div>
                  </div>

                  <div className="paint-card-ratio-band">
                    <p className="studio-eyebrow">Practical ratio</p>
                    <p className="paint-card-ratio-display">{recipe.practicalRatioText}</p>
                    <p className="paint-card-recipe-text">{recipe.recipeText}</p>
                  </div>

                  <div className="paint-card-quiet-meta">
                    {adjustment ? (
                      <p className="paint-card-adjustment-note">
                        <span className="paint-card-adjustment-label">Next adjustment</span>
                        {adjustment.detail}
                      </p>
                    ) : (
                      <p className="paint-card-adjustment-note"><span className="paint-card-adjustment-label">Mix note</span>No follow-up adjustment saved for this recipe.</p>
                    )}
                  </div>

                  <details className="studio-disclosure paint-detail-disclosure">
                    <summary className="studio-disclosure-summary">
                      <div className="panel-heading-row panel-heading-row-compact">
                        <div>
                          <p className="studio-eyebrow">Optional detail</p>
                          <p className="panel-heading-title panel-heading-title-sm">Status + saved mix notes</p>
                        </div>
                        <span className="studio-chip studio-chip-info">Expand</span>
                      </div>
                    </summary>
                    <div className="mt-4 space-y-4">
                      <div className="studio-panel studio-panel-muted paint-card-status-panel">
                        <div className="flex items-center justify-between gap-3">
                          <p className="studio-eyebrow">Mix status controls</p>
                          <span className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-subtle)]">Tap to update</span>
                        </div>
                        <div className="mt-3 grid gap-2 paint-status-grid">
                          {mixStatuses.map((status) => (
                            <button
                              key={status.value}
                              className={`studio-button studio-button-compact ${target.mixStatus === status.value ? 'studio-button-primary' : 'studio-button-secondary'}`}
                              type="button"
                              onClick={() => updateMixStatus(target.id, status.value)}
                            >
                              {status.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {recipe.layeringSuggestion ? <p className="text-sm leading-5 text-[color:var(--text-muted)]">{recipe.layeringSuggestion}</p> : null}
                    </div>
                  </details>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
