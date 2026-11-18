import { afterEach, describe, expect, it, vi } from 'vitest';
import { soundEngine } from '@/utils/soundEngine';

afterEach(() => {
  vi.unstubAllGlobals();
  soundEngine.muted = false;
  soundEngine.setMasterVolume(1);
});

describe('soundEngine master volume', () => {
  it('multiplies tone gain by the configured master volume', () => {
    const setValueAtTime = vi.fn();
    const gain = {
      gain: { setValueAtTime, exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    };
    const oscillator = {
      type: 'sine',
      frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const context = {
      state: 'running',
      currentTime: 2,
      destination: {},
      createGain: () => gain,
      createOscillator: () => oscillator,
    };
    vi.stubGlobal('AudioContext', function FakeAudioContext() {
      return context;
    });
    soundEngine.setMasterVolume(0.5);

    soundEngine.playTone(220, 110, 0.2, 'sine', 0.2);
    expect(setValueAtTime).toHaveBeenCalledWith(0.1, 2);

    setValueAtTime.mockClear();
    soundEngine.setMasterVolume(0);
    soundEngine.playTone(220, 110, 0.2, 'sine', 0.2);
    expect(setValueAtTime).not.toHaveBeenCalled();
  });
});
