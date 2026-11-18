import type { Difficulty } from '@/constants/gameConfig';
import type {
  AcidPool,
  BuildingEntity,
  CrashPod,
  DroneEntity,
  EnemyEntity,
  GameSpeed,
  GameStatus,
  HudSnapshot,
  PoiEntity,
  Projectile,
  Resources,
  RoverState,
} from '@/types/game';

export const SAVE_GAME_VERSION = 1 as const;

export type SaveNodeState = Pick<import('@/types/game').ResourceNode, 'id' | 'amount'>;
export type SavePoiState = Pick<
  PoiEntity,
  | 'id'
  | 'discovered'
  | 'progress'
  | 'completed'
  | 'ambushSpawned'
  | 'guardIds'
  | 'guardsCleared'
  | 'beaconPhase'
>;

/** Versioned, JSON-serializable simulation state. Renderer/FX state is excluded. */
export interface SaveGame {
  version: typeof SAVE_GAME_VERSION;
  savedAt: number;
  worldSeed: number;
  difficulty: Difficulty;
  status: GameStatus;
  speed: GameSpeed;
  elapsed: number;
  dayTime: number;
  resources: Resources;
  upgrades: Record<string, number>;
  aetherReserve: number;
  hubHp: number;
  hubMaxHp: number;
  warpProgress: number;
  phaseIndex: number;
  buildings: BuildingEntity[];
  drones: DroneEntity[];
  nodes: SaveNodeState[];
  pois: SavePoiState[];
  crashPods: CrashPod[];
  enemies: EnemyEntity[];
  projectiles: Projectile[];
  acidPools: AcidPool[];
  waveTimer: number;
  waveCount: number;
  stormTimer: number;
  stormActive: boolean;
  stormDuration: number;
  podTimer: number;
  bossSpawned: boolean;
  objectiveIndex: number;
  stormsSurvived: number;
  behemothKilled: number;
  rover: RoverState;
  logs: HudSnapshot['logs'];
}

export type SaveGameErrorCode = 'MALFORMED_SAVE' | 'UNSUPPORTED_VERSION';

export class SaveGameError extends Error {
  constructor(
    public readonly code: SaveGameErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SaveGameError';
  }
}

export type ApplySaveResult = { ok: true; save: SaveGame } | { ok: false; error: SaveGameError };
