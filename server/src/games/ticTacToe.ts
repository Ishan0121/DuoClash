export const TIC_TAC_TOE_WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export interface TicTacToeMoveResult {
  valid: boolean;
  newBoard: (string | null)[];
  isWin: boolean;
  isDraw: boolean;
  winningPattern?: number[];
}

export function makeTicTacToeMove(
  board: (string | null)[],
  index: number,
  playerId: string
): TicTacToeMoveResult {
  if (index < 0 || index > 8 || board[index] !== null) {
    return {
      valid: false,
      newBoard: board,
      isWin: false,
      isDraw: false,
    };
  }

  const newBoard = [...board];
  newBoard[index] = playerId;

  for (const pattern of TIC_TAC_TOE_WIN_PATTERNS) {
    const [a, b, c] = pattern;
    if (newBoard[a] === playerId && newBoard[b] === playerId && newBoard[c] === playerId) {
      return {
        valid: true,
        newBoard,
        isWin: true,
        isDraw: false,
        winningPattern: pattern,
      };
    }
  }

  const isDraw = newBoard.every((cell) => cell !== null);

  return {
    valid: true,
    newBoard,
    isWin: false,
    isDraw,
  };
}
