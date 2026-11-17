import { GRID_SIZE, HUB_GX, HUB_GY, HUB_X, HUB_Y, PHASES, TARGET_WARP_AETHER, TILE_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { soundEngine } from '@/utils/soundEngine';

export function updateCrashPods(engine: AetherGameEngine, dt: number): void {
  // Crash Pods spawning & decoding
  engine.podTimer -= dt;
  if (engine.podTimer <= 0 && engine.crashPods.filter((p) => !p.opened).length < 2) {
    engine.podTimer = 75;
    const gx = 4 + Math.floor(Math.random() * (GRID_SIZE - 8));
    const gy = 4 + Math.floor(Math.random() * (GRID_SIZE - 8));
    if (Math.hypot(gx - HUB_GX, gy - HUB_GY) > 7) {
      engine.crashPods.push({
        id: `pod_${Date.now()}`,
        gx,
        gy,
        x: (gx + 0.5) * TILE_SIZE,
        y: (gy + 0.5) * TILE_SIZE,
        progress: 0,
        opened: false,
        beaconPhase: 0,
      });
      engine.pushLog('Tàu Mẹ thả Hộp Tiếp Tế xuống bề mặt! Kiểm tra Radar.', 'good');
    }
  }

  for (const pod of engine.crashPods) {
    if (pod.opened) continue;
    pod.beaconPhase += dt * 4;
    if (Math.hypot(pod.x - engine.rover.x, pod.y - engine.rover.y) < 62) {
      pod.progress += dt * 0.55;
      if (pod.progress >= 1) {
        pod.opened = true;
        engine.resources.silicate += 85;
        engine.resources.iron += 65;
        engine.resources.aether += 30;
        engine.hubHp = Math.min(engine.hubMaxHp, engine.hubHp + 180);
        soundEngine.pickup();
        engine.spawnParticles(pod.x, pod.y, '#facc15', 26, 140, true);
        engine.addFloatingText(pod.x, pod.y - 20, '+85 Silicat, +65 Sắt, +30 Aether!', '#facc15', 1.15);
      }
    }
  }
}

export function updateWarpProgress(engine: AetherGameEngine, dt: number): void {
  // Automatic Aether Transfer to Warp Engine — only consumes the surplus
  // above the configurable reserve, keeping Aether available for upgrades.
  const available = engine.resources.aether - engine.aetherReserve;
  if (available > 0 && engine.warpProgress < TARGET_WARP_AETHER) {
    const rate = (12 + engine.upgrades.aether_capacitor * 6) * dt;
    const transfer = Math.min(available, rate, TARGET_WARP_AETHER - engine.warpProgress);
    engine.resources.aether -= transfer;
    engine.warpProgress += transfer;
  }

  // Update Phase Progression
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (engine.warpProgress >= (i === 0 ? 0 : PHASES[i - 1].targetAether)) {
      if (i > engine.phaseIndex) {
        engine.phaseIndex = i;
        engine.pushLog(PHASES[i].aiDirective, 'ai');
      }
      break;
    }
  }
}

export function updateStorms(engine: AetherGameEngine, dt: number): void {
  if (!engine.stormActive) {
    engine.stormTimer -= dt;
    if (engine.stormTimer <= 0) {
      engine.stormActive = true;
      engine.stormDuration = 22;
      engine.stormTimer = 155;
      soundEngine.storm();
      engine.pushLog('CẢNH BÁO: Bão Từ Địa Cầu đổ bộ! Tấm chắn đang chịu áp lực.', 'warn');
    }
  } else {
    engine.stormDuration -= dt;
    if (Math.random() < dt * 2.2) {
      const lx = HUB_X + (Math.random() - 0.5) * 650;
      const ly = HUB_Y + (Math.random() - 0.5) * 650;
      engine.camera.shake = 7;
      soundEngine.storm();
      engine.lightnings.push({
        points: [
          { x: lx - 40, y: ly - 240 },
          { x: lx + 15, y: ly - 120 },
          { x: lx - 10, y: ly - 55 },
          { x: lx, y: ly },
        ],
        life: 0.25,
        maxLife: 0.25,
      });
      const resist = Math.max(0.25, 1 - engine.upgrades.shield_matrix * 0.2);
      engine.hubHp -= 18 * resist;
    }
    if (engine.stormDuration <= 0) {
      engine.stormActive = false;
      engine.pushLog('Bão Từ đã tan. Hệ thống ổn định trở lại.', 'good');
    }
  }
}

export function checkGameEnd(engine: AetherGameEngine): void {
  if (engine.warpProgress >= TARGET_WARP_AETHER) {
    engine.status = 'victory';
  } else if (engine.hubHp <= 0) {
    engine.hubHp = 0;
    engine.status = 'gameover';
  }
}