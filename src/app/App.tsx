import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { ActivePaintingPage } from '../features/active/ActivePaintingPage';
import { PaintingPrepPage } from '../features/prep/PaintingPrepPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import { createPaintingSession, createStarterSessionState, prepareSessionForPainting } from '../features/sessions/sessionState';
import type { MixRecipe, Paint, RankedRecipe, UserSettings, WorkspaceView } from '../types/models';
import { createId } from '../lib/utils/id';

const navItems: Array<{ id: WorkspaceView; label: string }> = [
  { id: 'prep', label: 'Prep' },
  { id: 'paint', label: 'Paint' },
  { id: 'mixer', label: 'Mixer' },
  { id: 'projects', label: 'Projects' },
  { id: 'paints', label: 'Paints' },
];

const App = () => {
  const [view, setView] = useState<WorkspaceView>('prep');
  const [state, setState] = useState(loadAppState);
  const [saveMessage, setSaveMessage] = useState('');
  const [isPreparingSave, setIsPreparingSave] = useState(false);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  useEffect(() => {
    if (!saveMessage) return;
    const t = setTimeout(() => setSaveMessage(''), 2500);
    return () => clearTimeout(t);
  }, [saveMessage]);

  const currentSession = useMemo(
    () =>
      state.sessions.find((s) => s.id === state.currentSessionId) ??
      state.sessions[0] ??
      null,
    [state.currentSessionId, state.sessions],
  );

  const upsertPaint = (paint: Paint) => {
    setState((current) => {
      const exists = current.paints.some((p) => p.id === paint.id);
      return {
        ...current,
        paints: exists
          ? current.paints.map((p) => (p.id === paint.id ? paint : p))
          : [...current.paints, paint],
      };
    });
  };

  const saveRecipe = (recipe: RankedRecipe, targetHex: string) => {
    const saved: MixRecipe = {
      id: createId('recipe'),
      targetHex,
      predictedHex: recipe.predictedHex,
      distanceScore: recipe.distanceScore,
      components: recipe.components,
      createdAt: new Date().toISOString(),
      savedName: `Match ${targetHex}`,
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
      achievability:
        'headline' in recipe.achievability
          ? recipe.achievability
          : {
              level: 'workable',
              headline: recipe.achievability.summary,
              detail: recipe.achievability.detail,
            },
      layeringSuggestion: recipe.layeringSuggestion,
    };

    setState((c) => ({ ...c, recipes: [saved, ...c.recipes] }));
  };

  const setSettings = (settings: UserSettings) =>
    setState((c) => ({ ...c, settings }));

  const addRecentColor = (hex: string) => {
    setState((current) => ({
      ...current,
      recentTargetColors: [
        { hex, usedAt: new Date().toISOString() },
        ...current.recentTargetColors.filter((entry) => entry.hex !== hex),
      ].slice(0, 8),
    }));
  };

  const createProject = () => {
    setState((current) =>
      createStarterSessionState(current, `Painting ${current.sessions.length + 1}`),
    );
  };

  const updateSession = (next: NonNullable<typeof currentSession>) => {
    setState((c) => ({
      ...c,
      sessions: c.sessions.map((s) =>
        s.id === next.id ? next : s,
      ),
    }));
  };

  const saveProject = () => {
    if (!currentSession) return;

    setIsPreparingSave(true);
    setSaveMessage('Preparing palette…');

    const prepared = prepareSessionForPainting(
      currentSession,
      state.paints,
      state.settings,
    );

    updateSession(prepared);

    setTimeout(() => {
      setIsPreparingSave(false);
      setSaveMessage('Ready for Paint');
    }, 300);
  };

  return (
    <div className="studio-app-shell">
      {/* BACKGROUND */}
      <div className="studio-bg" />

      {/* HEADER */}
      <header className="studio-header">
        {/* LEFT */}
        <div className="studio-brand">
          <div className="studio-dot" />
          <span>Paint Mix Matcher</span>
        </div>

        {/* CENTER NAV */}
        <nav className="studio-nav">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`studio-nav-btn ${
                view === item.id ? 'active' : ''
              }`}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* RIGHT */}
        <div className="studio-actions">
          {currentSession ? (
            <>
              <input
                className="studio-project-input"
                value={currentSession.title}
                onChange={(e) =>
                  updateSession({
                    ...currentSession,
                    title: e.target.value,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />

              <button
                className="studio-save-btn"
                onClick={saveProject}
                disabled={isPreparingSave}
              >
                {isPreparingSave ? '…' : 'Save'}
              </button>
            </>
          ) : (
            <button
              className="studio-save-btn"
              onClick={() => {
                const session = createPaintingSession({
                  title: `Painting ${state.sessions.length + 1}`,
                });
                setState((c) => ({
                  ...c,
                  sessions: [session, ...c.sessions],
                  currentSessionId: session.id,
                }));
              }}
            >
              New
            </button>
          )}
        </div>
      </header>

      {/* MAIN */}
      <main className="studio-main">
        {view === 'prep' && (
          <PaintingPrepPage
            session={currentSession}
            paints={state.paints}
            settings={state.settings}
            onSessionChange={updateSession}
            onCreateProject={createProject}
          />
        )}

        {view === 'paint' && (
          <ActivePaintingPage
            session={currentSession}
            onSessionChange={updateSession}
            onReopenInPrep={() => setView('prep')}
          />
        )}

        {view === 'mixer' && (
          <MixerPage
            paints={state.paints}
            settings={state.settings}
            recentColors={state.recentTargetColors.map((c) => c.hex)}
            onSettingsChange={setSettings}
            onRecentColor={addRecentColor}
            onSaveRecipe={saveRecipe}
          />
        )}

        {view === 'projects' && (
          <SessionsPage
            sessions={state.sessions}
            currentSessionId={state.currentSessionId}
            onSelect={(id) => {
              setState((c) => ({ ...c, currentSessionId: id }));
              setView('prep');
            }}
            onCreate={createProject}
          />
        )}

        {view === 'paints' && (
          <PaintsPage
            paints={state.paints}
            onCreate={upsertPaint}
            onUpdate={upsertPaint}
            onDelete={(id) =>
              setState((c) => ({
                ...c,
                paints: c.paints.filter((p) => p.id !== id),
              }))
            }
          />
        )}
      </main>
    </div>
  );
};

export default App;
