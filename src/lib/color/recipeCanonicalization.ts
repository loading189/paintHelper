import type { RecipeComponent } from '../../types/models';

type WeightedRecipeComponent = Pick<RecipeComponent, 'paintId' | 'weight'>;

const asFinitePositive = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

/**
 * Canonical recipe representation for any forward-model invocation.
 * - Merges duplicate paint entries by paintId.
 * - Drops non-positive/invalid weights.
 * - Produces deterministic paintId ordering.
 */
export const canonicalizeRecipeComponents = <T extends WeightedRecipeComponent>(components: T[]): WeightedRecipeComponent[] => {
  const weightsByPaint = new Map<string, number>();

  components.forEach((component) => {
    const normalizedWeight = asFinitePositive(component.weight);
    if (!normalizedWeight || !component.paintId) return;
    weightsByPaint.set(component.paintId, (weightsByPaint.get(component.paintId) ?? 0) + normalizedWeight);
  });

  return [...weightsByPaint.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([paintId, weight]) => ({ paintId, weight }));
};

