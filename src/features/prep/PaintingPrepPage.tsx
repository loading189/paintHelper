import { useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { MixStatusChip } from '../../components/MixStatusChip';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SessionHeader } from '../../components/SessionHeader';
import { SectionTitle } from '../../components/SectionTitle';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
import type { Paint, PaintingSession, PaintingTarget, SessionStatus, TargetPriority, TargetValueRole, UserSettings } from '../../types/models';
import { generateColorFamily } from '../../lib/color/familyGeneration';
import { generateValueLadder } from '../../lib/color/valueRange';
import { sortTargetsForView, summarizeSession } from '../sessions/sessionState';

type PaintingPrepPageProps = {
  sessions: PaintingSession[];
  activeSessionId: string | null;
  paints: Paint[];
  settings: UserSettings;
  onCreateSession: (title: string) => void;
  onOpenSession: (sessionId: string) => void;
  onSessionMetaChange: (sessionId: string, patch: { title?: string; notes?: string; subject?: string; lightingNotes?: string; moodNotes?: string; canvasNotes?: string; status?: SessionStatus }) => void;
  onAddTarget: (sessionId: string, draft: { label: string; targetHex: string; notes?: string; area?: string; family?: string; priority?: TargetPriority; valueRole?: TargetValueRole; tags?: string[] }) => void;
  onUpdateTarget: (sessionId: string, targetId: string, patch: { label?: string; targetHex?: string; notes?: string; area?: string; family?: string; priority?: TargetPriority; valueRole?: TargetValueRole; tags?: string[] }) => void;
  onRemoveTarget: (sessionId: string, targetId: string) => void;
  onGenerateRecipes: (sessionId: string, targetId: string) => void;
  onSelectRecipe: (sessionId: string, targetId: string, recipeId: string, lock?: boolean) => void;
  onMoveTarget: (sessionId: string, targetId: string, direction: 'up' | 'down') => void;
  onToggleActiveTarget: (sessionId: string, targetId: string) => void;
  onAddGeneratedTargets: (sessionId: string, drafts: Array<{ label: string; targetHex: string; notes?: string; family?: string; priority?: TargetPriority; valueRole?: TargetValueRole }>) => void;
};

const priorityOptions: TargetPriority[] = ['primary', 'secondary', 'optional'];
const valueRoleOptions: TargetValueRole[] = ['highlight', 'light', 'midtone', 'shadow', 'accent'];

