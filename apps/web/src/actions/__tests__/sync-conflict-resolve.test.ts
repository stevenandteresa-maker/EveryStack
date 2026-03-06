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
  mockUpdateLastSyncedValues,
  mockRedisGet,
  mockRedisSet,
  mockRedisDel,
  mockRedisPublish,
  mockGenerateUUIDv7,
  mockWriteAuditLog,
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
  const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);

  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    await cb({ update: mockUpdate, insert: vi.fn() });
  });

  // Redis mocks
  const mockRedisGet = vi.fn().mockResolvedValue(null);
  const mockRedisSet = vi.fn().mockResolvedValue('OK');
  const mockRedisDel = vi.fn().mockResolvedValue(1);
  const mockRedisPublish = vi.fn().mockResolvedValue(1);

  const mockGetJob = vi.fn().mockResolvedValue(null);

  return {
    mockSelect,
    mockUpdate,
    mockTransaction,
    mockDb: {
      select: mockSelect,
      update: mockUpdate,
      transaction: mockTransaction,
    },
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: 'user-1',
      tenantId: 'tenant-1',
      clerkUserId: 'clerk-1',
      agencyTenantId: null,
    }),
    mockRequireRole: vi.fn().mockResolvedValue(undefined),
    mockQueueAdd: vi.fn().mockResolvedValue({ id: 'outbound-job-1' }),
    mockGetJob,
    mockBuildSearchVector: vi.fn().mockReturnValue('mock-tsvector-sql'),
    mockUpdateLastSyncedValues: vi.fn().mockReturnValue({
      platform_record_id: 'ext-1',
      last_synced_at: '2026-03-06T00:00:00Z',
      last_synced_values: {},
      sync_status: 'active',
      sync_direction: 'inbound',
      orphaned_at: null,
      orphaned_reason: null,
    }),
    mockRedisGet,
    mockRedisSet,
    mockRedisDel,
    mockRedisPublish,
    mockGenerateUUIDv7: vi.fn().mockReturnValue('undo-token-uuid-v7'),
    mockWriteAuditLog,
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
  class ForbiddenError extends Error {
    code = 'PERMISSION_DENIED';
    statusCode = 403;
    constructor(message: string) {
      super(message);
      this.name = 'ForbiddenError';
    }
  }
  return {
    ValidationError,
    NotFoundError,
    ForbiddenError,
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
    syncMetadata: 'sync_metadata',
    searchVector: 'search_vector',
    archivedAt: 'archived_at',
    updatedBy: 'updated_by',
    updatedAt: 'updated_at',
  },
  fields: {
    id: 'id',
    tenantId: 'tenant_id',
    tableId: 'table_id',
    fieldType: 'field_type',
    isPrimary: 'is_primary',
    config: 'config',
  },
  syncConflicts: {
    id: 'id',
    tenantId: 'tenant_id',
    recordId: 'record_id',
    fieldId: 'field_id',
    localValue: 'local_value',
    remoteValue: 'remote_value',
    baseValue: 'base_value',
    platform: 'platform',
    status: 'status',
    resolvedBy: 'resolved_by',
    resolvedAt: 'resolved_at',
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
  generateUUIDv7: mockGenerateUUIDv7,
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@everystack/shared/sync', () => ({
  updateLastSyncedValues: mockUpdateLastSyncedValues,
}));

vi.mock('@everystack/shared/realtime', () => ({
  REALTIME_EVENTS: {
    SYNC_CONFLICT_RESOLVED: 'sync.conflict_resolved',
    SYNC_CONFLICT_DETECTED: 'sync.conflict_detected',
    RECORD_UPDATED: 'record.updated',
  },
  createEventPublisher: vi.fn(() => ({
    publish: mockRedisPublish,
  })),
}));

vi.mock('@everystack/shared/redis', () => ({
  createRedisClient: vi.fn(() => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
    publish: mockRedisPublish,
  })),
}));

vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(() => ({
    add: mockQueueAdd,
    getJob: mockGetJob,
  })),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test'),
}));

