import type { MixPathStep, Paint, RankedRecipe } from '../../types/models';

const sortComponents = (recipe: Pick<RankedRecipe, 'components'>) => [...recipe.components].sort((left, right) => right.percentage - left.percentage);

const findPaint = (paints: Paint[], paintId: string): Paint | undefined => paints.find((paint) => paint.id === paintId);

const getRoleForPaint = (paint: Paint | undefined, index: number, count: number): MixPathStep['role'] => {
  if (!paint) return index === 0 ? 'base' : 'refine';
  if (index === 0) return 'base';
  if (paint.isBlack || paint.isWhite || paint.heuristics?.preferredRole === 'neutralizer' || paint.heuristics?.preferredRole === 'lightener') {
    return index === count - 1 ? 'support' : 'refine';
  }
  return 'hue-build';
};

export const buildMixPath = (recipe: Pick<RankedRecipe, 'components' | 'targetAnalysis' | 'predictedAnalysis'>, paints: Paint[]): MixPathStep[] => {
  const ordered = sortComponents(recipe);
  return ordered.map((component, index) => {
    const paint = findPaint(paints, component.paintId);
    const role = getRoleForPaint(paint, index, ordered.length);
    const paintName = paint?.name ?? component.paintId;

    if (role === 'base') {
      return { role, paintId: paint?.id, paintName, instruction: `Start with ${paintName} as the base pile.` };
    }
    if (role === 'hue-build') {
      return { role, paintId: paint?.id, paintName, instruction: `Introduce ${paintName} slowly until the ${recipe.targetAnalysis.hueFamily} family is established.` };
    }
    if (paint?.isWhite) {
      return { role, paintId: paint?.id, paintName, instruction: `Only then lift value with ${paintName} in small touches.` };
    }
    if (paint?.isBlack || paint?.heuristics?.preferredRole === 'neutralizer') {
      return { role, paintId: paint?.id, paintName, instruction: `Use ${paintName} last as support to deepen or mute without replacing the hue build.` };
    }
    return { role, paintId: paint?.id, paintName, instruction: `Refine with ${paintName} only after the main mix is reading correctly.` };
  });
};

export const buildStabilityWarnings = (recipe: Pick<RankedRecipe, 'components'>, paints: Paint[]): string[] => {
  const warnings: string[] = [];
  sortComponents(recipe).forEach((component) => {
    const paint = findPaint(paints, component.paintId);
    if (!paint) return;
    if ((paint.name.includes('Phthalo Blue') || paint.heuristics?.tintStrength === 'very-high') && component.percentage >= 10) {
      warnings.push(`${paint.name} is dominant here; tiny additions will shift hue quickly.`);
    }
    if (paint.isWhite && component.percentage >= 20) {
      warnings.push(`${paint.name} will lift value fast and reduce chroma.`);
    }
    if (paint.heuristics?.preferredRole === 'neutralizer' || paint.name.includes('Burnt Umber')) {
      warnings.push(`${paint.name} is acting mainly as a natural mute in this recipe.`);
    }
  });
  return [...new Set(warnings)].slice(0, 3);
};

export const buildRoleNotes = (recipe: Pick<RankedRecipe, 'components'>, paints: Paint[]): string[] => {
  const notes: string[] = [];
  sortComponents(recipe).forEach((component) => {
    const paint = findPaint(paints, component.paintId);
    if (!paint) return;
    if (paint.heuristics?.preferredRole === 'lightener' || paint.isWhite) {
      notes.push(`${paint.name} is handling value lift.`);
    } else if (paint.heuristics?.preferredRole === 'neutralizer' || paint.isBlack) {
      notes.push(`${paint.name} is supporting by muting or deepening the mixture.`);
    } else {
      notes.push(`${paint.name} is part of the hue-building path.`);
    }
  });
  return [...new Set(notes)].slice(0, 4);
};

export const buildLayeringSuggestion = (recipe: Pick<RankedRecipe, 'targetAnalysis' | 'scoreBreakdown'>, paints: Paint[]): string | undefined => {
  if (recipe.scoreBreakdown.finalScore < 0.42 || recipe.targetAnalysis.saturationClassification !== 'vivid') {
    return undefined;
  }
  const yellow = paints.find((paint) => paint.name.includes('Cadmium Yellow'))?.name ?? 'Cadmium Yellow Medium';
  const blue = paints.find((paint) => paint.name.includes('Blue'))?.name ?? 'Ultramarine Blue';
  if (recipe.targetAnalysis.hueFamily === 'green') {
    return `Consider establishing ${yellow} first, then glazing in ${blue} influence if the direct mix still feels limited.`;
  }
  if (recipe.targetAnalysis.hueFamily === 'blue') {
    return `Consider blocking in the closest blue first, then glazing a warmer or cooler support shift rather than forcing a single heavy mix.`;
  }
  return undefined;
};
