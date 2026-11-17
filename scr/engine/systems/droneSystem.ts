import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';

export function updateDrones(engine: AetherGameEngine, dt: number, efficiency: number): void {
  const droneSpeed = 135 * (1 + (engine.upgrades.drone_logistics - 1) * 0.3) * Math.max(0.35, efficiency);
  const droneCap = Math.round(10 * (1 + (engine.upgrades.drone_logistics - 1) * 0.3));
  for (const d of engine.drones) {
    d.propellerAngle += dt * 28;
    const drill = engine.buildings.find((b) => b.id === d.drillId);
    const node = drill ? engine.nodes.find((n) => n.id === drill.linkedNodeId) : undefined;
    if (!drill || !node || node.amount <= 0) continue;

    const destX = d.state === 'to_node' ? node.x : HUB_X;
    const destY = d.state === 'to_node' ? node.y : HUB_Y;
    const dx = destX - d.x;
    const dy = destY - d.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 12) {
      d.x += (dx / dist) * droneSpeed * dt;
      d.y += (dy / dist) * droneSpeed * dt;
    } else if (d.state === 'to_node') {
      const take = Math.min(node.amount, droneCap);
      node.amount -= take;
      d.cargoType = node.type;
      d.cargoAmount = take;
      d.state = 'to_hub';
    } else {
      if (d.cargoType && d.cargoAmount > 0) {
        engine.resources[d.cargoType] += d.cargoAmount;
        d.cargoAmount = 0;
      }
      d.state = 'to_node';
    }
  }
}