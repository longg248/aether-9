import { MapPin, Radio, Target } from 'lucide-react';
import { HudSnapshot } from '@/types/game';

export function ObjectivePanel({ hud }: { hud: HudSnapshot }) {
  return (
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
  );
}
