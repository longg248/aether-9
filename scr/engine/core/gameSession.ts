import { GameLoop } from '@/engine/core/gameLoop';
import type { AetherGameEngine } from '@/engine/gameEngine';
import type { GameRenderer, WorldPoint } from '@/engine/rendering/gameRenderer';

/**
 * Owns the runtime wiring around a pure simulation: renderer lifecycle, the
 * fixed-timestep loop and host resizing. React only creates/destroys sessions
 * and forwards input — it never runs the loop itself.
 */
export class GameSession {
  private readonly loop: GameLoop;
  private host: HTMLElement | null = null;
  private disposed = false;
  private attached = false;

  constructor(
    public readonly engine: AetherGameEngine,
    public readonly renderer: GameRenderer
  ) {
    this.loop = new GameLoop(
      (dt) => this.engine.update(dt),
      () => {
        if (!this.attached || this.disposed) return;
        this.syncSize();
        this.renderer.render(this.engine);
      }
    );
  }

  public async attach(host: HTMLElement): Promise<void> {
    this.host = host;
    await this.renderer.init(host);
    // StrictMode can dispose the session while renderer init is still pending.
    if (this.disposed) {
      this.renderer.destroy();
      return;
    }
    this.attached = true;
    this.syncSize();
    this.loop.start();
  }

  public screenToWorld(screenX: number, screenY: number): WorldPoint {
    return this.renderer.screenToWorld(this.engine, screenX, screenY);
  }

  /** Called when the tab becomes visible again: never fast-forward the sim. */
  public resetClock(): void {
    this.loop.resetClock();
  }

  public detach(): void {
    this.disposed = true;
    this.attached = false;
    this.loop.stop();
    this.renderer.destroy();
    this.host = null;
  }

  private syncSize(): void {
    if (!this.host || this.disposed) return;
    const rect = this.host.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.renderer.resize(rect.width, rect.height);
    }
  }
}