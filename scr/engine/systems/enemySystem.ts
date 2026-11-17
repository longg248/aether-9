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
import { BuildingEntity, BuildingType, EnemyEntity, EnemyType, Projectile } from '@/types/game';
import { soundEngine } from '@/utils/soundEngine';

/**
 * Target attractiveness multipliers (lower = more attractive). The Hub is the
 * reference at 1.0: turrets and production are priority targets, walls are
 * deprioritized so enemies path toward valuable structures — but a wall that
 * physically blocks movement is still attacked (see resolveWallCollision).
 */
const TARGET_WEIGHTS: Record<BuildingType, number> = {
  turret: 0.85,
  repair_bay: 0.9,
  drill: 0.95,
  smelter: 0.95,
  lab: 0.95,
  solar: 1.1,
  radar: 1.1,
  wall: 1.35,
};

/** Late-wave HP scaling cap: player damage tops out at +140% (turret_optics 5). */
export const WAVE_HP_SCALE_CAP = 3;

export interface WaveParams {
  /** Number of non-boss enemies in the wave. */
  count: number;
  /** HP multiplier applied to spawned enemies. */
  hpScale: number;
  /** Seconds until the next wave after this one. */
  nextWaveIn: number;
}

/** Pure, predictable difficulty curve — shared by the spawner and tests. */
export function getWaveParams(waveCount: number): WaveParams {
  return {
    count: Math.min(22, 4 + Math.floor(waveCount * 1.6)),
    hpScale: Math.min(WAVE_HP_SCALE_CAP, 1 + waveCount * 0.14),
    nextWaveIn: Math.max(55, 110 - waveCount * 4),
  };
}

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
  const params = getWaveParams(engine.waveCount);
  engine.waveTimer = params.nextWaveIn;
  const side = Math.floor(Math.random() * 4);
  engine.pushLog(`Cảnh báo: Đợt Bọ Tinh Thể #${engine.waveCount} đang tiến công!`, 'warn');

  for (let i = 0; i < params.count; i++) {
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

    createEnemy(engine, type, sx + (Math.random() - 0.5) * 90, sy + (Math.random() - 0.5) * 90, params.hpScale);
  }

  // Spawn Behemoth Boss in Phase 4+
  if (engine.phaseIndex >= 3 && !engine.bossSpawned) {
    engine.bossSpawned = true;
    createEnemy(engine, 'behemoth', 120, 120, 1);
    soundEngine.bossAlert();
    engine.pushLog('CẢNH BÁO ĐỎ: CHÚA TỂ TỔ KÉN AETHER BEHEMOTH XUẤT HIỆN!', 'warn');
  }
}

/** Monotonic suffix: ids stay unique even when Date.now/Math.random collide. */
let enemySeq = 0;

/** Shared spawner: waves and crystal-nest ambushes use the same stat table. */
export function createEnemy(
  engine: AetherGameEngine,
  type: EnemyType,
  x: number,
  y: number,
  scale: number
): EnemyEntity {
  const stats: Record<EnemyType, { hp: number; speed: number; radius: number }> = {
    swarmer: { hp: 55 * scale, speed: 68, radius: 12 },
    goliath: { hp: 220 * scale, speed: 42, radius: 19 },
    spitter: { hp: 85 * scale, speed: 52, radius: 14 },
    behemoth: { hp: 2600, speed: 32, radius: 34 },
  };
  const s = stats[type];
  const enemy: EnemyEntity = {
    id: `enm_${Date.now()}_${Math.random()}_${enemySeq++}`,
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
  };
  engine.enemies.push(enemy);
  return enemy;
}

