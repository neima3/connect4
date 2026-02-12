import { MatchmakingService } from './matchmaking-service';
import { GameService } from './game-service';
import { RoomService } from './room-service';
import { AuthService } from './auth-service';
import { WebSocketService } from './websocket-service';
import { CacheService } from './cache-service';

export interface Job {
  id: string;
  name: string;
  handler: () => Promise<any>;
  schedule: string; // Cron-like expression or interval in milliseconds
  lastRun?: number;
  nextRun?: number;
  running: boolean;
  enabled: boolean;
  timeout?: number; // Job timeout in milliseconds
}

export interface JobResult {
  jobId: string;
  success: boolean;
  duration: number;
  result?: any;
  error?: string;
  timestamp: number;
}

export interface JobStats {
  totalJobs: number;
  enabledJobs: number;
  runningJobs: number;
  recentResults: JobResult[];
  averageRunTime: number;
  successRate: number;
}

export class BackgroundJobService {
  private static jobs = new Map<string, Job>();
  private static results: JobResult[] = [];
  private static maxResults = 100;
  private static timers = new Map<string, NodeJS.Timeout>();
  private static isStarted = false;

  /**
   * Register a new background job
   */
  static registerJob(job: Omit<Job, 'id' | 'running' | 'enabled'>): string {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const fullJob: Job = {
      id: jobId,
      ...job,
      running: false,
      enabled: true,
    };

    this.jobs.set(jobId, fullJob);

    if (this.isStarted) {
      this.scheduleJob(jobId);
    }

    return jobId;
  }

