/**
 * Integration tests for the field permission data access layer.
 *
 * Tests the full resolution round-trip: real database → getFieldPermissions() → result.
 * Uses factories and an in-memory Redis mock.
 *
 * @see docs/reference/permissions.md § Field-Level Permissions
 * @see packages/shared/auth/permissions/resolve.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestTenantMembership,
  createTestWorkspaceMembership,
  createTestViewWithPermissions,
  getTestDb,
} from '@everystack/shared/testing';
import { views, eq } from '@everystack/shared/db';
import {
  getFieldPermissions,
  setRedisClient,
  buildCacheKey,
  PERMISSION_CACHE_TTL,
} from '../../data/permissions';

// ---------------------------------------------------------------------------
// In-memory Redis mock for integration tests
// ---------------------------------------------------------------------------

function createInMemoryRedis() {
  const store = new Map<string, { value: string; expiresAt?: number }>();

  return {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    }),
    set: vi.fn(async (key: string, value: string, _mode?: string, ttl?: number) => {
      store.set(key, {
        value,
        expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      });
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (store.delete(key)) deleted++;
      }
      return deleted;
    }),
    scan: vi.fn(async () => ['0' as string, [] as string[]]),
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Helper: update view permissions JSONB after factory creation
// ---------------------------------------------------------------------------

async function updateViewPermissions(
  viewId: string,
  permissions: Record<string, unknown>,
): Promise<void> {
  const db = getTestDb();
  await db.update(views).set({ permissions }).where(eq(views.id, viewId));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('permissions integration tests', () => {
  let mockRedis: ReturnType<typeof createInMemoryRedis>;

  beforeEach(() => {
    mockRedis = createInMemoryRedis();
    setRedisClient(mockRedis as never);
  });

  afterEach(() => {
    setRedisClient(null);
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Full resolution round-trip
  // -------------------------------------------------------------------------

  describe('full resolution round-trip', () => {
    it('resolves role restriction: Team Member field X → read_only, others → read_write', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
        status: 'active',
      });

      const { view, table, fields } = await createTestViewWithPermissions({
        tenantId: tenant.id,
        fieldCount: 3,
      });

      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: table.workspaceId,
        userId: user.id,
        role: 'team_member',
      });

      // Role restriction: team_member → field[0] read_only
      await updateViewPermissions(view.id, {
        roles: [],
        specificUsers: [],
        excludedUsers: [],
        fieldPermissions: {
          roleRestrictions: [
            {
              tableId: table.id,
              role: 'team_member',
              fieldId: fields[0]!.id,
              accessState: 'read_only',
            },
          ],
          individualOverrides: [],
        },
      });

      const result = await getFieldPermissions(tenant.id, view.id, user.id);

      expect(result.get(fields[0]!.id)).toBe('read_only');
      expect(result.get(fields[1]!.id)).toBe('read_write');
      expect(result.get(fields[2]!.id)).toBe('read_write');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // 2. Individual override restores access
  // -------------------------------------------------------------------------

  describe('individual override restores access', () => {
    it('overrides role restriction hidden → read_only for specific user', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
        status: 'active',
      });

      const { view, table, fields } = await createTestViewWithPermissions({
        tenantId: tenant.id,
        fieldCount: 3,
      });

      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: table.workspaceId,
        userId: user.id,
        role: 'team_member',
      });

      // Role restriction hides field[1]; individual override restores to read_only
      await updateViewPermissions(view.id, {
        roles: [],
        specificUsers: [],
        excludedUsers: [],
        fieldPermissions: {
          roleRestrictions: [
            {
              tableId: table.id,
              role: 'team_member',
              fieldId: fields[1]!.id,
              accessState: 'hidden',
            },
          ],
          individualOverrides: [
            {
              tableId: table.id,
              userId: user.id,
              fieldId: fields[1]!.id,
              accessState: 'read_only',
            },
          ],
        },
      });

      const result = await getFieldPermissions(tenant.id, view.id, user.id);

      expect(result.get(fields[1]!.id)).toBe('read_only');
      expect(result.get(fields[0]!.id)).toBe('read_write');
      expect(result.get(fields[2]!.id)).toBe('read_write');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // 3. Field ceiling blocks override
  // -------------------------------------------------------------------------

  describe('field ceiling blocks override', () => {
    it('clamps individual override read_write to read_only when member_edit=false', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
        status: 'active',
      });

      // Field[2] has member_edit=false — ceiling for team_member is read_only
      const { view, table, fields } = await createTestViewWithPermissions({
        tenantId: tenant.id,
        fieldCount: 3,
        fieldOverrides: [
          {},
          {},
          { permissions: { member_edit: false, viewer_visible: true } },
        ],
      });

      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: table.workspaceId,
        userId: user.id,
        role: 'team_member',
      });

      // Role restriction hides field[2]; override tries read_write but ceiling clamps
      await updateViewPermissions(view.id, {
        roles: [],
        specificUsers: [],
        excludedUsers: [],
        fieldPermissions: {
          roleRestrictions: [
            {
              tableId: table.id,
              role: 'team_member',
              fieldId: fields[2]!.id,
              accessState: 'hidden',
            },
          ],
          individualOverrides: [
            {
              tableId: table.id,
              userId: user.id,
              fieldId: fields[2]!.id,
              accessState: 'read_write',
            },
          ],
        },
      });

      const result = await getFieldPermissions(tenant.id, view.id, user.id);

      // Field ceiling (member_edit=false) clamps read_write → read_only
      expect(result.get(fields[2]!.id)).toBe('read_only');
      expect(result.get(fields[0]!.id)).toBe('read_write');
      expect(result.get(fields[1]!.id)).toBe('read_write');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // 4. Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('prevents cross-tenant permission resolution', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();

      const userA = await createTestUser();
      await createTestTenantMembership({
        tenantId: tenantA.id,
        userId: userA.id,
        role: 'member',
        status: 'active',
      });

      const { view, table } = await createTestViewWithPermissions({
        tenantId: tenantA.id,
      });

      await createTestWorkspaceMembership({
        tenantId: tenantA.id,
        workspaceId: table.workspaceId,
        userId: userA.id,
        role: 'team_member',
      });

      // Tenant A can resolve permissions
      const resultA = await getFieldPermissions(tenantA.id, view.id, userA.id);
      expect(resultA.size).toBeGreaterThan(0);

      // Clear cache so tenant B query hits DB
      mockRedis._store.clear();

      // Tenant B cannot see tenant A's view — throws NotFoundError
      await expect(
        getFieldPermissions(tenantB.id, view.id, userA.id),
      ).rejects.toThrow();
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // 5. Cache behavior
  // -------------------------------------------------------------------------

  describe('cache behavior', () => {
    it('second call uses cache — no additional DB queries', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
        status: 'active',
      });

      const { view, table } = await createTestViewWithPermissions({
        tenantId: tenant.id,
      });

      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: table.workspaceId,
        userId: user.id,
        role: 'team_member',
      });

      // First call — cache miss, populates cache
      const result1 = await getFieldPermissions(tenant.id, view.id, user.id);
      expect(result1.size).toBe(3);

      // Verify cache was written
      expect(mockRedis.set).toHaveBeenCalledTimes(1);
      const cacheKey = buildCacheKey(tenant.id, view.id, user.id);
      expect(mockRedis.set).toHaveBeenCalledWith(
        cacheKey,
        expect.any(String),
        'EX',
        PERMISSION_CACHE_TTL,
      );

      // Clear spy counts (keep stored data in cache)
      mockRedis.get.mockClear();
      mockRedis.set.mockClear();

      // Second call — should hit cache
      const result2 = await getFieldPermissions(tenant.id, view.id, user.id);

      // Verify cache was checked
      expect(mockRedis.get).toHaveBeenCalledTimes(1);
      expect(mockRedis.get).toHaveBeenCalledWith(cacheKey);

      // Results should be identical
      expect(result2.size).toBe(result1.size);
      for (const [fieldId, state] of result1) {
        expect(result2.get(fieldId)).toBe(state);
      }

      // No new cache write on cache hit
      expect(mockRedis.set).not.toHaveBeenCalled();
    }, 30_000);
  });
});
