import { useState, useCallback, useEffect } from 'react';
import { GameState, GameMode, Player } from '@/types/game';
import { createInitialGameState, makeMove, getAIMove } from '@/lib/game-logic';
import { useGame, useCreateGame } from './use-api';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(
    createInitialGameState()
  );
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);

  // For games that need persistence (AI and Online modes)
  const {
    data: apiGame,
    loading: apiLoading,
    error: apiError,
    makeMove: apiMakeMove,
    updateGame,
    getAIMove,
  } = useGame(currentGameId || undefined, {
    autoRefresh: gameMode === 'online',
    refreshInterval: 500,
  });

  const { createGame, loading: createLoading } = useCreateGame();

  // Sync API game state to local state
  useEffect(() => {
    if (apiGame && (gameMode === 'ai' || gameMode === 'online')) {
      // Convert API game format to local game state format
      setGameState({
        board: apiGame.boardState || createInitialGameState().board,
        currentPlayer: apiGame.currentPlayer || 'red',
        winner: apiGame.winner || null,
        isDraw: apiGame.isDraw || false,
        isGameOver: apiGame.isGameOver || false,
        moveCount: apiGame.moveCount || 0,
        winningLine: apiGame.winningLine || null,
        status: apiGame.status || 'playing',
      });
    }
  }, [apiGame, gameMode]);

  const startNewGame = useCallback(
    async (mode: GameMode) => {
      setGameMode(mode);
      setGameState(createInitialGameState());
      setCurrentGameId(null);
      setIsAIThinking(false);

      // Create persistent game for AI and online modes
      if (mode === 'ai' || mode === 'online') {
        try {
          const game = await createGame(mode);
          setCurrentGameId((game as any).id);
        } catch (error) {
          console.error('Failed to create game:', error);
          // Fall back to local game state
        }
      }
    },
    [createGame]
  );

  const makePlayerMove = useCallback(
    async (col: number) => {
      if (gameState.isGameOver || isAIThinking) return;

      // For local games, use local logic
      if (gameMode === 'local') {
        const result = makeMove(gameState, col);
        if (!result.position) return;

        setGameState(result.gameState);
        return;
      }

      // For AI and online games, use API
      if (!currentGameId) return;

      try {
        // Find the row where the piece will land
        const board = gameState.board;
        let row = -1;
        for (let r = 5; r >= 0; r--) {
          if (!board[r][col]) {
            row = r;
            break;
          }
        }

        if (row === -1) return; // Column is full

        // Make the move via API
        await apiMakeMove(col, gameState.currentPlayer, row);

        // If playing against AI and it's AI's turn
        if (gameMode === 'ai' && !gameState.isGameOver) {
          setIsAIThinking(true);

          setTimeout(async () => {
            try {
              await getAIMove();
            } catch (error) {
              console.error('Failed to get AI move:', error);
            } finally {
              setIsAIThinking(false);
            }
          }, 500);
        }
      } catch (error) {
        console.error('Failed to make move:', error);
        // Fall back to local logic if API fails
        const result = makeMove(gameState, col);
        if (result.position) {
          setGameState(result.gameState);
        }
      }
    },
    [gameState, gameMode, isAIThinking, currentGameId, apiMakeMove, getAIMove]
  );

  const resetGame = useCallback(async () => {
    const newState = createInitialGameState();
    setGameState(newState);

    // Reset API game if it exists
    if (currentGameId && (gameMode === 'ai' || gameMode === 'online')) {
      try {
        await updateGame({
          status: 'playing',
          currentPlayer: 'red',
          winner: null,
          isDraw: false,
          isGameOver: false,
          moveCount: 0,
          boardState: newState.board,
          winningLine: null,
        });
      } catch (error) {
        console.error('Failed to reset game:', error);
      }
    }
  }, [currentGameId, gameMode, updateGame]);

  return {
    gameState,
    gameMode,
    isAIThinking,
    loading: apiLoading || createLoading,
    error: apiError,
    startNewGame,
    makePlayerMove,
    resetGame,
    gameId: currentGameId,
  };
}
