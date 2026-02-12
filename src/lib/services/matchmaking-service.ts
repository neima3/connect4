import { RoomService, RoomJoinResult } from './room-service';
import { GameService } from './game-service';
import { WebSocketService } from './websocket-service';
import { NotificationService } from './notification-service';
import { ValidationError, NotFoundError } from '@/lib/api-utils';

export interface MatchmakingRequest {
  userId: string;
  userName: string;
  preferences: MatchmakingPreferences;
  createdAt: number;
}

export interface MatchmakingPreferences {
  skillLevel?: 'beginner' | 'intermediate' | 'advanced';
  preferredColor?: 'red' | 'yellow';
  maxWaitTime?: number; // in seconds
  region?: string;
}

export interface Match {
  id: string;
  roomCode: string;
  players: {
    userId: string;
    userName: string;
    color: 'red' | 'yellow';
  }[];
  createdAt: number;
  status: 'pending' | 'confirmed' | 'started' | 'cancelled';
}

export interface MatchmakingStats {
  totalWaiting: number;
  averageWaitTime: number;
  matchesToday: number;
  matchesThisHour: number;
  successRate: number;
}

export class MatchmakingService {
  private static requests = new Map<string, MatchmakingRequest>(); // userId -> request
  private static matches = new Map<string, Match>(); // matchId -> match
  private static readonly MAX_WAIT_TIME = 5 * 60 * 1000; // 5 minutes
  private static readonly CLEANUP_INTERVAL = 60 * 1000; // 1 minute

  /**
   * Add user to matchmaking queue
   */
  static async addToQueue(
    userId: string,
    userName: string,
    preferences: MatchmakingPreferences = {}
  ): Promise<{ success: boolean; match?: Match; estimatedWaitTime?: number }> {
    // Check if user is already in queue
    if (this.requests.has(userId)) {
      throw new ValidationError('User is already in matchmaking queue');
    }

    const request: MatchmakingRequest = {
      userId,
      userName,
      preferences: {
        maxWaitTime: 5 * 60, // 5 minutes default
        ...preferences,
      },
      createdAt: Date.now(),
    };

    this.requests.set(userId, request);

    // Try to find a match immediately
    const match = await this.findMatch(request);
    if (match) {
      return { success: true, match };
    }

    // Return estimated wait time
    const estimatedWaitTime = this.calculateEstimatedWaitTime();
    return { success: true, estimatedWaitTime };
  }

  /**
   * Remove user from matchmaking queue
   */
  static async removeFromQueue(userId: string): Promise<boolean> {
    const request = this.requests.get(userId);
    if (!request) {
      return false;
    }

    this.requests.delete(userId);

    // Check if user was in a pending match
    for (const [matchId, match] of this.matches.entries()) {
      if (
        match.status === 'pending' &&
        match.players.some((p) => p.userId === userId)
      ) {
        match.status = 'cancelled';
        this.matches.delete(matchId);

        // Notify the other player
        const otherPlayer = match.players.find((p) => p.userId !== userId);
        if (otherPlayer) {
          await WebSocketService.sendToUser(otherPlayer.userId, {
            type: 'matchmaking_cancelled',
            data: { reason: 'Opponent left queue' },
          });
        }
        break;
      }
    }

    return true;
  }

  /**
   * Get user's current status in queue
   */
  static getUserStatus(userId: string): {
    inQueue: boolean;
    position?: number;
    waitTime?: number;
    match?: Match;
  } {
    const request = this.requests.get(userId);
    if (!request) {
      return { inQueue: false };
    }

    const position = this.getQueuePosition(userId);
    const waitTime = Date.now() - request.createdAt;

    // Check if user has a pending match
    const match = Array.from(this.matches.values()).find(
      (m) =>
        m.status === 'pending' && m.players.some((p) => p.userId === userId)
    );

    return {
      inQueue: true,
      position,
      waitTime,
      match,
    };
  }

  /**
   * Find a match for a request
   */
  private static async findMatch(
    request: MatchmakingRequest
  ): Promise<Match | null> {
    const candidates = Array.from(this.requests.values())
      .filter((r) => r.userId !== request.userId)
      .filter((r) => this.isCompatibleMatch(request, r))
      .sort((a, b) => a.createdAt - b.createdAt);

    if (candidates.length === 0) {
      return null;
    }

    const opponent = candidates[0];
    return this.createMatch(request, opponent);
  }

