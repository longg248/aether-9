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
export type PoiType =
  | 'research_station'
  | 'aether_deposit'
  | 'signal_relay'
  | 'crystal_nest'
  | 'supply_cache';
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

export interface PoiEntity {
  id: string;
  type: PoiType;
  gx: number;
  gy: number;
  x: number;
  y: number;
  /** Tile has been revealed at least once (permanent discovery flag). */
  discovered: boolean;
  /** 0..1 channeling progress for the rover interaction. */
  progress: number;
  /** Terminal state: restored / activated / opened / harvested. Rewards fire once. */
  completed: boolean;
  /** Crystal nest only: the one-time ambush has been triggered. */
  ambushSpawned: boolean;
  /** Crystal nest only: ids of the spawned guards. */
  guardIds: string[];
  /** Crystal nest only: all guards dead — the nest becomes harvestable. */
  guardsCleared: boolean;
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
  /** Free node this drone reserved after its drill's node depleted. */
  targetNodeId?: string | null;
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
  /** Elite variant: boosted stats, guaranteed Aether drop, gold ring visual. */
  elite?: boolean;
  /** Heavy telegraph: seconds left before the winded-up strike lands. */
  windupTimer?: number;
  /** Total windup duration, for the telegraph progress visual. */
  windupTotal?: number;
  /** Building id the windup is aimed at (null = the Hub). Re-validated on landing. */
  pendingTargetId?: string | null;
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
  damagePerSecond: number;
  tickTimer: number;
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

export interface MinimapSnapshot {
  hub: { x: number; y: number };
  rover: { x: number; y: number };
  pois: { id: string; type: PoiType; x: number; y: number; completed: boolean }[];
  enemies: { id: string; x: number; y: number; elite: boolean }[];
  revealedTiles: { gx: number; gy: number }[];
}

export interface HudSnapshot {
  elapsed: number;
  /** Spendable balance: resources.aether is what upgrades/buildings consume. */
  resources: Resources;
  /** Aether protected from automatic Warp transfer. */
  aetherReserve: number;
  /** Surplus above the reserve that the Warp Engine may auto-consume. */
  warpSurplus: number;
  energyProd: number;
  energyUse: number;
  /** 0..1 grid efficiency; below 1 buildings/drones run slowed (brownout). */
  energyEfficiency: number;
  hubHp: number;
  hubMaxHp: number;
  warpProgress: number;
  phaseIndex: number;
  stormTimer: number;
  stormActive: boolean;
  waveTimer: number;
  waveCount: number;
  /** Live enemy count for the threat indicator. */
  enemiesAlive: number;
  /** Automation overview: hauling = carrying cargo, idle = no available task. */
  drones: { total: number; hauling: number; idle: number };
  bossActive: boolean;
  bossHp: number;
  bossMaxHp: number;
  /** Active milestone objective (null once the whole chain is completed). */
  objective: { id: string; title: string; desc: string; progress: number; target: number } | null;
  objectivesDone: number;
  objectivesTotal: number;
  /** Exploration overview: discovered vs total points of interest. */
  poi: { discovered: number; total: number };
  /** Read-only tactical minimap model; reveal filtering matches the world renderer. */
  minimap: MinimapSnapshot;
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