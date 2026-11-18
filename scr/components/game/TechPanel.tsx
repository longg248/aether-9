import { Cpu } from 'lucide-react';
import {
  AETHER_RESERVE_MAX,
  AETHER_RESERVE_MIN,
  AETHER_RESERVE_STEP,
  UPGRADES,
} from '@/constants/gameConfig';
import { getUpgradeCost, getUpgradeState } from '@/engine/systems/buildingSystem';
import { HudSnapshot } from '@/types/game';

interface TechPanelProps {
  hud: HudSnapshot;
  onClose: () => void;
  onBuyUpgrade: (id: string) => void;
  onReserveChange: (delta: number) => void;
}

export function TechPanel({ hud, onClose, onBuyUpgrade, onReserveChange }: TechPanelProps) {
  return (
    <div className="absolute right-4 top-24 z-30 w-96 rounded-2xl border border-slate-700 bg-slate-950/95 p-4 shadow-2xl backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-purple-300">
          <Cpu className="h-4 w-4" />
          <span>CÂY CÔNG NGHỆ AETHER</span>
        </div>
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-white">
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
                  onClick={() => onBuyUpgrade(u.id)}
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
              onClick={() => onReserveChange(-AETHER_RESERVE_STEP)}
              className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              −{AETHER_RESERVE_STEP}
            </button>
            <button
              aria-label={`Tăng dự trữ ${AETHER_RESERVE_STEP}`}
              disabled={hud.aetherReserve >= AETHER_RESERVE_MAX}
              onClick={() => onReserveChange(AETHER_RESERVE_STEP)}
              className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
            >
              +{AETHER_RESERVE_STEP}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
