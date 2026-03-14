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
const mockInsert = vi.fn();
const mockValues = vi.fn();
const mockOnConflictDoUpdate = vi.fn();
const mockExecute = vi.fn();

const chainedQuery = {
  select: mockSelect,
  from: mockFrom,
  innerJoin: mockInnerJoin,
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
};

const chainedInsert = {
  insert: mockInsert,
  values: mockValues,
  onConflictDoUpdate: mockOnConflictDoUpdate,
};

// Read chain: select → from → innerJoin → where → orderBy (resolves)
mockSelect.mockReturnValue(chainedQuery);
mockFrom.mockReturnValue(chainedQuery);
mockInnerJoin.mockReturnValue(chainedQuery);
mockWhere.mockReturnValue(chainedQuery);

// Insert chain: insert → values → onConflictDoUpdate (resolves)
mockInsert.mockReturnValue(chainedInsert);
mockValues.mockReturnValue(chainedInsert);

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn((tenantId: string, intent: string) => {
    if (intent === 'read') {
      return chainedQuery;
    }
    return {
      ...chainedInsert,
      execute: mockExecute,
    };
  }),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  desc: vi.fn((col: unknown) => ({ type: 'desc', col })),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({
    type: 'sql',
    strings: [...strings],
    values,
  }),
  userRecentItems: {
    id: 'user_recent_items.id',
    userId: 'user_recent_items.user_id',
    tenantId: 'user_recent_items.tenant_id',
    itemType: 'user_recent_items.item_type',
    itemId: 'user_recent_items.item_id',
    accessedAt: 'user_recent_items.accessed_at',
  },
  tables: {
    id: 'tables.id',
    name: 'tables.name',
  },
  views: {
    id: 'views.id',
    name: 'views.name',
  },
}));

import { trackRecentItem, getRecentItems } from '../recent-items';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-aaa-0001';
const TENANT_B = 'tenant-bbb-0002';
const USER_ID = 'user-0001';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRecentRow(overrides: Partial<{
  item_type: string;
  item_id: string;
  display_name: string;
  accessed_at: Date;
}> = {}) {
  return {
    item_type: overrides.item_type ?? 'table',
    item_id: overrides.item_id ?? 'tbl-001',
    display_name: overrides.display_name ?? 'Projects',
    accessed_at: overrides.accessed_at ?? new Date('2026-03-14T10:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// trackRecentItem
// ---------------------------------------------------------------------------

describe('trackRecentItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnConflictDoUpdate.mockResolvedValue(undefined);
    mockExecute.mockResolvedValue(undefined);
  });

  it('inserts a new recent item via upsert', async () => {
    await trackRecentItem(USER_ID, TENANT_A, {
      item_type: 'table',
      item_id: 'tbl-001',
      display_name: 'Projects',
    });

    const { getDbForTenant } = await import('@everystack/shared/db');
    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_A, 'write');
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        tenantId: TENANT_A,
        itemType: 'table',
        itemId: 'tbl-001',
      }),
    );
    expect(mockOnConflictDoUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        target: [
          'user_recent_items.user_id',
          'user_recent_items.item_type',
          'user_recent_items.item_id',
        ],
      }),
    );
  });

  it('upserts on conflict — updates accessed_at for duplicate item', async () => {
    await trackRecentItem(USER_ID, TENANT_A, {
      item_type: 'table',
      item_id: 'tbl-001',
      display_name: 'Projects',
    });

    // onConflictDoUpdate should set accessedAt
    const conflictCall = mockOnConflictDoUpdate.mock.calls[0]![0] as {
      set: { accessedAt: Date };
    };
    expect(conflictCall.set).toHaveProperty('accessedAt');
    expect(conflictCall.set.accessedAt).toBeInstanceOf(Date);
  });

  it('prunes oldest entries beyond 100 per user per tenant', async () => {
    await trackRecentItem(USER_ID, TENANT_A, {
      item_type: 'view',
      item_id: 'vw-001',
      display_name: 'Grid View',
    });

    // execute() called for the DELETE prune query
    expect(mockExecute).toHaveBeenCalled();
    const sqlArg = mockExecute.mock.calls[0]![0] as {
      type: string;
      values: unknown[];
    };
    // SQL should contain userId, tenantId, and OFFSET 100
    expect(sqlArg.values).toContain(USER_ID);
    expect(sqlArg.values).toContain(TENANT_A);
    expect(sqlArg.values).toContain(100);
  });
});

// ---------------------------------------------------------------------------
// getRecentItems
// ---------------------------------------------------------------------------

