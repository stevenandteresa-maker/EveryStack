/**
 * Saved messages (bookmarks) data functions.
 *
 * Users can bookmark any message for personal reference.
 * Private — no one else sees another user's saved messages.
 *
 * @see docs/reference/communications.md § Bookmarks / Saved Messages
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  sql,
  userSavedMessages,
} from '@everystack/shared/db';
import type { UserSavedMessage } from '@everystack/shared/db';

export type { UserSavedMessage } from '@everystack/shared/db';

export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// saveMessage
// ---------------------------------------------------------------------------

/**
 * Bookmark a message for the current user. Idempotent — if already saved,
 * updates the note.
 */
export async function saveMessage(
  tenantId: string,
  userId: string,
  messageId: string,
  note?: string,
): Promise<UserSavedMessage> {
  const db = getDbForTenant(tenantId, 'write');

  const [row] = await db
    .insert(userSavedMessages)
    .values({
      tenantId,
      userId,
      messageId,
      note: note ?? null,
    })
    .onConflictDoUpdate({
      target: [userSavedMessages.userId, userSavedMessages.messageId],
      set: { note: note ?? null },
    })
    .returning();

  return row!;
}

// ---------------------------------------------------------------------------
// unsaveMessage
// ---------------------------------------------------------------------------

export async function unsaveMessage(
  tenantId: string,
  userId: string,
  messageId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .delete(userSavedMessages)
    .where(
      and(
        eq(userSavedMessages.tenantId, tenantId),
        eq(userSavedMessages.userId, userId),
        eq(userSavedMessages.messageId, messageId),
      ),
    );
}

// ---------------------------------------------------------------------------
// listSavedMessages
// ---------------------------------------------------------------------------

/**
 * Cursor-paginated list of saved messages for a user, newest first.
 */
export async function listSavedMessages(
  tenantId: string,
  userId: string,
  opts?: PaginationOpts,
): Promise<PaginatedResult<UserSavedMessage>> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = opts?.limit ?? 50;

  const conditions = [
    eq(userSavedMessages.tenantId, tenantId),
    eq(userSavedMessages.userId, userId),
  ];

  if (opts?.cursor) {
    conditions.push(
      sql`${userSavedMessages.savedAt} < (SELECT ${userSavedMessages.savedAt} FROM ${userSavedMessages} WHERE ${userSavedMessages.id} = ${opts.cursor})`,
    );
  }

  const rows = await db
    .select()
    .from(userSavedMessages)
    .where(and(...conditions))
    .orderBy(desc(userSavedMessages.savedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
  };
}
