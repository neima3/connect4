import { GameState, Player, GameMode } from '@/types/game';
import { GameData, RoomData } from '@/lib/models';
import { ValidationError, ConflictError, NotFoundError } from '@/lib/api-utils';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface GameValidationRules {
  allowLateJoin: boolean;
  maxIdleTime: number; // in minutes
  allowSpectators: boolean;
  ratedGame: boolean;
}

export interface RoomValidationRules {
  maxPlayerNameLength: number;
  minPlayerNameLength: number;
  allowedCharacters: RegExp;
  roomCodeLength: number;
  maxRoomAge: number; // in hours
}

export class ValidationService {
  private static readonly DEFAULT_GAME_RULES: GameValidationRules = {
    allowLateJoin: false,
    maxIdleTime: 60,
    allowSpectators: false,
    ratedGame: false,
  };

  private static readonly DEFAULT_ROOM_RULES: RoomValidationRules = {
    maxPlayerNameLength: 50,
    minPlayerNameLength: 1,
    allowedCharacters: /^[a-zA-Z0-9\s\-_]+$/,
    roomCodeLength: 6,
    maxRoomAge: 24,
  };

  /**
   * Validate a game move
   */
  static validateMove(
    gameState: GameState,
    column: number,
    player: Player,
    rules: Partial<GameValidationRules> = {}
  ): ValidationResult {
    const validationRules = { ...this.DEFAULT_GAME_RULES, ...rules };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic move validation
    if (gameState.isGameOver) {
      errors.push('Game is already over');
    }

    if (gameState.currentPlayer !== player) {
      errors.push('Not your turn');
    }

    if (column < 0 || column > 6) {
      errors.push('Column must be between 0 and 6');
    }

    if (!this.isValidMovePosition(gameState.board, column)) {
      errors.push('Column is full');
    }

    // Game rule validations
    if (!validationRules.allowLateJoin && gameState.status === 'waiting') {
      errors.push('Game has not started yet');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate game state integrity
   */
  static validateGameState(gameState: GameState): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Board validation
    if (!this.isValidBoard(gameState.board)) {
      errors.push('Invalid board state');
    }

    // Player turn consistency
    const redCount = this.countPieces(gameState.board, 'red');
    const yellowCount = this.countPieces(gameState.board, 'yellow');

    if (Math.abs(redCount - yellowCount) > 1) {
      errors.push('Unbalanced number of pieces');
    }

    if (gameState.currentPlayer === 'red' && redCount > yellowCount) {
      errors.push('Invalid turn order - red should not have more pieces');
    }

    if (gameState.currentPlayer === 'yellow' && yellowCount > redCount) {
      errors.push('Invalid turn order - yellow should not have more pieces');
    }

    // Game state consistency
    if (gameState.isGameOver && !gameState.winner && !gameState.isDraw) {
      errors.push('Game is over but no winner or draw detected');
    }

    if (gameState.winner && gameState.isDraw) {
      errors.push('Cannot have both winner and draw');
    }

    // Move count consistency
    if (gameState.moveCount !== redCount + yellowCount) {
      warnings.push('Move count does not match pieces on board');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate room creation
   */
  static validateRoomCreation(
    roomCode: string,
    playerName: string,
    rules: Partial<RoomValidationRules> = {}
  ): ValidationResult {
    const validationRules = { ...this.DEFAULT_ROOM_RULES, ...rules };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Room code validation
    if (roomCode.length !== validationRules.roomCodeLength) {
      errors.push(
        `Room code must be exactly ${validationRules.roomCodeLength} characters`
      );
    }

    if (!/^[A-Z0-9]+$/.test(roomCode)) {
      errors.push('Room code must contain only uppercase letters and numbers');
    }

    // Player name validation
    if (playerName.length < validationRules.minPlayerNameLength) {
      errors.push(
        `Player name must be at least ${validationRules.minPlayerNameLength} character`
      );
    }

    if (playerName.length > validationRules.maxPlayerNameLength) {
      errors.push(
        `Player name must be no more than ${validationRules.maxPlayerNameLength} characters`
      );
    }

    if (!validationRules.allowedCharacters.test(playerName)) {
      errors.push('Player name contains invalid characters');
    }

    // Name format validation
    if (playerName.trim() !== playerName) {
      warnings.push('Player name should not start or end with whitespace');
    }

    if (/\s{2,}/.test(playerName)) {
      warnings.push('Player name contains multiple consecutive spaces');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate room joining
   */
  static validateRoomJoining(
    room: RoomData,
    playerName: string,
    rules: Partial<RoomValidationRules> = {}
  ): ValidationResult {
    const validationRules = { ...this.DEFAULT_ROOM_RULES, ...rules };
    const errors: string[] = [];
    const warnings: string[] = [];

    // Room existence and state
    if (!room) {
      errors.push('Room does not exist');
    } else {
      // Room age validation
      const roomAge =
        (Date.now() - room.createdAt.getTime()) / (1000 * 60 * 60); // hours
      if (roomAge > validationRules.maxRoomAge) {
        errors.push(`Room is older than ${validationRules.maxRoomAge} hours`);
      }

      // Player limits
      if (room.players.length >= 2) {
        errors.push('Room is full');
      }

      if (room.gameStarted) {
        errors.push('Game has already started');
      }

      // Player name uniqueness
      if (room.players.includes(playerName)) {
        errors.push('Player name already taken in this room');
      }

      // Warnings
      if (room.players.length === 1) {
        warnings.push('You will be the second player');
      }

      if (roomAge > validationRules.maxRoomAge * 0.8) {
        warnings.push('Room is close to expiring');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate AI difficulty setting
   */
  static validateAIDifficulty(difficulty: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validDifficulties = ['easy', 'medium', 'hard'];

    if (!validDifficulties.includes(difficulty)) {
      errors.push(
        `Invalid difficulty. Must be one of: ${validDifficulties.join(', ')}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate game mode
   */
  static validateGameMode(mode: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const validModes: GameMode[] = ['local', 'ai', 'online'];

    if (!validModes.includes(mode as GameMode)) {
      errors.push(
        `Invalid game mode. Must be one of: ${validModes.join(', ')}`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate database integrity
   */
  static async validateDatabaseIntegrity(): Promise<
    ValidationResult & {
      issues: {
        orphanedGames: string[];
        orphanedMoves: string[];
        corruptRooms: string[];
      };
    }
  > {
    const errors: string[] = [];
    const warnings: string[] = [];

    const issues = {
      orphanedGames: [] as string[],
      orphanedMoves: [] as string[],
      corruptRooms: [] as string[],
    };

    // This would require database-specific queries
    // For now, return a basic validation

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      issues,
    };
  }

  /**
   * Validate player action timing
   */
  static validateActionTiming(
    lastActionTime: number,
    currentTime: number,
    maxDelay: number = 30000 // 30 seconds
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    const timeDiff = currentTime - lastActionTime;

    if (timeDiff < 100) {
      warnings.push('Very rapid actions detected');
    }

    if (timeDiff > maxDelay) {
      warnings.push('Long delay between actions');
    }

    if (timeDiff < 0) {
      errors.push('Invalid action time - appears to be in the future');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate input sanitization
   */
  static sanitizeInput(
    input: string
  ): ValidationResult & { sanitized: string } {
    const errors: string[] = [];
    const warnings: string[] = [];

    let sanitized = input.trim();

    // Remove potentially harmful characters
    sanitized = sanitized.replace(/[<>]/g, '');

    if (sanitized !== input.trim()) {
      warnings.push('Input was sanitized for security');
    }

    if (sanitized.length === 0) {
      errors.push('Input cannot be empty after sanitization');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sanitized,
    };
  }

  /**
   * Helper methods
   */
  private static isValidMovePosition(
    board: (Player | null)[][],
    column: number
  ): boolean {
    return board[0][column] === null;
  }

  private static isValidBoard(board: (Player | null)[][]): boolean {
    if (!Array.isArray(board) || board.length !== 6) return false;

    for (const row of board) {
      if (!Array.isArray(row) || row.length !== 7) return false;

      for (const cell of row) {
        if (cell !== null && cell !== 'red' && cell !== 'yellow') {
          return false;
        }
      }
    }

    // Check for floating pieces
    for (let col = 0; col < 7; col++) {
      let foundEmpty = false;
      for (let row = 0; row < 6; row++) {
        if (board[row][col] === null) {
          foundEmpty = true;
        } else if (foundEmpty && board[row][col] !== null) {
          return false; // Found piece above empty space
        }
      }
    }

    return true;
  }

  private static countPieces(
    board: (Player | null)[][],
    player: Player
  ): number {
    let count = 0;
    for (const row of board) {
      for (const cell of row) {
        if (cell === player) count++;
      }
    }
    return count;
  }

  /**
   * Validate game rules consistency
   */
  static validateGameRules(
    customRules: Partial<GameValidationRules>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (customRules.maxIdleTime !== undefined) {
      if (customRules.maxIdleTime < 1 || customRules.maxIdleTime > 1440) {
        errors.push(
          'Max idle time must be between 1 and 1440 minutes (24 hours)'
        );
      }
    }

    if (
      customRules.allowLateJoin !== undefined &&
      customRules.allowSpectators !== undefined
    ) {
      if (customRules.allowLateJoin && !customRules.allowSpectators) {
        warnings.push('Late joining without spectators may cause confusion');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Cross-validate related entities
   */
  static validateConsistency(
    game: GameData,
    room: RoomData | null,
    moves: any[]
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Game-room consistency
    if (room) {
      if (room.gameId !== game.id) {
        errors.push('Game and room have inconsistent IDs');
      }

      if (room.gameStarted && game.status === 'waiting') {
        errors.push('Room shows game started but game is waiting');
      }
    }

    // Game-moves consistency
    const moveCount = moves.length;
    if (moveCount !== game.moveCount) {
      errors.push(
        `Move count mismatch: game shows ${game.moveCount}, found ${moveCount} moves`
      );
    }

    // Turn consistency with moves
    if (moves.length > 0) {
      const lastMove = moves[moves.length - 1];
      const expectedPlayer = lastMove.player === 'red' ? 'yellow' : 'red';

      if (game.currentPlayer !== expectedPlayer) {
        warnings.push('Current player may be inconsistent with last move');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
