import { HudSnapshot } from '@/types/game';

export function BossHealthBar({ hud }: { hud: HudSnapshot }) {
  return (
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
  );
}
