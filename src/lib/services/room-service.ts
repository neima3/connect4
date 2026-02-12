import { RoomModel, GameModel } from '@/lib/models';
import { RoomData, GameData } from '@/lib/models';
import { GameMode, Player } from '@/types/game';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError, ValidationError, ConflictError } from '@/lib/api-utils';

export interface RoomCreationOptions {
  playerName?: string;
  maxPlayers?: number;
  autoStart?: boolean;
}

export interface RoomJoinResult {
  room: RoomData;
  game: GameData | null;
  playerNumber: 1 | 2;
  gameStarted: boolean;
}

export interface RoomWithGame extends RoomData {
  game?: GameData | null;
}

export interface RoomStatus {
  code: string;
  playerCount: number;
  gameStarted: boolean;
  waitingForPlayer: boolean;
  timeRemaining: number | null;
}

export class RoomService {
  private static readonly ROOM_CODE_LENGTH = 6;
  private static readonly MAX_GENERATION_ATTEMPTS = 10;
  private static readonly ROOM_EXPIRY_HOURS = 24;

  /**
   * Create a new room with optional initial player
   */
  static async createRoom(
    options: RoomCreationOptions = {}
  ): Promise<RoomData> {
    const { playerName, maxPlayers = 2, autoStart = false } = options;

    // Generate unique room code
    const code = await this.generateUniqueRoomCode();

    const players = playerName ? [playerName] : [];

    const room = await RoomModel.create(code, players);

    // If auto-start is enabled and we have enough players, start the game
    if (autoStart && players.length >= maxPlayers) {
      await this.startGame(code);
    }

    return room;
  }

  /**
   * Generate a unique room code
   */
  private static async generateUniqueRoomCode(): Promise<string> {
    let attempts = 0;

    while (attempts < this.MAX_GENERATION_ATTEMPTS) {
      const code = this.generateRandomCode();
      const existingRoom = await RoomModel.findByCode(code);

      if (!existingRoom) {
        return code;
      }

      attempts++;
    }

    throw new Error(
      'Failed to generate unique room code after maximum attempts'
    );
  }

  /**
   * Generate a random room code
   */
  private static generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';

    for (let i = 0; i < this.ROOM_CODE_LENGTH; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
  }

  /**
   * Join an existing room
   */
  static async joinRoom(
    roomCode: string,
    playerName: string
  ): Promise<RoomJoinResult> {
    const code = roomCode.toUpperCase();
    const room = await RoomModel.findByCode(code);

    if (!room) {
      throw new NotFoundError('Room');
    }

    // Validate join conditions
    this.validateJoinConditions(room, playerName);

    // Add player to room
    const updatedPlayers = [...room.players, playerName];
    const updatedRoom = await RoomModel.update(code, {
      players: updatedPlayers,
    });

    if (!updatedRoom) {
      throw new Error('Failed to update room');
    }

    // Check if room is now full and auto-start game
    let game: GameData | null = null;
    let gameStarted = false;

    if (updatedPlayers.length === 2) {
      game = await this.startGame(code);
      gameStarted = true;
    }

    return {
      room: updatedRoom,
      game,
      playerNumber: updatedPlayers.length as 1 | 2,
      gameStarted,
    };
  }

  /**
   * Validate conditions for joining a room
   */
  private static validateJoinConditions(
    room: RoomData,
    playerName: string
  ): void {
    if (room.gameStarted) {
      throw new ConflictError('Game has already started');
    }

    if (room.players.length >= 2) {
      throw new ConflictError('Room is full');
    }

    if (room.players.includes(playerName)) {
      throw new ValidationError('Player name already taken in this room');
    }

    if (playerName.trim().length === 0 || playerName.length > 50) {
      throw new ValidationError(
        'Player name must be between 1 and 50 characters'
      );
    }
  }

  /**
   * Start a game in a room
   */
  static async startGame(roomCode: string): Promise<GameData> {
    const code = roomCode.toUpperCase();
    const room = await RoomModel.findByCode(code);

    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.players.length < 2) {
      throw new ValidationError('Need at least 2 players to start game');
    }

    if (room.gameStarted) {
      throw new ConflictError('Game has already started');
    }

    // Create new online game
    const game = await GameModel.create('online');

    // Update room with game ID and start flag
    const updatedRoom = await RoomModel.update(code, {
      gameId: game.id,
      gameStarted: true,
    });

    if (!updatedRoom) {
      throw new Error('Failed to update room');
    }

