import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { OutboundSyncJobData } from '@everystack/shared/queue';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockExecuteOutboundSync,
  mockSelect,
  mockQueueAdd,
  mockQueueGetJob,
} = vi.hoisted(() => ({
  mockExecuteOutboundSync: vi.fn().mockResolvedValue({
    success: true,
    platformRecordId: 'recABC',
    syncedFieldIds: ['field-1'],
    skippedFieldIds: [],
  }),
  mockSelect: vi.fn(),
  mockDb: { select: vi.fn() },
  mockQueueAdd: vi.fn().mockResolvedValue({ id: 'job-id-1' }),
  mockQueueGetJob: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/sync', () => ({
  executeOutboundSync: mockExecuteOutboundSync,
  registerAirtableTransforms: vi.fn(),
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    select: mockSelect,
  })),
  syncedFieldMappings: {
    tenantId: 'tenant_id', tableId: 'table_id',
    baseConnectionId: 'base_connection_id', status: 'status',
  },
  baseConnections: {
    id: 'id', tenantId: 'tenant_id', syncDirection: 'sync_direction',
    syncStatus: 'sync_status', syncConfig: 'sync_config',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
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
  QUEUE_NAMES: { 'sync:outbound': 'sync:outbound' },
}));

vi.mock('bullmq', () => {
  const MockQueue = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.add = mockQueueAdd;
    this.getJob = mockQueueGetJob;
  });
  const MockWorker = vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.on = vi.fn();
    this.close = vi.fn().mockResolvedValue(undefined);
  });
  return { Queue: MockQueue, Worker: MockWorker };
});

vi.mock('../../../../lib/sentry', () => ({ captureJobError: vi.fn() }));

import type { Logger } from '@everystack/shared/logging';
import { OutboundSyncProcessor, enqueueOutboundSync, calculateBackoff, setOutboundQueue } from '../sync-outbound';
import { Queue } from 'bullmq';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() };
}

function createMockJob(overrides?: Partial<OutboundSyncJobData>): Job<OutboundSyncJobData> {
  return {
    id: 'job-1',
    name: 'outbound-sync',
    data: {
      tenantId: 'tenant-1',
      recordId: 'record-1',
      tableId: 'table-1',
      baseConnectionId: 'conn-1',
      changedFieldIds: ['field-1'],
      editedBy: 'user-1',
      priority: 10,
      traceId: 'trace-1',
      triggeredBy: 'user-1',
      ...overrides,
    },
  } as unknown as Job<OutboundSyncJobData>;
}

function setupEnqueueMocks(opts?: { isSynced?: boolean; syncDirection?: string; syncStatus?: string }) {
  const isSynced = opts?.isSynced ?? true;
  const syncDirection = opts?.syncDirection ?? 'bidirectional';
  const syncStatus = opts?.syncStatus ?? 'active';

  let callCount = 0;
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // synced_field_mappings lookup
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(
              isSynced ? [{ baseConnectionId: 'conn-1' }] : [],
            ),
          }),
        };
      }
      // base_connections lookup
      return {
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            syncDirection,
            syncStatus,
            syncConfig: {
              polling_interval_seconds: 300,
              tables: [{
                external_table_id: 'tbl1',
                external_table_name: 'Contacts',
                enabled: true,
                sync_filter: null,
                estimated_record_count: 100,
                synced_record_count: 50,
                es_table_id: 'table-1',
              }],
            },
          }]),
        }),
      };
    }),
  }));
}

// ---------------------------------------------------------------------------
// OutboundSyncProcessor
// ---------------------------------------------------------------------------

describe('OutboundSyncProcessor', () => {
  let processor: OutboundSyncProcessor;

  beforeEach(() => {
    vi.clearAllMocks();
    processor = new OutboundSyncProcessor();
  });

  it('calls executeOutboundSync with correct job data', async () => {
    const job = createMockJob();
    const logger = createMockLogger();

    await processor.processJob(job, logger as unknown as Logger);

    expect(mockExecuteOutboundSync).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        recordId: 'record-1',
        tableId: 'table-1',
        baseConnectionId: 'conn-1',
        changedFieldIds: ['field-1'],
        editedBy: 'user-1',
      }),
    );
  }, 10_000);

  it('throws when executeOutboundSync returns failure', async () => {
    mockExecuteOutboundSync.mockResolvedValueOnce({
      success: false,
      platformRecordId: 'recABC',
      syncedFieldIds: [],
      skippedFieldIds: ['field-1'],
      error: 'Airtable API request failed: 500',
    });

    const job = createMockJob();
    const logger = createMockLogger();

    await expect(
      processor.processJob(job, logger as unknown as Logger),
    ).rejects.toThrow('Airtable API request failed: 500');
  }, 10_000);

  it('succeeds when executeOutboundSync returns success', async () => {
    const job = createMockJob();
    const logger = createMockLogger();

    await expect(
      processor.processJob(job, logger as unknown as Logger),
    ).resolves.toBeUndefined();
  }, 10_000);
});

