import { describe, expect, it } from 'vitest';
import { HUB_GX, HUB_GY, HUB_X, HUB_Y } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { OBJECTIVES } from '@/engine/systems/objectiveSystem';
import {
  DEPOSIT_AMOUNT,
  NEST_AMBUSH_RADIUS,
  getActivatedRelays,
} from '@/engine/systems/poiSystem';
import { PoiType } from '@/types/game';
import { isTileRevealed } from '@/utils/proceduralTerrain';
import { tick } from './helpers';

/**
 * Full-loop gameplay flows: the real engine.update() runs every system
 * (rover, POIs, combat, buildings, drones, warp, objectives) — no mocks.
 * Waves/storms/pods are deferred so only the POI flow under test is active.
 */
function makeLiveEngine(): AetherGameEngine {
  const engine = new AetherGameEngine();
  engine.status = 'playing';
  engine.waveTimer = 9999;
  engine.stormTimer = 9999;
  engine.podTimer = 9999;
  return engine;
}

const poiOf = (engine: AetherGameEngine, type: PoiType) =>
  engine.pois.find((p) => p.type === type)!;

describe('Aether deposit: discovery → drill → drone mining → delivery', () => {
  it('mines the finite node through the real economy, exactly-once delivery', () => {
    const engine = makeLiveEngine();
    const deposit = poiOf(engine, 'aether_deposit');
    const node = engine.nodes.find((n) => n.id === `node_${deposit.id}`)!;
    expect(node.amount).toBe(DEPOSIT_AMOUNT);

    // Rover reveals the tile; the drill is placed before any mining tick.
    engine.rover.x = deposit.x;
    engine.rover.y = deposit.y;
    expect(engine.placeBuilding(deposit.gx, deposit.gy, 'drill')).toBe(true);
    const drill = engine.buildings.find((b) => b.type === 'drill')!;
    expect(drill.linkedNodeId).toBe(node.id);
    const drone = engine.drones.find((d) => d.drillId === drill.id)!;
    expect(drone).toBeDefined();

    // Isolate the drone economy: the rover's hand-laser must not mine during
    // this flow (random nodes can sit within its 95px auto-mining range).
    engine.rover.mineCooldown = 1e6;
    engine.update(0.05); // discovery tick
    expect(deposit.discovered).toBe(true);
    const aetherAfterDiscovery = engine.resources.aether; // stays 0

    // Park the rover at the Hub and keep only the deposit node: from here on
    // every Aether unit must come from the drone's hauls.
    engine.rover.x = HUB_X;
    engine.rover.y = HUB_Y;
    engine.nodes = engine.nodes.filter((n) => n.id === node.id);

    tick((dt) => engine.update(dt), 90);

    const delivered = engine.resources.aether - aetherAfterDiscovery;
    expect(delivered).toBeGreaterThanOrEqual(10); // at least one drone haul
    expect(delivered % 10).toBe(0); // drone cargo cap is 10 per trip
    expect(node.amount).toBeLessThan(DEPOSIT_AMOUNT);
    // Conservation of the deposit itself: node + drone hauls + in-flight
    // cargo = 420. Any duplicated delivery would break this equality.
    const cargo = drone.cargoType === 'aether' ? drone.cargoAmount : 0;
    expect(node.amount + delivered + cargo).toBe(DEPOSIT_AMOUNT);
    expect(engine.warpProgress).toBe(0); // below the 150 reserve: no warp charge
    expect(drill.hp).toBeGreaterThan(0);
  });
});

describe('Signal relay: interaction, reward, permanent reveal', () => {
  it('channels to completion, grants +10 Aether once, and keeps the area buildable', () => {
    const engine = makeLiveEngine();
    engine.nodes = []; // isolate: no rover auto-mining income
    engine.objectiveIndex = OBJECTIVES.length; // isolate: no objective rewards
    const relay = poiOf(engine, 'signal_relay');
    // A tile 2 tiles further from the Hub than the relay: outside the Hub's
    // 7.5-tile reveal, inside the relay's 8.5-tile reveal once activated.
    const dx = Math.sign(relay.gx - HUB_GX) || 1;
    const dy = Math.sign(relay.gy - HUB_GY) || 1;
    const far = { gx: relay.gx + dx * 2, gy: relay.gy + dy * 2 };
    expect(isTileRevealed(far.gx, far.gy, HUB_X, HUB_Y, engine.buildings)).toBe(false);
    expect(engine.canBuildAt(far.gx, far.gy, 'solar').ok).toBe(false);

    engine.rover.x = relay.x;
    engine.rover.y = relay.y;
    const aetherBefore = engine.resources.aether;
    tick((dt) => engine.update(dt), 4.5); // channelTime 4s
    expect(relay.completed).toBe(true);
    expect(engine.resources.aether).toBe(aetherBefore + 10);
    expect(getActivatedRelays(engine.pois)).toHaveLength(1);

    tick((dt) => engine.update(dt), 5); // linger: reward never repeats
    expect(engine.resources.aether).toBe(aetherBefore + 10);

    // Rover returns to the Hub: the relay keeps the area revealed/buildable.
    engine.rover.x = HUB_X;
    engine.rover.y = HUB_Y;
    engine.update(0.05);
    const relays = getActivatedRelays(engine.pois);
    expect(isTileRevealed(far.gx, far.gy, HUB_X, HUB_Y, engine.buildings, relays)).toBe(true);
    expect(engine.canBuildAt(far.gx, far.gy, 'solar').ok).toBe(true);
  });
});

