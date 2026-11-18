import { GRID_SIZE, HUB_X, HUB_Y, TILE_SIZE, WORLD_SIZE } from '@/constants/gameConfig';
import { TerrainData } from '@/engine/world/terrainData';

/**
 * Legacy top-down terrain texture. Rendering-only: consumes pure TerrainData
 * and produces the offscreen canvas the Canvas2D renderer blits each frame.
 * The simulation never touches this module.
 */
export function buildTerrainCanvas(terrain: TerrainData): HTMLCanvasElement {
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
  for (const p of terrain.patches) {
    ctx.fillStyle = p.dark ? 'rgba(15, 10, 18, 0.22)' : 'rgba(68, 34, 28, 0.16)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, p.rx, p.ry, p.rotation, 0, Math.PI * 2);
    ctx.fill();
  }

  // Glowing subsurface Aether veins
  ctx.save();
  ctx.strokeStyle = 'rgba(168, 85, 247, 0.14)';
  ctx.lineWidth = 2.5;
  for (const line of terrain.veins) {
    ctx.beginPath();
    ctx.moveTo(line[0].x, line[0].y);
    for (let i = 1; i < line.length; i++) ctx.lineTo(line[i].x, line[i].y);
    ctx.stroke();
  }
  ctx.restore();

  // 3D-shaded impact craters
  for (const c of terrain.craters) {
    // Sunlit rim highlight
    ctx.fillStyle = 'rgba(180, 95, 72, 0.18)';
    ctx.beginPath();
    ctx.arc(c.x + 3, c.y + 3, c.r + 3, 0, Math.PI * 2);
    ctx.fill();

    // Crater bowl
    const bowlGrad = ctx.createRadialGradient(c.x + c.r * 0.25, c.y + c.r * 0.25, c.r * 0.1, c.x, c.y, c.r);
    bowlGrad.addColorStop(0, '#140c0f');
    bowlGrad.addColorStop(0.75, '#0b070a');
    bowlGrad.addColorStop(1, '#291716');
    ctx.fillStyle = bowlGrad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
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

  return canvas;
}