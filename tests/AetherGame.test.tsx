import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AetherGame from '@/components/game/AetherGame';
import { DEFAULT_AETHER_RESERVE } from '@/constants/gameConfig';
import { AetherGameEngine } from '@/engine/gameEngine';

let resetSpy: ReturnType<typeof vi.spyOn>;

const getEngine = () => resetSpy.mock.contexts.at(-1) as AetherGameEngine;

const startGame = () => {
  fireEvent.click(screen.getByText('BẮT ĐẦU NHIỆM VỤ'));
};

beforeEach(() => {
  resetSpy = vi.spyOn(AetherGameEngine.prototype, 'reset');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AetherGame: keyboard / engine synchronization', () => {
  it('ignores gameplay input while the game is not playing', () => {
    render(<AetherGame />);
    const engine = getEngine();

    fireEvent.keyDown(window, { key: 'w' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.keyDown(window, { key: 'q' });

    expect(engine.status).toBe('intro');
    expect(engine.keys.size).toBe(0);
    expect(engine.rover.dashCooldown).toBe(0);
    expect(engine.rover.empCooldown).toBe(0);
  });

  it('clears held keys on window blur', () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();

    fireEvent.keyDown(window, { key: 'w' });
    fireEvent.keyDown(window, { key: 'd' });
    expect(engine.keys.size).toBe(2);

    fireEvent.blur(window);

    expect(engine.keys.size).toBe(0);
  });

  it('clears held keys when the tab becomes hidden', () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();

    fireEvent.keyDown(window, { key: 'w' });
    expect(engine.keys.size).toBe(1);

    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(engine.keys.size).toBe(0);

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    fireEvent(document, new Event('visibilitychange'));
  });

  it('keyup releases keys after focus returns', () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();

    fireEvent.keyDown(window, { key: 'w' });
    fireEvent.blur(window);
    fireEvent.keyDown(window, { key: 'w' });
    fireEvent.keyUp(window, { key: 'w' });

    expect(engine.keys.has('w')).toBe(false);
  });
});

describe('AetherGame: restart resets UI state', () => {
  it('restart clears keys, build selection and tech modal', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();

    fireEvent.keyDown(window, { key: 't' }); // open tech tree
    fireEvent.keyDown(window, { key: '1' }); // select solar
    fireEvent.keyDown(window, { key: 'w' }); // hold movement
    expect(await screen.findByText('CÂY CÔNG NGHỆ AETHER')).toBeTruthy();
    expect(engine.selectedBuild).toBe('solar');

    engine.status = 'gameover';
    const restartBtn = await screen.findByText('CHƠI LẠI TỪ ĐẦU', undefined, { timeout: 2000 });
    fireEvent.click(restartBtn);

    expect(engine.status).toBe('playing');
    expect(engine.keys.size).toBe(0);
    expect(engine.selectedBuild).toBeNull();
    expect(screen.queryByText('CÂY CÔNG NGHỆ AETHER')).toBeNull();
  });
});

describe('AetherGame: warp reserve control in the tech panel', () => {
  const openTech = async () => {
    fireEvent.keyDown(window, { key: 't' });
    expect(await screen.findByText('CÂY CÔNG NGHỆ AETHER')).toBeTruthy();
  };

  it('adjusts the reserve by 25 and applies it immediately to the run', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    await openTech();

    const plus = screen.getByRole('button', { name: 'Tăng dự trữ 25' });
    const minus = screen.getByRole('button', { name: 'Giảm dự trữ 25' });

    fireEvent.click(plus);
    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE + 25);
    expect(screen.getByText('175')).toBeTruthy(); // panel value refreshes at once

    fireEvent.click(minus);
    fireEvent.click(minus);
    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE - 25);
    expect(screen.getByText('125')).toBeTruthy();
  });

  it('disables the controls at the 0 and 500 bounds', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    await openTech();

    const minus = screen.getByRole('button', { name: 'Giảm dự trữ 25' }) as HTMLButtonElement;
    for (let i = 0; i < 6; i++) fireEvent.click(minus); // 150 → 0
    expect(engine.aetherReserve).toBe(0);
    expect(minus.disabled).toBe(true);
    fireEvent.click(minus); // disabled: must not go negative
    expect(engine.aetherReserve).toBe(0);

    const plus = screen.getByRole('button', { name: 'Tăng dự trữ 25' }) as HTMLButtonElement;
    for (let i = 0; i < 20; i++) fireEvent.click(plus); // 0 → 500
    expect(engine.aetherReserve).toBe(500);
    expect(plus.disabled).toBe(true);
    fireEvent.click(plus); // disabled: must not exceed 500
    expect(engine.aetherReserve).toBe(500);
  });

  it('restart restores the default reserve', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    await openTech();

    fireEvent.click(screen.getByRole('button', { name: 'Tăng dự trữ 25' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tăng dự trữ 25' }));
    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE + 50);

    engine.status = 'gameover';
    const restartBtn = await screen.findByText('CHƠI LẠI TỪ ĐẦU', undefined, { timeout: 2000 });
    fireEvent.click(restartBtn);

    expect(engine.aetherReserve).toBe(DEFAULT_AETHER_RESERVE);
  });
});

describe('AetherGame: animation loop and listener lifecycle', () => {
  it('removes every listener and stops the loop on unmount', async () => {
    const winRemove = vi.spyOn(window, 'removeEventListener');
    const docRemove = vi.spyOn(document, 'removeEventListener');
    const updateSpy = vi.spyOn(AetherGameEngine.prototype, 'update');

    const { unmount } = render(<AetherGame />);
    unmount();

    for (const evt of ['keydown', 'keyup', 'blur']) {
      expect(winRemove.mock.calls.some(([name]) => name === evt)).toBe(true);
    }
    expect(docRemove.mock.calls.some(([name]) => name === 'visibilitychange')).toBe(true);

    const callsAtUnmount = updateSpy.mock.calls.length;
    await new Promise((r) => setTimeout(r, 150));
    expect(updateSpy.mock.calls.length).toBe(callsAtUnmount); // no zombie loop
  });

  it('StrictMode double-mount leaves exactly one active loop', async () => {
    const updateSpy = vi.spyOn(AetherGameEngine.prototype, 'update');
    render(
      <StrictMode>
        <AetherGame />
      </StrictMode>
    );
    startGame();
    const engine = getEngine();

    await waitFor(() => expect(updateSpy.mock.calls.length).toBeGreaterThan(5));
    await new Promise((r) => setTimeout(r, 120));

    // Every update call must belong to the surviving (second) engine instance.
    const strayed = updateSpy.mock.contexts.filter((ctx) => ctx !== engine);
    expect(strayed).toHaveLength(0);
    expect(engine.elapsed).toBeGreaterThan(0);
  });
});