// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables (UUIDs must be inside hoisted block)
// ---------------------------------------------------------------------------
const {
  mockWriteAuditLog,
  mockCheckCrossLinkPermission,
  mockDbChain,
  SOURCE_TABLE_ID,
  SOURCE_FIELD_ID,
  TARGET_TABLE_ID,
  TARGET_DISPLAY_FIELD_ID,
  REVERSE_FIELD_ID,
  GENERATED_UUID,
  TENANT_ID,
  USER_ID,
} = vi.hoisted(() => {
  const SOURCE_TABLE_ID = '11111111-1111-4111-8111-111111111111';
  const SOURCE_FIELD_ID = '22222222-2222-4222-8222-222222222222';
  const TARGET_TABLE_ID = '33333333-3333-4333-8333-333333333333';
  const TARGET_DISPLAY_FIELD_ID = '44444444-4444-4444-8444-444444444444';
  const REVERSE_FIELD_ID = '55555555-5555-4555-8555-555555555555';
  const GENERATED_UUID = '66666666-6666-4666-8666-666666666666';
  const TENANT_ID = '77777777-7777-4777-8777-777777777777';
  const USER_ID = '88888888-8888-4888-8888-888888888888';
  const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);
  const mockCheckCrossLinkPermission = vi.fn().mockResolvedValue(true);

  // Build a flexible mock chain that tracks calls and returns configurable results
  const selectResults: unknown[][] = [];
  let selectCallIndex = 0;

  const insertResults: unknown[][] = [];
  let insertCallIndex = 0;

  const mockLimit = vi.fn().mockImplementation(() => {
    const result = selectResults[selectCallIndex] ?? [];
    selectCallIndex++;
    return Promise.resolve(result);
  });

  const mockWhere = vi.fn().mockImplementation(() => {
    // For count queries that don't have .limit(), return as array
    const next = {
      limit: mockLimit,
      returning: vi.fn().mockResolvedValue([]),
    };
    // Also make it thenable for cases where .where() is the terminal call
    // This handles count queries: db.select().from().where() → resolves directly
    return Object.assign(next, {
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        const result = selectResults[selectCallIndex] ?? [];
        selectCallIndex++;
        return Promise.resolve(result).then(resolve, reject);
      },
    });
  });

  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  const mockInsertReturning = vi.fn().mockImplementation(() => {
    const result = insertResults[insertCallIndex] ?? [];
    insertCallIndex++;
    return Promise.resolve(result);
  });
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });

  const mockUpdateReturning = vi.fn().mockResolvedValue([]);
  const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
  const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockUpdateSet });

  const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockReturnValue({ where: mockDeleteWhere });

  const mockTx = {
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    select: mockSelect,
  };
  const mockTransaction = vi.fn().mockImplementation(
    async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  );

  // db object — same mock chain for outside-transaction queries
  const mockDb = {
    transaction: mockTransaction,
    select: mockSelect,
  };

  return {
    SOURCE_TABLE_ID,
    SOURCE_FIELD_ID,
    TARGET_TABLE_ID,
    TARGET_DISPLAY_FIELD_ID,
    REVERSE_FIELD_ID,
    GENERATED_UUID,
    TENANT_ID,
    USER_ID,
    mockWriteAuditLog,
    mockCheckCrossLinkPermission,
    mockDbChain: {
      db: mockDb,
      selectResults,
      insertResults,
      resetCallIndices: () => {
        selectCallIndex = 0;
        insertCallIndex = 0;
      },
      mockSelect,
      mockFrom,
      mockWhere,
      mockLimit,
      mockInsert,
      mockInsertValues,
      mockInsertReturning,
      mockUpdate,
      mockUpdateSet,
      mockUpdateWhere,
      mockUpdateReturning,
      mockDelete,
      mockDeleteWhere,
      mockTransaction,
    },
  };
});

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: vi.fn().mockResolvedValue({
    userId: USER_ID,
    tenantId: TENANT_ID,
    clerkUserId: 'clerk_user_aaa',
    agencyTenantId: null,
  }),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn().mockReturnValue('trace-test'),
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn().mockReturnValue(mockDbChain.db),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  count: vi.fn(() => 'count()'),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => ({ type: 'sql', args })),
    { raw: vi.fn((s: string) => s) },
  ),
  crossLinks: {
    id: 'cross_links.id',
    tenantId: 'cross_links.tenant_id',
    sourceTableId: 'cross_links.source_table_id',
    sourceFieldId: 'cross_links.source_field_id',
    targetTableId: 'cross_links.target_table_id',
    targetDisplayFieldId: 'cross_links.target_display_field_id',
    relationshipType: 'cross_links.relationship_type',
    reverseFieldId: 'cross_links.reverse_field_id',
  },
  crossLinkIndex: {
    tenantId: 'cross_link_index.tenant_id',
    crossLinkId: 'cross_link_index.cross_link_id',
  },
  fields: {
    id: 'fields.id',
    tenantId: 'fields.tenant_id',
    tableId: 'fields.table_id',
    sortOrder: 'fields.sort_order',
  },
  records: {
    tenantId: 'records.tenant_id',
    tableId: 'records.table_id',
    canonicalData: 'records.canonical_data',
  },
  tables: {
    id: 'tables.id',
    tenantId: 'tables.tenant_id',
  },
  generateUUIDv7: vi.fn().mockReturnValue(GENERATED_UUID),
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@/lib/errors', () => {
  class ForbiddenError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'ForbiddenError';
    }
  }
  class NotFoundError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'NotFoundError';
    }
  }
  return {
    ForbiddenError,
    NotFoundError,
    wrapUnknownError: vi.fn((e: unknown) => e),
  };
});

