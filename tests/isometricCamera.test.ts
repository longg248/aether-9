import { describe, expect, it } from 'vitest';
import { IsoCameraController, ISO_ZOOM_MAX, ISO_ZOOM_MIN } from '@/engine/isometric/camera';
import { worldToScreen } from '@/engine/isometric/projection';
import { makeEngine } from './helpers';

describe('IsoCameraController', () => {
  it('defaults to the simulation follow camera at zoom 1', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    const c = cam.getCamera(engine);
    expect(c.x).toBe(engine.camera.x);
    expect(c.y).toBe(engine.camera.y);
    expect(c.zoom).toBe(1);
  });

  it('drag-pan moves the world with the cursor (screen-space drag)', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    const probe = { x: engine.rover.x + 120, y: engine.rover.y - 80 };
    const before = worldToScreen(probe, cam.getCamera(engine), { width: 1280, height: 720 });
    cam.panByScreen(64, 32);
    const after = worldToScreen(probe, cam.getCamera(engine), { width: 1280, height: 720 });
    expect(after.x - before.x).toBeCloseTo(64, 6);
    expect(after.y - before.y).toBeCloseTo(32, 6);
  });

  it('wheel zoom keeps the world point under the cursor fixed', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    const cursor = { x: 900, y: 250 };
    const before = cam.screenToWorld(engine, cursor.x, cursor.y);
    cam.zoomAt(engine, cursor.x, cursor.y, 1.4);
    const after = cam.screenToWorld(engine, cursor.x, cursor.y);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(cam.zoom).toBeCloseTo(1.4, 6);
  });

  it('clamps zoom to the configured bounds', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    for (let i = 0; i < 20; i++) cam.zoomAt(engine, 640, 360, 1.5);
    expect(cam.zoom).toBe(ISO_ZOOM_MAX);
    for (let i = 0; i < 40; i++) cam.zoomAt(engine, 640, 360, 0.5);
    expect(cam.zoom).toBe(ISO_ZOOM_MIN);
  });

  it('recenter snaps back to the rover follow camera', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    cam.panByScreen(300, -200);
    expect(cam.isPanned).toBe(true);
    cam.recenter();
    expect(cam.isPanned).toBe(false);
    const c = cam.getCamera(engine);
    expect(c.x).toBe(engine.camera.x);
    expect(c.y).toBe(engine.camera.y);
  });

  it('screenToWorld agrees with the projection of the effective camera', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    cam.panByScreen(-150, 90);
    cam.zoomAt(engine, 400, 300, 1.8);
    const viewport = { width: 1280, height: 720 };
    const screen = { x: 512, y: 384 };
    const viaController = cam.screenToWorld(engine, screen.x, screen.y);
    const roundTrip = worldToScreen(viaController, cam.getCamera(engine), viewport);
    expect(roundTrip.x).toBeCloseTo(screen.x, 6);
    expect(roundTrip.y).toBeCloseTo(screen.y, 6);
  });

  it('never writes pan or zoom back into simulation state', () => {
    const engine = makeEngine();
    const cam = new IsoCameraController();
    cam.setViewport(1280, 720);
    const before = { ...engine.camera };
    cam.panByScreen(500, 500);
    cam.zoomAt(engine, 100, 100, 2);
    expect(engine.camera).toEqual(before);
  });
});