import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { ActivePaintingPage } from '../features/active/ActivePaintingPage';
import { PaintingPrepPage } from '../features/prep/PaintingPrepPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import { createPaintingSession, prepareSessionForPainting } from '../features/sessions/sessionState';
import type { MixRecipe, Paint, RankedRecipe, UserSettings, WorkspaceView } from '../types/models';
import { createId } from '../lib/utils/id';

const navItems: Array<{ id: WorkspaceView; label: string; shortLabel: string }> = [
  { id: 'prep', label: 'Prep', shortLabel: 'Reference + palette planning' },
  { id: 'paint', label: 'Paint', shortLabel: 'Execution board' },
  { id: 'mixer', label: 'Mixer', shortLabel: 'Precision utility' },
  { id: 'projects', label: 'Projects', shortLabel: 'Session library' },
  { id: 'paints', label: 'My Paints', shortLabel: 'Paint inventory' },
];

const App = () => {
  const [view, setView] = useState<WorkspaceView>('prep');
  const [state, setState] = useState(loadAppState);
  const [loadedTargetHex, setLoadedTargetHex] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPreparingSave, setIsPreparingSave] = useState(false);

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

  const activeViewMeta = navItems.find((item) => item.id === view) ?? navItems[0];
  const readyProjects = state.sessions.filter((session) => session.targets.some((target) => target.selectedRecipe)).length;

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

    setIsPreparingSave(true);
    setSaveMessage('Preparing palette locally…');

    const preparedSession = prepareSessionForPainting(currentSession, state.paints, state.settings);
    updateCurrentSession(preparedSession);

    window.setTimeout(() => {
      setIsPreparingSave(false);
      setSaveMessage('Saved locally · palette ready for Paint.');
    }, 0);
  };

  return (
    <div className="studio-app-shell">
      <div className="studio-app-shell__atmosphere" aria-hidden="true" />
      <header className="studio-topbar studio-control-strip" aria-label="Workspace controls">
        <div className="studio-brand-cluster">
          <div className="studio-brand-mark" aria-hidden="true" />
          <div className="studio-brand-copy">
            <span className="studio-eyebrow">Spectral atelier</span>
            <strong>Paint Mix Matcher</strong>
          </div>
        </div>

        <nav className="workspace-nav workspace-nav-inline workspace-nav-strip" aria-label="Workspace navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`workspace-nav-item workspace-nav-pill ${view === item.id ? 'workspace-nav-item-active' : ''}`}
              onClick={() => setView(item.id)}
              aria-pressed={view === item.id}
            >
              <span className="workspace-nav-pill-label">{item.label}</span>
              <span className="workspace-nav-pill-note">{item.shortLabel}</span>
            </button>
          ))}
        </nav>

        <div className="studio-control-cluster studio-control-session">
          {currentSession ? (
            <>
              <label className="studio-inline-field studio-project-field">
                <span className="studio-inline-label">Project</span>
                <input
                  className="studio-input studio-input-compact"
                  value={currentSession.title}
                  onChange={(event) => updateCurrentSession({ ...currentSession, title: event.target.value, updatedAt: new Date().toISOString() })}
                  aria-label="Current project name"
                />
              </label>
              <div className="studio-status-strip" aria-label="Session summary">
                <span className="studio-chip">Mode {activeViewMeta.label}</span>
                <span className="studio-chip">Selected {prepCounts.selected}</span>
                <span className="studio-chip">Candidates {prepCounts.candidates}</span>
                <span className="studio-chip studio-chip-success">Recipes {prepCounts.recipes}</span>
                {saveMessage ? <span className="studio-chip studio-chip-info">{saveMessage}</span> : <span className="studio-chip">Local-only ready</span>}
              </div>
              <button className="studio-button studio-button-primary studio-button-compact" type="button" onClick={saveCurrentProject} disabled={isPreparingSave}>
                {isPreparingSave ? 'Preparing…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <div className="studio-status-strip" aria-label="Studio status">
                <span className="studio-chip">No active project</span>
                <span className="studio-chip studio-chip-info">Projects {state.sessions.length}</span>
                <span className="studio-chip studio-chip-success">Ready {readyProjects}</span>
              </div>
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
            </>
          )}
        </div>
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
          <ActivePaintingPage
            session={currentSession}
            onSessionChange={(session) => updateCurrentSession(session)}
            onReopenInPrep={() => setView('prep')}
          />
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
