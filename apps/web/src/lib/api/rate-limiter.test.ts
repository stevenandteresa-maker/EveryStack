import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextResponse } from 'next/server';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Mocks — hoisted by vitest before imports
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  RATE_LIMIT_TIERS: {
    basic: { requestsPerMinute: 60, burst: 10 },
    standard: { requestsPerMinute: 120, burst: 20 },
    high: { requestsPerMinute: 600, burst: 100 },
    enterprise: { requestsPerMinute: 2000, burst: 500 },
  },
}));

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// Mock createRedisClient — we inject our own Redis instance via setRedisClient
vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(),
}));

import {
  checkRateLimit,
  checkTenantCeiling,
  setRateLimitHeaders,
  setRedisClient,
  type RateLimitResult,
} from './rate-limiter';

// ---------------------------------------------------------------------------
// Redis Test Instance
// ---------------------------------------------------------------------------

let redis: Redis;

function getRedisConfig(): { host: string; port: number } {
  const redisUrl = process.env['REDIS_URL'];
  if (redisUrl) {
    const parsed = new URL(redisUrl);
    return {
      host: parsed.hostname || 'localhost',
      port: Number(parsed.port) || 6379,
    };
  }
  return {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: Number(process.env['REDIS_PORT'] ?? '6379'),
  };
}

beforeEach(async () => {
  const config = getRedisConfig();
  redis = new Redis({
    host: config.host,
    port: config.port,
    maxRetriesPerRequest: null,
    lazyConnect: false,
  });
  setRedisClient(redis);
});

