import { describe, expect, it } from 'vitest';
import { ACID_POOL_LIFE, HUB_X, HUB_Y } from '@/constants/gameConfig';
import { updateEnemies, updateProjectiles } from '@/engine/systems/enemySystem';
import { Projectile } from '@/types/game';
import { makeBuilding, makeEnemy, makeEngine, tick } from './helpers';

function makeProjectile(x: number, y: number, vx: number, vy: number, isAcid: boolean): Projectile {
  return {
    id: `proj_test_${Math.random()}`,
    x,
    y,
    vx,
    vy,
    damage: 18,
    life: 1.2,
    color: '#4ade80',
    isAcid,
  };
}

const FAR = 300; // far away from Hub and any building

describe('projectiles: lifetime expiry without collision', () => {
  it('expired acid projectile does NOT damage the Hub', () => {
    const engine = makeEngine();
    engine.projectiles.push(makeProjectile(FAR, FAR, 10, 0, true));
    const hubBefore = engine.hubHp;

    tick((dt) => updateProjectiles(engine, dt), 2);

    expect(engine.hubHp).toBe(hubBefore);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.acidPools).toHaveLength(1);
    expect(engine.acidPools[0].x).toBeGreaterThan(FAR);
  });

  it('expired non-acid projectile is cleaned up without damage or pool', () => {
    const engine = makeEngine();
    engine.projectiles.push(makeProjectile(FAR, FAR, 10, 0, false));
    const hubBefore = engine.hubHp;

    tick((dt) => updateProjectiles(engine, dt), 2);

    expect(engine.hubHp).toBe(hubBefore);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.acidPools).toHaveLength(0);
  });
});

describe('projectiles: collision damage', () => {
  it('acid projectile impacts a building for half damage exactly once', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 10, 10, 480);
    engine.buildings.push(wall);
    engine.projectiles.push(makeProjectile(wall.x - 30, wall.y, 210, 0, true));
    const hubBefore = engine.hubHp;

    updateProjectiles(engine, 0.05); // moves 10.5px, still short
    updateProjectiles(engine, 0.05); // crosses into collision radius

    expect(wall.hp).toBe(480 - 9);
    expect(engine.hubHp).toBe(hubBefore);
    expect(engine.projectiles).toHaveLength(0);
    expect(engine.acidPools).toHaveLength(1);

    const hpAfterImpact = wall.hp;
    updateProjectiles(engine, 0.05); // no projectile left to re-apply impact
    expect(wall.hp).toBeGreaterThanOrEqual(hpAfterImpact - 3); // only pool DoT may tick
  });

  it('acid projectile hitting the Hub damages the Hub exactly once', () => {
    const engine = makeEngine();
    engine.projectiles.push(makeProjectile(HUB_X - 60, HUB_Y, 210, 0, true));
    const hubBefore = engine.hubHp;

    updateProjectiles(engine, 0.05);

    expect(engine.hubHp).toBe(hubBefore - 9);
    expect(engine.projectiles).toHaveLength(0);
  });

  it('non-acid projectile deals full impact damage to a building', () => {
    const engine = makeEngine();
    const turret = makeBuilding('turret', 10, 10, 240);
    engine.buildings.push(turret);
    engine.projectiles.push(makeProjectile(turret.x - 26, turret.y, 210, 0, false));

    updateProjectiles(engine, 0.05);

    expect(turret.hp).toBe(240 - 18);
    expect(engine.acidPools).toHaveLength(0);
  });

  it('projectile passing outside collision radius deals no damage', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 10, 10, 480);
    engine.buildings.push(wall);
    // passes 60px above the wall center (radius 24)
    engine.projectiles.push(makeProjectile(wall.x - 100, wall.y - 60, 210, 0, true));
    const hubBefore = engine.hubHp;

    tick((dt) => updateProjectiles(engine, dt), 1.3);

    expect(wall.hp).toBe(480);
    expect(engine.hubHp).toBe(hubBefore);
  });

  it('destroyed buildings (hp <= 0) are invalid targets and do not collide', () => {
    const engine = makeEngine();
    const wreck = makeBuilding('wall', 10, 10, 480);
    wreck.hp = 0;
    engine.buildings.push(wreck);
    engine.projectiles.push(makeProjectile(wreck.x - 26, wreck.y, 210, 0, false));

    updateProjectiles(engine, 0.05);

    expect(wreck.hp).toBe(0); // no further damage on a wreck
    expect(engine.projectiles).toHaveLength(1); // flew straight through
  });

  it('repair bay protection reduces acid impact damage', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 10, 10, 480);
    const bay = makeBuilding('repair_bay', 12, 10, 240);
    engine.buildings.push(wall, bay);
    engine.projectiles.push(makeProjectile(wall.x - 26, wall.y, 210, 0, true));

    updateProjectiles(engine, 0.05);

    expect(wall.hp).toBeCloseTo(480 - 9 * 0.75, 5);
  });
});

