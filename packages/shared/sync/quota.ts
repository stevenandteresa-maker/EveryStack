// ---------------------------------------------------------------------------
// Record Quota Enforcement — plan-based record limits with Redis caching
//
// Three enforcement points:
// 1. Sync Setup Wizard (preventive) — blocks sync if estimated count exceeds quota
// 2. Runtime Batch Check — partial acceptance when batch would exceed quota
// 3. Single Record Creation — boolean gate for local/portal record creation
//
// Quota = all records across all tables in all bases in the tenant
// (synced + native). Soft-deleted (archived) records don't count.
// Sync-orphaned records DO count.
//
// @see docs/reference/sync-engine.md § Record Quota Enforcement
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import { count, eq, isNull, and } from 'drizzle-orm';
import { createRedisClient } from '@everystack/shared/redis';
import { getDbForTenant } from '@everystack/shared/db';
import { records } from '@everystack/shared/db';
import { tenants } from '@everystack/shared/db';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'sync-quota' });

// ---------------------------------------------------------------------------
// Plan Quotas
// ---------------------------------------------------------------------------

export const PLAN_QUOTAS: Record<string, number> = {
  freelancer: 10_000,
  starter: 50_000,
  professional: 250_000,
  business: 1_000_000,
  enterprise: Infinity,
};

const QUOTA_CACHE_TTL_SECONDS = 60;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QuotaResult {
  currentCount: number;
  planQuota: number;
  remaining: number;
  exceeded: boolean;
}

export interface SyncQuotaCheck {
  allowed: boolean;
  remaining: number;
  overageCount: number;
}

export interface BatchQuotaResult {
  acceptedCount: number;
  quotaExceeded: boolean;
}

// ---------------------------------------------------------------------------
// Redis Client — lazy singleton
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient('sync-quota');
  }
  return redisClient;
}

/**
 * Replace the Redis client used by the quota module.
 * Exposed for testing — production code should never call this.
 */
export function setQuotaRedisClient(client: Redis): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// Core: Record Count Query
// ---------------------------------------------------------------------------

/**
 * Counts non-archived records for a tenant via getDbForTenant().
 * This is the authoritative count — used on cache miss.
 */
export async function countTenantRecords(tenantId: string): Promise<number> {
  const db = getDbForTenant(tenantId, 'read');

  const result = await db
    .select({ value: count() })
    .from(records)
    .where(and(eq(records.tenantId, tenantId), isNull(records.archivedAt)));

  return result[0]?.value ?? 0;
}

// ---------------------------------------------------------------------------
// Core: Plan Quota Lookup
// ---------------------------------------------------------------------------

/**
 * Resolves the record quota for a tenant by looking up its plan.
 * Falls back to the freelancer quota for unknown plans.
 */
export async function getTenantPlanQuota(tenantId: string): Promise<number> {
  const db = getDbForTenant(tenantId, 'read');

  const result = await db
    .select({ plan: tenants.plan })
    .from(tenants)
    .where(eq(tenants.id, tenantId));

  const plan = result[0]?.plan ?? 'freelancer';
  return PLAN_QUOTAS[plan] ?? PLAN_QUOTAS['freelancer']!;
}

// ---------------------------------------------------------------------------
// Redis Cache Helpers
// ---------------------------------------------------------------------------

function cacheKey(tenantId: string): string {
  return `quota:records:${tenantId}`;
}

async function getCachedCount(tenantId: string): Promise<number | null> {
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey(tenantId));
    if (cached === null) return null;
    const parsed = parseInt(cached, 10);
    return isNaN(parsed) ? null : parsed;
  } catch (err: unknown) {
    logger.error({ err, tenantId }, 'Quota cache read failed — falling through to DB');
    return null;
  }
}

async function setCachedCount(tenantId: string, recordCount: number): Promise<void> {
  try {
    const redis = getRedis();
    await redis.set(cacheKey(tenantId), recordCount, 'EX', QUOTA_CACHE_TTL_SECONDS);
  } catch (err: unknown) {
    logger.error({ err, tenantId }, 'Quota cache write failed');
  }
}

// ---------------------------------------------------------------------------
// 2. Quota Check Function
// ---------------------------------------------------------------------------

