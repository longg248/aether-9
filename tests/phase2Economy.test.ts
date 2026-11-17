import { describe, expect, it } from 'vitest';
import { BUILDINGS, UPGRADES } from '@/constants/gameConfig';
import { getEnergyStats, updateBuildings } from '@/engine/systems/buildingSystem';
import { updateDrones } from '@/engine/systems/droneSystem';
import { updateWarpProgress } from '@/engine/systems/environmentSystem';
import { makeBuilding, makeDrillWithDrone, makeEngine, makeNode, tick } from './helpers';

describe('energy grid: production, consumption, efficiency', () => {
  it('hub reactor provides 25 MW baseline at full efficiency', () => {
    const engine = makeEngine();
    const stats = getEnergyStats(engine);
    expect(stats.prod).toBe(25);
    expect(stats.use).toBe(0);
    expect(stats.efficiency).toBe(1);
  });

  it('solar adds 12 MW by day and 60% of that at night', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('solar', 20, 20));
    engine.dayTime = 0.5; // day
    expect(getEnergyStats(engine).prod).toBe(37);
    engine.dayTime = 0.8; // night
    expect(getEnergyStats(engine).prod).toBe(32); // 25 + 12*0.6 = 32.2 -> 32
  });

  it('consumers raise use and brownout scales efficiency proportionally', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('smelter', 20, 20));
    engine.buildings.push(makeBuilding('smelter', 21, 20));
    engine.buildings.push(makeBuilding('drill', 24, 24));
    // use = 14 + 14 + 8 = 36, prod = 25
    const stats = getEnergyStats(engine);
    expect(stats.use).toBe(36);
    expect(stats.efficiency).toBe(25 / 36);
  });

  it('destroyed buildings neither produce nor consume energy', () => {
    const engine = makeEngine();
    const solar = makeBuilding('solar', 20, 20);
    const smelter = makeBuilding('smelter', 21, 20);
    solar.hp = 0;
    smelter.hp = 0;
    engine.buildings.push(solar, smelter);
    const stats = getEnergyStats(engine);
    expect(stats.prod).toBe(25);
    expect(stats.use).toBe(0);
    expect(stats.efficiency).toBe(1);
  });

  it('brownout halves smelter output over the same wall-clock time', () => {
    const full = makeEngine();
    full.resources.silicate = 500;
    full.buildings.push(makeBuilding('smelter', 20, 20));
    tick((dt) => updateBuildings(full, dt, 1), 7);

    const brown = makeEngine();
    brown.resources.silicate = 500;
    brown.buildings.push(makeBuilding('smelter', 20, 20));
    tick((dt) => updateBuildings(brown, dt, 0.5), 7);

    // 3.2s cycle: full power fires at 0/3.2/6.4 (3x5 iron), half power at 0/6.4 (2x5).
    expect(full.resources.iron).toBe(45 + 15);
    expect(brown.resources.iron).toBe(45 + 10);
  });

  it('destroyed smelter does not produce while awaiting cleanup', () => {
    const engine = makeEngine();
    engine.resources.silicate = 500;
    const smelter = makeBuilding('smelter', 20, 20);
    smelter.hp = 0;
    engine.buildings.push(smelter);
    tick((dt) => updateBuildings(engine, dt, 1), 7);
    expect(engine.resources.iron).toBe(45);
    expect(engine.resources.silicate).toBe(500);
  });

  it('drone speed floors at 35% under severe brownout', () => {
    const engine = makeEngine();
    const node = makeNode('silicate', 30, 22, 100);
    const { drone } = makeDrillWithDrone(engine, node);
    drone.x = node.x + 200; // start away from the node so it has to fly
    const before = drone.x;
    updateDrones(engine, 0.05, 0.1); // efficiency below the 0.35 floor
    expect(before - drone.x).toBeCloseTo(135 * 0.35 * 0.05, 10);
  });

  it('HUD exposes the same efficiency the simulation uses', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('lab', 20, 20)); // -20 MW plus baseline consumers
    engine.buildings.push(makeBuilding('smelter', 21, 20));
    const hud = engine.getHudSnapshot();
    expect(hud.energyEfficiency).toBe(getEnergyStats(engine).efficiency);
    expect(hud.energyEfficiency).toBeLessThan(1);
  });
});

