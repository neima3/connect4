import { BackgroundJobService } from './services/background-jobs-service';
import { SecurityService } from './services/security-service';
import { CacheService } from './services/cache-service';
import { WebSocketService } from './services/websocket-service';
import { NotificationService } from './services/notification-service';

export interface ServiceConfig {
  backgroundJobs: boolean;
  security: boolean;
  cache: boolean;
  websockets: boolean;
  notifications: boolean;
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'warning' | 'error';
  lastCheck: number;
  details?: any;
}

export class ServiceManager {
  private static initialized = false;
  private static servicesStarted = new Set<string>();
  private static healthChecks = new Map<string, () => ServiceHealth>();

  /**
   * Initialize all services with proper configuration
   */
  static async initialize(config: Partial<ServiceConfig> = {}): Promise<void> {
    if (this.initialized) {
      console.warn('ServiceManager already initialized');
      return;
    }

    const finalConfig: ServiceConfig = {
      backgroundJobs: true,
      security: true,
      cache: true,
      websockets: true,
      notifications: true,
      ...config,
    };

    console.log('Initializing services with config:', finalConfig);

    try {
      // Initialize security first
      if (finalConfig.security) {
        await this.initializeSecurity();
      }

      // Initialize cache
      if (finalConfig.cache) {
        await this.initializeCache();
      }

      // Initialize notifications
      if (finalConfig.notifications) {
        await this.initializeNotifications();
      }

      // Initialize websockets
      if (finalConfig.websockets) {
        await this.initializeWebSockets();
      }

      // Start background jobs last
      if (finalConfig.backgroundJobs) {
        await this.initializeBackgroundJobs();
      }

      this.initialized = true;
      console.log('All services initialized successfully');

      // Start health monitoring
      this.startHealthMonitoring();
    } catch (error) {
      console.error('Failed to initialize services:', error);
      throw error;
    }
  }

  /**
   * Initialize security service
   */
  private static async initializeSecurity(): Promise<void> {
    try {
      // Configure security settings based on environment
      const isDevelopment = process.env.NODE_ENV === 'development';

      SecurityService.configure({
        enableRateLimit: true,
        enableInputValidation: true,
        enableXSSProtection: true,
        enableCSRFProtection: !isDevelopment,
        maxRequestSize: 10 * 1024 * 1024, // 10MB
        allowedOrigins: isDevelopment
          ? ['http://localhost:3000', 'http://localhost:4002']
          : [process.env.NEXT_PUBLIC_APP_URL || ''],
        blockedIPs: [],
      });

      this.servicesStarted.add('security');
      console.log('✓ Security service initialized');
    } catch (error) {
      console.error('Failed to initialize security service:', error);
      throw error;
    }
  }

  /**
   * Initialize cache service
   */
  private static async initializeCache(): Promise<void> {
    try {
      // Preload common cache data if needed
      await CacheService.warmCache(
        ['stats:games:all', 'leaderboard:10'],
        async (key) => {
          // This would typically fetch from database
          return null;
        },
        { ttl: 5 * 60 * 1000 } // 5 minutes
      );

      this.servicesStarted.add('cache');
      console.log('✓ Cache service initialized');
    } catch (error) {
      console.error('Failed to initialize cache service:', error);
      throw error;
    }
  }

  /**
   * Initialize notification service
   */
  private static async initializeNotifications(): Promise<void> {
    try {
      // Subscribe to system-wide notifications
      NotificationService.subscribe('system', (notification) => {
        console.log(
          'System notification:',
          notification.title,
          notification.message
        );
      });

      this.servicesStarted.add('notifications');
      console.log('✓ Notification service initialized');
    } catch (error) {
      console.error('Failed to initialize notification service:', error);
      throw error;
    }
  }

  /**
   * Initialize WebSocket service
   */
  private static async initializeWebSockets(): Promise<void> {
    try {
      // WebSocket service is mostly passive initialization
      // Real initialization happens when connections are established

      this.servicesStarted.add('websockets');
      console.log('✓ WebSocket service initialized');
    } catch (error) {
      console.error('Failed to initialize WebSocket service:', error);
      throw error;
    }
  }

  /**
   * Initialize background jobs
   */
  private static async initializeBackgroundJobs(): Promise<void> {
    try {
      BackgroundJobService.start();
      this.servicesStarted.add('backgroundJobs');
      console.log('✓ Background job service initialized');
    } catch (error) {
      console.error('Failed to initialize background job service:', error);
      throw error;
    }
  }

  /**
   * Start health monitoring for all services
   */
  private static startHealthMonitoring(): void {
    // Register health checks for each service
    this.healthChecks.set('security', () => this.checkSecurityHealth());
    this.healthChecks.set('cache', () => this.checkCacheHealth());
    this.healthChecks.set('websockets', () => this.checkWebSocketHealth());
    this.healthChecks.set('backgroundJobs', () =>
      this.checkBackgroundJobsHealth()
    );

    // Run health checks every 30 seconds
    setInterval(() => {
      this.runHealthChecks();
    }, 30 * 1000);

    // Run initial health check
    setTimeout(() => this.runHealthChecks(), 5000);
  }

