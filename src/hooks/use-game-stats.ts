import { useState, useEffect } from 'react';
import { Player, GameMode, GameState } from '@/types/game';

interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalMoves: number;
  averageGameTime: number;
  currentStreak: number;
  bestStreak: number;
}

const STORAGE_KEY = 'connect4-stats';

const getDefaultStats = (): GameStats => ({
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  draws: 0,
  totalMoves: 0,
  averageGameTime: 0,
  currentStreak: 0,
  bestStreak: 0,
});

export function useGameStats() {
  const [stats, setStats] = useState<GameStats>(getDefaultStats);
  const [gameStartTime, setGameStartTime] = useState<number>(Date.now());
  const [isGameActive, setIsGameActive] = useState(false);

  // Load stats from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setStats(JSON.parse(stored));
      }
    } catch (error) {
      console.warn('Failed to load stats from localStorage:', error);
    }
  }, []);

  // Save stats to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (error) {
      console.warn('Failed to save stats to localStorage:', error);
    }
  }, [stats]);

  const startGame = () => {
    setGameStartTime(Date.now());
    setIsGameActive(true);
  };

  const endGame = (
    gameState: GameState,
    gameMode: GameMode,
    playerNumber?: 1 | 2
  ) => {
    if (!isGameActive) return;

    const gameDuration = Math.floor((Date.now() - gameStartTime) / 1000);
    const isPlayerWinner =
      gameState.winner !== null &&
      (gameMode === 'local' ||
        (gameMode === 'ai' && gameState.winner === 'red') ||
        (gameMode === 'online' &&
          ((playerNumber === 1 && gameState.winner === 'red') ||
            (playerNumber === 2 && gameState.winner === 'yellow'))));

    setStats((prev) => {
      const newStats = { ...prev };

      // Update game count
      newStats.gamesPlayed++;

      // Update wins/losses/draws (only for AI mode for now)
      if (gameMode === 'ai') {
        if (gameState.winner === 'red') {
          newStats.wins++;
          newStats.currentStreak = Math.max(0, newStats.currentStreak) + 1;
        } else if (gameState.winner === 'yellow') {
          newStats.losses++;
          newStats.currentStreak = Math.min(0, newStats.currentStreak) - 1;
        } else {
          newStats.draws++;
          newStats.currentStreak = 0;
        }
      } else {
        // For local and online games, just track as draws for now
        if (gameState.isDraw) {
          newStats.draws++;
        }
        // Could add more sophisticated tracking for online games
      }

      // Update best streak
      newStats.bestStreak = Math.max(
        newStats.bestStreak,
        newStats.currentStreak
      );

      // Update total moves
      newStats.totalMoves += gameState.moveCount;

      // Update average game time
      const totalGameTime =
        prev.averageGameTime * (prev.gamesPlayed - 1) + gameDuration;
      newStats.averageGameTime = Math.floor(
        totalGameTime / newStats.gamesPlayed
      );

      return newStats;
    });

    setIsGameActive(false);
  };

  const resetStats = () => {
    setStats(getDefaultStats());
  };

  return {
    stats,
    startGame,
    endGame,
    resetStats,
  };
}
