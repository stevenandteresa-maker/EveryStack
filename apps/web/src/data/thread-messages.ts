/**
 * Thread message CRUD data functions.
 *
 * Covers message creation, cursor-paginated listing with lens filters,
 * editing, soft-delete with audit, pin/unpin, and text search.
 *
 * @see docs/reference/communications.md § thread_messages
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  asc,
  isNull,
  isNotNull,
  sql,
  threadMessages,
  writeAuditLog,
} from '@everystack/shared/db';
import type { ThreadMessage, DrizzleTransaction } from '@everystack/shared/db';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { ThreadMessage } from '@everystack/shared/db';

export interface CreateMessageParams {
  threadId: string;
  authorId: string;
  /** Known values: 'user', 'portal_client', 'system'. Defaults to 'user'. */
  authorType?: string;
  /** Known values: 'message', 'system'. Defaults to 'message'. */
  messageType?: string;
  content: unknown;
  parentMessageId?: string;
  mentions?: string[];
  attachments?: Record<string, unknown>[];
}

export interface MessageListOpts {
  cursor?: string;
  limit?: number;
  messageType?: string;
  parentMessageId?: string;
  lensFilter?: 'notes' | 'activity' | 'files';
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// createMessage
// ---------------------------------------------------------------------------

export async function createMessage(
  tenantId: string,
  params: CreateMessageParams,
): Promise<ThreadMessage> {
  const db = getDbForTenant(tenantId, 'write');

  const [message] = await db
    .insert(threadMessages)
    .values({
      tenantId,
      threadId: params.threadId,
      authorId: params.authorId,
      authorType: params.authorType ?? 'user',
      messageType: params.messageType ?? 'message',
      content: params.content,
      parentMessageId: params.parentMessageId ?? null,
      mentions: params.mentions ?? [],
      attachments: params.attachments ?? [],
    })
    .returning();

  return message!;
}

// ---------------------------------------------------------------------------
// getMessages
// ---------------------------------------------------------------------------

export async function getMessages(
  tenantId: string,
  threadId: string,
  opts?: MessageListOpts,
): Promise<PaginatedResult<ThreadMessage>> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = opts?.limit ?? 50;

  const conditions = [
    eq(threadMessages.tenantId, tenantId),
    eq(threadMessages.threadId, threadId),
    isNull(threadMessages.archivedAt),
  ];

  // Cursor: fetch messages created after the cursor message's created_at
  if (opts?.cursor) {
    conditions.push(
      sql`${threadMessages.createdAt} > (SELECT ${threadMessages.createdAt} FROM ${threadMessages} WHERE ${threadMessages.id} = ${opts.cursor})`,
    );
  }

  // Filter by messageType
  if (opts?.messageType) {
    conditions.push(eq(threadMessages.messageType, opts.messageType));
  }

  // Filter by parentMessageId (reply chains)
  if (opts?.parentMessageId) {
    conditions.push(eq(threadMessages.parentMessageId, opts.parentMessageId));
  }

  // Lens filters
  if (opts?.lensFilter === 'notes') {
    conditions.push(isNotNull(threadMessages.sourceNoteId));
  } else if (opts?.lensFilter === 'activity') {
    conditions.push(eq(threadMessages.messageType, 'system'));
  } else if (opts?.lensFilter === 'files') {
    conditions.push(sql`jsonb_array_length(${threadMessages.attachments}) > 0`);
  }

  const rows = await db
    .select()
    .from(threadMessages)
    .where(and(...conditions))
    .orderBy(asc(threadMessages.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  return {
    items,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
  };
}

// ---------------------------------------------------------------------------
// editMessage
// ---------------------------------------------------------------------------

export async function editMessage(
  tenantId: string,
  messageId: string,
  content: unknown,
): Promise<ThreadMessage> {
  const db = getDbForTenant(tenantId, 'write');

  const [updated] = await db
    .update(threadMessages)
    .set({
      content,
      editedAt: new Date(),
    })
    .where(
      and(
        eq(threadMessages.tenantId, tenantId),
        eq(threadMessages.id, messageId),
      ),
    )
    .returning();

  return updated!;
}

// ---------------------------------------------------------------------------
// deleteMessage
// ---------------------------------------------------------------------------

export async function deleteMessage(
  tenantId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db.transaction(async (tx) => {
    await tx
      .update(threadMessages)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(threadMessages.tenantId, tenantId),
          eq(threadMessages.id, messageId),
        ),
      );

    await writeAuditLog(tx as DrizzleTransaction, {
      tenantId,
      actorType: 'user',
      actorId: userId,
      action: 'message.deleted',
      entityType: 'thread_message',
      entityId: messageId,
      details: {},
      traceId: getTraceId(),
    });
  });
}

// ---------------------------------------------------------------------------
// pinMessage
// ---------------------------------------------------------------------------

export async function pinMessage(
  tenantId: string,
  messageId: string,
  userId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(threadMessages)
    .set({
      pinnedAt: new Date(),
      pinnedBy: userId,
    })
    .where(
      and(
        eq(threadMessages.tenantId, tenantId),
        eq(threadMessages.id, messageId),
      ),
    );
}

// ---------------------------------------------------------------------------
// unpinMessage
// ---------------------------------------------------------------------------

export async function unpinMessage(
  tenantId: string,
  messageId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(threadMessages)
    .set({
      pinnedAt: null,
      pinnedBy: null,
    })
    .where(
      and(
        eq(threadMessages.tenantId, tenantId),
        eq(threadMessages.id, messageId),
      ),
    );
}

// ---------------------------------------------------------------------------
// getPinnedMessages
// ---------------------------------------------------------------------------

export async function getPinnedMessages(
  tenantId: string,
  threadId: string,
): Promise<ThreadMessage[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(threadMessages)
    .where(
      and(
        eq(threadMessages.tenantId, tenantId),
        eq(threadMessages.threadId, threadId),
        isNotNull(threadMessages.pinnedAt),
        isNull(threadMessages.archivedAt),
      ),
    )
    .orderBy(desc(threadMessages.pinnedAt));
}

// ---------------------------------------------------------------------------
// searchThreadMessages
// ---------------------------------------------------------------------------

export async function searchThreadMessages(
  tenantId: string,
  threadId: string,
  query: string,
): Promise<ThreadMessage[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(threadMessages)
    .where(
      and(
        eq(threadMessages.tenantId, tenantId),
        eq(threadMessages.threadId, threadId),
        isNull(threadMessages.archivedAt),
        sql`${threadMessages.content}::text ILIKE ${'%' + query + '%'}`,
      ),
    )
    .orderBy(desc(threadMessages.createdAt))
    .limit(50);
}
