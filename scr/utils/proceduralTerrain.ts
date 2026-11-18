import { GRID_SIZE, HUB_GX, HUB_GY, HUB_X, HUB_Y, TILE_SIZE, WORLD_SEED } from '@/constants/gameConfig';
import { RandomStream, defaultResourceStream } from '@/engine/core/randomService';
import { BuildingEntity, PoiEntity, ResourceNode, ResourceType } from '@/types/game';

export function generateResourceNodes(
  pois: PoiEntity[] = [],
  rand: RandomStream = defaultResourceStream(WORLD_SEED)
): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  const occupied = new Set<string>();

  // Reserve 3x3 hub area
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      occupied.add(`${HUB_GX + dx},${HUB_GY + dy}`);
    }
  }
  // POI tiles are reserved world features (deposits carry their own node).
  for (const p of pois) occupied.add(`${p.gx},${p.gy}`);

  const placeCluster = (type: ResourceType, count: number, minDist: number, maxDist: number, amount: number) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < 2500) {
      guard++;
      const gx = 2 + Math.floor(rand() * (GRID_SIZE - 4));
      const gy = 2 + Math.floor(rand() * (GRID_SIZE - 4));
      const dist = Math.hypot(gx - HUB_GX, gy - HUB_GY);
      const key = `${gx},${gy}`;
      if (dist >= minDist && dist <= maxDist && !occupied.has(key)) {
        occupied.add(key);
        nodes.push({
          id: `node_${type}_${placed}_${gx}_${gy}`,
          type,
          gx,
          gy,
          x: (gx + 0.5) * TILE_SIZE,
          y: (gy + 0.5) * TILE_SIZE,
          amount,
          maxAmount: amount,
          pulse: rand() * Math.PI * 2,
          seed: rand() * 100,
        });
        placed++;
      }
    }
  };

  placeCluster('silicate', 26, 2.5, 18, 450);
  placeCluster('iron', 20, 4.5, 19, 400);
  placeCluster('aether', 14, 7.5, 20, 350);

  return nodes;
}

/** Activated relays reveal the same radius as a Radar building. */
export const RELAY_REVEAL_RADIUS = 8.5 * TILE_SIZE;

export function isTileRevealed(
  gx: number,
  gy: number,
  roverX: number,
  roverY: number,
  buildings: BuildingEntity[],
  /** Activated signal relays: permanent radar-like reveal sources. */
  relays?: ReadonlyArray<{ x: number; y: number }>
): boolean {
  const tx = (gx + 0.5) * TILE_SIZE;
  const ty = (gy + 0.5) * TILE_SIZE;

  if (Math.hypot(tx - HUB_X, ty - HUB_Y) <= 7.5 * TILE_SIZE) return true;
  if (Math.hypot(tx - roverX, ty - roverY) <= 6.2 * TILE_SIZE) return true;

  for (const b of buildings) {
    if (b.type === 'radar' && Math.hypot(tx - b.x, ty - b.y) <= 8.5 * TILE_SIZE) {
      return true;
    }
  }
  if (relays) {
    for (const r of relays) {
      if (Math.hypot(tx - r.x, ty - r.y) <= RELAY_REVEAL_RADIUS) return true;
    }
  }
  return false;
}