import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { DroneEntity } from '@/types/game';

const ARRIVE_DIST = 12;

/** Moves a drone toward a point; returns true once it is within arrival range. */
function moveToward(d: DroneEntity, tx: number, ty: number, speed: number, dt: number): boolean {
  const dx = tx - d.x;
  const dy = ty - d.y;
  const dist = Math.hypot(dx, dy);
  if (dist > ARRIVE_DIST) {
    const step = Math.min(dist, speed * dt);
    d.x += (dx / dist) * step;
    d.y += (dy / dist) * step;
    return false;
  }
  return true;
}

export function updateDrones(engine: AetherGameEngine, dt: number, efficiency: number): void {
  const droneSpeed = 135 * (1 + (engine.upgrades.drone_logistics - 1) * 0.3) * Math.max(0.35, efficiency);
  const droneCap = Math.round(10 * (1 + (engine.upgrades.drone_logistics - 1) * 0.3));
  for (let i = engine.drones.length - 1; i >= 0; i--) {
    const d = engine.drones[i];
    d.propellerAngle += dt * 28;
    const drill = engine.buildings.find((b) => b.id === d.drillId && b.hp > 0);
    const node = drill ? engine.nodes.find((n) => n.id === drill.linkedNodeId) : undefined;

    // Delivery always completes: a loaded drone flies to the Hub even if its
    // drill was destroyed or the node depleted (also recovers invalid states).
    if (d.cargoAmount > 0 || d.state === 'to_hub') {
      d.state = 'to_hub';
      if (moveToward(d, HUB_X, HUB_Y, droneSpeed, dt)) {
        if (d.cargoType && d.cargoAmount > 0) {
          engine.resources[d.cargoType] += d.cargoAmount;
        }
        // Clear cargo before any state change so delivery can never repeat.
        d.cargoType = null;
        d.cargoAmount = 0;
        d.state = node && node.amount > 0 ? 'to_node' : 'idle';
      }
      // Orphaned drone (drill gone): retire it once its cargo is delivered.
      if (!drill && d.cargoAmount === 0) engine.drones.splice(i, 1);
      continue;
    }

    // Empty drones need a living drill; otherwise they are orphaned.
    if (!drill) {
      engine.drones.splice(i, 1);
      continue;
    }

    if (!node || node.amount <= 0) {
      // Depleted node: hold position at the drill instead of freezing mid-map.
      d.state = 'idle';
      moveToward(d, drill.x, drill.y, droneSpeed, dt);
      continue;
    }

    if (d.state === 'idle') d.state = 'to_node';

    if (moveToward(d, node.x, node.y, droneSpeed, dt)) {
      const take = Math.min(node.amount, droneCap);
      if (take > 0) {
        node.amount -= take;
        d.cargoType = node.type;
        d.cargoAmount = take;
        d.state = 'to_hub';
      } else {
        d.state = 'idle';
      }
    }
  }
}