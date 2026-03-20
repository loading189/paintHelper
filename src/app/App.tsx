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
import { StudioPanel } from '../components/studio/StudioPanel';

const navItems: Array<{ id: WorkspaceView; label: string; blurb: string }> = [
  { id: 'prep', label: 'Prep', blurb: 'Build a palette from the reference image' },
  { id: 'paint', label: 'Paint', blurb: 'Work from image, palette, and recipes' },
  { id: 'mixer', label: 'Mixer', blurb: 'Standalone one-off color lookup' },
  { id: 'projects', label: 'Projects', blurb: 'Saved painting projects' },
  { id: 'paints', label: 'My Paints', blurb: 'Local paint inventory' },
];

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
      candidates: (currentSession?.sampledColors.length ?? 0) + (currentSession?.extractedCandidatePalette.length ?? 0),
    }),
    [currentSession, state.paints],
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
      <header className="studio-topbar">
        <div>
          <p className="studio-eyebrow">Paint Mix Matcher · simplified workflow</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-strong)] sm:text-4xl">Artist-native spectral painting workflow</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">Prep builds the palette from the image, Paint keeps the image and saved recipes together, and Mixer stays available for quick one-off color checks.</p>
        </div>
        <div className="topbar-stats">
          <div className="studio-mini-stat"><span>Projects</span><strong>{counts.projects}</strong></div>
          <div className="studio-mini-stat"><span>Candidate colors</span><strong>{counts.candidates}</strong></div>
          <div className="studio-mini-stat"><span>Selected palette</span><strong>{counts.paletteColors}</strong></div>
          <div className="studio-mini-stat"><span>Enabled paints</span><strong>{counts.enabledPaints}</strong></div>
        </div>
      </header>

      <div className="studio-workstation">
        <aside className="studio-sidebar">
          <StudioPanel title="Workspace" description="Move through Prep, Paint, Mixer, Projects, and My Paints without breaking the local-only flow.">
            <nav className="workspace-nav">
              {navItems.map((item) => (
                <button key={item.id} type="button" className={`workspace-nav-item ${view === item.id ? 'workspace-nav-item-active' : ''}`} onClick={() => setView(item.id)}>
                  <span className="block text-sm font-semibold text-[color:var(--text-strong)]">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[color:var(--text-muted)]">{item.blurb}</span>
                </button>
              ))}
            </nav>
          </StudioPanel>

          {currentSession ? (
            <StudioPanel title="Current project" description="The selected project carries the reference image, candidate tray, selected palette, and paint status.">
              <div className="space-y-3 text-sm text-[color:var(--text-body)]">
                <div>
                  <p className="font-semibold text-[color:var(--text-strong)]">{currentSession.title}</p>
                  <p className="text-[color:var(--text-muted)]">{currentSession.status}</p>
                </div>
                <div className="sidebar-paint-row">
                  <span className="sidebar-paint-swatch" style={{ backgroundColor: currentSession.targets[0]?.targetHex ?? '#d5cec5' }} />
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--text-strong)]">{currentSession.targets.length} selected palette color{currentSession.targets.length === 1 ? '' : 's'}</p>
                    <p className="text-xs text-[color:var(--text-muted)]">{currentSession.referenceImage ? currentSession.referenceImage.name : 'No reference image yet'}</p>
                  </div>
                </div>
              </div>
            </StudioPanel>
          ) : null}
        </aside>

        <main className="studio-main">
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
    </div>
  );
};

export default App;