  /**
   * Check if two requests are compatible for matching
   */
  private static isCompatibleMatch(
    req1: MatchmakingRequest,
    req2: MatchmakingRequest
  ): boolean {
    // Check skill level compatibility
    if (req1.preferences.skillLevel && req2.preferences.skillLevel) {
      const levelOrder = ['beginner', 'intermediate', 'advanced'];
      const level1 = levelOrder.indexOf(req1.preferences.skillLevel);
      const level2 = levelOrder.indexOf(req2.preferences.skillLevel);

      // Allow matching within 1 level difference
      if (Math.abs(level1 - level2) > 1) {
        return false;
      }
    }

    // Check region compatibility (if specified)
    if (req1.preferences.region && req2.preferences.region) {
      if (req1.preferences.region !== req2.preferences.region) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a match between two requests
   */
  private static async createMatch(
    req1: MatchmakingRequest,
    req2: MatchmakingRequest
  ): Promise<Match> {
    const matchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Determine colors based on preferences
    let player1Color: 'red' | 'yellow';
    let player2Color: 'red' | 'yellow';

    if (req1.preferences.preferredColor && req2.preferences.preferredColor) {
      if (req1.preferences.preferredColor !== req2.preferences.preferredColor) {
        player1Color = req1.preferences.preferredColor;
        player2Color = req2.preferences.preferredColor;
      } else {
        // Both want same color, random assignment
        const random = Math.random();
        player1Color =
          random < 0.5
            ? req1.preferences.preferredColor
            : req1.preferences.preferredColor === 'red'
              ? 'yellow'
              : 'red';
        player2Color = player1Color === 'red' ? 'yellow' : 'red';
      }
    } else if (req1.preferences.preferredColor) {
      player1Color = req1.preferences.preferredColor;
      player2Color = player1Color === 'red' ? 'yellow' : 'red';
    } else if (req2.preferences.preferredColor) {
      player2Color = req2.preferences.preferredColor;
      player1Color = player2Color === 'red' ? 'yellow' : 'red';
    } else {
      // Random assignment
      player1Color = Math.random() < 0.5 ? 'red' : 'yellow';
      player2Color = player1Color === 'red' ? 'yellow' : 'red';
    }

    const match: Match = {
      id: matchId,
      roomCode: '', // Will be set after room creation
      players: [
        {
          userId: req1.userId,
          userName: req1.userName,
          color: player1Color,
        },
        {
          userId: req2.userId,
          userName: req2.userName,
          color: player2Color,
        },
      ],
      createdAt: Date.now(),
      status: 'pending',
    };

    // Remove both users from queue
    this.requests.delete(req1.userId);
    this.requests.delete(req2.userId);

    // Store the match
    this.matches.set(matchId, match);

    // Create room and start game
    try {
      const room = await RoomService.createRoom();
      match.roomCode = room.code;

      // Join both players to room
      await RoomService.joinRoom(room.code, req1.userName);
      const joinResult = await RoomService.joinRoom(room.code, req2.userName);

      if (joinResult.gameStarted) {
        match.status = 'started';

        // Notify players
        await this.notifyMatchFound(match);
      } else {
        match.status = 'confirmed';
        await this.notifyMatchConfirmed(match);
      }

      return match;
    } catch (error) {
      // If room creation fails, clean up
      this.matches.delete(matchId);
      throw error;
    }
  }

  /**
   * Notify players that a match is found
   */
  private static async notifyMatchFound(match: Match): Promise<void> {
    for (const player of match.players) {
      await WebSocketService.sendToUser(player.userId, {
        type: 'match_found',
        data: {
          matchId: match.id,
          roomCode: match.roomCode,
          opponent: match.players.find((p) => p.userId !== player.userId),
          yourColor: player.color,
        },
      });
    }

    await NotificationService.createNotification(
      'game_start',
      'Match Found!',
      `You have been matched with an opponent. Room: ${match.roomCode}`,
      {
        priority: 'high',
      }
    );
  }

  /**
   * Notify players that match is confirmed (room created)
   */
  private static async notifyMatchConfirmed(match: Match): Promise<void> {
    for (const player of match.players) {
      await WebSocketService.sendToUser(player.userId, {
        type: 'match_confirmed',
        data: {
          matchId: match.id,
          roomCode: match.roomCode,
          opponent: match.players.find((p) => p.userId !== player.userId),
          yourColor: player.color,
        },
      });
    }
  }

  /**
   * Accept or decline a match
   */
  static async respondToMatch(
    userId: string,
    matchId: string,
    accept: boolean
  ): Promise<{ success: boolean; message?: string }> {
    const match = this.matches.get(matchId);
    if (!match) {
      throw new NotFoundError('Match');
    }

    if (match.status !== 'pending' && match.status !== 'confirmed') {
      throw new ValidationError('Match is no longer active');
    }

    const player = match.players.find((p) => p.userId === userId);
    if (!player) {
      throw new ValidationError('You are not part of this match');
    }

    if (!accept) {
      // Cancel the match
      match.status = 'cancelled';
      this.matches.delete(matchId);

      // Notify the other player
      const otherPlayer = match.players.find((p) => p.userId !== userId);
      if (otherPlayer) {
        await WebSocketService.sendToUser(otherPlayer.userId, {
          type: 'match_cancelled',
          data: { reason: 'Opponent declined match' },
        });
      }

      return { success: true, message: 'Match declined' };
    }

    // If both players accept, start the game
    const allPlayersAccepted = await this.checkAllPlayersAccepted(matchId);
    if (allPlayersAccepted) {
      await this.startMatch(match);
    }

    return { success: true, message: 'Match accepted' };
  }

  /**
   * Check if all players have accepted the match
   */
  private static async checkAllPlayersAccepted(
    matchId: string
  ): Promise<boolean> {
    // In a real implementation, you'd track individual acceptances
    // For now, we'll assume the first response starts the game
    return true;
  }

  /**
   * Start a confirmed match
   */
  private static async startMatch(match: Match): Promise<void> {
    try {
      await RoomService.startGame(match.roomCode);
      match.status = 'started';

      await this.notifyMatchStarted(match);
    } catch (error) {
      match.status = 'cancelled';
      throw error;
    }
  }

  /**
   * Notify players that match has started
   */
  private static async notifyMatchStarted(match: Match): Promise<void> {
    for (const player of match.players) {
      await WebSocketService.sendToUser(player.userId, {
        type: 'match_started',
        data: {
          roomCode: match.roomCode,
          yourColor: player.color,
          opponent: match.players.find((p) => p.userId !== player.userId),
        },
      });
    }
  }

  /**
   * Clean up old requests and expired matches
   */
  static cleanup(): {
    expiredRequests: number;
    expiredMatches: number;
    totalWaiting: number;
  } {
    const now = Date.now();
    let expiredRequests = 0;
    let expiredMatches = 0;

    // Clean up expired requests
    for (const [userId, request] of this.requests.entries()) {
      if (now - request.createdAt > this.MAX_WAIT_TIME) {
        this.requests.delete(userId);
        expiredRequests++;

        // Notify user about timeout
        WebSocketService.sendToUser(userId, {
          type: 'matchmaking_timeout',
          data: { message: 'Matchmaking timeout, please try again' },
        });
      }
    }

    // Clean up expired matches
    for (const [matchId, match] of this.matches.entries()) {
      if (
        now - match.createdAt > this.MAX_WAIT_TIME &&
        match.status === 'pending'
      ) {
        this.matches.delete(matchId);
        expiredMatches++;

        // Notify players about expired match
        for (const player of match.players) {
          WebSocketService.sendToUser(player.userId, {
            type: 'match_expired',
            data: { message: 'Match expired, please try again' },
          });
        }
      }
    }

    return {
      expiredRequests,
      expiredMatches,
      totalWaiting: this.requests.size,
    };
  }

  /**
   * Get queue position for a user
   */
  private static getQueuePosition(userId: string): number {
    const userRequest = this.requests.get(userId);
    if (!userRequest) return -1;

    const sortedRequests = Array.from(this.requests.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );

    return sortedRequests.findIndex((r) => r.userId === userId) + 1;
  }

  /**
   * Calculate estimated wait time
   */
  private static calculateEstimatedWaitTime(): number {
    const queueSize = this.requests.size;
    if (queueSize === 0) return 0;
    if (queueSize === 1) return 120; // 2 minutes estimate for solo player

    // Rough estimate: 30 seconds per opponent in queue
    return Math.min(queueSize * 30, 300); // Max 5 minutes
  }

  /**
   * Get matchmaking statistics
   */
  static getStats(): MatchmakingStats {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const totalWaiting = this.requests.size;
    const averageWaitTime = this.calculateAverageWaitTime();

    const matchesToday = Array.from(this.matches.values()).filter(
      (m) => m.createdAt > oneDayAgo
    ).length;

    const matchesThisHour = Array.from(this.matches.values()).filter(
      (m) => m.createdAt > oneHourAgo
    ).length;

    const successfulMatches = Array.from(this.matches.values()).filter(
      (m) => m.status === 'started'
    ).length;

    const successRate =
      this.matches.size > 0 ? (successfulMatches / this.matches.size) * 100 : 0;

    return {
      totalWaiting,
      averageWaitTime,
      matchesToday,
      matchesThisHour,
      successRate,
    };
  }

  /**
   * Calculate average wait time for current queue
   */
  private static calculateAverageWaitTime(): number {
    const requests = Array.from(this.requests.values());
    if (requests.length === 0) return 0;

    const totalWaitTime = requests.reduce(
      (sum, req) => sum + (Date.now() - req.createdAt),
      0
    );
    return Math.floor(totalWaitTime / requests.length / 1000); // Convert to seconds
  }

  /**
   * Get all active matches (for admin purposes)
   */
  static getActiveMatches(): Match[] {
    return Array.from(this.matches.values()).filter(
      (m) => m.status === 'pending' || m.status === 'confirmed'
    );
  }

  /**
   * Force start a match (admin function)
   */
  static async forceStartMatch(matchId: string): Promise<boolean> {
    const match = this.matches.get(matchId);
    if (!match || match.status !== 'confirmed') {
      return false;
    }

    try {
      await this.startMatch(match);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Cancel a match (admin function)
   */
  static async cancelMatch(matchId: string, reason?: string): Promise<boolean> {
    const match = this.matches.get(matchId);
    if (!match) {
      return false;
    }

    match.status = 'cancelled';
    this.matches.delete(matchId);

    // Notify all players
    for (const player of match.players) {
      await WebSocketService.sendToUser(player.userId, {
        type: 'match_cancelled',
        data: { reason: reason || 'Match was cancelled' },
      });
    }

    return true;
  }
}
