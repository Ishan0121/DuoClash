import { describe, it, expect } from 'vitest';
import { openBlock } from '../src/games/minefield.js';
import { Mine, RevealedBlock } from '../src/types/index.js';

describe('Minefield Game Logic', () => {
  const opponentMines: Mine[] = [
    { index: 4, type: 'treasure' },
    { index: 12, type: 'treasure' },
    { index: 7, type: 'bomb' },
  ];

  it('reveals empty block correctly', () => {
    const revealed: RevealedBlock[] = [];
    const result = openBlock(opponentMines, revealed, 0, 5);

    expect(result.alreadyRevealed).toBe(false);
    expect(result.type).toBe('empty');
    expect(result.row).toBe(0);
    expect(result.col).toBe(0);
    expect(result.isWin).toBe(false);
    expect(result.isBomb).toBe(false);
    expect(result.newRevealed).toHaveLength(1);
    expect(result.newRevealed![0]).toEqual({ index: 0, type: 'empty' });
  });

  it('identifies bomb and signals penalty', () => {
    const revealed: RevealedBlock[] = [];
    const result = openBlock(opponentMines, revealed, 7, 5);

    expect(result.isBomb).toBe(true);
    expect(result.type).toBe('bomb');
    expect(result.row).toBe(1);
    expect(result.col).toBe(2);
    expect(result.isWin).toBe(false);
  });

  it('detects win when all opponent treasures are found', () => {
    let revealed: RevealedBlock[] = [];

    // Find 1st treasure
    const step1 = openBlock(opponentMines, revealed, 4, 5);
    expect(step1.isWin).toBe(false);
    expect(step1.type).toBe('treasure');
    revealed = step1.newRevealed!;

    // Find 2nd treasure
    const step2 = openBlock(opponentMines, revealed, 12, 5);
    expect(step2.isWin).toBe(true);
    expect(step2.type).toBe('treasure');
  });

  it('prevents opening an already revealed block', () => {
    const revealed: RevealedBlock = { index: 3, type: 'empty' };
    const result = openBlock(opponentMines, [revealed], 3, 5);

    expect(result.alreadyRevealed).toBe(true);
  });
});
