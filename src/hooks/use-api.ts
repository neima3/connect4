'use client';

import { useState, useEffect } from 'react';
import { gamesAPI, roomsAPI, statsAPI, ApiError } from '@/lib/api-client';

interface UseGameOptions {
  gameId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useGame(gameId?: string, options: UseGameOptions = {}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const { autoRefresh = false, refreshInterval = 1000 } = options;

  const fetchGame = async () => {
    if (!gameId) return;

    setLoading(true);
    setError(null);

    try {
      const gameData = await gamesAPI.get(gameId);
      setData(gameData);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to fetch game')
      );
    } finally {
      setLoading(false);
    }
  };

  const makeMove = async (
    column: number,
    player: 'red' | 'yellow',
    row: number
  ) => {
    if (!gameId) throw new Error('No game ID');

    setLoading(true);
    setError(null);

    try {
      await gamesAPI.makeMove(gameId, column, player, row);
      // Refresh game data after move
      await fetchGame();
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to make move')
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateGame = async (updates: any) => {
    if (!gameId) throw new Error('No game ID');

    setLoading(true);
    setError(null);

    try {
      await gamesAPI.update(gameId, updates);
      await fetchGame();
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to update game')
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const getAIMove = async () => {
    if (!gameId) throw new Error('No game ID');

    try {
      const result = await gamesAPI.getAIMove(gameId);
      return result;
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to get AI move')
      );
      throw err;
    }
  };

  // Auto-refresh
  useEffect(() => {
    if (!gameId || !autoRefresh) return;

    const interval = setInterval(fetchGame, refreshInterval);
    return () => clearInterval(interval);
  }, [gameId, autoRefresh, refreshInterval]);

  // Initial fetch
  useEffect(() => {
    fetchGame();
  }, [gameId]);

  return {
    data,
    loading,
    error,
    refetch: fetchGame,
    makeMove,
    updateGame,
    getAIMove,
  };
}

export function useCreateGame() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const createGame = async (mode: 'local' | 'ai' | 'online') => {
    setLoading(true);
    setError(null);

    try {
      const game = await gamesAPI.create(mode);
      return game;
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to create game')
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    createGame,
    loading,
    error,
  };
}

export function useRoom(code?: string) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchRoom = async () => {
    if (!code) return;

    setLoading(true);
    setError(null);

    try {
      const roomData = await roomsAPI.get(code);
      setData(roomData);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to fetch room')
      );
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async (players?: string[]) => {
    setLoading(true);
    setError(null);

    try {
      const room = await roomsAPI.create(players);
      setData(room);
      return room;
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to create room')
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async (roomCode: string, playerName: string) => {
    setLoading(true);
    setError(null);

    try {
      const room = await roomsAPI.join(roomCode, playerName);
      setData(room);
      return room;
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to join room')
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateRoom = async (updates: any) => {
    if (!code) throw new Error('No room code');

    setLoading(true);
    setError(null);

    try {
      const updatedRoom = await roomsAPI.update(code, updates);
      setData(updatedRoom);
      return updatedRoom;
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to update room')
      );
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoom();
  }, [code]);

  return {
    data,
    loading,
    error,
    refetch: fetchRoom,
    createRoom,
    joinRoom,
    updateRoom,
  };
}

export function useStats() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const statsData = await statsAPI.get();
      setData(statsData);
    } catch (err) {
      setError(
        err instanceof ApiError ? err : new ApiError('Failed to fetch stats')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    data,
    loading,
    error,
    refetch: fetchStats,
  };
}
