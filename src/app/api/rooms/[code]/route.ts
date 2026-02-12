import { NextRequest, NextResponse } from 'next/server';
import { RoomModel, GameModel } from '@/lib/models';
import { z } from 'zod';

const JoinRoomSchema = z.object({
  playerName: z.string().min(1).max(50),
});

const UpdateRoomSchema = z.object({
  gameId: z.string().nullable().optional(),
  players: z.array(z.string()).optional(),
  gameStarted: z.boolean().optional(),
});

// GET /api/rooms/[code] - Get a specific room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await RoomModel.findByCode(code.toUpperCase());

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    // If room has a game, include game data
    let gameData = null;
    if (room.gameId) {
      gameData = await GameModel.findById(room.gameId);
    }

    return NextResponse.json({
      success: true,
      data: {
        ...room,
        game: gameData,
      },
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch room' },
      { status: 500 }
    );
  }
}

// PUT /api/rooms/[code] - Update a room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const body = await request.json();
    const validatedData = UpdateRoomSchema.parse(body);

    const updatedRoom = await RoomModel.update(
      code.toUpperCase(),
      validatedData
    );

    if (!updatedRoom) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedRoom,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error updating room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update room' },
      { status: 500 }
    );
  }
}

// DELETE /api/rooms/[code] - Delete a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const success = await RoomModel.delete(code.toUpperCase());

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Room deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete room' },
      { status: 500 }
    );
  }
}

// POST /api/rooms/[code]/join - Join a room
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await RoomModel.findByCode(code.toUpperCase());

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    if (room.gameStarted) {
      return NextResponse.json(
        { success: false, error: 'Game has already started' },
        { status: 400 }
      );
    }

    if (room.players.length >= 2) {
      return NextResponse.json(
        { success: false, error: 'Room is full' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = JoinRoomSchema.parse(body);

    // Check if player name is already taken
    if (room.players.includes(validatedData.playerName)) {
      return NextResponse.json(
        { success: false, error: 'Player name already taken' },
        { status: 400 }
      );
    }

    // Add player to room
    const updatedPlayers = [...room.players, validatedData.playerName];
    const updatedRoom = await RoomModel.update(code.toUpperCase(), {
      players: updatedPlayers,
    });

    // If room is now full, create a game and start it
    let game = null;
    if (updatedPlayers.length === 2 && updatedRoom) {
      game = await GameModel.create('online');
      await RoomModel.update(code.toUpperCase(), {
        gameId: game.id,
        gameStarted: true,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        room: updatedRoom,
        game,
        playerNumber: updatedPlayers.length, // 1 for first player, 2 for second
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Error joining room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to join room' },
      { status: 500 }
    );
  }
}

// PATCH /api/rooms/[code]/start - Start the game in a room
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const room = await RoomModel.findByCode(code.toUpperCase());

    if (!room) {
      return NextResponse.json(
        { success: false, error: 'Room not found' },
        { status: 404 }
      );
    }

    if (room.players.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Need at least 2 players to start' },
        { status: 400 }
      );
    }

    if (room.gameStarted) {
      return NextResponse.json(
        { success: false, error: 'Game already started' },
        { status: 400 }
      );
    }

    // Create a new game
    const game = await GameModel.create('online');

    // Update room with game ID and start flag
    const updatedRoom = await RoomModel.update(code.toUpperCase(), {
      gameId: game.id,
      gameStarted: true,
    });

    return NextResponse.json({
      success: true,
      data: {
        room: updatedRoom,
        game,
      },
    });
  } catch (error) {
    console.error('Error starting game:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start game' },
      { status: 500 }
    );
  }
}
