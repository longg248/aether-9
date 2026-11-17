import { BUILDINGS, GRID_SIZE, HUB_GX, HUB_GY, HUB_X, HUB_Y, TILE_SIZE, UPGRADES } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { BuildingEntity, BuildingType } from '@/types/game';
import { isTileRevealed } from '@/utils/proceduralTerrain';
import { soundEngine } from '@/utils/soundEngine';

export function getEnergyStats(engine: AetherGameEngine): { prod: number; use: number; efficiency: number } {
  const isNight = engine.dayTime > 0.72 || engine.dayTime < 0.14;
  const solarMult = isNight ? 0.6 : 1.0;
  let prod = 25; // Hub reactor baseline
  let use = 0;

  for (const b of engine.buildings) {
    const cfg = BUILDINGS[b.type];
    if (cfg.energyDelta > 0) {
      prod += cfg.energyDelta * (b.type === 'solar' ? solarMult : 1);
    } else {
      use += Math.abs(cfg.energyDelta);
    }
  }
  const efficiency = use === 0 ? 1 : Math.min(1, prod / use);
  return { prod: Math.round(prod), use, efficiency };
}

export function canBuildAt(
  engine: AetherGameEngine,
  gx: number,
  gy: number,
  type: BuildingType
): { ok: boolean; reason?: string } {
  if (gx < 1 || gy < 1 || gx >= GRID_SIZE - 1 || gy >= GRID_SIZE - 1) {
    return { ok: false, reason: 'Ngoài biên bản đồ' };
  }
  if (Math.abs(gx - HUB_GX) <= 1 && Math.abs(gy - HUB_GY) <= 1) {
    return { ok: false, reason: 'Khu vực Trung tâm Chỉ huy' };
  }
  if (!isTileRevealed(gx, gy, engine.rover.x, engine.rover.y, engine.buildings)) {
    return { ok: false, reason: 'Chưa thăm dò khu vực này' };
  }
  if (engine.buildings.some((b) => b.gx === gx && b.gy === gy)) {
    return { ok: false, reason: 'Ô đã có công trình' };
  }

  const node = engine.nodes.find((n) => n.gx === gx && n.gy === gy && n.amount > 0);
  if (type === 'drill' && !node) {
    return { ok: false, reason: 'Máy Khoan phải đặt lên mỏ tài nguyên' };
  }
  if (type !== 'drill' && node) {
    return { ok: false, reason: 'Không thể xây đè lên mỏ quặng' };
  }

  const cfg = BUILDINGS[type];
  if ((engine.resources.silicate || 0) < (cfg.cost.silicate || 0)) return { ok: false, reason: 'Thiếu Silicat' };
  if ((engine.resources.iron || 0) < (cfg.cost.iron || 0)) return { ok: false, reason: 'Thiếu Sắt' };
  if ((engine.resources.aether || 0) < (cfg.cost.aether || 0)) return { ok: false, reason: 'Thiếu Aether' };

  return { ok: true };
}

export function placeBuilding(engine: AetherGameEngine, gx: number, gy: number, type: BuildingType): boolean {
  const check = engine.canBuildAt(gx, gy, type);
  if (!check.ok) {
    if (check.reason) engine.pushLog(check.reason, 'warn');
    return false;
  }

  const cfg = BUILDINGS[type];
  engine.resources.silicate -= cfg.cost.silicate || 0;
  engine.resources.iron -= cfg.cost.iron || 0;
  engine.resources.aether -= cfg.cost.aether || 0;

  const x = (gx + 0.5) * TILE_SIZE;
  const y = (gy + 0.5) * TILE_SIZE;
  const linkedNode = type === 'drill' ? engine.nodes.find((n) => n.gx === gx && n.gy === gy) : undefined;

  const building: BuildingEntity = {
    id: `bld_${Date.now()}_${Math.random()}`,
    type,
    gx,
    gy,
    x,
    y,
    hp: cfg.maxHp,
    maxHp: cfg.maxHp,
    cooldown: 0,
    animPhase: Math.random() * Math.PI * 2,
    angle: 0,
    recoil: 0,
    hitFlash: 0,
    linkedNodeId: linkedNode?.id,
  };

  engine.buildings.push(building);
  soundEngine.build();
  engine.spawnParticles(x, y, cfg.accent, 16, 100, true);
  engine.addFloatingText(x, y - 16, `+ ${cfg.name}`, cfg.accent, 1);

  if (type === 'drill' && linkedNode) {
    engine.drones.push({
      id: `drone_${building.id}`,
      drillId: building.id,
      x,
      y,
      state: 'to_node',
      cargoType: null,
      cargoAmount: 0,
      propellerAngle: 0,
    });
  }

  return true;
}

