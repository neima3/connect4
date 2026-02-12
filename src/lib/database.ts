import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (db) return db;

  const dbPath = path.join(process.cwd(), 'data', 'connect4.db');

  // Ensure data directory exists
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Initialize tables
  await initializeTables(db);

  return db;
}

async function initializeTables(database: Database) {
  // Games table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('local', 'ai', 'online')),
      status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'won', 'draw')),
      current_player TEXT NOT NULL CHECK (current_player IN ('red', 'yellow')),
      winner TEXT CHECK (winner IN ('red', 'yellow')),
      is_draw BOOLEAN DEFAULT FALSE,
      is_game_over BOOLEAN DEFAULT FALSE,
      move_count INTEGER DEFAULT 0,
      board_state TEXT NOT NULL, -- JSON string of 2D array
      winning_line TEXT, -- JSON string of positions array
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      finished_at DATETIME
    )
  `);

  // Online rooms table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      code TEXT PRIMARY KEY,
      game_id TEXT,
      players TEXT NOT NULL, -- JSON array of player names
      game_started BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL
    )
  `);

  // Moves table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS moves (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      column INTEGER NOT NULL CHECK (column >= 0 AND column <= 6),
      player TEXT NOT NULL CHECK (player IN ('red', 'yellow')),
      row INTEGER NOT NULL CHECK (row >= 0 AND row <= 5),
      timestamp INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  // Game stats table
  await database.exec(`
    CREATE TABLE IF NOT EXISTS game_stats (
      id TEXT PRIMARY KEY,
      game_id TEXT NOT NULL,
      player_red TEXT,
      player_yellow TEXT,
      winner TEXT,
      total_moves INTEGER NOT NULL,
      game_duration INTEGER, -- in seconds
      mode TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  await database.exec(`
    CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
    CREATE INDEX IF NOT EXISTS idx_games_mode ON games(mode);
    CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
    CREATE INDEX IF NOT EXISTS idx_rooms_game_id ON rooms(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_stats_mode ON game_stats(mode);
  `);
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}
