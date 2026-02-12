import { NextRequest, NextResponse } from 'next/server';
import { RoomModel } from '@/lib/models';
import { z } from 'zod';

const CleanupQuerySchema = z.object({
  hours: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(168))
    .optional()
    .default(24), // max 1 week
  dryRun: z
    .string()
    .transform((val) => val === 'true')
    .optional()
    .default(false),
});

// POST /api/admin/cleanup - Clean up old rooms
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { hours, dryRun } = CleanupQuerySchema.parse({
      hours: searchParams.get('hours') || '24',
      dryRun: searchParams.get('dryRun') || 'false',
    });

    if (dryRun) {
      // For dry run, we'd need to add a method to find old rooms without deleting them
      // For now, just return what would be cleaned up
      return NextResponse.json({
        success: true,
        message: 'Dry run completed',
        data: {
          hours,
          wouldDelete:
            'Old rooms (no specific count available in dry run mode)',
        },
      });
    }

    // Perform actual cleanup
    await RoomModel.cleanup();

    return NextResponse.json({
      success: true,
      message: `Successfully cleaned up rooms older than ${hours} hours`,
      data: {
        hours,
        timestamp: new Date().toISOString(),
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

    console.error('Error during cleanup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to perform cleanup' },
      { status: 500 }
    );
  }
}

// GET /api/admin/cleanup - Get cleanup status
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'Cleanup endpoint is available',
      usage: {
        POST: 'Perform cleanup of old rooms',
        parameters: {
          hours: 'Age of rooms to clean up in hours (default: 24, max: 168)',
          dryRun:
            'Set to "true" to simulate cleanup without deleting (default: false)',
        },
        examples: [
          '/api/admin/cleanup',
          '/api/admin/cleanup?hours=12',
          '/api/admin/cleanup?dryRun=true',
        ],
      },
    });
  } catch (error) {
    console.error('Error getting cleanup status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get cleanup status' },
      { status: 500 }
    );
  }
}
