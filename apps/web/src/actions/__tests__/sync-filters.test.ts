import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetAuthContext,
  mockRequireRole,
  mockGetSyncConfig,
  mockUpdateSyncConfig,
  mockCanSyncRecords,
  mockQueueAdd,
  mockTranslateFilterToFormula,
  mockEstimateAirtableRecordCount,
  mockGetConnectionWithTokens,
  mockDecryptTokens,
  mockEncryptTokens,
  mockRefreshAirtableToken,
  mockUpdateConnectionTokens,
  mockDbSelect,
} = vi.hoisted(() => {
  return {
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      clerkUserId: 'clerk-1',
      agencyTenantId: null,
    }),
    mockRequireRole: vi.fn().mockResolvedValue(undefined),
    mockGetSyncConfig: vi.fn(),
    mockUpdateSyncConfig: vi.fn().mockResolvedValue(undefined),
    mockCanSyncRecords: vi.fn().mockResolvedValue({
      allowed: true,
      remaining: 5000,
      overageCount: 0,
    }),
    mockQueueAdd: vi.fn().mockResolvedValue({ id: 'job-123' }),
    mockTranslateFilterToFormula: vi.fn().mockReturnValue('{Status} = "Active"'),
    mockEstimateAirtableRecordCount: vi.fn().mockResolvedValue({
      count: 150,
      isExact: false,
    }),
    mockGetConnectionWithTokens: vi.fn().mockResolvedValue({
      oauthTokens: { encrypted: true },
    }),
    mockDecryptTokens: vi.fn().mockReturnValue({
      access_token: 'at-test',
      refresh_token: 'rt-test',
      expires_at: Date.now() + 3600000,
    }),
    mockEncryptTokens: vi.fn().mockReturnValue({ encrypted: true }),
    mockRefreshAirtableToken: vi.fn(),
    mockUpdateConnectionTokens: vi.fn().mockResolvedValue(undefined),
    mockDbSelect: vi.fn(),
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

vi.mock('@/data/sync-setup', () => ({
  getSyncConfig: mockGetSyncConfig,
  updateSyncConfig: mockUpdateSyncConfig,
}));

vi.mock('@everystack/shared/sync', async () => {
  const { z } = await import('zod');
  const FilterOperatorSchema = z.enum([
    'equals', 'not_equals', 'contains', 'not_contains', 'greater_than',
    'less_than', 'greater_equal', 'less_equal', 'is_empty', 'is_not_empty',
    'is_any_of', 'is_none_of', 'is_before', 'is_after', 'is_within',
  ]);
  const FilterRuleSchema = z.object({
    fieldId: z.string().min(1),
    operator: FilterOperatorSchema,
    value: z.unknown(),
    conjunction: z.enum(['and', 'or']),
  });
  const SyncConfigSchema = z.object({
    polling_interval_seconds: z.number().int().min(1).default(300),
    tables: z.array(z.any()),
  });
  return {
    canSyncRecords: mockCanSyncRecords,
    FilterRuleSchema,
    SyncConfigSchema,
    translateFilterToFormula: mockTranslateFilterToFormula,
    estimateAirtableRecordCount: mockEstimateAirtableRecordCount,
    refreshAirtableToken: mockRefreshAirtableToken,
  };
});

vi.mock('@everystack/shared/crypto', () => ({
  decryptTokens: mockDecryptTokens,
  encryptTokens: mockEncryptTokens,
}));

vi.mock('@/data/sync-connections', () => ({
  getConnectionWithTokens: mockGetConnectionWithTokens,
  updateConnectionTokens: mockUpdateConnectionTokens,
}));

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({ add: mockQueueAdd })),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => ({ select: mockDbSelect })),
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  syncedFieldMappings: {
    tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id',
    fieldId: 'field_id',
    externalFieldId: 'external_field_id',
  },
  fields: {
    id: 'id',
    name: 'name',
    tenantId: 'tenant_id',
  },
}));

import type { FilterRule } from '@everystack/shared/sync';
import {
  updateSyncFilter,
  enableSyncTable,
  disableSyncTable,
  estimateFilteredRecordCount,
} from '../sync-filters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CONN_ID = 'abcdef01-2345-4789-abcd-ef0123456789';
const TABLE_ID = 'ext-table-001';

