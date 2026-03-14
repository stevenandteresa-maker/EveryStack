import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockLimit = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({
    select: mockSelect,
  })),
  crossLinkIndex: {
    tenantId: 'tenant_id',
    crossLinkId: 'cross_link_id',
    sourceRecordId: 'source_record_id',
    targetRecordId: 'target_record_id',
  },
  crossLinks: {
    id: 'id',
    tenantId: 'tenant_id',
    sourceFieldId: 'source_field_id',
  },
  records: {
    id: 'id',
    tenantId: 'tenant_id',
    canonicalData: 'canonical_data',
  },
  eq: vi.fn((a, b) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(vi.fn(), {
    join: vi.fn(),
  }),
  count: vi.fn(() => 'count_agg'),
}));

vi.mock('@everystack/shared/logging', () => ({
  workerLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@everystack/shared/sync', () => ({
  extractCrossLinkField: vi.fn(),
}));

import { scheduleIntegrityCheck } from '../integrity-check';
import { extractCrossLinkField } from '@everystack/shared/sync';

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('scheduleIntegrityCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns early when cross-link definition not found', async () => {
    mockWhere.mockResolvedValue([]);
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await scheduleIntegrityCheck('tenant-1', 'cl-missing', undefined, mockLogger);

    expect(result.rebuildTriggered).toBe(false);
    expect(result.totalEntries).toBe(0);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ crossLinkId: 'cl-missing' }),
      expect.stringContaining('not found'),
    );
  });

  it('returns early when no index entries exist', async () => {
    let callCount = 0;
    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Definition lookup
        return Promise.resolve([{ id: 'cl-1', sourceFieldId: 'f-1' }]);
      }
      // Count query
      return Promise.resolve([{ total: 0 }]);
    });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    const result = await scheduleIntegrityCheck('tenant-1', 'cl-1', undefined, mockLogger);

    expect(result.totalEntries).toBe(0);
    expect(result.rebuildTriggered).toBe(false);
  });

  it('detects >1% drift and triggers rebuild', async () => {
    const sourceFieldId = 'f-src-1';
    const mockRebuild = vi.fn().mockResolvedValue(undefined);

    // We need to handle different query sequences
    let callCount = 0;
    mockLimit.mockResolvedValue([
      { sourceRecordId: 'rec-1', targetRecordId: 'target-1' },
      { sourceRecordId: 'rec-2', targetRecordId: 'target-2' },
      { sourceRecordId: 'rec-3', targetRecordId: 'target-3' },
      { sourceRecordId: 'rec-4', targetRecordId: 'target-4' },
      { sourceRecordId: 'rec-5', targetRecordId: 'target-5' },
      { sourceRecordId: 'rec-6', targetRecordId: 'target-6' },
      { sourceRecordId: 'rec-7', targetRecordId: 'target-7' },
      { sourceRecordId: 'rec-8', targetRecordId: 'target-8' },
      { sourceRecordId: 'rec-9', targetRecordId: 'target-9' },
      { sourceRecordId: 'rec-10', targetRecordId: 'target-10' },
    ]);
    mockOrderBy.mockReturnValue({ limit: mockLimit });

    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Definition lookup
        return Promise.resolve([{ id: 'cl-1', sourceFieldId }]);
      }
      if (callCount === 2) {
        // Count query
        return Promise.resolve([{ total: 50 }]);
      }
      if (callCount === 3) {
        // Sample query — returns via orderBy chain
        return { orderBy: mockOrderBy };
      }
      // Record lookups for each sampled entry
      // Records 1-8 exist with matching canonical data
      // Records 9-10 don't exist (drift)
      // We return empty for drift records, otherwise return a record
      if (callCount <= 13) {
        const recIndex = callCount - 4; // 0-based index into sampled entries
        if (recIndex >= 8) {
          return Promise.resolve([]); // Drift: record not found
        }
        return Promise.resolve([{
          canonicalData: {
            [sourceFieldId]: 'has-field',
          },
        }]);
      }
      return Promise.resolve([]);
    });

    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    // For records that exist, extractCrossLinkField should verify the target
    vi.mocked(extractCrossLinkField).mockImplementation((_canonical, _fieldId) => {
      return {
        type: 'cross_link',
        value: {
          cross_link_id: 'cl-1',
          linked_records: [
            // Include the matching target so these don't count as drift
            { record_id: 'target-1', table_id: 't', display_value: 'A', _display_updated_at: '' },
            { record_id: 'target-2', table_id: 't', display_value: 'B', _display_updated_at: '' },
            { record_id: 'target-3', table_id: 't', display_value: 'C', _display_updated_at: '' },
            { record_id: 'target-4', table_id: 't', display_value: 'D', _display_updated_at: '' },
            { record_id: 'target-5', table_id: 't', display_value: 'E', _display_updated_at: '' },
            { record_id: 'target-6', table_id: 't', display_value: 'F', _display_updated_at: '' },
            { record_id: 'target-7', table_id: 't', display_value: 'G', _display_updated_at: '' },
            { record_id: 'target-8', table_id: 't', display_value: 'H', _display_updated_at: '' },
          ],
        },
      };
    });

    const result = await scheduleIntegrityCheck('tenant-1', 'cl-1', mockRebuild, mockLogger);

    // 2 out of 10 drifted = 20% > 1% threshold
    expect(result.driftCount).toBe(2);
    expect(result.driftPercent).toBeGreaterThan(0.01);
    expect(result.rebuildTriggered).toBe(true);

    // Should enqueue rebuild
    expect(mockRebuild).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        crossLinkId: 'cl-1',
        triggeredBy: 'integrity-check',
      }),
    );

    // Should log error alert
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ crossLinkId: 'cl-1' }),
      expect.stringContaining('drift exceeds threshold'),
    );
  });

  it('passes check when drift is within threshold', async () => {
    const sourceFieldId = 'f-src-1';

    let callCount = 0;
    // Only 5 sampled entries, all matching
    mockLimit.mockResolvedValue([
      { sourceRecordId: 'rec-1', targetRecordId: 'target-1' },
      { sourceRecordId: 'rec-2', targetRecordId: 'target-2' },
      { sourceRecordId: 'rec-3', targetRecordId: 'target-3' },
      { sourceRecordId: 'rec-4', targetRecordId: 'target-4' },
      { sourceRecordId: 'rec-5', targetRecordId: 'target-5' },
    ]);
    mockOrderBy.mockReturnValue({ limit: mockLimit });

    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{ id: 'cl-1', sourceFieldId }]);
      }
      if (callCount === 2) {
        return Promise.resolve([{ total: 20 }]);
      }
      if (callCount === 3) {
        return { orderBy: mockOrderBy };
      }
      // All records exist and match
      return Promise.resolve([{
        canonicalData: { [sourceFieldId]: 'data' },
      }]);
    });

    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    vi.mocked(extractCrossLinkField).mockImplementation(() => ({
      type: 'cross_link',
      value: {
        cross_link_id: 'cl-1',
        linked_records: [
          { record_id: 'target-1', table_id: 't', display_value: 'A', _display_updated_at: '' },
          { record_id: 'target-2', table_id: 't', display_value: 'B', _display_updated_at: '' },
          { record_id: 'target-3', table_id: 't', display_value: 'C', _display_updated_at: '' },
          { record_id: 'target-4', table_id: 't', display_value: 'D', _display_updated_at: '' },
          { record_id: 'target-5', table_id: 't', display_value: 'E', _display_updated_at: '' },
        ],
      },
    }));

    const result = await scheduleIntegrityCheck('tenant-1', 'cl-1', undefined, mockLogger);

    expect(result.driftCount).toBe(0);
    expect(result.rebuildTriggered).toBe(false);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ crossLinkId: 'cl-1' }),
      expect.stringContaining('passed'),
    );
  });

  it('samples 100 entries for small tables (<1,000)', async () => {
    let callCount = 0;
    const sampleEntries = Array.from({ length: 100 }, (_, i) => ({
      sourceRecordId: `rec-${i}`,
      targetRecordId: `target-${i}`,
    }));
    mockLimit.mockResolvedValue(sampleEntries);
    mockOrderBy.mockReturnValue({ limit: mockLimit });

    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve([{ id: 'cl-1', sourceFieldId: 'f-1' }]);
      }
      if (callCount === 2) {
        return Promise.resolve([{ total: 500 }]); // 500 entries = small table
      }
      if (callCount === 3) {
        return { orderBy: mockOrderBy };
      }
      return Promise.resolve([{
        canonicalData: { 'f-1': 'data' },
      }]);
    });

    mockFrom.mockReturnValue({ where: mockWhere });
    mockSelect.mockReturnValue({ from: mockFrom });

    vi.mocked(extractCrossLinkField).mockReturnValue({
      type: 'cross_link',
      value: {
        cross_link_id: 'cl-1',
        linked_records: sampleEntries.map((e) => ({
          record_id: e.targetRecordId,
          table_id: 't',
          display_value: 'x',
          _display_updated_at: '',
        })),
      },
    });

    const result = await scheduleIntegrityCheck('tenant-1', 'cl-1', undefined, mockLogger);

    // Should sample 100 entries for <1,000 table size
    expect(mockLimit).toHaveBeenCalledWith(100);
    expect(result.sampledEntries).toBe(100);
  });
});