import {
  resolveConflict,
  undoConflictResolution,
  bulkResolveConflicts,
  bulkResolveTableConflicts,
} from '../sync-conflict-resolve';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CONFLICT_ID = 'a1234567-89ab-4def-8123-456789abcde0';
const RECORD_ID = 'b1234567-89ab-4def-8123-456789abcde1';
const FIELD_ID = 'c1234567-89ab-4def-8123-456789abcde2';
const TABLE_ID = 'd1234567-89ab-4def-8123-456789abcde3';
const BASE_CONN_ID = 'e1234567-89ab-4def-8123-456789abcde4';

const PENDING_CONFLICT = {
  id: CONFLICT_ID,
  tenantId: 'tenant-1',
  recordId: RECORD_ID,
  fieldId: FIELD_ID,
  localValue: 'local-val',
  remoteValue: 'remote-val',
  baseValue: 'base-val',
  platform: 'airtable',
  status: 'pending',
  resolvedBy: null,
  createdAt: new Date('2026-03-06'),
  resolvedAt: null,
};

const EXISTING_RECORD = {
  tenantId: 'tenant-1',
  id: RECORD_ID,
  tableId: TABLE_ID,
  canonicalData: { [FIELD_ID]: 'local-val', 'other-field': 'other-val' },
  syncMetadata: {
    platform_record_id: 'ext-1',
    last_synced_at: '2026-03-05T00:00:00Z',
    last_synced_values: { [FIELD_ID]: { value: 'base-val', synced_at: '2026-03-05T00:00:00Z' } },
    sync_status: 'active',
    sync_direction: 'inbound',
    orphaned_at: null,
    orphaned_reason: null,
  },
};

const TABLE_FIELDS = [
  { id: FIELD_ID, fieldType: 'text', isPrimary: true, config: {} },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Set up select mock for resolveConflict.
 * Call order:
 *   1. Conflict lookup
 *   2. Record lookup
 *   3. Table fields (for search vector)
 *   4. Synced field mapping lookup (only for resolved_local/resolved_merged)
 *   5. Connection lookup (only if mapping found)
 */
function setupResolveSelects(overrides?: {
  conflict?: Record<string, unknown> | null;
  record?: Record<string, unknown> | null;
  syncMapping?: boolean;
  syncDirection?: string;
  syncStatus?: string;
}) {
  const {
    conflict = PENDING_CONFLICT,
    record = EXISTING_RECORD,
    syncMapping = true,
    syncDirection = 'bidirectional',
    syncStatus = 'active',
  } = overrides ?? {};

  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;
    switch (callCount) {
      // 1. Conflict lookup
      case 1:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(conflict ? [conflict] : []),
            }),
          }),
        };
      // 2. Record lookup
      case 2:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(record ? [record] : []),
            }),
          }),
        };
      // 3. Table fields
      case 3:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(TABLE_FIELDS),
          }),
        };
      // 4. Synced field mapping
      case 4:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(
                syncMapping ? [{ baseConnectionId: BASE_CONN_ID }] : [],
              ),
            }),
          }),
        };
      // 5. Connection lookup
      case 5:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(
                syncMapping ? [{ syncDirection, syncStatus }] : [],
              ),
            }),
          }),
        };
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

/**
 * Set up select mock for undoConflictResolution.
 * Only needs table fields for search vector rebuild.
 */
function setupUndoSelects() {
  mockSelect.mockImplementation(() => ({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(TABLE_FIELDS),
    }),
  }));
}

const FIELD_ID_2 = 'c2234567-89ab-4def-8123-456789abcde2';

const PENDING_CONFLICT_2 = {
  ...PENDING_CONFLICT,
  id: 'a2234567-89ab-4def-8123-456789abcde0',
  fieldId: FIELD_ID_2,
  localValue: 'local-val-2',
  remoteValue: 'remote-val-2',
  baseValue: 'base-val-2',
};

/**
 * Set up select mock for bulkResolveConflicts.
 * Call order:
 *   1. Pending conflicts for record (returns array, no .limit())
 *   2. Record lookup
 *   3. Table fields
 *   4. Synced field mapping (for resolved_local)
 *   5. Connection lookup (if mapping found)
 */
