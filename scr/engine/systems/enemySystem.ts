import {
  ACID_POOL_DPS,
  ACID_POOL_LIFE,
  ACID_POOL_RADIUS,
  ACID_TICK_INTERVAL,
  BUILDING_COLLISION_RADIUS,
  HUB_COLLISION_RADIUS,
  HUB_X,
  HUB_Y,
  WORLD_SIZE,
} from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { BuildingEntity, EnemyEntity, EnemyType, Projectile } from '@/types/game';
import { soundEngine } from '@/utils/soundEngine';

/** Applies damage to a building with Repair Bay area protection (shared by melee & projectiles). */
function damageBuilding(engine: AetherGameEngine, target: BuildingEntity, damage: number): void {
  const protectedByBay = engine.buildings.some(
    (rb) => rb.type === 'repair_bay' && rb.hp > 0 && Math.hypot(rb.x - target.x, rb.y - target.y) <= 240
  );
  target.hp -= damage * (protectedByBay ? 0.75 : 1);
  target.hitFlash = 0.16;
}

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
      if (b.hp <= 0) continue; // destroyed buildings are invalid targets
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
    }

    // Intact walls are solid: push the enemy out and let it break through
    // by attacking, instead of walking through or getting stuck forever.
    const blockingWall = resolveWallCollision(engine, e);

    if (bestDist <= attackRange && e.attackCooldown <= 0) {
      e.attackCooldown = e.type === 'behemoth' ? 1.4 : 1.1;
      if (e.type === 'spitter') {
        fireAcidProjectile(engine, e);
      } else {
        const baseDmg = e.type === 'behemoth' ? 65 : e.type === 'goliath' ? 28 : 11;
        if (targetBuilding) {
          damageBuilding(engine, targetBuilding, baseDmg);
        } else {
          engine.hubHp -= baseDmg;
          engine.camera.shake = 5;
        }
      }
    } else if (blockingWall && bestDist > attackRange && e.attackCooldown <= 0) {
      e.attackCooldown = e.type === 'behemoth' ? 1.4 : 1.1;
      e.angle = Math.atan2(blockingWall.y - e.y, blockingWall.x - e.x);
      if (e.type === 'spitter') {
        fireAcidProjectile(engine, e);
      } else {
        const baseDmg = e.type === 'behemoth' ? 65 : e.type === 'goliath' ? 28 : 11;
        damageBuilding(engine, blockingWall, baseDmg);
      }
    }
  }

  // Remove destroyed buildings
  engine.buildings = engine.buildings.filter((b) => b.hp > 0);
}

/**
 * Simple circle collision against intact walls: pushes the enemy out of any
 * wall overlap (allowing it to slide along the wall) and reports the blocker.
 * Destroyed walls (hp <= 0) no longer block movement.
 */
function resolveWallCollision(engine: AetherGameEngine, e: EnemyEntity): BuildingEntity | null {
  let blocker: BuildingEntity | null = null;
  // Multiple passes: pushing out of one wall can shove the enemy into an
  // adjacent wall (continuous rows, L-corners). Re-resolve until stable.
  for (let pass = 0; pass < 4; pass++) {
    let pushed = false;
    for (const b of engine.buildings) {
      if (b.type !== 'wall' || b.hp <= 0) continue;
      const minDist = e.radius + BUILDING_COLLISION_RADIUS;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        if (dist > 0.001) {
          e.x = b.x + (dx / dist) * minDist;
          e.y = b.y + (dy / dist) * minDist;
        } else {
          e.x = b.x + minDist; // exactly concentric: pick a deterministic push direction
        }
        blocker = b;
        pushed = true;
      }
    }
    if (!pushed) break;
  }
  // Concave corners (L-junctions) can leave a residual overlap: sequential
  // pushes oscillate between the arms. Nudge along the combined outward
  // normal of all overlapping walls until the enemy is fully clear.
  for (let step = 0; step < 24; step++) {
    let nx = 0;
    let ny = 0;
    let overlapping = false;
    for (const b of engine.buildings) {
      if (b.type !== 'wall' || b.hp <= 0) continue;
      const minDist = e.radius + BUILDING_COLLISION_RADIUS;
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        overlapping = true;
        blocker = b;
        if (dist > 0.001) {
          nx += dx / dist;
          ny += dy / dist;
        } else {
          nx += 1;
        }
      }
    }
    if (!overlapping) break;
    const len = Math.hypot(nx, ny);
    if (len < 0.001) break; // opposing normals cancel: verified escape below
    e.x += (nx / len) * 4;
    e.y += (ny / len) * 4;
  }
  // The fast paths can stall: cancelled normals, or 4px nudges oscillating
  // between adjacent walls. Guarantee a verified escape as the final step.
  if (isOverlappingWalls(engine, e)) {
    escapeVerified(engine, e);
  }
  return blocker;
}

/** True while any intact wall still overlaps the enemy. */
function isOverlappingWalls(engine: AetherGameEngine, e: EnemyEntity): boolean {
  const minDist = e.radius + BUILDING_COLLISION_RADIUS;
  return engine.buildings.some(
    (b) => b.type === 'wall' && b.hp > 0 && Math.hypot(b.x - e.x, b.y - e.y) < minDist
  );
}

