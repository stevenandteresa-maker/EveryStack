import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { IncrementalSyncJobData } from '@everystack/shared/queue';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetDbForTenant,
  mockDecryptTokens,
  mockListRecords,
  mockToCanonical,
  mockDetectConflicts,
  mockWriteConflictRecords,
  mockApplyLastWriteWins,
  mockWaitForCapacity,
  mockPublish,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockTransaction,
} = vi.hoisted(() => {
  const mockSelect = vi.fn();
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockTransaction = vi.fn();
  const mockPublish = vi.fn().mockResolvedValue(undefined);

  return {
    mockGetDbForTenant: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      transaction: mockTransaction,
    })),
    mockDecryptTokens: vi.fn(() => ({ access_token: 'test-token' })),
    mockListRecords: vi.fn().mockResolvedValue({ records: [], offset: undefined }),
    mockToCanonical: vi.fn().mockReturnValue({}),
    mockDetectConflicts: vi.fn().mockReturnValue({
      cleanRemoteChanges: [],
      cleanLocalChanges: [],
      conflicts: [],
      unchangedFieldIds: [],
      convergentFieldIds: [],
    }),
    mockWriteConflictRecords: vi.fn().mockResolvedValue([]),
    mockApplyLastWriteWins: vi.fn().mockResolvedValue({
      updatedCanonical: {},
      updatedSyncMetadata: {
        platform_record_id: 'rec_resolved',
        last_synced_at: '2026-01-15T11:00:00.000Z',
        last_synced_values: {},
        sync_status: 'active',
        sync_direction: 'inbound',
        orphaned_at: null,
        orphaned_reason: null,
      },
      resolvedCount: 0,
    }),
    mockWaitForCapacity: vi.fn().mockResolvedValue(undefined),
    mockPublish,
    mockSelect,
    mockInsert,
    mockUpdate,
    mockTransaction,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: mockGetDbForTenant,
  baseConnections: {
    id: 'id', tenantId: 'tenant_id', platform: 'platform',
    externalBaseId: 'external_base_id', syncConfig: 'sync_config',
    oauthTokens: 'oauth_tokens', lastSyncAt: 'last_sync_at',
    syncStatus: 'sync_status', health: 'health',
    conflictResolution: 'conflict_resolution',
  },
  records: {
    id: 'id', tenantId: 'tenant_id', tableId: 'table_id',
    canonicalData: 'canonical_data', syncMetadata: 'sync_metadata',
  },
  syncedFieldMappings: {
    tenantId: 'tenant_id', baseConnectionId: 'base_connection_id',
    tableId: 'table_id', status: 'status', fieldId: 'field_id',
    externalFieldId: 'external_field_id', externalFieldType: 'external_field_type',
  },
  syncConflicts: { id: 'id', tenantId: 'tenant_id' },
  fields: { id: 'id', fieldType: 'field_type', config: 'config' },
  generateUUIDv7: vi.fn(() => 'generated-uuid'),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  sql: vi.fn(),
}));

vi.mock('@everystack/shared/sync', () => {
  // Must use function/class constructors for `new`
  function MockAirtableApiClient() {
    return { listRecords: mockListRecords };
  }
  function MockAirtableAdapter() {
    return { toCanonical: mockToCanonical };
  }
  return {
    AirtableApiClient: MockAirtableApiClient,
    AirtableAdapter: MockAirtableAdapter,
    registerAirtableTransforms: vi.fn(),
    translateFilterToFormula: vi.fn().mockReturnValue(''),
    rateLimiter: { waitForCapacity: mockWaitForCapacity },
    createInitialSyncMetadata: vi.fn().mockReturnValue({
      platform_record_id: 'rec_new',
      last_synced_at: '2026-01-15T10:00:00.000Z',
      last_synced_values: {},
      sync_status: 'active',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    }),
    updateLastSyncedValues: vi.fn().mockReturnValue({
      platform_record_id: 'rec_existing',
      last_synced_at: '2026-01-15T11:00:00.000Z',
      last_synced_values: {},
      sync_status: 'active',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    }),
    detectConflicts: mockDetectConflicts,
    writeConflictRecords: mockWriteConflictRecords,
    applyLastWriteWins: mockApplyLastWriteWins,
  };
});

