/**
 * Unit Tests for Rate Limiting System
 * Tests request throttling and rate limit enforcement
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  checkRateLimit,
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitStatus,
  cleanupExpiredEntries,
  RATE_LIMITS
} from '../core/rateLimit.js';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearAllRateLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow first request', () => {
      const result = checkRateLimit('test-endpoint', {
        windowMs: 60000,
        maxRequests: 10
      });

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.resetAt).toBeDefined();
    });

    it('should track request count correctly', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      // Make 3 requests
      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);
      const result = checkRateLimit('test-endpoint', config);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should block requests when limit exceeded', () => {
      const config = { windowMs: 60000, maxRequests: 3 };

      // Make 3 requests (max)
      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);

      // 4th request should be blocked
      const result = checkRateLimit('test-endpoint', config);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.message).toBeDefined();
    });

    it('should reset after time window expires', () => {
      const config = { windowMs: 60000, maxRequests: 3 };

      // Exhaust limit
      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);

      // Should be blocked
      let result = checkRateLimit('test-endpoint', config);
      expect(result.allowed).toBe(false);

      // Advance time past window
      vi.advanceTimersByTime(60001);

      // Should be allowed again
      result = checkRateLimit('test-endpoint', config);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('should track different endpoints separately', () => {
      const config = { windowMs: 60000, maxRequests: 2 };

      // Exhaust endpoint1
      checkRateLimit('endpoint1', config);
      checkRateLimit('endpoint1', config);

      const result1 = checkRateLimit('endpoint1', config);
      expect(result1.allowed).toBe(false);

      // endpoint2 should still be allowed
      const result2 = checkRateLimit('endpoint2', config);
      expect(result2.allowed).toBe(true);
    });

    it('should include custom message when provided', () => {
      const config = {
        windowMs: 60000,
        maxRequests: 1,
        message: 'Custom rate limit message'
      };

      checkRateLimit('test-endpoint', config);
      const result = checkRateLimit('test-endpoint', config);

      expect(result.allowed).toBe(false);
      expect(result.message).toBe('Custom rate limit message');
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit for specific key', () => {
      const config = { windowMs: 60000, maxRequests: 2 };

      // Exhaust limit
      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);

      let result = checkRateLimit('test-endpoint', config);
      expect(result.allowed).toBe(false);

      // Reset
      resetRateLimit('test-endpoint');

      // Should be allowed again
      result = checkRateLimit('test-endpoint', config);
      expect(result.allowed).toBe(true);
    });
  });

  describe('clearAllRateLimits', () => {
    it('should clear all rate limits', () => {
      const config = { windowMs: 60000, maxRequests: 1 };

      // Exhaust multiple endpoints
      checkRateLimit('endpoint1', config);
      checkRateLimit('endpoint2', config);

      clearAllRateLimits();

      // All should be allowed again
      expect(checkRateLimit('endpoint1', config).allowed).toBe(true);
      expect(checkRateLimit('endpoint2', config).allowed).toBe(true);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return status for existing entry', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);

      const status = getRateLimitStatus('test-endpoint');

      expect(status).not.toBeNull();
      expect(status?.count).toBe(2);
      expect(status?.resetAt).toBeDefined();
      expect(status?.timeUntilReset).toBeGreaterThan(0);
    });

    it('should return null for non-existent entry', () => {
      const status = getRateLimitStatus('non-existent');
      expect(status).toBeNull();
    });

    it('should calculate timeUntilReset correctly', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      checkRateLimit('test-endpoint', config);

      // Advance 30 seconds
      vi.advanceTimersByTime(30000);

      const status = getRateLimitStatus('test-endpoint');

      expect(status?.timeUntilReset).toBeLessThan(30001);
      expect(status?.timeUntilReset).toBeGreaterThan(29000);
    });
  });

  describe('cleanupExpiredEntries', () => {
    it('should remove expired entries', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      // Create entries
      checkRateLimit('endpoint1', config);
      checkRateLimit('endpoint2', config);
      checkRateLimit('endpoint3', config);

      // Advance past expiry
      vi.advanceTimersByTime(60001);

      const cleaned = cleanupExpiredEntries();

      expect(cleaned).toBe(3);

      // All should return null now
      expect(getRateLimitStatus('endpoint1')).toBeNull();
      expect(getRateLimitStatus('endpoint2')).toBeNull();
      expect(getRateLimitStatus('endpoint3')).toBeNull();
    });

    it('should not remove active entries', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      checkRateLimit('endpoint1', config);

      // Advance only 30 seconds
      vi.advanceTimersByTime(30000);

      const cleaned = cleanupExpiredEntries();

      expect(cleaned).toBe(0);
      expect(getRateLimitStatus('endpoint1')).not.toBeNull();
    });

    it('should return count of cleaned entries', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      // Create 5 entries
      for (let i = 0; i < 5; i++) {
        checkRateLimit(`endpoint${i}`, config);
      }

      vi.advanceTimersByTime(60001);

      const cleaned = cleanupExpiredEntries();
      expect(cleaned).toBe(5);
    });
  });

  describe('Pre-defined Rate Limits', () => {
    it('should have cloud rate limit configured', () => {
      expect(RATE_LIMITS.cloud).toBeDefined();
      expect(RATE_LIMITS.cloud.maxRequests).toBe(10);
      expect(RATE_LIMITS.cloud.windowMs).toBe(60000);
    });

    it('should have api rate limit configured', () => {
      expect(RATE_LIMITS.api).toBeDefined();
      expect(RATE_LIMITS.api.maxRequests).toBe(100);
    });

    it('should have safety rate limit configured', () => {
      expect(RATE_LIMITS.safety).toBeDefined();
      expect(RATE_LIMITS.safety.maxRequests).toBe(20);
    });

    it('should enforce cloud rate limit correctly', () => {
      // Make 10 requests (max)
      for (let i = 0; i < 10; i++) {
        const result = checkRateLimit('cloud:deploy', RATE_LIMITS.cloud);
        expect(result.allowed).toBe(true);
      }

      // 11th should be blocked
      const result = checkRateLimit('cloud:deploy', RATE_LIMITS.cloud);
      expect(result.allowed).toBe(false);
      expect(result.message).toContain('cloud operations');
    });
  });

  describe('Edge Cases', () => {
    it('should handle maxRequests = 1 correctly', () => {
      const config = { windowMs: 60000, maxRequests: 1 };

      const result1 = checkRateLimit('test-endpoint', config);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(0);

      const result2 = checkRateLimit('test-endpoint', config);
      expect(result2.allowed).toBe(false);
    });

    it('should handle very short time windows', () => {
      const config = { windowMs: 100, maxRequests: 2 };

      checkRateLimit('test-endpoint', config);
      checkRateLimit('test-endpoint', config);

      // Blocked
      expect(checkRateLimit('test-endpoint', config).allowed).toBe(false);

      // Wait for window to expire
      vi.advanceTimersByTime(101);

      // Should be allowed again
      expect(checkRateLimit('test-endpoint', config).allowed).toBe(true);
    });

    it('should handle concurrent requests to same endpoint', () => {
      const config = { windowMs: 60000, maxRequests: 5 };

      // Simulate 10 concurrent requests
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(checkRateLimit('test-endpoint', config));
      }

      // First 5 should be allowed
      expect(results.slice(0, 5).every(r => r.allowed)).toBe(true);

      // Last 5 should be blocked
      expect(results.slice(5).every(r => !r.allowed)).toBe(true);
    });
  });
});
