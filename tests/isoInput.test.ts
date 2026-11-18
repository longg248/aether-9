import { describe, expect, it } from 'vitest';
import { BUILDINGS, TILE_SIZE } from '@/constants/gameConfig';
import { IsoCameraController } from '@/engine/isometric/camera';
import { gridToScreen } from '@/engine/isometric/projection';
import { createRenderer } from '@/engine/rendering/createRenderer';
import { applyIsoMovementKeys, isIsoMovementKey } from '@/engine/systems/isoInput';
import { makeEngine, tick } from './helpers';

describe('isoInput: physical → logical key remap', () => {
  it('recognizes WASD and arrows, case-insensitively', () => {
    for (const k of ['w', 'a', 's', 'd', 'W', 'ArrowUp', 'arrowleft']) {
      expect(isIsoMovementKey(k)).toBe(true);
    }
    for (const k of ['q', ' ', '1', 't', 'escape']) {
      expect(isIsoMovementKey(k)).toBe(false);
    }
  });

  it('W maps to the world-axis pair that reads as screen-up', () => {
    const engine = makeEngine();
    applyIsoMovementKeys(engine, new Set(['w']));
    expect([...engine.keys].sort()).toEqual(['a', 'w']);
  });

  it('held keys combine as a union (W+D = world -y)', () => {
    const engine = makeEngine();
    applyIsoMovementKeys(engine, new Set(['w', 'd']));
    expect([...engine.keys].sort()).toEqual(['a', 'd', 'w']);

    applyIsoMovementKeys(engine, new Set(['w']));
    expect([...engine.keys].sort()).toEqual(['a', 'w']);

    applyIsoMovementKeys(engine, new Set());
    expect(engine.keys.size).toBe(0);
  });

  it('never touches non-movement keys already held', () => {
    const engine = makeEngine();
    engine.keys.add('q');
    applyIsoMovementKeys(engine, new Set(['s']));
    expect(engine.keys.has('q')).toBe(true);
    expect([...engine.keys].sort()).toEqual(['d', 'q', 's']);
  });

  it('screen-up input moves the rover toward decreasing world x AND y', () => {
    const engine = makeEngine();
    applyIsoMovementKeys(engine, new Set(['w']));
    const { x, y } = engine.rover;
    tick((dt) => engine.update(dt), 0.5);
    expect(engine.rover.x).toBeLessThan(x);
    expect(engine.rover.y).toBeLessThan(y);
  });

  it('screen-right input moves the rover toward +x / -y', () => {
    const engine = makeEngine();
    applyIsoMovementKeys(engine, new Set(['d']));
    const { x, y } = engine.rover;
    tick((dt) => engine.update(dt), 0.5);
    expect(engine.rover.x).toBeGreaterThan(x);
    expect(engine.rover.y).toBeLessThan(y);
  });
});

describe('iso click chain: screen → camera-aware pick → gameplay', () => {
  const viewport = { width: 800, height: 600 };

  function pannedZoomedCamera(engine: ReturnType<typeof makeEngine>): IsoCameraController {
    const camera = new IsoCameraController();
    camera.setViewport(viewport.width, viewport.height);
    camera.panByScreen(120, -80);
    camera.zoomAt(engine, viewport.width / 2, viewport.height / 2, 1.5);
    return camera;
  }

  it('places a building on the picked tile after pan + zoom and deducts its cost', () => {
    const engine = makeEngine();
    const camera = pannedZoomedCamera(engine);
    const tile = { x: 25, y: 22 }; // revealed, outside the hub exclusion zone
    const screen = gridToScreen({ x: tile.x + 0.5, y: tile.y + 0.5 }, camera.getCamera(engine), viewport);

    // Same wiring as AetherGame.tsx: screenToWorld → hover tile / world click.
    const world = camera.screenToWorld(engine, screen.x, screen.y);
    expect({ gx: Math.floor(world.x / TILE_SIZE), gy: Math.floor(world.y / TILE_SIZE) }).toEqual({
      gx: tile.x,
      gy: tile.y,
    });

    const silicateBefore = engine.resources.silicate;
    engine.selectedBuild = 'solar';
    engine.handleWorldClick(world.x, world.y);

    expect(engine.buildings).toHaveLength(1);
    expect(engine.buildings[0].type).toBe('solar');
    expect({ gx: engine.buildings[0].gx, gy: engine.buildings[0].gy }).toEqual({ gx: tile.x, gy: tile.y });
    expect(silicateBefore - engine.resources.silicate).toBe(BUILDINGS.solar.cost.silicate);
  });

  it('without a build selection, the same click chain commands rover movement', () => {
    const engine = makeEngine();
    const camera = pannedZoomedCamera(engine);
    const target = { x: 27.5, y: 24.5 };
    const screen = gridToScreen(target, camera.getCamera(engine), viewport);
    const world = camera.screenToWorld(engine, screen.x, screen.y);

    engine.handleWorldClick(world.x, world.y);

    expect(engine.rover.moveTarget).not.toBeNull();
    expect(engine.rover.moveTarget!.x).toBeCloseTo(target.x * TILE_SIZE, 3);
    expect(engine.rover.moveTarget!.y).toBeCloseTo(target.y * TILE_SIZE, 3);
  });
});

describe('createRenderer: environment-based selection', () => {
  it('falls back to the canvas renderer when WebGL2 is unavailable (jsdom)', async () => {
    const renderer = await createRenderer();
    expect(renderer.kind).toBe('canvas');
    renderer.destroy();
  });
});