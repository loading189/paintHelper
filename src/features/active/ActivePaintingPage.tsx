import { Card } from '../../components/Card';
import { duplicateTargetForRemix } from '../sessions/sessionState';
import type { MixStatus, PaintingSession } from '../../types/models';
import { useState } from 'react';

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

type CompactRecipeRowProps = {
  target: NonNullable<PaintingSession['targets'][number]>;
  onReopenInPrep: () => void;
  onRemix: (targetId: string) => void;
  onUpdateMixStatus: (targetId: string, status: MixStatus) => void;
};

const CompactRecipeRow = ({
  target,
  onReopenInPrep,
  onRemix,
  onUpdateMixStatus,
}: CompactRecipeRowProps) => {
  const [open, setOpen] = useState(false);
  const recipe = target.selectedRecipe!;

  return (
    <article className="paint-row-card">
      <div className="paint-row-main">
        <div className="paint-row-swatches">
          <div className="paint-row-swatchGroup" title="Goal">
            <span className="paint-row-swatchLabel">G</span>
            <span
              className="paint-row-swatch paint-row-swatch--goal"
              style={{ backgroundColor: target.targetHex }}
            />
          </div>

          <div className="paint-row-swatchGroup" title="Actual">
            <span className="paint-row-swatchLabel">A</span>
            <span
              className="paint-row-swatch paint-row-swatch--actual"
              style={{ backgroundColor: recipe.predictedHex }}
            />
          </div>
        </div>

        <p className="paint-row-recipe" title={recipe.recipeText}>
          {recipe.recipeText}
        </p>

      </div>
    </article>
  );
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
    <div className="paint-workspace paint-workspace-compact">
      <div className="paint-layout paint-layout-compact">
        <section className="paint-reference-shell">
          <Card className="p-4 sm:p-5 paint-reference-card paint-reference-card-compact">
            <div className="paint-reference-topline paint-reference-topline-compact">
              <div className="min-w-0">
                <p className="studio-kicker">Reference</p>
                <h2 className="paint-hero-title paint-hero-title-compact">
                  Keep the image visible.
                </h2>
              </div>

              <div className="paint-reference-meta">
                <span className="studio-chip studio-chip-info">
                  {activeTargets.length} ready
                </span>
              </div>
            </div>

            <div className="mt-3 paint-reference-stage paint-reference-stage-compact">
              {session.referenceImage?.dataUrl ? (
                <img
                  src={session.referenceImage.dataUrl}
                  alt={session.referenceImage.name}
                  className="paint-reference-image paint-reference-image-compact"
                />
              ) : (
                <div className="paint-reference-empty">
                  Add a reference image in Prep.
                </div>
              )}
            </div>
          </Card>
        </section>

        <aside className="paint-board paint-board-compact">
          {pendingTargets.length > 0 ? (
            <Card className="p-4 paint-rail-note-card paint-rail-note-card-compact">
              <p className="studio-kicker">Pending</p>
              <div className="mt-2 flex flex-wrap gap-2">
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
                Save palette colors from Prep to populate Paint mode.
              </p>
            </Card>
          ) : null}

          <div className="paint-rail-list">
            {activeTargets.map((target) => (
              <CompactRecipeRow
                key={target.id}
                target={target}
                onReopenInPrep={onReopenInPrep}
                onRemix={handleRemix}
                onUpdateMixStatus={updateMixStatus}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
};