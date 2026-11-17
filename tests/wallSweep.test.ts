import { describe, expect, it } from 'vitest';
import { BUILDING_COLLISION_RADIUS, HUB_X } from '@/constants/gameConfig';
import { updateEnemies } from '@/engine/systems/enemySystem';
import type { AetherGameEngine } from '@/engine/gameEngine';
import type { EnemyEntity } from '@/types/game';
import { makeBuilding, makeEnemy, makeEngine, tick } from './helpers';

/**
 * Phase 2 review fixes: swept/substepped wall collision, side preservation
 * and post-resolution blocker re-evaluation. These tests assert actual enemy
 * positions and wall HP — not merely that update() completes.
 */

const WALL_ROW_HP = 1_000_000; // effectively unbreakable within the test window

function expectNoPenetration(engine: AetherGameEngine, enemy: EnemyEntity): void {
  const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;
  for (const b of engine.buildings) {
    if (b.type !== 'wall' || b.hp <= 0) continue;
    expect(Math.hypot(enemy.x - b.x, enemy.y - b.y)).toBeGreaterThanOrEqual(minDist - 0.5);
  }
}

describe('wall sweep: intact rows are impassable', () => {
  it('an enemy assaulting a continuous row never crosses it', () => {
    const engine = makeEngine();
    const row = [];
    for (let gx = 18; gx <= 26; gx++) row.push(makeBuilding('wall', gx, 18, WALL_ROW_HP));
    engine.buildings.push(...row);
    const rowY = row[0].y;
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);
    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
      // Held on the approach side at the contact line — every single frame.
      expect(enemy.y).toBeLessThanOrEqual(rowY - minDist + 0.5);
    }, 20);

    expect(row.some((w) => w.hp < WALL_ROW_HP)).toBe(true); // fought the blocker
    expect(enemy.y).toBeLessThan(rowY); // never crossed the row line
  });

  it('a single oversized frame step cannot teleport the enemy across the row', () => {
    const engine = makeEngine();
    const row = [];
    for (let gx = 20; gx <= 24; gx++) row.push(makeBuilding('wall', gx, 18, WALL_ROW_HP));
    engine.buildings.push(...row);
    const rowY = row[0].y;
    const enemy = makeEnemy('swarmer', HUB_X, 800);
    engine.enemies.push(enemy);
    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;

    // dt = 10s would move the enemy 680px — straight through the row if
    // collision only inspected the final position. Substeps must prevent it.
    updateEnemies(engine, 10);

    expectNoPenetration(engine, enemy);
    expect(enemy.y).toBeLessThanOrEqual(rowY - minDist + 0.5);
    expect(enemy.y).toBeLessThan(rowY);
  });
});

describe('wall sweep: cancelled normals never displace across a wall', () => {
  it('an enemy knocked between two adjacent walls resolves locally, not across the line', () => {
    const engine = makeEngine();
    const left = makeBuilding('wall', 21, 18, WALL_ROW_HP);
    const right = makeBuilding('wall', 22, 18, WALL_ROW_HP);
    engine.buildings.push(left, right);
    const enemy = makeEnemy('swarmer', (left.x + right.x) / 2, left.y);
    engine.enemies.push(enemy);
    const start = { x: enemy.x, y: enemy.y };
    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;

    updateEnemies(engine, 0.05);

    expectNoPenetration(engine, enemy);
    // Local resolution only: at most a minimal contact-distance recovery,
    // never a multi-reach teleport down-range across the wall line (the old
    // final-position-only escape could commit to reach k*minDist candidates).
    expect(Math.abs(enemy.y - left.y)).toBeLessThanOrEqual(minDist + 0.001);
    expect(Math.hypot(enemy.x - start.x, enemy.y - start.y)).toBeLessThanOrEqual(2 * minDist);
  });

  it('sustained movement and attacks keep the enemy on its side of an intact wall', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, WALL_ROW_HP);
    engine.buildings.push(wall);
    const enemy = makeEnemy('goliath', HUB_X, 700);
    engine.enemies.push(enemy);
    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;
    const hubBefore = engine.hubHp;

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
      expect(enemy.y).toBeLessThanOrEqual(wall.y - minDist + 0.5);
    }, 30);

    expect(wall.hp).toBeLessThan(WALL_ROW_HP); // attacked the wall, not bypassed it
    expect(engine.hubHp).toBe(hubBefore); // the wall fully shielded the Hub
  });
});

