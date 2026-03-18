import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { analyzeColor, generateTargetPaletteInsights } from '../../lib/color/colorAnalysis';
import { normalizeHex } from '../../lib/color/colorMath';
import type { Paint, RankedRecipe, UserSettings } from '../../types/models';
import { PaintMixerLoading } from './PaintMixerLoading';
import { RecipeCard } from './RecipeCard';
import { canGenerateRecipes, createMixerDraftState, generateRecipesFromDraft, hasStaleResults, shouldShowInvalidHexMessage } from './mixerState';

const DEFAULT_TARGET = '#7A8FB3';

const rankingModeLabels: Record<UserSettings['rankingMode'], string> = {
  'strict-closest-color': 'Strict Closest Color',
  'painter-friendly-balanced': 'Painter-Friendly Balanced',
  'simpler-recipes-preferred': 'Simpler Recipes Preferred',
};

const rankingModeDescriptions: Record<UserSettings['rankingMode'], string> = {
  'strict-closest-color': 'Strict Closest Color ranks by the raw spectral color match with minimal painter heuristics.',
  'painter-friendly-balanced': 'Painter-Friendly Balanced keeps spectral matching first, then favors believable painterly construction paths.',
  'simpler-recipes-preferred': 'Simpler Recipes Preferred still uses the spectral engine, but leans harder toward mixes you can set up quickly.',
};

type MixerPageProps = {
  paints: Paint[];
  settings: UserSettings;
  recentColors: string[];
  onSettingsChange: (settings: UserSettings) => void;
  onRecentColor: (hex: string) => void;
  onSaveRecipe: (recipe: RankedRecipe, targetHex: string) => void;
  onLoadTargetHex?: string | null;
};