vi.mock('@everystack/shared/crypto', () => ({
  decryptTokens: mockDecryptTokens,
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    SYNC_CONFLICT_DETECTED: 'sync.conflict_detected',
    SYNC_CONFLICT_RESOLVED: 'sync.conflict_resolved',
  },
}));

vi.mock('@everystack/shared/logging', () => ({
  workerLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createChildLogger: vi.fn((_parent: unknown, _ctx: unknown) => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
  runWithTraceContext: vi.fn((_ctx: unknown, fn: () => unknown) => fn()),
  generateTraceId: vi.fn(() => 'trace-test'),
}));

vi.mock('@everystack/shared/redis', () => ({
  getRedisConfig: vi.fn(() => ({ host: 'localhost', port: 6379 })),
}));

vi.mock('@everystack/shared/queue', () => ({
  QUEUE_NAMES: { sync: 'sync' },
}));

vi.mock('bullmq', () => {
  const MockWorker = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.on = vi.fn();
    this.close = vi.fn().mockResolvedValue(undefined);
  });
  return { Worker: MockWorker };
});

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { InboundSyncProcessor } from '../sync-inbound';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockJob(overrides?: Partial<IncrementalSyncJobData>): Job<IncrementalSyncJobData> {
  return {
    data: {
      tenantId: 'tenant-1',
      connectionId: 'conn-1',
      traceId: 'trace-1',
      triggeredBy: 'system',
      jobType: 'incremental' as const,
      ...overrides,
    },
    id: 'job-1',
  } as unknown as Job<IncrementalSyncJobData>;
}

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// ---------------------------------------------------------------------------
// Setup chained query builder mocks
// ---------------------------------------------------------------------------

function setupConnectionQuery() {
  const connection = {
    id: 'conn-1',
    platform: 'airtable',
    externalBaseId: 'appABC',
    syncConfig: {
      polling_interval_seconds: 300,
      tables: [
        {
          external_table_id: 'tbl1',
          external_table_name: 'Projects',
          enabled: true,
          sync_filter: null,
          estimated_record_count: 100,
          synced_record_count: 50,
          es_table_id: 'es-table-1',
        },
      ],
    },
    oauthTokens: { encrypted: 'data' },
    lastSyncAt: new Date('2026-01-15T10:00:00.000Z'),
  };

  return connection;
}

