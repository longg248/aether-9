import { Application } from 'pixi.js';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { IsoCameraController } from '@/engine/isometric/camera';
import type { GameRenderer, WorldPoint } from '@/engine/rendering/gameRenderer';
import { IsoWorldScene } from './isoWorldScene';

const MOVEMENT_KEYS = ['w', 'a', 's', 'd'];

/**
 * PixiJS 8 renderer: owns the Application, the iso scene and the render-side
 * camera (wheel zoom + right/middle-drag pan). The simulation is only read.
 */
export class PixiGameRenderer implements GameRenderer {
  public readonly kind = 'pixi' as const;

  private app: Application | null = null;
  private scene: IsoWorldScene | null = null;
  private readonly camera = new IsoCameraController();
  private width = 1;
  private height = 1;
  private destroyed = false;
  private lastEngine: AetherGameEngine | null = null;
  private drag: { pointerId: number; x: number; y: number } | null = null;
  private detachInput: (() => void) | null = null;

  public async init(host: HTMLElement): Promise<void> {
    const app = new Application();
    await app.init({
      preference: 'webgl',
      background: '#09060c',
      width: Math.max(1, host.clientWidth),
      height: Math.max(1, host.clientHeight),
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true,
      autoStart: false, // the GameSession loop drives rendering
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    app.canvas.style.display = 'block';
    host.appendChild(app.canvas);
    this.attachInput(app.canvas);
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.setViewport(width, height);
    this.app?.renderer.resize(width, height);
  }

  public render(engine: AetherGameEngine): void {
    if (!this.app || this.destroyed) return;
    this.lastEngine = engine;
    if (!this.scene) {
      this.scene = new IsoWorldScene(engine);
      this.app.stage.addChild(this.scene.root);
    }
    // Pressing a movement key re-engages rover follow after a manual pan.
    if (this.camera.isPanned && MOVEMENT_KEYS.some((k) => engine.keys.has(k))) {
      this.camera.recenter();
    }
    this.scene.sync(this.camera.getCamera(engine), { width: this.width, height: this.height });
    this.app.render();
  }

  public screenToWorld(engine: AetherGameEngine, screenX: number, screenY: number): WorldPoint {
    return this.camera.screenToWorld(engine, screenX, screenY);
  }

  public destroy(): void {
    this.destroyed = true;
    this.detachInput?.();
    this.detachInput = null;
    this.drag = null;
    this.scene = null;
    this.lastEngine = null;
    // destroy(true) removes the canvas; children:true tears down the stage tree.
    this.app?.destroy(true, { children: true });
    this.app = null;
  }

  private attachInput(canvas: HTMLCanvasElement): void {
    const localPoint = (e: MouseEvent | WheelEvent | PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!this.lastEngine) return;
      const p = localPoint(e);
      this.camera.zoomAt(this.lastEngine, p.x, p.y, e.deltaY < 0 ? 1.12 : 1 / 1.12);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 1 && e.button !== 2) return;
      e.preventDefault();
      this.drag = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!this.drag || e.pointerId !== this.drag.pointerId) return;
      this.camera.panByScreen(e.clientX - this.drag.x, e.clientY - this.drag.y);
      this.drag.x = e.clientX;
      this.drag.y = e.clientY;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (this.drag?.pointerId === e.pointerId) this.drag = null;
    };
    const onContextMenu = (e: Event) => e.preventDefault();

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    this.detachInput = () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }
}