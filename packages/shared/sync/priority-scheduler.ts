// ---------------------------------------------------------------------------
// Priority-Based Sync Scheduler — P0–P3 dispatch with multi-tenant fairness
//
// Layers priority-based scheduling on top of the adaptive polling scheduler.
// Evaluates rate limit capacity before dispatching sync jobs and enforces
// per-tenant fairness via round-robin within each priority tier.
//
// @see docs/reference/sync-engine.md § Priority-Based Scheduling
// @see docs/reference/sync-engine.md § Multi-Tenant Fairness
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import { createLogger } from '@everystack/shared/logging';
import {
  SyncPriority,
  PRIORITY_CAPACITY_THRESHOLDS,
  MAX_TENANT_CAPACITY_PERCENT,
} from './types';
import type { PriorityDecision } from './types';

const logger = createLogger({ service: 'sync-priority' });

// ---------------------------------------------------------------------------
// Redis key prefixes
// ---------------------------------------------------------------------------

/** Round-robin index per platform per priority tier. */
const ROUND_ROBIN_PREFIX = 'sync:rr';

/** Per-tenant capacity usage tracking per platform. */
const TENANT_USAGE_PREFIX = 'sync:tenant_usage';

// ---------------------------------------------------------------------------
// Priority evaluation — pure function
// ---------------------------------------------------------------------------

/** Default delay for P1 jobs when capacity is too low (30 seconds). */
const P1_DELAY_MS = 30_000;

/**
 * Evaluates whether a sync job should be dispatched given its priority
 * tier and the current remaining rate limit capacity.
 *
 * P0 is always dispatched regardless of capacity.
 * P1 is delayed (not skipped) when capacity is below threshold.
 * P2–P3 are skipped (not delayed) when capacity is below threshold.
 */
export function evaluatePriority(
  priority: SyncPriority,
  capacityPercent: number,
): PriorityDecision {
  // P0 always dispatches
  if (priority === SyncPriority.P0_CRITICAL) {
    return { dispatch: true, reason: 'P0 always dispatched' };
  }

  const threshold = PRIORITY_CAPACITY_THRESHOLDS[priority];

  if (capacityPercent > threshold) {
    return {
      dispatch: true,
      reason: `Capacity ${capacityPercent}% > ${threshold}% threshold`,
    };
  }

  // P1 is delayed, not skipped
  if (priority === SyncPriority.P1_ACTIVE) {
    return {
      dispatch: false,
      delay: P1_DELAY_MS,
      reason: `P1 delayed: capacity ${capacityPercent}% <= ${threshold}% threshold`,
    };
  }

  // P2–P3 are skipped
  return {
    dispatch: false,
    reason: `P${priority} skipped: capacity ${capacityPercent}% <= ${threshold}% threshold`,
  };
}

// ---------------------------------------------------------------------------
// Rate limit capacity query
// ---------------------------------------------------------------------------

/**
 * Lua script to query remaining rate limit capacity from the sliding-window ZSET.
 *
 * KEYS[1] = ratelimit:{platform}:{scope_key}
 * ARGV[1] = maxRequests
 * ARGV[2] = windowMs
 * ARGV[3] = nowMs
 *
 * Returns: [currentCount, maxRequests]
 */
const CAPACITY_QUERY_LUA = `
local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local now_ms = tonumber(ARGV[3])

-- Remove expired entries
local window_start = now_ms - window_ms
redis.call('ZREMRANGEBYSCORE', key, '-inf', window_start)

-- Count current entries
local current = redis.call('ZCARD', key)

return { current, max_requests }
`;

/**
 * Queries remaining rate limit capacity for a platform scope as a percentage.
 *
 * Reads the ZSET for the rate limit key, counts tokens consumed in the
 * current window, and returns remaining capacity as 0–100.
 *
 * @param redis - Redis client
 * @param platform - Platform identifier (e.g. 'airtable', 'notion')
 * @param scopeKey - Scope and identifier (e.g. 'base:appABC123')
 * @param maxRequests - Maximum requests allowed in the window
 * @param windowSeconds - Window size in seconds
 * @returns Remaining capacity as 0–100 percentage
 */
