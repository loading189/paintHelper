import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
import { analyzeColor } from '../../lib/color/colorAnalysis';
import { normalizeHex } from '../../lib/color/colorMath';
import type { Paint, RankedRecipe, UserSettings } from '../../types/models';
import { PaintMixerLoading } from './PaintMixerLoading';
import { RecipeCard } from './RecipeCard';
import { canGenerateRecipes, createMixerDraftState, generateRecipesFromDraft, hasStaleResults, shouldShowInvalidHexMessage } from './mixerState';

const DEFAULT_TARGET = '#7A8FB3';

const rankingModeLabels: Record<UserSettings['rankingMode'], string> = {
  'strict-closest-color': 'Strict closest',
  'painter-friendly-balanced': 'Painter friendly',
  'simpler-recipes-preferred': 'Simpler recipes',
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

export const MixerPage = ({ paints, settings, recentColors, onSettingsChange, onRecentColor, onSaveRecipe, onLoadTargetHex }: MixerPageProps) => {
  const [mixerState, setMixerState] = useState(() => createMixerDraftState(onLoadTargetHex ?? DEFAULT_TARGET));

  const draftNormalizedHex = normalizeHex(mixerState.draftHex);
  const previewAnalysis = draftNormalizedHex ? analyzeColor(draftNormalizedHex) : null;
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
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
    setMixerState((current) => ({
      ...current,
      generatedHex: generated?.generatedHex ?? current.generatedHex,
      recipes: generated?.recipes ?? current.recipes,
      isGenerating: false,
    }));

    if (generated?.generatedHex) {
      onRecentColor(generated.generatedHex);
    }
  };

  const recentVisible = useMemo(() => recentColors.slice(0, 6), [recentColors]);

  return (
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),320px] xl:items-end">
          <SectionTitle eyebrow="Mixer" description="Use the standalone mixer for one-off color lookups without leaving the local painting workflow.">
            Quick color lookup
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="studio-metric">
              <p className="studio-eyebrow">Active paints</p>
              <p className="mt-2 text-2xl font-semibold text-[color:var(--text-strong)]">{enabledPaints.length}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">Available for the next mix search.</p>
            </div>
            <div className="studio-metric">
              <p className="studio-eyebrow">Ranking profile</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{rankingModeLabels[settings.rankingMode]}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">Practical guidance stays primary.</p>
            </div>
            <div className="studio-metric">
              <p className="studio-eyebrow">Best ratio</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{topRecipe?.practicalRatioText ?? 'Pending'}</p>
              <p className="mt-1 text-sm text-[color:var(--text-muted)]">Top working mix once recipes generate.</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[380px,minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Target" description="Enter a target color, compare swatches, and generate working recipes.">
              Mixer controls
            </SectionTitle>

            <div className="mt-6 space-y-4">
              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Target hex</span>
                <input className="studio-input" value={mixerState.draftHex} onChange={(event) => handleDraftChange(event.target.value)} placeholder="#7A8FB3" aria-invalid={showInvalidHexMessage} />
              </label>

              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Color picker</span>
                <input type="color" className="h-[58px] w-full rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-1.5" value={draftNormalizedHex ?? '#000000'} onChange={(event) => handleDraftChange(event.target.value)} />
              </label>

              <SwatchComparisonPanel
                targetHex={draftNormalizedHex ?? '#b5b0aa'}
                predictedHex={topRecipe?.predictedHex}
                targetHelper={previewAnalysis ? `${previewAnalysis.hueFamily} · ${previewAnalysis.valueClassification}` : 'Enter a valid hex'}
                predictedHelper={topRecipe ? topRecipe.practicalRatioText : 'Generate recipes'}
              />

              <label>
                <span className="mb-2 block text-[13px] font-semibold text-[color:var(--text-strong)]">Ranking mode</span>
                <select className="studio-select" value={settings.rankingMode} onChange={(event) => onSettingsChange({ ...settings, rankingMode: event.target.value as UserSettings['rankingMode'] })}>
                  {Object.entries(rankingModeLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <button className="studio-button studio-button-primary w-full" type="button" disabled={generateDisabled} onClick={() => void handleGenerate()}>
                {mixerState.isGenerating ? 'Generating…' : 'Generate recipes'}
              </button>

              {showInvalidHexMessage ? <p className="rounded-[22px] border border-[rgba(146,92,92,0.18)] bg-[rgba(146,92,92,0.08)] px-4 py-3 text-sm text-[#7f514f]">Enter a valid 6-digit hex target before generating.</p> : null}
              {enabledPaints.length === 0 ? <p className="rounded-[22px] border border-[rgba(143,108,69,0.18)] bg-[rgba(143,108,69,0.08)] px-4 py-3 text-sm text-[#77583a]">Enable at least one paint in My Paints to use the mixer.</p> : null}
              {resultsAreStale && mixerState.generatedHex ? <p className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 text-sm text-[color:var(--text-muted)]">The draft changed after the last recipe run. Generate again to refresh the working cards.</p> : null}
              {mixerState.isGenerating ? <PaintMixerLoading /> : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Recent" description="Jump back into recent one-off targets.">
              Recent colors
            </SectionTitle>
            <div className="mt-4 flex flex-wrap gap-2">
              {recentVisible.length ? recentVisible.map((hex) => (
                <button key={hex} type="button" className="rounded-full border border-[color:var(--border-soft)] px-3 py-2 text-sm text-[color:var(--text-strong)]" onClick={() => handleDraftChange(hex)}>
                  <span className="mr-2 inline-block h-3 w-3 rounded-full border border-black/10 align-middle" style={{ backgroundColor: hex }} />
                  {hex}
                </button>
              )) : <p className="text-sm text-[color:var(--text-muted)]">No recent colors yet.</p>}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          {recipes.length === 0 ? (
            <Card className="p-6 sm:p-7">
              <p className="studio-eyebrow">Waiting on target</p>
              <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">Generate recipes to see swatches, ratios, and adjustment guidance.</p>
            </Card>
          ) : null}

          {recipes.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              rank={index + 1}
              recipe={recipe}
              paints={paints}
              showPercentages={settings.showPercentages}
              showPartsRatios={settings.showPartsRatios}
              onSave={(candidate) => onSaveRecipe(candidate, mixerState.generatedHex ?? draftNormalizedHex ?? DEFAULT_TARGET)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
