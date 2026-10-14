import { Mine, RevealedBlock } from '../types/index.js';

export interface OpenBlockResult {
  alreadyRevealed: boolean;
  type?: 'treasure' | 'bomb' | 'empty';
  row?: number;
  col?: number;
  isWin?: boolean;
  isBomb?: boolean;
  newRevealed?: RevealedBlock[];
}

export function openBlock(
  opponentMines: Mine[],
  currentRevealed: RevealedBlock[],
  index: number,
  gridSize: number
): OpenBlockResult {
  if (currentRevealed.some((r) => r.index === index)) {
    return { alreadyRevealed: true };
  }

  const mineAtBlock = opponentMines.find((m) => m.index === index);
  const type: 'treasure' | 'bomb' | 'empty' = mineAtBlock ? mineAtBlock.type : 'empty';

  const newRevealed = [...currentRevealed, { index, type }];
  const row = Math.floor(index / gridSize);
  const col = index % gridSize;

  const totalOpponentTreasures = opponentMines.filter((m) => m.type === 'treasure').length;
  const myFoundTreasures = newRevealed.filter((r) => r.type === 'treasure').length;

  const isWin = totalOpponentTreasures > 0 && myFoundTreasures === totalOpponentTreasures;
  const isBomb = type === 'bomb';

  return {
    alreadyRevealed: false,
    type,
    row,
    col,
    isWin,
    isBomb,
    newRevealed,
  };
}
