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

const navItems: Array<{ id: WorkspaceView; label: string; blurb: string }> = [
  { id: 'prep', label: 'Prep', blurb: 'Build the painting palette from the image' },
  { id: 'paint', label: 'Paint', blurb: 'Large reference with saved recipes' },
  { id: 'mixer', label: 'Mixer', blurb: 'Standalone quick mix utility' },
  { id: 'projects', label: 'Projects', blurb: 'Saved painting workspaces' },
  { id: 'paints', label: 'My Paints', blurb: 'Local paint inventory' },
];

const viewTitles: Record<WorkspaceView, string> = {
  prep: 'Prep workspace',
  paint: 'Paint workspace',
  mixer: 'Mixer utility',
  projects: 'Projects',
  paints: 'My Paints',
};

const App = () => {
  const [view, setView] = useState<WorkspaceView>('prep');
  const [state, setState] = useState(loadAppState);
  const [loadedTargetHex, setLoadedTargetHex] = useState<string | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const currentSession = useMemo(
    () => state.sessions.find((session) => session.id === state.currentSessionId) ?? state.sessions[0] ?? null,
    [state.currentSessionId, state.sessions],
  );

  const counts = useMemo(
    () => ({
      enabledPaints: state.paints.filter((paint) => paint.isEnabled).length,
      projects: state.sessions.length,
      paletteColors: currentSession?.targets.length ?? 0,
      savedRecipes: currentSession?.targets.filter((target) => target.selectedRecipe).length ?? 0,
    }),
    [currentSession, state.paints, state.sessions.length],
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

  return (
    <div className="studio-app-shell">
      <header className="studio-topbar studio-topbar-compact">
        <div className="studio-topbar-brand">
          <p className="studio-eyebrow">Paint Mix Matcher</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.05em] text-[color:var(--text-strong)] sm:text-[2rem]">Artist-native spectral painting workflow</h1>
            <span className="studio-chip studio-chip-info">{viewTitles[view]}</span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--text-muted)]">Prep is palette-first, Paint is image-dominant, and Mixer stays available for focused one-off checks.</p>
        </div>

        <div className="studio-topbar-meta">
          <nav className="workspace-nav workspace-nav-inline" aria-label="Workspace navigation">
            {navItems.map((item) => (
              <button key={item.id} type="button" className={`workspace-nav-item workspace-nav-pill ${view === item.id ? 'workspace-nav-item-active' : ''}`} onClick={() => setView(item.id)}>
                <span className="block text-sm font-semibold text-[color:var(--text-strong)]">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="topbar-stats topbar-stats-compact">
            <div className="studio-mini-stat"><span>Projects</span><strong>{counts.projects}</strong></div>
            <div className="studio-mini-stat"><span>Palette</span><strong>{counts.paletteColors}</strong></div>
            <div className="studio-mini-stat"><span>Recipes</span><strong>{counts.savedRecipes}</strong></div>
            <div className="studio-mini-stat"><span>Paints</span><strong>{counts.enabledPaints}</strong></div>
          </div>
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
