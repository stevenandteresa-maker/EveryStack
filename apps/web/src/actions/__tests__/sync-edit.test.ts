import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockSelect,
  mockUpdate: _mockUpdate,
  mockTransaction,
  mockDb,
  mockGetAuthContext,
  mockRequireRole,
  mockQueueAdd,
  mockGetJob,
  mockBuildSearchVector,
  mockIsComputedFieldType,
} = vi.hoisted(() => {
  // Chainable select mock
  const _mockLimit = vi.fn().mockResolvedValue([]);
  const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
  const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: _mockFrom });

  // Chainable update mock
  const _mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const _mockUpdateSet = vi.fn().mockReturnValue({ where: _mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockUpdateSet });

  // Transaction mock — executes the callback with the tx
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb({ update: mockUpdate });
  });

  return {
    mockSelect,
    mockUpdate,
    mockTransaction,
    mockDb: { select: mockSelect, update: mockUpdate, transaction: mockTransaction },
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      clerkUserId: 'clerk-1',
      agencyTenantId: null,
    }),
    mockRequireRole: vi.fn().mockResolvedValue(undefined),
    mockQueueAdd: vi.fn().mockResolvedValue({ id: 'outbound-job-1' }),
    mockGetJob: vi.fn().mockResolvedValue(null),
    mockBuildSearchVector: vi.fn().mockReturnValue('mock-tsvector-sql'),
    mockIsComputedFieldType: vi.fn().mockReturnValue(false),
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

vi.mock('@/lib/errors', () => {
  class ValidationError extends Error {
    code = 'VALIDATION_FAILED';
    statusCode = 422;
    details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'ValidationError';
      this.details = details;
    }
  }
  class NotFoundError extends Error {
    code = 'NOT_FOUND';
    statusCode = 404;
    details?: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'NotFoundError';
      this.details = details;
    }
  }
  return {
    ValidationError,
    NotFoundError,
    wrapUnknownError: vi.fn((e: unknown) => e),
  };
});

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  records: {
    tenantId: 'tenant_id',
    id: 'id',
    tableId: 'table_id',
    canonicalData: 'canonical_data',
    archivedAt: 'archived_at',
    searchVector: 'search_vector',
    updatedBy: 'updated_by',
    updatedAt: 'updated_at',
  },
  fields: {
    id: 'id',
    tenantId: 'tenant_id',
    tableId: 'table_id',
    fieldType: 'field_type',
    isPrimary: 'is_primary',
    readOnly: 'read_only',
    config: 'config',
    name: 'name',
  },
  syncedFieldMappings: {
    tenantId: 'tenant_id',
    tableId: 'table_id',
    status: 'status',
    baseConnectionId: 'base_connection_id',
  },
  baseConnections: {
    id: 'id',
    tenantId: 'tenant_id',
    syncDirection: 'sync_direction',
    syncStatus: 'sync_status',
  },
  eq: vi.fn((...args: unknown[]) => ({ op: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
  buildSearchVector: mockBuildSearchVector,
}));

vi.mock('@everystack/shared/sync', () => ({
  isComputedFieldType: mockIsComputedFieldType,
}));

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({ add: mockQueueAdd, getJob: mockGetJob })),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

import { updateSyncedRecordField } from '../sync-edit';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECORD_ID = 'a1234567-89ab-4def-8123-456789abcde0';
const FIELD_ID = 'b1234567-89ab-4def-8123-456789abcde1';
const TABLE_ID = 'c1234567-89ab-4def-8123-456789abcde2';
const BASE_CONN_ID = 'd1234567-89ab-4def-8123-456789abcde3';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up select mock to return different results for sequential calls.
 * Call order:
 *   1. Field lookup (by fieldId)
 *   2. Record lookup (by recordId)
 *   3. Table fields (for search vector)
 *   4. Synced field mapping lookup
 *   5. Connection lookup
 */
