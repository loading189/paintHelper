import type {
  LinearRgbColor,
  Paint,
  RankedRecipe,
  RecipeComponent,
} from '../../types/models';
import {
  blendLinearRgb,
  colorDistance,
  hexToLinearRgb,
  linearRgbToHex,
} from './colorMath';

type MixEngineOptions = {
  step?: number;
  maxPaintsPerRecipe?: number;
  topResults?: number;
  duplicateThreshold?: number;
  simpleRecipeTieBreakThreshold?: number;
};

type PaintWithColor = Paint & {
  linearColor: LinearRgbColor;
};

type CandidateRecipe = {
  predictedLinear: LinearRgbColor;
  predictedHex: string;
  distanceScore: number;
  components: RecipeComponent[];
};

const DEFAULT_OPTIONS: Required<MixEngineOptions> = {
  step: 10,
  maxPaintsPerRecipe: 3,
  topResults: 3,
  duplicateThreshold: 0.015,
  simpleRecipeTieBreakThreshold: 0.01,
};

const validateStep = (step: number): void => {
  if (!Number.isInteger(step) || step <= 0 || step > 100) {
    throw new Error('Weight step must be an integer between 1 and 100.');
  }

  if (100 % step !== 0) {
    throw new Error('Weight step must divide evenly into 100.');
  }
};

const validateMaxPaints = (maxPaintsPerRecipe: number): void => {
  if (!Number.isInteger(maxPaintsPerRecipe) || maxPaintsPerRecipe < 1) {
    throw new Error('maxPaintsPerRecipe must be an integer greater than or equal to 1.');
  }
};

const activePaintCount = (components: RecipeComponent[]): number =>
  components.filter((component) => component.weight > 0).length;

const choosePaintCombinations = <T>(items: T[], size: number): T[][] => {
  if (size < 1 || size > items.length) {
    return [];
  }

  const results: T[][] = [];

  const build = (startIndex: number, current: T[]) => {
    if (current.length === size) {
      results.push([...current]);
      return;
    }

    for (let index = startIndex; index < items.length; index += 1) {
      current.push(items[index]);
      build(index + 1, current);
      current.pop();
    }
  };

  build(0, []);
  return results;
};

export const generateWeightCombinations = (
  paintCount: number,
  step = 10,
): number[][] => {
  validateStep(step);

  if (!Number.isInteger(paintCount) || paintCount < 1) {
    return [];
  }

  const units = 100 / step;
  const combinations: number[][] = [];

  const build = (remainingSlots: number, remainingUnits: number, current: number[]) => {
    if (remainingSlots === 1) {
      combinations.push([...current, remainingUnits * step]);
      return;
    }

    for (let unitsForThisSlot = 0; unitsForThisSlot <= remainingUnits; unitsForThisSlot += 1) {
      build(remainingSlots - 1, remainingUnits - unitsForThisSlot, [
        ...current,
        unitsForThisSlot * step,
      ]);
    }
  };

  build(paintCount, units, []);
  return combinations.filter((combo) => combo.some((value) => value > 0));
};

const prepareEnabledPaints = (paints: Paint[]): PaintWithColor[] => {
  return paints
    .filter((paint) => paint.isEnabled)
    .map((paint) => {
      const linearColor = hexToLinearRgb(paint.hex);
      if (!linearColor) {
        return null;
      }

      return {
        ...paint,
        linearColor,
      };
    })
    .filter((paint): paint is PaintWithColor => paint !== null);
};

const toRecipeComponents = (
  paints: PaintWithColor[],
  percentages: number[],
): RecipeComponent[] => {
  return paints
    .map((paint, index) => {
      const percentage = percentages[index] ?? 0;
      return {
        paintId: paint.id,
        percentage,
        weight: percentage / 100,
      };
    })
    .filter((component) => component.percentage > 0);
};

const buildCandidate = (
  paints: PaintWithColor[],
  percentages: number[],
  targetLinear: LinearRgbColor,
): CandidateRecipe | null => {
  const components = toRecipeComponents(paints, percentages);

  if (!components.length) {
    return null;
  }

  const blended = blendLinearRgb(
    components.map((component) => {
      const paint = paints.find((item) => item.id === component.paintId);
      if (!paint) {
        throw new Error(`Missing paint for component ${component.paintId}`);
      }

      return {
        color: paint.linearColor,
        weight: component.weight,
      };
    }),
  );

  return {
    predictedLinear: blended,
    predictedHex: linearRgbToHex(blended),
    distanceScore: colorDistance(blended, targetLinear),
    components,
  };
};

