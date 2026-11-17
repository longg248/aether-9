import type { AetherGameEngine } from '@/engine/gameEngine';

export function drawCombatEffects(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Additive Bloom FX (Lasers, Lightning, Particles)
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const l of engine.lasers) {
    const alpha = l.life / l.maxLife;
    ctx.strokeStyle = l.color;
    ctx.globalAlpha = alpha * 0.55;
    ctx.lineWidth = l.width * 2.5;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = l.width * 0.8;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }

  for (const bolt of engine.lightnings) {
    ctx.strokeStyle = '#38bdf8';
    ctx.globalAlpha = bolt.life / bolt.maxLife;
    ctx.lineWidth = 4;
    ctx.beginPath();
    bolt.points.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }

  for (const pt of engine.particles) {
    ctx.globalAlpha = pt.alpha;
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawFloatingTexts(engine: AetherGameEngine, ctx: CanvasRenderingContext2D): void {
  // Floating Combat/Resource Text
  for (const ft of engine.floatingTexts) {
    ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
    ctx.font = `bold ${Math.round(13 * ft.scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x, ft.y);
  }
  ctx.globalAlpha = 1;
}