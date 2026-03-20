import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SavedRecipesPage } from '../features/recipes/SavedRecipesPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import type { MixRecipe, MixStatus, Paint, RankedRecipe, SessionStatus, UserSettings } from '../types/models';
import { createId } from '../lib/utils/id';
import { ActivePaintingPage } from '../features/active/ActivePaintingPage';
import { PaintingPrepPage } from '../features/prep/PaintingPrepPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import {
  addTargetToSession,
  createPaintingSession,
  duplicatePaintingSession,
  duplicateTargetForRemix,
  generateRecipesForSessionTarget,
  moveTargetWithinSession,
  removeTargetFromSession,
  selectRecipeForTarget,
  setTargetMixStatus,
  toggleActiveTarget,
  togglePinnedTarget,
  updateSessionMeta,
  updateStateSessions,
  updateTargetInSession,
} from '../features/sessions/sessionState';

type View = 'mixer' | 'prep' | 'active' | 'paints' | 'recipes' | 'sessions';

const navItems: Array<{ id: View; label: string; blurb: string }> = [
  { id: 'mixer', label: 'Mixer', blurb: 'Single target recipe generator' },
  { id: 'prep', label: 'Painting Prep', blurb: 'Session planning board' },
  { id: 'active', label: 'Active Painting', blurb: 'Live palette dashboard' },
  { id: 'paints', label: 'My Paints', blurb: 'Inventory and tube roles' },
  { id: 'recipes', label: 'Saved Recipes', blurb: 'Archived mix references' },
  { id: 'sessions', label: 'Sessions', blurb: 'Session archive and duplication' },
];

