import { describe, expect, it } from 'vitest';
import { BUILDING_COLLISION_RADIUS, HUB_X, HUB_Y } from '@/constants/gameConfig';
import { updateEnemies, updateProjectiles } from '@/engine/systems/enemySystem';
import type { AetherGameEngine } from '@/engine/gameEngine';
import type { EnemyEntity } from '@/types/game';
import { makeBuilding, makeEnemy, makeEngine, tick } from './helpers';

/** After a resolved frame, no intact wall may overlap the enemy. */
function expectNoPenetration(engine: AetherGameEngine, enemy: EnemyEntity): void {
  const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;
  for (const b of engine.buildings) {
    if (b.type !== 'wall' || b.hp <= 0) continue;
    expect(Math.hypot(enemy.x - b.x, enemy.y - b.y)).toBeGreaterThanOrEqual(minDist - 0.5);
  }
}

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

describe('wall collision: continuous rows and corners', () => {
  it('a continuous row of adjacent walls blocks and is broken through', () => {
    const engine = makeEngine();
    const row = [];
    for (let gx = 20; gx <= 24; gx++) row.push(makeBuilding('wall', gx, 18, 480));
    engine.buildings.push(...row);
    const rowY = row[0].y;
    const enemy = makeEnemy('goliath', HUB_X, 700);
    engine.enemies.push(enemy);
    const hubBefore = engine.hubHp;

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
    }, 10);

    expect(enemy.y).toBeLessThan(rowY); // held at the row
    expect(row.some((w) => w.hp < 480)).toBe(true); // attacks the blocker

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
    }, 140);

    expect(row.some((w) => w.hp <= 0)).toBe(true); // breached a section
    expect(enemy.y).toBeGreaterThan(rowY); // passed the row line
    expect(engine.hubHp).toBeLessThan(hubBefore);
  });

  it('enemy knocked into an L-shaped corner is pushed clear of EVERY wall', () => {
    const engine = makeEngine();
    // Corner at (18,18): horizontal arm to the right, vertical arm downward.
    for (let gx = 18; gx <= 22; gx++) engine.buildings.push(makeBuilding('wall', gx, 18, 480));
    for (let gy = 19; gy <= 21; gy++) engine.buildings.push(makeBuilding('wall', 18, gy, 480));
    const enemy = makeEnemy('swarmer', 18.5 * 48 + 17, 18.5 * 48 + 17); // inside the corner overlap
    engine.enemies.push(enemy);

    updateEnemies(engine, 0.05);

    // A single push-out pass can shove the enemy into the neighbouring wall;
    // after resolution it must be clear of all intact walls at once.
    expectNoPenetration(engine, enemy);
  });

  it('an enemy at an L-corner keeps fighting without penetrating or freezing', () => {
    const engine = makeEngine();
    for (let gx = 18; gx <= 22; gx++) engine.buildings.push(makeBuilding('wall', gx, 18, 480));
    for (let gy = 19; gy <= 21; gy++) engine.buildings.push(makeBuilding('wall', 18, gy, 480));
    const enemy = makeEnemy('goliath', 18.5 * 48 + 10, 18.5 * 48 - 40);
    engine.enemies.push(enemy);
    const start = { x: enemy.x, y: enemy.y };

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
    }, 60);

    const walls = engine.buildings.filter((b) => b.type === 'wall');
    expect(walls.some((w) => w.hp < 480) || walls.length < 7).toBe(true); // fought the corner
    expect(Math.hypot(enemy.x - start.x, enemy.y - start.y)).toBeGreaterThan(5); // not frozen
  });

  it('a U-shaped pocket open toward the Hub does not trap the enemy', () => {
    const engine = makeEngine();
    for (let gx = 18; gx <= 26; gx++) engine.buildings.push(makeBuilding('wall', gx, 18, 480));
    for (let gy = 19; gy <= 21; gy++) {
      engine.buildings.push(makeBuilding('wall', 18, gy, 480));
      engine.buildings.push(makeBuilding('wall', 26, gy, 480));
    }
    const enemy = makeEnemy('swarmer', HUB_X, 20.5 * 48); // inside the pocket, Hub is nearest target
    engine.enemies.push(enemy);
    const hubBefore = engine.hubHp;

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
    }, 15);

    expect(enemy.y).toBeGreaterThan(HUB_Y - 60); // walked out through the opening
    expect(engine.hubHp).toBeLessThan(hubBefore);
    expect(engine.buildings).toHaveLength(15); // no wall needed to be destroyed
  });
});

