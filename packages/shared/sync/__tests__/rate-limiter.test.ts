import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(),
}));

import { createRedisClient } from '@everystack/shared/redis';
import {
  RateLimiter,
  rateLimiter,
  setRedisClient,
  AIRTABLE_RATE_LIMITS,
  type RateLimitResult,
} from '../rate-limiter';

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
  const keys = await redis.keys('ratelimit:*');
  if (keys.length > 0) {
    await redis.del(...keys);
  }
  await redis.quit();
});

// ---------------------------------------------------------------------------
// Platform Config Registration
// ---------------------------------------------------------------------------

describe('RateLimiter — platform config', () => {
  it('registers Airtable rate limits at construction', () => {
    const limiter = new RateLimiter();
    const config = limiter.getPlatformConfig('airtable');

    expect(config).toBeDefined();
    expect(config!.platform).toBe('airtable');
    expect(config!.limits).toHaveLength(2);
  }, 10_000);

  it('has correct Airtable per-base limit: 5 req/s', () => {
    const limiter = new RateLimiter();
    const config = limiter.getPlatformConfig('airtable')!;
    const perBase = config.limits.find((l) => l.scope === 'per_base');

    expect(perBase).toBeDefined();
    expect(perBase!.maxRequests).toBe(5);
    expect(perBase!.windowSeconds).toBe(1);
  }, 10_000);

  it('has correct Airtable per-API-key limit: 50 req/s', () => {
    const limiter = new RateLimiter();
    const config = limiter.getPlatformConfig('airtable')!;
    const perKey = config.limits.find((l) => l.scope === 'per_api_key');

    expect(perKey).toBeDefined();
    expect(perKey!.maxRequests).toBe(50);
    expect(perKey!.windowSeconds).toBe(1);
  }, 10_000);

  it('has Airtable retry strategy configured', () => {
    expect(AIRTABLE_RATE_LIMITS.retryStrategy).toEqual({
      maxRetries: 5,
      baseDelayMs: 200,
      maxDelayMs: 30_000,
      backoffMultiplier: 2,
    });
  }, 10_000);

  it('allows registering custom platform limits', () => {
    const limiter = new RateLimiter();
    limiter.registerPlatformLimits({
      platform: 'notion',
      limits: [{ scope: 'per_integration', maxRequests: 3, windowSeconds: 1 }],
      retryStrategy: {
        maxRetries: 3,
        baseDelayMs: 500,
        maxDelayMs: 60_000,
        backoffMultiplier: 2,
      },
    });

    const config = limiter.getPlatformConfig('notion');
    expect(config).toBeDefined();
    expect(config!.limits[0]!.maxRequests).toBe(3);
  }, 10_000);

  it('returns undefined for unregistered platform', () => {
    const limiter = new RateLimiter();
    expect(limiter.getPlatformConfig('smartsuite')).toBeUndefined();
  }, 10_000);

  it('exports singleton with Airtable pre-registered', () => {
    expect(rateLimiter).toBeInstanceOf(RateLimiter);
    expect(rateLimiter.getPlatformConfig('airtable')).toBeDefined();
  }, 10_000);
});

// ---------------------------------------------------------------------------
// checkLimit — under limit
// ---------------------------------------------------------------------------