describe('Crystal nest: one-time ambush, real combat, guarded harvest', () => {
  it('ambushes once, guards die to EMP + rover laser, then harvest pays +40 once', () => {
    const engine = makeLiveEngine();
    engine.nodes = []; // isolate: no mining income
    const nest = poiOf(engine, 'crystal_nest');
    engine.rover.x = nest.x;
    engine.rover.y = nest.y;

    engine.update(0.05);
    expect(nest.ambushSpawned).toBe(true);
    expect(nest.guardIds).toHaveLength(4);
    expect(engine.enemies).toHaveLength(4);

    // Harvest is blocked while any guard lives.
    tick((dt) => engine.update(dt), 0.5);
    expect(nest.completed).toBe(false);
    expect(nest.progress).toBe(0);

    // Real combat: EMP (55 dmg + 3.2s stun) kills the swarmers and stuns the
    // goliath; the rover's auto-laser (22 dmg / 0.34s) finishes it in range.
    engine.triggerEmp();
    tick((dt) => engine.update(dt), 4);
    expect(nest.guardsCleared).toBe(true);
    expect(engine.enemies).toHaveLength(0);

    const aetherBefore = engine.resources.aether; // after guard death drops
    tick((dt) => engine.update(dt), 3.5); // channelTime 3s
    expect(nest.completed).toBe(true);
    expect(engine.resources.aether).toBe(aetherBefore + 40);

    // Linger: no second ambush, no repeat harvest.
    tick((dt) => engine.update(dt), 5);
    expect(engine.resources.aether).toBe(aetherBefore + 40);
    expect(engine.enemies).toHaveLength(0);
    expect(nest.ambushSpawned).toBe(true);
  });
});

describe('POI state after reset', () => {
  it('reset restores fresh POIs, deposit nodes, economy and objective chain', () => {
    const engine = makeLiveEngine();
    const layout = engine.pois.map((p) => [p.id, p.gx, p.gy]);

    // Progress the world: complete a relay, drill a deposit, spring a nest.
    const relay = poiOf(engine, 'signal_relay');
    engine.rover.x = relay.x;
    engine.rover.y = relay.y;
    tick((dt) => engine.update(dt), 4.5);
    expect(relay.completed).toBe(true);

    const deposit = poiOf(engine, 'aether_deposit');
    engine.rover.x = deposit.x;
    engine.rover.y = deposit.y;
    engine.update(0.05);
    expect(engine.placeBuilding(deposit.gx, deposit.gy, 'drill')).toBe(true);

    const nest = poiOf(engine, 'crystal_nest');
    engine.rover.x = nest.x + NEST_AMBUSH_RADIUS - 30;
    engine.rover.y = nest.y;
    engine.update(0.05);
    expect(nest.ambushSpawned).toBe(true);
    expect(engine.enemies.length).toBeGreaterThanOrEqual(4);
    expect(engine.resources.aether).toBeGreaterThan(0);

    engine.reset();

    // Same seeded layout, but every POI is pristine again.
    expect(engine.pois.map((p) => [p.id, p.gx, p.gy])).toEqual(layout);
    for (const p of engine.pois) {
      expect(p.discovered).toBe(false);
      expect(p.completed).toBe(false);
      expect(p.progress).toBe(0);
      expect(p.ambushSpawned).toBe(false);
      expect(p.guardIds).toEqual([]);
      expect(p.guardsCleared).toBe(false);
    }
    expect(getActivatedRelays(engine.pois)).toHaveLength(0);
    for (const p of engine.pois.filter((p) => p.type === 'aether_deposit')) {
      const n = engine.nodes.find((n) => n.id === `node_${p.id}`)!;
      expect(n.amount).toBe(DEPOSIT_AMOUNT); // finite deposits refilled
    }
    expect(engine.resources).toEqual({ silicate: 90, iron: 45, aether: 0 });
    expect(engine.buildings).toEqual([]);
    expect(engine.drones).toEqual([]);
    expect(engine.enemies).toEqual([]);
    expect(engine.objectiveIndex).toBe(0);
    expect(engine.warpProgress).toBe(0);
  });
});