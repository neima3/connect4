import { GameModel, MoveModel, GameStatsModel } from '@/lib/models';
import { GameData, MoveData } from '@/lib/models';
import { GameMode, Player, GameState } from '@/types/game';
import { makeMove, checkWin, isValidMove } from '@/lib/game-logic';
import { APIError, NotFoundError, ValidationError } from '@/lib/api-utils';

export interface GameCreationOptions {
  mode: GameMode;
  playerRed?: string;
  playerYellow?: string;
}

export interface MoveExecution {
  game: GameData;
  move: MoveData;
  isGameOver: boolean;
  winner: Player | null;
  isDraw: boolean;
  winningLine: { row: number; col: number }[] | null;
}

export interface GameWithMoves extends GameData {
  moves: MoveData[];
}

export class GameService {
  /**
   * Create a new game with optional player names
   */
  static async createGame(options: GameCreationOptions): Promise<GameData> {
    const game = await GameModel.create(options.mode);
    return game;
  }

  /**
   * Get a game with all its moves
   */
  static async getGameWithMoves(gameId: string): Promise<GameWithMoves> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game');
    }

    const moves = await MoveModel.findByGameId(gameId);

    return {
      ...game,
      moves,
    };
  }

  /**
   * Execute a move in a game with full validation and state updates
   */
  static async executeMove(
    gameId: string,
    column: number,
    player: Player
  ): Promise<MoveExecution> {
    // Get current game state
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game');
    }

    // Validate game state
    this.validateMove(game, column, player);

    // Convert to game state format
    const gameState: GameState = {
      board: game.boardState,
      currentPlayer: game.currentPlayer,
      winner: game.winner,
      isDraw: game.isDraw,
      isGameOver: game.isGameOver,
      moveCount: game.moveCount,
      status: game.status,
      winningLine: game.winningLine,
    };

    // Execute move
    const moveResult = makeMove(gameState, column);
    if (!moveResult.position) {
      throw new ValidationError('Invalid move');
    }

    // Create move record
    const move = await MoveModel.create(
      gameId,
      column,
      player,
      moveResult.position.row
    );

    // Update game state
    const updatedGame = await GameModel.update(gameId, {
      status: moveResult.gameState.status,
      currentPlayer: moveResult.gameState.currentPlayer,
      winner: moveResult.gameState.winner,
      isDraw: moveResult.gameState.isDraw,
      isGameOver: moveResult.gameState.isGameOver,
      moveCount: moveResult.gameState.moveCount,
      boardState: moveResult.gameState.board,
      winningLine: moveResult.gameState.winningLine,
      finishedAt: moveResult.gameState.isGameOver ? new Date() : undefined,
    });

    if (!updatedGame) {
      throw new APIError('Failed to update game state', 500);
    }

    // Create stats if game is over
    if (moveResult.gameState.isGameOver) {
      const gameDuration = Math.floor(
        (new Date().getTime() - game.createdAt.getTime()) / 1000
      );

      await GameStatsModel.create(
        gameId,
        null, // playerRed - would be set for online games
        null, // playerYellow - would be set for online games
        moveResult.gameState.winner,
        moveResult.gameState.moveCount,
        gameDuration,
        game.mode
      );
    }

    return {
      game: updatedGame,
      move,
      isGameOver: moveResult.gameState.isGameOver,
      winner: moveResult.gameState.winner,
      isDraw: moveResult.gameState.isDraw,
      winningLine: moveResult.gameState.winningLine,
    };
  }

  /**
   * Validate a move against game rules and current state
   */
  private static validateMove(
    game: GameData,
    column: number,
    player: Player
  ): void {
    if (game.isGameOver) {
      throw new ValidationError('Game is already over');
    }

    if (game.currentPlayer !== player) {
      throw new ValidationError('Not your turn');
    }

    if (!isValidMove(game.boardState, column)) {
      throw new ValidationError(
        'Invalid move - column is full or out of bounds'
      );
    }

    if (column < 0 || column > 6) {
      throw new ValidationError('Column must be between 0 and 6');
    }
  }

  /**
   * Get games by various filters
   */
  static async getGames(filters: {
    mode?: GameMode;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<GameData[]> {
    const { mode, status, limit = 50, offset = 0 } = filters;

    if (mode) {
      return GameModel.findByMode(mode);
    } else if (status) {
      return GameModel.findByStatus(status as any);
    } else {
      return GameModel.findAll(limit);
    }
  }

  /**
   * Delete a game and all its data
   */
  static async deleteGame(gameId: string): Promise<boolean> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game');
    }

    // Delete moves first
    await MoveModel.deleteByGameId(gameId);

    // Delete the game
    return GameModel.delete(gameId);
  }

  /**
   * Get game statistics for a specific game
   */
  static async getGameStats(gameId: string) {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game');
    }

    const moves = await MoveModel.findByGameId(gameId);

    return {
      game,
      moveCount: moves.length,
      averageMoveTime: this.calculateAverageMoveTime(moves),
      gameDuration: game.finishedAt
        ? Math.floor(
            (game.finishedAt.getTime() - game.createdAt.getTime()) / 1000
          )
        : Math.floor((new Date().getTime() - game.createdAt.getTime()) / 1000),
    };
  }

  /**
   * Calculate average time between moves
   */
  private static calculateAverageMoveTime(moves: MoveData[]): number {
    if (moves.length < 2) return 0;

    let totalTime = 0;
    for (let i = 1; i < moves.length; i++) {
      totalTime += moves[i].timestamp - moves[i - 1].timestamp;
    }

    return Math.floor(totalTime / (moves.length - 1) / 1000); // Convert to seconds
  }

  /**
   * Check if a game is abandoned (no moves for extended period)
   */
  static async checkAbandonedGames(
    maxIdleHours: number = 24
  ): Promise<string[]> {
    const allGames = await GameModel.findAll(1000);
    const cutoff = Date.now() - maxIdleHours * 60 * 60 * 1000;
    const abandoned: string[] = [];

    for (const game of allGames) {
      if (!game.isGameOver && game.updatedAt.getTime() < cutoff) {
        abandoned.push(game.id);
      }
    }

    return abandoned;
  }

  /**
   * Resume a game that was paused
   */
  static async resumeGame(gameId: string): Promise<GameData> {
    const game = await GameModel.findById(gameId);
    if (!game) {
      throw new NotFoundError('Game');
    }

    if (game.isGameOver) {
      throw new ValidationError('Cannot resume a finished game');
    }

    // Update status to playing if it was waiting
    if (game.status === 'waiting') {
      const updatedGame = await GameModel.update(gameId, { status: 'playing' });
      if (!updatedGame) {
        throw new APIError('Failed to resume game', 500);
      }
      return updatedGame;
    }

    return game;
  }
}