describe('RateLimiter.checkLimit — under limit', () => {
  it('allows first request and returns correct remaining', async () => {
    const result = await rateLimiter.checkLimit('airtable', 'base:appTest1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 5 max - 1 used = 4
    expect(result.retryAfterMs).toBeNull();
  }, 10_000);

  it('allows 5 rapid requests within per-base limit', async () => {
    const results: RateLimitResult[] = [];
    for (let i = 0; i < 5; i++) {
      results.push(await rateLimiter.checkLimit('airtable', 'base:appTest2'));
    }

    expect(results.every((r) => r.allowed)).toBe(true);
    expect(results[0]!.remaining).toBe(4);
    expect(results[4]!.remaining).toBe(0);
  }, 10_000);

  it('tracks separate scope keys independently', async () => {
    // Exhaust base A
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit('airtable', 'base:appBaseA');
    }

    // Base B should still have capacity
    const result = await rateLimiter.checkLimit('airtable', 'base:appBaseB');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  }, 10_000);

  it('allows requests for unregistered platform (no limits)', async () => {
    const result = await rateLimiter.checkLimit('smartsuite', 'api_key:key1');

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
    expect(result.retryAfterMs).toBeNull();
  }, 10_000);

  it('allows requests for unmatched scope', async () => {
    const result = await rateLimiter.checkLimit(
      'airtable',
      'unknown_scope:xyz',
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(Infinity);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// checkLimit — over limit
// ---------------------------------------------------------------------------

describe('RateLimiter.checkLimit — over limit', () => {
  it('rejects 6th request after 5 rapid calls (per-base)', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit('airtable', 'base:appOver1');
    }

    const result = await rateLimiter.checkLimit('airtable', 'base:appOver1');

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(1000); // 1s window
  }, 10_000);

  it('provides positive retryAfterMs when rate limited', async () => {
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit('airtable', 'base:appRetry1');
    }

    const result = await rateLimiter.checkLimit('airtable', 'base:appRetry1');

    expect(result.retryAfterMs).not.toBeNull();
    expect(result.retryAfterMs!).toBeGreaterThan(0);
  }, 10_000);

  it('rejects 51st request for per-API-key limit', async () => {
    const promises = Array.from({ length: 50 }, () =>
      rateLimiter.checkLimit('airtable', 'api_key:keyOver1'),
    );
    const results = await Promise.all(promises);
    const allowedCount = results.filter((r) => r.allowed).length;
    expect(allowedCount).toBe(50);

    const result = await rateLimiter.checkLimit(
      'airtable',
      'api_key:keyOver1',
    );
    expect(result.allowed).toBe(false);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Lua script atomicity
// ---------------------------------------------------------------------------

describe('RateLimiter — Lua atomicity', () => {
  it('handles concurrent requests atomically (exactly 5 allowed)', async () => {
    const promises = Array.from({ length: 10 }, () =>
      rateLimiter.checkLimit('airtable', 'base:appAtomic1'),
    );
    const results = await Promise.all(promises);

    const allowed = results.filter((r) => r.allowed).length;
    const denied = results.filter((r) => !r.allowed).length;

    expect(allowed).toBe(5);
    expect(denied).toBe(5);
  }, 10_000);

  it('expires old entries and re-allows after window passes', async () => {
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit('airtable', 'base:appExpire1');
    }

    const denied = await rateLimiter.checkLimit('airtable', 'base:appExpire1');
    expect(denied.allowed).toBe(false);

    // Simulate window expiry by back-dating all ZSET entries
    const key = 'ratelimit:airtable:base:appExpire1';
    const members = await redis.zrange(key, 0, -1, 'WITHSCORES');
    for (let i = 0; i < members.length; i += 2) {
      const member = members[i]!;
      const score = Number(members[i + 1]!);
      // Move score 2 seconds into the past (window is 1s)
      await redis.zadd(key, String(score - 2000), member);
    }

    // Now capacity should be available
    const afterExpiry = await rateLimiter.checkLimit(
      'airtable',
      'base:appExpire1',
    );
    expect(afterExpiry.allowed).toBe(true);
    expect(afterExpiry.remaining).toBe(4);
  }, 10_000);

  it('sets TTL on Redis keys', async () => {
    await rateLimiter.checkLimit('airtable', 'base:appTTL1');

    const ttl = await redis.ttl('ratelimit:airtable:base:appTTL1');
    // 1s window → TTL should be ceil(1000/1000) + 10 = 11
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(11);
  }, 10_000);
});

// ---------------------------------------------------------------------------
// waitForCapacity
// ---------------------------------------------------------------------------

describe('RateLimiter.waitForCapacity', () => {
  it('resolves immediately when capacity is available', async () => {
    const start = Date.now();

    await rateLimiter.waitForCapacity('airtable', 'base:appWait1');

    const elapsed = Date.now() - start;
    // Should resolve almost instantly (under 100ms)
    expect(elapsed).toBeLessThan(100);
  }, 10_000);

  it('blocks until capacity opens with short window', async () => {
    // Register a custom platform with a very short window for testing
    const limiter = new RateLimiter();
    setRedisClient(redis);
    limiter.registerPlatformLimits({
      platform: 'airtable',
      limits: [{ scope: 'per_base', maxRequests: 2, windowSeconds: 1 }],
      retryStrategy: {
        maxRetries: 5,
        baseDelayMs: 50,
        maxDelayMs: 2000,
        backoffMultiplier: 1.5,
      },
    });

    // Exhaust the limit
    await limiter.checkLimit('airtable', 'base:appWait2');
    await limiter.checkLimit('airtable', 'base:appWait2');

    const denied = await limiter.checkLimit('airtable', 'base:appWait2');
    expect(denied.allowed).toBe(false);

    // Back-date the entries to simulate window expiry soon
    const key = 'ratelimit:airtable:base:appWait2';
    const members = await redis.zrange(key, 0, -1, 'WITHSCORES');
    for (let i = 0; i < members.length; i += 2) {
      const member = members[i]!;
      const score = Number(members[i + 1]!);
      // Move entries to 900ms ago (window is 1s, so they'll expire in ~100ms)
      await redis.zadd(key, String(score - 900), member);
    }

    // waitForCapacity should block briefly then resolve
    const start = Date.now();
    await limiter.waitForCapacity('airtable', 'base:appWait2', 5_000);
    const elapsed = Date.now() - start;

    // Should have waited some time but resolved before timeout
    expect(elapsed).toBeLessThan(5_000);
  }, 10_000);

  it('throws on timeout when capacity never opens', async () => {
    // Exhaust with default Airtable limits (5/s)
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit('airtable', 'base:appTimeout1');
    }

    // Very short timeout — won't be enough time for 1s window to pass
    await expect(
      rateLimiter.waitForCapacity('airtable', 'base:appTimeout1', 50),
    ).rejects.toThrow('Rate limit timeout');
  }, 10_000);

  it('breaks when deadline passes during checkLimit call', async () => {
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await rateLimiter.checkLimit('airtable', 'base:appDeadline1');
    }

    // 1ms timeout — checkLimit's Redis round-trip will exceed this,
    // triggering the remainingTime <= 0 break path
    await expect(
      rateLimiter.waitForCapacity('airtable', 'base:appDeadline1', 1),
    ).rejects.toThrow('Rate limit timeout');
  }, 10_000);

  it('resolves for unregistered platform (no limits)', async () => {
    await expect(
      rateLimiter.waitForCapacity('smartsuite', 'api_key:key1', 100),
    ).resolves.toBeUndefined();
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Redis failure — fail-open
// ---------------------------------------------------------------------------

describe('RateLimiter — Redis failure', () => {
  it('fails open when Redis is unavailable', async () => {
    // Create a limiter with a Redis client pointing to a bad port
    const badRedis = new Redis({
      host: 'localhost',
      port: 1, // nothing listening
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      connectTimeout: 100,
      retryStrategy: () => null, // never retry
    });
    setRedisClient(badRedis);

    const result = await rateLimiter.checkLimit('airtable', 'base:appFail1');

    expect(result.allowed).toBe(true);
    expect(result.retryAfterMs).toBeNull();

    await badRedis.quit().catch(() => {
      /* ignore */
    });
  }, 10_000);
});

// ---------------------------------------------------------------------------
// Lazy Redis initialization
// ---------------------------------------------------------------------------

describe('RateLimiter — lazy Redis init', () => {
  it('calls createRedisClient when no client is pre-set', async () => {
    const mockCreate = vi.mocked(createRedisClient);
    mockCreate.mockReturnValue(redis);

    // Reset to null to trigger lazy init path
    setRedisClient(null as unknown as typeof redis);

    const result = await rateLimiter.checkLimit('airtable', 'base:appLazy1');

    expect(mockCreate).toHaveBeenCalledWith('sync-rate-limiter');
    expect(result.allowed).toBe(true);

    mockCreate.mockReset();
  }, 10_000);
});
