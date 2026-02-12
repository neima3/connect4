export type Player = 'red' | 'yellow';
export type GameMode = 'menu' | 'local' | 'ai' | 'online';
export type GameStateStatus = 'waiting' | 'playing' | 'won' | 'draw';

export interface GameState {
  board: (Player | null)[][];
  currentPlayer: Player;
  winner: Player | null;
  isDraw: boolean;
  isGameOver: boolean;
  moveCount: number;
  status: GameStateStatus;
}

export interface Room {
  code: string;
  players: string[];
  gameStarted: boolean;
  createdAt: Date;
}

export interface Move {
  column: number;
  player: Player;
  timestamp: number;
  position?: {
    row: number;
    col: number;
  };
}

export interface Position {
  row: number;
  col: number;
}

export interface OnlineGame {
  code: string;
  gameState: GameState;
  playerNumber: 1 | 2;
  isMyTurn: boolean;
}
