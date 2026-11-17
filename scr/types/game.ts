export type ResourceType = 'silicate' | 'iron' | 'aether';
export type BuildingType =
  | 'solar'
  | 'drill'
  | 'smelter'
  | 'radar'
  | 'turret'
  | 'wall'
  | 'lab'
  | 'repair_bay';

export type EnemyType = 'swarmer' | 'goliath' | 'spitter' | 'behemoth';
export type GameSpeed = 0 | 1 | 2;
export type GameStatus = 'intro' | 'playing' | 'victory' | 'gameover';

export interface Resources {
  silicate: number;
  iron: number;
  aether: number;
}

export interface BuildingConfig {
  id: BuildingType;
  key: string;
  name: string;
  cost: Partial<Resources>;
  energyDelta: number;
  maxHp: number;
  color: string;
  accent: string;
  radius?: number;
  reqTech?: string;
  desc: string;
}

export interface UpgradeConfig {
  id: string;
  name: string;
  cost: Partial<Resources>;
  maxLevel: number;
  reqLab?: boolean;
  desc: string;
}

export interface PhaseInfo {
  id: number;
  title: string;
  aiDirective: string;
  targetAether: number;
}

export interface BuildingEntity {
  id: string;
  type: BuildingType;
  gx: number;
  gy: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  animPhase: number;
  angle: number;
  recoil: number;
  hitFlash: number;
  linkedNodeId?: string;
}

export interface ResourceNode {
  id: string;
  type: ResourceType;
  gx: number;
  gy: number;
  x: number;
  y: number;
  amount: number;
  maxAmount: number;
  pulse: number;
  seed: number;
}

export interface CrashPod {
  id: string;
  x: number;
  y: number;
  gx: number;
  gy: number;
  progress: number;
  opened: boolean;
  beaconPhase: number;
}

export interface DroneEntity {
  id: string;
  drillId: string;
  x: number;
  y: number;
  state: 'to_node' | 'to_hub' | 'idle';
  cargoType: ResourceType | null;
  cargoAmount: number;
  propellerAngle: number;
}

export interface EnemyEntity {
  id: string;
  type: EnemyType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  legPhase: number;
  attackCooldown: number;
  stunTimer: number;
  hitFlash: number;
  angle: number;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  life: number;
  color: string;
  isAcid: boolean;
}

export interface AcidPool {
  x: number;
  y: number;
  radius: number;
  life: number;
  maxLife: number;
}

export interface LaserBeam {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  life: number;
  maxLife: number;
}

export interface LightningBolt {
  points: { x: number; y: number }[];
  life: number;
  maxLife: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  glow?: boolean;
}

export interface FloatingText {
  x: number;
  y: number;
  vy: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  scale: number;
}

export interface RoverState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  turretAngle: number;
  wheelPhase: number;
  mineCooldown: number;
  targetNodeId: string | null;
  targetPodId: string | null;
  moveTarget: { x: number; y: number } | null;
  dashCooldown: number;
  dashTimer: number;
  empCooldown: number;
  overchargeCooldown: number;
  overchargeTimer: number;
}

export interface HudSnapshot {
  elapsed: number;
  resources: Resources;
  energyProd: number;
  energyUse: number;
  hubHp: number;
  hubMaxHp: number;
  warpProgress: number;
  phaseIndex: number;
  stormTimer: number;
  stormActive: boolean;
  waveTimer: number;
  waveCount: number;
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  dayTime: number;
  upgrades: Record<string, number>;
  hasLab: boolean;
  skills: {
    dashCd: number;
    empCd: number;
    overchargeCd: number;
    overchargeActive: boolean;
  };
  logs: { id: string; text: string; type: 'info' | 'warn' | 'ai' | 'good' }[];
}