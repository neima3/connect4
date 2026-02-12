import { jwtVerify, SignJWT } from 'jose';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';

const secretKey = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-in-production'
);

export interface User {
  id: string;
  name: string;
  sessionId: string;
  createdAt: number;
  lastActive: number;
}

export interface Session {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

export class AuthService {
  private static readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
  private static readonly COOKIE_NAME = 'connect4-session';
  private static readonly sessions = new Map<string, Session>();
  private static readonly users = new Map<string, User>();

  /**
   * Create a new user session
   */
  static async createUser(
    userName: string
  ): Promise<{ user: User; token: string }> {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();

    const user: User = {
      id: userId,
      name: userName,
      sessionId,
      createdAt: now,
      lastActive: now,
    };

    const session: Session = {
      userId,
      sessionId,
      expiresAt: now + this.SESSION_DURATION,
    };

    // Store user and session
    this.users.set(userId, user);
    this.sessions.set(sessionId, session);

    // Generate JWT token
    const token = await new SignJWT({
      userId,
      sessionId,
      userName,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(now)
      .setExpirationTime(now + this.SESSION_DURATION)
      .sign(secretKey);

    return { user, token };
  }

  /**
   * Validate and extract user from JWT token
   */
  static async validateToken(token: string): Promise<User | null> {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      const { userId, sessionId } = payload as {
        userId: string;
        sessionId: string;
      };

      // Check if session exists and is not expired
      const session = this.sessions.get(sessionId);
      if (!session || session.expiresAt < Date.now()) {
        return null;
      }

      // Get user
      const user = this.users.get(userId);
      if (!user || user.sessionId !== sessionId) {
        return null;
      }

      // Update last active time
      user.lastActive = Date.now();

      return user;
    } catch (error) {
      console.error('Token validation error:', error);
      return null;
    }
  }

  /**
   * Get current user from request cookies
   */
  static async getCurrentUser(request?: NextRequest): Promise<User | null> {
    let token: string | undefined;

    if (request) {
      // Try to get token from request cookies first
      token = request.cookies.get(this.COOKIE_NAME)?.value;
    } else {
      // Fallback to server-side cookies
      const cookieStore = await cookies();
      token = cookieStore.get(this.COOKIE_NAME)?.value;
    }

    if (!token) {
      return null;
    }

    return this.validateToken(token);
  }

  /**
   * Set session cookie (returns cookie header value)
   */
  static createSessionCookie(token: string): string {
    const maxAge = this.SESSION_DURATION / 1000;
    const secure = process.env.NODE_ENV === 'production';

    return `${this.COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=lax${secure ? '; Secure' : ''}`;
  }

  /**
   * Create clear session cookie header value
   */
  static createClearSessionCookie(): string {
    return `${this.COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=lax`;
  }

  /**
   * Logout user
   */
  static async logout(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      // Note: We keep the user data for analytics but could delete if needed
    }
  }

  /**
   * Clean up expired sessions
   */
  static cleanupExpiredSessions(): { cleaned: number; remaining: number } {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
        cleaned++;
      }
    }

    return {
      cleaned,
      remaining: this.sessions.size,
    };
  }

  /**
   * Get active user count
   */
  static getActiveUserCount(): number {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    let activeCount = 0;
    for (const user of this.users.values()) {
      if (user.lastActive > oneHourAgo) {
        activeCount++;
      }
    }

    return activeCount;
  }

  /**
   * Get user by ID
   */
  static getUserById(userId: string): User | null {
    return this.users.get(userId) || null;
  }

  /**
   * Update user name
   */
  static async updateUserName(
    userId: string,
    newName: string
  ): Promise<User | null> {
    const user = this.users.get(userId);
    if (!user) {
      return null;
    }

    // Validate new name
    if (newName.length < 1 || newName.length > 50) {
      throw new Error('User name must be between 1 and 50 characters');
    }

    user.name = newName;
    user.lastActive = Date.now();

    return user;
  }

  /**
   * Get session info
   */
  static getSessionInfo(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      ...session,
      timeRemaining: Math.max(0, session.expiresAt - Date.now()),
    } as Session & { timeRemaining: number };
  }

  /**
   * Extend session
   */
  static async extendSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.expiresAt = Date.now() + this.SESSION_DURATION;
    return true;
  }

  /**
   * Validate user name format
   */
  static validateUserName(name: string): { isValid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { isValid: false, error: 'User name is required' };
    }

    if (name.length > 50) {
      return {
        isValid: false,
        error: 'User name must be 50 characters or less',
      };
    }

    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
      return {
        isValid: false,
        error:
          'User name can only contain letters, numbers, spaces, hyphens, and underscores',
      };
    }

    if (name.trim() !== name) {
      return {
        isValid: false,
        error: 'User name cannot start or end with spaces',
      };
    }

    return { isValid: true };
  }

  /**
   * Get statistics
   */
  static getStats(): {
    totalUsers: number;
    activeSessions: number;
    activeUsersLastHour: number;
  } {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    const activeUsersLastHour = Array.from(this.users.values()).filter(
      (user) => user.lastActive > oneHourAgo
    ).length;

    return {
      totalUsers: this.users.size,
      activeSessions: this.sessions.size,
      activeUsersLastHour,
    };
  }
}