function makeSyncConfig(overrides?: Partial<Record<string, unknown>>) {
  return {
    polling_interval_seconds: 300,
    tables: [
      {
        external_table_id: TABLE_ID,
        external_table_name: 'Contacts',
        enabled: true,
        sync_filter: [{ fieldId: 'f1', operator: 'equals', value: 'old', conjunction: 'and' }],
        estimated_record_count: 200,
        synced_record_count: 180,
        ...overrides,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Tests: updateSyncFilter
// ---------------------------------------------------------------------------

describe('updateSyncFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSyncConfig.mockResolvedValue(makeSyncConfig());
    mockCanSyncRecords.mockResolvedValue({ allowed: true, remaining: 5000, overageCount: 0 });
  });

  it('stores previous filter, saves new filter, and enqueues job', async () => {
    const newFilter: FilterRule[] = [{ fieldId: 'f2', operator: 'contains', value: 'test', conjunction: 'and' }];

    const result = await updateSyncFilter({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
      newFilter,
    });

    expect(result).toEqual({ jobId: 'job-123' });

    // Verify previous filter was stored
    expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      VALID_CONN_ID,
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({
            previous_sync_filter: [{ fieldId: 'f1', operator: 'equals', value: 'old', conjunction: 'and' }],
            sync_filter: newFilter,
          }),
        ]),
      }),
    );

    // Verify job was enqueued with priority 1
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'sync.initial',
      expect.objectContaining({
        tenantId: 'tenant-1',
        connectionId: VALID_CONN_ID,
      }),
      { priority: 1 },
    );
  });

  it('blocks on quota exceeded', async () => {
    mockCanSyncRecords.mockResolvedValue({ allowed: false, remaining: 10, overageCount: 190 });

    await expect(
      updateSyncFilter({
        connectionId: VALID_CONN_ID,
        tableId: TABLE_ID,
        newFilter: [{ fieldId: 'f2', operator: 'equals', value: 'x', conjunction: 'and' }],
      }),
    ).rejects.toThrow('Quota exceeded');

    expect(mockUpdateSyncConfig).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('requires admin role with connection:update permission', async () => {
    await updateSyncFilter({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
      newFilter: [],
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'connection', 'update',
    );
  });

  it('sets sync_filter to null when newFilter is empty', async () => {
    await updateSyncFilter({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
      newFilter: [],
    });

    expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      VALID_CONN_ID,
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({
            sync_filter: null,
          }),
        ]),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: enableSyncTable
// ---------------------------------------------------------------------------

describe('enableSyncTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSyncConfig.mockResolvedValue(
      makeSyncConfig({ enabled: false, sync_filter: null }),
    );
  });

  it('sets enabled=true and enqueues initial sync', async () => {
    const result = await enableSyncTable({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
    });

    expect(result).toEqual({ jobId: 'job-123' });
    expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      VALID_CONN_ID,
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({
            enabled: true,
          }),
        ]),
      }),
    );
    expect(mockQueueAdd).toHaveBeenCalledWith(
      'sync.initial',
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
  });

  it('accepts optional filter', async () => {
    const filter: FilterRule[] = [{ fieldId: 'f1', operator: 'equals', value: 'x', conjunction: 'and' }];

    await enableSyncTable({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
      filter,
    });

    expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      VALID_CONN_ID,
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({
            enabled: true,
            sync_filter: filter,
          }),
        ]),
      }),
    );
  });

  it('requires admin role with connection:update permission', async () => {
    await enableSyncTable({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'connection', 'update',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: disableSyncTable
// ---------------------------------------------------------------------------

describe('disableSyncTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSyncConfig.mockResolvedValue(makeSyncConfig());
  });

  it('sets enabled=false and does not enqueue a job', async () => {
    const result = await disableSyncTable({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
    });

    expect(result).toEqual({ disabled: true });
    expect(mockUpdateSyncConfig).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      VALID_CONN_ID,
      expect.objectContaining({
        tables: expect.arrayContaining([
          expect.objectContaining({
            enabled: false,
          }),
        ]),
      }),
    );
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it('requires admin role with connection:update permission', async () => {
    await disableSyncTable({
      connectionId: VALID_CONN_ID,
      tableId: TABLE_ID,
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'connection', 'update',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: estimateFilteredRecordCount
// ---------------------------------------------------------------------------

describe('estimateFilteredRecordCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanSyncRecords.mockResolvedValue({ allowed: true, remaining: 5000, overageCount: 0 });

    // Mock the chained DB query for field mappings
    const mockMappingWhere = vi.fn().mockResolvedValue([
      { fieldId: 'es-field-1', externalFieldId: 'fldABC123' },
    ]);
    const mockMappingFrom = vi.fn().mockReturnValue({ where: mockMappingWhere });

    // Mock the chained DB query for field names
    const mockFieldWhere = vi.fn().mockResolvedValue([
      { id: 'es-field-1', name: 'Status' },
    ]);
    const mockFieldFrom = vi.fn().mockReturnValue({ where: mockFieldWhere });

    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return { from: mockMappingFrom };
      }
      return { from: mockFieldFrom };
    });
  });

  it('translates filters and returns estimate with quota info', async () => {
    const result = await estimateFilteredRecordCount({
      connectionId: VALID_CONN_ID,
      baseId: 'appXYZ',
      tableId: 'tblABC',
      filters: [{ fieldId: 'es-field-1', operator: 'equals', value: 'Active', conjunction: 'and' }],
    });

    expect(result).toEqual({
      count: 150,
      isExact: false,
      quotaRemaining: 5000,
      quotaAllowed: true,
    });

    expect(mockTranslateFilterToFormula).toHaveBeenCalledWith(
      [{ fieldId: 'es-field-1', operator: 'equals', value: 'Active', conjunction: 'and' }],
      expect.any(Map),
    );
    expect(mockEstimateAirtableRecordCount).toHaveBeenCalled();
  });

  it('requires admin role with connection:read permission', async () => {
    await estimateFilteredRecordCount({
      connectionId: VALID_CONN_ID,
      baseId: 'appXYZ',
      tableId: 'tblABC',
      filters: [],
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'admin', 'connection', 'read',
    );
  });
});
