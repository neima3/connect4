import { useState, useCallback } from 'react';
import { GameState, GameMode, Player } from '@/types/game';
import { createInitialGameState, makeMove, getAIMove } from '@/lib/game-logic';

export function useGameState() {
  const [gameState, setGameState] = useState<GameState>(
    createInitialGameState()
  );
  const [gameMode, setGameMode] = useState<GameMode>('menu');
  const [isAIThinking, setIsAIThinking] = useState(false);

  const startNewGame = useCallback((mode: GameMode) => {
    setGameMode(mode);
    setGameState(createInitialGameState());
  }, []);

  const makePlayerMove = useCallback(
    (col: number) => {
      if (gameState.isGameOver || isAIThinking) return;

      const result = makeMove(gameState, col);
      if (!result.position) return;

      setGameState(result.gameState);

      // If playing against AI and it's AI's turn
      if (gameMode === 'ai' && !result.gameState.isGameOver) {
        setIsAIThinking(true);

        setTimeout(() => {
          setGameState((currentState) => {
            const aiCol = getAIMove(currentState);
            if (aiCol === -1) return currentState;

            const aiResult = makeMove(currentState, aiCol);
            return aiResult.gameState;
          });
          setIsAIThinking(false);
        }, 500);
      }
    },
    [gameState, gameMode, isAIThinking]
  );

  const resetGame = useCallback(() => {
    setGameState(createInitialGameState());
  }, []);

  return {
    gameState,
    gameMode,
    isAIThinking,
    startNewGame,
    makePlayerMove,
    resetGame,
  };
}
