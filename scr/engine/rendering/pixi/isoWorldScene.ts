import { Container, Graphics, Text } from 'pixi.js';
import { BUILDINGS, GRID_SIZE, HUB_X, HUB_Y, TILE_SIZE } from '@/constants/gameConfig';
import type { AetherGameEngine } from '@/engine/gameEngine';
import { IsoCamera, ViewportSize, worldToIso } from '@/engine/isometric/projection';
import { getActivatedRelays } from '@/engine/systems/poiSystem';
import { isTileRevealed } from '@/utils/proceduralTerrain';
import {
  EntityView,
  HUB_ISO,
  createBuildingView,
  createDroneView,
  createEnemyView,
  createHubView,
  createNodeView,
  createPodView,
  createPoiView,
  createRoverView,
} from './entityViews';
import { createGridSpaceContainer, hex, shade } from './isoGraphics';

/**
 * Scene graph for the isometric world. Pure Pixi scene objects — constructible
 * and sync-able without a GL context, so jsdom tests can exercise it.
 *
 * Layer order (bottom → top): terrain → decals → entities (depth-sorted) →
 * additive effects → build ghost → fog of war → floating markers. Fog sits
 * ABOVE entities, matching the legacy canvas draw order.
 */
export class IsoWorldScene {
  readonly root = new Container();

  readonly worldLayer = new Container();
  private readonly terrainSpace = createGridSpaceContainer();
  private readonly terrainG = new Graphics();
  private readonly decalG = new Graphics();
  readonly entityLayer = new Container();
  private readonly effectsG = new Graphics();
  private readonly ghostSpace = createGridSpaceContainer();
  private readonly ghostG = new Graphics();
  private readonly fogSpace = createGridSpaceContainer();
  private readonly fogG = new Graphics();
  private readonly markerLayer = new Container();
  private readonly tintG = new Graphics();

  private readonly nodeViews = new Map<string, EntityView>();
  private readonly buildingViews = new Map<string, EntityView>();
  private readonly poiViews = new Map<string, EntityView>();
  private readonly podViews = new Map<string, EntityView>();
  private readonly droneViews = new Map<string, EntityView>();
  private readonly enemyViews = new Map<string, EntityView>();
  private hubView: EntityView;
  private roverView: EntityView;
  private readonly textPool: Text[] = [];

  private lastRunId = -1;
  private fogSignature = '';

  constructor(private readonly engine: AetherGameEngine) {
    this.entityLayer.sortableChildren = true;
    this.effectsG.blendMode = 'add';
    this.terrainSpace.addChild(this.terrainG);
    this.ghostSpace.addChild(this.ghostG);
    this.fogSpace.addChild(this.fogG);
    this.worldLayer.addChild(
      this.terrainSpace,
      this.decalG,
      this.entityLayer,
      this.effectsG,
      this.ghostSpace,
      this.fogSpace,
      this.markerLayer
    );
    this.root.addChild(this.worldLayer, this.tintG);

    this.buildTerrain();
    this.hubView = createHubView();
    this.roverView = createRoverView();
    this.hubView.container.position.set(HUB_ISO.x, HUB_ISO.y);
    this.hubView.container.zIndex = HUB_X + HUB_Y;
    this.entityLayer.addChild(this.hubView.container, this.roverView.container);
    this.lastRunId = engine.runId;
  }