export const PaintingPrepPage = ({
  sessions,
  activeSessionId,
  paints,
  settings,
  onCreateSession,
  onOpenSession,
  onSessionMetaChange,
  onAddTarget,
  onUpdateTarget,
  onRemoveTarget,
  onGenerateRecipes,
  onSelectRecipe,
  onMoveTarget,
  onToggleActiveTarget,
  onAddGeneratedTargets,
}: PaintingPrepPageProps) => {
  const session = sessions.find((item) => item.id === activeSessionId) ?? sessions[0] ?? null;
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'custom' | 'light-to-dark' | 'warm-to-cool' | 'primary-first'>('custom');
  const [targetDraft, setTargetDraft] = useState({ label: '', targetHex: '#7A8FB3', notes: '', area: '', family: '', priority: 'primary' as TargetPriority, valueRole: 'midtone' as TargetValueRole });

  const orderedTargets = useMemo(() => (session ? sortTargetsForView(session, sortMode) : []), [session, sortMode]);
  const selectedTarget = orderedTargets.find((target) => target.id === (selectedTargetId ?? orderedTargets[0]?.id)) ?? orderedTargets[0] ?? null;
  const summary = session ? summarizeSession(session) : null;

  if (!session || !summary) {
    return (
      <div className="space-y-6 lg:space-y-8">
        <Card className="p-6 sm:p-7">
          <SectionTitle eyebrow="Preparation mode" description="Build a session first so target colors, chosen recipes, and active painting cues stay connected.">
            Painting preparation board
          </SectionTitle>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="studio-button studio-button-primary" type="button" onClick={() => onCreateSession('New painting session')}>
              Create first session
            </button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <SessionHeader
          session={session}
          summary={[
            { label: 'Targets', value: summary.targetCount, note: 'planned color notes in this session' },
            { label: 'Locked recipes', value: summary.lockedCount, note: 'targets ready for painting' },
            { label: 'Active targets', value: summary.activeCount, note: 'currently included on the active board' },
          ]}
          actions={
            <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
              Deterministic planning board. Recipes only generate when you ask for them.
            </div>
          }
        />
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.15fr),420px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <SectionTitle eyebrow="Session notes" description="Keep the planning context nearby so prep decisions stay tied to subject, lighting, and mood.">
                Session direction
              </SectionTitle>
              <div className="flex flex-wrap gap-3">
                <select className="studio-select max-w-[180px]" value={session.status} onChange={(event) => onSessionMetaChange(session.id, { status: event.target.value as SessionStatus })}>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
                <select className="studio-select max-w-[200px]" value={sortMode} onChange={(event) => setSortMode(event.target.value as typeof sortMode)}>
                  <option value="custom">Custom order</option>
                  <option value="light-to-dark">Light to dark</option>
                  <option value="warm-to-cool">Warm to cool</option>
                  <option value="primary-first">Primary first</option>
                </select>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Title</span>
                <input className="studio-input" value={session.title} onChange={(event) => onSessionMetaChange(session.id, { title: event.target.value })} />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Subject</span>
                <input className="studio-input" value={session.subject ?? ''} onChange={(event) => onSessionMetaChange(session.id, { subject: event.target.value })} placeholder="Still life with copper cup" />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Lighting notes</span>
                <input className="studio-input" value={session.lightingNotes ?? ''} onChange={(event) => onSessionMetaChange(session.id, { lightingNotes: event.target.value })} placeholder="Warm side light, cool reflected fill" />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Mood notes</span>
                <input className="studio-input" value={session.moodNotes ?? ''} onChange={(event) => onSessionMetaChange(session.id, { moodNotes: event.target.value })} placeholder="Quiet, restrained, cool shadows" />
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Session notes</span>
                <textarea className="studio-textarea min-h-28" value={session.notes ?? ''} onChange={(event) => onSessionMetaChange(session.id, { notes: event.target.value })} placeholder="What needs to be pre-mixed before the painting session starts?" />
              </label>
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Target intake" description="Add the colors you expect to need before painting so each one can carry its own recipe options and lock state.">
              Add target color
            </SectionTitle>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Label</span>
                <input className="studio-input" value={targetDraft.label} onChange={(event) => setTargetDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Leaf highlight" />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Target hex</span>
                <input className="studio-input" value={targetDraft.targetHex} onChange={(event) => setTargetDraft((current) => ({ ...current, targetHex: event.target.value }))} />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Area</span>
                <input className="studio-input" value={targetDraft.area} onChange={(event) => setTargetDraft((current) => ({ ...current, area: event.target.value }))} placeholder="Foreground leaf cluster" />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Family</span>
                <input className="studio-input" value={targetDraft.family} onChange={(event) => setTargetDraft((current) => ({ ...current, family: event.target.value }))} placeholder="Leaf family" />
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Priority</span>
                <select className="studio-select" value={targetDraft.priority} onChange={(event) => setTargetDraft((current) => ({ ...current, priority: event.target.value as TargetPriority }))}>
                  {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Value role</span>
                <select className="studio-select" value={targetDraft.valueRole} onChange={(event) => setTargetDraft((current) => ({ ...current, valueRole: event.target.value as TargetValueRole }))}>
                  {valueRoleOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="md:col-span-2">
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Notes</span>
                <textarea className="studio-textarea min-h-24" value={targetDraft.notes} onChange={(event) => setTargetDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Reflected light should stay cooler than the main leaf family." />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="studio-button studio-button-primary" type="button" onClick={() => {
                onAddTarget(session.id, { ...targetDraft, tags: [] });
                setTargetDraft((current) => ({ ...current, label: '', notes: '' }));
              }}>
                Add target
              </button>
              <button className="studio-button studio-button-secondary" type="button" onClick={() => onOpenSession(session.id)}>
                Open session archive entry
              </button>
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Palette planning board" description="Review targets like a preparation wall: swatches first, practical recipe cues second, scoring tucked behind the scenes.">
              Session targets
            </SectionTitle>
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {orderedTargets.map((target) => {
                const selectedRecipe = target.selectedRecipe ?? target.recipeOptions.find((recipe) => recipe.id === target.selectedRecipeId);
                const isSelected = selectedTarget?.id === target.id;
                return (
                  <button
                    key={target.id}
                    type="button"
                    className={`rounded-[30px] border p-5 text-left transition ${isSelected ? 'border-[rgba(38,33,29,0.16)] bg-[rgba(251,248,243,0.96)] shadow-[var(--shadow-soft)]' : 'border-[color:var(--border-soft)] bg-[color:var(--surface-1)]/74 hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,252,247,0.92)]'}`}
                    onClick={() => setSelectedTargetId(target.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">{target.label}</h3>
                          <MixStatusChip status={target.mixStatus} />
                        </div>
                        <p className="mt-1 text-sm text-[color:var(--text-muted)]">{target.area ?? 'No area note'} · {target.valueRole ?? 'unassigned value role'}</p>
                      </div>
                      <div className="flex gap-2">
                        {target.priority ? <span className="studio-chip studio-chip-info">{target.priority}</span> : null}
                        {target.prepStatus === 'locked' ? <span className="studio-chip studio-chip-accent">Locked</span> : null}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-3">
                        <p className="studio-eyebrow">Target</p>
                        <div className="mt-3 h-20 rounded-[18px] border border-black/10" style={{ backgroundColor: target.targetHex }} />
                      </div>
                      <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-3">
                        <p className="studio-eyebrow">Chosen mix</p>
                        <div className="mt-3 h-20 rounded-[18px] border border-black/10" style={{ backgroundColor: selectedRecipe?.predictedHex ?? '#d6d0c8' }} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="studio-chip">{selectedRecipe?.practicalRatioText ?? 'No recipe selected'}</span>
                      {selectedRecipe?.achievability ? <span className={`studio-chip ${selectedRecipe.achievability.level === 'limited' ? 'studio-chip-warm' : 'studio-chip-success'}`.trim()}>{selectedRecipe.achievability.headline}</span> : null}
                    </div>
                    {selectedRecipe?.detailedAdjustments[0] ? <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">Next: {selectedRecipe.detailedAdjustments[0].detail}</p> : null}
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {selectedTarget ? (
            <Card className="p-5 sm:p-7">
              <SectionTitle eyebrow="Target detail" description="Tune the current target, generate deterministic options, and lock the recipe you actually want to carry into the painting session.">
                {selectedTarget.label}
              </SectionTitle>
              <div className="mt-6 space-y-4">
                <SwatchComparisonPanel targetHex={selectedTarget.targetHex} predictedHex={selectedTarget.selectedRecipe?.predictedHex} targetHelper={selectedTarget.valueRole} predictedHelper={selectedTarget.selectedRecipe?.qualityLabel} />

                <div className="grid gap-4">
                  <label>
                    <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Label</span>
                    <input className="studio-input" value={selectedTarget.label} onChange={(event) => onUpdateTarget(session.id, selectedTarget.id, { label: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Target hex</span>
                    <input className="studio-input" value={selectedTarget.targetHex} onChange={(event) => onUpdateTarget(session.id, selectedTarget.id, { targetHex: event.target.value })} />
                  </label>
                  <label>
                    <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Notes</span>
                    <textarea className="studio-textarea min-h-24" value={selectedTarget.notes ?? ''} onChange={(event) => onUpdateTarget(session.id, selectedTarget.id, { notes: event.target.value })} />
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button className="studio-button studio-button-primary" type="button" onClick={() => onGenerateRecipes(session.id, selectedTarget.id)}>Generate recipes</button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onToggleActiveTarget(session.id, selectedTarget.id)}>
                    {session.activeTargetIds.includes(selectedTarget.id) ? 'Remove from active board' : 'Include on active board'}
                  </button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onMoveTarget(session.id, selectedTarget.id, 'up')}>Move up</button>
                  <button className="studio-button studio-button-secondary" type="button" onClick={() => onMoveTarget(session.id, selectedTarget.id, 'down')}>Move down</button>
                  <button className="studio-button studio-button-danger" type="button" onClick={() => onRemoveTarget(session.id, selectedTarget.id)}>Delete target</button>
                </div>

                <div className="grid gap-3">
                  <button className="studio-button studio-button-secondary justify-start" type="button" onClick={() => onAddGeneratedTargets(session.id, generateColorFamily(selectedTarget.label, selectedTarget.targetHex, paints, selectedTarget.family))}>
                    Generate family
                  </button>
                  <button className="studio-button studio-button-secondary justify-start" type="button" onClick={() => {
                    const ladder = generateValueLadder(selectedTarget.targetHex, paints);
                    onAddGeneratedTargets(session.id, [
                      { label: `${selectedTarget.label} lighter`, targetHex: ladder.lighterHex, notes: 'Generated lighter value ladder target.', family: selectedTarget.family, priority: 'secondary', valueRole: 'light' },
                      { label: `${selectedTarget.label} darker`, targetHex: ladder.darkerHex, notes: 'Generated darker value ladder target.', family: selectedTarget.family, priority: 'secondary', valueRole: 'shadow' },
                      { label: `${selectedTarget.label} muted`, targetHex: ladder.mutedHex, notes: 'Generated muted value ladder target.', family: selectedTarget.family, priority: 'optional', valueRole: 'accent' },
                    ]);
                  }}>
                    Generate value ladder
                  </button>
                </div>

                {selectedTarget.recipeOptions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="rounded-[28px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-4">
                      <p className="studio-eyebrow">Recipe options</p>
                      <div className="mt-3 space-y-3">
                        {selectedTarget.recipeOptions.map((recipe) => (
                          <div key={recipe.id} className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-base font-semibold text-[color:var(--text-strong)]">{recipe.recipeText}</p>
                                <p className="mt-1 text-sm text-[color:var(--text-muted)]">Practical ratio {recipe.practicalRatioText} · {recipe.qualityLabel}</p>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <button className="studio-button studio-button-secondary" type="button" onClick={() => onSelectRecipe(session.id, selectedTarget.id, recipe.id)}>Choose</button>
                                <button className="studio-button studio-button-primary" type="button" onClick={() => onSelectRecipe(session.id, selectedTarget.id, recipe.id, true)}>Lock</button>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {recipe.badges.map((badge) => <span key={badge} className="studio-chip">{badge}</span>)}
                              <span className={`studio-chip ${recipe.achievability.level === 'limited' ? 'studio-chip-warm' : 'studio-chip-success'}`.trim()}>{recipe.achievability.headline}</span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">{recipe.achievability.detail}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {selectedTarget.selectedRecipe ? (
                      <>
                        <NextAdjustmentBlock adjustments={selectedTarget.selectedRecipe.detailedAdjustments} />
                        <MixPathBlock steps={selectedTarget.selectedRecipe.mixPath} warnings={selectedTarget.selectedRecipe.stabilityWarnings} layeringSuggestion={selectedTarget.selectedRecipe.layeringSuggestion} />
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)]/74 px-5 py-8 text-center">
                    <p className="studio-eyebrow">No recipes yet</p>
                    <p className="mt-3 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">Generate options when this target is ready</p>
                    <p className="mt-3 text-sm leading-7 text-[color:var(--text-muted)]">The existing spectral engine stays on-demand: recipes only generate when you click.</p>
                  </div>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
};
