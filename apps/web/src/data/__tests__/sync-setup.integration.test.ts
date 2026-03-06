import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestBase,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getSyncConfig, updateSyncConfig } from '@/data/sync-setup';
import { NotFoundError } from '@/lib/errors';
import type { SyncConfig } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Test sync config
// ---------------------------------------------------------------------------

const testSyncConfig: SyncConfig = {
  polling_interval_seconds: 300,
  tables: [
    {
      external_table_id: 'tbl001',
      external_table_name: 'Contacts',
      enabled: true,
      sync_filter: null,
      estimated_record_count: 150,
      synced_record_count: 0,
    },
    {
      external_table_id: 'tbl002',
      external_table_name: 'Projects',
      enabled: false,
      sync_filter: [
        {
          fieldId: 'fld001',
          operator: 'equals',
          value: 'Active',
          conjunction: 'and',
        },
      ],
      estimated_record_count: 500,
      synced_record_count: 0,
    },
  ],
};

describe('Sync Setup Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('getSyncConfig — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();

      await testTenantIsolation({
        setup: async (tenantId) => {
          const base = await createTestBase({ tenantId, createdBy: user.id });
          await updateSyncConfig(tenantId, user.id, base.id, testSyncConfig);
        },
        query: async (tenantId) => {
          // Get all connections for the tenant, then get their sync configs
          // Use a direct approach: get connections we know exist
          const { getConnectionsForTenant } = await import('@/data/sync-connections');
          const connections = await getConnectionsForTenant(tenantId);
          const configs = [];
          for (const conn of connections) {
            const config = await getSyncConfig(tenantId, conn.id);
            if (config) configs.push(config);
          }
          return configs;
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getSyncConfig
  // -------------------------------------------------------------------------

  describe('getSyncConfig', () => {
    it('returns null when no sync config is set', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
      });

      const config = await getSyncConfig(tenant.id, base.id);
      expect(config).toBeNull();
    }, 30_000);

    it('returns sync config after it has been set', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
      });

      await updateSyncConfig(tenant.id, user.id, base.id, testSyncConfig);
      const config = await getSyncConfig(tenant.id, base.id);

      expect(config).not.toBeNull();
      expect(config!.polling_interval_seconds).toBe(300);
      expect(config!.tables).toHaveLength(2);
      expect(config!.tables[0]!.external_table_id).toBe('tbl001');
      expect(config!.tables[0]!.enabled).toBe(true);
      expect(config!.tables[1]!.enabled).toBe(false);
      expect(config!.tables[1]!.sync_filter).toHaveLength(1);
    }, 30_000);

    it('throws NotFoundError for non-existent connection', async () => {
      const tenant = await createTestTenant();

      await expect(
        getSyncConfig(tenant.id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);

    it('throws NotFoundError for cross-tenant access', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenantA.id,
        createdBy: user.id,
      });

      await updateSyncConfig(tenantA.id, user.id, base.id, testSyncConfig);

      await expect(
        getSyncConfig(tenantB.id, base.id),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // updateSyncConfig
  // -------------------------------------------------------------------------

  describe('updateSyncConfig', () => {
    it('updates sync config on a connection', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
      });

      await updateSyncConfig(tenant.id, user.id, base.id, testSyncConfig);

      const config = await getSyncConfig(tenant.id, base.id);
      expect(config).not.toBeNull();
      expect(config!.tables).toHaveLength(2);
    }, 30_000);

    it('overwrites existing sync config', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenant.id,
        createdBy: user.id,
      });

      await updateSyncConfig(tenant.id, user.id, base.id, testSyncConfig);

      const updatedConfig: SyncConfig = {
        polling_interval_seconds: 600,
        tables: [
          {
            external_table_id: 'tbl003',
            external_table_name: 'Tasks',
            enabled: true,
            sync_filter: null,
            estimated_record_count: 50,
            synced_record_count: 0,
          },
        ],
      };

      await updateSyncConfig(tenant.id, user.id, base.id, updatedConfig);

      const config = await getSyncConfig(tenant.id, base.id);
      expect(config!.polling_interval_seconds).toBe(600);
      expect(config!.tables).toHaveLength(1);
      expect(config!.tables[0]!.external_table_id).toBe('tbl003');
    }, 30_000);

    it('throws NotFoundError for non-existent connection', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      await expect(
        updateSyncConfig(
          tenant.id,
          user.id,
          '00000000-0000-0000-0000-000000000000',
          testSyncConfig,
        ),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);

    it('throws NotFoundError for cross-tenant update', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const user = await createTestUser();
      const base = await createTestBase({
        tenantId: tenantA.id,
        createdBy: user.id,
      });

      await expect(
        updateSyncConfig(tenantB.id, user.id, base.id, testSyncConfig),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });
});
