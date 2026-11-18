import { beforeEach, describe, expect, it } from 'vitest';
import { AetherGameEngine } from '@/engine/gameEngine';
import { serializeGame } from '@/engine/persistence/saveGame';
import {
  DEFAULT_GAME_SETTINGS,
  SETTINGS_STORAGE_KEY,
  TUTORIAL_STORAGE_KEY,
  loadGameSettings,
  loadTutorialSeen,
  persistGameSettings,
  persistTutorialSeen,
} from '@/components/game/settingsStorage';
import {
  SAVE_STORAGE_KEYS,
  clearSaveSlots,
  readLatestSave,
  readSave,
  writeSaveGame,
} from '@/components/game/persistenceStorage';

beforeEach(() => {
  window.localStorage.clear();
});

describe('local persistence adapters', () => {
  it('reads the newest valid slot and clears only campaign data', () => {
    const engine = new AetherGameEngine();
    engine.status = 'playing';
    const base = serializeGame(engine);
    expect(writeSaveGame('autosave', { ...base, savedAt: 100, elapsed: 10 })).toBe(true);
    expect(writeSaveGame('manual', { ...base, savedAt: 200, elapsed: 20 })).toBe(true);
    expect(readLatestSave()?.elapsed).toBe(20);

    expect(writeSaveGame('autosave', { ...base, savedAt: 300, elapsed: 30 })).toBe(true);
    expect(readLatestSave()?.elapsed).toBe(30);
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{"muted":true}');
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, '1');
    expect(clearSaveSlots()).toBe(true);
    expect(readSave('manual')).toBeNull();
    expect(readSave('autosave')).toBeNull();
    expect(window.localStorage.getItem(SETTINGS_STORAGE_KEY)).not.toBeNull();
    expect(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('1');
  });

  it('returns null for corrupted or old-version stored saves without throwing', () => {
    window.localStorage.setItem(SAVE_STORAGE_KEYS.manual, '{not json');
    expect(() => readSave('manual')).not.toThrow();
    expect(readSave('manual')).toBeNull();

    const engine = new AetherGameEngine();
    window.localStorage.setItem(
      SAVE_STORAGE_KEYS.autosave,
      JSON.stringify({ ...serializeGame(engine), version: 0 })
    );
    expect(readSave('autosave')).toBeNull();
    expect(readLatestSave()).toBeNull();
  });

  it('persists settings safely and remembers tutorial dismissal', () => {
    expect(persistGameSettings({ muted: true, masterVolume: 0.25, defaultSpeed: 2 })).toBe(true);
    expect(loadGameSettings()).toEqual({ muted: true, masterVolume: 0.25, defaultSpeed: 2 });
    expect(persistTutorialSeen()).toBe(true);
    expect(loadTutorialSeen()).toBe(true);

    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{bad json');
    expect(loadGameSettings()).toEqual(DEFAULT_GAME_SETTINGS);
  });
});
