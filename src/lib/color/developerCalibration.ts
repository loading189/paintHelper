import type { Paint } from '../../types/models';

export type InverseSearchCalibration = {
  darkTargets: {
    minDarkShare: number;
    maxYellowShare: number;
    maxLightShare: number;
    dominantLightShareCap: number;
    dominantYellowShareCap: number;
    valuePenaltyScale: number;
    earthStructuralBonus: number;
    offHuePenalty: number;
  };
  yellows: {
    maxBlueShareLight: number;
  };
  mutedTargets: {
    cleanlinessPenalty: number;
  };
  vividTargets: {
    muddinessPenalty: number;
  };
  neutrals: {
    balancePenalty: number;
  };
  greenTargets: {
    requireEarthForDarkNatural: boolean;
    vividOffHuePenalty: number;
  };
  ratioSearch: {
    maxComponents: number;
    darkRatioFamiliesEnabled: boolean;
    neighborhoodRadius: number;
  };
  global: {
    familyBeamWidth: number;
    dedupeBasinThreshold: number;
    excellentMatchThreshold: number;
    workableMatchThreshold: number;
    practicalRatioHardMaxParts: number;
    practicalRatioIdealMaxParts2: number;
    practicalRatioIdealMaxParts3: number;
    practicalRatioIdealMaxParts4: number;
  };
};

export type PaintForwardCalibration = {
  tintingStrength: number;
  darknessBias: number;
  chromaBias: number;
  earthStrengthBias: number;
  whiteLiftBias: number;
  baseHexOverride?: string;
};

export type ForwardPigmentCalibration = {
  paints: Record<string, PaintForwardCalibration>;
};

export type DeveloperCalibration = {
  inverseSearch: InverseSearchCalibration;
  forwardPigments: ForwardPigmentCalibration;
};

const STORAGE_KEY = 'paint-mix-developer-calibration';

const defaultPerPaintForwardCalibration: ForwardPigmentCalibration['paints'] = {
  'paint-mars-black': { tintingStrength: 1.08, darknessBias: 0.03, chromaBias: -0.08, earthStrengthBias: 0, whiteLiftBias: 0 },
  'paint-cadmium-yellow-medium': { tintingStrength: 1, darknessBias: 0.02, chromaBias: -0.06, earthStrengthBias: 0, whiteLiftBias: 0 },
  'paint-burnt-umber': { tintingStrength: 1.12, darknessBias: 0.08, chromaBias: -0.14, earthStrengthBias: 0.18, whiteLiftBias: 0 },
  'paint-ultramarine-blue': { tintingStrength: 1.02, darknessBias: 0.04, chromaBias: -0.04, earthStrengthBias: 0, whiteLiftBias: 0 },
  'paint-phthalo-blue': { tintingStrength: 0.98, darknessBias: 0.01, chromaBias: -0.03, earthStrengthBias: 0, whiteLiftBias: 0 },
  'paint-cadmium-red': { tintingStrength: 1, darknessBias: 0.02, chromaBias: -0.03, earthStrengthBias: 0, whiteLiftBias: 0 },
  'paint-alizarin-crimson': { tintingStrength: 1, darknessBias: 0.03, chromaBias: -0.02, earthStrengthBias: 0, whiteLiftBias: 0 },
  'paint-unbleached-titanium': { tintingStrength: 1, darknessBias: 0, chromaBias: -0.04, earthStrengthBias: 0.06, whiteLiftBias: 0.02 },
  'paint-titanium-white': { tintingStrength: 1, darknessBias: 0, chromaBias: -0.08, earthStrengthBias: 0, whiteLiftBias: 0.04 },
};

