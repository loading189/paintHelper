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

export const RecipeCard = ({ rank, recipe, paints, showPercentages, showPartsRatios, onSave }: RecipeCardProps) => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">Rank #{rank}</p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{recipe.recipeText}</h3>
        </div>
        <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white" type="button" onClick={() => onSave(recipe)}>
          Save recipe
        </button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[96px,1fr]">
        <div>
          <div className="h-24 rounded-2xl border border-slate-200" style={{ backgroundColor: recipe.predictedHex }} />
          <p className="mt-2 text-sm font-medium text-slate-800">{recipe.predictedHex}</p>
          <p className="text-xs text-slate-500">Distance {formatDistance(recipe.distanceScore)}</p>
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
        </div>
      </div>
    </Card>
  );
};
