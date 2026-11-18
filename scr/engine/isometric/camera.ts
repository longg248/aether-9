import { WORLD_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import {
  DEFAULT_ISO_TILE,
  IsoCamera,
  IsoTileDimensions,
  ViewportSize,
  WorldPosition,
  gridToWorld,
  isoToGrid,
  screenToWorld,
} from '@/engine/isometric/projection';

export const ISO_ZOOM_MIN = 0.5;
export const ISO_ZOOM_MAX = 2.5;
/** How far the camera center may leave the world edge while panning. */
const PAN_MARGIN = 480;

/**
 * Render-side camera: the simulation keeps following the rover in world px
 * (engine.camera); this controller adds user pan + zoom on top without ever
 * writing back into simulation state.
 */
export class IsoCameraController {
  public zoom = 1;
  private panX = 0;
  private panY = 0;
  private viewport: ViewportSize = { width: 1, height: 1 };

  constructor(private readonly dims: IsoTileDimensions = DEFAULT_ISO_TILE) {}

  public setViewport(width: number, height: number): void {
    this.viewport = { width, height };
  }

  /** Effective camera for projection. Shake is added by the renderer only. */
  public getCamera(engine: AetherGameEngine): IsoCamera {
    const x = clamp(engine.camera.x + this.panX, -PAN_MARGIN, WORLD_SIZE + PAN_MARGIN);
    const y = clamp(engine.camera.y + this.panY, -PAN_MARGIN, WORLD_SIZE + PAN_MARGIN);
    return { x, y, zoom: this.zoom };
  }

  public screenToWorld(engine: AetherGameEngine, screenX: number, screenY: number): WorldPosition {
    return screenToWorld({ x: screenX, y: screenY }, this.getCamera(engine), this.viewport, this.dims);
  }

  /** Drag-pan: a screen-space pointer delta moves the world with the cursor. */
  public panByScreen(dx: number, dy: number): void {
    const iso = { x: dx / this.zoom, y: dy / this.zoom };
    const world = gridToWorld(isoToGrid(iso, this.dims));
    this.panX -= world.x;
    this.panY -= world.y;
    this.clampPan();
  }

  /** Wheel zoom anchored at the cursor: the world point under it stays fixed. */
  public zoomAt(engine: AetherGameEngine, screenX: number, screenY: number, factor: number): void {
    const before = this.screenToWorld(engine, screenX, screenY);
    this.zoom = clamp(this.zoom * factor, ISO_ZOOM_MIN, ISO_ZOOM_MAX);
    const after = this.screenToWorld(engine, screenX, screenY);
    this.panX += before.x - after.x;
    this.panY += before.y - after.y;
    this.clampPan();
  }

  /** Snap back to following the rover (movement keys / center action). */
  public recenter(): void {
    this.panX = 0;
    this.panY = 0;
  }

  public get isPanned(): boolean {
    return this.panX !== 0 || this.panY !== 0;
  }

  private clampPan(): void {
    // Keep the effective center inside the world (plus margin) by limiting the
    // offset relative to the current follow target is not possible here without
    // the engine; getCamera clamps the final center, pan itself stays bounded.
    const limit = WORLD_SIZE + PAN_MARGIN * 2;
    this.panX = clamp(this.panX, -limit, limit);
    this.panY = clamp(this.panY, -limit, limit);
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}