// ---------------------------------------------------------------------------
// enqueueOutboundSync
// ---------------------------------------------------------------------------

describe('enqueueOutboundSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the queue singleton to a fresh mock
    setOutboundQueue(new Queue('sync:outbound') as unknown as Queue<OutboundSyncJobData>);
  });

  it('enqueues a job for a synced table', async () => {
    setupEnqueueMocks();

    const result = await enqueueOutboundSync('tenant-1', 'record-1', 'table-1', ['field-1'], 'user-1');

    expect(result.enqueued).toBe(true);
    expect(mockQueueAdd).toHaveBeenCalledOnce();
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'outbound-sync',
      expect.objectContaining({
        tenantId: 'tenant-1',
        recordId: 'record-1',
        tableId: 'table-1',
        changedFieldIds: ['field-1'],
      }),
      expect.any(Object),
    );
  }, 10_000);

  it('returns no-op for a non-synced (native) table', async () => {
    setupEnqueueMocks({ isSynced: false });

    const result = await enqueueOutboundSync('tenant-1', 'record-1', 'table-1', ['field-1'], 'user-1');

    expect(result.enqueued).toBe(false);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  }, 10_000);

  it('returns no-op for inbound-only connections', async () => {
    setupEnqueueMocks({ syncDirection: 'inbound_only' });

    const result = await enqueueOutboundSync('tenant-1', 'record-1', 'table-1', ['field-1'], 'user-1');

    expect(result.enqueued).toBe(false);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  }, 10_000);

  it('returns no-op for paused connections', async () => {
    setupEnqueueMocks({ syncStatus: 'paused' });

    const result = await enqueueOutboundSync('tenant-1', 'record-1', 'table-1', ['field-1'], 'user-1');

    expect(result.enqueued).toBe(false);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  }, 10_000);

  it('deduplicates by merging changedFieldIds for the same record', async () => {
    setupEnqueueMocks();

    const mockExistingJob = {
      data: {
        tenantId: 'tenant-1',
        recordId: 'record-1',
        tableId: 'table-1',
        baseConnectionId: 'conn-1',
        changedFieldIds: ['field-1'],
        editedBy: 'user-1',
        priority: 10,
        traceId: 'trace-existing',
        triggeredBy: 'user-1',
      },
      getState: vi.fn().mockResolvedValue('waiting'),
      updateData: vi.fn().mockResolvedValue(undefined),
    };
    mockQueueGetJob.mockResolvedValueOnce(mockExistingJob);

    const result = await enqueueOutboundSync('tenant-1', 'record-1', 'table-1', ['field-2', 'field-3'], 'user-1');

    expect(result.enqueued).toBe(true);
    expect(mockExistingJob.updateData).toHaveBeenCalledWith(
      expect.objectContaining({
        changedFieldIds: ['field-1', 'field-2', 'field-3'],
      }),
    );
    // Should NOT add a new job — just merge
    expect(mockQueueAdd).not.toHaveBeenCalled();
  }, 10_000);

  it('does not dedup if existing job is already active', async () => {
    setupEnqueueMocks();

    const mockExistingJob = {
      data: {
        tenantId: 'tenant-1',
        changedFieldIds: ['field-1'],
      },
      getState: vi.fn().mockResolvedValue('active'),
      updateData: vi.fn(),
    };
    mockQueueGetJob.mockResolvedValueOnce(mockExistingJob);

    const result = await enqueueOutboundSync('tenant-1', 'record-1', 'table-1', ['field-2'], 'user-1');

    expect(result.enqueued).toBe(true);
    expect(mockExistingJob.updateData).not.toHaveBeenCalled();
    expect(mockQueueAdd).toHaveBeenCalledOnce();
  }, 10_000);
});

// ---------------------------------------------------------------------------
// calculateBackoff
// ---------------------------------------------------------------------------

describe('calculateBackoff', () => {
  it('returns 1 minute for first attempt', () => {
    expect(calculateBackoff(1)).toBe(60_000);
  });

  it('returns 5 minutes for second attempt', () => {
    expect(calculateBackoff(2)).toBe(300_000);
  });

  it('returns 15 minutes for third attempt', () => {
    expect(calculateBackoff(3)).toBe(900_000);
  });

  it('caps at 15 minutes for higher attempts', () => {
    expect(calculateBackoff(4)).toBe(900_000);
    expect(calculateBackoff(10)).toBe(900_000);
  });
});
