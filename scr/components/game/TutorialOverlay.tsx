const TUTORIAL_STEPS = [
  {
    title: 'Di chuyển Rover',
    description: 'Dùng WASD / phím mũi tên hoặc click chuột để di chuyển. Con lăn để thu phóng; giữ chuột phải hoặc giữa để kéo bản đồ.',
  },
  {
    title: 'Khai khoáng',
    description: 'Đưa Rover đến gần mỏ Silicat, Sắt hoặc Aether. Rover sẽ tự động khai thác khi ở trong tầm.',
  },
  {
    title: 'Xây dựng',
    description: 'Chọn công trình bằng phím 1–8 hoặc thanh xây dựng, rồi click vào ô đã khám phá. Máy Khoan phải đặt trực tiếp lên mỏ.',
  },
  {
    title: 'Mục tiêu',
    description: 'Theo dõi thẻ MỤC TIÊU và các POI để nhận thưởng. Bảo vệ Trung tâm và nạp đủ 1.200 Aether cho Động cơ Bước Nhảy.',
  },
] as const;

interface TutorialOverlayProps {
  step: number;
  onNext: () => void;
  onDismiss: () => void;
}

export function TutorialOverlay({ step, onNext, onDismiss }: TutorialOverlayProps) {
  const current = TUTORIAL_STEPS[step];
  if (!current) return null;
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
      <section
        aria-label="Hướng dẫn nhiệm vụ"
        className="w-full max-w-md rounded-3xl border border-sky-500/40 bg-slate-900/95 p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between text-xs font-bold tracking-wider text-sky-300">
          <span>HƯỚNG DẪN NHIỆM VỤ</span>
          <span className="font-mono text-slate-400">{step + 1}/{TUTORIAL_STEPS.length}</span>
        </div>
        <h2 className="mt-4 text-xl font-black text-white">{current.title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">{current.description}</p>
        <div className="mt-6 flex items-center justify-between">
          <button type="button" onClick={onDismiss} className="text-xs text-slate-400 hover:text-white">
            Bỏ qua
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-sky-600 px-5 py-2 text-sm font-bold text-white hover:bg-sky-500"
          >
            {isLast ? 'Bắt đầu' : 'Tiếp'}
          </button>
        </div>
      </section>
    </div>
  );
}
