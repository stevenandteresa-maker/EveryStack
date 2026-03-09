import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecord,
  createTestSyncConflict,
  testTenantIsolation,
} from '@everystack/shared/testing';
import {
  getPendingConflictsForTable,
  getPendingConflictCount,
} from '../../data/sync-conflicts';
import type { ConflictMap } from '../../data/sync-conflicts';

describe('Sync Conflict Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getPendingConflictsForTable — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      // Use closure to share tableId between setup and query.
      // testTenantIsolation creates tenants A & B. We store A's table
      // so query(tenantA) can look up the right table.
      const tableIdByTenant = new Map<string, string>();

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          const field = await createTestField({ tenantId, tableId: table.id });
          const record = await createTestRecord({ tenantId, tableId: table.id });

          await createTestSyncConflict({
            tenantId,
            recordId: record.id,
            fieldId: field.id,
          });

          tableIdByTenant.set(tenantId, table.id);
        },
        query: async (tenantId) => {
          // For tenant A, use the table created in setup.
          // For tenant B (cross-tenant check), create a fresh table.
          const tableId = tableIdByTenant.get(tenantId)
            ?? (await createTestTable({ tenantId })).id;
          const map = await getPendingConflictsForTable(tenantId, tableId);
          return Object.keys(map);
        },
      });
    }, 30_000);
  });

  describe('getPendingConflictCount — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const tableIdByTenant = new Map<string, string>();

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          const field = await createTestField({ tenantId, tableId: table.id });
          const record = await createTestRecord({ tenantId, tableId: table.id });

          await createTestSyncConflict({
            tenantId,
            recordId: record.id,
            fieldId: field.id,
          });

          tableIdByTenant.set(tenantId, table.id);
        },
        query: async (tenantId) => {
          const tableId = tableIdByTenant.get(tenantId)
            ?? (await createTestTable({ tenantId })).id;
          const count = await getPendingConflictCount(tenantId, tableId);
          return count > 0 ? [count] : [];
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getPendingConflictsForTable
  // -------------------------------------------------------------------------

  describe('getPendingConflictsForTable', () => {
    it('returns nested map keyed by recordId then fieldId', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field1 = await createTestField({ tenantId: tenant.id, tableId: table.id, name: 'Status' });
      const field2 = await createTestField({ tenantId: tenant.id, tableId: table.id, name: 'Priority' });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field1.id,
        localValue: 'Done',
        remoteValue: 'In Review',
        platform: 'airtable',
      });
      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field2.id,
        localValue: 'High',
        remoteValue: 'Low',
        platform: 'airtable',
      });

      const result: ConflictMap = await getPendingConflictsForTable(tenant.id, table.id);

      // Record is present
      expect(result[record.id]).toBeDefined();
      // Both fields present
      expect(result[record.id]![field1.id]).toBeDefined();
      expect(result[record.id]![field2.id]).toBeDefined();
      // Values correct
      expect(result[record.id]![field1.id]!.localValue).toBe('Done');
      expect(result[record.id]![field1.id]!.remoteValue).toBe('In Review');
      expect(result[record.id]![field1.id]!.platform).toBe('airtable');
      expect(result[record.id]![field2.id]!.localValue).toBe('High');
    }, 30_000);

    it('excludes resolved conflicts', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field.id,
        status: 'resolved',
      });

      const result = await getPendingConflictsForTable(tenant.id, table.id);

      expect(Object.keys(result)).toHaveLength(0);
    }, 30_000);

    it('excludes conflicts from other tables', async () => {
      const tenant = await createTestTenant();
      const table1 = await createTestTable({ tenantId: tenant.id });
      const table2 = await createTestTable({ tenantId: tenant.id });
      const field1 = await createTestField({ tenantId: tenant.id, tableId: table1.id });
      const field2 = await createTestField({ tenantId: tenant.id, tableId: table2.id });
      const record1 = await createTestRecord({ tenantId: tenant.id, tableId: table1.id });
      const record2 = await createTestRecord({ tenantId: tenant.id, tableId: table2.id });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record1.id,
        fieldId: field1.id,
      });
      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record2.id,
        fieldId: field2.id,
      });

      const result = await getPendingConflictsForTable(tenant.id, table1.id);

      expect(Object.keys(result)).toHaveLength(1);
      expect(result[record1.id]).toBeDefined();
      expect(result[record2.id]).toBeUndefined();
    }, 30_000);

    it('returns empty map when no conflicts exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getPendingConflictsForTable(tenant.id, table.id);

      expect(result).toEqual({});
    }, 30_000);

    it('includes createdAt as ISO string', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field.id,
      });

      const result = await getPendingConflictsForTable(tenant.id, table.id);
      const meta = result[record.id]![field.id]!;

      expect(meta.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getPendingConflictCount
  // -------------------------------------------------------------------------

  describe('getPendingConflictCount', () => {
    it('returns correct count of pending conflicts', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field1 = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const field2 = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field1.id,
      });
      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field2.id,
      });

      const count = await getPendingConflictCount(tenant.id, table.id);

      expect(count).toBe(2);
    }, 30_000);

    it('returns 0 when no conflicts exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const count = await getPendingConflictCount(tenant.id, table.id);

      expect(count).toBe(0);
    }, 30_000);

    it('excludes resolved conflicts from count', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field.id,
        status: 'pending',
      });
      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: await createTestField({ tenantId: tenant.id, tableId: table.id }).then(f => f.id),
        status: 'resolved',
      });

      const count = await getPendingConflictCount(tenant.id, table.id);

      expect(count).toBe(1);
    }, 30_000);
  });
});
