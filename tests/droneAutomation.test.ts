import { describe, expect, it } from 'vitest';
import { updateDrones } from '@/engine/systems/droneSystem';
import { makeBuilding, makeDrillWithDrone, makeEngine, makeNode, tick } from './helpers';

const run = (engine: ReturnType<typeof makeEngine>, seconds: number) =>
  tick((dt) => updateDrones(engine, dt, 1), seconds);

describe('drone automation: task reassignment after depletion', () => {
  it('a depleted-home drone hauls the nearest free node until it is exhausted', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    makeDrillWithDrone(engine, home);
    const free = makeNode('silicate', 28, 22, 100);
    engine.nodes.push(free);

    run(engine, 60);

    expect(engine.resources.silicate).toBe(90 + 100); // exact-once, full node
    expect(free.amount).toBe(0);
  });

  it('prefers the nearest free node to reduce unnecessary movement', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    const { drone } = makeDrillWithDrone(engine, home);
    const near = makeNode('iron', 26, 22, 100);
    const far = makeNode('iron', 34, 22, 100);
    engine.nodes.push(far, near); // far first: selection must not depend on array order

    updateDrones(engine, 0.05, 1);

    expect(drone.targetNodeId).toBe(near.id);
  });

  it('keeps working the drill node first when it still has resources', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 50);
    const { drone } = makeDrillWithDrone(engine, home);
    const free = makeNode('iron', 25, 22, 100); // closer than home would be irrelevant
    engine.nodes.push(free);

    updateDrones(engine, 0.05, 1);

    expect(drone.targetNodeId ?? null).toBeNull(); // no external reservation
    expect(free.amount).toBe(100); // untouched while home is productive
  });

  it('idles at the drill when no free node exists anywhere', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    const { drill, drone } = makeDrillWithDrone(engine, home);
    const claimed = makeNode('iron', 30, 22, 100);
    engine.nodes.push(claimed);
    makeDrillWithDrone(engine, claimed); // second drill owns the only free node

    run(engine, 10);

    expect(drone.state).toBe('idle');
    expect(Math.hypot(drone.x - drill.x, drone.y - drill.y)).toBeLessThanOrEqual(12);
    expect(claimed.amount).toBeGreaterThan(0); // first drone may mine it, never below 0
    expect(claimed.amount).toBeGreaterThanOrEqual(0);
  });
});

describe('drone automation: task reservations', () => {
  it('two idle drones never claim the same free node', () => {
    const engine = makeEngine();
    const homeA = makeNode('silicate', 24, 22, 0);
    const homeB = makeNode('silicate', 24, 26, 0);
    const { drone: a } = makeDrillWithDrone(engine, homeA);
    const { drone: b } = makeDrillWithDrone(engine, homeB);
    const free = makeNode('iron', 28, 22, 10); // single cargo load
    engine.nodes.push(free);

    run(engine, 3); // claimant is loaded and still flying to the Hub

    const claimants = engine.drones.filter((d) => d.targetNodeId === free.id);
    expect(claimants).toHaveLength(1);
    const other = claimants[0] === a ? b : a;
    expect(other.state).toBe('idle');
    // Conservation: the single load is either in cargo or delivered, never both.
    const delivered = engine.resources.iron - 45;
    expect(delivered + free.amount + a.cargoAmount + b.cargoAmount).toBe(10);

    run(engine, 10); // settle: the load is delivered exactly once
    expect(engine.resources.iron).toBe(45 + 10);
  });

  it('a reservation is released when the drone retires, freeing the node', () => {
    const engine = makeEngine();
    const homeA = makeNode('silicate', 24, 22, 0);
    const homeB = makeNode('silicate', 24, 26, 0);
    const { drone: a } = makeDrillWithDrone(engine, homeA);
    const { drill: drillB, drone: b } = makeDrillWithDrone(engine, homeB);
    const free = makeNode('iron', 28, 22, 100);
    engine.nodes.push(free);

    run(engine, 2); // reverse iteration: drone B claims the node first
    expect(b.targetNodeId).toBe(free.id);
    drillB.hp = 0; // destroyed: B must retire and release its claim
    run(engine, 30);

    expect(engine.drones).toHaveLength(1);
    expect(a.targetNodeId).toBe(free.id); // A picked up the released task
    expect(free.amount).toBeLessThan(100);
  });

  it('a hauler yields its reserved node when a new drill is built on it', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    const { drone } = makeDrillWithDrone(engine, home);
    const free = makeNode('iron', 28, 22, 100);
    engine.nodes.push(free);

    updateDrones(engine, 0.05, 1);
    expect(drone.targetNodeId).toBe(free.id);

    const newDrill = makeBuilding('drill', free.gx, free.gy, 180);
    newDrill.linkedNodeId = free.id;
    engine.buildings.push(newDrill);

    updateDrones(engine, 0.05, 1);

    expect(drone.targetNodeId ?? null).toBeNull(); // drill claim wins
    expect(drone.state).toBe('idle');
  });

  it('a depleted reserved node is released so another drone can take it after refill', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    const { drone } = makeDrillWithDrone(engine, home);
    const free = makeNode('iron', 28, 22, 10); // exactly one load
    engine.nodes.push(free);

    run(engine, 15); // takes the load, delivers, returns to idle
    expect(engine.resources.iron).toBe(45 + 10);
    expect(drone.targetNodeId ?? null).toBeNull(); // stale claim cleared

    free.amount = 10; // node refilled (e.g. new survey): work resumes
    run(engine, 15);
    expect(engine.resources.iron).toBe(45 + 20);
  });
});

describe('drone automation: exact-once delivery under reassignment', () => {
  it('reassigned cargo is delivered exactly once even if the drill dies mid-flight', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    const { drill } = makeDrillWithDrone(engine, home);
    const free = makeNode('silicate', 28, 22, 100);
    engine.nodes.push(free);

    run(engine, 2); // drone reaches the free node and loads 10
    drill.hp = 0; // drill destroyed while the drone hauls
    run(engine, 60);

    expect(engine.resources.silicate).toBe(90 + 10); // only the loaded cargo
    expect(free.amount).toBe(90);
    expect(engine.drones).toHaveLength(0); // orphan retired after delivery
  });

  it('full reassignment loop conserves resources (node + cargo + delivered)', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    makeDrillWithDrone(engine, home);
    const free = makeNode('iron', 30, 24, 37); // not a multiple of cargo cap
    engine.nodes.push(free);

    run(engine, 90);

    const delivered = engine.resources.iron - 45;
    const cargo = engine.drones.reduce((s, d) => s + d.cargoAmount, 0);
    expect(delivered + free.amount + cargo).toBe(37);
    expect(delivered).toBe(37);
    expect(free.amount).toBe(0);
  });

  it('HUD reports drone automation states accurately', () => {
    const engine = makeEngine();
    const home = makeNode('silicate', 24, 22, 0);
    const { drone } = makeDrillWithDrone(engine, home);
    const free = makeNode('iron', 28, 22, 100);
    engine.nodes.push(free);

    run(engine, 2); // loaded and heading to the Hub
    expect(drone.cargoAmount).toBeGreaterThan(0);
    const hud = engine.getHudSnapshot();
    expect(hud.drones).toEqual({ total: 1, hauling: 1, idle: 0 });
  });
});