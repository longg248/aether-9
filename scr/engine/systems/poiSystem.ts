import { GRID_SIZE, HUB_GX, HUB_GY, TILE_SIZE, WORLD_SEED } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { createEnemy } from '@/engine/systems/enemySystem';
import { PoiEntity, PoiType, ResourceNode, Resources } from '@/types/game';
import { isTileRevealed } from '@/utils/proceduralTerrain';
import { mulberry32 } from '@/utils/random';
import { soundEngine } from '@/utils/soundEngine';

export interface PoiConfig {
  name: string;
  color: string;
  accent: string;
  /** Seconds of rover proximity channeling; 0 = no interaction (deposit). */
  channelTime: number;
  /** One-time reward granted on completion (existing currencies only). */
  reward: Partial<Resources>;
  desc: string;
}

export const POI_CONFIG: Record<PoiType, PoiConfig> = {
  research_station: {
    name: 'Trạm Nghiên Cứu Bỏ Hoang',
    color: '#7c3aed',
    accent: '#c084fc',
    channelTime: 5,
    reward: { aether: 45, iron: 25 },
    desc: 'Phục hồi để thu dữ liệu Aether cổ (+45 Aether, +25 Sắt).',
  },
  aether_deposit: {
    name: 'Mỏ Aether Cổ Đại',
    color: '#a855f7',
    accent: '#e9d5ff',
    channelTime: 0,
    reward: {},
    desc: 'Mỏ Aether trữ lượng lớn — đặt Máy Khoan [2] để khai thác tự động.',
  },
  signal_relay: {
    name: 'Trạm Tín Hiệu Hỏng',
    color: '#059669',
    accent: '#34d399',
    channelTime: 4,
    reward: { aether: 10 },
    desc: 'Kích hoạt để mở tầm nhìn vĩnh viễn quanh trạm (+10 Aether).',
  },
  crystal_nest: {
    name: 'Tổ Kén Tinh Thể',
    color: '#be123c',
    accent: '#fb7185',
    channelTime: 3,
    reward: { aether: 40 },
    desc: 'Nguy hiểm: lính gác phục kích! Dọn sạch để thu hoạch (+40 Aether).',
  },
  supply_cache: {
    name: 'Kho Tiếp Tế Cổ',
    color: '#ca8a04',
    accent: '#facc15',
    channelTime: 2.5,
    reward: { silicate: 70, iron: 50 },
    desc: 'Mở kho lấy vật liệu xây dựng (+70 Silicat, +50 Sắt).',
  },
};

/** Deterministic world layout: type counts placed from the fixed world seed. */
export const POI_PLAN: ReadonlyArray<{ type: PoiType; count: number }> = [
  { type: 'research_station', count: 2 },
  { type: 'aether_deposit', count: 3 },
  { type: 'signal_relay', count: 2 },
  { type: 'crystal_nest', count: 3 },
  { type: 'supply_cache', count: 3 },
];

/** POIs stay outside the starting/economy zone so early game is unchanged. */
export const POI_MIN_HUB_DIST = 8;
/** Chebyshev separation between POIs (no overlapping features). */
export const POI_MIN_SEPARATION = 3;
/** Finite aether amount of an ancient deposit node (normal nodes: 350). */
export const DEPOSIT_AMOUNT = 420;
/** Rover proximity that triggers the one-time nest ambush. */
export const NEST_AMBUSH_RADIUS = 150;
/** Rover proximity for channeling interactions (same feel as crash pods). */
export const POI_INTERACT_RADIUS = 62;

/**
 * Deterministic POI placement from the world seed — identical on every run.
 * Never inside the Hub zone, never overlapping another POI, and always inside
 * the buildable grid margin. Resource nodes are generated afterwards and
 * avoid POI tiles, so the mining economy never collides with world features.
 */
export function generatePOIs(seed: number = WORLD_SEED): PoiEntity[] {
  const rand = mulberry32(seed);
  const placed: PoiEntity[] = [];

  for (const { type, count } of POI_PLAN) {
    let placedCount = 0;
    let guard = 0;
    while (placedCount < count && guard < 3000) {
      guard++;
      const gx = 3 + Math.floor(rand() * (GRID_SIZE - 6));
      const gy = 3 + Math.floor(rand() * (GRID_SIZE - 6));
      if (Math.hypot(gx - HUB_GX, gy - HUB_GY) < POI_MIN_HUB_DIST) continue;
      if (
        placed.some(
          (p) => Math.max(Math.abs(p.gx - gx), Math.abs(p.gy - gy)) < POI_MIN_SEPARATION
        )
      ) {
        continue;
      }
      placed.push({
        id: `poi_${type}_${placedCount}`,
        type,
        gx,
        gy,
        x: (gx + 0.5) * TILE_SIZE,
        y: (gy + 0.5) * TILE_SIZE,
        discovered: false,
        progress: 0,
        completed: false,
        ambushSpawned: false,
        guardIds: [],
        guardsCleared: false,
        beaconPhase: rand() * Math.PI * 2,
      });
      placedCount++;
    }
  }
  return placed;
}

