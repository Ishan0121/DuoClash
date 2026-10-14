/**
 * Pure domain logic for Word Deduction game
 */

export function validateWord(word: string): boolean {
  if (!word || typeof word !== 'string') return false;
  const trimmed = word.trim();
  return trimmed.length >= 1 && trimmed.length <= 12;
}

export function getLetterPositions(word: string, letter: string): number[] {
  const normalizedWord = word.toUpperCase();
  const normalizedLetter = letter.toUpperCase();
  const positions: number[] = [];

  for (let i = 0; i < normalizedWord.length; i++) {
    if (normalizedWord[i] === normalizedLetter) {
      positions.push(i);
    }
  }

  return positions;
}

export function verifyLetterResponse(
  word: string,
  letter: string,
  claimedCount: number,
  claimedPositions: number[]
): { isCorrect: boolean; actualPositions: number[] } {
  const actualPositions = getLetterPositions(word, letter);
  const sortedClaimed = [...claimedPositions].sort((a, b) => a - b);
  const sortedActual = [...actualPositions].sort((a, b) => a - b);

  const isCorrect =
    claimedCount === actualPositions.length &&
    JSON.stringify(sortedClaimed) === JSON.stringify(sortedActual);

  return {
    isCorrect,
    actualPositions,
  };
}

export function isCorrectSolve(guessWord: string, actualWord: string): boolean {
  return guessWord.trim().toUpperCase() === actualWord.trim().toUpperCase();
}