  /**
   * Run health checks for all services
   */
  private static async runHealthChecks(): Promise<void> {
    const results: ServiceHealth[] = [];

    for (const [serviceName, healthCheck] of this.healthChecks) {
      try {
        const health = healthCheck();
        results.push(health);

        if (health.status === 'error') {
          console.error(`Service ${serviceName} is unhealthy:`, health.details);
        }
      } catch (error) {
        console.error(`Health check failed for ${serviceName}:`, error);
        results.push({
          name: serviceName,
          status: 'error',
          lastCheck: Date.now(),
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Store health results for monitoring
    CacheService.set('system:health', results, { ttl: 60 * 1000 });
  }

  /**
   * Check security service health
   */
  private static checkSecurityHealth(): ServiceHealth {
    try {
      const stats = SecurityService.getStats();
      const violations = stats.recentViolations;

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      if (violations > 10) status = 'warning';
      if (violations > 50) status = 'error';

      return {
        name: 'security',
        status,
        lastCheck: Date.now(),
        details: stats,
      };
    } catch (error) {
      return {
        name: 'security',
        status: 'error',
        lastCheck: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check cache service health
   */
  private static checkCacheHealth(): ServiceHealth {
    try {
      const stats = CacheService.getStats();

      // Test cache functionality
      const testKey = 'health:test';
      CacheService.set(testKey, 'test', { ttl: 1000 });
      const testValue = CacheService.get(testKey);
      CacheService.delete(testKey);

      const isWorking = testValue === 'test';

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      if (!isWorking) status = 'error';
      if (stats.hitRate < 50) status = 'warning';

      return {
        name: 'cache',
        status,
        lastCheck: Date.now(),
        details: { ...stats, functionality: isWorking ? 'ok' : 'failed' },
      };
    } catch (error) {
      return {
        name: 'cache',
        status: 'error',
        lastCheck: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check WebSocket service health
   */
  private static checkWebSocketHealth(): ServiceHealth {
    try {
      const stats = WebSocketService.getStats();

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      if (stats.totalClients > 1000) status = 'warning';

      return {
        name: 'websockets',
        status,
        lastCheck: Date.now(),
        details: stats,
      };
    } catch (error) {
      return {
        name: 'websockets',
        status: 'error',
        lastCheck: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check background jobs health
   */
  private static checkBackgroundJobsHealth(): ServiceHealth {
    try {
      const stats = BackgroundJobService.getStats();

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      if (stats.successRate < 90) status = 'warning';
      if (stats.successRate < 50) status = 'error';

      return {
        name: 'backgroundJobs',
        status,
        lastCheck: Date.now(),
        details: stats,
      };
    } catch (error) {
      return {
        name: 'backgroundJobs',
        status: 'error',
        lastCheck: Date.now(),
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get current health status of all services
   */
  static getHealthStatus(): ServiceHealth[] {
    const cached = CacheService.get('system:health');
    if (cached) {
      return cached;
    }

    // If no cached data, run health checks synchronously
    const results: ServiceHealth[] = [];
    for (const [serviceName, healthCheck] of this.healthChecks) {
      try {
        results.push(healthCheck());
      } catch (error) {
        results.push({
          name: serviceName,
          status: 'error',
          lastCheck: Date.now(),
          details: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * Get list of initialized services
   */
  static getInitializedServices(): string[] {
    return Array.from(this.servicesStarted);
  }

  /**
   * Check if all services are initialized
   */
  static isFullyInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Gracefully shutdown all services
   */
  static async shutdown(): Promise<void> {
    console.log('Shutting down services...');

    try {
      // Stop background jobs
      if (this.servicesStarted.has('backgroundJobs')) {
        BackgroundJobService.stop();
        console.log('✓ Background jobs stopped');
      }

      // Clear cache
      if (this.servicesStarted.has('cache')) {
        CacheService.clear();
        console.log('✓ Cache cleared');
      }

      // Other services don't require explicit shutdown

      this.servicesStarted.clear();
      this.initialized = false;
      console.log('All services shut down successfully');
    } catch (error) {
      console.error('Error during service shutdown:', error);
      throw error;
    }
  }

  /**
   * Get comprehensive system status
   */
  static getSystemStatus(): {
    initialized: boolean;
    services: string[];
    health: ServiceHealth[];
    uptime: number;
    memory: NodeJS.MemoryUsage;
  } {
    return {
      initialized: this.initialized,
      services: this.getInitializedServices(),
      health: this.getHealthStatus(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    };
  }
}
