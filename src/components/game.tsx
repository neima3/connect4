'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Trophy,
  RotateCcw,
  Home,
  Users,
  Cpu,
  HelpCircle,
  BarChart3,
} from 'lucide-react';
import { Board } from './board';
import { Help } from './help';
import { Skeleton } from './skeleton';
import { StatsDisplay } from './stats';
import { OnlineGameSetup } from './online-game-setup';
import { useGameState } from '@/hooks/use-game-state';
import { useGameStats } from '@/hooks/use-game-stats';
import { useOnlineGame } from '@/hooks/use-online-game';
import { GameMode } from '@/types/game';
import { cn } from '@/lib/utils';

export function Game() {
  const [showHelp, setShowHelp] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [onlineGameCode, setOnlineGameCode] = useState<string | null>(null);
  const [playerNumber, setPlayerNumber] = useState<1 | 2>(1);

  const {
    gameState,
    gameMode,
    isAIThinking,
    loading,
    error,
    startNewGame,
    makePlayerMove,
    resetGame,
  } = useGameState();

  const {
    stats,
    startGame: trackGameStart,
    endGame: trackGameEnd,
  } = useGameStats();

  // Online game hook
  const onlineGame = onlineGameCode
    ? useOnlineGame(onlineGameCode, playerNumber)
    : null;

  // Track game start
  useEffect(() => {
    if (gameMode !== 'menu' && gameState.status === 'playing') {
      trackGameStart();
    }
  }, [gameMode, gameState.status, trackGameStart]);

  // Track game end
  useEffect(() => {
    if (gameState.isGameOver && gameMode !== 'menu') {
      trackGameEnd(gameState, gameMode);
    }
  }, [gameState.isGameOver, gameMode, gameState, trackGameEnd]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard input during active gameplay
      if (gameMode === 'menu' || gameState.isGameOver || isAIThinking) return;

      const key = event.key;

      // Handle number keys 1-7 for column selection
      if (key >= '1' && key <= '7') {
        const col = parseInt(key) - 1;
        makePlayerMove(col);
      }

      // Handle 'h' key for help
      if (key === 'h' || key === 'H') {
        setShowHelp(true);
      }

      // Handle 'n' key for new game
      if (key === 'n' || key === 'N') {
        resetGame();
      }

      // Handle 'm' key for menu
      if (key === 'm' || key === 'M') {
        startNewGame('menu');
      }

      // Handle 'Escape' key
      if (key === 'Escape') {
        if (showHelp) {
          setShowHelp(false);
        } else if (
          gameMode === 'local' ||
          gameMode === 'ai' ||
          gameMode === 'online'
        ) {
          startNewGame('menu');
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [
    gameMode,
    gameState.isGameOver,
    isAIThinking,
    makePlayerMove,
    showHelp,
    resetGame,
    startNewGame,
  ]);

  // Show loading state for API operations
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-2 sm:p-4"
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </motion.div>
    );
  }

  // Show error state
  if (error) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-2 sm:p-4"
      >
        <div className="w-full max-w-md px-2 sm:px-0">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="rounded-2xl bg-white p-4 sm:p-8 shadow-xl"
          >
            <div className="text-center">
              <div className="text-red-500 mb-4">
                <svg
                  className="w-16 h-16 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">
                Oops! Something went wrong
              </h2>
              <p className="text-gray-600 mb-6">
                {error.message || 'An error occurred'}
              </p>
              <button
                onClick={() => startNewGame('menu')}
                className="rounded-lg bg-blue-500 px-6 py-2 text-white font-semibold hover:bg-blue-600 transition-colors"
              >
                Back to Menu
              </button>
            </div>
          </motion.div>
        </div>
      </motion.div>
    );
  }

  if (gameMode === 'menu') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 1.05 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-2 sm:p-4"
      >
        <div className="w-full max-w-md px-2 sm:px-0">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white p-4 sm:p-8 shadow-xl"
          >
            <h1 className="text-center text-2xl sm:text-4xl font-bold text-gray-800 mb-6 sm:mb-8">
              Connect 4
            </h1>

            <div className="space-y-3 sm:space-y-4">
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startNewGame('local')}
                className="flex w-full items-center justify-center gap-2 sm:gap-3 rounded-lg bg-blue-500 p-3 sm:p-4 text-white font-semibold hover:bg-blue-600 transition-colors text-sm sm:text-base shadow-lg hover:shadow-xl"
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Local Game
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startNewGame('ai')}
                className="flex w-full items-center justify-center gap-2 sm:gap-3 rounded-lg bg-purple-500 p-3 sm:p-4 text-white font-semibold hover:bg-purple-600 transition-colors text-sm sm:text-base shadow-lg hover:shadow-xl"
              >
                <Cpu className="h-4 w-4 sm:h-5 sm:w-5" />
                vs Computer
              </motion.button>

              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setOnlineGameCode('')}
                className="flex w-full items-center justify-center gap-2 sm:gap-3 rounded-lg bg-green-500 p-3 sm:p-4 text-white font-semibold hover:bg-green-600 transition-colors text-sm sm:text-base shadow-lg hover:shadow-xl"
              >
                <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                Online Game
              </motion.button>
            </div>

            <div className="mt-4 sm:mt-6 text-center text-gray-500 text-xs sm:text-sm">
              Connect 4 pieces in a row to win!
            </div>

            <div className="mt-3 sm:mt-4 text-center space-y-2">
              <button
                onClick={() => setShowStats(true)}
                className="text-green-500 hover:text-green-600 text-xs sm:text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                View Stats
              </button>
              <button
                onClick={() => setShowHelp(true)}
                className="text-blue-500 hover:text-blue-600 text-xs sm:text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                How to Play
              </button>
            </div>
          </motion.div>
        </div>

        <Help isOpen={showHelp} onClose={() => setShowHelp(false)} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-2 sm:p-4"
    >
      <div className="w-full max-w-6xl px-2 sm:px-0">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 text-center"
        >
          <h1 className="text-2xl sm:text-4xl font-bold text-gray-800 mb-3 sm:mb-4">
            Connect 4
          </h1>

          {/* Game Status */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 mb-3 sm:mb-4 text-center sm:text-left">
            {gameState.isGameOver ? (
              gameState.winner ? (
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                  <span className="text-lg sm:text-xl font-semibold">
                    {gameState.winner === 'red' ? 'Red' : 'Yellow'} Wins!
                  </span>
                </div>
              ) : (
                <span className="text-lg sm:text-xl font-semibold text-gray-600">
                  It's a Draw!
                </span>
              )
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-5 w-5 sm:h-6 sm:w-6 rounded-full',
                    gameState.currentPlayer === 'red'
                      ? 'bg-red-500'
                      : 'bg-yellow-400'
                  )}
                />
                <span className="text-sm sm:text-lg font-medium">
                  {gameState.currentPlayer === 'red' ? 'Red' : 'Yellow'}'s Turn
                  {isAIThinking && (
                    <span className="ml-2">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          ease: 'linear',
                        }}
                        className="inline-block w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"
                      />
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Game Mode Info */}
          <div className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
            Mode:{' '}
            {gameMode === 'local'
              ? 'Local'
              : gameMode === 'ai'
                ? 'vs Computer'
                : onlineGame
                  ? `Online - Player ${playerNumber} (${onlineGame.opponentName ? 'vs ' + onlineGame.opponentName : 'Waiting...'})`
                  : 'Online'}
          </div>
        </motion.div>

        {/* Game Board */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-6 sm:mb-8 overflow-x-auto"
        >
          <Board
            gameState={gameState}
            onMove={makePlayerMove}
            disabled={isAIThinking}
          />
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-center gap-2 sm:gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetGame}
            className="flex items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2 sm:px-6 sm:py-3 text-white font-semibold hover:bg-blue-600 transition-colors text-sm sm:text-base"
          >
            <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
            New Game
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => startNewGame('menu')}
            className="flex items-center justify-center gap-2 rounded-lg bg-gray-500 px-4 py-2 sm:px-6 sm:py-3 text-white font-semibold hover:bg-gray-600 transition-colors text-sm sm:text-base"
          >
            <Home className="h-3 w-3 sm:h-4 sm:w-4" />
            Menu
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowStats(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-green-500 px-4 py-2 sm:px-6 sm:py-3 text-white font-semibold hover:bg-green-600 transition-colors text-sm sm:text-base"
          >
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
            Stats
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center gap-2 rounded-lg bg-purple-500 px-4 py-2 sm:px-6 sm:py-3 text-white font-semibold hover:bg-purple-600 transition-colors text-sm sm:text-base"
          >
            <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4" />
            Help
          </motion.button>
        </motion.div>
      </div>

      {/* Online Game Setup Modal */}
      {onlineGameCode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
          <OnlineGameSetup
            onStartGame={(code, playerNum) => {
              setOnlineGameCode(code);
              setPlayerNumber(playerNum);
              startNewGame('online');
            }}
            onBack={() => setOnlineGameCode(null)}
          />
        </div>
      )}

      <Help isOpen={showHelp} onClose={() => setShowHelp(false)} />

      {/* Stats Modal */}
      {showStats && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4"
          onClick={() => setShowStats(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <StatsDisplay stats={stats} />

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowStats(false)}
                className="rounded-lg bg-gray-500 px-6 py-2 text-white font-semibold hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
