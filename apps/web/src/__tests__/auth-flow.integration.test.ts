import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state — shared between vi.mock factories and tests
// ---------------------------------------------------------------------------

const {
  mockClerkAuth,
  mockGetEffectiveMemberships,
  mockGetEffectiveMembershipForTenant,
  mockDbRead,
  setDbReadResults,
} = vi.hoisted(() => {
  const clerkAuth = vi.fn();
  const getEffectiveMemberships = vi.fn();
  const getEffectiveMembershipForTenant = vi.fn();

  let callIndex = 0;
  let results: Record<string, unknown>[][] = [];

  function createSelectChain(queryResults: Record<string, unknown>[]) {
    const thenable = {
      then: (
        onFulfilled: (v: unknown) => unknown,
        onRejected?: (r: unknown) => unknown,
      ) => Promise.resolve(queryResults).then(onFulfilled, onRejected),
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
      const r = results[callIndex] ?? [];
      callIndex++;
      return createSelectChain(r);
    }),
  };

  return {
    mockClerkAuth: clerkAuth,
    mockGetEffectiveMemberships: getEffectiveMemberships,
    mockGetEffectiveMembershipForTenant: getEffectiveMembershipForTenant,
    mockDbRead: dbRead,
    setDbReadResults: (newResults: Record<string, unknown>[][]) => {
      callIndex = 0;
      results = newResults;
    },
  };
});

// ---------------------------------------------------------------------------
// Mock external boundaries
// ---------------------------------------------------------------------------

vi.mock('@clerk/nextjs/server', () => ({
  auth: mockClerkAuth,
}));

class RedirectError extends Error {
  url: string;
  constructor(url: string) {
    super(`NEXT_REDIRECT:${url}`);
    this.url = url;
  }
}

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url);
  },
}));

// Mock @everystack/shared/db at the barrel level — covers both
// tenant-resolver.ts (uses dbRead) and effective-memberships.ts
// (uses getEffectiveMemberships / getEffectiveMembershipForTenant).
vi.mock('@everystack/shared/db', async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    db: {},
    dbRead: mockDbRead,
    getDbForTenant: vi.fn(() => ({})),
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
// Import the module under test (uses mocked dependencies)
// ---------------------------------------------------------------------------

import { getAuthContext } from '../lib/auth-context';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth flow integration: requireAuth → resolveUser → resolveTenant → getAuthContext', { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDbReadResults([]);
  });

  it('produces valid ResolvedAuthContext via clerkOrgId path (direct member)', async () => {
    mockClerkAuth.mockResolvedValue({
      userId: 'clerk_user_abc',
      orgId: 'org_xyz',
    });

    // DB queries (2 direct dbRead calls):
    // 1. resolveUser: find user by clerkId
    // 2. resolveTenant: find tenant by clerkOrgId
    setDbReadResults([
      [{ id: 'int_user_001' }],
      [{ id: 'int_tenant_001' }],
    ]);

    // Effective membership mocks:
    // resolveUserTenants → getEffectiveMemberships
    mockGetEffectiveMemberships.mockResolvedValue([
      { tenantId: 'int_tenant_001', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_user_001' },
    ]);
    // resolveUserAccess → getEffectiveMembershipForTenant
    mockGetEffectiveMembershipForTenant.mockResolvedValue(
      { tenantId: 'int_tenant_001', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_user_001' },
    );

    const context = await getAuthContext();

    expect(context).toEqual({
      userId: 'int_user_001',
      tenantId: 'int_tenant_001',
      clerkUserId: 'clerk_user_abc',
      agencyTenantId: null,
    });
  });

  it('produces valid ResolvedAuthContext via fallback (no clerkOrgId)', async () => {
    mockClerkAuth.mockResolvedValue({
      userId: 'clerk_user_solo',
      orgId: undefined,
    });

    // DB query: resolveUser only (fallback path doesn't query tenants table)
    setDbReadResults([
      [{ id: 'int_user_solo' }],
    ]);

    // resolveUserTenants → getEffectiveMemberships (called twice: once in resolveUser, once in resolveTenant fallback)
    mockGetEffectiveMemberships.mockResolvedValue([
      { tenantId: 'int_tenant_solo', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_user_solo' },
    ]);
    // resolveUserAccess → getEffectiveMembershipForTenant
    mockGetEffectiveMembershipForTenant.mockResolvedValue(
      { tenantId: 'int_tenant_solo', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_user_solo' },
    );

    const context = await getAuthContext();

    expect(context).toEqual({
      userId: 'int_user_solo',
      tenantId: 'int_tenant_solo',
      clerkUserId: 'clerk_user_solo',
      agencyTenantId: null,
    });
  });

  it('redirects to /sign-in when unauthenticated', async () => {
    mockClerkAuth.mockResolvedValue({ userId: null });

    await expect(getAuthContext()).rejects.toThrow(RedirectError);
  });

  it('throws NotFoundError when user not found in database', async () => {
    mockClerkAuth.mockResolvedValue({ userId: 'clerk_ghost', orgId: null });

    setDbReadResults([[]]);

    await expect(getAuthContext()).rejects.toThrow('User not found');
  });

  it('throws NotFoundError when tenant not found for clerkOrgId', async () => {
    mockClerkAuth.mockResolvedValue({
      userId: 'clerk_user_x',
      orgId: 'org_missing',
    });

    // resolveUser finds user, then resolveTenant finds no tenant by clerkOrgId
    setDbReadResults([
      [{ id: 'int_user_x' }],
      [], // tenant not found by clerkOrgId
    ]);

    mockGetEffectiveMemberships.mockResolvedValue([
      { tenantId: 'some_tenant', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_user_x' },
    ]);

    await expect(getAuthContext()).rejects.toThrow('Tenant not found');
  });

  it('throws NotFoundError (not 403) for cross-tenant access attempt', async () => {
    mockClerkAuth.mockResolvedValue({
      userId: 'clerk_user_a',
      orgId: 'org_b',
    });

    setDbReadResults([
      [{ id: 'int_user_a' }],
      [{ id: 'int_tenant_b' }], // tenant B exists
    ]);

    mockGetEffectiveMemberships.mockResolvedValue([
      { tenantId: 'int_tenant_a', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_user_a' },
    ]);
    // User has no effective membership in tenant B
    mockGetEffectiveMembershipForTenant.mockResolvedValue(null);

    // Returns 404 — not 403 — to prevent tenant enumeration
    await expect(getAuthContext()).rejects.toThrow('Tenant not found');
  });

  it('includes agencyTenantId for agency access', async () => {
    mockClerkAuth.mockResolvedValue({
      userId: 'clerk_agency_user',
      orgId: 'org_client',
    });

    setDbReadResults([
      [{ id: 'int_agency_user' }],
      [{ id: 'client_tenant' }],
    ]);

    mockGetEffectiveMemberships.mockResolvedValue([
      { tenantId: 'agency_tenant', role: 'owner', source: 'direct', agencyTenantId: null, userId: 'int_agency_user' },
      { tenantId: 'client_tenant', role: 'admin', source: 'agency', agencyTenantId: 'agency_tenant', userId: 'int_agency_user' },
    ]);
    mockGetEffectiveMembershipForTenant.mockResolvedValue(
      { tenantId: 'client_tenant', role: 'admin', source: 'agency', agencyTenantId: 'agency_tenant', userId: 'int_agency_user' },
    );

    const context = await getAuthContext();

    expect(context).toEqual({
      userId: 'int_agency_user',
      tenantId: 'client_tenant',
      clerkUserId: 'clerk_agency_user',
      agencyTenantId: 'agency_tenant',
    });
  });
});
