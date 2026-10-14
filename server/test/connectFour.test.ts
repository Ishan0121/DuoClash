import { describe, it, expect } from 'vitest';
import {
  findDropRow,
  makeConnectFourMove,
  checkConnectFourWin,
  CONNECT_FOUR_COLS,
  CONNECT_FOUR_ROWS,
} from '../src/games/connectFour.js';

describe('Connect Four Game Logic', () => {
  it('drops piece to bottom of an empty column', () => {
    const board = Array(42).fill(null);
    const dropRow = findDropRow(board, 3);
    expect(dropRow).toBe(5); // Bottom row (index 5)

    const move = makeConnectFourMove(board, 3, 'p1');
    expect(move.valid).toBe(true);
    expect(move.droppedRow).toBe(5);
    expect(move.droppedIndex).toBe(5 * CONNECT_FOUR_COLS + 3);
    expect(move.newBoard[move.droppedIndex]).toBe('p1');
  });

  it('stacks pieces vertically in the same column', () => {
    let board = Array(42).fill(null);
    const move1 = makeConnectFourMove(board, 0, 'p1');
    expect(move1.droppedRow).toBe(5);
    board = move1.newBoard;

    const move2 = makeConnectFourMove(board, 0, 'p2');
    expect(move2.droppedRow).toBe(4);
    board = move2.newBoard;

    const move3 = makeConnectFourMove(board, 0, 'p1');
    expect(move3.droppedRow).toBe(3);
  });

  it('rejects moves in a completely full column', () => {
    const board = Array(42).fill(null);
    for (let r = 0; r < CONNECT_FOUR_ROWS; r++) {
      board[r * CONNECT_FOUR_COLS + 2] = 'p1';
    }

    const move = makeConnectFourMove(board, 2, 'p2');
    expect(move.valid).toBe(false);
  });

  it('detects 4-in-a-row horizontal win', () => {
    const board = Array(42).fill(null);
    // Row 5: cols 0, 1, 2 already p1
    board[5 * CONNECT_FOUR_COLS + 0] = 'p1';
    board[5 * CONNECT_FOUR_COLS + 1] = 'p1';
    board[5 * CONNECT_FOUR_COLS + 2] = 'p1';

    const move = makeConnectFourMove(board, 3, 'p1');
    expect(move.valid).toBe(true);
    expect(move.isWin).toBe(true);
  });

  it('detects 4-in-a-row vertical win', () => {
    const board = Array(42).fill(null);
    // Col 4: rows 5, 4, 3 already p1
    board[5 * CONNECT_FOUR_COLS + 4] = 'p1';
    board[4 * CONNECT_FOUR_COLS + 4] = 'p1';
    board[3 * CONNECT_FOUR_COLS + 4] = 'p1';

    const move = makeConnectFourMove(board, 4, 'p1');
    expect(move.valid).toBe(true);
    expect(move.droppedRow).toBe(2);
    expect(move.isWin).toBe(true);
  });

  it('detects diagonal win', () => {
    const board = Array(42).fill(null);
    // Diagonal down-right:
    // (r0, c0), (r1, c1), (r2, c2), (r3, c3)
    board[0 * CONNECT_FOUR_COLS + 0] = 'p1';
    board[1 * CONNECT_FOUR_COLS + 1] = 'p1';
    board[2 * CONNECT_FOUR_COLS + 2] = 'p1';
    board[3 * CONNECT_FOUR_COLS + 3] = 'p1';

    expect(checkConnectFourWin(board, 'p1')).toBe(true);
    expect(checkConnectFourWin(board, 'p2')).toBe(false);
  });
});
