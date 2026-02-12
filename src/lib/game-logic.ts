import { Player, GameState, Position } from '@/types/game';

export const ROWS = 6;
export const COLS = 7;
export const WINNING_LENGTH = 4;

export function createEmptyBoard(): (Player | null)[][] {
  return Array(ROWS)
    .fill(null)
    .map(() => Array(COLS).fill(null));
}

export function createInitialGameState(): GameState {
  return {
    board: createEmptyBoard(),
    currentPlayer: 'red',
    winner: null,
    isDraw: false,
    isGameOver: false,
    moveCount: 0,
    status: 'waiting',
    winningLine: null,
  };
}

export function isValidMove(board: (Player | null)[][], col: number): boolean {
  return col >= 0 && col < COLS && board[0][col] === null;
}

export function getValidMoves(board: (Player | null)[][]): number[] {
  return Array.from({ length: COLS }, (_, col) => col).filter((col) =>
    isValidMove(board, col)
  );
}

export function makeMove(
  gameState: GameState,
  col: number
): { gameState: GameState; position: Position | null } {
  if (!isValidMove(gameState.board, col)) {
    return { gameState, position: null };
  }

  const newBoard = gameState.board.map((row) => [...row]);
  const row = Array.from({ length: ROWS }, (_, i) => ROWS - 1 - i).find(
    (r) => newBoard[r][col] === null
  );

  if (row === undefined) {
    return { gameState, position: null };
  }

  newBoard[row][col] = gameState.currentPlayer;

  const newPosition = { row, col };
  const winResult = checkWin(newBoard, newPosition);
  const isDraw = !winResult.isWin && getValidMoves(newBoard).length === 0;

  return {
    gameState: {
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 'red' ? 'yellow' : 'red',
      winner: winResult.isWin ? gameState.currentPlayer : null,
      isDraw,
      isGameOver: winResult.isWin || isDraw,
      moveCount: gameState.moveCount + 1,
      status: winResult.isWin ? 'won' : isDraw ? 'draw' : 'playing',
      winningLine: winResult.winningLine,
    },
    position: newPosition,
  };
}

export function checkWin(
  board: (Player | null)[][],
  lastMove: Position
): { isWin: boolean; winningLine: Position[] | null } {
  const player = board[lastMove.row][lastMove.col];
  if (!player) return { isWin: false, winningLine: null };

  const directions = [
    [0, 1], // horizontal
    [1, 0], // vertical
    [1, 1], // diagonal \
    [1, -1], // diagonal /
  ];

  for (const [dr, dc] of directions) {
    const line: Position[] = [lastMove];
    let count = 1;

    // Check positive direction
    for (let i = 1; i < WINNING_LENGTH; i++) {
      const r = lastMove.row + dr * i;
      const c = lastMove.col + dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) {
        break;
      }
      line.push({ row: r, col: c });
      count++;
    }

    // Check negative direction
    for (let i = 1; i < WINNING_LENGTH; i++) {
      const r = lastMove.row - dr * i;
      const c = lastMove.col - dc * i;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS || board[r][c] !== player) {
        break;
      }
      line.unshift({ row: r, col: c });
      count++;
    }

    if (count >= WINNING_LENGTH) {
      return { isWin: true, winningLine: line };
    }
  }

  return { isWin: false, winningLine: null };
}

export function getAIMove(gameState: GameState): number {
  const validMoves = getValidMoves(gameState.board);

  if (validMoves.length === 0) return -1;

  // Simple AI: try to win, block opponent, or take center columns
  const centerCols = [3, 2, 4, 1, 5, 0, 6];

  // Try to win
  for (const col of validMoves) {
    const testMove = makeMove(gameState, col);
    if (testMove.gameState.winner === 'yellow') {
      return col;
    }
  }

  // Block opponent
  for (const col of validMoves) {
    const testState = {
      ...gameState,
      currentPlayer: 'red' as Player,
    };
    const testMove = makeMove(testState, col);
    if (testMove.gameState.winner === 'red') {
      return col;
    }
  }

  // Prefer center columns
  for (const col of centerCols) {
    if (validMoves.includes(col)) {
      return col;
    }
  }

  return validMoves[0];
}
