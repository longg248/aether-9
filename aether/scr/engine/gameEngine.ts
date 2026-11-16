import {
  BUILDINGS,
  GRID_SIZE,
  HUB_GX,
  HUB_GY,
  HUB_X,
  HUB_Y,
  PHASES,
  TARGET_WARP_AETHER,
  TILE_SIZE,
  UPGRADES,
  WORLD_SIZE,
} from '@/constants/gameConfig';
import {
  AcidPool,
  BuildingEntity,
  BuildingType,
  CrashPod,
  DroneEntity,
  EnemyEntity,
  EnemyType,
  FloatingText,
  GameSpeed,
  GameStatus,
  HudSnapshot,
  LaserBeam,
  LightningBolt,
  Particle,
  Projectile,
  ResourceNode,
  Resources,
  RoverState,
} from '@/types/game';
import {
  CraterDecor,
  FloraDecor,
  createProceduralTerrain,
  generateResourceNodes,
  isTileRevealed,
} from '@/utils/proceduralTerrain';
import { soundEngine } from '@/utils/soundEngine';

export class AetherGameEngine {
  private terrainCanvas: HTMLCanvasElement;
  private craters: CraterDecor[];
  private flora: FloraDecor[];

  public status: GameStatus = 'intro';
  public speed: GameSpeed = 1;
  public elapsed = 0;
  public dayTime = 0.22; // 0..1 cycle (0.22 = crisp morning)

  public resources: Resources = { silicate: 90, iron: 45, aether: 0 };
  public hubHp = 1200;
  public hubMaxHp = 1200;
  public warpProgress = 0;
  public phaseIndex = 0;

  public buildings: BuildingEntity[] = [];
  public nodes: ResourceNode[] = [];
  public drones: DroneEntity[] = [];
  public enemies: EnemyEntity[] = [];
  public crashPods: CrashPod[] = [];
  public projectiles: Projectile[] = [];
  public acidPools: AcidPool[] = [];
  public lasers: LaserBeam[] = [];
  public lightnings: LightningBolt[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];
  public tireTracks: { x: number; y: number; alpha: number }[] = [];

  public upgrades: Record<string, number> = {
    rover_laser: 1,
    drone_logistics: 1,
    turret_optics: 1,
    shield_matrix: 0,
    aether_capacitor: 0,
  };

  public rover: RoverState = {
    x: HUB_X + 75,
    y: HUB_Y + 60,
    vx: 0,
    vy: 0,
    angle: 0,
    turretAngle: 0,
    wheelPhase: 0,
    mineCooldown: 0,
    targetNodeId: null,
    targetPodId: null,
    moveTarget: null,
    dashCooldown: 0,
    dashTimer: 0,
    empCooldown: 0,
    overchargeCooldown: 0,
    overchargeTimer: 0,
  };

  public keys = new Set<string>();
  public hoverTile: { gx: number; gy: number } | null = null;
  public selectedBuild: BuildingType | null = null;

  public camera = { x: HUB_X, y: HUB_Y, shake: 0 };
  public stormTimer = 140;
  public stormActive = false;
  public stormDuration = 0;
  public waveTimer = 95;
  public waveCount = 0;
  public podTimer = 55;
  public bossSpawned = false;

  public logs: { id: string; text: string; type: 'info' | 'warn' | 'ai' | 'good' }[] = [];

  constructor() {
    const terrain = createProceduralTerrain();
    this.terrainCanvas = terrain.canvas;
    this.craters = terrain.craters;
    this.flora = terrain.flora;
    this.reset();
  }

  public reset(): void {
    this.elapsed = 0;
    this.dayTime = 0.22;
    this.resources = { silicate: 90, iron: 45, aether: 0 };
    this.hubHp = 1200;
    this.hubMaxHp = 1200;
    this.warpProgress = 0;
    this.phaseIndex = 0;

    this.buildings = [];
    this.nodes = generateResourceNodes();
    this.drones = [];
    this.enemies = [];
    this.crashPods = [];
    this.projectiles = [];
    this.acidPools = [];
    this.lasers = [];
    this.lightnings = [];
    this.particles = [];
    this.floatingTexts = [];
    this.tireTracks = [];

    this.upgrades = {
      rover_laser: 1,
      drone_logistics: 1,
      turret_optics: 1,
      shield_matrix: 0,
      aether_capacitor: 0,
    };

    this.rover = {
      x: HUB_X + 75,
      y: HUB_Y + 60,
      vx: 0,
      vy: 0,
      angle: 0,
      turretAngle: 0,
      wheelPhase: 0,
      mineCooldown: 0,
      targetNodeId: null,
      targetPodId: null,
      moveTarget: null,
      dashCooldown: 0,
      dashTimer: 0,
      empCooldown: 0,
      overchargeCooldown: 0,
      overchargeTimer: 0,
    };

    this.camera = { x: HUB_X, y: HUB_Y, shake: 0 };
    this.stormTimer = 140;
    this.stormActive = false;
    this.stormDuration = 0;
    this.waveTimer = 95;
    this.waveCount = 0;
    this.podTimer = 45;
    this.bossSpawned = false;
    this.logs = [];
    this.pushLog(PHASES[0].aiDirective, 'ai');
  }