function setupBulkResolveSelects(overrides?: {
  conflicts?: Record<string, unknown>[];
  record?: Record<string, unknown> | null;
  syncMapping?: boolean;
  syncDirection?: string;
  syncStatus?: string;
}) {
  const {
    conflicts = [PENDING_CONFLICT, PENDING_CONFLICT_2],
    record = {
      ...EXISTING_RECORD,
      canonicalData: { [FIELD_ID]: 'local-val', [FIELD_ID_2]: 'local-val-2', 'other-field': 'other-val' },
    },
    syncMapping = false,
  } = overrides ?? {};

  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;
    switch (callCount) {
      // 1. Pending conflicts for record (no .limit())
      case 1:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(conflicts),
          }),
        };
      // 2. Record lookup
      case 2:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(record ? [record] : []),
            }),
          }),
        };
      // 3. Table fields
      case 3:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(TABLE_FIELDS),
          }),
        };
      // 4. Synced field mapping
      case 4:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(
                syncMapping ? [{ baseConnectionId: BASE_CONN_ID }] : [],
              ),
            }),
          }),
        };
      // 5. Connection lookup
      case 5:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
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

/**
 * Set up select mock for bulkResolveTableConflicts.
 */
function setupBulkTableResolveSelects(overrides?: {
  conflicts?: { conflict: Record<string, unknown>; recordTableId: string }[];
  record?: Record<string, unknown> | null;
}) {
  const {
    conflicts = [
      { conflict: PENDING_CONFLICT, recordTableId: TABLE_ID },
      { conflict: PENDING_CONFLICT_2, recordTableId: TABLE_ID },
    ],
    record = {
      ...EXISTING_RECORD,
      canonicalData: { [FIELD_ID]: 'local-val', [FIELD_ID_2]: 'local-val-2', 'other-field': 'other-val' },
    },
  } = overrides ?? {};

  let callCount = 0;

  mockSelect.mockImplementation(() => {
    callCount++;
    switch (callCount) {
      // 1. All conflicts for table with innerJoin
      case 1:
        return {
          from: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(conflicts),
            }),
          }),
        };
      // 2. Table fields
      case 2:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(TABLE_FIELDS),
          }),
        };
      // 3. Record lookup (per record group)
      case 3:
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(record ? [record] : []),
            }),
          }),
        };
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

// ---------------------------------------------------------------------------
// Tests — resolveConflict
// ---------------------------------------------------------------------------

