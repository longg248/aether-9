import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { DroneEntity, ResourceNode } from '@/types/game';

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

  // Task reservations: a node linked to a living drill belongs to that drill's
  // drone; any other node can be claimed by at most one reassigned drone.
  const drillClaims = new Set<string>();
  for (const b of engine.buildings) {
    if (b.type === 'drill' && b.hp > 0 && b.linkedNodeId) drillClaims.add(b.linkedNodeId);
  }
  const droneClaims = new Map<string, string>(); // nodeId -> droneId
  for (const d of engine.drones) {
    if (d.targetNodeId) droneClaims.set(d.targetNodeId, d.id);
  }

  for (let i = engine.drones.length - 1; i >= 0; i--) {
    const d = engine.drones[i];
    d.propellerAngle += dt * 28;
    const drill = engine.buildings.find((b) => b.id === d.drillId && b.hp > 0);
    const homeNode = drill ? engine.nodes.find((n) => n.id === drill.linkedNodeId) : undefined;

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
        d.state = homeNode && homeNode.amount > 0 ? 'to_node' : 'idle';
      }
      // Orphaned drone (drill gone): retire it once its cargo is delivered.
      if (!drill && d.cargoAmount === 0) {
        if (d.targetNodeId) droneClaims.delete(d.targetNodeId);
        engine.drones.splice(i, 1);
      }
      continue;
    }

    // Empty drones need a living drill; otherwise they are orphaned.
    if (!drill) {
      if (d.targetNodeId) droneClaims.delete(d.targetNodeId);
      engine.drones.splice(i, 1);
      continue;
    }

    // Task selection: the drill's own node has priority. Once it depletes,
    // the drone hauls from the nearest free node instead of idling forever.
    let task: ResourceNode | undefined;
    if (homeNode && homeNode.amount > 0) {
      task = homeNode;
      if (d.targetNodeId) {
        droneClaims.delete(d.targetNodeId);
        d.targetNodeId = null;
      }
    } else {
      if (d.targetNodeId) {
        const held = engine.nodes.find((n) => n.id === d.targetNodeId);
        // Yield if the node ran out or a new drill claimed it.
        if (held && held.amount > 0 && !drillClaims.has(held.id)) {
          task = held;
        } else {
          droneClaims.delete(d.targetNodeId);
          d.targetNodeId = null;
        }
      }
      if (!task) {
        let best: ResourceNode | undefined;
        let bestDist = Infinity;
        for (const n of engine.nodes) {
          if (n.amount <= 0 || drillClaims.has(n.id) || droneClaims.has(n.id)) continue;
          const dist = Math.hypot(n.x - d.x, n.y - d.y);
          if (dist < bestDist) {
            bestDist = dist;
            best = n;
          }
        }
        if (best) {
          d.targetNodeId = best.id;
          droneClaims.set(best.id, d.id);
          task = best;
        }
      }
    }

    if (!task) {
      // No work anywhere: hold position at the drill instead of freezing mid-map.
      d.state = 'idle';
      moveToward(d, drill.x, drill.y, droneSpeed, dt);
      continue;
    }

    if (d.state === 'idle') d.state = 'to_node';

    if (moveToward(d, task.x, task.y, droneSpeed, dt)) {
      const take = Math.min(task.amount, droneCap);
      if (take > 0) {
        task.amount -= take;
        d.cargoType = task.type;
        d.cargoAmount = take;
        d.state = 'to_hub';
      } else {
        d.state = 'idle';
      }
    }
  }
}