describe('wall collision: several enemies on one section', () => {
  it('a clustered swarm shares the blocker, breaks it and passes without penetrating', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480);
    engine.buildings.push(wall);
    const enemies = [
      makeEnemy('swarmer', HUB_X - 15, 700),
      makeEnemy('swarmer', HUB_X, 705),
      makeEnemy('swarmer', HUB_X + 15, 700),
      makeEnemy('goliath', HUB_X - 8, 720),
      makeEnemy('goliath', HUB_X + 8, 725),
    ];
    engine.enemies.push(...enemies);
    const hubBefore = engine.hubHp;

    tick((dt) => {
      updateEnemies(engine, dt);
      for (const e of engine.enemies) expectNoPenetration(engine, e);
    }, 60);

    expect(wall.hp).toBeLessThan(480);
    expect(engine.buildings).toHaveLength(0); // section destroyed
    expect(engine.hubHp).toBeLessThan(hubBefore);
    for (const e of engine.enemies) {
      expect(e.y).toBeGreaterThan(wall.y); // none left stuck behind the wreck
    }
  });
});

describe('wall collision: destroyed section inside a row', () => {
  it('a wrecked section neither blocks movement nor absorbs attacks', () => {
    const engine = makeEngine();
    const left = makeBuilding('wall', 18, 18, 480);
    const wreck = makeBuilding('wall', 22, 18, 480); // middle section destroyed
    wreck.hp = 0;
    const right = makeBuilding('wall', 26, 18, 480);
    engine.buildings.push(left, wreck, right);
    // Enemy knocked exactly into the wrecked section: it must walk straight
    // out toward the Hub while the intact flanks keep blocking nothing here.
    const enemy = makeEnemy('swarmer', wreck.x, wreck.y);
    engine.enemies.push(enemy);
    const hubBefore = engine.hubHp;

    updateEnemies(engine, 0.05);
    expect(enemy.y).toBeGreaterThan(wreck.y); // wreck did not push the enemy out
    expect(wreck.hp).toBe(0); // wreck absorbed no attack

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
    }, 10);

    expect(engine.hubHp).toBeLessThan(hubBefore); // reached the Hub through the gap
    expect(left.hp).toBe(480); // intact flanks untouched on this path
    expect(right.hp).toBe(480);
    expect(engine.buildings).toHaveLength(2); // only the wreck was cleaned up
  });

  it('an enemy facing a row with a wrecked section breaches an intact one', () => {
    const engine = makeEngine();
    const row = [];
    for (let gx = 20; gx <= 24; gx++) row.push(makeBuilding('wall', gx, 18, 480));
    const wreck = row[2];
    wreck.hp = 0;
    engine.buildings.push(...row);
    const enemy = makeEnemy('goliath', HUB_X, 700);
    engine.enemies.push(enemy);

    tick((dt) => {
      updateEnemies(engine, dt);
      expect(wreck.hp).toBe(0); // never "re-damaged" or healed
      expectNoPenetration(engine, enemy);
    }, 120);

    // Nearest-target AI fights an intact section; the wreck is never a blocker.
    expect(row.some((w) => w !== wreck && w.hp <= 0)).toBe(true);
    expect(enemy.y).toBeGreaterThan(wreck.y); // passed the row line
  });
});