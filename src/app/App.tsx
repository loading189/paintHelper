import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SavedRecipesPage } from '../features/recipes/SavedRecipesPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import type { MixRecipe, Paint, RankedRecipe, UserSettings } from '../types/models';
import { createId } from '../lib/utils/id';

type View = 'mixer' | 'paints' | 'recipes';

const navItems: Array<{ id: View; label: string }> = [
  { id: 'mixer', label: 'Mixer' },
  { id: 'paints', label: 'My Paints' },
  { id: 'recipes', label: 'Saved Recipes' },
];

const App = () => {
  const [view, setView] = useState<View>('mixer');
  const [state, setState] = useState(loadAppState);
  const [loadedTargetHex, setLoadedTargetHex] = useState<string | null>(null);

  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const counts = useMemo(
    () => ({
      enabledPaints: state.paints.filter((paint) => paint.isEnabled).length,
      savedRecipes: state.recipes.length,
    }),
    [state.paints, state.recipes],
  );

  const upsertPaint = (paint: Paint) => {
    setState((current) => {
      const existing = current.paints.some((item) => item.id === paint.id);
      return {
        ...current,
        paints: existing
          ? current.paints.map((item) => (item.id === paint.id ? paint : item))
          : [...current.paints, paint],
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
      scoreBreakdown: recipe.scoreBreakdown,
    };

    setState((current) => ({ ...current, recipes: [saved, ...current.recipes] }));
    setView('recipes');
  };

  const setSettings = (settings: UserSettings) => setState((current) => ({ ...current, settings }));

  const addRecentColor = (hex: string) => {
    setState((current) => ({
      ...current,
      recentTargetColors: [
        { hex, usedAt: new Date().toISOString() },
        ...current.recentTargetColors.filter((entry) => entry.hex !== hex),
      ].slice(0, 8),
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6 px-6 py-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-sky-600">Paint Mix Matcher</p>
            <h1 className="mt-1 text-3xl font-bold">Local-only deterministic paint recipe finder</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Build your inventory, enter a target hex, and rank deterministic paint mixes with painter-friendly heuristics layered on top of linear RGB blending.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-2">Enabled paints: {counts.enabledPaints}</span>
            <span className="rounded-full bg-slate-100 px-3 py-2">Saved recipes: {counts.savedRecipes}</span>
            <span className="rounded-full bg-slate-100 px-3 py-2">Storage: local browser only</span>
          </div>
        </div>
      </header>

      <nav className="mx-auto flex max-w-7xl gap-2 px-6 py-5">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              view === item.id ? 'bg-slate-900 text-white' : 'bg-white text-slate-700'
            }`}
            onClick={() => setView(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <main className="mx-auto max-w-7xl px-6 pb-10">
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
  );
};

export default App;
