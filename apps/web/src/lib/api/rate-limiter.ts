/**
 * Redis Token-Bucket Rate Limiter
 *
 * Provides per-API-key rate limiting using an atomic Redis Lua script
 * implementing the token-bucket algorithm, plus a per-tenant ceiling
 * that prevents key proliferation as a rate limit bypass.
 *
 * Composed with auth middleware in the API pipeline (Prompt 6).
 *
 * @see docs/reference/platform-api.md § Rate Limiting
 */

import type { NextResponse } from 'next/server';
import type Redis from 'ioredis';
import { createRedisClient } from '@everystack/shared/redis';
import { RATE_LIMIT_TIERS } from '@everystack/shared/db';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'rate-limiter' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

// ---------------------------------------------------------------------------
// Redis Client — lazy singleton
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient('rate-limiter');
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
// Lua Script — Atomic Token Bucket
// ---------------------------------------------------------------------------

/**
 * Atomic token-bucket Lua script.
 *
 * KEYS[1] = rate_limit:{apiKeyId}
 * ARGV[1] = burst (max tokens)
 * ARGV[2] = refill rate (tokens per second)
 * ARGV[3] = now (Unix timestamp with ms precision)
 *
 * Returns: [allowed (0|1), remaining, resetAtMs]
 *
 * The bucket stores two hash fields:
 *   - tokens: current token count (scaled by 1000 for sub-integer precision)
 *   - last_refill: last refill timestamp in ms
 *
 * On each call: refill based on elapsed time, cap at burst, consume 1 token.
 */
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local burst = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

-- Scale factor: store tokens * 1000 for sub-integer precision
local SCALE = 1000

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens_scaled
local last_refill

if data[1] == false then
  -- First request: initialize bucket at burst capacity
  tokens_scaled = burst * SCALE
  last_refill = now_ms
else
  tokens_scaled = tonumber(data[1])
  last_refill = tonumber(data[2])
end

-- Refill tokens based on elapsed time
local elapsed_ms = math.max(now_ms - last_refill, 0)
local refill = math.floor(elapsed_ms * rate * SCALE / 1000)

if refill > 0 then
  tokens_scaled = math.min(tokens_scaled + refill, burst * SCALE)
  last_refill = now_ms
end

-- Attempt to consume 1 token
local allowed = 0
if tokens_scaled >= SCALE then
  tokens_scaled = tokens_scaled - SCALE
  allowed = 1
end

-- Calculate reset time: time until 1 token is available
local reset_at_ms = now_ms
if tokens_scaled < SCALE then
  local deficit = SCALE - tokens_scaled
  local refill_time_ms = math.ceil(deficit / (rate * SCALE / 1000))
  reset_at_ms = now_ms + refill_time_ms
end

-- Store state with TTL = 2x the time to fill the bucket from empty
local ttl_seconds = math.ceil(burst / rate * 2)
redis.call('HSET', key, 'tokens', tokens_scaled, 'last_refill', last_refill)
redis.call('EXPIRE', key, ttl_seconds)

-- Return remaining as integer (floor of scaled / SCALE)
local remaining = math.floor(tokens_scaled / SCALE)

return { allowed, remaining, reset_at_ms }
`;

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------

/**
 * Check and consume a rate limit token for an API key.
 *
 * Uses the token-bucket algorithm: tokens refill at a steady rate
 * (requestsPerMinute / 60 tokens per second) up to the burst cap.
 * Each request consumes 1 token.
 */
export async function checkRateLimit(
  apiKeyId: string,
  tier: string,
): Promise<RateLimitResult> {
  const tierConfig =
    RATE_LIMIT_TIERS[tier as keyof typeof RATE_LIMIT_TIERS] ??
    RATE_LIMIT_TIERS.standard;

  const burst = tierConfig.burst;
  const tokensPerSecond = tierConfig.requestsPerMinute / 60;
  const nowMs = Date.now();

  const redis = getRedis();

  try {
    const result = (await redis.eval(
      TOKEN_BUCKET_LUA,
      1,
      `rate_limit:${apiKeyId}`,
      burst,
      tokensPerSecond,
      nowMs,
    )) as [number, number, number];

    const [allowed, remaining, resetAtMs] = result;

    const rateLimitResult: RateLimitResult = {
      allowed: allowed === 1,
      limit: tierConfig.requestsPerMinute,
      remaining,
      resetAt: Math.ceil(resetAtMs / 1000),
    };

    if (!rateLimitResult.allowed) {
      rateLimitResult.retryAfter = Math.max(
        1,
        Math.ceil((resetAtMs - nowMs) / 1000),
      );
    }

    return rateLimitResult;
  } catch (err: unknown) {
    // If Redis is down, fail open — allow the request but log the error
    logger.error({ err, apiKeyId, tier }, 'Rate limit check failed');
    return {
      allowed: true,
      limit: tierConfig.requestsPerMinute,
      remaining: tierConfig.burst,
      resetAt: Math.ceil(nowMs / 1000) + 60,
    };
  }
}

// ---------------------------------------------------------------------------
// setRateLimitHeaders
// ---------------------------------------------------------------------------

/**
 * Set standard rate limit headers on an API response.
 *
 * Always sets: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * When blocked (429): also sets Retry-After
 */
export function setRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): void {
  response.headers.set('X-RateLimit-Limit', String(result.limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetAt));

  if (result.retryAfter !== undefined) {
    response.headers.set('Retry-After', String(result.retryAfter));
  }
}

// ---------------------------------------------------------------------------
// Tenant Ceiling — Lua Script
// ---------------------------------------------------------------------------

/**
 * Sliding-window counter Lua script for per-tenant ceiling.
 *
 * KEYS[1] = rate_limit_tenant:{tenantId}
 * ARGV[1] = ceiling (max requests per window)
 * ARGV[2] = window_ms (window size in milliseconds)
 * ARGV[3] = now_ms (current time in milliseconds)
 *
 * Uses a Redis sorted set with timestamps as scores.
 * Removes entries outside the window, counts remaining, adds new entry if allowed.
 *
 * Returns: [allowed (0|1), remaining, resetAtMs]
 */
const TENANT_CEILING_LUA = `
local key = KEYS[1]
local ceiling = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

