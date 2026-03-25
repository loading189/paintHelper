import styles from './ActivePaintingPage.module.css';
import type { RankedRecipe } from '../../types/models';

type Props = {
  selectedColor: { hex: string; value: number; label?: string } | null;
  recipe: RankedRecipe | null;
  isSolving: boolean;
  onRecalculate: () => void;
  onMarkUsed: () => void;
};

export const RecipePanel = ({ selectedColor, recipe, isSolving, onRecalculate, onMarkUsed }: Props) => (
  <aside className={styles.paintCockpitRecipePanel}>
    <p className="studio-kicker">Recipe</p>
    {selectedColor ? (
      <>
        <div className={styles.paintCockpitTarget}>
          <div className={styles.paintCockpitTargetSwatch} style={{ backgroundColor: selectedColor.hex }} />
          <div>
            <p className={styles.paintCockpitHex}>{selectedColor.hex}</p>
            <p className={styles.metaText}>Value {selectedColor.value} · 1 white · 9 black</p>
            {selectedColor.label ? <p className={styles.subtleText}>{selectedColor.label}</p> : null}
          </div>
        </div>

        <div className={styles.paintCockpitPredictionRow}>
          <div>
            <p className={styles.metaText}>Predicted mix</p>
            <div className={`${styles.paintCockpitTargetSwatch} ${styles.paintCockpitTargetSwatchSmall}`} style={{ backgroundColor: recipe?.predictedHex ?? '#1a202b' }} />
          </div>
          <div className={styles.paintCockpitRecipeText}>
            {recipe?.recipeText ? <p>{recipe.recipeText}</p> : <p className={styles.metaText}>No recipe yet.</p>}
          </div>
        </div>

        {recipe?.guidanceText?.length ? (
          <ul className={styles.paintCockpitGuidance}>
            {recipe.guidanceText.slice(0, 3).map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : null}

        <div className={styles.paintCockpitActions}>
          <button className="studio-button studio-button-secondary" onClick={onRecalculate} disabled={isSolving}>
            {isSolving ? 'Solving…' : 'Recalculate'}
          </button>
          <button className="studio-button" onClick={onMarkUsed} disabled={!recipe}>
            Mark as Used
          </button>
        </div>
      </>
    ) : (
      <p className={styles.metaText}>Select a color from the image or wheel.</p>
    )}
  </aside>
);
