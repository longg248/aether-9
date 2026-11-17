import { describe, expect, it } from 'vitest';
import { BUILDING_COLLISION_RADIUS, HUB_X } from '@/constants/gameConfig';
import { updateEnemies, updateProjectiles } from '@/engine/systems/enemySystem';
import { makeBuilding, makeEnemy, makeEngine, tick } from './helpers';

describe('wall collision: intact walls block enemies', () => {
  it('enemy cannot penetrate an intact wall while approaching the Hub', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480); // directly between enemy and Hub
    engine.buildings.push(wall);
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);
    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;

    tick((dt) => {
      updateEnemies(engine, dt);
      if (wall.hp > 0) {
        expect(Math.hypot(enemy.x - wall.x, enemy.y - wall.y)).toBeGreaterThanOrEqual(minDist - 0.5);
      }
    }, 10);

    expect(wall.hp).toBeLessThan(480); // blocked enemy attacks the wall
    expect(enemy.y).toBeLessThan(wall.y); // never crossed it
  });

  it('enemy knocked inside a wall (e.g. EMP push) is pushed out', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480);
    engine.buildings.push(wall);
    const enemy = makeEnemy('goliath', wall.x + 5, wall.y + 3); // inside the wall
    engine.enemies.push(enemy);

    updateEnemies(engine, 0.05);

    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;
    expect(Math.hypot(enemy.x - wall.x, enemy.y - wall.y)).toBeGreaterThanOrEqual(minDist - 0.001);
  });

  it('spitter acid breaks a blocking wall instead of bypassing it', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480);
    engine.buildings.push(wall);
    engine.enemies.push(makeEnemy('spitter', HUB_X, 700));
    const hubBefore = engine.hubHp;

    tick((dt) => {
      updateEnemies(engine, dt);
      updateProjectiles(engine, dt);
    }, 12);

    expect(wall.hp).toBeLessThan(480);
    expect(engine.hubHp).toBe(hubBefore); // wall shielded the Hub from acid
  });
});

describe('wall collision: destroyed walls no longer block', () => {
  it('enemy walks straight through a destroyed wall position', () => {
    const engine = makeEngine();
    const wreck = makeBuilding('wall', 22, 18, 480);
    wreck.hp = 0;
    engine.buildings.push(wreck);
    const enemy = makeEnemy('swarmer', HUB_X, 800);
    engine.enemies.push(enemy);

    tick((dt) => updateEnemies(engine, dt), 3);

    expect(enemy.y).toBeGreaterThan(wreck.y); // passed the wreck freely
    expect(engine.buildings).toHaveLength(0); // wreck cleaned up
  });

  it('destroyed wall is not targeted or attacked', () => {
    const engine = makeEngine();
    const wreck = makeBuilding('wall', 22, 18, 480);
    wreck.hp = 0;
    engine.buildings.push(wreck);
    engine.enemies.push(makeEnemy('swarmer', HUB_X, wreck.y - 30));
    const hubBefore = engine.hubHp;

    tick((dt) => updateEnemies(engine, dt), 5);

    expect(wreck.hp).toBe(0); // no wasted attacks on wrecks
    expect(engine.hubHp).toBeLessThan(hubBefore); // went for the Hub instead
  });
});

describe('wall collision: no permanent stuck states', () => {
  it('enemy breaks through an intact wall and reaches the Hub', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480);
    engine.buildings.push(wall);
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);
    const hubBefore = engine.hubHp;

    tick((dt) => updateEnemies(engine, dt), 120);

    expect(engine.buildings).toHaveLength(0); // wall destroyed
    expect(enemy.y).toBeGreaterThan(wall.y); // moved past the wall line
    expect(engine.hubHp).toBeLessThan(hubBefore); // now attacking the Hub
  });

  it('multiple enemies behind one wall all break through eventually', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480);
    engine.buildings.push(wall);
    engine.enemies.push(makeEnemy('swarmer', HUB_X - 20, 700));
    engine.enemies.push(makeEnemy('goliath', HUB_X + 20, 720));
    const hubBefore = engine.hubHp;

    tick((dt) => updateEnemies(engine, dt), 90);

    expect(engine.buildings).toHaveLength(0);
    expect(engine.hubHp).toBeLessThan(hubBefore);
    for (const e of engine.enemies) {
      expect(e.y).toBeGreaterThan(wall.y);
    }
  });
});