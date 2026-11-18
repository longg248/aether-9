import { describe, expect, it, vi } from 'vitest';
import { WORLD_SEED } from '@/constants/gameConfig';
import { RandomService } from '@/engine/core/randomService';
import { AetherGameEngine } from '@/engine/gameEngine';
import { generateTerrainData } from '@/engine/world/terrainData';
import { generateResourceNodes } from '@/utils/proceduralTerrain';
import { generatePOIs } from '@/engine/systems/poiSystem';

describe('simulation / rendering decoupling', () => {
  it('constructs and simulates without ever creating a canvas', () => {
    const createElement = vi.spyOn(document, 'createElement');
    try {
      const engine = new AetherGameEngine();
      engine.status = 'playing';
      for (let i = 0; i < 120; i++) engine.update(1 / 60);
      expect(engine.elapsed).toBeGreaterThan(0);
      const canvasCalls = createElement.mock.calls.filter(([tag]) => tag === 'canvas');
      expect(canvasCalls).toHaveLength(0);
    } finally {
      createElement.mockRestore();
    }
  });

  it('engine exposes no canvas-backed state', () => {
    const engine = new AetherGameEngine();
    expect('terrainCanvas' in engine).toBe(false);
    expect(typeof (engine as unknown as Record<string, unknown>).render).toBe('undefined');
  });
});

describe('deterministic world generation', () => {
  it('terrain data is pure and reproducible', () => {
    const a = generateTerrainData();
    const b = generateTerrainData();
    expect(a).toEqual(b);
    expect(a.craters.length).toBeGreaterThan(0);
    expect(a.flora.length).toBeGreaterThan(0);
    expect(a.veins).toHaveLength(18);
    expect(a.patches).toHaveLength(420);
  });

  it('the same world seed produces identical nodes and POIs across engines', () => {
    const a = new AetherGameEngine(WORLD_SEED);
    const b = new AetherGameEngine(WORLD_SEED);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.pois).toEqual(b.pois);
  });

  it('reset reproduces the same world (seeded streams are re-created)', () => {
    const engine = new AetherGameEngine(WORLD_SEED);
    const before = engine.nodes.map((n) => `${n.id}:${n.amount}`);
    engine.nodes[0].amount = 1;
    engine.reset();
    expect(engine.nodes.map((n) => `${n.id}:${n.amount}`)).toEqual(before);
  });

  it('different seeds produce different resource layouts', () => {
    const a = generateResourceNodes(generatePOIs(1), new RandomService(1).resources);
    const b = generateResourceNodes(generatePOIs(2), new RandomService(2).resources);
    const key = (ns: typeof a) => ns.map((n) => `${n.gx},${n.gy}`).join('|');
    expect(key(a)).not.toBe(key(b));
  });

  it('resource placement respects hub, POI and occupied tiles', () => {
    const pois = generatePOIs();
    const nodes = generateResourceNodes(pois, new RandomService(WORLD_SEED).resources);
    const seen = new Set<string>();
    for (const n of nodes) {
      const key = `${n.gx},${n.gy}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      expect(pois.some((p) => p.gx === n.gx && p.gy === n.gy)).toBe(false);
      expect(Math.max(Math.abs(n.gx - 22), Math.abs(n.gy - 22))).toBeGreaterThan(1);
    }
    expect(nodes.length).toBe(60); // 26 silicate + 20 iron + 14 aether
  });
});

describe('RandomService streams', () => {
  it('worldgen streams are seeded and independent', () => {
    const a = new RandomService(123);
    const b = new RandomService(123);
    expect(a.resources()).toBe(b.resources());
    expect(a.terrain()).toBe(b.terrain());
    expect(a.poi()).toBe(b.poi());
    const c = new RandomService(123);
    // Different streams must not produce the same first value.
    expect(c.terrain()).not.toBe(c.resources());
  });

  it('gameplay stream is injectable (defaults to Math.random)', () => {
    const scripted = vi.fn().mockReturnValue(0.5);
    const service = new RandomService(1, scripted);
    expect(service.gameplay()).toBe(0.5);
    expect(scripted).toHaveBeenCalledTimes(1);
  });

  it('engine gameplay events use the injected stream', () => {
    const engine = new AetherGameEngine(1);
    const scripted = vi.fn().mockReturnValue(0.99);
    engine.random = new RandomService(1, scripted);
    engine.status = 'playing';
    engine.spawnParticles(100, 100, '#fff', 3);
    expect(scripted).toHaveBeenCalled();
    expect(engine.particles).toHaveLength(3);
  });
});