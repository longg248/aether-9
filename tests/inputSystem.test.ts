import { describe, expect, it, vi } from 'vitest';
import { clearHeldKeys, handleKeyDown, handleKeyUp } from '@/engine/systems/inputSystem';
import { makeEngine, tick } from './helpers';

function makeUi() {
  return {
    onSelectBuild: vi.fn(),
    onToggleTech: vi.fn(),
    onCloseOverlays: vi.fn(),
  };
}

describe('inputSystem: key tracking follows game status', () => {
  it('tracks movement keys while playing and releases on keyup', () => {
    const engine = makeEngine();
    const ui = makeUi();

    handleKeyDown(engine, 'w', ui);
    expect(engine.keys.has('w')).toBe(true);

    handleKeyUp(engine, 'w');
    expect(engine.keys.has('w')).toBe(false);
  });

  it('normalizes key case between keydown and keyup', () => {
    const engine = makeEngine();
    handleKeyDown(engine, 'W', makeUi());
    handleKeyUp(engine, 'w');
    expect(engine.keys.size).toBe(0);
  });

  it.each(['intro', 'victory', 'gameover'] as const)('ignores gameplay keys in %s status', (status) => {
    const engine = makeEngine();
    engine.status = status;
    const ui = makeUi();

    const prevent = handleKeyDown(engine, 'w', ui);
    handleKeyDown(engine, ' ', ui);
    handleKeyDown(engine, 'q', ui);
    handleKeyDown(engine, 't', ui);
    handleKeyDown(engine, '1', ui);

    expect(engine.keys.size).toBe(0);
    expect(prevent).toBe(false);
    expect(engine.rover.dashCooldown).toBe(0);
    expect(engine.rover.empCooldown).toBe(0);
    expect(engine.selectedBuild).toBeNull();
    expect(ui.onToggleTech).not.toHaveBeenCalled();
    expect(ui.onSelectBuild).not.toHaveBeenCalled();
  });

  it('held keys drive rover movement only while playing', () => {
    const engine = makeEngine();
    handleKeyDown(engine, 'd', makeUi());
    const x0 = engine.rover.x;
    tick((dt) => engine.update(dt), 0.5);
    expect(engine.rover.x).toBeGreaterThan(x0);

    engine.status = 'gameover';
    const x1 = engine.rover.x;
    tick((dt) => engine.update(dt), 0.5);
    expect(engine.rover.x).toBe(x1);
  });
});

describe('inputSystem: ability and UI keys', () => {
  it('space triggers dash and requests preventDefault', () => {
    const engine = makeEngine();
    const prevent = handleKeyDown(engine, ' ', makeUi());
    expect(prevent).toBe(true);
    expect(engine.rover.dashCooldown).toBeGreaterThan(0);
  });

  it('escape clears build selection and closes overlays even when not playing', () => {
    const engine = makeEngine();
    engine.status = 'gameover';
    engine.selectedBuild = 'solar';
    const ui = makeUi();

    handleKeyDown(engine, 'Escape', ui);

    expect(engine.selectedBuild).toBeNull();
    expect(ui.onSelectBuild).toHaveBeenCalledWith(null);
    expect(ui.onCloseOverlays).toHaveBeenCalled();
  });

  it('building hotkeys toggle engine and UI selection in sync', () => {
    const engine = makeEngine();
    const ui = makeUi();

    handleKeyDown(engine, '1', ui); // solar
    expect(engine.selectedBuild).toBe('solar');
    expect(ui.onSelectBuild).toHaveBeenLastCalledWith('solar');

    handleKeyDown(engine, '1', ui); // toggle off
    expect(engine.selectedBuild).toBeNull();
    expect(ui.onSelectBuild).toHaveBeenLastCalledWith(null);
  });

  it('t toggles the tech tree only while playing', () => {
    const engine = makeEngine();
    const ui = makeUi();
    handleKeyDown(engine, 't', ui);
    expect(ui.onToggleTech).toHaveBeenCalledTimes(1);
  });
});

describe('inputSystem: focus loss recovery', () => {
  it('clearHeldKeys empties all held keys (blur / tab hide)', () => {
    const engine = makeEngine();
    const ui = makeUi();
    handleKeyDown(engine, 'w', ui);
    handleKeyDown(engine, 'd', ui);

    clearHeldKeys(engine);

    expect(engine.keys.size).toBe(0);
    const x0 = engine.rover.x;
    const y0 = engine.rover.y;
    tick((dt) => engine.update(dt), 0.5);
    expect(engine.rover.x).toBe(x0);
    expect(engine.rover.y).toBe(y0);
  });

  it('keyup for a never-pressed key is harmless', () => {
    const engine = makeEngine();
    handleKeyUp(engine, 'z');
    expect(engine.keys.size).toBe(0);
  });
});