/**
 * NotificationService — orchestrates notification creation and delivery routing.
 *
 * Inserts notification into DB, checks user preferences, and routes to:
 * - In-app: Redis pub/sub channel for real-time bell badge
 * - Email (instant): BullMQ job `notification.email.send`
 *
 * Failure handling: notification insert failure logs error but does NOT throw.
 * This is best-effort delivery — the originating action must never be blocked.
 *
 * @see docs/reference/communications.md § Delivery Pipeline
 */

import {
  getDbForTenant,
  eq,
  and,
  userNotificationPreferences,
  threadParticipants,
} from '@everystack/shared/db';
import { createRedisClient } from '@everystack/shared/redis';
import { webLogger } from '@everystack/shared/logging';
import { getQueue } from '@/lib/queue';
import { generateUUIDv7 } from '@everystack/shared/db';
import { createNotification } from '@/data/notifications';
import type { CreateNotificationParams } from '@/data/notifications';
import type { NotificationEmailSendJobData } from '@everystack/shared/queue';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Notification preferences shape (stored as JSONB).
 * @see communications.md § user_notification_preferences
 */
interface CategoryPreference {
  inApp: boolean;
  email: 'instant' | 'digest' | 'off';
}

interface NotificationPreferences {
  mentions: CategoryPreference;
  dms: CategoryPreference;
  threadReplies: CategoryPreference;
  approvals: CategoryPreference;
  automationFailures: CategoryPreference;
  syncErrors: CategoryPreference;
  digestFrequency: 'hourly' | 'daily' | 'off';
  muteSchedule: { enabled: boolean; start: string; end: string; timezone: string };
}

/** Default preferences per communications.md */
const DEFAULT_PREFERENCES: NotificationPreferences = {
  mentions: { inApp: true, email: 'instant' },
  dms: { inApp: true, email: 'instant' },
  threadReplies: { inApp: true, email: 'digest' },
  approvals: { inApp: true, email: 'digest' },
  automationFailures: { inApp: true, email: 'digest' },
  syncErrors: { inApp: true, email: 'digest' },
  digestFrequency: 'daily',
  muteSchedule: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
};

/** Maps notification type to preference category key */
const TYPE_TO_PREF_KEY: Record<string, keyof Pick<NotificationPreferences, 'mentions' | 'dms' | 'threadReplies' | 'approvals' | 'automationFailures' | 'syncErrors'>> = {
  mention: 'mentions',
  dm: 'dms',
  thread_reply: 'threadReplies',
  approval_requested: 'approvals',
  approval_decided: 'approvals',
  automation_failed: 'automationFailures',
  sync_error: 'syncErrors',
};

/** Priority types that always deliver regardless of mute schedule */
const PRIORITY_TYPES = new Set(['mention', 'dm']);

// ---------------------------------------------------------------------------
// Redis client (lazy singleton for notification pub/sub)
// ---------------------------------------------------------------------------

let _redisPub: ReturnType<typeof createRedisClient> | null = null;

function getRedisPub() {
  if (!_redisPub) {
    _redisPub = createRedisClient('notification-pub');
    _redisPub.connect().catch(() => {
      // Connection will be retried on next publish
    });
  }
  return _redisPub;
}

// ---------------------------------------------------------------------------
// NotificationService
// ---------------------------------------------------------------------------

