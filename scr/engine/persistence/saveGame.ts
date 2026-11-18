import { BUILDINGS, DIFFICULTY_SETTINGS, PHASES, UPGRADES } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { RandomService } from '@/engine/core/randomService';
import { createDepositNodes, generatePOIs } from '@/engine/systems/poiSystem';
import { generateResourceNodes } from '@/utils/proceduralTerrain';
import {
  ApplySaveResult,
  SAVE_GAME_VERSION,
  SaveGame,
  SaveGameError,
} from './types';

type RecordValue = Record<string, unknown>;

function fail(message: string): never {
  throw new SaveGameError('MALFORMED_SAVE', message);
}

function record(value: unknown, path: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${path} must be an object`);
  return value as RecordValue;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value;
}

function numberField(obj: RecordValue, key: string, path: string, min = -Infinity): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min) fail(`${path}.${key} is invalid`);
  return value;
}

function integerField(obj: RecordValue, key: string, path: string, min = -Infinity): number {
  const value = numberField(obj, key, path, min);
  if (!Number.isInteger(value)) fail(`${path}.${key} must be an integer`);
  return value;
}

function stringField(obj: RecordValue, key: string, path: string): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.length === 0) fail(`${path}.${key} must be a non-empty string`);
  return value;
}

function booleanField(obj: RecordValue, key: string, path: string): boolean {
  const value = obj[key];
  if (typeof value !== 'boolean') fail(`${path}.${key} must be a boolean`);
  return value;
}

function enumField(obj: RecordValue, key: string, path: string, values: readonly string[]): string {
  const value = stringField(obj, key, path);
  if (!values.includes(value)) fail(`${path}.${key} is not supported`);
  return value;
}

function optionalNumber(obj: RecordValue, key: string, path: string): void {
  const value = obj[key];
  if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) {
    fail(`${path}.${key} is invalid`);
  }
}

function optionalString(obj: RecordValue, key: string, path: string, nullable = false): void {
  const value = obj[key];
  if (value === undefined || (nullable && value === null)) return;
  if (typeof value !== 'string' || value.length === 0) fail(`${path}.${key} is invalid`);
}

function point(value: unknown, path: string): void {
  const obj = record(value, path);
  numberField(obj, 'x', path);
  numberField(obj, 'y', path);
}

function entity(value: unknown, path: string): RecordValue {
  const obj = record(value, path);
  stringField(obj, 'id', path);
  numberField(obj, 'x', path);
  numberField(obj, 'y', path);
  return obj;
}

function gridEntity(value: unknown, path: string): RecordValue {
  const obj = entity(value, path);
  integerField(obj, 'gx', path);
  integerField(obj, 'gy', path);
  return obj;
}

function uniqueIds(values: unknown[], path: string): void {
  const ids = values.map((value, index) => stringField(record(value, `${path}[${index}]`), 'id', `${path}[${index}]`));
  if (new Set(ids).size !== ids.length) fail(`${path} contains duplicate ids`);
}

function validateResources(value: unknown): void {
  const obj = record(value, 'resources');
  numberField(obj, 'silicate', 'resources', 0);
  numberField(obj, 'iron', 'resources', 0);
  numberField(obj, 'aether', 'resources', 0);
}

function validateUpgrades(value: unknown): void {
  const obj = record(value, 'upgrades');
  const known = new Set(UPGRADES.map((upgrade) => upgrade.id));
  for (const key of Object.keys(obj)) {
    if (!known.has(key)) fail(`upgrades.${key} is unknown`);
  }
  for (const upgrade of UPGRADES) {
    const level = integerField(obj, upgrade.id, 'upgrades', 0);
    if (level > upgrade.maxLevel) fail(`upgrades.${upgrade.id} exceeds its maximum`);
  }
}

function validateBuildings(values: unknown[]): void {
  uniqueIds(values, 'buildings');
  values.forEach((value, index) => {
    const path = `buildings[${index}]`;
    const obj = gridEntity(value, path);
    enumField(obj, 'type', path, Object.keys(BUILDINGS));
    numberField(obj, 'hp', path, 0);
    numberField(obj, 'maxHp', path, Number.MIN_VALUE);
    for (const key of ['cooldown', 'animPhase', 'angle', 'recoil', 'hitFlash']) numberField(obj, key, path);
    optionalString(obj, 'linkedNodeId', path);
  });
}

function validateDrones(values: unknown[]): void {
  uniqueIds(values, 'drones');
  values.forEach((value, index) => {
    const path = `drones[${index}]`;
    const obj = entity(value, path);
    stringField(obj, 'drillId', path);
    enumField(obj, 'state', path, ['to_node', 'to_hub', 'idle']);
    if (obj.cargoType !== null) enumField(obj, 'cargoType', path, ['silicate', 'iron', 'aether']);
    numberField(obj, 'cargoAmount', path, 0);
    numberField(obj, 'propellerAngle', path);
    optionalString(obj, 'targetNodeId', path, true);
  });
}

function validateEnemies(values: unknown[]): void {
  uniqueIds(values, 'enemies');
  values.forEach((value, index) => {
    const path = `enemies[${index}]`;
    const obj = entity(value, path);
    enumField(obj, 'type', path, ['swarmer', 'goliath', 'spitter', 'behemoth']);
    numberField(obj, 'hp', path);
    numberField(obj, 'maxHp', path, Number.MIN_VALUE);
    for (const key of ['speed', 'radius', 'legPhase', 'attackCooldown', 'stunTimer', 'hitFlash', 'angle']) {
      numberField(obj, key, path);
    }
    if (obj.elite !== undefined && typeof obj.elite !== 'boolean') fail(`${path}.elite is invalid`);
    optionalNumber(obj, 'windupTimer', path);
    optionalNumber(obj, 'windupTotal', path);
    optionalString(obj, 'pendingTargetId', path, true);
  });
}

function validateRover(value: unknown): void {
  const obj = record(value, 'rover');
  point(obj, 'rover');
  for (const key of [
    'vx', 'vy', 'angle', 'turretAngle', 'wheelPhase', 'mineCooldown', 'dashCooldown',
    'dashTimer', 'empCooldown', 'overchargeCooldown', 'overchargeTimer',
  ]) {
    numberField(obj, key, 'rover');
  }
  for (const key of ['targetNodeId', 'targetPodId']) {
    if (obj[key] !== null) stringField(obj, key, 'rover');
  }
  if (obj.moveTarget !== null) point(obj.moveTarget, 'rover.moveTarget');
}

/** Throws a typed error for malformed input or an unsupported schema version. */
export function validateSaveGame(input: unknown): SaveGame {
  const save = record(input, 'save');
  if (typeof save.version !== 'number' || !Number.isInteger(save.version)) fail('save.version is invalid');
  if (save.version !== SAVE_GAME_VERSION) {
    throw new SaveGameError('UNSUPPORTED_VERSION', `Save version ${save.version} is not supported`);
  }

  numberField(save, 'savedAt', 'save', 0);
  integerField(save, 'worldSeed', 'save');
  enumField(save, 'difficulty', 'save', Object.keys(DIFFICULTY_SETTINGS));
  enumField(save, 'status', 'save', ['intro', 'playing', 'victory', 'gameover']);
  const speed = numberField(save, 'speed', 'save');
  if (![0, 1, 2].includes(speed)) fail('save.speed is invalid');
  numberField(save, 'elapsed', 'save', 0);
  const dayTime = numberField(save, 'dayTime', 'save', 0);
  if (dayTime > 1) fail('save.dayTime is invalid');
  validateResources(save.resources);
  validateUpgrades(save.upgrades);
  numberField(save, 'aetherReserve', 'save', 0);
  numberField(save, 'hubHp', 'save', 0);
  numberField(save, 'hubMaxHp', 'save', Number.MIN_VALUE);
  numberField(save, 'warpProgress', 'save', 0);
  const phaseIndex = integerField(save, 'phaseIndex', 'save', 0);
  if (phaseIndex >= PHASES.length) fail('save.phaseIndex is invalid');

  validateBuildings(array(save.buildings, 'save.buildings'));
  validateDrones(array(save.drones, 'save.drones'));
  const nodes = array(save.nodes, 'save.nodes');
  uniqueIds(nodes, 'nodes');
  nodes.forEach((value, index) => {
    const obj = record(value, `nodes[${index}]`);
    stringField(obj, 'id', `nodes[${index}]`);
    numberField(obj, 'amount', `nodes[${index}]`, 0);
  });
  const pois = array(save.pois, 'save.pois');
  uniqueIds(pois, 'pois');
  pois.forEach((value, index) => {
    const path = `pois[${index}]`;
    const obj = record(value, path);
    stringField(obj, 'id', path);
    for (const key of ['discovered', 'completed', 'ambushSpawned', 'guardsCleared']) booleanField(obj, key, path);
    numberField(obj, 'progress', path, 0);
    numberField(obj, 'beaconPhase', path);
    const guards = array(obj.guardIds, `${path}.guardIds`);
    guards.forEach((id) => {
      if (typeof id !== 'string' || id.length === 0) fail(`${path}.guardIds contains an invalid id`);
    });
  });

  const pods = array(save.crashPods, 'save.crashPods');
  uniqueIds(pods, 'crashPods');
  pods.forEach((value, index) => {
    const path = `crashPods[${index}]`;
    const obj = gridEntity(value, path);
    numberField(obj, 'progress', path, 0);
    booleanField(obj, 'opened', path);
    numberField(obj, 'beaconPhase', path);
  });
  validateEnemies(array(save.enemies, 'save.enemies'));

  const projectiles = array(save.projectiles, 'save.projectiles');
  uniqueIds(projectiles, 'projectiles');
  projectiles.forEach((value, index) => {
    const path = `projectiles[${index}]`;
    const obj = entity(value, path);
    for (const key of ['vx', 'vy', 'damage', 'life']) numberField(obj, key, path);
    stringField(obj, 'color', path);
    booleanField(obj, 'isAcid', path);
  });
  array(save.acidPools, 'save.acidPools').forEach((value, index) => {
    const path = `acidPools[${index}]`;
    const obj = record(value, path);
    point(obj, path);
    for (const key of ['radius', 'life', 'maxLife', 'damagePerSecond', 'tickTimer']) numberField(obj, key, path);
  });

  numberField(save, 'waveTimer', 'save');
  integerField(save, 'waveCount', 'save', 0);
  numberField(save, 'stormTimer', 'save');
  booleanField(save, 'stormActive', 'save');
  numberField(save, 'stormDuration', 'save', 0);
  numberField(save, 'podTimer', 'save');
  booleanField(save, 'bossSpawned', 'save');
  integerField(save, 'objectiveIndex', 'save', 0);
  integerField(save, 'stormsSurvived', 'save', 0);
  integerField(save, 'behemothKilled', 'save', 0);
  validateRover(save.rover);

  const logs = array(save.logs, 'save.logs');
  logs.forEach((value, index) => {
    const path = `logs[${index}]`;
    const obj = record(value, path);
    stringField(obj, 'id', path);
    stringField(obj, 'text', path);
    enumField(obj, 'type', path, ['info', 'warn', 'ai', 'good']);
  });
  return input as SaveGame;
}

export function serializeGame(engine: AetherGameEngine): SaveGame {
  return {
    version: SAVE_GAME_VERSION,
    savedAt: Date.now(),
    worldSeed: engine.random.worldSeed,
    difficulty: engine.difficulty,
    status: engine.status,
    speed: engine.speed,
    elapsed: engine.elapsed,
    dayTime: engine.dayTime,
    resources: { ...engine.resources },
    upgrades: { ...engine.upgrades },
    aetherReserve: engine.aetherReserve,
    hubHp: engine.hubHp,
    hubMaxHp: engine.hubMaxHp,
    warpProgress: engine.warpProgress,
    phaseIndex: engine.phaseIndex,
    buildings: engine.buildings.map((building) => ({ ...building })),
    drones: engine.drones.map((drone) => ({ ...drone })),
    nodes: engine.nodes.map(({ id, amount }) => ({ id, amount })),
    pois: engine.pois.map((poi) => ({
      id: poi.id,
      discovered: poi.discovered,
      progress: poi.progress,
      completed: poi.completed,
      ambushSpawned: poi.ambushSpawned,
      guardIds: [...poi.guardIds],
      guardsCleared: poi.guardsCleared,
      beaconPhase: poi.beaconPhase,
    })),
    crashPods: engine.crashPods.map((pod) => ({ ...pod })),
    enemies: engine.enemies.map((enemy) => ({ ...enemy })),
    projectiles: engine.projectiles.map((projectile) => ({ ...projectile })),
    acidPools: engine.acidPools.map((pool) => ({ ...pool })),
    waveTimer: engine.waveTimer,
    waveCount: engine.waveCount,
    stormTimer: engine.stormTimer,
    stormActive: engine.stormActive,
    stormDuration: engine.stormDuration,
    podTimer: engine.podTimer,
    bossSpawned: engine.bossSpawned,
    objectiveIndex: engine.objectiveIndex,
    stormsSurvived: engine.stormsSurvived,
    behemothKilled: engine.behemothKilled,
    rover: { ...engine.rover, moveTarget: engine.rover.moveTarget ? { ...engine.rover.moveTarget } : null },
    logs: engine.logs.map((log) => ({ ...log })),
  };
}

function cloneSave(save: SaveGame): SaveGame {
  return JSON.parse(JSON.stringify(save)) as SaveGame;
}

/** Applies a fully validated save atomically; rejection is returned, not thrown. */
export function applySave(engine: AetherGameEngine, input: unknown): ApplySaveResult {
  try {
    const save = validateSaveGame(input);
    const random = new RandomService(save.worldSeed);
    const generatedPois = generatePOIs(save.worldSeed);
    const generatedNodes = generateResourceNodes(generatedPois, random.resources);
    generatedNodes.push(...createDepositNodes(generatedPois, random.resources));

    const savedNodeIds = new Set(save.nodes.map((node) => node.id));
    const savedPoiIds = new Set(save.pois.map((poi) => poi.id));
    if (
      generatedNodes.length !== save.nodes.length ||
      generatedNodes.some((node) => !savedNodeIds.has(node.id)) ||
      generatedPois.length !== save.pois.length ||
      generatedPois.some((poi) => !savedPoiIds.has(poi.id))
    ) {
      fail('Saved world state does not match its seed');
    }

    const data = cloneSave(save);
    const amounts = new Map(data.nodes.map((node) => [node.id, node.amount]));
    const poiStates = new Map(data.pois.map((poi) => [poi.id, poi]));

    engine.random = new RandomService(data.worldSeed);
    engine.difficulty = data.difficulty;
    engine.reset(); // Clears transient state and bumps runId for renderer rebuilds.
    engine.status = data.status;
    engine.speed = data.speed;
    engine.elapsed = data.elapsed;
    engine.dayTime = data.dayTime;
    engine.resources = data.resources;
    engine.upgrades = data.upgrades;
    engine.aetherReserve = data.aetherReserve;
    engine.hubHp = data.hubHp;
    engine.hubMaxHp = data.hubMaxHp;
    engine.warpProgress = data.warpProgress;
    engine.phaseIndex = data.phaseIndex;
    engine.buildings = data.buildings;
    engine.drones = data.drones;
    engine.nodes = generatedNodes.map((node) => ({ ...node, amount: amounts.get(node.id)! }));
    engine.pois = generatedPois.map((poi) => {
      const state = poiStates.get(poi.id)!;
      return { ...poi, ...state, guardIds: [...state.guardIds] };
    });
    engine.crashPods = data.crashPods;
    engine.enemies = data.enemies;
    engine.projectiles = data.projectiles;
    engine.acidPools = data.acidPools;
    engine.waveTimer = data.waveTimer;
    engine.waveCount = data.waveCount;
    engine.stormTimer = data.stormTimer;
    engine.stormActive = data.stormActive;
    engine.stormDuration = data.stormDuration;
    engine.podTimer = data.podTimer;
    engine.bossSpawned = data.bossSpawned;
    engine.objectiveIndex = data.objectiveIndex;
    engine.stormsSurvived = data.stormsSurvived;
    engine.behemothKilled = data.behemothKilled;
    engine.rover = data.rover;
    engine.logs = data.logs;
    return { ok: true, save: data };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof SaveGameError
          ? error
          : new SaveGameError('MALFORMED_SAVE', 'Save data could not be applied'),
    };
  }
}
