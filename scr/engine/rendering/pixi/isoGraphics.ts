import { Container, Graphics, Matrix } from 'pixi.js';
import { DEFAULT_ISO_TILE, IsoTileDimensions } from '@/engine/isometric/projection';

/** '#rrggbb' → Pixi numeric color. */
export function hex(color: string): number {
  return parseInt(color.slice(1), 16);
}

export function shade(color: string, factor: number): number {
  const n = hex(color);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((n & 255) * factor));
  return (r << 16) | (g << 8) | b;
}

/**
 * Extruded iso box sitting on the ground plane, origin at its ground-contact
 * center. Footprint is a diamond (halfW × halfH); `height` lifts the top face.
 * Left face is darkest, right mid, top light — consistent sun from the right.
 */
export function drawIsoBox(
  g: Graphics,
  halfW: number,
  halfH: number,
  height: number,
  color: string,
  alpha = 1
): void {
  // Left face
  g.poly([-halfW, -height, 0, -height + halfH, 0, halfH, -halfW, 0]).fill({
    color: shade(color, 0.55),
    alpha,
  });
  // Right face
  g.poly([halfW, -height, 0, -height + halfH, 0, halfH, halfW, 0]).fill({
    color: shade(color, 0.75),
    alpha,
  });
  // Top face
  g.poly([0, -height - halfH, halfW, -height, 0, -height + halfH, -halfW, -height]).fill({
    color: shade(color, 1.15),
    alpha,
  });
}

export function drawGroundShadow(g: Graphics, halfW: number, halfH: number, alpha = 0.4): void {
  g.ellipse(0, 2, halfW, halfH).fill({ color: 0x000000, alpha });
}

/**
 * Container whose local axes are GRID units, transformed into the iso plane by
 * the diamond matrix. Axis-aligned unit squares drawn inside become diamonds:
 * used for terrain and fog so both stay a single batched Graphics each.
 */
export function createGridSpaceContainer(dims: IsoTileDimensions = DEFAULT_ISO_TILE): Container {
  const c = new Container();
  const hw = dims.tileWidth / 2;
  const hh = dims.tileHeight / 2;
  // x' = hw*gx - hw*gy ; y' = hh*gx + hh*gy
  c.setFromMatrix(new Matrix(hw, hh, -hw, hh, 0, 0));
  return c;
}

/** Project a world-space direction angle into the iso plane (for turrets etc). */
export function isoAngle(worldAngle: number, dims: IsoTileDimensions = DEFAULT_ISO_TILE): number {
  const dx = Math.cos(worldAngle);
  const dy = Math.sin(worldAngle);
  return Math.atan2(((dx + dy) * dims.tileHeight) / 2, ((dx - dy) * dims.tileWidth) / 2);
}