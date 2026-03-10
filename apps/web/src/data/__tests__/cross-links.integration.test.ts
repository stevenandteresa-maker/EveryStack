import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecord,
  createTestCrossLink,
  createTestUser,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getDbForTenant, crossLinkIndex } from '@everystack/shared/db';
import { generateUUIDv7 } from '@everystack/shared/db';
import { getLinkedRecords, getLinkedRecordCount } from '../cross-links';

describe('Cross-Link Data Functions', () => {
  // -------------------------------------------------------------------------
  // Tenant Isolation
  // -------------------------------------------------------------------------

  describe('getLinkedRecords — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();

      // Track IDs across setup and query
      let sourceFieldId: string;
      let sourceRecordId: string;

      await testTenantIsolation({
        setup: async (tenantId) => {
          const sourceTable = await createTestTable({ tenantId });
          const sourceField = await createTestField({
            tenantId,
            tableId: sourceTable.id,
            name: 'Link',
            fieldType: 'cross_link',
          });
          sourceFieldId = sourceField.id;

          const targetTable = await createTestTable({ tenantId });
          const targetDisplayField = await createTestField({
            tenantId,
            tableId: targetTable.id,
            name: 'Name',
            fieldType: 'text',
            isPrimary: true,
          });

          const sourceRecord = await createTestRecord({
            tenantId,
            tableId: sourceTable.id,
          });
          sourceRecordId = sourceRecord.id;

          const targetRecord = await createTestRecord({
            tenantId,
            tableId: targetTable.id,
          });

          const crossLink = await createTestCrossLink({
            tenantId,
            sourceTableId: sourceTable.id,
            sourceFieldId: sourceField.id,
            targetTableId: targetTable.id,
            targetDisplayFieldId: targetDisplayField.id,
            createdBy: user.id,
          });

          // Insert cross_link_index entry
          const db = getDbForTenant(tenantId, 'write');
          await db.insert(crossLinkIndex).values({
            tenantId,
            crossLinkId: crossLink.id,
            sourceRecordId: sourceRecord.id,
            sourceTableId: sourceTable.id,
            targetRecordId: targetRecord.id,
          });
        },
        query: async (tenantId) => {
          // Use the field ID and record ID from setup.
          // For tenant B, this will return empty because the cross_link
          // doesn't exist in tenant B's scope (RLS isolation).
          // For tenant A, it will find the cross_link and linked records.
          const result = await getLinkedRecords(
            tenantId,
            sourceRecordId!,
            sourceFieldId!,
          );
          return result.records;
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getLinkedRecords
  // -------------------------------------------------------------------------

  describe('getLinkedRecords', () => {
    it('returns linked records with target fields', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const sourceField = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable.id,
        name: 'Link to Tasks',
        fieldType: 'cross_link',
      });

      const targetTable = await createTestTable({ tenantId: tenant.id });
      const targetDisplayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Task Name',
        fieldType: 'text',
        isPrimary: true,
      });

      const sourceRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: sourceTable.id,
      });

      const targetRecord1 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [targetDisplayField.id]: 'Task One' },
      });

      const targetRecord2 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [targetDisplayField.id]: 'Task Two' },
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: targetDisplayField.id,
        createdBy: user.id,
      });

      // Insert cross_link_index entries
      const db = getDbForTenant(tenant.id, 'write');
      await db.insert(crossLinkIndex).values([
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: targetRecord1.id,
        },
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: targetRecord2.id,
        },
      ]);

      const result = await getLinkedRecords(
        tenant.id,
        sourceRecord.id,
        sourceField.id,
      );

      expect(result.totalCount).toBe(2);
      expect(result.records).toHaveLength(2);
      expect(result.crossLink).toBeTruthy();
      expect(result.crossLink!.id).toBe(crossLink.id);
      expect(result.targetFields.length).toBeGreaterThan(0);
      expect(
        result.targetFields.some((f) => f.id === targetDisplayField.id),
      ).toBe(true);

      const recordIds = result.records.map((r) => r.record.id);
      expect(recordIds).toContain(targetRecord1.id);
      expect(recordIds).toContain(targetRecord2.id);
    }, 30_000);

    it('returns empty when no cross_link definition exists', async () => {
      const tenant = await createTestTenant();
      const result = await getLinkedRecords(
        tenant.id,
        generateUUIDv7(),
        generateUUIDv7(),
      );

      expect(result.records).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.crossLink).toBeNull();
      expect(result.targetFields).toEqual([]);
    }, 30_000);

    it('returns empty records with target fields when no links exist', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const sourceField = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable.id,
        name: 'Link',
        fieldType: 'cross_link',
      });

      const targetTable = await createTestTable({ tenantId: tenant.id });
      const targetDisplayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });

      await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: targetDisplayField.id,
        createdBy: user.id,
      });

      const result = await getLinkedRecords(
        tenant.id,
        generateUUIDv7(),
        sourceField.id,
      );

      expect(result.records).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.crossLink).toBeTruthy();
      // Should still return target fields for column headers
      expect(result.targetFields.length).toBeGreaterThan(0);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getLinkedRecordCount
  // -------------------------------------------------------------------------

  describe('getLinkedRecordCount', () => {
    it('returns correct count of linked records', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const sourceField = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable.id,
        name: 'Link',
        fieldType: 'cross_link',
      });

      const targetTable = await createTestTable({ tenantId: tenant.id });
      const targetDisplayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });

      const sourceRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: sourceTable.id,
      });

      const targetRecord1 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
      });
      const targetRecord2 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
      });
      const targetRecord3 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: targetDisplayField.id,
        createdBy: user.id,
      });

      const db = getDbForTenant(tenant.id, 'write');
      await db.insert(crossLinkIndex).values([
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: targetRecord1.id,
        },
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: targetRecord2.id,
        },
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: targetRecord3.id,
        },
      ]);

      const count = await getLinkedRecordCount(
        tenant.id,
        sourceRecord.id,
        sourceField.id,
      );

      expect(count).toBe(3);
    }, 30_000);

    it('returns 0 when no cross_link definition exists', async () => {
      const tenant = await createTestTenant();
      const count = await getLinkedRecordCount(
        tenant.id,
        generateUUIDv7(),
        generateUUIDv7(),
      );
      expect(count).toBe(0);
    }, 30_000);

    it('returns 0 when no links exist', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const sourceField = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable.id,
        name: 'Link',
        fieldType: 'cross_link',
      });

      const targetTable = await createTestTable({ tenantId: tenant.id });
      const targetDisplayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });

      await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: targetDisplayField.id,
        createdBy: user.id,
      });

      const count = await getLinkedRecordCount(
        tenant.id,
        generateUUIDv7(),
        sourceField.id,
      );
      expect(count).toBe(0);
    }, 30_000);
  });
});
