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
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
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

vi.mock('@/lib/errors', () => ({
  wrapUnknownError: vi.fn((e: unknown) => e),
  NotFoundError: class NotFoundError extends Error {
    code = 'NOT_FOUND';
    statusCode = 404;
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  bulkDeleteRecords,
  bulkUpdateRecordField,
  duplicateRecords,
} from '../record-actions';
import { getDbForTenant } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bulkDeleteRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([
      { id: 'a0000000-0000-4000-8000-000000000001' },
      { id: 'b0000000-0000-4000-8000-000000000002' },
    ]);
  });

  it('soft-deletes multiple records and returns count', async () => {
    const result = await bulkDeleteRecords({
      recordIds: ['a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'],
    });

    expect(result.count).toBe(2);
    expect(getDbForTenant).toHaveBeenCalledWith('tenant-123', 'write');
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'record.bulk_deleted',
        tenantId: 'tenant-123',
      }),
    );
  });

  it('validates max 500 record IDs', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) =>
      `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );

    await expect(
      bulkDeleteRecords({ recordIds: tooMany }),
    ).rejects.toThrow();
  });

  it('validates non-empty recordIds', async () => {
    await expect(
      bulkDeleteRecords({ recordIds: [] }),
    ).rejects.toThrow();
  });

  it('uses getAuthContext for tenant isolation', async () => {
    await bulkDeleteRecords({ recordIds: ['a0000000-0000-4000-8000-000000000001'] });

    const { getAuthContext } = await import('@/lib/auth-context');
    expect(getAuthContext).toHaveBeenCalled();
  });
});

describe('bulkUpdateRecordField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([
      { id: 'a0000000-0000-4000-8000-000000000001' },
      { id: 'b0000000-0000-4000-8000-000000000002' },
    ]);
  });

  it('updates a field on multiple records and returns count', async () => {
    const result = await bulkUpdateRecordField({
      recordIds: ['a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'],
      fieldId: 'a0000000-0000-4000-8000-000000000001',
      value: 'new value',
    });

    expect(result.count).toBe(2);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'record.bulk_field_updated',
      }),
    );
  });

  it('validates max 500 record IDs', async () => {
    const tooMany = Array.from({ length: 501 }, (_, i) =>
      `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );

    await expect(
      bulkUpdateRecordField({
        recordIds: tooMany,
        fieldId: 'a0000000-0000-4000-8000-000000000001',
        value: 'test',
      }),
    ).rejects.toThrow();
  });
});

describe('duplicateRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock select for fetching existing records
    mockWhere.mockResolvedValue([
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        tableId: 'table-1',
        tenantId: 'tenant-123',
        canonicalData: { field1: 'value1' },
      },
      {
        id: 'b0000000-0000-4000-8000-000000000002',
        tableId: 'table-1',
        tenantId: 'tenant-123',
        canonicalData: { field1: 'value2' },
      },
    ]);
    mockReturning.mockResolvedValue([]);
  });

  it('duplicates records and returns new IDs', async () => {
    const result = await duplicateRecords({
      recordIds: ['a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000002'],
    });

    expect(result.newRecordIds).toHaveLength(2);
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'record.bulk_duplicated',
      }),
    );
  });

  it('validates max 100 record IDs', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) =>
      `a0000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    );

    await expect(
      duplicateRecords({ recordIds: tooMany }),
    ).rejects.toThrow();
  });

  it('uses tenant-scoped write DB', async () => {
    await duplicateRecords({ recordIds: ['a0000000-0000-4000-8000-000000000001'] });

    expect(getDbForTenant).toHaveBeenCalledWith('tenant-123', 'write');
  });
});
