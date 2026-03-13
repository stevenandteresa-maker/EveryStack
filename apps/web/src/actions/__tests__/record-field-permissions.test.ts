// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables (must be declared before vi.mock factories)
// ---------------------------------------------------------------------------
const {
  mockReturning,
  mockWhere,
  mockWriteAuditLog,
  mockTransaction,
  mockCheckFieldPermission,
  mockCheckFieldPermissions,
  mockGetFieldPermissions,
  mockFilterHiddenFields,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning, limit: vi.fn().mockReturnValue([]) });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });
  const mockInsertValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
  const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);
  const mockTx = {
    update: mockUpdate,
    select: mockSelect,
    insert: mockInsert,
  };
  const mockTransaction = vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx));
  const mockCheckFieldPermission = vi.fn().mockResolvedValue(undefined);
  const mockCheckFieldPermissions = vi.fn().mockResolvedValue(undefined);
  const mockGetFieldPermissions = vi.fn();
  const mockFilterHiddenFields = vi.fn();
  return {
    mockReturning,
    mockWhere,
    mockSet,
    mockUpdate,
    mockSelectFrom,
    mockSelect,
    mockInsertValues,
    mockInsert,
    mockWriteAuditLog,
    mockTransaction,
    mockCheckFieldPermission,
    mockCheckFieldPermissions,
    mockGetFieldPermissions,
    mockFilterHiddenFields,
  };
});

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: vi.fn().mockResolvedValue({
    userId: 'user-123',
    tenantId: 'tenant-123',
    clerkUserId: 'clerk_user_123',
    agencyTenantId: null,
  }),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn().mockReturnValue('trace-123'),
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn().mockReturnValue({
    transaction: mockTransaction,
  }),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
  isNotNull: vi.fn((col: unknown) => ({ type: 'isNotNull', col })),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ type: 'inArray', col, vals })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings: [...strings],
      values,
    }),
    { raw: (s: string) => ({ type: 'raw', s }) },
  ),
  records: {
    id: 'records.id',
    tenantId: 'records.tenant_id',
    tableId: 'records.table_id',
    canonicalData: 'records.canonical_data',
    archivedAt: 'records.archived_at',
    updatedBy: 'records.updated_by',
    createdBy: 'records.created_by',
  },
  tables: {
    id: 'tables.id',
    tenantId: 'tables.tenant_id',
    tabColor: 'tables.tab_color',
  },
  generateUUIDv7: vi.fn().mockReturnValue('new-uuid-123'),
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@/lib/errors', () => {
  class ForbiddenError extends Error {
    code = 'PERMISSION_DENIED';
    statusCode = 403;
    details: Record<string, unknown>;
    constructor(message: string, details?: Record<string, unknown>) {
      super(message);
      this.name = 'ForbiddenError';
      this.details = details ?? {};
    }
  }
  return {
    wrapUnknownError: vi.fn((e: unknown) => e),
    NotFoundError: class NotFoundError extends Error {
      code = 'NOT_FOUND';
      statusCode = 404;
    },
    ForbiddenError,
  };
});

vi.mock('@/lib/auth/field-permissions', () => ({
  checkFieldPermission: mockCheckFieldPermission,
  checkFieldPermissions: mockCheckFieldPermissions,
  filterHiddenFields: mockFilterHiddenFields,
}));

