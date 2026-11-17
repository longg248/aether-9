import { describe, expect, it } from 'vitest';
import { TARGET_WARP_AETHER } from '@/constants/gameConfig';
import { checkGameEnd, updateStorms } from '@/engine/systems/environmentSystem';
import { updateEnemies } from '@/engine/systems/enemySystem';
import { OBJECTIVES, getActiveObjective, updateObjectives } from '@/engine/systems/objectiveSystem';
import { GameStatus } from '@/types/game';
import { makeBuilding, makeDrillWithDrone, makeEnemy, makeEngine, makeNode, tick } from './helpers';

/** Marks the first N POIs discovered (state-driven progress, not UI). */
function discoverPois(engine: ReturnType<typeof makeEngine>, count: number): void {
  engine.pois = Array.from({ length: count }, (_, i) => ({
    id: `poi_obj_${i}`,
    type: 'supply_cache' as const,
    gx: 30 + i,
    gy: 30,
    x: (30.5 + i) * 48,
    y: 30.5 * 48,
    discovered: true,
    progress: 0,
    completed: false,
    ambushSpawned: false,
    guardIds: [],
    guardsCleared: false,
    beaconPhase: 0,
  }));
}

describe('objective chain: progress from actual game state', () => {
  it('starts at the survey objective with zero progress', () => {
    const engine = makeEngine();
    const active = getActiveObjective(engine);
    expect(active?.id).toBe('survey');
    expect(active?.progress(engine)).toBe(0);
  });

  it('survey progress counts discovered POIs and completes at 3', () => {
    const engine = makeEngine();
    discoverPois(engine, 2);
    updateObjectives(engine);
    expect(engine.objectiveIndex).toBe(0); // not yet complete

    discoverPois(engine, 3);
    const before = { ...engine.resources };
    updateObjectives(engine);
    expect(engine.objectiveIndex).toBe(1);
    expect(engine.resources.silicate).toBe(before.silicate + 50);
    expect(engine.resources.iron).toBe(before.iron + 35);
  });

  it('production milestone requires operating drills and a supplied smelter', () => {
    const engine = makeEngine();
    engine.objectiveIndex = OBJECTIVES.findIndex((o) => o.id === 'production');
    const rigs = [
      makeDrillWithDrone(engine, makeNode('silicate', 20, 20, 500)),
      makeDrillWithDrone(engine, makeNode('silicate', 21, 20, 500)),
      makeDrillWithDrone(engine, makeNode('iron', 22, 20, 500)),
    ];
    const smelter = makeBuilding('smelter', 23, 20);
    engine.buildings.push(smelter);
    engine.resources.silicate = 50; // a full conversion batch is available

    const objective = getActiveObjective(engine)!;
    expect(objective.progress(engine)).toBe(4);

    rigs[0].drill.hp = 0; // destroyed buildings never count
    expect(objective.progress(engine)).toBe(3);
    updateObjectives(engine);
    expect(engine.objectiveIndex).toBe(OBJECTIVES.findIndex((o) => o.id === 'production'));

    rigs[0].drill.hp = 100;
    const before = { ...engine.resources };
    updateObjectives(engine);
    expect(engine.resources.silicate).toBe(before.silicate + 60);
    expect(engine.resources.iron).toBe(before.iron + 40);
  });

  it('surviving a full storm increments the milestone counter', () => {
    const engine = makeEngine();
    engine.stormTimer = 0.01;
    tick((dt) => updateStorms(engine, dt), 0.1); // storm starts
    expect(engine.stormActive).toBe(true);
    tick((dt) => updateStorms(engine, dt), 23); // storm lasts 22s
    expect(engine.stormActive).toBe(false);
    expect(engine.stormsSurvived).toBe(1);
  });

  it('a storm that kills the Hub does not count as survived', () => {
    const engine = makeEngine();
    engine.stormTimer = 0.01;
    tick((dt) => updateStorms(engine, dt), 0.1);
    engine.hubHp = 0;
    tick((dt) => updateStorms(engine, dt), 23);
    expect(engine.stormsSurvived).toBe(0);
  });

  it('defeating the Behemoth increments the kill counter', () => {
    const engine = makeEngine();
    const boss = makeEnemy('behemoth', 500, 500, 2600);
    boss.hp = 0;
    engine.enemies.push(boss);
    updateEnemies(engine, 0.05);
    expect(engine.behemothKilled).toBe(1);
    expect(engine.resources.aether).toBe(150); // existing boss drop preserved
  });
});

describe('objective rewards: exactly once, economy-safe', () => {
  it('repeated updates never re-grant a completed objective', () => {
    const engine = makeEngine();
    discoverPois(engine, 3);
    const before = { ...engine.resources };
    updateObjectives(engine);
    for (let i = 0; i < 10; i++) updateObjectives(engine);
    expect(engine.resources.silicate).toBe(before.silicate + 50);
    expect(engine.resources.iron).toBe(before.iron + 35);
    expect(engine.objectiveIndex).toBe(1);
  });

  it('the full chain grants bounded total rewards and then stops', () => {
    const engine = makeEngine();
    // Satisfy every objective directly through engine state.
    discoverPois(engine, 3);
    engine.pois.push(
      { ...engine.pois[0], id: 'relay_done', type: 'signal_relay', completed: true },
      { ...engine.pois[1], id: 'station_done', type: 'research_station', completed: true },
      { ...engine.pois[2], id: 'nest_done', type: 'crystal_nest', completed: true }
    );
    makeDrillWithDrone(engine, makeNode('silicate', 20, 20, 500));
    makeDrillWithDrone(engine, makeNode('silicate', 21, 20, 500));
    makeDrillWithDrone(engine, makeNode('iron', 22, 20, 500));
    engine.buildings.push(makeBuilding('smelter', 23, 20));
    engine.resources.silicate = 50; // smelter has a full batch to convert
    engine.stormsSurvived = 1;
    engine.behemothKilled = 1;

    const before = { ...engine.resources };
    for (let i = 0; i < OBJECTIVES.length + 5; i++) updateObjectives(engine);

    expect(engine.objectiveIndex).toBe(OBJECTIVES.length);
    expect(getActiveObjective(engine)).toBeNull();
    // Totals: 110 Silicat, 115 Sắt, 170 Aether — bounded vs the 1200 target.
    expect(engine.resources.silicate).toBe(before.silicate + 110);
    expect(engine.resources.iron).toBe(before.iron + 115);
    expect(engine.resources.aether).toBe(before.aether + 170);
  });

  it('objectives never bypass the Warp victory condition', () => {
    const engine = makeEngine();
    engine.warpProgress = TARGET_WARP_AETHER;
    updateObjectives(engine);
    checkGameEnd(engine);
    expect(engine.status).toBe('victory' as GameStatus);
    expect(engine.objectiveIndex).toBe(0); // chain untouched by victory
  });

  it('reset restores the chain and milestone counters', () => {
    const engine = makeEngine();
    engine.objectiveIndex = 4;
    engine.stormsSurvived = 2;
    engine.behemothKilled = 1;
    engine.reset();
    expect(engine.objectiveIndex).toBe(0);
    expect(engine.stormsSurvived).toBe(0);
    expect(engine.behemothKilled).toBe(0);
    expect(getActiveObjective(engine)?.id).toBe('survey');
  });
});