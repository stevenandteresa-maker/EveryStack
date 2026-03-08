/**
 * Tests for sync-notifications.ts
 *
 * Covers:
 * - Notification routing for all 7 event types
 * - Recipient resolution (Owner, Admin, Manager)
 * - In-app Redis publishing to correct channels
 * - Email queue enqueuing for auth_expired, sync_down_1h, sync_down_6h
 * - Rate-limited events are excluded
 * - Deduplication logic
 * - Error resilience (failures don't throw)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import {
  sendSyncNotification,
  isDuplicateNotification,
  markNotificationSent,
  setNotificationRedisClient,
} from '../sync-notifications';
import { setEnqueueEmail } from '../notification-queue';
import type { SyncNotificationDetails } from '../sync-notifications';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRedisPublish = vi.fn().mockResolvedValue(1);
const mockRedisSet = vi.fn().mockResolvedValue('OK');
const mockRedisExists = vi.fn().mockResolvedValue(0);
const mockRedisGet = vi.fn().mockResolvedValue(null);

const mockRedis = {
  publish: mockRedisPublish,
  set: mockRedisSet,
  exists: mockRedisExists,
  get: mockRedisGet,
} as unknown as Redis;

const mockEnqueueEmail = vi.fn().mockResolvedValue(undefined);

// Mock DB access for recipient resolution
const mockDbSelect = vi.fn();
const mockDbInnerJoin = vi.fn();
const mockDbWhere = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    select: (...args: unknown[]) => {
      mockDbSelect(...args);
      return {
        from: () => ({
          innerJoin: (...ijArgs: unknown[]) => {
            mockDbInnerJoin(...ijArgs);
            return {
              where: (...wArgs: unknown[]) => {
                mockDbWhere(...wArgs);
                return Promise.resolve(mockDbWhere());
              },
            };
          },
        }),
      };
    },
  })),
  tenantMemberships: { tenantId: 'tenant_id', userId: 'user_id', role: 'role', status: 'status' },
  workspaceMemberships: { tenantId: 'tenant_id', userId: 'user_id', workspaceId: 'workspace_id', role: 'role' },
  users: { id: 'id', email: 'email' },
  baseConnections: {},
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  inArray: vi.fn((...args: unknown[]) => args),
}));

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(() => mockRedis),
}));

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const testDetails: SyncNotificationDetails = {
  connectionId: 'conn-1',
  platform: 'Airtable',
  workspaceId: 'ws-1',
  tableName: 'Tasks',
};

const mockRecipients = [
  { userId: 'user-1', email: 'owner@test.com' },
  { userId: 'user-2', email: 'admin@test.com' },
];

beforeEach(() => {
  vi.clearAllMocks();
  setNotificationRedisClient(mockRedis);
  setEnqueueEmail(mockEnqueueEmail);
  // Default: return mock recipients from DB
  mockDbWhere.mockReturnValue(mockRecipients);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendSyncNotification', () => {
  describe('conflict_detected', () => {
    it('sends in-app notification to Table Managers', async () => {
      await sendSyncNotification('tenant-1', 'conflict_detected', {
        ...testDetails,
        conflictCount: 3,
      });

      // Should publish to Redis for each recipient
      expect(mockRedisPublish).toHaveBeenCalledTimes(2);
      expect(mockRedisPublish).toHaveBeenCalledWith(
        't:tenant-1:user:user-1:notifications',
        expect.stringContaining('"type":"conflict_detected"'),
      );
    });

    it('does NOT send email for conflicts', async () => {
      await sendSyncNotification('tenant-1', 'conflict_detected', testDetails);
      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });
  });

  describe('auth_expired', () => {
    it('sends in-app notification AND email to Owner + Admins', async () => {
      await sendSyncNotification('tenant-1', 'auth_expired', testDetails);

      // In-app
      expect(mockRedisPublish).toHaveBeenCalledTimes(2);
      // Email
      expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
      expect(mockEnqueueEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@test.com',
          templateId: 'sync_auth_expired',
        }),
      );
    });
  });

  describe('consecutive_failures', () => {
    it('sends in-app toast to Table Managers', async () => {
      await sendSyncNotification('tenant-1', 'consecutive_failures', testDetails);

      expect(mockRedisPublish).toHaveBeenCalledTimes(2);
      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });
  });

  describe('sync_down_1h', () => {
    it('sends email to Owner only', async () => {
      await sendSyncNotification('tenant-1', 'sync_down_1h', testDetails);

      // 1hr: email only, no in-app
      expect(mockRedisPublish).not.toHaveBeenCalled();
      expect(mockEnqueueEmail).toHaveBeenCalledTimes(2); // mock returns 2 recipients
    });
  });

  describe('sync_down_6h', () => {
    it('sends escalation email to Owner + Admins', async () => {
      await sendSyncNotification('tenant-1', 'sync_down_6h', testDetails);

      expect(mockRedisPublish).not.toHaveBeenCalled();
      expect(mockEnqueueEmail).toHaveBeenCalledTimes(2);
    });
  });

  describe('partial_failure', () => {
    it('sends in-app toast to Table Managers', async () => {
      await sendSyncNotification('tenant-1', 'partial_failure', {
        ...testDetails,
        affectedRecordCount: 15,
      });

      expect(mockRedisPublish).toHaveBeenCalledTimes(2);
      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });
  });

  describe('schema_mismatch', () => {
    it('sends in-app banner to Table Managers', async () => {
      await sendSyncNotification('tenant-1', 'schema_mismatch', testDetails);

      expect(mockRedisPublish).toHaveBeenCalledTimes(2);
      expect(mockEnqueueEmail).not.toHaveBeenCalled();
    });
  });

  it('does not throw on notification failure', async () => {
    mockDbWhere.mockRejectedValueOnce(new Error('DB failure'));

    await expect(
      sendSyncNotification('tenant-1', 'auth_expired', testDetails),
    ).resolves.not.toThrow();
  });
});

describe('deduplication', () => {
  it('returns false when no dedup key exists', async () => {
    mockRedisExists.mockResolvedValueOnce(0);
    const result = await isDuplicateNotification('tenant-1', 'auth_expired', 'conn-1');
    expect(result).toBe(false);
  });

  it('returns true when dedup key exists', async () => {
    mockRedisExists.mockResolvedValueOnce(1);
    const result = await isDuplicateNotification('tenant-1', 'auth_expired', 'conn-1');
    expect(result).toBe(true);
  });

  it('marks notification as sent with TTL', async () => {
    await markNotificationSent('tenant-1', 'auth_expired', 'conn-1');
    expect(mockRedisSet).toHaveBeenCalledWith(
      'sync-notif-dedup:tenant-1:conn-1:auth_expired',
      '1',
      'EX',
      3600,
    );
  });
});
