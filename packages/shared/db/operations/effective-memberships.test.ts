import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { DrizzleClient } from '../client';

// ---- Mocks ----------------------------------------------------------------

const mockSelectResult = vi.hoisted(() => ({
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock('../client', () => ({
  db: {},
  dbRead: {},
  getDbForTenant: vi.fn(),
}));

// Build a chainable mock that mimics .select().from().where().limit()
function createMockClient() {
  const limitFn = vi.fn(() => Promise.resolve(mockSelectResult.rows));
  const whereFn = vi.fn(() => {
    const thenable = {
      limit: limitFn,
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        Promise.resolve(mockSelectResult.rows).then(resolve, reject),
    };
    return thenable;
  });
  const fromFn = vi.fn(() => ({ where: whereFn }));
  const selectFn = vi.fn(() => ({ from: fromFn }));

  return {
    client: { select: selectFn } as unknown as DrizzleClient,
    selectFn,
    fromFn,
    whereFn,
    limitFn,
  };
}

// ---- Tests -----------------------------------------------------------------

describe('getEffectiveMemberships', () => {
  beforeEach(() => {
    mockSelectResult.rows = [];
    vi.clearAllMocks();
  });

  it('returns all memberships for a user', async () => {
    const { getEffectiveMemberships } = await import('./effective-memberships');
    const { client, fromFn } = createMockClient();

    mockSelectResult.rows = [
      { userId: 'u1', tenantId: 't1', role: 'admin', source: 'direct', agencyTenantId: null },
      { userId: 'u1', tenantId: 't2', role: 'builder', source: 'agency', agencyTenantId: 'a1' },
    ];

    const result = await getEffectiveMemberships('u1', client);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ tenantId: 't1', source: 'direct' });
    expect(result[1]).toMatchObject({ tenantId: 't2', source: 'agency' });
    expect(fromFn).toHaveBeenCalled();
  });

  it('returns empty array when user has no memberships', async () => {
    const { getEffectiveMemberships } = await import('./effective-memberships');
    const { client } = createMockClient();

    mockSelectResult.rows = [];

    const result = await getEffectiveMemberships('no-user', client);
    expect(result).toEqual([]);
  });
});

describe('getEffectiveMembershipForTenant', () => {
  beforeEach(() => {
    mockSelectResult.rows = [];
    vi.clearAllMocks();
  });

  it('returns the membership for a specific tenant', async () => {
    const { getEffectiveMembershipForTenant } = await import('./effective-memberships');
    const { client, limitFn } = createMockClient();

    mockSelectResult.rows = [
      { userId: 'u1', tenantId: 't1', role: 'admin', source: 'direct', agencyTenantId: null },
    ];

    const result = await getEffectiveMembershipForTenant('u1', 't1', client);

    expect(result).toMatchObject({ tenantId: 't1', role: 'admin', source: 'direct' });
    expect(limitFn).toHaveBeenCalledWith(1);
  });

  it('returns null when no membership exists', async () => {
    const { getEffectiveMembershipForTenant } = await import('./effective-memberships');
    const { client } = createMockClient();

    mockSelectResult.rows = [];

    const result = await getEffectiveMembershipForTenant('u1', 'no-tenant', client);
    expect(result).toBeNull();
  });
});