describe('economy: resources never go negative, failed transactions never deduct', () => {
  it('building placement fails without resources and deducts nothing', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 10, iron: 0, aether: 0 };
    const ok = engine.placeBuilding(20, 20, 'solar'); // costs 25 silicate
    expect(ok).toBe(false);
    expect(engine.resources).toEqual({ silicate: 10, iron: 0, aether: 0 });
    expect(engine.buildings).toHaveLength(0);
  });

  it('rapid double placement on the same tile charges exactly once', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 50, iron: 0, aether: 0 };
    expect(engine.placeBuilding(20, 20, 'solar')).toBe(true);
    expect(engine.placeBuilding(20, 20, 'solar')).toBe(false); // tile occupied
    expect(engine.resources.silicate).toBe(25);
    expect(engine.buildings).toHaveLength(1);
  });

  it('upgrade purchase with exactly enough resources leaves zero, never negative', () => {
    const engine = makeEngine();
    // rover_laser starts at level 1: next cost = base * 1.45
    engine.resources = { silicate: 87, iron: 58, aether: 0 };
    engine.buyUpgrade('rover_laser');
    expect(engine.upgrades.rover_laser).toBe(2);
    expect(engine.resources).toEqual({ silicate: 0, iron: 0, aether: 0 });
  });

  it('rapid repeated upgrade clicks buy only what is affordable', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 87, iron: 58, aether: 0 };
    for (let i = 0; i < 10; i++) engine.buyUpgrade('rover_laser');
    expect(engine.upgrades.rover_laser).toBe(2);
    expect(engine.resources.silicate).toBe(0);
    expect(engine.resources.iron).toBe(0);
  });

  it('failed upgrade purchase deducts nothing', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 86, iron: 58, aether: 0 }; // 1 silicate short
    engine.buyUpgrade('rover_laser');
    expect(engine.upgrades.rover_laser).toBe(1);
    expect(engine.resources).toEqual({ silicate: 86, iron: 58, aether: 0 });
  });

  it('quick repair fails without resources and deducts nothing', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 19, iron: 100, aether: 0 };
    engine.hubHp = 500;
    engine.triggerQuickRepair();
    expect(engine.hubHp).toBe(500);
    expect(engine.resources).toEqual({ silicate: 19, iron: 100, aether: 0 });
  });

  it('smelter never converts when silicate is below the batch cost', () => {
    const engine = makeEngine();
    engine.resources.silicate = 7;
    engine.buildings.push(makeBuilding('smelter', 20, 20));
    tick((dt) => updateBuildings(engine, dt, 1), 10);
    expect(engine.resources.silicate).toBe(7);
    expect(engine.resources.iron).toBe(45);
    expect(engine.resources.aether).toBe(0);
  });

  it('warp transfer, mining and purchases keep every resource >= 0 over a long loop', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 90, iron: 45, aether: 30 };
    engine.buildings.push(makeBuilding('smelter', 20, 20));
    engine.setAetherReserve(0);
    for (let i = 0; i < 400; i++) {
      updateBuildings(engine, 0.05, 1);
      updateWarpProgress(engine, 0.05);
      if (i % 20 === 0) {
        engine.buyUpgrade('rover_laser');
        engine.triggerQuickRepair();
        engine.placeBuilding(18 + (i % 5), 18, 'wall');
      }
      expect(engine.resources.silicate).toBeGreaterThanOrEqual(0);
      expect(engine.resources.iron).toBeGreaterThanOrEqual(0);
      expect(engine.resources.aether).toBeGreaterThanOrEqual(0);
    }
  });

  it('building costs in config are all non-negative', () => {
    for (const b of Object.values(BUILDINGS)) {
      for (const v of Object.values(b.cost)) expect(v).toBeGreaterThanOrEqual(0);
    }
    for (const u of UPGRADES) {
      for (const v of Object.values(u.cost)) expect(v).toBeGreaterThanOrEqual(0);
    }
  });
});