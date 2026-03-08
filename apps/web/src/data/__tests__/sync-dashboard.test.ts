/**
 * Tests for sync-dashboard data functions (apps/web/src/data/sync-dashboard.ts).
 *
 * Covers:
 * - getSyncDashboardData: aggregation of connection, health, and pending counts
 * - getSyncHistory: failure-based history grouped by date
 * - Tenant isolation via getDbForTenant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Test IDs (no hardcoded UUIDs)
// ---------------------------------------------------------------------------

const TENANT_ID = randomUUID();
const CONNECTION_ID = randomUUID();

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetDbForTenant,
  mockDeriveSyncHealthState,
  createMockDb,
} = vi.hoisted(() => {
  /**
   * Creates a mock DB chain that supports multiple sequential queries.
   * Each call to a terminal method (limit, where without further chaining,
   * orderBy) returns the next result from the queue.
   */
  function createMockDbFn() {
    const queryResults: unknown[][] = [];
    let queryIndex = 0;

    const getNextResult = () => {
      const result = queryResults[queryIndex] ?? [];
      queryIndex++;
      return result;
    };

    // The chain itself is a thenable object — when awaited, it resolves
    // with the next query result. This handles queries that end on any
    // chain method (where, limit, orderBy, etc.).
    const chain: Record<string, unknown> = {};

    const self = () => chain;

    chain.select = vi.fn(self);
    chain.from = vi.fn(self);
    chain.innerJoin = vi.fn(self);
    chain.leftJoin = vi.fn(self);
    chain.groupBy = vi.fn(self);
    chain.where = vi.fn(self);
    // limit() is terminal — returns a promise
    chain.limit = vi.fn(() => Promise.resolve(getNextResult()));
    // orderBy() is terminal — returns a promise
    chain.orderBy = vi.fn(() => Promise.resolve(getNextResult()));
    // Make the chain itself thenable for queries that end on .where()
    chain.then = vi.fn((resolve: (v: unknown) => void) => {
      return Promise.resolve(getNextResult()).then(resolve);
    });

    return {
      chain,
      setQueryResults: (results: unknown[][]) => {
        queryResults.length = 0;
        queryResults.push(...results);
        queryIndex = 0;
      },
    };
  }

  const db = createMockDbFn();

  return {
    mockGetDbForTenant: vi.fn(() => db.chain),
    mockDeriveSyncHealthState: vi.fn().mockReturnValue('healthy'),
    createMockDb: () => db,
  };
});

const mockDb = createMockDb();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: mockGetDbForTenant,
  baseConnections: {
    id: 'id',
    tenantId: 'tenant_id',
    platform: 'platform',
    externalBaseName: 'external_base_name',
    syncDirection: 'sync_direction',
    conflictResolution: 'conflict_resolution',
    syncStatus: 'sync_status',
    syncConfig: 'sync_config',
    health: 'health',
    lastSyncAt: 'last_sync_at',
  },
  syncConflicts: {
    id: 'id',
    tenantId: 'tenant_id',
    fieldId: 'field_id',
    recordId: 'record_id',
    status: 'status',
  },
  syncFailures: {
    id: 'id',
    tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id',
    status: 'status',
    createdAt: 'created_at',
  },
  syncSchemaChanges: {
    id: 'id',
    tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id',
    status: 'status',
  },
  syncedFieldMappings: {
    fieldId: 'field_id',
    tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id',
  },
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings: Array.from(strings),
      values,
      as: vi.fn(() => 'aliased'),
    })),
    {
      as: vi.fn(),
      raw: vi.fn(),
    },
  ),
}));

vi.mock('@everystack/shared/sync', () => ({
  ConnectionHealthSchema: {
    safeParse: vi.fn((data: unknown) => {
      if (data && typeof data === 'object') {
        return { success: true, data };
      }
      return { success: false };
    }),
  },
  deriveSyncHealthState: mockDeriveSyncHealthState,
  DEFAULT_CONNECTION_HEALTH: {
    consecutive_failures: 0,
    records_synced: 0,
    records_failed: 0,
    last_success_at: null,
    last_error: null,
    next_retry_at: null,
  },
}));