const compareCandidates = (
  left: CandidateRecipe,
  right: CandidateRecipe,
  simpleRecipeTieBreakThreshold: number,
): number => {
  const distanceDelta = left.distanceScore - right.distanceScore;

  if (Math.abs(distanceDelta) > simpleRecipeTieBreakThreshold) {
    return distanceDelta;
  }

  const paintCountDelta = activePaintCount(left.components) - activePaintCount(right.components);
  if (paintCountDelta !== 0) {
    return paintCountDelta;
  }

  const leftLargest = Math.max(...left.components.map((component) => component.percentage));
  const rightLargest = Math.max(...right.components.map((component) => component.percentage));

  if (leftLargest !== rightLargest) {
    return rightLargest - leftLargest;
  }

  return left.predictedHex.localeCompare(right.predictedHex);
};

const dedupeCandidates = (
  candidates: CandidateRecipe[],
  duplicateThreshold: number,
  topResults: number,
): CandidateRecipe[] => {
  const deduped: CandidateRecipe[] = [];

  for (const candidate of candidates) {
    const isDuplicate = deduped.some(
      (existing) =>
        colorDistance(existing.predictedLinear, candidate.predictedLinear) <= duplicateThreshold,
    );

    if (!isDuplicate) {
      deduped.push(candidate);
    }

    if (deduped.length >= topResults) {
      break;
    }
  }

  return deduped;
};

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const temp = y;
    y = x % y;
    x = temp;
  }

  return x || 1;
};

const gcdArray = (values: number[]): number => {
  const filtered = values.filter((value) => value > 0);
  if (!filtered.length) {
    return 1;
  }

  return filtered.reduce((acc, value) => gcd(acc, value), filtered[0]);
};

const simplifyParts = (percentages: number[]): number[] => {
  const filtered = percentages.filter((value) => value > 0);
  if (!filtered.length) {
    return [];
  }

  const divisor = gcdArray(filtered);
  return filtered.map((value) => Math.round(value / divisor));
};

const buildRecipeText = (
  components: RecipeComponent[],
  parts: number[],
  paintMap: Map<string, Paint>,
): string => {
  return components
    .map((component, index) => {
      const paintName = paintMap.get(component.paintId)?.name ?? component.paintId;
      const partValue = parts[index] ?? 0;
      const label = partValue === 1 ? 'part' : 'parts';
      return `${partValue} ${label} ${paintName}`;
    })
    .join(' + ');
};

const toRankedRecipe = (
  candidate: CandidateRecipe,
  paints: Paint[],
): RankedRecipe => {
  const paintMap = new Map(paints.map((paint) => [paint.id, paint]));
  const percentages = candidate.components.map((component) => component.percentage);
  const parts = simplifyParts(percentages);
  const ratioText = parts.join(':');
  const recipeText = buildRecipeText(candidate.components, parts, paintMap);

  return {
    predictedHex: candidate.predictedHex,
    distanceScore: candidate.distanceScore,
    components: candidate.components,
    parts,
    ratioText,
    recipeText,
  };
};

export const rankRecipes = (
  targetHex: string,
  paints: Paint[],
  options: MixEngineOptions = {},
): RankedRecipe[] => {
  const resolved = { ...DEFAULT_OPTIONS, ...options };

  validateStep(resolved.step);
  validateMaxPaints(resolved.maxPaintsPerRecipe);

  const targetLinear = hexToLinearRgb(targetHex);
  if (!targetLinear) {
    return [];
  }

  const enabledPaints = prepareEnabledPaints(paints);
  if (!enabledPaints.length) {
    return [];
  }

  const allCandidates: CandidateRecipe[] = [];
  const maxPaints = Math.min(resolved.maxPaintsPerRecipe, enabledPaints.length);

  for (let paintCount = 1; paintCount <= maxPaints; paintCount += 1) {
    const paintCombos = choosePaintCombinations(enabledPaints, paintCount);
    const weightCombos = generateWeightCombinations(paintCount, resolved.step);

    for (const paintCombo of paintCombos) {
      for (const weightCombo of weightCombos) {
        const candidate = buildCandidate(paintCombo, weightCombo, targetLinear);
        if (candidate) {
          allCandidates.push(candidate);
        }
      }
    }
  }

  const ranked = [...allCandidates].sort((left, right) =>
    compareCandidates(left, right, resolved.simpleRecipeTieBreakThreshold),
  );

  const deduped = dedupeCandidates(
    ranked,
    resolved.duplicateThreshold,
    resolved.topResults,
  );

  return deduped.map((candidate) => toRankedRecipe(candidate, paints));
};

export const generateCandidateMixes = (
  targetHex: string,
  paints: Paint[],
  options: MixEngineOptions = {},
): RankedRecipe[] => {
  return rankRecipes(targetHex, paints, options);
};