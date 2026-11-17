import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRID_SIZE, HUB_GX, HUB_GY, TILE_SIZE, WORLD_SEED } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { updateEnemies } from '@/engine/systems/enemySystem';
import {
  DEPOSIT_AMOUNT,
  NEST_AMBUSH_RADIUS,
  POI_MIN_HUB_DIST,
  POI_MIN_SEPARATION,
  POI_PLAN,
  createDepositNodes,
  generatePOIs,
  getActivatedRelays,
  updatePOIs,
} from '@/engine/systems/poiSystem';
import { PoiEntity, PoiType } from '@/types/game';
import { generateResourceNodes, isTileRevealed } from '@/utils/proceduralTerrain';
import { makeEngine, tick } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

let poiUid = 0;
function makePoi(type: PoiType, gx: number, gy: number): PoiEntity {
  return {
    id: `poi_test_${poiUid++}`,
    type,
    gx,
    gy,
    x: (gx + 0.5) * TILE_SIZE,
    y: (gy + 0.5) * TILE_SIZE,
    discovered: false,
    progress: 0,
    completed: false,
    ambushSpawned: false,
    guardIds: [],
    guardsCleared: false,
    beaconPhase: 0,
  };
}

describe('POI generation: deterministic from the world seed', () => {
  it('same seed produces identical POIs', () => {
    const a = generatePOIs(WORLD_SEED);
    const b = generatePOIs(WORLD_SEED);
    expect(a).toEqual(b);
    expect(a.length).toBe(POI_PLAN.reduce((sum, p) => sum + p.count, 0));
  });

  it('different seeds produce different layouts', () => {
    const a = generatePOIs(1);
    const b = generatePOIs(2);
    expect(a.map((p) => `${p.gx},${p.gy}`)).not.toEqual(b.map((p) => `${p.gx},${p.gy}`));
  });

  it('engine resets regenerate the same seeded POI layout', () => {
    const e1 = new AetherGameEngine();
    const e2 = new AetherGameEngine();
    expect(e1.pois.map((p) => [p.id, p.gx, p.gy])).toEqual(e2.pois.map((p) => [p.id, p.gx, p.gy]));
    e1.reset();
    expect(e1.pois.map((p) => [p.id, p.gx, p.gy])).toEqual(e2.pois.map((p) => [p.id, p.gx, p.gy]));
  });
});

describe('POI placement: never invalid or overlapping', () => {
  it('all POIs stay inside the grid margin and outside the Hub zone', () => {
    for (const poi of generatePOIs()) {
      expect(poi.gx).toBeGreaterThanOrEqual(3);
      expect(poi.gy).toBeGreaterThanOrEqual(3);
      expect(poi.gx).toBeLessThanOrEqual(GRID_SIZE - 4);
      expect(poi.gy).toBeLessThanOrEqual(GRID_SIZE - 4);
      expect(Math.hypot(poi.gx - HUB_GX, poi.gy - HUB_GY)).toBeGreaterThanOrEqual(POI_MIN_HUB_DIST);
    }
  });

  it('resource nodes never spawn on POI tiles (mining economy untouched)', () => {
    for (let run = 0; run < 5; run++) {
      const pois = generatePOIs();
      const poiTiles = new Set(pois.map((p) => `${p.gx},${p.gy}`));
      for (const node of generateResourceNodes(pois)) {
        expect(poiTiles.has(`${node.gx},${node.gy}`)).toBe(false);
      }
    }
  });

  it('POIs never overlap each other', () => {
    const pois = generatePOIs();
    for (let i = 0; i < pois.length; i++) {
      for (let j = i + 1; j < pois.length; j++) {
        const sep = Math.max(Math.abs(pois[i].gx - pois[j].gx), Math.abs(pois[i].gy - pois[j].gy));
        expect(sep).toBeGreaterThanOrEqual(POI_MIN_SEPARATION);
      }
    }
  });

  it('non-drill buildings are blocked on POI tiles; deposits accept drills', () => {
    const engine = makeEngine();
    const station = makePoi('research_station', 30, 22);
    const deposit = makePoi('aether_deposit', 30, 26);
    engine.pois = [station, deposit];
    engine.nodes = createDepositNodes(engine.pois);
    engine.resources = { silicate: 500, iron: 500, aether: 500 };
    // Reveal both tiles by standing the rover on them.
    engine.rover.x = station.x;
    engine.rover.y = station.y;
    expect(engine.canBuildAt(30, 22, 'solar').ok).toBe(false);
    expect(engine.canBuildAt(30, 22, 'wall').ok).toBe(false);

    engine.rover.x = deposit.x;
    engine.rover.y = deposit.y;
    expect(engine.canBuildAt(30, 26, 'drill').ok).toBe(true);
    expect(engine.canBuildAt(30, 26, 'solar').ok).toBe(false); // ore tile rule
  });

  it('deposit nodes are finite aether nodes usable by the existing economy', () => {
    const deposit = makePoi('aether_deposit', 30, 26);
    const nodes = createDepositNodes([deposit]);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe('aether');
    expect(nodes[0].amount).toBe(DEPOSIT_AMOUNT);
    expect(nodes[0].maxAmount).toBe(DEPOSIT_AMOUNT);
    expect(nodes[0].gx).toBe(30);
    expect(nodes[0].gy).toBe(26);
  });
});

