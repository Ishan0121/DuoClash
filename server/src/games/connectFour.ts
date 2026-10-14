export const CONNECT_FOUR_ROWS = 6;
export const CONNECT_FOUR_COLS = 7;
export const CONNECT_FOUR_TOTAL_CELLS = CONNECT_FOUR_ROWS * CONNECT_FOUR_COLS;

export interface ConnectFourMoveResult {
  valid: boolean;
  newBoard: (string | null)[];
  droppedRow: number;
  droppedIndex: number;
  isWin: boolean;
  isDraw: boolean;
}

export function findDropRow(board: (string | null)[], column: number): number {
  if (column < 0 || column >= CONNECT_FOUR_COLS) return -1;
  for (let r = CONNECT_FOUR_ROWS - 1; r >= 0; r--) {
    if (board[r * CONNECT_FOUR_COLS + column] === null) {
      return r;
    }
  }
  return -1;
}

export function checkConnectFourWin(board: (string | null)[], playerId: string): boolean {
  const b = board;
  const p = playerId;
  const cols = CONNECT_FOUR_COLS;

  // Horizontal check
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        b[r * cols + c] === p &&
        b[r * cols + c + 1] === p &&
        b[r * cols + c + 2] === p &&
        b[r * cols + c + 3] === p
      ) {
        return true;
      }
    }
  }

  // Vertical check
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < cols; c++) {
      if (
        b[r * cols + c] === p &&
        b[(r + 1) * cols + c] === p &&
        b[(r + 2) * cols + c] === p &&
        b[(r + 3) * cols + c] === p
      ) {
        return true;
      }
    }
  }

  // Diagonal down-right check
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      if (
        b[r * cols + c] === p &&
        b[(r + 1) * cols + c + 1] === p &&
        b[(r + 2) * cols + c + 2] === p &&
        b[(r + 3) * cols + c + 3] === p
      ) {
        return true;
      }
    }
  }

  // Diagonal down-left check
  for (let r = 0; r < 3; r++) {
    for (let c = 3; c < cols; c++) {
      if (
        b[r * cols + c] === p &&
        b[(r + 1) * cols + c - 1] === p &&
        b[(r + 2) * cols + c - 2] === p &&
        b[(r + 3) * cols + c - 3] === p
      ) {
        return true;
      }
    }
  }

  return false;
}

export function makeConnectFourMove(
  board: (string | null)[],
  column: number,
  playerId: string
): ConnectFourMoveResult {
  const targetRow = findDropRow(board, column);
  if (targetRow === -1) {
    return {
      valid: false,
      newBoard: board,
      droppedRow: -1,
      droppedIndex: -1,
      isWin: false,
      isDraw: false,
    };
  }

  const droppedIndex = targetRow * CONNECT_FOUR_COLS + column;
  const newBoard = [...board];
  newBoard[droppedIndex] = playerId;

  const isWin = checkConnectFourWin(newBoard, playerId);
  const isDraw = !isWin && !newBoard.includes(null);

  return {
    valid: true,
    newBoard,
    droppedRow: targetRow,
    droppedIndex,
    isWin,
    isDraw,
  };
}
