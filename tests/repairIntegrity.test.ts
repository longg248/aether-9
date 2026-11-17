import { describe, expect, it } from 'vitest';
import { UPGRADES } from '@/constants/gameConfig';
import { buildHudSnapshot } from '@/engine/hud';
import {
  getUpgradeState,
  hasLivingLab,
  triggerQuickRepair,
  updateBuildings,
} from '@/engine/systems/buildingSystem';
import { makeBuilding, makeEngine } from './helpers';

/**
 * Phase 2 review fixes: destroyed buildings (hp <= 0) must never be healed
 * back to life, and a destroyed Lab must not unlock research — engine and
 * HUD share the same living-Lab definition.
 */

describe('repair bay: only living buildings receive healing', () => {
  it('repairs a damaged living building in range by exactly 18 HP', () => {
    const engine = makeEngine();
    const bay = makeBuilding('repair_bay', 22, 20, 200);
    const turret = makeBuilding('turret', 23, 20, 100);
    turret.hp = 40;
    engine.buildings.push(bay, turret);

    updateBuildings(engine, 0.05, 1); // bay cooldown starts at 0 → fires

    expect(turret.hp).toBe(58); // 40 + 18, exact
  });

  it('does not repair a building at hp = 0', () => {
    const engine = makeEngine();
    const bay = makeBuilding('repair_bay', 22, 20, 200);
    const wreck = makeBuilding('turret', 23, 20, 100);
    wreck.hp = 0;
    engine.buildings.push(bay, wreck);

    updateBuildings(engine, 0.05, 1);

    expect(wreck.hp).toBe(0); // no resurrection
  });

  it('does not repair a building below zero HP either', () => {
    const engine = makeEngine();
    const bay = makeBuilding('repair_bay', 22, 20, 200);
    const wreck = makeBuilding('turret', 23, 20, 100);
    wreck.hp = -25;
    engine.buildings.push(bay, wreck);

    updateBuildings(engine, 0.05, 1);

    expect(wreck.hp).toBe(-25);
  });

  it('keeps repairing living buildings across repeated pulses while wrecks stay dead', () => {
    const engine = makeEngine();
    const bay = makeBuilding('repair_bay', 22, 20, 200);
    const living = makeBuilding('turret', 23, 20, 100);
    living.hp = 40;
    const wreck = makeBuilding('drill', 21, 20, 100);
    wreck.hp = 0;
    engine.buildings.push(bay, living, wreck);

    // Two repair pulses (cooldown 1.2s): at t=0 and t=1.2, none before 1.5.
    for (let t = 0; t < 1.5; t += 0.05) updateBuildings(engine, 0.05, 1);

    expect(living.hp).toBe(76); // 40 + 18 + 18, exact
    expect(wreck.hp).toBe(0);
  });
});

describe('quick repair: living buildings and the Hub only', () => {
  it('repairs damaged living buildings by 45% max HP and charges the exact cost', () => {
    const engine = makeEngine();
    engine.resources.silicate = 100;
    engine.resources.iron = 100;
    const turret = makeBuilding('turret', 23, 20, 100);
    turret.hp = 40;
    engine.buildings.push(turret);

    triggerQuickRepair(engine);

    expect(turret.hp).toBe(85); // 40 + 45, exact
    expect(engine.resources.silicate).toBe(80); // 100 - 20
    expect(engine.resources.iron).toBe(85); // 100 - 15
  });

  it('does not resurrect destroyed buildings (hp = 0 or below)', () => {
    const engine = makeEngine();
    engine.resources.silicate = 100;
    engine.resources.iron = 100;
    const wreckZero = makeBuilding('turret', 23, 20, 100);
    wreckZero.hp = 0;
    const wreckNegative = makeBuilding('drill', 21, 20, 100);
    wreckNegative.hp = -10;
    engine.buildings.push(wreckZero, wreckNegative);

    triggerQuickRepair(engine);

    expect(wreckZero.hp).toBe(0);
    expect(wreckNegative.hp).toBe(-10);
  });

  it('still repairs the Hub by 260 HP, capped at hubMaxHp', () => {
    const engine = makeEngine();
    engine.resources.silicate = 100;
    engine.resources.iron = 100;
    engine.hubHp = 100;

    triggerQuickRepair(engine);
    expect(engine.hubHp).toBe(360); // 100 + 260, exact

    engine.resources.silicate = 100;
    engine.resources.iron = 100;
    engine.hubHp = engine.hubMaxHp - 100;
    triggerQuickRepair(engine);
    expect(engine.hubHp).toBe(engine.hubMaxHp); // never overheals
  });

  it('a failed quick repair (insufficient resources) deducts nothing and heals nothing', () => {
    const engine = makeEngine();
    engine.resources.silicate = 10;
    engine.resources.iron = 100;
    const turret = makeBuilding('turret', 23, 20, 100);
    turret.hp = 40;
    engine.buildings.push(turret);
    const hubBefore = engine.hubHp;

    triggerQuickRepair(engine);

    expect(engine.resources.silicate).toBe(10);
    expect(engine.resources.iron).toBe(100);
    expect(turret.hp).toBe(40);
    expect(engine.hubHp).toBe(hubBefore);
  });
});