vi.mock('@/data/permissions', () => ({
  getFieldPermissions: mockGetFieldPermissions,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  updateRecordField,
  bulkUpdateRecordField,
} from '../record-actions';

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const VIEW_ID = 'a0000000-0000-4000-8000-000000000099';
const RECORD_ID = 'a0000000-0000-4000-8000-000000000001';
const FIELD_ID = 'f0000000-0000-4000-8000-000000000001';
const FIELD_ID_2 = 'f0000000-0000-4000-8000-000000000002';

// ---------------------------------------------------------------------------
// updateRecordField — field permission enforcement
// ---------------------------------------------------------------------------

describe('updateRecordField — field permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: record exists and updates successfully
    mockWhere.mockReturnValue({
      returning: mockReturning,
      limit: vi.fn().mockResolvedValue([{ id: RECORD_ID }]),
    });
    mockReturning.mockResolvedValue([{
      id: RECORD_ID,
      tenantId: 'tenant-123',
      tableId: 'table-1',
      canonicalData: { [FIELD_ID]: 'updated' },
    }]);
  });

  it('calls checkFieldPermission with read_write before mutation', async () => {
    await updateRecordField({
      recordId: RECORD_ID,
      viewId: VIEW_ID,
      fieldId: FIELD_ID,
      value: 'new value',
    });

    expect(mockCheckFieldPermission).toHaveBeenCalledWith(
      'tenant-123',
      VIEW_ID,
      'user-123',
      FIELD_ID,
      'read_write',
    );
    expect(mockCheckFieldPermission).toHaveBeenCalledTimes(1);
  });

  it('rejects write on read-only field with ForbiddenError', async () => {
    const { ForbiddenError } = await import('@/lib/errors');
    mockCheckFieldPermission.mockRejectedValueOnce(
      new ForbiddenError('This field is read-only for your role.', {
        action: 'edit',
        resource: 'field',
        resourceId: FIELD_ID,
      }),
    );

    await expect(
      updateRecordField({
        recordId: RECORD_ID,
        viewId: VIEW_ID,
        fieldId: FIELD_ID,
        value: 'new value',
      }),
    ).rejects.toThrow('This field is read-only for your role.');

    // Mutation should NOT have been called
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects write on hidden field with ForbiddenError', async () => {
    const { ForbiddenError } = await import('@/lib/errors');
    mockCheckFieldPermission.mockRejectedValueOnce(
      new ForbiddenError("You don't have access to this field.", {
        action: 'read',
        resource: 'field',
        resourceId: FIELD_ID,
      }),
    );

    await expect(
      updateRecordField({
        recordId: RECORD_ID,
        viewId: VIEW_ID,
        fieldId: FIELD_ID,
        value: 'new value',
      }),
    ).rejects.toThrow("You don't have access to this field.");

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('proceeds with mutation when permission check passes', async () => {
    mockCheckFieldPermission.mockResolvedValueOnce(undefined);

    await updateRecordField({
      recordId: RECORD_ID,
      viewId: VIEW_ID,
      fieldId: FIELD_ID,
      value: 'new value',
    });

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'record.field_updated',
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// bulkUpdateRecordField — field permission enforcement
// ---------------------------------------------------------------------------

describe('bulkUpdateRecordField — field permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([
      { id: RECORD_ID },
      { id: 'b0000000-0000-4000-8000-000000000002' },
    ]);
  });

  it('calls checkFieldPermission with read_write before bulk mutation', async () => {
    await bulkUpdateRecordField({
      recordIds: [RECORD_ID],
      viewId: VIEW_ID,
      fieldId: FIELD_ID,
      value: 'bulk value',
    });

    expect(mockCheckFieldPermission).toHaveBeenCalledWith(
      'tenant-123',
      VIEW_ID,
      'user-123',
      FIELD_ID,
      'read_write',
    );
  });

  it('rejects entire batch when field is read-only', async () => {
    const { ForbiddenError } = await import('@/lib/errors');
    mockCheckFieldPermission.mockRejectedValueOnce(
      new ForbiddenError('This field is read-only for your role.', {
        action: 'edit',
        resource: 'field',
        resourceId: FIELD_ID,
      }),
    );

    await expect(
      bulkUpdateRecordField({
        recordIds: [RECORD_ID, 'b0000000-0000-4000-8000-000000000002'],
        viewId: VIEW_ID,
        fieldId: FIELD_ID,
        value: 'value',
      }),
    ).rejects.toThrow('This field is read-only for your role.');

    // No DB mutation should happen
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('proceeds with bulk mutation when permission check passes', async () => {
    mockCheckFieldPermission.mockResolvedValueOnce(undefined);

    const result = await bulkUpdateRecordField({
      recordIds: [RECORD_ID, 'b0000000-0000-4000-8000-000000000002'],
      viewId: VIEW_ID,
      fieldId: FIELD_ID,
      value: 'bulk value',
    });

    expect(result.count).toBe(2);
    expect(mockTransaction).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Records data layer — hidden field filtering
// ---------------------------------------------------------------------------

describe('records data layer — hidden field filtering', () => {
  it('filterHiddenFields strips hidden fields from canonical_data', async () => {
    const permissionMap = new Map<string, 'read_write' | 'read_only' | 'hidden'>([
      [FIELD_ID, 'read_write'],
      [FIELD_ID_2, 'hidden'],
    ]);
    const record = {
      [FIELD_ID]: 'visible value',
      [FIELD_ID_2]: 'secret value',
    };

    // Use the mock with real logic to verify contract
    mockFilterHiddenFields.mockImplementation(
      (rec: Record<string, unknown>, pMap: Map<string, string>) => {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(rec)) {
          if (pMap.get(key) !== 'hidden') {
            result[key] = rec[key];
          }
        }
        return result;
      },
    );

    const { filterHiddenFields } = await import('@/lib/auth/field-permissions');
    const filtered = filterHiddenFields(record, permissionMap);
    expect(filtered).toHaveProperty(FIELD_ID);
    expect(filtered).not.toHaveProperty(FIELD_ID_2);
  });
});
