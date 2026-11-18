import { GRID_SIZE, HUB_X, HUB_Y, TILE_SIZE, WORLD_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { WorldPosition } from '@/engine/isometric/projection';
import { getActivatedRelays } from '@/engine/systems/poiSystem';
import { MinimapSnapshot } from '@/types/game';
import { isTileRevealed } from '@/utils/proceduralTerrain';

export interface MinimapSize {
  width: number;
  height: number;
}

export const MINIMAP_SIZE: MinimapSize = { width: 160, height: 160 };

/** Canonical world pixels → minimap SVG coordinates (no camera or iso transform). */
export function worldToMinimap(point: WorldPosition, size: MinimapSize = MINIMAP_SIZE): WorldPosition {
  return {
    x: (point.x / WORLD_SIZE) * size.width,
    y: (point.y / WORLD_SIZE) * size.height,
  };
}

/** Exact inverse of worldToMinimap. */
export function minimapToWorld(point: WorldPosition, size: MinimapSize = MINIMAP_SIZE): WorldPosition {
  return {
    x: (point.x / size.width) * WORLD_SIZE,
    y: (point.y / size.height) * WORLD_SIZE,
  };
}

/** Builds a render-only snapshot; enemies are included only on currently revealed tiles. */
export function buildMinimapSnapshot(engine: AetherGameEngine): MinimapSnapshot {
  const relays = getActivatedRelays(engine.pois);
  const revealedTiles: MinimapSnapshot['revealedTiles'] = [];
  for (let gy = 0; gy < GRID_SIZE; gy++) {
    for (let gx = 0; gx < GRID_SIZE; gx++) {
      if (isTileRevealed(gx, gy, engine.rover.x, engine.rover.y, engine.buildings, relays)) {
        revealedTiles.push({ gx, gy });
      }
    }
  }

  const enemies = engine.enemies.filter((enemy) => {
    const gx = Math.floor(enemy.x / TILE_SIZE);
    const gy = Math.floor(enemy.y / TILE_SIZE);
    if (gx < 0 || gy < 0 || gx >= GRID_SIZE || gy >= GRID_SIZE) return false;
    return isTileRevealed(gx, gy, engine.rover.x, engine.rover.y, engine.buildings, relays);
  });

  return {
    hub: { x: HUB_X, y: HUB_Y },
    rover: { x: engine.rover.x, y: engine.rover.y },
    pois: engine.pois
      .filter((poi) => poi.discovered || (poi.type === 'signal_relay' && poi.completed))
      .map((poi) => ({ id: poi.id, type: poi.type, x: poi.x, y: poi.y, completed: poi.completed })),
    enemies: enemies.map((enemy) => ({
      id: enemy.id,
      x: enemy.x,
      y: enemy.y,
      elite: enemy.elite === true,
    })),
    revealedTiles,
  };
}
