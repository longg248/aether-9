import type { GameRenderer } from '@/engine/rendering/gameRenderer';
import { CanvasGameRenderer } from '@/engine/rendering/legacy/canvasGameRenderer';

/**
 * Picks the best available renderer: PixiJS/WebGL when the browser supports it,
 * the legacy Canvas renderer otherwise (also the jsdom test path). Pixi is
 * loaded lazily so the fallback bundle never pays for it.
 */
export async function createRenderer(): Promise<GameRenderer> {
  if (typeof WebGL2RenderingContext !== 'undefined') {
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (gl) {
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        const { PixiGameRenderer } = await import('@/engine/rendering/pixi/pixiGameRenderer');
        return new PixiGameRenderer();
      }
    } catch {
      // WebGL probe or module load failed — fall back to Canvas below.
    }
  }
  return new CanvasGameRenderer();
}