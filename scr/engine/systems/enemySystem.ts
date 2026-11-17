import { HUB_X, HUB_Y, WORLD_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { BuildingEntity, EnemyType } from '@/types/game';
import { soundEngine } from '@/utils/soundEngine';

export function spawnEnemyWave(engine: AetherGameEngine): void {
  engine.waveCount++;
  const side = Math.floor(Math.random() * 4);
  const baseCount = Math.min(22, 4 + Math.floor(engine.waveCount * 1.6));
  engine.pushLog(`Cảnh báo: Đợt Bọ Tinh Thể #${engine.waveCount} đang tiến công!`, 'warn');

  for (let i = 0; i < baseCount; i++) {
    let sx = 60;
    let sy = 60;
    const offset = 200 + Math.random() * (WORLD_SIZE - 400);
    if (side === 0) {
      sx = offset;
      sy = 50;
    } else if (side === 1) {
      sx = WORLD_SIZE - 50;
      sy = offset;
    } else if (side === 2) {
      sx = offset;
      sy = WORLD_SIZE - 50;
    } else {
      sx = 50;
      sy = offset;
    }

    let type: EnemyType = 'swarmer';
    if (engine.waveCount >= 3 && i % 5 === 0) type = 'goliath';
    if (engine.waveCount >= 4 && i % 6 === 1) type = 'spitter';

    createEnemy(engine, type, sx + (Math.random() - 0.5) * 90, sy + (Math.random() - 0.5) * 90);
  }

  // Spawn Behemoth Boss in Phase 4+
  if (engine.phaseIndex >= 3 && !engine.bossSpawned) {
    engine.bossSpawned = true;
    createEnemy(engine, 'behemoth', 120, 120);
    soundEngine.bossAlert();
    engine.pushLog('CẢNH BÁO ĐỎ: CHÚA TỂ TỔ KÉN AETHER BEHEMOTH XUẤT HIỆN!', 'warn');
  }
}

function createEnemy(engine: AetherGameEngine, type: EnemyType, x: number, y: number): void {
  const scale = 1 + engine.waveCount * 0.14;
  const stats: Record<EnemyType, { hp: number; speed: number; radius: number }> = {
    swarmer: { hp: 55 * scale, speed: 68, radius: 12 },
    goliath: { hp: 220 * scale, speed: 42, radius: 19 },
    spitter: { hp: 85 * scale, speed: 52, radius: 14 },
    behemoth: { hp: 2600, speed: 32, radius: 34 },
  };
  const s = stats[type];
  engine.enemies.push({
    id: `enm_${Date.now()}_${Math.random()}`,
    type,
    x,
    y,
    hp: s.hp,
    maxHp: s.hp,
    speed: s.speed,
    radius: s.radius,
    legPhase: Math.random() * Math.PI * 2,
    attackCooldown: 0,
    stunTimer: 0,
    hitFlash: 0,
    angle: 0,
  });
}

export function updateEnemies(engine: AetherGameEngine, dt: number): void {
  // Enemy Waves & AI
  engine.waveTimer -= dt;
  if (engine.waveTimer <= 0) {
    engine.waveTimer = Math.max(55, 110 - engine.waveCount * 4);
    spawnEnemyWave(engine);
  }

  for (let i = engine.enemies.length - 1; i >= 0; i--) {
    const e = engine.enemies[i];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.hp <= 0) {
      engine.spawnParticles(e.x, e.y, '#c084fc', e.type === 'behemoth' ? 40 : 12, 130, true);
      if (e.type === 'behemoth') {
        engine.resources.aether += 150;
        engine.pushLog('ĐÃ TIÊU DIỆT AETHER BEHEMOTH! Thu được +150 Aether!', 'good');
      } else if (Math.random() < 0.35) {
        engine.resources.aether += 3;
      }
      engine.enemies.splice(i, 1);
      continue;
    }

    if (e.stunTimer > 0) {
      e.stunTimer -= dt;
      continue;
    }

    e.legPhase += dt * 14;
    e.attackCooldown = Math.max(0, e.attackCooldown - dt);

    // Target nearest building or Hub
    let targetX = HUB_X;
    let targetY = HUB_Y;
    let targetBuilding: BuildingEntity | null = null;
    let bestDist = Math.hypot(HUB_X - e.x, HUB_Y - e.y);

    for (const b of engine.buildings) {
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      if (d < bestDist) {
        bestDist = d;
        targetX = b.x;
        targetY = b.y;
        targetBuilding = b;
      }
    }

    e.angle = Math.atan2(targetY - e.y, targetX - e.x);
    const attackRange = e.type === 'spitter' ? 165 : e.radius + 24;

    if (bestDist > attackRange) {
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    } else if (e.attackCooldown <= 0) {
      e.attackCooldown = e.type === 'behemoth' ? 1.4 : 1.1;
      if (e.type === 'spitter') {
        engine.projectiles.push({
          id: `proj_${Math.random()}`,
          x: e.x,
          y: e.y,
          vx: Math.cos(e.angle) * 210,
          vy: Math.sin(e.angle) * 210,
          damage: 18,
          life: 1.2,
          color: '#4ade80',
          isAcid: true,
        });
      } else {
        const baseDmg = e.type === 'behemoth' ? 65 : e.type === 'goliath' ? 28 : 11;
        if (targetBuilding) {
          const protectedByBay = engine.buildings.some(
            (rb) => rb.type === 'repair_bay' && Math.hypot(rb.x - targetBuilding!.x, rb.y - targetBuilding!.y) <= 240
          );
          targetBuilding.hp -= baseDmg * (protectedByBay ? 0.75 : 1);
          targetBuilding.hitFlash = 0.16;
        } else {
          engine.hubHp -= baseDmg;
          engine.camera.shake = 5;
        }
      }
    }
  }

  // Remove destroyed buildings
  engine.buildings = engine.buildings.filter((b) => b.hp > 0);
}

export function updateProjectiles(engine: AetherGameEngine, dt: number): void {
  for (let i = engine.projectiles.length - 1; i >= 0; i--) {
    const p = engine.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      if (p.isAcid) {
        engine.acidPools.push({ x: p.x, y: p.y, radius: 26, life: 5, maxLife: 5 });
        engine.hubHp -= p.damage * 0.5;
      }
      engine.projectiles.splice(i, 1);
    }
  }
  for (let i = engine.acidPools.length - 1; i >= 0; i--) {
    engine.acidPools[i].life -= dt;
    if (engine.acidPools[i].life <= 0) engine.acidPools.splice(i, 1);
  }
}