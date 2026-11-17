import { GRID_SIZE, HUB_GX, HUB_GY, HUB_X, HUB_Y, TILE_SIZE, WORLD_SIZE } from '@/constants/gameConfig';
import { BuildingEntity, PoiEntity, ResourceNode, ResourceType } from '@/types/game';

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

export function createProceduralTerrain(): {
  canvas: HTMLCanvasElement;
  craters: CraterDecor[];
  flora: FloraDecor[];
} {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_SIZE;
  canvas.height = WORLD_SIZE;
  const ctx = canvas.getContext('2d')!;

  // Base alien iron-oxide ground
  const baseGrad = ctx.createRadialGradient(HUB_X, HUB_Y, 120, HUB_X, HUB_Y, WORLD_SIZE * 0.72);
  baseGrad.addColorStop(0, '#2a1815');
  baseGrad.addColorStop(0.55, '#1d1214');
  baseGrad.addColorStop(1, '#120b10');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, WORLD_SIZE, WORLD_SIZE);

  // Subtle basalt patches & surface grain
  for (let i = 0; i < 420; i++) {
    const px = ((i * 7919) % WORLD_SIZE);
    const py = ((i * 6271) % WORLD_SIZE);
    const rx = 28 + (i % 75);
    const ry = 18 + (i % 50);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(68, 34, 28, 0.16)' : 'rgba(15, 10, 18, 0.22)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, ry, (i % 6) * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing subsurface Aether veins
  ctx.save();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.14)';
  ctx.lineWidth = 2.5;
  for (let v = 0; v < 18; v++) {
    let vx = ((v * 3313) % (WORLD_SIZE - 400)) + 200;
    let vy = ((v * 4999) % (WORLD_SIZE - 400)) + 200;
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    for (let s = 0; s < 7; s++) {
      vx += Math.cos(v + s * 1.1) * 85;
      vy += Math.sin(v * 1.3 + s) * 85;
      ctx.lineTo(vx, vy);
    }
    ctx.stroke();
  }
  ctx.restore();

  // 3D-shaded impact craters
  const craters: CraterDecor[] = [];
  for (let c = 0; c < 56; c++) {
    const cx = ((c * 5101 + 317) % (WORLD_SIZE - 260)) + 130;
    const cy = ((c * 8831 + 521) % (WORLD_SIZE - 260)) + 130;
    if (Math.hypot(cx - HUB_X, cy - HUB_Y) < 230) continue;
    const r = 24 + (c % 44);
    craters.push({ x: cx, y: cy, r });

    // Sunlit rim highlight
    ctx.fillStyle = 'rgba(180, 95, 72, 0.18)';
    ctx.beginPath();
    ctx.arc(cx + 3, cy + 3, r + 3, 0, Math.PI * 2);
    ctx.fill();

    // Crater bowl
    const bowlGrad = ctx.createRadialGradient(cx + r * 0.25, cy + r * 0.25, r * 0.1, cx, cy, r);
    bowlGrad.addColorStop(0, '#140c0f');
    bowlGrad.addColorStop(0.75, '#0b070a');
    bowlGrad.addColorStop(1, '#291716');
    ctx.fillStyle = bowlGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle tactical grid lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.032)';
  ctx.lineWidth = 1;
  for (let g = 0; g <= GRID_SIZE; g++) {
    const pos = g * TILE_SIZE;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, WORLD_SIZE);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(WORLD_SIZE, pos);
    ctx.stroke();
  }

  // Bioluminescent alien flora
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

  return { canvas, craters, flora };
}

export function generateResourceNodes(pois: PoiEntity[] = []): ResourceNode[] {
  const nodes: ResourceNode[] = [];
  const occupied = new Set<string>();

  // Reserve 3x3 hub area
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      occupied.add(`${HUB_GX + dx},${HUB_GY + dy}`);
    }
  }
  // POI tiles are reserved world features (deposits carry their own node).
  for (const p of pois) occupied.add(`${p.gx},${p.gy}`);

  const placeCluster = (type: ResourceType, count: number, minDist: number, maxDist: number, amount: number) => {
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < 2500) {
      guard++;
      const gx = 2 + Math.floor(Math.random() * (GRID_SIZE - 4));
      const gy = 2 + Math.floor(Math.random() * (GRID_SIZE - 4));
      const dist = Math.hypot(gx - HUB_GX, gy - HUB_GY);
      const key = `${gx},${gy}`;
      if (dist >= minDist && dist <= maxDist && !occupied.has(key)) {
        occupied.add(key);
        nodes.push({
          id: `node_${type}_${placed}_${gx}_${gy}`,
          type,
          gx,
          gy,
          x: (gx + 0.5) * TILE_SIZE,
          y: (gy + 0.5) * TILE_SIZE,
          amount,
          maxAmount: amount,
          pulse: Math.random() * Math.PI * 2,
          seed: Math.random() * 100,
        });
        placed++;
      }
    }
  };

  placeCluster('silicate', 26, 2.5, 18, 450);
  placeCluster('iron', 20, 4.5, 19, 400);
  placeCluster('aether', 14, 7.5, 20, 350);

  return nodes;
}

/** Activated relays reveal the same radius as a Radar building. */
export const RELAY_REVEAL_RADIUS = 8.5 * TILE_SIZE;

export function isTileRevealed(
  gx: number,
  gy: number,
  roverX: number,
  roverY: number,
  buildings: BuildingEntity[],
  /** Activated signal relays: permanent radar-like reveal sources. */
  relays?: ReadonlyArray<{ x: number; y: number }>
): boolean {
  const tx = (gx + 0.5) * TILE_SIZE;
  const ty = (gy + 0.5) * TILE_SIZE;

  if (Math.hypot(tx - HUB_X, ty - HUB_Y) <= 7.5 * TILE_SIZE) return true;
  if (Math.hypot(tx - roverX, ty - roverY) <= 6.2 * TILE_SIZE) return true;

  for (const b of buildings) {
    if (b.type === 'radar' && Math.hypot(tx - b.x, ty - b.y) <= 8.5 * TILE_SIZE) {
      return true;
    }
  }
  if (relays) {
    for (const r of relays) {
      if (Math.hypot(tx - r.x, ty - r.y) <= RELAY_REVEAL_RADIUS) return true;
    }
  }
  return false;
}