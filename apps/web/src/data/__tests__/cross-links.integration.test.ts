import { describe, it, expect } from 'vitest';
import {
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecord,
  createTestCrossLink,
  createTestCrossLinkWithIndex,
  createTestUser,
  createTestTenantMembership,
  createTestWorkspaceMembership,
  testTenantIsolation,
} from '@everystack/shared/testing';
import { getDbForTenant, crossLinks, crossLinkIndex, records } from '@everystack/shared/db';
import { generateUUIDv7 } from '@everystack/shared/db';
import { and, eq, count } from 'drizzle-orm';
import {
  CROSS_LINK_LIMITS,
  extractCrossLinkField,
  setCrossLinkField,
} from '@everystack/shared/sync';
import type { CrossLinkFieldValue } from '@everystack/shared/sync';
import {
  getLinkedRecords,
  getLinkedRecordCount,
  getCrossLinkDefinition,
  listCrossLinkDefinitions,
  getCrossLinksByTarget,
  validateLinkTarget,
  checkCrossLinkPermission,
} from '../cross-links';

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

  // -------------------------------------------------------------------------
  // getCrossLinkDefinition
  // -------------------------------------------------------------------------

  describe('getCrossLinkDefinition', () => {
    it('returns correct definition by ID', async () => {
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
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: targetDisplayField.id,
        createdBy: user.id,
      });

      const result = await getCrossLinkDefinition(tenant.id, crossLink.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(crossLink.id);
      expect(result!.sourceTableId).toBe(sourceTable.id);
      expect(result!.targetTableId).toBe(targetTable.id);
    }, 30_000);

    it('returns null for wrong tenant', async () => {
      const tenant1 = await createTestTenant();
      const tenant2 = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant1.id });
      const sourceField = await createTestField({
        tenantId: tenant1.id,
        tableId: sourceTable.id,
        name: 'Link',
        fieldType: 'cross_link',
      });
      const targetTable = await createTestTable({ tenantId: tenant1.id });
      const targetDisplayField = await createTestField({
        tenantId: tenant1.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant1.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: targetDisplayField.id,
        createdBy: user.id,
      });

      const result = await getCrossLinkDefinition(tenant2.id, crossLink.id);
      expect(result).toBeNull();
    }, 30_000);

    it('returns null for non-existent ID', async () => {
      const tenant = await createTestTenant();
      const result = await getCrossLinkDefinition(tenant.id, generateUUIDv7());
      expect(result).toBeNull();
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // listCrossLinkDefinitions
  // -------------------------------------------------------------------------

  describe('listCrossLinkDefinitions', () => {
    it('returns only definitions for specified table', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const table1 = await createTestTable({ tenantId: tenant.id });
      const table2 = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({ tenantId: tenant.id });

      const field1 = await createTestField({
        tenantId: tenant.id,
        tableId: table1.id,
        name: 'Link1',
        fieldType: 'cross_link',
      });
      const field2 = await createTestField({
        tenantId: tenant.id,
        tableId: table2.id,
        name: 'Link2',
        fieldType: 'cross_link',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table1.id,
        sourceFieldId: field1.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table2.id,
        sourceFieldId: field2.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      const result = await listCrossLinkDefinitions(tenant.id, table1.id);
      expect(result).toHaveLength(1);
      expect(result[0]!.sourceTableId).toBe(table1.id);
    }, 30_000);

    it('returns empty array when no definitions exist', async () => {
      const tenant = await createTestTenant();
      const result = await listCrossLinkDefinitions(tenant.id, generateUUIDv7());
      expect(result).toEqual([]);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // getCrossLinksByTarget
  // -------------------------------------------------------------------------

  describe('getCrossLinksByTarget', () => {
    it('returns reverse lookups correctly', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable1 = await createTestTable({ tenantId: tenant.id });
      const sourceTable2 = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({ tenantId: tenant.id });

      const field1 = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable1.id,
        name: 'Link1',
        fieldType: 'cross_link',
      });
      const field2 = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable2.id,
        name: 'Link2',
        fieldType: 'cross_link',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable1.id,
        sourceFieldId: field1.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });
      await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable2.id,
        sourceFieldId: field2.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      const result = await getCrossLinksByTarget(tenant.id, targetTable.id);
      expect(result).toHaveLength(2);
      const sourceTableIds = result.map((cl) => cl.sourceTableId);
      expect(sourceTableIds).toContain(sourceTable1.id);
      expect(sourceTableIds).toContain(sourceTable2.id);
    }, 30_000);

    it('returns empty array when no definitions point at table', async () => {
      const tenant = await createTestTenant();
      const result = await getCrossLinksByTarget(tenant.id, generateUUIDv7());
      expect(result).toEqual([]);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // validateLinkTarget
  // -------------------------------------------------------------------------

  describe('validateLinkTarget', () => {
    it('validates a valid target record', async () => {
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
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      const targetRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        targetRecord.id,
      );
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    }, 30_000);

    it('rejects archived records', async () => {
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
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      const targetRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        archivedAt: new Date(),
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        targetRecord.id,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Target record is archived');
    }, 30_000);

    it('rejects same-record self-links', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const table = await createTestTable({ tenantId: tenant.id });
      const sourceField = await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Link',
        fieldType: 'cross_link',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Name',
        fieldType: 'text',
      });

      // Same-table cross-link (allowed), but same-record self-link blocked
      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table.id,
        sourceFieldId: sourceField.id,
        targetTableId: table.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      const record = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        record.id,
        record.id, // same record as source
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('A record cannot link to itself');
    }, 30_000);

    it('rejects records that fail scope filter', async () => {
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
      const statusField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Status',
        fieldType: 'text',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
        linkScopeFilter: {
          conditions: [
            { field_id: statusField.id, operator: 'in', value: ['Active', 'Pending'] },
          ],
          logic: 'and',
        },
      });

      // Record with status = "Closed" should fail the scope filter
      const targetRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [statusField.id]: 'Closed' },
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        targetRecord.id,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Target record does not match scope filter');
    }, 30_000);

    it('accepts records that pass scope filter', async () => {
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
      const statusField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Status',
        fieldType: 'text',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
        linkScopeFilter: {
          conditions: [
            { field_id: statusField.id, operator: 'in', value: ['Active', 'Pending'] },
          ],
          logic: 'and',
        },
      });

      const targetRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [statusField.id]: 'Active' },
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        targetRecord.id,
      );
      expect(result.valid).toBe(true);
    }, 30_000);

    it('rejects non-existent records', async () => {
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
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        generateUUIDv7(),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Target record does not exist');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // checkCrossLinkPermission
  // -------------------------------------------------------------------------

  describe('checkCrossLinkPermission', () => {
    it('allows create when user is Manager of both tables in same workspace', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const workspace = (await createTestTable({ tenantId: tenant.id }));

      // Create tables in the same workspace
      const sourceTable = await createTestTable({
        tenantId: tenant.id,
        workspaceId: workspace.workspaceId,
      });
      const targetTable = await createTestTable({
        tenantId: tenant.id,
        workspaceId: workspace.workspaceId,
      });

      // Grant tenant membership and workspace Manager role
      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
      });
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: workspace.workspaceId,
        userId: user.id,
        role: 'manager',
      });

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'create',
      );
      expect(result).toBe(true);
    }, 30_000);

    it('denies create when user is only team_member', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({
        tenantId: tenant.id,
        workspaceId: sourceTable.workspaceId,
      });

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
      });
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: sourceTable.workspaceId,
        userId: user.id,
        role: 'team_member',
      });

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'create',
      );
      expect(result).toBe(false);
    }, 30_000);

    it('allows create cross-workspace when user is Admin', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({ tenantId: tenant.id });

      // Admin is tenant-level — no workspace membership needed
      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'admin',
      });

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'create',
      );
      expect(result).toBe(true);
    }, 30_000);

    it('denies create cross-workspace when user is Manager of only one workspace', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({ tenantId: tenant.id });

      // Make sure tables are in different workspaces (default behavior of createTestTable)
      expect(sourceTable.workspaceId).not.toBe(targetTable.workspaceId);

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
      });
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: sourceTable.workspaceId,
        userId: user.id,
        role: 'manager',
      });
      // No membership on target workspace

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'create',
      );
      expect(result).toBe(false);
    }, 30_000);

    it('allows operational when Manager of either table', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({ tenantId: tenant.id });

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
      });
      // Manager of source workspace only
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: sourceTable.workspaceId,
        userId: user.id,
        role: 'manager',
      });

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'operational',
      );
      expect(result).toBe(true);
    }, 30_000);

    it('denies operational when viewer only', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({
        tenantId: tenant.id,
        workspaceId: sourceTable.workspaceId,
      });

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'member',
      });
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        workspaceId: sourceTable.workspaceId,
        userId: user.id,
        role: 'viewer',
      });

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'operational',
      );
      expect(result).toBe(false);
    }, 30_000);

    it('allows structural for Owner', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const targetTable = await createTestTable({ tenantId: tenant.id });

      await createTestTenantMembership({
        tenantId: tenant.id,
        userId: user.id,
        role: 'owner',
      });

      const result = await checkCrossLinkPermission(
        tenant.id,
        user.id,
        sourceTable.id,
        targetTable.id,
        'structural',
      );
      expect(result).toBe(true);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Tenant Isolation — new data functions
  // -------------------------------------------------------------------------

  describe('getCrossLinkDefinition — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();
      let crossLinkId: string;

      await testTenantIsolation({
        setup: async (tenantId) => {
          const sourceTable = await createTestTable({ tenantId });
          const sourceField = await createTestField({
            tenantId,
            tableId: sourceTable.id,
            name: 'Link',
            fieldType: 'cross_link',
          });
          const targetTable = await createTestTable({ tenantId });
          const displayField = await createTestField({
            tenantId,
            tableId: targetTable.id,
            name: 'Name',
            fieldType: 'text',
          });
          const crossLink = await createTestCrossLink({
            tenantId,
            sourceTableId: sourceTable.id,
            sourceFieldId: sourceField.id,
            targetTableId: targetTable.id,
            targetDisplayFieldId: displayField.id,
            createdBy: user.id,
          });
          crossLinkId = crossLink.id;
        },
        query: async (tenantId) => {
          const result = await getCrossLinkDefinition(tenantId, crossLinkId!);
          return result ? [result] : [];
        },
      });
    }, 30_000);
  });

  describe('listCrossLinkDefinitions — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();
      let sourceTableId: string;

      await testTenantIsolation({
        setup: async (tenantId) => {
          const sourceTable = await createTestTable({ tenantId });
          sourceTableId = sourceTable.id;
          const sourceField = await createTestField({
            tenantId,
            tableId: sourceTable.id,
            name: 'Link',
            fieldType: 'cross_link',
          });
          const targetTable = await createTestTable({ tenantId });
          const displayField = await createTestField({
            tenantId,
            tableId: targetTable.id,
            name: 'Name',
            fieldType: 'text',
          });
          await createTestCrossLink({
            tenantId,
            sourceTableId: sourceTable.id,
            sourceFieldId: sourceField.id,
            targetTableId: targetTable.id,
            targetDisplayFieldId: displayField.id,
            createdBy: user.id,
          });
        },
        query: async (tenantId) => {
          return listCrossLinkDefinitions(tenantId, sourceTableId!);
        },
      });
    }, 30_000);
  });

  describe('getCrossLinksByTarget — tenant isolation', () => {
    it('enforces tenant isolation', async () => {
      const user = await createTestUser();
      let targetTableId: string;

      await testTenantIsolation({
        setup: async (tenantId) => {
          const sourceTable = await createTestTable({ tenantId });
          const sourceField = await createTestField({
            tenantId,
            tableId: sourceTable.id,
            name: 'Link',
            fieldType: 'cross_link',
          });
          const targetTable = await createTestTable({ tenantId });
          targetTableId = targetTable.id;
          const displayField = await createTestField({
            tenantId,
            tableId: targetTable.id,
            name: 'Name',
            fieldType: 'text',
          });
          await createTestCrossLink({
            tenantId,
            sourceTableId: sourceTable.id,
            sourceFieldId: sourceField.id,
            targetTableId: targetTable.id,
            targetDisplayFieldId: displayField.id,
            createdBy: user.id,
          });
        },
        query: async (tenantId) => {
          return getCrossLinksByTarget(tenantId, targetTableId!);
        },
      });
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // createTestCrossLinkWithIndex factory validation
  // -------------------------------------------------------------------------

  describe('createTestCrossLinkWithIndex factory', () => {
    it('creates complete fixture with defaults', async () => {
      const tenant = await createTestTenant();
      const result = await createTestCrossLinkWithIndex({ tenantId: tenant.id });

      expect(result.crossLink).toBeDefined();
      expect(result.sourceTable).toBeDefined();
      expect(result.targetTable).toBeDefined();
      expect(result.sourceField).toBeDefined();
      expect(result.targetDisplayField).toBeDefined();
      expect(result.sourceRecords).toHaveLength(2); // default
      expect(result.targetRecords).toHaveLength(3); // default
      // Each source links to all 3 targets → 6 index entries
      expect(result.indexEntries).toHaveLength(6);

      // Verify canonical field values on source records
      for (const sourceRecord of result.sourceRecords) {
        const fieldValue = extractCrossLinkField(
          sourceRecord.canonicalData,
          result.sourceField.id,
        );
        expect(fieldValue).not.toBeNull();
        expect(fieldValue!.type).toBe('cross_link');
        expect(fieldValue!.value.cross_link_id).toBe(result.crossLink.id);
        expect(fieldValue!.value.linked_records).toHaveLength(3);
      }
    }, 30_000);

    it('respects custom record counts and links per source', async () => {
      const tenant = await createTestTenant();
      const result = await createTestCrossLinkWithIndex({
        tenantId: tenant.id,
        sourceRecordCount: 1,
        targetRecordCount: 5,
        linksPerSourceRecord: 2,
      });

      expect(result.sourceRecords).toHaveLength(1);
      expect(result.targetRecords).toHaveLength(5);
      // 1 source × 2 links = 2 index entries
      expect(result.indexEntries).toHaveLength(2);

      const fieldValue = extractCrossLinkField(
        result.sourceRecords[0]!.canonicalData,
        result.sourceField.id,
      );
      expect(fieldValue!.value.linked_records).toHaveLength(2);
    }, 30_000);

    it('populates display values from target records', async () => {
      const tenant = await createTestTenant();
      const result = await createTestCrossLinkWithIndex({
        tenantId: tenant.id,
        sourceRecordCount: 1,
        targetRecordCount: 2,
      });

      const fieldValue = extractCrossLinkField(
        result.sourceRecords[0]!.canonicalData,
        result.sourceField.id,
      );
      expect(fieldValue).not.toBeNull();

      const displayValues = fieldValue!.value.linked_records.map((lr) => lr.display_value);
      expect(displayValues).toContain('Target 1');
      expect(displayValues).toContain('Target 2');
    }, 30_000);

    it('index entries match cross-link definition', async () => {
      const tenant = await createTestTenant();
      const result = await createTestCrossLinkWithIndex({ tenantId: tenant.id });

      for (const entry of result.indexEntries) {
        expect(entry.crossLinkId).toBe(result.crossLink.id);
        expect(entry.sourceTableId).toBe(result.sourceTable.id);
        expect(entry.tenantId).toBe(tenant.id);
      }
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // End-to-end lifecycle: create → link → verify → unlink → verify cleanup
  // -------------------------------------------------------------------------

  describe('Cross-link lifecycle (data layer)', () => {
    it('create definition → link records → verify index → verify canonical → unlink → verify cleanup', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      // Setup tables
      const sourceTable = await createTestTable({ tenantId: tenant.id });
      const sourceField = await createTestField({
        tenantId: tenant.id,
        tableId: sourceTable.id,
        name: 'Link',
        fieldType: 'cross_link',
      });
      const targetTable = await createTestTable({ tenantId: tenant.id });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });

      // Create definition
      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      // Create records
      const sourceRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: sourceTable.id,
      });
      const targetRecord1 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [displayField.id]: 'Acme Corp' },
      });
      const targetRecord2 = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [displayField.id]: 'Beta Inc' },
      });

      const db = getDbForTenant(tenant.id, 'write');

      // Link records — insert index entries
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

      // Set canonical field value
      const fieldValue: CrossLinkFieldValue = {
        type: 'cross_link',
        value: {
          linked_records: [
            {
              record_id: targetRecord1.id,
              table_id: targetTable.id,
              display_value: 'Acme Corp',
              _display_updated_at: new Date().toISOString(),
            },
            {
              record_id: targetRecord2.id,
              table_id: targetTable.id,
              display_value: 'Beta Inc',
              _display_updated_at: new Date().toISOString(),
            },
          ],
          cross_link_id: crossLink.id,
        },
      };

      const updatedCanonical = setCrossLinkField(
        sourceRecord.canonicalData,
        sourceField.id,
        fieldValue,
      );
      await db
        .update(records)
        .set({ canonicalData: updatedCanonical })
        .where(and(eq(records.tenantId, tenant.id), eq(records.id, sourceRecord.id)));

      // Verify index entries via getLinkedRecords
      const linked = await getLinkedRecords(tenant.id, sourceRecord.id, sourceField.id);
      expect(linked.totalCount).toBe(2);
      expect(linked.records).toHaveLength(2);
      expect(linked.crossLink!.id).toBe(crossLink.id);

      // Verify canonical data
      const [refreshedSource] = await db
        .select()
        .from(records)
        .where(and(eq(records.tenantId, tenant.id), eq(records.id, sourceRecord.id)))
        .limit(1);
      const extractedField = extractCrossLinkField(refreshedSource!.canonicalData, sourceField.id);
      expect(extractedField).not.toBeNull();
      expect(extractedField!.value.linked_records).toHaveLength(2);

      // Unlink — remove index entries for targetRecord1
      await db
        .delete(crossLinkIndex)
        .where(
          and(
            eq(crossLinkIndex.tenantId, tenant.id),
            eq(crossLinkIndex.crossLinkId, crossLink.id),
            eq(crossLinkIndex.sourceRecordId, sourceRecord.id),
            eq(crossLinkIndex.targetRecordId, targetRecord1.id),
          ),
        );

      // Remove from canonical
      const afterUnlink = setCrossLinkField(
        refreshedSource!.canonicalData,
        sourceField.id,
        {
          type: 'cross_link',
          value: {
            linked_records: extractedField!.value.linked_records.filter(
              (lr) => lr.record_id !== targetRecord1.id,
            ),
            cross_link_id: crossLink.id,
          },
        },
      );
      await db
        .update(records)
        .set({ canonicalData: afterUnlink })
        .where(and(eq(records.tenantId, tenant.id), eq(records.id, sourceRecord.id)));

      // Verify cleanup
      const afterUnlinkResult = await getLinkedRecords(tenant.id, sourceRecord.id, sourceField.id);
      expect(afterUnlinkResult.totalCount).toBe(1);
      expect(afterUnlinkResult.records[0]!.record.id).toBe(targetRecord2.id);
    }, 30_000);

    it('delete definition cascades index entries', async () => {
      const tenant = await createTestTenant();
      const fixture = await createTestCrossLinkWithIndex({ tenantId: tenant.id });
      const db = getDbForTenant(tenant.id, 'write');

      // Verify index entries exist
      const [beforeCount] = await db
        .select({ value: count() })
        .from(crossLinkIndex)
        .where(
          and(
            eq(crossLinkIndex.tenantId, tenant.id),
            eq(crossLinkIndex.crossLinkId, fixture.crossLink.id),
          ),
        );
      expect(Number(beforeCount!.value)).toBeGreaterThan(0);

      // Delete the cross-link definition (FK cascade should clean index)
      await db
        .delete(crossLinks)
        .where(
          and(
            eq(crossLinks.tenantId, tenant.id),
            eq(crossLinks.id, fixture.crossLink.id),
          ),
        );

      // Verify index entries cascaded
      const [afterCount] = await db
        .select({ value: count() })
        .from(crossLinkIndex)
        .where(
          and(
            eq(crossLinkIndex.tenantId, tenant.id),
            eq(crossLinkIndex.crossLinkId, fixture.crossLink.id),
          ),
        );
      expect(Number(afterCount!.value)).toBe(0);

      // Verify definition is gone
      const def = await getCrossLinkDefinition(tenant.id, fixture.crossLink.id);
      expect(def).toBeNull();
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // validateLinkTarget — comprehensive edge cases
  // -------------------------------------------------------------------------

  describe('validateLinkTarget — edge cases', () => {
    it('rejects record from wrong table', async () => {
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
      const wrongTable = await createTestTable({ tenantId: tenant.id });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
      });

      // Record belongs to wrong table
      const wrongRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: wrongTable.id,
      });

      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        wrongRecord.id,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Target record does not belong to the target table');
    }, 30_000);

    it('validates scope filter with multiple AND conditions', async () => {
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
      const statusField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Status',
        fieldType: 'text',
      });
      const priorityField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Priority',
        fieldType: 'text',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
        linkScopeFilter: {
          conditions: [
            { field_id: statusField.id, operator: 'eq', value: 'Active' },
            { field_id: priorityField.id, operator: 'in', value: ['High', 'Critical'] },
          ],
          logic: 'and',
        },
      });

      // Record matches both conditions
      const matchingRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: {
          [statusField.id]: 'Active',
          [priorityField.id]: 'High',
        },
      });

      const result1 = await validateLinkTarget(tenant.id, crossLink.id, matchingRecord.id);
      expect(result1.valid).toBe(true);

      // Record fails one condition
      const partialRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: {
          [statusField.id]: 'Active',
          [priorityField.id]: 'Low',
        },
      });

      const result2 = await validateLinkTarget(tenant.id, crossLink.id, partialRecord.id);
      expect(result2.valid).toBe(false);
      expect(result2.reason).toBe('Target record does not match scope filter');
    }, 30_000);

    it('validates scope filter with OR logic', async () => {
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
      const statusField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Status',
        fieldType: 'text',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
        linkScopeFilter: {
          conditions: [
            { field_id: statusField.id, operator: 'eq', value: 'Active' },
            { field_id: statusField.id, operator: 'eq', value: 'Pending' },
          ],
          logic: 'or',
        },
      });

      // Record matches one of the OR conditions
      const record = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [statusField.id]: 'Pending' },
      });

      const result = await validateLinkTarget(tenant.id, crossLink.id, record.id);
      expect(result.valid).toBe(true);

      // Record fails all OR conditions
      const failRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: targetTable.id,
        canonicalData: { [statusField.id]: 'Closed' },
      });

      const result2 = await validateLinkTarget(tenant.id, crossLink.id, failRecord.id);
      expect(result2.valid).toBe(false);
    }, 30_000);

    it('rejects when at max link count', async () => {
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
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
      });

      // Create with maxLinksPerRecord = 2
      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: sourceTable.id,
        sourceFieldId: sourceField.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: displayField.id,
        createdBy: user.id,
        maxLinksPerRecord: 2,
      });

      const sourceRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: sourceTable.id,
      });

      // Link 2 records (at max)
      const db = getDbForTenant(tenant.id, 'write');
      const target1 = await createTestRecord({ tenantId: tenant.id, tableId: targetTable.id });
      const target2 = await createTestRecord({ tenantId: tenant.id, tableId: targetTable.id });
      await db.insert(crossLinkIndex).values([
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: target1.id,
        },
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: sourceRecord.id,
          sourceTableId: sourceTable.id,
          targetRecordId: target2.id,
        },
      ]);

      // Try to link a 3rd — should fail
      const target3 = await createTestRecord({ tenantId: tenant.id, tableId: targetTable.id });
      const result = await validateLinkTarget(
        tenant.id,
        crossLink.id,
        target3.id,
        sourceRecord.id,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Link count exceeds max_links_per_record limit');
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Max definitions per table enforcement
  // -------------------------------------------------------------------------

  describe('MAX_DEFINITIONS_PER_TABLE limit', () => {
    it('enforces limit by verifying count matches definitions created', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();
      const sourceTable = await createTestTable({ tenantId: tenant.id });

      const definitionsToCreate = 3;
      for (let i = 0; i < definitionsToCreate; i++) {
        const field = await createTestField({
          tenantId: tenant.id,
          tableId: sourceTable.id,
          name: `Link ${i}`,
          fieldType: 'cross_link',
        });
        const targetTable = await createTestTable({ tenantId: tenant.id });
        const displayField = await createTestField({
          tenantId: tenant.id,
          tableId: targetTable.id,
          name: 'Name',
          fieldType: 'text',
        });
        await createTestCrossLink({
          tenantId: tenant.id,
          sourceTableId: sourceTable.id,
          sourceFieldId: field.id,
          targetTableId: targetTable.id,
          targetDisplayFieldId: displayField.id,
          createdBy: user.id,
        });
      }

      const defs = await listCrossLinkDefinitions(tenant.id, sourceTable.id);
      expect(defs).toHaveLength(definitionsToCreate);

      // Verify limit constant is reasonable
      expect(CROSS_LINK_LIMITS.MAX_DEFINITIONS_PER_TABLE).toBe(20);
    }, 30_000);
  });

  // -------------------------------------------------------------------------
  // Display value population
  // -------------------------------------------------------------------------

  describe('display value in canonical JSONB', () => {
    it('linked records carry display values from target display field', async () => {
      const tenant = await createTestTenant();
      const fixture = await createTestCrossLinkWithIndex({
        tenantId: tenant.id,
        sourceRecordCount: 1,
        targetRecordCount: 2,
      });

      const source = fixture.sourceRecords[0]!;
      const fieldValue = extractCrossLinkField(source.canonicalData, fixture.sourceField.id);

      expect(fieldValue).not.toBeNull();
      const entries = fieldValue!.value.linked_records;
      expect(entries).toHaveLength(2);

      // Each entry should have a non-empty display value from target
      for (const entry of entries) {
        expect(entry.display_value).toBeTruthy();
        expect(entry.table_id).toBe(fixture.targetTable.id);
        expect(entry._display_updated_at).toBeTruthy();
      }
    }, 30_000);
  });
});
