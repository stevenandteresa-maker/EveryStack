import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockClerkAuth,
  mockDbRead,
  mockRoleDb,
  setDbReadResults,
  setRoleDbResults,
} = vi.hoisted(() => {
  const clerkAuth = vi.fn();

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

  // --- Role DB (getDbForTenant for check-role) ---
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

vi.mock('../../../../packages/shared/db/client', () => ({
  db: {},
  dbRead: mockDbRead,
  getDbForTenant: vi.fn(() => mockRoleDb),
}));

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
// Import modules under test
// ---------------------------------------------------------------------------

import { getAuthContext } from '@/lib/auth-context';
import { requireRole, PermissionDeniedError } from '@everystack/shared/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Set up mocks for an authenticated user with clerkOrgId path. */
function setupAuthenticatedUser(clerkId: string, userId: string, tenantId: string) {
  mockClerkAuth.mockResolvedValue({ userId: clerkId, orgId: 'org_1' });

  setDbReadResults([
    [{ id: userId }],           // resolveUser: find user
    [{ tenantId, role: 'owner', source: 'direct', agencyTenantId: null }], // resolveUserTenants → getEffectiveMemberships
    [{ id: tenantId }],         // resolveTenant: tenant lookup
    [{ tenantId, role: 'owner', source: 'direct', agencyTenantId: null }], // resolveUserAccess → getEffectiveMembershipForTenant
  ]);
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
      const error = err as InstanceType<typeof PermissionDeniedError>;
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
