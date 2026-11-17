import { DEFAULT_AETHER_RESERVE, HUB_X, HUB_Y, PHASES } from '@/constants/gameConfig';
import { createInitialResources, createInitialRover, createInitialUpgrades } from '@/engine/gameState';
import { buildHudSnapshot } from '@/engine/hud';
import { renderWorld } from '@/engine/rendering/renderer';
import {
  buyUpgrade,
  canBuildAt,
  getEnergyStats,
  placeBuilding,
  triggerQuickRepair,
  updateBuildings,
} from '@/engine/systems/buildingSystem';
import { updateDrones } from '@/engine/systems/droneSystem';
import { addFloatingText, pushLog, spawnParticles, updateEffects } from '@/engine/systems/effectsSystem';
import { updateEnemies, updateProjectiles } from '@/engine/systems/enemySystem';
import { checkGameEnd, updateCrashPods, updateStorms, updateWarpProgress } from '@/engine/systems/environmentSystem';
import {
  handleWorldClick,
  triggerDash,
  triggerEmp,
  triggerOvercharge,
  updateRoverCombat,
  updateRoverMovement,
} from '@/engine/systems/roverSystem';
import {
  AcidPool,
  BuildingEntity,
  BuildingType,
  CrashPod,
  DroneEntity,
  EnemyEntity,
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
import { CraterDecor, FloraDecor, createProceduralTerrain, generateResourceNodes } from '@/utils/proceduralTerrain';

export class AetherGameEngine {
  public readonly terrainCanvas: HTMLCanvasElement;
  private craters: CraterDecor[];
  public readonly flora: FloraDecor[];

  public status: GameStatus = 'intro';
  public speed: GameSpeed = 1;
  public elapsed = 0;
  public dayTime = 0.22; // 0..1 cycle (0.22 = crisp morning)

  public resources: Resources = createInitialResources();
  public aetherReserve = DEFAULT_AETHER_RESERVE;
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

  public upgrades: Record<string, number> = createInitialUpgrades();

  public rover: RoverState = createInitialRover();

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
    this.resources = createInitialResources();
    this.aetherReserve = DEFAULT_AETHER_RESERVE;
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

    this.upgrades = createInitialUpgrades();
    this.rover = createInitialRover();

    this.keys.clear();
    this.hoverTile = null;
    this.selectedBuild = null;

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
    pushLog(this, text, type);
  }

  public addFloatingText(x: number, y: number, text: string, color: string, scale = 1): void {
    addFloatingText(this, x, y, text, color, scale);
  }

  public spawnParticles(x: number, y: number, color: string, count: number, speed = 90, glow = false): void {
    spawnParticles(this, x, y, color, count, speed, glow);
  }

  public getEnergyStats(): { prod: number; use: number; efficiency: number } {
    return getEnergyStats(this);
  }

  public canBuildAt(gx: number, gy: number, type: BuildingType): { ok: boolean; reason?: string } {
    return canBuildAt(this, gx, gy, type);
  }

  public placeBuilding(gx: number, gy: number, type: BuildingType): boolean {
    return placeBuilding(this, gx, gy, type);
  }

  public buyUpgrade(id: string): void {
    buyUpgrade(this, id);
  }

  /** Configures how much Aether the Warp Engine must leave untouched. */
  public setAetherReserve(value: number): void {
    this.aetherReserve = Number.isFinite(value) ? Math.max(0, value) : DEFAULT_AETHER_RESERVE;
  }

  public triggerQuickRepair(): void {
    triggerQuickRepair(this);
  }

  public triggerDash(): void {
    triggerDash(this);
  }

  public triggerEmp(): void {
    triggerEmp(this);
  }

  public triggerOvercharge(): void {
    triggerOvercharge(this);
  }

  public handleWorldClick(worldX: number, worldY: number): void {
    handleWorldClick(this, worldX, worldY);
  }

  public update(rawDt: number): void {
    if (this.status !== 'playing' || this.speed === 0) return;
    const dt = Math.min(0.05, Math.max(0, rawDt)) * this.speed;
    this.elapsed += dt;
    this.dayTime = (this.dayTime + dt / 240) % 1; // 4-minute full day/night cycle

    updateRoverMovement(this, dt);
    updateCrashPods(this, dt);
    updateRoverCombat(this, dt);

    // Energy & Production Buildings
    const { efficiency } = this.getEnergyStats();
    updateBuildings(this, dt, efficiency);
    updateDrones(this, dt, efficiency);

    updateWarpProgress(this, dt);
    updateStorms(this, dt);
    updateEnemies(this, dt);
    updateProjectiles(this, dt);
    updateEffects(this, dt);
    checkGameEnd(this);
  }

  public render(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    renderWorld(this, ctx, width, height);
  }

  public getHudSnapshot(): HudSnapshot {
    return buildHudSnapshot(this);
  }
}