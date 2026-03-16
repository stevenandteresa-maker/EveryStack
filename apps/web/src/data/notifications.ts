/**
 * Notification data functions.
 *
 * CRUD operations for the notifications table with Redis-cached unread count.
 *
 * @see docs/reference/communications.md § Notification Aggregation & Delivery
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  sql,
  count,
  notifications,
} from '@everystack/shared/db';
import type { Notification } from '@everystack/shared/db';
import { createRedisClient } from '@everystack/shared/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { Notification } from '@everystack/shared/db';

/** Known values: 'mention', 'dm', 'thread_reply', 'approval_requested', 'approval_decided', 'automation_failed', 'sync_error', 'system' */
export type NotificationType = string;

export interface CreateNotificationParams {
  userId: string;
  tenantId: string;
  /** Known values: 'mention' | 'dm' | 'thread_reply' | 'approval_requested' | 'approval_decided' | 'automation_failed' | 'sync_error' | 'system' */
  type: string;
  title: string;
  body?: string;
  /** Known values: 'thread_message' | 'approval' | 'automation' | 'sync' | 'system' */
  sourceType?: string;
  sourceThreadId?: string;
  sourceMessageId?: string;
  sourceRecordId?: string;
  actorId?: string;
  groupKey?: string;
}

export interface NotificationListOpts {
  cursor?: string;
  limit?: number;
  read?: boolean;
}

export interface PaginatedNotificationResult {
  items: Notification[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Redis client (lazy singleton for notification cache)
// ---------------------------------------------------------------------------

let _redis: ReturnType<typeof createRedisClient> | null = null;

function getRedis() {
  if (!_redis) {
    _redis = createRedisClient('notification-cache');
    _redis.connect().catch(() => {
      // Connection will be retried on next operation
    });
  }
  return _redis;
}

/**
 * Close the Redis singleton. Call in test teardown to prevent connection leaks.
 * @internal Exported for test cleanup only.
 */
export async function _closeRedis(): Promise<void> {
  if (_redis) {
    await _redis.quit();
    _redis = null;
  }
}

function unreadCacheKey(tenantId: string, userId: string): string {
  return `cache:notif:unread:t:${tenantId}:u:${userId}`;
}

// ---------------------------------------------------------------------------
// createNotification
// ---------------------------------------------------------------------------

/**
 * Insert a notification row. Returns the created notification.
 */
export async function createNotification(
  tenantId: string,
  params: CreateNotificationParams,
): Promise<Notification> {
  const db = getDbForTenant(tenantId, 'write');

  const [row] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      tenantId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      sourceType: params.sourceType ?? null,
      sourceThreadId: params.sourceThreadId ?? null,
      sourceMessageId: params.sourceMessageId ?? null,
      sourceRecordId: params.sourceRecordId ?? null,
      actorId: params.actorId ?? null,
      groupKey: params.groupKey ?? null,
    })
    .returning();

  return row!;
}

// ---------------------------------------------------------------------------
// getNotifications
// ---------------------------------------------------------------------------

/**
 * Paginated notification list for a user, sorted by created_at DESC.
 * Supports optional `read` boolean filter.
 */
export async function getNotifications(
  tenantId: string,
  userId: string,
  opts?: NotificationListOpts,
): Promise<PaginatedNotificationResult> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = opts?.limit ?? 50;

  const conditions = [
    eq(notifications.tenantId, tenantId),
    eq(notifications.userId, userId),
  ];

  if (opts?.read !== undefined) {
    conditions.push(eq(notifications.read, opts.read));
  }

  if (opts?.cursor) {
    conditions.push(
      sql`${notifications.createdAt} < (SELECT ${notifications.createdAt} FROM ${notifications} WHERE ${notifications.id} = ${opts.cursor})`,
    );
  }

  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
  };
}

// ---------------------------------------------------------------------------
// getUnreadNotificationCount
// ---------------------------------------------------------------------------

/**
 * Get unread notification count for a user.
 * Redis-cached at `cache:notif:unread:t:{tenantId}:u:{userId}` with 5s TTL.
 * Falls back to DB count on cache miss or Redis failure.
 */
export async function getUnreadNotificationCount(
  tenantId: string,
  userId: string,
): Promise<number> {
  const cacheKey = unreadCacheKey(tenantId, userId);

  // Try Redis cache first
  try {
    const redis = getRedis();
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return Number(cached);
    }
  } catch {
    // Redis failure — fall through to DB
  }

  // DB count fallback
  const db = getDbForTenant(tenantId, 'read');
  const [result] = await db
    .select({ value: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        eq(notifications.read, false),
      ),
    );

  const unread = Number(result?.value ?? 0);

  // Cache the result with 5s TTL
  try {
    const redis = getRedis();
    await redis.setex(cacheKey, 5, String(unread));
  } catch {
    // Cache write failure is non-critical
  }

  return unread;
}

// ---------------------------------------------------------------------------
// markNotificationRead
// ---------------------------------------------------------------------------

/**
 * Mark a single notification as read. Invalidates the unread count cache.
 */
export async function markNotificationRead(
  tenantId: string,
  userId: string,
  notificationId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(notifications)
    .set({
      read: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
      ),
    );

  // Invalidate cache
  try {
    const redis = getRedis();
    await redis.del(unreadCacheKey(tenantId, userId));
  } catch {
    // Cache invalidation failure is non-critical
  }
}

// ---------------------------------------------------------------------------
// markAllNotificationsRead
// ---------------------------------------------------------------------------

/**
 * Mark all unread notifications as read for a user. Invalidates the unread count cache.
 */
export async function markAllNotificationsRead(
  tenantId: string,
  userId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(notifications)
    .set({
      read: true,
      readAt: new Date(),
    })
    .where(
      and(
        eq(notifications.tenantId, tenantId),
        eq(notifications.userId, userId),
        eq(notifications.read, false),
      ),
    );

  // Invalidate cache
  try {
    const redis = getRedis();
    await redis.del(unreadCacheKey(tenantId, userId));
  } catch {
    // Cache invalidation failure is non-critical
  }
}
