/**
 * Fixed-timestep simulation loop, decoupled from React. Simulation advances in
 * constant steps (deterministic feel, stable physics); rendering runs once per
 * animation frame. A capped step count prevents a spiral of death after long
 * frames — excess accumulated time is dropped, not simulated late.
 */
export class GameLoop {
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(
    private readonly step: (dt: number) => void,
    private readonly render: () => void,
    private readonly fixedDt: number = 1 / 60,
    private readonly maxStepsPerFrame: number = 8
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  /** Drop elapsed-time backlog (tab was hidden) so returning never fast-forwards. */
  public resetClock(): void {
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    const dt = Math.min(0.25, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.accumulator += dt;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxStepsPerFrame) {
      this.step(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }
    if (steps === this.maxStepsPerFrame) this.accumulator = 0;

    this.render();
    this.rafId = requestAnimationFrame(this.frame);
  };
}