export function buyUpgrade(engine: AetherGameEngine, id: string): void {
  const upg = UPGRADES.find((u) => u.id === id);
  if (!upg) return;
  const lvl = engine.upgrades[id] || 0;
  if (lvl >= upg.maxLevel) return;
  if (upg.reqLab && !engine.buildings.some((b) => b.type === 'lab')) {
    engine.pushLog('Cần xây Phòng Nghiên Cứu Aether [7] trước!', 'warn');
    return;
  }

  const mult = Math.pow(1.45, lvl);
  const costSil = Math.round((upg.cost.silicate || 0) * mult);
  const costIron = Math.round((upg.cost.iron || 0) * mult);
  const costAeth = Math.round((upg.cost.aether || 0) * mult);

  if (engine.resources.silicate < costSil || engine.resources.iron < costIron || engine.resources.aether < costAeth) {
    engine.pushLog('Không đủ tài nguyên nâng cấp!', 'warn');
    return;
  }

  engine.resources.silicate -= costSil;
  engine.resources.iron -= costIron;
  engine.resources.aether -= costAeth;
  engine.upgrades[id] = lvl + 1;

  if (id === 'shield_matrix') {
    engine.hubMaxHp += 400;
    engine.hubHp = Math.min(engine.hubMaxHp, engine.hubHp + 400);
  }

  soundEngine.build();
  engine.pushLog(`Đã nâng cấp: ${upg.name} (Cấp ${lvl + 1})`, 'good');
}

export function triggerQuickRepair(engine: AetherGameEngine): void {
  if (engine.resources.silicate < 20 || engine.resources.iron < 15) {
    engine.pushLog('Cần 20 Silicat & 15 Sắt để sửa chữa khẩn cấp!', 'warn');
    return;
  }
  engine.resources.silicate -= 20;
  engine.resources.iron -= 15;
  engine.hubHp = Math.min(engine.hubMaxHp, engine.hubHp + 260);
  for (const b of engine.buildings) {
    b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.45);
  }
  soundEngine.pickup();
  engine.spawnParticles(HUB_X, HUB_Y, '#2dd4bf', 24, 130, true);
  engine.addFloatingText(HUB_X, HUB_Y - 28, 'SỬA CHỮA TOÀN CĂN CỨ!', '#2dd4bf', 1.15);
}

export function updateBuildings(engine: AetherGameEngine, dt: number, efficiency: number): void {
  for (const b of engine.buildings) {
    b.animPhase += dt * 3;
    b.recoil = Math.max(0, b.recoil - dt * 18);
    b.hitFlash = Math.max(0, b.hitFlash - dt);
    b.cooldown -= dt * efficiency;

    if (b.type === 'smelter' && b.cooldown <= 0) {
      b.cooldown = 3.2;
      if (engine.resources.silicate >= 8) {
        engine.resources.silicate -= 8;
        engine.resources.iron += 5;
        engine.resources.aether += 1.5;
        engine.spawnParticles(b.x, b.y - 10, '#f87171', 4, 35, true);
      }
    } else if (b.type === 'lab' && b.cooldown <= 0) {
      b.cooldown = 2.0;
      engine.resources.aether += 3.0;
      engine.spawnParticles(b.x, b.y, '#c084fc', 5, 45, true);
    } else if (b.type === 'turret' && b.cooldown <= 0) {
      const range = (BUILDINGS.turret.radius || 5.5) * TILE_SIZE;
      const target = engine.enemies.find((e) => Math.hypot(e.x - b.x, e.y - b.y) <= range);
      if (target) {
        b.angle = Math.atan2(target.y - b.y, target.x - b.x);
        b.recoil = 5;
        b.cooldown = 0.52;
        const dmg = 28 * (1 + (engine.upgrades.turret_optics - 1) * 0.35);
        target.hp -= dmg;
        target.hitFlash = 0.14;
        soundEngine.laser();
        engine.lasers.push({
          x1: b.x,
          y1: b.y,
          x2: target.x,
          y2: target.y,
          color: '#fb7185',
          width: 3,
          life: 0.13,
          maxLife: 0.13,
        });
      }
    } else if (b.type === 'repair_bay' && b.cooldown <= 0) {
      b.cooldown = 1.2;
      const range = (BUILDINGS.repair_bay.radius || 5) * TILE_SIZE;
      for (const ally of engine.buildings) {
        if (ally.hp < ally.maxHp && Math.hypot(ally.x - b.x, ally.y - b.y) <= range) {
          ally.hp = Math.min(ally.maxHp, ally.hp + 18);
          engine.lasers.push({
            x1: b.x,
            y1: b.y,
            x2: ally.x,
            y2: ally.y,
            color: '#2dd4bf',
            width: 2,
            life: 0.25,
            maxLife: 0.25,
          });
        }
      }
    }
  }
}