import { HUB_X, HUB_Y, SMELTER_BATCH_SILICATE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { getEnergyStats } from '@/engine/systems/buildingSystem';
import { Resources } from '@/types/game';
import { soundEngine } from '@/utils/soundEngine';

export interface ObjectiveDef {
  id: string;
  title: string;
  desc: string;
  target: number;
  /** One-time reward, existing currencies only. */
  reward: Partial<Resources>;
  /** Progress derived from actual engine state — never from UI assumptions. */
  progress: (engine: AetherGameEngine) => number;
}

const countCompleted = (engine: AetherGameEngine, type: string): number =>
  engine.pois.filter((p) => p.type === type && p.completed).length;

/**
 * Sequential milestone chain: exactly one active objective at a time keeps
 * the HUD readable. Completion advances objectiveIndex, so rewards can never
 * fire twice. The chain is independent of the 1,200-Aether Warp victory.
 */
export const OBJECTIVES: ObjectiveDef[] = [
  {
    id: 'survey',
    title: 'Khảo sát bề mặt',
    desc: 'Phát hiện 3 điểm đặc biệt (POI) trên bản đồ.',
    target: 3,
    reward: { silicate: 50, iron: 35 },
    progress: (e) => e.pois.filter((p) => p.discovered).length,
  },
  {
    id: 'relay',
    title: 'Khôi phục liên lạc',
    desc: 'Kích hoạt 1 Trạm Tín Hiệu Hỏng.',
    target: 1,
    reward: { aether: 20 },
    progress: (e) => countCompleted(e, 'signal_relay'),
  },
  {
    id: 'station',
    title: 'Cứu dữ liệu nghiên cứu',
    desc: 'Phục hồi 1 Trạm Nghiên Cứu Bỏ Hoang.',
    target: 1,
    reward: { aether: 25, iron: 40 },
    progress: (e) => countCompleted(e, 'research_station'),
  },
  {
    id: 'nest',
    title: 'Dọn tổ kén',
    desc: 'Tiêu diệt lính gác và thu hoạch 1 Tổ Kén Tinh Thể.',
    target: 1,
    reward: { aether: 30 },
    progress: (e) => countCompleted(e, 'crystal_nest'),
  },
  {
    id: 'production',
    title: 'Dây chuyền tự động',
    desc: 'Vận hành 3 Máy Khoan có drone đang làm việc và 1 Lò Luyện Kim đủ điện, đủ Silicat cho một mẻ luyện cùng lúc.',
    target: 4,
    reward: { silicate: 60, iron: 40 },
    // Operating ≠ merely existing: a drill counts only while its drone is
    // actively working (idle = no mineable node left); a smelter counts only
    // while the grid powers its cycle AND a full Silicate batch is available
    // to convert — otherwise its 3.2s cycle spins without producing.
    progress: (e) => {
      const { efficiency } = getEnergyStats(e);
      const drills = e.buildings.filter(
        (b) =>
          b.type === 'drill' &&
          b.hp > 0 &&
          e.drones.some((d) => d.drillId === b.id && d.state !== 'idle')
      ).length;
      const smelters = e.buildings.filter(
        (b) =>
          b.type === 'smelter' &&
          b.hp > 0 &&
          efficiency > 0 &&
          e.resources.silicate >= SMELTER_BATCH_SILICATE
      ).length;
      return Math.min(drills, 3) + Math.min(smelters, 1);
    },
  },
  {
    id: 'storm',
    title: 'Sống sót qua Bão Từ',
    desc: 'Chịu đựng trọn vẹn 1 cơn Bão Từ Địa Cầu.',
    target: 1,
    reward: { aether: 35 },
    progress: (e) => e.stormsSurvived,
  },
  {
    id: 'behemoth',
    title: 'Hạ gục Behemoth',
    desc: 'Tiêu diệt Chúa Tể Tổ Kén Aether Behemoth.',
    target: 1,
    reward: { aether: 60 },
    progress: (e) => e.behemothKilled,
  },
];

export function getActiveObjective(engine: AetherGameEngine): ObjectiveDef | null {
  return OBJECTIVES[engine.objectiveIndex] ?? null;
}

/** Grants the active objective's reward exactly once, then advances the chain. */
export function updateObjectives(engine: AetherGameEngine): void {
  const objective = getActiveObjective(engine);
  if (!objective) return;
  if (objective.progress(engine) < objective.target) return;

  engine.resources.silicate += objective.reward.silicate || 0;
  engine.resources.iron += objective.reward.iron || 0;
  engine.resources.aether += objective.reward.aether || 0;
  engine.objectiveIndex++;

  const rewardText = [
    objective.reward.silicate ? `+${objective.reward.silicate} Silicat` : '',
    objective.reward.iron ? `+${objective.reward.iron} Sắt` : '',
    objective.reward.aether ? `+${objective.reward.aether} Aether` : '',
  ]
    .filter(Boolean)
    .join(', ');
  soundEngine.pickup();
  engine.pushLog(`Mục tiêu hoàn thành: ${objective.title}! Thưởng ${rewardText}.`, 'good');
  engine.addFloatingText(HUB_X, HUB_Y - 44, 'MỤC TIÊU HOÀN THÀNH!', '#4ade80', 1.2);

  if (engine.objectiveIndex >= OBJECTIVES.length) {
    engine.pushLog('Valkyrie-7: Toàn bộ mục tiêu chiến dịch đã hoàn thành. Tập trung nạp Warp!', 'ai');
  }
}