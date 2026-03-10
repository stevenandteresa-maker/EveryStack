/**
 * Integration tests for CSV import server action.
 *
 * Tests tenant isolation, role checks, synced table blocking,
 * and plan quota enforcement.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestWorkspace,
  createTestTable,
  createTestField,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getDbForTenant, records, eq, and, isNull } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockGetAuthContext,
  mockRequireRole,
  mockCheckRecordQuota,
  mockIncrementQuotaCache,
} = vi.hoisted(() => ({
  mockGetAuthContext: vi.fn(),
  mockRequireRole: vi.fn().mockResolvedValue(undefined),
  mockCheckRecordQuota: vi.fn().mockResolvedValue({
    currentCount: 0,
    planQuota: 10_000,
    remaining: 10_000,
    exceeded: false,
  }),
  mockIncrementQuotaCache: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('@everystack/shared/auth', () => ({
  requireRole: mockRequireRole,
}));

vi.mock('@everystack/shared/sync', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    checkRecordQuota: mockCheckRecordQuota,
    incrementQuotaCache: mockIncrementQuotaCache,
  };
});

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn().mockReturnValue('test-trace-id'),
  createLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { importRecords } from '@/actions/import-actions';

// ---------------------------------------------------------------------------
// Helper: create fresh test data per test
// ---------------------------------------------------------------------------

async function createTestSetup() {
  const tenant = await createTestTenant({ name: 'Import Test Tenant' });
  const user = await createTestUser();
  const workspace = await createTestWorkspace({ tenantId: tenant.id, name: 'Import WS' });
  const table = await createTestTable({ workspaceId: workspace.id, tenantId: tenant.id, name: 'Import Table' });
  const field = await createTestField({
    tableId: table.id,
    tenantId: tenant.id,
    name: 'Name',
    fieldType: 'text',
    isPrimary: true,
  });

  mockGetAuthContext.mockResolvedValue({
    userId: user.id,
    tenantId: tenant.id,
    clerkUserId: 'clerk_test',
    agencyTenantId: null,
  });

  return { tenant, user, workspace, table, field };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('importRecords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue(undefined);
    mockCheckRecordQuota.mockResolvedValue({
      currentCount: 0,
      planQuota: 10_000,
      remaining: 10_000,
      exceeded: false,
    });
  });

  it('imports records into a table', async () => {
    const { tenant, table, field } = await createTestSetup();

    const result = await importRecords({
      tableId: table.id,
      rows: [
        { [field.id]: 'Alice' },
        { [field.id]: 'Bob' },
      ],
    });

    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.errors).toHaveLength(0);

    // Verify records exist in DB
    const db = getDbForTenant(tenant.id, 'read');
    const importedRecords = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenant.id),
          eq(records.tableId, table.id),
          isNull(records.archivedAt),
        ),
      );

    expect(importedRecords.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it('allows import into non-synced tables', async () => {
    const { table, field } = await createTestSetup();

    const result = await importRecords({
      tableId: table.id,
      rows: [{ [field.id]: 'Test' }],
    });

    // No synced_field_mappings → should succeed
    expect(result.imported).toBe(1);
  }, 30_000);

  it('checks Manager+ role', async () => {
    const { tenant, user, table, field } = await createTestSetup();

    await importRecords({
      tableId: table.id,
      rows: [{ [field.id]: 'Test' }],
    });

    expect(mockRequireRole).toHaveBeenCalledWith(
      user.id,
      tenant.id,
      undefined,
      'manager',
      'record',
      'import',
    );
  }, 30_000);

  it('rejects when plan quota is exceeded', async () => {
    const { table, field } = await createTestSetup();

    mockCheckRecordQuota.mockResolvedValueOnce({
      currentCount: 10_000,
      planQuota: 10_000,
      remaining: 0,
      exceeded: true,
    });

    await expect(
      importRecords({
        tableId: table.id,
        rows: [{ [field.id]: 'Test' }],
      }),
    ).rejects.toThrow(/record limit/i);
  }, 30_000);

  it('truncates import when quota partially exceeded', async () => {
    const { table, field } = await createTestSetup();

    mockCheckRecordQuota.mockResolvedValueOnce({
      currentCount: 9_998,
      planQuota: 10_000,
      remaining: 2,
      exceeded: false,
    });

    const result = await importRecords({
      tableId: table.id,
      rows: [
        { [field.id]: 'Row 1' },
        { [field.id]: 'Row 2' },
        { [field.id]: 'Row 3' },
        { [field.id]: 'Row 4' },
      ],
    });

    // Only 2 should be imported (quota remaining = 2)
    expect(result.imported).toBe(2);
    // 2 skipped due to quota
    expect(result.errors.length).toBe(2);
    expect(result.errors[0]!.error).toContain('exceed plan record limit');
  }, 30_000);

  // Tenant isolation test
  it('enforces tenant isolation', async () => {
    const user = await createTestUser();

    await testTenantIsolation({
      setup: async (tenantId) => {
        const workspace = await createTestWorkspace({ tenantId, name: 'Isolation WS' });
        const table = await createTestTable({ workspaceId: workspace.id, tenantId, name: 'Isolation Table' });
        const field = await createTestField({
          tableId: table.id,
          tenantId,
          name: 'Name',
          fieldType: 'text',
          isPrimary: true,
        });

        mockGetAuthContext.mockResolvedValue({
          userId: user.id,
          tenantId,
          clerkUserId: 'clerk_test',
          agencyTenantId: null,
        });

        await importRecords({
          tableId: table.id,
          rows: [{ [field.id]: 'Isolation Test' }],
        });
      },
      query: async (tenantId) => {
        const db = getDbForTenant(tenantId, 'read');
        return db
          .select()
          .from(records)
          .where(
            and(
              eq(records.tenantId, tenantId),
              isNull(records.archivedAt),
            ),
          );
      },
    });
  }, 30_000);
});
