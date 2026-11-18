import { Graphics } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { HUB_X, HUB_Y } from '@/constants/gameConfig';
import { worldToIso } from '@/engine/isometric/projection';
import { IsoWorldScene } from '@/engine/rendering/pixi/isoWorldScene';
import { generatePOIs } from '@/engine/systems/poiSystem';
import { makeEngine } from './helpers';

const VIEWPORT = { width: 1280, height: 720 };
const CENTER_CAMERA = { x: HUB_X, y: HUB_Y, zoom: 1 };

function pinShape(scene: IsoWorldScene, poiId: string): Graphics {
  const pin = scene.poiPinLayer.children.find((child) => child.label === `poi-pin:${poiId}`);
  expect(pin).toBeTruthy();
  return pin!.children[0] as Graphics;
}

describe('IsoWorldScene: POI map pins', () => {
  it('creates and removes discovered pins above fog, with zoom-stable sizing', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    const poi = generatePOIs()[0];
    scene.sync(CENTER_CAMERA, VIEWPORT);
    expect(scene.poiPinLayer.children).toHaveLength(0);

    poi.discovered = true;
    engine.pois.push(poi);
    scene.sync(CENTER_CAMERA, VIEWPORT);
    expect(scene.poiPinLayer.children).toHaveLength(1);
    expect(scene.poiPinLayer.parent).toBe(scene.markerLayer);
    expect(scene.worldLayer.getChildIndex(scene.markerLayer)).toBeGreaterThan(
      scene.worldLayer.getChildIndex(scene.fogSpace)
    );

    const pin = scene.poiPinLayer.children[0];
    const iso = worldToIso(poi);
    expect(pin.position.x).toBe(iso.x);
    expect(pin.position.y).toBe(iso.y);
    expect(pin.scale.x).toBe(1);

    scene.sync({ ...CENTER_CAMERA, zoom: 2 }, VIEWPORT);
    expect(pin.scale.x).toBe(0.5);
    expect(pin.scale.y).toBe(0.5);

    poi.discovered = false;
    scene.sync({ ...CENTER_CAMERA, zoom: 2 }, VIEWPORT);
    expect(scene.poiPinLayer.children).toHaveLength(0);
    scene.destroy();
  });

  it('uses the POI accent while active and grey when completed', () => {
    const engine = makeEngine();
    const scene = new IsoWorldScene(engine);
    const [active, completed] = generatePOIs().slice(0, 2);
    active.discovered = true;
    completed.discovered = true;
    completed.completed = true;
    engine.pois.push(active, completed);
    scene.sync(CENTER_CAMERA, VIEWPORT);

    expect(pinShape(scene, active.id).tint).toBe(0xc084fc);
    expect(pinShape(scene, active.id).alpha).toBe(1);
    expect(pinShape(scene, completed.id).tint).toBe(0x64748b);
    expect(pinShape(scene, completed.id).alpha).toBe(0.8);
    scene.destroy();
  });
});
