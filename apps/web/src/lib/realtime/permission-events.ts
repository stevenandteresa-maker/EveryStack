/**
 * Server-side permission event publisher.
 *
 * Publishes permission.updated events after invalidating the Redis cache.
 * ORDERING GUARANTEE: Cache invalidation completes before the event is published
 * so clients always fetch fresh data on re-query.
 *
 * @see docs/reference/permissions.md § Permission Caching Strategy
 */

import {
  REALTIME_EVENTS,
  createEventPublisher,
} from '@everystack/shared/realtime';
import type { PermissionUpdatedPayload } from '@everystack/shared/realtime';
import { createRedisClient } from '@everystack/shared/redis';
import { invalidatePermissionCache } from '@/data/permissions';

// ---------------------------------------------------------------------------
// Redis singleton (lazy)
// ---------------------------------------------------------------------------

let redisClient: ReturnType<typeof createRedisClient> | null = null;

function getRedis(): ReturnType<typeof createRedisClient> {
  if (!redisClient) {
    redisClient = createRedisClient('web:permission-events');
  }
  return redisClient;
}

/** @internal Exposed for testing — replaces the Redis client. */
export function setRedisClient(client: ReturnType<typeof createRedisClient> | null): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// Publisher
// ---------------------------------------------------------------------------

/**
 * Invalidate permission cache then publish a real-time permission.updated event.
 *
 * 1. Bust Redis cache for the view (all users).
 * 2. Publish event on the workspace channel so clients re-fetch.
 *
 * Cache invalidation MUST complete before the event publish (sequential awaits).
 */
export async function publishPermissionUpdate(
  tenantId: string,
  viewId: string,
  tableId: string,
  affectedUserIds?: string[],
): Promise<void> {
  // Step 1: Invalidate cache FIRST — clients must get fresh data on re-query
  await invalidatePermissionCache(tenantId, viewId);

  // Step 2: Publish event AFTER cache is busted
  const publisher = createEventPublisher(getRedis());

  const payload: PermissionUpdatedPayload = {
    type: REALTIME_EVENTS.PERMISSION_UPDATED,
    tenantId,
    viewId,
    tableId,
    ...(affectedUserIds ? { affectedUserIds } : {}),
  };

  await publisher.publish({
    tenantId,
    channel: `table:${tableId}`,
    event: REALTIME_EVENTS.PERMISSION_UPDATED,
    payload,
  });
}
