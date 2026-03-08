// ---------------------------------------------------------------------------
// Sync Notification System — routes sync events to the right recipients
//
// Handles 7 notification event types:
// 1. Conflict detected (manual mode) → in-app badge/toast → Table Managers
// 2. Auth expired → in-app banner + email → Owner + Admins
// 3. 3 consecutive failures → in-app toast → Table Managers
// 4. Sync down >1 hour → email → Owner
// 5. Sync down >6 hours → email (escalation) → Owner + Admins
// 6. Partial failure (>10 records) → in-app toast + badge → Table Managers
// 7. Schema mismatch detected → in-app banner → Table Managers
//
// Rate-limited events do NOT generate notifications (auto-resolving).
//
// @see docs/reference/sync-engine.md § Notification System for Sync Issues
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import { createRedisClient } from '@everystack/shared/redis';
import {
  getDbForTenant,
  tenantMemberships,
  workspaceMemberships,
  users,
} from '@everystack/shared/db';
import { eq, and, inArray } from 'drizzle-orm';
import { getEnqueueEmail } from './notification-queue';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'sync-notifications' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Sync notification event types.
 * Each event type determines recipients, channel, and timing.
 */
export type SyncNotificationEventType =
  | 'conflict_detected'
  | 'auth_expired'
  | 'consecutive_failures'
  | 'sync_down_1h'
  | 'sync_down_6h'
  | 'partial_failure'
  | 'schema_mismatch';

/**
 * Details attached to a sync notification.
 */
export interface SyncNotificationDetails {
  /** The base connection that triggered the notification. */
  connectionId: string;
  /** Platform display name (e.g. "Airtable", "Notion"). */
  platform: string;
  /** Workspace ID for scoping manager lookups. */
  workspaceId: string;
  /** Optional table name for context. */
  tableName?: string;
  /** Number of records affected (for partial_failure). */
  affectedRecordCount?: number;
  /** Number of conflicts (for conflict_detected). */
  conflictCount?: number;
  /** Error message for display. */
  errorMessage?: string;
  /** Connection name for email context. */
  connectionName?: string;
}

/**
 * Resolved recipient with userId and email.
 */
interface NotificationRecipient {
  userId: string;
  email: string;
}

/**
 * In-app notification payload published to Redis.
 */
export interface SyncNotificationPayload {
  type: SyncNotificationEventType;
  title: string;
  message: string;
  connectionId: string;
  platform: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Redis client — lazy singleton
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

function getRedis(): Redis {
  if (!redisClient) {
    redisClient = createRedisClient('sync-notifications');
  }
  return redisClient;
}

/**
 * Replace the Redis client (for testing).
 */
export function setNotificationRedisClient(client: Redis): void {
  redisClient = client;
}

// ---------------------------------------------------------------------------
// Recipient resolution
// ---------------------------------------------------------------------------

/**
 * Gets workspace Owner and Admin users for a tenant.
 * Owner + Admin roles are on tenant_memberships.
 */
async function getOwnerAndAdmins(tenantId: string): Promise<NotificationRecipient[]> {
  const db = getDbForTenant(tenantId, 'read');

  const members = await db
    .select({
      userId: tenantMemberships.userId,
      email: users.email,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, 'active'),
        inArray(tenantMemberships.role, ['owner', 'admin']),
      ),
    );

  return members;
}

/**
 * Gets only the workspace Owner for a tenant.
 */
async function getOwner(tenantId: string): Promise<NotificationRecipient[]> {
  const db = getDbForTenant(tenantId, 'read');

  const members = await db
    .select({
      userId: tenantMemberships.userId,
      email: users.email,
    })
    .from(tenantMemberships)
    .innerJoin(users, eq(users.id, tenantMemberships.userId))
    .where(
      and(
        eq(tenantMemberships.tenantId, tenantId),
        eq(tenantMemberships.status, 'active'),
        eq(tenantMemberships.role, 'owner'),
      ),
    );

  return members;
}

/**
 * Gets Table Managers — workspace-level managers for the workspace
 * containing the synced base connection.
 */
