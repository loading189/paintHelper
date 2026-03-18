import { describe, expect, it } from 'vitest';
import { getInitialState, loadAppState, saveAppState, storageKey } from './localState';

const createStorage = (seed?: string) => {
  let value = seed;
  return {
    getItem: () => value ?? null,
    setItem: (_key: string, nextValue: string) => {
      value = nextValue;
    },
    read: () => value,
  };
};

describe('localState', () => {
  it('falls back when persisted JSON is corrupted', () => {
    const storage = createStorage('{bad json');
    expect(loadAppState(storage)).toEqual(getInitialState());
  });

  it('saves and reloads app state', () => {
    const storage = createStorage();
    const state = getInitialState();
    saveAppState(state, storage);
    expect(storage.read()).not.toBeUndefined();
    expect(loadAppState(storage)).toEqual(state);
  });

  it('uses the expected storage key', () => {
    expect(storageKey).toBe('paint-mix-matcher-state');
  });
});
