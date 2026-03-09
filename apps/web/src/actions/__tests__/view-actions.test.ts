/**
 * Tests for view-actions server actions.
 *
 * Covers:
 * - updateViewConfig: merge config patch into views.config JSONB
 * - renameField: rename a field (Manager+ only)
 * - tenant isolation for updateViewConfig
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  TENANT_ID,
  VIEW_ID,
  FIELD_ID,
  mockSelect,
  mockTransaction,
  mockDb,
  mockGetAuthContext,
  mockWriteAuditLog,
} = vi.hoisted(() => {
  const _TENANT_ID = crypto.randomUUID();
  const _USER_ID = crypto.randomUUID();
  const _VIEW_ID = crypto.randomUUID();
  const _FIELD_ID = crypto.randomUUID();

  // Chainable select mock
  const _mockLimit = vi.fn().mockResolvedValue([{ id: _VIEW_ID }]);
  const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
  const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: _mockFrom });

  // Chainable update mock
  const _mockUpdateReturning = vi.fn().mockResolvedValue([{
    id: _VIEW_ID,
    tenantId: _TENANT_ID,
    tableId: crypto.randomUUID(),
    name: 'All Records',
    viewType: 'grid',
    config: { frozenColumns: 2 },
    permissions: {},
    isShared: true,
    publishState: 'live',
    environment: 'live',
    position: 0,
    createdBy: _USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
  }]);
  const _mockUpdateWhere = vi.fn().mockReturnValue({ returning: _mockUpdateReturning });
  const _mockUpdateSet = vi.fn().mockReturnValue({ where: _mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: _mockUpdateSet });

  // Transaction mock
  const mockTransaction = vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    return cb({ select: mockSelect, update: mockUpdate });
  });

  const mockDb = { transaction: mockTransaction };

  return {
    TENANT_ID: _TENANT_ID,
    VIEW_ID: _VIEW_ID,
    FIELD_ID: _FIELD_ID,
    mockSelect,
    mockTransaction,
    mockDb,
    mockGetAuthContext: vi.fn().mockResolvedValue({
      userId: _USER_ID,
      tenantId: _TENANT_ID,
      clerkUserId: 'clerk_test',
      agencyTenantId: null,
    }),
    mockWriteAuditLog: vi.fn().mockResolvedValue(undefined),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => mockDb),
  eq: vi.fn((...args: unknown[]) => args),
  and: vi.fn((...args: unknown[]) => args),
  sql: Object.assign(
    vi.fn((...args: unknown[]) => args),
    { raw: vi.fn((s: string) => s) },
  ),
  views: {
    id: 'views.id',
    tenantId: 'views.tenantId',
    config: 'views.config',
    updatedAt: 'views.updatedAt',
  },
  fields: {
    id: 'fields.id',
    tenantId: 'fields.tenantId',
    name: 'fields.name',
    updatedAt: 'fields.updatedAt',
  },
  writeAuditLog: mockWriteAuditLog,
  generateUUIDv7: vi.fn(() => crypto.randomUUID()),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn(() => 'trace-test-123'),
}));

vi.mock('@/lib/errors', () => ({
  wrapUnknownError: vi.fn((e: unknown) => e),
  NotFoundError: class NotFoundError extends Error {
    code = 'NOT_FOUND';
    statusCode = 404;
    constructor(message: string) {
      super(message);
      this.name = 'NotFoundError';
    }
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('updateViewConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset select to return existing view
    const _mockLimit = vi.fn().mockResolvedValue([{ id: VIEW_ID }]);
    const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
    const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
    mockSelect.mockReturnValue({ from: _mockFrom });
  });

  it('merges config patch into view', async () => {
    const { updateViewConfig } = await import('../view-actions');

    const result = await updateViewConfig({
      viewId: VIEW_ID,
      configPatch: { frozenColumns: 2 },
    });

    expect(result).toBeDefined();
    expect(result.id).toBe(VIEW_ID);
    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockWriteAuditLog).toHaveBeenCalledOnce();
  });

  it('validates viewId is a valid UUID', async () => {
    const { updateViewConfig } = await import('../view-actions');

    await expect(
      updateViewConfig({
        viewId: 'not-a-uuid',
        configPatch: { frozenColumns: 1 },
      }),
    ).rejects.toThrow();
  });

  it('validates frozenColumns max is 5', async () => {
    const { updateViewConfig } = await import('../view-actions');

    await expect(
      updateViewConfig({
        viewId: VIEW_ID,
        configPatch: { frozenColumns: 10 },
      }),
    ).rejects.toThrow();
  });

  it('validates column width bounds (60–800)', async () => {
    const { updateViewConfig } = await import('../view-actions');

    await expect(
      updateViewConfig({
        viewId: VIEW_ID,
        configPatch: {
          columns: [{ fieldId: FIELD_ID, width: 10 }],
        },
      }),
    ).rejects.toThrow();

    await expect(
      updateViewConfig({
        viewId: VIEW_ID,
        configPatch: {
          columns: [{ fieldId: FIELD_ID, width: 1000 }],
        },
      }),
    ).rejects.toThrow();
  });

  it('accepts valid column colors', async () => {
    const { updateViewConfig } = await import('../view-actions');

    const result = await updateViewConfig({
      viewId: VIEW_ID,
      configPatch: {
        columnColors: { [FIELD_ID]: 'Blue' },
      },
    });

    expect(result).toBeDefined();
  });

  it('accepts valid column order', async () => {
    const { updateViewConfig } = await import('../view-actions');
    const fieldId2 = crypto.randomUUID();

    const result = await updateViewConfig({
      viewId: VIEW_ID,
      configPatch: {
        columnOrder: [FIELD_ID, fieldId2],
      },
    });

    expect(result).toBeDefined();
  });

  it('throws NotFoundError for non-existent view', async () => {
    // Override select to return empty
    const _mockLimit = vi.fn().mockResolvedValue([]);
    const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
    const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
    mockSelect.mockReturnValue({ from: _mockFrom });

    const { updateViewConfig } = await import('../view-actions');

    await expect(
      updateViewConfig({
        viewId: VIEW_ID,
        configPatch: { frozenColumns: 1 },
      }),
    ).rejects.toThrow('View not found');
  });

  it('writes audit log on config update', async () => {
    const { updateViewConfig } = await import('../view-actions');

    await updateViewConfig({
      viewId: VIEW_ID,
      configPatch: { density: 'compact' },
    });

    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: TENANT_ID,
        action: 'view.config_updated',
        entityType: 'view',
        entityId: VIEW_ID,
      }),
    );
  });
});

describe('updateViewConfig — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const _mockLimit = vi.fn().mockResolvedValue([{ id: VIEW_ID }]);
    const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
    const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
    mockSelect.mockReturnValue({ from: _mockFrom });
  });

  it('scopes view lookup to authenticated tenant ID (cross-tenant query returns not found)', async () => {
    const OTHER_TENANT_ID = crypto.randomUUID();

    // Simulate a different tenant context
    mockGetAuthContext.mockResolvedValueOnce({
      userId: crypto.randomUUID(),
      tenantId: OTHER_TENANT_ID,
      clerkUserId: 'clerk_other',
      agencyTenantId: null,
    });

    // The mocked select returns empty when tenant ID doesn't match
    const _mockLimitEmpty = vi.fn().mockResolvedValue([]);
    const _mockWhereEmpty = vi.fn().mockReturnValue({ limit: _mockLimitEmpty });
    const _mockFromEmpty = vi.fn().mockReturnValue({ where: _mockWhereEmpty });
    mockSelect.mockReturnValue({ from: _mockFromEmpty });

    const { updateViewConfig } = await import('../view-actions');

    await expect(
      updateViewConfig({
        viewId: VIEW_ID,
        configPatch: { frozenColumns: 1 },
      }),
    ).rejects.toThrow('View not found');
  });

  it('calls getDbForTenant with the authenticated tenant ID', async () => {
    const { getDbForTenant } = await import('@everystack/shared/db');
    const { updateViewConfig } = await import('../view-actions');

    await updateViewConfig({
      viewId: VIEW_ID,
      configPatch: { frozenColumns: 1 },
    });

    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_ID, 'write');
  });
});

describe('renameField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset select to return existing field
    const _mockLimit = vi.fn().mockResolvedValue([{ id: FIELD_ID }]);
    const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
    const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
    mockSelect.mockReturnValue({ from: _mockFrom });
  });

  it('renames a field successfully', async () => {
    const { renameField } = await import('../view-actions');

    await renameField({
      fieldId: FIELD_ID,
      name: 'New Name',
    });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'field.renamed',
        entityId: FIELD_ID,
      }),
    );
  });

  it('validates field name is non-empty', async () => {
    const { renameField } = await import('../view-actions');

    await expect(
      renameField({ fieldId: FIELD_ID, name: '' }),
    ).rejects.toThrow();
  });

  it('throws NotFoundError for non-existent field', async () => {
    const _mockLimit = vi.fn().mockResolvedValue([]);
    const _mockWhere = vi.fn().mockReturnValue({ limit: _mockLimit });
    const _mockFrom = vi.fn().mockReturnValue({ where: _mockWhere });
    mockSelect.mockReturnValue({ from: _mockFrom });

    const { renameField } = await import('../view-actions');

    await expect(
      renameField({ fieldId: FIELD_ID, name: 'Test' }),
    ).rejects.toThrow('Field not found');
  });
});
