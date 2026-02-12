'use client';

import { motion } from 'framer-motion';
import { Trophy, Target, Clock, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GameStats {
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalMoves: number;
  averageGameTime: number;
  currentStreak: number;
  bestStreak: number;
}

interface StatsDisplayProps {
  stats: GameStats;
  className?: string;
}

export function StatsDisplay({ stats, className }: StatsDisplayProps) {
  const winRate =
    stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-white rounded-lg p-4 shadow-lg border border-gray-200',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-500" />
        <h3 className="text-lg font-semibold text-gray-800">Game Statistics</h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">
            {stats.gamesPlayed}
          </div>
          <div className="text-sm text-gray-600">Games Played</div>
        </div>

        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{stats.wins}</div>
          <div className="text-sm text-gray-600">Wins</div>
        </div>

        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{stats.losses}</div>
          <div className="text-sm text-gray-600">Losses</div>
        </div>

        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-600">{stats.draws}</div>
          <div className="text-sm text-gray-600">Draws</div>
        </div>

        <div className="text-center p-3 bg-purple-50 rounded-lg col-span-2">
          <div className="text-2xl font-bold text-purple-600">
            {winRate.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Win Rate</div>
        </div>

        <div className="text-center p-3 bg-yellow-50 rounded-lg col-span-2">
          <div className="flex items-center justify-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span className="text-2xl font-bold text-yellow-600">
              {stats.currentStreak}
            </span>
            <span className="text-sm text-gray-600">
              / {stats.bestStreak} best
            </span>
          </div>
          <div className="text-sm text-gray-600">Current Streak</div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-gray-500" />
          <div>
            <div className="text-sm font-medium text-gray-700">
              {stats.totalMoves}
            </div>
            <div className="text-xs text-gray-500">Total Moves</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-gray-500" />
          <div>
            <div className="text-sm font-medium text-gray-700">
              {stats.averageGameTime}s
            </div>
            <div className="text-xs text-gray-500">Avg. Game Time</div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
