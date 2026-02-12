import { NextRequest, NextResponse } from 'next/server';
import { GameModel, MoveModel } from '@/lib/models';
import { getAIMove, makeMove } from '@/lib/game-logic';
import { z } from 'zod';

const DifficultySchema = z.object({
  difficulty: z.enum(['easy', 'medium', 'hard']).optional().default('medium'),
});

// POST /api/games/[id]/ai-move - Make an AI move
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // First check if game exists and is in AI mode
    const game = await GameModel.findById(id);
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.mode !== 'ai') {
      return NextResponse.json(
        { success: false, error: 'This is not an AI game' },
        { status: 400 }
      );
    }

    if (game.isGameOver) {
      return NextResponse.json(
        { success: false, error: 'Game is already over' },
        { status: 400 }
      );
    }

    if (game.currentPlayer !== 'yellow') {
      return NextResponse.json(
        { success: false, error: 'Not AI turn' },
        { status: 400 }
      );
    }

    // Parse optional difficulty parameter
    const body = await request.json().catch(() => ({}));
    const { difficulty } = DifficultySchema.parse(body);

    // Convert game data to game state format
    const gameState = {
      board: game.boardState,
      currentPlayer: game.currentPlayer,
      winner: game.winner,
      isDraw: game.isDraw,
      isGameOver: game.isGameOver,
      moveCount: game.moveCount,
      status: game.status,
      winningLine: game.winningLine,
    };

    // Get AI move
    const aiColumn = getAIMove(gameState);

    if (aiColumn === -1) {
      return NextResponse.json(
        { success: false, error: 'No valid moves available' },
        { status: 400 }
      );
    }

    // Make the move
    const moveResult = makeMove(gameState, aiColumn);

    if (!moveResult.position) {
      return NextResponse.json(
        { success: false, error: 'Invalid move' },
        { status: 400 }
      );
    }

    // Create the move record
    const move = await MoveModel.create(
      id,
      aiColumn,
      'yellow',
      moveResult.position.row
    );

    // Update game state
    const updatedGame = await GameModel.update(id, {
      status: moveResult.gameState.status,
      currentPlayer: moveResult.gameState.currentPlayer,
      winner: moveResult.gameState.winner,
      isDraw: moveResult.gameState.isDraw,
      isGameOver: moveResult.gameState.isGameOver,
      moveCount: moveResult.gameState.moveCount,
      boardState: moveResult.gameState.board,
      winningLine: moveResult.gameState.winningLine,
      finishedAt: moveResult.gameState.isGameOver ? new Date() : undefined,
    });

    if (!updatedGame) {
      return NextResponse.json(
        { success: false, error: 'Failed to update game' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        move,
        game: updatedGame,
        column: aiColumn,
        row: moveResult.position.row,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error making AI move:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to make AI move' },
      { status: 500 }
    );
  }
}
