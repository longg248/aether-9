import type { AetherGameEngine } from '@/engine/gameEngine';
import { drawBuildings, drawDrones, drawEnemies, drawRover } from '@/engine/rendering/entityRenderer';
import { drawCombatEffects, drawFloatingTexts } from '@/engine/rendering/effectsRenderer';
import {
  drawBuildGhost,
  drawCrashPods,
  drawDayNightTint,
  drawFlora,
  drawFogOfWar,
  drawGroundDecals,
  drawHub,
  drawResourceNodes,
  drawTerrain,
} from '@/engine/rendering/worldRenderer';

export function renderWorld(engine: AetherGameEngine, ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save();
  ctx.fillStyle = '#09060c';
  ctx.fillRect(0, 0, width, height);

  const shakeX = (Math.random() - 0.5) * engine.camera.shake;
  const shakeY = (Math.random() - 0.5) * engine.camera.shake;
  const camX = Math.round(engine.camera.x - width / 2 + shakeX);
  const camY = Math.round(engine.camera.y - height / 2 + shakeY);

  ctx.translate(-camX, -camY);

  // World layers (terrain, decor, nodes, pods, hub)
  drawTerrain(engine, ctx);
  drawFlora(engine, ctx, width, height);
  drawGroundDecals(engine, ctx);
  drawResourceNodes(engine, ctx);
  drawCrashPods(engine, ctx);
  drawHub(engine, ctx);

  // Entities (buildings, drones, enemies, rover)
  drawBuildings(engine, ctx);
  drawDrones(engine, ctx);
  drawEnemies(engine, ctx);
  drawRover(engine, ctx);

  // FX & overlays
  drawCombatEffects(engine, ctx);
  drawBuildGhost(engine, ctx);
  drawFogOfWar(engine, ctx, camX, camY, width, height);
  drawFloatingTexts(engine, ctx);
  ctx.restore();

  // Screen-space day/night tint
  drawDayNightTint(engine, ctx, width, height);
}