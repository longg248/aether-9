import { TILE_SIZE } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import {
  BuildingEntity,
  BuildingType,
  DroneEntity,
  EnemyEntity,
  EnemyType,
  ResourceNode,
  ResourceType,
} from '@/types/game';

let uid = 0;
const nextId = (prefix: string) => `${prefix}_test_${uid++}`;

export function makeEngine(): AetherGameEngine {
  const engine = new AetherGameEngine();
  engine.status = 'playing';
  // Deterministic baseline: no random nodes/waves interfere with assertions.
  engine.nodes = [];
  engine.waveTimer = 9999;
  engine.stormTimer = 9999;
  engine.podTimer = 9999;
  return engine;
}

export function makeNode(type: ResourceType, gx: number, gy: number, amount: number): ResourceNode {
  return {
    id: nextId('node'),
    type,
    gx,
    gy,
    x: (gx + 0.5) * TILE_SIZE,
    y: (gy + 0.5) * TILE_SIZE,
    amount,
    maxAmount: amount,
    pulse: 0,
    seed: 0,
  };
}

export function makeBuilding(type: BuildingType, gx: number, gy: number, hp = 100): BuildingEntity {
  return {
    id: nextId('bld'),
    type,
    gx,
    gy,
    x: (gx + 0.5) * TILE_SIZE,
    y: (gy + 0.5) * TILE_SIZE,
    hp,
    maxHp: hp,
    cooldown: 0,
    animPhase: 0,
    angle: 0,
    recoil: 0,
    hitFlash: 0,
  };
}

export function makeDrillWithDrone(
  engine: AetherGameEngine,
  node: ResourceNode
): { drill: BuildingEntity; drone: DroneEntity } {
  const drill = makeBuilding('drill', node.gx, node.gy, 180);
  drill.linkedNodeId = node.id;
  engine.buildings.push(drill);
  engine.nodes.push(node);
  const drone: DroneEntity = {
    id: nextId('drone'),
    drillId: drill.id,
    x: drill.x,
    y: drill.y,
    state: 'to_node',
    cargoType: null,
    cargoAmount: 0,
    propellerAngle: 0,
  };
  engine.drones.push(drone);
  return { drill, drone };
}

export function makeEnemy(type: EnemyType, x: number, y: number, hp = 100): EnemyEntity {
  const radius = type === 'behemoth' ? 34 : type === 'goliath' ? 19 : type === 'spitter' ? 14 : 12;
  return {
    id: nextId('enm'),
    type,
    x,
    y,
    hp,
    maxHp: hp,
    speed: 68,
    radius,
    legPhase: 0,
    attackCooldown: 0,
    stunTimer: 0,
    hitFlash: 0,
    angle: 0,
  };
}

/** Run updateDrones/updateProjectiles-style ticks with a fixed step. */
export function tick(fn: (dt: number) => void, seconds: number, dt = 0.05): void {
  for (let t = 0; t < seconds; t += dt) fn(dt);
}