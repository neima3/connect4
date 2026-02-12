'use client'

import type { Player } from '@/types/game'

interface GameBoardProps {
  board: (Player | null)[][]
  onMove: (column: number) => void
  disabled?: boolean
}

export default function GameBoard({ board, onMove, disabled = false }: GameBoardProps) {
  const handleColumnClick = (column: number) => {
    if (disabled) return
    if (board[0][column] !== null) return // Column is full
    
    onMove(column)
  }

  return (
    <div className="game-board max-w-2xl mx-auto">
      <div className="grid grid-cols-7 gap-2">
        {board[0].map((_, columnIndex) => (
          <button
            key={columnIndex}
            className={`game-column rounded-md p-1 transition-all ${
              disabled ? 'cursor-not-allowed' : 'hover:bg-blue-500'
            }`}
            onClick={() => handleColumnClick(columnIndex)}
            disabled={disabled}
            aria-label={`Drop disc in column ${columnIndex + 1}`}
          >
            <div className="space-y-2">
              {board.map((row, rowIndex) => (
                <div key={rowIndex} className="game-cell relative overflow-hidden">
                  {row[columnIndex] && (
                    <div 
                      className={`player-disc absolute inset-0 ${
                        row[columnIndex] === 'red' ? 'player-disc-red' : 'player-disc-yellow'
                      }`}
                      style={{
                        animation: `dropIn 0.5s ease-out ${rowIndex * 0.1}s both`
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}