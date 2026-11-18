import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AetherGame from '@/components/game/AetherGame';
import { AetherGameEngine } from '@/engine/gameEngine';
import { SAVE_STORAGE_KEYS } from '@/components/game/persistenceStorage';
import { TUTORIAL_STORAGE_KEY } from '@/components/game/settingsStorage';
import { soundEngine } from '@/utils/soundEngine';

let resetSpy: ReturnType<typeof vi.spyOn>;
const getEngine = () => resetSpy.mock.contexts.at(-1) as AetherGameEngine;

function clickNewGame() {
  fireEvent.click(screen.getByText('BẮT ĐẦU NHIỆM VỤ'));
}

function startWithoutTutorial() {
  clickNewGame();
  const skip = screen.queryByText('Bỏ qua');
  if (skip) fireEvent.click(skip);
}

beforeEach(() => {
  window.localStorage.clear();
  soundEngine.muted = false;
  soundEngine.setMasterVolume(1);
  resetSpy = vi.spyOn(AetherGameEngine.prototype, 'reset');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('AetherGame: save/load controls', () => {
  it('manual saves while paused and continues the latest save on a fresh mount', () => {
    const first = render(<AetherGame />);
    startWithoutTutorial();
    const engine = getEngine();
    engine.elapsed = 123;
    engine.resources.silicate = 777;

    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    expect(screen.getByText('TẠM DỪNG')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(window.localStorage.getItem(SAVE_STORAGE_KEYS.manual)).toBeTruthy();
    first.unmount();

    render(<AetherGame />);
    const continueButton = screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton);

    const restored = getEngine();
    expect(restored.status).toBe('playing');
    expect(restored.elapsed).toBe(123);
    expect(restored.resources.silicate).toBe(777);
  });

  it('autosaves after 30 seconds of active play', () => {
    vi.useFakeTimers();
    render(<AetherGame />);
    startWithoutTutorial();
    const engine = getEngine();
    engine.elapsed = 42;

    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(window.localStorage.getItem(SAVE_STORAGE_KEYS.autosave)).toBeTruthy();
    const saved = JSON.parse(window.localStorage.getItem(SAVE_STORAGE_KEYS.autosave)!) as { elapsed: number };
    expect(saved.elapsed).toBeGreaterThanOrEqual(42);
  });

  it('deletes both save slots and disables continue on the next intro', () => {
    const first = render(<AetherGame />);
    startWithoutTutorial();
    fireEvent.click(screen.getByRole('button', { name: 'Tạm dừng' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    window.localStorage.setItem(SAVE_STORAGE_KEYS.autosave, window.localStorage.getItem(SAVE_STORAGE_KEYS.manual)!);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa dữ liệu' }));

    expect(window.localStorage.getItem(SAVE_STORAGE_KEYS.manual)).toBeNull();
    expect(window.localStorage.getItem(SAVE_STORAGE_KEYS.autosave)).toBeNull();
    first.unmount();
    render(<AetherGame />);
    expect((screen.getByRole('button', { name: 'Tiếp tục' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('AetherGame: persisted settings and tutorial', () => {
  it('restores mute, master volume, and default speed on a fresh mount', () => {
    const first = render(<AetherGame />);
    fireEvent.change(screen.getByRole('slider', { name: 'Âm lượng tổng' }), { target: { value: '0.35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tắt âm' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tốc độ mặc định 2x' }));
    expect(soundEngine.muted).toBe(true);
    expect(soundEngine.masterVolume).toBe(0.35);
    first.unmount();

    render(<AetherGame />);
    expect((screen.getByRole('slider', { name: 'Âm lượng tổng' }) as HTMLInputElement).value).toBe('0.35');
    expect(screen.getByRole('button', { name: 'Bật âm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tốc độ mặc định 2x' }).getAttribute('aria-pressed')).toBe('true');
    startWithoutTutorial();
    expect(getEngine().speed).toBe(2);
  });

  it('shows four tutorial steps once and remembers dismissal', () => {
    const first = render(<AetherGame />);
    clickNewGame();
    expect(screen.getByText('Di chuyển Rover')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    expect(screen.getByText('Khai khoáng')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    expect(screen.getByText('Xây dựng')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
    expect(screen.getByText('Mục tiêu')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu' }));

    expect(screen.queryByText('Di chuyển Rover')).toBeNull();
    expect(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)).toBe('1');
    first.unmount();
    render(<AetherGame />);
    clickNewGame();
    expect(screen.queryByText('Di chuyển Rover')).toBeNull();
  });
});
