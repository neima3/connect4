'use client'

import type { GameState, GameMode } from '@/types/game'

interface GameStatusProps {
  gameState: GameState
  gameMode: GameMode
  roomCode: string
  isMyTurn: boolean
  onReset: () => void
  onBackToMenu: () => void
}

export default function GameStatus({
  gameState,
  gameMode,
  roomCode,
  isMyTurn,
  onReset,
  onBackToMenu
}: GameStatusProps) {
  const getStatusMessage = () => {
    if (gameState.winner) {
      return (
        <span className="flex items-center gap-2">
          <span className={`inline-block w-6 h-6 rounded-full ${
            gameState.winner === 'red' ? 'bg-red-500' : 'bg-yellow-400'
          }`} />
          {gameState.winner === 'red' ? 'Red' : 'Yellow'} Player Wins!
        </span>
      )
    }
    
    if (gameState.isDraw) {
      return "It's a Draw!"
    }
    
    if (gameMode === 'online') {
      return (
        <span className="flex items-center gap-2">
          {isMyTurn ? '🟢' : '🔴'} 
          {isMyTurn ? 'Your Turn' : "Opponent's Turn"}
        </span>
      )
    }
    
    return (
      <span className="flex items-center gap-2">
        <span className={`inline-block w-6 h-6 rounded-full ${
          gameState.currentPlayer === 'red' ? 'bg-red-500' : 'bg-yellow-400'
        }`} />
        {gameState.currentPlayer === 'red' ? 'Red' : 'Yellow'}'s Turn
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-lg font-semibold text-gray-800">
          {getStatusMessage()}
        </div>
        
        <div className="flex gap-2">
          {gameState.isGameOver && (
            <button
              onClick={onReset}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded transition-colors duration-200"
            >
              🔄 Play Again
            </button>
          )}
          
          <button
            onClick={onBackToMenu}
            className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors duration-200"
          >
            🏠 Menu
          </button>
        </div>
      </div>
      
      {gameMode === 'online' && roomCode && (
        <div className="mt-4 p-3 bg-gray-100 rounded-lg">
          <div className="text-sm text-gray-600">Room Code</div>
          <div className="font-mono font-bold text-lg text-gray-800">{roomCode}</div>
        </div>
      )}
      
      <div className="mt-4 flex justify-between text-sm text-gray-600">
        <span>Moves: {gameState.moveCount}</span>
        <span>Mode: {gameMode.charAt(0).toUpperCase() + gameMode.slice(1)}</span>
      </div>
    </div>
  )
}