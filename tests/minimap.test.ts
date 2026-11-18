import { describe, expect, it } from 'vitest';
import { HUB_X, HUB_Y, TILE_SIZE, WORLD_SIZE } from '@/constants/gameConfig';
import {
  buildMinimapSnapshot,
  minimapToWorld,
  worldToMinimap,
} from '@/engine/rendering/minimap';
import { generatePOIs } from '@/engine/systems/poiSystem';
import { makeBuilding, makeEnemy, makeEngine } from './helpers';

describe('tactical minimap', () => {
  it('maps world coordinates to the minimap and back without an iso/camera transform', () => {
    const size = { width: 320, height: 160 };
    const world = { x: WORLD_SIZE * 0.25, y: WORLD_SIZE * 0.75 };
    const point = worldToMinimap(world, size);
    expect(point.x).toBeCloseTo(80);
    expect(point.y).toBeCloseTo(120);

    const roundTrip = minimapToWorld(point, size);
    expect(roundTrip.x).toBeCloseTo(world.x);
    expect(roundTrip.y).toBeCloseTo(world.y);
    expect(worldToMinimap({ x: 0, y: 0 }, size)).toEqual({ x: 0, y: 0 });
    expect(worldToMinimap({ x: WORLD_SIZE, y: WORLD_SIZE }, size)).toEqual({ x: 320, y: 160 });
  });

  it('includes discovered or activated POIs and hides enemies outside revealed tiles', () => {
    const engine = makeEngine();
    const [discovered, hidden] = generatePOIs().slice(0, 2);
    const relay = generatePOIs().find((poi) => poi.type === 'signal_relay')!;
    discovered.discovered = true;
    relay.completed = true; // activated relays remain useful even in a synthetic undiscovered state
    engine.pois.push(discovered, hidden, relay);

    const visible = makeEnemy('swarmer', HUB_X, HUB_Y);
    const hiddenEnemy = makeEnemy('goliath', TILE_SIZE * 1.5, TILE_SIZE * 1.5);
    engine.enemies.push(visible, hiddenEnemy);
    const snapshot = buildMinimapSnapshot(engine);

    expect(snapshot.pois.map((poi) => poi.id)).toEqual([discovered.id, relay.id]);
    expect(snapshot.enemies.map((enemy) => enemy.id)).toEqual([visible.id]);
    expect(snapshot.rover).toEqual({ x: engine.rover.x, y: engine.rover.y });
    expect(snapshot.hub).toEqual({ x: HUB_X, y: HUB_Y });
    expect(snapshot.revealedTiles.length).toBeGreaterThan(0);
  });

  it('uses radar and activated relays to reveal tiles and their enemies', () => {
    const engine = makeEngine();
    const radar = makeBuilding('radar', 3, 3);
    engine.buildings.push(radar);
    const radarEnemy = makeEnemy('swarmer', radar.x, radar.y);

    const relay = generatePOIs().find((poi) => poi.type === 'signal_relay')!;
    relay.gx = 35;
    relay.gy = 5;
    relay.x = (relay.gx + 0.5) * TILE_SIZE;
    relay.y = (relay.gy + 0.5) * TILE_SIZE;
    relay.completed = true;
    engine.pois.push(relay);
    const relayEnemy = makeEnemy('spitter', relay.x, relay.y);
    engine.enemies.push(radarEnemy, relayEnemy);

    const snapshot = buildMinimapSnapshot(engine);
    expect(snapshot.revealedTiles).toContainEqual({ gx: radar.gx, gy: radar.gy });
    expect(snapshot.revealedTiles).toContainEqual({ gx: relay.gx, gy: relay.gy });
    expect(snapshot.enemies.map((enemy) => enemy.id)).toEqual([radarEnemy.id, relayEnemy.id]);
  });
});
