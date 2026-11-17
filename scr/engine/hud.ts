import type { AetherGameEngine } from '@/engine/gameEngine';
import { HudSnapshot } from '@/types/game';

export function buildHudSnapshot(engine: AetherGameEngine): HudSnapshot {
  const energy = engine.getEnergyStats();
  const boss = engine.enemies.find((e) => e.type === 'behemoth');
  return {
    elapsed: engine.elapsed,
    resources: { ...engine.resources },
    aetherReserve: engine.aetherReserve,
    aetherAvailable: Math.max(0, engine.resources.aether - engine.aetherReserve),
    energyProd: energy.prod,
    energyUse: energy.use,
    hubHp: Math.round(engine.hubHp),
    hubMaxHp: engine.hubMaxHp,
    warpProgress: engine.warpProgress,
    phaseIndex: engine.phaseIndex,
    stormTimer: Math.ceil(engine.stormTimer),
    stormActive: engine.stormActive,
    waveTimer: Math.ceil(engine.waveTimer),
    waveCount: engine.waveCount,
    bossActive: Boolean(boss),
    bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
    bossMaxHp: boss ? boss.maxHp : 1,
    dayTime: engine.dayTime,
    upgrades: { ...engine.upgrades },
    hasLab: engine.buildings.some((b) => b.type === 'lab'),
    skills: {
      dashCd: Number(engine.rover.dashCooldown.toFixed(1)),
      empCd: Number(engine.rover.empCooldown.toFixed(1)),
      overchargeCd: Number(engine.rover.overchargeCooldown.toFixed(1)),
      overchargeActive: engine.rover.overchargeTimer > 0,
    },
    logs: engine.logs,
  };
}