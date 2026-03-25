import type { Paint, UserSettings } from '../../types/models';

const LOCKED_CONFIG_STORAGE_KEY = 'paint-mix-matcher-locked-configs';

export type MixerTuningSnapshot = {
  tintingStrength: number;
  chromaBias: number;
  darknessBias: number;
  temperatureBias: number;
};

export type LockedPaintConfig = {
  paintId: string;
  name: string;
  hex: string;
  isOnHand: boolean;
  tuning: MixerTuningSnapshot;
};

export type LockedMixerConfiguration = {
  schemaVersion: 1;
  id: string;
  configName: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  source: 'local-browser-registry';
  settings: UserSettings;
  paints: LockedPaintConfig[];
};

export type LockedConfigRegistry = {
  schemaVersion: 1;
  items: LockedMixerConfiguration[];
};

const fallbackRegistry = (): LockedConfigRegistry => ({
  schemaVersion: 1,
  items: [],
});

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries
      .map(([key, inner]) => `${JSON.stringify(key)}:${stableStringify(inner)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const fnv1a = (input: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'config';

const toLockedPaintConfig = (paint: Paint): LockedPaintConfig => ({
  paintId: paint.id,
  name: paint.name,
  hex: paint.hex,
  isOnHand: paint.isOnHand ?? true,
  tuning: {
    tintingStrength: paint.tintingStrength ?? 1,
    chromaBias: paint.chromaBias ?? 0,
    darknessBias: paint.darknessBias ?? 0,
    temperatureBias: paint.temperatureBias === 'warm' ? 0.5 : paint.temperatureBias === 'cool' ? -0.5 : 0,
  },
});

export const createLockedConfigDraft = (args: {
  configName: string;
  paints: Paint[];
  settings: UserSettings;
  createdAt?: string;
}) => {
  const createdAt = args.createdAt ?? new Date().toISOString();
  const paints = args.paints.map(toLockedPaintConfig);
  const seed = stableStringify({
    configName: args.configName,
    paints,
    settings: args.settings,
  });

  return {
    schemaVersion: 1 as const,
    id: `${toSlug(args.configName)}-${fnv1a(seed)}`,
    configName: args.configName,
    version: 1,
    createdAt,
    updatedAt: createdAt,
    source: 'local-browser-registry' as const,
    settings: args.settings,
    paints,
  };
};

export const loadLockedConfigRegistry = (): LockedConfigRegistry => {
  if (typeof window === 'undefined') {
    return fallbackRegistry();
  }

  try {
    const raw = window.localStorage.getItem(LOCKED_CONFIG_STORAGE_KEY);
    if (!raw) {
      return fallbackRegistry();
    }

    const parsed = JSON.parse(raw) as Partial<LockedConfigRegistry>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.items)) {
      return fallbackRegistry();
    }

    return {
      schemaVersion: 1,
      items: parsed.items.filter(
        (item): item is LockedMixerConfiguration =>
          Boolean(item) && typeof item.id === 'string' && typeof item.configName === 'string',
      ),
    };
  } catch {
    return fallbackRegistry();
  }
};

export const saveLockedConfigRegistry = (registry: LockedConfigRegistry) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(LOCKED_CONFIG_STORAGE_KEY, JSON.stringify(registry));
};

export const saveLockedConfiguration = (draft: LockedMixerConfiguration, mode: 'new-version' | 'update-current' = 'new-version') => {
  const registry = loadLockedConfigRegistry();
  const existing = registry.items.find((item) => item.id === draft.id);

  if (!existing) {
    const next = {
      ...registry,
      items: [draft, ...registry.items],
    };
    saveLockedConfigRegistry(next);
    return draft;
  }

  const nextVersion = mode === 'new-version' ? existing.version + 1 : existing.version;
  const merged: LockedMixerConfiguration = {
    ...draft,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    version: nextVersion,
  };

  const next = {
    ...registry,
    items: [merged, ...registry.items.filter((item) => item.id !== draft.id)],
  };
  saveLockedConfigRegistry(next);
  return merged;
};

export const exportLockedConfigRegistryJson = () => JSON.stringify(loadLockedConfigRegistry(), null, 2);

export const importLockedConfigRegistryJson = (raw: string) => {
  const parsed = JSON.parse(raw) as Partial<LockedConfigRegistry>;
  if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.items)) {
    throw new Error('Invalid locked configuration registry file.');
  }

  const normalized: LockedConfigRegistry = {
    schemaVersion: 1,
    items: parsed.items.filter(
      (item): item is LockedMixerConfiguration =>
        Boolean(item) && typeof item.id === 'string' && typeof item.configName === 'string',
    ),
  };

  saveLockedConfigRegistry(normalized);
  return normalized;
};
