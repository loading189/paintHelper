import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../components/Card';
import { SectionTitle } from '../../components/SectionTitle';
import { SwatchTile } from '../../components/SwatchTile';
import { analyzeColor, generateTargetPaletteInsights } from '../../lib/color/colorAnalysis';
import { normalizeHex } from '../../lib/color/colorMath';
import { formatDistance } from '../../lib/utils/format';
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

  const targetInsights = useMemo(() => (previewAnalysis ? generateTargetPaletteInsights(previewAnalysis, paints) : []), [previewAnalysis, paints]);

  const targetMetrics = previewAnalysis
    ? [
        { label: 'Hex', value: previewAnalysis.normalizedHex },
        { label: 'RGB', value: `${previewAnalysis.rgb.r}, ${previewAnalysis.rgb.g}, ${previewAnalysis.rgb.b}` },
        { label: 'Value', value: previewAnalysis.valueClassification },
        { label: 'Hue family', value: previewAnalysis.hueFamily },
        { label: 'Saturation', value: previewAnalysis.saturationClassification },
      ]
    : [
        { label: 'Hex', value: 'Invalid target' },
        { label: 'RGB', value: '—' },
        { label: 'Value', value: '—' },
        { label: 'Hue family', value: '—' },
        { label: 'Saturation', value: '—' },
      ];

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
    <div className="space-y-6 lg:space-y-8">
      <Card className="p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr),420px] xl:items-end">
          <SectionTitle
            eyebrow="Mix workstation"
            description="Set a target, choose how the engine ranks candidates, and review painter-friendly matches without breaking the deterministic spectral flow."
          >
            Spectral mixer console
          </SectionTitle>
          <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            {[
              { label: 'Active paints', value: enabledPaints.length, note: 'included in the current search' },
              { label: 'Ranking mode', value: rankingModeLabels[settings.rankingMode], note: 'how ties and painter usability are judged' },
              { label: 'Best practical ratio', value: topRecipe?.practicalRatioText ?? 'Pending', note: topRecipe ? 'primary physical mix instruction' : 'generate recipes to populate' },
            ].map((item) => (
              <div key={item.label} className="studio-metric">
                <p className="studio-eyebrow">{item.label}</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{item.value}</p>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[420px,minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Target setup" description="This control stack is tuned for deliberate target entry and repeatable mix generation.">
              Mixing controls
            </SectionTitle>

            <div className="mt-6 space-y-4">
              <div className="grid gap-4">
                <label className="block text-sm font-medium text-[color:var(--text-body)]">
                  <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Target hex</span>
                  <input
                    className="studio-input"
                    value={mixerState.draftHex}
                    onChange={(event) => handleDraftChange(event.target.value)}
                    placeholder="#7A8FB3"
                    aria-invalid={showInvalidHexMessage}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-[124px,minmax(0,1fr)]">
                  <label className="block text-sm font-medium text-[color:var(--text-body)]">
                    <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Picker</span>
                    <input
                      type="color"
                      className="h-[58px] w-full rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] p-1.5"
                      value={draftNormalizedHex ?? '#000000'}
                      onChange={(event) => handleDraftChange(event.target.value)}
                    />
                  </label>
                  <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] p-4">
                    <p className="studio-eyebrow">Current draft</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="h-12 w-12 rounded-2xl border border-black/10" style={{ backgroundColor: draftNormalizedHex ?? '#b5b0aa' }} />
                      <div>
                        <p className="text-base font-semibold text-[color:var(--text-strong)]">{draftNormalizedHex ?? 'Invalid hex'}</p>
                        <p className="text-sm text-[color:var(--text-muted)]">Neutral surround preview for quick target confirmation.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="studio-panel studio-panel-muted">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="studio-eyebrow">Ranking profile</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">{rankingModeLabels[settings.rankingMode]}</p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--text-muted)]">{rankingModeDescriptions[settings.rankingMode]}</p>
                  </div>
                  <span className="studio-chip studio-chip-info">Deterministic search</span>
                </div>

                <div className="mt-5 grid gap-4">
                  <label className="block text-sm font-medium text-[color:var(--text-body)]">
                    <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Ranking mode</span>
                    <select
                      className="studio-select"
                      value={settings.rankingMode}
                      onChange={(event) => onSettingsChange({ ...settings, rankingMode: event.target.value as UserSettings['rankingMode'] })}
                    >
                      {Object.entries(rankingModeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-[color:var(--text-body)]">
                      <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Weight step size</span>
                      <select
                        className="studio-select"
                        value={settings.weightStep}
                        onChange={(event) => onSettingsChange({ ...settings, weightStep: Number(event.target.value) })}
                      >
                        <option value={10}>10%</option>
                        <option value={5}>5%</option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-[color:var(--text-body)]">
                      <span className="mb-2 block text-[13px] font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">Max paints per recipe</span>
                      <select
                        className="studio-select"
                        value={settings.maxPaintsPerRecipe}
                        onChange={(event) => onSettingsChange({ ...settings, maxPaintsPerRecipe: Number(event.target.value) as 1 | 2 | 3 })}
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>

              <button
                className="studio-button studio-button-primary w-full"
                type="button"
                disabled={generateDisabled}
                onClick={() => {
                  void handleGenerate();
                }}
              >
                {mixerState.isGenerating ? 'Running spectral mix pass…' : 'Generate recipes'}
              </button>

              {showInvalidHexMessage ? <p className="rounded-[22px] border border-[rgba(146,92,92,0.18)] bg-[rgba(146,92,92,0.08)] px-4 py-3 text-sm text-[#7f514f]">Enter a valid 6-digit hex target before generating.</p> : null}
              {enabledPaints.length === 0 ? <p className="rounded-[22px] border border-[rgba(143,108,69,0.18)] bg-[rgba(143,108,69,0.08)] px-4 py-3 text-sm text-[#77583a]">Enable at least one paint in My Paints to open the recipe search.</p> : null}
              {resultsAreStale && generatedHex ? (
                <p className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                  Draft target has moved. Generate again to refresh the mix set; the current cards still reflect {generatedHex}.
                </p>
              ) : null}
              {mixerState.isGenerating ? <PaintMixerLoading /> : null}
            </div>
          </Card>

          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Search preferences" description="Keep secondary controls nearby without letting them compete with the color comparison area.">
              Mixer options
            </SectionTitle>

            <div className="mt-6 grid gap-3">
              {[
                {
                  label: 'Show practical percentages',
                  description: 'Reveal displayed percentages that match the practical ratio.',
                  checked: settings.showPercentages,
                  onChange: (checked: boolean) => onSettingsChange({ ...settings, showPercentages: checked }),
                },
                {
                  label: 'Show practical parts ratios',
                  description: 'Keep part counts visible alongside the physical mix instruction.',
                  checked: settings.showPartsRatios,
                  onChange: (checked: boolean) => onSettingsChange({ ...settings, showPartsRatios: checked }),
                },
                {
                  label: 'Discourage black-only matches',
                  description: 'Reduce one-note dark matches when a constructed mix is close.',
                  checked: settings.singlePaintPenaltySettings.discourageBlackOnlyMatches,
                  onChange: (checked: boolean) =>
                    onSettingsChange({
                      ...settings,
                      singlePaintPenaltySettings: { ...settings.singlePaintPenaltySettings, discourageBlackOnlyMatches: checked },
                    }),
                },
                {
                  label: 'Discourage white-only matches',
                  description: 'Avoid chalk-only solutions unless they are clearly warranted.',
                  checked: settings.singlePaintPenaltySettings.discourageWhiteOnlyMatches,
                  onChange: (checked: boolean) =>
                    onSettingsChange({
                      ...settings,
                      singlePaintPenaltySettings: { ...settings.singlePaintPenaltySettings, discourageWhiteOnlyMatches: checked },
                    }),
                },
                {
                  label: 'Favor multi-paint mixes when close',
                  description: 'Let believable constructed recipes win when distance is nearly tied.',
                  checked: settings.singlePaintPenaltySettings.favorMultiPaintMixesWhenClose,
                  onChange: (checked: boolean) =>
                    onSettingsChange({
                      ...settings,
                      singlePaintPenaltySettings: { ...settings.singlePaintPenaltySettings, favorMultiPaintMixesWhenClose: checked },
                    }),
                },
              ].map((toggle) => (
                <label
                  key={toggle.label}
                  className="studio-toggle"
                >
                  <div>
                    <p className="text-sm font-semibold tracking-[-0.01em] text-[color:var(--text-strong)]">{toggle.label}</p>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">{toggle.description}</p>
                  </div>
                  <input type="checkbox" checked={toggle.checked} onChange={(event) => toggle.onChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-[color:var(--border-soft)] text-[color:var(--accent-blue)]" />
                </label>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <SectionTitle eyebrow="Visual comparison" description="Judge the target and the current best prediction on the same neutral stage, then move into recipe detail below.">
              Target and best-match review
            </SectionTitle>

            <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr),140px,minmax(0,1fr)] xl:items-center">
              <SwatchTile
                label="Target"
                hex={draftNormalizedHex ?? '#b5b0aa'}
                helper={previewAnalysis ? `${previewAnalysis.hueFamily} · ${previewAnalysis.valueClassification}` : 'Awaiting valid hex'}
                footer={previewAnalysis ? 'The draft target you are evaluating right now.' : 'Enter a valid target hex to activate analysis.'}
                emphasis="hero"
                testId="target-swatch-panel"
              />
              <div className="studio-panel studio-panel-strong flex flex-col items-center justify-center gap-3 px-4 py-6 text-center xl:min-h-[300px]">
                <span className="studio-chip studio-chip-accent">{topRecipe ? `Δ ${formatDistance(topRecipe.scoreBreakdown.finalScore)}` : 'Awaiting mix'}</span>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-subtle)]">Target ↔ predicted</p>
                <p className="text-sm leading-6 text-[color:var(--text-muted)]">Make the hue family, value, and the practical ratio agree before chasing smaller differences.</p>
                <div className="grid w-full gap-2">
                  <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-3 py-3">
                    <p className="studio-eyebrow">Practical ratio</p>
                    <p className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[color:var(--text-strong)]">{topRecipe?.practicalRatioText ?? 'Pending'}</p>
                  </div>
                  <div className="rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-3 py-3">
                    <p className="studio-eyebrow">Target family</p>
                    <p className="mt-2 text-sm font-semibold capitalize text-[color:var(--text-strong)]">{previewAnalysis?.hueFamily ?? '—'}</p>
                  </div>
                </div>
              </div>
              <SwatchTile
                label="Best predicted"
                hex={topRecipe?.predictedHex ?? '#d4cfc7'}
                helper={topRecipe ? `${topRecipe.predictedAnalysis.hueFamily} · ${topRecipe.predictedAnalysis.valueClassification}` : 'No recipe yet'}
                footer={
                  topRecipe
                    ? `Current lead recipe uses ${topRecipe.practicalRatioText} as the physical starting pile.`
                    : 'Generate recipes to compare the best deterministic prediction against the target.'
                }
                emphasis="hero"
                testId="predicted-swatch-panel"
              />
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
              <div className="studio-panel studio-panel-strong">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="studio-eyebrow">Current mix strategy</p>
                    <p className="mt-2 text-[2rem] font-semibold tracking-[-0.05em] text-[color:var(--text-strong)] sm:text-[2.4rem]">{topRecipe?.practicalRatioText ?? 'Pending recipe set'}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">
                      {topRecipe
                        ? topRecipe.mixStrategy[0] ?? 'Use the practical ratio first, then fine-tune slowly.'
                        : 'The best practical ratio and mix strategy will appear here after generation.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {topRecipe?.badges.slice(0, 2).map((badge, index) => (
                      <span key={badge} className={`studio-chip ${index === 0 && badge === 'Best overall' ? 'studio-chip-accent' : 'studio-chip-info'}`}>
                        {badge}
                      </span>
                    ))}
                    {resultsAreStale ? <span className="studio-chip">Needs refresh</span> : null}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="studio-metric">
                    <p className="studio-eyebrow">Difference cue</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{topRecipe ? formatDistance(topRecipe.scoreBreakdown.finalScore) : '—'}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">Lower painter score means a closer starting point.</p>
                  </div>
                  <div className="studio-metric">
                    <p className="studio-eyebrow">Target family</p>
                    <p className="mt-2 text-lg font-semibold capitalize text-[color:var(--text-strong)]">{previewAnalysis?.hueFamily ?? '—'}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">Hue family and value read before mixing.</p>
                  </div>
                  <div className="studio-metric">
                    <p className="studio-eyebrow">Prediction family</p>
                    <p className="mt-2 text-lg font-semibold capitalize text-[color:var(--text-strong)]">{topRecipe?.predictedAnalysis.hueFamily ?? '—'}</p>
                    <p className="mt-1 text-sm text-[color:var(--text-muted)]">Quick family check against the target.</p>
                  </div>
                </div>
              </div>

              <div className="studio-panel">
                <p className="studio-eyebrow">Target analysis</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {targetMetrics.map((metric) => (
                    <div key={metric.label} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">{metric.label}</p>
                      <p className="mt-2 text-base font-semibold capitalize tracking-[-0.02em] text-[color:var(--text-strong)]">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--text-subtle)]">Palette insights</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--text-body)]">
                    {targetInsights.length > 0 ? targetInsights.map((insight) => <li key={insight}>• {insight}</li>) : <li>• Enter a valid target to surface palette-aware observations.</li>}
                  </ul>
                </div>
              </div>
            </div>

            <div className="studio-panel studio-panel-muted mt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="studio-eyebrow">Recent targets</p>
                  <p className="mt-1 text-sm text-[color:var(--text-muted)]">Quick return swatches for repeated matching sessions.</p>
                </div>
                <span className="studio-chip">Local session memory</span>
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {recentColors.length > 0 ? (
                  recentColors.map((color) => (
                    <button
                      key={color}
                      className="studio-recent-chip"
                      type="button"
                      title={color}
                      onClick={() => handleDraftChange(color)}
                    >
                      <span className="h-8 w-8 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                      <span className="font-medium">{color}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-[color:var(--text-muted)]">Generate a few targets and they will appear here for quick recall.</p>
                )}
              </div>
            </div>
          </Card>

          <div className="space-y-4 lg:space-y-5">
            <SectionTitle eyebrow="Recipe set" description={rankingModeDescriptions[settings.rankingMode]}>
              Spectral recipe suggestions
            </SectionTitle>

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
              <Card className="p-6 sm:p-7">
                <div className="rounded-[28px] border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-1)]/74 px-5 py-8 text-center">
                  <p className="studio-eyebrow">Recipe state</p>
                  <p className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">
                    {enabledPaints.length === 0 ? 'Paint inventory needed' : generatedAnalysis ? 'No deterministic matches returned' : 'Ready for your first mix pass'}
                  </p>
                  <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[color:var(--text-muted)]">
                    {enabledPaints.length === 0
                      ? 'Enable paints in My Paints so the spectral engine has material to work with.'
                      : generatedAnalysis
                        ? 'Try a different ranking profile, allow more paints per recipe, or choose a nearby target to widen the search.'
                        : 'Generate recipes to see neutral, deterministic predictions with practical ratios, saved-recipe support, and adjustment guidance.'}
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
