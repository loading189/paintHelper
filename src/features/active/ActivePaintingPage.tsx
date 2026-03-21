import { Card } from '../../components/Card';
import { MixStatusChip } from '../../components/MixStatusChip';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import type { MixStatus, PaintingSession } from '../../types/models';

const mixStatuses: MixStatus[] = ['not-mixed', 'mixed', 'adjusted', 'remix-needed'];

type ActivePaintingPageProps = {
  session: PaintingSession | null;
  onSessionChange: (session: PaintingSession) => void;
};

export const ActivePaintingPage = ({ session, onSessionChange }: ActivePaintingPageProps) => {
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

  const updateMixStatus = (targetId: string, status: MixStatus) => {
    onSessionChange({
      ...session,
      updatedAt: new Date().toISOString(),
      targets: session.targets.map((target) => target.id === targetId ? { ...target, mixStatus: status } : target),
    });
  };

  return (
    <div className="space-y-5 lg:space-y-6">
      <Card className="p-4 sm:p-5">
        <div className="workspace-header workspace-header-compact">
          <div>
            <p className="studio-eyebrow">Paint</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">Active Painting</h2>
              <span className="studio-chip">{session.title}</span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--text-muted)]">Keep the reference image dominant and the saved palette recipes ready on the right while you paint.</p>
          </div>

          <div className="workspace-header-actions">
            <div className="workspace-stat-row">
              <div className="studio-mini-stat"><span>Recipe cards</span><strong>{activeTargets.length}</strong></div>
              <div className="studio-mini-stat"><span>Mixed</span><strong>{activeTargets.filter((target) => target.mixStatus === 'mixed').length}</strong></div>
              <div className="studio-mini-stat"><span>Adjusted</span><strong>{activeTargets.filter((target) => target.mixStatus === 'adjusted').length}</strong></div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 paint-layout">
        <Card className="p-4 sm:p-5 paint-reference-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="studio-eyebrow">Reference image</p>
              <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Painting image</h3>
            </div>
            <span className="studio-chip studio-chip-info">Image first</span>
          </div>

          <div className="mt-4 paint-reference-stage">
            {session.referenceImage?.dataUrl ? (
              <img src={session.referenceImage.dataUrl} alt={session.referenceImage.name} className="paint-reference-image" />
            ) : (
              <div className="flex min-h-[420px] items-center justify-center rounded-[24px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)] text-sm text-[color:var(--text-muted)]">Add a reference image in Prep to keep it here while painting.</div>
            )}
          </div>
        </Card>

        <div className="space-y-4 paint-board">
          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Recipe board</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Selected palette recipes</h3>
              </div>
              <span className="studio-chip studio-chip-success">{activeTargets.length} ready</span>
            </div>
          </Card>

          {activeTargets.length === 0 ? (
            <Card className="p-6 sm:p-7">
              <p className="studio-eyebrow">Nothing ready yet</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Generate and save recipes in Prep to populate Paint mode.</p>
            </Card>
          ) : null}

          {activeTargets.map((target) => {
            const recipe = target.selectedRecipe!;
            return (
              <Card key={target.id} className="p-4 sm:p-5">
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{target.label}</h4>
                        <MixStatusChip status={target.mixStatus} />
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--text-muted)]">{target.targetHex}</p>
                    </div>
                    <div className="recipe-ratio-hero">
                      <p className="studio-eyebrow text-stone-300">Practical ratio</p>
                      <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-stone-50">{recipe.practicalRatioText}</p>
                    </div>
                  </div>

                  <div className="paint-swatch-row">
                    <div className="paint-swatch-card">
                      <p className="studio-eyebrow">Target swatch</p>
                      <div className="paint-swatch-block mt-3" style={{ backgroundColor: target.targetHex }} />
                    </div>
                    <div className="paint-swatch-card">
                      <p className="studio-eyebrow">Predicted swatch</p>
                      <div className="paint-swatch-block mt-3" style={{ backgroundColor: recipe.predictedHex }} />
                    </div>
                  </div>

                  <div className="studio-panel studio-panel-strong">
                    <p className="studio-eyebrow">Mix path</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{recipe.recipeText}</p>
                    <ul className="mt-4 space-y-2 text-sm leading-6 text-[color:var(--text-body)]">
                      {recipe.mixPath.map((step, index) => <li key={`${step.paintId}-${index}`}>• {step.instruction}</li>)}
                    </ul>
                    {recipe.layeringSuggestion ? <p className="mt-3 text-sm text-[color:var(--text-muted)]">{recipe.layeringSuggestion}</p> : null}
                  </div>

                  <NextAdjustmentBlock adjustments={recipe.detailedAdjustments} />

                  <div className="studio-panel studio-panel-muted">
                    <p className="studio-eyebrow">Mix status controls</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mixStatuses.map((status) => (
                        <button key={status} className={`studio-button ${target.mixStatus === status ? 'studio-button-primary' : 'studio-button-secondary'}`} type="button" onClick={() => updateMixStatus(target.id, status)}>
                          {status}
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
