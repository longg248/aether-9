import { describe, expect, it } from 'vitest';
import { DEFAULT_AETHER_RESERVE, TARGET_WARP_AETHER } from '@/constants/gameConfig';
import { buyUpgrade } from '@/engine/systems/buildingSystem';
import { updateWarpProgress } from '@/engine/systems/environmentSystem';
import { makeBuilding, makeEngine, tick } from './helpers';

describe('aether economy: warp reserve', () => {
  it('warp only consumes Aether above the reserve', () => {
    const engine = makeEngine();
    engine.resources.aether = 200;
    engine.setAetherReserve(150);

    tick((dt) => updateWarpProgress(engine, dt), 30);

    expect(engine.resources.aether).toBeCloseTo(150, 5);
    expect(engine.warpProgress).toBeCloseTo(50, 5);
  });

  it('warp never touches Aether at or below the reserve', () => {
    const engine = makeEngine();
    engine.resources.aether = 100;
    engine.setAetherReserve(150);

    tick((dt) => updateWarpProgress(engine, dt), 30);

    expect(engine.resources.aether).toBe(100);
    expect(engine.warpProgress).toBe(0);
  });

  it('conserves total Aether (stock + warp progress) during transfer', () => {
    const engine = makeEngine();
    engine.resources.aether = 500;
    const total = engine.resources.aether + engine.warpProgress;

    tick((dt) => updateWarpProgress(engine, dt), 10);

    expect(engine.resources.aether + engine.warpProgress).toBeCloseTo(total, 5);
  });

  it('reserve is configurable and clamped to sane values', () => {
    const engine = makeEngine();
    engine.setAetherReserve(300);
    expect(engine.aetherReserve).toBe(300);
    engine.resources.aether = 400;
    tick((dt) => updateWarpProgress(engine, dt), 30);
    expect(engine.resources.aether).toBeCloseTo(300, 5);

    engine.setAetherReserve(-50);
    expect(engine.aetherReserve).toBe(0);
    engine.setAetherReserve(Number.NaN);
    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE);
  });

  it('reset restores the default reserve', () => {
    const engine = makeEngine();
    engine.setAetherReserve(999);
    engine.reset();
    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE);
  });

  it('warp still stops exactly at the 1,200 victory threshold', () => {
    const engine = makeEngine();
    engine.setAetherReserve(0);
    engine.resources.aether = 5000;

    tick((dt) => updateWarpProgress(engine, dt), 200);

    expect(engine.warpProgress).toBe(TARGET_WARP_AETHER);
    expect(engine.resources.aether).toBeCloseTo(3800, 5);
  });
});

describe('aether economy: upgrades alongside warp consumption', () => {
  it('upgrade purchase succeeds while the warp engine is running', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('lab', 20, 20));
    engine.resources.iron = 500;
    engine.resources.aether = 300;

    tick((dt) => updateWarpProgress(engine, dt), 30);
    // Warp drained the surplus but left the reserve for the player.
    expect(engine.resources.aether).toBeCloseTo(DEFAULT_AETHER_RESERVE, 5);
    expect(engine.warpProgress).toBeGreaterThan(0);

    buyUpgrade(engine, 'aether_capacitor'); // costs 130 iron + 90 aether

    expect(engine.upgrades.aether_capacitor).toBe(1);
    expect(engine.resources.aether).toBeCloseTo(DEFAULT_AETHER_RESERVE - 90, 5);
    expect(engine.resources.iron).toBe(370);
  });

  it('full engine loop: lab production, warp drain and upgrade purchase coexist', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('lab', 20, 20));
    engine.resources.iron = 500;
    engine.resources.aether = 0;

    tick((dt) => engine.update(dt), 120); // lab makes +3 aether / 2s

    expect(engine.warpProgress).toBeGreaterThan(0);
    expect(engine.resources.aether).toBeGreaterThanOrEqual(DEFAULT_AETHER_RESERVE - 1);

    buyUpgrade(engine, 'turret_optics'); // costs 85 iron + 35 aether
    expect(engine.upgrades.turret_optics).toBe(2);

    tick((dt) => engine.update(dt), 30);
    expect(engine.warpProgress).toBeGreaterThan(0);
    expect(engine.status).toBe('playing');
  });

  it('purchase can dip below the reserve; warp waits until it refills', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('lab', 20, 20));
    engine.resources.iron = 500;
    engine.resources.aether = 160;

    tick((dt) => updateWarpProgress(engine, dt), 10);
    expect(engine.resources.aether).toBeCloseTo(150, 5);

    buyUpgrade(engine, 'aether_capacitor'); // -90 → 60 left
    expect(engine.resources.aether).toBeCloseTo(60, 5);
    const warpBefore = engine.warpProgress;

    tick((dt) => updateWarpProgress(engine, dt), 5);
    expect(engine.warpProgress).toBe(warpBefore); // no drain below reserve
    expect(engine.resources.aether).toBeCloseTo(60, 5);
  });
});

describe('aether economy: HUD consistency', () => {
  it('HUD reports total, reserved and available Aether consistently', () => {
    const engine = makeEngine();
    engine.resources.aether = 200;
    engine.setAetherReserve(150);

    const hud = engine.getHudSnapshot();

    expect(hud.resources.aether).toBe(200);
    expect(hud.aetherReserve).toBe(150);
    expect(hud.aetherAvailable).toBe(50);
  });

  it('available Aether never goes negative in the HUD', () => {
    const engine = makeEngine();
    engine.resources.aether = 20;
    const hud = engine.getHudSnapshot();
    expect(hud.aetherAvailable).toBe(0);
  });
});