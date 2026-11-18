import type { AetherGameEngine } from '@/engine/gameEngine';
import { buildMinimapSnapshot } from '@/engine/rendering/minimap';
import { hasLivingLab } from '@/engine/systems/buildingSystem';
import { OBJECTIVES, getActiveObjective } from '@/engine/systems/objectiveSystem';
import { HudSnapshot } from '@/types/game';

export function buildHudSnapshot(engine: AetherGameEngine): HudSnapshot {
  const energy = engine.getEnergyStats();
  const boss = engine.enemies.find((e) => e.type === 'behemoth');
  const objective = getActiveObjective(engine);
  return {
    elapsed: engine.elapsed,
    resources: { ...engine.resources },
    aetherReserve: engine.aetherReserve,
    warpSurplus: Math.max(0, engine.resources.aether - engine.aetherReserve),
    energyProd: energy.prod,
    energyUse: energy.use,
    energyEfficiency: energy.efficiency,
    hubHp: Math.round(engine.hubHp),
    hubMaxHp: engine.hubMaxHp,
    warpProgress: engine.warpProgress,
    phaseIndex: engine.phaseIndex,
    stormTimer: Math.ceil(engine.stormTimer),
    stormActive: engine.stormActive,
    waveTimer: Math.ceil(engine.waveTimer),
    waveCount: engine.waveCount,
    enemiesAlive: engine.enemies.length,
    drones: {
      total: engine.drones.length,
      hauling: engine.drones.filter((d) => d.cargoAmount > 0).length,
      idle: engine.drones.filter((d) => d.state === 'idle').length,
    },
    bossActive: Boolean(boss),
    bossHp: boss ? Math.max(0, Math.round(boss.hp)) : 0,
    bossMaxHp: boss ? boss.maxHp : 1,
    objective: objective
      ? {
          id: objective.id,
          title: objective.title,
          desc: objective.desc,
          progress: Math.min(objective.target, objective.progress(engine)),
          target: objective.target,
        }
      : null,
    objectivesDone: engine.objectiveIndex,
    objectivesTotal: OBJECTIVES.length,
    poi: {
      discovered: engine.pois.filter((p) => p.discovered).length,
      total: engine.pois.length,
    },
    minimap: buildMinimapSnapshot(engine),
    dayTime: engine.dayTime,
    upgrades: { ...engine.upgrades },
    hasLab: hasLivingLab(engine.buildings),
    skills: {
      dashCd: Number(engine.rover.dashCooldown.toFixed(1)),
      empCd: Number(engine.rover.empCooldown.toFixed(1)),
      overchargeCd: Number(engine.rover.overchargeCooldown.toFixed(1)),
      overchargeActive: engine.rover.overchargeTimer > 0,
    },
    logs: engine.logs,
  };
}