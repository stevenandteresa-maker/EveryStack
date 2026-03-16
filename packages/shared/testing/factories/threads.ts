/**
 * Thread-related test factories.
 *
 * Provides createTestMessage and createTestParticipant factories.
 * createTestThread already exists in the main factories.ts file.
 *
 * All factories use generateUUIDv7() for IDs and auto-create parent
 * entities when not provided.
 */

import {
  threadMessages,
  threadParticipants,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { NewThreadMessage, ThreadMessage, NewThreadParticipant, ThreadParticipant } from '@everystack/shared/db';
import { getTestDb, createTestTenant, createTestUser, createTestThread } from '../factories';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function firstRow<T>(rows: T[]): T {
  if (!rows[0]) throw new Error('Factory insert returned no rows');
  return rows[0];
}

// ---------------------------------------------------------------------------
// createTestMessage
// ---------------------------------------------------------------------------

/**
 * Creates a thread message with sensible defaults.
 * Auto-creates tenant, user, and thread when not provided.
 */
export async function createTestMessage(
  overrides?: Partial<NewThreadMessage>,
): Promise<ThreadMessage> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const authorId = overrides?.authorId ?? (await createTestUser()).id;
  const threadId = overrides?.threadId ?? (await createTestThread({ tenantId })).id;

  const values: NewThreadMessage = {
    id: generateUUIDv7(),
    tenantId,
    threadId,
    authorId,
    authorType: 'user',
    messageType: 'message',
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test message' }] }] },
    mentions: [],
    attachments: [],
    reactions: {},
    ...overrides,
  };

  return firstRow(await db.insert(threadMessages).values(values).returning());
}

// ---------------------------------------------------------------------------
// createTestParticipant
// ---------------------------------------------------------------------------

/**
 * Creates a thread participant with sensible defaults.
 * Auto-creates tenant, user, and thread when not provided.
 */
export async function createTestParticipant(
  overrides?: Partial<NewThreadParticipant>,
): Promise<ThreadParticipant> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const userId = overrides?.userId ?? (await createTestUser()).id;
  const threadId = overrides?.threadId ?? (await createTestThread({ tenantId })).id;

  const values: NewThreadParticipant = {
    id: generateUUIDv7(),
    tenantId,
    threadId,
    userId,
    participantType: 'user',
    ...overrides,
  };

  return firstRow(await db.insert(threadParticipants).values(values).returning());
}
