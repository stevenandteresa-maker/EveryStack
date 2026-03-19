/**
 * Integration tests for generated document data functions.
 *
 * Covers tenant isolation, single-document fetch, and list
 * ordering by generated_at desc.
 */

import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestUser,
  createTestTable,
  createTestDocumentTemplate,
  createTestGeneratedDocument,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { generateUUIDv7 } from '@everystack/shared/db';

import {
  getGeneratedDocument,
  listGeneratedDocuments,
} from '../generated-documents';

// ---------------------------------------------------------------------------
// Tenant Isolation
// ---------------------------------------------------------------------------

describe('Generated Document Data Functions', () => {
  describe('getGeneratedDocument — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      let documentId = '';

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          const table = await createTestTable({ tenantId });
          const template = await createTestDocumentTemplate({
            tenantId,
            tableId: table.id,
            createdBy: user.id,
          });
          const doc = await createTestGeneratedDocument({
            tenantId,
            templateId: template.id,
            generatedBy: user.id,
          });
          documentId = doc.id;
        },
        query: async (tenantId) => {
          const result = await getGeneratedDocument(tenantId, documentId);
          return result ? [result] : [];
        },
      });
    }, 30_000);
  });

  describe('listGeneratedDocuments — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const recordId = generateUUIDv7();

      await testTenantIsolation({
        setup: async (tenantId) => {
          const user = await createTestUser();
          const table = await createTestTable({ tenantId });
          const template = await createTestDocumentTemplate({
            tenantId,
            tableId: table.id,
            createdBy: user.id,
          });
          await createTestGeneratedDocument({
            tenantId,
            templateId: template.id,
            generatedBy: user.id,
            sourceRecordId: recordId,
          });
        },
        query: async (tenantId) => {
          return listGeneratedDocuments(tenantId, recordId);
        },
      });
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // Functional Tests
  // ---------------------------------------------------------------------------

  describe('getGeneratedDocument', () => {
    it('returns generated document by ID', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const table = await createTestTable({ tenantId: tenant.id });
      const template = await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: table.id,
        createdBy: user.id,
      });
      const doc = await createTestGeneratedDocument({
        tenantId: tenant.id,
        templateId: template.id,
        generatedBy: user.id,
        fileType: 'pdf',
      });

      const result = await getGeneratedDocument(tenant.id, doc.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(doc.id);
      expect(result!.tenantId).toBe(tenant.id);
      expect(result!.templateId).toBe(template.id);
      expect(result!.fileType).toBe('pdf');
      expect(result!.generatedBy).toBe(user.id);
    }, 30_000);

    it('returns null for non-existent document', async () => {
      const tenant = await createTestTenant();
      const result = await getGeneratedDocument(tenant.id, '00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    }, 30_000);
  });

  describe('listGeneratedDocuments', () => {
    it('returns documents ordered by generated_at desc', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const table = await createTestTable({ tenantId: tenant.id });
      const template = await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: table.id,
        createdBy: user.id,
      });
      const recordId = generateUUIDv7();

      const docA = await createTestGeneratedDocument({
        tenantId: tenant.id,
        templateId: template.id,
        generatedBy: user.id,
        sourceRecordId: recordId,
      });
      const docB = await createTestGeneratedDocument({
        tenantId: tenant.id,
        templateId: template.id,
        generatedBy: user.id,
        sourceRecordId: recordId,
      });

      const results = await listGeneratedDocuments(tenant.id, recordId);

      expect(results.length).toBe(2);
      // Most recently generated (B) should come first
      expect(results[0]!.id).toBe(docB.id);
      expect(results[1]!.id).toBe(docA.id);
    }, 30_000);

    it('returns empty array when record has no documents', async () => {
      const tenant = await createTestTenant();
      const results = await listGeneratedDocuments(tenant.id, generateUUIDv7());
      expect(results).toEqual([]);
    }, 30_000);

    it('only returns documents for the specified record', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const table = await createTestTable({ tenantId: tenant.id });
      const template = await createTestDocumentTemplate({
        tenantId: tenant.id,
        tableId: table.id,
        createdBy: user.id,
      });
      const recordA = generateUUIDv7();
      const recordB = generateUUIDv7();

      await createTestGeneratedDocument({
        tenantId: tenant.id,
        templateId: template.id,
        generatedBy: user.id,
        sourceRecordId: recordA,
      });
      await createTestGeneratedDocument({
        tenantId: tenant.id,
        templateId: template.id,
        generatedBy: user.id,
        sourceRecordId: recordB,
      });

      const results = await listGeneratedDocuments(tenant.id, recordA);
      expect(results.length).toBe(1);
      expect(results[0]!.sourceRecordId).toBe(recordA);
    }, 30_000);
  });
});
