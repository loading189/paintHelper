import { Card } from '../../components/Card';
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
    return 'border-stone-700 bg-stone-800 text-stone-50';
  }
  if (badge === 'Chromatic build' || badge === 'Best hue path') {
    return 'border-stone-300 bg-stone-200/80 text-stone-900';
  }
  return 'border-stone-200 bg-stone-100 text-stone-700';
};

export const RecipeCard = ({ rank, recipe, paints, showPercentages, showPartsRatios, onSave }: RecipeCardProps) => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const practicalDiffers = recipe.practicalRatioText !== recipe.exactRatioText;
  const displayedPercentages = showPartsRatios ? recipe.practicalPercentages : recipe.exactPercentages;
  const componentDetailLabel = showPartsRatios ? 'Mix share' : 'Exact share';

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-stone-200 pb-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
            <span>Rank #{rank}</span>
            <span className="rounded-full border border-stone-300 bg-stone-100 px-2.5 py-1 tracking-[0.14em] text-stone-700">{recipe.qualityLabel}</span>
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-stone-950">{recipe.recipeText}</h3>
            <p className="mt-1 text-sm text-stone-600">Use the practical ratio as the main physical mixing guide. Exact percentages stay secondary.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {recipe.badges.map((badge) => (
              <span key={badge} className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${badgeClassName(badge)}`}>
                {badge}
              </span>
            ))}
          </div>
        </div>
        <button className="rounded-xl border border-stone-300 bg-stone-900 px-4 py-2.5 text-sm font-semibold text-stone-50 transition hover:bg-stone-800" type="button" onClick={() => onSave(recipe)}>
          Save recipe
        </button>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,240px),minmax(0,1fr)]">
        <div className="space-y-4 rounded-3xl border border-stone-200 bg-stone-100/70 p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {[
              { label: 'Target', hex: recipe.targetAnalysis.normalizedHex, helper: 'Target swatch' },
              { label: 'Predicted', hex: recipe.predictedHex, helper: `Score ${formatDistance(recipe.scoreBreakdown.finalScore)}` },
            ].map((swatch) => (
              <div key={swatch.label} className="rounded-2xl border border-stone-200 bg-stone-50 p-3" data-testid={`${swatch.label.toLowerCase()}-swatch-panel`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{swatch.label}</p>
                <div className="mt-2 rounded-2xl border border-stone-300 bg-stone-200 p-2">
                  <div className="h-28 rounded-xl border border-black/8" style={{ backgroundColor: swatch.hex }} />
                </div>
                <p className="mt-2 text-sm font-semibold text-stone-900">{swatch.hex}</p>
                <p className="text-xs text-stone-500">{swatch.helper}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Practical ratio</p>
              <p className="mt-1 text-lg font-semibold text-stone-950">{recipe.practicalRatioText}</p>
              {practicalDiffers ? <p className="mt-1 text-xs text-stone-500">Rounded from exact {recipe.exactRatioText} for hand-mixable piles.</p> : null}
            </div>
            {showPercentages ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">{componentDetailLabel}</p>
                <p className="mt-1 text-base font-semibold text-stone-900">{displayedPercentages.map((percentage) => `${percentage}%`).join(' · ')}</p>
                {showPartsRatios ? <p className="mt-1 text-xs text-stone-500">Shown from the displayed practical ratio so the card stays physically consistent.</p> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Target family</p>
              <p className="mt-1 font-semibold capitalize text-stone-900">{recipe.targetAnalysis.hueFamily}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Predicted family</p>
              <p className="mt-1 font-semibold capitalize text-stone-900">{recipe.predictedAnalysis.hueFamily}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Value fit</p>
              <p className="mt-1 font-semibold text-stone-900">{formatDistance(recipe.scoreBreakdown.valueDifference)}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Chroma fit</p>
              <p className="mt-1 font-semibold text-stone-900">{formatDistance(recipe.scoreBreakdown.chromaDifference)}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-stone-950">Mix recipe</p>
                <p className="text-xs text-stone-500">Practical parts lead. Exact percentages stay in supporting detail.</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-stone-700">
              {recipe.components.map((component, index) => (
                <li key={component.paintId} className="flex items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <span>
                    <span className="font-semibold text-stone-950">{paintMap.get(component.paintId)?.name ?? component.paintId}</span>
                    <span className="ml-2 text-xs uppercase tracking-[0.12em] text-stone-500">{paintMap.get(component.paintId)?.heuristics?.preferredRole ?? 'paint'}</span>
                  </span>
                  <span className="text-right">
                    {showPartsRatios ? <span className="block text-sm font-semibold text-stone-900">{recipe.practicalParts[index]} part{recipe.practicalParts[index] === 1 ? '' : 's'}</span> : null}
                    {showPercentages ? <span className="block text-xs text-stone-500">{displayedPercentages[index]}%</span> : null}
                  </span>
                </li>
              ))}
            </ul>

            {(showPercentages || showPartsRatios) ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {showPartsRatios ? (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Practical mixing ratio</p>
                    <p className="mt-1 font-semibold text-stone-950">{recipe.practicalRatioText}</p>
                    {practicalDiffers ? <p className="mt-1 text-xs text-stone-500">Rounded from exact {recipe.exactRatioText} to keep the physical mix readable.</p> : null}
                  </div>
                ) : null}
                {showPercentages ? (
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">Exact percentages</p>
                    <p className="mt-1">{recipe.exactPercentages.map((percentage) => `${percentage}%`).join(' · ')}</p>
                    <p className="mt-1 text-xs text-stone-500">These track the stored exact ratio behind the prediction.</p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800 lg:col-span-1">
              <p className="font-semibold text-stone-950">Mix guidance</p>
              <ul className="mt-2 space-y-1.5">
                {recipe.guidanceText.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800 lg:col-span-1">
              <p className="font-semibold text-stone-950">Palette strategy</p>
              <ul className="mt-2 space-y-1.5">
                {recipe.mixStrategy.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800 lg:col-span-1">
              <p className="font-semibold text-stone-950">Next adjustments</p>
              <ul className="mt-2 space-y-1.5">
                {recipe.nextAdjustments.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <details className="mt-5 rounded-3xl border border-stone-200 bg-stone-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-stone-900">Why this ranked</summary>
        <div className="mt-4 space-y-4 text-sm text-stone-700">
          <div>
            <p className="font-semibold text-stone-950">Reasoning</p>
            <ul className="mt-2 space-y-1.5">
              {recipe.whyThisRanked.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <p className="font-semibold text-stone-950">Target analysis</p>
              <p className="mt-2 text-stone-700">{recipe.targetAnalysis.normalizedHex} · {recipe.targetAnalysis.valueClassification} · {recipe.targetAnalysis.hueFamily} · {recipe.targetAnalysis.saturationClassification}</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <p className="font-semibold text-stone-950">Predicted analysis</p>
              <p className="mt-2 text-stone-700">{recipe.predictedAnalysis.normalizedHex} · {recipe.predictedAnalysis.valueClassification} · {recipe.predictedAnalysis.hueFamily} · {recipe.predictedAnalysis.saturationClassification}</p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-stone-950">Score breakdown</p>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {breakdownRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-3 py-2.5">
                  <span>{row.label}</span>
                  <span>{formatDistance(recipe.scoreBreakdown[row.key] as number)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between rounded-2xl border border-stone-800 bg-stone-900 px-3 py-2.5 text-stone-50 md:col-span-2">
                <span>Final painter score</span>
                <span>{formatDistance(recipe.scoreBreakdown.finalScore)}</span>
              </li>
            </ul>
          </div>
        </div>
      </details>
    </Card>
  );
};
