import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockUpdate,
  mockDb,
  mockWriteDb,
  mockGetAuthContext,
  mockRequireRole,
  mockDecrementQuotaCache,
  mockUpdateSyncConfig,
  mockQueueAdd,
} = vi.hoisted(() => {
  const _mockWhere = vi.fn().mockResolvedValue([]);
  const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: _mockFrom });

  const _mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const _mockUpdateSet = vi.fn().mockReturnValue({ where: _mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockUpdateSet });

  return {
    mockSelect,
    mockUpdate,
    mockDb: { select: mockSelect },
    mockWriteDb: { select: mockSelect, update: mockUpdate },
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      clerkUserId: 'clerk-1',
      agencyTenantId: null,
    }),
    mockRequireRole: vi.fn().mockResolvedValue(undefined),
    mockDecrementQuotaCache: vi.fn().mockResolvedValue(undefined),
    mockUpdateSyncConfig: vi.fn().mockResolvedValue(undefined),
    mockQueueAdd: vi.fn().mockResolvedValue({ id: 'job-123' }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/auth', () => ({
  requireRole: mockRequireRole,
}));

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('@/lib/errors', () => ({
  wrapUnknownError: vi.fn((e: unknown) => e),
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn((_, mode?: string) => (mode === 'write' ? mockWriteDb : mockDb)),
  records: {
    id: 'id',
    tenantId: 'tenant_id',
    tableId: 'table_id',
    syncMetadata: 'sync_metadata',
    archivedAt: 'archived_at',
  },
  baseConnections: {
    id: 'id',
    tenantId: 'tenant_id',
    syncConfig: 'sync_config',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      sql: strings.join('?'),
      values,
    }),
    { raw: (s: string) => s },
  ),
  isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
}));

vi.mock('@everystack/shared/sync', () => ({
  decrementQuotaCache: mockDecrementQuotaCache,
}));

vi.mock('@/data/sync-setup', () => ({
  updateSyncConfig: mockUpdateSyncConfig,
}));

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({ add: mockQueueAdd })),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

import {
  deleteOrphanedRecords,
  keepOrphanedRecordsAsLocal,
  undoFilterChange,
} from '../sync-orphans';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_TABLE_ID = '01234567-89ab-4def-8123-456789abcdef';
const VALID_CONN_ID = 'abcdef01-2345-4789-abcd-ef0123456789';

function setupOrphanedRecords(count: number) {
  const records = Array.from({ length: count }, (_, i) => ({
    id: `rec-${i}`,
  }));

  const mockWhere = vi.fn().mockResolvedValue(records);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

function setupConnectionWithConfig(syncConfig: Record<string, unknown>) {
  const mockLimit = vi.fn().mockResolvedValue([{ syncConfig }]);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('deleteOrphanedRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('returns deletedCount: 0 when no orphaned records exist', async () => {
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await deleteOrphanedRecords({ tableId: VALID_TABLE_ID });
    expect(result).toEqual({ deletedCount: 0 });
    expect(mockDecrementQuotaCache).not.toHaveBeenCalled();
  });

  it('soft-deletes orphaned records and decrements quota', async () => {
    setupOrphanedRecords(3);

    const result = await deleteOrphanedRecords({ tableId: VALID_TABLE_ID });

    expect(result).toEqual({ deletedCount: 3 });
    expect(mockDecrementQuotaCache).toHaveBeenCalledWith('tenant-1', 3);
    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'record', 'delete',
    );
  });

  it('requires admin role with record:delete permission', async () => {
    setupOrphanedRecords(1);

    await deleteOrphanedRecords({ tableId: VALID_TABLE_ID });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'record', 'delete',
    );
  });
});

describe('keepOrphanedRecordsAsLocal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns acknowledged: true without DB changes', async () => {
    const result = await keepOrphanedRecordsAsLocal({ tableId: VALID_TABLE_ID });
    expect(result).toEqual({ acknowledged: true });
  });

  it('requires admin role with record:update permission', async () => {
    await keepOrphanedRecordsAsLocal({ tableId: VALID_TABLE_ID });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'record', 'update',
    );
  });
});

describe('undoFilterChange', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('reverts filter, resets orphan status, and enqueues re-sync', async () => {
    setupConnectionWithConfig({
      polling_interval_seconds: 300,
      tables: [{
        external_table_id: VALID_TABLE_ID,
        external_table_name: 'Contacts',
        enabled: true,
        sync_filter: [{ fieldId: 'f1', operator: 'equals', value: 'new', conjunction: 'and' }],
        estimated_record_count: 100,
        synced_record_count: 50,
        previous_sync_filter: [{ fieldId: 'f1', operator: 'equals', value: 'old', conjunction: 'and' }],
      }],
    });

    const result = await undoFilterChange({
      tableId: VALID_TABLE_ID,
      connectionId: VALID_CONN_ID,
    });

    expect(result).toEqual({ resyncJobId: 'job-123' });
    expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      VALID_CONN_ID,
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({
            sync_filter: [{ fieldId: 'f1', operator: 'equals', value: 'old', conjunction: 'and' }],
            previous_sync_filter: null,
          }),
        ]),
      }),
    );
    expect(mockQueueAdd).toHaveBeenCalledWith('sync.initial', expect.objectContaining({
      tenantId: 'tenant-1',
      connectionId: VALID_CONN_ID,
    }));
  });

  it('requires admin role with connection:update permission', async () => {
    setupConnectionWithConfig({
      polling_interval_seconds: 300,
      tables: [{
        external_table_id: VALID_TABLE_ID,
        external_table_name: 'Contacts',
        enabled: true,
        sync_filter: null,
        estimated_record_count: 100,
        synced_record_count: 50,
        previous_sync_filter: [],
      }],
    });

    await undoFilterChange({
      tableId: VALID_TABLE_ID,
      connectionId: VALID_CONN_ID,
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'connection', 'update',
    );
  });

  it('throws when no previous filter is available', async () => {
    setupConnectionWithConfig({
      polling_interval_seconds: 300,
      tables: [{
        external_table_id: VALID_TABLE_ID,
        external_table_name: 'Contacts',
        enabled: true,
        sync_filter: [{ fieldId: 'f1', operator: 'equals', value: 'x', conjunction: 'and' }],
        estimated_record_count: 100,
        synced_record_count: 50,
        // No previous_sync_filter
      }],
    });

    await expect(
      undoFilterChange({ tableId: VALID_TABLE_ID, connectionId: VALID_CONN_ID }),
    ).rejects.toThrow('No previous filter available to restore');
  });

  it('throws when connection is not found', async () => {
    const mockLimit = vi.fn().mockResolvedValue([]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    await expect(
      undoFilterChange({ tableId: VALID_TABLE_ID, connectionId: VALID_CONN_ID }),
    ).rejects.toThrow('Connection not found');
  });
});
