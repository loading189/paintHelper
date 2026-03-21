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
              <p className="studio-eyebrow">Reference</p>
              <h2 className="mt-2 text-[clamp(1.6rem,2.4vw,2.3rem)] font-semibold tracking-[-0.05em] text-[color:var(--text-strong)]">Keep the image in front. Mix from the board.</h2>
              <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-muted)]">The painting target stays dominant on the left while the active palette recipes remain visible and ready to execute on the right.</p>
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
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)] text-sm text-[color:var(--text-muted)]">Add a reference image in Prep to keep it here while painting.</div>
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
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Selected recipe board</h3>
                <p className="mt-2 text-sm text-[color:var(--text-muted)]">Compact mix cards built for fast glancing, quick status updates, and easy reruns.</p>
              </div>
              <div className="paint-board-summary">
                <div className="studio-mini-stat"><span>Ready</span><strong>{activeTargets.length}</strong></div>
                <div className="studio-mini-stat"><span>In progress</span><strong>{completedCount}</strong></div>
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
            const adjustmentLines = recipe.detailedAdjustments.slice(0, 2);
            const mixPathLines = recipe.mixPath.slice(0, 3);

            return (
              <Card key={target.id} className="p-4 paint-recipe-card">
                <div className="paint-recipe-card-shell">
                  <div className="paint-recipe-card-topline">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="truncate text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{target.label}</h4>
                        <MixStatusChip status={target.mixStatus} />
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.14em] text-[color:var(--text-subtle)]">Target {target.targetHex}</p>
                    </div>
                    <div className="paint-card-actions">
                      <button className="studio-button studio-button-secondary studio-button-compact" type="button" onClick={onReopenInPrep}>Reopen</button>
                      <button className="studio-button studio-button-secondary studio-button-compact" type="button" onClick={() => handleRemix(target.id)}>Remix</button>
                    </div>
                  </div>

                  <div className="paint-card-ratio-band">
                    <p className="studio-eyebrow text-stone-300">Practical ratio</p>
                    <p className="mt-2 text-[clamp(1.5rem,2vw,2.1rem)] font-semibold tracking-[-0.06em] text-stone-50">{recipe.practicalRatioText}</p>
                  </div>

                  <div className="paint-swatch-row paint-swatch-row-compact">
                    <div className="paint-swatch-card paint-swatch-card-compact">
                      <p className="studio-eyebrow">Target swatch</p>
                      <div className="paint-swatch-block mt-2" style={{ backgroundColor: target.targetHex }} />
                    </div>
                    <div className="paint-swatch-card paint-swatch-card-compact">
                      <p className="studio-eyebrow">Predicted swatch</p>
                      <div className="paint-swatch-block mt-2" style={{ backgroundColor: recipe.predictedHex }} />
                    </div>
                  </div>

                  <div className="paint-card-grid">
                    <section className="studio-panel studio-panel-strong paint-card-panel">
                      <p className="studio-eyebrow">Mix path</p>
                      <p className="mt-2 text-base font-semibold text-[color:var(--text-strong)]">{recipe.recipeText}</p>
                      <ul className="mt-3 space-y-2 text-sm leading-5 text-[color:var(--text-body)]">
                        {mixPathLines.map((step, index) => (
                          <li key={`${step.paintId ?? step.paintName ?? 'step'}-${index}`} className="paint-card-list-item">• {step.instruction ?? step.detail ?? step.title ?? 'Continue mixing'}</li>
                        ))}
                      </ul>
                      {recipe.mixPath.length > mixPathLines.length ? <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[color:var(--text-subtle)]">+ {recipe.mixPath.length - mixPathLines.length} more steps saved</p> : null}
                    </section>

                    <section className="studio-panel studio-panel-muted paint-card-panel">
                      <p className="studio-eyebrow">Next adjustments</p>
                      {adjustmentLines.length ? (
                        <div className="mt-3 space-y-2.5">
                          {adjustmentLines.map((adjustment) => (
                            <div key={`${adjustment.priority}-${adjustment.detail}`} className="paint-adjustment-item">
                              <p className="font-semibold text-[color:var(--text-strong)]">{adjustment.label}</p>
                              <p className="mt-1 text-sm leading-5 text-[color:var(--text-muted)]">{adjustment.detail}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-[color:var(--text-muted)]">No follow-up adjustment saved for this recipe.</p>
                      )}
                    </section>
                  </div>

                  {recipe.layeringSuggestion ? <p className="text-sm leading-5 text-[color:var(--text-muted)]">{recipe.layeringSuggestion}</p> : null}

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
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};