  /** Static terrain: one batched Graphics in grid space (diamond matrix). */
  private buildTerrain(): void {
    const g = this.terrainG;
    const t = this.engine.terrain;
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        // Subtle per-tile value noise so the basalt plain doesn't read flat.
        const h = ((gx * 73856093) ^ (gy * 19349663)) >>> 0;
        const v = 0.9 + (h % 100) / 1000;
        g.rect(gx, gy, 1.02, 1.02).fill({ color: shade('#1a1226', v) });
      }
    }
    for (const p of t.patches) {
      g.ellipse(p.x / TILE_SIZE, p.y / TILE_SIZE, p.rx / TILE_SIZE, p.ry / TILE_SIZE).fill({
        color: p.dark ? 0x120b1c : 0x241735,
        alpha: 0.5,
      });
    }
    for (const vein of t.veins) {
      g.moveTo(vein[0].x / TILE_SIZE, vein[0].y / TILE_SIZE);
      for (let i = 1; i < vein.length; i++) g.lineTo(vein[i].x / TILE_SIZE, vein[i].y / TILE_SIZE);
      g.stroke({ color: 0x3b2a55, width: 0.12, alpha: 0.7 });
    }
    for (const c of t.craters) {
      g.ellipse(c.x / TILE_SIZE, c.y / TILE_SIZE, c.r / TILE_SIZE, c.r / TILE_SIZE).fill({ color: 0x0d0817, alpha: 0.8 });
      g.ellipse(c.x / TILE_SIZE, c.y / TILE_SIZE, c.r / TILE_SIZE, c.r / TILE_SIZE).stroke({
        color: 0x2c1d42,
        width: 0.08,
        alpha: 0.8,
      });
    }
    for (const f of t.flora) {
      g.circle(f.x / TILE_SIZE, f.y / TILE_SIZE, f.size / TILE_SIZE).fill({ color: hex('#7c5cbf'), alpha: 0.55 });
    }
    // Grid lines last so they sit on top of the decals.
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        g.rect(gx, gy, 1, 1).stroke({ color: 0x6d5a9e, width: 0.02, alpha: 0.16 });
      }
    }
  }

  private syncViews<T extends { id: string; x: number; y: number }>(
    items: T[],
    views: Map<string, EntityView>,
    create: (item: T) => EntityView
  ): void {
    const seen = new Set<string>();
    for (const item of items) {
      seen.add(item.id);
      let view = views.get(item.id);
      if (!view) {
        view = create(item);
        views.set(item.id, view);
        this.entityLayer.addChild(view.container);
      }
      const iso = worldToIso(item);
      view.container.position.set(iso.x, iso.y);
      // Ground-contact depth: worldX + worldY is monotonic with iso screen Y.
      view.container.zIndex = item.x + item.y;
      view.update(this.engine);
    }
    for (const [id, view] of views) {
      if (!seen.has(id)) {
        view.destroy();
        views.delete(id);
      }
    }
  }

  private clearEntityViews(): void {
    for (const map of [
      this.nodeViews,
      this.buildingViews,
      this.poiViews,
      this.podViews,
      this.droneViews,
      this.enemyViews,
    ]) {
      for (const view of map.values()) view.destroy();
      map.clear();
    }
    this.hubView.destroy();
    this.roverView.destroy();
    this.hubView = createHubView();
    this.roverView = createRoverView();
    this.hubView.container.position.set(HUB_ISO.x, HUB_ISO.y);
    this.hubView.container.zIndex = HUB_X + HUB_Y;
    this.entityLayer.addChild(this.hubView.container, this.roverView.container);
    for (const text of this.textPool) text.destroy();
    this.textPool.length = 0;
  }

  private syncDecals(): void {
    const g = this.decalG;
    g.clear();
    for (const track of this.engine.tireTracks) {
      const p = worldToIso(track);
      g.ellipse(p.x, p.y, 5, 2.5).fill({ color: 0x000000, alpha: track.alpha * 0.35 });
    }
    for (const pool of this.engine.acidPools) {
      const p = worldToIso(pool);
      const fade = Math.min(1, pool.life / pool.maxLife);
      g.ellipse(p.x, p.y, pool.radius, pool.radius * 0.5).fill({ color: 0x4ade80, alpha: 0.28 * fade });
      g.ellipse(p.x, p.y, pool.radius * 0.6, pool.radius * 0.3).fill({ color: 0x86efac, alpha: 0.25 * fade });
    }
  }

  private syncEffects(): void {
    const g = this.effectsG;
    g.clear();
    const e = this.engine;
    for (const beam of e.lasers) {
      const a = worldToIso({ x: beam.x1, y: beam.y1 });
      const b = worldToIso({ x: beam.x2, y: beam.y2 });
      const alpha = Math.max(0, beam.life / beam.maxLife);
      g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: hex(beam.color), width: beam.width, alpha });
    }
    for (const bolt of e.lightnings) {
      const alpha = Math.max(0, bolt.life / bolt.maxLife);
      const first = worldToIso(bolt.points[0]);
      g.moveTo(first.x, first.y);
      for (let i = 1; i < bolt.points.length; i++) {
        const p = worldToIso(bolt.points[i]);
        g.lineTo(p.x, p.y);
      }
      g.stroke({ color: 0x93c5fd, width: 2.5, alpha });
    }
    for (const proj of e.projectiles) {
      const p = worldToIso(proj);
      g.circle(p.x, p.y - 6, proj.isAcid ? 4 : 2.5).fill({ color: hex(proj.color), alpha: 0.95 });
    }
    for (const part of e.particles) {
      const p = worldToIso(part);
      g.circle(p.x, p.y - 4, part.size).fill({ color: hex(part.color), alpha: Math.max(0, part.alpha) });
    }
  }

  private syncGhost(): void {
    const g = this.ghostG;
    g.clear();
    const e = this.engine;
    const hover = e.hoverTile;
    if (!hover || e.status !== 'playing') return;
    const { gx, gy } = hover;
    if (gx < 0 || gy < 0 || gx >= GRID_SIZE || gy >= GRID_SIZE) return;
    if (e.selectedBuild) {
      const cfg = BUILDINGS[e.selectedBuild];
      const check = e.canBuildAt(gx, gy, e.selectedBuild);
      const color = check.ok ? 0x22c55e : 0xef4444;
      g.rect(gx, gy, 1, 1).fill({ color, alpha: 0.35 });
      g.rect(gx, gy, 1, 1).stroke({ color, width: 0.06, alpha: 0.9 });
      if (cfg.radius) {
        g.circle(gx + 0.5, gy + 0.5, cfg.radius).stroke({ color, width: 0.05, alpha: 0.5 });
      }
    } else {
      g.rect(gx, gy, 1, 1).stroke({ color: 0xe2e8f0, width: 0.05, alpha: 0.5 });
    }
  }

  private syncFog(): void {
    const e = this.engine;
    const relays = getActivatedRelays(e.pois);
    const radarCount = e.buildings.reduce((n, b) => n + (b.type === 'radar' ? 1 : 0), 0);
    // Rebuild only when a reveal source actually moved/changed (24px buckets).
    const signature = `${Math.floor(e.rover.x / 24)},${Math.floor(e.rover.y / 24)},${radarCount},${relays.length}`;
    if (signature === this.fogSignature) return;
    this.fogSignature = signature;
    const g = this.fogG;
    g.clear();
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        if (!isTileRevealed(gx, gy, e.rover.x, e.rover.y, e.buildings, relays)) {
          g.rect(gx, gy, 1.02, 1.02).fill({ color: 0x07050c, alpha: 0.84 });
        }
      }
    }
  }

  private syncMarkers(): void {
    const texts = this.engine.floatingTexts;
    while (this.textPool.length < texts.length) {
      const text = new Text({
        text: '',
        style: { fontFamily: 'ui-sans-serif, system-ui, sans-serif', fontSize: 13, fontWeight: 'bold', fill: 0xffffff },
      });
      text.anchor.set(0.5);
      this.textPool.push(text);
      this.markerLayer.addChild(text);
    }
    for (let i = 0; i < this.textPool.length; i++) {
      const text = this.textPool[i];
      const ft = texts[i];
      if (!ft) {
        text.visible = false;
        continue;
      }
      text.visible = true;
      text.text = ft.text;
      text.style.fill = hex(ft.color);
      const p = worldToIso(ft);
      text.position.set(p.x, p.y - 24);
      text.alpha = Math.max(0, ft.life / ft.maxLife);
      text.scale.set(ft.scale);
    }
  }

  private syncTint(viewport: ViewportSize): void {
    const g = this.tintG;
    g.clear();
    const day = this.engine.dayTime;
    // Night: deep blue overlay; dawn/dusk: warm tint. dayTime 0.22 = morning.
    const color = 0x0b1030;
    let alpha = 0;
    if (day > 0.72 || day < 0.14) alpha = 0.32;
    else if (day > 0.62) alpha = ((day - 0.62) / 0.1) * 0.32;
    else if (day < 0.22) alpha = ((0.22 - day) / 0.08) * 0.32;
    if (alpha > 0) g.rect(0, 0, viewport.width, viewport.height).fill({ color, alpha });
    if (this.engine.stormActive) {
      const flicker = 0.1 + 0.05 * Math.sin(this.engine.elapsed * 23);
      g.rect(0, 0, viewport.width, viewport.height).fill({ color: 0x7c3aed, alpha: flicker });
    }
  }

  /** Per-frame sync. `camera` is the iso camera; sim state is never mutated. */
  sync(camera: IsoCamera, viewport: ViewportSize): void {
    const e = this.engine;
    if (e.runId !== this.lastRunId) {
      this.lastRunId = e.runId;
      this.clearEntityViews();
      this.fogSignature = '';
    }

    const camIso = worldToIso(camera);
    // Camera shake stays in the render layer only (never in sim state).
    const shake = e.camera.shake;
    const sx = shake > 0 ? Math.sin(e.elapsed * 61) * shake : 0;
    const sy = shake > 0 ? Math.cos(e.elapsed * 53) * shake : 0;
    this.worldLayer.position.set(
      viewport.width / 2 - camIso.x * camera.zoom + sx,
      viewport.height / 2 - camIso.y * camera.zoom + sy
    );
    this.worldLayer.scale.set(camera.zoom);

    this.syncViews(e.nodes, this.nodeViews, createNodeView);
    this.syncViews(e.pois, this.poiViews, createPoiView);
    this.syncViews(e.buildings, this.buildingViews, createBuildingView);
    this.syncViews(e.crashPods, this.podViews, createPodView);
    this.syncViews(e.drones, this.droneViews, createDroneView);
    this.syncViews(e.enemies, this.enemyViews, createEnemyView);

    const roverIso = worldToIso(e.rover);
    this.roverView.container.position.set(roverIso.x, roverIso.y);
    this.roverView.container.zIndex = e.rover.x + e.rover.y;
    this.roverView.update(e);
    this.hubView.update(e);

    this.syncDecals();
    this.syncEffects();
    this.syncGhost();
    this.syncFog();
    this.syncMarkers();
    this.syncTint(viewport);
  }

  destroy(): void {
    this.clearEntityViews();
    this.root.destroy({ children: true });
  }
}