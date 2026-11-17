import { afterEach, describe, expect, it } from 'vitest';
import { UPGRADES } from '@/constants/gameConfig';
import { getStormDamageMultiplier, updateStorms } from '@/engine/systems/environmentSystem';
import { makeEngine } from './helpers';

/**
 * Phase 2 review fix (Option A): Shield Matrix reduces storm damage by 20%
 * per level with NO hidden floor — level 4 leaves 20% incoming damage (80%
 * reduction), exactly as the upgrade description advertises.
 */

const originalRandom = Math.random;
afterEach(() => {
  Math.random = originalRandom;
});

describe('shield matrix: documented reduction at every level', () => {
  it.each([0, 1, 2, 3, 4])('level %i: multiplier matches 20%% reduction per level', (level) => {
    // Exact deterministic value: 100% / 80% / 60% / 40% / 20% incoming.
    expect(getStormDamageMultiplier(level)).toBe(1 - level * 0.2);
  });

  it('level 4 has no 25% damage floor — the old cap silently limited reduction to 75%', () => {
    expect(getStormDamageMultiplier(4)).toBeLessThan(0.25);
    expect(getStormDamageMultiplier(4)).toBe(1 - 4 * 0.2); // 20% incoming = 80% reduction
  });

  it.each([0, 1, 2, 3, 4])('level %i: an actual storm strike deals exactly 18 × multiplier', (level) => {
    Math.random = () => 0; // force exactly one lightning strike this tick
    const engine = makeEngine();
    engine.stormActive = true;
    engine.stormDuration = 22;
    engine.upgrades.shield_matrix = level;
    engine.hubHp = 1000;

    updateStorms(engine, 0.05);

    expect(engine.hubHp).toBe(1000 - 18 * (1 - level * 0.2));
  });

  it('the upgrade description agrees with the implementation (20% per level)', () => {
    const upg = UPGRADES.find((u) => u.id === 'shield_matrix')!;
    expect(upg.maxLevel).toBe(4);
    expect(upg.desc).toContain('20%'); // "-20% sát thương Bão Từ mỗi cấp"
    // 4 levels × 20% = 80% reduction at max; no floor contradicts this.
    expect(getStormDamageMultiplier(upg.maxLevel)).toBe(1 - upg.maxLevel * 0.2);
  });
});