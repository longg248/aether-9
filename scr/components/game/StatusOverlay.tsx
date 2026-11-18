import { Activity, Hammer, Play, RotateCcw, Sparkles } from 'lucide-react';
import { GameStatus } from '@/types/game';
import { formatTime } from './formatTime';

interface StatusOverlayProps {
  status: GameStatus;
  elapsed: number;
  onStart: () => void;
}

export function StatusOverlay({ status, elapsed, onStart }: StatusOverlayProps) {
  return (
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
            ? `Chúc mừng Chỉ huy! Bạn đã hoàn thành chiến dịch sinh tồn trong ${formatTime(elapsed)} và đưa toàn bộ dữ liệu hành tinh Aether-9 trở về quỹ đạo an toàn.`
            : 'Lõi lò phản ứng đã quá tải trước sức ép của bão từ và sinh vật bản địa. Hãy tái thiết lập hệ thống phòng thủ!'}
        </p>

        <button
          onClick={onStart}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
        >
          {status === 'intro' ? <Play className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
          <span>{status === 'intro' ? 'BẮT ĐẦU NHIỆM VỤ' : 'CHƠI LẠI TỪ ĐẦU'}</span>
        </button>
      </div>
    </div>
  );
}
