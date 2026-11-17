import { TILE_SIZE, WORLD_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { soundEngine } from '@/utils/soundEngine';

export function updateRoverMovement(engine: AetherGameEngine, dt: number): void {
  // Cooldowns
  engine.rover.dashCooldown = Math.max(0, engine.rover.dashCooldown - dt);
  engine.rover.dashTimer = Math.max(0, engine.rover.dashTimer - dt);
  engine.rover.empCooldown = Math.max(0, engine.rover.empCooldown - dt);
  engine.rover.overchargeCooldown = Math.max(0, engine.rover.overchargeCooldown - dt);
  engine.rover.overchargeTimer = Math.max(0, engine.rover.overchargeTimer - dt);
  engine.camera.shake = Math.max(0, engine.camera.shake - dt * 28);

  // Rover Movement (WASD / Arrows or Click target)
  let ix = 0;
  let iy = 0;
  if (engine.keys.has('w') || engine.keys.has('arrowup')) iy -= 1;
  if (engine.keys.has('s') || engine.keys.has('arrowdown')) iy += 1;
  if (engine.keys.has('a') || engine.keys.has('arrowleft')) ix -= 1;
  if (engine.keys.has('d') || engine.keys.has('arrowright')) ix += 1;

  if (ix !== 0 || iy !== 0) {
    engine.rover.moveTarget = null;
    const len = Math.hypot(ix, iy);
    ix /= len;
    iy /= len;
  } else if (engine.rover.moveTarget) {
    const dx = engine.rover.moveTarget.x - engine.rover.x;
    const dy = engine.rover.moveTarget.y - engine.rover.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 34) {
      ix = dx / dist;
      iy = dy / dist;
    } else {
      engine.rover.moveTarget = null;
    }
  }

  const baseSpeed = 165 * (1 + (engine.upgrades.rover_laser - 1) * 0.15);
  const moveSpeed = engine.rover.dashTimer > 0 ? baseSpeed * 2.8 : baseSpeed;
  engine.rover.vx = ix * moveSpeed;
  engine.rover.vy = iy * moveSpeed;
  engine.rover.x = Math.max(28, Math.min(WORLD_SIZE - 28, engine.rover.x + engine.rover.vx * dt));
  engine.rover.y = Math.max(28, Math.min(WORLD_SIZE - 28, engine.rover.y + engine.rover.vy * dt));

  if (Math.hypot(engine.rover.vx, engine.rover.vy) > 8) {
    engine.rover.angle = Math.atan2(engine.rover.vy, engine.rover.vx);
    engine.rover.wheelPhase += dt * 16;
    if (Math.random() < 0.45) {
      engine.tireTracks.push({ x: engine.rover.x, y: engine.rover.y, alpha: 0.35 });
      if (engine.tireTracks.length > 140) engine.tireTracks.shift();
    }
  }

  // Smooth camera follow
  engine.camera.x += (engine.rover.x - engine.camera.x) * Math.min(1, dt * 6.5);
  engine.camera.y += (engine.rover.y - engine.camera.y) * Math.min(1, dt * 6.5);
}

export function updateRoverCombat(engine: AetherGameEngine, dt: number): void {
  // Rover Auto-Mining & Combat Laser
  engine.rover.mineCooldown -= dt;
  const overchargeMult = engine.rover.overchargeTimer > 0 ? 3.0 : 1.0;

  // Prioritize nearby enemies for Rover turret
  const nearEnemy = engine.enemies.find((e) => Math.hypot(e.x - engine.rover.x, e.y - engine.rover.y) < 195);
  if (nearEnemy && engine.rover.mineCooldown <= 0) {
    engine.rover.turretAngle = Math.atan2(nearEnemy.y - engine.rover.y, nearEnemy.x - engine.rover.x);
    engine.rover.mineCooldown = 0.34 / overchargeMult;
    const dmg = 22 * (1 + (engine.upgrades.turret_optics - 1) * 0.35);
    nearEnemy.hp -= dmg;
    nearEnemy.hitFlash = 0.14;
    soundEngine.laser();
    engine.lasers.push({
      x1: engine.rover.x,
      y1: engine.rover.y,
      x2: nearEnemy.x,
      y2: nearEnemy.y,
      color: engine.rover.overchargeTimer > 0 ? '#facc15' : '#38bdf8',
      width: engine.rover.overchargeTimer > 0 ? 4 : 2.5,
      life: 0.12,
      maxLife: 0.12,
    });
  } else {
    const targetNode =
      engine.nodes.find((n) => n.id === engine.rover.targetNodeId && n.amount > 0) ||
      engine.nodes.find((n) => n.amount > 0 && Math.hypot(n.x - engine.rover.x, n.y - engine.rover.y) < 95);

    if (targetNode && Math.hypot(targetNode.x - engine.rover.x, targetNode.y - engine.rover.y) < 105) {
      engine.rover.turretAngle = Math.atan2(targetNode.y - engine.rover.y, targetNode.x - engine.rover.x);
      if (engine.rover.mineCooldown <= 0) {
        const speedMult = (1 + (engine.upgrades.rover_laser - 1) * 0.35) * overchargeMult;
        engine.rover.mineCooldown = 0.42 / speedMult;
        const isCrit = Math.random() < 0.22;
        const yieldAmt = isCrit ? 12 : 6;
        const mined = Math.min(targetNode.amount, yieldAmt);
        targetNode.amount -= mined;
        engine.resources[targetNode.type] += mined;

        soundEngine.mine(isCrit);
        const color =
          targetNode.type === 'silicate' ? '#fb923c' : targetNode.type === 'iron' ? '#38bdf8' : '#c084fc';
        engine.lasers.push({
          x1: engine.rover.x,
          y1: engine.rover.y,
          x2: targetNode.x,
          y2: targetNode.y,
          color,
          width: isCrit ? 4.5 : 2.6,
          life: 0.14,
          maxLife: 0.14,
        });
        engine.spawnParticles(targetNode.x, targetNode.y, color, isCrit ? 10 : 5, 80, true);
        engine.addFloatingText(
          targetNode.x,
          targetNode.y - 14,
          `${isCrit ? 'CRIT ' : ''}+${mined}`,
          color,
          isCrit ? 1.2 : 0.95
        );
      }
    }
  }
}

