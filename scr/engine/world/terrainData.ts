import { HUB_X, HUB_Y, WORLD_SIZE } from '@/constants/gameConfig';

export interface CraterDecor {
  x: number;
  y: number;
  r: number;
}

export interface FloraDecor {
  x: number;
  y: number;
  size: number;
  hue: number;
  phase: number;
}

export interface BasaltPatch {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  dark: boolean;
}

export interface TerrainData {
  patches: BasaltPatch[];
  /** Glowing subsurface aether veins, as world-space polylines. */
  veins: { x: number; y: number }[][];
  craters: CraterDecor[];
  flora: FloraDecor[];
}

/**
 * Pure, deterministic terrain data — no DOM/Canvas. The legacy texture builder
 * and the isometric renderer both consume this, so the simulation never needs
 * a browser environment. Formulas are the original modular-arithmetic layout
 * (unchanged), keeping the world identical across renderers and runs.
 */
export function generateTerrainData(): TerrainData {
  const patches: BasaltPatch[] = [];
  for (let i = 0; i < 420; i++) {
    patches.push({
      x: (i * 7919) % WORLD_SIZE,
      y: (i * 6271) % WORLD_SIZE,
      rx: 28 + (i % 75),
      ry: 18 + (i % 50),
      rotation: (i % 6) * 0.5,
      dark: i % 2 !== 0,
    });
  }

  const veins: { x: number; y: number }[][] = [];
  for (let v = 0; v < 18; v++) {
    let vx = ((v * 3313) % (WORLD_SIZE - 400)) + 200;
    let vy = ((v * 4999) % (WORLD_SIZE - 400)) + 200;
    const line = [{ x: vx, y: vy }];
    for (let s = 0; s < 7; s++) {
      vx += Math.cos(v + s * 1.1) * 85;
      vy += Math.sin(v * 1.3 + s) * 85;
      line.push({ x: vx, y: vy });
    }
    veins.push(line);
  }

  const craters: CraterDecor[] = [];
  for (let c = 0; c < 56; c++) {
    const cx = ((c * 5101 + 317) % (WORLD_SIZE - 260)) + 130;
    const cy = ((c * 8831 + 521) % (WORLD_SIZE - 260)) + 130;
    if (Math.hypot(cx - HUB_X, cy - HUB_Y) < 230) continue;
    craters.push({ x: cx, y: cy, r: 24 + (c % 44) });
  }

  const flora: FloraDecor[] = [];
  for (let f = 0; f < 95; f++) {
    const fx = ((f * 4219 + 190) % (WORLD_SIZE - 160)) + 80;
    const fy = ((f * 7331 + 290) % (WORLD_SIZE - 160)) + 80;
    if (Math.hypot(fx - HUB_X, fy - HUB_Y) < 190) continue;
    flora.push({
      x: fx,
      y: fy,
      size: 5 + (f % 7),
      hue: f % 2 === 0 ? 175 : 285,
      phase: f * 0.7,
    });
  }

  return { patches, veins, craters, flora };
}