// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock variables (must be declared before vi.mock factories)
// ---------------------------------------------------------------------------
const {
  mockTransaction,
  mockWhere,
  mockSelect,
  mockWriteAuditLog,
  mockResolveEffectiveRole,
  mockInvalidatePermissionCache,
  mockPublishPermissionUpdate,
} = vi.hoisted(() => {
  const mockWhere = vi.fn().mockReturnValue({
    returning: vi.fn().mockResolvedValue([]),
    limit: vi.fn().mockResolvedValue([]),
  });
  const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });
  const mockSelectFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockSelectFrom });
  const mockWriteAuditLog = vi.fn().mockResolvedValue(undefined);
  const mockTx = { update: mockUpdate, select: mockSelect };
  const mockTransaction = vi.fn().mockImplementation(
    async (fn: (tx: typeof mockTx) => unknown) => fn(mockTx),
  );
  const mockResolveEffectiveRole = vi.fn();
  const mockInvalidatePermissionCache = vi.fn().mockResolvedValue(undefined);
  const mockPublishPermissionUpdate = vi.fn().mockResolvedValue(undefined);
  return {
    mockTransaction,
    mockWhere,
    mockSet,
    mockUpdate,
    mockSelect,
    mockSelectFrom,
    mockWriteAuditLog,
    mockResolveEffectiveRole,
    mockInvalidatePermissionCache,
    mockPublishPermissionUpdate,
  };
});

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: vi.fn().mockResolvedValue({
    userId: 'user-aaa',
    tenantId: 'tenant-aaa',
    clerkUserId: 'clerk_user_aaa',
    agencyTenantId: null,
  }),
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn().mockReturnValue('trace-test'),
}));

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn().mockReturnValue({
    transaction: mockTransaction,
    select: mockSelect,
  }),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  views: {
    id: 'views.id',
    tenantId: 'views.tenant_id',
    tableId: 'views.table_id',
    permissions: 'views.permissions',
  },
  fields: {
    id: 'fields.id',
    tenantId: 'fields.tenant_id',
    permissions: 'fields.permissions',
  },
  writeAuditLog: mockWriteAuditLog,
}));

vi.mock('@everystack/shared/auth', async () => {
  const actual = await vi.importActual('@everystack/shared/auth') as Record<string, unknown>;
  return {
    ...actual,
    resolveEffectiveRole: mockResolveEffectiveRole,
  };
});

vi.mock('@/lib/errors', () => ({
  wrapUnknownError: vi.fn((e: unknown) => e),
}));

vi.mock('@/data/permissions', () => ({
  invalidatePermissionCache: mockInvalidatePermissionCache,
}));

vi.mock('@/lib/realtime/permission-events', () => ({
  publishPermissionUpdate: mockPublishPermissionUpdate,
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  updateViewPermissions,
  updateFieldGlobalPermissions,
} from '../permission-actions';

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const VIEW_ID = 'a0000000-0000-4000-8000-000000000001';
const TABLE_ID = 'b0000000-0000-4000-8000-000000000001';
const WORKSPACE_ID = 'c0000000-0000-4000-8000-000000000001';
const FIELD_ID = 'f0000000-0000-4000-8000-000000000001';

// ---------------------------------------------------------------------------
// Base valid inputs
// ---------------------------------------------------------------------------

const validViewPermissionsInput = {
  viewId: VIEW_ID,
  workspaceId: WORKSPACE_ID,
  tableId: TABLE_ID,
  permissions: {
    roles: [] as Array<'team_member' | 'viewer'>,
    specificUsers: [] as string[],
    excludedUsers: [] as string[],
    fieldPermissions: {
      roleRestrictions: [
        {
          tableId: TABLE_ID,
          role: 'team_member' as const,
          fieldId: FIELD_ID,
          accessState: 'read_only' as const,
        },
      ],
      individualOverrides: [],
    },
  },
};

const validFieldPermissionsInput = {
  fieldId: FIELD_ID,
  workspaceId: WORKSPACE_ID,
  tableId: TABLE_ID,
  permissions: {
    member_edit: false,
    viewer_visible: true,
    portal_visible: true,
    portal_editable: false,
  },
};

// ---------------------------------------------------------------------------
// updateViewPermissions
// ---------------------------------------------------------------------------

describe('updateViewPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates input with Zod — rejects invalid viewId', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');

    await expect(
      updateViewPermissions({
        ...validViewPermissionsInput,
        viewId: 'not-a-uuid',
      }),
    ).rejects.toThrow();

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects non-Manager users', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    await expect(
      updateViewPermissions(validViewPermissionsInput),
    ).rejects.toThrow("You don't have permission to configure view permissions.");

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects users with no role (null)', async () => {
    mockResolveEffectiveRole.mockResolvedValue(null);

    await expect(
      updateViewPermissions(validViewPermissionsInput),
    ).rejects.toThrow("You don't have permission to configure view permissions.");

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('Manager cannot configure Manager restrictions', async () => {
    mockResolveEffectiveRole.mockResolvedValue('manager');

    const inputWithManagerRestriction = {
      ...validViewPermissionsInput,
      permissions: {
        ...validViewPermissionsInput.permissions,
        fieldPermissions: {
          roleRestrictions: [
            {
              tableId: TABLE_ID,
              role: 'manager' as const,
              fieldId: FIELD_ID,
              accessState: 'read_only' as const,
            },
          ],
          individualOverrides: [],
        },
      },
    };

    await expect(
      updateViewPermissions(inputWithManagerRestriction),
    ).rejects.toThrow('Only admins can configure permissions for the Manager role.');

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('Admin can configure Manager restrictions', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');

    const inputWithManagerRestriction = {
      ...validViewPermissionsInput,
      permissions: {
        ...validViewPermissionsInput.permissions,
        fieldPermissions: {
          roleRestrictions: [
            {
              tableId: TABLE_ID,
              role: 'manager' as const,
              fieldId: FIELD_ID,
              accessState: 'read_only' as const,
            },
          ],
          individualOverrides: [],
        },
      },
    };

    await updateViewPermissions(inputWithManagerRestriction);

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'view.permissions_updated',
        entityId: VIEW_ID,
      }),
    );
  });

  it('Manager can configure Team Member restrictions', async () => {
    mockResolveEffectiveRole.mockResolvedValue('manager');

    await updateViewPermissions(validViewPermissionsInput);

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalled();
  });

  it('triggers cache invalidation + real-time event after save', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');

    await updateViewPermissions(validViewPermissionsInput);

    expect(mockInvalidatePermissionCache).toHaveBeenCalledWith(
      'tenant-aaa',
      VIEW_ID,
    );
    expect(mockPublishPermissionUpdate).toHaveBeenCalledWith(
      'tenant-aaa',
      VIEW_ID,
      TABLE_ID,
    );
  });
});

