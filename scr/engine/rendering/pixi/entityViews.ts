import { Container, Graphics } from 'pixi.js';
import { BUILDINGS, HUB_X, HUB_Y, TILE_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { worldToIso } from '@/engine/isometric/projection';
import { POI_CONFIG } from '@/engine/systems/poiSystem';
import {
  BuildingEntity,
  CrashPod,
  DroneEntity,
  EnemyEntity,
  PoiEntity,
  ResourceNode,
} from '@/types/game';
import { drawGroundShadow, drawIsoBox, hex, isoAngle, shade } from './isoGraphics';

export interface EntityView {
  container: Container;
  update: (engine: AetherGameEngine) => void;
  destroy: () => void;
}

const NODE_PALETTE = {
  silicate: { main: '#f97316', light: '#fdba74', dark: '#9a3412' },
  iron: { main: '#0ea5e9', light: '#7dd3fc', dark: '#075985' },
  aether: { main: '#a855f7', light: '#e9d5ff', dark: '#581c87' },
} as const;

function makeHpBar(width: number, yOffset: number): { bar: Container; fill: Graphics } {
  const bar = new Container();
  const bg = new Graphics().rect(-width / 2, 0, width, 4).fill({ color: 0x000000, alpha: 0.7 });
  const fill = new Graphics().rect(-width / 2, 0, width, 4).fill({ color: 0x22c55e });
  bar.addChild(bg, fill);
  bar.position.set(0, yOffset);
  bar.visible = false;
  return { bar, fill };
}

function setHp(bar: Container, fill: Graphics, hp: number, maxHp: number, width: number): void {
  bar.visible = hp < maxHp;
  // Scale from the left edge: shift the fill so it grows rightward.
  fill.scale.x = Math.max(0, hp / maxHp);
  fill.position.x = (-width / 2) * (1 - fill.scale.x);
}

/** Resource node: faceted crystal cluster on a ground shadow. */
export function createNodeView(node: ResourceNode): EntityView {
  const container = new Container();
  const g = new Graphics();
  const palette = NODE_PALETTE[node.type];
  drawGroundShadow(g, 18, 9, 0.45);
  for (let k = 0; k < 4; k++) {
    const ang = node.seed + k * 1.55;
    const ox = Math.cos(ang) * 8;
    const oy = Math.sin(ang) * 4 - 4;
    const h = 14 + (k % 2) * 5;
    g.poly([ox, oy - h, ox + 8, oy, ox, oy + 6, ox - 8, oy]).fill({ color: hex(k % 2 === 0 ? palette.main : palette.dark) });
    g.poly([ox, oy - h, ox + 4, oy - 4, ox, oy]).fill({ color: hex(palette.light) });
  }
  container.addChild(g);
  return {
    container,
    update: () => {
      container.visible = node.amount > 0;
    },
    destroy: () => container.destroy({ children: true }),
  };
}

/** Building: extruded iso box + type-specific animated detail + HP bar. */
export function createBuildingView(b: BuildingEntity): EntityView {
  const cfg = BUILDINGS[b.type];
  const container = new Container();
  const body = new Graphics();
  const detail = new Container();
  const detailG = new Graphics();
  detail.addChild(detailG);

  const isWall = b.type === 'wall';
  const halfW = isWall ? 30 : 26;
  const halfH = halfW / 2;
  const height = isWall ? 16 : b.type === 'lab' || b.type === 'smelter' ? 30 : 24;

  drawGroundShadow(body, halfW + 4, halfH + 2, 0.45);
  if (b.type === 'repair_bay') {
    body.ellipse(0, 0, (cfg.radius || 5) * TILE_SIZE * 0.72, (cfg.radius || 5) * TILE_SIZE * 0.36).stroke({
      color: 0x2dd4bf,
      alpha: 0.25,
      width: 1.5,
    });
  }
  drawIsoBox(body, halfW, halfH, height, cfg.color);
  // Accent rim on the top face
  body
    .poly([0, -height - halfH, halfW, -height, 0, -height + halfH, -halfW, -height])
    .stroke({ color: hex(cfg.accent), width: 1.5, alpha: 0.9 });

  if (b.type === 'solar') {
    detailG
      .poly([0, -height - halfH + 4, halfW - 6, -height, 0, -height + halfH - 4, -halfW + 6, -height])
      .fill({ color: 0x0c4a6e, alpha: 0.85 });
    detailG.moveTo(-halfW + 10, -height).lineTo(halfW - 10, -height).stroke({ color: 0x38bdf8, width: 1, alpha: 0.6 });
  } else if (b.type === 'turret') {
    detail.position.set(0, -height - 4);
    detailG.rect(-3, -3, 22, 6).fill({ color: 0xf8fafc });
    detailG.circle(0, 0, 6).fill({ color: hex(cfg.accent) });
  } else if (b.type === 'drill') {
    detail.position.set(0, -height - 2);
    detailG.moveTo(-9, 0).lineTo(9, 0).moveTo(0, -5).lineTo(0, 5).stroke({ color: 0xfef3c7, width: 2.5 });
  } else if (b.type === 'radar') {
    detail.position.set(0, -height - 6);
    detailG.arc(0, 0, 9, -0.7, 0.7).stroke({ color: 0xa7f3d0, width: 2 });
    detailG.moveTo(0, 0).lineTo(0, -12).stroke({ color: 0xa7f3d0, width: 1.5 });
  } else if (b.type === 'lab') {
    detailG.circle(0, -height - 6, 5).fill({ color: 0xc084fc, alpha: 0.9 });
  } else if (b.type === 'smelter') {
    detailG.rect(-6, -height - 10, 12, 8).fill({ color: 0x7f1d1d });
    detailG.circle(0, -height - 6, 3).fill({ color: 0xfbbf24, alpha: 0.9 });
  }

  const { bar, fill } = makeHpBar(32, -height - halfH - 12);
  container.addChild(body, detail, bar);

  return {
    container,
    update: () => {
      if (b.type === 'drill') detail.rotation = b.animPhase * 2;
      else if (b.type === 'radar') detail.rotation = b.animPhase;
      else if (b.type === 'turret') {
        detail.rotation = isoAngle(b.angle);
        detailG.position.x = -b.recoil * 0.4;
      }
      body.alpha = b.hitFlash > 0 ? 0.7 : 1;
      setHp(bar, fill, b.hp, b.maxHp, 32);
    },
    destroy: () => container.destroy({ children: true }),
  };
}

/** Point of interest: distinct silhouette per type, pulse while actionable. */
export function createPoiView(poi: PoiEntity): EntityView {
  const cfg = POI_CONFIG[poi.type];
  const container = new Container();
  const g = new Graphics();
  const pulse = new Graphics();
  const { bar, fill } = makeHpBar(32, -40);
  fill.tint = 0x22c55e;

  drawGroundShadow(g, 22, 11, 0.45);
  const color = cfg.color;
  if (poi.type === 'research_station') {
    drawIsoBox(g, 18, 9, 12, color);
    g.circle(0, -18, 10).fill({ color: shade(color, 1.2) });
    g.moveTo(0, -26).lineTo(0, -40).stroke({ color: hex(cfg.accent), width: 2 });
    g.circle(0, -42, 3).fill({ color: hex(cfg.accent) });
  } else if (poi.type === 'signal_relay') {
    g.poly([-12, 0, 0, -34, 12, 0]).fill({ color: hex(color) });
    g.poly([-12, 0, 0, -34, 12, 0]).stroke({ color: hex(cfg.accent), width: 1.5 });
    g.arc(0, -34, 7, Math.PI * 0.9, Math.PI * 2.1).stroke({ color: hex(cfg.accent), width: 2 });
  } else if (poi.type === 'crystal_nest') {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.4;
      const ox = Math.cos(a) * 10;
      const oy = Math.sin(a) * 5;
      g.poly([ox, oy - 18, ox + 6, oy + 4, ox - 6, oy + 4]).fill({ color: hex(color) });
      g.poly([ox, oy - 18, ox + 6, oy + 4, ox - 6, oy + 4]).stroke({ color: hex(cfg.accent), width: 1 });
    }
  } else if (poi.type === 'supply_cache') {
    drawIsoBox(g, 16, 8, 14, color);
    g.moveTo(-16, -7).lineTo(16, -7).stroke({ color: hex(cfg.accent), width: 1.5 });
  } else {
    // aether_deposit: a large crystal marker (the node itself is a NodeView).
    g.poly([0, -26, 10, -6, 0, 4, -10, -6]).fill({ color: hex(color), alpha: 0.9 });
    g.poly([0, -26, 5, -10, 0, -2]).fill({ color: hex(cfg.accent) });
  }

  container.addChild(pulse, g, bar);
  return {
    container,
    update: () => {
      const actionable = !poi.completed && poi.type !== 'aether_deposit';
      pulse.clear();
      if (actionable) {
        const r = 24 + Math.sin(poi.beaconPhase) * 4;
        pulse.ellipse(0, 0, r, r * 0.5).stroke({ color: hex(cfg.accent), alpha: 0.5, width: 1.5 });
      }
      g.alpha = poi.completed ? 0.45 : 1;
      bar.visible = poi.progress > 0 && !poi.completed;
      fill.scale.x = Math.min(1, poi.progress);
      fill.position.x = -16 * (1 - fill.scale.x);
    },
    destroy: () => container.destroy({ children: true }),
  };
}

