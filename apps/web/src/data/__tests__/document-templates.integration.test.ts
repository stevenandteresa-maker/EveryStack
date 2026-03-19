/**
 * Integration tests for document template data functions.
 *
 * Covers tenant isolation, single-template fetch with creator name,
 * and list ordering by updated_at desc.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestTable,
  createTestDocumentTemplate,
  testTenantIsolation,
} from '@everystack/shared/testing';

import {
  getDocumentTemplate,
  listDocumentTemplates,
} from '../document-templates';

// ---------------------------------------------------------------------------
// Tenant Isolation
// ---------------------------------------------------------------------------

describe('Document Template Data Functions', () => {
  describe('getDocumentTemplate — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let templateId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          const table = await createTestTable({ tenantId });
          const template = await createTestDocumentTemplate({
            tenantId,
            tableId: table.id,
            createdBy: user.id,
          });
          templateId = template.id;
        },
        query: async (tenantId) => {
          const result = await getDocumentTemplate(tenantId, templateId);
          return result ? [result] : [];
        },
      });
    }, 30_000);
  });

  describe('listDocumentTemplates — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let tableId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          const table = await createTestTable({ tenantId });
          tableId = table.id;
          await createTestDocumentTemplate({
            tenantId,
            tableId: table.id,
            createdBy: user.id,
          });
        },
        query: async (tenantId) => {
          return listDocumentTemplates(tenantId, tableId);
        },
      });
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // Functional Tests
  // ---------------------------------------------------------------------------

  describe('getDocumentTemplate', () => {
    it('returns template with creator name', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser({ name: 'Alice Builder' });
      const table = await createTestTable({ tenantId: tenant.id });
      const template = await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: table.id,
        createdBy: user.id,
        name: 'Invoice Template',
      });

      const result = await getDocumentTemplate(tenant.id, template.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(template.id);
      expect(result!.name).toBe('Invoice Template');
      expect(result!.creatorName).toBe('Alice Builder');
      expect(result!.tenantId).toBe(tenant.id);
      expect(result!.tableId).toBe(table.id);
    }, 30_000);

    it('returns null for non-existent template', async () => {
      const tenant = await createTestTenant();
      const result = await getDocumentTemplate(tenant.id, '00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    }, 30_000);
  });

  describe('listDocumentTemplates', () => {
    it('returns templates ordered by updated_at desc', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const table = await createTestTable({ tenantId: tenant.id });

      // Create templates with staggered timestamps
      const templateA = await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: table.id,
        createdBy: user.id,
        name: 'Older Template',
      });
      const templateB = await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: table.id,
        createdBy: user.id,
        name: 'Newer Template',
      });

      const results = await listDocumentTemplates(tenant.id, table.id);

      expect(results.length).toBe(2);
      // Most recently created (B) should come first due to updated_at desc
      expect(results[0]!.id).toBe(templateB.id);
      expect(results[1]!.id).toBe(templateA.id);
      // All results include creator name
      expect(results[0]!.creatorName).toBe(user.name);
    }, 30_000);

    it('returns empty array when table has no templates', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });

      const results = await listDocumentTemplates(tenant.id, table.id);
      expect(results).toEqual([]);
    }, 30_000);

    it('only returns templates for the specified table', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const tableA = await createTestTable({ tenantId: tenant.id });
      const tableB = await createTestTable({ tenantId: tenant.id });

      await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: tableA.id,
        createdBy: user.id,
        name: 'Table A Template',
      });
      await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: tableB.id,
        createdBy: user.id,
        name: 'Table B Template',
      });

      const results = await listDocumentTemplates(tenant.id, tableA.id);
      expect(results.length).toBe(1);
      expect(results[0]!.name).toBe('Table A Template');
    }, 30_000);
  });
});
