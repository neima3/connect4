import { NotificationService, Notification } from './notification-service';
import { RoomService } from './room-service';
import { GameService } from './game-service';

export interface WSMessage {
  type: string;
  data: any;
  timestamp: number;
  gameId?: string;
  roomCode?: string;
  userId?: string;
}

export interface WSClient {
  id: string;
  userId?: string;
  gameId?: string;
  roomCode?: string;
  lastPing: number;
  subscriptions: Set<string>;
  send: (message: WSMessage) => void;
  close: () => void;
}

export interface GameUpdate {
  type: 'move' | 'game_end' | 'game_start' | 'player_joined' | 'player_left';
  gameId: string;
  data: any;
}

export interface RoomUpdate {
  type: 'player_joined' | 'player_left' | 'game_started' | 'room_closed';
  roomCode: string;
  data: any;
}

export class WebSocketService {
  private static clients = new Map<string, WSClient>();
  private static gameSubscriptions = new Map<string, Set<string>>(); // gameId -> clientIds
  private static roomSubscriptions = new Map<string, Set<string>>(); // roomCode -> clientIds
  private static userSubscriptions = new Map<string, Set<string>>(); // userId -> clientIds

  /**
   * Register a new WebSocket client
   */
  static registerClient(
    clientId: string,
    sendFn: (message: WSMessage) => void,
    closeFn: () => void
  ): WSClient {
    const client: WSClient = {
      id: clientId,
      lastPing: Date.now(),
      subscriptions: new Set(),
      send: sendFn,
      close: closeFn,
    };

    this.clients.set(clientId, client);
    return client;
  }

  /**
   * Unregister a WebSocket client
   */
  static unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Clean up subscriptions
    if (client.gameId) {
      this.unsubscribeFromGame(clientId, client.gameId);
    }
    if (client.roomCode) {
      this.unsubscribeFromRoom(clientId, client.roomCode);
    }
    if (client.userId) {
      this.unsubscribeFromUser(clientId, client.userId);
    }