/**
 * Returns the current record count and quota status for a tenant.
 * Checks Redis cache first (TTL 60s), falls through to DB on miss.
 */
export async function checkRecordQuota(tenantId: string): Promise<QuotaResult> {
  const [cachedCount, planQuota] = await Promise.all([
    getCachedCount(tenantId),
    getTenantPlanQuota(tenantId),
  ]);

  let currentCount: number;
  if (cachedCount !== null) {
    currentCount = cachedCount;
  } else {
    currentCount = await countTenantRecords(tenantId);
    await setCachedCount(tenantId, currentCount);
  }

  const remaining = Math.max(0, planQuota - currentCount);

  return {
    currentCount,
    planQuota,
    remaining,
    exceeded: currentCount >= planQuota,
  };
}

// ---------------------------------------------------------------------------
// 3. Enforcement Point 1 — Sync Setup Wizard (Preventive)
// ---------------------------------------------------------------------------

/**
 * Checks whether a sync operation with the estimated record count can proceed.
 * Called before confirming sync in the setup wizard.
 */
export async function canSyncRecords(
  tenantId: string,
  estimatedCount: number,
): Promise<SyncQuotaCheck> {
  const quota = await checkRecordQuota(tenantId);

  const overageCount = Math.max(0, estimatedCount - quota.remaining);
  const allowed = overageCount === 0;

  return {
    allowed,
    remaining: quota.remaining,
    overageCount,
  };
}

// ---------------------------------------------------------------------------
// 4. Enforcement Point 2 — Runtime Batch Check
// ---------------------------------------------------------------------------

/**
 * Determines how many records from an inbound batch can be accepted
 * without exceeding the tenant's quota.
 *
 * Returns the number of records that fit and whether quota was exceeded.
 */
export async function enforceQuotaOnBatch(
  tenantId: string,
  batchSize: number,
): Promise<BatchQuotaResult> {
  const quota = await checkRecordQuota(tenantId);

  if (quota.remaining >= batchSize) {
    return { acceptedCount: batchSize, quotaExceeded: false };
  }

  return {
    acceptedCount: Math.max(0, quota.remaining),
    quotaExceeded: true,
  };
}

// ---------------------------------------------------------------------------
// 5. Enforcement Point 3 — Single Record Creation
// ---------------------------------------------------------------------------

/**
 * Returns whether the tenant can create one more record.
 * Called before local record creation and portal form submissions.
 */
export async function canCreateRecord(tenantId: string): Promise<boolean> {
  const quota = await checkRecordQuota(tenantId);
  return !quota.exceeded;
}

// ---------------------------------------------------------------------------
// 6. Quota Cache Maintenance
// ---------------------------------------------------------------------------

/**
 * Increment the cached record count after inserting records.
 * If the cache key doesn't exist, this is a no-op (next read will recount).
 */
export async function incrementQuotaCache(
  tenantId: string,
  delta: number,
): Promise<void> {
  try {
    const redis = getRedis();
    const exists = await redis.exists(cacheKey(tenantId));
    if (exists) {
      await redis.incrby(cacheKey(tenantId), delta);
    }
  } catch (err: unknown) {
    logger.error({ err, tenantId, delta }, 'Quota cache increment failed');
  }
}

/**
 * Decrement the cached record count after deleting/archiving records.
 * If the cache key doesn't exist, this is a no-op (next read will recount).
 */
export async function decrementQuotaCache(
  tenantId: string,
  delta: number,
): Promise<void> {
  try {
    const redis = getRedis();
    const exists = await redis.exists(cacheKey(tenantId));
    if (exists) {
      await redis.decrby(cacheKey(tenantId), delta);
    }
  } catch (err: unknown) {
    logger.error({ err, tenantId, delta }, 'Quota cache decrement failed');
  }
}

/**
 * Invalidate the quota cache, forcing a full recount on next check.
 */
export async function invalidateQuotaCache(tenantId: string): Promise<void> {
  try {
    const redis = getRedis();
    await redis.del(cacheKey(tenantId));
  } catch (err: unknown) {
    logger.error({ err, tenantId }, 'Quota cache invalidation failed');
  }
}
