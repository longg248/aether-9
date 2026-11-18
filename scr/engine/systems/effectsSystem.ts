import type { AetherGameEngine } from '@/engine/gameEngine';

export function pushLog(
  engine: AetherGameEngine,
  text: string,
  type: 'info' | 'warn' | 'ai' | 'good' = 'info'
): void {
  engine.logs = [{ id: `${Date.now()}_${engine.random.gameplay()}`, text, type }, ...engine.logs].slice(0, 6);
}

export function addFloatingText(
  engine: AetherGameEngine,
  x: number,
  y: number,
  text: string,
  color: string,
  scale = 1
): void {
  engine.floatingTexts.push({
    x,
    y,
    vy: -34,
    text,
    color,
    life: 1.15,
    maxLife: 1.15,
    scale,
  });
}

export function spawnParticles(
  engine: AetherGameEngine,
  x: number,
  y: number,
  color: string,
  count: number,
  speed = 90,
  glow = false
): void {
  for (let i = 0; i < count; i++) {
    const a = engine.random.gameplay() * Math.PI * 2;
    const spd = (0.25 + engine.random.gameplay() * 0.75) * speed;
    const life = 0.35 + engine.random.gameplay() * 0.45;
    engine.particles.push({
      x,
      y,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      size: 2 + engine.random.gameplay() * 3,
      color,
      alpha: 1,
      life,
      maxLife: life,
      glow,
    });
  }
}

export function updateEffects(engine: AetherGameEngine, dt: number): void {
  for (let i = engine.lasers.length - 1; i >= 0; i--) {
    engine.lasers[i].life -= dt;
    if (engine.lasers[i].life <= 0) engine.lasers.splice(i, 1);
  }
  for (let i = engine.lightnings.length - 1; i >= 0; i--) {
    engine.lightnings[i].life -= dt;
    if (engine.lightnings[i].life <= 0) engine.lightnings.splice(i, 1);
  }
  for (let i = engine.particles.length - 1; i >= 0; i--) {
    const pt = engine.particles[i];
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
    pt.alpha = Math.max(0, pt.life / pt.maxLife);
    if (pt.life <= 0) engine.particles.splice(i, 1);
  }
  for (let i = engine.floatingTexts.length - 1; i >= 0; i--) {
    const ft = engine.floatingTexts[i];
    ft.y += ft.vy * dt;
    ft.life -= dt;
    if (ft.life <= 0) engine.floatingTexts.splice(i, 1);
  }
  for (const tr of engine.tireTracks) tr.alpha -= dt * 0.04;
  engine.tireTracks = engine.tireTracks.filter((tr) => tr.alpha > 0);
}