  public pushLog(text: string, type: 'info' | 'warn' | 'ai' | 'good' = 'info'): void {
    this.logs = [{ id: `${Date.now()}_${Math.random()}`, text, type }, ...this.logs].slice(0, 6);
  }

  public addFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    this.floatingTexts.push({
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

  public spawnParticles(x: number, y: number, color: string, count: number, speed = 90, glow = false): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * speed;
      const life = 0.35 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        size: 2 + Math.random() * 3,
        color,
        alpha: 1,
        life,
        maxLife: life,
        glow,
      });
    }
  }

  public getEnergyStats(): { prod: number; use: number; efficiency: number } {
    const isNight = this.dayTime > 0.72 || this.dayTime < 0.14;
    const solarMult = isNight ? 0.6 : 1.0;
    let prod = 25; // Hub reactor baseline
    let use = 0;

    for (const b of this.buildings) {
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

  public canBuildAt(gx: number, gy: number, type: BuildingType): { ok: boolean; reason?: string } {
    if (gx < 1 || gy < 1 || gx >= GRID_SIZE - 1 || gy >= GRID_SIZE - 1) {
      return { ok: false, reason: 'Ngoài biên bản đồ' };
    }
    if (Math.abs(gx - HUB_GX) <= 1 && Math.abs(gy - HUB_GY) <= 1) {
      return { ok: false, reason: 'Khu vực Trung tâm Chỉ huy' };
    }
    if (!isTileRevealed(gx, gy, this.rover.x, this.rover.y, this.buildings)) {
      return { ok: false, reason: 'Chưa thăm dò khu vực này' };
    }
    if (this.buildings.some((b) => b.gx === gx && b.gy === gy)) {
      return { ok: false, reason: 'Ô đã có công trình' };
    }

    const node = this.nodes.find((n) => n.gx === gx && n.gy === gy && n.amount > 0);
    if (type === 'drill' && !node) {
      return { ok: false, reason: 'Máy Khoan phải đặt lên mỏ tài nguyên' };
    }
    if (type !== 'drill' && node) {
      return { ok: false, reason: 'Không thể xây đè lên mỏ quặng' };
    }

    const cfg = BUILDINGS[type];
    if ((this.resources.silicate || 0) < (cfg.cost.silicate || 0)) return { ok: false, reason: 'Thiếu Silicat' };
    if ((this.resources.iron || 0) < (cfg.cost.iron || 0)) return { ok: false, reason: 'Thiếu Sắt' };
    if ((this.resources.aether || 0) < (cfg.cost.aether || 0)) return { ok: false, reason: 'Thiếu Aether' };

    return { ok: true };
  }

  public placeBuilding(gx: number, gy: number, type: BuildingType): boolean {
    const check = this.canBuildAt(gx, gy, type);
    if (!check.ok) {
      if (check.reason) this.pushLog(check.reason, 'warn');
      return false;
    }

    const cfg = BUILDINGS[type];
    this.resources.silicate -= cfg.cost.silicate || 0;
    this.resources.iron -= cfg.cost.iron || 0;
    this.resources.aether -= cfg.cost.aether || 0;

    const x = (gx + 0.5) * TILE_SIZE;
    const y = (gy + 0.5) * TILE_SIZE;
    const linkedNode = type === 'drill' ? this.nodes.find((n) => n.gx === gx && n.gy === gy) : undefined;

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

    this.buildings.push(building);
    soundEngine.build();
    this.spawnParticles(x, y, cfg.accent, 16, 100, true);
    this.addFloatingText(x, y - 16, `+ ${cfg.name}`, cfg.accent, 1);

    if (type === 'drill' && linkedNode) {
      this.drones.push({
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

  public buyUpgrade(id: string): void {
    const upg = UPGRADES.find((u) => u.id === id);
    if (!upg) return;
    const lvl = this.upgrades[id] || 0;
    if (lvl >= upg.maxLevel) return;
    if (upg.reqLab && !this.buildings.some((b) => b.type === 'lab')) {
      this.pushLog('Cần xây Phòng Nghiên Cứu Aether [7] trước!', 'warn');
      return;
    }

    const mult = Math.pow(1.45, lvl);
    const costSil = Math.round((upg.cost.silicate || 0) * mult);
    const costIron = Math.round((upg.cost.iron || 0) * mult);
    const costAeth = Math.round((upg.cost.aether || 0) * mult);

    if (this.resources.silicate < costSil || this.resources.iron < costIron || this.resources.aether < costAeth) {
      this.pushLog('Không đủ tài nguyên nâng cấp!', 'warn');
      return;
    }

    this.resources.silicate -= costSil;
    this.resources.iron -= costIron;
    this.resources.aether -= costAeth;
    this.upgrades[id] = lvl + 1;

    if (id === 'shield_matrix') {
      this.hubMaxHp += 400;
      this.hubHp = Math.min(this.hubMaxHp, this.hubHp + 400);
    }

    soundEngine.build();
    this.pushLog(`Đã nâng cấp: ${upg.name} (Cấp ${lvl + 1})`, 'good');
  }

  public triggerQuickRepair(): void {
    if (this.resources.silicate < 20 || this.resources.iron < 15) {
      this.pushLog('Cần 20 Silicat & 15 Sắt để sửa chữa khẩn cấp!', 'warn');
      return;
    }
    this.resources.silicate -= 20;
    this.resources.iron -= 15;
    this.hubHp = Math.min(this.hubMaxHp, this.hubHp + 260);
    for (const b of this.buildings) {
      b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.45);
    }
    soundEngine.pickup();
    this.spawnParticles(HUB_X, HUB_Y, '#2dd4bf', 24, 130, true);
    this.addFloatingText(HUB_X, HUB_Y - 28, 'SỬA CHỮA TOÀN CĂN CỨ!', '#2dd4bf', 1.15);
  }

  public triggerDash(): void {
    if (this.rover.dashCooldown > 0) return;
    this.rover.dashCooldown = 4.5;
    this.rover.dashTimer = 0.24;
    soundEngine.dash();
    this.spawnParticles(this.rover.x, this.rover.y, '#38bdf8', 14, 120, true);
  }

  public triggerEmp(): void {
    if (this.rover.empCooldown > 0) return;
    this.rover.empCooldown = 14;
    soundEngine.emp();
    this.camera.shake = 10;
    this.spawnParticles(this.rover.x, this.rover.y, '#a855f7', 36, 220, true);
    this.addFloatingText(this.rover.x, this.rover.y - 24, 'XUNG EMP!', '#c084fc', 1.2);

    const dmg = 55 * (1 + (this.upgrades.turret_optics - 1) * 0.35);
    for (const e of this.enemies) {
      const dist = Math.hypot(e.x - this.rover.x, e.y - this.rover.y);
      if (dist <= 230) {
        e.hp -= dmg;
        e.stunTimer = 3.2;
        e.hitFlash = 0.25;
        const pushAngle = Math.atan2(e.y - this.rover.y, e.x - this.rover.x);
        e.x += Math.cos(pushAngle) * 32;
        e.y += Math.sin(pushAngle) * 32;
      }
    }
  }

  public triggerOvercharge(): void {
    if (this.rover.overchargeCooldown > 0) return;
    this.rover.overchargeCooldown = 20;
    this.rover.overchargeTimer = 6.0;
    soundEngine.pickup();
    this.addFloatingText(this.rover.x, this.rover.y - 26, 'QUÁ TẢI LASER 300%!', '#facc15', 1.2);
  }

  public handleWorldClick(worldX: number, worldY: number): void {
    if (this.status !== 'playing') return;
    const gx = Math.floor(worldX / TILE_SIZE);
    const gy = Math.floor(worldY / TILE_SIZE);

    if (this.selectedBuild) {
      this.placeBuilding(gx, gy, this.selectedBuild);
      return;
    }

    // Check crash pod
    const pod = this.crashPods.find((p) => !p.opened && Math.hypot(p.x - worldX, p.y - worldY) < 38);
    if (pod) {
      this.rover.targetPodId = pod.id;
      this.rover.targetNodeId = null;
      this.rover.moveTarget = { x: pod.x, y: pod.y };
      return;
    }

    // Check resource node
    const node = this.nodes.find((n) => n.amount > 0 && Math.hypot(n.x - worldX, n.y - worldY) < 36);
    if (node) {
      this.rover.targetNodeId = node.id;
      this.rover.targetPodId = null;
      this.rover.moveTarget = { x: node.x, y: node.y };
      return;
    }

    this.rover.targetNodeId = null;
    this.rover.targetPodId = null;
    this.rover.moveTarget = {
      x: Math.max(32, Math.min(WORLD_SIZE - 32, worldX)),
      y: Math.max(32, Math.min(WORLD_SIZE - 32, worldY)),
    };
  }

  private spawnEnemyWave(): void {
    this.waveCount++;
    const side = Math.floor(Math.random() * 4);
    const baseCount = Math.min(22, 4 + Math.floor(this.waveCount * 1.6));
    this.pushLog(`Cảnh báo: Đợt Bọ Tinh Thể #${this.waveCount} đang tiến công!`, 'warn');

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
      if (this.waveCount >= 3 && i % 5 === 0) type = 'goliath';
      if (this.waveCount >= 4 && i % 6 === 1) type = 'spitter';

      this.createEnemy(type, sx + (Math.random() - 0.5) * 90, sy + (Math.random() - 0.5) * 90);
    }

    // Spawn Behemoth Boss in Phase 4+
    if (this.phaseIndex >= 3 && !this.bossSpawned) {
      this.bossSpawned = true;
      this.createEnemy('behemoth', 120, 120);
      soundEngine.bossAlert();
      this.pushLog('CẢNH BÁO ĐỎ: CHÚA TỂ TỔ KÉN AETHER BEHEMOTH XUẤT HIỆN!', 'warn');
    }
  }

  private createEnemy(type: EnemyType, x: number, y: number): void {
    const scale = 1 + this.waveCount * 0.14;
    const stats: Record<EnemyType, { hp: number; speed: number; radius: number }> = {
      swarmer: { hp: 55 * scale, speed: 68, radius: 12 },
      goliath: { hp: 220 * scale, speed: 42, radius: 19 },
      spitter: { hp: 85 * scale, speed: 52, radius: 14 },
      behemoth: { hp: 2600, speed: 32, radius: 34 },
    };
    const s = stats[type];
    this.enemies.push({
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

  public update(rawDt: number): void {
    if (this.status !== 'playing' || this.speed === 0) return;
    const dt = Math.min(0.05, rawDt) * this.speed;
    this.elapsed += dt;
    this.dayTime = (this.dayTime + dt / 240) % 1; // 4-minute full day/night cycle

    // Cooldowns
    this.rover.dashCooldown = Math.max(0, this.rover.dashCooldown - dt);
    this.rover.dashTimer = Math.max(0, this.rover.dashTimer - dt);
    this.rover.empCooldown = Math.max(0, this.rover.empCooldown - dt);
    this.rover.overchargeCooldown = Math.max(0, this.rover.overchargeCooldown - dt);
    this.rover.overchargeTimer = Math.max(0, this.rover.overchargeTimer - dt);
    this.camera.shake = Math.max(0, this.camera.shake - dt * 28);

    // Rover Movement (WASD / Arrows or Click target)
    let ix = 0;
    let iy = 0;
    if (this.keys.has('w') || this.keys.has('arrowup')) iy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) iy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) ix -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) ix += 1;

    if (ix !== 0 || iy !== 0) {
      this.rover.moveTarget = null;
      const len = Math.hypot(ix, iy);
      ix /= len;
      iy /= len;
    } else if (this.rover.moveTarget) {
      const dx = this.rover.moveTarget.x - this.rover.x;
      const dy = this.rover.moveTarget.y - this.rover.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 34) {
        ix = dx / dist;
        iy = dy / dist;
      } else {
        this.rover.moveTarget = null;
      }
    }

    const baseSpeed = 165 * (1 + (this.upgrades.rover_laser - 1) * 0.15);
    const moveSpeed = this.rover.dashTimer > 0 ? baseSpeed * 2.8 : baseSpeed;
    this.rover.vx = ix * moveSpeed;
    this.rover.vy = iy * moveSpeed;
    this.rover.x = Math.max(28, Math.min(WORLD_SIZE - 28, this.rover.x + this.rover.vx * dt));
    this.rover.y = Math.max(28, Math.min(WORLD_SIZE - 28, this.rover.y + this.rover.vy * dt));

    if (Math.hypot(this.rover.vx, this.rover.vy) > 8) {
      this.rover.angle = Math.atan2(this.rover.vy, this.rover.vx);
      this.rover.wheelPhase += dt * 16;
      if (Math.random() < 0.45) {
        this.tireTracks.push({ x: this.rover.x, y: this.rover.y, alpha: 0.35 });
        if (this.tireTracks.length > 140) this.tireTracks.shift();
      }
    }

    // Smooth camera follow
    this.camera.x += (this.rover.x - this.camera.x) * Math.min(1, dt * 6.5);
    this.camera.y += (this.rover.y - this.camera.y) * Math.min(1, dt * 6.5);

    // Crash Pods spawning & decoding
    this.podTimer -= dt;
    if (this.podTimer <= 0 && this.crashPods.filter((p) => !p.opened).length < 2) {
      this.podTimer = 75;
      const gx = 4 + Math.floor(Math.random() * (GRID_SIZE - 8));
      const gy = 4 + Math.floor(Math.random() * (GRID_SIZE - 8));
      if (Math.hypot(gx - HUB_GX, gy - HUB_GY) > 7) {
        this.crashPods.push({
          id: `pod_${Date.now()}`,
          gx,
          gy,
          x: (gx + 0.5) * TILE_SIZE,
          y: (gy + 0.5) * TILE_SIZE,
          progress: 0,
          opened: false,
          beaconPhase: 0,
        });
        this.pushLog('Tàu Mẹ thả Hộp Tiếp Tế xuống bề mặt! Kiểm tra Radar.', 'good');
      }
    }

    for (const pod of this.crashPods) {
      if (pod.opened) continue;
      pod.beaconPhase += dt * 4;
      if (Math.hypot(pod.x - this.rover.x, pod.y - this.rover.y) < 62) {
        pod.progress += dt * 0.55;
        if (pod.progress >= 1) {
          pod.opened = true;
          this.resources.silicate += 85;
          this.resources.iron += 65;
          this.resources.aether += 30;
          this.hubHp = Math.min(this.hubMaxHp, this.hubHp + 180);
          soundEngine.pickup();
          this.spawnParticles(pod.x, pod.y, '#facc15', 26, 140, true);
          this.addFloatingText(pod.x, pod.y - 20, '+85 Silicat, +65 Sắt, +30 Aether!', '#facc15', 1.15);
        }
      }
    }

    // Rover Auto-Mining & Combat Laser
    this.rover.mineCooldown -= dt;
    const overchargeMult = this.rover.overchargeTimer > 0 ? 3.0 : 1.0;

    // Prioritize nearby enemies for Rover turret
    const nearEnemy = this.enemies.find((e) => Math.hypot(e.x - this.rover.x, e.y - this.rover.y) < 195);
    if (nearEnemy && this.rover.mineCooldown <= 0) {
      this.rover.turretAngle = Math.atan2(nearEnemy.y - this.rover.y, nearEnemy.x - this.rover.x);
      this.rover.mineCooldown = 0.34 / overchargeMult;
      const dmg = 22 * (1 + (this.upgrades.turret_optics - 1) * 0.35);
      nearEnemy.hp -= dmg;
      nearEnemy.hitFlash = 0.14;
      soundEngine.laser();
      this.lasers.push({
        x1: this.rover.x,
        y1: this.rover.y,
        x2: nearEnemy.x,
        y2: nearEnemy.y,
        color: this.rover.overchargeTimer > 0 ? '#facc15' : '#38bdf8',
        width: this.rover.overchargeTimer > 0 ? 4 : 2.5,
        life: 0.12,
        maxLife: 0.12,
      });
    } else {
      const targetNode =
        this.nodes.find((n) => n.id === this.rover.targetNodeId && n.amount > 0) ||
        this.nodes.find((n) => n.amount > 0 && Math.hypot(n.x - this.rover.x, n.y - this.rover.y) < 95);

      if (targetNode && Math.hypot(targetNode.x - this.rover.x, targetNode.y - this.rover.y) < 105) {
        this.rover.turretAngle = Math.atan2(targetNode.y - this.rover.y, targetNode.x - this.rover.x);
        if (this.rover.mineCooldown <= 0) {
          const speedMult = (1 + (this.upgrades.rover_laser - 1) * 0.35) * overchargeMult;
          this.rover.mineCooldown = 0.42 / speedMult;
          const isCrit = Math.random() < 0.22;
          const yieldAmt = isCrit ? 12 : 6;
          const mined = Math.min(targetNode.amount, yieldAmt);
          targetNode.amount -= mined;
          this.resources[targetNode.type] += mined;

          soundEngine.mine(isCrit);
          const color =
            targetNode.type === 'silicate' ? '#fb923c' : targetNode.type === 'iron' ? '#38bdf8' : '#c084fc';
          this.lasers.push({
            x1: this.rover.x,
            y1: this.rover.y,
            x2: targetNode.x,
            y2: targetNode.y,
            color,
            width: isCrit ? 4.5 : 2.6,
            life: 0.14,
            maxLife: 0.14,
          });
          this.spawnParticles(targetNode.x, targetNode.y, color, isCrit ? 10 : 5, 80, true);
          this.addFloatingText(
            targetNode.x,
            targetNode.y - 14,
            `${isCrit ? 'CRIT ' : ''}+${mined}`,
            color,
            isCrit ? 1.2 : 0.95
          );
        }
      }
    }

    // Energy & Production Buildings
    const { efficiency } = this.getEnergyStats();
    for (const b of this.buildings) {
      b.animPhase += dt * 3;
      b.recoil = Math.max(0, b.recoil - dt * 18);
      b.hitFlash = Math.max(0, b.hitFlash - dt);
      b.cooldown -= dt * efficiency;

      if (b.type === 'smelter' && b.cooldown <= 0) {
        b.cooldown = 3.2;
        if (this.resources.silicate >= 8) {
          this.resources.silicate -= 8;
          this.resources.iron += 5;
          this.resources.aether += 1.5;
          this.spawnParticles(b.x, b.y - 10, '#f87171', 4, 35, true);
        }
      } else if (b.type === 'lab' && b.cooldown <= 0) {
        b.cooldown = 2.0;
        this.resources.aether += 3.0;
        this.spawnParticles(b.x, b.y, '#c084fc', 5, 45, true);
      } else if (b.type === 'turret' && b.cooldown <= 0) {
        const range = (BUILDINGS.turret.radius || 5.5) * TILE_SIZE;
        const target = this.enemies.find((e) => Math.hypot(e.x - b.x, e.y - b.y) <= range);
        if (target) {
          b.angle = Math.atan2(target.y - b.y, target.x - b.x);
          b.recoil = 5;
          b.cooldown = 0.52;
          const dmg = 28 * (1 + (this.upgrades.turret_optics - 1) * 0.35);
          target.hp -= dmg;
          target.hitFlash = 0.14;
          soundEngine.laser();
          this.lasers.push({
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
        for (const ally of this.buildings) {
          if (ally.hp < ally.maxHp && Math.hypot(ally.x - b.x, ally.y - b.y) <= range) {
            ally.hp = Math.min(ally.maxHp, ally.hp + 18);
            this.lasers.push({
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

    // Drones Logistics
    const droneSpeed = 135 * (1 + (this.upgrades.drone_logistics - 1) * 0.3) * Math.max(0.35, efficiency);
    const droneCap = Math.round(10 * (1 + (this.upgrades.drone_logistics - 1) * 0.3));
    for (const d of this.drones) {
      d.propellerAngle += dt * 28;
      const drill = this.buildings.find((b) => b.id === d.drillId);
      const node = drill ? this.nodes.find((n) => n.id === drill.linkedNodeId) : undefined;
      if (!drill || !node || node.amount <= 0) continue;

      const destX = d.state === 'to_node' ? node.x : HUB_X;
      const destY = d.state === 'to_node' ? node.y : HUB_Y;
      const dx = destX - d.x;
      const dy = destY - d.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 12) {
        d.x += (dx / dist) * droneSpeed * dt;
        d.y += (dy / dist) * droneSpeed * dt;
      } else if (d.state === 'to_node') {
        const take = Math.min(node.amount, droneCap);
        node.amount -= take;
        d.cargoType = node.type;
        d.cargoAmount = take;
        d.state = 'to_hub';
      } else {
        if (d.cargoType && d.cargoAmount > 0) {
          this.resources[d.cargoType] += d.cargoAmount;
          d.cargoAmount = 0;
        }
        d.state = 'to_node';
      }
    }

    // Automatic Aether Transfer to Warp Engine
    if (this.resources.aether > 0.5 && this.warpProgress < TARGET_WARP_AETHER) {
      const rate = (12 + this.upgrades.aether_capacitor * 6) * dt;
      const transfer = Math.min(this.resources.aether, rate, TARGET_WARP_AETHER - this.warpProgress);
      this.resources.aether -= transfer;
      this.warpProgress += transfer;
    }

    // Update Phase Progression
    for (let i = PHASES.length - 1; i >= 0; i--) {
      if (this.warpProgress >= (i === 0 ? 0 : PHASES[i - 1].targetAether)) {
        if (i > this.phaseIndex) {
          this.phaseIndex = i;
          this.pushLog(PHASES[i].aiDirective, 'ai');
        }
        break;
      }
    }

    // Magnetic Storms
    if (!this.stormActive) {
      this.stormTimer -= dt;
      if (this.stormTimer <= 0) {
        this.stormActive = true;
        this.stormDuration = 22;
        this.stormTimer = 155;
        soundEngine.storm();
        this.pushLog('CẢNH BÁO: Bão Từ Địa Cầu đổ bộ! Tấm chắn đang chịu áp lực.', 'warn');
      }
    } else {
      this.stormDuration -= dt;
      if (Math.random() < dt * 2.2) {
        const lx = HUB_X + (Math.random() - 0.5) * 650;
        const ly = HUB_Y + (Math.random() - 0.5) * 650;
        this.camera.shake = 7;
        soundEngine.storm();
        this.lightnings.push({
          points: [
            { x: lx - 40, y: ly - 240 },
            { x: lx + 15, y: ly - 120 },
            { x: lx - 10, y: ly - 55 },
            { x: lx, y: ly },
          ],
          life: 0.25,
          maxLife: 0.25,
        });
        const resist = Math.max(0.25, 1 - this.upgrades.shield_matrix * 0.2);
        this.hubHp -= 18 * resist;
      }
      if (this.stormDuration <= 0) {
        this.stormActive = false;
        this.pushLog('Bão Từ đã tan. Hệ thống ổn định trở lại.', 'good');
      }
    }

    // Enemy Waves & AI
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveTimer = Math.max(55, 110 - this.waveCount * 4);
      this.spawnEnemyWave();
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (e.hp <= 0) {
        this.spawnParticles(e.x, e.y, '#c084fc', e.type === 'behemoth' ? 40 : 12, 130, true);
        if (e.type === 'behemoth') {
          this.resources.aether += 150;
          this.pushLog('ĐÃ TIÊU DIỆT AETHER BEHEMOTH! Thu được +150 Aether!', 'good');
        } else if (Math.random() < 0.35) {
          this.resources.aether += 3;
        }
        this.enemies.splice(i, 1);
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

      for (const b of this.buildings) {
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
          this.projectiles.push({
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
            const protectedByBay = this.buildings.some(
              (rb) => rb.type === 'repair_bay' && Math.hypot(rb.x - targetBuilding!.x, rb.y - targetBuilding!.y) <= 240
            );
            targetBuilding.hp -= baseDmg * (protectedByBay ? 0.75 : 1);
            targetBuilding.hitFlash = 0.16;
          } else {
            this.hubHp -= baseDmg;
            this.camera.shake = 5;
          }
        }
      }
    }

    // Remove destroyed buildings
    this.buildings = this.buildings.filter((b) => b.hp > 0);

    // Update Projectiles & Acid Pools
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        if (p.isAcid) {
          this.acidPools.push({ x: p.x, y: p.y, radius: 26, life: 5, maxLife: 5 });
          this.hubHp -= p.damage * 0.5;
        }
        this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      this.acidPools[i].life -= dt;
      if (this.acidPools[i].life <= 0) this.acidPools.splice(i, 1);
    }

    // Update FX
    for (let i = this.lasers.length - 1; i >= 0; i--) {
      this.lasers[i].life -= dt;
      if (this.lasers[i].life <= 0) this.lasers.splice(i, 1);
    }
    for (let i = this.lightnings.length - 1; i >= 0; i--) {
      this.lightnings[i].life -= dt;
      if (this.lightnings[i].life <= 0) this.lightnings.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      pt.alpha = Math.max(0, pt.life / pt.maxLife);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life -= dt;
      if (ft.life <= 0) this.floatingTexts.splice(i, 1);
    }
    for (const tr of this.tireTracks) tr.alpha -= dt * 0.04;
    this.tireTracks = this.tireTracks.filter((tr) => tr.alpha > 0);

    // Check Victory / Game Over
    if (this.warpProgress >= TARGET_WARP_AETHER) {
      this.status = 'victory';
    } else if (this.hubHp <= 0) {
      this.hubHp = 0;
      this.status = 'gameover';
    }
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    ctx.save();
    ctx.fillStyle = '#09060c';
    ctx.fillRect(0, 0, width, height);

    const shakeX = (Math.random() - 0.5) * this.camera.shake;
    const shakeY = (Math.random() - 0.5) * this.camera.shake;
    const camX = Math.round(this.camera.x - width / 2 + shakeX);
    const camY = Math.round(this.camera.y - height / 2 + shakeY);

    ctx.translate(-camX, -camY);

    // 1. Offscreen Terrain Layer
    ctx.drawImage(this.terrainCanvas, 0, 0);

    // 2. Bioluminescent flora sway
    for (const f of this.flora) {
      if (Math.abs(f.x - this.camera.x) > width * 0.65 || Math.abs(f.y - this.camera.y) > height * 0.65) continue;
      const sway = Math.sin(this.elapsed * 2 + f.phase) * 2.5;
      ctx.fillStyle = `hsla(${f.hue}, 85%, 62%, 0.45)`;
      ctx.beginPath();
      ctx.arc(f.x + sway, f.y, f.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Tire tracks & Acid pools
    for (const tr of this.tireTracks) {
      ctx.fillStyle = `rgba(10, 6, 8, ${tr.alpha})`;
      ctx.fillRect(tr.x - 4, tr.y - 4, 8, 8);
    }
    for (const ap of this.acidPools) {
      ctx.fillStyle = `rgba(74, 222, 128, ${0.32 * (ap.life / ap.maxLife)})`;
      ctx.beginPath();
      ctx.arc(ap.x, ap.y, ap.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Resource Nodes (3D faceted crystals/ores)
    for (const n of this.nodes) {
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

    // 5. Crash Pods
    for (const pod of this.crashPods) {
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

    // 6. Central Command Hub (Octagonal Multi-Tier Reactor)
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
    ctx.rotate(this.elapsed * 1.4);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(52, 0);
    ctx.stroke();
    ctx.restore();

    // 7. Player Buildings
    for (const b of this.buildings) {
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

    // 8. Drones
    for (const d of this.drones) {
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

    // 9. Enemies (Crystal Bugs & Behemoth Boss)
    for (const e of this.enemies) {
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

    // 10. Engineer Rover + Headlight Cone
    ctx.save();
    ctx.translate(this.rover.x, this.rover.y);

    // Headlight cone (brighter at night)
    const isNight = this.dayTime > 0.72 || this.dayTime < 0.14;
    ctx.save();
    ctx.rotate(this.rover.angle);
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
    ctx.rotate(this.rover.turretAngle);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-4, -3, 18, 6);
    ctx.restore();

    // 11. Additive Bloom FX (Lasers, Lightning, Particles)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const l of this.lasers) {
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

    for (const bolt of this.lightnings) {
      ctx.strokeStyle = '#38bdf8';
      ctx.globalAlpha = bolt.life / bolt.maxLife;
      ctx.lineWidth = 4;
      ctx.beginPath();
      bolt.points.forEach((p, idx) => (idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }

    for (const pt of this.particles) {
      ctx.globalAlpha = pt.alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 12. Build Placement Ghost Preview
    if (this.hoverTile && this.selectedBuild) {
      const { gx, gy } = this.hoverTile;
      const check = this.canBuildAt(gx, gy, this.selectedBuild);
      const bx = gx * TILE_SIZE;
      const by = gy * TILE_SIZE;
      ctx.fillStyle = check.ok ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.28)';
      ctx.strokeStyle = check.ok ? '#4ade80' : '#f87171';
      ctx.lineWidth = 2;
      ctx.fillRect(bx + 4, by + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      ctx.strokeRect(bx + 4, by + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }

    // 13. Soft Fog of War
    const startGx = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endGx = Math.min(GRID_SIZE - 1, Math.ceil((camX + width) / TILE_SIZE) + 1);
    const startGy = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endGy = Math.min(GRID_SIZE - 1, Math.ceil((camY + height) / TILE_SIZE) + 1);

    for (let gy = startGy; gy <= endGy; gy++) {
      for (let gx = startGx; gx <= endGx; gx++) {
        if (!isTileRevealed(gx, gy, this.rover.x, this.rover.y, this.buildings)) {
          ctx.fillStyle = 'rgba(7, 5, 12, 0.84)';
          ctx.fillRect(gx * TILE_SIZE, gy * TILE_SIZE, TILE_SIZE + 1, TILE_SIZE + 1);
        }
      }
    }

    // 14. Floating Combat/Resource Text
    for (const ft of this.floatingTexts) {
      ctx.globalAlpha = Math.max(0, ft.life / ft.maxLife);
      ctx.font = `bold ${Math.round(13 * ft.scale)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 15. Day/Night Atmospheric Tint Overlay
    if (this.dayTime > 0.72 || this.dayTime < 0.14) {
      ctx.fillStyle = 'rgba(8, 12, 34, 0.34)';
      ctx.fillRect(0, 0, width, height);
    } else if (this.dayTime > 0.58) {
      ctx.fillStyle = 'rgba(88, 28, 68, 0.14)';
      ctx.fillRect(0, 0, width, height);
    }
  }

  public getHudSnapshot(): HudSnapshot {
    const energy = this.getEnergyStats();
    const boss = this.enemies.find((e) => e.type === 'behemoth');
    return {
      elapsed: this.elapsed,
      resources: { ...this.resources },
      energyProd: energy.prod,
      energyUse: energy.use,
      hubHp: Math.round(this.hubHp),
      hubMaxHp: this.hubMaxHp,
      warpProgress: this.warpProgress,
      phaseIndex: this.phaseIndex,
      stormTimer: Math.ceil(this.stormTimer),
      stormActive: this.stormActive,
      waveTimer: Math.ceil(this.waveTimer),
      waveCount: this.waveCount,
      bossActive: Boolean(boss),
      bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
      bossMaxHp: boss ? boss.maxHp : 1,
      dayTime: this.dayTime,
      upgrades: { ...this.upgrades },
      hasLab: this.buildings.some((b) => b.type === 'lab'),
      skills: {
        dashCd: Number(this.rover.dashCooldown.toFixed(1)),
        empCd: Number(this.rover.empCooldown.toFixed(1)),
        overchargeCd: Number(this.rover.overchargeCooldown.toFixed(1)),
        overchargeActive: this.rover.overchargeTimer > 0,
      },
      logs: this.logs,
    };
  }
}