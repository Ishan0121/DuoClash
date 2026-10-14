import { describe, it, expect } from 'vitest';
import { drawLineAndClaimBoxes, checkDotsGameOver } from '../src/games/dotsAndBoxes.js';

describe('Dots and Boxes Game Logic', () => {
  it('allows drawing a new line without claiming a box', () => {
    const result = drawLineAndClaimBoxes([], {}, 'h-0-0', 3, 'player1');
    expect(result.alreadyDrawn).toBe(false);
    expect(result.newLines).toContain('h-0-0');
    expect(result.boxesCompleted).toBe(0);
    expect(result.newBoxes).toEqual({});
  });

  it('rejects duplicate line drawing', () => {
    const result = drawLineAndClaimBoxes(['h-0-0'], {}, 'h-0-0', 3, 'player1');
    expect(result.alreadyDrawn).toBe(true);
    expect(result.boxesCompleted).toBe(0);
  });

  it('claims a single box when the 4th surrounding edge is drawn', () => {
    // Box (0,0) edges: top: h-0-0, bottom: h-1-0, left: v-0-0, right: v-0-1
    const currentLines = ['h-0-0', 'h-1-0', 'v-0-0'];
    const result = drawLineAndClaimBoxes(currentLines, {}, 'v-0-1', 3, 'player1');

    expect(result.boxesCompleted).toBe(1);
    expect(result.newBoxes['0-0']).toBe('player1');
  });

  it('claims two boxes simultaneously when a shared edge closes both', () => {
    // Box (0,0) and Box (0,1) sharing vertical line v-0-1
    // Box (0,0) already has h-0-0, h-1-0, v-0-0
    // Box (0,1) already has h-0-1, h-1-1, v-0-2
    const currentLines = [
      'h-0-0', 'h-1-0', 'v-0-0', // 3 edges of box 0-0
      'h-0-1', 'h-1-1', 'v-0-2', // 3 edges of box 0-1
    ];

    // Drawing shared line v-0-1 should complete BOTH box 0-0 and box 0-1
    const result = drawLineAndClaimBoxes(currentLines, {}, 'v-0-1', 3, 'player2');
    expect(result.boxesCompleted).toBe(2);
    expect(result.newBoxes['0-0']).toBe('player2');
    expect(result.newBoxes['0-1']).toBe('player2');
  });

  it('correctly calculates game over and winner', () => {
    // 2x2 grid -> 4 boxes total
    const boxes = {
      '0-0': 'p1',
      '0-1': 'p1',
      '1-0': 'p2',
      '1-1': 'p1',
    };

    const result = checkDotsGameOver(boxes, 2, ['p1', 'p2']);
    expect(result.isOver).toBe(true);
    expect(result.winnerId).toBe('p1');
    expect(result.scores['p1']).toBe(3);
    expect(result.scores['p2']).toBe(1);
  });

  it('detects a draw when box scores are tied', () => {
    const boxes = {
      '0-0': 'p1',
      '0-1': 'p2',
    };

    // 1x2 grid or 2 boxes claimed in 2-total game
    // If gridSize=1, totalBoxes=1 (not 2). Let's simulate gridSize: Math.sqrt(2)? For gridSize=2 (total 4), if only 2 claimed, isOver is false
    const notOver = checkDotsGameOver(boxes, 2, ['p1', 'p2']);
    expect(notOver.isOver).toBe(false);

    // Now full 2x2 with equal 2 and 2
    const tiedBoxes = {
      '0-0': 'p1',
      '0-1': 'p2',
      '1-0': 'p1',
      '1-1': 'p2',
    };
    const tied = checkDotsGameOver(tiedBoxes, 2, ['p1', 'p2']);
    expect(tied.isOver).toBe(true);
    expect(tied.winnerId).toBe('draw');
  });
});