/**
 * Deterministic last-resort escape when pushes/nudges stall (e.g. an enemy
 * symmetrically between walls whose collision normals cancel). Tries fixed
 * candidate directions at increasing reach and commits only to a position
 * verified clear of EVERY intact wall — a blind one-direction shove can land
 * inside the neighbouring wall.
 */
function escapeVerified(engine: AetherGameEngine, e: EnemyEntity): void {
  const minDist = e.radius + BUILDING_COLLISION_RADIUS;
  const dirs: ReadonlyArray<readonly [number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [Math.SQRT1_2, Math.SQRT1_2],
    [Math.SQRT1_2, -Math.SQRT1_2],
    [-Math.SQRT1_2, Math.SQRT1_2],
    [-Math.SQRT1_2, -Math.SQRT1_2],
  ];
  for (let reach = 1; reach <= 32; reach++) {
    for (const [dx, dy] of dirs) {
      const x = e.x + dx * minDist * reach;
      const y = e.y + dy * minDist * reach;
      const clear = engine.buildings.every(
        (b) => b.type !== 'wall' || b.hp <= 0 || Math.hypot(b.x - x, b.y - y) >= minDist
      );
      if (clear) {
        e.x = x;
        e.y = y;
        return;
      }
    }
  }
  // No verified position within reach (only possible inside a fully sealed
  // wall shell): keep the last resolved position rather than teleport blindly.
}

function fireAcidProjectile(engine: AetherGameEngine, e: EnemyEntity): void {
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
}

function spawnAcidPool(engine: AetherGameEngine, x: number, y: number): void {
  engine.acidPools.push({
    x,
    y,
    radius: ACID_POOL_RADIUS,
    life: ACID_POOL_LIFE,
    maxLife: ACID_POOL_LIFE,
    damagePerSecond: ACID_POOL_DPS,
    tickTimer: ACID_TICK_INTERVAL,
  });
}

/** Impact damage happens exactly once, on the actual collision target only. */
function applyProjectileImpact(
  engine: AetherGameEngine,
  p: Projectile,
  hitBuilding: BuildingEntity | null
): void {
  const damage = p.isAcid ? p.damage * 0.5 : p.damage;
  if (hitBuilding) {
    damageBuilding(engine, hitBuilding, damage);
  } else {
    engine.hubHp -= damage;
    engine.camera.shake = 3;
  }
}

export function updateProjectiles(engine: AetherGameEngine, dt: number): void {
  // Acid pools tick BEFORE projectile movement so a pool spawned this frame
  // starts its lifetime on the next frame (no extra frame lost at spawn).
  // Tolerance absorbs float drift so boundary ticks/expiry stay deterministic.
  const EPS = 1e-6;
  for (let i = engine.acidPools.length - 1; i >= 0; i--) {
    const ap = engine.acidPools[i];
    ap.life -= dt;
    ap.tickTimer -= dt;
    while (ap.tickTimer <= EPS) {
      // A tick only damages if its scheduled moment (tickTimer relative to
      // remaining life) falls within the pool's lifetime — never after expiry.
      if (ap.tickTimer <= ap.life + EPS) {
        const tickDamage = ap.damagePerSecond * ACID_TICK_INTERVAL;
        for (const b of engine.buildings) {
          if (b.hp > 0 && Math.hypot(b.x - ap.x, b.y - ap.y) <= ap.radius + BUILDING_COLLISION_RADIUS) {
            damageBuilding(engine, b, tickDamage);
          }
        }
        if (Math.hypot(HUB_X - ap.x, HUB_Y - ap.y) <= ap.radius + HUB_COLLISION_RADIUS) {
          engine.hubHp -= tickDamage;
        }
      }
      ap.tickTimer += ACID_TICK_INTERVAL;
    }
    if (ap.life <= EPS) {
      engine.acidPools.splice(i, 1);
    }
  }

  for (let i = engine.projectiles.length - 1; i >= 0; i--) {
    const p = engine.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    // Collision detection against intact buildings and the Hub.
    let hitBuilding: BuildingEntity | null = null;
    for (const b of engine.buildings) {
      if (b.hp <= 0) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) <= BUILDING_COLLISION_RADIUS) {
        hitBuilding = b;
        break;
      }
    }
    const hitHub =
      !hitBuilding && Math.hypot(HUB_X - p.x, HUB_Y - p.y) <= HUB_COLLISION_RADIUS;

    if (hitBuilding || hitHub) {
      if (p.isAcid) spawnAcidPool(engine, p.x, p.y);
      applyProjectileImpact(engine, p, hitBuilding);
      engine.projectiles.splice(i, 1);
      continue;
    }

    if (p.life <= 0) {
      // Expired mid-air: acid leaves a pool where it lands, nothing else takes damage.
      if (p.isAcid) spawnAcidPool(engine, p.x, p.y);
      engine.projectiles.splice(i, 1);
    }
  }
}