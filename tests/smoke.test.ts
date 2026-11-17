import { describe, expect, it } from 'vitest';
import { TARGET_WARP_AETHER } from '@/constants/gameConfig';
import { makeEngine, tick } from './helpers';

describe('test infrastructure smoke', () => {
  it('constructs the engine with a stubbed terrain canvas', () => {
    const engine = makeEngine();
    expect(engine.status).toBe('playing');
    expect(engine.terrainCanvas).toBeTruthy();
    expect(engine.resources.aether).toBeGreaterThanOrEqual(0);
  });

  it('runs the full update loop without throwing', () => {
    const engine = makeEngine();
    tick((dt) => engine.update(dt), 2);
    expect(engine.elapsed).toBeGreaterThan(0);
    expect(engine.status).toBe('playing');
  });

  it('preserves the 1,200 Aether victory condition', () => {
    expect(TARGET_WARP_AETHER).toBe(1200);
    const engine = makeEngine();
    engine.warpProgress = TARGET_WARP_AETHER;
    engine.update(0.05);
    expect(engine.status).toBe('victory');
  });
});