import { Play, Save, Trash2 } from 'lucide-react';
import { SettingsPanel, SettingsPanelProps } from './SettingsPanel';

interface PauseOverlayProps {
  notice: string | null;
  settings: SettingsPanelProps;
  onResume: () => void;
  onSave: () => void;
  onDelete: () => void;
}

export function PauseOverlay({ notice, settings, onResume, onSave, onDelete }: PauseOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/75 p-6 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/95 p-6 text-center shadow-2xl">
        <h2 className="text-xl font-black tracking-wide text-white">TẠM DỪNG</h2>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={onResume}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-500"
          >
            <Play className="h-4 w-4" />
            Tiếp tục
          </button>
          <button
            type="button"
            onClick={onSave}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white hover:bg-purple-500"
          >
            <Save className="h-4 w-4" />
            Lưu
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-rose-300 hover:bg-slate-700"
          >
            <Trash2 className="h-4 w-4" />
            Xóa dữ liệu
          </button>
        </div>
        {notice && <p role="status" className="mt-3 text-xs text-emerald-300">{notice}</p>}
        <SettingsPanel {...settings} />
      </div>
    </div>
  );
}
