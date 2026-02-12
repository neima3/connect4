import { GameState, Player, Position } from '@/types/game';
import {
  makeMove,
  checkWin,
  getValidMoves,
  COLS,
  ROWS,
} from '@/lib/game-logic';
import { ValidationError } from '@/lib/api-utils';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export interface AIMoveResult {
  column: number;
  confidence: number;
  reasoning: string;
}

export interface AIMoveEvaluation {
  column: number;
  score: number;
  canWin: boolean;
  blocksWin: boolean;
  createsOpportunity: boolean;
}

export class AIService {
  /**
   * Get the best AI move based on difficulty level
   */
  static async getBestMove(
    gameState: GameState,
    difficulty: AIDifficulty = 'medium'
  ): Promise<AIMoveResult> {
    const validMoves = getValidMoves(gameState.board);

    if (validMoves.length === 0) {
      throw new ValidationError('No valid moves available');
    }

    // For easy difficulty, use simple logic
    if (difficulty === 'easy') {
      return this.getEasyMove(gameState, validMoves);
    }

    // For medium and hard, use minimax with different depths
    const depth = difficulty === 'medium' ? 3 : 5;
    const bestMove = this.minimaxMove(gameState, depth);

    return {
      column: bestMove.column,
      confidence: bestMove.score / 100,
      reasoning: this.getMoveReasoning(bestMove),
    };
  }

  /**
   * Easy AI - simple heuristic logic
   */
  private static getEasyMove(
    gameState: GameState,
    validMoves: number[]
  ): AIMoveResult {
    // Priority 1: Try to win
    for (const col of validMoves) {
      const testMove = makeMove(gameState, col);
      if (testMove.gameState.winner === 'yellow') {
        return {
          column: col,
          confidence: 1.0,
          reasoning: 'Winning move',
        };
      }
    }

    // Priority 2: Block opponent from winning
    for (const col of validMoves) {
      const testState = { ...gameState, currentPlayer: 'red' as Player };
      const testMove = makeMove(testState, col);
      if (testMove.gameState.winner === 'red') {
        return {
          column: col,
          confidence: 0.9,
          reasoning: 'Blocking opponent win',
        };
      }
    }

    // Priority 3: Prefer center columns
    const centerPreference = [3, 2, 4, 1, 5, 0, 6];
    for (const col of centerPreference) {
      if (validMoves.includes(col)) {
        return {
          column: col,
          confidence: 0.5,
          reasoning: 'Center column preference',
        };
      }
    }

    // Fallback to first valid move
    return {
      column: validMoves[0],
      confidence: 0.3,
      reasoning: 'Random valid move',
    };
  }

  /**
   * Minimax algorithm for AI decision making
   */
  private static minimaxMove(
    gameState: GameState,
    depth: number
  ): AIMoveEvaluation {
    const validMoves = getValidMoves(gameState.board);
    let bestMove: AIMoveEvaluation = {
      column: validMoves[0],
      score: -Infinity,
      canWin: false,
      blocksWin: false,
      createsOpportunity: false,
    };

    for (const col of validMoves) {
      const moveResult = makeMove(gameState, col);
      if (!moveResult.position) continue;

      const score = this.minimax(
        moveResult.gameState,
        depth - 1,
        false,
        -Infinity,
        Infinity
      );

      const evaluation: AIMoveEvaluation = {
        column: col,
        score,
        canWin: moveResult.gameState.winner === 'yellow',
        blocksWin: this.checkIfBlocksWin(gameState, col),
        createsOpportunity: this.checkIfCreatesOpportunity(
          moveResult.gameState
        ),
      };

      if (score > bestMove.score) {
        bestMove = evaluation;
      }
    }

    return bestMove;
  }

