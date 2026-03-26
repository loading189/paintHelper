import { Card } from '../../components/Card';
import { MixPathBlock } from '../../components/MixPathBlock';
import { NextAdjustmentBlock } from '../../components/NextAdjustmentBlock';
import { SwatchComparisonPanel } from '../../components/SwatchComparisonPanel';
import type { Paint, RankedRecipe } from '../../types/models';
import styles from './RecipeCard.module.css';

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
    <Card className={`${styles.cardPadding} ${styles.recipeCard}`}>
      <div className={styles.recipeTopline}>
        <div>
          <div className={styles.recipeChips}>
            <span className="studio-chip">Recipe #{rank}</span>
            <span className="studio-chip studio-chip-success">{recipe.qualityLabel}</span>
          </div>
          <h3 className={styles.recipeTitle}>{recipe.recipeText}</h3>
          <p className={styles.recipeCopy}>Use the swatch match, practical ratio, and next adjustments first.</p>
        </div>
        <div className={styles.recipeActions}>
          <div className="recipe-ratio-hero">
            <p className="studio-eyebrow">Practical ratio</p>
            <p className={styles.ratioDisplay}>{recipe.practicalRatioText}</p>
          </div>
          <button className="studio-button studio-button-primary" type="button" onClick={() => onSave(recipe)}>
            Save recipe
          </button>
        </div>
      </div>

      <div className={styles.recipeGrid}>
        <div className={styles.columnStack}>
          <SwatchComparisonPanel
            targetHex={recipe.targetAnalysis.normalizedHex}
            predictedHex={recipe.predictedHex}
            targetHelper={`${recipe.targetAnalysis.hueFamily} · ${recipe.targetAnalysis.valueClassification}`}
            predictedHelper={recipe.qualityLabel}
          />

          <section className={`studio-surface studio-surface-strong ${styles.palettePanel}`}>
            <div className={styles.paletteHeader}>
              <div>
                <p className="studio-eyebrow">Palette recipe</p>
                <p className="panel-heading-title panel-heading-title-sm">Build this pile first</p>
              </div>
              {showPercentages ? <span className="studio-chip studio-chip-info">{recipe.practicalPercentages.map((value) => `${value}%`).join(' · ')}</span> : null}
            </div>
            <ul className={styles.componentList}>
              {recipe.components.map((component, index) => {
                const paint = paintMap.get(component.paintId);
                return (
                  <li key={`${component.paintId}-${index}`} className={styles.componentRow}>
                    <div className={styles.componentIdentity}>
                      <span className={styles.componentSwatch} style={{ backgroundColor: paint?.hex ?? '#c7beb2' }} />
                      <div>
                        <p className={styles.componentName}>{paint?.name ?? component.paintId}</p>
                        <p className={styles.componentParts}>{showPartsRatios ? `${recipe.practicalParts[index]} part${recipe.practicalParts[index] === 1 ? '' : 's'}` : 'Mix component'}</p>
                      </div>
                    </div>
                    {showPercentages ? <p className={styles.componentPercent}>{recipe.practicalPercentages[index]}%</p> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <NextAdjustmentBlock adjustments={recipe.detailedAdjustments} />
        </div>

        <div className={styles.columnStack}>
          <section className="studio-surface studio-surface-muted">
            <p className="studio-eyebrow">Working notes</p>
            <p className="panel-heading-title panel-heading-title-sm">{('headline' in recipe.achievability ? recipe.achievability.headline : recipe.achievability.summary) ?? 'Use as a starting point'}</p>
            <p className={styles.workingNotes}>{recipe.achievability.detail}</p>
            {recipe.guidanceText.length ? (
              <ul className={styles.guidanceList}>
                {recipe.guidanceText.map((line) => <li key={line}>• {line}</li>)}
              </ul>
            ) : null}
          </section>

          <details className="studio-disclosure group">
            <summary className="studio-disclosure-summary">
              <div className="panel-heading-row panel-heading-row-compact">
                <div>
                  <p className="studio-eyebrow">Optional details</p>
                  <p className="panel-heading-title panel-heading-title-sm">Mix path + Technical breakdown</p>
                </div>
                <span className="studio-chip studio-chip-info">Expand</span>
              </div>
            </summary>
            <div className={styles.detailsBody}>
              <MixPathBlock steps={recipe.mixPath} warnings={recipe.stabilityWarnings} layeringSuggestion={recipe.layeringSuggestion} />
              <div className={styles.detailGrid}>
                <div className={styles.detailBlock}>
                  <p className={styles.detailHeading}>Score summary</p>
                  <p className={styles.detailMetric}>Mode: {recipe.scoreBreakdown.mode}</p>
                  <p className={styles.detailMetric}>Primary truth score: {recipe.scoreBreakdown.primaryScore.toFixed(3)}</p>
                  <p className={styles.detailMetric}>Regularization penalties: {recipe.scoreBreakdown.regularizationPenalty.toFixed(3)}</p>
                  <p className={styles.detailMetric}>Regularization bonuses: {recipe.scoreBreakdown.regularizationBonus.toFixed(3)}</p>
                  {recipe.scoreBreakdown.legacyHeuristicPenalty > 0 || recipe.scoreBreakdown.legacyHeuristicBonus > 0 ? (
                    <p className={styles.detailMetric}>Legacy heuristic delta: {(recipe.scoreBreakdown.legacyHeuristicPenalty - recipe.scoreBreakdown.legacyHeuristicBonus).toFixed(3)}</p>
                  ) : null}
                  <p className={styles.detailMetric}>Final score: {recipe.scoreBreakdown.finalScore.toFixed(3)}</p>
                  <p className={styles.detailMetric}>Spectral distance: {recipe.scoreBreakdown.spectralDistance.toFixed(3)}</p>
                  <p className={styles.detailMetric}>Value difference: {recipe.scoreBreakdown.valueDifference.toFixed(3)}</p>
                  <p className={styles.detailMetric}>Hue difference: {recipe.scoreBreakdown.hueDifference.toFixed(3)}</p>
                  <p className={styles.detailMetric}>Chroma difference: {recipe.scoreBreakdown.chromaDifference.toFixed(3)}</p>
                </div>
                {recipe.whyThisRanked.length ? (
                  <div className={styles.detailBlock}>
                    <p className={styles.detailHeading}>Why this ranked</p>
                    <ul className={styles.whyList}>
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
