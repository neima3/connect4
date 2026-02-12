import { NextRequest, NextResponse } from 'next/server';
import { GameStatsModel } from '@/lib/models';
import { GameMode } from '@/types/game';
import { z } from 'zod';

const StatsQuerySchema = z.object({
  mode: z.enum(['local', 'ai', 'online']).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional()
    .default(50),
});

// GET /api/stats - Get game statistics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const validatedParams = StatsQuerySchema.parse({
      mode: searchParams.get('mode') || undefined,
      limit: searchParams.get('limit') || '50',
    });

    const mode = validatedParams.mode as GameMode | undefined;
    const limit = validatedParams.limit;

    // Get recent game stats
    const recentStats = await GameStatsModel.findByMode(mode!, limit);

    // Get summary statistics
    const summary = await GameStatsModel.getStatsSummary(mode);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        recent: recentStats,
      },
      meta: {
        mode: mode || 'all',
        count: recentStats.length,
        limit,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
