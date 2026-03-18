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
  { key: 'whitePenalty', label: 'White penalty' },
  { key: 'singlePaintPenalty', label: 'Single-paint penalty' },
  { key: 'naturalMixBonus', label: 'Natural mix bonus' },
  { key: 'chromaticPathBonus', label: 'Chromatic path bonus' },
  { key: 'vividTargetPenalty', label: 'Vivid-target penalty' },
];

export const RecipeCard = ({ rank, recipe, paints, showPercentages, showPartsRatios, onSave }: RecipeCardProps) => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const practicalDiffers = recipe.practicalRatioText !== recipe.exactRatioText;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Rank #{rank}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{recipe.recipeText}</h3>
          <p className="mt-2 text-sm font-medium text-emerald-700">{recipe.qualityLabel}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.badges.map((badge) => (
              <span key={badge} className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                {badge}
              </span>
            ))}
          </div>
        </div>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => onSave(recipe)}>
          Save recipe
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[110px,110px,1fr]">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Target</p>
          <div className="h-24 rounded-2xl border border-slate-200" style={{ backgroundColor: recipe.targetAnalysis.normalizedHex }} />
          <p className="mt-2 text-xs text-slate-600">{recipe.targetAnalysis.normalizedHex}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Predicted</p>
          <div className="h-24 rounded-2xl border border-slate-200" style={{ backgroundColor: recipe.predictedHex }} />
          <p className="mt-2 text-sm font-medium text-slate-800">{recipe.predictedHex}</p>
          <p className="text-xs text-slate-500">Score {formatDistance(recipe.scoreBreakdown.finalScore)}</p>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Target family</p>
              <p className="mt-1 font-semibold text-slate-900">{recipe.targetAnalysis.hueFamily}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Predicted family</p>
              <p className="mt-1 font-semibold text-slate-900">{recipe.predictedAnalysis.hueFamily}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Value fit</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDistance(recipe.scoreBreakdown.valueDifference)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chroma fit</p>
              <p className="mt-1 font-semibold text-slate-900">{formatDistance(recipe.scoreBreakdown.chromaDifference)}</p>
            </div>
          </div>

          <ul className="space-y-2 text-sm text-slate-700">
            {recipe.components.map((component, index) => (
              <li key={component.paintId} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
                <span>
                  <span className="font-medium text-slate-900">{paintMap.get(component.paintId)?.name ?? component.paintId}</span>
                  <span className="ml-2 text-xs text-slate-500">{paintMap.get(component.paintId)?.heuristics?.preferredRole ?? 'paint'}</span>
                </span>
                <span className="text-right text-slate-500">
                  {showPercentages ? <span className="block">{component.percentage}%</span> : null}
                  {showPartsRatios ? <span className="block">{recipe.practicalParts[index]} part{recipe.practicalParts[index] === 1 ? '' : 's'}</span> : null}
                </span>
              </li>
            ))}
          </ul>

          <div className="grid gap-3 md:grid-cols-2">
            {showPercentages ? (
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact percentages</p>
                <p className="mt-1">{recipe.components.map((component) => `${component.percentage}%`).join(' · ')}</p>
              </div>
            ) : null}
            {showPartsRatios ? (
              <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Practical mixing ratio</p>
                <p className="mt-1 font-semibold text-slate-900">{recipe.practicalRatioText}</p>
                {practicalDiffers ? <p className="mt-1 text-xs text-slate-500">Rounded from exact {recipe.exactRatioText} for easier physical mixing.</p> : null}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-semibold">Mix guidance</p>
              <ul className="mt-2 space-y-1">
                {recipe.guidanceText.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 text-sm text-sky-950">
              <p className="font-semibold">Palette strategy</p>
              <ul className="mt-2 space-y-1">
                {recipe.mixStrategy.map((line) => (
                  <li key={line}>• {line}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">Why this ranked</summary>
        <div className="mt-4 space-y-4 text-sm text-slate-700">
          <div>
            <p className="font-semibold text-slate-900">Reasoning</p>
            <ul className="mt-2 space-y-1">
              {recipe.whyThisRanked.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Target analysis</p>
              <p className="mt-2">{recipe.targetAnalysis.normalizedHex} · {recipe.targetAnalysis.valueClassification} · {recipe.targetAnalysis.hueFamily} · {recipe.targetAnalysis.saturationClassification}</p>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Predicted analysis</p>
              <p className="mt-2">{recipe.predictedAnalysis.normalizedHex} · {recipe.predictedAnalysis.valueClassification} · {recipe.predictedAnalysis.hueFamily} · {recipe.predictedAnalysis.saturationClassification}</p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-slate-900">Score breakdown</p>
            <ul className="mt-2 grid gap-2 md:grid-cols-2">
              {breakdownRows.map((row) => (
                <li key={row.key} className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                  <span>{row.label}</span>
                  <span>{formatDistance(recipe.scoreBreakdown[row.key] as number)}</span>
                </li>
              ))}
              <li className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-white md:col-span-2">
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
