import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  createTestBase,
  createTestSyncedFieldMapping,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { createSchemaChange } from '@everystack/shared/sync';
import { getSyncSchemaChanges, getPendingSchemaChangeCount } from '../../data/sync-schema-changes';

// ---------------------------------------------------------------------------
// getSyncSchemaChanges
// ---------------------------------------------------------------------------

describe('getSyncSchemaChanges', () => {
  describe('tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const connectionIdByTenant = new Map<string, string>();

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

          await createSchemaChange(tenantId, {
            baseConnectionId: base.id,
            changeType: 'field_type_changed',
            fieldId: field.id,
            platformFieldId: 'fld_ext_123',
            oldSchema: { type: 'singleLineText' },
            newSchema: { type: 'number' },
          });

          connectionIdByTenant.set(tenantId, base.id);
        },
        query: async (tenantId) => {
          const connectionId = connectionIdByTenant.get(tenantId);
          if (!connectionId) return [];
          return getSyncSchemaChanges(tenantId, connectionId);
        },
      });
    }, 30_000);
  });

  describe('functionality', () => {
    it('returns empty array when no schema changes exist', async () => {
      const tenant = await createTestTenant();
      const base = await createTestBase({ tenantId: tenant.id });

      const result = await getSyncSchemaChanges(tenant.id, base.id);
      expect(result).toEqual([]);
    });

    it('returns schema changes for a connection', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const base = await createTestBase({ tenantId: tenant.id, syncStatus: 'active' });

      await createTestSyncedFieldMapping({
        tenantId: tenant.id,
        baseConnectionId: base.id,
        tableId: table.id,
        fieldId: field.id,
      });

      await createSchemaChange(tenant.id, {
        baseConnectionId: base.id,
        changeType: 'field_deleted',
        fieldId: field.id,
        platformFieldId: 'fld_ext_456',
        oldSchema: { type: 'singleLineText', name: 'Old Field' },
        newSchema: null,
      });

      const result = await getSyncSchemaChanges(tenant.id, base.id);
      expect(result).toHaveLength(1);
      expect(result[0]!.changeType).toBe('field_deleted');
      expect(result[0]!.status).toBe('pending');
      expect(result[0]!.fieldId).toBe(field.id);
    });
  });
});

// ---------------------------------------------------------------------------
// getPendingSchemaChangeCount
// ---------------------------------------------------------------------------

describe('getPendingSchemaChangeCount', () => {
  describe('tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const connectionIdByTenant = new Map<string, string>();

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

          await createSchemaChange(tenantId, {
            baseConnectionId: base.id,
            changeType: 'field_added',
            fieldId: null,
            platformFieldId: 'fld_ext_new',
            oldSchema: null,
            newSchema: { type: 'checkbox', name: 'New Check' },
          });

          connectionIdByTenant.set(tenantId, base.id);
        },
        query: async (tenantId) => {
          const connectionId = connectionIdByTenant.get(tenantId);
          if (!connectionId) return [];
          const count = await getPendingSchemaChangeCount(tenantId, connectionId);
          // testTenantIsolation expects an array — wrap count in array if > 0
          return count > 0 ? [{ count }] : [];
        },
      });
    }, 30_000);
  });

  describe('functionality', () => {
    it('returns 0 when no pending changes', async () => {
      const tenant = await createTestTenant();
      const base = await createTestBase({ tenantId: tenant.id });

      const count = await getPendingSchemaChangeCount(tenant.id, base.id);
      expect(count).toBe(0);
    });

    it('counts only pending changes', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field1 = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const field2 = await createTestField({ tenantId: tenant.id, tableId: table.id });
      const base = await createTestBase({ tenantId: tenant.id, syncStatus: 'active' });

      // Create 2 pending changes
      await createSchemaChange(tenant.id, {
        baseConnectionId: base.id,
        changeType: 'field_renamed',
        fieldId: field1.id,
        platformFieldId: 'fld_ext_r1',
        oldSchema: { name: 'Old' },
        newSchema: { name: 'New' },
      });

      await createSchemaChange(tenant.id, {
        baseConnectionId: base.id,
        changeType: 'field_type_changed',
        fieldId: field2.id,
        platformFieldId: 'fld_ext_t1',
        oldSchema: { type: 'text' },
        newSchema: { type: 'number' },
      });

      const count = await getPendingSchemaChangeCount(tenant.id, base.id);
      expect(count).toBe(2);
    });
  });
});
