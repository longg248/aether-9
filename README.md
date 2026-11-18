# AETHER-9

AETHER-9 là game sinh tồn / xây dựng căn cứ 2D với góc nhìn isometric: điều khiển Rover Kỹ Sư khai khoáng, dựng chuỗi sản xuất tự động, khảo sát các điểm đặc biệt, chống lại Bọ Tinh Thể và bão từ, rồi nạp đủ **1.200 Aether** để kích hoạt Động cơ Bước Nhảy.

AETHER-9 is a 2D isometric survival / base-building game: pilot the Engineer Rover, mine resources, build automated production chains, explore points of interest, defend against crystal bugs and magnetic storms, and charge the Warp Drive with **1,200 Aether**.

## Renderer and simulation

- The default renderer uses **PixiJS 8 / WebGL** and projects the square simulation grid into an isometric diamond view.
- If WebGL is unavailable, the game falls back to the legacy **Canvas 2D top-down renderer**.
- The simulation under `scr/engine/` is renderer-agnostic. Camera pan, zoom, and shake are render-only concerns; they never change simulation coordinates or gameplay rules.
- Terrain, buildings, drones, enemies, combat effects, fog of war, day/night tint, and floating markers are drawn by the active renderer.

## World and campaign

- **Seeded generation:** `WORLD_SEED` fixes the POI layout across runs. Resource nodes use seeded random streams and avoid the Hub and POI tiles.
- **POIs:** discover abandoned research stations, ancient Aether deposits, damaged signal relays, crystal nests, and supply caches. Activated relays permanently reveal nearby terrain; guarded nests trigger an ambush.
- **Objective chain:** seven sequential milestones cover surveying, relay activation, research recovery, nest clearing, automated production, storm survival, and the Behemoth encounter. Each reward is granted once. The chain is independent of the 1,200-Aether victory condition.
- **Enemies and elites:** regular waves include swarmers, goliaths, and spitters. Elite variants have boosted stats, a gold visual ring, and guaranteed Aether drops. The Aether Behemoth is a boss with a telegraphed heavy attack.

## Controls

### Pixi isometric renderer

- **WASD / arrow keys** — move in screen directions. Keys are remapped to world-axis pairs so **W** moves up, **S** down, **A** left, and **D** right on the diamond view.
- **Left click** — move/interact or place the selected building.
- **Mouse wheel** — zoom around the cursor.
- **Right- or middle-drag** — pan the render camera. Holding a movement key returns to rover following.

### Shared controls

- **Space** — Ion Dash; **Q** — EMP; **E** — Overcharge; **R** — Quick Repair.
- **T** — toggle the tech tree; **Esc** — close panels and cancel building selection.
- **1–8** — select the building shown in the construction dock.
- The top HUD provides pause, 1×/2× speed, and audio controls. The Canvas fallback keeps the original top-down WASD mapping and does not add iso pan/zoom.
- The intro/pause menus provide continue, manual save, save deletion, volume, mute, and default-speed settings. The game autosaves every 30 seconds during active play; a four-step first-run tutorial is remembered after dismissal.

## Tech stack

- Next.js 15 (App Router) + React 19
- TypeScript in strict mode
- PixiJS 8 with a Canvas 2D fallback
- Tailwind CSS v4 and `lucide-react`
- Vitest + jsdom
- Web Audio API (client-side only)

## Getting started

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run lint` | Run ESLint |
| `npm test` | Run the Vitest suite once |
| `npm run build` | Create the production Next.js build |
| `npm start` | Serve the production build |

## Project structure

`scr/` is intentional; `@/*` maps to `./scr/*` in `tsconfig.json`.

```text
app/                              Next.js App Router entry, layout, global CSS
scr/
  components/game/                Game shell and focused HUD/panel components
  constants/gameConfig.ts         Shared content and balance configuration
  engine/
    core/                         Session, loop, and seeded random services
    isometric/                    Iso projection and render-side camera
    persistence/                  Versioned save types, validation, serialize/apply
    systems/                      Pure gameplay systems and input mapping
    world/                        Terrain data
    gameEngine.ts                 Simulation facade
    gameState.ts                  Initial simulation state
    hud.ts                        Read-only HUD snapshots
    rendering/
      pixi/                       Pixi application, iso scene, and entity views
      legacy/                     Canvas renderer and terrain texture
      createRenderer.ts           WebGL probe and renderer selection
      gameRenderer.ts             Renderer boundary
      renderer.ts                 Legacy Canvas draw orchestration
      worldRenderer.ts            Legacy terrain/POI/fog drawing
      entityRenderer.ts           Legacy entity drawing
      effectsRenderer.ts          Legacy effects drawing
  types/game.ts                   Shared simulation and HUD types
  utils/                          Seeded terrain helpers, random, sound
tests/                            Vitest simulation, input, HUD, and renderer tests
```

The engine uses a modular facade: systems receive the engine instance, while type-only imports avoid runtime cycles. Browser-only Canvas, WebGL, and audio work stays behind client components and renderer/effect boundaries.
