import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { MixStatusChip } from '../../components/MixStatusChip';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SessionHeader } from '../../components/SessionHeader';
import { SectionTitle } from '../../components/SectionTitle';
import type { MixStatus, PaintingSession } from '../../types/models';
import { getActivePaintingTargets, sortTargetsForView, summarizeSession } from '../sessions/sessionState';

type ActivePaintingPageProps = {
  sessions: PaintingSession[];
  activeSessionId: string | null;
  onOpenSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: PaintingSession['status']) => void;
  onMixStatusChange: (sessionId: string, targetId: string, status: MixStatus) => void;
  onTogglePin: (sessionId: string, targetId: string) => void;
  onDuplicateForRemix: (sessionId: string, targetId: string) => void;
  onOpenInPrep: (sessionId: string, targetId: string) => void;
};

const mixStatuses: MixStatus[] = ['not-mixed', 'mixed', 'adjusted', 'remix-needed'];

export const ActivePaintingPage = ({
  sessions,
  activeSessionId,
  onOpenSession,
  onStatusChange,
  onMixStatusChange,
  onTogglePin,
  onDuplicateForRemix,
  onOpenInPrep,
}: ActivePaintingPageProps) => {
  const session = sessions.find((item) => item.id === activeSessionId) ?? sessions.find((item) => item.status === 'active') ?? sessions[0] ?? null;
  const [sortMode, setSortMode] = useState<'pinned-first' | 'not-mixed-first' | 'light-to-dark' | 'custom' | 'primary-first'>('pinned-first');
  const summary = session ? summarizeSession(session) : null;

  const activeTargets = useMemo(() => {
    if (!session) {
      return [];
    }
    const activeIds = new Set(getActivePaintingTargets(session).map((target) => target.id));
    return sortTargetsForView(session, sortMode).filter((target) => activeIds.has(target.id) && target.selectedRecipe);
  }, [session, sortMode]);

  if (!session || !summary) {
    return (
      <Card className="p-6 sm:p-7">
        <SectionTitle eyebrow="Active painting" description="Activate a session from Painting Prep or Sessions before using the low-friction painting dashboard.">
          No active painting session yet
        </SectionTitle>
      </Card>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <SessionHeader
          session={session}
          summary={[
            { label: 'Board targets', value: activeTargets.length, note: 'selected targets shown while painting' },
            { label: 'Mixed', value: activeTargets.filter((target) => target.mixStatus === 'mixed').length, note: 'targets already laid out' },
            { label: 'Remix needed', value: activeTargets.filter((target) => target.mixStatus === 'remix-needed').length, note: 'targets calling for another pass' },
          ]}
          actions={
            <div className="space-y-3">
              <select className="studio-select" value={session.status} onChange={(event) => onStatusChange(session.id, event.target.value as PaintingSession['status'])}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
              <select className="studio-select" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                <option value="pinned-first">Pinned first</option>
                <option value="not-mixed-first">Not mixed first</option>
                <option value="light-to-dark">Light to dark</option>
                <option value="primary-first">Primary first</option>
                <option value="custom">Custom order</option>
              </select>
            </div>
          }
        />
      </Card>

      {activeTargets.length === 0 ? (
        <Card className="p-6 sm:p-7">
          <div className="rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)]/74 px-5 py-10 text-center">
            <p className="studio-eyebrow">Board empty</p>
            <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Select and include prep targets first</p>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">The active dashboard only shows chosen colors with selected recipes, keeping the painting view large, clean, and glanceable.</p>
            <div className="mt-5">
              <button className="studio-button studio-button-primary" type="button" onClick={() => onOpenSession(session.id)}>Open session planning</button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {activeTargets.map((target) => {
          const recipe = target.selectedRecipe!;
          const isPinned = session.pinnedTargetIds.includes(target.id);
          return (
            <Card key={target.id} className="p-5 sm:p-7">
              <div className="space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[1.55rem] font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">{target.label}</h3>
                      <MixStatusChip status={target.mixStatus} />
                      {isPinned ? <span className="studio-chip studio-chip-accent">Pinned</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">{target.area ?? target.family ?? 'No area grouping'} · {target.valueRole ?? 'unassigned value role'}</p>
                  </div>
                  <div className="rounded-[24px] border border-[rgba(38,33,29,0.12)] bg-[linear-gradient(180deg,rgba(40,34,31,0.98),rgba(30,26,23,0.96))] px-5 py-4 text-right text-stone-50">
                    <p className="studio-eyebrow text-stone-300">Practical ratio</p>
                    <p className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{recipe.practicalRatioText}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-300">{recipe.practicalPercentages.map((percentage) => `${percentage}%`).join(' · ')}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
                    <p className="studio-eyebrow">Target</p>
                    <div className="mt-3 h-36 rounded-[20px] border border-black/10" style={{ backgroundColor: target.targetHex }} />
                  </div>
                  <div className="rounded-[26px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
                    <p className="studio-eyebrow">Predicted</p>
                    <div className="mt-3 h-36 rounded-[20px] border border-black/10" style={{ backgroundColor: recipe.predictedHex }} />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="studio-panel studio-panel-muted">
                    <p className="studio-eyebrow">Recipe</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{recipe.recipeText}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{recipe.achievability.headline} · {recipe.achievability.detail}</p>
                  </div>
                  <div className="studio-panel studio-panel-muted">
                    <p className="studio-eyebrow">Mix status</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {mixStatuses.map((status) => (
                        <button key={status} className={`studio-button ${target.mixStatus === status ? 'studio-button-primary' : 'studio-button-secondary'}`.trim()} type="button" onClick={() => onMixStatusChange(session.id, target.id, status)}>
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <NextAdjustmentBlock adjustments={recipe.detailedAdjustments} />
                <MixPathBlock steps={recipe.mixPath} warnings={recipe.stabilityWarnings} layeringSuggestion={recipe.layeringSuggestion} />

                <div className="flex flex-wrap gap-3">
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onTogglePin(session.id, target.id)}>
                    {isPinned ? 'Unpin' : 'Pin to top'}
                  </button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onDuplicateForRemix(session.id, target.id)}>
                    Duplicate for remix
                  </button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onOpenInPrep(session.id, target.id)}>
                    Reopen in prep
                  </button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
