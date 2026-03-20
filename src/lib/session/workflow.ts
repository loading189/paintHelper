import { analyzeColor } from '../color/colorAnalysis';
import { hexToRgb, normalizeHex, rgbToHex } from '../color/colorMath';
import { rankRecipes } from '../color/mixEngine';
import type {
  AchievabilitySignal,
  MixPathStep,
  MixWarning,
  Paint,
  PaintingTarget,
  RankedRecipe,
  ReferenceSample,
  TargetRole,
  UserSettings,
} from '../../types/models';

const roleWeight: Record<TargetRole, number> = {
  primary: 3,
  secondary: 2,
  optional: 1,
};

const clamp = (value: number): number => Math.max(0, Math.min(255, value));

export const createTargetFromSample = (sample: ReferenceSample, sortIndex: number): PaintingTarget => ({
  id: `target-${sample.id}`,
  name: sample.name || `Sample ${sortIndex + 1}`,
  hex: sample.hex,
  notes: sample.note,
  role: 'secondary',
  priority: 2,
  source: 'reference-sample',
  addedAt: sample.addedAt,
  sortIndex,
  mixStatus: 'not-mixed',
  isPinned: false,
  sampleId: sample.id,
});

export const createTargetFromExtractedColor = (hex: string, label: string, sortIndex: number): PaintingTarget => ({
  id: `target-extract-${sortIndex}-${hex.slice(1)}`,
  name: label,
  hex,
  role: 'optional',
  priority: 1,
  source: 'palette-extraction',
  addedAt: new Date().toISOString(),
  sortIndex,
  mixStatus: 'not-mixed',
  isPinned: false,
});

export const buildMixPath = (recipe: RankedRecipe, paints: Paint[]): MixPathStep[] => {
  const map = new Map(paints.map((paint) => [paint.id, paint]));
  const ordered = [...recipe.components].sort((left, right) => right.percentage - left.percentage);
  return ordered.map((component, index) => {
    const paint = map.get(component.paintId);
    const name = paint?.name ?? component.paintId;
    const role = paint?.heuristics?.preferredRole;
    if (index === 0) {
      return {
        title: `Start with ${name}`,
        detail: `Lay in the base pile first at roughly ${component.percentage}% of the mix so the value family is established before corrections.`,
      };
    }
    if (role === 'lightener' || paint?.isWhite) {
      return {
        title: `Reserve ${name} for the late value pass`,
        detail: 'Lift value only after the hue reads correctly; late lightener additions keep the pile from chalking out too early.',
      };
    }
    if (role === 'neutralizer' || paint?.isBlack) {
      return {
        title: `Introduce ${name} only after the hue build`,
        detail: 'Use this support color carefully to naturalize or deepen the mix once the main color family is already believable.',
      };
    }
    return {
      title: `Introduce ${name} slowly`,
      detail: paint?.heuristics?.tintStrength === 'very-high'
        ? 'This is a dominant pigment. Feed it in with tiny touches so the pile does not overshoot.'
        : 'Bring this color in as the hue-building adjustment once the base pile is on the palette.',
    };
  });
};

export const buildDominanceWarnings = (recipe: RankedRecipe, paints: Paint[]): MixWarning[] => {
  const map = new Map(paints.map((paint) => [paint.id, paint]));
  const warnings: MixWarning[] = [];

  recipe.components.forEach((component) => {
    const paint = map.get(component.paintId);
    if (!paint) return;
    if (paint.heuristics?.tintStrength === 'very-high' && component.percentage >= 20) {
      warnings.push({ level: 'warning', text: `${paint.name} has very strong tinting power, so overshoot risk is high.` });
    }
    if (paint.isWhite && component.percentage >= 15) {
      warnings.push({ level: 'info', text: 'White will reduce chroma quickly; keep later lifts incremental.' });
    }
    if (paint.isBlack) {
      warnings.push({ level: 'info', text: 'Black works best here as a value support, not the main hue source.' });
    }
    if (paint.heuristics?.naturalBias === 'earth') {
      warnings.push({ level: 'info', text: `${paint.name} is acting as the muting / naturalizing support in this recipe.` });
    }
  });

  return warnings.slice(0, 4);
};

export const buildAchievabilitySignal = (recipe: RankedRecipe): AchievabilitySignal => {
  if (recipe.distanceScore <= 0.14) {
    return {
      level: 'easy',
      summary: 'Comfortably reachable with the current paint set.',
      detail: 'The spectral prediction is already close enough that normal on-palette refinement should be effective.',
    };
  }
  if (recipe.distanceScore <= 0.28) {
    return {
      level: 'moderate',
      summary: 'Reachable, but expect a few correction passes.',
      detail: 'This target is plausible with the current palette, though value and chroma balancing will need some restraint.',
    };
  }
  return {
    level: 'challenging',
    summary: 'This target is likely an approximation with the current palette.',
    detail: 'The top match remains visibly constrained, so use the recipe as a painterly direction rather than a promise of an exact match.',
  };
};