describe('acid pools: damage over time and lifetime', () => {
  it('damages a building inside the pool on fixed ticks, then expires', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 10, 10, 480);
    engine.buildings.push(wall);
    engine.projectiles.push(makeProjectile(wall.x - 26, wall.y, 210, 0, true));
    updateProjectiles(engine, 0.05); // impact + pool spawn
    const hpAfterImpact = wall.hp;

    tick((dt) => updateProjectiles(engine, dt), ACID_POOL_LIFE + 1);

    const dotDamage = hpAfterImpact - wall.hp;
    expect(dotDamage).toBeGreaterThanOrEqual(24); // ~6 dps over ~5s
    expect(dotDamage).toBeLessThanOrEqual(30);
    expect(engine.acidPools).toHaveLength(0);

    const hpAfterExpiry = wall.hp;
    tick((dt) => updateProjectiles(engine, dt), 3);
    expect(wall.hp).toBe(hpAfterExpiry); // no damage after expiry
  });

  it('pool away from Hub and buildings damages nothing', () => {
    const engine = makeEngine();
    engine.projectiles.push(makeProjectile(FAR, FAR, 0, 0, true));
    const hubBefore = engine.hubHp;

    tick((dt) => updateProjectiles(engine, dt), ACID_POOL_LIFE + 2);

    expect(engine.hubHp).toBe(hubBefore);
    expect(engine.acidPools).toHaveLength(0);
  });

  it('produces deterministic damage for identical simulations', () => {
    const simulate = () => {
      const engine = makeEngine();
      const wall = makeBuilding('wall', 10, 10, 480);
      engine.buildings.push(wall);
      engine.projectiles.push(makeProjectile(wall.x - 26, wall.y, 210, 0, true));
      tick((dt) => updateProjectiles(engine, dt), ACID_POOL_LIFE + 1);
      return wall.hp;
    };
    expect(simulate()).toBe(simulate());
  });

  it('damages the Hub when the pool overlaps it', () => {
    const engine = makeEngine();
    engine.projectiles.push(makeProjectile(HUB_X - 60, HUB_Y, 210, 0, true));
    updateProjectiles(engine, 0.05); // impact -9, pool at hub edge
    const hubAfterImpact = engine.hubHp;

    tick((dt) => updateProjectiles(engine, dt), ACID_POOL_LIFE + 1);

    expect(engine.hubHp).toBeLessThan(hubAfterImpact);
    expect(hubAfterImpact - engine.hubHp).toBeLessThanOrEqual(30);
  });
});

describe('enemy melee regression (existing behavior preserved)', () => {
  it('swarmer adjacent to the Hub still deals melee damage', () => {
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('swarmer', HUB_X + 30, HUB_Y));
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05);

    expect(engine.hubHp).toBe(hubBefore - 11);
  });

  it('spitter in range still fires an acid projectile', () => {
    const engine = makeEngine();
    engine.enemies.push(makeEnemy('spitter', HUB_X + 150, HUB_Y));

    updateEnemies(engine, 0.05);

    expect(engine.projectiles).toHaveLength(1);
    expect(engine.projectiles[0].isAcid).toBe(true);
  });
});