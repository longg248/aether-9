import { afterEach, describe, expect, it } from 'vitest';
import { HUB_GX, HUB_GY, TARGET_WARP_AETHER } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { BuildingType, GameStatus } from '@/types/game';

/** Deterministic PRNG so the whole simulation is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const originalRandom = Math.random;
afterEach(() => {
  Math.random = originalRandom;
});

/** First buildable tile in the revealed hub area (deterministic scan). */
function placeNearHub(engine: AetherGameEngine, type: BuildingType): boolean {
  for (let r = 2; r <= 7; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const gx = HUB_GX + dx;
        const gy = HUB_GY + dy;
        if (engine.canBuildAt(gx, gy, type).ok) {
          return engine.placeBuilding(gx, gy, type);
        }
      }
    }
  }
  return false;
}

/**
 * Scripted "competent player": keeps the grid powered, expands drills onto
 * revealed nodes, builds smelter/lab/turrets, buys upgrades in a sensible
 * priority, and pilots the rover to pods and aether-rich nodes.
 */
function playTick(engine: AetherGameEngine): void {
  const res = engine.resources;

  // Rover: collect pods first, then mine (aether preferred once phase 2+).
  const pod = engine.crashPods.find((p) => !p.opened);
  if (pod) {
    engine.rover.moveTarget = { x: pod.x, y: pod.y };
  } else {
    const pool = engine.nodes.filter((n) => n.amount > 0);
    const aetherNodes = pool.filter((n) => n.type === 'aether');
    const candidates = engine.phaseIndex >= 1 && aetherNodes.length > 0 ? aetherNodes : pool;
    let best = null as (typeof candidates)[number] | null;
    let bestDist = Infinity;
    for (const n of candidates) {
      const d = Math.hypot(n.x - engine.rover.x, n.y - engine.rover.y);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    if (best) engine.rover.moveTarget = { x: best.x, y: best.y };
  }

  // Power: keep efficiency at 100%.
  if (engine.getEnergyStats().efficiency < 1) placeNearHub(engine, 'solar');

  // Drills: expand onto revealed, unoccupied nodes (nearest first).
  const drillCount = engine.buildings.filter((b) => b.type === 'drill').length;
  const desiredDrills = Math.min(8, 2 + Math.floor(engine.elapsed / 100));
  if (drillCount < desiredDrills) {
    const drilled = new Set(
      engine.buildings.filter((b) => b.type === 'drill').map((b) => b.linkedNodeId)
    );
    const free = engine.nodes
      .filter((n) => n.amount > 0 && !drilled.has(n.id))
      .sort(
        (a, b) =>
          Math.hypot(a.x - engine.rover.x, a.y - engine.rover.y) -
          Math.hypot(b.x - engine.rover.x, b.y - engine.rover.y)
      );
    for (const n of free) {
      if (engine.canBuildAt(n.gx, n.gy, 'drill').ok) {
        engine.placeBuilding(n.gx, n.gy, 'drill');
        break;
      }
    }
  }

  // Production & defense.
  const has = (t: BuildingType) => engine.buildings.some((b) => b.type === t);
  if (!has('smelter') && engine.elapsed > 60) placeNearHub(engine, 'smelter');
  if (!has('lab') && engine.elapsed > 180 && res.aether >= 25) placeNearHub(engine, 'lab');
  const turretCount = engine.buildings.filter((b) => b.type === 'turret').length;
  if (turretCount < Math.min(4, 1 + engine.waveCount)) placeNearHub(engine, 'turret');
  if (!has('repair_bay') && engine.elapsed > 400 && res.aether >= 15) placeNearHub(engine, 'repair_bay');

  // Upgrades in progression priority (buyUpgrade validates everything).
  for (const id of ['rover_laser', 'drone_logistics', 'turret_optics', 'shield_matrix', 'aether_capacitor']) {
    engine.buyUpgrade(id);
  }
}

// Measured baselines (seed 20261117, dt 0.05, the scripted policy below):
// - Competent bot: victory at ~175s with hubHp ~300 after 1 wave. This is a
//   LOWER bound: the bot has full map knowledge (no fog-of-war exploration)
//   and perfect micro; human runs are longer.
// - Idle player: gameover at ~322s after 3 waves — defense is mandatory.
// - Stress (separate measurement): 30 drones / 60 enemies / 90 buildings
//   ≈ 2ms per update step in jsdom, far inside the 16.6ms frame budget.
describe('balance: full gameplay loop simulation (seeded, deterministic)', () => {
  it('a competent player reaches 1,200 Aether victory within ~30 minutes', () => {
    Math.random = mulberry32(20261117);
    const engine = new AetherGameEngine();
    engine.status = 'playing' as GameStatus; // widened: the loop mutates status

    const dt = 0.05;
    let victoryAt = -1;
    for (let step = 0; step < 1800 / dt; step++) {
      if (step % 20 === 0) playTick(engine); // player decisions once per second
      engine.update(dt);

      // Invariants: economy never goes negative at any point of the loop.
      expect(engine.resources.silicate).toBeGreaterThanOrEqual(0);
      expect(engine.resources.iron).toBeGreaterThanOrEqual(0);
      expect(engine.resources.aether).toBeGreaterThanOrEqual(0);

      if (engine.status === 'victory') {
        victoryAt = engine.elapsed;
        break;
      }
      if (engine.status === 'gameover') break;
    }

    expect(engine.status).toBe('victory');
    expect(engine.warpProgress).toBe(TARGET_WARP_AETHER);
    // The bot has full map knowledge and perfect micro, so ~3 min is a LOWER
    // bound; human runs include exploration and defense management. The upper
    // bound guards against excessive grinding.
    expect(victoryAt).toBeGreaterThan(120); // requires a real economic ramp-up
    expect(victoryAt).toBeLessThan(1800); // no excessive grind (~30 min cap)
    expect(engine.waveCount).toBeGreaterThanOrEqual(1); // faced real waves
    expect(engine.hubHp).toBeGreaterThan(0);
  }, 120000);

  it('an idle player loses: waves are a real threat, not decoration', () => {
    Math.random = mulberry32(20261117);
    const engine = new AetherGameEngine();
    engine.status = 'playing' as GameStatus; // widened: the loop mutates status

    const dt = 0.05;
    for (let step = 0; step < 900 / dt; step++) {
      engine.update(dt);
      if (engine.status !== 'playing') break;
    }

    expect(engine.status).toBe('gameover');
    expect(engine.hubHp).toBe(0);
    expect(engine.elapsed).toBeLessThan(900);
  }, 60000);

  it('the same seed reproduces the same run (balance measurements are stable)', () => {
    const runOnce = () => {
      Math.random = mulberry32(424242);
      const engine = new AetherGameEngine();
      engine.status = 'playing' as GameStatus; // widened: the loop mutates status
      for (let step = 0; step < 300 / 0.05; step++) {
        if (step % 20 === 0) playTick(engine);
        engine.update(0.05);
        if (engine.status !== 'playing') break;
      }
      return {
        elapsed: engine.elapsed,
        warp: engine.warpProgress,
        silicate: engine.resources.silicate,
        iron: engine.resources.iron,
        aether: engine.resources.aether,
        waves: engine.waveCount,
        buildings: engine.buildings.length,
      };
    };
    expect(runOnce()).toEqual(runOnce());
  }, 60000);
});