import { Card } from '../../components/Card';
import { SwatchTile } from '../../components/SwatchTile';
import { formatDistance } from '../../lib/utils/format';
import type { Paint, RankedRecipe } from '../../types/models';

type RecipeCardProps = {
  rank: number;
  recipe: RankedRecipe;
  paints: Paint[];
  showPercentages: boolean;
  showPartsRatios: boolean;
  onSave: (recipe: RankedRecipe) => void;
};

const breakdownRows: Array<{ key: keyof RankedRecipe['scoreBreakdown']; label: string }> = [
  { key: 'spectralDistance', label: 'Spectral distance' },
  { key: 'valueDifference', label: 'Value difference' },
  { key: 'hueDifference', label: 'Hue difference' },
  { key: 'saturationDifference', label: 'Saturation difference' },
  { key: 'chromaDifference', label: 'Chroma difference' },
  { key: 'complexityPenalty', label: 'Complexity penalty' },
  { key: 'hueFamilyPenalty', label: 'Hue-family penalty' },
  { key: 'constructionPenalty', label: 'Construction penalty' },
  { key: 'supportPenalty', label: 'Support penalty' },
  { key: 'dominancePenalty', label: 'Dominance penalty' },
  { key: 'neutralizerPenalty', label: 'Neutralizer penalty' },
  { key: 'blackPenalty', label: 'Black penalty' },
  { key: 'whitePenalty', label: 'White-only penalty' },
  { key: 'earlyWhitePenalty', label: 'Early-white penalty' },
  { key: 'singlePaintPenalty', label: 'Single-paint penalty' },
  { key: 'naturalMixBonus', label: 'Natural mix bonus' },
  { key: 'chromaticPathBonus', label: 'Chromatic path bonus' },
  { key: 'twoPaintUsabilityBonus', label: 'Two-paint usability bonus' },
  { key: 'vividTargetPenalty', label: 'Vivid-target penalty' },
];

const badgeClassName = (badge: string): string => {
  if (badge === 'Best overall') {
    return 'studio-chip-accent';
  }
  if (badge === 'Chromatic build' || badge === 'Best hue path') {
    return 'studio-chip-info';
  }
  if (badge.toLowerCase().includes('usable') || badge.toLowerCase().includes('friendly')) {
    return 'studio-chip-success';
  }
  return '';
};

