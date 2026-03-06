import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const {
  mockGetForTenant,
  mockDbReadSelect,
  mockRedisGet,
  mockRedisSet,
  mockRedisDel,
  mockAuth,
  mockResolveUser,
  mockResolveTenant,
  mockLoggerWarn,
} = vi.hoisted(() => ({
  mockGetForTenant: vi.fn(),
  mockDbReadSelect: vi.fn(),
  mockRedisGet: vi.fn(),
  mockRedisSet: vi.fn(),
  mockRedisDel: vi.fn(),
  mockAuth: vi.fn(),
  mockResolveUser: vi.fn(),
  mockResolveTenant: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock: @everystack/shared/db
// ---------------------------------------------------------------------------

// Build a chainable select mock: dbRead.select().from().where().limit()
function buildSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mockDbReadSelect.mockReturnValue(chain);
  return chain;
}

vi.mock('@everystack/shared/db', () => ({
  getEffectiveMembershipForTenant: mockGetForTenant,
  eq: vi.fn((a: unknown, b: unknown) => ({ a, b })),
  dbRead: {
    select: mockDbReadSelect,
  },
  tenants: {
    id: 'tenants.id',
    name: 'tenants.name',
    settings: 'tenants.settings',
    clerkOrgId: 'tenants.clerkOrgId',
  },
}));

// ---------------------------------------------------------------------------
// Mock: @everystack/shared/redis
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  })),
}));

