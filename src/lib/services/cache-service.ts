export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
  hits: number;
  lastAccessed: number;
}

export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memoryUsage: number; // in bytes
  expiredEntries: number;
}

export interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds
  maxSize?: number; // Maximum number of entries
  cleanupInterval?: number; // Cleanup interval in milliseconds
}

export class CacheService {
  private static cache = new Map<string, CacheEntry>();
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly DEFAULT_MAX_SIZE = 1000;
  private static readonly DEFAULT_CLEANUP_INTERVAL = 60 * 1000; // 1 minute
  private static stats = {
    hits: 0,
    misses: 0,
  };

  /**
   * Set a value in cache
   */
  static set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const { ttl = this.DEFAULT_TTL, maxSize = this.DEFAULT_MAX_SIZE } = options;

    // Evict oldest entries if cache is full
    if (this.cache.size >= maxSize && !this.cache.has(key)) {
      this.evictOldestEntries();
    }

    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl,
      hits: 0,
      lastAccessed: now,
    };

    this.cache.set(key, entry);
  }

  /**
   * Get a value from cache
   */
  static get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();

    // Check if entry is expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.hits++;
    entry.lastAccessed = now;
    this.stats.hits++;

    return entry.data as T;
  }

  /**
   * Check if key exists and is not expired
   */
  static has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();

    // Check if entry is expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  static delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  static clear(): void {
    this.cache.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Get multiple keys at once
   */
  static getMultiple<T = any>(keys: string[]): Record<string, T | null> {
    const result: Record<string, T | null> = {};

    for (const key of keys) {
      result[key] = this.get<T>(key);
    }

    return result;
  }

  /**
   * Set multiple keys at once
   */
  static setMultiple<T>(
    entries: Record<string, T>,
    options: CacheOptions = {}
  ): void {
    for (const [key, data] of Object.entries(entries)) {
      this.set(key, data, options);
    }
  }

  /**
   * Get or set pattern - if key doesn't exist, set it with the result of the factory function
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    this.set(key, data, options);

    return data;
  }

  /**
   * Get cache statistics
   */
  static getStats(): CacheStats {
    const totalEntries = this.cache.size;
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;
    const hitRate =
      totalHits + totalMisses > 0
        ? (totalHits / (totalHits + totalMisses)) * 100
        : 0;

    const expiredEntries = this.countExpiredEntries();
    const memoryUsage = this.calculateMemoryUsage();

    return {
      totalEntries,
      totalHits,
      totalMisses,
      hitRate,
      memoryUsage,
      expiredEntries,
    };
  }

  /**
   * Clean up expired entries
   */
  static cleanup(): { cleaned: number; remaining: number } {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return {
      cleaned,
      remaining: this.cache.size,
    };
  }

  /**
   * Evict least recently used entries
   */
  private static evictOldestEntries(count: number = 1): void {
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessed - b.lastAccessed
    );

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.cache.delete(entries[i][0]);
    }
  }

  /**
   * Count expired entries
   */
  private static countExpiredEntries(): number {
    const now = Date.now();
    let count = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp > entry.ttl) {
        count++;
      }
    }

    return count;
  }

  /**
   * Calculate approximate memory usage
   */
  private static calculateMemoryUsage(): number {
    // Rough estimation - each character is ~2 bytes
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Key size
      totalSize += key.length * 2;

      // Data size (JSON stringified)
      try {
        const jsonString = JSON.stringify(entry.data);
        totalSize += jsonString.length * 2;
      } catch (error) {
        // If serialization fails, use a rough estimate
        totalSize += 100;
      }

      // Metadata size
      totalSize += 64; // Rough estimate for timestamps, counters, etc.
    }

    return totalSize;
  }

  /**
   * Get all keys in cache
   */
  static keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry information
   */
  static getEntryInfo(key: string): CacheEntry | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    const remainingTTL = Math.max(0, entry.ttl - (now - entry.timestamp));

    return {
      ...entry,
      ttl: remainingTTL,
    };
  }

  /**
   * Extend TTL for a specific key
   */
  static extendTTL(key: string, additionalTTL: number): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    entry.ttl += additionalTTL;
    return true;
  }

  /**
   * Set TTL for a specific key
   */
  static setTTL(key: string, newTTL: number): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    entry.ttl = newTTL;
    return true;
  }

  /**
   * Get entries that are about to expire (within the next minute)
   */
  static getExpiringEntries(
    withinMinutes: number = 1
  ): Array<{ key: string; entry: CacheEntry; timeToExpiry: number }> {
    const now = Date.now();
    const threshold = withinMinutes * 60 * 1000;
    const expiring: Array<{
      key: string;
      entry: CacheEntry;
      timeToExpiry: number;
    }> = [];

    for (const [key, entry] of this.cache.entries()) {
      const timeToExpiry = entry.ttl - (now - entry.timestamp);

      if (timeToExpiry > 0 && timeToExpiry <= threshold) {
        expiring.push({ key, entry, timeToExpiry });
      }
    }

    return expiring.sort((a, b) => a.timeToExpiry - b.timeToExpiry);
  }

  /**
   * Preload common data into cache
   */
  static async preloadData<T>(
    keys: string[],
    dataFactory: (key: string) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> {
    const promises = keys.map(async (key) => {
      if (!this.has(key)) {
        try {
          const data = await dataFactory(key);
          this.set(key, data, options);
        } catch (error) {
          console.error(`Failed to preload data for key ${key}:`, error);
        }
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Cache warming for frequently accessed data
   */
  static async warmCache<T>(
    frequentKeys: string[],
    dataFactory: (key: string) => Promise<T>,
    options: CacheOptions = {}
  ): Promise<{ warmed: number; failed: number }> {
    let warmed = 0;
    let failed = 0;

    for (const key of frequentKeys) {
      try {
        const data = await dataFactory(key);
        this.set(key, data, options);
        warmed++;
      } catch (error) {
        console.error(`Failed to warm cache for key ${key}:`, error);
        failed++;
      }
    }

    return { warmed, failed };
  }

  /**
   * Reset statistics
   */
  static resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }
}

/**
 * Specialized cache instances for different data types
 */
export class GameCache {
  private static readonly CACHE_PREFIX = 'game:';
  private static readonly GAME_TTL = 10 * 60 * 1000; // 10 minutes

  static getGameState(gameId: string) {
    return CacheService.get(`${this.CACHE_PREFIX}state:${gameId}`);
  }

  static setGameState(gameId: string, state: any) {
    return CacheService.set(`${this.CACHE_PREFIX}state:${gameId}`, state, {
      ttl: this.GAME_TTL,
    });
  }

  static getGameMoves(gameId: string) {
    return CacheService.get(`${this.CACHE_PREFIX}moves:${gameId}`);
  }

  static setGameMoves(gameId: string, moves: any) {
    return CacheService.set(`${this.CACHE_PREFIX}moves:${gameId}`, moves, {
      ttl: this.GAME_TTL,
    });
  }

  static invalidateGame(gameId: string) {
    CacheService.delete(`${this.CACHE_PREFIX}state:${gameId}`);
    CacheService.delete(`${this.CACHE_PREFIX}moves:${gameId}`);
  }
}

export class RoomCache {
  private static readonly CACHE_PREFIX = 'room:';
  private static readonly ROOM_TTL = 30 * 60 * 1000; // 30 minutes

  static getRoomData(roomCode: string) {
    return CacheService.get(`${this.CACHE_PREFIX}data:${roomCode}`);
  }

  static setRoomData(roomCode: string, data: any) {
    return CacheService.set(`${this.CACHE_PREFIX}data:${roomCode}`, data, {
      ttl: this.ROOM_TTL,
    });
  }

  static getRoomPlayers(roomCode: string) {
    return CacheService.get(`${this.CACHE_PREFIX}players:${roomCode}`);
  }

  static setRoomPlayers(roomCode: string, players: string[]) {
    return CacheService.set(
      `${this.CACHE_PREFIX}players:${roomCode}`,
      players,
      {
        ttl: this.ROOM_TTL,
      }
    );
  }

  static invalidateRoom(roomCode: string) {
    CacheService.delete(`${this.CACHE_PREFIX}data:${roomCode}`);
    CacheService.delete(`${this.CACHE_PREFIX}players:${roomCode}`);
  }
}

export class StatsCache {
  private static readonly CACHE_PREFIX = 'stats:';
  private static readonly STATS_TTL = 5 * 60 * 1000; // 5 minutes

  static getGameStats(mode?: string) {
    const key = mode ? `games:${mode}` : 'games:all';
    return CacheService.get(`${this.CACHE_PREFIX}${key}`);
  }

  static setGameStats(stats: any, mode?: string) {
    const key = mode ? `games:${mode}` : 'games:all';
    return CacheService.set(`${this.CACHE_PREFIX}${key}`, stats, {
      ttl: this.STATS_TTL,
    });
  }

  static getLeaderboard(limit?: number) {
    const key = `leaderboard:${limit || 10}`;
    return CacheService.get(`${this.CACHE_PREFIX}${key}`);
  }

  static setLeaderboard(leaderboard: any[], limit?: number) {
    const key = `leaderboard:${limit || 10}`;
    return CacheService.set(`${this.CACHE_PREFIX}${key}`, leaderboard, {
      ttl: this.STATS_TTL,
    });
  }
}