describe('resolveConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe('input validation', () => {
    it('rejects invalid conflictId', async () => {
      await expect(
        resolveConflict({
          conflictId: 'not-uuid',
          resolution: 'resolved_local',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow();
    });

    it('rejects invalid resolution value', async () => {
      await expect(
        resolveConflict({
          conflictId: CONFLICT_ID,
          // @ts-expect-error — intentional invalid value for test
          resolution: 'invalid_value',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow();
    });

    it('rejects resolved_merged without mergedValue', async () => {
      setupResolveSelects();

      await expect(
        resolveConflict({
          conflictId: CONFLICT_ID,
          resolution: 'resolved_merged',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow('mergedValue is required');
    });
  });

  // -----------------------------------------------------------------------
  // Permission check
  // -----------------------------------------------------------------------

  describe('permission check', () => {
    it('requires manager role', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockRequireRole).toHaveBeenCalledWith(
        'user-1', 'tenant-1', undefined, 'manager', 'record', 'update',
      );
    });

    it('throws ForbiddenError when role check fails', async () => {
      mockRequireRole.mockRejectedValueOnce(new Error('Permission denied'));

      await expect(
        resolveConflict({
          conflictId: CONFLICT_ID,
          resolution: 'resolved_local',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow('Permission denied');
    });
  });

  // -----------------------------------------------------------------------
  // Not found cases
  // -----------------------------------------------------------------------

  describe('not found', () => {
    it('throws when conflict does not exist', async () => {
      setupResolveSelects({ conflict: null });

      await expect(
        resolveConflict({
          conflictId: CONFLICT_ID,
          resolution: 'resolved_local',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow('Conflict not found');
    });

    it('throws when record does not exist', async () => {
      setupResolveSelects({ record: null });

      await expect(
        resolveConflict({
          conflictId: CONFLICT_ID,
          resolution: 'resolved_local',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow('Record not found');
    });

    it('throws when conflict is already resolved', async () => {
      setupResolveSelects({
        conflict: { ...PENDING_CONFLICT, status: 'resolved_local' },
      });

      await expect(
        resolveConflict({
          conflictId: CONFLICT_ID,
          resolution: 'resolved_local',
          tableId: TABLE_ID,
        }),
      ).rejects.toThrow('Conflict is already resolved');
    });
  });

  // -----------------------------------------------------------------------
  // resolved_local — Keep EveryStack
  // -----------------------------------------------------------------------

  describe('resolved_local (Keep EveryStack)', () => {
    it('updates conflict and record in a single transaction', async () => {
      setupResolveSelects();

      const result = await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(result.success).toBe(true);
      expect(result.undoToken).toBe('undo-token-uuid-v7');
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('sets canonical_data to the local value', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      // buildSearchVector is called with canonical data that includes local value
      expect(mockBuildSearchVector).toHaveBeenCalledWith(
        expect.objectContaining({
          [FIELD_ID]: 'local-val',
          'other-field': 'other-val',
        }),
        expect.any(Array),
      );
    });

    it('enqueues outbound sync with P1 priority', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'outbound-sync',
        expect.objectContaining({
          tenantId: 'tenant-1',
          recordId: RECORD_ID,
          tableId: TABLE_ID,
          baseConnectionId: BASE_CONN_ID,
          changedFieldIds: [FIELD_ID],
          priority: 1,
        }),
        expect.objectContaining({
          priority: 1,
        }),
      );
    });

    it('emits sync.conflict_resolved event', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockRedisPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'sync.conflict_resolved',
          payload: expect.objectContaining({
            conflictId: CONFLICT_ID,
            resolution: 'resolved_local',
            resolvedValue: 'local-val',
          }),
        }),
      );
    });

    it('emits record.updated event', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockRedisPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'record.updated',
          payload: expect.objectContaining({
            recordId: RECORD_ID,
          }),
        }),
      );
    });

    it('caches undo state in Redis with 8-second TTL', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockRedisSet).toHaveBeenCalledWith(
        'conflict-undo:undo-token-uuid-v7',
        expect.any(String),
        'EX',
        8,
      );

      // Verify the cached state contains the original canonical data
      const cachedJson = mockRedisSet.mock.calls[0]?.[1] as string;
      const cachedState = JSON.parse(cachedJson);
      expect(cachedState.previousCanonicalData).toEqual(EXISTING_RECORD.canonicalData);
      expect(cachedState.conflictId).toBe(CONFLICT_ID);
    });

    it('updates sync_metadata with resolved value', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockUpdateLastSyncedValues).toHaveBeenCalledWith(
        EXISTING_RECORD.syncMetadata,
        [FIELD_ID],
        expect.objectContaining({ [FIELD_ID]: 'local-val' }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // resolved_remote — Keep Platform
  // -----------------------------------------------------------------------

  describe('resolved_remote (Keep Platform)', () => {
    it('sets canonical_data to the remote value', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_remote',
        tableId: TABLE_ID,
      });

      expect(mockBuildSearchVector).toHaveBeenCalledWith(
        expect.objectContaining({ [FIELD_ID]: 'remote-val' }),
        expect.any(Array),
      );
    });

    it('does NOT enqueue outbound sync', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_remote',
        tableId: TABLE_ID,
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('stores null outboundJobId in undo state', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_remote',
        tableId: TABLE_ID,
      });

      const cachedJson = mockRedisSet.mock.calls[0]?.[1] as string;
      const cachedState = JSON.parse(cachedJson);
      expect(cachedState.outboundJobId).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // resolved_merged — Edit
  // -----------------------------------------------------------------------

  describe('resolved_merged (Edit)', () => {
    it('sets canonical_data to the merged value', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_merged',
        mergedValue: 'custom-merged',
        tableId: TABLE_ID,
      });

      expect(mockBuildSearchVector).toHaveBeenCalledWith(
        expect.objectContaining({ [FIELD_ID]: 'custom-merged' }),
        expect.any(Array),
      );
    });

    it('enqueues outbound sync with P1 priority for merged value', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_merged',
        mergedValue: 'custom-merged',
        tableId: TABLE_ID,
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'outbound-sync',
        expect.objectContaining({
          changedFieldIds: [FIELD_ID],
          priority: 1,
        }),
        expect.objectContaining({ priority: 1 }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // Outbound sync — edge cases
  // -----------------------------------------------------------------------

  describe('outbound sync edge cases', () => {
    it('skips outbound for inbound-only connections', async () => {
      setupResolveSelects({ syncDirection: 'inbound_only' });

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('skips outbound for paused connections', async () => {
      setupResolveSelects({ syncStatus: 'paused' });

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });

    it('skips outbound when no sync mapping exists', async () => {
      setupResolveSelects({ syncMapping: false });

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockQueueAdd).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Null sync_metadata handling
  // -----------------------------------------------------------------------

  describe('null sync_metadata', () => {
    it('handles record with no sync_metadata gracefully', async () => {
      setupResolveSelects({
        record: { ...EXISTING_RECORD, syncMetadata: null },
      });

      const result = await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(result.success).toBe(true);
      expect(mockUpdateLastSyncedValues).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Audit log
  // -----------------------------------------------------------------------

  describe('audit log', () => {
    it('writes audit log entry in the transaction', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      expect(mockWriteAuditLog).toHaveBeenCalledWith(
        expect.anything(), // tx
        expect.objectContaining({
          tenantId: 'tenant-1',
          actorType: 'user',
          actorId: 'user-1',
          action: 'sync_conflict.resolved',
          entityType: 'record',
          entityId: RECORD_ID,
          details: expect.objectContaining({
            conflictId: CONFLICT_ID,
            fieldId: FIELD_ID,
            resolution: 'resolved_local',
            resolvedValue: 'local-val',
            platform: 'airtable',
          }),
        }),
      );
    });

    it('logs previousValue as remote when resolution is resolved_local', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_local',
        tableId: TABLE_ID,
      });

      const auditCall = mockWriteAuditLog.mock.calls[0]?.[1];
      expect(auditCall?.details?.previousValue).toBe('remote-val');
    });

    it('logs previousValue as local when resolution is resolved_remote', async () => {
      setupResolveSelects();

      await resolveConflict({
        conflictId: CONFLICT_ID,
        resolution: 'resolved_remote',
        tableId: TABLE_ID,
      });

      const auditCall = mockWriteAuditLog.mock.calls[0]?.[1];
      expect(auditCall?.details?.previousValue).toBe('local-val');
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — undoConflictResolution
// ---------------------------------------------------------------------------

describe('undoConflictResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const UNDO_TOKEN = 'f1234567-89ab-4def-8123-456789abcde5';
  const UNDO_STATE: Record<string, unknown> = {
    conflictId: CONFLICT_ID,
    recordId: RECORD_ID,
    fieldId: FIELD_ID,
    tableId: TABLE_ID,
    tenantId: 'tenant-1',
    previousCanonicalData: { [FIELD_ID]: 'local-val', 'other-field': 'other-val' },
    previousSyncMetadata: EXISTING_RECORD.syncMetadata,
    localValue: 'local-val',
    remoteValue: 'remote-val',
    baseValue: 'base-val',
    platform: 'airtable',
    outboundJobId: 'outbound:tenant-1:' + RECORD_ID,
  };

  // -----------------------------------------------------------------------
  // Successful undo (within 8-second window)
  // -----------------------------------------------------------------------

  describe('within undo window', () => {
    it('reverts conflict and record state', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      const result = await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(result.success).toBe(true);
      expect(mockTransaction).toHaveBeenCalledTimes(1);
    });

    it('deletes the Redis undo key', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockRedisDel).toHaveBeenCalledWith('conflict-undo:' + UNDO_TOKEN);
    });

    it('cancels outbound sync job if waiting', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('waiting'),
        remove: mockRemove,
      });
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('cancels outbound sync job if delayed', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('delayed'),
        remove: mockRemove,
      });
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockRemove).toHaveBeenCalledTimes(1);
    });

    it('does not cancel outbound sync job if already active', async () => {
      const mockRemove = vi.fn();
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue('active'),
        remove: mockRemove,
      });
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('emits sync.conflict_detected to restore conflict indicator', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockRedisPublish).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'sync.conflict_detected',
          payload: expect.objectContaining({
            conflictId: CONFLICT_ID,
            recordId: RECORD_ID,
            fieldId: FIELD_ID,
            localValue: 'local-val',
            remoteValue: 'remote-val',
          }),
        }),
      );
    });

    it('restores search_vector with previous canonical data', async () => {
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(UNDO_STATE));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockBuildSearchVector).toHaveBeenCalledWith(
        UNDO_STATE.previousCanonicalData,
        TABLE_FIELDS,
      );
    });
  });

  // -----------------------------------------------------------------------
  // Expired undo (after 8-second window)
  // -----------------------------------------------------------------------

  describe('after undo window (expired)', () => {
    it('returns success: false when Redis key is gone', async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      const result = await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(result.success).toBe(false);
    });

    it('does not modify the database', async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockTransaction).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Permission check
  // -----------------------------------------------------------------------

  describe('permission check', () => {
    it('requires manager role', async () => {
      mockRedisGet.mockResolvedValueOnce(null);

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockRequireRole).toHaveBeenCalledWith(
        'user-1', 'tenant-1', undefined, 'manager', 'record', 'update',
      );
    });
  });

  // -----------------------------------------------------------------------
  // Tenant isolation
  // -----------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('rejects undo from a different tenant', async () => {
      const crossTenantState = { ...UNDO_STATE, tenantId: 'tenant-other' };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(crossTenantState));

      await expect(
        undoConflictResolution({ undoToken: UNDO_TOKEN }),
      ).rejects.toThrow('Cannot undo conflict for another tenant');
    });
  });

  // -----------------------------------------------------------------------
  // No outbound job to cancel
  // -----------------------------------------------------------------------

  describe('no outbound job', () => {
    it('skips job cancellation when outboundJobId is null', async () => {
      const stateNoJob = { ...UNDO_STATE, outboundJobId: null };
      mockRedisGet.mockResolvedValueOnce(JSON.stringify(stateNoJob));
      setupUndoSelects();

      await undoConflictResolution({ undoToken: UNDO_TOKEN });

      expect(mockGetJob).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe('input validation', () => {
    it('rejects invalid undoToken format', async () => {
      await expect(
        undoConflictResolution({ undoToken: 'not-a-uuid' }),
      ).rejects.toThrow();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — bulkResolveConflicts
// ---------------------------------------------------------------------------

describe('bulkResolveConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves all pending conflicts on a record', async () => {
    setupBulkResolveSelects();

    const result = await bulkResolveConflicts({
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      resolution: 'resolved_local',
    });

    expect(result.success).toBe(true);
    expect(result.resolvedCount).toBe(2);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  it('generates a single undo token for the batch', async () => {
    setupBulkResolveSelects();

    const result = await bulkResolveConflicts({
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      resolution: 'resolved_local',
    });

    expect(result.undoToken).toBe('undo-token-uuid-v7');
    expect(mockRedisSet).toHaveBeenCalledTimes(1);

    const cachedJson = mockRedisSet.mock.calls[0]?.[1] as string;
    const cachedState = JSON.parse(cachedJson);
    expect(cachedState.type).toBe('bulk');
    expect(cachedState.items).toHaveLength(2);
  });

  it('writes audit log per conflict', async () => {
    setupBulkResolveSelects();

    await bulkResolveConflicts({
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      resolution: 'resolved_local',
    });

    expect(mockWriteAuditLog).toHaveBeenCalledTimes(2);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sync_conflict.resolved',
        details: expect.objectContaining({ bulk: true }),
      }),
    );
  });

  it('emits SYNC_CONFLICT_RESOLVED per conflict', async () => {
    setupBulkResolveSelects();

    await bulkResolveConflicts({
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      resolution: 'resolved_local',
    });

    const resolvedCalls = mockRedisPublish.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>)?.event === 'sync.conflict_resolved',
    );
    expect(resolvedCalls).toHaveLength(2);
  });

  it('emits single RECORD_UPDATED event', async () => {
    setupBulkResolveSelects();

    await bulkResolveConflicts({
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      resolution: 'resolved_local',
    });

    const updatedCalls = mockRedisPublish.mock.calls.filter(
      (call: unknown[]) => (call[0] as Record<string, unknown>)?.event === 'record.updated',
    );
    expect(updatedCalls).toHaveLength(1);
  });

  it('requires manager role', async () => {
    setupBulkResolveSelects();

    await bulkResolveConflicts({
      recordId: RECORD_ID,
      tableId: TABLE_ID,
      resolution: 'resolved_local',
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'manager', 'record', 'update',
    );
  });

  it('rejects resolved_merged for bulk', async () => {
    await expect(
      bulkResolveConflicts({
        recordId: RECORD_ID,
        tableId: TABLE_ID,
        resolution: 'resolved_merged',
      }),
    ).rejects.toThrow('Bulk resolve does not support merged resolution');
  });

  it('throws NotFoundError when no pending conflicts', async () => {
    setupBulkResolveSelects({ conflicts: [] });

    await expect(
      bulkResolveConflicts({
        recordId: RECORD_ID,
        tableId: TABLE_ID,
        resolution: 'resolved_local',
      }),
    ).rejects.toThrow('No pending conflicts found');
  });
});

// ---------------------------------------------------------------------------
// Tests — bulkResolveTableConflicts
// ---------------------------------------------------------------------------

describe('bulkResolveTableConflicts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves all conflicts in a table grouped by record', async () => {
    setupBulkTableResolveSelects();

    const result = await bulkResolveTableConflicts({
      tableId: TABLE_ID,
      resolution: 'resolved_remote',
    });

    expect(result.success).toBe(true);
    expect(result.resolvedCount).toBe(2);
  });

  it('generates a single undo token for the entire table batch', async () => {
    setupBulkTableResolveSelects();

    const result = await bulkResolveTableConflicts({
      tableId: TABLE_ID,
      resolution: 'resolved_remote',
    });

    expect(result.undoToken).toBe('undo-token-uuid-v7');
    expect(mockRedisSet).toHaveBeenCalledTimes(1);

    const cachedJson = mockRedisSet.mock.calls[0]?.[1] as string;
    const cachedState = JSON.parse(cachedJson);
    expect(cachedState.type).toBe('bulk');
  });

  it('requires manager role', async () => {
    setupBulkTableResolveSelects();

    await bulkResolveTableConflicts({
      tableId: TABLE_ID,
      resolution: 'resolved_remote',
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      'user-1', 'tenant-1', undefined, 'manager', 'record', 'update',
    );
  });

  it('rejects resolved_merged for bulk table resolve', async () => {
    await expect(
      bulkResolveTableConflicts({
        tableId: TABLE_ID,
        resolution: 'resolved_merged',
      }),
    ).rejects.toThrow('Bulk resolve does not support merged resolution');
  });

  it('throws NotFoundError when no pending conflicts in table', async () => {
    setupBulkTableResolveSelects({ conflicts: [] });

    await expect(
      bulkResolveTableConflicts({
        tableId: TABLE_ID,
        resolution: 'resolved_remote',
      }),
    ).rejects.toThrow('No pending conflicts found');
  });

  it('writes audit log per conflict with tableLevel flag', async () => {
    setupBulkTableResolveSelects();

    await bulkResolveTableConflicts({
      tableId: TABLE_ID,
      resolution: 'resolved_remote',
    });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        details: expect.objectContaining({ bulk: true, tableLevel: true }),
      }),
    );
  });
});
