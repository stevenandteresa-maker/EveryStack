/**
 * Notification preferences data functions.
 *
 * CRUD operations for user_notification_preferences JSONB.
 * Returns sensible defaults when no row exists.
 *
 * @see docs/reference/communications.md § Notification Preferences JSONB structure
 */

import {
  getDbForTenant,
  eq,
  and,
  userNotificationPreferences,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryPreference {
  inApp: boolean;
  /** Known values: 'instant' | 'digest' | 'off' */
  email: string;
}

export interface MuteSchedule {
  enabled: boolean;
  start: string;
  end: string;
  timezone: string;
}

export interface NotificationPreferences {
  mentions: CategoryPreference;
  dms: CategoryPreference;
  threadReplies: CategoryPreference;
  approvals: CategoryPreference;
  automationFailures: CategoryPreference;
  syncErrors: CategoryPreference;
  /** Known values: 'hourly' | 'daily' | 'off' */
  digestFrequency: string;
  muteSchedule: MuteSchedule;
}

// ---------------------------------------------------------------------------
// Defaults (per communications.md)
// ---------------------------------------------------------------------------

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  mentions: { inApp: true, email: 'instant' },
  dms: { inApp: true, email: 'instant' },
  threadReplies: { inApp: true, email: 'digest' },
  approvals: { inApp: true, email: 'digest' },
  automationFailures: { inApp: true, email: 'digest' },
  syncErrors: { inApp: true, email: 'digest' },
  digestFrequency: 'daily',
  muteSchedule: { enabled: false, start: '22:00', end: '08:00', timezone: 'UTC' },
};

// ---------------------------------------------------------------------------
// getNotificationPreferences
// ---------------------------------------------------------------------------

/**
 * Fetch user notification preferences. Returns defaults if no row exists.
 */
export async function getNotificationPreferences(
  tenantId: string,
  userId: string,
): Promise<NotificationPreferences> {
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
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(rows[0].preferences as Partial<NotificationPreferences>),
    };
  }

  return { ...DEFAULT_NOTIFICATION_PREFERENCES };
}

// ---------------------------------------------------------------------------
// updateNotificationPreferences
// ---------------------------------------------------------------------------

/**
 * Upsert notification preferences JSONB.
 * Merges partial prefs with existing (or default) preferences.
 */
export async function updateNotificationPreferences(
  tenantId: string,
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  // Fetch current to merge
  const current = await getNotificationPreferences(tenantId, userId);
  const merged = { ...current, ...prefs };

  // Check if row exists
  const existing = await db
    .select({ id: userNotificationPreferences.id })
    .from(userNotificationPreferences)
    .where(
      and(
        eq(userNotificationPreferences.tenantId, tenantId),
        eq(userNotificationPreferences.userId, userId),
      ),
    )
    .limit(1);

  if (existing[0]) {
    await db
      .update(userNotificationPreferences)
      .set({
        preferences: merged as Record<string, unknown>,
      })
      .where(eq(userNotificationPreferences.id, existing[0].id));
  } else {
    await db.insert(userNotificationPreferences).values({
      userId,
      tenantId,
      preferences: merged as Record<string, unknown>,
    });
  }
}