  /**
   * Minimax implementation with alpha-beta pruning
   */
  private static minimax(
    gameState: GameState,
    depth: number,
    isMaximizing: boolean,
    alpha: number,
    beta: number
  ): number {
    // Terminal states
    if (gameState.winner === 'yellow') return 1000 + depth;
    if (gameState.winner === 'red') return -1000 - depth;
    if (gameState.isDraw || depth === 0) return this.evaluateBoard(gameState);

    const validMoves = getValidMoves(gameState.board);

    if (isMaximizing) {
      let maxScore = -Infinity;
      for (const col of validMoves) {
        const moveResult = makeMove(gameState, col);
        if (!moveResult.position) continue;

        const score = this.minimax(
          moveResult.gameState,
          depth - 1,
          false,
          alpha,
          beta
        );
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, score);

        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return maxScore;
    } else {
      let minScore = Infinity;
      for (const col of validMoves) {
        const moveResult = makeMove(gameState, col);
        if (!moveResult.position) continue;

        const score = this.minimax(
          moveResult.gameState,
          depth - 1,
          true,
          alpha,
          beta
        );
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, score);

        if (beta <= alpha) break; // Alpha-beta pruning
      }
      return minScore;
    }
  }

  /**
   * Evaluate the current board state
   */
  private static evaluateBoard(gameState: GameState): number {
    let score = 0;
    const board = gameState.board;

    // Center column control
    for (let row = 0; row < ROWS; row++) {
      if (board[row][3] === 'yellow') score += 3;
      if (board[row][3] === 'red') score -= 3;
    }

    // Evaluate all possible 4-in-a-row positions
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Horizontal
        if (col <= COLS - 4) {
          score += this.evaluateLine(
            board[row][col],
            board[row][col + 1],
            board[row][col + 2],
            board[row][col + 3]
          );
        }

        // Vertical
        if (row <= ROWS - 4) {
          score += this.evaluateLine(
            board[row][col],
            board[row + 1][col],
            board[row + 2][col],
            board[row + 3][col]
          );
        }

        // Diagonal (top-left to bottom-right)
        if (row <= ROWS - 4 && col <= COLS - 4) {
          score += this.evaluateLine(
            board[row][col],
            board[row + 1][col + 1],
            board[row + 2][col + 2],
            board[row + 3][col + 3]
          );
        }

        // Diagonal (bottom-left to top-right)
        if (row >= 3 && col <= COLS - 4) {
          score += this.evaluateLine(
            board[row][col],
            board[row - 1][col + 1],
            board[row - 2][col + 2],
            board[row - 3][col + 3]
          );
        }
      }
    }

    return score;
  }

  /**
   * Evaluate a line of 4 positions
   */
  private static evaluateLine(
    pos1: Player | null,
    pos2: Player | null,
    pos3: Player | null,
    pos4: Player | null
  ): number {
    const line = [pos1, pos2, pos3, pos4];
    let yellowCount = 0;
    let redCount = 0;
    let emptyCount = 0;

    for (const pos of line) {
      if (pos === 'yellow') yellowCount++;
      else if (pos === 'red') redCount++;
      else emptyCount++;
    }

    // If both players have pieces in this line, it's not valuable
    if (yellowCount > 0 && redCount > 0) return 0;

    // Score based on how many pieces we have and how many empty spots
    if (yellowCount === 3 && emptyCount === 1) return 50;
    if (yellowCount === 2 && emptyCount === 2) return 10;
    if (yellowCount === 1 && emptyCount === 3) return 1;

    if (redCount === 3 && emptyCount === 1) return -50;
    if (redCount === 2 && emptyCount === 2) return -10;
    if (redCount === 1 && emptyCount === 3) return -1;

    return 0;
  }

  /**
   * Check if a move blocks an opponent win
   */
  private static checkIfBlocksWin(
    gameState: GameState,
    column: number
  ): boolean {
    const testState = { ...gameState, currentPlayer: 'red' as Player };
    const testMove = makeMove(testState, column);
    return testMove.gameState.winner === 'red';
  }

  /**
   * Check if a move creates future opportunities
   */
  private static checkIfCreatesOpportunity(gameState: GameState): boolean {
    // Simple heuristic: check if we created multiple potential winning lines
    const opportunities = this.countWinningOpportunities(gameState, 'yellow');
    return opportunities >= 2;
  }

  /**
   * Count winning opportunities for a player
   */
  private static countWinningOpportunities(
    gameState: GameState,
    player: Player
  ): number {
    let opportunities = 0;
    const board = gameState.board;

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        // Check horizontal
        if (col <= COLS - 4) {
          if (
            this.isWinningOpportunity(
              board[row][col],
              board[row][col + 1],
              board[row][col + 2],
              board[row][col + 3],
              player
            )
          )
            opportunities++;
        }

        // Check vertical
        if (row <= ROWS - 4) {
          if (
            this.isWinningOpportunity(
              board[row][col],
              board[row + 1][col],
              board[row + 2][col],
              board[row + 3][col],
              player
            )
          )
            opportunities++;
        }
      }
    }

    return opportunities;
  }

  /**
   * Check if a line is a winning opportunity
   */
  private static isWinningOpportunity(
    pos1: Player | null,
    pos2: Player | null,
    pos3: Player | null,
    pos4: Player | null,
    player: Player
  ): boolean {
    const line = [pos1, pos2, pos3, pos4];
    let playerCount = 0;
    let emptyCount = 0;
    let opponentCount = 0;

    for (const pos of line) {
      if (pos === player) playerCount++;
      else if (pos === null) emptyCount++;
      else opponentCount++;
    }

    // It's an opportunity if we have pieces and empty spots, but no opponent pieces
    return playerCount >= 2 && emptyCount >= 1 && opponentCount === 0;
  }

  /**
   * Get human-readable reasoning for a move
   */
  private static getMoveReasoning(evaluation: AIMoveEvaluation): string {
    if (evaluation.canWin) return 'Winning move';
    if (evaluation.blocksWin) return 'Blocking opponent win';
    if (evaluation.createsOpportunity) return 'Creating winning opportunity';
    if (evaluation.score > 50) return 'Strong strategic move';
    if (evaluation.score > 0) return 'Good positional move';
    return 'Developing move';
  }

  /**
   * Get AI performance statistics
   */
  static async getAIPerformanceStats(difficulty: AIDifficulty): Promise<{
    gamesPlayed: number;
    winRate: number;
    averageMovesPerGame: number;
    averageGameDuration: number;
  }> {
    // This would be implemented with actual stats from the database
    // For now, return mock data
    return {
      gamesPlayed: 0,
      winRate: 0,
      averageMovesPerGame: 0,
      averageGameDuration: 0,
    };
  }
}
