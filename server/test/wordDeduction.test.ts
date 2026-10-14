import { describe, it, expect } from 'vitest';
import {
  validateWord,
  getLetterPositions,
  verifyLetterResponse,
  isCorrectSolve,
} from '../src/games/wordDeduction.js';

describe('Word Deduction Game Logic', () => {
  it('validates words correctly', () => {
    expect(validateWord('CAT')).toBe(true);
    expect(validateWord('A')).toBe(true);
    expect(validateWord('ABCDEFGHIJKL')).toBe(true); // 12 chars
    expect(validateWord('ABCDEFGHIJKLM')).toBe(false); // 13 chars
    expect(validateWord('')).toBe(false);
    expect(validateWord('   ')).toBe(false);
  });

  it('finds letter positions accurately with case-insensitivity', () => {
    expect(getLetterPositions('BANANA', 'A')).toEqual([1, 3, 5]);
    expect(getLetterPositions('banana', 'a')).toEqual([1, 3, 5]);
    expect(getLetterPositions('HELLO', 'L')).toEqual([2, 3]);
    expect(getLetterPositions('WORLD', 'Z')).toEqual([]);
  });

  it('validates letter verification response honestly', () => {
    // Honest response
    const honest = verifyLetterResponse('PLANET', 'E', 1, [4]);
    expect(honest.isCorrect).toBe(true);
    expect(honest.actualPositions).toEqual([4]);

    // Liar response: says count 0 when letter is present
    const liar1 = verifyLetterResponse('PLANET', 'E', 0, []);
    expect(liar1.isCorrect).toBe(false);
    expect(liar1.actualPositions).toEqual([4]);

    // Liar response: says wrong index
    const liar2 = verifyLetterResponse('PLANET', 'E', 1, [2]);
    expect(liar2.isCorrect).toBe(false);
    expect(liar2.actualPositions).toEqual([4]);

    // Multiple occurrences
    const multi = verifyLetterResponse('APPLE', 'P', 2, [1, 2]);
    expect(multi.isCorrect).toBe(true);
  });

  it('checks solve attempts with case-insensitivity', () => {
    expect(isCorrectSolve('galaxy', 'GALAXY')).toBe(true);
    expect(isCorrectSolve(' GALAXY ', 'galaxy')).toBe(true);
    expect(isCorrectSolve('cosmos', 'galaxy')).toBe(false);
  });
});
