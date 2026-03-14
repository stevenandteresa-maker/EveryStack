/**
 * Cross-link display value cascade — enqueue helper & backpressure.
 *
 * When a target record's display field changes, enqueues a BullMQ job
 * to update all source records that reference it.
 *
 * Job deduplication: uses jobId `crosslink:cascade:{tenantId}:{targetRecordId}`
 * so concurrent edits to the same target collapse into one cascade.
 *
 * Backpressure: Redis counter `q:cascade:depth:{tenantId}` tracks pending
 * cascade jobs per tenant. Sync scheduler checks this before polling.
 *
 * @see docs/reference/cross-linking.md § Display Value Cascade
 * @see docs/reference/cross-linking.md § Sync Backpressure
 */

import { getQueue } from '@/lib/queue';
import { getTraceId } from '@everystack/shared/logging';
import { createRedisClient } from '@everystack/shared/redis';
import type { CrossLinkCascadeJobData } from '@everystack/shared/queue';

/** Priority mapping: high → 1 (immediate), low → 10 (background). */
const PRIORITY_MAP: Record<'high' | 'low', number> = {
  high: 1,
  low: 10,
} as const;

/** Maximum pending cascade jobs before backpressure kicks in. */
const BACKPRESSURE_THRESHOLD = 500;

/** Redis key prefix for per-tenant cascade depth counters. */
const DEPTH_KEY_PREFIX = 'q:cascade:depth:';

/** Lazy-created Redis client for backpressure counters. */
let backpressureRedis: ReturnType<typeof createRedisClient> | null = null;

function getBackpressureRedis() {
  if (!backpressureRedis) {
    backpressureRedis = createRedisClient('cascade-backpressure');
  }
  return backpressureRedis;
}

/**
 * Check whether cascade backpressure is active for a tenant.
 * Returns true if >500 pending cascade jobs exist for the tenant.
 * Used by sync scheduler to skip polls when cascade queue is congested.
 */
export async function checkCascadeBackpressure(
  tenantId: string,
): Promise<boolean> {
  const redis = getBackpressureRedis();
  const depth = await redis.get(`${DEPTH_KEY_PREFIX}${tenantId}`);
  return depth !== null && Number(depth) > BACKPRESSURE_THRESHOLD;
}

/**
 * Increment the cascade depth counter for a tenant.
 * Called when a cascade job is enqueued.
 */
export async function incrementCascadeDepth(tenantId: string): Promise<void> {
  const redis = getBackpressureRedis();
  await redis.incr(`${DEPTH_KEY_PREFIX}${tenantId}`);
}

/**
 * Decrement the cascade depth counter for a tenant.
 * Called when a cascade job completes or fails.
 */
export async function decrementCascadeDepth(tenantId: string): Promise<void> {
  const redis = getBackpressureRedis();
  const result = await redis.decr(`${DEPTH_KEY_PREFIX}${tenantId}`);
  // Clamp to zero — never go negative
  if (result < 0) {
    await redis.set(`${DEPTH_KEY_PREFIX}${tenantId}`, '0');
  }
}

export async function enqueueCascadeJob(
  tenantId: string,
  targetRecordId: string,
  priority: 'high' | 'low',
  reason: CrossLinkCascadeJobData['reason'] = 'user_edit',
): Promise<void> {
  const queue = getQueue('cross-link');

  await queue.add(
    'cross-link.cascade',
    {
      tenantId,
      targetRecordId,
      priority,
      reason,
      traceId: getTraceId() ?? '',
      triggeredBy: 'cascade-enqueue',
    } satisfies CrossLinkCascadeJobData,
    {
      jobId: `crosslink:cascade:${tenantId}:${targetRecordId}`,
      priority: PRIORITY_MAP[priority],
      removeOnComplete: true,
      removeOnFail: { count: 100 },
    },
  );

  await incrementCascadeDepth(tenantId);
}
