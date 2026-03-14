import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

const chainedQuery = {
  select: mockSelect,
  from: mockFrom,
  innerJoin: mockInnerJoin,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
};

// Each method returns the chain
mockSelect.mockReturnValue(chainedQuery);
mockFrom.mockReturnValue(chainedQuery);
mockInnerJoin.mockReturnValue(chainedQuery);
mockWhere.mockReturnValue(chainedQuery);
mockOrderBy.mockReturnValue(chainedQuery);

const mockResolveEffectiveRole = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => chainedQuery),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings: [...strings],
      values,
    }),
    {
      join: vi.fn((items: unknown[], sep: unknown) => ({ type: 'sql.join', items, sep })),
    },
  ),
  records: {
    id: 'records.id',
    tenantId: 'records.tenant_id',
    tableId: 'records.table_id',
    canonicalData: 'records.canonical_data',
    searchVector: 'records.search_vector',
    archivedAt: 'records.archived_at',
  },
  fields: {
    id: 'fields.id',
    tableId: 'fields.table_id',
    isPrimary: 'fields.is_primary',
  },
  tables: {
    id: 'tables.id',
    name: 'tables.name',
    workspaceId: 'tables.workspace_id',
  },
}));

vi.mock('@everystack/shared/auth', () => ({
  resolveEffectiveRole: (...args: unknown[]) => mockResolveEffectiveRole(...args),
}));

