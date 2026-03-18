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
  'strict-closest-color': 'Ranks by the raw spectral match first, with very little painterly filtering.',
  'painter-friendly-balanced': 'Keeps spectral plausibility first, then rewards believable hue builds and restrained support paint use.',
  'simpler-recipes-preferred': 'Still uses the spectral engine, but gives a slight edge to practical two-paint mixes when they are genuinely close.',
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
    <div className="grid gap-6 xl:grid-cols-[340px,340px,minmax(0,1fr)] 2xl:grid-cols-[360px,360px,minmax(0,1fr)]">
      <Card>
        <SectionTitle>Mixer controls</SectionTitle>
        <p className="mt-2 text-sm leading-6 text-stone-600">Keep the workspace quiet, set a target, then generate a fresh mix set only when you are ready.</p>

        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5 text-sm font-medium text-stone-700">
            Target hex
            <input
              className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900"
              value={mixerState.draftHex}
              onChange={(event) => handleDraftChange(event.target.value)}
              placeholder="#7A8FB3"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-stone-700">
            Target picker
            <input
              type="color"
              className="h-14 w-full rounded-2xl border border-stone-300 bg-white p-1.5"
              value={draftNormalizedHex ?? '#000000'}
              onChange={(event) => handleDraftChange(event.target.value)}
            />
          </label>
          <button
            className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold transition ${generateDisabled ? 'bg-stone-300 text-stone-500' : 'bg-stone-900 text-stone-50 hover:bg-stone-800'}`}
            type="button"
            disabled={generateDisabled}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {mixerState.isGenerating ? 'Mixing…' : 'Generate Recipes'}
          </button>
          {showInvalidHexMessage ? <p className="text-sm text-rose-700">Enter a valid 6-digit hex color.</p> : null}
          {enabledPaints.length === 0 ? <p className="text-sm text-amber-800">Enable at least one paint in My Paints to generate mixes.</p> : null}
          {resultsAreStale && generatedHex ? (
            <p className="rounded-2xl border border-stone-300 bg-stone-100 px-3 py-2.5 text-sm text-stone-700">
              Target changed — generate recipes to refresh this mix set. Current cards still reflect {generatedHex}.
            </p>
          ) : null}
          {mixerState.isGenerating ? <PaintMixerLoading /> : null}
        </div>

        <div className="mt-8 space-y-4 border-t border-stone-200 pt-6">
          <SectionTitle>Settings</SectionTitle>
          <label className="block space-y-1.5 text-sm font-medium text-stone-700">
            Ranking mode
            <select
              className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5"
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
          <label className="block space-y-1.5 text-sm font-medium text-stone-700">
            Weight step size
            <select
              className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5"
              value={settings.weightStep}
              onChange={(event) => onSettingsChange({ ...settings, weightStep: Number(event.target.value) })}
            >
              <option value={10}>10%</option>
              <option value={5}>5%</option>
            </select>
          </label>
          <label className="block space-y-1.5 text-sm font-medium text-stone-700">
            Max paints per recipe
            <select
              className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5"
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
          {[
            {
              label: 'Show percentages',
              checked: settings.showPercentages,
              onChange: (checked: boolean) => onSettingsChange({ ...settings, showPercentages: checked }),
            },
            {
              label: 'Show parts ratios',
              checked: settings.showPartsRatios,
              onChange: (checked: boolean) => onSettingsChange({ ...settings, showPartsRatios: checked }),
            },
            {
              label: 'Discourage black-only matches',
              checked: settings.singlePaintPenaltySettings.discourageBlackOnlyMatches,
              onChange: (checked: boolean) =>
                onSettingsChange({
                  ...settings,
                  singlePaintPenaltySettings: {
                    ...settings.singlePaintPenaltySettings,
                    discourageBlackOnlyMatches: checked,
                  },
                }),
            },
            {
              label: 'Discourage white-only matches',
              checked: settings.singlePaintPenaltySettings.discourageWhiteOnlyMatches,
              onChange: (checked: boolean) =>
                onSettingsChange({
                  ...settings,
                  singlePaintPenaltySettings: {
                    ...settings.singlePaintPenaltySettings,
                    discourageWhiteOnlyMatches: checked,
                  },
                }),
            },
            {
              label: 'Favor multi-paint mixes when close',
              checked: settings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose,
              onChange: (checked: boolean) =>
                onSettingsChange({
                  ...settings,
                  singlePaintPenaltySettings: {
                    ...settings.singlePaintPenaltySettings,
                    favorMultiPaintMixesWhenClose: checked,
                  },
                }),
            },
          ].map((toggle) => (
            <label key={toggle.label} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium text-stone-700">
              {toggle.label}
              <input type="checkbox" checked={toggle.checked} onChange={(event) => toggle.onChange(event.target.checked)} />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Target analysis</SectionTitle>
        <p className="mt-2 text-sm leading-6 text-stone-600">Judge the target against a neutral surround before comparing recipes.</p>
        <div className="mt-5 space-y-5">
          <div className="rounded-[28px] border border-stone-200 bg-stone-100 p-4">
            <div className="rounded-[24px] border border-stone-300 bg-stone-200 p-3">
              <div className="h-56 rounded-[20px] border border-black/8" style={{ backgroundColor: draftNormalizedHex ?? '#cbd5d1' }} />
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Draft hex</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">{draftNormalizedHex ?? 'Invalid hex'}</p>
            {generatedHex ? <p className="mt-1 text-xs text-stone-500">Last generated target: {generatedHex}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">RGB</p>
            <p className="mt-1 text-base text-stone-800">
              {previewAnalysis ? `${previewAnalysis.rgb.r}, ${previewAnalysis.rgb.g}, ${previewAnalysis.rgb.b}` : '—'}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Value</p>
              <p className="mt-1 font-semibold capitalize text-stone-900">{previewAnalysis?.valueClassification ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Hue family</p>
              <p className="mt-1 font-semibold capitalize text-stone-900">{previewAnalysis?.hueFamily ?? '—'}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3">
              <p className="text-[11px] uppercase tracking-[0.16em] text-stone-500">Saturation</p>
              <p className="mt-1 font-semibold capitalize text-stone-900">{previewAnalysis?.saturationClassification ?? '—'}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Palette insight</p>
            <ul className="mt-2 space-y-2 text-sm leading-6 text-stone-700">
              {targetInsights.length > 0 ? targetInsights.map((insight) => <li key={insight}>• {insight}</li>) : <li>• Enter a valid target color to see palette-aware guidance.</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Recent colors</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {recentColors.map((color) => (
                <button
                  key={color}
                  className="h-10 w-10 rounded-full border border-stone-300 bg-white"
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

      <div className="space-y-4 lg:space-y-5">
        <div>
          <SectionTitle>Spectral recipe suggestions</SectionTitle>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{rankingModeDescriptions[settings.rankingMode]}</p>
        </div>

        {topRecipe ? (
          <Card>
            <SectionTitle>Top-result palette setup</SectionTitle>
            <p className="mt-2 text-base font-semibold text-stone-950">{topRecipe.recipeText}</p>
            <p className="mt-1 text-sm text-stone-600">Practical mix: {topRecipe.practicalRatioText}</p>
            {topRecipe.practicalRatioText !== topRecipe.exactRatioText ? (
              <p className="mt-1 text-xs text-stone-500">Exact simplified ratio: {topRecipe.exactRatioText}</p>
            ) : null}
            <ul className="mt-4 space-y-2 text-sm leading-6 text-stone-700">
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
            <p className="text-sm leading-6 text-stone-600">
              {enabledPaints.length === 0
                ? 'No enabled paints are available for recipe generation.'
                : generatedAnalysis
                  ? 'No deterministic mixes matched this target with the current settings.'
                  : 'Generate recipes to see neutral, deterministic spectral predictions and painter-first starting mixes.'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
