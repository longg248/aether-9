import type { AetherGameEngine } from '@/engine/gameEngine';

/**
 * Isometric movement remap. The sim moves in world axes (W = -y, D = +x), but
 * on a diamond grid those read as diagonal on screen. Each physical key maps
 * to the logical pair whose world-space sum points along the screen direction:
 *   W (screen up)    → world (-x,-y) → logical {w, a}
 *   S (screen down)  → world (+x,+y) → logical {s, d}
 *   A (screen left)  → world (-x,+y) → logical {a, s}
 *   D (screen right) → world (+x,-y) → logical {w, d}
 * Held keys combine as a UNION so W+D still means world -y, etc. Only the
 * pixi renderer uses this; the legacy canvas view keeps identity mapping.
 */
const ISO_KEY_MAP: Record<string, readonly string[]> = {
  w: ['w', 'a'],
  arrowup: ['w', 'a'],
  s: ['s', 'd'],
  arrowdown: ['s', 'd'],
  a: ['a', 's'],
  arrowleft: ['a', 's'],
  d: ['w', 'd'],
  arrowright: ['w', 'd'],
};

const LOGICAL_KEYS = ['w', 'a', 's', 'd'];

export function isIsoMovementKey(key: string): boolean {
  return key.toLowerCase() in ISO_KEY_MAP;
}

/** Recompute the logical movement subset of engine.keys from physical holds. */
export function applyIsoMovementKeys(engine: AetherGameEngine, physical: ReadonlySet<string>): void {
  for (const k of LOGICAL_KEYS) engine.keys.delete(k);
  for (const p of physical) {
    for (const logical of ISO_KEY_MAP[p] ?? []) engine.keys.add(logical);
  }
}