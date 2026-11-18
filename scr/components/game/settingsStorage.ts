'use client';

export interface GameSettings {
  muted: boolean;
  masterVolume: number;
  defaultSpeed: 1 | 2;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  muted: false,
  masterVolume: 1,
  defaultSpeed: 1,
};

export const SETTINGS_STORAGE_KEY = 'aether9.settings.v1';
export const TUTORIAL_STORAGE_KEY = 'aether9.tutorialSeen.v1';

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadGameSettings(): GameSettings {
  try {
    const raw = storage()?.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_GAME_SETTINGS };
    const value = JSON.parse(raw) as Partial<GameSettings>;
    return {
      muted: typeof value.muted === 'boolean' ? value.muted : DEFAULT_GAME_SETTINGS.muted,
      masterVolume:
        typeof value.masterVolume === 'number' && Number.isFinite(value.masterVolume)
          ? Math.min(1, Math.max(0, value.masterVolume))
          : DEFAULT_GAME_SETTINGS.masterVolume,
      defaultSpeed: value.defaultSpeed === 2 ? 2 : 1,
    };
  } catch {
    return { ...DEFAULT_GAME_SETTINGS };
  }
}

export function persistGameSettings(settings: GameSettings): boolean {
  try {
    const target = storage();
    if (!target) return false;
    target.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadTutorialSeen(): boolean {
  try {
    return storage()?.getItem(TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function persistTutorialSeen(): boolean {
  try {
    storage()?.setItem(TUTORIAL_STORAGE_KEY, '1');
    return storage() !== null;
  } catch {
    return false;
  }
}
