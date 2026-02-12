import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import {
  Player,
  GameMode,
  GameStateStatus,
  GameState,
  Position,
  Move,
} from '../types/game';

export interface GameData {
  id: string;
  mode: GameMode;
  status: GameStateStatus;
  currentPlayer: Player;
  winner: Player | null;
  isDraw: boolean;
  isGameOver: boolean;
  moveCount: number;
  boardState: (Player | null)[][];
  winningLine: Position[] | null;
  createdAt: Date;
  updatedAt: Date;
  finishedAt?: Date;
}

export interface RoomData {
  code: string;
  gameId: string | null;
  players: string[];
  gameStarted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MoveData {
  id: string;
  gameId: string;
  column: number;
  player: Player;
  row: number;
  timestamp: number;
  createdAt: Date;
}

export interface GameStatsData {
  id: string;
  gameId: string;
  playerRed: string | null;
  playerYellow: string | null;
  winner: Player | null;
  totalMoves: number;
  gameDuration: number | null;
  mode: GameMode;
  createdAt: Date;
}

export class GameModel {
  static async create(mode: GameMode): Promise<GameData> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date();

    // Initialize empty board
    const boardState: (Player | null)[][] = Array(6)
      .fill(null)
      .map(() => Array(7).fill(null));

    const game: GameData = {
      id,
      mode,
      status: 'waiting',
      currentPlayer: 'red',
      winner: null,
      isDraw: false,
      isGameOver: false,
      moveCount: 0,
      boardState,
      winningLine: null,
      createdAt: now,
      updatedAt: now,
    };

    await db.run(
      `INSERT INTO games (
        id, mode, status, current_player, winner, is_draw, is_game_over,
        move_count, board_state, winning_line, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        game.id,
        game.mode,
        game.status,
        game.currentPlayer,
        game.winner,
        game.isDraw ? 1 : 0,
        game.isGameOver ? 1 : 0,
        game.moveCount,
        JSON.stringify(game.boardState),
        JSON.stringify(game.winningLine),
        game.createdAt.toISOString(),
        game.updatedAt.toISOString(),
      ]
    );

    return game;
  }

  static async findById(id: string): Promise<GameData | null> {
    const db = await getDatabase();

    const row = await db.get('SELECT * FROM games WHERE id = ?', [id]);
    if (!row) return null;

    return this.mapRowToGame(row);
  }

  static async update(
    id: string,
    updates: Partial<Omit<GameData, 'id' | 'createdAt'>>
  ): Promise<GameData | null> {
    const db = await getDatabase();
    const now = new Date();

    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.status !== undefined) {
      setParts.push('status = ?');
      values.push(updates.status);
    }
    if (updates.currentPlayer !== undefined) {
      setParts.push('current_player = ?');
      values.push(updates.currentPlayer);
    }
    if (updates.winner !== undefined) {
      setParts.push('winner = ?');
      values.push(updates.winner);
    }
    if (updates.isDraw !== undefined) {
      setParts.push('is_draw = ?');
      values.push(updates.isDraw ? 1 : 0);
    }
    if (updates.isGameOver !== undefined) {
      setParts.push('is_game_over = ?');
      values.push(updates.isGameOver ? 1 : 0);
    }
    if (updates.moveCount !== undefined) {
      setParts.push('move_count = ?');
      values.push(updates.moveCount);
    }
    if (updates.boardState !== undefined) {
      setParts.push('board_state = ?');
      values.push(JSON.stringify(updates.boardState));
    }
    if (updates.winningLine !== undefined) {
      setParts.push('winning_line = ?');
      values.push(JSON.stringify(updates.winningLine));
    }
    if (updates.finishedAt !== undefined) {
      setParts.push('finished_at = ?');
      values.push(updates.finishedAt.toISOString());
    }

    setParts.push('updated_at = ?');
    values.push(now.toISOString());
    values.push(id);

    await db.run(
      `UPDATE games SET ${setParts.join(', ')} WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM games WHERE id = ?', [id]);
    return (result.changes || 0) > 0;
  }