function setupSuccessfulEdit(overrides?: {
  fieldType?: string;
  readOnly?: boolean;
  syncMapping?: boolean;
  syncDirection?: string;
  syncStatus?: string;
}) {
  const {
    fieldType = 'text',
    readOnly = false,
    syncMapping = true,
    syncDirection = 'bidirectional',
    syncStatus = 'active',
  } = overrides ?? {};

  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;
    switch (callCount) {
      // 1. Field lookup
      case 1: {
        const fieldResult = [{
          id: FIELD_ID,
          fieldType,
          isPrimary: false,
          readOnly,
          config: {},
          name: 'Test Field',
        }];
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(fieldResult),
            }),
          }),
        };
      }
      // 2. Record lookup
      case 2: {
        const recordResult = [{
          tenantId: 'tenant-1',
          id: RECORD_ID,
          canonicalData: { [FIELD_ID]: { type: 'text', value: 'old value' } },
          tableId: TABLE_ID,
        }];
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(recordResult),
            }),
          }),
        };
      }
      // 3. Table fields for search vector
      case 3: {
        const fieldsResult = [{
          id: FIELD_ID,
          fieldType: 'text',
          isPrimary: false,
          config: {},
        }];
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(fieldsResult),
          }),
        };
      }
      // 4. Synced field mapping
      case 4: {
        const mappingResult = syncMapping
          ? [{ baseConnectionId: BASE_CONN_ID }]
          : [];
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mappingResult),
            }),
          }),
        };
      }
      // 5. Connection lookup
      case 5: {
        const connResult = syncMapping
          ? [{ syncDirection, syncStatus }]
          : [];
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(connResult),
            }),
          }),
        };
      }
      default:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
    }
  });
}