vi.mock('@/data/cross-links', () => ({
  checkCrossLinkPermission: mockCheckCrossLinkPermission,
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import {
  createCrossLinkDefinition,
  updateCrossLinkDefinition,
  deleteCrossLinkDefinition,
} from '../cross-link-actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_CREATE_INPUT = {
  name: 'Project → Client',
  sourceTableId: SOURCE_TABLE_ID,
  sourceFieldId: SOURCE_FIELD_ID,
  targetTableId: TARGET_TABLE_ID,
  targetDisplayFieldId: TARGET_DISPLAY_FIELD_ID,
  relationshipType: 'many_to_one' as const,
};

const MOCK_CROSS_LINK = {
  id: GENERATED_UUID,
  tenantId: TENANT_ID,
  name: 'Project → Client',
  sourceTableId: SOURCE_TABLE_ID,
  sourceFieldId: SOURCE_FIELD_ID,
  targetTableId: TARGET_TABLE_ID,
  targetDisplayFieldId: TARGET_DISPLAY_FIELD_ID,
  relationshipType: 'many_to_one',
  reverseFieldId: null,
  linkScopeFilter: null,
  cardFields: [],
  maxLinksPerRecord: 50,
  maxDepth: 3,
  environment: 'live',
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setupSelectResults(...results: unknown[][]) {
  mockDbChain.selectResults.length = 0;
  mockDbChain.selectResults.push(...results);
  mockDbChain.resetCallIndices();
}

function setupInsertResults(...results: unknown[][]) {
  mockDbChain.insertResults.length = 0;
  mockDbChain.insertResults.push(...results);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createCrossLinkDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCrossLinkPermission.mockResolvedValue(true);
    mockDbChain.resetCallIndices();
    mockDbChain.selectResults.length = 0;
    mockDbChain.insertResults.length = 0;
  });

  it('creates definition with valid input', async () => {
    setupSelectResults(
      [{ id: SOURCE_TABLE_ID }], // source table tenant check
      [{ id: TARGET_TABLE_ID }], // target table tenant check
      [{ value: 5 }],            // definition count
    );
    setupInsertResults(
      [MOCK_CROSS_LINK],         // cross-link insert
    );

    const result = await createCrossLinkDefinition(VALID_CREATE_INPUT);

    expect(result).toEqual(MOCK_CROSS_LINK);
    expect(mockCheckCrossLinkPermission).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      SOURCE_TABLE_ID,
      TARGET_TABLE_ID,
      'create',
    );
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'cross_link.created',
        entityType: 'cross_link',
      }),
    );
  });

  it('creates reverse field when reverseFieldId is provided', async () => {
    setupSelectResults(
      [{ id: SOURCE_TABLE_ID }], // source table tenant check
      [{ id: TARGET_TABLE_ID }], // target table tenant check
      [{ value: 0 }],            // definition count
      [{ value: 5 }],            // max sort order in tx
    );
    // Only the cross-link insert calls .returning() — field insert does not
    setupInsertResults(
      [MOCK_CROSS_LINK],         // cross-link insert (only .returning() call)
    );

    const result = await createCrossLinkDefinition({
      ...VALID_CREATE_INPUT,
      reverseFieldId: REVERSE_FIELD_ID,
    });

    expect(result).toEqual(MOCK_CROSS_LINK);
    // Two inserts: reverse field + cross-link
    expect(mockDbChain.mockInsertValues).toHaveBeenCalledTimes(2);
  });

  it('blocks creation when MAX_DEFINITIONS_PER_TABLE limit reached', async () => {
    setupSelectResults(
      [{ id: SOURCE_TABLE_ID }], // source table
      [{ id: TARGET_TABLE_ID }], // target table
      [{ value: 20 }],           // count at limit
    );

    await expect(createCrossLinkDefinition(VALID_CREATE_INPUT)).rejects.toThrow(
      /Maximum of 20 cross-link definitions per table exceeded/,
    );
  });

  it('blocks creation when permission denied', async () => {
    mockCheckCrossLinkPermission.mockResolvedValue(false);
    setupSelectResults(
      [{ id: SOURCE_TABLE_ID }],
      [{ id: TARGET_TABLE_ID }],
      [{ value: 0 }],
    );

    await expect(createCrossLinkDefinition(VALID_CREATE_INPUT)).rejects.toThrow(
      /permission/i,
    );
  });

  it('blocks creation when table is in different tenant', async () => {
    setupSelectResults(
      [], // source table NOT found
    );

    await expect(createCrossLinkDefinition(VALID_CREATE_INPUT)).rejects.toThrow(
      /does not belong to this tenant/,
    );
  });
});

