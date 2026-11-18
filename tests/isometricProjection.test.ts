import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '@/constants/gameConfig';
import {
  DEFAULT_ISO_TILE,
  IsoCamera,
  ViewportSize,
  gridToIso,
  gridToScreen,
  gridToWorld,
  isoToGrid,
  isoToWorld,
  pickTile,
  screenToGrid,
  screenToWorld,
  worldToGrid,
  worldToIso,
  worldToScreen,
} from '@/engine/isometric/projection';

const viewport: ViewportSize = { width: 1280, height: 720 };
const camera: IsoCamera = { x: 1080, y: 1080, zoom: 1 }; // hub center

const expectClose = (a: { x: number; y: number }, b: { x: number; y: number }, eps = 1e-9) => {
  expect(a.x).toBeCloseTo(b.x, -Math.log10(eps));
  expect(a.y).toBeCloseTo(b.y, -Math.log10(eps));
};

describe('isometric projection: grid <-> world', () => {
  it('converts with the canonical tile size', () => {
    expect(gridToWorld({ x: 3, y: 5 })).toEqual({ x: 3 * TILE_SIZE, y: 5 * TILE_SIZE });
    expect(worldToGrid({ x: 3 * TILE_SIZE, y: 5 * TILE_SIZE })).toEqual({ x: 3, y: 5 });
  });

  it('round-trips negative and fractional coordinates', () => {
    for (const g of [
      { x: -4, y: -7 },
      { x: -2.5, y: 3.25 },
      { x: 0, y: 0 },
      { x: 43.9, y: 0.1 },
    ]) {
      expectClose(worldToGrid(gridToWorld(g)), g);
    }
  });
});

describe('isometric projection: diamond math', () => {
  it('matches the reference diamond formula', () => {
    const { tileWidth, tileHeight } = DEFAULT_ISO_TILE;
    expect(gridToIso({ x: 2, y: 3 })).toEqual({
      x: ((2 - 3) * tileWidth) / 2,
      y: ((2 + 3) * tileHeight) / 2,
    });
  });

  it('inverts exactly (grid -> iso -> grid)', () => {
    for (const g of [
      { x: 0, y: 0 },
      { x: 5, y: 2 },
      { x: -3, y: -8 },
      { x: 12.34, y: -5.67 },
    ]) {
      expectClose(isoToGrid(gridToIso(g)), g);
    }
  });

  it('world -> iso -> world round-trips through the tile scale', () => {
    for (const w of [
      { x: 0, y: 0 },
      { x: 1080, y: 1080 },
      { x: -240, y: 960 },
      { x: 123.4, y: 567.8 },
    ]) {
      expectClose(isoToWorld(worldToIso(w)), w, 1e-6);
    }
  });

  it('supports configurable tile dimensions', () => {
    const dims = { tileWidth: 128, tileHeight: 64 };
    expect(gridToIso({ x: 1, y: 0 }, dims)).toEqual({ x: 64, y: 32 });
    expectClose(isoToGrid(gridToIso({ x: 2, y: 7 }, dims), dims), { x: 2, y: 7 });
  });
});

describe('isometric projection: camera, zoom, viewport', () => {
  it('places the camera world point at the viewport center', () => {
    expectClose(worldToScreen({ x: camera.x, y: camera.y }, camera, viewport), {
      x: viewport.width / 2,
      y: viewport.height / 2,
    });
  });

  it('screen <-> world round-trips with camera offset and zoom', () => {
    const cams: IsoCamera[] = [
      { x: 0, y: 0, zoom: 1 },
      { x: 1080, y: 1080, zoom: 1 },
      { x: 300, y: 1700, zoom: 0.5 },
      { x: 2000, y: 100, zoom: 2.5 },
      { x: -100, y: -100, zoom: 1.75 },
    ];
    for (const cam of cams) {
      for (const s of [
        { x: 0, y: 0 },
        { x: 640, y: 360 },
        { x: 1279, y: 719 },
        { x: -50, y: 900 },
      ]) {
        expectClose(worldToScreen(screenToWorld(s, cam, viewport), cam, viewport), s, 1e-6);
      }
    }
  });

  it('gridToScreen / screenToGrid compose the tile scale correctly', () => {
    const cam: IsoCamera = { x: 500, y: 900, zoom: 1.3 };
    for (const g of [
      { x: 0, y: 0 },
      { x: 22, y: 22 },
      { x: -3, y: 40 },
    ]) {
      expectClose(screenToGrid(gridToScreen(g, cam, viewport), cam, viewport), g, 1e-6);
    }
  });

  it('zoom scales distances from the viewport center', () => {
    const world = { x: camera.x + 96, y: camera.y }; // 2 tiles east in world px
    const at1 = worldToScreen(world, { ...camera, zoom: 1 }, viewport);
    const at2 = worldToScreen(world, { ...camera, zoom: 2 }, viewport);
    const d1 = Math.hypot(at1.x - 640, at1.y - 360);
    const d2 = Math.hypot(at2.x - 640, at2.y - 360);
    expect(d2).toBeCloseTo(d1 * 2, 6);
  });
});

describe('isometric picking: screen -> tile', () => {
  it('picks the tile whose center projects under the cursor', () => {
    const cam: IsoCamera = { x: 1080, y: 1080, zoom: 1 };
    for (const tile of [
      { x: 22, y: 22 },
      { x: 0, y: 0 },
      { x: 43, y: 43 },
      { x: 5, y: 30 },
      { x: 30, y: 5 },
    ]) {
      const center = gridToWorld({ x: tile.x + 0.5, y: tile.y + 0.5 });
      const screen = worldToScreen(center, cam, viewport);
      expect(pickTile(screen, cam, viewport)).toEqual(tile);
    }
  });

  it('picks correctly after camera movement and zoom', () => {
    const cam: IsoCamera = { x: 400, y: 1600, zoom: 2.2 };
    const tile = { x: 8, y: 33 };
    const center = gridToWorld({ x: tile.x + 0.5, y: tile.y + 0.5 });
    const screen = worldToScreen(center, cam, viewport);
    expect(pickTile(screen, cam, viewport)).toEqual(tile);
  });

  it('diamond edges resolve to the right tile (no square-grid bias)', () => {
    const cam: IsoCamera = { x: 1080, y: 1080, zoom: 1 };
    // Just inside the four corners of tile (22,22)'s diamond.
    const corners = [
      { x: 22.02, y: 22.02 }, // top corner region (grid min,min)
      { x: 22.98, y: 22.02 }, // right corner region
      { x: 22.02, y: 22.98 }, // left corner region
      { x: 22.98, y: 22.98 }, // bottom corner region
    ];
    for (const c of corners) {
      const screen = worldToScreen(gridToWorld(c), cam, viewport);
      expect(pickTile(screen, cam, viewport)).toEqual({ x: 22, y: 22 });
    }
    // Just outside the right corner belongs to the neighbouring tile.
    const outside = worldToScreen(gridToWorld({ x: 23.02, y: 22.02 }), cam, viewport);
    expect(pickTile(outside, cam, viewport)).toEqual({ x: 23, y: 22 });
  });

  it('handles negative grid coordinates', () => {
    const cam: IsoCamera = { x: -200, y: -200, zoom: 1 };
    const tile = { x: -5, y: -4 };
    const center = gridToWorld({ x: tile.x + 0.5, y: tile.y + 0.5 });
    const screen = worldToScreen(center, cam, viewport);
    expect(pickTile(screen, cam, viewport)).toEqual(tile);
  });
});