export const buildGlazingSuggestion = (recipe: RankedRecipe): string | undefined => {
  if (recipe.distanceScore < 0.28) {
    return undefined;
  }
  if (recipe.targetAnalysis.hueFamily === 'green') {
    return 'Block in the yellow-green base first, then glaze the cooler blue influence instead of forcing everything into one pile immediately.';
  }
  if (recipe.targetAnalysis.hueFamily === 'violet') {
    return 'Establish the red-violet base first and cool it in later passes rather than overloading the initial mix.';
  }
  return 'If the direct mix feels stubborn, establish the broad value-and-family base first and reserve the final color bias for a later pass.';
};

export const enrichRankedRecipe = (recipe: RankedRecipe, paints: Paint[]): RankedRecipe => ({
  ...recipe,
  mixPath: buildMixPath(recipe, paints),
  dominanceWarnings: buildDominanceWarnings(recipe, paints),
  achievability: buildAchievabilitySignal(recipe),
  glazingSuggestion: buildGlazingSuggestion(recipe),
});

export const generateRecipeForTarget = (targetHex: string, paints: Paint[], settings: UserSettings): RankedRecipe | undefined => {
  const top = rankRecipes(targetHex, paints, settings, 1)[0];
  return top ? enrichRankedRecipe(top, paints) : undefined;
};

const adjustHex = (hex: string, transform: (rgb: { r: number; g: number; b: number }) => { r: number; g: number; b: number }): string => {
  const rgb = hexToRgb(hex);
  if (!rgb) {
    return hex;
  }
  return normalizeHex(rgbToHex(transform(rgb))) ?? hex;
};

export const generateValueVariants = (target: PaintingTarget): PaintingTarget[] => {
  const baseAnalysis = analyzeColor(target.hex);
  const label = target.name;
  const family = target.familyGroup ?? target.id;

  const lighter = adjustHex(target.hex, ({ r, g, b }) => ({ r: clamp(r + 28), g: clamp(g + 28), b: clamp(b + 28) }));
  const darker = adjustHex(target.hex, ({ r, g, b }) => ({ r: clamp(r - 32), g: clamp(g - 32), b: clamp(b - 32) }));
  const muted = adjustHex(target.hex, ({ r, g, b }) => ({
    r: clamp(Math.round(r * 0.82 + 18)),
    g: clamp(Math.round(g * 0.82 + 18)),
    b: clamp(Math.round(b * 0.82 + 18)),
  }));
  const warmShift = adjustHex(target.hex, ({ r, g, b }) => ({ r: clamp(r + 18), g: clamp(g + 6), b: clamp(b - 10) }));
  const coolShift = adjustHex(target.hex, ({ r, g, b }) => ({ r: clamp(r - 8), g: clamp(g + 8), b: clamp(b + 18) }));

  const variants: Array<{ name: string; hex: string; role: TargetRole; priority: number }> = [
    { name: `${label} Highlight`, hex: lighter, role: 'secondary', priority: 2 },
    { name: `${label} Shadow`, hex: darker, role: 'secondary', priority: 2 },
    { name: `${label} Muted`, hex: muted, role: 'optional', priority: 1 },
  ];

  if (baseAnalysis?.hueFamily !== 'neutral') {
    variants.push(
      { name: `${label} Warm Accent`, hex: warmShift, role: 'optional', priority: 1 },
      { name: `${label} Cool Accent`, hex: coolShift, role: 'optional', priority: 1 },
    );
  }

  return variants.map((variant, index) => ({
    id: `${target.id}-variant-${index}`,
    name: variant.name,
    hex: variant.hex,
    role: variant.role,
    priority: variant.priority,
    source: 'family-generator',
    addedAt: new Date().toISOString(),
    sortIndex: target.sortIndex + index + 1,
    mixStatus: 'not-mixed',
    isPinned: false,
    familyGroup: family,
  }));
};

export const sortTargets = (targets: PaintingTarget[], mode: 'custom' | 'light-to-dark' | 'family' | 'priority'): PaintingTarget[] => {
  const sorted = [...targets];
  if (mode === 'custom') {
    return sorted.sort((left, right) => left.sortIndex - right.sortIndex || left.name.localeCompare(right.name));
  }
  if (mode === 'priority') {
    return sorted.sort((left, right) => roleWeight[right.role] - roleWeight[left.role] || right.priority - left.priority || left.sortIndex - right.sortIndex);
  }
  if (mode === 'family') {
    return sorted.sort((left, right) => {
      const leftAnalysis = analyzeColor(left.hex);
      const rightAnalysis = analyzeColor(right.hex);
      return (leftAnalysis?.hueFamily ?? '').localeCompare(rightAnalysis?.hueFamily ?? '') || left.sortIndex - right.sortIndex;
    });
  }
  return sorted.sort((left, right) => {
    const leftAnalysis = analyzeColor(left.hex);
    const rightAnalysis = analyzeColor(right.hex);
    return (rightAnalysis?.value ?? 0) - (leftAnalysis?.value ?? 0) || left.sortIndex - right.sortIndex;
  });
};
