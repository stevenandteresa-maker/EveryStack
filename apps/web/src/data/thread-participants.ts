/**
 * Thread participant data functions.
 *
 * Covers participant add/remove, unread tracking via last_read_at,
 * and per-thread unread count computation.
 *
 * @see docs/reference/communications.md § thread_participants
 */

import {
  getDbForTenant,
  eq,
  and,
  sql,
  threadParticipants,
} from '@everystack/shared/db';
import type { ThreadParticipant } from '@everystack/shared/db';

export type { ThreadParticipant } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// addParticipant — idempotent upsert
// ---------------------------------------------------------------------------

/**
 * Add a user as a participant to a thread. Idempotent — no error on duplicate.
 */
export async function addParticipant(
  tenantId: string,
  threadId: string,
  userId: string,
): Promise<ThreadParticipant> {
  const db = getDbForTenant(tenantId, 'write');

  const [row] = await db
    .insert(threadParticipants)
    .values({
      tenantId,
      threadId,
      userId,
      participantType: 'user',
    })
    .onConflictDoNothing({
      target: [threadParticipants.threadId, threadParticipants.userId],
    })
    .returning();

  // If conflict, fetch existing row
  if (!row) {
    const [existing] = await db
      .select()
      .from(threadParticipants)
      .where(
        and(
          eq(threadParticipants.tenantId, tenantId),
          eq(threadParticipants.threadId, threadId),
          eq(threadParticipants.userId, userId),
        ),
      )
      .limit(1);
    return existing!;
  }

  return row;
}

// ---------------------------------------------------------------------------
// removeParticipant
// ---------------------------------------------------------------------------

export async function removeParticipant(
  tenantId: string,
  threadId: string,
  userId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .delete(threadParticipants)
    .where(
      and(
        eq(threadParticipants.tenantId, tenantId),
        eq(threadParticipants.threadId, threadId),
        eq(threadParticipants.userId, userId),
      ),
    );
}

// ---------------------------------------------------------------------------
// listParticipants
// ---------------------------------------------------------------------------

export async function listParticipants(
  tenantId: string,
  threadId: string,
): Promise<ThreadParticipant[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(threadParticipants)
    .where(
      and(
        eq(threadParticipants.tenantId, tenantId),
        eq(threadParticipants.threadId, threadId),
      ),
    );
}

// ---------------------------------------------------------------------------
// updateLastRead
// ---------------------------------------------------------------------------

export async function updateLastRead(
  tenantId: string,
  threadId: string,
  userId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(threadParticipants)
    .set({ lastReadAt: new Date() })
    .where(
      and(
        eq(threadParticipants.tenantId, tenantId),
        eq(threadParticipants.threadId, threadId),
        eq(threadParticipants.userId, userId),
      ),
    );
}

// ---------------------------------------------------------------------------
// getUnreadCounts
// ---------------------------------------------------------------------------

/**
 * For each thread the user participates in, count messages created after
 * the participant's last_read_at. Returns { [threadId]: count }.
 */
export async function getUnreadCounts(
  tenantId: string,
  userId: string,
): Promise<Record<string, number>> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      threadId: threadParticipants.threadId,
      unreadCount: sql<number>`
        COALESCE((
          SELECT COUNT(*)::int
          FROM thread_messages tm
          WHERE tm.thread_id = ${threadParticipants.threadId}
            AND tm.tenant_id = ${tenantId}
            AND tm.archived_at IS NULL
            AND tm.created_at > COALESCE(${threadParticipants.lastReadAt}, '1970-01-01'::timestamptz)
        ), 0)
      `.as('unread_count'),
    })
    .from(threadParticipants)
    .where(
      and(
        eq(threadParticipants.tenantId, tenantId),
        eq(threadParticipants.userId, userId),
      ),
    );

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.threadId] = Number(row.unreadCount);
  }
  return result;
}
