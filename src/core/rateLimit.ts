/**
 * Iori v3.1 Rate Limiting System
 * Prevents abuse of API endpoints
 *
 * @philosophy "Reasonable limits" - Protect against accidental DoS, not paranoid security
 */

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string; // Custom message when limit exceeded
}

/**
 * Request tracking entry
 */
interface RequestEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory request tracker
 * Key: endpoint or client identifier
 */
const requestTracker = new Map<string, RequestEntry>();

/**
 * Default rate limit configurations for different endpoint types
 */
export const RATE_LIMITS = {
  // Cloud operations (git, vercel, firebase) - 10 per minute
  cloud: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: 'Too many cloud operations. Please wait before trying again.'
  },
  // API calls - 100 per minute
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    message: 'Too many requests. Please slow down.'
  },
  // Safety confirmations - 20 per minute
  safety: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: 'Too many confirmation attempts. Please wait.'
  }
};

/**
 * Check if a request should be rate limited
 * @param key Unique identifier for the endpoint (e.g., "cloud:/api/cloud/action")
 * @param config Rate limit configuration
 * @returns { allowed: boolean, remaining?: number, resetAt?: number }
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): {
  allowed: boolean;
  remaining?: number;
  resetAt?: number;
  message?: string;
} {
  const now = Date.now();
  const entry = requestTracker.get(key);

  // No entry or window expired - allow and create new entry
  if (!entry || now > entry.resetAt) {
    const resetAt = now + config.windowMs;
    requestTracker.set(key, {
      count: 1,
      resetAt
    });
    return {
      allowed: true,
      remaining: config.maxRequests - 1,
      resetAt
    };
  }

  // Entry exists and window is active
  if (entry.count >= config.maxRequests) {
    // Limit exceeded
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      message: config.message || 'Rate limit exceeded'
    };
  }

  // Increment count and allow
  entry.count++;
  return {
    allowed: true,
    remaining: config.maxRequests - entry.count,
    resetAt: entry.resetAt
  };
}

/**
 * Reset rate limit for a specific key
 * Useful for testing or manual overrides
 */
export function resetRateLimit(key: string): void {
  requestTracker.delete(key);
}

/**
 * Clear all rate limit entries
 * Useful for testing
 */
export function clearAllRateLimits(): void {
  requestTracker.clear();
}

/**
 * Get current rate limit status for a key
 */
export function getRateLimitStatus(key: string): {
  count: number;
  resetAt: number;
  timeUntilReset: number;
} | null {
  const entry = requestTracker.get(key);
  if (!entry) {
    return null;
  }

  return {
    count: entry.count,
    resetAt: entry.resetAt,
    timeUntilReset: Math.max(0, entry.resetAt - Date.now())
  };
}

/**
 * Cleanup expired entries periodically
 * Run this on a timer to prevent memory leaks
 */
export function cleanupExpiredEntries(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of requestTracker.entries()) {
    if (now > entry.resetAt) {
      requestTracker.delete(key);
      cleaned++;
    }
  }

  return cleaned;
}
