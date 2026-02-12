'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Copy, Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Room } from '@/types/game';
import { useRoom } from '@/hooks/use-api';

interface OnlineGameSetupProps {
  onStartGame: (code: string, playerNumber: 1 | 2) => void;
  onBack: () => void;
}

export function OnlineGameSetup({ onStartGame, onBack }: OnlineGameSetupProps) {
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<Room | null>(null);

  // Use API for room operations
  const {
    createRoom: apiCreateRoom,
    joinRoom: apiJoinRoom,
    loading: apiLoading,
    error: apiError,
  } = useRoom();

  const createRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const room = await apiCreateRoom([playerName.trim()]);
      setCreatedRoom(room as Room);
      setRoomCode((room as any).code);
    } catch (err: any) {
      setError(err.message || 'Failed to create room');
    } finally {
      setIsLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const room = await apiJoinRoom(roomCode.toUpperCase(), playerName.trim());

      // Start game as player 2
      onStartGame(roomCode.toUpperCase(), 2);
    } catch (err: any) {
      setError(err.message || 'Failed to join room');
    } finally {
      setIsLoading(false);
    }
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code');
    }
  };

  const checkRoomStatus = () => {
    if (!createdRoom) return;

    // For now, check localStorage for second player
    // In a real implementation, this would use WebSocket or polling
    const stored = localStorage.getItem(`room_${createdRoom.code}`);
    if (!stored) return;

    try {
      const room: Room = JSON.parse(stored);
      if (room.players.length === 2 && !room.gameStarted) {
        // Start game as player 1
        room.gameStarted = true;
        localStorage.setItem(`room_${createdRoom.code}`, JSON.stringify(room));
        onStartGame(createdRoom.code, 1);
      }
    } catch (error) {
      console.error('Error checking room status:', error);
    }
  };

  // Poll for room status changes
  useEffect(() => {
    if (!createdRoom) return;

    const interval = setInterval(checkRoomStatus, 1000);
    return () => clearInterval(interval);
  }, [createdRoom]);

  if (mode === null) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            Online Game
          </h2>

          <div className="space-y-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('create')}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-blue-500 p-4 text-white font-semibold hover:bg-blue-600 transition-colors"
            >
              <Users className="h-5 w-5" />
              Create Room
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setMode('join')}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-green-500 p-4 text-white font-semibold hover:bg-green-600 transition-colors"
            >
              <Users className="h-5 w-5" />
              Join Room
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="w-full mt-4 rounded-lg bg-gray-500 p-3 text-white font-semibold hover:bg-gray-600 transition-colors"
          >
            Back
          </motion.button>
        </div>
      </motion.div>
    );
  }

  if (mode === 'create' && createdRoom) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="rounded-2xl bg-white p-6 shadow-xl">
          <div className="text-center mb-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Room Created!
            </h2>
            <p className="text-gray-600">Share this code with your friend</p>
          </div>

          <div className="bg-gray-100 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-mono font-bold text-gray-800">
                {roomCode}
              </span>
              <button
                onClick={copyRoomCode}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                title="Copy code"
              >
                {copied ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5 text-gray-600" />
                )}
              </button>
            </div>
          </div>

          <div className="text-center mb-4">
            <p className="text-sm text-gray-600 mb-2">
              Players in room: {createdRoom.players.length}/2
            </p>
            <div className="flex justify-center gap-2">
              {createdRoom.players.map((player, i) => (
                <span
                  key={i}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {player}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Waiting for opponent...</span>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            className="w-full mt-6 rounded-lg bg-gray-500 p-3 text-white font-semibold hover:bg-gray-600 transition-colors"
          >
            Cancel
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md"
    >
      <div className="rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          {mode === 'create' ? 'Create Room' : 'Join Room'}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={20}
            />
          </div>

          {mode === 'join' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Enter 6-character code"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-center text-lg"
                maxLength={6}
              />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={mode === 'create' ? createRoom : joinRoom}
              disabled={isLoading}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg p-3 font-semibold transition-colors',
                mode === 'create'
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-green-500 text-white hover:bg-green-600',
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {mode === 'create' ? 'Create Room' : 'Join Room'}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setMode(null);
                setError('');
                setPlayerName('');
                setRoomCode('');
                setCreatedRoom(null);
              }}
              className="rounded-lg bg-gray-500 px-6 py-3 text-white font-semibold hover:bg-gray-600 transition-colors"
            >
              Back
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