describe('POI discovery and interaction', () => {
  it('discovery fires once when the rover reveals the tile', () => {
    const engine = makeEngine();
    const poi = makePoi('supply_cache', 30, 22);
    engine.pois = [poi];
    engine.rover.x = poi.x;
    engine.rover.y = poi.y;

    updatePOIs(engine, 0.05);
    expect(poi.discovered).toBe(true);
    const logsAfterDiscovery = engine.logs.length;

    tick((dt) => updatePOIs(engine, dt), 1);
    expect(engine.logs.length).toBeLessThanOrEqual(logsAfterDiscovery + 1); // completion log at most
    expect(poi.discovered).toBe(true);
  });

  it('supply cache channels to completion and grants its reward exactly once', () => {
    const engine = makeEngine();
    const poi = makePoi('supply_cache', 30, 22);
    engine.pois = [poi];
    engine.rover.x = poi.x;
    engine.rover.y = poi.y;
    const before = { ...engine.resources };

    tick((dt) => updatePOIs(engine, dt), 3); // channelTime 2.5s
    expect(poi.completed).toBe(true);
    expect(engine.resources.silicate).toBe(before.silicate + 70);
    expect(engine.resources.iron).toBe(before.iron + 50);

    tick((dt) => updatePOIs(engine, dt), 5); // linger: no repeat reward
    expect(engine.resources.silicate).toBe(before.silicate + 70);
    expect(engine.resources.iron).toBe(before.iron + 50);
  });

  it('research station restoration grants +45 Aether +25 Iron once', () => {
    const engine = makeEngine();
    const poi = makePoi('research_station', 30, 22);
    engine.pois = [poi];
    engine.rover.x = poi.x;
    engine.rover.y = poi.y;
    const aetherBefore = engine.resources.aether;
    const ironBefore = engine.resources.iron;

    tick((dt) => updatePOIs(engine, dt), 5.5);
    expect(poi.completed).toBe(true);
    expect(engine.resources.aether).toBe(aetherBefore + 45);
    expect(engine.resources.iron).toBe(ironBefore + 25);

    tick((dt) => updatePOIs(engine, dt), 6);
    expect(engine.resources.aether).toBe(aetherBefore + 45);
  });

  it('channeling only progresses while the rover is nearby', () => {
    const engine = makeEngine();
    const poi = makePoi('signal_relay', 30, 22);
    engine.pois = [poi];
    engine.rover.x = poi.x + 400; // far away
    engine.rover.y = poi.y;

    tick((dt) => updatePOIs(engine, dt), 3);
    expect(poi.progress).toBe(0);
    expect(poi.completed).toBe(false);
  });

  it('activated relay permanently reveals its surroundings', () => {
    const engine = makeEngine();
    const relay = makePoi('signal_relay', 35, 35);
    engine.pois = [relay];
    const farTile = { gx: 35, gy: 33 };
    // Far from Hub/rover: unrevealed before activation.
    expect(isTileRevealed(farTile.gx, farTile.gy, engine.rover.x, engine.rover.y, engine.buildings)).toBe(false);

    engine.rover.x = relay.x;
    engine.rover.y = relay.y;
    tick((dt) => updatePOIs(engine, dt), 4.5); // channelTime 4s
    expect(relay.completed).toBe(true);
    expect(getActivatedRelays(engine.pois)).toHaveLength(1);

    // Rover leaves; the relay keeps the area revealed and buildable.
    engine.rover.x = 500;
    engine.rover.y = 500;
    const relays = getActivatedRelays(engine.pois);
    expect(isTileRevealed(farTile.gx, farTile.gy, engine.rover.x, engine.rover.y, engine.buildings, relays)).toBe(true);
    engine.resources.silicate = 100;
    expect(engine.canBuildAt(farTile.gx, farTile.gy, 'solar').ok).toBe(true);
  });
});

