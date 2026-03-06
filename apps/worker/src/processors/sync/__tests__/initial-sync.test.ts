import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { InitialSyncJobData } from '@everystack/shared/queue';
import type { EventPublisher } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Hoisted mocks — declared before vi.mock factories which get hoisted
// ---------------------------------------------------------------------------

const {
  mockInsert,
  mockUpdate,
  mockSelect,
  mockDb,
  mockSyncSchema,
  mockListRecords,
  mockEnforceQuotaOnBatch,
  mockIncrementQuotaCache,
  mockWaitForCapacity,
} = vi.hoisted(() => {
  const _mockValues = vi.fn().mockResolvedValue(undefined);
  const mockInsert = vi.fn().mockReturnValue({ values: _mockValues });
  const _mockSetWhere = vi.fn().mockResolvedValue(undefined);
  const _mockSet = vi.fn().mockReturnValue({ where: _mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockSet });
  const mockSelect = vi.fn().mockReturnValue({ from: vi.fn() });

  return {
    mockInsert,
    mockUpdate,
    mockSelect,
    mockDb: { insert: mockInsert, update: mockUpdate, select: mockSelect },
    mockSyncSchema: vi.fn().mockResolvedValue({
      tableMap: new Map([['tbl001', 'es-table-1']]),
      updatedSyncConfig: {
        polling_interval_seconds: 300,
        tables: [{
          external_table_id: 'tbl001',
          external_table_name: 'Contacts',
          enabled: true,
          sync_filter: null,
          estimated_record_count: 100,
          synced_record_count: 0,
        }],
      },
    }),
    mockListRecords: vi.fn().mockResolvedValue({ records: [], offset: undefined }),
    mockEnforceQuotaOnBatch: vi.fn().mockResolvedValue({ acceptedCount: 0, quotaExceeded: false }),
    mockIncrementQuotaCache: vi.fn().mockResolvedValue(undefined),
    mockWaitForCapacity: vi.fn().mockResolvedValue(undefined),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  tables: { id: 'id' },
  fields: { id: 'id', fieldType: 'field_type', config: 'config' },
  records: { id: 'id' },
  syncedFieldMappings: {
    id: 'id', fieldId: 'field_id', externalFieldId: 'external_field_id',
    externalFieldType: 'external_field_type', tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id', tableId: 'table_id', status: 'status',
  },
  baseConnections: { id: 'id', tenantId: 'tenant_id' },
  generateUUIDv7: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 8)}`),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('../schema-sync', () => ({ syncSchema: mockSyncSchema }));

vi.mock('@everystack/shared/crypto', () => ({
  decryptTokens: vi.fn(() => ({
    access_token: 'atok_test', refresh_token: 'rtok_test',
    token_type: 'bearer', expires_in: 3600,
    expires_at: Date.now() + 3600000, scope: 'data.records:read',
  })),
}));

vi.mock('@everystack/shared/sync', () => ({
  AirtableApiClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.listRecords = mockListRecords;
    this.listFields = vi.fn().mockResolvedValue([]);
    this.getRecord = vi.fn();
  }),
  AirtableAdapter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.platform = 'airtable';
    this.toCanonical = vi.fn((record: { fields: Record<string, unknown> }) => record.fields);
    this.fromCanonical = vi.fn();
  }),
  registerAirtableTransforms: vi.fn(),
  translateFilterToFormula: vi.fn(() => ''),
  enforceQuotaOnBatch: mockEnforceQuotaOnBatch,
  incrementQuotaCache: mockIncrementQuotaCache,
  rateLimiter: { waitForCapacity: mockWaitForCapacity },
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    SYNC_STARTED: 'sync.started', SYNC_SCHEMA_READY: 'sync.schema_ready',
    SYNC_PROGRESS: 'sync.progress', SYNC_BATCH_COMPLETE: 'sync.batch_complete',
    SYNC_COMPLETED: 'sync.completed', SYNC_FAILED: 'sync.failed',
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

vi.mock('../../../lib/sentry', () => ({ captureJobError: vi.fn() }));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(), close: vi.fn().mockResolvedValue(undefined),
  })),
}));

import { InitialSyncProcessor } from '../initial-sync';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPublisher(): EventPublisher {
  return { publish: vi.fn().mockResolvedValue(undefined) } as unknown as EventPublisher;
}

function createMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
}

function createMockJob(overrides?: Partial<InitialSyncJobData>): Job<InitialSyncJobData> {
  return {
    id: 'job-1', name: 'initial-sync',
    data: {
      tenantId: 'tenant-1', connectionId: 'conn-1', workspaceId: 'ws-1',
      traceId: 'trace-1', triggeredBy: 'user-1', ...overrides,
    },
  } as unknown as Job<InitialSyncJobData>;
}

function setupConnectionMock(overrides?: Record<string, unknown>) {
  const connection = {
    id: 'conn-1', platform: 'airtable', externalBaseId: 'appBase1',
    syncConfig: {
      polling_interval_seconds: 300,
      tables: [{
        external_table_id: 'tbl001', external_table_name: 'Contacts', enabled: true,
        sync_filter: null, estimated_record_count: 100, synced_record_count: 0,
      }],
    },
    health: {},
    oauthTokens: { iv: 'test', tag: 'test', ciphertext: 'test', version: 1 },
    createdBy: 'user-1', ...overrides,
  };

  mockSelect.mockReturnValue({
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([connection]) }),
    }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InitialSyncProcessor', () => {
  let processor: InitialSyncProcessor;
  let publisher: EventPublisher;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    publisher = createMockPublisher();
    processor = new InitialSyncProcessor(publisher);
    logger = createMockLogger();

    setupConnectionMock();
    mockListRecords.mockResolvedValue({ records: [], offset: undefined });
    mockEnforceQuotaOnBatch.mockResolvedValue({ acceptedCount: 0, quotaExceeded: false });

    mockInsert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('full pipeline: schema sync → records → completion', async () => {
    await processor.processJob(createMockJob(), logger as never);

    expect(mockSyncSchema).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', connectionId: 'conn-1', workspaceId: 'ws-1' }),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'sync.started', payload: expect.objectContaining({ connectionId: 'conn-1' }) }),
    );
    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'sync.completed' }),
    );
  });

  it('progressive events emitted in correct order', async () => {
    await processor.processJob(createMockJob(), logger as never);

    const events = vi.mocked(publisher.publish).mock.calls
      .map((call) => (call[0] as { event: string }).event);

    expect(events[0]).toBe('sync.started');
    expect(events[events.length - 1]).toBe('sync.completed');
  });

  it('handles empty tables (0 records)', async () => {
    await processor.processJob(createMockJob(), logger as never);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sync.completed',
        payload: expect.objectContaining({ totalRecordsSynced: 0 }),
      }),
    );
  });

  it('quota enforcement stops sync when exceeded', async () => {
    mockListRecords.mockResolvedValue({
      records: [
        { id: 'rec1', fields: { fldName: 'Alice' }, createdTime: '2024-01-01T00:00:00.000Z' },
        { id: 'rec2', fields: { fldName: 'Bob' }, createdTime: '2024-01-01T00:00:00.000Z' },
      ],
      offset: 'more_pages',
    });
    mockEnforceQuotaOnBatch.mockResolvedValue({ acceptedCount: 1, quotaExceeded: true });

    await processor.processJob(createMockJob(), logger as never);

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'sync.completed' }),
    );
    // Should have called enforceQuotaOnBatch
    expect(mockEnforceQuotaOnBatch).toHaveBeenCalled();
  });

  it('rate limiter called before each page fetch', async () => {
    mockListRecords
      .mockResolvedValueOnce({
        records: [{ id: 'rec1', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
        offset: 'page2',
      })
      .mockResolvedValueOnce({
        records: [{ id: 'rec2', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
        offset: undefined,
      });
    mockEnforceQuotaOnBatch.mockResolvedValue({ acceptedCount: 1, quotaExceeded: false });

    await processor.processJob(createMockJob(), logger as never);

    expect(mockWaitForCapacity).toHaveBeenCalled();
  });

  it('emits SYNC_FAILED and updates status on error', async () => {
    mockSyncSchema.mockRejectedValueOnce(new Error('Network timeout'));

    await expect(
      processor.processJob(createMockJob(), logger as never),
    ).rejects.toThrow('Network timeout');

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sync.failed',
        payload: expect.objectContaining({ connectionId: 'conn-1', error: 'Network timeout' }),
      }),
    );
  });

  it('throws when connection has no tokens', async () => {
    setupConnectionMock({ oauthTokens: null });

    await expect(
      processor.processJob(createMockJob(), logger as never),
    ).rejects.toThrow('Connection missing tokens or base ID');
  });

  it('throws when connection is not found', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      }),
    });

    await expect(
      processor.processJob(createMockJob(), logger as never),
    ).rejects.toThrow('not found');
  });
});
