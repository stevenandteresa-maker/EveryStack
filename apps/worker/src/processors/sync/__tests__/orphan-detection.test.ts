import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EventPublisher } from '@everystack/shared/realtime';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockUpdate,
  mockDb,
  mockWriteDb,
  mockListRecords,
  mockGetRecord,
  mockWaitForCapacity,
  mockDecrementQuotaCache,
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
    mockWriteDb: { update: mockUpdate },
    mockListRecords: vi.fn().mockResolvedValue({ records: [], offset: undefined }),
    mockGetRecord: vi.fn(),
    mockWaitForCapacity: vi.fn().mockResolvedValue(undefined),
    mockDecrementQuotaCache: vi.fn().mockResolvedValue(undefined),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn((_, mode?: string) => (mode === 'write' ? mockWriteDb : mockDb)),
  records: {
    id: 'id',
    tenantId: 'tenant_id',
    tableId: 'table_id',
    syncMetadata: 'sync_metadata',
    archivedAt: 'archived_at',
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
  rateLimiter: { waitForCapacity: mockWaitForCapacity },
  decrementQuotaCache: mockDecrementQuotaCache,
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    SYNC_RECORDS_ORPHANED: 'sync.records_orphaned',
  },
}));

import { detectAndProcessOrphans } from '../orphan-detection';
import type { OrphanDetectionParams } from '../orphan-detection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockPublisher(): EventPublisher {
  return { publish: vi.fn().mockResolvedValue(undefined) } as unknown as EventPublisher;
}

function createMockLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() };
}

function createMockApiClient() {
  return {
    listRecords: mockListRecords,
    getRecord: mockGetRecord,
    listFields: vi.fn(),
  };
}

function buildParams(overrides?: Partial<OrphanDetectionParams>): OrphanDetectionParams {
  return {
    tenantId: 'tenant-1',
    connectionId: 'conn-1',
    workspaceId: 'ws-1',
    esTableId: 'es-table-1',
    externalTableId: 'tbl001',
    apiClient: createMockApiClient() as never,
    eventPublisher: createMockPublisher(),
    logger: createMockLogger() as never,
    ...overrides,
  };
}