/** Ancient deposits are ordinary finite resource nodes: drills/drones reuse them. */
export function createDepositNodes(pois: PoiEntity[]): ResourceNode[] {
  return pois
    .filter((p) => p.type === 'aether_deposit')
    .map((p) => ({
      id: `node_${p.id}`,
      type: 'aether' as const,
      gx: p.gx,
      gy: p.gy,
      x: p.x,
      y: p.y,
      amount: DEPOSIT_AMOUNT,
      maxAmount: DEPOSIT_AMOUNT,
      pulse: Math.random() * Math.PI * 2,
      seed: Math.random() * 100,
    }));
}

/** Activated relays act as permanent reveal sources (fog + build validation). */
export function getActivatedRelays(pois: PoiEntity[]): PoiEntity[] {
  return pois.filter((p) => p.type === 'signal_relay' && p.completed);
}

function completePoi(engine: AetherGameEngine, poi: PoiEntity): void {
  poi.completed = true;
  poi.progress = 1;
  const cfg = POI_CONFIG[poi.type];
  engine.resources.silicate += cfg.reward.silicate || 0;
  engine.resources.iron += cfg.reward.iron || 0;
  engine.resources.aether += cfg.reward.aether || 0;

  const rewardText = [
    cfg.reward.silicate ? `+${cfg.reward.silicate} Silicat` : '',
    cfg.reward.iron ? `+${cfg.reward.iron} Sắt` : '',
    cfg.reward.aether ? `+${cfg.reward.aether} Aether` : '',
  ]
    .filter(Boolean)
    .join(', ');

  soundEngine.pickup();
  engine.spawnParticles(poi.x, poi.y, cfg.accent, 24, 130, true);
  if (poi.type === 'signal_relay') {
    engine.pushLog(`${cfg.name} đã kích hoạt — tầm nhìn mở rộng vĩnh viễn! ${rewardText}`, 'good');
  } else {
    engine.pushLog(`${cfg.name} hoàn tất! ${rewardText}`, 'good');
  }
  engine.addFloatingText(poi.x, poi.y - 22, rewardText || cfg.name, cfg.accent, 1.1);
}

/** Spawns the one-time nest ambush using the shared wave stat table. */
function triggerNestAmbush(engine: AetherGameEngine, poi: PoiEntity): void {
  poi.ambushSpawned = true;
  const offsets: ReadonlyArray<readonly [number, number]> = [
    [46, 0],
    [-46, 0],
    [0, 46],
    [0, -46],
  ];
  poi.guardIds = offsets.map(([dx, dy], i) => {
    const guard = createEnemy(engine, i === 3 ? 'goliath' : 'swarmer', poi.x + dx, poi.y + dy, 1);
    return guard.id;
  });
  engine.pushLog('CẢNH BÁO: Tổ Kén Tinh Thể phục kích! Tiêu diệt lính gác để thu hoạch.', 'warn');
  engine.addFloatingText(poi.x, poi.y - 26, 'PHỤC KÍCH!', '#fb7185', 1.2);
}

export function updatePOIs(engine: AetherGameEngine, dt: number): void {
  const relays = getActivatedRelays(engine.pois);
  for (const poi of engine.pois) {
    poi.beaconPhase += dt * 3;

    if (
      !poi.discovered &&
      isTileRevealed(poi.gx, poi.gy, engine.rover.x, engine.rover.y, engine.buildings, relays)
    ) {
      poi.discovered = true;
      const cfg = POI_CONFIG[poi.type];
      engine.pushLog(`Phát hiện: ${cfg.name}! ${cfg.desc}`, 'good');
      engine.addFloatingText(poi.x, poi.y - 24, cfg.name, cfg.accent, 1.05);
      soundEngine.pickup();
    }

    // Deposits are mined through the node/drill/drone economy — no channeling.
    if (poi.completed || poi.type === 'aether_deposit') continue;

    const dist = Math.hypot(poi.x - engine.rover.x, poi.y - engine.rover.y);

    if (poi.type === 'crystal_nest') {
      if (!poi.ambushSpawned && dist < NEST_AMBUSH_RADIUS) {
        triggerNestAmbush(engine, poi);
      }
      if (poi.ambushSpawned && !poi.guardsCleared) {
        poi.guardsCleared = !poi.guardIds.some((id) => engine.enemies.some((e) => e.id === id));
        if (poi.guardsCleared) {
          engine.pushLog('Tổ Kén đã sạch lính gác — tiếp cận để thu hoạch Aether.', 'good');
        }
      }
      if (!poi.guardsCleared) continue; // guarded nests cannot be harvested
    }

    if (dist < POI_INTERACT_RADIUS) {
      poi.progress += dt / POI_CONFIG[poi.type].channelTime;
      if (poi.progress >= 1) completePoi(engine, poi);
    }
  }
}