import type { RankedRecipe } from '../../types/models';

type Props = {
  selectedColor: { hex: string; value: number; label?: string } | null;
  recipe: RankedRecipe | null;
  isSolving: boolean;
  onRecalculate: () => void;
  onMarkUsed: () => void;
};

export const RecipePanel = ({ selectedColor, recipe, isSolving, onRecalculate, onMarkUsed }: Props) => (
  <aside className="paint-cockpit-recipe-panel">
    <p className="studio-kicker">Recipe</p>
    {selectedColor ? (
      <>
        <div className="paint-cockpit-target">
          <div className="paint-cockpit-target__swatch" style={{ backgroundColor: selectedColor.hex }} />
          <div>
            <p className="paint-cockpit-hex">{selectedColor.hex}</p>
            <p className="text-xs text-[color:var(--text-muted)]">Value {selectedColor.value} · 1 white · 9 black</p>
            {selectedColor.label ? <p className="text-xs text-[color:var(--text-subtle)]">{selectedColor.label}</p> : null}
          </div>
        </div>

        <div className="paint-cockpit-prediction-row">
          <div>
            <p className="text-xs text-[color:var(--text-muted)]">Predicted mix</p>
            <div className="paint-cockpit-target__swatch paint-cockpit-target__swatch--small" style={{ backgroundColor: recipe?.predictedHex ?? '#1a202b' }} />
          </div>
          <div className="paint-cockpit-recipe-text">
            {recipe?.recipeText ? <p>{recipe.recipeText}</p> : <p className="text-xs text-[color:var(--text-muted)]">No recipe yet.</p>}
          </div>
        </div>

        {recipe?.guidanceText?.length ? (
          <ul className="paint-cockpit-guidance">
            {recipe.guidanceText.slice(0, 3).map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : null}

        <div className="paint-cockpit-actions">
          <button className="studio-button studio-button-secondary" onClick={onRecalculate} disabled={isSolving}>
            {isSolving ? 'Solving…' : 'Recalculate'}
          </button>
          <button className="studio-button" onClick={onMarkUsed} disabled={!recipe}>
            Mark as Used
          </button>
        </div>
      </>
    ) : (
      <p className="text-sm text-[color:var(--text-muted)]">Select a color from the image or wheel.</p>
    )}
  </aside>
);
