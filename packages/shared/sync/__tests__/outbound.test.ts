import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockUpdate,
  mockDb,
  mockWaitForCapacity,
  mockUpdateRecord,
  mockDecryptTokens,
} = vi.hoisted(() => {
  const mockLimitResult = vi.fn();
  const mockLimit = vi.fn().mockReturnValue(mockLimitResult);
  const mockInnerJoin = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) });
  const mockFrom = vi.fn().mockReturnValue({
    innerJoin: mockInnerJoin,
    where: vi.fn().mockReturnValue({ limit: mockLimit }),
  });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  const mockSetWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockSetWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return {
    mockSelect,
    mockUpdate,
    mockDb: { select: mockSelect, update: mockUpdate },
    mockLimitResult,
    mockLimit,
    mockInnerJoin,
    mockFrom,
    mockWaitForCapacity: vi.fn().mockResolvedValue(undefined),
    mockUpdateRecord: vi.fn().mockResolvedValue({
      id: 'recABC',
      fields: { fldName: 'Updated' },
      createdTime: '2026-01-01T00:00:00.000Z',
    }),
    mockDecryptTokens: vi.fn().mockReturnValue({
      access_token: 'atok_test',
      refresh_token: 'rtok_test',
    }),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  records: {
    id: 'id', tenantId: 'tenant_id',
    canonicalData: 'canonical_data', syncMetadata: 'sync_metadata',
  },
  fields: { id: 'id', fieldType: 'field_type', config: 'config' },
  syncedFieldMappings: {
    id: 'id', fieldId: 'field_id', externalFieldId: 'external_field_id',
    externalFieldType: 'external_field_type', tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id', tableId: 'table_id', status: 'status',
  },
  baseConnections: {
    id: 'id', tenantId: 'tenant_id', platform: 'platform',
    externalBaseId: 'external_base_id', oauthTokens: 'oauth_tokens',
    syncConfig: 'sync_config', syncDirection: 'sync_direction',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@everystack/shared/crypto', () => ({
  decryptTokens: mockDecryptTokens,
}));

vi.mock('@everystack/shared/logging', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
  })),
}));

vi.mock('../rate-limiter', () => ({
  rateLimiter: { waitForCapacity: mockWaitForCapacity },
}));

vi.mock('../adapters/airtable/api-client', () => ({
  AirtableApiClient: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.updateRecord = mockUpdateRecord;
  }),
}));

vi.mock('../adapters/airtable', () => ({
  AirtableAdapter: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
    this.platform = 'airtable';
    this.fromCanonical = vi.fn((canonical: Record<string, unknown>, mappings: Array<{ externalFieldId: string; fieldId: string }>) => {
      const result: Record<string, unknown> = {};
      for (const m of mappings) {
        if (canonical[m.fieldId] !== undefined) {
          result[m.externalFieldId] = (canonical[m.fieldId] as Record<string, unknown>).value ?? canonical[m.fieldId];
        }
      }
      return result;
    });
  }),
}));

vi.mock('../field-registry', () => ({
  fieldTypeRegistry: {
    has: vi.fn().mockReturnValue(true),
    get: vi.fn().mockReturnValue({
      toCanonical: vi.fn(),
      fromCanonical: vi.fn(),
      isLossless: true,
      supportedOperations: ['read', 'write', 'filter', 'sort'],
    }),
  },
}));

vi.mock('../sync-metadata', () => ({
  updateLastSyncedValues: vi.fn((existing: Record<string, unknown>, _fieldIds: string[], _data: Record<string, unknown>) => ({
    ...existing,
    last_synced_at: new Date().toISOString(),
  })),
}));

import { executeOutboundSync } from '../outbound';
import { fieldTypeRegistry } from '../field-registry';
import type { OutboundSyncJob } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides?: Partial<OutboundSyncJob>): OutboundSyncJob {
  return {
    tenantId: 'tenant-1',
    recordId: 'record-1',
    tableId: 'table-1',
    baseConnectionId: 'conn-1',
    changedFieldIds: ['field-1'],
    editedBy: 'user-1',
    priority: 10,
    traceId: 'trace-1',
    ...overrides,
  };
}

