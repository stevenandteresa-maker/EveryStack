/**
 * Integration tests for record-view-configs data access layer.
 *
 * Tests tenant isolation, CRUD queries, and auto-generated default config.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecordViewConfig,
} from '@everystack/shared/testing';
import { testTenantIsolation } from '@everystack/shared/testing';
import {
  getRecordViewConfigs,
  getRecordViewConfigById,
  getDefaultRecordViewConfig,
} from '@/data/record-view-configs';

describe('record-view-configs data layer', () => {
  // ---------------------------------------------------------------------------
  // Tenant isolation — mandatory for every /data function
  // ---------------------------------------------------------------------------

  describe('getRecordViewConfigs', () => {
    it('enforces tenant isolation', async () => {
      // Create a shared table reference via closure
      const tableIds: Record<string, string> = {};

      await testTenantIsolation({
        setup: async (tenantId: string) => {
          const table = await createTestTable({ tenantId });
          tableIds[tenantId] = table.id;
          await createTestRecordViewConfig({
            tenantId,
            tableId: table.id,
          });
        },
        query: async (tenantId: string) => {
          // When querying as the other tenant, we use the setup tenant's tableId
          // But the RLS should prevent seeing data
          const setupTenantId = Object.keys(tableIds).find((id) => id !== tenantId) ?? tenantId;
          const tableId = tableIds[setupTenantId] ?? tableIds[tenantId]!;
          return getRecordViewConfigs(tenantId, tableId);
        },
      });
    }, 30_000);

    it('returns all configs for a table', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const config1 = await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Config A',
      });
      const config2 = await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Config B',
      });

      const result = await getRecordViewConfigs(tenant.id, table.id);

      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.id);
      expect(ids).toContain(config1.id);
      expect(ids).toContain(config2.id);
    }, 10_000);

    it('does not return configs from other tables', async () => {
      const tenant = await createTestTenant();
      const table1 = await createTestTable({ tenantId: tenant.id });
      const table2 = await createTestTable({ tenantId: tenant.id });

      await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table1.id,
      });
      await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table2.id,
      });

      const result = await getRecordViewConfigs(tenant.id, table1.id);
      expect(result).toHaveLength(1);
      expect(result[0]!.tableId).toBe(table1.id);
    }, 10_000);
  });

  describe('getRecordViewConfigById', () => {
    it('enforces tenant isolation', async () => {
      let configId = '';

      await testTenantIsolation({
        setup: async (tenantId: string) => {
          const config = await createTestRecordViewConfig({ tenantId });
          configId = config.id;
        },
        query: async (tenantId: string) => {
          try {
            return [await getRecordViewConfigById(tenantId, configId)];
          } catch {
            return [];
          }
        },
      });
    }, 30_000);

    it('returns a config by ID', async () => {
      const config = await createTestRecordViewConfig();

      const result = await getRecordViewConfigById(config.tenantId, config.id);
      expect(result.id).toBe(config.id);
      expect(result.name).toBe(config.name);
    }, 10_000);

    it('throws NotFoundError for non-existent config', async () => {
      const tenant = await createTestTenant();

      await expect(
        getRecordViewConfigById(tenant.id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow('Record view config not found');
    }, 10_000);
  });

  describe('getDefaultRecordViewConfig', () => {
    it('returns the explicit default config', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const defaultConfig = await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table.id,
        isDefault: true,
      });
      await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table.id,
        isDefault: false,
      });

      const result = await getDefaultRecordViewConfig(tenant.id, table.id);
      expect(result.id).toBe(defaultConfig.id);
    }, 10_000);

    it('falls back to first config when no default is set', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const config = await createTestRecordViewConfig({
        tenantId: tenant.id,
        tableId: table.id,
        isDefault: false,
      });

      const result = await getDefaultRecordViewConfig(tenant.id, table.id);
      expect(result.id).toBe(config.id);
    }, 10_000);

    it('auto-generates a default config when none exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      // Create some fields for the auto-generated config
      await createTestField({ tenantId: tenant.id, tableId: table.id, name: 'Name', sortOrder: 0 });
      await createTestField({ tenantId: tenant.id, tableId: table.id, name: 'Status', sortOrder: 1 });

      const result = await getDefaultRecordViewConfig(tenant.id, table.id);

      expect(result.id).toBe(`auto-${table.id}`);
      expect(result.isDefault).toBe(true);

      const layout = result.layout as Record<string, unknown>;
      expect(layout).toHaveProperty('columns', 2);
      expect(layout).toHaveProperty('fields');
      expect((layout.fields as unknown[]).length).toBe(2);
    }, 10_000);

    it('auto-generates empty config when table has no fields', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getDefaultRecordViewConfig(tenant.id, table.id);

      const layout = result.layout as Record<string, unknown>;
      expect((layout.fields as unknown[]).length).toBe(0);
    }, 10_000);
  });
});
