# AETHER-9

AETHER-9 là game sinh tồn / xây dựng căn cứ 2D chạy trên Canvas: điều khiển Rover Kỹ Sư khai khoáng, dựng chuỗi sản xuất tự động, chống lại Bọ Tinh Thể và bão từ, nạp đủ **1.200 Aether** để kích hoạt Động cơ Bước Nhảy.

AETHER-9 is a 2D canvas survival / base-building game: pilot the Engineer Rover, mine resources, build automated production chains, defend against crystal bugs and magnetic storms, and charge the Warp Drive with 1,200 Aether.

## Tech stack

- [Next.js](https://nextjs.org) (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS v4 (via `@tailwindcss/postcss`)
- `lucide-react` icons
- Canvas 2D rendering + Web Audio API (client-side only)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Description                          |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Start the development server         |
| `npm run build`     | Production build                     |
| `npm start`         | Serve the production build           |
| `npm run lint`      | ESLint (next/core-web-vitals + TS)   |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`)    |

## Project structure

Source code lives in `scr/` (mapped to the `@/` import alias in `tsconfig.json`):

```
app/                     Next.js App Router (layout, page, global CSS)
scr/
  components/game/       AetherGame React component (HUD, overlays, input)
  constants/             Game balance & configuration (gameConfig.ts)
  engine/                AetherGameEngine facade + state factories + HUD snapshot
    rendering/           Canvas renderers (world, entities, effects)
    systems/             Simulation systems (rover, buildings, drones, enemies, ...)
  types/                 Shared game types
  utils/                 Procedural terrain generation, sound engine
```

The engine follows a modular facade pattern: `gameEngine.ts` delegates to system
and renderer modules, which receive the engine instance and use `import type`
to avoid circular runtime dependencies.

## Controls

- **WASD / mouse click** — move the rover
- **Space** — Ion Dash · **Q** — EMP · **E** — Overcharge · **R** — Quick Repair
- **T** — tech tree · **Esc** — close panels
- Building hotkeys are shown on the construction dock.

## Notes

- Canvas, AudioContext and other browser APIs are only touched inside client
  components (`'use client'`) and effects, so server rendering stays safe.