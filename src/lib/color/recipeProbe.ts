import type { ColorAnalysis, Paint, RecipeComponent } from '../../types/models';
import { formatRatio, simplifyRatio } from '../utils/ratio';
import { analyzeColor, classifyHueFamily } from './colorAnalysis';
import { getDeveloperCalibration } from './developerCalibration';
import { predictSpectralMix } from './spectralMixing';

export type ProbeRecipeInput = {
  paintId: string;
  parts: number;
};

export type RecipeProbeResult = {
  predictedHex: string;
  normalizedRatio: number[];
  normalizedRatioText: string;
  normalizedComponents: RecipeComponent[];
  analysis: {
    value: number;
    chroma: number;
    hueFamily: ColorAnalysis['hueFamily'];
  };
  predictedAnalysis: ColorAnalysis;
};

const clampPositiveInteger = (value: number): number => Math.max(1, Math.round(value));

const buildComponents = (recipe: ProbeRecipeInput[]): RecipeComponent[] => {
  const cleaned = recipe
    .filter((component) => component.paintId)
    .map((component) => ({ ...component, parts: clampPositiveInteger(component.parts) }));

  return cleaned.map((component) => ({
    paintId: component.paintId,
    weight: component.parts,
    percentage: component.parts,
  }));
};

export const probeRecipe = (paints: Paint[], recipe: ProbeRecipeInput[]): RecipeProbeResult | null => {
  const components = buildComponents(recipe);
  if (!components.length) {
    return null;
  }

  const normalizedRatio = simplifyRatio(components.map((component) => component.weight));
  const normalizedComponents = components.map((component, index) => ({
    ...component,
    weight: normalizedRatio[index],
    percentage: normalizedRatio[index],
  }));
  const mix = predictSpectralMix(paints, normalizedComponents);
  const predictedAnalysis = analyzeColor(mix.hex);

  if (!predictedAnalysis) {
    return null;
  }

  return {
    predictedHex: mix.hex,
    normalizedRatio,
    normalizedRatioText: formatRatio(normalizedRatio),
    normalizedComponents,
    analysis: {
      value: predictedAnalysis.value,
      chroma: predictedAnalysis.chroma,
      hueFamily: predictedAnalysis.hueFamily,
    },
    predictedAnalysis,
  };
};

const sortNeighborhood = (left: number[], right: number[], base: number[], darkIndices: number[], supportIndex: number): number => {
  const score = (candidate: number[]) => {
    const distance = candidate.reduce((sum, part, index) => sum + Math.abs(part - base[index]), 0);
    const darkShare = darkIndices.reduce((sum, index) => sum + candidate[index], 0);
    const supportPenalty = supportIndex >= 0 ? candidate[supportIndex] : 0;
    return distance - darkShare * 0.12 + supportPenalty * 0.15;
  };

  return score(left) - score(right);
};

export const generateRecipeNeighborhood = (
  paints: Paint[],
  recipe: ProbeRecipeInput[],
  options: { maxVariants?: number } = {},
): ProbeRecipeInput[][] => {
  const components = buildComponents(recipe);
  if (components.length < 2) {
    return [];
  }

  const maxVariants = options.maxVariants ?? 12;
  const base = simplifyRatio(components.map((component) => component.weight));
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const darkIndices = components.flatMap((component, index) => {
    const paint = paintMap.get(component.paintId);
    if (!paint) return [];
    return paint.isBlack || paint.heuristics?.naturalBias === 'earth' || paint.heuristics?.darkeningStrength ? [index] : [];
  });
  const supportIndex = components.findIndex((component) => {
    const paint = paintMap.get(component.paintId);
    if (!paint) return false;
    return paint.isWhite || paint.heuristics?.preferredRole === 'lightener' || classifyHueFamily(analyzeColor(paint.hex)?.hue ?? null, analyzeColor(paint.hex)?.saturationClassification ?? 'neutral') === 'yellow';
  });
  const neighborhoodRadius = getDeveloperCalibration().inverseSearch.ratioSearch.neighborhoodRadius;
  const variants = new Set<string>();

  const visit = (index: number, candidate: number[]) => {
    if (index === base.length) {
      const distance = candidate.reduce((sum, part, candidateIndex) => sum + Math.abs(part - base[candidateIndex]), 0);
      if (distance === 0 || distance > neighborhoodRadius * 2) {
        return;
      }
      variants.add(candidate.join(':'));
      return;
    }

    for (let delta = -neighborhoodRadius; delta <= neighborhoodRadius; delta += 1) {
      visit(index + 1, [...candidate, clampPositiveInteger(base[index] + delta)]);
    }
  };

  visit(0, []);

  if (base.length === 3) {
    const [a, b, c] = base;
    [
      [a, b + 1, Math.max(1, c - 1)],
      [a + 1, b + 1, Math.max(1, c - 1)],
      [a + 1, b + 2, Math.max(1, c - 1)],
      [Math.max(1, a - 1), b + 2, Math.max(1, c - 1)],
      [a + 1, b, Math.max(1, c - 1)],
    ].forEach((candidate) => variants.add(candidate.join(':')));
  }

  return [...variants]
    .map((signature) => signature.split(':').map((part) => Number(part)))
    .sort((left, right) => sortNeighborhood(left, right, base, darkIndices, supportIndex))
    .slice(0, maxVariants)
    .map((parts) => components.map((component, index) => ({ paintId: component.paintId, parts: parts[index] })));
};

export const exploreRecipeNeighborhood = (
  paints: Paint[],
  recipe: ProbeRecipeInput[],
  options: { maxVariants?: number } = {},
): Array<RecipeProbeResult & { recipe: ProbeRecipeInput[] }> =>
  generateRecipeNeighborhood(paints, recipe, options)
    .map((candidate) => {
      const result = probeRecipe(paints, candidate);
      return result ? { recipe: candidate, ...result } : null;
    })
    .filter((entry): entry is RecipeProbeResult & { recipe: ProbeRecipeInput[] } => Boolean(entry));