export function triggerDash(engine: AetherGameEngine): void {
  if (engine.rover.dashCooldown > 0) return;
  engine.rover.dashCooldown = 4.5;
  engine.rover.dashTimer = 0.24;
  soundEngine.dash();
  engine.spawnParticles(engine.rover.x, engine.rover.y, '#38bdf8', 14, 120, true);
}

export function triggerEmp(engine: AetherGameEngine): void {
  if (engine.rover.empCooldown > 0) return;
  engine.rover.empCooldown = 14;
  soundEngine.emp();
  engine.camera.shake = 10;
  engine.spawnParticles(engine.rover.x, engine.rover.y, '#a855f7', 36, 220, true);
  engine.addFloatingText(engine.rover.x, engine.rover.y - 24, 'XUNG EMP!', '#c084fc', 1.2);

  const dmg = 55 * (1 + (engine.upgrades.turret_optics - 1) * 0.35);
  for (const e of engine.enemies) {
    const dist = Math.hypot(e.x - engine.rover.x, e.y - engine.rover.y);
    if (dist <= 230) {
      e.hp -= dmg;
      e.stunTimer = 3.2;
      e.hitFlash = 0.25;
      const pushAngle = Math.atan2(e.y - engine.rover.y, e.x - engine.rover.x);
      e.x += Math.cos(pushAngle) * 32;
      e.y += Math.sin(pushAngle) * 32;
    }
  }
}

export function triggerOvercharge(engine: AetherGameEngine): void {
  if (engine.rover.overchargeCooldown > 0) return;
  engine.rover.overchargeCooldown = 20;
  engine.rover.overchargeTimer = 6.0;
  soundEngine.pickup();
  engine.addFloatingText(engine.rover.x, engine.rover.y - 26, 'QUÁ TẢI LASER 300%!', '#facc15', 1.2);
}

export function handleWorldClick(engine: AetherGameEngine, worldX: number, worldY: number): void {
  if (engine.status !== 'playing') return;
  const gx = Math.floor(worldX / TILE_SIZE);
  const gy = Math.floor(worldY / TILE_SIZE);

  if (engine.selectedBuild) {
    engine.placeBuilding(gx, gy, engine.selectedBuild);
    return;
  }

  // Check crash pod
  const pod = engine.crashPods.find((p) => !p.opened && Math.hypot(p.x - worldX, p.y - worldY) < 38);
  if (pod) {
    engine.rover.targetPodId = pod.id;
    engine.rover.targetNodeId = null;
    engine.rover.moveTarget = { x: pod.x, y: pod.y };
    return;
  }

  // Check resource node
  const node = engine.nodes.find((n) => n.amount > 0 && Math.hypot(n.x - worldX, n.y - worldY) < 36);
  if (node) {
    engine.rover.targetNodeId = node.id;
    engine.rover.targetPodId = null;
    engine.rover.moveTarget = { x: node.x, y: node.y };
    return;
  }

  engine.rover.targetNodeId = null;
  engine.rover.targetPodId = null;
  engine.rover.moveTarget = {
    x: Math.max(32, Math.min(WORLD_SIZE - 32, worldX)),
    y: Math.max(32, Math.min(WORLD_SIZE - 32, worldY)),
  };
}