'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { GameState, Player } from '@/types/game';

interface CellProps {
  player: Player | null;
  isWinning?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

function Cell({ player, isWinning, onClick, disabled }: CellProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || player !== null}
      className={cn(
        'aspect-square rounded-full border border-blue-300 bg-blue-50 p-0.5 sm:p-1 transition-all duration-200',
        'hover:bg-blue-100 focus:outline-none focus:ring-1 sm:focus:ring-2 focus:ring-blue-400',
        player && 'cursor-not-allowed',
        disabled && 'cursor-not-allowed opacity-50',
        'min-w-[25px] sm:min-w-[0]'
      )}
    >
      <motion.div
        initial={
          player
            ? {
                scale: 0,
                y: -300,
                opacity: 0,
              }
            : false
        }
        animate={
          isWinning
            ? {
                scale: [1, 1.1, 1],
                transition: {
                  duration: 1,
                  repeat: Infinity,
                  ease: 'easeInOut',
                },
              }
            : { scale: 1, y: 0, opacity: 1 }
        }
        transition={
          player && !isWinning
            ? {
                type: 'spring',
                stiffness: 200,
                damping: 15,
                mass: 1,
              }
            : undefined
        }
        className={cn(
          'h-full w-full rounded-full',
          player === 'red' && 'bg-red-500 shadow-md sm:shadow-lg',
          player === 'yellow' && 'bg-yellow-400 shadow-md sm:shadow-lg',
          player &&
            isWinning &&
            'ring-2 sm:ring-4 ring-white ring-opacity-60 shadow-lg sm:shadow-xl',
          !player && 'bg-white'
        )}
      />
    </button>
  );
}

interface BoardProps {
  gameState: GameState;
  onMove: (col: number) => void;
  disabled?: boolean;
}

export function Board({ gameState, onMove, disabled }: BoardProps) {
  const { board } = gameState;

  return (
    <div className="inline-block bg-blue-600 p-2 sm:p-4 rounded-lg shadow-2xl max-w-full">
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => {
            const isWinningCell =
              gameState.winningLine?.some(
                (pos) => pos.row === rowIndex && pos.col === colIndex
              ) || false;

            return (
              <Cell
                key={`cell-${rowIndex}-${colIndex}`}
                player={cell}
                isWinning={isWinningCell}
                onClick={() => !disabled && onMove(colIndex)}
                disabled={disabled || gameState.isGameOver}
              />
            );
          })
        )}
      </div>

      {/* Column hover indicators */}
      {!disabled && !gameState.isGameOver && (
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mt-1 sm:mt-2">
          {Array.from({ length: 7 }, (_, col) => (
            <motion.button
              key={`col-${col}`}
              onClick={() => onMove(col)}
              className="aspect-square rounded-full bg-blue-700 bg-opacity-30 hover:bg-opacity-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[20px] sm:min-h-[0] relative overflow-hidden"
              aria-label={`Place piece in column ${col + 1}`}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="absolute inset-0 bg-white opacity-0"
                whileHover={{ opacity: 0.3 }}
                transition={{ duration: 0.2 }}
              />
              <div
                className={cn(
                  'w-3 h-3 sm:w-4 sm:h-4 rounded-full mx-auto',
                  gameState.currentPlayer === 'red'
                    ? 'bg-red-500'
                    : 'bg-yellow-400'
                )}
              />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
