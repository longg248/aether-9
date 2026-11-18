export interface SettingsPanelProps {
  muted: boolean;
  masterVolume: number;
  defaultSpeed: 1 | 2;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onDefaultSpeedChange: (speed: 1 | 2) => void;
}

export function SettingsPanel({
  muted,
  masterVolume,
  defaultSpeed,
  onToggleMute,
  onVolumeChange,
  onDefaultSpeedChange,
}: SettingsPanelProps) {
  return (
    <section className="mt-5 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-left" aria-label="Cài đặt">
      <h2 className="text-xs font-bold tracking-wider text-slate-300">CÀI ĐẶT</h2>
      <div className="mt-3 flex items-center justify-between gap-3">
        <label htmlFor="master-volume" className="text-xs text-slate-400">Âm lượng tổng</label>
        <div className="flex items-center gap-2">
          <input
            id="master-volume"
            aria-label="Âm lượng tổng"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={masterVolume}
            onChange={(event) => onVolumeChange(Number(event.target.value))}
            className="w-28 accent-sky-500"
          />
          <span className="w-9 font-mono text-xs text-slate-300">{Math.round(masterVolume * 100)}%</span>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">Âm thanh</span>
        <button
          type="button"
          aria-pressed={muted}
          onClick={onToggleMute}
          className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-slate-200 hover:bg-slate-700"
        >
          {muted ? 'Bật âm' : 'Tắt âm'}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-400">Tốc độ mặc định</span>
        <div className="flex gap-1">
          {([1, 2] as const).map((speed) => (
            <button
              key={speed}
              type="button"
              aria-label={`Tốc độ mặc định ${speed}x`}
              aria-pressed={defaultSpeed === speed}
              onClick={() => onDefaultSpeedChange(speed)}
              className={`rounded-lg px-3 py-1 text-xs font-bold ${
                defaultSpeed === speed ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {speed}x
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
