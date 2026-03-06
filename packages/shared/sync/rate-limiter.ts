// ---------------------------------------------------------------------------
// Sync Rate Limiter — proactive, Redis-backed sliding-window rate limiting
//
// Uses a ZSET per key (scored by timestamp) with an atomic Lua script to
// ensure the sync scheduler never exceeds platform API rate limits.
// 429 responses should be rare exceptions, not the norm.
//
// @see docs/reference/sync-engine.md § External API Rate Limit Management
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import { createRedisClient } from '@everystack/shared/redis';
import { createLogger } from '@everystack/shared/logging';
import type { PlatformRateLimits, RateLimit } from './adapters/types';

const logger = createLogger({ service: 'sync-rate-limiter' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  /** Whether the request is allowed through. */
  allowed: boolean;
  /** Number of remaining requests in the current window. */
  remaining: number;
  /** Milliseconds to wait before retrying, or null if allowed. */
  retryAfterMs: number | null;
}

// ---------------------------------------------------------------------------
// Redis Client — lazy singleton
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient('sync-rate-limiter');
  }
  return redisClient;
}

/**
 * Replace the Redis client used by the rate limiter.
 * Exposed for testing — production code should never call this.
 */
export function setRedisClient(client: Redis): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// Lua Script — Atomic Sliding-Window ZSET
// ---------------------------------------------------------------------------