  /**
   * Start the background job service
   */
  static start(): void {
    if (this.isStarted) {
      return;
    }

    this.isStarted = true;

    // Register default jobs
    this.registerDefaultJobs();

    // Schedule all enabled jobs
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.enabled) {
        this.scheduleJob(jobId);
      }
    }

    console.log(`Background job service started with ${this.jobs.size} jobs`);
  }

  /**
   * Stop the background job service
   */
  static stop(): void {
    if (!this.isStarted) {
      return;
    }

    // Clear all timers
    for (const [jobId, timer] of this.timers.entries()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    this.isStarted = false;
    console.log('Background job service stopped');
  }

  /**
   * Register default system jobs
   */
  private static registerDefaultJobs(): void {
    // Cleanup expired matchmaking requests
    this.registerJob({
      name: 'matchmaking-cleanup',
      handler: async () => {
        return MatchmakingService.cleanup();
      },
      schedule: '*/1 * * * *', // Every minute (cron format)
      timeout: 30000, // 30 seconds timeout
    });

    // Check for abandoned games
    this.registerJob({
      name: 'abandoned-games-check',
      handler: async () => {
        const abandonedGames = await GameService.checkAbandonedGames(24); // 24 hours
        return { abandonedGames, count: abandonedGames.length };
      },
      schedule: '*/30 * * * *', // Every 30 minutes (cron format)
      timeout: 60000, // 1 minute timeout
    });

    // Cleanup expired rooms
    this.registerJob({
      name: 'room-cleanup',
      handler: async () => {
        return RoomService.cleanupExpiredRooms();
      },
      schedule: '*/15 * * * *', // Every 15 minutes (cron format)
      timeout: 30000, // 30 seconds timeout
    });

    // Cleanup expired auth sessions
    this.registerJob({
      name: 'auth-session-cleanup',
      handler: async () => {
        return AuthService.cleanupExpiredSessions();
      },
      schedule: '*/10 * * * *', // Every 10 minutes (cron format)
      timeout: 15000, // 15 seconds timeout
    });

    // Ping WebSocket clients and clean up disconnected ones
    this.registerJob({
      name: 'websocket-ping',
      handler: async () => {
        return WebSocketService.pingClients();
      },
      schedule: '*/30 * * * *', // Every 30 seconds needs a different approach, use 30 seconds interval
      // We'll handle this as a special case in the scheduler
    });

    // Cleanup cache entries
    this.registerJob({
      name: 'cache-cleanup',
      handler: async () => {
        return CacheService.cleanup();
      },
      schedule: '*/5 * * * *', // Every 5 minutes (cron format)
      timeout: 10000, // 10 seconds timeout
    });

    // Generate daily statistics
    this.registerJob({
      name: 'daily-stats-generation',
      handler: async () => {
        const now = new Date();
        if (now.getHours() === 0 && now.getMinutes() < 5) {
          // Run around midnight
          return this.generateDailyStats();
        }
        return { skipped: true, reason: 'Not midnight' };
      },
      schedule: '0 * * * *', // Every hour (cron format)
      timeout: 120000, // 2 minutes timeout
    });

    // System health check
    this.registerJob({
      name: 'system-health-check',
      handler: async () => {
        return this.performHealthCheck();
      },
      schedule: '*/5 * * * *', // Every 5 minutes (cron format)
      timeout: 30000, // 30 seconds timeout
    });
  }

  /**
   * Schedule a single job
   */
  private static scheduleJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || !job.enabled) {
      return;
    }

    const scheduleNextRun = () => {
      if (!job.enabled) return;

      const delay =
        typeof job.schedule === 'string'
          ? this.parseCronExpression(job.schedule)
          : job.schedule;

      const timer = setTimeout(async () => {
        await this.executeJob(jobId);
        scheduleNextRun(); // Schedule next run
      }, delay);

      this.timers.set(jobId, timer);
      job.nextRun = Date.now() + delay;
    };

    scheduleNextRun();
  }

  /**
   * Execute a job
   */
  private static async executeJob(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.running) {
      return;
    }

    job.running = true;
    job.lastRun = Date.now();

    const startTime = Date.now();
    let result: JobResult;

    try {
      // Set up timeout if specified
      let timeoutId: NodeJS.Timeout | undefined;
      if (job.timeout) {
        timeoutId = setTimeout(() => {
          throw new Error(`Job timed out after ${job.timeout}ms`);
        }, job.timeout);
      }

      // Execute the job
      const jobResult = await job.handler();

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      const duration = Date.now() - startTime;

      result = {
        jobId,
        success: true,
        duration,
        result: jobResult,
        timestamp: startTime,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      result = {
        jobId,
        success: false,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: startTime,
      };
    } finally {
      job.running = false;
    }

    // Store result
    this.addResult(result);
  }

  /**
   * Store job result
   */
  private static addResult(result: JobResult): void {
    this.results.unshift(result);

    // Keep only recent results
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(0, this.maxResults);
    }

    // Log result
    if (result.success) {
      console.log(
        `Job ${result.jobId} completed successfully in ${result.duration}ms`
      );
    } else {
      console.error(
        `Job ${result.jobId} failed after ${result.duration}ms: ${result.error}`
      );
    }
  }

  /**
   * Enable or disable a job
   */
  static setJobEnabled(jobId: string, enabled: boolean): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    job.enabled = enabled;

    // Clear existing timer
    const timer = this.timers.get(jobId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(jobId);
    }

    // Reschedule if enabled
    if (enabled && this.isStarted) {
      this.scheduleJob(jobId);
    }

    return true;
  }

  /**
   * Run a job manually
   */
  static async runJobManually(jobId: string): Promise<JobResult> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.running) {
      throw new Error(`Job ${jobId} is already running`);
    }

    await this.executeJob(jobId);

    const result = this.results.find(
      (r) => r.jobId === jobId && r.timestamp === job.lastRun
    );
    if (!result) {
      throw new Error('Job result not found');
    }

    return result;
  }

  /**
   * Get all registered jobs
   */
  static getJobs(): Job[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  static getJob(jobId: string): Job | null {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Get recent job results
   */
  static getRecentResults(limit: number = 20): JobResult[] {
    return this.results.slice(0, limit);
  }

  /**
   * Get job statistics
   */
  static getStats(): JobStats {
    const totalJobs = this.jobs.size;
    const enabledJobs = Array.from(this.jobs.values()).filter(
      (job) => job.enabled
    ).length;
    const runningJobs = Array.from(this.jobs.values()).filter(
      (job) => job.running
    ).length;

    const recentResults = this.getRecentResults();
    const successfulResults = recentResults.filter((r) => r.success);
    const successRate =
      recentResults.length > 0
        ? (successfulResults.length / recentResults.length) * 100
        : 0;

    const averageRunTime =
      recentResults.length > 0
        ? recentResults.reduce((sum, r) => sum + r.duration, 0) /
          recentResults.length
        : 0;

    return {
      totalJobs,
      enabledJobs,
      runningJobs,
      recentResults,
      averageRunTime,
      successRate,
    };
  }

  /**
   * Parse simple cron expressions (basic implementation)
   */
  private static parseCronExpression(cron: string): number {
    // This is a simplified parser - in production, use a proper cron library
    // Examples: "*/5 * * * *" (every 5 minutes), "0 0 * * *" (daily at midnight)

    const parts = cron.split(' ');
    if (parts.length !== 5) {
      throw new Error('Invalid cron expression');
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

    // Handle some common patterns
    if (cron === '0 0 * * *') {
      // Daily at midnight
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      return tomorrow.getTime() - now.getTime();
    }

    if (cron === '0 */6 * * *') {
      // Every 6 hours
      return 6 * 60 * 60 * 1000;
    }

    if (cron === '*/30 * * * *') {
      // Every 30 minutes
      return 30 * 60 * 1000;
    }

    // Default to 1 hour for unrecognized patterns
    return 60 * 60 * 1000;
  }

  /**
   * Generate daily statistics
   */
  private static async generateDailyStats(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];

    // This would typically aggregate data from various sources
    // For now, return a placeholder
    return {
      date: today,
      gamesPlayed: 0,
      activeUsers: 0,
      averageGameDuration: 0,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Perform system health check
   */
  private static async performHealthCheck(): Promise<any> {
    const health: any = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        activeConnections: WebSocketService.getStats().totalClients,
        cacheStats: CacheService.getStats(),
        matchmakingStats: MatchmakingService.getStats(),
        authStats: AuthService.getStats(),
      },
    };

    // Determine overall health status
    const memoryUsage = process.memoryUsage();
    const memoryThreshold = 500 * 1024 * 1024; // 500MB

    if (memoryUsage.heapUsed > memoryThreshold) {
      health.status = 'warning';
      health.warning = 'High memory usage';
    }

    return health;
  }

  /**
   * Export job results for analysis
   */
  static exportResults(format: 'json' | 'csv' = 'json'): string {
    const results = this.getRecentResults(100);

    if (format === 'csv') {
      const headers = ['jobId', 'success', 'duration', 'timestamp', 'error'];
      const rows = results.map((r) => [
        r.jobId,
        r.success.toString(),
        r.duration.toString(),
        new Date(r.timestamp).toISOString(),
        r.error || '',
      ]);

      return [headers.join(','), ...rows.map((row) => row.join(','))].join(
        '\n'
      );
    }

    return JSON.stringify(results, null, 2);
  }

  /**
   * Get job performance metrics
   */
  static getJobMetrics(jobId: string): {
    totalRuns: number;
    successRate: number;
    averageRunTime: number;
    lastRun: number | null;
    lastSuccess: number | null;
    lastFailure: number | null;
  } {
    const jobResults = this.results.filter((r) => r.jobId === jobId);

    if (jobResults.length === 0) {
      return {
        totalRuns: 0,
        successRate: 0,
        averageRunTime: 0,
        lastRun: null,
        lastSuccess: null,
        lastFailure: null,
      };
    }

    const successfulRuns = jobResults.filter((r) => r.success);
    const totalRunTime = jobResults.reduce((sum, r) => sum + r.duration, 0);
    const lastSuccess =
      successfulRuns.length > 0
        ? Math.max(...successfulRuns.map((r) => r.timestamp))
        : null;
    const lastFailure = jobResults.some((r) => !r.success)
      ? Math.max(
          ...jobResults.filter((r) => !r.success).map((r) => r.timestamp)
        )
      : null;

    return {
      totalRuns: jobResults.length,
      successRate: (successfulRuns.length / jobResults.length) * 100,
      averageRunTime: totalRunTime / jobResults.length,
      lastRun: Math.max(...jobResults.map((r) => r.timestamp)),
      lastSuccess,
      lastFailure,
    };
  }
}
