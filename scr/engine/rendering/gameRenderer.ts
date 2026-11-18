import type { AetherGameEngine } from '@/engine/gameEngine';

export interface WorldPoint {
  x: number;
  y: number;
}

/**
 * Boundary between the simulation and whatever draws it. Implementations own
 * all DOM/Canvas/GPU state; the engine never imports them. Screen coordinates
 * are CSS pixels relative to the host element's top-left.
 */
export interface GameRenderer {
  readonly kind: 'pixi' | 'canvas';
  init(host: HTMLElement): Promise<void>;
  resize(width: number, height: number): void;
  render(engine: AetherGameEngine): void;
  /** Inverse camera transform: CSS-pixel pointer position → canonical world px. */
  screenToWorld(engine: AetherGameEngine, screenX: number, screenY: number): WorldPoint;
  destroy(): void;
}