// ---------------------------------------------------------------------------
// Mock: @everystack/shared/logging
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/logging', () => ({
  webLogger: {
    warn: mockLoggerWarn,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/auth
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/tenant-resolver
// ---------------------------------------------------------------------------

vi.mock('@/lib/tenant-resolver', () => ({
  resolveUser: mockResolveUser,
  resolveTenant: mockResolveTenant,
}));

// ---------------------------------------------------------------------------
// Mock: @/lib/errors
// ---------------------------------------------------------------------------

vi.mock('@/lib/errors', () => {
  class NotFoundError extends Error {
    code = 'NOT_FOUND';
    statusCode = 404;
    constructor(message = 'Not found') {
      super(message);
      this.name = 'NotFoundError';
    }
  }
  return { NotFoundError };
});

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import {
  switchTenant,
  getActiveTenant,
  invalidateTenantCache,
} from '../tenant-switch';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-uuid-001';
const TENANT_A = 'tenant-uuid-aaa';
const TENANT_B = 'tenant-uuid-bbb';
const AGENCY_TENANT = 'agency-uuid-001';

function directMembership(tenantId: string, role = 'member') {
  return {
    userId: USER_ID,
    tenantId,
    role,
    source: 'direct',
    agencyTenantId: null,
  };
}

function agencyMembership(tenantId: string, accessLevel: string) {
  return {
    userId: USER_ID,
    tenantId,
    role: accessLevel,
    source: 'agency',
    agencyTenantId: AGENCY_TENANT,
  };
}

function tenantRow(
  id: string,
  name: string,
  clerkOrgId: string | null = 'org_abc',
  accentColor = '#0D9488',
) {
  return {
    id,
    name,
    settings: { branding_accent_color: accentColor },
    clerkOrgId,
  };
}

// ---------------------------------------------------------------------------
// Tests — switchTenant
// ---------------------------------------------------------------------------

describe('switchTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successful switch → updates Redis, returns correct TenantSwitchResult', async () => {
    mockGetForTenant.mockResolvedValue(directMembership(TENANT_A, 'admin'));
    buildSelectChain([tenantRow(TENANT_A, 'Acme Corp', 'org_acme', '#FF5733')]);
    mockRedisSet.mockResolvedValue('OK');

    const result = await switchTenant(USER_ID, TENANT_A);

    expect(result).toEqual({
      tenantId: TENANT_A,
      tenantName: 'Acme Corp',
      role: 'admin',
      source: 'direct',
      accentColor: '#FF5733',
      clerkOrgId: 'org_acme',
    });

    expect(mockGetForTenant).toHaveBeenCalledWith(USER_ID, TENANT_A);
    expect(mockRedisSet).toHaveBeenCalledWith(
      `active_tenant:${USER_ID}`,
      TENANT_A,
      'EX',
      86_400,
    );
  });

  it('switch to non-existent tenant → throws NotFoundError', async () => {
    mockGetForTenant.mockResolvedValue(null);

    await expect(switchTenant(USER_ID, TENANT_B)).rejects.toThrow('Tenant not found');
    expect(mockGetForTenant).toHaveBeenCalledWith(USER_ID, TENANT_B);
  });

  it('switch to tenant user has no access to → throws NotFoundError', async () => {
    // Same behavior — getEffectiveMembershipForTenant returns null
    mockGetForTenant.mockResolvedValue(null);

    await expect(switchTenant(USER_ID, TENANT_B)).rejects.toThrow('Tenant not found');
  });

  it('Redis failure on switch → degrades gracefully, returns result and logs warning', async () => {
    mockGetForTenant.mockResolvedValue(directMembership(TENANT_A, 'owner'));
    buildSelectChain([tenantRow(TENANT_A, 'Acme Corp')]);
    mockRedisSet.mockRejectedValue(new Error('Redis connection refused'));

    const result = await switchTenant(USER_ID, TENANT_A);

    // Should still return a valid result
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.tenantName).toBe('Acme Corp');

    // Should have logged a warning
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, targetTenantId: TENANT_A }),
      expect.stringContaining('Redis cache update failed'),
    );
  });

  it('agency member switching to client tenant → returns source: agency', async () => {
    mockGetForTenant.mockResolvedValue(agencyMembership(TENANT_B, 'admin'));
    buildSelectChain([tenantRow(TENANT_B, 'Client Inc', 'org_client')]);
    mockRedisSet.mockResolvedValue('OK');

    const result = await switchTenant(USER_ID, TENANT_B);

    expect(result).toEqual({
      tenantId: TENANT_B,
      tenantName: 'Client Inc',
      role: 'admin',
      source: 'agency',
      accentColor: '#0D9488',
      agencyTenantId: AGENCY_TENANT,
      clerkOrgId: 'org_client',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — getActiveTenant
// ---------------------------------------------------------------------------

describe('getActiveTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached value on Redis hit', async () => {
    mockRedisGet.mockResolvedValue(TENANT_A);

    const result = await getActiveTenant(USER_ID);

    expect(result).toBe(TENANT_A);
    expect(mockRedisGet).toHaveBeenCalledWith(`active_tenant:${USER_ID}`);
    // Should NOT call auth() on cache hit
    expect(mockAuth).not.toHaveBeenCalled();
  });

  it('populates cache on miss → resolves from Clerk session', async () => {
    mockRedisGet.mockResolvedValue(null);
    mockAuth.mockResolvedValue({ userId: 'clerk_user_1', clerkOrgId: 'org_1' });
    mockResolveUser.mockResolvedValue({ id: USER_ID, tenantIds: [TENANT_A] });
    mockResolveTenant.mockResolvedValue({ tenantId: TENANT_A, agencyTenantId: null });
    mockRedisSet.mockResolvedValue('OK');

    const result = await getActiveTenant(USER_ID);

    expect(result).toBe(TENANT_A);
    expect(mockAuth).toHaveBeenCalled();
    expect(mockResolveUser).toHaveBeenCalledWith('clerk_user_1');
    expect(mockResolveTenant).toHaveBeenCalledWith(USER_ID, 'org_1');
    // Should populate cache
    expect(mockRedisSet).toHaveBeenCalledWith(
      `active_tenant:${USER_ID}`,
      TENANT_A,
      'EX',
      86_400,
    );
  });

  it('Redis failure on getActiveTenant → falls back to Clerk session', async () => {
    mockRedisGet.mockRejectedValue(new Error('Redis down'));
    mockAuth.mockResolvedValue({ userId: 'clerk_user_1', clerkOrgId: 'org_1' });
    mockResolveUser.mockResolvedValue({ id: USER_ID, tenantIds: [TENANT_A] });
    mockResolveTenant.mockResolvedValue({ tenantId: TENANT_A, agencyTenantId: null });
    // Redis set also fails (still down)
    mockRedisSet.mockRejectedValue(new Error('Redis down'));

    const result = await getActiveTenant(USER_ID);

    expect(result).toBe(TENANT_A);
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
      expect.stringContaining('Redis cache read failed'),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — invalidateTenantCache
// ---------------------------------------------------------------------------

describe('invalidateTenantCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls Redis DEL with correct key', async () => {
    mockRedisDel.mockResolvedValue(1);

    await invalidateTenantCache(USER_ID);

    expect(mockRedisDel).toHaveBeenCalledWith(`active_tenant:${USER_ID}`);
  });
});