/** Configure mocks for a successful outbound sync scenario. */
function setupSuccessScenario() {
  // Call 1: record query
  // Call 2: base_connection query
  // Call 3: field mappings query
  let callCount = 0;

  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Record
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'record-1',
              canonicalData: {
                'field-1': { type: 'text', value: 'Updated Name' },
                'field-2': { type: 'number', value: 42 },
              },
              syncMetadata: {
                platform_record_id: 'recABC',
                last_synced_at: '2026-01-15T10:00:00.000Z',
                last_synced_values: {
                  'field-1': { value: { type: 'text', value: 'Old Name' }, synced_at: '2026-01-15T10:00:00.000Z' },
                },
                sync_status: 'active',
                sync_direction: 'both',
                orphaned_at: null,
                orphaned_reason: null,
              },
            }]),
          }),
          innerJoin: undefined,
        };
      }
      if (callCount === 2) {
        // Base connection
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              platform: 'airtable',
              externalBaseId: 'appBase1',
              oauthTokens: { encrypted: true },
              syncConfig: {
                polling_interval_seconds: 300,
                tables: [{
                  external_table_id: 'tblExternal1',
                  external_table_name: 'Contacts',
                  enabled: true,
                  sync_filter: null,
                  estimated_record_count: 100,
                  synced_record_count: 50,
                  es_table_id: 'table-1',
                }],
              },
              syncDirection: 'bidirectional',
            }]),
          }),
          innerJoin: undefined,
        };
      }
      // Field mappings (call 3) — uses innerJoin
      return {
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            fieldId: 'field-1',
            externalFieldId: 'fldName',
            externalFieldType: 'singleLineText',
            fieldType: 'text',
            config: {},
          }]),
        }),
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      };
    }),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('executeOutboundSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully pushes a record update to the platform', async () => {
    setupSuccessScenario();

    const result = await executeOutboundSync(makeJob());

    expect(result.success).toBe(true);
    expect(result.platformRecordId).toBe('recABC');
    expect(result.syncedFieldIds).toContain('field-1');
    expect(mockUpdateRecord).toHaveBeenCalledOnce();
  }, 10_000);

  it('returns failure when record is not found', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await executeOutboundSync(makeJob());

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  }, 10_000);

  it('returns failure when record has no sync metadata', async () => {
    mockSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{
            id: 'record-1',
            canonicalData: { 'field-1': { type: 'text', value: 'val' } },
            syncMetadata: null,
          }]),
        }),
      }),
    });

    const result = await executeOutboundSync(makeJob());

    expect(result.success).toBe(false);
    expect(result.error).toContain('sync metadata');
  }, 10_000);

  it('skips computed fields (lookup, rollup, formula, count)', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 'record-1',
                canonicalData: {
                  'field-computed': { type: 'text', value: 'computed val' },
                },
                syncMetadata: {
                  platform_record_id: 'recABC',
                  last_synced_at: '2026-01-15T10:00:00.000Z',
                  last_synced_values: {},
                  sync_status: 'active',
                  sync_direction: 'both',
                  orphaned_at: null,
                  orphaned_reason: null,
                },
              }]),
            }),
          };
        }
        if (callCount === 2) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                platform: 'airtable',
                externalBaseId: 'appBase1',
                oauthTokens: { encrypted: true },
                syncConfig: {
                  polling_interval_seconds: 300,
                  tables: [{ external_table_id: 'tbl1', external_table_name: 'T', enabled: true, sync_filter: null, estimated_record_count: 0, synced_record_count: 0, es_table_id: 'table-1' }],
                },
                syncDirection: 'bidirectional',
              }]),
            }),
          };
        }
        return {
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              fieldId: 'field-computed',
              externalFieldId: 'fldLookup',
              externalFieldType: 'lookup',
              fieldType: 'lookup',
              config: {},
            }]),
          }),
        };
      }),
    }));

    const result = await executeOutboundSync(
      makeJob({ changedFieldIds: ['field-computed'] }),
    );

    // Should succeed but with no fields synced
    expect(result.success).toBe(true);
    expect(result.syncedFieldIds).toHaveLength(0);
    expect(result.skippedFieldIds).toContain('field-computed');
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  }, 10_000);

  it('skips lossy (non-lossless) transforms', async () => {
    vi.mocked(fieldTypeRegistry.get).mockReturnValue({
      toCanonical: vi.fn(),
      fromCanonical: vi.fn(),
      isLossless: false,
      supportedOperations: ['read', 'write'],
    });

    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 'record-1',
                canonicalData: { 'field-1': { type: 'text', value: 'val' } },
                syncMetadata: {
                  platform_record_id: 'recABC',
                  last_synced_at: '2026-01-15T10:00:00.000Z',
                  last_synced_values: {},
                  sync_status: 'active',
                  sync_direction: 'both',
                  orphaned_at: null,
                  orphaned_reason: null,
                },
              }]),
            }),
          };
        }
        if (callCount === 2) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                platform: 'airtable',
                externalBaseId: 'appBase1',
                oauthTokens: { encrypted: true },
                syncConfig: {
                  polling_interval_seconds: 300,
                  tables: [{ external_table_id: 'tbl1', external_table_name: 'T', enabled: true, sync_filter: null, estimated_record_count: 0, synced_record_count: 0, es_table_id: 'table-1' }],
                },
                syncDirection: 'bidirectional',
              }]),
            }),
          };
        }
        return {
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{
              fieldId: 'field-1',
              externalFieldId: 'fldFormula',
              externalFieldType: 'formula',
              fieldType: 'text',
              config: {},
            }]),
          }),
        };
      }),
    }));

    const result = await executeOutboundSync(makeJob());

    expect(result.success).toBe(true);
    expect(result.syncedFieldIds).toHaveLength(0);
    expect(result.skippedFieldIds).toContain('field-1');
    expect(mockUpdateRecord).not.toHaveBeenCalled();

    // Restore
    vi.mocked(fieldTypeRegistry.get).mockReturnValue({
      toCanonical: vi.fn(),
      fromCanonical: vi.fn(),
      isLossless: true,
      supportedOperations: ['read', 'write', 'filter', 'sort'],
    });
  }, 10_000);

  it('returns error details when platform API call fails', async () => {
    setupSuccessScenario();

    const apiError = new Error('Airtable API request failed: 422');
    (apiError as Error & { statusCode: number }).statusCode = 422;
    mockUpdateRecord.mockRejectedValueOnce(apiError);

    const result = await executeOutboundSync(makeJob());

    expect(result.success).toBe(false);
    expect(result.error).toContain('422');
    expect(result.statusCode).toBe(422);
  }, 10_000);

  it('rejects inbound-only connections', async () => {
    let callCount = 0;
    mockSelect.mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 'record-1',
                canonicalData: { 'field-1': { type: 'text', value: 'val' } },
                syncMetadata: {
                  platform_record_id: 'recABC',
                  last_synced_at: '2026-01-15T10:00:00.000Z',
                  last_synced_values: {},
                  sync_status: 'active',
                  sync_direction: 'both',
                  orphaned_at: null,
                  orphaned_reason: null,
                },
              }]),
            }),
          };
        }
        return {
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              platform: 'airtable',
              externalBaseId: 'appBase1',
              oauthTokens: { encrypted: true },
              syncConfig: { tables: [] },
              syncDirection: 'inbound_only',
            }]),
          }),
        };
      }),
    }));

    const result = await executeOutboundSync(makeJob());

    expect(result.success).toBe(false);
    expect(result.error).toContain('inbound_only');
    expect(mockUpdateRecord).not.toHaveBeenCalled();
  }, 10_000);

  it('updates sync_metadata.last_synced_values on success', async () => {
    setupSuccessScenario();

    await executeOutboundSync(makeJob());

    // The update mock should have been called to persist sync metadata
    expect(mockUpdate).toHaveBeenCalled();
  }, 10_000);
});
