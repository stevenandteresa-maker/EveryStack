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
  getTestDb,
} from '@everystack/shared/testing';
import { getDbForTenant, records, crossLinkIndex, eq, and } from '@everystack/shared/db';
import type { CrossLinkFieldValue } from '@everystack/shared/sync';
import { CROSS_LINK_LIMITS } from '@everystack/shared/sync';
import {
  resolveLinkedRecordsL0,
  resolveLinkedRecordsL1,
  resolveLinkedRecordsL2,
  resolveLinkedRecordPermissions,
  filterLinkedRecordByPermissions,
} from '../cross-link-resolution';
import type { LinkedRecordTree } from '../cross-link-resolution';

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

  // -------------------------------------------------------------------------
  // L2 — Bounded traversal with circuit breaker
  // -------------------------------------------------------------------------

  describe('resolveLinkedRecordsL2', () => {
    /**
     * Helper to create a multi-level cross-link chain.
     * Returns { tenant, crossLink, recordChain } where recordChain[0] is
     * the root and each subsequent element is linked from the previous.
     */
    async function createChain(levels: number, linksPerLevel: number = 1) {
      const db = getTestDb();
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Self Link',
        fieldType: 'cross_link',
      });
      const displayField = await createTestField({
        tenantId: tenant.id,
        tableId: table.id,
        name: 'Name',
        fieldType: 'text',
        isPrimary: true,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table.id,
        sourceFieldId: field.id,
        targetTableId: table.id,
        targetDisplayFieldId: displayField.id,
        maxDepth: 3,
      });

      // Build a chain: root -> level1 records -> level2 records -> ...
      const recordsByLevel: Array<Awaited<ReturnType<typeof createTestRecord>>[]> = [];

      // Root record
      const root = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'Root' },
      });
      recordsByLevel.push([root]);

      // Build subsequent levels
      for (let lvl = 0; lvl < levels; lvl++) {
        const parentRecords = recordsByLevel[recordsByLevel.length - 1]!;
        const childRecords: Awaited<ReturnType<typeof createTestRecord>>[] = [];

        for (const parent of parentRecords) {
          for (let i = 0; i < linksPerLevel; i++) {
            const child = await createTestRecord({
              tenantId: tenant.id,
              tableId: table.id,
              canonicalData: { [displayField.id]: `L${lvl + 1}-${i}` },
            });
            childRecords.push(child);

            // Insert cross_link_index entry
            await db.insert(crossLinkIndex).values({
              tenantId: tenant.id,
              crossLinkId: crossLink.id,
              sourceRecordId: parent.id,
              sourceTableId: table.id,
              targetRecordId: child.id,
            });
          }
        }
        recordsByLevel.push(childRecords);
      }

      return { tenant, crossLink, table, field, displayField, recordsByLevel };
    }

    it('implements iterative bounded traversal with visited set for cycle detection', async () => {
      const { tenant, crossLink, recordsByLevel } = await createChain(2, 2);
      const root = recordsByLevel[0]![0]!;

      const result: LinkedRecordTree = await resolveLinkedRecordsL2(
        tenant.id,
        root.id,
        crossLink.id,
      );

      // Root is depth 0 with 1 record, depth 1 has 2, depth 2 has 4
      expect(result.root).toBe(root.id);
      expect(result.levels).toHaveLength(3);
      expect(result.levels[0]!.depth).toBe(0);
      expect(result.levels[0]!.records).toHaveLength(1);
      expect(result.levels[1]!.depth).toBe(1);
      expect(result.levels[1]!.records).toHaveLength(2);
      expect(result.levels[2]!.depth).toBe(2);
      expect(result.levels[2]!.records).toHaveLength(4);
      expect(result.truncated).toBe(false);
    }, 30_000);

    it('stops at maxDepth (default from definition, hard cap at 5)', async () => {
      // Chain with 6 levels, but definition maxDepth = 3
      const { tenant, crossLink, recordsByLevel } = await createChain(6, 1);
      const root = recordsByLevel[0]![0]!;

      const result = await resolveLinkedRecordsL2(
        tenant.id,
        root.id,
        crossLink.id,
      );

      // Should only traverse 3 levels (depth 0, 1, 2) since definition maxDepth=3
      expect(result.levels).toHaveLength(3);
      expect(result.truncated).toBe(true);
      expect(result.truncationReason).toBe('max_depth');
    }, 30_000);

    it('respects explicit maxDepth parameter, hard cap at 5', async () => {
      const db = getTestDb();
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({
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
        isPrimary: true,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table.id,
        sourceFieldId: field.id,
        targetTableId: table.id,
        targetDisplayFieldId: displayField.id,
        maxDepth: 10, // Definition says 10, but hard cap is 5
      });

      // Build a 7-level chain
      let prevRecord = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'Root' },
      });
      const rootId = prevRecord.id;

      for (let i = 0; i < 7; i++) {
        const next = await createTestRecord({
          tenantId: tenant.id,
          tableId: table.id,
          canonicalData: { [displayField.id]: `Level ${i + 1}` },
        });
        await db.insert(crossLinkIndex).values({
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: prevRecord.id,
          sourceTableId: table.id,
          targetRecordId: next.id,
        });
        prevRecord = next;
      }

      // Request maxDepth=10, should be capped at 5
      const result = await resolveLinkedRecordsL2(
        tenant.id,
        rootId,
        crossLink.id,
        10,
      );

      expect(result.levels.length).toBeLessThanOrEqual(CROSS_LINK_LIMITS.MAX_DEPTH);
      expect(result.truncated).toBe(true);
      expect(result.truncationReason).toBe('max_depth');

      // Also test explicit maxDepth=2
      const result2 = await resolveLinkedRecordsL2(
        tenant.id,
        rootId,
        crossLink.id,
        2,
      );

      expect(result2.levels).toHaveLength(2);
      expect(result2.truncated).toBe(true);
      expect(result2.truncationReason).toBe('max_depth');
    }, 30_000);

    it('circuit breaker triggers at >1000 records, returns truncated result', async () => {
      const db = getTestDb();
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({
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
        isPrimary: true,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table.id,
        sourceFieldId: field.id,
        targetTableId: table.id,
        targetDisplayFieldId: displayField.id,
        maxDepth: 5,
      });

      // Root record
      const root = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'Root' },
      });

      // Create 1001 target records and link them from root
      const batchSize = 100;
      const totalTargets = CROSS_LINK_LIMITS.CIRCUIT_BREAKER_THRESHOLD + 1;

      // Create level 1 record that links to root
      const level1 = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'Level1' },
      });

      await db.insert(crossLinkIndex).values({
        tenantId: tenant.id,
        crossLinkId: crossLink.id,
        sourceRecordId: root.id,
        sourceTableId: table.id,
        targetRecordId: level1.id,
      });

      // Create 1001 records linked from level1 to trigger circuit breaker
      for (let batch = 0; batch < totalTargets; batch += batchSize) {
        const count = Math.min(batchSize, totalTargets - batch);
        const batchRecords = [];
        for (let i = 0; i < count; i++) {
          batchRecords.push(
            await createTestRecord({
              tenantId: tenant.id,
              tableId: table.id,
              canonicalData: { [displayField.id]: `Target-${batch + i}` },
            }),
          );
        }

        // Insert index entries in batch
        const indexEntries = batchRecords.map((r) => ({
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: level1.id,
          sourceTableId: table.id,
          targetRecordId: r.id,
        }));
        await db.insert(crossLinkIndex).values(indexEntries);
      }

      const result = await resolveLinkedRecordsL2(
        tenant.id,
        root.id,
        crossLink.id,
      );

      expect(result.truncated).toBe(true);
      expect(result.truncationReason).toBe('circuit_breaker');
      // Should have root + level1, but not level2 (circuit breaker)
      expect(result.levels.length).toBeGreaterThanOrEqual(1);
    }, 120_000);

    it('cycle detection: A→B→C→A cycle, no infinite loop, each record once', async () => {
      const db = getTestDb();
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({
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
        isPrimary: true,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table.id,
        sourceFieldId: field.id,
        targetTableId: table.id,
        targetDisplayFieldId: displayField.id,
        maxDepth: 5,
      });

      // Create A, B, C
      const recordA = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'A' },
      });
      const recordB = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'B' },
      });
      const recordC = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'C' },
      });

      // A→B, B→C, C→A (cycle)
      await db.insert(crossLinkIndex).values([
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: recordA.id,
          sourceTableId: table.id,
          targetRecordId: recordB.id,
        },
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: recordB.id,
          sourceTableId: table.id,
          targetRecordId: recordC.id,
        },
        {
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: recordC.id,
          sourceTableId: table.id,
          targetRecordId: recordA.id,
        },
      ]);

      const result = await resolveLinkedRecordsL2(
        tenant.id,
        recordA.id,
        crossLink.id,
      );

      // Should complete without hanging, each record appears once
      const allRecordIds = result.levels.flatMap((l) =>
        l.records.map((r) => r.id),
      );
      const uniqueIds = new Set(allRecordIds);

      // All 3 records appear exactly once (no duplication from cycle)
      expect(uniqueIds.size).toBe(allRecordIds.length);
      expect(uniqueIds).toContain(recordA.id);
      expect(uniqueIds).toContain(recordB.id);
      expect(uniqueIds).toContain(recordC.id);
      expect(result.truncated).toBe(false);
    }, 30_000);

    it('performance: L1 with 20 links <50ms', async () => {
      const fixture = await createTestCrossLinkWithIndex({
        sourceRecordCount: 1,
        targetRecordCount: 20,
      });

      const start = performance.now();
      await resolveLinkedRecordsL1(
        fixture.crossLink.tenantId,
        fixture.sourceRecords[0]!.id,
        fixture.crossLink.id,
      );
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(50);
    }, 30_000);

    it('performance: L2 two-level 20→100 <200ms', async () => {
      const db = getTestDb();
      const tenant = await createTestTenant();
      const table = await createTestTable({ tenantId: tenant.id });
      const field = await createTestField({
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
        isPrimary: true,
      });

      const crossLink = await createTestCrossLink({
        tenantId: tenant.id,
        sourceTableId: table.id,
        sourceFieldId: field.id,
        targetTableId: table.id,
        targetDisplayFieldId: displayField.id,
        maxDepth: 3,
      });

      // Root → 20 records → 100 records (5 per level-1 record)
      const root = await createTestRecord({
        tenantId: tenant.id,
        tableId: table.id,
        canonicalData: { [displayField.id]: 'Root' },
      });

      // Level 1: 20 records linked from root
      const level1Records = [];
      for (let i = 0; i < 20; i++) {
        const rec = await createTestRecord({
          tenantId: tenant.id,
          tableId: table.id,
          canonicalData: { [displayField.id]: `L1-${i}` },
        });
        level1Records.push(rec);
      }

      // Insert index entries for root → level1
      await db.insert(crossLinkIndex).values(
        level1Records.map((r) => ({
          tenantId: tenant.id,
          crossLinkId: crossLink.id,
          sourceRecordId: root.id,
          sourceTableId: table.id,
          targetRecordId: r.id,
        })),
      );

      // Level 2: 5 records per level-1 record = 100 total
      const level2Entries = [];
      for (const l1Rec of level1Records) {
        for (let j = 0; j < 5; j++) {
          const rec = await createTestRecord({
            tenantId: tenant.id,
            tableId: table.id,
            canonicalData: { [displayField.id]: `L2-${j}` },
          });
          level2Entries.push({
            tenantId: tenant.id,
            crossLinkId: crossLink.id,
            sourceRecordId: l1Rec.id,
            sourceTableId: table.id,
            targetRecordId: rec.id,
          });
        }
      }
      await db.insert(crossLinkIndex).values(level2Entries);

      // Measure
      const start = performance.now();
      const result = await resolveLinkedRecordsL2(
        tenant.id,
        root.id,
        crossLink.id,
      );
      const elapsed = performance.now() - start;

      expect(result.levels).toHaveLength(3);
      expect(result.levels[0]!.records).toHaveLength(1); // root
      expect(result.levels[1]!.records).toHaveLength(20); // level 1
      expect(result.levels[2]!.records).toHaveLength(100); // level 2
      expect(elapsed).toBeLessThan(200);
    }, 60_000);

    // -----------------------------------------------------------------------
    // Tenant isolation
    // -----------------------------------------------------------------------

    it('enforces tenant isolation', async () => {
      let crossLinkId: string;
      let rootRecordId: string;

      await testTenantIsolation({
        setup: async (tenantId) => {
          const db = getTestDb();
          const table = await createTestTable({ tenantId });
          const field = await createTestField({
            tenantId,
            tableId: table.id,
            name: 'Link',
            fieldType: 'cross_link',
          });
          const displayField = await createTestField({
            tenantId,
            tableId: table.id,
            name: 'Name',
            fieldType: 'text',
            isPrimary: true,
          });
          const crossLink = await createTestCrossLink({
            tenantId,
            sourceTableId: table.id,
            sourceFieldId: field.id,
            targetTableId: table.id,
            targetDisplayFieldId: displayField.id,
          });
          crossLinkId = crossLink.id;

          const root = await createTestRecord({
            tenantId,
            tableId: table.id,
            canonicalData: { [displayField.id]: 'Root' },
          });
          rootRecordId = root.id;

          const child = await createTestRecord({
            tenantId,
            tableId: table.id,
            canonicalData: { [displayField.id]: 'Child' },
          });

          await db.insert(crossLinkIndex).values({
            tenantId,
            crossLinkId: crossLink.id,
            sourceRecordId: root.id,
            sourceTableId: table.id,
            targetRecordId: child.id,
          });
        },
        query: async (tenantId) => {
          const result = await resolveLinkedRecordsL2(
            tenantId,
            rootRecordId,
            crossLinkId,
          );
          return result.levels.flatMap((l) => l.records);
        },
      });
    }, 30_000);
  });
});
