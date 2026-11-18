import { BUILDING_LIST } from '@/constants/gameConfig';
import { BuildingType, HudSnapshot } from '@/types/game';

interface BuildDockProps {
  hud: HudSnapshot;
  selectedBuild: BuildingType | null;
  onSelectBuild: (type: BuildingType) => void;
}

export function BuildDock({ hud, selectedBuild, onSelectBuild }: BuildDockProps) {
  return (
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
            onClick={() => onSelectBuild(b.id)}
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
  );
}
