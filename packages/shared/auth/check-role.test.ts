import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — prevent real DB connections
// ---------------------------------------------------------------------------

const mockDb = {
  select: vi.fn(),
};

vi.mock('../db/client', () => ({
  getDbForTenant: vi.fn(() => mockDb),
}));

// ---------------------------------------------------------------------------
// Query builder mock — chains .select().from().where().limit()
// ---------------------------------------------------------------------------

let tenantQueryResult: Array<Record<string, unknown>> = [];
let workspaceQueryResult: Array<Record<string, unknown>> = [];
let queryCallCount = 0;

function createQueryChain(results: Array<Record<string, unknown>>) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(results),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryCallCount = 0;
  tenantQueryResult = [];
  workspaceQueryResult = [];

  mockDb.select.mockImplementation(() => {
    queryCallCount++;
    // First call = tenant membership query, second = workspace membership
    if (queryCallCount === 1) {
      return createQueryChain(tenantQueryResult);
    }
    return createQueryChain(workspaceQueryResult);
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('resolveEffectiveRole', () => {
  it('returns null when user has no tenant membership', async () => {
    tenantQueryResult = [];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-1', 'tenant-1');
    expect(result).toBeNull();
  });

  it('returns "owner" for tenant owner without workspaceId', async () => {
    tenantQueryResult = [{ role: 'owner' }];
    const { resolveEffectiveRole } = await import('./check-role');

    expect(await resolveEffectiveRole('user-1', 'tenant-1')).toBe('owner');
  });

  it('returns "owner" for tenant owner even with workspaceId', async () => {
    tenantQueryResult = [{ role: 'owner' }];
    const { resolveEffectiveRole } = await import('./check-role');

    expect(await resolveEffectiveRole('user-1', 'tenant-1', 'ws-1')).toBe('owner');
  });

  it('returns "admin" for tenant admin without workspace context', async () => {
    tenantQueryResult = [{ role: 'admin' }];
    const { resolveEffectiveRole } = await import('./check-role');

    expect(await resolveEffectiveRole('user-1', 'tenant-1')).toBe('admin');
  });

  it('returns "admin" for tenant admin even with workspaceId', async () => {
    tenantQueryResult = [{ role: 'admin' }];
    const { resolveEffectiveRole } = await import('./check-role');

    expect(await resolveEffectiveRole('user-1', 'tenant-1', 'ws-1')).toBe('admin');
  });

  it('returns null for member with no workspaceId', async () => {
    tenantQueryResult = [{ role: 'member' }];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-1', 'tenant-1');
    expect(result).toBeNull();
  });

  it('returns workspace role for member with workspace membership', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'manager' }];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-1', 'tenant-1', 'ws-1');
    expect(result).toBe('manager');
  });

  it('returns "team_member" workspace role', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'team_member' }];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-1', 'tenant-1', 'ws-1');
    expect(result).toBe('team_member');
  });

  it('returns "viewer" workspace role', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'viewer' }];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-1', 'tenant-1', 'ws-1');
    expect(result).toBe('viewer');
  });

  it('returns null for member with no matching workspace membership', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-1', 'tenant-1', 'ws-1');
    expect(result).toBeNull();
  });

  it('uses getDbForTenant with read intent', async () => {
    tenantQueryResult = [{ role: 'owner' }];
    const { resolveEffectiveRole } = await import('./check-role');
    const { getDbForTenant } = await import('../db/client');

    await resolveEffectiveRole('user-1', 'tenant-1');

    expect(getDbForTenant).toHaveBeenCalledWith('tenant-1', 'read');
  });

  it('tenant isolation: returns null for user from Tenant A checking workspace from Tenant B', async () => {
    // User has no membership in the queried tenant
    tenantQueryResult = [];
    const { resolveEffectiveRole } = await import('./check-role');

    const result = await resolveEffectiveRole('user-from-tenant-a', 'tenant-b', 'ws-in-tenant-b');
    expect(result).toBeNull();
  });
});

describe('checkRole', () => {
  it('returns true when effective role meets required role', async () => {
    tenantQueryResult = [{ role: 'admin' }];
    const { checkRole } = await import('./check-role');

    const result = await checkRole('user-1', 'tenant-1', undefined, 'manager');
    expect(result).toBe(true);
  });

  it('returns false when effective role is below required role', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'viewer' }];
    const { checkRole } = await import('./check-role');

    const result = await checkRole('user-1', 'tenant-1', 'ws-1', 'manager');
    expect(result).toBe(false);
  });

  it('returns false when user has no membership', async () => {
    tenantQueryResult = [];
    const { checkRole } = await import('./check-role');

    const result = await checkRole('user-1', 'tenant-1', 'ws-1', 'viewer');
    expect(result).toBe(false);
  });

  it('returns true when roles are exactly equal', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'team_member' }];
    const { checkRole } = await import('./check-role');

    const result = await checkRole('user-1', 'tenant-1', 'ws-1', 'team_member');
    expect(result).toBe(true);
  });
});

describe('requireRole', () => {
  it('resolves when user has sufficient role', async () => {
    tenantQueryResult = [{ role: 'owner' }];
    const { requireRole } = await import('./check-role');

    await expect(
      requireRole('user-1', 'tenant-1', 'ws-1', 'admin', 'workspace', 'edit'),
    ).resolves.toBeUndefined();
  });

  it('throws PermissionDeniedError when user lacks required role', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'viewer' }];
    const { requireRole } = await import('./check-role');
    const { PermissionDeniedError } = await import('./errors');

    await expect(
      requireRole('user-1', 'tenant-1', 'ws-1', 'manager', 'table', 'edit'),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('thrown error has correct code and httpStatus', async () => {
    tenantQueryResult = [];
    const { requireRole } = await import('./check-role');

    try {
      await requireRole('user-1', 'tenant-1', undefined, 'admin', 'workspace', 'manage');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { code: string; httpStatus: number };
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.httpStatus).toBe(403);
    }
  });

  it('thrown error includes structured details', async () => {
    tenantQueryResult = [{ role: 'member' }];
    workspaceQueryResult = [{ role: 'team_member' }];
    const { requireRole } = await import('./check-role');

    try {
      await requireRole('user-1', 'tenant-1', 'ws-1', 'admin', 'record', 'delete');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as { details: Record<string, unknown> };
      expect(error.details).toEqual({
        action: 'delete',
        resource: 'record',
        requiredRole: 'admin',
      });
    }
  });

  it('throws when user has no membership at all', async () => {
    tenantQueryResult = [];
    const { requireRole } = await import('./check-role');
    const { PermissionDeniedError } = await import('./errors');

    await expect(
      requireRole('user-1', 'tenant-1', 'ws-1', 'viewer', 'table', 'read'),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