export const RecipeCard = ({ rank, recipe, paints, showPercentages, showPartsRatios, onSave }: RecipeCardProps) => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const practicalDiffers = recipe.practicalRatioText !== recipe.exactRatioText;
  const displayedPercentages = showPartsRatios ? recipe.practicalPercentages : recipe.exactPercentages;

  return (
    <Card className="p-5 sm:p-7">
      <div className="flex flex-col gap-5 border-b border-[color:var(--border-soft)] pb-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="studio-chip">Rank #{rank}</span>
            <span className="studio-chip studio-chip-success">{recipe.qualityLabel}</span>
            {recipe.badges.map((badge) => (
              <span key={badge} className={`studio-chip ${badgeClassName(badge)}`.trim()}>
                {badge}
              </span>
            ))}
          </div>

          <div>
            <p className="studio-eyebrow">Recipe title</p>
            <h3 className="mt-2 max-w-4xl text-[1.55rem] font-semibold leading-tight tracking-[-0.04em] text-[color:var(--text-strong)] sm:text-[1.8rem]">
              {recipe.recipeText}
            </h3>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[color:var(--text-muted)]">
              Practical pile first, exact percentages second. This card is tuned to help you mix physically before you read deeper scoring detail.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 lg:flex-col lg:items-end">
          <div className="studio-panel min-w-[180px] px-4 py-3 text-right">
            <p className="studio-eyebrow">Painter score</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{formatDistance(recipe.scoreBreakdown.finalScore)}</p>
          </div>
          <button className="studio-button studio-button-primary" type="button" onClick={() => onSave(recipe)}>
            Save recipe
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[minmax(0,1.08fr),minmax(0,0.92fr)]">
        <div className="space-y-6">
          <section className="studio-panel studio-panel-strong">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Comparison</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">Target versus predicted</p>
              </div>
              <span className="studio-chip studio-chip-info">Difference cue {formatDistance(recipe.scoreBreakdown.finalScore)}</span>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr),110px,minmax(0,1fr)] md:items-center">
              <SwatchTile
                label="Target"
                hex={recipe.targetAnalysis.normalizedHex}
                helper={`${recipe.targetAnalysis.hueFamily} · ${recipe.targetAnalysis.valueClassification}`}
                footer="Target swatch for direct neutral-ground comparison."
                testId="target-swatch-panel"
              />
              <div className="studio-panel studio-panel-muted flex flex-col items-center justify-center gap-2 px-4 py-5 text-center md:min-h-[220px]">
                <span className="studio-chip studio-chip-accent">Δ {formatDistance(recipe.scoreBreakdown.finalScore)}</span>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--text-subtle)]">Direct compare</p>
                <p className="text-sm leading-6 text-[color:var(--text-muted)]">Use hue family and value first, then adjust by chroma.</p>
              </div>
              <SwatchTile
                label="Predicted"
                hex={recipe.predictedHex}
                helper={`${recipe.predictedAnalysis.hueFamily} · ${recipe.predictedAnalysis.valueClassification}`}
                footer="Predicted result of the stored practical recipe."
                testId="predicted-swatch-panel"
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {[
                { label: 'Target family', value: recipe.targetAnalysis.hueFamily },
                { label: 'Predicted family', value: recipe.predictedAnalysis.hueFamily },
                { label: 'Value fit', value: formatDistance(recipe.scoreBreakdown.valueDifference) },
                { label: 'Chroma fit', value: formatDistance(recipe.scoreBreakdown.chromaDifference) },
              ].map((item) => (
                <div key={item.label} className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3 text-sm">
                  <p className="studio-eyebrow">{item.label}</p>
                  <p className="mt-2 font-semibold capitalize text-[color:var(--text-strong)]">{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="studio-panel studio-panel-strong">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Mix</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">Practical mixing instruction</p>
              </div>
              <span className="studio-chip studio-chip-success">Use this first on the palette</span>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
              <div className="rounded-[28px] border border-[rgba(38,33,29,0.12)] bg-[linear-gradient(180deg,rgba(40,34,31,0.98),rgba(30,26,23,0.96))] px-5 py-5 text-stone-50 shadow-[0_18px_34px_rgba(33,29,26,0.16)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="studio-eyebrow text-stone-300">Practical ratio</p>
                  <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-100">
                    Physical starting pile
                  </span>
                </div>
                <p className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-white sm:text-[3.6rem]">{recipe.practicalRatioText}</p>
                <p className="mt-3 max-w-xl text-sm leading-7 text-stone-300">
                  Build this pile first before fine-tuning. It is the clearest physical instruction on the card.
                </p>
                {practicalDiffers ? <p className="mt-2 text-sm text-stone-400">Rounded from exact {recipe.exactRatioText} to keep the hand-mixed pile readable.</p> : null}
              </div>

              <div className="grid gap-3">
                {showPercentages ? (
                  <div className="studio-panel studio-panel-muted px-4 py-4 text-sm">
                    <p className="studio-eyebrow">Practical percentages</p>
                    <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{recipe.practicalPercentages.map((percentage) => `${percentage}%`).join(' · ')}</p>
                    <p className="mt-2 text-sm text-[color:var(--text-muted)]">Shown to mirror the practical ratio, not to replace it.</p>
                  </div>
                ) : null}
                <div className="studio-panel studio-panel-muted px-4 py-4 text-sm">
                  <p className="studio-eyebrow">Exact detail</p>
                  <p className="mt-2 font-semibold text-[color:var(--text-strong)]">{recipe.exactRatioText}</p>
                  {showPercentages ? <p className="mt-2 text-[color:var(--text-muted)]">Exact percentages: {recipe.exactPercentages.map((percentage) => `${percentage}%`).join(' · ')}</p> : null}
                </div>
              </div>
            </div>

            <ul className="mt-5 space-y-3 text-sm text-[color:var(--text-body)]">
              {recipe.components.map((component, index) => {
                const paint = paintMap.get(component.paintId);
                return (
                  <li
                    key={component.paintId}
                    className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="h-11 w-11 rounded-2xl border border-black/10" style={{ backgroundColor: paint?.hex ?? '#c7beb2' }} />
                      <div>
                        <p className="font-semibold text-[color:var(--text-strong)]">{paint?.name ?? component.paintId}</p>
                        <p className="text-xs uppercase tracking-[0.14em] text-[color:var(--text-subtle)]">{paint?.heuristics?.preferredRole ?? 'paint component'}</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      {showPartsRatios ? <p className="text-base font-semibold text-[color:var(--text-strong)]">{recipe.practicalParts[index]} part{recipe.practicalParts[index] === 1 ? '' : 's'}</p> : null}
                      {showPercentages ? <p className="text-sm text-[color:var(--text-muted)]">{displayedPercentages[index]}%</p> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="studio-panel studio-panel-muted">
            <p className="studio-eyebrow">Guidance</p>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-4 text-sm text-[color:var(--text-body)]">
                <p className="font-semibold text-[color:var(--text-strong)]">Mix guidance</p>
                <ul className="mt-3 space-y-2 leading-6">
                  {recipe.guidanceText.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-4 text-sm text-[color:var(--text-body)]">
                <p className="font-semibold text-[color:var(--text-strong)]">Palette strategy</p>
                <ul className="mt-3 space-y-2 leading-6">
                  {recipe.mixStrategy.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-[rgba(84,111,88,0.16)] bg-[rgba(84,111,88,0.08)] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="studio-eyebrow">Next adjustments</p>
                <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">Refinement suggestions</p>
              </div>
              <span className="studio-chip studio-chip-success">First-class guidance</span>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm leading-6 text-[color:var(--text-body)]">
              {recipe.nextAdjustments.map((line) => (
                <li key={line} className="rounded-[20px] border border-[rgba(84,111,88,0.14)] bg-[rgba(251,248,243,0.72)] px-4 py-3">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          <details className="studio-disclosure group">
            <summary className="studio-disclosure-summary">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="studio-eyebrow">Reasoning</p>
                  <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[color:var(--text-strong)]">Why this ranked</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">{recipe.whyThisRanked[0] ?? 'Open for score detail and ranking rationale.'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="studio-chip studio-chip-info">Expand details</span>
                  <span aria-hidden="true" className="studio-disclosure-caret">
                    ↓
                  </span>
                </div>
              </div>
            </summary>

            <div className="mt-5 space-y-5 text-sm text-[color:var(--text-body)]">
              <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4">
                <p className="font-semibold text-[color:var(--text-strong)]">Reasoning summary</p>
                <ul className="mt-3 space-y-2 leading-6">
                  {recipe.whyThisRanked.map((line) => (
                    <li key={line}>• {line}</li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4">
                  <p className="font-semibold text-[color:var(--text-strong)]">Target analysis</p>
                  <p className="mt-2 leading-6 text-[color:var(--text-body)]">
                    {recipe.targetAnalysis.normalizedHex} · {recipe.targetAnalysis.valueClassification} · {recipe.targetAnalysis.hueFamily} · {recipe.targetAnalysis.saturationClassification}
                  </p>
                </div>
                <div className="rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-4 py-4">
                  <p className="font-semibold text-[color:var(--text-strong)]">Predicted analysis</p>
                  <p className="mt-2 leading-6 text-[color:var(--text-body)]">
                    {recipe.predictedAnalysis.normalizedHex} · {recipe.predictedAnalysis.valueClassification} · {recipe.predictedAnalysis.hueFamily} · {recipe.predictedAnalysis.saturationClassification}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-[color:var(--text-strong)]">Score breakdown</p>
                <ul className="mt-3 grid gap-2 md:grid-cols-2">
                  {breakdownRows.map((row) => (
                    <li key={row.key} className="flex items-center justify-between rounded-[20px] border border-[color:var(--border-soft)] bg-[color:var(--surface-1)] px-3 py-2.5">
                      <span>{row.label}</span>
                      <span>{formatDistance(recipe.scoreBreakdown[row.key] as number)}</span>
                    </li>
                  ))}
                  <li className="flex items-center justify-between rounded-[20px] bg-[linear-gradient(180deg,#322c28,#221e1a)] px-3 py-3 text-stone-50 md:col-span-2">
                    <span>Final painter score</span>
                    <span>{formatDistance(recipe.scoreBreakdown.finalScore)}</span>
                  </li>
                </ul>
              </div>
            </div>
          </details>
        </div>
      </div>
    </Card>
  );
};
