import { NextRequest, NextResponse } from 'next/server';
import { GameModel } from '@/lib/models';
import { GameMode, GameStateStatus } from '@/types/game';
import { z } from 'zod';
import {
  handleAPIError,
  validateRequestBody,
  successResponse,
  createdResponse,
  ValidationError,
} from '@/lib/api-utils';

const CreateGameSchema = z.object({
  mode: z.enum(['local', 'ai', 'online']),
});

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

// GET /api/games - List all games or filter by mode/status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') as GameMode | null;
    const status = searchParams.get('status') as GameStateStatus | null;

    let games;
    if (mode) {
      games = await GameModel.findByMode(mode);
    } else if (status) {
      games = await GameModel.findByStatus(status);
    } else {
      // Return all recent games (limit to 50 for performance)
      games = await GameModel.findAll(50);
    }

    return successResponse(games, { count: games.length });
  } catch (error) {
    return handleAPIError(error);
  }
}

// POST /api/games - Create a new game
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateRequestBody(CreateGameSchema, body);

    const game = await GameModel.create(validatedData.mode);

    return createdResponse(game);
  } catch (error) {
    return handleAPIError(error);
  }
}
