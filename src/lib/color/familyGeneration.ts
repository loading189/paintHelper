import type { Paint } from '../../types/models';
import { generateValueLadder } from './valueRange';

export type GeneratedTargetSeed = {
  label: string;
  targetHex: string;
  notes: string;
  valueRole?: 'highlight' | 'light' | 'midtone' | 'shadow' | 'accent';
  priority?: 'primary' | 'secondary' | 'optional';
  family?: string;
};

export const generateColorFamily = (label: string, targetHex: string, paints: Paint[], familyName?: string): GeneratedTargetSeed[] => {
  const ladder = generateValueLadder(targetHex, paints);
  const root = label.trim() || 'Target';
  const family = familyName ?? root;

  return [
    {
      label: `${root} highlight`,
      targetHex: ladder.lighterHex,
      notes: 'Deterministic lighter family target for preparation.',
      valueRole: 'highlight',
      priority: 'secondary',
      family,
    },
    {
      label: `${root} midtone`,
      targetHex,
      notes: 'Original target retained as the family midtone anchor.',
      valueRole: 'midtone',
      priority: 'primary',
      family,
    },
    {
      label: `${root} shadow`,
      targetHex: ladder.darkerHex,
      notes: 'Deterministic darker family target for realism shadow planning.',
      valueRole: 'shadow',
      priority: 'secondary',
      family,
    },
    {
      label: `${root} muted`,
      targetHex: ladder.mutedHex,
      notes: 'Muted/background leaning family target generated from the current palette logic.',
      valueRole: 'accent',
      priority: 'optional',
      family,
    },
  ];
};
