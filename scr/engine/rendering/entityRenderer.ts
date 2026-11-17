import { BUILDINGS, TILE_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';

export function drawBuildings(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  for (const b of engine.buildings) {
    const cfg = BUILDINGS[b.type];
    ctx.save();
    ctx.translate(b.x, b.y);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(-15, -13, 34, 34);

    // Repair Bay Aura
    if (b.type === 'repair_bay') {
      ctx.strokeStyle = 'rgba(45, 212, 191, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, (cfg.radius || 5) * TILE_SIZE, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = b.hitFlash > 0 ? '#ffffff' : cfg.color;
    ctx.strokeStyle = cfg.accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-17, -17, 34, 34, 6);
    ctx.fill();
    ctx.stroke();

    // Mechanical details
    if (b.type === 'drill') {
      ctx.rotate(b.animPhase * 2);
      ctx.strokeStyle = '#fef3c7';
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(0, -10);
      ctx.lineTo(0, 10);
      ctx.stroke();
    } else if (b.type === 'turret') {
      ctx.rotate(b.angle);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-4 - b.recoil, -4, 22, 8);
    } else if (b.type === 'radar') {
      ctx.rotate(b.animPhase);
      ctx.strokeStyle = '#a7f3d0';
      ctx.beginPath();
      ctx.arc(0, 0, 10, -0.7, 0.7);
      ctx.stroke();
    }

    // Health bar if damaged
    if (b.hp < b.maxHp) {
      ctx.rotate(0);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(-16, -24, 32, 4);
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(-16, -24, 32 * (b.hp / b.maxHp), 4);
    }
    ctx.restore();
  }
}

export function drawDrones(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  for (const d of engine.drones) {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Quad rotors
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    for (const [rx, ry] of [
      [-8, -8],
      [8, -8],
      [-8, 8],
      [8, 8],
    ]) {
      ctx.beginPath();
      ctx.arc(rx, ry, 4, d.propellerAngle, d.propellerAngle + Math.PI * 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function drawEnemies(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Crystal Bugs & Behemoth Boss
  for (const e of engine.enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    const bodyColor =
      e.hitFlash > 0
        ? '#ffffff'
        : e.type === 'behemoth'
        ? '#7e22ce'
        : e.type === 'goliath'
        ? '#be123c'
        : e.type === 'spitter'
        ? '#15803d'
        : '#e11d48';

    // Animated chitin legs
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = e.type === 'behemoth' ? 3.5 : 2;
    for (let l = -1; l <= 1; l++) {
      const swing = Math.sin(e.legPhase + l) * 5;
      ctx.beginPath();
      ctx.moveTo(l * (e.radius * 0.45), -e.radius * 0.6);
      ctx.lineTo(l * (e.radius * 0.5) + swing, -e.radius * 1.35);
      ctx.moveTo(l * (e.radius * 0.45), e.radius * 0.6);
      ctx.lineTo(l * (e.radius * 0.5) - swing, e.radius * 1.35);
      ctx.stroke();
    }

    // Carapace
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.ellipse(0, 0, e.radius * 1.15, e.radius * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();

    // Glowing eyes
    ctx.fillStyle = e.stunTimer > 0 ? '#38bdf8' : '#fef08a';
    ctx.beginPath();
    ctx.arc(e.radius * 0.65, -e.radius * 0.3, 2.5, 0, Math.PI * 2);
    ctx.arc(e.radius * 0.65, e.radius * 0.3, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawRover(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Engineer Rover + Headlight Cone
  ctx.save();
  ctx.translate(engine.rover.x, engine.rover.y);

  // Headlight cone (brighter at night)
  const isNight = engine.dayTime > 0.72 || engine.dayTime < 0.14;
  ctx.save();
  ctx.rotate(engine.rover.angle);
  const coneGrad = ctx.createRadialGradient(14, 0, 4, 14, 0, 175);
  coneGrad.addColorStop(0, isNight ? 'rgba(224, 242, 254, 0.34)' : 'rgba(224, 242, 254, 0.12)');
  coneGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.arc(12, 0, 175, -0.42, 0.42);
  ctx.closePath();
  ctx.fill();

  // Rover Chassis
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(-16, -15, 32, 6);
  ctx.fillRect(-16, 9, 32, 6);

  ctx.fillStyle = '#0284c7';
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(-14, -11, 28, 22, 5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Independent Laser Turret
  ctx.rotate(engine.rover.turretAngle);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(-4, -3, 18, 6);
  ctx.restore();
}