import { searchRecords } from '../command-bar-search';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-aaa-0001';
const TENANT_B = 'tenant-bbb-0002';
const WORKSPACE_ID = 'ws-0001';
const TABLE_ID = 'tbl-0001';
const USER_ID = 'user-0001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSearchResult(overrides: Partial<{
  record_id: string;
  table_id: string;
  table_name: string;
  primary_field_value: string;
  rank: number;
}> = {}) {
  return {
    record_id: overrides.record_id ?? 'rec-001',
    table_id: overrides.table_id ?? TABLE_ID,
    table_name: overrides.table_name ?? 'Projects',
    primary_field_value: overrides.primary_field_value ?? 'Acme Project',
    rank: overrides.rank ?? 0.5,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('searchRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: query returns results
    mockLimit.mockResolvedValue([makeSearchResult()]);
    // Default: user has access
    mockResolveEffectiveRole.mockResolvedValue('manager');
  });

  it('returns ranked search results matching query', async () => {
    const results = await searchRecords(TENANT_A, WORKSPACE_ID, 'acme');

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(expect.objectContaining({
      record_id: 'rec-001',
      table_id: TABLE_ID,
      table_name: 'Projects',
      primary_field_value: 'Acme Project',
      rank: 0.5,
    }));
    // Verify getDbForTenant was called with tenant + read intent
    const { getDbForTenant } = await import('@everystack/shared/db');
    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_A, 'read');
  });

  it('returns empty array for empty query', async () => {
    const results = await searchRecords(TENANT_A, WORKSPACE_ID, '');
    expect(results).toEqual([]);
  });

  it('returns empty array for whitespace-only query', async () => {
    const results = await searchRecords(TENANT_A, WORKSPACE_ID, '   ');
    expect(results).toEqual([]);
  });

  it('scoped search filters to specific table', async () => {
    mockLimit.mockResolvedValue([
      makeSearchResult({ table_id: TABLE_ID }),
    ]);

    const results = await searchRecords(TENANT_A, WORKSPACE_ID, 'acme', {
      tableId: TABLE_ID,
    });

    expect(results).toHaveLength(1);
    expect(results[0]!.table_id).toBe(TABLE_ID);
    // Verify the query was constructed (select → from → join → join → where → orderBy → limit)
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockInnerJoin).toHaveBeenCalledTimes(2); // tables + fields
    expect(mockWhere).toHaveBeenCalled();
    expect(mockOrderBy).toHaveBeenCalled();
    expect(mockLimit).toHaveBeenCalled();
  });

  it('permission filtering: user with no access sees no results', async () => {
    mockResolveEffectiveRole.mockResolvedValue(null);

    const results = await searchRecords(TENANT_A, WORKSPACE_ID, 'acme', {
      userId: USER_ID,
    });

    expect(results).toEqual([]);
    expect(mockResolveEffectiveRole).toHaveBeenCalledWith(USER_ID, TENANT_A, WORKSPACE_ID);
    // Should NOT have queried the database
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('permission filtering: user with role sees results', async () => {
    mockResolveEffectiveRole.mockResolvedValue('owner');
    mockLimit.mockResolvedValue([
      makeSearchResult({ record_id: 'rec-100' }),
      makeSearchResult({ record_id: 'rec-200' }),
    ]);

    const results = await searchRecords(TENANT_A, WORKSPACE_ID, 'acme', {
      userId: USER_ID,
    });

    expect(results).toHaveLength(2);
    expect(mockResolveEffectiveRole).toHaveBeenCalledWith(USER_ID, TENANT_A, WORKSPACE_ID);
  });

  it('soft-deleted records excluded (archivedAt filter in query)', async () => {
    // The function adds isNull(records.archivedAt) to the WHERE clause.
    // We verify that the WHERE was called (which includes the archived filter).
    mockLimit.mockResolvedValue([makeSearchResult()]);

    await searchRecords(TENANT_A, WORKSPACE_ID, 'acme');

    // The where clause is constructed with and() containing isNull(archivedAt)
    const { and: mockAnd, isNull: mockIsNull } = await import('@everystack/shared/db');
    expect(mockIsNull).toHaveBeenCalledWith('records.archived_at');
    expect(mockAnd).toHaveBeenCalled();
  });

  it('respects custom limit', async () => {
    mockLimit.mockResolvedValue([]);

    await searchRecords(TENANT_A, WORKSPACE_ID, 'test', { limit: 5 });

    expect(mockLimit).toHaveBeenCalledWith(5);
  });

  it('uses default limit of 20', async () => {
    mockLimit.mockResolvedValue([]);

    await searchRecords(TENANT_A, WORKSPACE_ID, 'test');

    expect(mockLimit).toHaveBeenCalledWith(20);
  });

  it('converts rank to number', async () => {
    mockLimit.mockResolvedValue([
      makeSearchResult({ rank: '0.123' as unknown as number }),
    ]);

    const results = await searchRecords(TENANT_A, WORKSPACE_ID, 'query');

    expect(typeof results[0]!.rank).toBe('number');
    expect(results[0]!.rank).toBe(0.123);
  });

  it('handles null primary_field_value gracefully', async () => {
    mockLimit.mockResolvedValue([{
      record_id: 'rec-001',
      table_id: TABLE_ID,
      table_name: 'Projects',
      primary_field_value: null,
      rank: 0.5,
    }]);

    const results = await searchRecords(TENANT_A, WORKSPACE_ID, 'query');

    expect(results[0]!.primary_field_value).toBe('');
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation
  // ---------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('passes tenantId to getDbForTenant for scoping', async () => {
      mockLimit.mockResolvedValue([]);

      await searchRecords(TENANT_A, WORKSPACE_ID, 'query');
      await searchRecords(TENANT_B, WORKSPACE_ID, 'query');

      const { getDbForTenant } = await import('@everystack/shared/db');
      expect(getDbForTenant).toHaveBeenCalledWith(TENANT_A, 'read');
      expect(getDbForTenant).toHaveBeenCalledWith(TENANT_B, 'read');
    });

    it('includes tenantId in query conditions', async () => {
      mockLimit.mockResolvedValue([]);

      await searchRecords(TENANT_A, WORKSPACE_ID, 'query');

      const { eq: mockEq } = await import('@everystack/shared/db');
      // eq(records.tenantId, tenantId) should be called
      expect(mockEq).toHaveBeenCalledWith('records.tenant_id', TENANT_A);
    });
  });
});