    this.clients.delete(clientId);
  }

  /**
   * Authenticate client with user ID
   */
  static authenticateClient(clientId: string, userId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    client.userId = userId;
    this.userSubscriptions.set(
      userId,
      (this.userSubscriptions.get(userId) || new Set()).add(clientId)
    );

    return true;
  }

  /**
   * Subscribe client to game updates
   */
  static subscribeToGame(clientId: string, gameId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Unsubscribe from previous game if any
    if (client.gameId && client.gameId !== gameId) {
      this.unsubscribeFromGame(clientId, client.gameId);
    }

    client.gameId = gameId;
    client.subscriptions.add(`game:${gameId}`);

    if (!this.gameSubscriptions.has(gameId)) {
      this.gameSubscriptions.set(gameId, new Set());
    }
    this.gameSubscriptions.get(gameId)!.add(clientId);

    return true;
  }

  /**
   * Subscribe client to room updates
   */
  static subscribeToRoom(clientId: string, roomCode: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Unsubscribe from previous room if any
    if (client.roomCode && client.roomCode !== roomCode) {
      this.unsubscribeFromRoom(clientId, client.roomCode);
    }

    client.roomCode = roomCode;
    client.subscriptions.add(`room:${roomCode}`);

    if (!this.roomSubscriptions.has(roomCode)) {
      this.roomSubscriptions.set(roomCode, new Set());
    }
    this.roomSubscriptions.get(roomCode)!.add(clientId);

    return true;
  }

  /**
   * Unsubscribe client from game
   */
  static unsubscribeFromGame(clientId: string, gameId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(`game:${gameId}`);
    client.gameId = undefined;

    const subscribers = this.gameSubscriptions.get(gameId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.gameSubscriptions.delete(gameId);
      }
    }
  }

  /**
   * Unsubscribe client from room
   */
  static unsubscribeFromRoom(clientId: string, roomCode: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(`room:${roomCode}`);
    client.roomCode = undefined;

    const subscribers = this.roomSubscriptions.get(roomCode);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.roomSubscriptions.delete(roomCode);
      }
    }
  }

  /**
   * Unsubscribe client from user
   */
  static unsubscribeFromUser(clientId: string, userId: string): void {
    const subscribers = this.userSubscriptions.get(userId);
    if (subscribers) {
      subscribers.delete(clientId);
      if (subscribers.size === 0) {
        this.userSubscriptions.delete(userId);
      }
    }
  }

  /**
   * Broadcast message to all subscribers of a game
   */
  static async broadcastToGame(
    gameId: string,
    message: Omit<WSMessage, 'timestamp'>
  ): Promise<void> {
    const subscribers = this.gameSubscriptions.get(gameId);
    if (!subscribers || subscribers.size === 0) return;

    const fullMessage: WSMessage = {
      ...message,
      timestamp: Date.now(),
      gameId,
    };

    const promises = Array.from(subscribers).map((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(fullMessage);
        } catch (error) {
          console.error(`Failed to send message to client ${clientId}:`, error);
          // Mark client for cleanup
          client.lastPing = 0;
        }
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
  }

  /**
   * Broadcast message to all subscribers of a room
   */
  static async broadcastToRoom(
    roomCode: string,
    message: Omit<WSMessage, 'timestamp'>
  ): Promise<void> {
    const subscribers = this.roomSubscriptions.get(roomCode);
    if (!subscribers || subscribers.size === 0) return;

    const fullMessage: WSMessage = {
      ...message,
      timestamp: Date.now(),
      roomCode,
    };

    const promises = Array.from(subscribers).map((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(fullMessage);
        } catch (error) {
          console.error(`Failed to send message to client ${clientId}:`, error);
          client.lastPing = 0;
        }
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
  }

  /**
   * Send message to specific user
   */
  static async sendToUser(
    userId: string,
    message: Omit<WSMessage, 'timestamp'>
  ): Promise<void> {
    const subscribers = this.userSubscriptions.get(userId);
    if (!subscribers || subscribers.size === 0) return;

    const fullMessage: WSMessage = {
      ...message,
      timestamp: Date.now(),
      userId,
    };

    const promises = Array.from(subscribers).map((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.send(fullMessage);
        } catch (error) {
          console.error(`Failed to send message to client ${clientId}:`, error);
          client.lastPing = 0;
        }
      }
      return Promise.resolve();
    });

    await Promise.allSettled(promises);
  }

  /**
   * Handle game move notification
   */
  static async handleGameMove(
    gameId: string,
    player: string,
    column: number,
    row: number,
    isWinningMove: boolean = false
  ): Promise<void> {
    await this.broadcastToGame(gameId, {
      type: 'game_move',
      data: {
        player,
        column,
        row,
        isWinningMove,
      },
    });

    // Send notification
    if (isWinningMove) {
      await NotificationService.notifyMoveMade(
        gameId,
        player as any,
        column,
        row,
        true
      );
    }
  }

  /**
   * Handle game state change
   */
  static async handleGameStateChange(
    gameId: string,
    gameState: any
  ): Promise<void> {
    await this.broadcastToGame(gameId, {
      type: 'game_state_update',
      data: gameState,
    });

    // Send appropriate notifications
    if (gameState.isGameOver) {
      if (gameState.winner) {
        await NotificationService.notifyGameEnd(gameId, gameState);
      } else if (gameState.isDraw) {
        await NotificationService.notifyGameEnd(gameId, gameState);
      }
    }
  }

  /**
   * Handle room events
   */
  static async handleRoomEvent(
    roomCode: string,
    eventType: string,
    data: any
  ): Promise<void> {
    await this.broadcastToRoom(roomCode, {
      type: `room_${eventType}`,
      data,
    });

    // Send notifications
    switch (eventType) {
      case 'player_joined':
        await NotificationService.notifyPlayerJoined(
          roomCode,
          data.playerName,
          data.playerCount
        );
        break;
      case 'player_left':
        await NotificationService.notifyPlayerLeft(roomCode, data.playerName);
        break;
      case 'game_started':
        await NotificationService.notifyGameStart(data.gameId, data.gameData);
        break;
    }
  }

  /**
   * Handle AI move
   */
  static async handleAIMove(
    gameId: string,
    column: number,
    row: number,
    difficulty: string,
    confidence?: number
  ): Promise<void> {
    await this.broadcastToGame(gameId, {
      type: 'ai_move',
      data: {
        column,
        row,
        difficulty,
        confidence,
      },
    });

    await NotificationService.notifyAIMove(
      gameId,
      column,
      row,
      difficulty,
      confidence
    );
  }

  /**
   * Ping all clients and remove disconnected ones
   */
  static async pingClients(): Promise<{ active: number; removed: number }> {
    const now = Date.now();
    const timeout = 30000; // 30 seconds
    let removed = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (now - client.lastPing > timeout) {
        try {
          client.close();
        } catch (error) {
          // Ignore errors during cleanup
        }
        this.unregisterClient(clientId);
        removed++;
      } else {
        // Send ping
        try {
          client.send({
            type: 'ping',
            data: { timestamp: now },
            timestamp: now,
          });
        } catch (error) {
          // Client is disconnected, mark for removal
          client.lastPing = 0;
        }
      }
    }

    return {
      active: this.clients.size,
      removed,
    };
  }

  /**
   * Get client by ID
   */
  static getClient(clientId: string): WSClient | null {
    return this.clients.get(clientId) || null;
  }

  /**
   * Get all clients subscribed to a game
   */
  static getGameSubscribers(gameId: string): WSClient[] {
    const subscriberIds = this.gameSubscriptions.get(gameId);
    if (!subscriberIds) return [];

    return Array.from(subscriberIds)
      .map((id) => this.clients.get(id))
      .filter((client) => client !== undefined) as WSClient[];
  }

  /**
   * Get all clients subscribed to a room
   */
  static getRoomSubscribers(roomCode: string): WSClient[] {
    const subscriberIds = this.roomSubscriptions.get(roomCode);
    if (!subscriberIds) return [];

    return Array.from(subscriberIds)
      .map((id) => this.clients.get(id))
      .filter((client) => client !== undefined) as WSClient[];
  }

  /**
   * Get connection statistics
   */
  static getStats(): {
    totalClients: number;
    gameSubscriptions: number;
    roomSubscriptions: number;
    userSubscriptions: number;
    activeGames: number;
    activeRooms: number;
  } {
    return {
      totalClients: this.clients.size,
      gameSubscriptions: this.gameSubscriptions.size,
      roomSubscriptions: this.roomSubscriptions.size,
      userSubscriptions: this.userSubscriptions.size,
      activeGames: this.gameSubscriptions.size,
      activeRooms: this.roomSubscriptions.size,
    };
  }

  /**
   * Update client ping time
   */
  static updateClientPing(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
    }
  }

  /**
   * Handle pong response from client
   */
  static handlePong(clientId: string): void {
    this.updateClientPing(clientId);
  }
}
