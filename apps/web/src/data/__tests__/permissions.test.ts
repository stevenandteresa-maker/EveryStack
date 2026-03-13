/**
 * Unit tests for the field permission data access layer.
 *
 * Tests verify caching behavior, key format, TTL, and invalidation.
 * The pure resolution engine is tested separately in resolve.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { FieldPermissionMap } from '@everystack/shared/auth';

// ---------------------------------------------------------------------------
// Mocks — set up before importing the module under test
// ---------------------------------------------------------------------------

const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  scan: vi.fn(),
};

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(() => mockRedis),
}));

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockGetViewById = vi.fn();
vi.mock('@/data/views', () => ({
  getViewById: (...args: unknown[]) => mockGetViewById(...args),
}));

const mockGetFieldsByTable = vi.fn();
vi.mock('@/data/fields', () => ({
  getFieldsByTable: (...args: unknown[]) => mockGetFieldsByTable(...args),
}));

const mockGetTableById = vi.fn();
vi.mock('@/data/tables', () => ({
  getTableById: (...args: unknown[]) => mockGetTableById(...args),
}));

const mockResolveEffectiveRole = vi.fn();
const mockResolveAllFieldPermissions = vi.fn();
vi.mock('@everystack/shared/auth', async (importOriginal) => {
  const original = await importOriginal<typeof import('@everystack/shared/auth')>();
  return {
    ...original,
    resolveEffectiveRole: (...args: unknown[]) => mockResolveEffectiveRole(...args),
    resolveAllFieldPermissions: (...args: unknown[]) => mockResolveAllFieldPermissions(...args),
  };
});

// Import module under test AFTER mocks
import {
  getFieldPermissions,
  invalidatePermissionCache,
  buildCacheKey,
  PERMISSION_CACHE_KEY_PATTERN,
  PERMISSION_CACHE_TTL,
  setRedisClient,
} from '@/data/permissions';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const TENANT_ID = '019414aa-1111-7000-8000-000000000001';
const VIEW_ID = '019414aa-2222-7000-8000-000000000002';
const USER_ID = '019414aa-3333-7000-8000-000000000003';
const TABLE_ID = '019414aa-4444-7000-8000-000000000004';
const WORKSPACE_ID = '019414aa-5555-7000-8000-000000000005';
const FIELD_A = '019414aa-6666-7000-8000-000000000006';
const FIELD_B = '019414aa-7777-7000-8000-000000000007';

function createMockView(): Record<string, unknown> {
  return {
    id: VIEW_ID,
    tenantId: TENANT_ID,
    tableId: TABLE_ID,
    name: 'Test View',
    viewType: 'grid',
    config: {
      columns: [
        { fieldId: FIELD_A, visible: true },
        { fieldId: FIELD_B, visible: true },
      ],
    },
    permissions: {},
    isShared: true,
    publishState: 'live',
    environment: 'live',
    position: 0,
    createdBy: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function createMockTable() {
  return {
    id: TABLE_ID,
    tenantId: TENANT_ID,
    workspaceId: WORKSPACE_ID,
    name: 'Test Table',
    workspace: { id: WORKSPACE_ID, name: 'Test Workspace' },
  };
}

function createMockFields() {
  return [
    {
      id: FIELD_A,
      tenantId: TENANT_ID,
      tableId: TABLE_ID,
      name: 'Name',
      fieldType: 'text',
      permissions: { member_edit: true, viewer_visible: true },
      sortOrder: 0,
    },
    {
      id: FIELD_B,
      tenantId: TENANT_ID,
      tableId: TABLE_ID,
      name: 'Status',
      fieldType: 'single_select',
      permissions: { member_edit: true, viewer_visible: true },
      sortOrder: 1,
    },
  ];
}

function createMockPermissionMap(): FieldPermissionMap {
  return new Map<string, 'read_write' | 'read_only' | 'hidden'>([
    [FIELD_A, 'read_write'],
    [FIELD_B, 'read_only'],
  ]);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('permissions data layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setRedisClient(mockRedis as never);
  });

  afterEach(() => {
    setRedisClient(null);
  });

  // -------------------------------------------------------------------------
  // buildCacheKey
  // -------------------------------------------------------------------------

  describe('buildCacheKey', () => {
    it('produces the correct key format from the pattern', () => {
      const key = buildCacheKey(TENANT_ID, VIEW_ID, USER_ID);

      expect(key).toBe(`cache:t:${TENANT_ID}:perm:${VIEW_ID}:${USER_ID}`);
    });

    it('matches PERMISSION_CACHE_KEY_PATTERN when expanded', () => {
      const key = buildCacheKey('t1', 'v1', 'u1');
      const expected = PERMISSION_CACHE_KEY_PATTERN
        .replace('{tenantId}', 't1')
        .replace('{viewId}', 'v1')
        .replace('{userId}', 'u1');

      expect(key).toBe(expected);
    });
  });

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  describe('constants', () => {
    it('PERMISSION_CACHE_TTL is 300 seconds', () => {
      expect(PERMISSION_CACHE_TTL).toBe(300);
    });

    it('PERMISSION_CACHE_KEY_PATTERN contains required placeholders', () => {
      expect(PERMISSION_CACHE_KEY_PATTERN).toContain('{tenantId}');
      expect(PERMISSION_CACHE_KEY_PATTERN).toContain('{viewId}');
      expect(PERMISSION_CACHE_KEY_PATTERN).toContain('{userId}');
    });
  });

  // -------------------------------------------------------------------------
  // getFieldPermissions — cache hit
  // -------------------------------------------------------------------------

  describe('getFieldPermissions — cache hit', () => {
    it('returns cached map without triggering DB queries', async () => {
      const permMap = createMockPermissionMap();
      const serialized = JSON.stringify(Array.from(permMap.entries()));

      mockRedis.get.mockResolvedValueOnce(serialized);

      const result = await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      // Verify cache was checked
      expect(mockRedis.get).toHaveBeenCalledWith(
        buildCacheKey(TENANT_ID, VIEW_ID, USER_ID),
      );

      // Verify no DB queries were made
      expect(mockGetViewById).not.toHaveBeenCalled();
      expect(mockGetFieldsByTable).not.toHaveBeenCalled();
      expect(mockGetTableById).not.toHaveBeenCalled();
      expect(mockResolveEffectiveRole).not.toHaveBeenCalled();
      expect(mockResolveAllFieldPermissions).not.toHaveBeenCalled();

      // Verify correct deserialized result
      expect(result).toBeInstanceOf(Map);
      expect(result.get(FIELD_A)).toBe('read_write');
      expect(result.get(FIELD_B)).toBe('read_only');
    });
  });

  // -------------------------------------------------------------------------
  // getFieldPermissions — cache miss
  // -------------------------------------------------------------------------

  describe('getFieldPermissions — cache miss', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockGetViewById.mockResolvedValueOnce(createMockView());
      mockGetTableById.mockResolvedValueOnce(createMockTable());
      mockGetFieldsByTable.mockResolvedValueOnce(createMockFields());
      mockResolveEffectiveRole.mockResolvedValueOnce('team_member');
      mockResolveAllFieldPermissions.mockReturnValueOnce(createMockPermissionMap());
      mockRedis.set.mockResolvedValueOnce('OK');
    });

    it('triggers full resolution flow on cache miss', async () => {
      await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      expect(mockGetViewById).toHaveBeenCalledWith(TENANT_ID, VIEW_ID);
      expect(mockGetTableById).toHaveBeenCalledWith(TENANT_ID, TABLE_ID);
      expect(mockGetFieldsByTable).toHaveBeenCalledWith(TENANT_ID, TABLE_ID);
      expect(mockResolveEffectiveRole).toHaveBeenCalledWith(
        USER_ID,
        TENANT_ID,
        WORKSPACE_ID,
      );
      expect(mockResolveAllFieldPermissions).toHaveBeenCalledOnce();
    });

    it('passes correct context to resolveAllFieldPermissions', async () => {
      await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      const context = mockResolveAllFieldPermissions.mock.calls[0]?.[0];
      expect(context).toMatchObject({
        userId: USER_ID,
        effectiveRole: 'team_member',
        tableId: TABLE_ID,
        viewId: VIEW_ID,
        fieldIds: [FIELD_A, FIELD_B],
        viewFieldOverrides: [FIELD_A, FIELD_B],
      });
    });

    it('caches result in Redis with correct TTL', async () => {
      await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      const cacheKey = buildCacheKey(TENANT_ID, VIEW_ID, USER_ID);
      expect(mockRedis.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(String),
        'EX',
        PERMISSION_CACHE_TTL,
      );
    });

    it('returns the resolved FieldPermissionMap', async () => {
      const result = await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      expect(result).toBeInstanceOf(Map);
      expect(result.get(FIELD_A)).toBe('read_write');
      expect(result.get(FIELD_B)).toBe('read_only');
    });
  });

  // -------------------------------------------------------------------------
  // getFieldPermissions — no role (no access)
  // -------------------------------------------------------------------------

  describe('getFieldPermissions — no effective role', () => {
    it('returns all fields as hidden when user has no role', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockGetViewById.mockResolvedValueOnce(createMockView());
      mockGetTableById.mockResolvedValueOnce(createMockTable());
      mockGetFieldsByTable.mockResolvedValueOnce(createMockFields());
      mockResolveEffectiveRole.mockResolvedValueOnce(null);

      const result = await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      expect(result.get(FIELD_A)).toBe('hidden');
      expect(result.get(FIELD_B)).toBe('hidden');
      expect(mockResolveAllFieldPermissions).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // getFieldPermissions — Redis failure (fail-open)
  // -------------------------------------------------------------------------

  describe('getFieldPermissions — Redis failure', () => {
    it('falls back to resolution when Redis read fails', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Connection refused'));
      mockGetViewById.mockResolvedValueOnce(createMockView());
      mockGetTableById.mockResolvedValueOnce(createMockTable());
      mockGetFieldsByTable.mockResolvedValueOnce(createMockFields());
      mockResolveEffectiveRole.mockResolvedValueOnce('team_member');
      mockResolveAllFieldPermissions.mockReturnValueOnce(createMockPermissionMap());
      mockRedis.set.mockResolvedValueOnce('OK');

      const result = await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      expect(result).toBeInstanceOf(Map);
      expect(mockResolveAllFieldPermissions).toHaveBeenCalledOnce();
    });

    it('continues without caching when Redis write fails', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockGetViewById.mockResolvedValueOnce(createMockView());
      mockGetTableById.mockResolvedValueOnce(createMockTable());
      mockGetFieldsByTable.mockResolvedValueOnce(createMockFields());
      mockResolveEffectiveRole.mockResolvedValueOnce('team_member');
      mockResolveAllFieldPermissions.mockReturnValueOnce(createMockPermissionMap());
      mockRedis.set.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      // Should still return the resolved map
      expect(result.get(FIELD_A)).toBe('read_write');
    });
  });

  // -------------------------------------------------------------------------
  // getFieldPermissions — view with no columns config
  // -------------------------------------------------------------------------

  describe('getFieldPermissions — no columns config', () => {
    it('treats all fields as visible when view has no columns config', async () => {
      const viewNoColumns = createMockView();
      viewNoColumns.config = {};

      mockRedis.get.mockResolvedValueOnce(null);
      mockGetViewById.mockResolvedValueOnce(viewNoColumns);
      mockGetTableById.mockResolvedValueOnce(createMockTable());
      mockGetFieldsByTable.mockResolvedValueOnce(createMockFields());
      mockResolveEffectiveRole.mockResolvedValueOnce('team_member');
      mockResolveAllFieldPermissions.mockReturnValueOnce(createMockPermissionMap());
      mockRedis.set.mockResolvedValueOnce('OK');

      await getFieldPermissions(TENANT_ID, VIEW_ID, USER_ID);

      const context = mockResolveAllFieldPermissions.mock.calls[0]?.[0];
      // All field IDs should be in viewFieldOverrides
      expect(context.viewFieldOverrides).toEqual([FIELD_A, FIELD_B]);
    });
  });

  // -------------------------------------------------------------------------
  // invalidatePermissionCache — with userId
  // -------------------------------------------------------------------------

  describe('invalidatePermissionCache — with userId', () => {
    it('deletes the specific cache key', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await invalidatePermissionCache(TENANT_ID, VIEW_ID, USER_ID);

      expect(mockRedis.del).toHaveBeenCalledWith(
        buildCacheKey(TENANT_ID, VIEW_ID, USER_ID),
      );
      expect(mockRedis.scan).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // invalidatePermissionCache — without userId (scan)
  // -------------------------------------------------------------------------

  describe('invalidatePermissionCache — without userId', () => {
    it('uses SCAN to find and delete all user caches for a view', async () => {
      const key1 = buildCacheKey(TENANT_ID, VIEW_ID, 'user-1');
      const key2 = buildCacheKey(TENANT_ID, VIEW_ID, 'user-2');

      // First scan returns keys, second scan returns cursor '0' (done)
      mockRedis.scan
        .mockResolvedValueOnce(['42', [key1, key2]])
        .mockResolvedValueOnce(['0', []]);
      mockRedis.del.mockResolvedValue(2);

      await invalidatePermissionCache(TENANT_ID, VIEW_ID);

      expect(mockRedis.scan).toHaveBeenCalledWith(
        '0',
        'MATCH',
        `cache:t:${TENANT_ID}:perm:${VIEW_ID}:*`,
        'COUNT',
        100,
      );
      expect(mockRedis.del).toHaveBeenCalledWith(key1, key2);
    });

    it('handles empty scan result gracefully', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await invalidatePermissionCache(TENANT_ID, VIEW_ID);

      expect(mockRedis.scan).toHaveBeenCalledOnce();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // invalidatePermissionCache — Redis failure
  // -------------------------------------------------------------------------

  describe('invalidatePermissionCache — Redis failure', () => {
    it('does not throw when Redis fails', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        invalidatePermissionCache(TENANT_ID, VIEW_ID, USER_ID),
      ).resolves.toBeUndefined();
    });
  });
});
