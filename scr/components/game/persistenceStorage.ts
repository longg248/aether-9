'use client';

import type { AetherGameEngine } from '@/engine/gameEngine';
import { serializeGame, validateSaveGame } from '@/engine/persistence/saveGame';
import type { SaveGame } from '@/engine/persistence/types';

export type SaveSlot = 'autosave' | 'manual';

export const SAVE_STORAGE_KEYS: Record<SaveSlot, string> = {
  autosave: 'aether9.save.autosave.v1',
  manual: 'aether9.save.manual.v1',
};

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function writeSaveGame(slot: SaveSlot, save: SaveGame): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(SAVE_STORAGE_KEYS[slot], JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function writeSave(slot: SaveSlot, engine: AetherGameEngine): boolean {
  try {
    return writeSaveGame(slot, serializeGame(engine));
  } catch {
    return false;
  }
}

export function readSave(slot: SaveSlot): SaveGame | null {
  try {
    const raw = storage()?.getItem(SAVE_STORAGE_KEYS[slot]);
    if (!raw) return null;
    return validateSaveGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Continue uses the newest valid manual/autosave slot. */
export function readLatestSave(): SaveGame | null {
  const saves = [readSave('autosave'), readSave('manual')].filter((save): save is SaveGame => save !== null);
  if (saves.length === 0) return null;
  return saves.reduce((latest, save) => (save.savedAt > latest.savedAt ? save : latest));
}

export function hasSaveGame(): boolean {
  return readLatestSave() !== null;
}

/** Clears campaign slots only; settings and tutorial preference are retained. */
export function clearSaveSlots(): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.removeItem(SAVE_STORAGE_KEYS.autosave);
    target.removeItem(SAVE_STORAGE_KEYS.manual);
    return true;
  } catch {
    return false;
  }
}
