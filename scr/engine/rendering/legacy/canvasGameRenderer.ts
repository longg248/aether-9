import type { AetherGameEngine } from '@/engine/gameEngine';
import type { GameRenderer, WorldPoint } from '@/engine/rendering/gameRenderer';
import { buildTerrainCanvas } from '@/engine/rendering/legacy/terrainTexture';
import { renderWorld } from '@/engine/rendering/renderer';

/**
 * Legacy top-down Canvas2D renderer, kept operational behind the GameRenderer
 * boundary (fallback when WebGL is unavailable). All canvas/DOM state lives
 * here — never in the simulation.
 */
export class CanvasGameRenderer implements GameRenderer {
  public readonly kind = 'canvas' as const;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private terrainCanvas: HTMLCanvasElement | null = null;
  private width = 0;
  private height = 0;
  private destroyed = false;

  public async init(host: HTMLElement): Promise<void> {
    if (this.destroyed) return;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'h-full w-full cursor-crosshair block';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    if (!this.canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(width * dpr);
    const h = Math.floor(height * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  public render(engine: AetherGameEngine): void {
    if (!this.canvas || !this.ctx || this.width === 0) return;
    if (!this.terrainCanvas) this.terrainCanvas = buildTerrainCanvas(engine.terrain);
    const dpr = window.devicePixelRatio || 1;
    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    renderWorld(engine, this.ctx, this.width, this.height, this.terrainCanvas);
    this.ctx.restore();
  }

  public screenToWorld(engine: AetherGameEngine, screenX: number, screenY: number): WorldPoint {
    return {
      x: screenX + engine.camera.x - this.width / 2,
      y: screenY + engine.camera.y - this.height / 2,
    };
  }

  public destroy(): void {
    this.destroyed = true;
    this.canvas?.remove();
    this.canvas = null;
    this.ctx = null;
    this.terrainCanvas = null;
  }
}