/**
 * Integration tests for thread participants, saved messages, and
 * data functions from Prompts 2–4 (threads, messages, participants, saved).
 *
 * Covers tenant isolation, DM determinism, group DM validation,
 * unread counts, audit logging, and search.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestThread,
  createTestMessage,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getDbForTenant, eq, and, auditLog, generateUUIDv7 } from '@everystack/shared/db';

import {
  addParticipant,
  removeParticipant,
  listParticipants,
  updateLastRead,
  getUnreadCounts,
} from '../thread-participants';

import {
  saveMessage,
  unsaveMessage,
  listSavedMessages,
} from '../saved-messages';

import {
  createThread,
  getThread,
  getThreadByScope,
  listThreadsForUser,
  getOrCreateDMThread,
  createGroupDM,
} from '../threads';

import {
  createMessage,
  getMessages,
  editMessage,
  deleteMessage,
  pinMessage,
  unpinMessage,
  getPinnedMessages,
  searchThreadMessages,
} from '../thread-messages';

// ---------------------------------------------------------------------------
// Thread Participants — Tenant Isolation
// ---------------------------------------------------------------------------

describe('Thread Participants', () => {
  describe('addParticipant — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let threadId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          const thread = await createTestThread({ tenantId, createdBy: user.id });
          threadId = thread.id;
          await addParticipant(tenantId, thread.id, user.id);
        },
        query: async (tenantId) => {
          return listParticipants(tenantId, threadId);
        },
      });
    }, 30_000);
  });

  describe('getUnreadCounts — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let userId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          userId = user.id;
          const thread = await createTestThread({ tenantId, createdBy: user.id });
          await addParticipant(tenantId, thread.id, user.id);
          await createTestMessage({ tenantId, threadId: thread.id, authorId: user.id });
        },
        query: async (tenantId) => {
          const counts = await getUnreadCounts(tenantId, userId);
          // Return entries as array so testTenantIsolation can check length
          return Object.entries(counts).filter(([, v]) => v > 0);
        },
      });
    }, 30_000);
  });

  describe('addParticipant — idempotency', () => {
    it('does not error on duplicate add', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const thread = await createTestThread({ tenantId: tenant.id, createdBy: user.id });

      const first = await addParticipant(tenant.id, thread.id, user.id);
      const second = await addParticipant(tenant.id, thread.id, user.id);

      expect(first.id).toBe(second.id);

      const participants = await listParticipants(tenant.id, thread.id);
      // Thread creation adds creator + addParticipant is idempotent
      // Creator was added by createThread, so only 1 participant
      const userParticipants = participants.filter((p) => p.userId === user.id);
      expect(userParticipants).toHaveLength(1);
    }, 30_000);
  });

  describe('removeParticipant', () => {
    it('removes participant from thread', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const thread = await createTestThread({ tenantId: tenant.id });

      await addParticipant(tenant.id, thread.id, user.id);
      let participants = await listParticipants(tenant.id, thread.id);
      expect(participants.some((p) => p.userId === user.id)).toBe(true);

      await removeParticipant(tenant.id, thread.id, user.id);
      participants = await listParticipants(tenant.id, thread.id);
      expect(participants.some((p) => p.userId === user.id)).toBe(false);
    }, 30_000);
  });

  describe('getUnreadCounts', () => {
    it('returns accurate per-thread unread counts', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const author = await createTestUser();
      const thread = await createTestThread({ tenantId: tenant.id, createdBy: user.id });

      // Add user as participant
      await addParticipant(tenant.id, thread.id, user.id);

      // Mark as read now
      await updateLastRead(tenant.id, thread.id, user.id);

      // Wait a tiny bit to ensure messages are after last_read_at
      await new Promise((r) => setTimeout(r, 50));

      // Create 3 messages after last_read_at
      await createTestMessage({ tenantId: tenant.id, threadId: thread.id, authorId: author.id });
      await createTestMessage({ tenantId: tenant.id, threadId: thread.id, authorId: author.id });
      await createTestMessage({ tenantId: tenant.id, threadId: thread.id, authorId: author.id });

      const counts = await getUnreadCounts(tenant.id, user.id);
      expect(counts[thread.id]).toBe(3);
    }, 30_000);

    it('returns 0 for threads with no new messages', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const thread = await createTestThread({ tenantId: tenant.id, createdBy: user.id });

      await addParticipant(tenant.id, thread.id, user.id);

      // Create message, then mark read
      await createTestMessage({ tenantId: tenant.id, threadId: thread.id, authorId: user.id });

      // Wait a tiny bit to ensure last_read_at is after message
      await new Promise((r) => setTimeout(r, 50));
      await updateLastRead(tenant.id, thread.id, user.id);

      const counts = await getUnreadCounts(tenant.id, user.id);
      expect(counts[thread.id]).toBe(0);
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// Saved Messages — Tenant Isolation
// ---------------------------------------------------------------------------

describe('Saved Messages', () => {
  describe('saveMessage — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let userId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          userId = user.id;
          const message = await createTestMessage({ tenantId });
          await saveMessage(tenantId, user.id, message.id, 'test note');
        },
        query: async (tenantId) => {
          const result = await listSavedMessages(tenantId, userId);
          return result.items;
        },
      });
    }, 30_000);
  });

  describe('saveMessage / unsaveMessage', () => {
    it('saves and unsaves a message', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const message = await createTestMessage({ tenantId: tenant.id });

      const saved = await saveMessage(tenant.id, user.id, message.id, 'important');
      expect(saved.messageId).toBe(message.id);
      expect(saved.note).toBe('important');

      let list = await listSavedMessages(tenant.id, user.id);
      expect(list.items).toHaveLength(1);

      await unsaveMessage(tenant.id, user.id, message.id);

      list = await listSavedMessages(tenant.id, user.id);
      expect(list.items).toHaveLength(0);
    }, 30_000);
  });

  describe('listSavedMessages — pagination', () => {
    it('paginates saved messages', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      // Save 3 messages
      for (let i = 0; i < 3; i++) {
        const msg = await createTestMessage({ tenantId: tenant.id });
        await saveMessage(tenant.id, user.id, msg.id);
        // Small delay to ensure different saved_at timestamps
        await new Promise((r) => setTimeout(r, 10));
      }

      const page1 = await listSavedMessages(tenant.id, user.id, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await listSavedMessages(tenant.id, user.id, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// DM Thread Determinism
// ---------------------------------------------------------------------------

describe('DM Threads', () => {
  describe('getOrCreateDMThread — deterministic', () => {
    it('returns the same thread for (A,B) and (B,A)', async () => {
      const tenant = await createTestTenant();
      const userA = await createTestUser();
      const userB = await createTestUser();

      const thread1 = await getOrCreateDMThread(tenant.id, userA.id, userB.id);
      const thread2 = await getOrCreateDMThread(tenant.id, userB.id, userA.id);

      expect(thread1.id).toBe(thread2.id);
      expect(thread1.scopeType).toBe('dm');
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// Group DM Validation
// ---------------------------------------------------------------------------

describe('Group DMs', () => {
  describe('createGroupDM — participant validation', () => {
    it('rejects fewer than 3 participants', async () => {
      const tenant = await createTestTenant();
      const userA = await createTestUser();
      const userB = await createTestUser();

      await expect(
        createGroupDM(tenant.id, userA.id, [userA.id, userB.id]),
      ).rejects.toThrow('at least 3');
    }, 30_000);

    it('rejects more than 8 participants', async () => {
      const tenant = await createTestTenant();
      const users = await Promise.all(
        Array.from({ length: 9 }, () => createTestUser()),
      );
      const creatorId = users[0]!.id;

      await expect(
        createGroupDM(
          tenant.id,
          creatorId,
          users.map((u) => u.id),
        ),
      ).rejects.toThrow('at most 8');
    }, 30_000);

    it('creates group DM with 3 participants', async () => {
      const tenant = await createTestTenant();
      const users = await Promise.all(
        Array.from({ length: 3 }, () => createTestUser()),
      );
      const creatorId = users[0]!.id;

      const thread = await createGroupDM(
        tenant.id,
        creatorId,
        users.map((u) => u.id),
      );

      expect(thread.scopeType).toBe('group_dm');
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// deleteMessage — Audit Log
// ---------------------------------------------------------------------------

describe('Message Deletion', () => {
  describe('deleteMessage — audit log', () => {
    it('writes audit log entry on deletion', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const message = await createTestMessage({
        tenantId: tenant.id,
        authorId: user.id,
      });

      await deleteMessage(tenant.id, message.id, user.id);

      // Verify audit log entry
      const db = getDbForTenant(tenant.id, 'read');
      const logs = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.tenantId, tenant.id),
            eq(auditLog.entityId, message.id),
            eq(auditLog.action, 'message.deleted'),
          ),
        );

      expect(logs).toHaveLength(1);
      expect(logs[0]!.actorId).toBe(user.id);
      expect(logs[0]!.entityType).toBe('thread_message');
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// searchThreadMessages — ILIKE
// ---------------------------------------------------------------------------

describe('Message Search', () => {
  describe('searchThreadMessages — ILIKE', () => {
    it('finds messages by content substring (case-insensitive)', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });

      // Create messages with searchable text content
      await createTestMessage({
        tenantId: tenant.id,
        threadId: thread.id,
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello World' }] }] },
      });
      await createTestMessage({
        tenantId: tenant.id,
        threadId: thread.id,
        content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Goodbye Moon' }] }] },
      });

      const results = await searchThreadMessages(tenant.id, thread.id, 'hello');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(
        results.some((m) => JSON.stringify(m.content).includes('Hello World')),
      ).toBe(true);
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// createThread — CRUD & Validation
// ---------------------------------------------------------------------------

describe('Thread CRUD', () => {
  describe('createThread', () => {
    it('creates a thread and adds creator as participant', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const scopeId = generateUUIDv7();

      const thread = await createThread(tenant.id, {
        scopeType: 'record',
        scopeId,
        createdBy: user.id,
      });

      expect(thread.scopeType).toBe('record');
      expect(thread.scopeId).toBe(scopeId);
      expect(thread.threadType).toBe('internal');
      expect(thread.createdBy).toBe(user.id);

      // Creator is added as participant
      const participants = await listParticipants(tenant.id, thread.id);
      expect(participants.some((p) => p.userId === user.id)).toBe(true);
    }, 30_000);

    it('rejects invalid scope_type', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await expect(
        createThread(tenant.id, {
          scopeType: 'invalid',
          scopeId: generateUUIDv7(),
          createdBy: user.id,
        }),
      ).rejects.toThrow('Invalid scope_type');
    }, 30_000);

    it('accepts optional threadType and name', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const thread = await createThread(tenant.id, {
        scopeType: 'record',
        scopeId: generateUUIDv7(),
        threadType: 'client',
        name: 'Client Discussion',
        createdBy: user.id,
      });

      expect(thread.threadType).toBe('client');
      expect(thread.name).toBe('Client Discussion');
    }, 30_000);
  });

  describe('createThread — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let threadId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          const thread = await createThread(tenantId, {
            scopeType: 'record',
            scopeId: generateUUIDv7(),
            createdBy: user.id,
          });
          threadId = thread.id;
        },
        query: async (tenantId) => {
          const result = await getThread(tenantId, threadId);
          return result ? [result] : [];
        },
      });
    }, 30_000);
  });

  describe('getThread', () => {
    it('returns thread by ID', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const thread = await createThread(tenant.id, {
        scopeType: 'record',
        scopeId: generateUUIDv7(),
        createdBy: user.id,
      });

      const fetched = await getThread(tenant.id, thread.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(thread.id);
    }, 30_000);

    it('returns null for non-existent thread', async () => {
      const tenant = await createTestTenant();
      const result = await getThread(tenant.id, '00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    }, 30_000);
  });

  describe('getThreadByScope', () => {
    it('finds thread by scope identifiers', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const scopeId = generateUUIDv7();
      await createThread(tenant.id, {
        scopeType: 'record',
        scopeId,
        createdBy: user.id,
      });

      const found = await getThreadByScope(tenant.id, 'record', scopeId);
      expect(found).not.toBeNull();
      expect(found!.scopeId).toBe(scopeId);
    }, 30_000);

    it('filters by threadType when provided', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const scopeId = generateUUIDv7();
      await createThread(tenant.id, {
        scopeType: 'record',
        scopeId,
        threadType: 'client',
        createdBy: user.id,
      });

      const found = await getThreadByScope(tenant.id, 'record', scopeId, 'client');
      expect(found).not.toBeNull();

      const notFound = await getThreadByScope(tenant.id, 'record', scopeId, 'internal');
      expect(notFound).toBeNull();
    }, 30_000);
  });

  describe('listThreadsForUser', () => {
    it('returns threads with last message and unread count', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const thread = await createThread(tenant.id, {
        scopeType: 'record',
        scopeId: generateUUIDv7(),
        createdBy: user.id,
      });

      // Create a message in the thread
      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Hello' },
      });

      const result = await listThreadsForUser(tenant.id, user.id);
      expect(result.items.length).toBeGreaterThanOrEqual(1);

      const found = result.items.find((t) => t.id === thread.id);
      expect(found).toBeDefined();
      expect(found!.lastMessage).not.toBeNull();
    }, 30_000);

    it('supports pagination with cursor', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      // Create 3 threads
      for (let i = 0; i < 3; i++) {
        await createThread(tenant.id, {
          scopeType: 'record',
          scopeId: generateUUIDv7(),
          createdBy: user.id,
        });
        await new Promise((r) => setTimeout(r, 10));
      }

      const page1 = await listThreadsForUser(tenant.id, user.id, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await listThreadsForUser(tenant.id, user.id, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(1);
      expect(page2.nextCursor).toBeNull();
    }, 30_000);
  });
});

// ---------------------------------------------------------------------------
// Message CRUD — getMessages, editMessage, pin/unpin
// ---------------------------------------------------------------------------

describe('Message CRUD', () => {
  describe('getMessages', () => {
    it('returns paginated messages excluding archived', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      // Create 3 messages
      const msgs = [];
      for (let i = 0; i < 3; i++) {
        const msg = await createMessage(tenant.id, {
          threadId: thread.id,
          authorId: user.id,
          content: { text: `Message ${i}` },
        });
        msgs.push(msg);
      }

      // Delete one
      await deleteMessage(tenant.id, msgs[1]!.id, user.id);

      const result = await getMessages(tenant.id, thread.id);
      expect(result.items).toHaveLength(2);
    }, 30_000);

    it('supports cursor-based pagination', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      for (let i = 0; i < 3; i++) {
        await createMessage(tenant.id, {
          threadId: thread.id,
          authorId: user.id,
          content: { text: `Msg ${i}` },
        });
      }

      const page1 = await getMessages(tenant.id, thread.id, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).not.toBeNull();

      const page2 = await getMessages(tenant.id, thread.id, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(1);
    }, 30_000);

    it('filters by messageType', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        messageType: 'system',
        content: { text: 'System msg' },
      });
      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'User msg' },
      });

      const systemMsgs = await getMessages(tenant.id, thread.id, { messageType: 'system' });
      expect(systemMsgs.items).toHaveLength(1);
    }, 30_000);

    it('filters by lensFilter: activity', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        messageType: 'system',
        content: { text: 'Activity' },
      });
      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Regular' },
      });

      const result = await getMessages(tenant.id, thread.id, { lensFilter: 'activity' });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.messageType).toBe('system');
    }, 30_000);

    it('filters by lensFilter: files', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'With file' },
        attachments: [{ name: 'test.pdf', url: 'https://example.com/test.pdf' }],
      });
      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'No file' },
      });

      const result = await getMessages(tenant.id, thread.id, { lensFilter: 'files' });
      expect(result.items).toHaveLength(1);
    }, 30_000);

    it('filters by parentMessageId for replies', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      const parent = await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Parent' },
      });
      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Reply' },
        parentMessageId: parent.id,
      });
      await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Another top-level' },
      });

      const replies = await getMessages(tenant.id, thread.id, {
        parentMessageId: parent.id,
      });
      expect(replies.items).toHaveLength(1);
    }, 30_000);
  });

  describe('editMessage', () => {
    it('updates content and sets editedAt', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      const msg = await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Original' },
      });

      expect(msg.editedAt).toBeNull();

      const updated = await editMessage(tenant.id, msg.id, { text: 'Edited' });
      expect(JSON.stringify(updated.content)).toContain('Edited');
      expect(updated.editedAt).not.toBeNull();
    }, 30_000);
  });

  describe('pinMessage / unpinMessage / getPinnedMessages', () => {
    it('pins, lists pinned, and unpins a message', async () => {
      const tenant = await createTestTenant();
      const thread = await createTestThread({ tenantId: tenant.id });
      const user = await createTestUser();

      const msg = await createMessage(tenant.id, {
        threadId: thread.id,
        authorId: user.id,
        content: { text: 'Pin me' },
      });

      await pinMessage(tenant.id, msg.id, user.id);

      const pinned = await getPinnedMessages(tenant.id, thread.id);
      expect(pinned).toHaveLength(1);
      expect(pinned[0]!.id).toBe(msg.id);
      expect(pinned[0]!.pinnedBy).toBe(user.id);

      await unpinMessage(tenant.id, msg.id);

      const afterUnpin = await getPinnedMessages(tenant.id, thread.id);
      expect(afterUnpin).toHaveLength(0);
    }, 30_000);
  });

  describe('createMessage — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let threadId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const thread = await createTestThread({ tenantId });
          threadId = thread.id;
          await createMessage(tenantId, {
            threadId: thread.id,
            authorId: (await createTestUser()).id,
            content: { text: 'test' },
          });
        },
        query: async (tenantId) => {
          const result = await getMessages(tenantId, threadId);
          return result.items;
        },
      });
    }, 30_000);
  });
});
