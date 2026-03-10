/**
 * Integration tests for bulk record action server actions.
 *
 * Tests tenant isolation via `testTenantIsolation()` for:
 * - bulkDeleteRecords
 * - bulkUpdateRecordField
 * - duplicateRecords
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestWorkspace,
  createTestTable,
  createTestField,
  createTestRecord,
  testTenantIsolation,
} from '@everystack/shared/testing';
import {
  getDbForTenant,
  records,
  eq,
  and,
  isNull,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGetAuthContext } = vi.hoisted(() => ({
  mockGetAuthContext: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/auth-context', () => ({
  getAuthContext: mockGetAuthContext,
}));

vi.mock('@everystack/shared/logging', () => ({
  getTraceId: vi.fn().mockReturnValue('test-trace-id'),
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import {
  bulkDeleteRecords,
  bulkUpdateRecordField,
  duplicateRecords,
} from '../record-actions';

// ---------------------------------------------------------------------------
// Helper: create fresh test data per test
// ---------------------------------------------------------------------------

async function createTestSetup() {
  const tenant = await createTestTenant({ name: 'Bulk Test Tenant' });
  const user = await createTestUser();
  const workspace = await createTestWorkspace({
    tenantId: tenant.id,
    name: 'Bulk WS',
  });
  const table = await createTestTable({
    workspaceId: workspace.id,
    tenantId: tenant.id,
    name: 'Bulk Table',
  });
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

async function createRecordsForTenant(
  tenantId: string,
  tableId: string,
  fieldId: string,
  count: number,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [fieldId]: `Value ${i}` },
    });
    ids.push(record.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('bulkDeleteRecords — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('soft-deletes records and respects tenant scope', async () => {
    const { tenant, table, field } = await createTestSetup();
    const recordIds = await createRecordsForTenant(
      tenant.id,
      table.id,
      field.id,
      3,
    );

    const result = await bulkDeleteRecords({ recordIds });

    expect(result.count).toBe(3);

    // Verify records are soft-deleted
    const db = getDbForTenant(tenant.id, 'read');
    const remaining = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenant.id),
          eq(records.tableId, table.id),
          isNull(records.archivedAt),
        ),
      );
    expect(remaining).toHaveLength(0);
  }, 30_000);

  it('enforces tenant isolation', async () => {
    const user = await createTestUser();

    await testTenantIsolation({
      setup: async (tenantId) => {
        const workspace = await createTestWorkspace({
          tenantId,
          name: 'Isolation WS',
        });
        const table = await createTestTable({
          workspaceId: workspace.id,
          tenantId,
          name: 'Isolation Table',
        });
        const field = await createTestField({
          tableId: table.id,
          tenantId,
          name: 'Name',
          fieldType: 'text',
          isPrimary: true,
        });

        // Create 4 records; delete only 2 so the query still finds surviving rows
        const recordIds = await createRecordsForTenant(
          tenantId,
          table.id,
          field.id,
          4,
        );
        const toDelete = recordIds.slice(0, 2);

        mockGetAuthContext.mockResolvedValue({
          userId: user.id,
          tenantId,
          clerkUserId: 'clerk_test',
          agencyTenantId: null,
        });

        await bulkDeleteRecords({ recordIds: toDelete });
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

describe('bulkUpdateRecordField — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a field on multiple records', async () => {
    const { tenant, table, field } = await createTestSetup();
    const recordIds = await createRecordsForTenant(
      tenant.id,
      table.id,
      field.id,
      2,
    );

    const result = await bulkUpdateRecordField({
      recordIds,
      fieldId: field.id,
      value: 'Updated',
    });

    expect(result.count).toBe(2);

    // Verify the field was updated
    const db = getDbForTenant(tenant.id, 'read');
    const updated = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenant.id),
          eq(records.tableId, table.id),
          isNull(records.archivedAt),
        ),
      );
    for (const record of updated) {
      const data = record.canonicalData as Record<string, unknown>;
      expect(data[field.id]).toBe('Updated');
    }
  }, 30_000);

  it('enforces tenant isolation', async () => {
    const user = await createTestUser();

    await testTenantIsolation({
      setup: async (tenantId) => {
        const workspace = await createTestWorkspace({
          tenantId,
          name: 'Isolation WS',
        });
        const table = await createTestTable({
          workspaceId: workspace.id,
          tenantId,
          name: 'Isolation Table',
        });
        const field = await createTestField({
          tableId: table.id,
          tenantId,
          name: 'Name',
          fieldType: 'text',
          isPrimary: true,
        });

        const recordIds = await createRecordsForTenant(
          tenantId,
          table.id,
          field.id,
          2,
        );

        mockGetAuthContext.mockResolvedValue({
          userId: user.id,
          tenantId,
          clerkUserId: 'clerk_test',
          agencyTenantId: null,
        });

        await bulkUpdateRecordField({
          recordIds,
          fieldId: field.id,
          value: 'Isolated',
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

describe('duplicateRecords — integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('duplicates records with new UUIDs', async () => {
    const { tenant, table, field } = await createTestSetup();
    const recordIds = await createRecordsForTenant(
      tenant.id,
      table.id,
      field.id,
      2,
    );

    const result = await duplicateRecords({ recordIds });

    expect(result.newRecordIds).toHaveLength(2);
    // New IDs should differ from source IDs
    for (const newId of result.newRecordIds) {
      expect(recordIds).not.toContain(newId);
    }

    // Verify total record count is now 4
    const db = getDbForTenant(tenant.id, 'read');
    const all = await db
      .select()
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenant.id),
          eq(records.tableId, table.id),
          isNull(records.archivedAt),
        ),
      );
    expect(all).toHaveLength(4);
  }, 30_000);

  it('enforces tenant isolation', async () => {
    const user = await createTestUser();

    await testTenantIsolation({
      setup: async (tenantId) => {
        const workspace = await createTestWorkspace({
          tenantId,
          name: 'Isolation WS',
        });
        const table = await createTestTable({
          workspaceId: workspace.id,
          tenantId,
          name: 'Isolation Table',
        });
        const field = await createTestField({
          tableId: table.id,
          tenantId,
          name: 'Name',
          fieldType: 'text',
          isPrimary: true,
        });

        const recordIds = await createRecordsForTenant(
          tenantId,
          table.id,
          field.id,
          2,
        );

        mockGetAuthContext.mockResolvedValue({
          userId: user.id,
          tenantId,
          clerkUserId: 'clerk_test',
          agencyTenantId: null,
        });

        await duplicateRecords({ recordIds });
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