const App = () => {
  const [view, setView] = useState<View>('prep');
  const [state, setState] = useState(loadAppState);
  const [loadedTargetHex, setLoadedTargetHex] = useState<string | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const counts = useMemo(
    () => ({
      enabledPaints: state.paints.filter((paint) => paint.isEnabled).length,
      savedRecipes: state.recipes.length,
      recentTargets: state.recentTargetColors.length,
      sessions: state.sessions.length,
      activeTargets: state.sessions.find((session) => session.id === state.activeSessionId)?.activeTargetIds.length ?? 0,
    }),
    [state],
  );

  const upsertPaint = (paint: Paint) => {
    setState((current) => {
      const existing = current.paints.some((item) => item.id === paint.id);
      return {
        ...current,
        paints: existing ? current.paints.map((item) => (item.id === paint.id ? paint : item)) : [...current.paints, paint],
      };
    });
  };

  const saveRecipe = (recipe: RankedRecipe, targetHex: string) => {
    const savedName = `Match ${targetHex}`;
    const saved: MixRecipe = {
      id: createId('recipe'),
      targetHex,
      predictedHex: recipe.predictedHex,
      distanceScore: recipe.distanceScore,
      components: recipe.components,
      createdAt: new Date().toISOString(),
      savedName,
      notes: '',
      rankingMode: state.settings.rankingMode,
      qualityLabel: recipe.qualityLabel,
      guidanceText: recipe.guidanceText,
      nextAdjustments: recipe.nextAdjustments,
      detailedAdjustments: recipe.detailedAdjustments,
      scoreBreakdown: recipe.scoreBreakdown,
      exactParts: recipe.exactParts,
      exactPercentages: recipe.exactPercentages,
      exactRatioText: recipe.exactRatioText,
      practicalParts: recipe.practicalParts,
      practicalPercentages: recipe.practicalPercentages,
      practicalRatioText: recipe.practicalRatioText,
      recipeText: recipe.recipeText,
      mixPath: recipe.mixPath,
      stabilityWarnings: recipe.stabilityWarnings,
      roleNotes: recipe.roleNotes,
      achievability: recipe.achievability,
      layeringSuggestion: recipe.layeringSuggestion,
    };

    setState((current) => ({ ...current, recipes: [saved, ...current.recipes] }));
    setView('recipes');
  };

  const setSettings = (settings: UserSettings) => setState((current) => ({ ...current, settings }));

  const addRecentColor = (hex: string) => {
    setState((current) => ({
      ...current,
      recentTargetColors: [{ hex, usedAt: new Date().toISOString() }, ...current.recentTargetColors.filter((entry) => entry.hex !== hex)].slice(0, 8),
    }));
  };

  const createSession = (title: string) => {
    const session = createPaintingSession({ title });
    setState((current) => ({ ...current, sessions: [session, ...current.sessions], activeSessionId: session.id }));
    setView('prep');
  };

  const openSession = (sessionId: string, nextView: View = 'prep') => {
    setState((current) => ({ ...current, activeSessionId: sessionId }));
    setView(nextView);
  };

  return (
    <div className="min-h-screen bg-transparent text-[color:var(--text-body)]">
      <header className="border-b border-[color:var(--border-soft)] bg-[rgba(250,246,240,0.76)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1520px] px-5 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr),360px] xl:items-end">
            <div>
              <p className="studio-eyebrow">Paint Mix Matcher</p>
              <h1 className="mt-3 max-w-5xl text-4xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)] sm:text-5xl xl:text-[3.7rem]">
                A local-only studio assistant for painting prep, color mixing, and active realism workflow.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base">
                Session-based planning, spectral recipe generation, practical palette ratios, and active painting guidance—kept deterministic and fully in-browser.
              </p>
            </div>

            <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[rgba(251,248,243,0.86)] p-5 shadow-[var(--shadow-soft)]">
              <p className="studio-eyebrow">Studio overview</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  { label: 'Enabled paints', value: counts.enabledPaints, note: 'active in recipe search' },
                  { label: 'Sessions', value: counts.sessions, note: 'preparation + painting workflows' },
                  { label: 'Saved recipes', value: counts.savedRecipes, note: 'stored locally in browser' },
                  { label: 'Active board', value: counts.activeTargets, note: 'targets currently in painting mode' },
                ].map((item) => (
                  <div key={item.label} className="studio-metric">
                    <p className="studio-eyebrow">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{item.value}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                Deterministic engine, no cloud sync, no auth, no backend, no hidden state.
              </div>
            </div>
          </div>

          <nav className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {navItems.map((item) => {
              const isActive = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`rounded-[28px] border px-5 py-4 text-left ${
                    isActive
                      ? 'border-[rgba(38,33,29,0.16)] bg-[linear-gradient(180deg,rgba(40,34,31,0.96),rgba(28,24,21,0.96))] text-stone-50 shadow-[0_18px_28px_rgba(33,29,26,0.18)]'
                      : 'border-[color:var(--border-soft)] bg-[rgba(251,248,243,0.78)] text-[color:var(--text-body)] hover:border-[color:var(--border-strong)] hover:bg-[rgba(255,252,247,0.92)]'
                  }`}
                  onClick={() => setView(item.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className={`text-lg font-semibold tracking-[-0.02em] ${isActive ? 'text-stone-50' : 'text-[color:var(--text-strong)]'}`}>{item.label}</p>
                      <p className={`mt-1 text-sm ${isActive ? 'text-stone-300' : 'text-[color:var(--text-muted)]'}`}>{item.blurb}</p>
                    </div>
                    <span className={`studio-chip ${isActive ? 'studio-chip-accent border-white/10 bg-white/10 text-stone-100' : ''}`}>{item.id === 'mixer' ? 'Tool' : item.id === 'active' ? 'Live' : 'Workflow'}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1520px] px-5 pb-14 pt-8 sm:px-6 lg:px-10 lg:pb-20">
        {view === 'mixer' ? (
          <MixerPage
            paints={state.paints}
            settings={state.settings}
            recentColors={state.recentTargetColors.map((entry) => entry.hex)}
            onSettingsChange={setSettings}
            onRecentColor={addRecentColor}
            onSaveRecipe={saveRecipe}
            onLoadTargetHex={loadedTargetHex}
          />
        ) : null}

        {view === 'prep' ? (
          <PaintingPrepPage
            sessions={state.sessions}
            activeSessionId={state.activeSessionId}
            paints={state.paints}
            settings={state.settings}
            onCreateSession={createSession}
            onOpenSession={(sessionId) => openSession(sessionId, 'sessions')}
            onSessionMetaChange={(sessionId, patch) => setState((current) => updateStateSessions(current, sessionId, (session) => updateSessionMeta(session, patch)))}
            onAddTarget={(sessionId, draft) => setState((current) => updateStateSessions(current, sessionId, (session) => addTargetToSession(session, draft)))}
            onUpdateTarget={(sessionId, targetId, patch) => setState((current) => updateStateSessions(current, sessionId, (session) => updateTargetInSession(session, targetId, patch)))}
            onRemoveTarget={(sessionId, targetId) => setState((current) => updateStateSessions(current, sessionId, (session) => removeTargetFromSession(session, targetId)))}
            onGenerateRecipes={(sessionId, targetId) => setState((current) => updateStateSessions(current, sessionId, (session) => generateRecipesForSessionTarget(session, targetId, current.paints, current.settings)))}
            onSelectRecipe={(sessionId, targetId, recipeId, lock) => setState((current) => updateStateSessions(current, sessionId, (session) => selectRecipeForTarget(session, targetId, recipeId, lock)))}
            onMoveTarget={(sessionId, targetId, direction) => setState((current) => updateStateSessions(current, sessionId, (session) => moveTargetWithinSession(session, targetId, direction)))}
            onToggleActiveTarget={(sessionId, targetId) => setState((current) => updateStateSessions(current, sessionId, (session) => toggleActiveTarget(session, targetId)))}
            onAddGeneratedTargets={(sessionId, drafts) =>
              setState((current) =>
                updateStateSessions(current, sessionId, (session) => drafts.reduce((nextSession, draft) => addTargetToSession(nextSession, draft), session)),
              )
            }
          />
        ) : null}

        {view === 'active' ? (
          <ActivePaintingPage
            sessions={state.sessions}
            activeSessionId={state.activeSessionId}
            onOpenSession={(sessionId) => openSession(sessionId, 'prep')}
            onStatusChange={(sessionId, status) => setState((current) => updateStateSessions(current, sessionId, (session) => updateSessionMeta(session, { status } as { status: SessionStatus })))}
            onMixStatusChange={(sessionId, targetId, status: MixStatus) => setState((current) => updateStateSessions(current, sessionId, (session) => setTargetMixStatus(session, targetId, status)))}
            onTogglePin={(sessionId, targetId) => setState((current) => updateStateSessions(current, sessionId, (session) => togglePinnedTarget(session, targetId)))}
            onDuplicateForRemix={(sessionId, targetId) => setState((current) => updateStateSessions(current, sessionId, (session) => duplicateTargetForRemix(session, targetId)))}
            onOpenInPrep={(sessionId) => openSession(sessionId, 'prep')}
          />
        ) : null}

        {view === 'paints' ? (
          <PaintsPage
            paints={state.paints}
            onCreate={upsertPaint}
            onUpdate={upsertPaint}
            onDelete={(paintId) =>
              setState((current) => ({
                ...current,
                paints: current.paints.filter((paint) => paint.id !== paintId),
              }))
            }
          />
        ) : null}

        {view === 'recipes' ? (
          <SavedRecipesPage
            recipes={state.recipes}
            paints={state.paints}
            onDelete={(recipeId) =>
              setState((current) => ({
                ...current,
                recipes: current.recipes.filter((recipe) => recipe.id !== recipeId),
              }))
            }
            onLoadIntoMixer={(recipe) => {
              setLoadedTargetHex(recipe.targetHex);
              setView('mixer');
            }}
            onUpdate={(recipe) =>
              setState((current) => ({
                ...current,
                recipes: current.recipes.map((item) => (item.id === recipe.id ? recipe : item)),
              }))
            }
          />
        ) : null}

        {view === 'sessions' ? (
          <SessionsPage
            sessions={state.sessions}
            activeSessionId={state.activeSessionId}
            onCreate={createSession}
            onOpenInPrep={(sessionId) => openSession(sessionId, 'prep')}
            onOpenInActive={(sessionId) => openSession(sessionId, 'active')}
            onStatusChange={(sessionId, status) => setState((current) => updateStateSessions(current, sessionId, (session) => updateSessionMeta(session, { status } as { status: SessionStatus })))}
            onDuplicate={(sessionId) =>
              setState((current) => {
                const source = current.sessions.find((session) => session.id === sessionId);
                if (!source) {
                  return current;
                }
                const duplicate = duplicatePaintingSession(source);
                return { ...current, sessions: [duplicate, ...current.sessions], activeSessionId: duplicate.id };
              })
            }
            onDelete={(sessionId) =>
              setState((current) => {
                const sessions = current.sessions.filter((session) => session.id !== sessionId);
                return { ...current, sessions, activeSessionId: current.activeSessionId === sessionId ? sessions[0]?.id ?? null : current.activeSessionId };
              })
            }
          />
        ) : null}
      </main>
    </div>
  );
};

export default App;
