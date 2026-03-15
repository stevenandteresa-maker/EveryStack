'use server';

/**
 * Server Actions — Thread messaging, DM, pin, and saved message operations.
 *
 * All actions validate Clerk session via getAuthContext() and enforce
 * workspace membership and authorship checks.
 *
 * @see docs/reference/communications.md
 */

import { z } from 'zod';
import {
  getDbForTenant,
  eq,
  and,
  threadMessages,
  threadParticipants,
} from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { ForbiddenError, NotFoundError, wrapUnknownError } from '@/lib/errors';
import { createMessage, editMessage, deleteMessage, pinMessage, unpinMessage } from '@/data/thread-messages';
import { getOrCreateDMThread, createGroupDM } from '@/data/threads';
import { saveMessage as saveMessageData, unsaveMessage as unsaveMessageData } from '@/data/saved-messages';
import { addParticipant } from '@/data/thread-participants';
import { publishChatEvent } from '@/lib/realtime/chat-events';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const sendMessageSchema = z.object({
  threadId: z.string().uuid(),
  content: z.unknown(),
  parentMessageId: z.string().uuid().optional(),
  mentions: z.array(z.string()).optional(),
  attachments: z.array(z.record(z.string(), z.unknown())).optional(),
});

const editMessageSchema = z.object({
  messageId: z.string().uuid(),
  content: z.unknown(),
});

const messageIdSchema = z.object({
  messageId: z.string().uuid(),
});

const saveMessageSchema = z.object({
  messageId: z.string().uuid(),
  note: z.string().optional(),
});

const createDMSchema = z.object({
  targetUserId: z.string().uuid(),
});

const createGroupDMSchema = z.object({
  participantIds: z.array(z.string().uuid()),
  name: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyThreadParticipant(
  tenantId: string,
  threadId: string,
  userId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'read');
  const [participant] = await db
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

  if (!participant) {
    throw new ForbiddenError('You are not a participant in this thread');
  }
}

async function getMessageWithAuth(
  tenantId: string,
  messageId: string,
) {
  const db = getDbForTenant(tenantId, 'read');
  const [message] = await db
    .select()
    .from(threadMessages)
    .where(
      and(
        eq(threadMessages.tenantId, tenantId),
        eq(threadMessages.id, messageId),
      ),
    )
    .limit(1);

  if (!message) {
    throw new NotFoundError('Message not found');
  }

  return message;
}

// ---------------------------------------------------------------------------
// sendMessage
// ---------------------------------------------------------------------------

export async function sendMessage(
  input: z.input<typeof sendMessageSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = sendMessageSchema.parse(input);

  try {
    // Auto-add sender as participant (idempotent)
    await addParticipant(tenantId, validated.threadId, userId);

    const message = await createMessage(tenantId, {
      threadId: validated.threadId,
      authorId: userId,
      content: validated.content,
      parentMessageId: validated.parentMessageId,
      mentions: validated.mentions,
      attachments: validated.attachments,
    });

    // Fire-and-forget: publish chat event for real-time delivery
    void publishChatEvent(tenantId, validated.threadId, {
      type: 'message:new',
      threadId: validated.threadId,
      payload: message,
    }, userId);

    return message;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// editMessageAction
// ---------------------------------------------------------------------------

export async function editMessageAction(
  input: z.input<typeof editMessageSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = editMessageSchema.parse(input);

  const message = await getMessageWithAuth(tenantId, validated.messageId);

  if (message.authorId !== userId) {
    throw new ForbiddenError('You can only edit your own messages');
  }

  try {
    const updated = await editMessage(tenantId, validated.messageId, validated.content);

    // Fire-and-forget: publish chat event for real-time delivery
    void publishChatEvent(tenantId, message.threadId, {
      type: 'message:edit',
      threadId: message.threadId,
      payload: updated,
    }, userId);

    return updated;
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// deleteMessageAction
// ---------------------------------------------------------------------------

export async function deleteMessageAction(
  input: z.input<typeof messageIdSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = messageIdSchema.parse(input);

  const message = await getMessageWithAuth(tenantId, validated.messageId);

  // Author can delete own messages; otherwise defer to data layer
  // (Manager+ permission check would be added when role resolution is wired)
  if (message.authorId !== userId) {
    throw new ForbiddenError('You can only delete your own messages');
  }

  try {
    await deleteMessage(tenantId, validated.messageId, userId);

    // Fire-and-forget: publish chat event for real-time delivery
    void publishChatEvent(tenantId, message.threadId, {
      type: 'message:delete',
      threadId: message.threadId,
      payload: { messageId: validated.messageId },
    }, userId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// pinMessageAction
// ---------------------------------------------------------------------------

export async function pinMessageAction(
  input: z.input<typeof messageIdSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = messageIdSchema.parse(input);

  const message = await getMessageWithAuth(tenantId, validated.messageId);

  // Verify user is a participant in the thread
  await verifyThreadParticipant(tenantId, message.threadId, userId);

  try {
    await pinMessage(tenantId, validated.messageId, userId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// unpinMessageAction
// ---------------------------------------------------------------------------

export async function unpinMessageAction(
  input: z.input<typeof messageIdSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = messageIdSchema.parse(input);

  const message = await getMessageWithAuth(tenantId, validated.messageId);

  // Same permission check as pin
  await verifyThreadParticipant(tenantId, message.threadId, userId);

  try {
    await unpinMessage(tenantId, validated.messageId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// saveMessageAction
// ---------------------------------------------------------------------------

export async function saveMessageAction(
  input: z.input<typeof saveMessageSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = saveMessageSchema.parse(input);

  try {
    return await saveMessageData(tenantId, userId, validated.messageId, validated.note);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// unsaveMessageAction
// ---------------------------------------------------------------------------

export async function unsaveMessageAction(
  input: z.input<typeof messageIdSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = messageIdSchema.parse(input);

  try {
    await unsaveMessageData(tenantId, userId, validated.messageId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// createDMAction
// ---------------------------------------------------------------------------

export async function createDMAction(
  input: z.input<typeof createDMSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = createDMSchema.parse(input);

  try {
    return await getOrCreateDMThread(tenantId, userId, validated.targetUserId);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// createGroupDMAction
// ---------------------------------------------------------------------------

export async function createGroupDMAction(
  input: z.input<typeof createGroupDMSchema>,
) {
  const { userId, tenantId } = await getAuthContext();
  const validated = createGroupDMSchema.parse(input);

  try {
    return await createGroupDM(tenantId, userId, validated.participantIds, validated.name);
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