  static async findByStatus(status: GameStateStatus): Promise<GameData[]> {
    const db = await getDatabase();
    const rows = await db.all(
      'SELECT * FROM games WHERE status = ? ORDER BY created_at DESC',
      [status]
    );
    return rows.map((row) => this.mapRowToGame(row));
  }

  static async findByMode(mode: GameMode): Promise<GameData[]> {
    const db = await getDatabase();
    const rows = await db.all(
      'SELECT * FROM games WHERE mode = ? ORDER BY created_at DESC',
      [mode]
    );
    return rows.map((row) => this.mapRowToGame(row));
  }

  static async findAll(limit: number = 50): Promise<GameData[]> {
    const db = await getDatabase();
    const rows = await db.all(
      'SELECT * FROM games ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return rows.map((row) => this.mapRowToGame(row));
  }

  private static mapRowToGame(row: any): GameData {
    return {
      id: row.id,
      mode: row.mode,
      status: row.status,
      currentPlayer: row.current_player,
      winner: row.winner,
      isDraw: Boolean(row.is_draw),
      isGameOver: Boolean(row.is_game_over),
      moveCount: row.move_count,
      boardState: JSON.parse(row.board_state),
      winningLine: row.winning_line ? JSON.parse(row.winning_line) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : undefined,
    };
  }
}

export class RoomModel {
  static async create(code: string, players: string[] = []): Promise<RoomData> {
    const db = await getDatabase();
    const now = new Date();

    const room: RoomData = {
      code,
      gameId: null,
      players,
      gameStarted: false,
      createdAt: now,
      updatedAt: now,
    };

    await db.run(
      `INSERT INTO rooms (code, game_id, players, game_started, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        room.code,
        room.gameId,
        JSON.stringify(room.players),
        room.gameStarted ? 1 : 0,
        room.createdAt.toISOString(),
        room.updatedAt.toISOString(),
      ]
    );

    return room;
  }

  static async findByCode(code: string): Promise<RoomData | null> {
    const db = await getDatabase();

    const row = await db.get('SELECT * FROM rooms WHERE code = ?', [code]);
    if (!row) return null;

    return this.mapRowToRoom(row);
  }

  static async update(
    code: string,
    updates: Partial<Omit<RoomData, 'code' | 'createdAt'>>
  ): Promise<RoomData | null> {
    const db = await getDatabase();
    const now = new Date();

    const setParts: string[] = [];
    const values: any[] = [];

    if (updates.gameId !== undefined) {
      setParts.push('game_id = ?');
      values.push(updates.gameId);
    }
    if (updates.players !== undefined) {
      setParts.push('players = ?');
      values.push(JSON.stringify(updates.players));
    }
    if (updates.gameStarted !== undefined) {
      setParts.push('game_started = ?');
      values.push(updates.gameStarted ? 1 : 0);
    }

    setParts.push('updated_at = ?');
    values.push(now.toISOString());
    values.push(code);

    await db.run(
      `UPDATE rooms SET ${setParts.join(', ')} WHERE code = ?`,
      values
    );

    return this.findByCode(code);
  }

  static async delete(code: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM rooms WHERE code = ?', [code]);
    return (result.changes || 0) > 0;
  }

  static async cleanup(): Promise<void> {
    const db = await getDatabase();
    // Delete rooms older than 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await db.run('DELETE FROM rooms WHERE created_at < ?', [
      cutoff.toISOString(),
    ]);
  }

  private static mapRowToRoom(row: any): RoomData {
    return {
      code: row.code,
      gameId: row.game_id,
      players: JSON.parse(row.players),
      gameStarted: Boolean(row.game_started),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export class MoveModel {
  static async create(
    gameId: string,
    column: number,
    player: Player,
    row: number
  ): Promise<MoveData> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date();
    const timestamp = Date.now();

    const move: MoveData = {
      id,
      gameId,
      column,
      player,
      row,
      timestamp,
      createdAt: now,
    };

    await db.run(
      `INSERT INTO moves (id, game_id, column, player, row, timestamp, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        move.id,
        move.gameId,
        move.column,
        move.player,
        move.row,
        move.timestamp,
        move.createdAt.toISOString(),
      ]
    );

    return move;
  }