// ---------------------------------------------------------------------------
// updateFieldGlobalPermissions
// ---------------------------------------------------------------------------

describe('updateFieldGlobalPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return 2 views for the table
    mockWhere.mockReturnValue([
      { id: VIEW_ID },
      { id: 'a0000000-0000-4000-8000-000000000099' },
    ]);
  });

  it('validates input with Zod — rejects invalid fieldId', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');

    await expect(
      updateFieldGlobalPermissions({
        ...validFieldPermissionsInput,
        fieldId: 'not-uuid',
      }),
    ).rejects.toThrow();

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects non-Admin users (Manager)', async () => {
    mockResolveEffectiveRole.mockResolvedValue('manager');

    await expect(
      updateFieldGlobalPermissions(validFieldPermissionsInput),
    ).rejects.toThrow("You don't have permission to change field-level permissions.");

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('rejects Team Member users', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    await expect(
      updateFieldGlobalPermissions(validFieldPermissionsInput),
    ).rejects.toThrow("You don't have permission to change field-level permissions.");

    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('Admin can update field global permissions', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');

    await updateFieldGlobalPermissions(validFieldPermissionsInput);

    expect(mockTransaction).toHaveBeenCalled();
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'field.permissions_updated',
        entityId: FIELD_ID,
      }),
    );
  });

  it('Owner can update field global permissions', async () => {
    mockResolveEffectiveRole.mockResolvedValue('owner');

    await updateFieldGlobalPermissions(validFieldPermissionsInput);

    expect(mockTransaction).toHaveBeenCalled();
  });

  it('invalidates all affected view caches', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');

    // Mock the select query to return affected views
    const VIEW_2 = 'a0000000-0000-4000-8000-000000000099';
    // The getDbForTenant().select() call outside the transaction returns views
    const { getDbForTenant } = await import('@everystack/shared/db');
    const mockDbSelect = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { id: VIEW_ID },
          { id: VIEW_2 },
        ]),
      }),
    });
    (getDbForTenant as ReturnType<typeof vi.fn>).mockReturnValue({
      transaction: mockTransaction,
      select: mockDbSelect,
    });

    await updateFieldGlobalPermissions(validFieldPermissionsInput);

    // Should invalidate cache for each view
    expect(mockInvalidatePermissionCache).toHaveBeenCalledWith('tenant-aaa', VIEW_ID);
    expect(mockInvalidatePermissionCache).toHaveBeenCalledWith('tenant-aaa', VIEW_2);

    // Should publish permission update for each view
    expect(mockPublishPermissionUpdate).toHaveBeenCalledWith('tenant-aaa', VIEW_ID, TABLE_ID);
    expect(mockPublishPermissionUpdate).toHaveBeenCalledWith('tenant-aaa', VIEW_2, TABLE_ID);
  });
});
