import { useState, useEffect } from 'react';
import { GameState, Player, Room } from '@/types/game';
import { createInitialGameState } from '@/lib/game-logic';

interface OnlineGameHookReturn {
  gameState: GameState;
  playerNumber: 1 | 2;
  isMyTurn: boolean;
  isConnected: boolean;
  opponentName: string;
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
  const [isConnected, setIsConnected] = useState(false);
  const [opponentName, setOpponentName] = useState('');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  const isMyTurn =
    playerNumber === 1
      ? gameState.currentPlayer === 'red'
      : gameState.currentPlayer === 'yellow';

  // Load initial game state
  useEffect(() => {
    const stored = localStorage.getItem(`game_${roomCode}`);
    if (stored) {
      setGameState(JSON.parse(stored));
    }
  }, [roomCode]);

  // Load room info for opponent name
  useEffect(() => {
    const stored = localStorage.getItem(`room_${roomCode}`);
    if (stored) {
      const room: Room = JSON.parse(stored);
      const opponent = room.players.find(
        (_, index) => index !== playerNumber - 1
      );
      if (opponent) {
        setOpponentName(opponent);
        setIsConnected(true);
      }
    }
  }, [roomCode, playerNumber]);

  // Sync game state from localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem(`game_${roomCode}`);
      if (stored) {
        const newState: GameState = JSON.parse(stored);
        // Only update if it's newer
        if (newState.moveCount > gameState.moveCount) {
          setGameState(newState);
          setLastUpdate(Date.now());
        }
      }
    }, 500);

    return () => clearInterval(interval);
  }, [roomCode, gameState.moveCount]);

  const makeMove = (col: number) => {
    if (!isMyTurn || gameState.isGameOver) return;

    // Simulate game logic update
    const updatedState = { ...gameState };
    // Here you would call the actual game logic
    // For now, we'll just increment move count and toggle player
    updatedState.moveCount++;
    updatedState.currentPlayer =
      updatedState.currentPlayer === 'red' ? 'yellow' : 'red';

    // Save to localStorage (simulating server update)
    localStorage.setItem(`game_${roomCode}`, JSON.stringify(updatedState));
    setGameState(updatedState);
  };

  const disconnect = () => {
    // Clean up game data
    localStorage.removeItem(`game_${roomCode}`);

    // Remove player from room
    const roomStored = localStorage.getItem(`room_${roomCode}`);
    if (roomStored) {
      const room: Room = JSON.parse(roomStored);
      room.players = room.players.filter(
        (_, index) => index !== playerNumber - 1
      );
      if (room.players.length === 0) {
        localStorage.removeItem(`room_${roomCode}`);
      } else {
        localStorage.setItem(`room_${roomCode}`, JSON.stringify(room));
      }
    }
  };

  return {
    gameState,
    playerNumber,
    isMyTurn,
    isConnected,
    opponentName,
    makeMove,
    disconnect,
  };
}
