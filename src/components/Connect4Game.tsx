'use client'

import { useState, useEffect } from 'react'
import GameBoard from './GameBoard'
import GameControls from './GameControls'
import GameStatus from './GameStatus'
import type { GameState, Player, GameMode } from '@/types/game'

const initialGameState: GameState = {
  board: Array(6).fill(null).map(() => Array(7).fill(null)),
  currentPlayer: 'red',
  winner: null,
  isDraw: false,
  isGameOver: false,
  moveCount: 0,
}

export default function Connect4Game() {
  const [gameState, setGameState] = useState<GameState>(initialGameState)
  const [gameMode, setGameMode] = useState<GameMode>('menu')
  const [roomCode, setRoomCode] = useState('')
  const [isMyTurn, setIsMyTurn] = useState(true)

  const startNewGame = (mode: GameMode, code?: string) => {
    setGameState(initialGameState)
    setGameMode(mode)
    setRoomCode(code || '')
    setIsMyTurn(true)
  }

  const resetGame = () => {
    setGameState(initialGameState)
    setIsMyTurn(true)
  }

  const makeMove = (column: number) => {
    if (gameState.isGameOver) return
    if (!isMyTurn && gameMode === 'online') return

    const newBoard = gameState.board.map((row: (Player | null)[]) => [...row])
    
    // Find the lowest available row in the column
    for (let row = 5; row >= 0; row--) {
      if (!newBoard[row][column]) {
        newBoard[row][column] = gameState.currentPlayer
        break
      }
    }

    const winner = checkWinner(newBoard)
    const isDraw = !winner && gameState.moveCount + 1 === 42

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: gameState.currentPlayer === 'red' ? 'yellow' : 'red',
      winner,
      isDraw,
      isGameOver: !!winner || isDraw,
      moveCount: gameState.moveCount + 1,
    })

    // Handle turn switching for online mode
    if (gameMode === 'online') {
      setIsMyTurn(!isMyTurn)
    }
  }

  const checkWinner = (board: (Player | null)[][]): Player | null => {
    // Check horizontal
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col <= 3; col++) {
        const player = board[row][col]
        if (player && 
            board[row][col + 1] === player && 
            board[row][col + 2] === player && 
            board[row][col + 3] === player) {
          return player
        }
      }
    }

    // Check vertical
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= 2; row++) {
        const player = board[row][col]
        if (player && 
            board[row + 1][col] === player && 
            board[row + 2][col] === player && 
            board[row + 3][col] === player) {
          return player
        }
      }
    }

    // Check diagonal (top-left to bottom-right)
    for (let row = 0; row <= 2; row++) {
      for (let col = 0; col <= 3; col++) {
        const player = board[row][col]
        if (player && 
            board[row + 1][col + 1] === player && 
            board[row + 2][col + 2] === player && 
            board[row + 3][col + 3] === player) {
          return player
        }
      }
    }

    // Check diagonal (bottom-left to top-right)
    for (let row = 3; row <= 5; row++) {
      for (let col = 0; col <= 3; col++) {
        const player = board[row][col]
        if (player && 
            board[row - 1][col + 1] === player && 
            board[row - 2][col + 2] === player && 
            board[row - 3][col + 3] === player) {
          return player
        }
      }
    }

    return null
  }

  const handleAIGame = () => {
    startNewGame('ai')
    
    // Make AI move after player moves
    setTimeout(() => {
      if (gameState.currentPlayer === 'yellow' && gameMode === 'ai' && !gameState.isGameOver) {
        // Simple AI: pick a random valid column
        const validColumns = []
        for (let col = 0; col < 7; col++) {
          if (gameState.board[0][col] === null) {
            validColumns.push(col)
          }
        }
        if (validColumns.length > 0) {
          const randomColumn = validColumns[Math.floor(Math.random() * validColumns.length)]
          makeMove(randomColumn)
        }
      }
    }, 500)
  }

  return (
    <div className="max-w-4xl mx-auto">
      {gameMode === 'menu' ? (
        <GameControls 
          onStartAI={handleAIGame}
          onStartLocal={() => startNewGame('local')}
          onStartOnline={() => startNewGame('online')}
        />
      ) : (
        <>
          <GameStatus 
            gameState={gameState}
            gameMode={gameMode}
            roomCode={roomCode}
            isMyTurn={isMyTurn}
            onReset={resetGame}
            onBackToMenu={() => setGameMode('menu')}
          />
          <GameBoard 
            board={gameState.board}
            onMove={makeMove}
            disabled={gameState.isGameOver || (gameMode === 'online' && !isMyTurn)}
          />
        </>
      )}
    </div>
  )
}