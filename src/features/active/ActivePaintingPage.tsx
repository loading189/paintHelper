import { Card } from '../../components/Card';
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

export const ActivePaintingPage = ({
  session,
  onSessionChange,
  onReopenInPrep,
}: ActivePaintingPageProps) => {
  if (!session) {
    return (
      <Card className="p-6 sm:p-7">
        <div className="space-y-3">
          <p className="studio-kicker">Paint</p>
          <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">
            No project selected
          </h2>
          <p className="text-sm text-[color:var(--text-muted)]">
            Open a project in Prep first.
          </p>
        </div>
      </Card>
    );
  }

  const activeTargets = (
    session.activeTargetIds.length ? session.activeTargetIds : session.targetOrder
  )
    .map((id) => session.targets.find((target) => target.id === id))
    .filter(
      (target): target is NonNullable<typeof target> =>
        Boolean(target?.selectedRecipe),
    );

  const pendingTargets = session.targetOrder
    .map((id) => session.targets.find((target) => target.id === id))
    .filter(
      (target): target is NonNullable<typeof target> =>
        Boolean(target && !target.selectedRecipe),
    );

  const updateMixStatus = (targetId: string, status: MixStatus) => {
    onSessionChange({
      ...session,
      updatedAt: new Date().toISOString(),
      targets: session.targets.map((target) =>
        target.id === targetId ? { ...target, mixStatus: status } : target,
      ),
    });
  };

  const handleRemix = (targetId: string) => {
    onSessionChange(duplicateTargetForRemix(session, targetId));
  };

  return (
    <div className="paint-workspace">
      <div className="paint-layout">
        <section className="paint-reference-shell">
          <Card className="p-4 sm:p-5 paint-reference-card">
            <div className="paint-reference-topline">
              <div>
                <p className="studio-kicker">Painting image</p>
                <h2 className="paint-hero-title">
                  Keep the reference visible and mix from the rail.
                </h2>
              </div>

              <div className="paint-reference-meta">
                <span className="studio-chip studio-chip-info">
                  {activeTargets.length} colors ready
                </span>
              </div>
            </div>

            <div className="mt-4 paint-reference-stage paint-reference-stage-workspace">
              {session.referenceImage?.dataUrl ? (
                <img
                  src={session.referenceImage.dataUrl}
                  alt={session.referenceImage.name}
                  className="paint-reference-image paint-reference-image-workspace"
                />
              ) : (
                <div className="paint-reference-empty">
                  Add a reference image in Prep.
                </div>
              )}
            </div>
          </Card>
        </section>

        <aside className="paint-board paint-board-workspace">
          {pendingTargets.length ? (
            <Card className="p-4 sm:p-5">
              <p className="studio-kicker">Needs recipes</p>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                These selected colors still need recipes before they can appear in
                the working rail.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {pendingTargets.map((target) => (
                  <span key={target.id} className="studio-chip">
                    {target.label}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}

          {activeTargets.length === 0 ? (
            <Card className="p-6 sm:p-7">
              <p className="studio-kicker">Nothing ready yet</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">
                Save from Prep to populate Paint mode.
              </p>
            </Card>
          ) : null}

          {activeTargets.map((target) => {
            const recipe = target.selectedRecipe!;

            return (
              <Card
                key={target.id}
                className="p-4 paint-recipe-card paint-recipe-card-minimal"
              >
                <div className="space-y-4">
                  <div className="paint-card-header">
                    <h3 className="paint-card-title">{target.label}</h3>
                  </div>

                  <div className="paint-card-compare-grid">
                    <div className="paint-card-swatch-frame">
                      <p className="studio-kicker">Goal</p>
                      <div
                        className="paint-card-swatch mt-2"
                        style={{ backgroundColor: target.targetHex }}
                      />
                    </div>

                    <div className="paint-card-swatch-frame">
                      <p className="studio-kicker">Actual</p>
                      <div
                        className="paint-card-swatch mt-2"
                        style={{ backgroundColor: recipe.predictedHex }}
                      />
                    </div>
                  </div>

                  <div className="paint-card-mixture-band">
                    <p className="studio-kicker">Mixture</p>
                    <p className="paint-card-mixture-text">
                      {recipe.recipeText}
                    </p>
                  </div>

                  <details className="studio-disclosure paint-detail-disclosure">
                    <summary className="studio-disclosure-summary">
                      <span className="studio-chip studio-chip-muted">
                        Actions
                      </span>
                    </summary>

                    <div className="mt-3 space-y-3">
                      <div className="paint-card-actions">
                        <button
                          className="studio-button studio-button-secondary studio-button-compact"
                          type="button"
                          onClick={onReopenInPrep}
                        >
                          Reopen in Prep
                        </button>
                        <button
                          className="studio-button studio-button-secondary studio-button-compact"
                          type="button"
                          onClick={() => handleRemix(target.id)}
                        >
                          Duplicate for Remix
                        </button>
                      </div>

                      <div className="paint-status-grid">
                        {mixStatuses.map((status) => (
                          <button
                            key={status.value}
                            className={`studio-button studio-button-compact ${
                              target.mixStatus === status.value
                                ? 'studio-button-primary'
                                : 'studio-button-secondary'
                            }`}
                            type="button"
                            onClick={() =>
                              updateMixStatus(target.id, status.value)
                            }
                          >
                            {status.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </details>
                </div>
              </Card>
            );
          })}
        </aside>
      </div>
    </div>
  );
};