'use client';

import { useEffect, useRef, useState } from 'react';
import { TILE_SIZE } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { GameSession } from '@/engine/core/gameSession';
import { createRenderer } from '@/engine/rendering/createRenderer';
import { clearHeldKeys, handleKeyDown, handleKeyUp } from '@/engine/systems/inputSystem';
import { applyIsoMovementKeys, isIsoMovementKey } from '@/engine/systems/isoInput';
import { BuildingType, GameSpeed, GameStatus, HudSnapshot } from '@/types/game';
import { soundEngine } from '@/utils/soundEngine';
import { BossHealthBar } from './BossHealthBar';
import { BuildDock } from './BuildDock';
import { Minimap } from './Minimap';
import { ObjectivePanel } from './ObjectivePanel';
import { SkillBar } from './SkillBar';
import { StatusOverlay } from './StatusOverlay';
import { TechPanel } from './TechPanel';
import { TopHud } from './TopHud';

export default function AetherGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<AetherGameEngine | null>(null);
  const sessionRef = useRef<GameSession | null>(null);
  const rendererKindRef = useRef<'pixi' | 'canvas'>('canvas');
  const physicalKeysRef = useRef(new Set<string>());

  const [status, setStatus] = useState<GameStatus>('intro');
  const [speed, setSpeed] = useState<GameSpeed>(1);
  const [muted, setMuted] = useState(false);
  const [selectedBuild, setSelectedBuild] = useState<BuildingType | null>(null);
  const [showTech, setShowTech] = useState(false);
  const [hud, setHud] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    const engine = new AetherGameEngine();
    engineRef.current = engine;
    setHud(engine.getHudSnapshot());
    // Stable Set identity — captured so the cleanup doesn't read the ref late.
    const physicalKeys = physicalKeysRef.current;

    // Renderer creation is async (WebGL probe + lazy Pixi import). StrictMode
    // can unmount while it is pending — the cancelled flag disposes the result.
    let cancelled = false;
    let session: GameSession | null = null;
    void (async () => {
      const renderer = await createRenderer();
      if (cancelled) {
        renderer.destroy();
        return;
      }
      rendererKindRef.current = renderer.kind;
      session = new GameSession(engine, renderer);
      sessionRef.current = session;
      if (hostRef.current) await session.attach(hostRef.current);
    })();

    // HUD state is polled independently of the render loop (10 Hz).
    const hudTimer = window.setInterval(() => {
      setHud(engine.getHudSnapshot());
      setStatus(engine.status);
    }, 100);

    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (rendererKindRef.current === 'pixi' && isIsoMovementKey(k)) {
        // Iso view: physical keys map to logical world-axis pairs (see isoInput).
        if (engine.status === 'playing') {
          physicalKeys.add(k);
          applyIsoMovementKeys(engine, physicalKeys);
        }
        if (k.startsWith('arrow')) e.preventDefault();
        return;
      }
      const preventDefault = handleKeyDown(engine, e.key, {
        onSelectBuild: setSelectedBuild,
        onToggleTech: () => setShowTech((prev) => !prev),
        onCloseOverlays: () => setShowTech(false),
      });
      if (preventDefault) e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (rendererKindRef.current === 'pixi' && isIsoMovementKey(k)) {
        physicalKeys.delete(k);
        applyIsoMovementKeys(engine, physicalKeys);
        return;
      }
      handleKeyUp(engine, e.key);
    };

    // Held keys must not survive focus loss (alt-tab, clicking outside, tab hide).
    const onBlur = () => {
      clearHeldKeys(engine);
      physicalKeys.clear();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearHeldKeys(engine);
        physicalKeys.clear();
      } else {
        session?.resetClock(); // avoid a giant dt spike on return
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      window.clearInterval(hudTimer);
      session?.detach();
      sessionRef.current = null;
      clearHeldKeys(engine);
      physicalKeys.clear();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const handleStart = () => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.reset(); // also clears keys, hoverTile and selectedBuild
    physicalKeysRef.current.clear();
    engine.status = 'playing';
    engine.speed = 1;
    setSpeed(1);
    setStatus('playing');
    setSelectedBuild(null);
    setShowTech(false);
    setHud(engine.getHudSnapshot());
  };

  const handleSpeedChange = (nextSpeed: GameSpeed) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.speed = nextSpeed;
    setSpeed(nextSpeed);
  };

  const handleSelectBuild = (type: BuildingType) => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = selectedBuild === type ? null : type;
    engine.selectedBuild = next;
    setSelectedBuild(next);
  };

  const handleReserveChange = (delta: number) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.adjustAetherReserve(delta); // applies immediately to the current run
    setHud(engine.getHudSnapshot());
  };

  const toggleMute = () => {
    soundEngine.muted = !muted;
    setMuted(!muted);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans text-slate-100 select-none">
      {/* Interactive world viewport: the active renderer owns its canvas inside. */}
      <div
        ref={hostRef}
        onMouseMove={(e) => {
          const engine = engineRef.current;
          const session = sessionRef.current;
          const host = hostRef.current;
          if (!engine || !session || !host) return;
          const rect = host.getBoundingClientRect();
          const world = session.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          engine.hoverTile = {
            gx: Math.floor(world.x / TILE_SIZE),
            gy: Math.floor(world.y / TILE_SIZE),
          };
        }}
        onClick={(e) => {
          const engine = engineRef.current;
          const session = sessionRef.current;
          const host = hostRef.current;
          if (!engine || !session || !host) return;
          const rect = host.getBoundingClientRect();
          const world = session.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
          engine.handleWorldClick(world.x, world.y);
        }}
        className="h-full w-full cursor-crosshair"
      />

      {/* TOP HUD BAR */}
      {hud && status === 'playing' && (
        <TopHud hud={hud} speed={speed} muted={muted} onSpeedChange={handleSpeedChange} onToggleMute={toggleMute} />
      )}

      {/* BOSS HP BAR */}
      {hud?.bossActive && status === 'playing' && <BossHealthBar hud={hud} />}

      {/* LEFT TACTICAL AI LOGS & TIMERS */}
      {hud && status === 'playing' && <ObjectivePanel hud={hud} />}

      {/* TACTICAL MINIMAP (hidden while the tech panel occupies the right rail) */}
      {hud && status === 'playing' && !showTech && <Minimap snapshot={hud.minimap} />}

      {/* TECH TREE MODAL */}
      {hud && status === 'playing' && showTech && (
        <TechPanel
          hud={hud}
          onClose={() => setShowTech(false)}
          onBuyUpgrade={(id) => engineRef.current?.buyUpgrade(id)}
          onReserveChange={handleReserveChange}
        />
      )}

      {/* BOTTOM CONSTRUCTION & ROVER SKILLS BAR */}
      {hud && status === 'playing' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4">
          {/* Rover Active Skills + Quick Repair + Tech Toggle */}
          <SkillBar
            hud={hud}
            showTech={showTech}
            onDash={() => engineRef.current?.triggerDash()}
            onEmp={() => engineRef.current?.triggerEmp()}
            onOvercharge={() => engineRef.current?.triggerOvercharge()}
            onQuickRepair={() => engineRef.current?.triggerQuickRepair()}
            onToggleTech={() => setShowTech((prev) => !prev)}
          />

          {/* 8 Buildings Dock */}
          <BuildDock hud={hud} selectedBuild={selectedBuild} onSelectBuild={handleSelectBuild} />
        </div>
      )}

      {/* INTRO / VICTORY / GAMEOVER OVERLAYS */}
      {status !== 'playing' && <StatusOverlay status={status} elapsed={hud?.elapsed ?? 0} onStart={handleStart} />}
    </div>
  );
}
