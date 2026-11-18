import { describe, expect, it } from 'vitest';
import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { worldToIso } from '@/engine/isometric/projection';
import { IsoWorldScene } from '@/engine/rendering/pixi/isoWorldScene';
import { Particle } from '@/types/game';
import { makeEngine } from './helpers';

const VIEWPORT = { width: 1280, height: 720 };
const CENTER_CAMERA = { x: HUB_X, y: HUB_Y, zoom: 1 };

function spawnParticles(engine: AetherGameEngine, count: number): void {
  engine.particles = Array.from({ length: count }, (_, i): Particle => ({
    x: 500 + i * 10,
    y: 700 + i * 5,
    vx: 0,
    vy: 0,
    size: 2 + (i % 3),
    color: i % 2 === 0 ? '#ff0000' : '#38bdf8',
    alpha: 0.75,
    life: 1,
    maxLife: 1,
  }));
}

describe('IsoWorldScene: pooled particle effects', () => {
  it('uses one shared texture, additive blending, and projected particle transforms', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    spawnParticles(engine, 2);
    scene.sync(CENTER_CAMERA, VIEWPORT);

    const particles = scene.particleLayer.particleChildren;
    expect(particles).toHaveLength(2);
    expect(particles[0].texture).toBe(particles[1].texture);
    expect(scene.particleLayer.blendMode).toBe('add');
    const iso = worldToIso(engine.particles[0]);
    expect(particles[0].x).toBe(iso.x);
    expect(particles[0].y).toBe(iso.y - 4);
    expect(particles[0].scaleX).toBeCloseTo(engine.particles[0].size / 7);
    expect(particles[0].scaleY).toBe(particles[0].scaleX);
    expect(particles[0].tint).toBe(0xff0000);
    expect(particles[0].alpha).toBe(0.75);
    scene.destroy();
  });

  it('reuses the high-water-mark pool through many spawn/expire cycles', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    spawnParticles(engine, 8);
    scene.sync(CENTER_CAMERA, VIEWPORT);
    const original = [...scene.particleLayer.particleChildren];
    expect(original).toHaveLength(8);

    for (let cycle = 0; cycle < 30; cycle++) {
      engine.particles.length = 0;
      scene.sync(CENTER_CAMERA, VIEWPORT);
      expect(scene.particleLayer.particleChildren).toHaveLength(8);
      expect(scene.particleLayer.particleChildren.every((particle) => particle.alpha === 0)).toBe(true);

      spawnParticles(engine, (cycle % 8) + 1);
      scene.sync(CENTER_CAMERA, VIEWPORT);
      expect(scene.particleLayer.particleChildren).toHaveLength(8);
      expect(scene.particleLayer.particleChildren).toEqual(original);
    }

    spawnParticles(engine, 3);
    scene.sync(CENTER_CAMERA, VIEWPORT);
    expect(scene.particleLayer.particleChildren.slice(0, 3)).toEqual(original.slice(0, 3));
    expect(scene.particleLayer.particleChildren[3].alpha).toBe(0);
    scene.destroy();
  });
});
