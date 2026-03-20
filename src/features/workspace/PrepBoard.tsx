import { useMemo } from 'react';
import { SwatchComparisonPanel } from '../../components/studio/SwatchComparisonPanel';
import { StudioPanel } from '../../components/studio/StudioPanel';
import { TargetCard } from '../../components/studio/TargetCard';
import { SessionHeader } from '../../components/studio/SessionHeader';
import { enrichRankedRecipe, generateRecipeForTarget, generateValueVariants, sortTargets } from '../../lib/session/workflow';
import type { Paint, PaintingSession, PaintingTarget, UserSettings } from '../../types/models';

export const PrepBoard = ({
  session,
  paints,
  settings,
  selectedTargetId,
  onSelectTarget,
  onSessionChange,
  onOpenSampler,
}: {
  session: PaintingSession;
  paints: Paint[];
  settings: UserSettings;
  selectedTargetId: string | null;
  onSelectTarget: (id: string) => void;
  onSessionChange: (session: PaintingSession) => void;
  onOpenSampler: () => void;
}) => {
  const sortedTargets = useMemo(() => sortTargets(session.targets, session.targetSortMode), [session.targets, session.targetSortMode]);
  const selectedTarget = sortedTargets.find((target) => target.id === selectedTargetId) ?? sortedTargets[0] ?? null;
  const selectedRecipe = selectedTarget?.recipe;

  const updateTarget = (targetId: string, updater: (target: PaintingTarget) => PaintingTarget) => {
    onSessionChange({
      ...session,
      updatedAt: new Date().toISOString(),
      targets: session.targets.map((target) => (target.id === targetId ? updater(target) : target)),
    });
  };

  return (
    <div className="space-y-6">
      <StudioPanel tone="strong">
        <SessionHeader
          session={session}
          onRename={(name) => onSessionChange({ ...session, name, updatedAt: new Date().toISOString() })}
          onDescriptionChange={(description) => onSessionChange({ ...session, description, updatedAt: new Date().toISOString() })}
          onStartPainting={() => onSessionChange({ ...session, status: 'active', updatedAt: new Date().toISOString() })}
        />
      </StudioPanel>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.2fr),420px]">
        <StudioPanel
          eyebrow="Target board"
          title="Painting prep board"
          description="Organize sampled or manual targets, generate spectral recipes, and build value / family variations before you move to the easel."
        >
          <div className="mb-5 flex flex-wrap gap-3">
            <button className="studio-button studio-button-primary" type="button" onClick={onOpenSampler}>Open reference sampler</button>
            <button
              className="studio-button studio-button-secondary"
              type="button"
              onClick={() => onSessionChange({
                ...session,
                targets: [...session.targets, {
                  id: `manual-${Date.now()}`,
                  name: `Manual target ${session.targets.length + 1}`,
                  hex: '#8A7F74',
                  role: 'secondary',
                  priority: 1,
                  source: 'manual',
                  addedAt: new Date().toISOString(),
                  sortIndex: session.targets.length,
                  mixStatus: 'not-mixed',
                  isPinned: false,
                }],
                updatedAt: new Date().toISOString(),
              })}
            >
              Add manual target
            </button>
            <select
              className="studio-select max-w-[220px]"
              value={session.targetSortMode}
              onChange={(event) => onSessionChange({ ...session, targetSortMode: event.target.value as PaintingSession['targetSortMode'], updatedAt: new Date().toISOString() })}
            >
              <option value="custom">Custom order</option>
              <option value="light-to-dark">Light to dark</option>
              <option value="family">Family</option>
              <option value="priority">Priority</option>
            </select>
          </div>

          <div className="target-grid">
            {sortedTargets.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                selected={selectedTarget?.id === target.id}
                onSelect={() => onSelectTarget(target.id)}
                onTogglePin={() => updateTarget(target.id, (current) => ({ ...current, isPinned: !current.isPinned }))}
              />
            ))}
          </div>
        </StudioPanel>

        <StudioPanel
          eyebrow="Selected target"
          title={selectedTarget?.name ?? 'No target selected'}
          description="Review swatches, generate a locked spectral recipe, and create deterministic value or family variants."
        >
          {selectedTarget ? (
            <div className="space-y-5">
              <SwatchComparisonPanel targetHex={selectedTarget.hex} predictedHex={selectedRecipe?.predictedHex} />
              <label className="block">
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Target notes / area tag</span>
                <textarea
                  className="studio-textarea min-h-28"
                  value={selectedTarget.notes ?? ''}
                  onChange={(event) => updateTarget(selectedTarget.id, (current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Skin midtone, underpainting shadow edge, sky accent, etc."
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="studio-button studio-button-primary"
                  type="button"
                  onClick={() => updateTarget(selectedTarget.id, (current) => ({ ...current, recipe: generateRecipeForTarget(current.hex, paints, settings) }))}
                >
                  {selectedRecipe ? 'Regenerate recipe' : 'Generate recipe'}
                </button>
                <button
                  className="studio-button studio-button-secondary"
                  type="button"
                  onClick={() => onSessionChange({
                    ...session,
                    updatedAt: new Date().toISOString(),
                    targets: [...session.targets, ...generateValueVariants(selectedTarget).map((variant, index) => ({ ...variant, sortIndex: session.targets.length + index }))],
                  })}
                >
                  Generate family / value set
                </button>
              </div>

              {selectedRecipe ? (
                <>
                  <div className="studio-panel-block">
                    <p className="studio-eyebrow">Recipe overview</p>
                    <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-strong)]">{selectedRecipe.practicalRatioText}</p>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{selectedRecipe.recipeText}</p>
                  </div>
                  <div className="studio-panel-block">
                    <p className="studio-eyebrow">Mix path</p>
                    <ol className="mt-3 space-y-3 text-sm text-[color:var(--text-body)]">
                      {(selectedRecipe.mixPath ?? enrichRankedRecipe(selectedRecipe, paints).mixPath ?? []).map((step) => (
                        <li key={step.title} className="rounded-2xl border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3">
                          <strong className="block text-[color:var(--text-strong)]">{step.title}</strong>
                          <span className="mt-1 block leading-6">{step.detail}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="studio-panel-block">
                    <p className="studio-eyebrow">Achievability</p>
                    <p className="mt-3 text-sm text-[color:var(--text-body)]">{selectedRecipe.achievability?.summary ?? enrichRankedRecipe(selectedRecipe, paints).achievability?.summary}</p>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{selectedRecipe.achievability?.detail ?? enrichRankedRecipe(selectedRecipe, paints).achievability?.detail}</p>
                  </div>
                  <div className="studio-panel-block">
                    <p className="studio-eyebrow">Next adjustments</p>
                    <ul className="mt-3 space-y-2 text-sm text-[color:var(--text-body)]">
                      {selectedRecipe.nextAdjustments.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="studio-empty-state">Generate a recipe to populate the prep detail view.</div>
              )}
            </div>
          ) : (
            <div className="studio-empty-state">Add or import targets from the reference sampler to begin planning.</div>
          )}
        </StudioPanel>
      </div>
    </div>
  );
};
