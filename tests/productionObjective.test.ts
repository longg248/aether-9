import { describe, expect, it } from 'vitest';
import { SMELTER_BATCH_SILICATE } from '@/constants/gameConfig';
import { getEnergyStats, updateBuildings } from '@/engine/systems/buildingSystem';
import { updateDrones } from '@/engine/systems/droneSystem';
import { OBJECTIVES, getActiveObjective, updateObjectives } from '@/engine/systems/objectiveSystem';
import { makeBuilding, makeDrillWithDrone, makeEngine, makeNode, tick } from './helpers';

const PRODUCTION_INDEX = OBJECTIVES.findIndex((o) => o.id === 'production');

/** Three drills with active drones on live nodes + one supplied smelter. */
function setupProductionLine(engine: ReturnType<typeof makeEngine>) {
  const rigs = [
    makeDrillWithDrone(engine, makeNode('silicate', 20, 20, 500)),
    makeDrillWithDrone(engine, makeNode('silicate', 21, 20, 500)),
    makeDrillWithDrone(engine, makeNode('iron', 22, 20, 500)),
  ];
  const smelter = makeBuilding('smelter', 23, 20);
  engine.buildings.push(smelter);
  engine.resources.silicate = 50; // full conversion batches available
  engine.objectiveIndex = PRODUCTION_INDEX;
  return { rigs, smelter };
}

describe('production objective: measures operation, not existence', () => {
  it('three operating drills and a supplied smelter complete it exactly once', () => {
    const engine = makeEngine();
    setupProductionLine(engine);
    expect(getActiveObjective(engine)!.progress(engine)).toBe(4);

    const before = { ...engine.resources };
    updateObjectives(engine);
    expect(engine.objectiveIndex).toBe(PRODUCTION_INDEX + 1);
    expect(engine.resources.silicate).toBe(before.silicate + 60);
    expect(engine.resources.iron).toBe(before.iron + 40);

    for (let i = 0; i < 10; i++) updateObjectives(engine); // condition still true
    expect(engine.resources.silicate).toBe(before.silicate + 60);
    expect(engine.resources.iron).toBe(before.iron + 40);
    expect(engine.objectiveIndex).toBe(PRODUCTION_INDEX + 1);
  });

  it('destroyed drills and smelters never count', () => {
    const engine = makeEngine();
    const { rigs, smelter } = setupProductionLine(engine);
    rigs[0].drill.hp = 0;
    smelter.hp = 0;
    expect(getActiveObjective(engine)!.progress(engine)).toBe(2); // 2 live drills only
    updateObjectives(engine);
    expect(engine.objectiveIndex).toBe(PRODUCTION_INDEX); // no completion
  });

  it('a drill without a drone is not operating', () => {
    const engine = makeEngine();
    setupProductionLine(engine);
    engine.drones.splice(0, 1); // first drill lost its drone
    expect(getActiveObjective(engine)!.progress(engine)).toBe(3);
  });

  it('drills whose drones idled on depleted nodes stop counting', () => {
    const engine = makeEngine();
    setupProductionLine(engine);
    for (const n of engine.nodes) n.amount = 0; // every mine exhausted
    tick((dt) => updateDrones(engine, dt, 1), 0.5);
    expect(engine.drones.every((d) => d.state === 'idle')).toBe(true);
    // Only the supplied smelter still operates.
    expect(getActiveObjective(engine)!.progress(engine)).toBe(1);
  });

  it('a smelter without a Silicate batch spins idle: no output, no progress', () => {
    const engine = makeEngine();
    const { smelter } = setupProductionLine(engine);
    engine.resources.silicate = SMELTER_BATCH_SILICATE - 1; // 7 < one batch
    const objective = getActiveObjective(engine)!;
    expect(objective.progress(engine)).toBe(3); // drills only

    const ironBefore = engine.resources.iron;
    const aetherBefore = engine.resources.aether;
    const { efficiency } = getEnergyStats(engine);
    tick((dt) => updateBuildings(engine, dt, efficiency), 7); // > two 3.2s cycles
    expect(engine.resources.silicate).toBe(SMELTER_BATCH_SILICATE - 1); // never consumed
    expect(engine.resources.iron).toBe(ironBefore); // never produced
    expect(engine.resources.aether).toBe(aetherBefore);
    expect(smelter.cooldown).toBeGreaterThan(0); // cycle spins without output
    expect(objective.progress(engine)).toBe(3);

    engine.resources.silicate = SMELTER_BATCH_SILICATE; // supply arrives
    expect(objective.progress(engine)).toBe(4);
  });
});

describe('production objective: brownout consistency with the energy system', () => {
  it('a powered, supplied smelter still operates under brownout, just slower', () => {
    const brownout = makeEngine();
    setupProductionLine(brownout);
    const effBrown = getEnergyStats(brownout).efficiency;
    expect(effBrown).toBeLessThan(1); // 25 MW hub vs 46 MW draw
    expect(effBrown).toBeGreaterThan(0);
    expect(getActiveObjective(brownout)!.progress(brownout)).toBe(4);

    const fullGrid = makeEngine();
    setupProductionLine(fullGrid);
    fullGrid.buildings.push(makeBuilding('solar', 24, 20), makeBuilding('solar', 25, 20));
    expect(getEnergyStats(fullGrid).efficiency).toBe(1);
    expect(getActiveObjective(fullGrid)!.progress(fullGrid)).toBe(4);

    // Same 12s window: the browned-out smelter converts fewer batches.
    const ironBrownBefore = brownout.resources.iron;
    const ironFullBefore = fullGrid.resources.iron;
    tick((dt) => updateBuildings(brownout, dt, effBrown), 12);
    tick((dt) => updateBuildings(fullGrid, dt, 1), 12);
    expect(brownout.resources.iron - ironBrownBefore).toBeLessThan(
      fullGrid.resources.iron - ironFullBefore
    );
    expect(brownout.resources.iron).toBeGreaterThan(ironBrownBefore); // still producing
  });

  it('at zero efficiency the smelter cycle freezes after its first batch', () => {
    const engine = makeEngine();
    const { smelter } = setupProductionLine(engine);
    const ironBefore = engine.resources.iron;
    tick((dt) => updateBuildings(engine, dt, 0), 10); // total grid failure
    // The initial ready cycle fires once, then cooldown never advances again.
    expect(engine.resources.iron).toBe(ironBefore + 5);
    expect(smelter.cooldown).toBe(3.2);
  });
});