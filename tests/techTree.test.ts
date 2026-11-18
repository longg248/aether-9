import { afterEach, describe, expect, it, vi } from 'vitest';
import { TARGET_WARP_AETHER, UPGRADES, WARP_TRANSFER_RATE } from '@/constants/gameConfig';
import { getUpgradeCost, getUpgradeState, updateBuildings } from '@/engine/systems/buildingSystem';
import { updateDrones } from '@/engine/systems/droneSystem';
import { checkGameEnd, updateStorms, updateWarpProgress } from '@/engine/systems/environmentSystem';
import { updateRoverCombat, updateRoverMovement } from '@/engine/systems/roverSystem';
import { makeBuilding, makeDrillWithDrone, makeEnemy, makeEngine, makeNode, tick } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

const rich = { silicate: 99999, iron: 99999, aether: 99999 };

describe('tech tree: costs and availability states', () => {
  it('cost scales by 1.45^level with rounding, for every upgrade and level', () => {
    for (const u of UPGRADES) {
      for (let lvl = 0; lvl < u.maxLevel; lvl++) {
        const cost = getUpgradeCost(u, lvl);
        const mult = Math.pow(1.45, lvl);
        expect(cost.silicate).toBe(Math.round((u.cost.silicate || 0) * mult));
        expect(cost.iron).toBe(Math.round((u.cost.iron || 0) * mult));
        expect(cost.aether).toBe(Math.round((u.cost.aether || 0) * mult));
      }
    }
  });

  it('distinguishes locked / unaffordable / affordable / maxed', () => {
    const upgrades = { shield_matrix: 0, aether_capacitor: 0, rover_laser: 5 };
    const poor = { silicate: 0, iron: 0, aether: 0 };
    expect(getUpgradeState('shield_matrix', upgrades, rich, false)).toBe('locked');
    expect(getUpgradeState('shield_matrix', upgrades, poor, true)).toBe('unaffordable');
    expect(getUpgradeState('shield_matrix', upgrades, rich, true)).toBe('affordable');
    expect(getUpgradeState('rover_laser', upgrades, rich, false)).toBe('maxed');
    expect(getUpgradeState('does_not_exist', upgrades, rich, true)).toBeNull();
  });

  it('locked upgrades cannot be bought even with unlimited resources', () => {
    const engine = makeEngine();
    engine.resources = { ...rich };
    engine.buyUpgrade('shield_matrix');
    expect(engine.upgrades.shield_matrix).toBe(0);
    expect(engine.resources).toEqual(rich);
  });

  it('maxed upgrades cannot be bought again (no repeat purchase, no deduction)', () => {
    const engine = makeEngine();
    engine.resources = { ...rich };
    engine.upgrades.rover_laser = 5;
    for (let i = 0; i < 10; i++) engine.buyUpgrade('rover_laser');
    expect(engine.upgrades.rover_laser).toBe(5);
    expect(engine.resources).toEqual(rich);
  });

  it('rapid repeated clicks with funds for one level buy exactly one level', () => {
    const engine = makeEngine();
    engine.resources = { silicate: 100, iron: 80, aether: 45 }; // exactly shield_matrix lvl0 cost
    engine.buildings.push(makeBuilding('lab', 20, 20));
    for (let i = 0; i < 20; i++) engine.buyUpgrade('shield_matrix');
    expect(engine.upgrades.shield_matrix).toBe(1);
    expect(engine.resources).toEqual({ silicate: 0, iron: 0, aether: 0 });
  });

  it('every configured upgrade has a positive cost, a level cap and a description', () => {
    for (const u of UPGRADES) {
      expect(u.maxLevel).toBeGreaterThan(0);
      expect(u.desc.length).toBeGreaterThan(0);
      const total = (u.cost.silicate || 0) + (u.cost.iron || 0) + (u.cost.aether || 0);
      expect(total).toBeGreaterThan(0);
    }
  });
});

