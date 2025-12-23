/**
 * Iori v3.0 Authentication System
 * JWT-based token authentication for Iori Dashboard
 *
 * @module @sentinel - Security focused implementation
 */

import { randomBytes, scrypt, timingSafeEqual, createHmac } from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';
import { checkRateLimit, type RateLimitConfig } from './rateLimit.js';

const scryptAsync = promisify(scrypt);

/**
 * User credentials schema
 */
const UserCredentialsSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(8).max(128)
});

/**
 * JWT payload structure
 */
interface JWTPayload {
  sub: string; // Subject (user ID)
  username: string;
  iat: number; // Issued at
  exp: number; // Expiration
  jti: string; // JWT ID (for revocation)
}

/**
 * User record stored in memory
 */
interface UserRecord {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  lastLogin?: number;
}

/**
 * Session record for tracking active sessions
 */
interface SessionRecord {
  jti: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
  revoked: boolean;
}

/**
 * Authentication result
 */
export interface AuthResult {
  success: boolean;
  token?: string;
  expiresIn?: number;
  error?: string;
}

/**
 * Token verification result
 */
export interface VerifyResult {
  valid: boolean;
  payload?: JWTPayload;
  error?: string;
}

/**
 * Rate limit config for login attempts
 */
const LOGIN_RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per 15 minutes
  message: 'Too many login attempts. Please try again later.'
};

/**
 * AuthService - Handles all authentication operations
 * Uses in-memory storage (suitable for single-instance deployment)
 */
export class AuthService {
  private readonly users = new Map<string, UserRecord>();
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly jwtSecret: string;
  private readonly tokenExpiryMs: number;

  constructor(jwtSecret?: string, tokenExpiryMs = 24 * 60 * 60 * 1000) {
    this.jwtSecret = jwtSecret || process.env.JWT_SECRET || randomBytes(32).toString('hex');
    this.tokenExpiryMs = tokenExpiryMs;

    if (!jwtSecret && !process.env.JWT_SECRET) {
      console.warn('[AuthService] No JWT_SECRET provided. Using random secret.');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const [salt, storedHash] = hash.split(':');
    if (!salt || !storedHash) return false;

    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return timingSafeEqual(derivedKey, storedBuffer);
  }

  private createToken(payload: JWTPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    return `${headerB64}.${payloadB64}.${signature}`;
  }

  private verifyToken(token: string): VerifyResult {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return { valid: false, error: 'Invalid token format' };

      const [headerB64, payloadB64, signature] = parts;
      const expectedSignature = createHmac('sha256', this.jwtSecret)
        .update(`${headerB64}.${payloadB64}`)
        .digest('base64url');

      if (signature !== expectedSignature) return { valid: false, error: 'Invalid signature' };

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as JWTPayload;
      if (Date.now() > payload.exp) return { valid: false, error: 'Token expired' };

      return { valid: true, payload };
    } catch {
      return { valid: false, error: 'Token verification failed' };
    }
  }

  async register(username: string, password: string): Promise<AuthResult> {
    try {
      const validation = UserCredentialsSchema.safeParse({ username, password });
      if (!validation.success) {
        return { success: false, error: validation.error.issues[0]?.message || 'Invalid credentials' };
      }

      const existingUser = Array.from(this.users.values()).find(u => u.username === username);
      if (existingUser) return { success: false, error: 'Username already exists' };

      const id = randomBytes(16).toString('hex');
      const passwordHash = await this.hashPassword(password);
      this.users.set(id, { id, username, passwordHash, createdAt: Date.now() });

      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Registration failed' };
    }
  }

  async login(username: string, password: string, clientId?: string): Promise<AuthResult> {
    try {
      const rateLimitKey = `login:${clientId || username}`;
      const rateLimitResult = checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT);
      if (!rateLimitResult.allowed) {
        return { success: false, error: rateLimitResult.message || 'Too many login attempts' };
      }

      const validation = UserCredentialsSchema.safeParse({ username, password });
      if (!validation.success) return { success: false, error: 'Invalid credentials' };

      const user = Array.from(this.users.values()).find(u => u.username === username);
      if (!user) {
        await this.hashPassword(password); // Constant-time defense
        return { success: false, error: 'Invalid credentials' };
      }

      const isValid = await this.verifyPassword(password, user.passwordHash);
      if (!isValid) return { success: false, error: 'Invalid credentials' };

      user.lastLogin = Date.now();
      const jti = randomBytes(16).toString('hex');
      const now = Date.now();
      const expiresAt = now + this.tokenExpiryMs;

      this.sessions.set(jti, { jti, userId: user.id, createdAt: now, expiresAt, revoked: false });

      const token = this.createToken({ sub: user.id, username: user.username, iat: now, exp: expiresAt, jti });
      return { success: true, token, expiresIn: this.tokenExpiryMs };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
    }
  }

  async verify(token: string): Promise<VerifyResult> {
    const result = this.verifyToken(token);
    if (!result.valid || !result.payload) return result;

    const session = this.sessions.get(result.payload.jti);
    if (!session || session.revoked) return { valid: false, error: 'Session revoked' };

    return result;
  }

  async logout(token: string): Promise<{ success: boolean; error?: string }> {
    const result = this.verifyToken(token);
    if (!result.valid || !result.payload) return { success: false, error: result.error };

    const session = this.sessions.get(result.payload.jti);
    if (session) session.revoked = true;

    return { success: true };
  }

  revokeAllSessions(userId: string): void {
    for (const session of this.sessions.values()) {
      if (session.userId === userId) session.revoked = true;
    }
  }

  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleaned = 0;
    for (const [jti, session] of this.sessions.entries()) {
      if (now > session.expiresAt) { this.sessions.delete(jti); cleaned++; }
    }
    return cleaned;
  }

  getUserById(userId: string): Omit<UserRecord, 'passwordHash'> | null {
    const user = this.users.get(userId);
    if (!user) return null;
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  getActiveSessionCount(userId: string): number {
    let count = 0;
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revoked && now < session.expiresAt) count++;
    }
    return count;
  }

  userExists(username: string): boolean {
    return Array.from(this.users.values()).some(u => u.username === username);
  }
}

let authServiceInstance: AuthService | null = null;

export function getAuthService(jwtSecret?: string): AuthService {
  if (!authServiceInstance) authServiceInstance = new AuthService(jwtSecret);
  return authServiceInstance;
}

export function resetAuthService(): void {
  authServiceInstance = null;
}