describe('lab prerequisite: only a living Lab unlocks research', () => {
  const labUpgrade = UPGRADES.find((u) => u.reqLab)!; // shield_matrix

  it('a destroyed Lab does not unlock Lab-dependent upgrades (engine)', () => {
    const engine = makeEngine();
    const lab = makeBuilding('lab', 24, 20, 200);
    lab.hp = 0;
    engine.buildings.push(lab);
    engine.resources = { silicate: 1000, iron: 1000, aether: 1000 };
    const levelBefore = engine.upgrades[labUpgrade.id] || 0;

    engine.buyUpgrade(labUpgrade.id);

    expect(engine.upgrades[labUpgrade.id] || 0).toBe(levelBefore); // purchase refused
    expect(engine.resources.silicate).toBe(1000); // nothing deducted
    expect(hasLivingLab(engine.buildings)).toBe(false);
    expect(getUpgradeState(labUpgrade.id, engine.upgrades, engine.resources, hasLivingLab(engine.buildings))).toBe('locked');
  });

  it('the HUD reports the same Lab state as the engine (destroyed Lab)', () => {
    const engine = makeEngine();
    const lab = makeBuilding('lab', 24, 20, 200);
    lab.hp = 0;
    engine.buildings.push(lab);
    engine.resources = { silicate: 1000, iron: 1000, aether: 1000 };

    const hud = buildHudSnapshot(engine);

    expect(hud.hasLab).toBe(false);
    expect(hud.hasLab).toBe(hasLivingLab(engine.buildings)); // single definition
    expect(getUpgradeState(labUpgrade.id, hud.upgrades, hud.resources, hud.hasLab)).toBe('locked');
  });

  it('a living Lab unlocks the upgrade and the purchase deducts the exact cost', () => {
    const engine = makeEngine();
    engine.buildings.push(makeBuilding('lab', 24, 20, 200));
    engine.resources = { silicate: 1000, iron: 1000, aether: 1000 };
    const levelBefore = engine.upgrades[labUpgrade.id] || 0;

    const hud = buildHudSnapshot(engine);
    expect(hud.hasLab).toBe(true);
    expect(getUpgradeState(labUpgrade.id, hud.upgrades, hud.resources, hud.hasLab)).toBe('affordable');

    engine.buyUpgrade(labUpgrade.id);

    expect(engine.upgrades[labUpgrade.id]).toBe(levelBefore + 1);
    expect(engine.resources.silicate).toBe(1000 - labUpgrade.cost.silicate!);
    expect(engine.resources.iron).toBe(1000 - labUpgrade.cost.iron!);
    expect(engine.resources.aether).toBe(1000 - labUpgrade.cost.aether!);
  });

  it('a Lab destroyed after purchase keeps the upgrade but locks further levels', () => {
    const engine = makeEngine();
    const lab = makeBuilding('lab', 24, 20, 200);
    engine.buildings.push(lab);
    engine.resources = { silicate: 1000, iron: 1000, aether: 1000 };

    engine.buyUpgrade(labUpgrade.id); // level 1 while alive
    lab.hp = 0; // then destroyed
    const levelAfterFirst = engine.upgrades[labUpgrade.id];
    const silicateAfterFirst = engine.resources.silicate;

    engine.buyUpgrade(labUpgrade.id); // must be refused now

    expect(engine.upgrades[labUpgrade.id]).toBe(levelAfterFirst);
    expect(engine.resources.silicate).toBe(silicateAfterFirst);
    expect(buildHudSnapshot(engine).hasLab).toBe(false);
  });
});