    return game;
  }

  /**
   * Get room with game data
   */
  static async getRoomWithGame(roomCode: string): Promise<RoomWithGame> {
    const code = roomCode.toUpperCase();
    const room = await RoomModel.findByCode(code);

    if (!room) {
      throw new NotFoundError('Room');
    }

    // Include game data if game exists
    let game: GameData | null = null;
    if (room.gameId) {
      game = await GameModel.findById(room.gameId);
    }

    return {
      ...room,
      game,
    };
  }

  /**
   * Leave a room
   */
  static async leaveRoom(
    roomCode: string,
    playerName: string
  ): Promise<RoomData | null> {
    const code = roomCode.toUpperCase();
    const room = await RoomModel.findByCode(code);

    if (!room) {
      throw new NotFoundError('Room');
    }

    if (!room.players.includes(playerName)) {
      throw new ValidationError('Player not in room');
    }

    // Remove player from room
    const updatedPlayers = room.players.filter((p) => p !== playerName);

    if (updatedPlayers.length === 0) {
      // Delete room if no players left
      await RoomModel.delete(code);
      return null;
    }

    // Update room
    const updatedRoom = await RoomModel.update(code, {
      players: updatedPlayers,
    });

    // If game was in progress, handle it (could end game or mark as abandoned)
    if (room.gameStarted && room.gameId) {
      await this.handlePlayerLeaveGame(room.gameId, updatedPlayers.length);
    }

    return updatedRoom;
  }

  /**
   * Handle a player leaving an active game
   */
  private static async handlePlayerLeaveGame(
    gameId: string,
    remainingPlayers: number
  ): Promise<void> {
    if (remainingPlayers === 0) {
      // No players left, delete the game
      await GameModel.delete(gameId);
    } else {
      // One player left, mark game as abandoned or let them continue
      // This could be enhanced to allow reconnection
      const game = await GameModel.findById(gameId);
      if (game && !game.isGameOver) {
        // Could mark as waiting for reconnection
        // For now, we'll leave the game active
      }
    }
  }

  /**
   * Get room status for monitoring
   */
  static async getRoomStatus(roomCode: string): Promise<RoomStatus> {
    const room = await this.getRoomWithGame(roomCode);

    return {
      code: room.code,
      playerCount: room.players.length,
      gameStarted: room.gameStarted,
      waitingForPlayer: room.players.length < 2 && !room.gameStarted,
      timeRemaining: this.calculateTimeRemaining(room.createdAt),
    };
  }

  /**
   * Calculate time remaining before room expires
   */
  private static calculateTimeRemaining(createdAt: Date): number | null {
    const now = new Date();
    const expiryTime =
      createdAt.getTime() + this.ROOM_EXPIRY_HOURS * 60 * 60 * 1000;
    const remaining = expiryTime - now.getTime();

    return remaining > 0 ? Math.floor(remaining / 1000) : null; // Return in seconds
  }

  /**
   * Clean up expired rooms
   */
  static async cleanupExpiredRooms(): Promise<{
    deleted: number;
    errors: string[];
  }> {
    try {
      await RoomModel.cleanup();
      return { deleted: 0, errors: [] }; // Would need enhancement to get actual count
    } catch (error) {
      return {
        deleted: 0,
        errors: error instanceof Error ? [error.message] : ['Unknown error'],
      };
    }
  }

  /**
   * Get all active rooms (for admin purposes)
   */
  static async getActiveRooms(): Promise<RoomStatus[]> {
    // This would need to be implemented in RoomModel
    // For now, return empty array
    return [];
  }

  /**
   * Reconnect to a room (for players who lost connection)
   */
  static async reconnectToRoom(
    roomCode: string,
    playerName: string
  ): Promise<RoomWithGame> {
    const room = await this.getRoomWithGame(roomCode);

    // Check if player was in the room
    if (!room.players.includes(playerName)) {
      throw new ValidationError('You were not in this room');
    }

    return room;
  }

  /**
   * Update room settings
   */
  static async updateRoomSettings(
    roomCode: string,
    settings: {
      maxPlayers?: number;
      autoStart?: boolean;
    }
  ): Promise<RoomData> {
    const room = await RoomModel.findByCode(roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundError('Room');
    }

    if (room.gameStarted) {
      throw new ValidationError(
        'Cannot change settings after game has started'
      );
    }

    // RoomModel doesn't support these settings yet, so just return current room
    // This would need to be extended in the database schema
    return room;
  }

  /**
   * Get player's color assignment in a room
   */
  static async getPlayerColor(
    roomCode: string,
    playerName: string
  ): Promise<Player> {
    const room = await RoomModel.findByCode(roomCode.toUpperCase());

    if (!room) {
      throw new NotFoundError('Room');
    }

    const playerIndex = room.players.indexOf(playerName);
    if (playerIndex === -1) {
      throw new ValidationError('Player not in room');
    }

    // First player is red, second is yellow
    return playerIndex === 0 ? 'red' : 'yellow';
  }
}
