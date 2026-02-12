import { GameStatsModel, GameModel, MoveModel } from '@/lib/models';
import { GameStatsData, GameData, MoveData } from '@/lib/models';
import { GameMode, Player } from '@/types/game';

export interface GameStats {
  totalGames: number;
  redWins: number;
  yellowWins: number;
  draws: number;
  averageMoves: number;
  averageDuration: number;
  winRate: { red: number; yellow: number };
  longestGame: number;
  shortestGame: number;
}

export interface DetailedGameStats extends GameStatsData {
  movesPerMinute: number;
  efficiency: number;
  comeback: boolean;
  earlyWin: boolean;
}

export interface PlayerStats {
  playerName: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  averageMoves: number;
  averageGameDuration: number;
  favoriteColor: Player;
  winStreak: number;
  longestWinStreak: number;
}

export interface TimeSeriesData {
  date: string;
  games: number;
  wins: { red: number; yellow: number };
  draws: number;
  averageDuration: number;
}

export interface LeaderboardEntry {
  playerName: string;
  wins: number;
  winRate: number;
  gamesPlayed: number;
  averageMoves: number;
}

export class StatsService {
  /**
   * Get comprehensive game statistics
   */
  static async getGameStats(mode?: GameMode): Promise<GameStats> {
    const summary = await GameStatsModel.getStatsSummary(mode);

    return {
      totalGames: summary.totalGames,
      redWins: summary.redWins,
      yellowWins: summary.yellowWins,
      draws: summary.draws,
      averageMoves: summary.averageMoves,
      averageDuration: summary.averageDuration,
      winRate: {
        red:
          summary.totalGames > 0
            ? (summary.redWins / summary.totalGames) * 100
            : 0,
        yellow:
          summary.totalGames > 0
            ? (summary.yellowWins / summary.totalGames) * 100
            : 0,
      },
      longestGame: await this.getLongestGameDuration(mode),
      shortestGame: await this.getShortestGameDuration(mode),
    };
  }

  /**
   * Get detailed statistics for specific games
   */
  static async getDetailedGameStats(
    gameIds: string[]
  ): Promise<DetailedGameStats[]> {
    const detailedStats: DetailedGameStats[] = [];

    for (const gameId of gameIds) {
      const game = await GameModel.findById(gameId);
      const moves = await MoveModel.findByGameId(gameId);

      if (!game) continue;

      const gameDuration = game.finishedAt
        ? Math.floor(
            (game.finishedAt.getTime() - game.createdAt.getTime()) / 1000
          )
        : Math.floor((new Date().getTime() - game.createdAt.getTime()) / 1000);

      const movesPerMinute =
        gameDuration > 0 ? (moves.length / gameDuration) * 60 : 0;
      const efficiency = this.calculateGameEfficiency(moves, game);
      const comeback = this.checkForComeback(moves, game);
      const earlyWin = this.checkForEarlyWin(moves, game);

      // Find corresponding stats record
      const statsRecords = await GameStatsModel.findByMode(game.mode, 1000);
      const statsRecord = statsRecords.find((s) => s.gameId === gameId);

      if (statsRecord) {
        detailedStats.push({
          ...statsRecord,
          movesPerMinute,
          efficiency,
          comeback,
          earlyWin,
        });
      }
    }

    return detailedStats;
  }

  /**
   * Get player-specific statistics
   */
  static async getPlayerStats(playerName: string): Promise<PlayerStats> {
    const allStats = await GameStatsModel.findByMode('online', 1000);
    const playerGames = allStats.filter(
      (stats) =>
        stats.playerRed === playerName || stats.playerYellow === playerName
    );

    if (playerGames.length === 0) {
      return this.getDefaultPlayerStats(playerName);
    }

    const wins = playerGames.filter((stats) => {
      if (stats.playerRed === playerName) return stats.winner === 'red';
      if (stats.playerYellow === playerName) return stats.winner === 'yellow';
      return false;
    }).length;

    const losses = playerGames.filter((stats) => {
      if (stats.playerRed === playerName) return stats.winner === 'yellow';
      if (stats.playerYellow === playerName) return stats.winner === 'red';
      return false;
    }).length;

    const draws = playerGames.filter((stats) => stats.winner === null).length;

    const totalMoves = playerGames.reduce(
      (sum, stats) => sum + stats.totalMoves,
      0
    );
    const totalDuration = playerGames.reduce(
      (sum, stats) => sum + (stats.gameDuration || 0),
      0
    );

    const favoriteColor = this.determineFavoriteColor(playerGames, playerName);
    const winStreak = this.calculateCurrentWinStreak(playerGames, playerName);
    const longestWinStreak = this.calculateLongestWinStreak(
      playerGames,
      playerName
    );

    return {
      playerName,
      gamesPlayed: playerGames.length,
      wins,
      losses,
      draws,
      winRate: (wins / playerGames.length) * 100,
      averageMoves: totalMoves / playerGames.length,
      averageGameDuration: totalDuration / playerGames.length,
      favoriteColor,
      winStreak,
      longestWinStreak,
    };
  }

