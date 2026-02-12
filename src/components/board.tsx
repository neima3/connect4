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
        'aspect-square rounded-full border-2 border-blue-300 bg-blue-50 p-1 transition-all duration-200',
        'hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-400',
        player && 'cursor-not-allowed',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <motion.div
        initial={player ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={cn(
          'h-full w-full rounded-full',
          player === 'red' && 'bg-red-500 shadow-lg',
          player === 'yellow' && 'bg-yellow-400 shadow-lg',
          player &&
            isWinning &&
            'animate-pulse ring-4 ring-white ring-opacity-60',
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
    <div className="inline-block bg-blue-600 p-4 rounded-lg shadow-2xl">
      <div className="grid grid-cols-7 gap-2">
        {board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <Cell
              key={`cell-${rowIndex}-${colIndex}`}
              player={cell}
              onClick={() => !disabled && onMove(colIndex)}
              disabled={disabled || gameState.isGameOver}
            />
          ))
        )}
      </div>

      {/* Column hover indicators */}
      {!disabled && !gameState.isGameOver && (
        <div className="grid grid-cols-7 gap-2 mt-2">
          {Array.from({ length: 7 }, (_, col) => (
            <button
              key={`col-${col}`}
              onClick={() => onMove(col)}
              className="aspect-square rounded-full bg-blue-700 bg-opacity-30 hover:bg-opacity-50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label={`Place piece in column ${col + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