/** Crash pod: yellow crate with a pulsing beacon ring. */
export function createPodView(pod: CrashPod): EntityView {
  const container = new Container();
  const g = new Graphics();
  const ring = new Graphics();
  const { bar, fill } = makeHpBar(32, -30);
  drawGroundShadow(g, 16, 8, 0.45);
  drawIsoBox(g, 14, 7, 14, '#eab308');
  g.poly([0, -21, 14, -14, 0, -7, -14, -14]).stroke({ color: 0xfef08a, width: 1.5 });
  container.addChild(ring, g, bar);
  return {
    container,
    update: () => {
      container.visible = !pod.opened;
      ring.clear();
      const r = 20 + Math.sin(pod.beaconPhase) * 6;
      ring.ellipse(0, 0, r, r * 0.5).stroke({ color: 0xfacc15, alpha: 0.55, width: 2 });
      bar.visible = pod.progress > 0;
      fill.scale.x = Math.min(1, pod.progress);
      fill.position.x = -16 * (1 - fill.scale.x);
    },
    destroy: () => container.destroy({ children: true }),
  };
}

/** Drone: elevated body + spinning rotors, ground shadow keeps depth readable. */
export function createDroneView(drone: DroneEntity): EntityView {
  const container = new Container();
  const shadow = new Graphics();
  drawGroundShadow(shadow, 8, 4, 0.3);
  const body = new Container();
  const hull = new Graphics();
  hull.circle(0, 0, 6).fill({ color: 0xf8fafc });
  const cargo = new Graphics();
  const rotors = new Graphics();
  body.addChild(hull, cargo, rotors);
  body.position.set(0, -18);
  container.addChild(shadow, body);
  return {
    container,
    update: () => {
      cargo.clear();
      if (drone.cargoAmount > 0 && drone.cargoType) {
        cargo.circle(0, 0, 3).fill({
          color: hex(drone.cargoType === 'silicate' ? '#fb923c' : drone.cargoType === 'iron' ? '#38bdf8' : '#c084fc'),
        });
      }
      rotors.clear();
      const color = drone.state === 'idle' ? 0x64748b : 0x38bdf8;
      for (const [rx, ry] of [[-8, -5], [8, -5], [-8, 5], [8, 5]] as const) {
        rotors.arc(rx, ry, 4, drone.propellerAngle, drone.propellerAngle + Math.PI * 1.4).stroke({ color, width: 1.5 });
      }
    },
    destroy: () => container.destroy({ children: true }),
  };
}

