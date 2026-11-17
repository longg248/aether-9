import { describe, expect, it } from 'vitest';
import { DEFAULT_AETHER_RESERVE } from '@/constants/gameConfig';
import { createInitialResources, createInitialUpgrades } from '@/engine/gameState';
import { makeBuilding, makeDrillWithDrone, makeEnemy, makeEngine, makeNode, tick } from './helpers';

describe('game restart: engine.reset clears all state', () => {
  it('clears input state (keys, selection, hover)', () => {
    const engine = makeEngine();
    engine.keys.add('w');
    engine.keys.add('d');
    engine.selectedBuild = 'turret';
    engine.hoverTile = { gx: 5, gy: 7 };

    engine.reset();

    expect(engine.keys.size).toBe(0);
    expect(engine.selectedBuild).toBeNull();
    expect(engine.hoverTile).toBeNull();
  });

  it('restores resources, upgrades, warp progress and reserve', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 999, iron: 999, aether: 999 };
    engine.upgrades.turret_optics = 5;
    engine.warpProgress = 600;
    engine.phaseIndex = 3;
    engine.setAetherReserve(999);
    engine.hubHp = 10;

    engine.reset();

    expect(engine.resources).toEqual(createInitialResources());
    expect(engine.upgrades).toEqual(createInitialUpgrades());
    expect(engine.warpProgress).toBe(0);
    expect(engine.phaseIndex).toBe(0);
    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE);
    expect(engine.hubHp).toBe(1200);
  });

  it('clears entities, effects and timers from the previous run', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 19, 22, 100);
    makeDrillWithDrone(engine, node);
    engine.buildings.push(makeBuilding('wall', 20, 20));
    engine.enemies.push(makeEnemy('swarmer', 500, 500));
    engine.acidPools.push({
      x: 500,
      y: 500,
      radius: 26,
      life: 5,
      maxLife: 5,
      damagePerSecond: 6,
      tickTimer: 0.5,
    });
    engine.waveCount = 9;
    engine.bossSpawned = true;
    tick((dt) => engine.update(dt), 1);

    engine.reset();

    expect(engine.buildings).toHaveLength(0);
    expect(engine.drones).toHaveLength(0);
    expect(engine.enemies).toHaveLength(0);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.acidPools).toHaveLength(0);
    expect(engine.particles).toHaveLength(0);
    expect(engine.elapsed).toBe(0);
    expect(engine.waveCount).toBe(0);
    expect(engine.bossSpawned).toBe(false);
  });

  it('rover does not drift after restart from held keys', () => {
    const engine = makeEngine();
    engine.keys.add('d');
    tick((dt) => engine.update(dt), 0.5);

    engine.reset();
    engine.status = 'playing';
    const x0 = engine.rover.x;
    tick((dt) => engine.update(dt), 0.5);

    expect(engine.rover.x).toBe(x0);
  });
});