function setupChainedSelectMock(results: Record<string, unknown>[][]) {
  let callIndex = 0;
  mockSelect.mockImplementation(() => {
    const idx = callIndex++;
    const rows = results[idx] ?? [];
    const chain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    };
    return chain;
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InboundSyncProcessor', () => {
  let processor: InboundSyncProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockEventPublisher = { publish: mockPublish } as never;
    processor = new InboundSyncProcessor(mockEventPublisher);

    // Default: update returns a chain
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    // Default: insert returns a chain
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    // Default: transaction executes callback with mock tx
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const mockTx = {
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockResolvedValue(undefined),
        }),
      };
      return fn(mockTx);
    });
  });

  it('creates new records from platform when no local record exists', async () => {
    const connection = setupConnectionQuery();

    // 1st select: connection lookup → returns connection
    // 2nd select: field mappings → returns one mapping
    // 3rd select: record lookup (reconcile) → returns empty (new record)
    setupChainedSelectMock([
      [connection],
      [{ fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} }],
      [], // no existing record
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recNEW', fields: { fld1: 'Hello' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: { type: 'text', value: 'Hello' } });

    await processor.processJob(createMockJob(), mockLogger as never);

    expect(mockInsert).toHaveBeenCalled();
  });

  it('applies clean remote changes and updates sync_metadata', async () => {
    const connection = setupConnectionQuery();

    setupChainedSelectMock([
      [connection],
      [{ fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} }],
      [{ id: 'rec-1', tenantId: 'tenant-1', canonicalData: { f1: 'old' }, syncMetadata: { platform_record_id: 'recABC', last_synced_values: {} } }],
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recABC', fields: { fld1: 'Updated' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: { type: 'text', value: 'Updated' } });

    mockDetectConflicts.mockReturnValueOnce({
      cleanRemoteChanges: [{ fieldId: 'f1', value: { type: 'text', value: 'Updated' } }],
      cleanLocalChanges: [],
      conflicts: [],
      unchangedFieldIds: [],
      convergentFieldIds: [],
    });

    await processor.processJob(createMockJob(), mockLogger as never);

    expect(mockDetectConflicts).toHaveBeenCalledOnce();
    expect(mockTransaction).toHaveBeenCalled();
  });

  it('calls applyLastWriteWins when conflicts detected (default LWW mode)', async () => {
    const connection = setupConnectionQuery();

    setupChainedSelectMock([
      [connection],
      [{ fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} }],
      [{ id: 'rec-1', tenantId: 'tenant-1', canonicalData: { f1: 'local' }, syncMetadata: { platform_record_id: 'recABC', last_synced_values: { f1: { value: 'base', synced_at: '2026-01-15T10:00:00.000Z' } } } }],
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recABC', fields: { fld1: 'Remote' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: { type: 'text', value: 'Remote' } });

    const conflicts = [{
      fieldId: 'f1',
      localValue: 'local',
      remoteValue: { type: 'text', value: 'Remote' },
      baseValue: 'base',
    }];

    mockDetectConflicts.mockReturnValueOnce({
      cleanRemoteChanges: [],
      cleanLocalChanges: [],
      conflicts,
      unchangedFieldIds: [],
      convergentFieldIds: [],
    });

    mockApplyLastWriteWins.mockResolvedValueOnce({
      updatedCanonical: { f1: { type: 'text', value: 'Remote' } },
      updatedSyncMetadata: {
        platform_record_id: 'recABC',
        last_synced_at: '2026-01-15T11:00:00.000Z',
        last_synced_values: { f1: { value: { type: 'text', value: 'Remote' }, synced_at: '2026-01-15T11:00:00.000Z' } },
        sync_status: 'active',
        sync_direction: 'inbound',
        orphaned_at: null,
        orphaned_reason: null,
      },
      resolvedCount: 1,
    });

    await processor.processJob(createMockJob(), mockLogger as never);

    // Default mode is last_write_wins — should call applyLastWriteWins
    expect(mockApplyLastWriteWins).toHaveBeenCalledWith(
      expect.anything(), // tx
      'tenant-1',
      'rec-1',
      conflicts,
      'airtable',
      expect.any(Object), // mergedCanonical
      expect.any(Object), // updatedMeta
      'recABC',
      ['f1'],
    );
    // writeConflictRecords should NOT be called in LWW mode
    expect(mockWriteConflictRecords).not.toHaveBeenCalled();
  });

  it('preserves clean local changes without action', async () => {
    const connection = setupConnectionQuery();

    setupChainedSelectMock([
      [connection],
      [{ fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} }],
      [{ id: 'rec-1', tenantId: 'tenant-1', canonicalData: { f1: 'local-edit' }, syncMetadata: { platform_record_id: 'recABC', last_synced_values: { f1: { value: 'base', synced_at: '2026-01-15T10:00:00.000Z' } } } }],
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recABC', fields: { fld1: 'base' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: 'base' });

    mockDetectConflicts.mockReturnValueOnce({
      cleanRemoteChanges: [],
      cleanLocalChanges: [{ fieldId: 'f1', value: 'local-edit' }],
      conflicts: [],
      unchangedFieldIds: [],
      convergentFieldIds: [],
    });

    await processor.processJob(createMockJob(), mockLogger as never);

    // No transaction needed — nothing to write
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('handles mixed conflicts and clean changes in one record', async () => {
    const connection = setupConnectionQuery();

    setupChainedSelectMock([
      [connection],
      [
        { fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} },
        { fieldId: 'f2', externalFieldId: 'fld2', externalFieldType: 'number', fieldType: 'number', config: {} },
      ],
      [{ id: 'rec-1', tenantId: 'tenant-1', canonicalData: { f1: 'local', f2: 'base2' }, syncMetadata: { platform_record_id: 'recABC', last_synced_values: {} } }],
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recABC', fields: { fld1: 'Remote', fld2: 'Remote2' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: 'remote1', f2: 'remote2' });

    mockDetectConflicts.mockReturnValueOnce({
      cleanRemoteChanges: [{ fieldId: 'f2', value: 'remote2' }],
      cleanLocalChanges: [],
      conflicts: [{ fieldId: 'f1', localValue: 'local', remoteValue: 'remote1', baseValue: 'base1' }],
      unchangedFieldIds: [],
      convergentFieldIds: [],
    });

    mockApplyLastWriteWins.mockResolvedValueOnce({
      updatedCanonical: { f1: 'remote1', f2: 'remote2' },
      updatedSyncMetadata: {
        platform_record_id: 'recABC',
        last_synced_at: '2026-01-15T11:00:00.000Z',
        last_synced_values: {},
        sync_status: 'active',
        sync_direction: 'inbound',
        orphaned_at: null,
        orphaned_reason: null,
      },
      resolvedCount: 1,
    });

    await processor.processJob(createMockJob(), mockLogger as never);

    // Transaction should run with both updates and LWW conflict resolution
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockApplyLastWriteWins).toHaveBeenCalled();
  });

  it('emits sync.conflict_detected events after writeConflictRecords in manual mode', async () => {
    const connection = {
      ...setupConnectionQuery(),
      conflictResolution: 'manual',
    };

    setupChainedSelectMock([
      [connection],
      [{ fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} }],
      [{ id: 'rec-1', tenantId: 'tenant-1', canonicalData: { f1: 'local' }, syncMetadata: { platform_record_id: 'recABC', last_synced_values: { f1: { value: 'base', synced_at: '2026-01-15T10:00:00.000Z' } } } }],
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recABC', fields: { fld1: 'Remote' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: { type: 'text', value: 'Remote' } });

    const conflicts = [{
      fieldId: 'f1',
      localValue: 'local',
      remoteValue: { type: 'text', value: 'Remote' },
      baseValue: 'base',
    }];

    mockDetectConflicts.mockReturnValueOnce({
      cleanRemoteChanges: [],
      cleanLocalChanges: [],
      conflicts,
      unchangedFieldIds: [],
      convergentFieldIds: [],
    });

    const writtenConflicts = [
      { id: 'conflict-uuid-1', fieldId: 'f1', localValue: 'local', remoteValue: { type: 'text', value: 'Remote' } },
    ];
    mockWriteConflictRecords.mockResolvedValueOnce(writtenConflicts);

    await processor.processJob(createMockJob(), mockLogger as never);

    // writeConflictRecords called in manual mode
    expect(mockWriteConflictRecords).toHaveBeenCalled();

    // Event emitted for each written conflict
    expect(mockPublish).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      channel: 'table:es-table-1',
      event: 'sync.conflict_detected',
      payload: {
        type: 'sync.conflict_detected',
        recordId: 'rec-1',
        fieldId: 'f1',
        conflictId: 'conflict-uuid-1',
        localValue: 'local',
        remoteValue: { type: 'text', value: 'Remote' },
        platform: 'airtable',
      },
    });
  });

  it('does not emit conflict events in last_write_wins mode', async () => {
    const connection = setupConnectionQuery(); // default: no conflictResolution → 'last_write_wins'

    setupChainedSelectMock([
      [connection],
      [{ fieldId: 'f1', externalFieldId: 'fld1', externalFieldType: 'singleLineText', fieldType: 'text', config: {} }],
      [{ id: 'rec-1', tenantId: 'tenant-1', canonicalData: { f1: 'local' }, syncMetadata: { platform_record_id: 'recABC', last_synced_values: { f1: { value: 'base', synced_at: '2026-01-15T10:00:00.000Z' } } } }],
    ]);

    mockListRecords.mockResolvedValueOnce({
      records: [{ id: 'recABC', fields: { fld1: 'Remote' } }],
      offset: undefined,
    });

    mockToCanonical.mockReturnValueOnce({ f1: { type: 'text', value: 'Remote' } });

    mockDetectConflicts.mockReturnValueOnce({
      cleanRemoteChanges: [],
      cleanLocalChanges: [],
      conflicts: [{ fieldId: 'f1', localValue: 'local', remoteValue: 'remote', baseValue: 'base' }],
      unchangedFieldIds: [],
      convergentFieldIds: [],
    });

    await processor.processJob(createMockJob(), mockLogger as never);

    // LWW mode — no conflict events emitted
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