function setupLocalRecords(
  platformIds: string[],
): void {
  const records = platformIds.map((pid, i) => ({
    id: `es-rec-${i}`,
    platformRecordId: pid,
  }));

  const mockWhere = vi.fn().mockResolvedValue(records);
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  mockSelect.mockReturnValue({ from: mockFrom });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('detectAndProcessOrphans', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: no local records
    const mockWhere = vi.fn().mockResolvedValue([]);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    mockListRecords.mockResolvedValue({ records: [], offset: undefined });
    mockUpdate.mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
    });
  });

  it('returns zero counts when no local records exist', async () => {
    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    expect(result).toEqual({ orphanedCount: 0, deletedCount: 0 });
    expect(mockListRecords).not.toHaveBeenCalled();
  });

  it('returns zero counts when all local records match the inbound set', async () => {
    setupLocalRecords(['recA', 'recB']);
    mockListRecords.mockResolvedValue({
      records: [
        { id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' },
        { id: 'recB', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' },
      ],
      offset: undefined,
    });

    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    expect(result).toEqual({ orphanedCount: 0, deletedCount: 0 });
  });

  it('marks filter-orphaned records when getRecord succeeds (200)', async () => {
    setupLocalRecords(['recA', 'recB', 'recC']);

    // Inbound only has recA — recB and recC are orphan candidates
    mockListRecords.mockResolvedValue({
      records: [{ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
      offset: undefined,
    });

    // getRecord succeeds → record still exists on Airtable (filter-orphaned)
    mockGetRecord.mockResolvedValue({
      id: 'recB',
      fields: {},
      createdTime: '2024-01-01T00:00:00.000Z',
    });

    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    expect(result.orphanedCount).toBe(2);
    expect(result.deletedCount).toBe(0);
    expect(mockGetRecord).toHaveBeenCalledTimes(2);
  });

  it('soft-deletes platform-deleted records when getRecord returns 404', async () => {
    setupLocalRecords(['recA', 'recB']);

    mockListRecords.mockResolvedValue({
      records: [{ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
      offset: undefined,
    });

    // getRecord throws 404 → platform-deleted
    mockGetRecord.mockRejectedValue(new Error('Airtable API request failed: 404'));

    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    expect(result.orphanedCount).toBe(0);
    expect(result.deletedCount).toBe(1);
    expect(mockDecrementQuotaCache).toHaveBeenCalledWith('tenant-1', 1);
  });

  it('correctly identifies filter-orphaned vs platform-deleted in mixed batch', async () => {
    setupLocalRecords(['recA', 'recB', 'recC']);

    // Only recA in inbound set
    mockListRecords.mockResolvedValue({
      records: [{ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
      offset: undefined,
    });

    // recB exists (filter-orphaned), recC is 404 (platform-deleted)
    mockGetRecord
      .mockResolvedValueOnce({ id: 'recB', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' })
      .mockRejectedValueOnce(new Error('Airtable API request failed: 404'));

    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    expect(result.orphanedCount).toBe(1);
    expect(result.deletedCount).toBe(1);
  });

  it('rate-limits API calls during verification', async () => {
    setupLocalRecords(['recA', 'recB']);

    mockListRecords.mockResolvedValue({
      records: [],
      offset: undefined,
    });

    // Both are orphan candidates
    mockGetRecord.mockResolvedValue({ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' });

    const params = buildParams();
    await detectAndProcessOrphans(params);

    // At minimum, rate limiter should be called for the listRecords page
    expect(mockWaitForCapacity).toHaveBeenCalled();
  });

  it('emits SYNC_RECORDS_ORPHANED event when records are orphaned', async () => {
    setupLocalRecords(['recA', 'recB']);

    mockListRecords.mockResolvedValue({
      records: [{ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
      offset: undefined,
    });

    mockGetRecord.mockResolvedValue({ id: 'recB', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' });

    const params = buildParams();
    await detectAndProcessOrphans(params);

    expect((params.eventPublisher.publish as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'sync.records_orphaned',
        payload: expect.objectContaining({
          tableId: 'es-table-1',
          orphanedCount: 1,
          connectionId: 'conn-1',
        }),
      }),
    );
  });

  it('does not emit event when no records are orphaned', async () => {
    setupLocalRecords(['recA']);

    mockListRecords.mockResolvedValue({
      records: [{ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
      offset: undefined,
    });

    const params = buildParams();
    await detectAndProcessOrphans(params);

    expect((params.eventPublisher.publish as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('handles paginated inbound record fetching', async () => {
    setupLocalRecords(['recA', 'recB', 'recC']);

    // Two pages of inbound records
    mockListRecords
      .mockResolvedValueOnce({
        records: [{ id: 'recA', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
        offset: 'page2',
      })
      .mockResolvedValueOnce({
        records: [{ id: 'recB', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' }],
        offset: undefined,
      });

    // recC is orphan candidate, still exists
    mockGetRecord.mockResolvedValue({ id: 'recC', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' });

    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    expect(result.orphanedCount).toBe(1);
    expect(mockListRecords).toHaveBeenCalledTimes(2);
  });

  it('skips candidates that fail with non-404 errors', async () => {
    setupLocalRecords(['recA', 'recB']);

    mockListRecords.mockResolvedValue({
      records: [],
      offset: undefined,
    });

    // recA: non-404 error, recB: success
    mockGetRecord
      .mockRejectedValueOnce(new Error('Network timeout'))
      .mockResolvedValueOnce({ id: 'recB', fields: {}, createdTime: '2024-01-01T00:00:00.000Z' });

    const params = buildParams();
    const result = await detectAndProcessOrphans(params);

    // recA skipped, recB orphaned
    expect(result.orphanedCount).toBe(1);
    expect(result.deletedCount).toBe(0);
  });
});
