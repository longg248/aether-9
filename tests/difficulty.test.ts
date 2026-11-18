import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CAMPAIGN_WAVE_INTERVAL_SCALE,
  DEFAULT_DIFFICULTY,
  DIFFICULTY_SETTINGS,
  Difficulty,
  INITIAL_WAVE_DELAY,
  WORLD_SEED,
} from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { getWaveParams, spawnEnemyWave } from '@/engine/systems/enemySystem';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('difficulty settings', () => {
  it('defaults to Normal multipliers and the measured Normal starting state', () => {
    const engine = new AetherGameEngine();
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(engine.difficulty).toBe('normal');
    expect(DIFFICULTY_SETTINGS.normal).toEqual({
      enemyHpScale: 1,
      waveIntervalScale: 1,
      startingResourceScale: 1,
    });
    expect(engine.resources).toEqual({ silicate: 90, iron: 45, aether: 0 });
    expect(engine.waveTimer).toBe(INITIAL_WAVE_DELAY * CAMPAIGN_WAVE_INTERVAL_SCALE);
  });

  it('scales starting resources and preserves the selected setting across reset', () => {
    const easy = new AetherGameEngine(WORLD_SEED, 'easy');
    const hard = new AetherGameEngine(WORLD_SEED, 'hard');
    expect(easy.resources).toEqual({ silicate: 113, iron: 56, aether: 0 });
    expect(hard.resources).toEqual({ silicate: 72, iron: 36, aether: 0 });

    easy.resources = { silicate: 0, iron: 0, aether: 0 };
    easy.reset();
    expect(easy.difficulty).toBe('easy');
    expect(easy.resources).toEqual({ silicate: 113, iron: 56, aether: 0 });
    expect(easy.waveTimer).toBe(
      INITIAL_WAVE_DELAY *
        CAMPAIGN_WAVE_INTERVAL_SCALE *
        DIFFICULTY_SETTINGS.easy.waveIntervalScale
    );
  });

  it.each(['easy', 'normal', 'hard'] as Difficulty[])(
    'applies %s HP and wave-interval multipliers to waves and the boss',
    (difficulty) => {
      vi.spyOn(Math, 'random').mockReturnValue(0.5);
      const engine = new AetherGameEngine(WORLD_SEED, difficulty);
      const setting = DIFFICULTY_SETTINGS[difficulty];
      engine.phaseIndex = 3;
      spawnEnemyWave(engine);

      const wave = getWaveParams(1);
      const regular = engine.enemies.filter((enemy) => enemy.type !== 'behemoth');
      const boss = engine.enemies.find((enemy) => enemy.type === 'behemoth');
      expect(regular).toHaveLength(wave.count);
      for (const enemy of regular) {
        expect(enemy.maxHp).toBeCloseTo(55 * wave.hpScale * setting.enemyHpScale, 6);
      }
      expect(boss?.maxHp).toBeCloseTo(2600 * setting.enemyHpScale, 6);
      expect(engine.waveTimer).toBeCloseTo(
        getWaveParams(1, CAMPAIGN_WAVE_INTERVAL_SCALE * setting.waveIntervalScale).nextWaveIn,
        6
      );
    }
  );
});
