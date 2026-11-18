'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Cpu,
  Flame,
  Hammer,
  MapPin,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  Target,
  Volume2,
  VolumeX,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  AETHER_RESERVE_MAX,
  AETHER_RESERVE_MIN,
  AETHER_RESERVE_STEP,
  BUILDING_LIST,
  PHASES,
  TARGET_WARP_AETHER,
  TILE_SIZE,
  UPGRADES,
} from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';
import { GameSession } from '@/engine/core/gameSession';
import { createRenderer } from '@/engine/rendering/createRenderer';
import { getUpgradeCost, getUpgradeState } from '@/engine/systems/buildingSystem';
import { clearHeldKeys, handleKeyDown, handleKeyUp } from '@/engine/systems/inputSystem';
import { applyIsoMovementKeys, isIsoMovementKey } from '@/engine/systems/isoInput';
import { BuildingType, GameSpeed, GameStatus, HudSnapshot } from '@/types/game';
import { soundEngine } from '@/utils/soundEngine';

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

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentPhase = PHASES[hud?.phaseIndex ?? 0];
  const warpPct = Math.min(100, ((hud?.warpProgress ?? 0) / TARGET_WARP_AETHER) * 100);

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
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-4">
          {/* Resources & Energy */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-slate-800/90 bg-slate-950/85 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-orange-400" />
              <span className="text-xs text-slate-400">Silicat:</span>
              <span className="font-mono text-sm font-bold text-orange-300">{Math.floor(hud.resources.silicate)}</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
              <span className="text-xs text-slate-400">Sắt:</span>
              <span className="font-mono text-sm font-bold text-sky-300">{Math.floor(hud.resources.iron)}</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div
              className="flex items-center gap-1.5"
              title={`Chi tiêu được: ${Math.floor(hud.resources.aether)} (nâng cấp & xây dựng) · Dôi dư nạp Warp: ${Math.floor(hud.warpSurplus)} · Dự trữ chặn Warp: ${Math.floor(hud.aetherReserve)}`}
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-400" />
              <span className="text-xs text-slate-400">Aether:</span>
              <span className="font-mono text-sm font-bold text-purple-300">{Math.floor(hud.resources.aether)}</span>
              <span
                className="font-mono text-[10px] text-slate-500"
                title="Dự trữ chặn chuyển Warp tự động · Dôi dư sẽ được Warp tự nạp"
              >
                (trữ {Math.floor(hud.aetherReserve)} · dôi {Math.floor(hud.warpSurplus)})
              </span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span
                className={`font-mono text-xs font-bold ${
                  hud.energyProd >= hud.energyUse ? 'text-emerald-400' : 'text-rose-400'
                }`}
                title={`Sản xuất ${hud.energyProd} MW · Tiêu thụ ${hud.energyUse} MW · Hiệu suất lưới ${Math.round(hud.energyEfficiency * 100)}%`}
              >
                {hud.energyProd}/{hud.energyUse} MW
              </span>
              {hud.energyEfficiency < 1 && (
                <span
                  className="animate-pulse font-mono text-[10px] font-bold text-rose-400"
                  title="Thiếu điện: công trình & Drone hoạt động chậm. Xây thêm Pin Mặt Trời [1]."
                >
                  ! {Math.round(hud.energyEfficiency * 100)}%
                </span>
              )}
            </div>
          </div>

          {/* Warp Drive Progress & Phase */}
          <div className="pointer-events-auto flex min-w-[300px] flex-col gap-1.5 rounded-xl border border-purple-500/30 bg-slate-950/85 px-4 py-2.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold tracking-wider text-purple-300">{currentPhase.title}</span>
              <span className="font-mono text-slate-400">{formatTime(hud.elapsed)} / ~30:00</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full bg-gradient-to-r from-sky-500 via-purple-500 to-fuchsia-400 transition-all duration-300"
                style={{ width: `${warpPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>Động cơ Bước Nhảy: {warpPct.toFixed(1)}%</span>
              <span>
                {Math.floor(hud.warpProgress)} / {TARGET_WARP_AETHER} Aether
              </span>
            </div>
          </div>

          {/* Base Hull, Speed & Audio Controls */}
          <div className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-800/90 bg-slate-950/85 px-3 py-2 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 pr-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-emerald-300">
                {hud.hubHp}/{hud.hubMaxHp}
              </span>
            </div>

            <div className="flex items-center rounded-lg bg-slate-900 p-0.5">
              {([0, 1, 2] as GameSpeed[]).map((sp) => (
                <button
                  key={sp}
                  onClick={() => handleSpeedChange(sp)}
                  className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                    speed === sp ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sp === 0 ? <Pause className="h-3.5 w-3.5" /> : `${sp}x`}
                </button>
              ))}
            </div>

            <button
              onClick={toggleMute}
              className="rounded-lg bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
              title="Bật/Tắt âm thanh"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      )}

      {/* BOSS HP BAR */}
      {hud?.bossActive && status === 'playing' && (
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div className="w-96 rounded-xl border border-purple-500/60 bg-slate-950/90 px-4 py-2 shadow-2xl">
            <div className="mb-1 flex justify-between text-xs font-bold text-purple-300">
              <span>CHÚA TỂ TỔ KÉN: AETHER BEHEMOTH</span>
              <span>
                {hud.bossHp} / {hud.bossMaxHp}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-900">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-purple-500"
                style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* LEFT TACTICAL AI LOGS & TIMERS */}
      {hud && status === 'playing' && (
        <div className="pointer-events-none absolute left-4 top-24 flex w-80 flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs backdrop-blur-md">
              <span className="text-slate-400">Bão Từ: </span>
              <span className={`font-mono font-bold ${hud.stormActive ? 'text-rose-400 animate-pulse' : 'text-sky-300'}`}>
                {hud.stormActive ? 'ĐANG ĐỔ BỘ!' : `${hud.stormTimer}s`}
              </span>
            </div>
            <div
              className={`flex-1 rounded-lg border bg-slate-950/80 px-3 py-1.5 text-xs backdrop-blur-md ${
                hud.waveTimer <= 10 ? 'border-rose-500/70' : 'border-slate-800'
              }`}
              title={`Đợt tiếp theo sau ${hud.waveTimer}s · Đã qua ${hud.waveCount} đợt · ${hud.enemiesAlive} Bọ Tinh Thể còn sống`}
            >
              <span className="text-slate-400">Đợt {hud.waveCount + 1}: </span>
              <span
                className={`font-mono font-bold ${
                  hud.waveTimer <= 10 ? 'animate-pulse text-rose-400' : 'text-amber-300'
                }`}
              >
                {hud.waveTimer}s
              </span>
              {hud.enemiesAlive > 0 && (
                <span className="font-mono font-bold text-rose-400"> · {hud.enemiesAlive} bọ</span>
              )}
            </div>
          </div>

          {hud.drones.total > 0 && (
            <div
              className="rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-1.5 text-xs backdrop-blur-md"
              title={`Tổng ${hud.drones.total} Drone · ${hud.drones.hauling} đang chở hàng · ${hud.drones.idle} chờ việc (mỏ cạn hoặc hết nhiệm vụ)`}
            >
              <span className="text-slate-400">Drone: </span>
              <span className="font-mono font-bold text-sky-300">{hud.drones.total}</span>
              <span className="text-slate-500"> · </span>
              <span className="font-mono text-emerald-300">{hud.drones.hauling} chở</span>
              <span className="text-slate-500"> · </span>
              <span className={`font-mono ${hud.drones.idle > 0 ? 'text-amber-300' : 'text-slate-400'}`}>
                {hud.drones.idle} chờ
              </span>
            </div>
          )}

          {/* Active objective + POI discovery tracker (engine-driven, 10Hz) */}
          {hud.objective ? (
            <div className="rounded-xl border border-emerald-500/30 bg-slate-950/80 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5" />
                  MỤC TIÊU {hud.objectivesDone + 1}/{hud.objectivesTotal}
                </span>
                <span
                  className="flex items-center gap-1 font-mono text-slate-400"
                  title="Điểm đặc biệt (POI) đã phát hiện trên tổng số"
                >
                  <MapPin className="h-3 w-3 text-sky-400" />
                  {hud.poi.discovered}/{hud.poi.total}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-100">{hud.objective.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{hud.objective.desc}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-900">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-300"
                    style={{ width: `${(hud.objective.progress / hud.objective.target) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-emerald-300">
                  {hud.objective.progress}/{hud.objective.target}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-slate-950/80 px-3 py-1.5 text-xs backdrop-blur-md">
              <span className="flex items-center gap-1.5 font-bold text-emerald-300">
                <Target className="h-3.5 w-3.5" />
                Mục tiêu: {hud.objectivesDone}/{hud.objectivesTotal} hoàn thành
              </span>
              <span className="flex items-center gap-1 font-mono text-slate-400" title="Điểm đặc biệt (POI) đã phát hiện">
                <MapPin className="h-3 w-3 text-sky-400" />
                {hud.poi.discovered}/{hud.poi.total}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-1.5 rounded-xl border border-slate-800/80 bg-slate-950/80 p-3 backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-sky-400">
              <Radio className="h-3.5 w-3.5" />
              <span>AI TÀU MẸ VALKYRIE-7</span>
            </div>
            {hud.logs.slice(0, 3).map((log) => (
              <p
                key={log.id}
                className={`text-xs leading-relaxed ${
                  log.type === 'warn'
                    ? 'text-rose-300'
                    : log.type === 'good'
                    ? 'text-emerald-300'
                    : log.type === 'ai'
                    ? 'text-sky-200'
                    : 'text-slate-300'
                }`}
              >
                {log.text}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* TECH TREE MODAL */}
      {hud && status === 'playing' && showTech && (
        <div className="absolute right-4 top-24 z-30 w-96 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-purple-300">
              <Cpu className="h-4 w-4" />
              <span>CÂY CÔNG NGHỆ AETHER</span>
            </div>
            <button onClick={() => setShowTech(false)} className="text-xs text-slate-400 hover:text-white">
              Đóng [ESC]
            </button>
          </div>
          <div className="flex flex-col gap-2.5">
            {UPGRADES.map((u) => {
              const lvl = hud.upgrades[u.id] || 0;
              const state = getUpgradeState(u.id, hud.upgrades, hud.resources, hud.hasLab);
              const maxed = state === 'maxed';
              const locked = state === 'locked';
              const cost = getUpgradeCost(u, lvl);
              const costParts = [
                { key: 'silicate', label: 'Sil', value: cost.silicate },
                { key: 'iron', label: 'Sắt', value: cost.iron },
                { key: 'aether', label: 'Aeth', value: cost.aether },
              ].filter((p) => p.value > 0);
              return (
                <div key={u.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{u.name}</span>
                    <span className="font-mono text-xs text-purple-300">
                      Lv.{lvl}/{u.maxLevel}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">{u.desc}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[11px] text-slate-300">
                      {maxed ? (
                        'ĐÃ TỐI ĐA'
                      ) : (
                        costParts.map((p, i) => (
                          <span key={p.key}>
                            {i > 0 && <span className="text-slate-500"> · </span>}
                            <span
                              className={
                                hud.resources[p.key as keyof typeof hud.resources] < p.value
                                  ? 'text-rose-400'
                                  : 'text-slate-300'
                              }
                            >
                              {p.value} {p.label}
                            </span>
                          </span>
                        ))
                      )}
                    </span>
                    <button
                      disabled={state !== 'affordable'}
                      onClick={() => engineRef.current?.buyUpgrade(u.id)}
                      className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                    >
                      {locked
                        ? 'Cần Phòng NC [7]'
                        : maxed
                        ? 'Max'
                        : state === 'unaffordable'
                        ? 'Thiếu tài nguyên'
                        : 'Nâng cấp'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Warp Aether reserve control */}
          <div className="mt-2.5 rounded-xl border border-purple-500/30 bg-slate-900/80 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-100">Dự trữ Aether chặn Warp</span>
              <span className="font-mono text-xs text-purple-300">{Math.floor(hud.aetherReserve)}</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Warp chỉ tự nạp phần Aether dôi dư trên mức dự trữ. Toàn bộ số dư hiện tại vẫn dùng để nâng cấp.
            </p>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-mono text-[11px] text-slate-300">
                {AETHER_RESERVE_MIN}–{AETHER_RESERVE_MAX} · bước {AETHER_RESERVE_STEP}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  aria-label={`Giảm dự trữ ${AETHER_RESERVE_STEP}`}
                  disabled={hud.aetherReserve <= AETHER_RESERVE_MIN}
                  onClick={() => handleReserveChange(-AETHER_RESERVE_STEP)}
                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  −{AETHER_RESERVE_STEP}
                </button>
                <button
                  aria-label={`Tăng dự trữ ${AETHER_RESERVE_STEP}`}
                  disabled={hud.aetherReserve >= AETHER_RESERVE_MAX}
                  onClick={() => handleReserveChange(AETHER_RESERVE_STEP)}
                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                >
                  +{AETHER_RESERVE_STEP}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM CONSTRUCTION & ROVER SKILLS BAR */}
      {hud && status === 'playing' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 p-4">
          {/* Rover Active Skills + Quick Repair + Tech Toggle */}
          <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 shadow-xl backdrop-blur-md">
            <button
              onClick={() => engineRef.current?.triggerDash()}
              disabled={hud.skills.dashCd > 0}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-900/70 disabled:opacity-45"
            >
              <span>[Space] Lướt Ion</span>
              {hud.skills.dashCd > 0 && <span className="font-mono text-sky-400">{hud.skills.dashCd}s</span>}
            </button>

            <button
              onClick={() => engineRef.current?.triggerEmp()}
              disabled={hud.skills.empCd > 0}
              className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/60 px-2.5 py-1 text-xs font-semibold text-purple-200 hover:bg-purple-900/70 disabled:opacity-45"
            >
              <span>[Q] Xung EMP</span>
              {hud.skills.empCd > 0 && <span className="font-mono text-purple-400">{hud.skills.empCd}s</span>}
            </button>

            <button
              onClick={() => engineRef.current?.triggerOvercharge()}
              disabled={hud.skills.overchargeCd > 0}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-900/70 disabled:opacity-45"
            >
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>[E] Quá Tải</span>
              {hud.skills.overchargeCd > 0 && (
                <span className="font-mono text-amber-400">{hud.skills.overchargeCd}s</span>
              )}
            </button>

            <div className="h-4 w-px bg-slate-800" />

            <button
              onClick={() => engineRef.current?.triggerQuickRepair()}
              className="flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-950/60 px-2.5 py-1 text-xs font-semibold text-teal-200 hover:bg-teal-900/70"
            >
              <Wrench className="h-3.5 w-3.5 text-teal-400" />
              <span>[R] Sửa Nhanh (20 Sil, 15 Sắt)</span>
            </button>

            <button
              onClick={() => setShowTech((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold transition ${
                showTech
                  ? 'border-purple-400 bg-purple-600 text-white'
                  : 'border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>[T] Công Nghệ</span>
            </button>
          </div>

          {/* 8 Buildings Dock */}
          <div className="pointer-events-auto flex flex-wrap justify-center gap-2 rounded-2xl border border-slate-800/90 bg-slate-950/90 p-2.5 shadow-2xl backdrop-blur-md">
            {BUILDING_LIST.map((b) => {
              const active = selectedBuild === b.id;
              const affordable =
                hud.resources.silicate >= (b.cost.silicate || 0) &&
                hud.resources.iron >= (b.cost.iron || 0) &&
                hud.resources.aether >= (b.cost.aether || 0);
              return (
                <button
                  key={b.id}
                  onClick={() => handleSelectBuild(b.id)}
                  disabled={!affordable}
                  title={affordable ? b.desc : `Không đủ tài nguyên · ${b.desc}`}
                  className={`flex w-36 flex-col items-start rounded-xl border p-2 text-left transition ${
                    active
                      ? 'border-sky-400 bg-sky-950/80 ring-2 ring-sky-400/40'
                      : 'border-slate-800 bg-slate-900/80 hover:border-slate-600'
                  } disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-slate-800`}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                      [{b.key}]
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {b.energyDelta > 0 ? `+${b.energyDelta}MW` : b.energyDelta < 0 ? `${b.energyDelta}MW` : '0MW'}
                    </span>
                  </div>
                  <span className="mt-1 line-clamp-1 text-xs font-bold text-slate-100">{b.name}</span>
                  <span className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {[
                      b.cost.silicate ? `${b.cost.silicate} Sil` : '',
                      b.cost.iron ? `${b.cost.iron} Sắt` : '',
                      b.cost.aether ? `${b.cost.aether} Aeth` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* INTRO / VICTORY / GAMEOVER OVERLAYS */}
      {status !== 'playing' && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur-md">
          <div className="max-w-lg rounded-3xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-400">
              {status === 'intro' ? (
                <Hammer className="h-7 w-7" />
              ) : status === 'victory' ? (
                <Sparkles className="h-7 w-7" />
              ) : (
                <Activity className="h-7 w-7 text-rose-400" />
              )}
            </div>

            <h1 className="text-2xl font-black tracking-wide text-white">
              {status === 'intro'
                ? 'AETHER-9: HÀNH TINH KHAI KHOÁNG'
                : status === 'victory'
                ? 'BƯỚC NHẢY KHÔNG GIAN THÀNH CÔNG!'
                : 'TRUNG TÂM CHỈ HUY THẤT THỦ'}
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {status === 'intro'
                ? 'Điều khiển Rover Kỹ Sư (WASD / Click chuột), xây dựng chuỗi khai khoáng tự động, phòng thủ trước Bọ Tinh Thể và nạp đủ 1.200 Aether để kích hoạt Động cơ Bước Nhảy.'
                : status === 'victory'
                ? `Chúc mừng Chỉ huy! Bạn đã hoàn thành chiến dịch sinh tồn trong ${formatTime(hud?.elapsed ?? 0)} và đưa toàn bộ dữ liệu hành tinh Aether-9 trở về quỹ đạo an toàn.`
                : 'Lõi lò phản ứng đã quá tải trước sức ép của bão từ và sinh vật bản địa. Hãy tái thiết lại hệ thống phòng thủ!'}
            </p>

            <button
              onClick={handleStart}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
            >
              {status === 'intro' ? <Play className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
              <span>{status === 'intro' ? 'BẮT ĐẦU NHIỆM VỤ' : 'CHƠI LẠI TỪ ĐẦU'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}