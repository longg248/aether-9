import { afterEach, describe, expect, it, vi } from 'vitest';
import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import {
  ELITE_AETHER_DROP,
  ELITE_DMG_MULT,
  ELITE_HP_MULT,
  GOLIATH_WINDUP,
  WAVE_HP_SCALE_CAP,
  createEnemy,
  getWaveParams,
  spawnEnemyWave,
  updateEnemies,
} from '@/engine/systems/enemySystem';
import { makeBuilding, makeEnemy, makeEngine, tick } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('elite variants: gated, bounded stat multipliers', () => {
  it('elite swarmer gets multiplied HP/speed and a larger radius', () => {
    const engine = makeEngine();
    const elite = createEnemy(engine, 'swarmer', 500, 500, 2, true);
    expect(elite.elite).toBe(true);
    expect(elite.maxHp).toBeCloseTo(55 * 2 * ELITE_HP_MULT, 6); // 198
    expect(elite.speed).toBeCloseTo(68 * 1.12, 6);
    expect(elite.radius).toBe(14);

    const normal = createEnemy(engine, 'swarmer', 600, 600, 2);
    expect(normal.elite).toBe(false);
    expect(normal.maxHp).toBe(110);
    expect(normal.speed).toBe(68);
    expect(normal.radius).toBe(12);
  });

  it('elite HP stays bounded by the late-wave scale cap', () => {
    const engine = makeEngine();
    const scale = getWaveParams(100).hpScale;
    expect(scale).toBe(WAVE_HP_SCALE_CAP);
    const elite = createEnemy(engine, 'goliath', 500, 500, scale, true);
    expect(elite.maxHp).toBeCloseTo(220 * WAVE_HP_SCALE_CAP * ELITE_HP_MULT, 6); // 1188
  });

  it('elites never spawn before wave 5, even with a lucky roll', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // every roll "succeeds"
    const engine = makeEngine();
    engine.waveCount = 3;
    spawnEnemyWave(engine); // wave 4
    expect(engine.enemies.length).toBeGreaterThan(0);
    expect(engine.enemies.every((e) => !e.elite)).toBe(true);
  });

  it('wave 5+ rolls elites at the configured chance', () => {
    const engine = makeEngine();
    engine.waveCount = 4;
    vi.spyOn(Math, 'random').mockReturnValue(0); // 0 < 0.15 → elite
    spawnEnemyWave(engine); // wave 5
    expect(engine.enemies.every((e) => e.elite)).toBe(true);

    engine.enemies = [];
    engine.waveCount = 4;
    vi.spyOn(Math, 'random').mockReturnValue(0.99); // 0.99 >= 0.15 → normal
    spawnEnemyWave(engine);
    expect(engine.enemies.every((e) => !e.elite)).toBe(true);
  });
});

describe('elite rewards: reliable but bounded Aether drops', () => {
  it('an elite death grants exactly +8 Aether, exactly once', () => {
    const engine = makeEngine();
    const elite = createEnemy(engine, 'swarmer', 500, 500, 1, true);
    elite.hp = 0;
    const before = engine.resources.aether;
    updateEnemies(engine, 0.05);
    expect(engine.resources.aether).toBe(before + ELITE_AETHER_DROP);
    expect(engine.enemies).toHaveLength(0);
    updateEnemies(engine, 0.05); // corpse already removed: no double drop
    expect(engine.resources.aether).toBe(before + ELITE_AETHER_DROP);
  });

  it('normal enemies keep the existing 35% chance drop (no guaranteed bonus)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const engine = makeEngine();
    const normal = createEnemy(engine, 'swarmer', 500, 500, 1);
    normal.hp = 0;
    const before = engine.resources.aether;
    updateEnemies(engine, 0.05);
    expect(engine.resources.aether).toBe(before);
  });
});

