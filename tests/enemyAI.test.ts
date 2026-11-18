import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN_WAVE_INTERVAL_SCALE, HUB_X, TILE_SIZE } from '@/constants/gameConfig';
import {
  WAVE_HP_SCALE_CAP,
  getWaveParams,
  spawnEnemyWave,
  updateEnemies,
  updateProjectiles,
} from '@/engine/systems/enemySystem';
import { makeBuilding, makeEnemy, makeEngine, tick } from './helpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('wave progression: predictable difficulty curve', () => {
  it('count grows with the wave and caps at 22', () => {
    expect(getWaveParams(1).count).toBe(5);
    expect(getWaveParams(5).count).toBe(12);
    expect(getWaveParams(11).count).toBe(21);
    expect(getWaveParams(12).count).toBe(22);
    expect(getWaveParams(50).count).toBe(22);
  });

  it('interval shrinks with the wave and floors at 55s', () => {
    expect(getWaveParams(1).nextWaveIn).toBe(106);
    expect(getWaveParams(10).nextWaveIn).toBe(70);
    expect(getWaveParams(13).nextWaveIn).toBe(58);
    expect(getWaveParams(14).nextWaveIn).toBe(55);
    expect(getWaveParams(50).nextWaveIn).toBe(55);
  });

  it('HP scale grows linearly but is capped so maxed defenses stay viable', () => {
    expect(getWaveParams(1).hpScale).toBeCloseTo(1.14, 10);
    expect(getWaveParams(10).hpScale).toBeCloseTo(2.4, 10);
    expect(getWaveParams(15).hpScale).toBe(WAVE_HP_SCALE_CAP);
    expect(getWaveParams(100).hpScale).toBe(WAVE_HP_SCALE_CAP);
  });

  it('the curve is monotonic across waves 1..40', () => {
    for (let w = 2; w <= 40; w++) {
      const prev = getWaveParams(w - 1);
      const cur = getWaveParams(w);
      expect(cur.count).toBeGreaterThanOrEqual(prev.count);
      expect(cur.hpScale).toBeGreaterThanOrEqual(prev.hpScale);
      expect(cur.nextWaveIn).toBeLessThanOrEqual(prev.nextWaveIn);
    }
  });

  it('spawner applies the curve: enemy count, HP scale and next-wave timer', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = makeEngine();
    engine.waveTimer = 0;
    updateEnemies(engine, 0.05);

    const params = getWaveParams(1, CAMPAIGN_WAVE_INTERVAL_SCALE);
    expect(engine.waveCount).toBe(1);
    expect(engine.enemies).toHaveLength(params.count);
    expect(engine.waveTimer).toBe(params.nextWaveIn);
    for (const e of engine.enemies) {
      expect(e.maxHp).toBeCloseTo(55 * params.hpScale, 6);
    }
  });

  it('wave composition introduces goliaths at wave 3 and spitters at wave 4', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = makeEngine();

    spawnEnemyWave(engine); // wave 1
    expect(engine.enemies.every((e) => e.type === 'swarmer')).toBe(true);

    engine.enemies = [];
    spawnEnemyWave(engine); // wave 2
    expect(engine.enemies.every((e) => e.type === 'swarmer')).toBe(true);

    engine.enemies = [];
    spawnEnemyWave(engine); // wave 3
    expect(engine.enemies.some((e) => e.type === 'goliath')).toBe(true);
    expect(engine.enemies.some((e) => e.type === 'spitter')).toBe(false);

    engine.enemies = [];
    spawnEnemyWave(engine); // wave 4
    expect(engine.enemies.some((e) => e.type === 'spitter')).toBe(true);
  });

  it('Behemoth spawns exactly once when phase 3+ is reached', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const engine = makeEngine();
    engine.phaseIndex = 3;

    spawnEnemyWave(engine);
    const bosses = engine.enemies.filter((e) => e.type === 'behemoth');
    expect(bosses).toHaveLength(1);
    expect(bosses[0].maxHp).toBe(2600); // boss HP is fixed, not wave-scaled

    spawnEnemyWave(engine);
    expect(engine.enemies.filter((e) => e.type === 'behemoth')).toHaveLength(1);
    expect(engine.bossSpawned).toBe(true);
  });
});

