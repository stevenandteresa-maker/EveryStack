/**
 * Unit tests for NotificationService.
 *
 * Tests routing logic: in-app delivery, email enqueue, priority overrides,
 * muted thread suppression, and best-effort error handling.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotificationService } from '../notification-service';
import type { CreateNotificationParams } from '@/data/notifications';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockCreateNotification = vi.fn();
const mockRedisPublish = vi.fn();
const mockRedisConnect = vi.fn().mockResolvedValue(undefined);
const mockQueueAdd = vi.fn();

// Queue of DB query results — each DB query pops from front
const dbQueryResults: unknown[][] = [];

vi.mock('@/data/notifications', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: () => ({
    publish: mockRedisPublish,
    connect: mockRedisConnect,
  }),
}));

vi.mock('@/lib/queue', () => ({
  getQueue: () => ({ add: mockQueueAdd }),
}));

vi.mock('@everystack/shared/db', async () => {
  const actual = await vi.importActual('@everystack/shared/db') as Record<string, unknown>;
  return {
    ...actual,
    getDbForTenant: () => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve(dbQueryResults.shift() ?? []),
          }),
        }),
      }),
    }),
    generateUUIDv7: () => '00000000-0000-0000-0000-000000000099',
  };
});

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildParams(overrides?: Partial<CreateNotificationParams>): CreateNotificationParams {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    type: 'mention',
    title: 'Test notification',
    sourceType: 'thread_message',
    ...overrides,
  };
}

const MOCK_NOTIFICATION = {
  id: 'notif-1',
  userId: 'user-1',
  tenantId: 'tenant-1',
  type: 'mention',
  title: 'Test notification',
  body: null,
  sourceType: 'thread_message',
  sourceThreadId: null,
  sourceMessageId: null,
  sourceRecordId: null,
  actorId: null,
  groupKey: null,
  read: false,
  readAt: null,
  createdAt: new Date(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    service = new NotificationService();
    vi.clearAllMocks();
    dbQueryResults.length = 0;
    mockCreateNotification.mockResolvedValue(MOCK_NOTIFICATION);
    mockRedisPublish.mockResolvedValue(1);
    mockQueueAdd.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Basic routing
  // -------------------------------------------------------------------------

  it('inserts notification and publishes to Redis for in-app', async () => {
    // DB call: getUserPreferences → no prefs found (defaults)
    dbQueryResults.push([]);

    const result = await service.create(buildParams());

    expect(mockCreateNotification).toHaveBeenCalledOnce();
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'user:user-1:notifications',
      JSON.stringify(MOCK_NOTIFICATION),
    );
    expect(result).toEqual(MOCK_NOTIFICATION);
  });

  it('enqueues email job when default prefs have instant email for mention', async () => {
    dbQueryResults.push([]); // getUserPreferences

    await service.create(buildParams({ type: 'mention' }));

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'notification.email.send',
      expect.objectContaining({
        notificationId: 'notif-1',
        type: 'mention',
      }),
      expect.objectContaining({
        attempts: 3,
      }),
    );
  });

  it('enqueues email job for dm type (instant by default)', async () => {
    dbQueryResults.push([]); // getUserPreferences

    await service.create(buildParams({ type: 'dm' }));

    expect(mockQueueAdd).toHaveBeenCalledWith(
      'notification.email.send',
      expect.objectContaining({ type: 'dm' }),
      expect.any(Object),
    );
  });

  it('does NOT enqueue email for thread_reply (digest by default)', async () => {
    dbQueryResults.push([]); // isThreadMutedForUser (not muted)
    dbQueryResults.push([]); // getUserPreferences

    await service.create(buildParams({ type: 'thread_reply', sourceThreadId: 'thread-1' }));

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('does NOT enqueue email for system type', async () => {
    dbQueryResults.push([]); // getUserPreferences

    await service.create(buildParams({ type: 'system' }));

    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // All 8 notification types supported
  // -------------------------------------------------------------------------

  it.each([
    'mention', 'dm', 'thread_reply', 'approval_requested',
    'approval_decided', 'automation_failed', 'sync_error', 'system',
  ])('handles %s notification type', async (type) => {
    // For thread_reply: first DB call is mute check, second is prefs
    if (type === 'thread_reply') {
      dbQueryResults.push([]); // isThreadMutedForUser
    }
    dbQueryResults.push([]); // getUserPreferences

    const result = await service.create(buildParams({ type, sourceThreadId: 'thread-1' }));
    expect(result).toBeDefined();
    expect(mockCreateNotification).toHaveBeenCalledOnce();
  });

  // -------------------------------------------------------------------------
  // Priority override: mention and dm bypass mute
  // -------------------------------------------------------------------------

  describe('priority override', () => {
    it('mention delivers in-app even when mute schedule is active', async () => {
      // getUserPreferences returns mute-active schedule
      dbQueryResults.push([{
        preferences: {
          mentions: { inApp: true, email: 'instant' },
          muteSchedule: { enabled: true, start: '00:00', end: '23:59', timezone: 'UTC' },
        },
      }]);

      await service.create(buildParams({ type: 'mention' }));

      expect(mockRedisPublish).toHaveBeenCalled();
    });

    it('dm delivers in-app even when mute schedule is active', async () => {
      dbQueryResults.push([{
        preferences: {
          dms: { inApp: true, email: 'instant' },
          muteSchedule: { enabled: true, start: '00:00', end: '23:59', timezone: 'UTC' },
        },
      }]);

      await service.create(buildParams({ type: 'dm' }));

      expect(mockRedisPublish).toHaveBeenCalled();
    });

    it('mention enqueues email even when mute schedule is active', async () => {
      dbQueryResults.push([{
        preferences: {
          mentions: { inApp: true, email: 'instant' },
          muteSchedule: { enabled: true, start: '00:00', end: '23:59', timezone: 'UTC' },
        },
      }]);

      await service.create(buildParams({ type: 'mention' }));

      expect(mockQueueAdd).toHaveBeenCalled();
    });

    it('non-priority type suppressed in-app during mute schedule', async () => {
      dbQueryResults.push([]); // isThreadMutedForUser (thread_reply checks mute)
      dbQueryResults.push([{
        preferences: {
          threadReplies: { inApp: true, email: 'digest' },
          muteSchedule: { enabled: true, start: '00:00', end: '23:59', timezone: 'UTC' },
        },
      }]);

      await service.create(buildParams({ type: 'thread_reply', sourceThreadId: 'thread-1' }));

      expect(mockRedisPublish).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Muted thread_reply suppression
  // -------------------------------------------------------------------------

  describe('muted thread_reply suppression', () => {
    it('suppresses thread_reply when thread is muted for user', async () => {
      // isThreadMutedForUser returns muted=true
      dbQueryResults.push([{ muted: true }]);

      const result = await service.create(buildParams({
        type: 'thread_reply',
        sourceThreadId: 'thread-1',
      }));

      expect(result).toBeNull();
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('does NOT suppress mention even when thread is muted', async () => {
      // mention type does not check thread mute (only thread_reply does)
      dbQueryResults.push([]); // getUserPreferences

      const result = await service.create(buildParams({
        type: 'mention',
        sourceThreadId: 'thread-1',
      }));

      expect(result).toBeDefined();
      expect(mockCreateNotification).toHaveBeenCalledOnce();
    });

    it('delivers thread_reply when thread is NOT muted', async () => {
      dbQueryResults.push([{ muted: false }]); // isThreadMutedForUser
      dbQueryResults.push([]); // getUserPreferences

      const result = await service.create(buildParams({
        type: 'thread_reply',
        sourceThreadId: 'thread-1',
      }));

      expect(result).toBeDefined();
      expect(mockCreateNotification).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Best-effort error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('returns null when notification insert fails', async () => {
      dbQueryResults.push([]); // getUserPreferences
      mockCreateNotification.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.create(buildParams());

      expect(result).toBeNull();
    });

    it('still returns notification when Redis publish fails', async () => {
      dbQueryResults.push([]); // getUserPreferences
      mockRedisPublish.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.create(buildParams());

      expect(result).toEqual(MOCK_NOTIFICATION);
    });

    it('still returns notification when email enqueue fails', async () => {
      dbQueryResults.push([]); // getUserPreferences
      mockQueueAdd.mockRejectedValueOnce(new Error('Queue error'));

      const result = await service.create(buildParams({ type: 'mention' }));

      expect(result).toEqual(MOCK_NOTIFICATION);
    });
  });
});