  static async findByGameId(gameId: string): Promise<MoveData[]> {
    const db = await getDatabase();
    const rows = await db.all(
      'SELECT * FROM moves WHERE game_id = ? ORDER BY timestamp ASC',
      [gameId]
    );
    return rows.map((row) => this.mapRowToMove(row));
  }

  static async deleteByGameId(gameId: string): Promise<boolean> {
    const db = await getDatabase();
    const result = await db.run('DELETE FROM moves WHERE game_id = ?', [
      gameId,
    ]);
    return (result.changes || 0) > 0;
  }

  private static mapRowToMove(row: any): MoveData {
    return {
      id: row.id,
      gameId: row.game_id,
      column: row.column,
      player: row.player,
      row: row.row,
      timestamp: row.timestamp,
      createdAt: new Date(row.created_at),
    };
  }
}

export class GameStatsModel {
  static async create(
    gameId: string,
    playerRed: string | null,
    playerYellow: string | null,
    winner: Player | null,
    totalMoves: number,
    gameDuration: number | null,
    mode: GameMode
  ): Promise<GameStatsData> {
    const db = await getDatabase();
    const id = uuidv4();
    const now = new Date();

    const stats: GameStatsData = {
      id,
      gameId,
      playerRed,
      playerYellow,
      winner,
      totalMoves,
      gameDuration,
      mode,
      createdAt: now,
    };

    await db.run(
      `INSERT INTO game_stats (id, game_id, player_red, player_yellow, winner, total_moves, game_duration, mode, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stats.id,
        stats.gameId,
        stats.playerRed,
        stats.playerYellow,
        stats.winner,
        stats.totalMoves,
        stats.gameDuration,
        stats.mode,
        stats.createdAt.toISOString(),
      ]
    );

    return stats;
  }

  static async findByMode(
    mode: GameMode,
    limit: number = 50
  ): Promise<GameStatsData[]> {
    const db = await getDatabase();
    const rows = await db.all(
      'SELECT * FROM game_stats WHERE mode = ? ORDER BY created_at DESC LIMIT ?',
      [mode, limit]
    );
    return rows.map((row) => this.mapRowToStats(row));
  }

  static async getStatsSummary(mode?: GameMode): Promise<{
    totalGames: number;
    redWins: number;
    yellowWins: number;
    draws: number;
    averageMoves: number;
    averageDuration: number;
  }> {
    const db = await getDatabase();

    let query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN winner = 'red' THEN 1 ELSE 0 END) as red_wins,
        SUM(CASE WHEN winner = 'yellow' THEN 1 ELSE 0 END) as yellow_wins,
        SUM(CASE WHEN winner IS NULL THEN 1 ELSE 0 END) as draws,
        AVG(total_moves) as avg_moves,
        AVG(game_duration) as avg_duration 
      FROM game_stats`;
    const params: any[] = [];

    if (mode) {
      query += ' WHERE mode = ?';
      params.push(mode);
    }

    const rows = await db.all(query, params);
    const row = rows[0];

    return {
      totalGames: row.total || 0,
      redWins: row.red_wins || 0,
      yellowWins: row.yellow_wins || 0,
      draws: row.draws || 0,
      averageMoves: Math.round(row.avg_moves || 0),
      averageDuration: Math.round(row.avg_duration || 0),
    };
  }

  private static mapRowToStats(row: any): GameStatsData {
    return {
      id: row.id,
      gameId: row.game_id,
      playerRed: row.player_red,
      playerYellow: row.player_yellow,
      winner: row.winner,
      totalMoves: row.total_moves,
      gameDuration: row.game_duration,
      mode: row.mode,
      createdAt: new Date(row.created_at),
    };
  }
}
