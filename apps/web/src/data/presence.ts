/**
 * Custom status data functions.
 *
 * CRUD operations for the custom status fields on workspace_memberships.
 * Presence state is ephemeral in Redis (handled by PresenceService).
 * Custom status (emoji + text + auto-clear) is persisted to the database.
 *
 * @see docs/reference/communications.md § Presence & Status
 */

import {
  getDbForTenant,
  eq,
  and,
  lt,
  isNotNull,
  workspaceMemberships,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomStatusResult {
  emoji: string;
  text: string;
  clearAt: Date | null;
}

// ---------------------------------------------------------------------------
// updateCustomStatus
// ---------------------------------------------------------------------------

/**
 * Set a custom status (emoji + text) on a user's workspace membership.
 * Optionally set an auto-clear timestamp.
 */
export async function updateCustomStatus(
  tenantId: string,
  userId: string,
  emoji: string,
  text: string,
  clearAt?: Date,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(workspaceMemberships)
    .set({
      statusEmoji: emoji,
      statusText: text,
      statusClearAt: clearAt ?? null,
    })
    .where(
      and(
        eq(workspaceMemberships.tenantId, tenantId),
        eq(workspaceMemberships.userId, userId),
      ),
    );
}

// ---------------------------------------------------------------------------
// getCustomStatus
// ---------------------------------------------------------------------------

/**
 * Read a user's custom status from workspace_memberships.
 * Returns null if no status is set.
 */
export async function getCustomStatus(
  tenantId: string,
  userId: string,
): Promise<CustomStatusResult | null> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      statusEmoji: workspaceMemberships.statusEmoji,
      statusText: workspaceMemberships.statusText,
      statusClearAt: workspaceMemberships.statusClearAt,
    })
    .from(workspaceMemberships)
    .where(
      and(
        eq(workspaceMemberships.tenantId, tenantId),
        eq(workspaceMemberships.userId, userId),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row?.statusEmoji || !row.statusText) {
    return null;
  }

  return {
    emoji: row.statusEmoji,
    text: row.statusText,
    clearAt: row.statusClearAt,
  };
}

// ---------------------------------------------------------------------------
// clearExpiredStatuses
// ---------------------------------------------------------------------------

/**
 * Clear all custom statuses that have passed their auto-clear time.
 * Called by a scheduled cleanup job.
 */
export async function clearExpiredStatuses(): Promise<void> {
  const db = getDbForTenant('system', 'write');

  await db
    .update(workspaceMemberships)
    .set({
      statusEmoji: null,
      statusText: null,
      statusClearAt: null,
    })
    .where(
      and(
        isNotNull(workspaceMemberships.statusClearAt),
        lt(workspaceMemberships.statusClearAt, new Date()),
      ),
    );
}