const ENEMY_COLORS: Record<EnemyEntity['type'], string> = {
  swarmer: '#e11d48',
  goliath: '#be123c',
  spitter: '#15803d',
  behemoth: '#7e22ce',
};

/** Enemy: squashed carapace, animated legs, eyes facing the projected angle. */
export function createEnemyView(enemy: EnemyEntity): EntityView {
  const container = new Container();
  const shadow = new Graphics();
  drawGroundShadow(shadow, enemy.radius * 1.1, enemy.radius * 0.5, 0.35);
  const legs = new Graphics();
  const body = new Graphics();
  const telegraph = new Graphics();
  const { bar, fill } = makeHpBar(32, -enemy.radius - 18);
  fill.tint = 0xfacc15;

  const r = enemy.radius;
  body.ellipse(0, -r * 0.4, r * 1.15, r * 0.7).fill({ color: hex(ENEMY_COLORS[enemy.type]) });
  if (enemy.elite) {
    body.ellipse(0, -r * 0.4, r * 1.32, r * 0.85).stroke({ color: 0xfacc15, width: 2 });
  }
  container.addChild(shadow, legs, body, telegraph, bar);

  return {
    container,
    update: () => {
      legs.clear();
      const swing = Math.sin(enemy.legPhase) * 4;
      legs.setStrokeStyle({ color: 0xfda4af, width: enemy.type === 'behemoth' ? 3 : 1.5 });
      for (let l = -1; l <= 1; l++) {
        legs.moveTo(l * r * 0.45, -r * 0.4 - r * 0.4);
        legs.lineTo(l * r * 0.5 + swing, -r * 0.4 - r * 0.95);
        legs.moveTo(l * r * 0.45, -r * 0.4 + r * 0.4);
        legs.lineTo(l * r * 0.5 - swing, -r * 0.4 + r * 0.95);
      }
      legs.stroke();
      // Eyes along the projected facing direction.
      const a = isoAngle(enemy.angle);
      const ex = Math.cos(a) * r * 0.6;
      const ey = Math.sin(a) * r * 0.35 - r * 0.4;
      body.alpha = enemy.hitFlash > 0 ? 0.7 : 1;
      telegraph.clear();
      if ((enemy.windupTimer ?? 0) > 0 && enemy.windupTotal) {
        const t = 1 - (enemy.windupTimer ?? 0) / enemy.windupTotal;
        const color = enemy.type === 'behemoth' ? 0xc084fc : 0xfb923c;
        telegraph
          .ellipse(0, -r * 0.4, r * (1.5 + 0.6 * t), r * (0.9 + 0.36 * t))
          .stroke({ color, alpha: 0.35 + 0.5 * t, width: 2 + 2 * t });
      }
      // Stunned eyes read blue; otherwise yellow.
      telegraph.circle(ex - 3, ey, 2.2).fill({ color: enemy.stunTimer > 0 ? 0x38bdf8 : 0xfef08a });
      telegraph.circle(ex + 3, ey, 2.2).fill({ color: enemy.stunTimer > 0 ? 0x38bdf8 : 0xfef08a });
      setHp(bar, fill, enemy.hp, enemy.maxHp, 32);
      bar.visible = enemy.elite === true && enemy.hp < enemy.maxHp;
    },
    destroy: () => container.destroy({ children: true }),
  };
}