vi.mock('@/lib/errors', () => {
  class NotFoundError extends Error {
    code = 'NOT_FOUND';
    statusCode = 404;
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  }
  return { NotFoundError };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getSyncDashboardData, getSyncHistory } from '../sync-dashboard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConnectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONNECTION_ID,
    platform: 'airtable',
    externalBaseName: 'My Base',
    syncDirection: 'bidirectional',
    conflictResolution: 'last_write_wins',
    syncStatus: 'active',
    syncConfig: {
      tables: [
        { external_table_id: randomUUID(), enabled: true, estimated_record_count: 100 },
        { external_table_id: randomUUID(), enabled: true, estimated_record_count: 200 },
        { external_table_id: randomUUID(), enabled: false, estimated_record_count: 50 },
      ],
      polling_interval_seconds: 600,
    },
    health: {
      consecutive_failures: 0,
      records_synced: 300,
      records_failed: 0,
      last_success_at: '2026-03-07T12:00:00Z',
      last_error: null,
      next_retry_at: null,
    },
    lastSyncAt: new Date('2026-03-07T12:00:00Z'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getSyncDashboardData
// ---------------------------------------------------------------------------

describe('getSyncDashboardData', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns complete dashboard data when connection exists', async () => {
    const connRow = makeConnectionRow();
    // Query order: 1) connection (limit), 2) conflicts (where→then),
    // 3) failures (where→then), 4) schema changes (where→then)
    mockDb.setQueryResults([
      [connRow],
      [{ count: 3 }],
      [{ count: 1 }],
      [{ count: 2 }],
    ]);

    const data = await getSyncDashboardData(TENANT_ID, CONNECTION_ID);

    expect(data.connectionId).toBe(CONNECTION_ID);
    expect(data.platform).toBe('airtable');
    expect(data.baseName).toBe('My Base');
    expect(data.syncDirection).toBe('bidirectional');
    expect(data.syncStatus).toBe('active');
    expect(data.totalSyncedRecords).toBe(300);
    expect(data.pollingIntervalSeconds).toBe(600);
    expect(data.pendingConflictCount).toBe(3);
    expect(data.pendingFailureCount).toBe(1);
    expect(data.pendingSchemaChangeCount).toBe(2);
    expect(data.healthState).toBe('healthy');
    expect(data.syncConfig).not.toBeNull();
  });

  it('throws NotFoundError when connection not found', async () => {
    mockDb.setQueryResults([[]]);

    await expect(
      getSyncDashboardData(TENANT_ID, CONNECTION_ID),
    ).rejects.toThrow('Connection not found');
  });

  it('handles null health JSONB — falls back to DEFAULT_CONNECTION_HEALTH', async () => {
    const connRow = makeConnectionRow({ health: null });
    mockDb.setQueryResults([
      [connRow],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
    ]);

    const data = await getSyncDashboardData(TENANT_ID, CONNECTION_ID);

    expect(data.health).toEqual({
      consecutive_failures: 0,
      records_synced: 0,
      records_failed: 0,
      last_success_at: null,
      last_error: null,
      next_retry_at: null,
    });
  });

  it('correctly calculates total synced records from enabled tables only', async () => {
    const connRow = makeConnectionRow({
      syncConfig: {
        tables: [
          { external_table_id: randomUUID(), enabled: true, estimated_record_count: 500 },
          { external_table_id: randomUUID(), enabled: false, estimated_record_count: 999 },
          { external_table_id: randomUUID(), enabled: true, estimated_record_count: 250 },
        ],
        polling_interval_seconds: 120,
      },
    });

    mockDb.setQueryResults([
      [connRow],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
    ]);

    const data = await getSyncDashboardData(TENANT_ID, CONNECTION_ID);

    expect(data.totalSyncedRecords).toBe(750);
    expect(data.pollingIntervalSeconds).toBe(120);
  });

  it('returns zero totalSyncedRecords when syncConfig is null', async () => {
    const connRow = makeConnectionRow({ syncConfig: null });
    mockDb.setQueryResults([
      [connRow],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
    ]);

    const data = await getSyncDashboardData(TENANT_ID, CONNECTION_ID);

    expect(data.totalSyncedRecords).toBe(0);
    expect(data.pollingIntervalSeconds).toBe(300);
    expect(data.syncConfig).toBeNull();
  });

  it('uses tenant-scoped read access', async () => {
    const connRow = makeConnectionRow();
    mockDb.setQueryResults([
      [connRow],
      [{ count: 0 }],
      [{ count: 0 }],
      [{ count: 0 }],
    ]);

    await getSyncDashboardData(TENANT_ID, CONNECTION_ID);

    expect(mockGetDbForTenant).toHaveBeenCalledWith(TENANT_ID, 'read');
  });
});

// ---------------------------------------------------------------------------
// getSyncHistory
// ---------------------------------------------------------------------------

describe('getSyncHistory', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns history entries grouped by date', async () => {
    const historyRows = [
      { date: '2026-03-07', failedCount: 2, retriedCount: 1, resolvedCount: 5 },
      { date: '2026-03-06', failedCount: 0, retriedCount: 0, resolvedCount: 3 },
    ];

    mockDb.setQueryResults([historyRows]);

    const history = await getSyncHistory(TENANT_ID, CONNECTION_ID);

    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({
      date: '2026-03-07',
      successCount: 5,
      partialCount: 1,
      failedCount: 2,
      totalRecordsSynced: 0,
      averageDurationMs: null,
    });
  });

  it('returns empty array when no failures exist', async () => {
    mockDb.setQueryResults([[]]);

    const history = await getSyncHistory(TENANT_ID, CONNECTION_ID);

    expect(history).toEqual([]);
  });

  it('uses tenant-scoped read access', async () => {
    mockDb.setQueryResults([[]]);

    await getSyncHistory(TENANT_ID, CONNECTION_ID);

    expect(mockGetDbForTenant).toHaveBeenCalledWith(TENANT_ID, 'read');
  });
});