export const defaultDeveloperCalibration: DeveloperCalibration = {
  inverseSearch: {
    darkTargets: {
      minDarkShare: 20,
      maxYellowShare: 60,
      maxLightShare: 0,
      dominantLightShareCap: 55,
      dominantYellowShareCap: 55,
      valuePenaltyScale: 1.45,
      earthStructuralBonus: 0.04,
      offHuePenalty: 0.16,
    },
    yellows: { maxBlueShareLight: 5 },
    mutedTargets: { cleanlinessPenalty: 2.1 },
    vividTargets: { muddinessPenalty: 1.4 },
    neutrals: { balancePenalty: 2.4 },
    greenTargets: { requireEarthForDarkNatural: true, vividOffHuePenalty: 0.22 },
    ratioSearch: { maxComponents: 3, darkRatioFamiliesEnabled: true, neighborhoodRadius: 2 },
    global: {
      familyBeamWidth: 8,
      dedupeBasinThreshold: 0.01,
      excellentMatchThreshold: 0.18,
      workableMatchThreshold: 0.34,
      practicalRatioHardMaxParts: 12,
      practicalRatioIdealMaxParts2: 8,
      practicalRatioIdealMaxParts3: 9,
      practicalRatioIdealMaxParts4: 10,
    },
  },
  forwardPigments: {
    paints: defaultPerPaintForwardCalibration,
  },
};

const cloneCalibration = (calibration: DeveloperCalibration): DeveloperCalibration => JSON.parse(JSON.stringify(calibration)) as DeveloperCalibration;

const listeners = new Set<(calibration: DeveloperCalibration) => void>();

const notify = () => {
  const snapshot = getDeveloperCalibration();
  listeners.forEach((listener) => listener(snapshot));
};

const persistCalibration = (calibration: DeveloperCalibration) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration));
};

const loadCalibration = (): DeveloperCalibration | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DeveloperCalibration;
  } catch {
    return null;
  }
};

let currentDeveloperCalibration: DeveloperCalibration = cloneCalibration(defaultDeveloperCalibration);
const fromStorage = loadCalibration();
if (fromStorage) {
  currentDeveloperCalibration = {
    ...cloneCalibration(defaultDeveloperCalibration),
    ...fromStorage,
    inverseSearch: {
      ...cloneCalibration(defaultDeveloperCalibration).inverseSearch,
      ...fromStorage.inverseSearch,
      global: {
        ...cloneCalibration(defaultDeveloperCalibration).inverseSearch.global,
        ...(fromStorage.inverseSearch?.global ?? {}),
      },
    },
    forwardPigments: {
      paints: {
        ...cloneCalibration(defaultDeveloperCalibration).forwardPigments.paints,
        ...(fromStorage.forwardPigments?.paints ?? {}),
      },
    },
  };
}

export const getDeveloperCalibration = (): DeveloperCalibration => currentDeveloperCalibration;

export const subscribeDeveloperCalibration = (listener: (calibration: DeveloperCalibration) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const resetDeveloperCalibration = (): DeveloperCalibration => {
  currentDeveloperCalibration = cloneCalibration(defaultDeveloperCalibration);
  persistCalibration(currentDeveloperCalibration);
  notify();
  return currentDeveloperCalibration;
};

export const updateDeveloperCalibration = (patch: Partial<DeveloperCalibration>): DeveloperCalibration => {
  const next = cloneCalibration(currentDeveloperCalibration) as any;
  const incoming = patch as any;

  if (incoming.inverseSearch) {
    Object.entries(incoming.inverseSearch).forEach(([section, values]) => {
      next.inverseSearch[section] = {
        ...next.inverseSearch[section],
        ...(values as Record<string, unknown>),
      };
    });
  }

  if (incoming.forwardPigments?.paints) {
    Object.entries(incoming.forwardPigments.paints).forEach(([paintId, values]) => {
      next.forwardPigments.paints[paintId] = {
        ...(next.forwardPigments.paints[paintId] ?? { tintingStrength: 1, darknessBias: 0, chromaBias: 0, earthStrengthBias: 0, whiteLiftBias: 0 }),
        ...(values as Record<string, unknown>),
      };
    });
  }

  currentDeveloperCalibration = next;
  persistCalibration(currentDeveloperCalibration);
  notify();
  return currentDeveloperCalibration;
};

export const getForwardCalibrationForPaint = (paint: Paint): PaintForwardCalibration => {
  const runtimeCalibration = (paint as Paint & { runtime?: { forwardCalibration?: PaintForwardCalibration } }).runtime?.forwardCalibration;
  if (runtimeCalibration) {
    return runtimeCalibration;
  }

  const calibration = getDeveloperCalibration().forwardPigments.paints[paint.id];
  return calibration
    ? calibration
    : { tintingStrength: 1, darknessBias: 0, chromaBias: 0, earthStrengthBias: 0, whiteLiftBias: 0 };
};
