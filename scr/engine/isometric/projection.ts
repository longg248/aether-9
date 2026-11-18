import { TILE_SIZE } from '@/constants/gameConfig';

/**
 * Isometric coordinate math. Three spaces, never mixed:
 *
 * - Grid:  integer/continuous tile coordinates (simulation, pathfinding).
 * - World: canonical simulation pixels, grid * TILE_SIZE (entity positions,
 *          distances, speeds — all gameplay math stays in this space).
 * - Screen: CSS pixels on the viewport (rendering + pointer input only).
 *
 * The diamond projection maps the grid plane to an intermediate "iso plane":
 *   isoX = (gridX - gridY) * tileWidth / 2
 *   isoY = (gridX + gridY) * tileHeight / 2
 * Camera (a world-space center point) and zoom are applied afterwards, so no
 * camera state ever leaks into simulation data.
 */

export interface GridPosition {
  x: number;
  y: number;
}

export interface WorldPosition {
  x: number;
  y: number;
}

export interface ScreenPosition {
  x: number;
  y: number;
}

export interface IsoTileDimensions {
  tileWidth: number;
  tileHeight: number;
}

/** Initial prototype tile footprint (2:1 diamond). */
export const DEFAULT_ISO_TILE: IsoTileDimensions = { tileWidth: 64, tileHeight: 32 };

export interface IsoCamera {
  /** World-space point shown at the viewport center. */
  x: number;
  y: number;
  zoom: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export function gridToWorld(grid: GridPosition, tileSize: number = TILE_SIZE): WorldPosition {
  return { x: grid.x * tileSize, y: grid.y * tileSize };
}

export function worldToGrid(world: WorldPosition, tileSize: number = TILE_SIZE): GridPosition {
  return { x: world.x / tileSize, y: world.y / tileSize };
}

/** Grid → iso plane (diamond projection, no camera). */
export function gridToIso(grid: GridPosition, dims: IsoTileDimensions = DEFAULT_ISO_TILE): ScreenPosition {
  return {
    x: ((grid.x - grid.y) * dims.tileWidth) / 2,
    y: ((grid.x + grid.y) * dims.tileHeight) / 2,
  };
}

/**
 * Iso plane → grid. Inverting the diamond:
 *   isoX / (tw/2) = gridX - gridY ; isoY / (th/2) = gridX + gridY
 *   gridX = isoX/tw + isoY/th ; gridY = isoY/th - isoX/tw
 */
export function isoToGrid(iso: ScreenPosition, dims: IsoTileDimensions = DEFAULT_ISO_TILE): GridPosition {
  const a = iso.x / dims.tileWidth;
  const b = iso.y / dims.tileHeight;
  return { x: a + b, y: b - a };
}

export function worldToIso(world: WorldPosition, dims: IsoTileDimensions = DEFAULT_ISO_TILE): ScreenPosition {
  return gridToIso(worldToGrid(world), dims);
}

export function isoToWorld(iso: ScreenPosition, dims: IsoTileDimensions = DEFAULT_ISO_TILE): WorldPosition {
  return gridToWorld(isoToGrid(iso, dims));
}

/** World → screen: project, subtract the projected camera center, zoom, center. */
export function worldToScreen(
  world: WorldPosition,
  camera: IsoCamera,
  viewport: ViewportSize,
  dims: IsoTileDimensions = DEFAULT_ISO_TILE
): ScreenPosition {
  const iso = worldToIso(world, dims);
  const camIso = worldToIso(camera, dims);
  return {
    x: (iso.x - camIso.x) * camera.zoom + viewport.width / 2,
    y: (iso.y - camIso.y) * camera.zoom + viewport.height / 2,
  };
}

/** Screen → world: exact inverse of worldToScreen (camera + zoom aware). */
export function screenToWorld(
  screen: ScreenPosition,
  camera: IsoCamera,
  viewport: ViewportSize,
  dims: IsoTileDimensions = DEFAULT_ISO_TILE
): WorldPosition {
  const camIso = worldToIso(camera, dims);
  const iso = {
    x: (screen.x - viewport.width / 2) / camera.zoom + camIso.x,
    y: (screen.y - viewport.height / 2) / camera.zoom + camIso.y,
  };
  return isoToWorld(iso, dims);
}

export function gridToScreen(
  grid: GridPosition,
  camera: IsoCamera,
  viewport: ViewportSize,
  dims: IsoTileDimensions = DEFAULT_ISO_TILE
): ScreenPosition {
  return worldToScreen(gridToWorld(grid), camera, viewport, dims);
}

export function screenToGrid(
  screen: ScreenPosition,
  camera: IsoCamera,
  viewport: ViewportSize,
  dims: IsoTileDimensions = DEFAULT_ISO_TILE
): GridPosition {
  return worldToGrid(screenToWorld(screen, camera, viewport, dims));
}

/**
 * Pointer → integer tile. Flooring the continuous grid coordinate picks the
 * correct diamond because the projection is linear: unit grid squares map
 * exactly to screen diamonds.
 */
export function pickTile(
  screen: ScreenPosition,
  camera: IsoCamera,
  viewport: ViewportSize,
  dims: IsoTileDimensions = DEFAULT_ISO_TILE
): GridPosition {
  const grid = screenToGrid(screen, camera, viewport, dims);
  return { x: Math.floor(grid.x), y: Math.floor(grid.y) };
}