export function updateEnemies(engine: AetherGameEngine, dt: number): void {
  // Enemy Waves & AI
  engine.waveTimer -= dt;
  if (engine.waveTimer <= 0) {
    spawnEnemyWave(engine); // also schedules the next wave via getWaveParams
  }

  for (let i = engine.enemies.length - 1; i >= 0; i--) {
    const e = engine.enemies[i];
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.hp <= 0) {
      engine.spawnParticles(e.x, e.y, '#c084fc', e.type === 'behemoth' ? 40 : 12, 130, true);
      if (e.type === 'behemoth') {
        engine.resources.aether += 150;
        engine.behemothKilled++;
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

    // Weighted target selection: prefer the Hub and valuable structures over
    // peripheral walls. Re-evaluated every frame, so a destroyed target is
    // replaced immediately by the next best valid one.
    let targetX = HUB_X;
    let targetY = HUB_Y;
    let targetBuilding: BuildingEntity | null = null;
    let targetDist = Math.hypot(HUB_X - e.x, HUB_Y - e.y);
    let bestScore = targetDist; // Hub weight is 1.0

    for (const b of engine.buildings) {
      if (b.hp <= 0) continue; // destroyed buildings are invalid targets
      const d = Math.hypot(b.x - e.x, b.y - e.y);
      const score = d * TARGET_WEIGHTS[b.type];
      if (score < bestScore) {
        bestScore = score;
        targetDist = d;
        targetX = b.x;
        targetY = b.y;
        targetBuilding = b;
      }
    }

    e.angle = Math.atan2(targetY - e.y, targetX - e.x);
    const attackRange = e.type === 'spitter' ? 165 : e.radius + 24;

    if (targetDist > attackRange) {
      // Substepped movement: each increment is collision-resolved before the
      // next, so a large frame step can never tunnel across an intact wall.
      const stepX = Math.cos(e.angle) * e.speed * dt;
      const stepY = Math.sin(e.angle) * e.speed * dt;
      const travel = Math.hypot(stepX, stepY);
      const substeps = Math.max(1, Math.ceil(travel / WALL_SUBSTEP_MAX));
      for (let s = 0; s < substeps; s++) {
        const fromX = e.x;
        const fromY = e.y;
        e.x += stepX / substeps;
        e.y += stepY / substeps;
        resolveWallCollision(engine, e);
        preserveWallSides(engine, e, fromX, fromY);
      }
    } else {
      // Stationary attackers (e.g. after knockback) still need penetration
      // recovery — resolve without any movement.
      resolveWallCollision(engine, e);
    }

    // Re-evaluate the blocker AFTER resolution: only an alive wall physically
    // in contact range may be attacked — never a stale or distant reference.
    const blockingWall = findContactWall(engine, e);

    if (targetDist <= attackRange && e.attackCooldown <= 0) {
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
    } else if (
      blockingWall &&
      blockingWall.hp > 0 &&
      Math.hypot(blockingWall.x - e.x, blockingWall.y - e.y) <= e.radius + BUILDING_COLLISION_RADIUS + WALL_ATTACK_REACH &&
      targetDist > attackRange &&
      e.attackCooldown <= 0
    ) {
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

/** Max displacement per collision substep — small vs the wall diameter (48). */
const WALL_SUBSTEP_MAX = 8;
/** Contact tolerance beyond the collision radius for melee wall attacks. */
const WALL_ATTACK_REACH = 10;

/**
 * Simple circle collision against intact walls: pushes the enemy out of any
 * wall overlap (allowing it to slide along the wall). Destroyed walls
 * (hp <= 0) no longer block movement. The blocking wall is re-evaluated by
 * the caller AFTER resolution (findContactWall) — never from stale state.
 */
function resolveWallCollision(engine: AetherGameEngine, e: EnemyEntity): void {
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
}

/**
 * Side preservation: push-out/escape project along the CURRENT offset, which
 * can land the enemy on the far side of a wall it never legitimately crossed
 * (e.g. a deep knock-in or cancelled normals). For every intact wall the
 * enemy was clear of before the substep, keep it on that same side —
 * projecting back onto the contact circle when a crossing is detected.
 * Walls the enemy already overlapped (knock-ins) are left to the verified
 * escape, which may legitimately relocate it.
 */
function preserveWallSides(engine: AetherGameEngine, e: EnemyEntity, fromX: number, fromY: number): void {
  const minDist = e.radius + BUILDING_COLLISION_RADIUS;
  for (let iter = 0; iter < 4; iter++) {
    let corrected = false;
    for (const b of engine.buildings) {
      if (b.type !== 'wall' || b.hp <= 0) continue;
      const preDx = fromX - b.x;
      const preDy = fromY - b.y;
      const preDist = Math.hypot(preDx, preDy);
      if (preDist < minDist) continue; // started overlapping: escape owns recovery
      const dx = e.x - b.x;
      const dy = e.y - b.y;
      const dist = Math.hypot(dx, dy);
      const crossed = dist > 0.001 && preDx * dx + preDy * dy < 0;
      if (crossed || dist < minDist) {
        // Restore the pre-move side at contact distance (deterministic axis
        // fallback when the offset degenerates).
        const sx = dist > 0.001 && !crossed ? dx / dist : preDx / preDist;
        const sy = dist > 0.001 && !crossed ? dy / dist : preDy / preDist;
        e.x = b.x + sx * minDist;
        e.y = b.y + sy * minDist;
        corrected = true;
      }
    }
    if (!corrected) break;
    // A side correction can press the enemy into a neighbouring wall.
    resolveWallCollision(engine, e);
  }
}

/**
 * The wall actually blocking the enemy right now: the nearest intact wall
 * within physical contact range. Re-evaluated after collision resolution so
 * attack logic never damages a stale or distant reference.
 */
function findContactWall(engine: AetherGameEngine, e: EnemyEntity): BuildingEntity | null {
  const reach = e.radius + BUILDING_COLLISION_RADIUS + WALL_ATTACK_REACH;
  let best: BuildingEntity | null = null;
  let bestDist = Infinity;
  for (const b of engine.buildings) {
    if (b.type !== 'wall' || b.hp <= 0) continue;
    const d = Math.hypot(b.x - e.x, b.y - e.y);
    if (d <= reach && d < bestDist) {
      best = b;
      bestDist = d;
    }
  }
  return best;
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
 * verified clear of EVERY intact wall — and only when the swept path from
 * the current position to the candidate crosses no intact wall the enemy is
 * not already inside. Checking the final position alone could displace the
 * enemy straight across a defensive row.
 */
function escapeVerified(engine: AetherGameEngine, e: EnemyEntity): void {
  const minDist = e.radius + BUILDING_COLLISION_RADIUS;
  const walls = engine.buildings.filter((b) => b.type === 'wall' && b.hp > 0);
  const inside = new Set(
    walls.filter((b) => Math.hypot(b.x - e.x, b.y - e.y) < minDist)
  );
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
      const clear = walls.every((b) => Math.hypot(b.x - x, b.y - y) >= minDist);
      if (!clear) continue;
      // Swept-path check: the segment must not pass through any intact wall
      // the enemy is not already overlapping (no teleport across the line).
      const pathClear = walls.every(
        (b) => inside.has(b) || !segmentHitsCircle(e.x, e.y, x, y, b.x, b.y, minDist)
      );
      if (pathClear) {
        e.x = x;
        e.y = y;
        return;
      }
    }
  }
  // No verified position within reach (only possible inside a fully sealed
  // wall shell): keep the last resolved position rather than teleport blindly.
}

/** True when the segment (x0,y0)->(x1,y1) passes within `radius` of (cx,cy). */
function segmentHitsCircle(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
  radius: number
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - x0) * dx + (cy - y0) * dy) / len2)) : 0;
  return Math.hypot(cx - (x0 + dx * t), cy - (y0 + dy * t)) < radius;
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