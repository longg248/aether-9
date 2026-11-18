import { Pause, Shield, Sparkles, Volume2, VolumeX, Zap } from 'lucide-react';
import { PHASES, TARGET_WARP_AETHER } from '@/constants/gameConfig';
import { GameSpeed, HudSnapshot } from '@/types/game';
import { formatTime } from './formatTime';

interface TopHudProps {
  hud: HudSnapshot;
  speed: GameSpeed;
  muted: boolean;
  onSpeedChange: (speed: GameSpeed) => void;
  onToggleMute: () => void;
}

export function TopHud({ hud, speed, muted, onSpeedChange, onToggleMute }: TopHudProps) {
  const currentPhase = PHASES[hud.phaseIndex];
  const warpPct = Math.min(100, (hud.warpProgress / TARGET_WARP_AETHER) * 100);

  return (
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
              aria-label={sp === 0 ? 'Tạm dừng' : undefined}
              onClick={() => onSpeedChange(sp)}
              className={`rounded-md px-2 py-1 text-xs font-bold transition ${
                speed === sp ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {sp === 0 ? <Pause className="h-3.5 w-3.5" /> : `${sp}x`}
            </button>
          ))}
        </div>

        <button
          onClick={onToggleMute}
          className="rounded-lg bg-slate-900 p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white"
          title="Bật/Tắt âm thanh"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
