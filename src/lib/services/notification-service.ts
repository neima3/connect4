import { Player, GameState, GameMode } from '@/types/game';
import { GameData, RoomData } from '@/lib/models';

export type NotificationType =
  | 'game_start'
  | 'game_end'
  | 'move_made'
  | 'player_joined'
  | 'player_left'
  | 'room_created'
  | 'room_full'
  | 'turn_change'
  | 'winning_move'
  | 'game_abandoned'
  | 'ai_move'
  | 'connection_lost'
  | 'connection_restored';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: number;
  gameId?: string;
  roomCode?: string;
  player?: Player;
  playerName?: string;
  data?: any;
  priority: 'low' | 'medium' | 'high';
  category: 'game' | 'room' | 'system';
}

export interface NotificationPreferences {
  gameStart: boolean;
  gameEnd: boolean;
  moveMade: boolean;
  playerJoined: boolean;
  playerLeft: boolean;
  roomCreated: boolean;
  turnChange: boolean;
  winningMove: boolean;
  gameAbandoned: boolean;
  aiMove: boolean;
  connectionLost: boolean;
  connectionRestored: boolean;
}

export interface NotificationChannel {
  id: string;
  name: string;
  enabled: boolean;
  type: 'websocket' | 'push' | 'email' | 'inapp';
}

export class NotificationService {
  private static subscribers: Map<
    string,
    Set<(notification: Notification) => void>
  > = new Map();
  private static notificationHistory: Notification[] = [];
  private static maxHistorySize = 1000;

