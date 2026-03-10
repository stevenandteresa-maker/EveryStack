import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestRecord,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getDbForTenant, eq, and, records } from '@everystack/shared/db';
import {
  getRecordsByTable,
  getRecordById,
} from '../../data/records';
import { NotFoundError } from '../../lib/errors';

describe('Record Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getRecordsByTable — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let tableId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          tableId = table.id;
          await createTestRecord({ tenantId, tableId: table.id });
        },
        query: async (tenantId) => {
          const result = await getRecordsByTable(tenantId, tableId);
          return result.records;
        },
      });
    }, 30_000);
  });

  describe('getRecordById — tenant isolation', () => {
    it('enforces tenant isolation via NotFoundError', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const table = await createTestTable({ tenantId: tenantA.id });
      const record = await createTestRecord({
        tenantId: tenantA.id,
        tableId: table.id,
      });

      // Tenant B cannot access Tenant A's record
      await expect(
        getRecordById(tenantB.id, record.id),
      ).rejects.toThrow(NotFoundError);

      // Tenant A can access its own record
      const result = await getRecordById(tenantA.id, record.id);
      expect(result.id).toBe(record.id);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getRecordsByTable
  // -------------------------------------------------------------------------

  describe('getRecordsByTable', () => {
    it('returns paginated results with totalCount and hasMore', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      // Create 5 records
      for (let i = 0; i < 5; i++) {
        await createTestRecord({ tenantId: tenant.id, tableId: table.id });
      }

      const page1 = await getRecordsByTable(tenant.id, table.id, {
        limit: 3,
        offset: 0,
      });

      expect(page1.records).toHaveLength(3);
      expect(page1.totalCount).toBe(5);
      expect(page1.hasMore).toBe(true);

      const page2 = await getRecordsByTable(tenant.id, table.id, {
        limit: 3,
        offset: 3,
      });

      expect(page2.records).toHaveLength(2);
      expect(page2.totalCount).toBe(5);
      expect(page2.hasMore).toBe(false);
    }, 30_000);

    it('uses default limit of 100', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      await createTestRecord({ tenantId: tenant.id, tableId: table.id });

      const result = await getRecordsByTable(tenant.id, table.id);

      expect(result.records).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
    }, 30_000);

    it('excludes soft-deleted records', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      // Create 2 records, soft-delete one
      await createTestRecord({ tenantId: tenant.id, tableId: table.id });
      const toDelete = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
      });

      // Soft-delete via direct DB update
      const db = getDbForTenant(tenant.id, 'write');
      await db
        .update(records)
        .set({ archivedAt: new Date() })
        .where(
          and(eq(records.tenantId, tenant.id), eq(records.id, toDelete.id)),
        );

      const result = await getRecordsByTable(tenant.id, table.id);

      expect(result.records).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.records[0]?.id).not.toBe(toDelete.id);
    }, 30_000);

    it('returns empty result for table with no records', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getRecordsByTable(tenant.id, table.id);

      expect(result.records).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.hasMore).toBe(false);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getRecordById
  // -------------------------------------------------------------------------

  describe('getRecordById', () => {
    it('returns the record with canonical_data', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const record = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { 'field-1': { type: 'text', value: 'Hello' } },
      });

      const result = await getRecordById(tenant.id, record.id);

      expect(result.id).toBe(record.id);
      expect(result.tableId).toBe(table.id);
      expect(result.canonicalData).toEqual({
        'field-1': { type: 'text', value: 'Hello' },
      });
    }, 30_000);

    it('throws NotFoundError for non-existent record', async () => {
      const tenant = await createTestTenant();
      const nonExistentId = crypto.randomUUID();

      await expect(
        getRecordById(tenant.id, nonExistentId),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);

    it('throws NotFoundError for soft-deleted record', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const record = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
      });

      // Soft-delete
      const db = getDbForTenant(tenant.id, 'write');
      await db
        .update(records)
        .set({ archivedAt: new Date() })
        .where(
          and(eq(records.tenantId, tenant.id), eq(records.id, record.id)),
        );

      await expect(
        getRecordById(tenant.id, record.id),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });
});
