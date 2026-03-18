import { useEffect, useMemo, useState } from 'react';
import { MixerPage } from '../features/mixer/MixerPage';
import { PaintsPage } from '../features/paints/PaintsPage';
import { SavedRecipesPage } from '../features/recipes/SavedRecipesPage';
import { loadAppState, saveAppState } from '../lib/storage/localState';
import type { MixRecipe, Paint, RankedRecipe, UserSettings } from '../types/models';
import { createId } from '../lib/utils/id';

type View = 'mixer' | 'paints' | 'recipes';

const navItems: Array<{ id: View; label: string; blurb: string }> = [
  { id: 'mixer', label: 'Mixer', blurb: 'Target match workstation' },
  { id: 'paints', label: 'My Paints', blurb: 'Inventory and tube roles' },
  { id: 'recipes', label: 'Saved Recipes', blurb: 'Archived mix references' },
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
      recentTargets: state.recentTargetColors.length,
    }),
    [state.paints, state.recipes, state.recentTargetColors],
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

  return (
    <div className="min-h-screen bg-transparent text-[color:var(--text-body)]">
      <header className="border-b border-[color:var(--border-soft)] bg-[rgba(250,246,240,0.76)] backdrop-blur-xl">
        <div className="mx-auto max-w-[1520px] px-5 py-8 sm:px-6 lg:px-10 lg:py-10">
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr),360px] xl:items-end">
            <div>
              <p className="studio-eyebrow">Paint Mix Matcher</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)] sm:text-5xl xl:text-[3.7rem]">
                Spectral paint mixing, presented like a studio-grade color workstation.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)] sm:text-base">
                Local-only recipe generation, practical pile ratios, and painterly adjustment cues in a neutral workspace designed for color-critical judgment.
              </p>
            </div>

            <div className="rounded-[32px] border border-[color:var(--border-soft)] bg-[rgba(251,248,243,0.86)] p-5 shadow-[var(--shadow-soft)]">
              <p className="studio-eyebrow">Session overview</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                {[
                  { label: 'Enabled paints', value: counts.enabledPaints, note: 'active in recipe search' },
                  { label: 'Saved recipes', value: counts.savedRecipes, note: 'stored locally in browser' },
                  { label: 'Recent targets', value: counts.recentTargets, note: 'quick return palette checks' },
                ].map((item) => (
                  <div key={item.label} className="studio-metric">
                    <p className="studio-eyebrow">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{item.value}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                Deterministic engine, no cloud sync, no auth, no backend.
              </div>
            </div>
          </div>

          <nav className="mt-8 grid gap-3 sm:grid-cols-3">
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
                    <span className={`studio-chip ${isActive ? 'studio-chip-accent border-white/10 bg-white/10 text-stone-100' : ''}`}>{item.id === 'mixer' ? 'Primary' : 'Library'}</span>
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
