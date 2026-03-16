'use server';

/**
 * Server Actions — notification query operations (list, unread count).
 *
 * Read-only counterpart to notifications.ts (which handles mutations).
 *
 * @see docs/reference/communications.md § Notification Aggregation & Delivery
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import { getNotifications, getUnreadNotificationCount } from '@/data/notifications';
import { wrapUnknownError } from '@/lib/errors';
import type { Notification } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const getNotificationsSchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

// ---------------------------------------------------------------------------
// getNotificationsAction
// ---------------------------------------------------------------------------

export async function getNotificationsAction(
  input?: z.input<typeof getNotificationsSchema>,
): Promise<{ items: Notification[]; nextCursor: string | null }> {
  const { userId, tenantId } = await getAuthContext();
  const validated = getNotificationsSchema.parse(input ?? {});

  try {
    return await getNotifications(tenantId, userId, {
      cursor: validated.cursor,
      limit: validated.limit,
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// getUnreadCountAction
// ---------------------------------------------------------------------------

export async function getUnreadCountAction(): Promise<number> {
  const { userId, tenantId } = await getAuthContext();

  try {
    return await getUnreadNotificationCount(tenantId, userId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
