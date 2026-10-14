import { describe, it, expect } from 'vitest';
import { makeTicTacToeMove } from '../src/games/ticTacToe.js';

describe('Tic-Tac-Toe Game Logic', () => {
  it('allows valid moves on empty cells', () => {
    const board = Array(9).fill(null);
    const result = makeTicTacToeMove(board, 4, 'p1');

    expect(result.valid).toBe(true);
    expect(result.newBoard[4]).toBe('p1');
    expect(result.isWin).toBe(false);
    expect(result.isDraw).toBe(false);
  });

  it('rejects moves on occupied cells', () => {
    const board = Array(9).fill(null);
    board[4] = 'p1';
    const result = makeTicTacToeMove(board, 4, 'p2');

    expect(result.valid).toBe(false);
  });

  it('detects row win', () => {
    const board = ['p1', 'p1', null, null, null, null, null, null, null];
    const result = makeTicTacToeMove(board, 2, 'p1');

    expect(result.valid).toBe(true);
    expect(result.isWin).toBe(true);
    expect(result.winningPattern).toEqual([0, 1, 2]);
  });

  it('detects diagonal win', () => {
    const board = ['p1', null, null, null, 'p1', null, null, null, null];
    const result = makeTicTacToeMove(board, 8, 'p1');

    expect(result.valid).toBe(true);
    expect(result.isWin).toBe(true);
    expect(result.winningPattern).toEqual([0, 4, 8]);
  });

  it('detects draw when full board with no 3-in-a-row', () => {
    // X O X
    // X X O
    // O X O
    const board = [
      'p1', 'p2', 'p1',
      'p1', 'p1', 'p2',
      'p2', null, 'p2',
    ];
    // p1 places at index 7 -> 'O' or 'X'? Let's check:
    // row 0: p1, p2, p1
    // row 1: p1, p1, p2
    // row 2: p2, p1, p2
    // cols: (p1, p1, p2), (p2, p1, p1), (p1, p2, p2)
    // diags: (p1, p1, p2), (p1, p1, p2)
    // No 3 in a row!
    const result = makeTicTacToeMove(board, 7, 'p1');

    expect(result.valid).toBe(true);
    expect(result.isWin).toBe(false);
    expect(result.isDraw).toBe(true);
  });
});