/** Rover: iso chassis + independently aimed turret + ground headlight cone. */
export function createRoverView(): EntityView {
  const container = new Container();
  const cone = new Graphics();
  const shadow = new Graphics();
  drawGroundShadow(shadow, 18, 9, 0.4);
  const body = new Graphics();
  drawIsoBox(body, 16, 8, 12, '#0284c7');
  body.poly([0, -20, 16, -12, 0, -4, -16, -12]).stroke({ color: 0x7dd3fc, width: 1.5 });
  // Tracks
  body.rect(-18, -6, 6, 10).fill({ color: 0x0f172a });
  body.rect(12, -6, 6, 10).fill({ color: 0x0f172a });
  const turret = new Container();
  const turretG = new Graphics();
  turretG.rect(-3, -2.5, 18, 5).fill({ color: 0xf8fafc });
  turretG.circle(0, 0, 5).fill({ color: 0x7dd3fc });
  turret.addChild(turretG);
  turret.position.set(0, -16);
  const ring = new Graphics();
  ring.ellipse(0, 0, 22, 11).stroke({ color: 0x38bdf8, alpha: 0.35, width: 1.5 });
  container.addChild(cone, shadow, ring, body, turret);

  return {
    container,
    update: (engine) => {
      const rover = engine.rover;
      turret.rotation = isoAngle(rover.turretAngle);
      cone.clear();
      const a = isoAngle(rover.angle);
      const isNight = engine.dayTime > 0.72 || engine.dayTime < 0.14;
      const len = 120;
      const spread = 0.35;
      cone
        .poly([
          Math.cos(a) * 12, Math.sin(a) * 6,
          Math.cos(a - spread) * len, Math.sin(a - spread) * len * 0.5,
          Math.cos(a + spread) * len, Math.sin(a + spread) * len * 0.5,
        ])
        .fill({ color: 0xe0f2fe, alpha: isNight ? 0.16 : 0.06 });
      body.alpha = rover.dashTimer > 0 ? 0.8 : 1;
    },
    destroy: () => container.destroy({ children: true }),
  };
}

/** Command Hub: large two-tier iso structure with a glowing warp core. */
export function createHubView(): EntityView {
  const container = new Container();
  const g = new Graphics();
  drawGroundShadow(g, 66, 33, 0.5);
  drawIsoBox(g, 60, 30, 22, '#1e293b');
  g.poly([0, -52, 60, -22, 0, 8, -60, -22]).stroke({ color: 0x38bdf8, width: 2.5 });
  drawIsoBox(g, 34, 17, 40, '#334155');
  const core = new Graphics();
  core.circle(0, -46, 14).fill({ color: 0xa855f7, alpha: 0.85 });
  core.circle(0, -46, 7).fill({ color: 0xf3e8ff });
  const sweep = new Container();
  const sweepG = new Graphics();
  sweepG.moveTo(0, 0).lineTo(56, 0).stroke({ color: 0x38bdf8, alpha: 0.45, width: 2 });
  sweep.addChild(sweepG);
  sweep.position.set(0, -22);
  sweep.scale.y = 0.5; // squash the rotating sweep into the ground plane
  container.addChild(g, core, sweep);
  return {
    container,
    update: (engine) => {
      sweep.rotation = engine.elapsed * 1.4;
      core.alpha = 0.75 + Math.sin(engine.elapsed * 3) * 0.25;
    },
    destroy: () => container.destroy({ children: true }),
  };
}

export const HUB_ISO = worldToIso({ x: HUB_X, y: HUB_Y });