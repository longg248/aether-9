import { describe, expect, it } from 'vitest';
import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import { updateDrones } from '@/engine/systems/droneSystem';
import { makeDrillWithDrone, makeEngine, makeNode, tick } from './helpers';

const run = (engine: ReturnType<typeof makeEngine>, seconds: number) =>
  tick((dt) => updateDrones(engine, dt, 1), seconds);

describe('droneSystem: resource delivery', () => {
  it('mines a node and delivers resources to the Hub', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 19, 22, 450);
    const { drone } = makeDrillWithDrone(engine, node);
    const before = engine.resources.silicate;

    run(engine, 30);

    expect(engine.resources.silicate).toBeGreaterThan(before);
    expect(node.amount).toBeLessThan(450);
    expect(['to_node', 'to_hub', 'idle']).toContain(drone.state);
  });

  it('conserves resources across the full cycle (node + cargo + delivered)', () => {
    const engine = makeEngine();
    const node = makeNode('iron', 20, 22, 37); // not a multiple of drone cap
    const { drone } = makeDrillWithDrone(engine, node);
    const before = engine.resources.iron;

    run(engine, 60);

    const delivered = engine.resources.iron - before;
    expect(delivered + node.amount + drone.cargoAmount).toBe(37);
    expect(node.amount).toBe(0);
    expect(drone.cargoAmount).toBe(0);
    expect(delivered).toBe(37);
  });

  it('never overdraws a node below zero', () => {
    const engine = makeEngine();
    const node = makeNode('aether', 20, 22, 3); // smaller than one cargo load
    makeDrillWithDrone(engine, node);

    run(engine, 30);

    expect(node.amount).toBe(0);
    expect(engine.resources.aether).toBeGreaterThanOrEqual(3);
  });
});

describe('droneSystem: depleted nodes', () => {
  it('delivers cargo even when the node depletes mid-flight', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 19, 22, 10);
    const { drone } = makeDrillWithDrone(engine, node);
    drone.state = 'to_hub';
    drone.cargoType = 'silicate';
    drone.cargoAmount = 10;
    node.amount = 0;
    const before = engine.resources.silicate;

    run(engine, 30);

    expect(engine.resources.silicate).toBe(before + 10);
    expect(drone.cargoAmount).toBe(0);
    expect(drone.cargoType).toBeNull();
  });

  it('parks an empty drone at the drill instead of freezing mid-map', () => {
    const engine = makeEngine();
    const node = makeNode('iron', 18, 20, 0);
    const { drill, drone } = makeDrillWithDrone(engine, node);
    drone.x = drill.x + 300; // stranded away from the drill
    drone.y = drill.y + 300;

    run(engine, 20);

    expect(drone.state).toBe('idle');
    expect(Math.hypot(drone.x - drill.x, drone.y - drill.y)).toBeLessThanOrEqual(12);
    expect(engine.drones).toHaveLength(1); // kept, not orphaned
  });

  it('resumes work if an idle drone finds resources again', () => {
    const engine = makeEngine();
    const node = makeNode('iron', 20, 22, 0);
    const { drone } = makeDrillWithDrone(engine, node);

    run(engine, 5);
    expect(drone.state).toBe('idle');

    node.amount = 50;
    run(engine, 30);

    expect(engine.resources.iron).toBeGreaterThan(0);
  });

  it('does not duplicate delivery after the node is exhausted', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 20, 22, 10);
    makeDrillWithDrone(engine, node);

    run(engine, 30);
    const settled = engine.resources.silicate;
    run(engine, 30);

    expect(engine.resources.silicate).toBe(settled);
  });
});

describe('droneSystem: destroyed drills and orphans', () => {
  it('completes delivery then retires a drone whose drill was destroyed', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 19, 22, 100);
    const { drill, drone } = makeDrillWithDrone(engine, node);
    drone.state = 'to_hub';
    drone.cargoType = 'silicate';
    drone.cargoAmount = 10;
    engine.buildings = engine.buildings.filter((b) => b.id !== drill.id);
    const before = engine.resources.silicate;

    run(engine, 30);

    expect(engine.resources.silicate).toBe(before + 10);
    expect(engine.drones).toHaveLength(0);
  });

  it('does not lose cargo while still flying to the Hub after drill loss', () => {
    const engine = makeEngine();
    const node = makeNode('iron', 10, 10, 100);
    const { drone } = makeDrillWithDrone(engine, node);
    drone.state = 'to_hub';
    drone.cargoType = 'iron';
    drone.cargoAmount = 10;
    drone.x = node.x; // far from Hub
    drone.y = node.y;
    engine.buildings = [];
    const before = engine.resources.iron;

    updateDrones(engine, 0.05, 1); // one frame: must NOT be removed mid-flight

    expect(engine.drones).toHaveLength(1);
    expect(drone.cargoAmount).toBe(10);

    run(engine, 60);
    expect(engine.resources.iron).toBe(before + 10);
    expect(engine.drones).toHaveLength(0);
  });

  it('removes an empty orphaned drone', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 19, 22, 100);
    makeDrillWithDrone(engine, node);
    engine.buildings = [];

    run(engine, 1);

    expect(engine.drones).toHaveLength(0);
  });

  it('treats a drill with hp <= 0 as destroyed', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 19, 22, 100);
    const { drill } = makeDrillWithDrone(engine, node);
    drill.hp = 0; // still in array before cleanup filter runs

    run(engine, 1);

    expect(engine.drones).toHaveLength(0);
  });
});

describe('droneSystem: invalid state recovery', () => {
  it('recovers a drone carrying cargo while wrongly in to_node state', () => {
    const engine = makeEngine();
    const node = makeNode('aether', 20, 22, 100);
    const { drone } = makeDrillWithDrone(engine, node);
    drone.state = 'to_node'; // invalid: has cargo but heading to node
    drone.cargoType = 'aether';
    drone.cargoAmount = 7;
    node.amount = 0; // depleted: the 7 cargo is the only possible delivery
    const before = engine.resources.aether;

    run(engine, 30);

    // Exact-once delivery: not "at least 7", which would mask duplicates.
    expect(engine.resources.aether).toBe(before + 7);
    expect(drone.cargoAmount).toBe(0);
    expect(drone.cargoType).toBeNull();

    run(engine, 30); // keep simulating: nothing more may be delivered
    expect(engine.resources.aether).toBe(before + 7);
    expect(drone.state).toBe('idle');
  });

  it('handles a to_hub drone with no cargo without delivering phantom resources', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 20, 22, 100);
    const { drone } = makeDrillWithDrone(engine, node);
    drone.state = 'to_hub';
    drone.cargoType = null;
    drone.cargoAmount = 0;
    drone.x = HUB_X;
    drone.y = HUB_Y;
    const before = { ...engine.resources };

    updateDrones(engine, 0.05, 1);

    expect(engine.resources).toEqual(before);
    expect(drone.state).toBe('to_node');
  });
});