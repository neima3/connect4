'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, RotateCcw, Home, Users, Cpu, HelpCircle } from 'lucide-react';
import { Board } from './board';
import { Help } from './help';
import { useGameState } from '@/hooks/use-game-state';
import { GameMode } from '@/types/game';
import { cn } from '@/lib/utils';

export function Game() {
  const [showHelp, setShowHelp] = useState(false);
  const {
    gameState,
    gameMode,
    isAIThinking,
    startNewGame,
    makePlayerMove,
    resetGame,
  } = useGameState();

  if (gameMode === 'menu') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4"
      >
        <div className="w-full max-w-md">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl bg-white p-8 shadow-xl"
          >
            <h1 className="text-center text-4xl font-bold text-gray-800 mb-8">
              Connect 4
            </h1>

            <div className="space-y-4">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startNewGame('local')}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-500 p-4 text-white font-semibold hover:bg-blue-600 transition-colors"
              >
                <Users className="h-5 w-5" />
                Local Game
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startNewGame('ai')}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-purple-500 p-4 text-white font-semibold hover:bg-purple-600 transition-colors"
              >
                <Cpu className="h-5 w-5" />
                vs Computer
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startNewGame('online')}
                className="flex w-full items-center justify-center gap-3 rounded-lg bg-green-500 p-4 text-white font-semibold hover:bg-green-600 transition-colors"
              >
                <Users className="h-5 w-5" />
                Online Game
              </motion.button>
            </div>

            <div className="mt-6 text-center text-gray-500 text-sm">
              Connect 4 pieces in a row to win!
            </div>

            <div className="mt-4 text-center">
              <button
                onClick={() => setShowHelp(true)}
                className="text-blue-500 hover:text-blue-600 text-sm font-medium flex items-center gap-1 mx-auto"
              >
                <HelpCircle className="h-4 w-4" />
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
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 p-4"
    >
      <div className="w-full max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Connect 4</h1>

          {/* Game Status */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {gameState.isGameOver ? (
              gameState.winner ? (
                <div className="flex items-center gap-2">
                  <Trophy className="h-6 w-6 text-yellow-500" />
                  <span className="text-xl font-semibold">
                    {gameState.winner === 'red' ? 'Red' : 'Yellow'} Wins!
                  </span>
                </div>
              ) : (
                <span className="text-xl font-semibold text-gray-600">
                  It's a Draw!
                </span>
              )
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'h-6 w-6 rounded-full',
                    gameState.currentPlayer === 'red'
                      ? 'bg-red-500'
                      : 'bg-yellow-400'
                  )}
                />
                <span className="text-lg font-medium">
                  {gameState.currentPlayer === 'red' ? 'Red' : 'Yellow'}'s Turn
                  {isAIThinking && ' (AI thinking...)'}
                </span>
              </div>
            )}
          </div>

          {/* Game Mode Info */}
          <div className="text-sm text-gray-500 mb-4">
            Mode:{' '}
            {gameMode === 'local'
              ? 'Local'
              : gameMode === 'ai'
                ? 'vs Computer'
                : 'Online'}
          </div>
        </motion.div>

        {/* Game Board */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center mb-8"
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
          className="flex justify-center gap-4"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={resetGame}
            className="flex items-center gap-2 rounded-lg bg-blue-500 px-6 py-3 text-white font-semibold hover:bg-blue-600 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            New Game
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => startNewGame('menu')}
            className="flex items-center gap-2 rounded-lg bg-gray-500 px-6 py-3 text-white font-semibold hover:bg-gray-600 transition-colors"
          >
            <Home className="h-4 w-4" />
            Menu
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-2 rounded-lg bg-purple-500 px-6 py-3 text-white font-semibold hover:bg-purple-600 transition-colors"
          >
            <HelpCircle className="h-4 w-4" />
            Help
          </motion.button>
        </motion.div>
      </div>

      <Help isOpen={showHelp} onClose={() => setShowHelp(false)} />
    </motion.div>
  );
}
