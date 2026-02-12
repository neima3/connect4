import { NextRequest, NextResponse } from 'next/server';
import { RoomModel, GameModel } from '@/lib/models';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const CreateRoomSchema = z.object({
  players: z.array(z.string()).optional(),
});

const JoinRoomSchema = z.object({
  playerName: z.string().min(1).max(50),
});

const UpdateRoomSchema = z.object({
  gameId: z.string().nullable().optional(),
  players: z.array(z.string()).optional(),
  gameStarted: z.boolean().optional(),
});

// GET /api/rooms - List all active rooms
export async function GET(request: NextRequest) {
  try {
    // This would need to be implemented in RoomModel
    // For now, return empty array as we don't expose all rooms for security
    return NextResponse.json({
      success: true,
      data: [],
      count: 0,
    });
  } catch (error) {
    console.error('Error fetching rooms:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

// POST /api/rooms - Create a new room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateRoomSchema.parse(body);

    // Generate a unique room code
    let code: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = generateRoomCode();
      const existingRoom = await RoomModel.findByCode(code);
      if (!existingRoom) break;
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { success: false, error: 'Could not generate unique room code' },
        { status: 500 }
      );
    }

    const room = await RoomModel.create(code, validatedData.players || []);

    return NextResponse.json(
      {
        success: true,
        data: room,
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

    console.error('Error creating room:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create room' },
      { status: 500 }
    );
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