async function getTableManagers(
  tenantId: string,
  workspaceId: string,
): Promise<NotificationRecipient[]> {
  const db = getDbForTenant(tenantId, 'read');

  const members = await db
    .select({
      userId: workspaceMemberships.userId,
      email: users.email,
    })
    .from(workspaceMemberships)
    .innerJoin(users, eq(users.id, workspaceMemberships.userId))
    .where(
      and(
        eq(workspaceMemberships.tenantId, tenantId),
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.role, 'manager'),
      ),
    );

  return members;
}

// ---------------------------------------------------------------------------
// Notification message builders
// ---------------------------------------------------------------------------

function buildNotificationPayload(
  event: SyncNotificationEventType,
  details: SyncNotificationDetails,
): SyncNotificationPayload {
  const { connectionId, platform, tableName } = details;
  const now = new Date().toISOString();

  const payloads: Record<SyncNotificationEventType, { title: string; message: string }> = {
    conflict_detected: {
      title: 'Sync conflict detected',
      message: tableName
        ? `${details.conflictCount ?? 1} conflict(s) detected in "${tableName}" from ${platform}. Review and resolve in Sync Settings.`
        : `Conflict(s) detected in your ${platform} sync. Review and resolve in Sync Settings.`,
    },
    auth_expired: {
      title: `${platform} connection expired`,
      message: `Your ${platform} OAuth token has expired. Re-authenticate to resume syncing.`,
    },
    consecutive_failures: {
      title: 'Sync failures detected',
      message: `3 consecutive sync failures for your ${platform} connection. Check Sync Settings for details.`,
    },
    sync_down_1h: {
      title: 'Sync has been down for 1 hour',
      message: `Your ${platform} sync has not completed successfully in over 1 hour. Immediate attention may be required.`,
    },
    sync_down_6h: {
      title: 'Sync has been down for 6 hours — escalation',
      message: `Your ${platform} sync has not completed successfully in over 6 hours. This is an escalation notice. Please investigate urgently.`,
    },
    partial_failure: {
      title: 'Partial sync failure',
      message: tableName
        ? `${details.affectedRecordCount ?? 0} records in "${tableName}" failed to sync from ${platform}. Review in Sync Settings > Failures.`
        : `${details.affectedRecordCount ?? 0} records failed to sync from ${platform}. Review in Sync Settings > Failures.`,
    },
    schema_mismatch: {
      title: 'Schema change detected',
      message: tableName
        ? `Field changes detected in "${tableName}" on ${platform}. Review and accept/reject in Sync Settings > Schema Changes.`
        : `Field changes detected in your ${platform} database. Review in Sync Settings > Schema Changes.`,
    },
  };

  const { title, message } = payloads[event];

  return {
    type: event,
    title,
    message,
    connectionId,
    platform,
    timestamp: now,
    details: {
      tableName: details.tableName,
      affectedRecordCount: details.affectedRecordCount,
      conflictCount: details.conflictCount,
      errorMessage: details.errorMessage,
    },
  };
}

// ---------------------------------------------------------------------------
// In-app notification — publish to Redis for realtime forwarding
// ---------------------------------------------------------------------------

async function publishInAppNotification(
  tenantId: string,
  recipients: NotificationRecipient[],
  payload: SyncNotificationPayload,
): Promise<void> {
  const redis = getRedis();

  // Publish to each recipient's notification channel
  // Channel: t:{tenantId}:user:{userId}:notifications
  const publishPromises = recipients.map(async (recipient) => {
    const channel = `t:${tenantId}:user:${recipient.userId}:notifications`;
    await redis.publish(channel, JSON.stringify(payload));
  });

  await Promise.all(publishPromises);

  logger.info(
    {
      event: payload.type,
      recipientCount: recipients.length,
      connectionId: payload.connectionId,
    },
    'In-app sync notification published',
  );
}

// ---------------------------------------------------------------------------
// Email notification — enqueue BullMQ job
// ---------------------------------------------------------------------------

async function enqueueEmailNotification(
  tenantId: string,
  recipients: NotificationRecipient[],
  payload: SyncNotificationPayload,
  traceId: string,
): Promise<void> {
  const enqueue = getEnqueueEmail();

  const emailPromises = recipients.map(async (recipient) => {
    await enqueue({
      tenantId,
      traceId,
      triggeredBy: 'system:sync_notification',
      to: recipient.email,
      templateId: `sync_${payload.type}`,
      subject: payload.title,
      payload: {
        ...payload,
        recipientUserId: recipient.userId,
      },
    });
  });

  await Promise.all(emailPromises);

  logger.info(
    {
      event: payload.type,
      recipientCount: recipients.length,
      connectionId: payload.connectionId,
    },
    'Sync notification email enqueued',
  );
}