  /**
   * Get time series data for charts
   */
  static async getTimeSeriesData(
    days: number = 30,
    mode?: GameMode
  ): Promise<TimeSeriesData[]> {
    const allStats = await GameStatsModel.findByMode(mode || 'online', 1000);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const dailyData = new Map<string, TimeSeriesData>();

    for (const stats of allStats) {
      if (stats.createdAt < cutoffDate) continue;

      const dateKey = stats.createdAt.toISOString().split('T')[0];

      if (!dailyData.has(dateKey)) {
        dailyData.set(dateKey, {
          date: dateKey,
          games: 0,
          wins: { red: 0, yellow: 0 },
          draws: 0,
          averageDuration: 0,
        });
      }

      const dayData = dailyData.get(dateKey)!;
      dayData.games++;

      if (stats.winner === 'red') dayData.wins.red++;
      if (stats.winner === 'yellow') dayData.wins.yellow++;
      if (stats.winner === null) dayData.draws++;

      dayData.averageDuration =
        (dayData.averageDuration + (stats.gameDuration || 0)) / 2;
    }

    return Array.from(dailyData.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  /**
   * Get leaderboard rankings
   */
  static async getLeaderboard(
    limit: number = 10,
    sortBy: 'wins' | 'winRate' | 'gamesPlayed' = 'wins'
  ): Promise<LeaderboardEntry[]> {
    const allStats = await GameStatsModel.findByMode('online', 1000);
    const playerMap = new Map<string, LeaderboardEntry>();

    // Aggregate stats by player
    for (const stats of allStats) {
      const players = [stats.playerRed, stats.playerYellow].filter(
        Boolean
      ) as string[];

      for (const player of players) {
        if (!playerMap.has(player)) {
          playerMap.set(player, {
            playerName: player,
            wins: 0,
            winRate: 0,
            gamesPlayed: 0,
            averageMoves: 0,
          });
        }

        const entry = playerMap.get(player)!;
        entry.gamesPlayed++;
        entry.averageMoves = (entry.averageMoves + stats.totalMoves) / 2;

        const isRed = stats.playerRed === player;
        const playerWon =
          (isRed && stats.winner === 'red') ||
          (!isRed && stats.winner === 'yellow');

        if (playerWon) {
          entry.wins++;
        }
      }
    }

    // Calculate win rates
    for (const entry of playerMap.values()) {
      entry.winRate =
        entry.gamesPlayed > 0 ? (entry.wins / entry.gamesPlayed) * 100 : 0;
    }

    // Sort and return
    return Array.from(playerMap.values())
      .sort((a, b) => {
        switch (sortBy) {
          case 'wins':
            return b.wins - a.wins;
          case 'winRate':
            return b.winRate - a.winRate;
          case 'gamesPlayed':
            return b.gamesPlayed - a.gamesPlayed;
          default:
            return b.wins - a.wins;
        }
      })
      .slice(0, limit);
  }

  /**
   * Get AI performance statistics
   */
  static async getAIStats(difficulty?: 'easy' | 'medium' | 'hard'): Promise<{
    gamesPlayed: number;
    humanWins: number;
    aiWins: number;
    draws: number;
    averageMoves: number;
    averageGameDuration: number;
    winRate: number;
  }> {
    const aiStats = await GameStatsModel.findByMode('ai', 1000);

    const filteredStats = difficulty
      ? aiStats.filter((stats) => true) // Would need difficulty field in stats
      : aiStats;

    const gamesPlayed = filteredStats.length;
    const humanWins = filteredStats.filter(
      (stats) => stats.winner === 'red'
    ).length;
    const aiWins = filteredStats.filter(
      (stats) => stats.winner === 'yellow'
    ).length;
    const draws = filteredStats.filter((stats) => stats.winner === null).length;

    const totalMoves = filteredStats.reduce(
      (sum, stats) => sum + stats.totalMoves,
      0
    );
    const totalDuration = filteredStats.reduce(
      (sum, stats) => sum + (stats.gameDuration || 0),
      0
    );

    return {
      gamesPlayed,
      humanWins,
      aiWins,
      draws,
      averageMoves: gamesPlayed > 0 ? totalMoves / gamesPlayed : 0,
      averageGameDuration: gamesPlayed > 0 ? totalDuration / gamesPlayed : 0,
      winRate: gamesPlayed > 0 ? (aiWins / gamesPlayed) * 100 : 0,
    };
  }

  /**
   * Helper methods
   */
  private static async getLongestGameDuration(
    mode?: GameMode
  ): Promise<number> {
    const stats = await GameStatsModel.findByMode(mode || 'online', 1000);
    return Math.max(...stats.map((s) => s.gameDuration || 0), 0);
  }

  private static async getShortestGameDuration(
    mode?: GameMode
  ): Promise<number> {
    const stats = await GameStatsModel.findByMode(mode || 'online', 1000);
    const durations = stats
      .map((s) => s.gameDuration || 0)
      .filter((d) => d > 0);
    return durations.length > 0 ? Math.min(...durations) : 0;
  }

  private static calculateGameEfficiency(
    moves: MoveData[],
    game: GameData
  ): number {
    // Efficiency based on how quickly the game was won
    if (!game.winner) return 50; // Draw games have neutral efficiency

    const winningMoveCount = game.moveCount;
    const optimalMoveCount = 7; // Minimum moves to win (4 each)

    return Math.max(0, 100 - (winningMoveCount - optimalMoveCount) * 5);
  }

  private static checkForComeback(moves: MoveData[], game: GameData): boolean {
    // Check if the winner was losing at any point
    if (!game.winner || moves.length < 8) return false;

    // Simplified comeback detection
    // Would need more sophisticated analysis
    return false;
  }

  private static checkForEarlyWin(moves: MoveData[], game: GameData): boolean {
    // Early win is winning in less than 15 moves
    return game.moveCount < 15 && game.winner !== null;
  }

  private static getDefaultPlayerStats(playerName: string): PlayerStats {
    return {
      playerName,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      averageMoves: 0,
      averageGameDuration: 0,
      favoriteColor: 'red',
      winStreak: 0,
      longestWinStreak: 0,
    };
  }

  private static determineFavoriteColor(
    playerGames: GameStatsData[],
    playerName: string
  ): Player {
    let redCount = 0;
    let yellowCount = 0;

    for (const game of playerGames) {
      if (game.playerRed === playerName) redCount++;
      if (game.playerYellow === playerName) yellowCount++;
    }

    return redCount >= yellowCount ? 'red' : 'yellow';
  }

  private static calculateCurrentWinStreak(
    playerGames: GameStatsData[],
    playerName: string
  ): number {
    // Sort by creation date (newest first)
    const sortedGames = playerGames.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

    let streak = 0;
    for (const game of sortedGames) {
      const isRed = game.playerRed === playerName;
      const playerWon =
        (isRed && game.winner === 'red') ||
        (!isRed && game.winner === 'yellow');

      if (playerWon) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  private static calculateLongestWinStreak(
    playerGames: GameStatsData[],
    playerName: string
  ): number {
    // Sort by creation date (oldest first)
    const sortedGames = playerGames.sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    let maxStreak = 0;
    let currentStreak = 0;

    for (const game of sortedGames) {
      const isRed = game.playerRed === playerName;
      const playerWon =
        (isRed && game.winner === 'red') ||
        (!isRed && game.winner === 'yellow');

      if (playerWon) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }

    return maxStreak;
  }

  /**
   * Export statistics for analysis
   */
  static async exportStats(format: 'json' | 'csv' = 'json'): Promise<string> {
    const stats = await GameStatsModel.findByMode('online', 1000);

    if (format === 'csv') {
      const headers = [
        'gameId',
        'playerRed',
        'playerYellow',
        'winner',
        'totalMoves',
        'gameDuration',
        'mode',
        'createdAt',
      ];
      const rows = stats.map((stat) =>
        headers.map((header) => stat[header as keyof GameStatsData]).join(',')
      );

      return [headers.join(','), ...rows].join('\n');
    }

    return JSON.stringify(stats, null, 2);
  }
}
