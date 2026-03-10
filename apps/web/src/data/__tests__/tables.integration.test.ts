import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestWorkspace,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getTableById, getTablesByWorkspace } from '../../data/tables';
import { NotFoundError } from '../../lib/errors';

describe('Table Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getTablesByWorkspace — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let workspaceId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          workspaceId = table.workspaceId;
        },
        query: async (tenantId) => {
          return getTablesByWorkspace(tenantId, workspaceId);
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getTableById
  // -------------------------------------------------------------------------

  describe('getTableById', () => {
    it('returns table with workspace info', async () => {
      const tenant = await createTestTenant();
      const workspace = await createTestWorkspace({ tenantId: tenant.id });
      const table = await createTestTable({
        tenantId: tenant.id,
        workspaceId: workspace.id,
        name: 'Clients',
        tableType: 'table',
      });

      const result = await getTableById(tenant.id, table.id);

      expect(result.id).toBe(table.id);
      expect(result.name).toBe('Clients');
      expect(result.tableType).toBe('table');
      expect(result.workspace.id).toBe(workspace.id);
      expect(result.workspace.name).toBe(workspace.name);
    }, 30_000);

    it('throws NotFoundError for non-existent table', async () => {
      const tenant = await createTestTenant();
      const nonExistentId = crypto.randomUUID();

      await expect(
        getTableById(tenant.id, nonExistentId),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);

    it('throws NotFoundError for table in different tenant', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const table = await createTestTable({ tenantId: tenantA.id });

      await expect(
        getTableById(tenantB.id, table.id),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getTablesByWorkspace
  // -------------------------------------------------------------------------

  describe('getTablesByWorkspace', () => {
    it('returns tables ordered by name', async () => {
      const tenant = await createTestTenant();
      const workspace = await createTestWorkspace({ tenantId: tenant.id });

      await createTestTable({
        tenantId: tenant.id,
        workspaceId: workspace.id,
        name: 'Zebra',
      });
      await createTestTable({
        tenantId: tenant.id,
        workspaceId: workspace.id,
        name: 'Alpha',
      });
      await createTestTable({
        tenantId: tenant.id,
        workspaceId: workspace.id,
        name: 'Middle',
      });

      const result = await getTablesByWorkspace(tenant.id, workspace.id);

      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('Alpha');
      expect(result[1]?.name).toBe('Middle');
      expect(result[2]?.name).toBe('Zebra');
    }, 30_000);

    it('returns empty array for workspace with no tables', async () => {
      const tenant = await createTestTenant();
      const workspace = await createTestWorkspace({ tenantId: tenant.id });

      const result = await getTablesByWorkspace(tenant.id, workspace.id);

      expect(result).toEqual([]);
    }, 30_000);
  });
});