/**
 * Atomic sliding-window rate limit check using a Redis sorted set.
 *
 * KEYS[1] = ratelimit:{platform}:{scope_key}
 * ARGV[1] = maxRequests
 * ARGV[2] = windowMs  (window size in milliseconds)
 * ARGV[3] = nowMs     (current time in milliseconds)
 *
 * Steps:
 *   1. Remove expired entries (score < nowMs - windowMs)
 *   2. Count remaining entries in the window
 *   3. If count < maxRequests: add new entry, return [1, remaining, 0]
 *   4. If count >= maxRequests: return [0, 0, retryAfterMs]
 *
 * Returns: [allowed (0|1), remaining, retryAfterMs]
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

-- 1. Remove entries outside the sliding window
local window_start = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- 2. Count current entries in the window
local current = redis.call('ZCARD', key)

if current >= max_requests then
  -- 4. Over limit — compute retry delay from oldest entry
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry_after_ms = window_ms
  if oldest and oldest[2] then
    retry_after_ms = tonumber(oldest[2]) + window_ms - now_ms
    if retry_after_ms < 1 then
      retry_after_ms = 1
    end
  end
  return { 0, 0, retry_after_ms }
end

-- 3. Under limit — add this request with a unique member
local member = now_ms .. ':' .. math.random(1, 999999999)
redis.call('ZADD', key, now_ms, member)

-- Set TTL slightly longer than the window to auto-clean
redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 10)

local remaining = max_requests - current - 1
return { 1, remaining, 0 }
`;

// ---------------------------------------------------------------------------
// Airtable Rate Limit Configuration
// ---------------------------------------------------------------------------

const AIRTABLE_RATE_LIMITS: PlatformRateLimits = {
  platform: 'airtable',
  limits: [
    { scope: 'per_base', maxRequests: 5, windowSeconds: 1 },
    { scope: 'per_api_key', maxRequests: 50, windowSeconds: 1 },
  ],
  retryStrategy: {
    maxRetries: 5,
    baseDelayMs: 200,
    maxDelayMs: 30_000,
    backoffMultiplier: 2,
  },
};

// ---------------------------------------------------------------------------
// RateLimiter Class
// ---------------------------------------------------------------------------

export class RateLimiter {
  private platformConfigs = new Map<string, PlatformRateLimits>();

  constructor() {
    // Register Airtable limits at construction
    this.registerPlatformLimits(AIRTABLE_RATE_LIMITS);
  }

  /**
   * Register rate limit configuration for a platform.
   * Can be called at any time to update limits when platforms change.
   */
  registerPlatformLimits(config: PlatformRateLimits): void {
    this.platformConfigs.set(config.platform, config);
  }

  /**
   * Get the registered configuration for a platform.
   */
  getPlatformConfig(platform: string): PlatformRateLimits | undefined {
    return this.platformConfigs.get(platform);
  }

  /**
   * Check whether a request is allowed under the rate limit for a given
   * platform and scope key.
   *
   * The scopeKey combines the scope and identifier, e.g.:
   *   - `base:appABC123` (Airtable per-base limit)
   *   - `api_key:keyXYZ`  (Airtable per-API-key limit)
   *
   * The rate limit is looked up from the registered platform config
   * by matching the scope prefix (the part before the first `:`).
   *
   * @param platform - Platform identifier (e.g. 'airtable')
   * @param scopeKey - Scope and identifier (e.g. 'base:appABC123')
   * @returns Rate limit check result
   */
  async checkLimit(
    platform: string,
    scopeKey: string,
  ): Promise<RateLimitResult> {
    const config = this.platformConfigs.get(platform);
    if (!config) {
      // No limits registered — allow everything
      return { allowed: true, remaining: Infinity, retryAfterMs: null };
    }

    // Extract scope from scopeKey (e.g. 'base' from 'base:appABC123')
    const scope = this.extractScope(scopeKey, config.limits);
    if (!scope) {
      // No matching limit for this scope — allow
      return { allowed: true, remaining: Infinity, retryAfterMs: null };
    }

    const redisKey = `ratelimit:${platform}:${scopeKey}`;
    const windowMs = scope.windowSeconds * 1000;
    const nowMs = Date.now();

    const redis = getRedis();

    try {
      const result = (await redis.eval(
        SLIDING_WINDOW_LUA,
        1,
        redisKey,
        scope.maxRequests,
        windowMs,
        nowMs,
      )) as [number, number, number];

      const [allowed, remaining, retryAfterMs] = result;

      return {
        allowed: allowed === 1,
        remaining,
        retryAfterMs: allowed === 1 ? null : retryAfterMs,
      };
    } catch (err: unknown) {
      // Fail open — if Redis is down, allow the request. The platform's
      // own 429 response will act as the fallback safety net.
      logger.error(
        { err, platform, scopeKey },
        'Sync rate limit check failed — failing open',
      );
      return { allowed: true, remaining: 0, retryAfterMs: null };
    }
  }

  /**
   * Block until capacity is available for the given platform and scope key.
   *
   * Polls checkLimit() with exponential backoff. Resolves when a request
   * is allowed, or throws if the timeout is exceeded.
   *
   * @param platform - Platform identifier
   * @param scopeKey - Scope and identifier
   * @param timeoutMs - Maximum time to wait (default 30 seconds)
   */
  async waitForCapacity(
    platform: string,
    scopeKey: string,
    timeoutMs = 30_000,
  ): Promise<void> {
    const config = this.platformConfigs.get(platform);
    const baseDelay = config?.retryStrategy.baseDelayMs ?? 100;
    const maxDelay = config?.retryStrategy.maxDelayMs ?? 30_000;
    const multiplier = config?.retryStrategy.backoffMultiplier ?? 2;

    const deadline = Date.now() + timeoutMs;
    let delay = baseDelay;

    while (Date.now() < deadline) {
      const result = await this.checkLimit(platform, scopeKey);
      if (result.allowed) {
        return;
      }

      // Use the smaller of: retryAfterMs hint, current backoff delay, or remaining time
      const remainingTime = deadline - Date.now();
      if (remainingTime <= 0) {
        break;
      }

      const waitTime = Math.min(
        result.retryAfterMs ?? delay,
        delay,
        remainingTime,
      );

      await sleep(waitTime);
      delay = Math.min(delay * multiplier, maxDelay);
    }

    throw new Error(
      `Rate limit timeout: waited ${timeoutMs}ms for capacity on ${platform}:${scopeKey}`,
    );
  }

  /**
   * Match a scopeKey to its RateLimit config entry.
   *
   * Convention: scopeKey is `{scope_prefix}:{identifier}`.
   * The scope_prefix is matched against `RateLimit.scope` by converting
   * underscores to match (e.g. scope='per_base' matches prefix='base').
   */
  private extractScope(
    scopeKey: string,
    limits: RateLimit[],
  ): RateLimit | undefined {
    const colonIndex = scopeKey.indexOf(':');
    const prefix = colonIndex === -1 ? scopeKey : scopeKey.slice(0, colonIndex);

    return limits.find((limit) => {
      // Match 'per_base' scope to 'base' prefix, or 'per_api_key' to 'api_key'
      const scopeSuffix = limit.scope.startsWith('per_')
        ? limit.scope.slice(4)
        : limit.scope;
      return scopeSuffix === prefix || limit.scope === prefix;
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const rateLimiter = new RateLimiter();

// Re-export config for external registration
export { AIRTABLE_RATE_LIMITS };