describe('updateCrossLinkDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCrossLinkPermission.mockResolvedValue(true);
    mockDbChain.resetCallIndices();
    mockDbChain.selectResults.length = 0;
    mockDbChain.insertResults.length = 0;
  });

  it('applies operational permission for name change', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK], // fetch existing
    );
    mockDbChain.mockUpdateReturning.mockResolvedValueOnce([
      { ...MOCK_CROSS_LINK, name: 'Updated Name' },
    ]);

    await updateCrossLinkDefinition(GENERATED_UUID, { name: 'Updated Name' });

    expect(mockCheckCrossLinkPermission).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      SOURCE_TABLE_ID,
      TARGET_TABLE_ID,
      'operational',
    );
  });

  it('applies structural permission for relationshipType change', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK],
    );
    mockDbChain.mockUpdateReturning.mockResolvedValueOnce([
      { ...MOCK_CROSS_LINK, relationshipType: 'one_to_many' },
    ]);

    await updateCrossLinkDefinition(GENERATED_UUID, {
      relationshipType: 'one_to_many',
    });

    expect(mockCheckCrossLinkPermission).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      SOURCE_TABLE_ID,
      TARGET_TABLE_ID,
      'structural',
    );
  });

  it('applies structural when mix of structural and operational fields', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK],
    );
    mockDbChain.mockUpdateReturning.mockResolvedValueOnce([
      { ...MOCK_CROSS_LINK, name: 'New', relationshipType: 'one_to_many' },
    ]);

    await updateCrossLinkDefinition(GENERATED_UUID, {
      name: 'New',
      relationshipType: 'one_to_many',
    });

    expect(mockCheckCrossLinkPermission).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      'structural',
    );
  });

  it('throws NotFoundError when definition does not exist', async () => {
    setupSelectResults([]); // not found

    await expect(
      updateCrossLinkDefinition('nonexistent-id', { name: 'X' }),
    ).rejects.toThrow(/not found/i);
  });

  it('writes audit log with changes detail', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK],
    );
    mockDbChain.mockUpdateReturning.mockResolvedValueOnce([
      { ...MOCK_CROSS_LINK, name: 'Updated' },
    ]);

    await updateCrossLinkDefinition(GENERATED_UUID, { name: 'Updated' });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'cross_link.updated',
        details: expect.objectContaining({
          changes: ['name'],
          permissionType: 'operational',
        }),
      }),
    );
  });
});

describe('deleteCrossLinkDefinition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCrossLinkPermission.mockResolvedValue(true);
    mockDbChain.resetCallIndices();
    mockDbChain.selectResults.length = 0;
    mockDbChain.insertResults.length = 0;
  });

  it('deletes definition and cascades cleanup', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK], // fetch existing
    );

    await deleteCrossLinkDefinition(GENERATED_UUID);

    // Should delete index entries + cross_links row (no reverse field)
    expect(mockDbChain.mockDeleteWhere).toHaveBeenCalledTimes(2);
    // Should update records to clear canonical data
    expect(mockDbChain.mockUpdateSet).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'cross_link.deleted',
        entityType: 'cross_link',
        entityId: GENERATED_UUID,
      }),
    );
  });

  it('deletes reverse field when it exists', async () => {
    const crossLinkWithReverse = {
      ...MOCK_CROSS_LINK,
      reverseFieldId: REVERSE_FIELD_ID,
    };
    setupSelectResults(
      [crossLinkWithReverse],
    );

    await deleteCrossLinkDefinition(GENERATED_UUID);

    // 3 deletes: index entries + reverse field + cross_links row
    expect(mockDbChain.mockDeleteWhere).toHaveBeenCalledTimes(3);
  });

  it('checks structural permission for delete', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK],
    );

    await deleteCrossLinkDefinition(GENERATED_UUID);

    expect(mockCheckCrossLinkPermission).toHaveBeenCalledWith(
      TENANT_ID,
      USER_ID,
      MOCK_CROSS_LINK.sourceTableId,
      MOCK_CROSS_LINK.targetTableId,
      'structural',
    );
  });

  it('throws NotFoundError when definition does not exist', async () => {
    setupSelectResults([]); // not found

    await expect(deleteCrossLinkDefinition('nonexistent-id')).rejects.toThrow(
      /not found/i,
    );
  });

  it('throws ForbiddenError when permission denied', async () => {
    setupSelectResults(
      [MOCK_CROSS_LINK],
    );
    mockCheckCrossLinkPermission.mockResolvedValue(false);

    await expect(deleteCrossLinkDefinition(GENERATED_UUID)).rejects.toThrow(
      /permission/i,
    );
  });
});
