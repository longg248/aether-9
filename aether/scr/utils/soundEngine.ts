class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(
    freq: number,
    endFreq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.08
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), ctx.currentTime + duration);

      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Ignore audio policy restrictions before user gesture
    }
  }

  public mine(isCrit: boolean): void {
    this.playTone(isCrit ? 620 : 340, isCrit ? 980 : 180, 0.11, isCrit ? 'triangle' : 'sawtooth', 0.06);
  }

  public build(): void {
    this.playTone(220, 520, 0.16, 'triangle', 0.09);
  }

  public laser(): void {
    this.playTone(880, 210, 0.09, 'sawtooth', 0.045);
  }

  public emp(): void {
    this.playTone(420, 48, 0.45, 'sawtooth', 0.12);
  }

  public dash(): void {
    this.playTone(180, 640, 0.2, 'sine', 0.08);
  }

  public pickup(): void {
    this.playTone(520, 1040, 0.25, 'sine', 0.09);
  }

  public storm(): void {
    this.playTone(95, 42, 0.55, 'sawtooth', 0.11);
  }

  public bossAlert(): void {
    this.playTone(150, 75, 0.65, 'sawtooth', 0.13);
  }
}

export const soundEngine = new SoundEngine();