export class NotificationService {
  /**
   * Create and route a notification.
   *
   * 1. Insert notification row
   * 2. Check user preferences for this type
   * 3. If inApp enabled: publish to Redis channel
   * 4. If email = 'instant': enqueue BullMQ job
   * 5. Priority override: mention/dm always deliver regardless of mute
   * 6. Muted thread_reply: suppress (but NOT mention)
   *
   * @returns The created notification, or null if insert failed
   */
  async create(params: CreateNotificationParams) {
    const logger = webLogger.child({
      service: 'NotificationService',
      userId: params.userId,
      tenantId: params.tenantId,
      type: params.type,
    });

    // Step 0: Check thread mute for thread_reply
    if (params.type === 'thread_reply' && params.sourceThreadId) {
      const isMuted = await this.isThreadMutedForUser(
        params.tenantId,
        params.sourceThreadId,
        params.userId,
      );
      if (isMuted) {
        logger.debug('Suppressing thread_reply notification for muted thread');
        return null;
      }
    }

    // Step 1: Insert notification (best-effort)
    let notification;
    try {
      notification = await createNotification(params.tenantId, params);
    } catch (error) {
      logger.error({ err: error }, 'Failed to insert notification — skipping delivery');
      return null;
    }

    // Step 2: Load user preferences
    const prefs = await this.getUserPreferences(params.tenantId, params.userId);
    const prefKey = TYPE_TO_PREF_KEY[params.type];
    const categoryPref: CategoryPreference | undefined = prefKey
      ? prefs[prefKey]
      : undefined;

    const isPriority = PRIORITY_TYPES.has(params.type);
    const isMuteActive = this.isMuteActive(prefs);

    // Step 3: In-app delivery
    const shouldDeliverInApp = isPriority || (!isMuteActive && (categoryPref?.inApp ?? true));
    if (shouldDeliverInApp) {
      try {
        const redis = getRedisPub();
        await redis.publish(
          `user:${params.userId}:notifications`,
          JSON.stringify(notification),
        );
      } catch (error) {
        logger.warn({ err: error }, 'Failed to publish notification to Redis — client will see on tray open');
      }
    }

    // Step 4: Email delivery
    const emailPref = categoryPref?.email ?? 'off';
    const shouldSendEmail = isPriority
      ? emailPref !== 'off'
      : !isMuteActive && emailPref === 'instant';

    if (shouldSendEmail) {
      try {
        const queue = getQueue('notification');
        const jobData: NotificationEmailSendJobData = {
          tenantId: params.tenantId,
          traceId: generateUUIDv7(),
          triggeredBy: 'notification-service',
          notificationId: notification.id,
          userId: params.userId,
          type: params.type,
          title: params.title,
          body: params.body,
          actorId: params.actorId,
          sourceThreadId: params.sourceThreadId,
          sourceRecordId: params.sourceRecordId,
        };
        await queue.add('notification.email.send', jobData, {
          attempts: 3,
          backoff: { type: 'exponential', delay: 60_000 },
        });
      } catch (error) {
        logger.warn({ err: error }, 'Failed to enqueue notification email job');
      }
    }

    return notification;
  }

  /**
   * Check if a thread is muted for a specific user.
   */
  private async isThreadMutedForUser(
    tenantId: string,
    threadId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const db = getDbForTenant(tenantId, 'read');
      const rows = await db
        .select({ muted: threadParticipants.muted })
        .from(threadParticipants)
        .where(
          and(
            eq(threadParticipants.tenantId, tenantId),
            eq(threadParticipants.threadId, threadId),
            eq(threadParticipants.userId, userId),
          ),
        )
        .limit(1);

      return rows[0]?.muted ?? false;
    } catch {
      return false;
    }
  }

  /**
   * Load user notification preferences, falling back to defaults.
   */
  private async getUserPreferences(
    tenantId: string,
    userId: string,
  ): Promise<NotificationPreferences> {
    try {
      const db = getDbForTenant(tenantId, 'read');
      const rows = await db
        .select({ preferences: userNotificationPreferences.preferences })
        .from(userNotificationPreferences)
        .where(
          and(
            eq(userNotificationPreferences.tenantId, tenantId),
            eq(userNotificationPreferences.userId, userId),
          ),
        )
        .limit(1);

      if (rows[0]?.preferences) {
        return { ...DEFAULT_PREFERENCES, ...rows[0].preferences as Partial<NotificationPreferences> };
      }
    } catch {
      // Fallback to defaults
    }
    return DEFAULT_PREFERENCES;
  }

  /**
   * Check if the user's mute schedule is currently active.
   */
  private isMuteActive(prefs: NotificationPreferences): boolean {
    if (!prefs.muteSchedule.enabled) return false;

    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: prefs.muteSchedule.timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const currentTime = formatter.format(now);
    const { start, end } = prefs.muteSchedule;

    // Handle overnight mute windows (e.g., 22:00 to 08:00)
    if (start > end) {
      return currentTime >= start || currentTime < end;
    }
    return currentTime >= start && currentTime < end;
  }
}
