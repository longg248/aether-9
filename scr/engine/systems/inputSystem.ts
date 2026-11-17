import { BUILDING_LIST } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { BuildingType } from '@/types/game';

export interface InputUiCallbacks {
  onSelectBuild: (type: BuildingType | null) => void;
  onToggleTech: () => void;
  onCloseOverlays: () => void;
}

/**
 * Keyboard handling kept in sync with engine state: gameplay keys are only
 * tracked/triggered while actually playing. Returns true when the browser
 * default for the event must be prevented.
 */
export function handleKeyDown(engine: AetherGameEngine, key: string, ui: InputUiCallbacks): boolean {
  const k = key.toLowerCase();

  if (k === 'escape') {
    engine.selectedBuild = null;
    ui.onSelectBuild(null);
    ui.onCloseOverlays();
    return false;
  }

  if (engine.status !== 'playing') return false;

  engine.keys.add(k);

  if (k === ' ') {
    engine.triggerDash();
    return true;
  }
  if (k === 'q') {
    engine.triggerEmp();
  } else if (k === 'e') {
    engine.triggerOvercharge();
  } else if (k === 'r') {
    engine.triggerQuickRepair();
  } else if (k === 't') {
    ui.onToggleTech();
  } else {
    const bMatch = BUILDING_LIST.find((b) => b.key === k);
    if (bMatch) {
      const next = engine.selectedBuild === bMatch.id ? null : bMatch.id;
      engine.selectedBuild = next;
      ui.onSelectBuild(next);
    }
  }
  return false;
}

export function handleKeyUp(engine: AetherGameEngine, key: string): void {
  engine.keys.delete(key.toLowerCase());
}

/** Called on window blur / tab hide so held keys never survive focus loss. */
export function clearHeldKeys(engine: AetherGameEngine): void {
  engine.keys.clear();
}