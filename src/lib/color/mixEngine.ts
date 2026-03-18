import type { LinearRgbColor, Paint, RankedRecipe, RecipeComponent } from '../../types/models';
import { colorDistance, hexToRgb, linearRgbToSrgbRgb, rgbToHex, srgbRgbToLinearRgb } from './colorMath';
import { simplifyRatio } from '../utils/ratio';

export type WeightCombination = number[];

export type CandidateMix = {
  paintIds: string[];
  weights: number[];
};

const mixLinearColors = (colors: LinearRgbColor[], weights: number[]): LinearRgbColor => {
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  return colors.reduce(
    (accumulator, color, index) => ({
      r: accumulator.r + (color.r * weights[index]) / totalWeight,
      g: accumulator.g + (color.g * weights[index]) / totalWeight,
      b: accumulator.b + (color.b * weights[index]) / totalWeight,
    }),
    { r: 0, g: 0, b: 0 },
  );
};

export const generateWeightCombinations = (count: number, step: number): WeightCombination[] => {
  // Generate integer partitions of 100% so the engine stays deterministic and easy to reason about.
  const totalUnits = Math.round(100 / step);
  const combinations: WeightCombination[] = [];

  const visit = (remainingSlots: number, remainingUnits: number, path: number[]): void => {
    if (remainingSlots === 1) {
      if (remainingUnits > 0) {
        combinations.push([...path, remainingUnits * step]);
      }
      return;
    }

    for (let units = 1; units <= remainingUnits - (remainingSlots - 1); units += 1) {
      visit(remainingSlots - 1, remainingUnits - units, [...path, units * step]);
    }
  };

  visit(count, totalUnits, []);

  return combinations;
};

const choosePaintGroups = <T,>(items: T[], groupSize: number): T[][] => {
  const groups: T[][] = [];

  const visit = (startIndex: number, path: T[]): void => {
    if (path.length === groupSize) {
      groups.push(path);
      return;
    }

    for (let index = startIndex; index <= items.length - (groupSize - path.length); index += 1) {
      visit(index + 1, [...path, items[index]]);
    }
  };

  visit(0, []);

  return groups;
};

export const generateCandidateMixes = (paints: Paint[], maxPaintsPerRecipe: number, step: number): CandidateMix[] => {
  const enabledPaints = paints.filter((paint) => paint.isEnabled);
  const candidates: CandidateMix[] = [];

  for (let size = 1; size <= Math.min(maxPaintsPerRecipe, enabledPaints.length); size += 1) {
    const groups = choosePaintGroups(enabledPaints, size);
    const weightSets = generateWeightCombinations(size, step);

    groups.forEach((group) => {
      weightSets.forEach((weights) => {
        candidates.push({
          paintIds: group.map((paint) => paint.id),
          weights,
        });
      });
    });
  }

  return candidates;
};

const buildRecipeText = (paintNames: string[], parts: number[]): string =>
  paintNames.map((name, index) => `${parts[index]} part${parts[index] === 1 ? '' : 's'} ${name}`).join(' + ');

const recipeSignature = (components: RecipeComponent[]): string =>
  components.map((component) => `${component.paintId}:${component.percentage}`).join('|');

const sharesEnoughComponentOverlap = (left: RecipeComponent[], right: RecipeComponent[]): boolean => {
  const leftIds = new Set(left.map((component) => component.paintId));
  const overlap = right.filter((component) => leftIds.has(component.paintId)).length;
  return overlap === Math.min(left.length, right.length);
};

export const rankRecipes = (
  targetHex: string,
  paints: Paint[],
  maxPaintsPerRecipe: number,
  step: number,
  limit = 3,
): RankedRecipe[] => {
  const targetRgb = hexToRgb(targetHex);
  if (!targetRgb) {
    return [];
  }

  const targetLinear = srgbRgbToLinearRgb(targetRgb);
  const paintMap = new Map(
    paints.map((paint) => {
      const rgb = hexToRgb(paint.hex);
      return [paint.id, rgb ? srgbRgbToLinearRgb(rgb) : null] as const;
    }),
  );

  const ranked = generateCandidateMixes(paints, maxPaintsPerRecipe, step)
    .map((candidate) => {
      const colors = candidate.paintIds.map((paintId) => paintMap.get(paintId));
      if (colors.some((color) => !color)) {
        return null;
      }

      const mixedLinear = mixLinearColors(colors as LinearRgbColor[], candidate.weights);
      const predictedHex = rgbToHex(linearRgbToSrgbRgb(mixedLinear));
      const distanceScore = colorDistance(targetLinear, mixedLinear);
      const ratio = simplifyRatio(candidate.weights);
      const components = candidate.paintIds.map((paintId, index) => ({
        paintId,
        weight: candidate.weights[index],
        percentage: candidate.weights[index],
      }));
      const paintNames = candidate.paintIds.map((paintId) => paints.find((paint) => paint.id === paintId)?.name ?? paintId);

      return {
        predictedHex,
        distanceScore,
        components,
        parts: ratio,
        ratioText: ratio.join(':'),
        recipeText: buildRecipeText(paintNames, ratio),
      } satisfies RankedRecipe;
    })
    .filter((candidate): candidate is RankedRecipe => candidate !== null)
    .sort((left, right) => {
      if (left.distanceScore !== right.distanceScore) {
        return left.distanceScore - right.distanceScore;
      }

      return recipeSignature(left.components).localeCompare(recipeSignature(right.components));
    });

  const diverse: RankedRecipe[] = [];
  // Keep the strongest results, but skip recipes that land on the same predicted color using nearly identical paint sets.
  for (const recipe of ranked) {
    const nearDuplicate = diverse.some(
      (existing) =>
        existing.predictedHex === recipe.predictedHex &&
        sharesEnoughComponentOverlap(existing.components, recipe.components),
    );

    if (!nearDuplicate) {
      diverse.push(recipe);
    }

    if (diverse.length === limit) {
      break;
    }
  }

  return diverse;
};
