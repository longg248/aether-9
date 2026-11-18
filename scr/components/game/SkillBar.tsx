import { Cpu, Flame, Wrench } from 'lucide-react';
import { HudSnapshot } from '@/types/game';

interface SkillBarProps {
  hud: HudSnapshot;
  showTech: boolean;
  onDash: () => void;
  onEmp: () => void;
  onOvercharge: () => void;
  onQuickRepair: () => void;
  onToggleTech: () => void;
}

export function SkillBar({
  hud,
  showTech,
  onDash,
  onEmp,
  onOvercharge,
  onQuickRepair,
  onToggleTech,
}: SkillBarProps) {
  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/90 px-3 py-2 shadow-xl backdrop-blur-md">
      <button
        onClick={onDash}
        disabled={hud.skills.dashCd > 0}
        className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-950/60 px-2.5 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-900/70 disabled:opacity-45"
      >
        <span>[Space] Lướt Ion</span>
        {hud.skills.dashCd > 0 && <span className="font-mono text-sky-400">{hud.skills.dashCd}s</span>}
      </button>

      <button
        onClick={onEmp}
        disabled={hud.skills.empCd > 0}
        className="flex items-center gap-1.5 rounded-lg border border-purple-500/40 bg-purple-950/60 px-2.5 py-1 text-xs font-semibold text-purple-200 hover:bg-purple-900/70 disabled:opacity-45"
      >
        <span>[Q] Xung EMP</span>
        {hud.skills.empCd > 0 && <span className="font-mono text-purple-400">{hud.skills.empCd}s</span>}
      </button>

      <button
        onClick={onOvercharge}
        disabled={hud.skills.overchargeCd > 0}
        className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-900/70 disabled:opacity-45"
      >
        <Flame className="h-3.5 w-3.5 text-amber-400" />
        <span>[E] Quá Tải</span>
        {hud.skills.overchargeCd > 0 && <span className="font-mono text-amber-400">{hud.skills.overchargeCd}s</span>}
      </button>

      <div className="h-4 w-px bg-slate-800" />

      <button
        onClick={onQuickRepair}
        className="flex items-center gap-1.5 rounded-lg border border-teal-500/40 bg-teal-950/60 px-2.5 py-1 text-xs font-semibold text-teal-200 hover:bg-teal-900/70"
      >
        <Wrench className="h-3.5 w-3.5 text-teal-400" />
        <span>[R] Sửa Nhanh (20 Sil, 15 Sắt)</span>
      </button>

      <button
        onClick={onToggleTech}
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
  );
}
