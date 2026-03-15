/**
 * Thread CRUD data functions.
 *
 * Covers thread creation, lookup, DM helpers, and paginated listing.
 *
 * @see docs/reference/communications.md § Thread Scopes
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  desc,
  sql,
  threads,
  threadParticipants,
  threadMessages,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { Thread } from '@everystack/shared/db';
import { ValidationError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type { Thread } from '@everystack/shared/db';

export interface CreateThreadParams {
  /** Known values: 'record', 'dm', 'group_dm' */
  scopeType: string;
  scopeId: string;
  /** Known values: 'internal', 'client'. Defaults to 'internal'. */
  threadType?: string;
  name?: string;
  createdBy: string;
}

export interface ThreadWithLastMessage extends Thread {
  lastMessage: {
    content: string;
    authorId: string;
    createdAt: Date;
  } | null;
  unreadCount: number;
}

export interface PaginationOpts {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const VALID_SCOPE_TYPES = ['record', 'dm', 'group_dm'] as const;

const createGroupDMSchema = z.object({
  participantIds: z
    .array(z.string().uuid())
    .min(3, 'Group DMs require at least 3 participants')
    .max(8, 'Group DMs support at most 8 participants'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic UUID for a DM scope_id from two user IDs.
 *
 * Sorts the IDs lexicographically and hashes them into a UUID-formatted
 * string (version 5-style, using SHA-256 truncated to 128 bits).
 */
function generateDMScopeId(userId1: string, userId2: string): string {
  const sorted = [userId1, userId2].sort();
  const hash = createHash('sha256')
    .update(`dm:${sorted[0]}:${sorted[1]}`)
    .digest('hex');
  // Format as UUID: 8-4-4-4-12
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-');
}

// ---------------------------------------------------------------------------
// createThread
// ---------------------------------------------------------------------------

/**
 * Create a new thread and add the creator as the first participant.
 */
export async function createThread(
  tenantId: string,
  params: CreateThreadParams,
): Promise<Thread> {
  if (!VALID_SCOPE_TYPES.includes(params.scopeType as (typeof VALID_SCOPE_TYPES)[number])) {
    throw new ValidationError(
      `Invalid scope_type: ${params.scopeType}. Expected one of: ${VALID_SCOPE_TYPES.join(', ')}`,
    );
  }

  const db = getDbForTenant(tenantId, 'write');

  const [thread] = await db
    .insert(threads)
    .values({
      tenantId,
      scopeType: params.scopeType,
      scopeId: params.scopeId,
      threadType: params.threadType ?? 'internal',
      name: params.name ?? null,
      createdBy: params.createdBy,
    })
    .returning();

  // Add creator as first participant
  await db.insert(threadParticipants).values({
    tenantId,
    threadId: thread!.id,
    userId: params.createdBy,
    participantType: 'user',
  });

  return thread!;
}

// ---------------------------------------------------------------------------
// getThread
// ---------------------------------------------------------------------------

/**
 * Fetch a thread by ID, tenant-scoped.
 */
export async function getThread(
  tenantId: string,
  threadId: string,
): Promise<Thread | null> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(threads)
    .where(and(eq(threads.tenantId, tenantId), eq(threads.id, threadId)))
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// getThreadByScope
// ---------------------------------------------------------------------------

/**
 * Look up a thread by scope identifiers, leveraging the
 * UNIQUE(scope_type, scope_id, thread_type) constraint.
 */
export async function getThreadByScope(
  tenantId: string,
  scopeType: string,
  scopeId: string,
  threadType?: string,
): Promise<Thread | null> {
  const db = getDbForTenant(tenantId, 'read');

  const conditions = [
    eq(threads.tenantId, tenantId),
    eq(threads.scopeType, scopeType),
    eq(threads.scopeId, scopeId),
  ];

  if (threadType) {
    conditions.push(eq(threads.threadType, threadType));
  }

  const rows = await db
    .select()
    .from(threads)
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// listThreadsForUser
// ---------------------------------------------------------------------------

/**
 * All threads the user participates in, joined with last message preview,
 * sorted by last activity. Cursor-based pagination.
 */
export async function listThreadsForUser(
  tenantId: string,
  userId: string,
  opts?: PaginationOpts,
): Promise<PaginatedResult<ThreadWithLastMessage>> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = opts?.limit ?? 50;

  // Subquery: latest message per thread
  const lastMessageSq = db
    .select({
      threadId: threadMessages.threadId,
      content: threadMessages.content,
      authorId: threadMessages.authorId,
      createdAt: threadMessages.createdAt,
      rn: sql<number>`ROW_NUMBER() OVER (PARTITION BY ${threadMessages.threadId} ORDER BY ${threadMessages.createdAt} DESC)`.as('rn'),
    })
    .from(threadMessages)
    .where(eq(threadMessages.tenantId, tenantId))
    .as('last_msg');

  // Build cursor condition
  const cursorConditions = [
    eq(threadParticipants.tenantId, tenantId),
    eq(threadParticipants.userId, userId),
  ];

  if (opts?.cursor) {
    cursorConditions.push(
      sql`${threads.updatedAt} < (SELECT ${threads.updatedAt} FROM ${threads} WHERE ${threads.id} = ${opts.cursor})`,
    );
  }

  const rows = await db
    .select({
      // Thread fields
      id: threads.id,
      tenantId: threads.tenantId,
      scopeType: threads.scopeType,
      scopeId: threads.scopeId,
      threadType: threads.threadType,
      name: threads.name,
      createdBy: threads.createdBy,
      createdAt: threads.createdAt,
      updatedAt: threads.updatedAt,
      // Last message fields
      lastMessageContent: lastMessageSq.content,
      lastMessageAuthorId: lastMessageSq.authorId,
      lastMessageCreatedAt: lastMessageSq.createdAt,
      // Unread count: messages created after participant's last_read_at
      unreadCount: sql<number>`
        COALESCE((
          SELECT COUNT(*)::int
          FROM thread_messages tm
          WHERE tm.thread_id = ${threads.id}
            AND tm.tenant_id = ${tenantId}
            AND tm.created_at > COALESCE(${threadParticipants.lastReadAt}, '1970-01-01'::timestamptz)
        ), 0)
      `.as('unread_count'),
    })
    .from(threadParticipants)
    .innerJoin(threads, eq(threads.id, threadParticipants.threadId))
    .leftJoin(
      lastMessageSq,
      and(
        eq(lastMessageSq.threadId, threads.id),
        eq(lastMessageSq.rn, 1),
      ),
    )
    .where(and(...cursorConditions))
    .orderBy(desc(threads.updatedAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);

  const mapped: ThreadWithLastMessage[] = items.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    threadType: row.threadType,
    name: row.name,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastMessage: row.lastMessageCreatedAt
      ? {
          content: typeof row.lastMessageContent === 'string'
            ? row.lastMessageContent
            : JSON.stringify(row.lastMessageContent),
          authorId: row.lastMessageAuthorId ?? '',
          createdAt: row.lastMessageCreatedAt,
        }
      : null,
    unreadCount: Number(row.unreadCount),
  }));

  return {
    items: mapped,
    nextCursor: hasMore && items.length > 0 ? items[items.length - 1]!.id : null,
  };
}

// ---------------------------------------------------------------------------
// getOrCreateDMThread
// ---------------------------------------------------------------------------

/**
 * Get or create a 1:1 DM thread between two users.
 *
 * Generates a deterministic scope_id from sorted user IDs so that
 * calling with (A, B) or (B, A) returns the same thread.
 */
export async function getOrCreateDMThread(
  tenantId: string,
  userId1: string,
  userId2: string,
): Promise<Thread> {
  const scopeId = generateDMScopeId(userId1, userId2);

  // Try to find existing thread first
  const existing = await getThreadByScope(tenantId, 'dm', scopeId, 'internal');
  if (existing) {
    return existing;
  }

  // Create new DM thread with both participants
  const db = getDbForTenant(tenantId, 'write');

  const [thread] = await db
    .insert(threads)
    .values({
      tenantId,
      scopeType: 'dm',
      scopeId,
      threadType: 'internal',
      createdBy: userId1,
    })
    .returning();

  // Add both users as participants
  await db.insert(threadParticipants).values([
    {
      tenantId,
      threadId: thread!.id,
      userId: userId1,
      participantType: 'user',
    },
    {
      tenantId,
      threadId: thread!.id,
      userId: userId2,
      participantType: 'user',
    },
  ]);

  return thread!;
}

// ---------------------------------------------------------------------------
// createGroupDM
// ---------------------------------------------------------------------------

/**
 * Create a group DM thread with 3–8 participants.
 *
 * Validates participant count via Zod. Generates a UUID scope_id.
 * Adds all participants (including creator) to the thread.
 */
export async function createGroupDM(
  tenantId: string,
  creatorId: string,
  participantIds: string[],
  name?: string,
): Promise<Thread> {
  // Ensure creator is in participant list for count validation
  const allParticipantIds = participantIds.includes(creatorId)
    ? participantIds
    : [creatorId, ...participantIds];

  // Deduplicate
  const uniqueParticipantIds = [...new Set(allParticipantIds)];

  // Validate 3–8 participant cap
  const result = createGroupDMSchema.safeParse({ participantIds: uniqueParticipantIds });
  if (!result.success) {
    throw new ValidationError(result.error.issues[0]?.message ?? 'Invalid participant count');
  }

  const scopeId = generateUUIDv7();
  const db = getDbForTenant(tenantId, 'write');

  const [thread] = await db
    .insert(threads)
    .values({
      tenantId,
      scopeType: 'group_dm',
      scopeId,
      threadType: 'internal',
      name: name ?? null,
      createdBy: creatorId,
    })
    .returning();

  // Add all participants
  await db.insert(threadParticipants).values(
    uniqueParticipantIds.map((userId) => ({
      tenantId,
      threadId: thread!.id,
      userId,
      participantType: 'user' as const,
    })),
  );

  return thread!;
}
