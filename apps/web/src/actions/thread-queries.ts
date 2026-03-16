'use server';

/**
 * Server Actions — thread query operations (messages, unread counts).
 *
 * Read-only counterpart to threads.ts (which handles mutations).
 *
 * @see docs/reference/communications.md
 */

import { z } from 'zod';
import { getAuthContext } from '@/lib/auth-context';
import { getMessages } from '@/data/thread-messages';
import { updateLastRead, getUnreadCounts } from '@/data/thread-participants';
import { wrapUnknownError } from '@/lib/errors';
import type { MessageListOpts } from '@/data/thread-messages';
import type { ThreadMessage } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const getMessagesSchema = z.object({
  threadId: z.string().uuid(),
  cursor: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  lensFilter: z.enum(['notes', 'activity', 'files']).optional(),
  parentMessageId: z.string().uuid().optional(),
});

const markReadSchema = z.object({
  threadId: z.string().uuid(),
});

const unreadCountSchema = z.object({
  threadId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// getMessagesAction
// ---------------------------------------------------------------------------

export async function getMessagesAction(
  input: z.input<typeof getMessagesSchema>,
): Promise<{ items: ThreadMessage[]; nextCursor: string | null }> {
  const { tenantId } = await getAuthContext();
  const validated = getMessagesSchema.parse(input);

  try {
    const opts: MessageListOpts = {
      cursor: validated.cursor,
      limit: validated.limit,
      lensFilter: validated.lensFilter,
      parentMessageId: validated.parentMessageId,
    };

    return await getMessages(tenantId, validated.threadId, opts);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// markThreadReadAction
// ---------------------------------------------------------------------------

export async function markThreadReadAction(
  input: z.input<typeof markReadSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  const validated = markReadSchema.parse(input);

  try {
    await updateLastRead(tenantId, validated.threadId, userId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// getUnreadCountAction
// ---------------------------------------------------------------------------

export async function getUnreadCountAction(
  input: z.input<typeof unreadCountSchema>,
): Promise<number> {
  const { userId, tenantId } = await getAuthContext();
  const validated = unreadCountSchema.parse(input);

  try {
    const counts = await getUnreadCounts(tenantId, userId);
    return counts[validated.threadId] ?? 0;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