describe('getRecentItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: both table and view queries return empty
    mockOrderBy.mockResolvedValue([]);
  });

  it('returns items sorted by accessed_at DESC', async () => {
    const older = makeRecentRow({
      item_type: 'table',
      item_id: 'tbl-001',
      display_name: 'Older Table',
      accessed_at: new Date('2026-03-14T08:00:00Z'),
    });
    const newer = makeRecentRow({
      item_type: 'table',
      item_id: 'tbl-002',
      display_name: 'Newer Table',
      accessed_at: new Date('2026-03-14T12:00:00Z'),
    });

    // First orderBy call (tables) returns both items
    mockOrderBy.mockResolvedValueOnce([older, newer]);
    // Second orderBy call (views) returns empty
    mockOrderBy.mockResolvedValueOnce([]);

    const results = await getRecentItems(USER_ID, TENANT_A);

    expect(results).toHaveLength(2);
    expect(results[0]!.display_name).toBe('Newer Table');
    expect(results[1]!.display_name).toBe('Older Table');
  });

  it('merges table and view items sorted together', async () => {
    const tableItem = makeRecentRow({
      item_type: 'table',
      item_id: 'tbl-001',
      display_name: 'Table A',
      accessed_at: new Date('2026-03-14T10:00:00Z'),
    });
    const viewItem = makeRecentRow({
      item_type: 'view',
      item_id: 'vw-001',
      display_name: 'View B',
      accessed_at: new Date('2026-03-14T11:00:00Z'),
    });

    mockOrderBy.mockResolvedValueOnce([tableItem]);
    mockOrderBy.mockResolvedValueOnce([viewItem]);

    const results = await getRecentItems(USER_ID, TENANT_A);

    expect(results).toHaveLength(2);
    // View is newer, should come first
    expect(results[0]!.display_name).toBe('View B');
    expect(results[1]!.display_name).toBe('Table A');
  });

  it('uses default limit of 20', async () => {
    // Create 25 items for tables query
    const items = Array.from({ length: 25 }, (_, i) =>
      makeRecentRow({
        item_id: `tbl-${String(i).padStart(3, '0')}`,
        display_name: `Table ${i}`,
        accessed_at: new Date(`2026-03-14T${String(i).padStart(2, '0')}:00:00Z`),
      }),
    );

    mockOrderBy.mockResolvedValueOnce(items);
    mockOrderBy.mockResolvedValueOnce([]);

    const results = await getRecentItems(USER_ID, TENANT_A);

    expect(results).toHaveLength(20);
  });

  it('respects custom limit', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeRecentRow({
        item_id: `tbl-${String(i).padStart(3, '0')}`,
        display_name: `Table ${i}`,
        accessed_at: new Date(`2026-03-14T${String(i).padStart(2, '0')}:00:00Z`),
      }),
    );

    mockOrderBy.mockResolvedValueOnce(items);
    mockOrderBy.mockResolvedValueOnce([]);

    const results = await getRecentItems(USER_ID, TENANT_A, 5);

    expect(results).toHaveLength(5);
  });

  it('filters out deleted entities (inner join ensures only existing)', async () => {
    // Inner join with tables/views naturally filters out deleted entities.
    // If a table was deleted, the JOIN won't match — item excluded.
    mockOrderBy.mockResolvedValueOnce([makeRecentRow()]);
    mockOrderBy.mockResolvedValueOnce([]);

    const results = await getRecentItems(USER_ID, TENANT_A);

    expect(results).toHaveLength(1);
    // Verify innerJoin was called (tables join for table items)
    expect(mockInnerJoin).toHaveBeenCalled();
  });

  it('returns ISO 8601 accessed_at strings', async () => {
    const date = new Date('2026-03-14T10:30:00Z');
    mockOrderBy.mockResolvedValueOnce([makeRecentRow({ accessed_at: date })]);
    mockOrderBy.mockResolvedValueOnce([]);

    const results = await getRecentItems(USER_ID, TENANT_A);

    expect(results[0]!.accessed_at).toBe('2026-03-14T10:30:00.000Z');
  });

  it('returns empty array when no recent items exist', async () => {
    mockOrderBy.mockResolvedValueOnce([]);
    mockOrderBy.mockResolvedValueOnce([]);

    const results = await getRecentItems(USER_ID, TENANT_A);

    expect(results).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Tenant isolation
  // ---------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('passes tenantId to getDbForTenant for scoping', async () => {
      mockOrderBy.mockResolvedValue([]);

      await getRecentItems(USER_ID, TENANT_A);
      await getRecentItems(USER_ID, TENANT_B);

      const { getDbForTenant } = await import('@everystack/shared/db');
      expect(getDbForTenant).toHaveBeenCalledWith(TENANT_A, 'read');
      expect(getDbForTenant).toHaveBeenCalledWith(TENANT_B, 'read');
    });

    it('includes tenantId in query conditions', async () => {
      mockOrderBy.mockResolvedValue([]);

      await getRecentItems(USER_ID, TENANT_A);

      const { eq: mockEq } = await import('@everystack/shared/db');
      expect(mockEq).toHaveBeenCalledWith(
        'user_recent_items.tenant_id',
        TENANT_A,
      );
    });
  });
});
