import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getFieldsByTable, getFieldById } from '@/data/fields';
import { NotFoundError } from '@/lib/errors';

describe('Field Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getFieldsByTable — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let tableId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const table = await createTestTable({ tenantId });
          tableId = table.id;
          await createTestField({ tenantId, tableId: table.id });
        },
        query: async (tenantId) => {
          return getFieldsByTable(tenantId, tableId);
        },
      });
    }, 30_000);
  });

  describe('getFieldById — tenant isolation', () => {
    it('enforces tenant isolation via NotFoundError', async () => {
      const tenantA = await createTestTenant();
      const tenantB = await createTestTenant();
      const table = await createTestTable({ tenantId: tenantA.id });
      const field = await createTestField({
        tenantId: tenantA.id,
        tableId: table.id,
      });

      await expect(
        getFieldById(tenantB.id, field.id),
      ).rejects.toThrow(NotFoundError);

      const result = await getFieldById(tenantA.id, field.id);
      expect(result.id).toBe(field.id);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getFieldsByTable
  // -------------------------------------------------------------------------

  describe('getFieldsByTable', () => {
    it('returns fields ordered by sort_order', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Third',
        sortOrder: 3,
      });
      await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'First',
        sortOrder: 1,
      });
      await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Second',
        sortOrder: 2,
      });

      const result = await getFieldsByTable(tenant.id, table.id);

      expect(result).toHaveLength(3);
      expect(result[0]?.name).toBe('First');
      expect(result[1]?.name).toBe('Second');
      expect(result[2]?.name).toBe('Third');
    }, 30_000);

    it('returns empty array for table with no fields', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const result = await getFieldsByTable(tenant.id, table.id);

      expect(result).toEqual([]);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getFieldById
  // -------------------------------------------------------------------------

  describe('getFieldById', () => {
    it('returns the field with config and metadata', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Status',
        fieldType: 'single_select',
        config: { options: [{ label: 'Active' }, { label: 'Inactive' }] },
      });

      const result = await getFieldById(tenant.id, field.id);

      expect(result.id).toBe(field.id);
      expect(result.name).toBe('Status');
      expect(result.fieldType).toBe('single_select');
      expect(result.config).toEqual({
        options: [{ label: 'Active' }, { label: 'Inactive' }],
      });
    }, 30_000);

    it('throws NotFoundError for non-existent field', async () => {
      const tenant = await createTestTenant();

      await expect(
        getFieldById(tenant.id, '00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundError);
    }, 30_000);
  });
});