function setupFieldNotFound() {
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([]),
      }),
    }),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateSyncedRecordField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsComputedFieldType.mockReturnValue(false);
  });

  // -------------------------------------------------------------------------
  // Input validation
  // -------------------------------------------------------------------------

  describe('input validation', () => {
    it('rejects missing recordId', async () => {
      await expect(
        updateSyncedRecordField({
          recordId: 'not-a-uuid',
          fieldId: FIELD_ID,
          tableId: TABLE_ID,
          newValue: 'test',
        }),
      ).rejects.toThrow();
    });

    it('rejects missing fieldId', async () => {
      await expect(
        updateSyncedRecordField({
          recordId: RECORD_ID,
          fieldId: 'bad',
          tableId: TABLE_ID,
          newValue: 'test',
        }),
      ).rejects.toThrow();
    });

    it('rejects missing tableId', async () => {
      await expect(
        updateSyncedRecordField({
          recordId: RECORD_ID,
          fieldId: FIELD_ID,
          tableId: 'bad',
          newValue: 'test',
        }),
      ).rejects.toThrow();
    });

    it('accepts null newValue', async () => {
      setupSuccessfulEdit();

      const result = await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: null,
      });

      expect(result.recordId).toBe(RECORD_ID);
    });
  });

  // -------------------------------------------------------------------------
  // Computed field rejection
  // -------------------------------------------------------------------------

  describe('computed field rejection', () => {
    it.each([
      'lookup', 'rollup', 'formula', 'count', 'auto_number',
      'created_at', 'updated_at', 'created_by', 'updated_by',
    ])('rejects editing %s field', async (fieldType) => {
      mockIsComputedFieldType.mockReturnValue(true);

      // Setup field lookup to return the computed field
      mockSelect.mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: FIELD_ID,
              fieldType,
              isPrimary: false,
              readOnly: false,
              config: {},
              name: 'Computed Field',
            }]),
          }),
        }),
      }));

      await expect(
        updateSyncedRecordField({
          recordId: RECORD_ID,
          fieldId: FIELD_ID,
          tableId: TABLE_ID,
          newValue: 'test',
        }),
      ).rejects.toThrow('This field is computed and cannot be edited.');
    });
  });

  // -------------------------------------------------------------------------
  // Read-only field rejection
  // -------------------------------------------------------------------------

  describe('read-only field rejection', () => {
    it('rejects editing a read-only field', async () => {
      setupSuccessfulEdit({ readOnly: true });

      await expect(
        updateSyncedRecordField({
          recordId: RECORD_ID,
          fieldId: FIELD_ID,
          tableId: TABLE_ID,
          newValue: 'test',
        }),
      ).rejects.toThrow('This field is read-only and cannot be edited.');
    });
  });

  // -------------------------------------------------------------------------
  // Not found cases
  // -------------------------------------------------------------------------

  describe('not found', () => {
    it('throws NotFoundError when field does not exist', async () => {
      setupFieldNotFound();

      await expect(
        updateSyncedRecordField({
          recordId: RECORD_ID,
          fieldId: FIELD_ID,
          tableId: TABLE_ID,
          newValue: 'test',
        }),
      ).rejects.toThrow('Field not found');
    });

    it('throws NotFoundError when record does not exist', async () => {
      let callCount = 0;
      mockSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Field found
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: FIELD_ID,
                  fieldType: 'text',
                  isPrimary: false,
                  readOnly: false,
                  config: {},
                  name: 'Test Field',
                }]),
              }),
            }),
          };
        }
        // Record not found
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      });

      await expect(
        updateSyncedRecordField({
          recordId: RECORD_ID,
          fieldId: FIELD_ID,
          tableId: TABLE_ID,
          newValue: 'test',
        }),
      ).rejects.toThrow('Record not found');
    });
  });

  // -------------------------------------------------------------------------
  // Successful edit
  // -------------------------------------------------------------------------

  describe('successful edit', () => {
    it('updates canonical data and returns immediately', async () => {
      setupSuccessfulEdit();

      const result = await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: { type: 'text', value: 'new value' },
      });

      expect(result).toEqual({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        updatedCanonicalData: {
          [FIELD_ID]: { type: 'text', value: 'new value' },
        },
      });
    });

    it('calls buildSearchVector with updated canonical data', async () => {
      setupSuccessfulEdit();

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: { type: 'text', value: 'new value' },
      });

      expect(mockBuildSearchVector).toHaveBeenCalledWith(
        { [FIELD_ID]: { type: 'text', value: 'new value' } },
        expect.arrayContaining([
          expect.objectContaining({ id: FIELD_ID, fieldType: 'text' }),
        ]),
      );
    });

    it('updates record in a transaction', async () => {
      setupSuccessfulEdit();

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: { type: 'text', value: 'new' },
      });

      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('requires member role with record:update permission', async () => {
      setupSuccessfulEdit();

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: 'test',
      });

      expect(mockRequireRole).toHaveBeenCalledWith(
        'user-1', 'tenant-1', undefined, 'team_member', 'record', 'update',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Outbound sync enqueue
  // -------------------------------------------------------------------------

  describe('outbound sync enqueue', () => {
    it('enqueues outbound sync job for synced tables', async () => {
      setupSuccessfulEdit({ syncMapping: true });

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: 'test',
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'outbound-sync',
        expect.objectContaining({
          tenantId: 'tenant-1',
          recordId: RECORD_ID,
          tableId: TABLE_ID,
          baseConnectionId: BASE_CONN_ID,
          changedFieldIds: [FIELD_ID],
          editedBy: 'user-1',
        }),
        expect.objectContaining({
          jobId: `outbound:tenant-1:${RECORD_ID}`,
          priority: 10,
        }),
      );
    });

    it('skips outbound sync for non-synced tables', async () => {
      setupSuccessfulEdit({ syncMapping: false });

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: 'test',
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('skips outbound sync for inbound-only connections', async () => {
      setupSuccessfulEdit({ syncMapping: true, syncDirection: 'inbound_only' });

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: 'test',
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('skips outbound sync for paused connections', async () => {
      setupSuccessfulEdit({ syncMapping: true, syncStatus: 'paused' });

      await updateSyncedRecordField({
        recordId: RECORD_ID,
        fieldId: FIELD_ID,
        tableId: TABLE_ID,
        newValue: 'test',
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });
});