describe('wall sweep: corners and dense layouts do not stall', () => {
  it('an enemy at an L-shaped corner keeps fighting without penetrating or freezing', () => {
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

  it('an enemy knocked into a dense 2x2 block resolves clear and keeps acting', () => {
    const engine = makeEngine();
    const block = [
      makeBuilding('wall', 21, 17, 480),
      makeBuilding('wall', 22, 17, 480),
      makeBuilding('wall', 21, 18, 480),
      makeBuilding('wall', 22, 18, 480),
    ];
    engine.buildings.push(...block);
    const enemy = makeEnemy('swarmer', 22 * 48, 18 * 48); // exact block center
    engine.enemies.push(enemy);

    updateEnemies(engine, 0.05);
    const minDist = enemy.radius + BUILDING_COLLISION_RADIUS;
    for (const b of block) {
      expect(Math.hypot(enemy.x - b.x, enemy.y - b.y)).toBeGreaterThanOrEqual(minDist - 0.001);
    }

    const start = { x: enemy.x, y: enemy.y };
    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
    }, 60);
    const moved = Math.hypot(enemy.x - start.x, enemy.y - start.y);
    const fought = block.some((w) => w.hp < 480) || engine.buildings.length < 4;
    expect(moved > 5 || fought).toBe(true); // no permanent stall
  });
});

describe('wall sweep: destroyed walls are inert', () => {
  it('a wall at hp <= 0 neither blocks movement nor absorbs attacks', () => {
    const engine = makeEngine();
    const wreck = makeBuilding('wall', 22, 18, 480);
    wreck.hp = -5; // below zero must behave exactly like zero
    engine.buildings.push(wreck);
    const enemy = makeEnemy('swarmer', HUB_X, 800);
    engine.enemies.push(enemy);
    const hubBefore = engine.hubHp;

    tick((dt) => updateEnemies(engine, dt), 4);

    expect(enemy.y).toBeGreaterThan(wreck.y); // walked straight through
    expect(wreck.hp).toBe(-5); // never re-damaged or healed
    expect(engine.hubHp).toBeLessThan(hubBefore);
    expect(engine.buildings).toHaveLength(0); // wreck cleaned up
  });
});

describe('wall sweep: only live, in-range walls take damage', () => {
  it('a distant wall is never damaged through a stale blocker reference', () => {
    const engine = makeEngine();
    const near = makeBuilding('wall', 22, 18, 40); // low HP: falls quickly
    const far = makeBuilding('wall', 22, 10, 480); // far behind the enemy
    engine.buildings.push(near, far);
    const enemy = makeEnemy('swarmer', HUB_X, 840);
    engine.enemies.push(enemy);
    const hubBefore = engine.hubHp;

    tick((dt) => {
      updateEnemies(engine, dt);
      expectNoPenetration(engine, enemy);
      expect(far.hp).toBe(480); // every frame: the distant wall stays pristine
    }, 12);

    expect(near.hp).toBeLessThanOrEqual(0); // the contact wall was broken
    expect(far.hp).toBe(480);
    expect(enemy.y).toBeGreaterThan(near.y); // passed through the breach
    expect(engine.hubHp).toBeLessThan(hubBefore);
  });

  it('a low-HP wall is broken through quickly and the enemy advances', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 30);
    engine.buildings.push(wall);
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);

    let breachedAt = -1;
    for (let t = 0; t < 10; t += 0.05) {
      updateEnemies(engine, 0.05);
      if (wall.hp <= 0) {
        breachedAt = t;
        break;
      }
    }

    // 30 HP / 11 damage per 1.1s swing + ~2s approach: well under 8 seconds.
    expect(breachedAt).toBeGreaterThanOrEqual(0);
    expect(breachedAt).toBeLessThan(8);

    tick((dt) => updateEnemies(engine, dt), 5);
    expect(enemy.y).toBeGreaterThan(wall.y); // moved past the fallen wall
  });
});