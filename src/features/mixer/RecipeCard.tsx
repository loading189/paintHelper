import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
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
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[color:var(--border-soft)] pb-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="studio-chip">Recipe #{rank}</span>
            <span className="studio-chip studio-chip-success">{recipe.qualityLabel}</span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-[color:var(--text-strong)]">{recipe.recipeText}</h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text-muted)]">Use the swatch match, practical ratio, and next adjustments first.</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <div className="recipe-ratio-hero">
            <p className="studio-eyebrow text-stone-300">Practical ratio</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-stone-50">{recipe.practicalRatioText}</p>
          </div>
          <button className="studio-button studio-button-primary" type="button" onClick={() => onSave(recipe)}>
            Save recipe
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.02fr),minmax(0,0.98fr)]">
        <div className="space-y-5">
          <SwatchComparisonPanel
            targetHex={recipe.targetAnalysis.normalizedHex}
            predictedHex={recipe.predictedHex}
            targetHelper={`${recipe.targetAnalysis.hueFamily} · ${recipe.targetAnalysis.valueClassification}`}
            predictedHelper={recipe.qualityLabel}
          />

          <section className="studio-panel studio-panel-strong">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="studio-eyebrow">Palette recipe</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">Build this pile first</p>
              </div>
              {showPercentages ? <span className="studio-chip studio-chip-info">{recipe.practicalPercentages.map((value) => `${value}%`).join(' · ')}</span> : null}
            </div>
            <ul className="mt-4 space-y-3 text-sm text-[color:var(--text-body)]">
              {recipe.components.map((component, index) => {
                const paint = paintMap.get(component.paintId);
                return (
                  <li key={`${component.paintId}-${index}`} className="flex flex-col gap-3 rounded-[24px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="h-11 w-11 rounded-2xl border border-black/10" style={{ backgroundColor: paint?.hex ?? '#c7beb2' }} />
                      <div>
                        <p className="font-semibold text-[color:var(--text-strong)]">{paint?.name ?? component.paintId}</p>
                        <p className="text-xs text-[color:var(--text-muted)]">{showPartsRatios ? `${recipe.practicalParts[index]} part${recipe.practicalParts[index] === 1 ? '' : 's'}` : 'Mix component'}</p>
                      </div>
                    </div>
                    {showPercentages ? <p className="text-sm font-semibold text-[color:var(--text-strong)]">{recipe.practicalPercentages[index]}%</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <NextAdjustmentBlock adjustments={recipe.detailedAdjustments} />
        </div>

        <div className="space-y-5">
          <section className="studio-panel studio-panel-muted">
            <p className="studio-eyebrow">Working notes</p>
            <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">{('headline' in recipe.achievability ? recipe.achievability.headline : recipe.achievability.summary) ?? 'Use as a starting point'}</p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)]">{recipe.achievability.detail}</p>
            {recipe.guidanceText.length ? (
              <ul className="mt-4 space-y-2 text-sm leading-6 text-[color:var(--text-body)]">
                {recipe.guidanceText.map((line) => <li key={line}>• {line}</li>)}
              </ul>
            ) : null}
          </section>

          <details className="studio-disclosure group">
            <summary className="studio-disclosure-summary">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="studio-eyebrow">Optional details</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--text-strong)]">Mix path + technical breakdown</p>
                </div>
                <span className="studio-chip studio-chip-info">Expand</span>
              </div>
            </summary>
            <div className="mt-4 space-y-4">
              <MixPathBlock steps={recipe.mixPath} warnings={recipe.stabilityWarnings} layeringSuggestion={recipe.layeringSuggestion} />
              <div className="grid gap-3 text-sm text-[color:var(--text-body)]">
                <div className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3">
                  <p className="font-semibold text-[color:var(--text-strong)]">Score summary</p>
                  <p className="mt-2">Final score: {recipe.scoreBreakdown.finalScore.toFixed(3)}</p>
                  <p>Spectral distance: {recipe.scoreBreakdown.spectralDistance.toFixed(3)}</p>
                  <p>Value difference: {recipe.scoreBreakdown.valueDifference.toFixed(3)}</p>
                  <p>Chroma difference: {recipe.scoreBreakdown.chromaDifference.toFixed(3)}</p>
                </div>
                {recipe.whyThisRanked.length ? (
                  <div className="rounded-[22px] border border-[color:var(--border-soft)] bg-[color:var(--surface-0)] px-4 py-3">
                    <p className="font-semibold text-[color:var(--text-strong)]">Why this ranked</p>
                    <ul className="mt-2 space-y-2">
                      {recipe.whyThisRanked.map((line) => <li key={line}>• {line}</li>)}
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </details>
        </div>
      </div>
    </Card>
  );
};
