import { GRID_SIZE, HUB_X, HUB_Y, TILE_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { POI_CONFIG, getActivatedRelays } from '@/engine/systems/poiSystem';
import { isTileRevealed } from '@/utils/proceduralTerrain';

export function drawTerrain(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Offscreen Terrain Layer
  ctx.drawImage(engine.terrainCanvas, 0, 0);
}

export function drawFlora(engine: AetherGameEngine, ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Bioluminescent flora sway
  for (const f of engine.flora) {
    if (Math.abs(f.x - engine.camera.x) > width * 0.65 || Math.abs(f.y - engine.camera.y) > height * 0.65) continue;
    const sway = Math.sin(engine.elapsed * 2 + f.phase) * 2.5;
    ctx.fillStyle = `hsla(${f.hue}, 85%, 62%, 0.45)`;
    ctx.beginPath();
    ctx.arc(f.x + sway, f.y, f.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGroundDecals(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Tire tracks & Acid pools
  for (const tr of engine.tireTracks) {
    ctx.fillStyle = `rgba(10, 6, 8, ${tr.alpha})`;
    ctx.fillRect(tr.x - 4, tr.y - 4, 8, 8);
  }
  for (const ap of engine.acidPools) {
    ctx.fillStyle = `rgba(74, 222, 128, ${0.32 * (ap.life / ap.maxLife)})`;
    ctx.beginPath();
    ctx.arc(ap.x, ap.y, ap.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawResourceNodes(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Resource Nodes (3D faceted crystals/ores)
  for (const n of engine.nodes) {
    if (n.amount <= 0) continue;
    const palette =
      n.type === 'silicate'
        ? { main: '#f97316', light: '#fdba74', dark: '#9a3412' }
        : n.type === 'iron'
        ? { main: '#0ea5e9', light: '#7dd3fc', dark: '#075985' }
        : { main: '#a855f7', light: '#e9d5ff', dark: '#581c87' };

    // Soft ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(n.x + 5, n.y + 7, 16, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Crystal cluster facets
    for (let k = 0; k < 4; k++) {
      const ang = n.seed + k * 1.55;
      const ox = Math.cos(ang) * 7;
      const oy = Math.sin(ang) * 7;
      ctx.fillStyle = k % 2 === 0 ? palette.main : palette.dark;
      ctx.beginPath();
      ctx.moveTo(n.x + ox, n.y + oy - 12);
      ctx.lineTo(n.x + ox + 9, n.y + oy + 2);
      ctx.lineTo(n.x + ox, n.y + oy + 9);
      ctx.lineTo(n.x + ox - 9, n.y + oy + 2);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = palette.light;
      ctx.beginPath();
      ctx.moveTo(n.x + ox, n.y + oy - 12);
      ctx.lineTo(n.x + ox + 4, n.y + oy - 2);
      ctx.lineTo(n.x + ox, n.y + oy + 2);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export function drawCrashPods(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  for (const pod of engine.crashPods) {
    if (pod.opened) continue;
    const pulse = 18 + Math.sin(pod.beaconPhase) * 6;
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pod.x, pod.y, pulse, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#eab308';
    ctx.fillRect(pod.x - 12, pod.y - 12, 24, 24);
    ctx.strokeStyle = '#fef08a';
    ctx.strokeRect(pod.x - 12, pod.y - 12, 24, 24);

    if (pod.progress > 0) {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(pod.x - 16, pod.y - 22, 32 * pod.progress, 4);
    }
  }
}

export function drawPOIs(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Points of interest: distinct silhouette per type, pulse while actionable.
  for (const poi of engine.pois) {
    const cfg = POI_CONFIG[poi.type];
    ctx.save();
    ctx.translate(poi.x, poi.y);

    // Shadow pad
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(4, 6, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    const actionable = !poi.completed && poi.type !== 'aether_deposit';
    if (actionable) {
      const pulse = 22 + Math.sin(poi.beaconPhase) * 4;
      ctx.strokeStyle = `${cfg.accent}88`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = poi.completed ? '#334155' : cfg.color;
    ctx.strokeStyle = poi.completed ? '#64748b' : cfg.accent;
    ctx.lineWidth = 2;

    if (poi.type === 'research_station') {
      // Dome + antenna mast
      ctx.beginPath();
      ctx.arc(0, 4, 14, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(0, -22);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -24, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (poi.type === 'signal_relay') {
      // Lattice tower with dish
      ctx.beginPath();
      ctx.moveTo(-10, 14);
      ctx.lineTo(0, -18);
      ctx.lineTo(10, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -18, 6, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();
      if (poi.completed) {
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.5)';
        ctx.beginPath();
        ctx.arc(0, -18, 10 + Math.sin(poi.beaconPhase) * 2, -0.9, 0.9);
        ctx.stroke();
      }
    } else if (poi.type === 'crystal_nest') {
      // Jagged crystal cluster
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.4;
        const ox = Math.cos(a) * 9;
        const oy = Math.sin(a) * 7;
        ctx.beginPath();
        ctx.moveTo(ox, oy - 14);
        ctx.lineTo(ox + 6, oy + 6);
        ctx.lineTo(ox - 6, oy + 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (poi.type === 'supply_cache') {
      // Crate with cross strap
      ctx.beginPath();
      ctx.roundRect(-13, -11, 26, 24, 3);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-13, 1);
      ctx.lineTo(13, 1);
      ctx.moveTo(0, -11);
      ctx.lineTo(0, 13);
      ctx.stroke();
    }
    // aether_deposit: the crystal node itself is drawn by drawResourceNodes.

    // Channeling progress bar
    if (poi.progress > 0 && !poi.completed) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-16, -32, 32, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-16, -32, 32 * Math.min(1, poi.progress), 4);
    }
    ctx.restore();
  }
}

export function drawPOIMarkers(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Discovered POIs keep a small map pin above the fog so the player can
  // navigate back after the rover/radar reveal moves on.
  for (const poi of engine.pois) {
    if (!poi.discovered) continue;
    const cfg = POI_CONFIG[poi.type];
    ctx.save();
    ctx.translate(poi.x, poi.y - 34);
    ctx.fillStyle = poi.completed ? 'rgba(100,116,139,0.8)' : cfg.accent;
    ctx.beginPath();
    ctx.moveTo(0, 6);
    ctx.lineTo(-5, -2);
    ctx.lineTo(0, -6);
    ctx.lineTo(5, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function drawHub(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Central Command Hub (Octagonal Multi-Tier Reactor)
  ctx.save();
  ctx.translate(HUB_X, HUB_Y);
  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.arc(10, 12, 58, 0, Math.PI * 2);
  ctx.fill();

  // Base hull
  ctx.fillStyle = '#1e293b';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let s = 0; s < 8; s++) {
    const a = (s * Math.PI) / 4 + Math.PI / 8;
    const rx = Math.cos(a) * 54;
    const ry = Math.sin(a) * 54;
    if (s === 0) ctx.moveTo(rx, ry);
    else ctx.lineTo(rx, ry);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Glowing Warp Core
  const coreGrad = ctx.createRadialGradient(0, 0, 4, 0, 0, 28);
  coreGrad.addColorStop(0, '#f3e8ff');
  coreGrad.addColorStop(0.5, '#a855f7');
  coreGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();

  // Rotating Radar Sweep
  ctx.rotate(engine.elapsed * 1.4);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(52, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawBuildGhost(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Build Placement Ghost Preview
  if (!engine.hoverTile || !engine.selectedBuild) return;
  const { gx, gy } = engine.hoverTile;
  const check = engine.canBuildAt(gx, gy, engine.selectedBuild);
  const bx = gx * TILE_SIZE;
  const by = gy * TILE_SIZE;
  ctx.fillStyle = check.ok ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.28)';
  ctx.strokeStyle = check.ok ? '#4ade80' : '#f87171';
  ctx.lineWidth = 2;
  ctx.fillRect(bx + 4, by + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  ctx.strokeRect(bx + 4, by + 4, TILE_SIZE - 8, TILE_SIZE - 8);
}

export function drawFogOfWar(
  engine: AetherGameEngine,
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  width: number,
  height: number
): void {
  // Soft Fog of War (activated relays are permanent reveal sources)
  const relays = getActivatedRelays(engine.pois);
  const startGx = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
  const endGx = Math.min(GRID_SIZE - 1, Math.ceil((camX + width) / TILE_SIZE) + 1);
  const startGy = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
  const endGy = Math.min(GRID_SIZE - 1, Math.ceil((camY + height) / TILE_SIZE) + 1);

  for (let gy = startGy; gy <= endGy; gy++) {
    for (let gx = startGx; gx <= endGx; gx++) {
      if (!isTileRevealed(gx, gy, engine.rover.x, engine.rover.y, engine.buildings, relays)) {
        ctx.fillStyle = 'rgba(7, 5, 12, 0.84)';
        ctx.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE + 1, TILE_SIZE + 1);
      }
    }
  }
}

export function drawDayNightTint(engine: AetherGameEngine, ctx: CanvasRenderingContext2D, width: number, height: number): void {
  // Day/Night Atmospheric Tint Overlay
  if (engine.dayTime > 0.72 || engine.dayTime < 0.14) {
    ctx.fillStyle = 'rgba(8, 12, 34, 0.34)';
    ctx.fillRect(0, 0, width, height);
  } else if (engine.dayTime > 0.58) {
    ctx.fillStyle = 'rgba(88, 28, 68, 0.14)';
    ctx.fillRect(0, 0, width, height);
  }
}