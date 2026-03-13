import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FieldPermissionMap } from '@everystack/shared/auth';
import { ForbiddenError } from '@everystack/shared/errors';
import {
  checkFieldPermission,
  checkFieldPermissions,
  filterHiddenFields,
  logPermissionDenial,
  setRedisClient,
} from '../field-permissions';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/data/permissions', () => ({
  getFieldPermissions: vi.fn(),
}));

vi.mock('@everystack/shared/db', () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  getDbForTenant: vi.fn().mockReturnValue({}),
}));

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  getTraceId: vi.fn().mockReturnValue('test-trace-id'),
}));

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(),
}));

import { getFieldPermissions } from '@/data/permissions';
import { writeAuditLog } from '@everystack/shared/db';

const mockGetFieldPermissions = vi.mocked(getFieldPermissions);
const mockWriteAuditLog = vi.mocked(writeAuditLog);

// ---------------------------------------------------------------------------
// Mock Redis client
// ---------------------------------------------------------------------------

function createMockRedis() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
      store.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(store.get(key) ?? '0', 10);
      const next = current + 1;
      store.set(key, String(next));
      return next;
    }),
    del: vi.fn(),
    scan: vi.fn(),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_ID = '019538a0-0000-7000-8000-000000000001';
const VIEW_ID = '019538a0-0000-7000-8000-000000000002';
const USER_ID = '019538a0-0000-7000-8000-000000000003';
const FIELD_A = '019538a0-0000-7000-8000-00000000000a';
const FIELD_B = '019538a0-0000-7000-8000-00000000000b';
const FIELD_C = '019538a0-0000-7000-8000-00000000000c';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('field-permissions', () => {
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    setRedisClient(mockRedis as never);
  });

  afterEach(() => {
    setRedisClient(null);
  });

  // -------------------------------------------------------------------------
  // checkFieldPermission — single field
  // -------------------------------------------------------------------------

  describe('checkFieldPermission', () => {
    it('throws ForbiddenError on hidden field access', async () => {
      const map: FieldPermissionMap = new Map([[FIELD_A, 'hidden']]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_only'),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_only'),
      ).rejects.toThrow("You don't have access to this field.");
    });

    it('throws ForbiddenError with action "read" when field is hidden', async () => {
      const map: FieldPermissionMap = new Map([[FIELD_A, 'hidden']]);
      mockGetFieldPermissions.mockResolvedValue(map);

      try {
        await checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_only');
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ForbiddenError);
        const forbidden = error as ForbiddenError;
        expect(forbidden.details?.action).toBe('read');
        expect(forbidden.details?.resource).toBe('field');
        expect(forbidden.details?.resourceId).toBe(FIELD_A);
      }
    });

    it('throws ForbiddenError on read_only when write required', async () => {
      const map: FieldPermissionMap = new Map([[FIELD_A, 'read_only']]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_write'),
      ).rejects.toThrow(ForbiddenError);

      try {
        await checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_write');
        expect.fail('Should have thrown');
      } catch (error) {
        const forbidden = error as ForbiddenError;
        expect(forbidden.details?.action).toBe('edit');
        expect(forbidden.message).toBe('This field is read-only for your role.');
      }
    });

    it('passes for sufficient permission (read_write)', async () => {
      const map: FieldPermissionMap = new Map([[FIELD_A, 'read_write']]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_write'),
      ).resolves.toBeUndefined();
    });

    it('passes for read_only when read_only required', async () => {
      const map: FieldPermissionMap = new Map([[FIELD_A, 'read_only']]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_only'),
      ).resolves.toBeUndefined();
    });

    it('treats unknown fields as hidden', async () => {
      const map: FieldPermissionMap = new Map(); // empty — no field entry
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermission(TENANT_ID, VIEW_ID, USER_ID, FIELD_A, 'read_only'),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  // -------------------------------------------------------------------------
  // checkFieldPermissions — batch
  // -------------------------------------------------------------------------

  describe('checkFieldPermissions', () => {
    it('rejects batch if any field fails', async () => {
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'hidden'],
        [FIELD_C, 'read_only'],
      ]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermissions(TENANT_ID, VIEW_ID, USER_ID, [FIELD_A, FIELD_B, FIELD_C], 'read_write'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('includes count in error message', async () => {
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'hidden'],
        [FIELD_C, 'read_only'],
      ]);
      mockGetFieldPermissions.mockResolvedValue(map);

      try {
        await checkFieldPermissions(
          TENANT_ID, VIEW_ID, USER_ID,
          [FIELD_A, FIELD_B, FIELD_C],
          'read_write',
        );
        expect.fail('Should have thrown');
      } catch (error) {
        const forbidden = error as ForbiddenError;
        // FIELD_B (hidden) and FIELD_C (read_only when write required) = 2 denied
        expect(forbidden.message).toContain('2 field(s)');
        expect(forbidden.details?.deniedCount).toBe(2);
        expect(forbidden.details?.fieldIds).toEqual([FIELD_B, FIELD_C]);
      }
    });

    it('passes when all fields have sufficient permission', async () => {
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'read_write'],
      ]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await expect(
        checkFieldPermissions(TENANT_ID, VIEW_ID, USER_ID, [FIELD_A, FIELD_B], 'read_write'),
      ).resolves.toBeUndefined();
    });

    it('loads permission map only once for batch', async () => {
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'read_write'],
      ]);
      mockGetFieldPermissions.mockResolvedValue(map);

      await checkFieldPermissions(
        TENANT_ID, VIEW_ID, USER_ID,
        [FIELD_A, FIELD_B],
        'read_write',
      );

      expect(mockGetFieldPermissions).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // filterHiddenFields
  // -------------------------------------------------------------------------

  describe('filterHiddenFields', () => {
    it('strips hidden keys', () => {
      const record = {
        [FIELD_A]: 'visible value',
        [FIELD_B]: 'hidden value',
        [FIELD_C]: 'read-only value',
      };
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'hidden'],
        [FIELD_C, 'read_only'],
      ]);

      const result = filterHiddenFields(record, map);

      expect(result).not.toHaveProperty(FIELD_B);
    });

    it('preserves read_write and read_only keys', () => {
      const record = {
        [FIELD_A]: 'editable',
        [FIELD_B]: 'hidden',
        [FIELD_C]: 'read-only',
      };
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'hidden'],
        [FIELD_C, 'read_only'],
      ]);

      const result = filterHiddenFields(record, map);

      expect(result[FIELD_A]).toBe('editable');
      expect(result[FIELD_C]).toBe('read-only');
      expect(Object.keys(result)).toHaveLength(2);
    });

    it('does not mutate the original record', () => {
      const record = { [FIELD_A]: 'value', [FIELD_B]: 'hidden' };
      const map: FieldPermissionMap = new Map([
        [FIELD_A, 'read_write'],
        [FIELD_B, 'hidden'],
      ]);

      filterHiddenFields(record, map);

      expect(record).toHaveProperty(FIELD_B);
    });

    it('preserves keys not in permission map (unknown fields pass through)', () => {
      const record = { [FIELD_A]: 'value', someOtherKey: 'extra' };
      const map: FieldPermissionMap = new Map([[FIELD_A, 'read_write']]);

      const result = filterHiddenFields(record, map);

      expect(result).toHaveProperty('someOtherKey');
    });
  });

  // -------------------------------------------------------------------------
  // logPermissionDenial
  // -------------------------------------------------------------------------

  describe('logPermissionDenial', () => {
    it('writes to audit log', async () => {
      await logPermissionDenial(TENANT_ID, USER_ID, {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_A,
      });

      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(), // db instance
        expect.objectContaining({
          tenantId: TENANT_ID,
          actorType: 'user',
          actorId: USER_ID,
          action: 'permission_denied',
          entityType: 'field',
          entityId: FIELD_A,
          traceId: 'test-trace-id',
        }),
      );
    });

    it('deduplicates: second identical denial within 5 min increments count', async () => {
      // First call — writes audit entry
      await logPermissionDenial(TENANT_ID, USER_ID, {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_A,
      });

      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);

      // Second call — same params, should be deduplicated
      await logPermissionDenial(TENANT_ID, USER_ID, {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_A,
      });

      // Audit log should NOT have been called a second time
      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);

      // Redis incr should have been called for the dedup key
      expect(mockRedis.incr).toHaveBeenCalledTimes(1);
    });

    it('writes separate audit entries for different fields', async () => {
      await logPermissionDenial(TENANT_ID, USER_ID, {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_A,
      });

      await logPermissionDenial(TENANT_ID, USER_ID, {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_B,
      });

      expect(mockWriteAuditLog).toHaveBeenCalledTimes(2);
    });

    it('still writes audit entry when Redis fails', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Redis down'));

      await logPermissionDenial(TENANT_ID, USER_ID, {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_A,
      });

      expect(mockWriteAuditLog).toHaveBeenCalledTimes(1);
    });
  });
});
