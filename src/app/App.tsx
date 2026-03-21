import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { ActivePaintingPage } from '../features/active/ActivePaintingPage';
import { PaintingPrepPage } from '../features/prep/PaintingPrepPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import { createPaintingSession } from '../features/sessions/sessionState';
import type { MixRecipe, Paint, RankedRecipe, UserSettings, WorkspaceView } from '../types/models';
import { createId } from '../lib/utils/id';

const navItems: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'prep', label: 'Prep' },
  { id: 'paint', label: 'Paint' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'projects', label: 'Projects' },
  { id: 'paints', label: 'My Paints' },
];

const App = () => {
  const [view, setView] = useState<WorkspaceView>('prep');
  const [state, setState] = useState(loadAppState);
  const [loadedTargetHex, setLoadedTargetHex] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    if (!saveMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setSaveMessage(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [saveMessage]);

  const currentSession = useMemo(
    () => state.sessions.find((session) => session.id === state.currentSessionId) ?? state.sessions[0] ?? null,
    [state.currentSessionId, state.sessions],
  );

  const prepCounts = useMemo(
    () => ({
      selected: currentSession?.targetOrder.length ?? 0,
      candidates: (currentSession?.sampledColors.length ?? 0) + (currentSession?.extractedCandidatePalette.length ?? 0),
      recipes: currentSession?.targets.filter((target) => target.selectedRecipe).length ?? 0,
    }),
    [currentSession],
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
      achievability: 'headline' in recipe.achievability ? recipe.achievability : { level: 'workable', headline: recipe.achievability.summary, detail: recipe.achievability.detail },
      layeringSuggestion: recipe.layeringSuggestion,
    };

    setState((current) => ({ ...current, recipes: [saved, ...current.recipes] }));
  };

  const setSettings = (settings: UserSettings) => setState((current) => ({ ...current, settings }));

  const addRecentColor = (hex: string) => {
    setState((current) => ({
      ...current,
      recentTargetColors: [{ hex, usedAt: new Date().toISOString() }, ...current.recentTargetColors.filter((entry) => entry.hex !== hex)].slice(0, 8),
    }));
  };

  const updateCurrentSession = (nextSession: NonNullable<typeof currentSession>) => {
    setState((current) => ({
      ...current,
      sessions: current.sessions.map((session) => (session.id === nextSession.id ? nextSession : session)),
    }));
  };

  const saveCurrentProject = () => {
    if (!currentSession) {
      return;
    }

    updateCurrentSession({
      ...currentSession,
      status: currentSession.targets.some((target) => target.selectedRecipe) ? 'active' : currentSession.status,
      updatedAt: new Date().toISOString(),
    });
    setSaveMessage('Saved locally');
  };

  return (
    <div className="studio-app-shell">
      <header className="studio-topbar studio-control-strip" aria-label="Workspace controls">
        <div className="studio-control-cluster studio-control-brand">
          <span className="studio-chip studio-chip-info">Paint Mix Matcher</span>
        </div>

        <nav className="workspace-nav workspace-nav-inline workspace-nav-strip" aria-label="Workspace navigation">
          {navItems.map((item) => (
            <button key={item.id} type="button" className={`workspace-nav-item workspace-nav-pill ${view === item.id ? 'workspace-nav-item-active' : ''}`} onClick={() => setView(item.id)}>
              <span className="text-sm font-semibold text-[color:var(--text-strong)]">{item.label}</span>
            </button>
          ))}
        </nav>

        {currentSession ? (
          <div className="studio-control-cluster studio-control-session">
            <label className="studio-inline-field">
              <span className="studio-inline-label">Project</span>
              <input
                className="studio-input studio-input-compact"
                value={currentSession.title}
                onChange={(event) => updateCurrentSession({ ...currentSession, title: event.target.value, updatedAt: new Date().toISOString() })}
                aria-label="Current project name"
              />
            </label>

            <label className="studio-inline-field studio-inline-field-select">
              <span className="studio-inline-label">Status</span>
              <select
                className="studio-select studio-input-compact"
                value={currentSession.status}
                onChange={(event) => updateCurrentSession({ ...currentSession, status: event.target.value as typeof currentSession.status, updatedAt: new Date().toISOString() })}
                aria-label="Current project status"
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <span className="studio-chip">Selected {prepCounts.selected}</span>
            <span className="studio-chip">Candidates {prepCounts.candidates}</span>
            <span className="studio-chip studio-chip-success">Recipes {prepCounts.recipes}</span>
            {saveMessage ? <span className="studio-chip studio-chip-info">{saveMessage}</span> : null}
            <button className="studio-button studio-button-primary studio-button-compact" type="button" onClick={saveCurrentProject}>Save</button>
          </div>
        ) : (
          <div className="studio-control-cluster studio-control-session">
            <span className="studio-chip">No project</span>
            <button
              className="studio-button studio-button-primary studio-button-compact"
              type="button"
              onClick={() => {
                const session = createPaintingSession({ title: `Painting project ${state.sessions.length + 1}` });
                setState((current) => ({ ...current, sessions: [session, ...current.sessions], currentSessionId: session.id }));
                setView('prep');
              }}
            >
              Create project
            </button>
          </div>
        )}
      </header>

      <main className="studio-main studio-main-fullwidth">
        {view === 'prep' ? (
          <PaintingPrepPage
            session={currentSession}
            paints={state.paints}
            settings={state.settings}
            onSessionChange={(session) => updateCurrentSession(session)}
            onCreateProject={() => {
              const session = createPaintingSession({ title: `Painting project ${state.sessions.length + 1}` });
              setState((current) => ({ ...current, sessions: [session, ...current.sessions], currentSessionId: session.id }));
            }}
          />
        ) : null}

        {view === 'paint' ? (
          <ActivePaintingPage session={currentSession} onSessionChange={(session) => updateCurrentSession(session)} />
        ) : null}

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

        {view === 'projects' ? (
          <SessionsPage
            sessions={state.sessions}
            currentSessionId={state.currentSessionId}
            onSelect={(id) => {
              setState((current) => ({ ...current, currentSessionId: id }));
              setView('prep');
            }}
            onCreate={() => {
              const session = createPaintingSession({ title: `Painting project ${state.sessions.length + 1}` });
              setState((current) => ({ ...current, sessions: [session, ...current.sessions], currentSessionId: session.id }));
              setView('prep');
            }}
          />
        ) : null}

        {view === 'paints' ? (
          <PaintsPage
            paints={state.paints}
            onCreate={upsertPaint}
            onUpdate={upsertPaint}
            onDelete={(paintId) => setState((current) => ({ ...current, paints: current.paints.filter((paint) => paint.id !== paintId) }))}
          />
        ) : null}
      </main>
    </div>
  );
};

export default App;