-- Remove entries outside the sliding window
local window_start = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current entries in the window
local current = redis.call('ZCARD', key)

if current >= ceiling then
  -- Get the oldest entry to calculate reset time
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local reset_at_ms = now_ms + window_ms
  if oldest and oldest[2] then
    reset_at_ms = tonumber(oldest[2]) + window_ms
  end
  return { 0, 0, reset_at_ms }
end

-- Add this request with the current timestamp as the score
-- Use a unique member to allow multiple entries per millisecond
local member = now_ms .. ':' .. math.random(1000000)
redis.call('ZADD', key, now_ms, member)

-- Set TTL slightly longer than the window
redis.call('EXPIRE', key, math.ceil(window_ms / 1000) + 10)

local remaining = ceiling - current - 1
return { 1, remaining, now_ms + window_ms }
`;

// ---------------------------------------------------------------------------
// Tenant Ceiling Config Cache
// ---------------------------------------------------------------------------

const CEILING_CACHE_PREFIX = 'rate_limit_tenant_ceiling:';
const CEILING_CACHE_TTL = 60; // seconds

// ---------------------------------------------------------------------------
// checkTenantCeiling
// ---------------------------------------------------------------------------

/**
 * Check the per-tenant request ceiling.
 *
 * The ceiling is 3× the highest single-key tier's requestsPerMinute.
 * This prevents key proliferation as a rate limit bypass.
 *
 * Called AFTER the per-key check passes. The `highestKeyTier` parameter
 * is the highest tier among all active keys for this tenant.
 *
 * The ceiling value is cached in Redis with a 60s TTL to avoid
 * per-request recomputation.
 */
export async function checkTenantCeiling(
  tenantId: string,
  highestKeyTier: string,
): Promise<RateLimitResult> {
  const tierConfig =
    RATE_LIMIT_TIERS[highestKeyTier as keyof typeof RATE_LIMIT_TIERS] ??
    RATE_LIMIT_TIERS.standard;

  const redis = getRedis();
  const cacheKey = `${CEILING_CACHE_PREFIX}${tenantId}`;

  // Check cached ceiling value first
  let ceiling: number;
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      ceiling = Number(cached);
    } else {
      ceiling = tierConfig.requestsPerMinute * 3;
      await redis.set(cacheKey, String(ceiling), 'EX', CEILING_CACHE_TTL);
    }
  } catch (err: unknown) {
    logger.error({ err, tenantId }, 'Failed to read tenant ceiling cache');
    ceiling = tierConfig.requestsPerMinute * 3;
  }

  const windowMs = 60_000; // 1 minute sliding window
  const nowMs = Date.now();

  try {
    const result = (await redis.eval(
      TENANT_CEILING_LUA,
      1,
      `rate_limit_tenant:${tenantId}`,
      ceiling,
      windowMs,
      nowMs,
    )) as [number, number, number];

    const [allowed, remaining, resetAtMs] = result;

    const ceilingResult: RateLimitResult = {
      allowed: allowed === 1,
      limit: ceiling,
      remaining,
      resetAt: Math.ceil(resetAtMs / 1000),
    };

    if (!ceilingResult.allowed) {
      ceilingResult.retryAfter = Math.max(
        1,
        Math.ceil((resetAtMs - nowMs) / 1000),
      );
    }

    return ceilingResult;
  } catch (err: unknown) {
    // Fail open on Redis errors
    logger.error({ err, tenantId }, 'Tenant ceiling check failed');
    return {
      allowed: true,
      limit: ceiling,
      remaining: ceiling,
      resetAt: Math.ceil(nowMs / 1000) + 60,
    };
  }
}
