import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AetherGame from '@/components/game/AetherGame';
import { AetherGameEngine } from '@/engine/gameEngine';
import { OBJECTIVES } from '@/engine/systems/objectiveSystem';

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

describe('AetherGame: objective card reflects engine state', () => {
  it('shows the active objective, its progress and the POI discovery chip', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    engine.stormTimer = 500; // keep timers out of the assertions

    expect(await screen.findByText('Khảo sát bề mặt')).toBeTruthy();
    expect(screen.getByText('MỤC TIÊU 1/7')).toBeTruthy();
    expect(screen.getByText('0/3')).toBeTruthy(); // progress/target from engine state
    expect(screen.getByText(`0/${engine.pois.length}`)).toBeTruthy(); // POI chip

    engine.pois[0].discovered = true;
    engine.pois[1].discovered = true;
    await waitFor(() => expect(screen.getByText('2/3')).toBeTruthy());
    expect(screen.getByText(`2/${engine.pois.length}`)).toBeTruthy();
  });

  it('completion advances the card and grants the reward exactly once', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    engine.stormTimer = 500;
    await screen.findByText('Khảo sát bề mặt');

    const silBefore = engine.resources.silicate;
    for (let i = 0; i < 3; i++) engine.pois[i].discovered = true;

    await waitFor(() => expect(screen.getByText('MỤC TIÊU 2/7')).toBeTruthy());
    expect(screen.getByText('Khôi phục liên lạc')).toBeTruthy();
    expect(engine.resources.silicate).toBe(silBefore + 50);

    // Keep the condition satisfied: the reward must never fire again.
    await new Promise((r) => setTimeout(r, 250));
    expect(engine.resources.silicate).toBe(silBefore + 50);
    expect(engine.objectiveIndex).toBe(1);
  });

  it('shows a compact completion chip when the whole chain is done', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    engine.stormTimer = 500;
    engine.objectiveIndex = OBJECTIVES.length;

    expect(await screen.findByText('Mục tiêu: 7/7 hoàn thành')).toBeTruthy();
    expect(screen.queryByText('MỤC TIÊU 1/7')).toBeNull();
  });

  it('restart restores the objective card to the first milestone', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    engine.stormTimer = 500;
    engine.objectiveIndex = 3;
    await screen.findByText('MỤC TIÊU 4/7');

    engine.status = 'gameover';
    const restartBtn = await screen.findByText('CHƠI LẠI TỪ ĐẦU', undefined, { timeout: 2000 });
    fireEvent.click(restartBtn);

    expect(engine.objectiveIndex).toBe(0);
    expect(await screen.findByText('MỤC TIÊU 1/7')).toBeTruthy();
    expect(screen.getByText('Khảo sát bề mặt')).toBeTruthy();
  });
});

describe('AetherGame: incoming wave warning', () => {
  it('the wave timer pulses red only when the next wave is imminent', async () => {
    render(<AetherGame />);
    startGame();
    const engine = getEngine();
    engine.stormTimer = 500;
    await screen.findByText('Khảo sát bề mặt');

    const calm = screen.getByText(`${Math.ceil(engine.waveTimer)}s`);
    expect(calm.className).not.toContain('animate-pulse');

    engine.waveTimer = 8;
    await waitFor(() => {
      const imminent = screen.getByText('8s');
      expect(imminent.className).toContain('animate-pulse');
      expect(imminent.className).toContain('text-rose-400');
    });
  });
});