  /**
   * Subscribe to notifications for a specific entity (game or room)
   */
  static subscribe(
    entityId: string,
    callback: (notification: Notification) => void
  ): () => void {
    if (!this.subscribers.has(entityId)) {
      this.subscribers.set(entityId, new Set());
    }

    this.subscribers.get(entityId)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscribers.get(entityId);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.subscribers.delete(entityId);
        }
      }
    };
  }

  /**
   * Create and dispatch a notification
   */
  static async createNotification(
    type: NotificationType,
    title: string,
    message: string,
    options: {
      gameId?: string;
      roomCode?: string;
      player?: Player;
      playerName?: string;
      data?: any;
      priority?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<Notification> {
    const notification: Notification = {
      id: this.generateNotificationId(),
      type,
      title,
      message,
      timestamp: Date.now(),
      gameId: options.gameId,
      roomCode: options.roomCode,
      player: options.player,
      playerName: options.playerName,
      data: options.data,
      priority: options.priority || this.getDefaultPriority(type),
      category: this.getNotificationCategory(type),
    };

    // Add to history
    this.addToHistory(notification);

    // Dispatch to relevant subscribers
    await this.dispatchNotification(notification);

    return notification;
  }

  /**
   * Game event notifications
   */
  static async notifyGameStart(
    gameId: string,
    gameData: GameData
  ): Promise<Notification> {
    const message = this.buildGameStartMessage(gameData);

    return this.createNotification('game_start', 'Game Started', message, {
      gameId,
      data: gameData,
      priority: 'high',
    });
  }

  static async notifyGameEnd(
    gameId: string,
    gameState: GameState
  ): Promise<Notification> {
    const message = this.buildGameEndMessage(gameState);

    return this.createNotification('game_end', 'Game Ended', message, {
      gameId,
      player: gameState.winner || undefined,
      data: gameState,
      priority: 'high',
    });
  }

  static async notifyMoveMade(
    gameId: string,
    player: Player,
    column: number,
    row: number,
    isWinningMove: boolean = false
  ): Promise<Notification> {
    const type = isWinningMove ? 'winning_move' : 'move_made';
    const title = isWinningMove ? 'Winning Move!' : 'Move Made';
    const message = isWinningMove
      ? `${player.charAt(0).toUpperCase() + player.slice(1)} wins with a move in column ${column + 1}!`
      : `${player.charAt(0).toUpperCase() + player.slice(1)} placed a piece in column ${column + 1}`;

    return this.createNotification(type, title, message, {
      gameId,
      player,
      data: { column, row, isWinningMove },
      priority: isWinningMove ? 'high' : 'medium',
    });
  }

  static async notifyTurnChange(
    gameId: string,
    currentPlayer: Player
  ): Promise<Notification> {
    return this.createNotification(
      'turn_change',
      'Turn Change',
      `${currentPlayer.charAt(0).toUpperCase() + currentPlayer.slice(1)}'s turn`,
      {
        gameId,
        player: currentPlayer,
        priority: 'medium',
      }
    );
  }

  /**
   * AI-specific notifications
   */
  static async notifyAIMove(
    gameId: string,
    column: number,
    row: number,
    difficulty: string,
    confidence?: number
  ): Promise<Notification> {
    const message = `AI made a move in column ${column + 1}${confidence ? ` (${Math.round(confidence * 100)}% confidence)` : ''}`;

    return this.createNotification('ai_move', 'AI Move', message, {
      gameId,
      data: { column, row, difficulty, confidence },
      priority: 'medium',
    });
  }

  /**
   * Room event notifications
   */
  static async notifyRoomCreated(
    roomCode: string,
    creatorName: string
  ): Promise<Notification> {
    return this.createNotification(
      'room_created',
      'Room Created',
      `Room ${roomCode} created by ${creatorName}`,
      {
        roomCode,
        playerName: creatorName,
        priority: 'medium',
      }
    );
  }

  static async notifyPlayerJoined(
    roomCode: string,
    playerName: string,
    playerCount: number
  ): Promise<Notification> {
    const title = playerCount === 2 ? 'Room Full' : 'Player Joined';
    const message =
      playerCount === 2
        ? `${playerName} joined. Room is now full!`
        : `${playerName} joined the room`;

    return this.createNotification(
      playerCount === 2 ? 'room_full' : 'player_joined',
      title,
      message,
      {
        roomCode,
        playerName,
        data: { playerCount },
        priority: 'medium',
      }
    );
  }

  static async notifyPlayerLeft(
    roomCode: string,
    playerName: string
  ): Promise<Notification> {
    return this.createNotification(
      'player_left',
      'Player Left',
      `${playerName} left the room`,
      {
        roomCode,
        playerName,
        priority: 'medium',
      }
    );
  }

  /**
   * System notifications
   */
  static async notifyGameAbandoned(gameId: string): Promise<Notification> {
    return this.createNotification(
      'game_abandoned',
      'Game Abandoned',
      'Game was abandoned due to inactivity',
      {
        gameId,
        priority: 'high',
      }
    );
  }

  static async notifyConnectionLost(entityId: string): Promise<Notification> {
    return this.createNotification(
      'connection_lost',
      'Connection Lost',
      'Connection to the server was lost',
      {
        gameId: entityId.startsWith('game_') ? entityId : undefined,
        roomCode: entityId.startsWith('room_') ? entityId : undefined,
        priority: 'high',
      }
    );
  }

  static async notifyConnectionRestored(
    entityId: string
  ): Promise<Notification> {
    return this.createNotification(
      'connection_restored',
      'Connection Restored',
      'Connection to the server has been restored',
      {
        gameId: entityId.startsWith('game_') ? entityId : undefined,
        roomCode: entityId.startsWith('room_') ? entityId : undefined,
        priority: 'medium',
      }
    );
  }

  /**
   * Get notification history
   */
  static getNotificationHistory(
    filters: {
      type?: NotificationType;
      gameId?: string;
      roomCode?: string;
      player?: Player;
      since?: number;
      limit?: number;
    } = {}
  ): Notification[] {
    let filtered = [...this.notificationHistory];

    // Apply filters
    if (filters.type) {
      filtered = filtered.filter((n) => n.type === filters.type);
    }

    if (filters.gameId) {
      filtered = filtered.filter((n) => n.gameId === filters.gameId);
    }

    if (filters.roomCode) {
      filtered = filtered.filter((n) => n.roomCode === filters.roomCode);
    }

    if (filters.player) {
      filtered = filtered.filter((n) => n.player === filters.player);
    }

    if (filters.since) {
      filtered = filtered.filter((n) => n.timestamp >= filters.since!);
    }

    // Sort by timestamp (newest first) and apply limit
    filtered.sort((a, b) => b.timestamp - a.timestamp);

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Clear notification history
   */
  static clearHistory(olderThan?: number): void {
    if (olderThan) {
      this.notificationHistory = this.notificationHistory.filter(
        (n) => n.timestamp >= olderThan
      );
    } else {
      this.notificationHistory = [];
    }
  }

  /**
   * Get notification statistics
   */
  static getNotificationStats(): {
    total: number;
    byType: Record<NotificationType, number>;
    byPriority: Record<string, number>;
    recent: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const byType = {} as Record<NotificationType, number>;
    const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0 };

    for (const notification of this.notificationHistory) {
      byType[notification.type] = (byType[notification.type] || 0) + 1;
      byPriority[notification.priority]++;
    }

    const recent = this.notificationHistory.filter(
      (n) => n.timestamp >= oneHourAgo
    ).length;

    return {
      total: this.notificationHistory.length,
      byType,
      byPriority,
      recent,
    };
  }

  /**
   * Helper methods
   */
  private static generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private static getDefaultPriority(
    type: NotificationType
  ): 'low' | 'medium' | 'high' {
    const highPriority: NotificationType[] = [
      'game_start',
      'game_end',
      'winning_move',
      'connection_lost',
    ];
    const lowPriority: NotificationType[] = ['move_made'];

    if (highPriority.includes(type)) return 'high';
    if (lowPriority.includes(type)) return 'low';
    return 'medium';
  }

  private static getNotificationCategory(
    type: NotificationType
  ): 'game' | 'room' | 'system' {
    const gameEvents: NotificationType[] = [
      'game_start',
      'game_end',
      'move_made',
      'turn_change',
      'winning_move',
      'game_abandoned',
      'ai_move',
    ];
    const roomEvents: NotificationType[] = [
      'room_created',
      'room_full',
      'player_joined',
      'player_left',
    ];
    const systemEvents: NotificationType[] = [
      'connection_lost',
      'connection_restored',
    ];

    if (gameEvents.includes(type)) return 'game';
    if (roomEvents.includes(type)) return 'room';
    return 'system';
  }

  private static async dispatchNotification(
    notification: Notification
  ): Promise<void> {
    const entityId = notification.gameId || notification.roomCode;

    if (entityId && this.subscribers.has(entityId)) {
      const callbacks = this.subscribers.get(entityId)!;

      // Notify all subscribers asynchronously
      const promises = Array.from(callbacks).map((callback) => {
        try {
          return Promise.resolve(callback(notification));
        } catch (error) {
          console.error('Error in notification callback:', error);
          return Promise.resolve();
        }
      });

      await Promise.allSettled(promises);
    }
  }

  private static addToHistory(notification: Notification): void {
    this.notificationHistory.push(notification);

    // Maintain history size
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(
        -this.maxHistorySize
      );
    }
  }

  private static buildGameStartMessage(gameData: GameData): string {
    const modeText: Record<GameMode, string> = {
      menu: 'Menu',
      local: 'Local multiplayer',
      ai: 'vs AI',
      online: 'Online multiplayer',
    };

    return `${modeText[gameData.mode]} game started. Red goes first!`;
  }

  private static buildGameEndMessage(gameState: GameState): string {
    if (gameState.isDraw) {
      return 'Game ended in a draw!';
    }

    if (gameState.winner) {
      return `${gameState.winner.charAt(0).toUpperCase() + gameState.winner.slice(1)} wins in ${gameState.moveCount} moves!`;
    }

    return 'Game ended.';
  }

  /**
   * Create user notification preferences
   */
  static createDefaultPreferences(): NotificationPreferences {
    return {
      gameStart: true,
      gameEnd: true,
      moveMade: true,
      playerJoined: true,
      playerLeft: true,
      roomCreated: true,
      turnChange: true,
      winningMove: true,
      gameAbandoned: true,
      aiMove: true,
      connectionLost: true,
      connectionRestored: true,
    };
  }

  /**
   * Filter notifications based on preferences
   */
  static filterByPreferences(
    notifications: Notification[],
    preferences: Partial<NotificationPreferences>
  ): Notification[] {
    const defaultPrefs = this.createDefaultPreferences();
    const mergedPrefs = { ...defaultPrefs, ...preferences };

    return notifications.filter((notification) => {
      const prefKey = notification.type as keyof NotificationPreferences;
      return mergedPrefs[prefKey] !== false;
    });
  }
}