export async function getRateLimitCapacity(
  redis: Redis,
  platform: string,
  scopeKey: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<number> {
  const redisKey = `ratelimit:${platform}:${scopeKey}`;
  const windowMs = windowSeconds * 1000;
  const nowMs = Date.now();

  try {
    const result = (await redis.eval(
      CAPACITY_QUERY_LUA,
      1,
      redisKey,
      maxRequests,
      windowMs,
      nowMs,
    )) as [number, number];

    const [current, max] = result;
    if (max === 0) return 100;

    const remaining = Math.max(0, max - current);
    return Math.round((remaining / max) * 100);
  } catch (err: unknown) {
    // Fail open — if Redis is down, report full capacity so jobs dispatch
    logger.error(
      { err, platform, scopeKey },
      'Rate limit capacity query failed — assuming full capacity',
    );
    return 100;
  }
}

// ---------------------------------------------------------------------------
// Multi-tenant fairness — round-robin within priority tiers
// ---------------------------------------------------------------------------

/**
 * Gets the next tenant to serve for a given platform and priority tier
 * using round-robin scheduling.
 *
 * Maintains a per-platform, per-priority-tier index in Redis.
 * Returns null if no eligible tenants remain (all have exceeded their budget).
 *
 * @param redis - Redis client
 * @param platform - Platform identifier
 * @param priorityTier - The priority tier being scheduled
 * @param eligibleTenants - List of tenant IDs with pending jobs in this tier
 * @returns The next tenant ID to serve, or null if none eligible
 */
export async function getNextTenantForPlatform(
  redis: Redis,
  platform: string,
  priorityTier: SyncPriority,
  eligibleTenants: string[],
): Promise<string | null> {
  if (eligibleTenants.length === 0) return null;

  // P0 bypasses round-robin — serve all tenants
  if (priorityTier === SyncPriority.P0_CRITICAL) {
    return eligibleTenants[0] ?? null;
  }

  const rrKey = `${ROUND_ROBIN_PREFIX}:${platform}:${priorityTier}`;

  // Increment and wrap around
  const rawIndex = await redis.incr(rrKey);
  // Set TTL to prevent stale keys (1 hour)
  await redis.expire(rrKey, 3600);

  const index = (rawIndex - 1) % eligibleTenants.length;
  return eligibleTenants[index] ?? null;
}

// ---------------------------------------------------------------------------
// Per-tenant capacity budget enforcement
// ---------------------------------------------------------------------------

/**
 * Checks whether a tenant has exceeded the per-tenant capacity budget
 * (MAX_TENANT_CAPACITY_PERCENT of the platform's rate limit).
 *
 * P0 is exempt from this check.
 *
 * @param redis - Redis client
 * @param platform - Platform identifier
 * @param tenantId - Tenant to check
 * @param maxRequests - Platform's max requests per window
 * @param windowSeconds - Platform's rate limit window in seconds
 * @param priority - The priority tier of this job
 * @returns Whether the tenant is within budget
 */
export async function isTenantWithinBudget(
  redis: Redis,
  platform: string,
  tenantId: string,
  maxRequests: number,
  windowSeconds: number,
  priority: SyncPriority,
): Promise<boolean> {
  // P0 is exempt from per-tenant budget
  if (priority === SyncPriority.P0_CRITICAL) return true;

  // Ensure at least 1 request per tenant even for low-limit platforms
  const budget = Math.max(1, Math.floor(maxRequests * (MAX_TENANT_CAPACITY_PERCENT / 100)));

  const key = `${TENANT_USAGE_PREFIX}:${platform}:${tenantId}`;
  const windowMs = windowSeconds * 1000;
  const nowMs = Date.now();
  const windowStart = nowMs - windowMs;

  try {
    // Clean up expired entries and count current usage
    await redis.zremrangebyscore(key, '-inf', String(windowStart));
    const currentUsage = await redis.zcard(key);

    return currentUsage < budget;
  } catch (err: unknown) {
    // Fail open — allow the tenant to proceed
    logger.error(
      { err, platform, tenantId },
      'Tenant budget check failed — allowing',
    );
    return true;
  }
}

/**
 * Records a request against the tenant's capacity budget.
 *
 * @param redis - Redis client
 * @param platform - Platform identifier
 * @param tenantId - Tenant that consumed capacity
 * @param windowSeconds - Rate limit window in seconds (for TTL)
 */
export async function recordTenantUsage(
  redis: Redis,
  platform: string,
  tenantId: string,
  windowSeconds: number,
): Promise<void> {
  const key = `${TENANT_USAGE_PREFIX}:${platform}:${tenantId}`;
  const nowMs = Date.now();
  const member = `${nowMs}:${Math.random().toString(36).slice(2, 10)}`;

  try {
    await redis.zadd(key, String(nowMs), member);
    // TTL slightly longer than window to auto-cleanup
    await redis.expire(key, windowSeconds + 10);
  } catch (err: unknown) {
    logger.error(
      { err, platform, tenantId },
      'Failed to record tenant usage',
    );
  }
}

// ---------------------------------------------------------------------------
// Visibility → Priority mapping
// ---------------------------------------------------------------------------

/**
 * Maps a table's visibility state to its sync priority tier.
 *
 * This is used by the scheduler to assign priority to inbound polling jobs.
 * Outbound (user-edit) and webhook-triggered jobs are always P0 and bypass
 * this mapping.
 */
export function visibilityToPriority(
  visibility: 'active' | 'background' | 'inactive',
): SyncPriority {
  switch (visibility) {
    case 'active':
      return SyncPriority.P1_ACTIVE;
    case 'background':
      return SyncPriority.P2_BACKGROUND;
    case 'inactive':
      return SyncPriority.P3_INACTIVE;
  }
}
