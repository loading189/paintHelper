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
  { key: 'baseDistance', label: 'Base color distance' },
  { key: 'valueDifference', label: 'Value difference' },
  { key: 'hueDifference', label: 'Hue difference' },
  { key: 'saturationDifference', label: 'Saturation difference' },
  { key: 'complexityPenalty', label: 'Complexity penalty' },
  { key: 'blackPenalty', label: 'Black-only penalty' },
  { key: 'whitePenalty', label: 'White-only penalty' },
  { key: 'singlePaintPenalty', label: 'Single-paint penalty' },
  { key: 'earthToneBonus', label: 'Earth-tone bonus' },
];

export const RecipeCard = ({ rank, recipe, paints, showPercentages, showPartsRatios, onSave }: RecipeCardProps) => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));

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

      <div className="mt-4 grid gap-4 md:grid-cols-[96px,1fr]">
        <div>
          <div className="h-24 rounded-2xl border border-slate-200" style={{ backgroundColor: recipe.predictedHex }} />
          <p className="mt-2 text-sm font-medium text-slate-800">{recipe.predictedHex}</p>
          <p className="text-xs text-slate-500">Painter score {formatDistance(recipe.scoreBreakdown.finalScore)}</p>
          <p className="text-xs text-slate-500">Base distance {formatDistance(recipe.scoreBreakdown.baseDistance)}</p>
        </div>
        <div className="space-y-3">
          <ul className="space-y-2 text-sm text-slate-700">
            {recipe.components.map((component, index) => (
              <li key={component.paintId} className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
                <span>{paintMap.get(component.paintId)?.name ?? component.paintId}</span>
                <span className="text-slate-500">
                  {showPercentages ? `${component.percentage}%` : null}
                  {showPercentages && showPartsRatios ? ' · ' : null}
                  {showPartsRatios ? `${recipe.parts[index]} parts` : null}
                </span>
              </li>
            ))}
          </ul>
          {showPartsRatios ? <p className="text-sm text-slate-600">Ratio: {recipe.ratioText}</p> : null}
          <div className="rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">
            <p className="font-semibold">Mix advice</p>
            <ul className="mt-2 space-y-1">
              {recipe.guidanceText.map((line) => (
                <li key={line}>• {line}</li>
              ))}
            </ul>
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

          <div>
            <p className="font-semibold text-slate-900">Target analysis</p>
            <p className="mt-2">
              {recipe.targetAnalysis.normalizedHex} · {recipe.targetAnalysis.valueClassification} · {recipe.targetAnalysis.hueFamily} ·{' '}
              {recipe.targetAnalysis.saturationClassification}
            </p>
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