describe('heavy telegraph: goliath and behemoth wind up before striking', () => {
  it('goliath strike is delayed by the windup, then lands for 28 damage', () => {
    const engine = makeEngine();
    const goliath = makeEnemy('goliath', HUB_X, HUB_Y - 40, 220);
    engine.enemies.push(goliath);
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05); // enters range → starts windup, no damage
    expect(goliath.windupTimer).toBeGreaterThan(0);
    expect(goliath.windupTotal).toBe(GOLIATH_WINDUP);
    expect(engine.hubHp).toBe(hubBefore);

    tick((dt) => updateEnemies(engine, dt), 0.65); // windup completes at 0.6s
    expect(engine.hubHp).toBe(hubBefore - 28);

    tick((dt) => updateEnemies(engine, dt), 1.2); // full cycle = 0.6 + 0.5 = 1.1s
    expect(engine.hubHp).toBe(hubBefore - 56); // DPS unchanged, only telegraphed
  });

  it('behemoth winds up 0.9s before its 65-damage slam', () => {
    const engine = makeEngine();
    const boss = makeEnemy('behemoth', HUB_X, HUB_Y - 50, 2600);
    engine.enemies.push(boss);
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05);
    expect(boss.windupTotal).toBe(0.9);
    tick((dt) => updateEnemies(engine, dt), 0.85);
    expect(engine.hubHp).toBe(hubBefore); // still telegraphing

    tick((dt) => updateEnemies(engine, dt), 0.1);
    expect(engine.hubHp).toBe(hubBefore - 65);
  });

  it('elite heavies hit harder but keep the same telegraph', () => {
    const engine = makeEngine();
    const elite = createEnemy(engine, 'goliath', HUB_X, HUB_Y - 40, 1, true);
    const hubBefore = engine.hubHp;
    updateEnemies(engine, 0.05);
    expect(elite.windupTimer).toBeGreaterThan(0);
    tick((dt) => updateEnemies(engine, dt), 0.65);
    expect(engine.hubHp).toBeCloseTo(hubBefore - 28 * ELITE_DMG_MULT, 6); // 42
  });

  it('a target destroyed mid-windup is never damaged (no phantom hits)', () => {
    const engine = makeEngine();
    const turret = makeBuilding('turret', 30, 30, 150);
    engine.buildings.push(turret);
    const goliath = makeEnemy('goliath', turret.x, turret.y - 40, 220);
    engine.enemies.push(goliath);
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05); // locks onto the turret
    expect(goliath.pendingTargetId).toBe(turret.id);
    turret.hp = 0; // destroyed during the windup

    tick((dt) => updateEnemies(engine, dt), 0.65);
    expect(engine.hubHp).toBe(hubBefore); // strike fizzled, no splash
    expect(engine.buildings).toHaveLength(0); // wreck cleaned up, not re-damaged
  });

  it('stun/EMP interrupts a windup and cancels the pending strike', () => {
    const engine = makeEngine();
    const goliath = makeEnemy('goliath', HUB_X, HUB_Y - 40, 220);
    engine.enemies.push(goliath);
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05); // windup started
    goliath.stunTimer = 0.8;
    tick((dt) => updateEnemies(engine, dt), 0.8);
    expect(goliath.windupTimer).toBe(0);
    expect(engine.hubHp).toBe(hubBefore); // interrupted strike never lands
  });
});

describe('elite light attacks: damage multipliers reuse existing rules', () => {
  it('elite swarmer melee deals 16.5 instead of 11', () => {
    const engine = makeEngine();
    createEnemy(engine, 'swarmer', HUB_X, HUB_Y - 30, 1, true);
    const hubBefore = engine.hubHp;
    updateEnemies(engine, 0.05);
    expect(engine.hubHp).toBeCloseTo(hubBefore - 11 * ELITE_DMG_MULT, 6);
  });

  it('elite spitter acid projectiles carry 27 damage (normal: 18)', () => {
    const engine = makeEngine();
    createEnemy(engine, 'spitter', HUB_X, HUB_Y - 100, 1, true);
    updateEnemies(engine, 0.05);
    expect(engine.projectiles).toHaveLength(1);
    expect(engine.projectiles[0].damage).toBeCloseTo(18 * ELITE_DMG_MULT, 6);

    engine.projectiles = [];
    createEnemy(engine, 'spitter', HUB_X + 120, HUB_Y - 100, 1); // ~156px < 165 range
    updateEnemies(engine, 0.05);
    const normal = engine.projectiles.find((p) => p.damage === 18);
    expect(normal).toBeDefined();
  });
});

