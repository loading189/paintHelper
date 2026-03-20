import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SavedRecipesPage } from '../features/recipes/SavedRecipesPage';
import { ReferenceSamplerPage } from '../features/reference/ReferenceSamplerPage';
import { SessionsPage } from '../features/sessions/SessionsPage';
import { ActivePaintingBoard } from '../features/workspace/ActivePaintingBoard';
import { PrepBoard } from '../features/workspace/PrepBoard';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import type { MixRecipe, Paint, PaintingSession, RankedRecipe, UserSettings, WorkspaceView } from '../types/models';
import { createId } from '../lib/utils/id';
import { StudioPanel } from '../components/studio/StudioPanel';

const navItems: Array<{ id: WorkspaceView; label: string; blurb: string }> = [
  { id: 'mixer', label: 'Mixer', blurb: 'Target color exploration' },
  { id: 'prep', label: 'Painting Prep', blurb: 'Target board and recipe locks' },
  { id: 'active', label: 'Active Painting', blurb: 'Large live palette dashboard' },
  { id: 'sampler', label: 'Reference Sampler', blurb: 'Canvas eyedropper and palette extraction' },
  { id: 'sessions', label: 'Sessions', blurb: 'Project context and switching' },
  { id: 'paints', label: 'My Paints', blurb: 'Inventory and paint roles' },
  { id: 'recipes', label: 'Saved Recipes', blurb: 'Local recipe archive' },
];

const App = () => {
  const [view, setView] = useState<WorkspaceView>('prep');
  const [state, setState] = useState(loadAppState);
  const [loadedTargetHex, setLoadedTargetHex] = useState<string | null>(null);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

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
      savedRecipes: state.recipes.length,
      sessionTargets: currentSession?.targets.length ?? 0,
      samples: state.sampler.samples.length,
    }),
    [currentSession?.targets.length, state.paints, state.recipes.length, state.sampler.samples.length],
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
      scoreBreakdown: recipe.scoreBreakdown,
      exactParts: recipe.exactParts,
      exactPercentages: recipe.exactPercentages,
      exactRatioText: recipe.exactRatioText,
      practicalParts: recipe.practicalParts,
      practicalPercentages: recipe.practicalPercentages,
      practicalRatioText: recipe.practicalRatioText,
      recipeText: recipe.recipeText,
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

  const updateCurrentSession = (session: PaintingSession) => {
    setState((current) => ({
      ...current,
      sessions: current.sessions.map((item) => (item.id === session.id ? session : item)),
    }));
  };

  return (
    <div className="studio-app-shell">
      <header className="studio-topbar">
        <div>
          <p className="studio-eyebrow">Paint Mix Matcher · Major studio release</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-[color:var(--text-strong)] sm:text-4xl">Spectral painting workstation</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--text-muted)]">A premium, local-only color lab for building sessions, sampling references, extracting palettes, preparing targets, and painting from a live dashboard.</p>
        </div>
        <div className="topbar-stats">
          <div className="studio-mini-stat"><span>Enabled paints</span><strong>{counts.enabledPaints}</strong></div>
          <div className="studio-mini-stat"><span>Session targets</span><strong>{counts.sessionTargets}</strong></div>
          <div className="studio-mini-stat"><span>Reference samples</span><strong>{counts.samples}</strong></div>
          <div className="studio-mini-stat"><span>Saved recipes</span><strong>{counts.savedRecipes}</strong></div>
        </div>
      </header>

      <div className="studio-workstation">
        <aside className="studio-sidebar">
          <StudioPanel title="Workspaces" description="Move through the painting workflow without leaving the same studio shell.">
            <nav className="workspace-nav">
              {navItems.map((item) => (
                <button key={item.id} type="button" className={`workspace-nav-item ${view === item.id ? 'workspace-nav-item-active' : ''}`} onClick={() => setView(item.id)}>
                  <span className="block text-sm font-semibold text-[color:var(--text-strong)]">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-[color:var(--text-muted)]">{item.blurb}</span>
                </button>
              ))}
            </nav>
          </StudioPanel>

          <StudioPanel title="Paint inventory" description="Your on-hand palette remains persistent and drives every spectral prediction.">
            <div className="space-y-3">
              {state.paints.filter((paint) => paint.isEnabled).map((paint) => (
                <div key={paint.id} className="sidebar-paint-row">
                  <span className="sidebar-paint-swatch" style={{ backgroundColor: paint.hex }} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--text-strong)]">{paint.name}</p>
                    <p className="truncate text-xs text-[color:var(--text-muted)]">{paint.hex}</p>
                  </div>
                </div>
              ))}
            </div>
          </StudioPanel>
        </aside>

        <main className="studio-main">
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

          {view === 'prep' && currentSession ? (
            <PrepBoard
              session={currentSession}
              paints={state.paints}
              settings={state.settings}
              selectedTargetId={selectedTargetId}
              onSelectTarget={setSelectedTargetId}
              onSessionChange={updateCurrentSession}
              onOpenSampler={() => setView('sampler')}
            />
          ) : null}

          {view === 'active' && currentSession ? (
            <ActivePaintingBoard
              session={currentSession}
              paints={state.paints}
              onSessionChange={updateCurrentSession}
              onOpenPrep={(targetId) => {
                setSelectedTargetId(targetId);
                setView('prep');
              }}
            />
          ) : null}

          {view === 'sampler' && currentSession ? (
            <ReferenceSamplerPage
              sampler={state.sampler}
              session={currentSession}
              onSamplerChange={(sampler) => setState((current) => ({ ...current, sampler }))}
              onSessionChange={updateCurrentSession}
            />
          ) : null}

          {view === 'sessions' ? (
            <SessionsPage
              sessions={state.sessions}
              currentSessionId={state.currentSessionId}
              onSelect={(id) => {
                setState((current) => ({ ...current, currentSessionId: id }));
                setView('prep');
              }}
              onCreate={() => {
                const session: PaintingSession = {
                  id: createId('session'),
                  name: `Studio Session ${state.sessions.length + 1}`,
                  description: 'New local-only painting session.',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  status: 'planning',
                  targetSortMode: 'custom',
                  targets: [],
                };
                setState((current) => ({
                  ...current,
                  sessions: [session, ...current.sessions],
                  currentSessionId: session.id,
                }));
              }}
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
        </main>
      </div>

      <footer className="studio-footer">
        <span>Local-only · deterministic · Spectral.js-based prediction core · no backend / no auth / no cloud sync.</span>
        <span>{currentSession ? `Current session: ${currentSession.name}` : 'No session selected'}</span>
      </footer>
    </div>
  );
};

export default App;
