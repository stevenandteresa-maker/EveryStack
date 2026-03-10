import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecord,
  createTestBase,
  createTestSyncedFieldMapping,
  createTestSyncConflict,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getSyncStatusForTable } from '../../data/sync-status';

describe('getSyncStatusForTable', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const tableIdByTenant = new Map<string, string>();

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          const field = await createTestField({ tenantId, tableId: table.id });
          const base = await createTestBase({ tenantId, syncStatus: 'active' });

          await createTestSyncedFieldMapping({
            tenantId,
            baseConnectionId: base.id,
            tableId: table.id,
            fieldId: field.id,
          });

          tableIdByTenant.set(tenantId, table.id);
        },
        query: async (tenantId) => {
          const tableId = tableIdByTenant.get(tenantId)
            ?? (await createTestTable({ tenantId })).id;
          const result = await getSyncStatusForTable(tenantId, tableId);
          return result ? [result] : [];
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Functional Tests
  // -------------------------------------------------------------------------

  describe('functionality', () => {
    it('returns null for a non-synced table', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getSyncStatusForTable(tenant.id, table.id);
      expect(result).toBeNull();
    });

    it('returns sync status for a synced table', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const base = await createTestBase({
        tenantId: tenant.id,
        platform: 'airtable',
        syncStatus: 'active',
        syncConfig: { polling_interval_seconds: 300, tables: [] },
        lastSyncAt: new Date(),
      });

      await createTestSyncedFieldMapping({
        tenantId: tenant.id,
        baseConnectionId: base.id,
        tableId: table.id,
        fieldId: field.id,
      });

      const result = await getSyncStatusForTable(tenant.id, table.id);

      expect(result).not.toBeNull();
      expect(result!.platform).toBe('airtable');
      expect(result!.connectionId).toBe(base.id);
      expect(result!.healthState).toBe('healthy');
      expect(result!.pendingConflictCount).toBe(0);
      expect(result!.pollingIntervalSeconds).toBe(300);
    });

    it('includes pending conflict count', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });
      const base = await createTestBase({
        tenantId: tenant.id,
        syncStatus: 'active',
        lastSyncAt: new Date(),
      });

      await createTestSyncedFieldMapping({
        tenantId: tenant.id,
        baseConnectionId: base.id,
        tableId: table.id,
        fieldId: field.id,
      });

      await createTestSyncConflict({
        tenantId: tenant.id,
        recordId: record.id,
        fieldId: field.id,
      });

      const result = await getSyncStatusForTable(tenant.id, table.id);

      expect(result).not.toBeNull();
      expect(result!.pendingConflictCount).toBe(1);
      expect(result!.healthState).toBe('conflicts');
    });

    it('derives auth_required state from sync_status column', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const base = await createTestBase({
        tenantId: tenant.id,
        syncStatus: 'auth_required',
      });

      await createTestSyncedFieldMapping({
        tenantId: tenant.id,
        baseConnectionId: base.id,
        tableId: table.id,
        fieldId: field.id,
      });

      const result = await getSyncStatusForTable(tenant.id, table.id);
      expect(result!.healthState).toBe('auth_required');
    });

    it('defaults to 300s polling interval when not configured', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const base = await createTestBase({
        tenantId: tenant.id,
        syncStatus: 'active',
        syncConfig: {},
      });

      await createTestSyncedFieldMapping({
        tenantId: tenant.id,
        baseConnectionId: base.id,
        tableId: table.id,
        fieldId: field.id,
      });

      const result = await getSyncStatusForTable(tenant.id, table.id);
      expect(result!.pollingIntervalSeconds).toBe(300);
    });
  });
});
