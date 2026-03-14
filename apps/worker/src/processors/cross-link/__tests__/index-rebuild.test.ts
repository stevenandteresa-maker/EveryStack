import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Job } from 'bullmq';
import type { CrossLinkIndexRebuildJobData } from '@everystack/shared/queue';
import type { Logger } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockInsert = vi.fn();
const mockValues = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    select: mockSelect,
    delete: mockDelete,
    insert: mockInsert,
  })),
  crossLinkIndex: {
    tenantId: 'tenant_id',
    crossLinkId: 'cross_link_id',
    sourceRecordId: 'source_record_id',
    sourceTableId: 'source_table_id',
    targetRecordId: 'target_record_id',
  },
  crossLinks: {
    id: 'id',
    tenantId: 'tenant_id',
    sourceTableId: 'source_table_id',
    sourceFieldId: 'source_field_id',
  },
  records: {
    id: 'id',
    tenantId: 'tenant_id',
    tableId: 'table_id',
    canonicalData: 'canonical_data',
  },
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(vi.fn(), {
    join: vi.fn(),
  }),
}));

vi.mock('@everystack/shared/sync', () => ({
  extractCrossLinkField: vi.fn(),
}));

import { processIndexRebuild } from '../index-rebuild';
import { extractCrossLinkField } from '@everystack/shared/sync';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

function createMockJob(
  overrides: Partial<CrossLinkIndexRebuildJobData> = {},
): Job<CrossLinkIndexRebuildJobData> {
  return {
    data: {
      tenantId: 'tenant-1',
      crossLinkId: 'cl-1',
      traceId: 'trace-1',
      triggeredBy: 'test',
      ...overrides,
    },
    id: 'job-1',
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as Job<CrossLinkIndexRebuildJobData>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processIndexRebuild', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips rebuild when cross-link definition not found', async () => {
    // Definition query returns empty
    mockWhere.mockResolvedValue([]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const job = createMockJob();
    await processIndexRebuild(job, mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ crossLinkId: 'cl-1' }),
      expect.stringContaining('not found'),
    );
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes existing index entries and rebuilds from canonical data', async () => {
    const sourceFieldId = 'field-src-1';
    const sourceTableId = 'table-src-1';

    // Track call sequence to return different results
    let selectCallCount = 0;
    mockWhere.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        // Definition query
        return Promise.resolve([{ id: 'cl-1', sourceTableId, sourceFieldId }]);
      }
      // Record batch query (returned via limit chain)
      return { orderBy: mockOrderBy };
    });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit
      .mockResolvedValueOnce([
        // First batch: 2 records
        {
          id: 'rec-1',
          canonicalData: { [sourceFieldId]: 'mock-data' },
        },
        {
          id: 'rec-2',
          canonicalData: { [sourceFieldId]: 'mock-data' },
        },
      ])
      .mockResolvedValueOnce([]); // Second batch: empty (end of records)

    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // Mock delete chain
    mockDeleteWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });

    // Mock insert chain
    mockValues.mockResolvedValue(undefined);
    mockInsert.mockReturnValue({ values: mockValues });

    // Mock extractCrossLinkField to return linked records
    vi.mocked(extractCrossLinkField)
      .mockReturnValueOnce({
        type: 'cross_link',
        value: {
          cross_link_id: 'cl-1',
          linked_records: [
            { record_id: 'target-1', table_id: 'table-t', display_value: 'A', _display_updated_at: '' },
            { record_id: 'target-2', table_id: 'table-t', display_value: 'B', _display_updated_at: '' },
          ],
        },
      })
      .mockReturnValueOnce({
        type: 'cross_link',
        value: {
          cross_link_id: 'cl-1',
          linked_records: [
            { record_id: 'target-3', table_id: 'table-t', display_value: 'C', _display_updated_at: '' },
          ],
        },
      });

    const job = createMockJob();
    await processIndexRebuild(job, mockLogger);

    // Should delete existing entries
    expect(mockDelete).toHaveBeenCalled();

    // Should insert 3 new index entries (2 from rec-1, 1 from rec-2)
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: 'tenant-1',
          crossLinkId: 'cl-1',
          sourceRecordId: 'rec-1',
          targetRecordId: 'target-1',
        }),
        expect.objectContaining({
          sourceRecordId: 'rec-1',
          targetRecordId: 'target-2',
        }),
        expect.objectContaining({
          sourceRecordId: 'rec-2',
          targetRecordId: 'target-3',
        }),
      ]),
    );

    // Should log completion
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        crossLinkId: 'cl-1',
        totalRecords: 2,
        totalEntries: 3,
      }),
      expect.stringContaining('rebuild complete'),
    );
  });

  it('handles records with no cross-link field gracefully', async () => {
    let selectCallCount = 0;
    mockWhere.mockImplementation(() => {
      selectCallCount++;
      if (selectCallCount === 1) {
        return Promise.resolve([{ id: 'cl-1', sourceTableId: 'tbl-1', sourceFieldId: 'f-1' }]);
      }
      return { orderBy: mockOrderBy };
    });
    mockOrderBy.mockReturnValue({ limit: mockLimit });
    mockLimit
      .mockResolvedValueOnce([
        { id: 'rec-1', canonicalData: {} },
      ])
      .mockResolvedValueOnce([]);

    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
    mockDeleteWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });

    // No cross-link field found
    vi.mocked(extractCrossLinkField).mockReturnValue(null);

    const job = createMockJob();
    await processIndexRebuild(job, mockLogger);

    // Should not insert any entries
    expect(mockInsert).not.toHaveBeenCalled();

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ totalEntries: 0 }),
      expect.stringContaining('rebuild complete'),
    );
  });
});