describe('tech tree: upgrades modify real gameplay properties', () => {
  it('rover_laser increases movement speed by 15% per level above base', () => {
    const engine = makeEngine();
    engine.upgrades.rover_laser = 3;
    engine.keys.add('d');
    const before = engine.rover.x;
    updateRoverMovement(engine, 0.05);
    expect(engine.rover.x - before).toBeCloseTo(165 * (1 + 2 * 0.15) * 0.05, 9);
  });

  it('rover_laser shortens the mining cooldown by 35% per level above base', () => {
    const engine = makeEngine();
    engine.upgrades.rover_laser = 3;
    const node = makeNode('silicate', 22, 22, 450);
    node.x = engine.rover.x + 40; // within mining range
    node.y = engine.rover.y;
    engine.nodes.push(node);
    updateRoverCombat(engine, 0.05);
    expect(engine.rover.mineCooldown).toBeCloseTo(0.42 / (1 + 2 * 0.35), 9);
  });

  it('drone_logistics raises cargo capacity by 30% per level above base', () => {
    const engine = makeEngine();
    engine.upgrades.drone_logistics = 3;
    const node = makeNode('iron', 24, 22, 100);
    makeDrillWithDrone(engine, node); // drone starts on the node
    updateDrones(engine, 0.05, 1);
    expect(engine.drones[0].cargoAmount).toBe(16); // round(10 * 1.6)
    expect(node.amount).toBe(84);
  });

  it('turret_optics raises turret damage by 35% per level above base', () => {
    const engine = makeEngine();
    engine.upgrades.turret_optics = 3;
    const turret = makeBuilding('turret', 22, 20, 240);
    engine.buildings.push(turret);
    const enemy = makeEnemy('swarmer', turret.x + 60, turret.y, 100);
    engine.enemies.push(enemy);
    updateBuildings(engine, 0.05, 1);
    expect(enemy.hp).toBeCloseTo(100 - 28 * (1 + 2 * 0.35), 9);
  });

  it('shield_matrix adds 400 max Hub HP and heals on purchase', () => {
    const engine = makeEngine();
    engine.resources = { ...rich };
    engine.buildings.push(makeBuilding('lab', 20, 20));
    engine.hubHp = 900;
    engine.buyUpgrade('shield_matrix');
    expect(engine.hubMaxHp).toBe(1600);
    expect(engine.hubHp).toBe(1300);
  });

  it('shield_matrix reduces storm damage by 20% per level (as advertised)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // force a lightning strike
    const engine = makeEngine();
    engine.upgrades.shield_matrix = 2;
    engine.stormActive = true;
    engine.stormDuration = 10;
    updateStorms(engine, 0.05);
    expect(engine.hubHp).toBeCloseTo(1200 - 18 * (1 - 2 * 0.2), 9);
  });

  it('aether_capacitor boosts warp charge rate by 45% per level (as advertised)', () => {
    const engine = makeEngine();
    engine.upgrades.aether_capacitor = 2;
    engine.resources.aether = 1000;
    engine.setAetherReserve(0);
    tick((dt) => updateWarpProgress(engine, dt), 1);
    expect(engine.warpProgress).toBeCloseTo(WARP_TRANSFER_RATE * (1 + 2 * 0.45), 6);
    expect(engine.resources.aether).toBeCloseTo(1000 - WARP_TRANSFER_RATE * 1.9, 6);
  });

  it('victory still triggers at exactly 1,200 Aether with maxed capacitor', () => {
    const engine = makeEngine();
    engine.upgrades.aether_capacitor = 4;
    engine.resources.aether = 5000;
    engine.setAetherReserve(0);
    tick((dt) => {
      updateWarpProgress(engine, dt);
      checkGameEnd(engine);
    }, 1500);
    expect(engine.warpProgress).toBe(TARGET_WARP_AETHER);
    expect(engine.status).toBe('victory');
    expect(engine.resources.aether).toBeGreaterThanOrEqual(0);
  });
});