// ---------------------------------------------------------------------------
// Main: sendSyncNotification
// ---------------------------------------------------------------------------

/**
 * Sends a sync notification to the appropriate recipients based on event type.
 *
 * Routing:
 * - conflict_detected → in-app toast → Table Managers
 * - auth_expired → in-app banner + email → Owner + Admins
 * - consecutive_failures → in-app toast → Table Managers
 * - sync_down_1h → email → Owner
 * - sync_down_6h → email (escalation) → Owner + Admins
 * - partial_failure → in-app toast + badge → Table Managers
 * - schema_mismatch → in-app banner → Table Managers
 */
export async function sendSyncNotification(
  tenantId: string,
  event: SyncNotificationEventType,
  details: SyncNotificationDetails,
  traceId?: string,
): Promise<void> {
  const trace = traceId ?? `sync-notif-${Date.now()}`;

  try {
    const payload = buildNotificationPayload(event, details);

    switch (event) {
      case 'conflict_detected': {
        const managers = await getTableManagers(tenantId, details.workspaceId);
        await publishInAppNotification(tenantId, managers, payload);
        break;
      }

      case 'auth_expired': {
        const ownerAndAdmins = await getOwnerAndAdmins(tenantId);
        await publishInAppNotification(tenantId, ownerAndAdmins, payload);
        await enqueueEmailNotification(tenantId, ownerAndAdmins, payload, trace);
        break;
      }

      case 'consecutive_failures': {
        const managers = await getTableManagers(tenantId, details.workspaceId);
        await publishInAppNotification(tenantId, managers, payload);
        break;
      }

      case 'sync_down_1h': {
        const owner = await getOwner(tenantId);
        await enqueueEmailNotification(tenantId, owner, payload, trace);
        break;
      }

      case 'sync_down_6h': {
        const ownerAndAdmins = await getOwnerAndAdmins(tenantId);
        await enqueueEmailNotification(tenantId, ownerAndAdmins, payload, trace);
        break;
      }

      case 'partial_failure': {
        const managers = await getTableManagers(tenantId, details.workspaceId);
        await publishInAppNotification(tenantId, managers, payload);
        break;
      }

      case 'schema_mismatch': {
        const managers = await getTableManagers(tenantId, details.workspaceId);
        await publishInAppNotification(tenantId, managers, payload);
        break;
      }

      default: {
        // Exhaustive check — should never reach here
        const _exhaustive: never = event;
        logger.warn({ event: _exhaustive }, 'Unknown sync notification event type');
      }
    }
  } catch (err: unknown) {
    // Notification failures should never break the sync pipeline
    logger.error(
      { err, tenantId, event, connectionId: details.connectionId },
      'Failed to send sync notification',
    );
  }
}

// ---------------------------------------------------------------------------
// Deduplication keys — prevent sending the same notification repeatedly
// ---------------------------------------------------------------------------

const DEDUP_TTL_SECONDS = 3600; // 1 hour

/**
 * Checks if a notification for this event+connection was already sent recently.
 * Returns true if it's a duplicate (should skip sending).
 */
export async function isDuplicateNotification(
  tenantId: string,
  event: SyncNotificationEventType,
  connectionId: string,
): Promise<boolean> {
  try {
    const redis = getRedis();
    const key = `sync-notif-dedup:${tenantId}:${connectionId}:${event}`;
    const exists = await redis.exists(key);
    return exists === 1;
  } catch {
    return false; // On error, allow the notification
  }
}

/**
 * Marks a notification as sent to prevent duplicates within the TTL window.
 */
export async function markNotificationSent(
  tenantId: string,
  event: SyncNotificationEventType,
  connectionId: string,
): Promise<void> {
  try {
    const redis = getRedis();
    const key = `sync-notif-dedup:${tenantId}:${connectionId}:${event}`;
    await redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS);
  } catch {
    // Silent failure — dedup is best-effort
  }
}