export const MixerPage = ({
  paints,
  settings,
  recentColors,
  onSettingsChange,
  onRecentColor,
  onSaveRecipe,
  onLoadTargetHex,
}: MixerPageProps) => {
  const [mixerState, setMixerState] = useState(() => createMixerDraftState(onLoadTargetHex ?? DEFAULT_TARGET));

  const draftNormalizedHex = normalizeHex(mixerState.draftHex);
  const previewAnalysis = draftNormalizedHex ? analyzeColor(draftNormalizedHex) : null;
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const generatedHex = mixerState.generatedHex;
  const generatedAnalysis = generatedHex ? analyzeColor(generatedHex) : null;
  const recipes = mixerState.recipes;
  const topRecipe = recipes[0] ?? null;
  const resultsAreStale = hasStaleResults(mixerState.draftHex, mixerState.generatedHex);
  const showInvalidHexMessage = shouldShowInvalidHexMessage(mixerState.draftHex, mixerState.touched);
  const generateDisabled = !canGenerateRecipes(mixerState.draftHex, enabledPaints.length, mixerState.isGenerating);

  useEffect(() => {
    if (onLoadTargetHex) {
      setMixerState((current) => ({ ...current, draftHex: onLoadTargetHex, touched: true }));
    }
  }, [onLoadTargetHex]);

  const targetInsights = useMemo(
    () => (previewAnalysis ? generateTargetPaletteInsights(previewAnalysis, paints) : []),
    [previewAnalysis, paints],
  );

  const handleDraftChange = (value: string) => {
    setMixerState((current) => ({ ...current, draftHex: value, touched: true }));
  };

  const handleGenerate = async () => {
    setMixerState((current) => ({ ...current, touched: true }));
    if (!draftNormalizedHex || enabledPaints.length === 0 || mixerState.isGenerating) {
      return;
    }

    setMixerState((current) => ({ ...current, isGenerating: true }));
    const generated = await generateRecipesFromDraft(draftNormalizedHex, paints, settings);

    setMixerState((current) => {
      if (!generated) {
        return { ...current, isGenerating: false };
      }

      return {
        ...current,
        generatedHex: generated.generatedHex,
        recipes: generated.recipes,
        isGenerating: false,
      };
    });

    if (generated?.generatedHex) {
      onRecentColor(generated.generatedHex);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[320px,320px,minmax(0,1fr)]">
      <Card>
        <SectionTitle>Mixer controls</SectionTitle>
        <div className="mt-4 space-y-4">
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Target hex
            <input
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={mixerState.draftHex}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder="#7A8FB3"
            />
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Target picker
            <input
              type="color"
              className="h-12 w-full rounded-xl border border-slate-300 p-1"
              value={draftNormalizedHex ?? '#000000'}
              onChange={(event) => handleDraftChange(event.target.value)}
            />
          </label>
          <button
            className={`w-full rounded-xl px-4 py-2 text-sm font-semibold text-white ${generateDisabled ? 'bg-slate-400' : 'bg-slate-900'}`}
            type="button"
            disabled={generateDisabled}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {mixerState.isGenerating ? 'Mixing...' : 'Generate Recipes'}
          </button>
          {showInvalidHexMessage ? <p className="text-sm text-rose-600">Enter a valid 6-digit hex color.</p> : null}
          {enabledPaints.length === 0 ? <p className="text-sm text-amber-700">Enable at least one paint in My Paints to generate mixes.</p> : null}
          {resultsAreStale && generatedHex ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Draft target changed. Visible recipes are still for {generatedHex}. Click Generate Recipes to remix.
            </p>
          ) : null}
          {mixerState.isGenerating ? <PaintMixerLoading /> : null}
        </div>

        <div className="mt-6 space-y-4">
          <SectionTitle>Settings</SectionTitle>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Ranking mode
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={settings.rankingMode}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  rankingMode: event.target.value as UserSettings['rankingMode'],
                })
              }
            >
              {Object.entries(rankingModeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Weight step size
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={settings.weightStep}
              onChange={(event) => onSettingsChange({ ...settings, weightStep: Number(event.target.value) })}
            >
              <option value={10}>10%</option>
              <option value={5}>5%</option>
            </select>
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            Max paints per recipe
            <select
              className="w-full rounded-xl border border-slate-300 px-3 py-2"
              value={settings.maxPaintsPerRecipe}
              onChange={(event) =>
                onSettingsChange({ ...settings, maxPaintsPerRecipe: Number(event.target.value) as 1 | 2 | 3 })
              }
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Show percentages
            <input
              type="checkbox"
              checked={settings.showPercentages}
              onChange={(event) => onSettingsChange({ ...settings, showPercentages: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Show parts ratios
            <input
              type="checkbox"
              checked={settings.showPartsRatios}
              onChange={(event) => onSettingsChange({ ...settings, showPartsRatios: event.target.checked })}
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Discourage black-only matches
            <input
              type="checkbox"
              checked={settings.singlePaintPenaltySettings.discourageBlackOnlyMatches}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  singlePaintPenaltySettings: {
                    ...settings.singlePaintPenaltySettings,
                    discourageBlackOnlyMatches: event.target.checked,
                  },
                })
              }
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Discourage white-only matches
            <input
              type="checkbox"
              checked={settings.singlePaintPenaltySettings.discourageWhiteOnlyMatches}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  singlePaintPenaltySettings: {
                    ...settings.singlePaintPenaltySettings,
                    discourageWhiteOnlyMatches: event.target.checked,
                  },
                })
              }
            />
          </label>
          <label className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
            Favor multi-paint mixes when close
            <input
              type="checkbox"
              checked={settings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose}
              onChange={(event) =>
                onSettingsChange({
                  ...settings,
                  singlePaintPenaltySettings: {
                    ...settings.singlePaintPenaltySettings,
                    favorMultiPaintMixesWhenClose: event.target.checked,
                  },
                })
              }
            />
          </label>
        </div>
      </Card>

      <Card>
        <SectionTitle>Target analysis</SectionTitle>
        <div className="mt-4 space-y-4">
          <div className="h-56 rounded-3xl border border-slate-200" style={{ backgroundColor: draftNormalizedHex ?? '#CBD5E1' }} />
          <div>
            <p className="text-sm text-slate-500">Draft hex</p>
            <p className="text-xl font-semibold text-slate-900">{draftNormalizedHex ?? 'Invalid hex'}</p>
            {generatedHex ? <p className="mt-1 text-xs text-slate-500">Last generated target: {generatedHex}</p> : null}
          </div>
          <div>
            <p className="text-sm text-slate-500">RGB</p>
            <p className="text-base text-slate-800">
              {previewAnalysis ? `${previewAnalysis.rgb.r}, ${previewAnalysis.rgb.g}, ${previewAnalysis.rgb.b}` : '—'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Value</p>
              <p className="mt-1 font-semibold text-slate-900">{previewAnalysis?.valueClassification ?? '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Hue family</p>
              <p className="mt-1 font-semibold text-slate-900">{previewAnalysis?.hueFamily ?? '—'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">Saturation</p>
              <p className="mt-1 font-semibold text-slate-900">{previewAnalysis?.saturationClassification ?? '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-500">Palette insight</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {targetInsights.length > 0 ? targetInsights.map((insight) => <li key={insight}>• {insight}</li>) : <li>• Enter a valid target color to see palette-aware hints.</li>}
            </ul>
          </div>
          <div>
            <p className="text-sm text-slate-500">Recent colors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentColors.map((color) => (
                <button
                  key={color}
                  className="h-9 w-9 rounded-full border border-slate-200"
                  type="button"
                  style={{ backgroundColor: color }}
                  title={color}
                  onClick={() => handleDraftChange(color)}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div>
          <SectionTitle>Spectral recipe suggestions</SectionTitle>
          <p className="mt-1 text-sm text-slate-600">{rankingModeDescriptions[settings.rankingMode]}</p>
        </div>

        {topRecipe ? (
          <Card>
            <SectionTitle>Mix strategy for the top result</SectionTitle>
            <p className="mt-1 text-sm font-semibold text-slate-900">{topRecipe.recipeText}</p>
            <p className="mt-1 text-sm text-slate-600">Practical mix: {topRecipe.practicalRatioText}</p>
            {topRecipe.practicalRatioText !== topRecipe.exactRatioText ? (
              <p className="mt-1 text-xs text-slate-500">Exact simplified ratio: {topRecipe.exactRatioText}</p>
            ) : null}
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              {topRecipe.mixStrategy.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </Card>
        ) : null}

        {generatedHex && enabledPaints.length > 0 && recipes.length > 0 ? (
          recipes.map((recipe, index) => (
            <RecipeCard
              key={`${recipe.predictedHex}-${index}`}
              rank={index + 1}
              recipe={recipe}
              paints={paints}
              showPercentages={settings.showPercentages}
              showPartsRatios={settings.showPartsRatios}
              onSave={(rankedRecipe) => onSaveRecipe(rankedRecipe, generatedHex)}
            />
          ))
        ) : (
          <Card>
            <p className="text-sm text-slate-600">
              {enabledPaints.length === 0
                ? 'No enabled paints are available for recipe generation.'
                : generatedAnalysis
                  ? 'No deterministic mixes matched this target with the current settings.'
                  : 'Generate recipes to see deterministic spectral predictions and painter-first starting mixes.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
