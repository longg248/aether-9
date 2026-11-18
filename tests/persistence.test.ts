import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WORLD_SEED } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { applySave, serializeGame } from '@/engine/persistence/saveGame';
import { createInitialResources } from '@/engine/gameState';
import { createEnemy } from '@/engine/systems/enemySystem';
import { mulberry32 } from '@/utils/random';
import { makeBuilding } from './helpers';

function normalized(save: ReturnType<typeof serializeGame>) {
  return { ...save, savedAt: 0 };
}

function makeActiveEngine(): AetherGameEngine {
  const engine = new AetherGameEngine(WORLD_SEED);
  engine.status = 'playing';
  engine.resources = { silicate: 999, iron: 999, aether: 300 };
  engine.waveTimer = 9999;
  engine.stormTimer = 9999;
  engine.podTimer = 9999;

  const node = engine.nodes.find((candidate) => candidate.type === 'silicate')!;
  engine.rover.x = node.x;
  engine.rover.y = node.y;
  expect(engine.placeBuilding(node.gx, node.gy, 'drill')).toBe(true);
  engine.buildings.push(makeBuilding('lab', 20, 20, 300));
  const enemy = createEnemy(engine, 'swarmer', node.x + 80, node.y, 1.5, true);
  engine.crashPods.push({
    id: 'pod_save_test',
    gx: node.gx,
    gy: node.gy,
    x: node.x + 20,
    y: node.y,
    progress: 0.25,
    opened: false,
    beaconPhase: 1.5,
  });
  const poi = engine.pois[0];
  poi.discovered = true;
  poi.progress = 0.4;
  poi.ambushSpawned = true;
  poi.guardIds = [enemy.id];
  engine.upgrades.aether_capacitor = 2;
  for (let i = 0; i < 100; i++) engine.update(0.05);
  return engine;
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('save/load persistence', () => {
  it('round-trips the HUD and reproduces identical seeded behavior after more ticks', () => {
    Math.random = mulberry32(123456);
    const engine = makeActiveEngine();
    const save = serializeGame(engine);
    const hudBefore = engine.getHudSnapshot();
    const fresh = new AetherGameEngine(999, 'hard');
    const runIdBefore = fresh.runId;

    const result = applySave(fresh, save);
    expect(result.ok).toBe(true);
    expect(fresh.runId).toBe(runIdBefore + 1);
    expect(fresh.random.worldSeed).toBe(WORLD_SEED);
    expect(fresh.difficulty).toBe('normal');
    expect(fresh.getHudSnapshot()).toEqual(hudBefore);
    expect(normalized(serializeGame(fresh))).toEqual(normalized(save));
    expect(fresh.particles).toHaveLength(0);
    expect(fresh.lasers).toHaveLength(0);
    expect(fresh.lightnings).toHaveLength(0);
    expect(fresh.floatingTexts).toHaveLength(0);
    expect(fresh.tireTracks).toHaveLength(0);

    const advance = (target: AetherGameEngine) => {
      Math.random = mulberry32(987654);
      for (let i = 0; i < 400; i++) target.update(0.05);
      return { hud: target.getHudSnapshot(), save: serializeGame(target) };
    };
    const continued = advance(engine);
    const restored = advance(fresh);
    expect(restored.hud).toEqual(continued.hud);
    expect(normalized(restored.save)).toEqual(normalized(continued.save));
  });

  it('rejects corrupted and old-version saves without throwing or mutating the run', () => {
    const engine = new AetherGameEngine();
    engine.status = 'playing';
    const before = serializeGame(engine);
    const runId = engine.runId;

    const malformed = applySave(engine, { ...before, resources: null });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.error.code).toBe('MALFORMED_SAVE');

    const oldVersion = applySave(engine, { ...before, version: 0 });
    expect(oldVersion.ok).toBe(false);
    if (!oldVersion.ok) expect(oldVersion.error.code).toBe('UNSUPPORTED_VERSION');

    expect(() => applySave(engine, null)).not.toThrow();
    expect(normalized(serializeGame(engine))).toEqual(normalized(before));
    expect(engine.runId).toBe(runId);
  });

  it('restart clears loaded state and regenerates full nodes', () => {
    const engine = makeActiveEngine();
    const fresh = new AetherGameEngine();
    expect(applySave(fresh, serializeGame(engine)).ok).toBe(true);
    const runId = fresh.runId;

    fresh.reset();
    expect(fresh.runId).toBe(runId + 1);
    expect(fresh.resources).toEqual(createInitialResources());
    expect(fresh.buildings).toHaveLength(0);
    expect(fresh.drones).toHaveLength(0);
    expect(fresh.enemies).toHaveLength(0);
    expect(fresh.crashPods).toHaveLength(0);
    expect(fresh.warpProgress).toBe(0);
    expect(fresh.objectiveIndex).toBe(0);
    expect(fresh.stormsSurvived).toBe(0);
    expect(fresh.behemothKilled).toBe(0);
    expect(fresh.nodes.every((node) => node.amount === node.maxAmount)).toBe(true);
  });
});
