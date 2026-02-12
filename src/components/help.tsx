'use client';

import { motion } from 'framer-motion';
import { X, HelpCircle, Trophy, Users, Cpu, Globe } from 'lucide-react';

interface HelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Help({ isOpen, onClose }: HelpProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-gray-800">
              How to Play Connect 4
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100 transition-colors"
            aria-label="Close help"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-6 text-gray-600">
          <section>
            <h3 className="font-semibold text-gray-800 mb-2">Objective</h3>
            <p>
              Connect 4 of your colored discs in a row - horizontally,
              vertically, or diagonally before your opponent does!
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2">How to Play</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Choose your game mode from the main menu</li>
              <li>Click on any column to drop your disc</li>
              <li>Discs fall to the lowest available position in the column</li>
              <li>Players take turns alternating between red and yellow</li>
              <li>First to connect 4 discs in a row wins!</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-3">Game Modes</h3>
            <div className="grid gap-4">
              <div className="flex items-start gap-3">
                <Users className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <strong className="text-gray-800">Local Game:</strong>
                  <p className="text-sm">
                    Play with a friend on the same device. Take turns using the
                    same screen.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Cpu className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <strong className="text-gray-800">vs Computer:</strong>
                  <p className="text-sm">
                    Challenge our AI opponent. The computer plays as yellow and
                    you play as red.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <strong className="text-gray-800">Online Game:</strong>
                  <p className="text-sm">
                    Play with friends remotely. Share a game code and connect
                    from anywhere.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2">Strategy Tips</h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Control the center columns - they offer more winning
                opportunities
              </li>
              <li>Block your opponent's potential winning moves</li>
              <li>Look for multiple ways to win on your next turn</li>
              <li>Plan ahead - think 2-3 moves in advance</li>
              <li>Remember that diagonals can be easy to miss!</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 mb-2">Controls</h3>
            <ul className="space-y-1">
              <li>
                <strong>Mouse/Touch:</strong> Click on any column to place your
                disc
              </li>
              <li>
                <strong>Keyboard:</strong> Use number keys 1-7 to select columns
                (coming soon)
              </li>
              <li>
                <strong>New Game:</strong> Start fresh at any time
              </li>
              <li>
                <strong>Menu:</strong> Return to game mode selection
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
          <p>Enjoy playing Connect 4! 🎮</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
