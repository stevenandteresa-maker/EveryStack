'use server';

/**
 * Server Actions — Notification read state + preference management.
 *
 * All actions validate Clerk session via getAuthContext().
 *
 * @see docs/reference/communications.md § Notification Aggregation & Delivery
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import { markNotificationRead, markAllNotificationsRead } from '@/data/notifications';
import { updateNotificationPreferences } from '@/data/notification-preferences';
import { revalidatePath } from 'next/cache';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const categoryPreferenceSchema = z.object({
  inApp: z.boolean(),
  email: z.enum(['instant', 'digest', 'off']),
});

const muteScheduleSchema = z.object({
  enabled: z.boolean(),
  start: z.string(),
  end: z.string(),
  timezone: z.string(),
});

const notificationPreferencesSchema = z.object({
  mentions: categoryPreferenceSchema.optional(),
  dms: categoryPreferenceSchema.optional(),
  threadReplies: categoryPreferenceSchema.optional(),
  approvals: categoryPreferenceSchema.optional(),
  automationFailures: categoryPreferenceSchema.optional(),
  syncErrors: categoryPreferenceSchema.optional(),
  digestFrequency: z.enum(['hourly', 'daily', 'off']).optional(),
  muteSchedule: muteScheduleSchema.optional(),
});

// ---------------------------------------------------------------------------
// markNotificationReadAction
// ---------------------------------------------------------------------------

export async function markNotificationReadAction(notificationId: string) {
  const { userId, tenantId } = await getAuthContext();

  z.string().uuid().parse(notificationId);

  await markNotificationRead(tenantId, userId, notificationId);
  revalidatePath('/');
}

// ---------------------------------------------------------------------------
// markAllReadAction
// ---------------------------------------------------------------------------

export async function markAllReadAction() {
  const { userId, tenantId } = await getAuthContext();

  await markAllNotificationsRead(tenantId, userId);
  revalidatePath('/');
}

// ---------------------------------------------------------------------------
// updateNotificationPreferencesAction
// ---------------------------------------------------------------------------

export async function updateNotificationPreferencesAction(
  prefs: Record<string, unknown>,
) {
  const { userId, tenantId } = await getAuthContext();

  const validated = notificationPreferencesSchema.parse(prefs);

  await updateNotificationPreferences(tenantId, userId, validated);
  revalidatePath('/');
}
