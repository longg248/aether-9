import { DEFAULT_DIFFICULTY, DIFFICULTY_SETTINGS, Difficulty, HUB_X, HUB_Y } from '@/constants/gameConfig';
import { Resources, RoverState } from '@/types/game';

export function createInitialResources(difficulty: Difficulty = DEFAULT_DIFFICULTY): Resources {
  const scale = DIFFICULTY_SETTINGS[difficulty].startingResourceScale;
  return { silicate: Math.round(90 * scale), iron: Math.round(45 * scale), aether: 0 };
}

export function createInitialUpgrades(): Record<string, number> {
  return {
    rover_laser: 1,
    drone_logistics: 1,
    turret_optics: 1,
    shield_matrix: 0,
    aether_capacitor: 0,
  };
}

export function createInitialRover(): RoverState {
  return {
    x: HUB_X + 75,
    y: HUB_Y + 60,
    vx: 0,
    vy: 0,
    angle: 0,
    turretAngle: 0,
    wheelPhase: 0,
    mineCooldown: 0,
    targetNodeId: null,
    targetPodId: null,
    moveTarget: null,
    dashCooldown: 0,
    dashTimer: 0,
    empCooldown: 0,
    overchargeCooldown: 0,
    overchargeTimer: 0,
  };
}