afterEach(async () => {
  // Clean up all rate limit keys
  const keys = await redis.keys('rate_limit*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.quit();
});

// ---------------------------------------------------------------------------
// checkRateLimit — Token Bucket
// ---------------------------------------------------------------------------

describe('checkRateLimit', () => {
  it('allows requests up to burst limit', async () => {
    const apiKeyId = 'test-key-burst';

    // Basic tier: burst = 10
    const results: RateLimitResult[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(await checkRateLimit(apiKeyId, 'basic'));
    }

    // All 10 should be allowed
    expect(results.every((r) => r.allowed)).toBe(true);
    expect(results[0]!.limit).toBe(60);
    expect(results[0]!.remaining).toBe(9);
    expect(results[9]!.remaining).toBe(0);
  }, 10_000);

  it('rejects requests when bucket is empty', async () => {
    const apiKeyId = 'test-key-empty';

    // Basic tier: burst = 10 — exhaust all tokens
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(apiKeyId, 'basic');
    }

    // 11th request should be rejected
    const result = await checkRateLimit(apiKeyId, 'basic');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfter).toBeDefined();
    expect(result.retryAfter).toBeGreaterThanOrEqual(1);
  }, 10_000);

  it('refills tokens at correct rate over time', async () => {
    const apiKeyId = 'test-key-refill';

    // Basic tier: 60/min = 1/sec, burst = 10
    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      await checkRateLimit(apiKeyId, 'basic');
    }

    // Verify exhausted
    const exhausted = await checkRateLimit(apiKeyId, 'basic');
    expect(exhausted.allowed).toBe(false);

    // Simulate time passing by directly manipulating the Redis hash
    // Set last_refill to 2 seconds ago to simulate 2 tokens refilling
    const key = `rate_limit:${apiKeyId}`;
    const data = await redis.hgetall(key);
    const lastRefill = Number(data['last_refill']);
    await redis.hset(key, 'last_refill', String(lastRefill - 2000));

    // Now we should have ~2 tokens refilled (1/sec * 2s = 2 tokens)
    const afterWait = await checkRateLimit(apiKeyId, 'basic');
    expect(afterWait.allowed).toBe(true);
    expect(afterWait.remaining).toBeGreaterThanOrEqual(0);
  }, 10_000);

  it('respects tier configuration for standard tier', async () => {
    const apiKeyId = 'test-key-standard';

    // Standard tier: 120/min, burst = 20
    const result = await checkRateLimit(apiKeyId, 'standard');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(120);
    expect(result.remaining).toBe(19);
  }, 10_000);

  it('respects tier configuration for enterprise tier', async () => {
    const apiKeyId = 'test-key-enterprise';

    // Enterprise tier: 2000/min, burst = 500
    const result = await checkRateLimit(apiKeyId, 'enterprise');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(2000);
    expect(result.remaining).toBe(499);
  }, 10_000);

  it('falls back to standard tier for unknown tier', async () => {
    const apiKeyId = 'test-key-unknown';

    const result = await checkRateLimit(apiKeyId, 'nonexistent');

    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(120);
    expect(result.remaining).toBe(19);
  }, 10_000);

  it('returns correct resetAt timestamp', async () => {
    const apiKeyId = 'test-key-reset';
    const beforeMs = Math.ceil(Date.now() / 1000);

    const result = await checkRateLimit(apiKeyId, 'basic');

    expect(result.resetAt).toBeGreaterThanOrEqual(beforeMs);
  }, 10_000);

  it('handles concurrent requests atomically', async () => {
    const apiKeyId = 'test-key-concurrent';

    // Basic tier: burst = 10. Send 15 concurrent requests.
    const promises = Array.from({ length: 15 }, () =>
      checkRateLimit(apiKeyId, 'basic'),
    );
    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;

    // Exactly 10 should be allowed (burst limit), 5 denied
    expect(allowed).toBe(10);
    expect(denied).toBe(5);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// setRateLimitHeaders
// ---------------------------------------------------------------------------

describe('setRateLimitHeaders', () => {
  function createMockResponse(): NextResponse {
    const headers = new Map<string, string>();
    return {
      headers: {
        set: (key: string, value: string) => headers.set(key, value),
        get: (key: string) => headers.get(key) ?? null,
      },
    } as unknown as NextResponse;
  }

  it('sets all 3 standard rate limit headers', () => {
    const response = createMockResponse();
    const result: RateLimitResult = {
      allowed: true,
      limit: 120,
      remaining: 117,
      resetAt: 1709125200,
    };

    setRateLimitHeaders(response, result);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('120');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('117');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1709125200');
  });

  it('adds Retry-After header when rate limited', () => {
    const response = createMockResponse();
    const result: RateLimitResult = {
      allowed: false,
      limit: 60,
      remaining: 0,
      resetAt: 1709125260,
      retryAfter: 5,
    };

    setRateLimitHeaders(response, result);

    expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
    expect(response.headers.get('X-RateLimit-Reset')).toBe('1709125260');
    expect(response.headers.get('Retry-After')).toBe('5');
  });

  it('does not set Retry-After when request is allowed', () => {
    const response = createMockResponse();
    const result: RateLimitResult = {
      allowed: true,
      limit: 120,
      remaining: 50,
      resetAt: 1709125200,
    };

    setRateLimitHeaders(response, result);

    expect(response.headers.get('Retry-After')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkTenantCeiling
// ---------------------------------------------------------------------------

describe('checkTenantCeiling', () => {
  it('allows requests within tenant ceiling', async () => {
    const tenantId = 'tenant-ceiling-test';

    const result = await checkTenantCeiling(tenantId, 'standard');

    // Ceiling = 3 x 120 = 360
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(360);
    expect(result.remaining).toBe(359);
  }, 10_000);

  it('computes ceiling as 3x highest tier (standard → 360/min)', async () => {
    const tenantId = 'tenant-ceiling-standard';

    const result = await checkTenantCeiling(tenantId, 'standard');

    expect(result.limit).toBe(360);
  }, 10_000);

  it('computes ceiling as 3x highest tier (high → 1800/min)', async () => {
    const tenantId = 'tenant-ceiling-high';

    const result = await checkTenantCeiling(tenantId, 'high');

    expect(result.limit).toBe(1800);
  }, 10_000);

  it('rejects requests when tenant ceiling is exceeded', async () => {
    const tenantId = 'tenant-ceiling-exceed';

    // Use basic tier: ceiling = 3 x 60 = 180
    // Send 180 requests to exhaust the ceiling
    const promises = Array.from({ length: 180 }, () =>
      checkTenantCeiling(tenantId, 'basic'),
    );
    const results = await Promise.all(promises);

    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(180);

    // 181st request should be denied
    const denied = await checkTenantCeiling(tenantId, 'basic');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfter).toBeDefined();
    expect(denied.retryAfter).toBeGreaterThanOrEqual(1);
  }, 30_000);

  it('caches ceiling value in Redis with 60s TTL', async () => {
    const tenantId = 'tenant-ceiling-cache';

    await checkTenantCeiling(tenantId, 'standard');

    const cacheKey = `rate_limit_tenant_ceiling:${tenantId}`;
    const cached = await redis.get(cacheKey);
    expect(cached).toBe('360');

    const ttl = await redis.ttl(cacheKey);
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60);
  }, 10_000);

  it('falls back to standard tier for unknown tier', async () => {
    const tenantId = 'tenant-ceiling-unknown';

    const result = await checkTenantCeiling(tenantId, 'nonexistent');

    // Fallback: standard = 120, ceiling = 360
    expect(result.limit).toBe(360);
  }, 10_000);
});
