export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (identifier: string) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

export interface SecurityConfig {
  enableRateLimit: boolean;
  enableInputValidation: boolean;
  enableXSSProtection: boolean;
  enableCSRFProtection: boolean;
  maxRequestSize: number; // in bytes
  allowedOrigins: string[];
  blockedIPs: string[];
}

export interface SecurityViolation {
  type:
    | 'rate_limit'
    | 'xss_attempt'
    | 'csrf_attempt'
    | 'invalid_input'
    | 'blocked_ip';
  timestamp: number;
  ip: string;
  userAgent?: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export class SecurityService {
  private static rateLimitStore = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private static violations: SecurityViolation[] = [];
  private static maxViolations = 1000;
  private static config: SecurityConfig = {
    enableRateLimit: true,
    enableInputValidation: true,
    enableXSSProtection: true,
    enableCSRFProtection: false, // Disabled by default for simplicity
    maxRequestSize: 1024 * 1024, // 1MB
    allowedOrigins: ['http://localhost:3000', 'http://localhost:4002'],
    blockedIPs: [],
  };

  /**
   * Configure security settings
   */
  static configure(config: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check rate limit for an identifier
   */
  static checkRateLimit(
    identifier: string,
    config: RateLimitConfig
  ): RateLimitResult {
    const {
      windowMs,
      maxRequests,
      keyGenerator = (id) => id,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
    } = config;

    const key = keyGenerator(identifier);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = this.rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      this.rateLimitStore.set(key, entry);
    }

    // Increment counter
    entry.count++;

    const allowed = entry.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - entry.count);

    // Clean up expired entries
    this.cleanupRateLimitStore();

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
      totalHits: entry.count,
    };
  }

  /**
   * Validate and sanitize input
   */
  static validateInput(
    input: string,
    type: 'string' | 'email' | 'username' | 'roomCode' | 'gameId' = 'string'
  ): { isValid: boolean; sanitized?: string; error?: string } {
    if (!this.config.enableInputValidation) {
      return { isValid: true, sanitized: input };
    }

    // Check for empty input
    if (!input || input.trim().length === 0) {
      return { isValid: false, error: 'Input cannot be empty' };
    }

    let sanitized = input.trim();

    // Basic XSS protection
    if (this.config.enableXSSProtection) {
      sanitized = this.sanitizeForXSS(sanitized);

      if (sanitized !== input.trim()) {
        this.logViolation({
          type: 'xss_attempt',
          ip: 'unknown', // Should be passed from request
          details: { original: input, sanitized },
          severity: 'high',
        });
      }
    }

    // Type-specific validation
    switch (type) {
      case 'email':
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitized)) {
          return { isValid: false, error: 'Invalid email format' };
        }
        break;

      case 'username':
        if (sanitized.length < 1 || sanitized.length > 50) {
          return {
            isValid: false,
            error: 'Username must be between 1 and 50 characters',
          };
        }
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized)) {
          return {
            isValid: false,
            error: 'Username contains invalid characters',
          };
        }
        break;

      case 'roomCode':
        if (sanitized.length !== 6) {
          return {
            isValid: false,
            error: 'Room code must be exactly 6 characters',
          };
        }
        if (!/^[A-Z0-9]+$/.test(sanitized)) {
          return {
            isValid: false,
            error: 'Room code must contain only uppercase letters and numbers',
          };
        }
        break;

      case 'gameId':
        if (sanitized.length < 10 || sanitized.length > 50) {
          return { isValid: false, error: 'Invalid game ID format' };
        }
        if (!/^[a-zA-Z0-9_\-]+$/.test(sanitized)) {
          return { isValid: false, error: 'Invalid game ID format' };
        }
        break;

      case 'string':
      default:
        // General string validation
        if (sanitized.length > 1000) {
          return {
            isValid: false,
            error: 'Input too long (max 1000 characters)',
          };
        }
        break;
    }

    return { isValid: true, sanitized };
  }

  /**
   * Check if IP is blocked
   */
  static isIPBlocked(ip: string): boolean {
    return this.config.blockedIPs.includes(ip);
  }

  /**
   * Block an IP address
   */
  static blockIP(ip: string, duration?: number): void {
    if (!this.config.blockedIPs.includes(ip)) {
      this.config.blockedIPs.push(ip);
    }

    // If duration is specified, schedule unblock
    if (duration) {
      setTimeout(() => {
        this.unblockIP(ip);
      }, duration);
    }
  }

  /**
   * Unblock an IP address
   */
  static unblockIP(ip: string): void {
    const index = this.config.blockedIPs.indexOf(ip);
    if (index > -1) {
      this.config.blockedIPs.splice(index, 1);
    }
  }

  /**
   * Check CORS origin
   */
  static isOriginAllowed(origin: string): boolean {
    return (
      this.config.allowedOrigins.includes(origin) ||
      this.config.allowedOrigins.includes('*')
    );
  }

  /**
   * Sanitize input for XSS
   */
  private static sanitizeForXSS(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .replace(/javascript:/gi, '') // Remove javascript protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/data:/gi, '') // Remove data protocols
      .trim();
  }

  /**
   * Log security violation
   */
  static logViolation(violation: Omit<SecurityViolation, 'timestamp'>): void {
    const fullViolation: SecurityViolation = {
      type: violation.type,
      ip: violation.ip,
      userAgent: violation.userAgent,
      details: violation.details,
      severity: violation.severity,
      timestamp: Date.now(),
    };

    this.violations.unshift(fullViolation);

    // Keep only recent violations
    if (this.violations.length > this.maxViolations) {
      this.violations = this.violations.slice(0, this.maxViolations);
    }

    // Log to console for monitoring
    console.warn(
      `Security violation [${violation.severity}]: ${violation.type}`,
      violation.details
    );
  }

  /**
   * Get security violations
   */
  static getViolations(
    filters: {
      type?: SecurityViolation['type'];
      severity?: SecurityViolation['severity'];
      since?: number;
      limit?: number;
    } = {}
  ): SecurityViolation[] {
    let filtered = [...this.violations];

    if (filters.type) {
      filtered = filtered.filter((v) => v.type === filters.type);
    }

    if (filters.severity) {
      filtered = filtered.filter((v) => v.severity === filters.severity);
    }

    if (filters.since) {
      filtered = filtered.filter((v) => v.timestamp >= filters.since!);
    }

    if (filters.limit) {
      filtered = filtered.slice(0, filters.limit);
    }

    return filtered;
  }

  /**
   * Get security statistics
   */
  static getStats(): {
    totalViolations: number;
    violationsByType: Record<string, number>;
    violationsBySeverity: Record<string, number>;
    blockedIPs: number;
    rateLimitedIPs: number;
    recentViolations: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const violationsByType: Record<string, number> = {};
    const violationsBySeverity: Record<string, number> = {};
    let recentViolations = 0;

    for (const violation of this.violations) {
      violationsByType[violation.type] =
        (violationsByType[violation.type] || 0) + 1;
      violationsBySeverity[violation.severity] =
        (violationsBySeverity[violation.severity] || 0) + 1;

      if (violation.timestamp > oneHourAgo) {
        recentViolations++;
      }
    }

    const rateLimitedIPs = this.rateLimitStore.size;

    return {
      totalViolations: this.violations.length,
      violationsByType,
      violationsBySeverity,
      blockedIPs: this.config.blockedIPs.length,
      rateLimitedIPs,
      recentViolations,
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  private static cleanupRateLimitStore(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetTime) {
        expired.push(key);
      }
    }

    for (const key of expired) {
      this.rateLimitStore.delete(key);
    }
  }

  /**
   * Validate request size
   */
  static validateRequestSize(size: number): boolean {
    return size <= this.config.maxRequestSize;
  }

  /**
   * Generate CSRF token
   */
  static generateCSRFToken(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    const signature = Buffer.from(`${timestamp}.${random}`).toString('base64');
    return signature;
  }

  /**
   * Validate CSRF token
   */
  static validateCSRFToken(
    token: string,
    maxAge: number = 60 * 60 * 1000
  ): boolean {
    if (!this.config.enableCSRFProtection) {
      return true;
    }

    try {
      const decoded = Buffer.from(token, 'base64').toString();
      const [timestamp] = decoded.split('.');

      const tokenAge = Date.now() - parseInt(timestamp);
      return tokenAge <= maxAge;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get rate limit middleware for Express/Next.js
   */
  static createRateLimitMiddleware(config: RateLimitConfig) {
    return (req: any, res: any, next: any) => {
      const identifier = req.ip || req.connection.remoteAddress || 'unknown';
      const result = this.checkRateLimit(identifier, config);

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': result.remaining.toString(),
        'X-RateLimit-Reset': new Date(result.resetTime).toISOString(),
      });

      if (!result.allowed) {
        this.logViolation({
          type: 'rate_limit',
          ip: identifier,
          userAgent: req.get('User-Agent'),
          details: { limit: config.maxRequests, windowMs: config.windowMs },
          severity: 'medium',
        });

        return res.status(429).json({
          success: false,
          error: 'Too many requests',
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        });
      }

      next();
    };
  }

  /**
   * Check for suspicious patterns in user behavior
   */
  static analyzeSuspiciousBehavior(
    ip: string,
    actions: Array<{ action: string; timestamp: number; details?: any }>
  ): {
    isSuspicious: boolean;
    riskScore: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let riskScore = 0;

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    // Too many actions in a short time
    const recentActions = actions.filter((a) => a.timestamp > oneMinuteAgo);
    if (recentActions.length > 100) {
      reasons.push('Too many actions per minute');
      riskScore += 30;
    }

    // Failed login attempts
    const failedLogins = actions.filter(
      (a) => a.action === 'login_failed' && a.timestamp > oneHourAgo
    );
    if (failedLogins.length > 5) {
      reasons.push('Multiple failed login attempts');
      riskScore += 40;
    }

    // Rapid game creation
    const gameCreations = actions.filter(
      (a) => a.action === 'game_created' && a.timestamp > oneMinuteAgo
    );
    if (gameCreations.length > 10) {
      reasons.push('Excessive game creation');
      riskScore += 20;
    }

    // Check against known violation patterns
    const violations = this.getViolations({ since: oneHourAgo });
    if (violations.length > 3) {
      reasons.push('Multiple security violations');
      riskScore += 50;
    }

    const isSuspicious = riskScore > 40;

    if (isSuspicious) {
      this.logViolation({
        type: 'invalid_input',
        ip,
        details: { riskScore, reasons, actions: recentActions },
        severity: riskScore > 70 ? 'critical' : 'high',
      });
    }

    return {
      isSuspicious,
      riskScore,
      reasons,
    };
  }

  /**
   * Clear old violations
   */
  static cleanupViolations(
    olderThan: number = 7 * 24 * 60 * 60 * 1000
  ): number {
    const cutoff = Date.now() - olderThan;
    const initialCount = this.violations.length;

    this.violations = this.violations.filter((v) => v.timestamp > cutoff);

    return initialCount - this.violations.length;
  }

  /**
   * Export security data for analysis
   */
  static exportData(): {
    violations: SecurityViolation[];
    config: SecurityConfig;
    stats: ReturnType<typeof SecurityService.getStats>;
  } {
    return {
      violations: this.violations,
      config: this.config,
      stats: this.getStats(),
    };
  }
}

/**
 * Predefined rate limit configurations
 */
export const RateLimitConfigs = {
  // Very strict limits for sensitive operations
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },

  // Moderate limits for general API usage
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // 100 requests per 15 minutes
  },

  // Relaxed limits for game operations
  game: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 requests per minute
  },

  // Strict limits for room creation
  roomCreation: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10, // 10 rooms per hour
  },

  // Very strict limits for matchmaking
  matchmaking: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 3, // 3 matchmaking requests per 5 minutes
  },
} as const;
