import { NextRequest, NextResponse } from 'next/server';
import { GameModel, MoveModel, GameStatsModel } from '@/lib/models';
import { z } from 'zod';

const UpdateGameSchema = z.object({
  status: z.enum(['waiting', 'playing', 'won', 'draw']).optional(),
  currentPlayer: z.enum(['red', 'yellow']).optional(),
  winner: z.enum(['red', 'yellow']).nullable().optional(),
  isDraw: z.boolean().optional(),
  isGameOver: z.boolean().optional(),
  moveCount: z.number().int().min(0).optional(),
  boardState: z.array(z.array(z.enum(['red', 'yellow']).nullable())).optional(),
  winningLine: z
    .array(
      z.object({
        row: z.number().int(),
        col: z.number().int(),
      })
    )
    .nullable()
    .optional(),
});

const MakeMoveSchema = z.object({
  column: z.number().int().min(0).max(6),
  player: z.enum(['red', 'yellow']),
  row: z.number().int().min(0).max(5),
});

// GET /api/games/[id] - Get a specific game
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const game = await GameModel.findById(id);

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Get moves for this game
    const moves = await MoveModel.findByGameId(id);

    return NextResponse.json({
      success: true,
      data: {
        ...game,
        moves,
      },
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch game' },
      { status: 500 }
    );
  }
}

// PUT /api/games/[id] - Update a game
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const validatedData = UpdateGameSchema.parse(body);

    const updatedGame = await GameModel.update(id, validatedData);

    if (!updatedGame) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // If game is finished, create stats record
    if (
      validatedData.isGameOver &&
      (validatedData.winner || validatedData.isDraw)
    ) {
      const gameDuration = updatedGame.finishedAt
        ? Math.floor(
            (updatedGame.finishedAt.getTime() -
              updatedGame.createdAt.getTime()) /
              1000
          )
        : null;

      await GameStatsModel.create(
        updatedGame.id,
        null, // player names would be set for online games
        null,
        updatedGame.winner,
        updatedGame.moveCount,
        gameDuration,
        updatedGame.mode
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedGame,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update game' },
      { status: 500 }
    );
  }
}

// DELETE /api/games/[id] - Delete a game
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const success = await GameModel.delete(id);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    // Also delete associated moves
    await MoveModel.deleteByGameId(id);

    return NextResponse.json({
      success: true,
      message: 'Game deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete game' },
      { status: 500 }
    );
  }
}

// POST /api/games/[id]/moves - Make a move in a game
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // First check if game exists
    const game = await GameModel.findById(id);
    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      );
    }

    if (game.isGameOver) {
      return NextResponse.json(
        { success: false, error: 'Game is already over' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = MakeMoveSchema.parse(body);

    // Create the move
    const move = await MoveModel.create(
      id,
      validatedData.column,
      validatedData.player,
      validatedData.row
    );

    // Update game state (move count, current player)
    const nextPlayer = validatedData.player === 'red' ? 'yellow' : 'red';
    await GameModel.update(id, {
      moveCount: game.moveCount + 1,
      currentPlayer: nextPlayer,
    });

    return NextResponse.json(
      {
        success: true,
        data: move,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error making move:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to make move' },
      { status: 500 }
    );
  }
}