describe('enemy AI: weighted target selection', () => {
  it('prefers the Hub over a nearer but peripheral wall', () => {
    const engine = makeEngine();
    // Wall is closer (304px) than the Hub (380px) but off the direct path;
    // weight 1.35 makes its score 411 > 380, so the Hub wins.
    const wall = makeBuilding('wall', 27, 18, 480);
    engine.buildings.push(wall);
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);

    updateEnemies(engine, 0.05);

    expect(enemy.angle).toBeCloseTo(Math.PI / 2, 6); // straight at the Hub
    expect(enemy.x).toBeCloseTo(HUB_X, 6);
    expect(enemy.y).toBeGreaterThan(700);
    expect(wall.hp).toBe(480); // not attacked while unblocking
  });

  it('prefers a turret over an equidistant wall (threat priority)', () => {
    const engine = makeEngine();
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);
    // Both ~268px away: turret score 0.85*d beats wall score 1.35*d.
    const turret = makeBuilding('turret', 26, 18, 240);
    const wall = makeBuilding('wall', 18, 18, 480);
    engine.buildings.push(turret, wall);

    updateEnemies(engine, 0.05);

    // Heading is computed from the pre-move position (HUB_X, 700).
    const toTurret = Math.atan2(turret.y - 700, turret.x - HUB_X);
    expect(enemy.angle).toBeCloseTo(toTurret, 6);
  });

  it('a blocking wall is still attacked even when the Hub is the target', () => {
    const engine = makeEngine();
    const wall = makeBuilding('wall', 22, 18, 480); // directly between enemy and Hub
    engine.buildings.push(wall);
    engine.enemies.push(makeEnemy('swarmer', HUB_X, 700));

    tick((dt) => updateEnemies(engine, dt), 6);

    expect(wall.hp).toBeLessThan(480);
    expect(engine.hubHp).toBe(1200); // wall shielded the Hub
  });

  it('retargets immediately when the current target is destroyed', () => {
    const engine = makeEngine();
    const turret = makeBuilding('turret', 26, 18, 240); // off-axis: distinct heading
    engine.buildings.push(turret);
    const enemy = makeEnemy('swarmer', HUB_X, 700);
    engine.enemies.push(enemy);

    updateEnemies(engine, 0.05);
    const angleAtTurret = enemy.angle;
    expect(angleAtTurret).not.toBeCloseTo(Math.PI / 2, 3);

    turret.hp = 0; // destroyed; cleanup runs at the end of updateEnemies
    updateEnemies(engine, 0.05);

    expect(enemy.angle).not.toBe(angleAtTurret);
    expect(enemy.angle).toBeCloseTo(Math.PI / 2, 1); // now heads for the Hub
    expect(engine.buildings).toHaveLength(0); // wreck removed
  });

  it('does not stall when surrounded by a sealed wall ring', () => {
    const engine = makeEngine();
    // 3x3 ring of walls around the enemy at (22,18)
    const walls = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        const w = makeBuilding('wall', 22 + dx, 18 + dy, 480);
        walls.push(w);
        engine.buildings.push(w);
      }
    }
    const enemy = makeEnemy('swarmer', (22.5) * TILE_SIZE, (18.5) * TILE_SIZE);
    engine.enemies.push(enemy);

    tick((dt) => updateEnemies(engine, dt), 120);

    // It fights its way out instead of freezing: some wall is damaged/destroyed
    // and the enemy never rests inside an intact wall.
    expect(walls.some((w) => w.hp < 480)).toBe(true);
    for (const w of engine.buildings) {
      if (w.type === 'wall' && w.hp > 0) {
        expect(Math.hypot(w.x - enemy.x, w.y - enemy.y)).toBeGreaterThanOrEqual(
          enemy.radius + TILE_SIZE * 0.5 - 0.001
        );
      }
    }
  });

  it('navigates staggered wall rows without penetrating or freezing', () => {
    const engine = makeEngine();
    // Two offset rows forming a chicane above the Hub approach lane.
    for (let gx = 18; gx <= 24; gx++) engine.buildings.push(makeBuilding('wall', gx, 16, 480));
    for (let gx = 20; gx <= 26; gx++) engine.buildings.push(makeBuilding('wall', gx, 19, 480));
    const enemy = makeEnemy('swarmer', HUB_X, 600);
    engine.enemies.push(enemy);

    tick((dt) => {
      updateEnemies(engine, dt);
      updateProjectiles(engine, dt);
    }, 150);

    // Reached the Hub (dealing damage) or is still fighting — never inside a wall.
    for (const w of engine.buildings) {
      if (w.type === 'wall' && w.hp > 0) {
        expect(Math.hypot(w.x - enemy.x, w.y - enemy.y)).toBeGreaterThanOrEqual(
          enemy.radius + TILE_SIZE * 0.5 - 0.001
        );
      }
    }
    expect(engine.hubHp < 1200 || enemy.y > 16 * TILE_SIZE).toBe(true);
  });
});