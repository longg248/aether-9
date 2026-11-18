import { describe, expect, it } from 'vitest';
import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import { IsoWorldScene } from '@/engine/rendering/pixi/isoWorldScene';
import { worldToIso } from '@/engine/isometric/projection';
import { makeBuilding, makeEnemy, makeEngine, makeNode } from './helpers';

const VIEWPORT = { width: 1280, height: 720 };
const CENTER_CAMERA = { x: HUB_X, y: HUB_Y, zoom: 1 };

describe('IsoWorldScene: construction and sync without a GL context', () => {
  it('builds the full layer stack and the static hub/rover views', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);

    // root = worldLayer + screen-space tint; worldLayer holds the 7 iso layers.
    expect(scene.root.children).toHaveLength(2);
    expect(scene.worldLayer.children).toHaveLength(7);
    // Hub + rover exist from the start; makeEngine clears nodes/pois.
    expect(scene.entityLayer.children).toHaveLength(2);
    expect(scene.entityLayer.sortableChildren).toBe(true);
    scene.destroy();
  });

  it('adds views for new entities and removes them when entities disappear', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    scene.sync(CENTER_CAMERA, VIEWPORT);
    const base = scene.entityLayer.children.length;

    const node = makeNode('silicate', 19, 22, 100);
    engine.nodes.push(node);
    engine.buildings.push(makeBuilding('turret', 20, 20));
    engine.enemies.push(makeEnemy('swarmer', 900, 900));
    scene.sync(CENTER_CAMERA, VIEWPORT);
    expect(scene.entityLayer.children).toHaveLength(base + 3);

    engine.enemies.length = 0;
    scene.sync(CENTER_CAMERA, VIEWPORT);
    expect(scene.entityLayer.children).toHaveLength(base + 2);
    scene.destroy();
  });

  it('depth-sorts entities by ground contact (worldX + worldY)', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    const near = makeEnemy('swarmer', 800, 800);
    const far = makeEnemy('goliath', 1400, 1400);
    engine.enemies.push(near, far);
    scene.sync(CENTER_CAMERA, VIEWPORT);

    const views = scene.entityLayer.children;
    const nearView = views.find((c) => c.zIndex === near.x + near.y);
    const farView = views.find((c) => c.zIndex === far.x + far.y);
    expect(nearView).toBeTruthy();
    expect(farView).toBeTruthy();
    expect(farView!.zIndex).toBeGreaterThan(nearView!.zIndex);
    scene.destroy();
  });

  it('positions the world layer from the iso camera and zoom', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    scene.sync(CENTER_CAMERA, VIEWPORT);
    const camIso = worldToIso({ x: HUB_X, y: HUB_Y });
    expect(scene.worldLayer.position.x).toBeCloseTo(VIEWPORT.width / 2 - camIso.x);
    expect(scene.worldLayer.position.y).toBeCloseTo(VIEWPORT.height / 2 - camIso.y);
    expect(scene.worldLayer.scale.x).toBe(1);

    scene.sync({ x: HUB_X, y: HUB_Y, zoom: 2 }, VIEWPORT);
    expect(scene.worldLayer.scale.x).toBe(2);
    expect(scene.worldLayer.position.x).toBeCloseTo(VIEWPORT.width / 2 - camIso.x * 2);
    scene.destroy();
  });

  it('rebuilds entity views when the engine resets (runId changes)', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    engine.buildings.push(makeBuilding('solar', 20, 20));
    scene.sync(CENTER_CAMERA, VIEWPORT);
    const before = scene.entityLayer.children.length;
    expect(before).toBeGreaterThan(2);

    engine.reset();
    scene.sync(CENTER_CAMERA, VIEWPORT);
    // Reset regenerates the seeded world: hub + rover + every node/POI view,
    // and the previous run's building view is gone.
    expect(scene.entityLayer.children).toHaveLength(2 + engine.nodes.length + engine.pois.length);
    scene.destroy();
  });

  it('destroy tears down the scene graph', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    scene.sync(CENTER_CAMERA, VIEWPORT);
    scene.destroy();
    expect(scene.root.destroyed).toBe(true);
  });
});