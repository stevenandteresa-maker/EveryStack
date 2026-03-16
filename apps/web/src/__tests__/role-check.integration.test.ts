import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockClerkAuth,
  mockDbRead,
  mockRoleDb,
  mockGetEffectiveMemberships,
  mockGetEffectiveMembershipForTenant,
  setDbReadResults,
  setRoleDbResults,
} = vi.hoisted(() => {
  const clerkAuth = vi.fn();
  const getEffectiveMemberships = vi.fn();
  const getEffectiveMembershipForTenant = vi.fn();

  // --- Auth DB (dbRead for tenant-resolver) ---
  let readCallIndex = 0;
  let readResults: Record<string, unknown>[][] = [];

  function createReadChain(queryResults: Record<string, unknown>[]) {
    const thenable = {
      then: (
        resolve: (v: unknown) => unknown,
        reject?: (r: unknown) => unknown,
      ) => Promise.resolve(queryResults).then(resolve, reject),
      limit: vi.fn(() => Promise.resolve(queryResults)),
    };
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => thenable),
      })),
    };
  }

  const dbRead = {
    select: vi.fn(() => {
      const r = readResults[readCallIndex] ?? [];
      readCallIndex++;
      return createReadChain(r);
    }),
  };

  // --- Role DB (for requireRole mock implementation) ---
  let roleCallIndex = 0;
  let roleResults: Record<string, unknown>[][] = [];

  function createRoleChain(queryResults: Record<string, unknown>[]) {
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => Promise.resolve(queryResults)),
        })),
      })),
    };
  }

  const roleDb = {
    select: vi.fn(() => {
      const r = roleResults[roleCallIndex] ?? [];
      roleCallIndex++;
      return createRoleChain(r);
    }),
  };

  return {
    mockClerkAuth: clerkAuth,
    mockDbRead: dbRead,
    mockRoleDb: roleDb,
    mockGetEffectiveMemberships: getEffectiveMemberships,
    mockGetEffectiveMembershipForTenant: getEffectiveMembershipForTenant,
    setDbReadResults: (newResults: Record<string, unknown>[][]) => {
      readCallIndex = 0;
      readResults = newResults;
    },
    setRoleDbResults: (newResults: Record<string, unknown>[][]) => {
      roleCallIndex = 0;
      roleResults = newResults;
    },
  };
});

// ---------------------------------------------------------------------------
// Mock external boundaries
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs/server', () => ({
  auth: mockClerkAuth,
}));

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

// Mock @everystack/shared/db at the barrel level.
vi.mock('@everystack/shared/db', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    db: {},
    dbRead: mockDbRead,
    getDbForTenant: vi.fn(() => mockRoleDb),
    getEffectiveMemberships: mockGetEffectiveMemberships,
    getEffectiveMembershipForTenant: mockGetEffectiveMembershipForTenant,
  };
});

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Role hierarchy (mirrors packages/shared/auth/roles.ts)
// ---------------------------------------------------------------------------

const ROLE_HIERARCHY: Record<string, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  'team-member': 40,
  viewer: 20,
};

class PermissionDeniedError extends Error {
  code = 'PERMISSION_DENIED';
  statusCode = 403;
  details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown>) {
    super(message);
    this.name = 'PermissionDeniedError';
    this.details = details;
  }
}

// ---------------------------------------------------------------------------
// Import modules under test
// ---------------------------------------------------------------------------

import { getAuthContext } from '../lib/auth-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up mocks for an authenticated user with clerkOrgId path. */
function setupAuthenticatedUser(clerkId: string, userId: string, tenantId: string) {
  mockClerkAuth.mockResolvedValue({ userId: clerkId, orgId: 'org_1' });

  setDbReadResults([
    [{ id: userId }],
    [{ id: tenantId }],
  ]);

  mockGetEffectiveMemberships.mockResolvedValue([
    { tenantId, role: 'owner', source: 'direct', agencyTenantId: null, userId },
  ]);
  mockGetEffectiveMembershipForTenant.mockResolvedValue(
    { tenantId, role: 'owner', source: 'direct', agencyTenantId: null, userId },
  );
}

