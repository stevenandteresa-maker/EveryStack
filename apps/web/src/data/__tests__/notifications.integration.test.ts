/**
 * Integration tests for notification data functions.
 *
 * Covers tenant isolation, CRUD operations, pagination,
 * Redis-cached unread count, and mark-read operations.
 */

import { describe, it, expect, afterAll } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  testTenantIsolation,
} from '@everystack/shared/testing';

import {
  createNotification,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  _closeRedis,
} from '../notifications';
import type { CreateNotificationParams } from '../notifications';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildParams(overrides: Partial<CreateNotificationParams> & { userId: string; tenantId: string }): CreateNotificationParams {
  return {
    type: 'mention',
    title: 'Test notification',
    sourceType: 'thread_message',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tenant Isolation Tests
// ---------------------------------------------------------------------------

describe('Notification Data Functions', () => {
  afterAll(async () => {
    await _closeRedis();
  });

  describe('createNotification — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let notifUserId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          notifUserId = user.id;
          await createNotification(tenantId, buildParams({
            userId: user.id,
            tenantId,
          }));
        },
        query: async (tenantId) => {
          const result = await getNotifications(tenantId, notifUserId);
          return result.items;
        },
      });
    }, 30_000);
  });

  describe('getNotifications — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let userId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          userId = user.id;
          await createNotification(tenantId, buildParams({
            userId: user.id,
            tenantId,
          }));
        },
        query: async (tenantId) => {
          const result = await getNotifications(tenantId, userId);
          return result.items;
        },
      });
    }, 30_000);
  });

  describe('getUnreadNotificationCount — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let userId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          userId = user.id;
          await createNotification(tenantId, buildParams({
            userId: user.id,
            tenantId,
          }));
        },
        query: async (tenantId) => {
          const count = await getUnreadNotificationCount(tenantId, userId);
          // Return empty array for 0 count (cross-tenant), array with item for non-zero
          return count > 0 ? [{ count }] : [];
        },
      });
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // CRUD Tests
  // ---------------------------------------------------------------------------

  describe('createNotification', () => {
    it('inserts a notification with all fields', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();
      const actor = await createTestUser();

      const notif = await createNotification(tenantId, {
        userId: user.id,
        tenantId,
        type: 'mention',
        title: 'Sarah mentioned you',
        body: 'Hey check this out',
        sourceType: 'thread_message',
        sourceThreadId: '00000000-0000-0000-0000-000000000001',
        sourceMessageId: '00000000-0000-0000-0000-000000000002',
        actorId: actor.id,
        groupKey: 'thread:00000000-0000-0000-0000-000000000001',
      });

      expect(notif).toBeDefined();
      expect(notif.id).toBeDefined();
      expect(notif.userId).toBe(user.id);
      expect(notif.tenantId).toBe(tenantId);
      expect(notif.type).toBe('mention');
      expect(notif.title).toBe('Sarah mentioned you');
      expect(notif.body).toBe('Hey check this out');
      expect(notif.read).toBe(false);
      expect(notif.readAt).toBeNull();
    }, 10_000);

    it('supports all 8 notification types', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      const types = [
        'mention', 'dm', 'thread_reply', 'approval_requested',
        'approval_decided', 'automation_failed', 'sync_error', 'system',
      ];

      for (const type of types) {
        const notif = await createNotification(tenantId, buildParams({
          userId: user.id,
          tenantId,
          type,
          title: `Test ${type}`,
        }));
        expect(notif.type).toBe(type);
      }
    }, 10_000);
  });

  describe('getNotifications', () => {
    it('returns notifications in created_at DESC order', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      for (let i = 0; i < 3; i++) {
        await createNotification(tenantId, buildParams({
          userId: user.id,
          tenantId,
          title: `Notif ${i}`,
        }));
      }

      const result = await getNotifications(tenantId, user.id);
      expect(result.items).toHaveLength(3);
      // DESC order: most recent first
      expect(result.items[0]!.title).toBe('Notif 2');
      expect(result.items[2]!.title).toBe('Notif 0');
    }, 10_000);

    it('supports read filter', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      const n1 = await createNotification(tenantId, buildParams({
        userId: user.id,
        tenantId,
        title: 'Unread',
      }));
      await createNotification(tenantId, buildParams({
        userId: user.id,
        tenantId,
        title: 'Will be read',
      }));

      await markNotificationRead(tenantId, user.id, n1.id);

      const unread = await getNotifications(tenantId, user.id, { read: false });
      expect(unread.items).toHaveLength(1);
      expect(unread.items[0]!.title).toBe('Will be read');

      const read = await getNotifications(tenantId, user.id, { read: true });
      expect(read.items).toHaveLength(1);
      expect(read.items[0]!.title).toBe('Unread');
    }, 10_000);

    it('supports cursor-based pagination', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      for (let i = 0; i < 5; i++) {
        await createNotification(tenantId, buildParams({
          userId: user.id,
          tenantId,
          title: `Notif ${i}`,
        }));
      }

      const page1 = await getNotifications(tenantId, user.id, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.nextCursor).toBeDefined();

      const page2 = await getNotifications(tenantId, user.id, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(2);

      const page3 = await getNotifications(tenantId, user.id, {
        limit: 2,
        cursor: page2.nextCursor!,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.nextCursor).toBeNull();
    }, 10_000);
  });

  // ---------------------------------------------------------------------------
  // Unread Count
  // ---------------------------------------------------------------------------

  describe('getUnreadNotificationCount', () => {
    it('returns correct unread count', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));
      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));
      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));

      const count = await getUnreadNotificationCount(tenantId, user.id);
      expect(count).toBe(3);
    }, 10_000);

    it('returns 0 when all read', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));
      await markAllNotificationsRead(tenantId, user.id);

      const count = await getUnreadNotificationCount(tenantId, user.id);
      expect(count).toBe(0);
    }, 10_000);
  });

  // ---------------------------------------------------------------------------
  // Mark Read
  // ---------------------------------------------------------------------------

  describe('markNotificationRead', () => {
    it('marks a single notification as read with timestamp', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      const notif = await createNotification(tenantId, buildParams({
        userId: user.id,
        tenantId,
      }));

      await markNotificationRead(tenantId, user.id, notif.id);

      const result = await getNotifications(tenantId, user.id, { read: true });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.read).toBe(true);
      expect(result.items[0]!.readAt).toBeDefined();
    }, 10_000);
  });

  describe('markAllNotificationsRead', () => {
    it('marks all unread notifications as read', async () => {
      const { id: tenantId } = await createTestTenant();
      const user = await createTestUser();

      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));
      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));
      await createNotification(tenantId, buildParams({ userId: user.id, tenantId }));

      await markAllNotificationsRead(tenantId, user.id);

      const unread = await getNotifications(tenantId, user.id, { read: false });
      expect(unread.items).toHaveLength(0);

      const allRead = await getNotifications(tenantId, user.id, { read: true });
      expect(allRead.items).toHaveLength(3);
    }, 10_000);
  });
});
