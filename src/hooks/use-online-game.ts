import { useState, useEffect } from 'react';
import { GameState, Player, Room } from '@/types/game';
import {
  createInitialGameState,
  makeMove as gameLogicMakeMove,
} from '@/lib/game-logic';
import { useRoom } from './use-api';

interface OnlineGameHookReturn {
  gameState: GameState;
  playerNumber: 1 | 2;
  isMyTurn: boolean;
  isConnected: boolean;
  opponentName: string;
  loading: boolean;
  error: any;
  makeMove: (col: number) => void;
  disconnect: () => void;
}

export function useOnlineGame(
  roomCode: string,
  playerNumber: 1 | 2
): OnlineGameHookReturn {
  const [gameState, setGameState] = useState<GameState>(
    createInitialGameState()
  );
  const [gameId, setGameId] = useState<string | null>(null);

  const {
    data: room,
    loading: roomLoading,
    error: roomError,
    updateRoom,
  } = useRoom(roomCode);

  const isConnected = room && room.players.length >= 2;
  const opponentName =
    (room &&
      room.players.find(
        (_player: string, index: number) => index !== playerNumber - 1
      )) ||
    '';

  const isMyTurn =
    playerNumber === 1
      ? gameState.currentPlayer === 'red'
      : gameState.currentPlayer === 'yellow';

  // Update game state when room data changes
  useEffect(() => {
    if (room && room.gameId) {
      setGameId(room.gameId);
    }
  }, [room]);

  // Sync game state from room
  useEffect(() => {
    // For now, we'll use localStorage as a simple sync mechanism
    // In a real implementation, this would use WebSocket or polling
    const interval = setInterval(() => {
      if (roomCode) {
        const stored = localStorage.getItem(`online_game_${roomCode}`);
        if (stored) {
          const newState: GameState = JSON.parse(stored);
          // Only update if it's newer
          if (newState.moveCount > gameState.moveCount) {
            setGameState(newState);
          }
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [roomCode, gameState.moveCount]);

  const makeMove = async (col: number) => {
    if (!isMyTurn || gameState.isGameOver || !roomCode) return;

    try {
      // Apply move locally for immediate feedback
      const result = gameLogicMakeMove(gameState, col);
      if (!result.position) return;

      // Update game state
      setGameState(result.gameState);

      // Store in localStorage for sync (simulating server update)
      localStorage.setItem(
        `online_game_${roomCode}`,
        JSON.stringify(result.gameState)
      );

      // In a real implementation, this would send the move to the server
      // For now, we simulate it with localStorage sync
    } catch (error) {
      console.error('Failed to make move:', error);
    }
  };

  const disconnect = async () => {
    try {
      // Remove player from room
      if (room) {
        const updatedPlayers = room.players.filter(
          (_player: string, index: number) => index !== playerNumber - 1
        );
        await updateRoom({
          players: updatedPlayers,
          gameStarted: updatedPlayers.length >= 2,
        });
      }

      // Clean up local storage
      localStorage.removeItem(`online_game_${roomCode}`);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  return {
    gameState,
    playerNumber,
    isMyTurn,
    isConnected: isConnected || false,
    opponentName: opponentName || '',
    loading: roomLoading,
    error: roomError,
    makeMove,
    disconnect,
  };
}
