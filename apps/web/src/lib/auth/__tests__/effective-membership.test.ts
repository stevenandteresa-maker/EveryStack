import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EffectiveMembership } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const { mockGetForTenant, mockGetAll } = vi.hoisted(() => ({
  mockGetForTenant: vi.fn<(userId: string, tenantId: string) => Promise<EffectiveMembership | null>>(),
  mockGetAll: vi.fn<(userId: string) => Promise<EffectiveMembership[]>>(),
}));

vi.mock('@everystack/shared/db', () => ({
  getEffectiveMembershipForTenant: mockGetForTenant,
  getEffectiveMemberships: mockGetAll,
}));

// ---------------------------------------------------------------------------
// Import module under test (uses mocked dependencies)
// ---------------------------------------------------------------------------

import {
  resolveUserAccess,
  resolveUserTenants,
} from '../effective-membership';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function directMembership(
  userId: string,
  tenantId: string,
  role: string,
): EffectiveMembership {
  return { userId, tenantId, role, source: 'direct', agencyTenantId: null };
}

function agencyMembership(
  userId: string,
  tenantId: string,
  accessLevel: string,
  agencyTenantId: string,
): EffectiveMembership {
  return {
    userId,
    tenantId,
    role: accessLevel,
    source: 'agency',
    agencyTenantId,
  };
}

// ---------------------------------------------------------------------------
// Tests — resolveUserAccess
// ---------------------------------------------------------------------------

describe('resolveUserAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when user has no membership', async () => {
    mockGetForTenant.mockResolvedValue(null);

    const result = await resolveUserAccess('user_1', 'tenant_1');

    expect(result).toBeNull();
    expect(mockGetForTenant).toHaveBeenCalledWith('user_1', 'tenant_1');
  });

  it('resolves direct member access correctly (unchanged behavior)', async () => {
    mockGetForTenant.mockResolvedValue(
      directMembership('user_1', 'tenant_1', 'admin'),
    );

    const result = await resolveUserAccess('user_1', 'tenant_1');

    expect(result).toEqual({
      role: 'admin',
      source: 'direct',
      agencyTenantId: null,
    });
  });

  it('maps agency access_level "admin" to Admin-equivalent role', async () => {
    mockGetForTenant.mockResolvedValue(
      agencyMembership('user_1', 'client_1', 'admin', 'agency_1'),
    );

    const result = await resolveUserAccess('user_1', 'client_1');

    expect(result).toEqual({
      role: 'admin',
      source: 'agency',
      agencyTenantId: 'agency_1',
    });
  });

  it('maps agency access_level "builder" to Manager-equivalent role', async () => {
    mockGetForTenant.mockResolvedValue(
      agencyMembership('user_1', 'client_1', 'builder', 'agency_1'),
    );

    const result = await resolveUserAccess('user_1', 'client_1');

    expect(result).toEqual({
      role: 'member',
      source: 'agency',
      agencyTenantId: 'agency_1',
    });
  });

  it('maps agency access_level "read_only" to Viewer-equivalent role', async () => {
    mockGetForTenant.mockResolvedValue(
      agencyMembership('user_1', 'client_1', 'read_only', 'agency_1'),
    );

    const result = await resolveUserAccess('user_1', 'client_1');

    expect(result).toEqual({
      role: 'viewer',
      source: 'agency',
      agencyTenantId: 'agency_1',
    });
  });

  it('suspended agency relationship returns null (no access)', async () => {
    // The effective_memberships view filters out suspended relationships,
    // so getEffectiveMembershipForTenant returns null.
    mockGetForTenant.mockResolvedValue(null);

    const result = await resolveUserAccess('user_1', 'client_1');

    expect(result).toBeNull();
  });

  it('direct membership takes precedence over agency access for same tenant', async () => {
    // The view returns direct rows before agency rows (UNION ALL ordering),
    // and getEffectiveMembershipForTenant uses LIMIT 1. So when both exist,
    // the direct membership is returned.
    mockGetForTenant.mockResolvedValue(
      directMembership('user_1', 'tenant_1', 'member'),
    );

    const result = await resolveUserAccess('user_1', 'tenant_1');

    expect(result).toEqual({
      role: 'member',
      source: 'direct',
      agencyTenantId: null,
    });
  });

  it('falls back to viewer for unknown agency access_level', async () => {
    mockGetForTenant.mockResolvedValue(
      agencyMembership('user_1', 'client_1', 'unknown_level', 'agency_1'),
    );

    const result = await resolveUserAccess('user_1', 'client_1');

    expect(result).toEqual({
      role: 'viewer',
      source: 'agency',
      agencyTenantId: 'agency_1',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — resolveUserTenants
// ---------------------------------------------------------------------------

describe('resolveUserTenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array for user with no memberships', async () => {
    mockGetAll.mockResolvedValue([]);

    const result = await resolveUserTenants('user_1');

    expect(result).toEqual([]);
  });

  it('returns tenant IDs from direct memberships', async () => {
    mockGetAll.mockResolvedValue([
      directMembership('user_1', 'tenant_a', 'owner'),
      directMembership('user_1', 'tenant_b', 'member'),
    ]);

    const result = await resolveUserTenants('user_1');

    expect(result).toEqual(['tenant_a', 'tenant_b']);
  });

  it('includes both direct and agency tenant IDs', async () => {
    mockGetAll.mockResolvedValue([
      directMembership('user_1', 'tenant_a', 'owner'),
      agencyMembership('user_1', 'client_1', 'admin', 'agency_1'),
    ]);

    const result = await resolveUserTenants('user_1');

    expect(result).toEqual(['tenant_a', 'client_1']);
  });

  it('deduplicates tenant IDs (direct wins over agency)', async () => {
    mockGetAll.mockResolvedValue([
      directMembership('user_1', 'tenant_a', 'member'),
      agencyMembership('user_1', 'tenant_a', 'admin', 'agency_1'),
    ]);

    const result = await resolveUserTenants('user_1');

    expect(result).toEqual(['tenant_a']);
  });
});