describe('wave composition: denser late waves, early waves untouched', () => {
  it('wave 6 adds goliaths on i%4===2 without changing early rules', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = makeEngine();
    engine.waveCount = 5;
    spawnEnemyWave(engine); // wave 6: 13 enemies
    expect(engine.enemies).toHaveLength(13);
    expect(engine.enemies.filter((e) => e.type === 'goliath')).toHaveLength(5);
    expect(engine.enemies.filter((e) => e.type === 'spitter')).toHaveLength(2);
    expect(engine.enemies.every((e) => !e.elite)).toBe(true); // 0.5 >= 0.15
  });

  it('wave 7 adds spitters on i%5===3', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = makeEngine();
    engine.waveCount = 6;
    spawnEnemyWave(engine); // wave 7: 15 enemies
    expect(engine.enemies).toHaveLength(15);
    expect(engine.enemies.filter((e) => e.type === 'goliath')).toHaveLength(6);
    expect(engine.enemies.filter((e) => e.type === 'spitter')).toHaveLength(5);
  });

  it('waves 3 and 4 keep their exact original compositions', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = makeEngine();
    engine.waveCount = 2;
    spawnEnemyWave(engine); // wave 3: 8 enemies, goliaths only at i%5===0
    expect(engine.enemies.filter((e) => e.type === 'goliath')).toHaveLength(2);
    expect(engine.enemies.filter((e) => e.type === 'spitter')).toHaveLength(0);

    engine.enemies = [];
    spawnEnemyWave(engine); // wave 4: 10 enemies
    expect(engine.enemies.filter((e) => e.type === 'goliath')).toHaveLength(2);
    expect(engine.enemies.filter((e) => e.type === 'spitter')).toHaveLength(2);
  });
});

describe('heavy telegraph respects walls and collision', () => {
  it('a winded-up goliath strikes the blocking wall and never penetrates it', () => {
    const engine = makeEngine();
    const walls = [21, 22, 23].map((gx) => makeBuilding('wall', gx, 18, 480));
    engine.buildings.push(...walls);
    const wallY = walls[1].y;
    const goliath = makeEnemy('goliath', HUB_X, wallY - 50, 220);
    engine.enemies.push(goliath);

    updateEnemies(engine, 0.05); // out of Hub range, in wall contact → windup
    expect(goliath.pendingTargetId).toBe(walls[1].id);

    tick((dt) => {
      updateEnemies(engine, dt);
      expect(goliath.y).toBeLessThan(wallY); // stays on the approach side
      for (const w of walls) {
        expect(Math.hypot(w.x - goliath.x, w.y - goliath.y)).toBeGreaterThanOrEqual(
          goliath.radius + 24 - 0.001
        );
      }
    }, 0.65);

    expect(walls[1].hp).toBe(480 - 28); // strike landed on the wall, not through it
    expect(walls[0].hp).toBe(480);
    expect(walls[2].hp).toBe(480);
    expect(engine.hubHp).toBe(1200); // Hub untouched behind the wall line
  });

  it('a wall destroyed mid-windup absorbs no strike and stays inert', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480);
    engine.buildings.push(wall);
    const goliath = makeEnemy('goliath', HUB_X, wall.y - 50, 220);
    engine.enemies.push(goliath);
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05);
    expect(goliath.pendingTargetId).toBe(wall.id);
    wall.hp = 0; // breached by turrets during the windup

    tick((dt) => updateEnemies(engine, dt), 0.65);
    expect(engine.buildings).toHaveLength(0); // wreck removed, never re-damaged
    expect(engine.hubHp).toBe(hubBefore); // no phantom damage redirected
  });
});