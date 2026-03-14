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
import { getDbForTenant, records, eq, and } from '@everystack/shared/db';
import type { CrossLinkFieldValue } from '@everystack/shared/sync';
import {
  resolveLinkedRecordsL0,
  resolveLinkedRecordsL1,
  resolveLinkedRecordPermissions,
  filterLinkedRecordByPermissions,
} from '../cross-link-resolution';

describe('Cross-Link Resolution', () => {
  // -------------------------------------------------------------------------
  // L0 — Pure canonical extraction
  // -------------------------------------------------------------------------

  describe('resolveLinkedRecordsL0', () => {
    it('extracts display values from canonical JSONB with zero database queries', () => {
      const fieldId = 'field-uuid-001';
      const canonicalData: Record<string, unknown> = {
        [fieldId]: {
          type: 'cross_link',
          value: {
            linked_records: [
              {
                record_id: 'rec-1',
                table_id: 'tbl-1',
                display_value: 'Acme Corp',
                _display_updated_at: '2026-03-14T00:00:00Z',
              },
              {
                record_id: 'rec-2',
                table_id: 'tbl-1',
                display_value: 'Beta Inc',
                _display_updated_at: '2026-03-14T00:00:00Z',
              },
            ],
            cross_link_id: 'cl-1',
          },
        } satisfies CrossLinkFieldValue,
        'other-field': 'plain text value',
      };

      const result = resolveLinkedRecordsL0(canonicalData, fieldId);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('cross_link');
      expect(result?.value.linked_records).toHaveLength(2);
      expect(result?.value.linked_records[0]?.display_value).toBe('Acme Corp');
      expect(result?.value.linked_records[1]?.display_value).toBe('Beta Inc');
      expect(result?.value.cross_link_id).toBe('cl-1');
    });

    it('returns null for non-existent field', () => {
      const result = resolveLinkedRecordsL0({}, 'missing-field');
      expect(result).toBeNull();
    });

    it('returns null for non-cross-link field value', () => {
      const result = resolveLinkedRecordsL0({ 'field-1': 'plain text' }, 'field-1');
      expect(result).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // L1 — Single IN query resolution
  // -------------------------------------------------------------------------

  describe('resolveLinkedRecordsL1', () => {
    it('returns full linked records, paginated, ordered by creation time', async () => {
      const fixture = await createTestCrossLinkWithIndex({
        sourceRecordCount: 1,
        targetRecordCount: 3,
      });

      const sourceRecord = fixture.sourceRecords[0]!;
      const result = await resolveLinkedRecordsL1(
        fixture.crossLink.tenantId,
        sourceRecord.id,
        fixture.crossLink.id,
      );

      expect(result.totalCount).toBe(3);
      expect(result.records).toHaveLength(3);

      // Verify ordering by index created_at ASC
      for (let i = 1; i < result.records.length; i++) {
        const prev = result.records[i - 1]!.crossLinkIndexCreatedAt;
        const curr = result.records[i]!.crossLinkIndexCreatedAt;
        expect(prev.getTime()).toBeLessThanOrEqual(curr.getTime());
      }

      // Verify records have canonical data
      for (const linkedResult of result.records) {
        expect(linkedResult.record.id).toBeDefined();
        expect(linkedResult.record.canonicalData).toBeDefined();
      }
    });

    it('paginates with limit and offset', async () => {
      const fixture = await createTestCrossLinkWithIndex({
        sourceRecordCount: 1,
        targetRecordCount: 5,
      });

      const sourceRecord = fixture.sourceRecords[0]!;

      // First page: 2 records
      const page1 = await resolveLinkedRecordsL1(
        fixture.crossLink.tenantId,
        sourceRecord.id,
        fixture.crossLink.id,
        { limit: 2, offset: 0 },
      );

      expect(page1.records).toHaveLength(2);
      expect(page1.totalCount).toBe(5);

      // Second page: 2 records
      const page2 = await resolveLinkedRecordsL1(
        fixture.crossLink.tenantId,
        sourceRecord.id,
        fixture.crossLink.id,
        { limit: 2, offset: 2 },
      );

      expect(page2.records).toHaveLength(2);
      expect(page2.totalCount).toBe(5);

      // No overlap between pages
      const page1Ids = page1.records.map((r) => r.record.id);
      const page2Ids = page2.records.map((r) => r.record.id);
      for (const id of page2Ids) {
        expect(page1Ids).not.toContain(id);
      }
    });

    it('returns empty result when no links exist', async () => {
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const record = await createTestRecord({ tenantId: tenant.id, tableId: table.id });
      const crossLink = await createTestCrossLink({ tenantId: tenant.id });

      const result = await resolveLinkedRecordsL1(
        tenant.id,
        record.id,
        crossLink.id,
      );

      expect(result.records).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('excludes archived target records', async () => {
      const fixture = await createTestCrossLinkWithIndex({
        sourceRecordCount: 1,
        targetRecordCount: 3,
      });

      // Archive one target record
      const db = getDbForTenant(fixture.crossLink.tenantId, 'write');
      await db
        .update(records)
        .set({ archivedAt: new Date() })
        .where(
          and(
            eq(records.tenantId, fixture.crossLink.tenantId),
            eq(records.id, fixture.targetRecords[0]!.id),
          ),
        );

      const result = await resolveLinkedRecordsL1(
        fixture.crossLink.tenantId,
        fixture.sourceRecords[0]!.id,
        fixture.crossLink.id,
      );

      // Index still has 3 entries but only 2 non-archived records returned
      expect(result.totalCount).toBe(3); // total from index
      expect(result.records).toHaveLength(2); // only non-archived
    });

    // -----------------------------------------------------------------------
    // Tenant isolation
    // -----------------------------------------------------------------------

    it('enforces tenant isolation', async () => {
      let crossLinkId: string;
      let sourceRecordId: string;

      await testTenantIsolation({
        setup: async (tenantId) => {
          const fixture = await createTestCrossLinkWithIndex({
            tenantId,
            sourceRecordCount: 1,
            targetRecordCount: 2,
          });
          crossLinkId = fixture.crossLink.id;
          sourceRecordId = fixture.sourceRecords[0]!.id;
        },
        query: async (tenantId) => {
          const result = await resolveLinkedRecordsL1(
            tenantId,
            sourceRecordId,
            crossLinkId,
          );
          return result.records;
        },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Permission intersection
  // -------------------------------------------------------------------------

  describe('resolveLinkedRecordPermissions', () => {
    it('intersects card_fields with user target table permissions', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      // Create workspace membership (team_member has read_write by default)
      const targetTable = await createTestTable({ tenantId: tenant.id });
      await createTestTenantMembership({ tenantId: tenant.id, userId: user.id, role: 'member' });
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        userId: user.id,
        workspaceId: targetTable.workspaceId,
        role: 'team_member',
      });

      // Create fields on target table
      const field1 = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });
      const field2 = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Email',
        fieldType: 'text',
      });
      const field3 = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Secret',
        fieldType: 'text',
        permissions: { member_edit: false, viewer_visible: false },
      });

      // Cross-link with card_fields = [field1, field3]
      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: field1.id,
        cardFields: [field1.id, field3.id],
      });

      const permittedFields = await resolveLinkedRecordPermissions(
        tenant.id,
        user.id,
        crossLink,
        targetTable.id,
      );

      // field1 is in card_fields and user has permission → included
      expect(permittedFields).toContain(field1.id);
      // field2 is not in card_fields → excluded (even though user has permission)
      expect(permittedFields).not.toContain(field2.id);
      // field3 is in card_fields but member_edit=false → read_only for team_member → still included
      expect(permittedFields).toContain(field3.id);
    });

    it('uses all non-hidden fields when card_fields is empty', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const targetTable = await createTestTable({ tenantId: tenant.id });
      await createTestTenantMembership({ tenantId: tenant.id, userId: user.id, role: 'member' });
      await createTestWorkspaceMembership({
        tenantId: tenant.id,
        userId: user.id,
        workspaceId: targetTable.workspaceId,
        role: 'team_member',
      });

      const field1 = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });
      const field2 = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Status',
        fieldType: 'text',
      });

      // Cross-link with empty card_fields
      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: field1.id,
        cardFields: [],
      });

      const permittedFields = await resolveLinkedRecordPermissions(
        tenant.id,
        user.id,
        crossLink,
        targetTable.id,
      );

      // All fields should be included since card_fields is empty
      expect(permittedFields).toContain(field1.id);
      expect(permittedFields).toContain(field2.id);
    });

    it('returns empty array when user has no access to target workspace', async () => {
      const tenant = await createTestTenant();
      const user = await createTestUser();

      const targetTable = await createTestTable({ tenantId: tenant.id });
      // No workspace membership created for user

      const field1 = await createTestField({
        tenantId: tenant.id,
        tableId: targetTable.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        targetTableId: targetTable.id,
        targetDisplayFieldId: field1.id,
        cardFields: [field1.id],
      });

      const permittedFields = await resolveLinkedRecordPermissions(
        tenant.id,
        user.id,
        crossLink,
        targetTable.id,
      );

      expect(permittedFields).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // Permission-based field stripping
  // -------------------------------------------------------------------------

  describe('filterLinkedRecordByPermissions', () => {
    it('strips non-permitted fields from canonical_data', () => {
      const record = {
        tenantId: 'tenant-1',
        id: 'rec-1',
        tableId: 'tbl-1',
        canonicalData: {
          'field-a': 'visible value',
          'field-b': 'hidden value',
          'field-c': 42,
        },
        syncMetadata: null,
        searchVector: null,
        archivedAt: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = filterLinkedRecordByPermissions(record, ['field-a', 'field-c']);

      expect(result.canonicalData).toEqual({
        'field-a': 'visible value',
        'field-c': 42,
      });
      expect(result.id).toBe('rec-1');
      // field-b should not be in the result
      expect(result.canonicalData?.['field-b']).toBeUndefined();
    });

    it('returns minimal shape when zero permitted fields', () => {
      const record = {
        tenantId: 'tenant-1',
        id: 'rec-123',
        tableId: 'tbl-1',
        canonicalData: {
          'field-a': 'value',
          'field-b': 'value',
        },
        syncMetadata: null,
        searchVector: null,
        archivedAt: null,
        createdBy: null,
        updatedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = filterLinkedRecordByPermissions(record, []);

      expect(result.id).toBe('rec-123');
      expect(result.canonicalData).toEqual({});
      // Should NOT include other properties in the minimal shape
      expect(result.tableId).toBeUndefined();
      expect(result.tenantId).toBeUndefined();
    });
  });
});