describe('crystal nest: telegraphed danger, guarded harvest', () => {
  it('approach triggers a one-time ambush with standard-stat guards', () => {
    const engine = makeEngine();
    const nest = makePoi('crystal_nest', 30, 22);
    engine.pois = [nest];
    engine.rover.x = nest.x + NEST_AMBUSH_RADIUS - 20;
    engine.rover.y = nest.y;

    updatePOIs(engine, 0.05);
    expect(nest.ambushSpawned).toBe(true);
    expect(nest.guardIds).toHaveLength(4);
    const guards = engine.enemies.filter((e) => nest.guardIds.includes(e.id));
    expect(guards.filter((e) => e.type === 'swarmer')).toHaveLength(3);
    expect(guards.filter((e) => e.type === 'goliath')).toHaveLength(1);
    expect(guards.find((e) => e.type === 'swarmer')?.maxHp).toBe(55);
    expect(guards.find((e) => e.type === 'goliath')?.maxHp).toBe(220);

    tick((dt) => updatePOIs(engine, dt), 2); // staying close: no second ambush
    expect(engine.enemies.filter((e) => nest.guardIds.includes(e.id))).toHaveLength(4);
  });

  it('cannot be harvested while guards live; harvestable once they die', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // no random aether drops
    const engine = makeEngine();
    const nest = makePoi('crystal_nest', 30, 22);
    engine.pois = [nest];
    engine.rover.x = nest.x;
    engine.rover.y = nest.y;

    tick((dt) => updatePOIs(engine, dt), 1);
    expect(nest.ambushSpawned).toBe(true);
    expect(nest.completed).toBe(false); // guards alive: no progress
    expect(nest.progress).toBe(0);

    // Guards are killed by the player (standard death cleanup).
    for (const e of engine.enemies) e.hp = 0;
    updateEnemies(engine, 0.05);
    updatePOIs(engine, 0.05);
    expect(nest.guardsCleared).toBe(true);

    const aetherBefore = engine.resources.aether;
    tick((dt) => updatePOIs(engine, dt), 3.5); // channelTime 3s
    expect(nest.completed).toBe(true);
    expect(engine.resources.aether).toBe(aetherBefore + 40);

    tick((dt) => updatePOIs(engine, dt), 4); // no repeat harvest
    expect(engine.resources.aether).toBe(aetherBefore + 40);
  });

  it('guards are real enemies: they target the Hub like wave enemies', () => {
    const engine = makeEngine();
    const nest = makePoi('crystal_nest', 22, 14); // north of the Hub
    engine.pois = [nest];
    engine.rover.x = nest.x;
    engine.rover.y = nest.y;
    updatePOIs(engine, 0.05);

    const guard = engine.enemies[0];
    const y0 = guard.y;
    tick((dt) => updateEnemies(engine, dt), 2);
    expect(guard.y).toBeGreaterThan(y0); // advances toward the Hub
  });
});