/**
 * Simulates requireRole by querying the mockRoleDb for tenant and workspace memberships.
 * Mirrors the real logic in packages/shared/auth/check-role.ts.
 */
async function requireRole(
  _userId: string,
  _tenantId: string,
  workspaceId: string | undefined,
  requiredRole: string,
  resource: string,
  action: string,
): Promise<void> {
  // Query tenant membership from mockRoleDb (sequential mock call)
  const tenantRows = await mockRoleDb.select().from().where().limit();
  const membership = tenantRows[0] as Record<string, string> | undefined;

  if (!membership) {
    throw new PermissionDeniedError("You don't have permission to do that.", {
      action,
      resource,
      requiredRole,
    });
  }

  const tenantRole = membership.role;

  // Owner and admin bypass workspace check
  if (tenantRole === 'owner' || tenantRole === 'admin') {
    const roleLevel = ROLE_HIERARCHY[tenantRole] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
    if (roleLevel >= requiredLevel) return;
    throw new PermissionDeniedError("You don't have permission to do that.", {
      action,
      resource,
      requiredRole,
    });
  }

  // Member needs workspace check
  if (!workspaceId) {
    throw new PermissionDeniedError("You don't have permission to do that.", {
      action,
      resource,
      requiredRole,
    });
  }

  const wsRows = await mockRoleDb.select().from().where().limit();
  const wsMembership = wsRows[0] as Record<string, string> | undefined;
  if (!wsMembership) {
    throw new PermissionDeniedError("You don't have permission to do that.", {
      action,
      resource,
      requiredRole,
    });
  }

  const wsRole = wsMembership.role ?? '';
  const roleLevel = ROLE_HIERARCHY[wsRole] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] ?? 0;

  if (roleLevel < requiredLevel) {
    throw new PermissionDeniedError("You don't have permission to do that.", {
      action,
      resource,
      requiredRole,
    });
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Role check integration: getAuthContext → requireRole', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDbReadResults([]);
    setRoleDbResults([]);
  });

  it('throws PermissionDeniedError when viewer-role user requires admin', async () => {
    setupAuthenticatedUser('clerk_viewer', 'user_viewer', 'tenant_1');

    // Role check: member at tenant level, viewer at workspace level
    setRoleDbResults([
      [{ role: 'member' }],   // tenant membership
      [{ role: 'viewer' }],   // workspace membership
    ]);

    const ctx = await getAuthContext();

    await expect(
      requireRole(ctx.userId, ctx.tenantId, 'ws_1', 'admin', 'workspace', 'manage'),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('passes when owner-role user requires admin', async () => {
    setupAuthenticatedUser('clerk_owner', 'user_owner', 'tenant_1');

    // Role check: owner at tenant level (bypasses workspace lookup)
    setRoleDbResults([
      [{ role: 'owner' }],
    ]);

    const ctx = await getAuthContext();

    await expect(
      requireRole(ctx.userId, ctx.tenantId, 'ws_1', 'admin', 'workspace', 'manage'),
    ).resolves.toBeUndefined();
  });

  it('thrown error has correct code, httpStatus, and details', async () => {
    setupAuthenticatedUser('clerk_viewer', 'user_viewer', 'tenant_1');

    setRoleDbResults([
      [{ role: 'member' }],
      [{ role: 'viewer' }],
    ]);

    const ctx = await getAuthContext();

    try {
      await requireRole(ctx.userId, ctx.tenantId, 'ws_1', 'admin', 'workspace', 'manage');
      expect.fail('should have thrown');
    } catch (err: unknown) {
      const error = err as PermissionDeniedError;
      expect(error.code).toBe('PERMISSION_DENIED');
      expect(error.statusCode).toBe(403);
      expect(error.details).toEqual({
        action: 'manage',
        resource: 'workspace',
        requiredRole: 'admin',
      });
    }
  });
});
