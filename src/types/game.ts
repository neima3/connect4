export type Player = 'red' | 'yellow'
export type GameMode = 'menu' | 'local' | 'ai' | 'online'

export interface GameState {
  board: (Player | null)[][]
  currentPlayer: Player
  winner: Player | null
  isDraw: boolean
  isGameOver: boolean
  moveCount: number
}

export interface Room {
  code: string
  players: string[]
  gameStarted: boolean
}

export interface Move {
  column: number
  player: Player
  timestamp: number
}