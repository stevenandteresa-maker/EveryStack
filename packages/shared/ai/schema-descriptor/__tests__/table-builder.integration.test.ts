import { describe, it, expect } from 'vitest';
import { eq, and } from 'drizzle-orm';
import { buildTableDescriptor } from '../table-builder';
import {
  getTestDb,
  createTestTable,
  createTestField,
  createTestCrossLink,
} from '../../../testing';
import { testTenantIsolation } from '../../../testing/tenant-isolation';
import { tables as tablesSchema } from '../../../db/schema/tables';

describe('buildTableDescriptor', () => {
  const db = getTestDb();

  // ------------------------------------------------------------------
  // Core assembly — multiple field types
  // ------------------------------------------------------------------
  it('assembles a table descriptor with multiple field types', async () => {
    const table = await createTestTable({ name: 'Deals' });
    const tenantId = table.tenantId;

    // Create fields in specific sort order
    const textField = await createTestField({
      tenantId,
      tableId: table.id,
      name: 'Deal Name',
      fieldType: 'text',
      sortOrder: 0,
    });

    const numberField = await createTestField({
      tenantId,
      tableId: table.id,
      name: 'Value',
      fieldType: 'number',
      sortOrder: 1,
    });

    const selectField = await createTestField({
      tenantId,
      tableId: table.id,
      name: 'Stage',
      fieldType: 'single_select',
      sortOrder: 2,
      config: {
        options: [
          { id: 'opt1', label: 'Prospect' },
          { id: 'opt2', label: 'Closed Won' },
        ],
      },
    });

    const result = await buildTableDescriptor(table.id, tenantId, db);

    expect(result.table_id).toBe(table.id);
    expect(result.name).toBe('Deals');
    expect(result.record_count_approx).toBeGreaterThanOrEqual(0);
    expect(result.fields).toHaveLength(3);

    // Verify sort order is respected
    const field0 = result.fields[0]!;
    const field1 = result.fields[1]!;
    const field2 = result.fields[2]!;

    expect(field0.field_id).toBe(textField.id);
    expect(field0.type).toBe('text');
    expect(field0.searchable).toBe(true);

    expect(field1.field_id).toBe(numberField.id);
    expect(field1.type).toBe('number');
    expect(field1.aggregatable).toBe(true);

    expect(field2.field_id).toBe(selectField.id);
    expect(field2.type).toBe('single_select');
    expect(field2.options).toEqual(['Prospect', 'Closed Won']);
  }, 30_000);

  // ------------------------------------------------------------------
  // Row count — uses pg_stat_user_tables, not COUNT(*)
  // ------------------------------------------------------------------
  it('uses pg_stat_user_tables for approximate row count', async () => {
    const table = await createTestTable({ name: 'Stats Test' });

    const result = await buildTableDescriptor(table.id, table.tenantId, db);

    // The key assertion: record_count_approx is a number (from pg_stat),
    // not undefined or null. For freshly created tables it may be 0.
    expect(typeof result.record_count_approx).toBe('number');
    expect(result.record_count_approx).toBeGreaterThanOrEqual(0);
  }, 30_000);

  // ------------------------------------------------------------------
  // Linked record fields with cross-link metadata
  // ------------------------------------------------------------------
  it('includes cross-link metadata for linked_record fields', async () => {
    // Create source table
    const sourceTable = await createTestTable({ name: 'Deals' });
    const tenantId = sourceTable.tenantId;

    // Create a linked_record field on the source table
    const linkField = await createTestField({
      tenantId,
      tableId: sourceTable.id,
      name: 'Primary Contact',
      fieldType: 'linked_record',
      sortOrder: 0,
    });

    // Create target table + display field
    const targetTable = await createTestTable({ tenantId, name: 'Contacts' });
    const targetDisplayField = await createTestField({
      tenantId,
      tableId: targetTable.id,
      name: 'Name',
      fieldType: 'text',
      isPrimary: true,
    });

    // Create reverse field on target table
    const reverseField = await createTestField({
      tenantId,
      tableId: targetTable.id,
      name: 'Deals',
      fieldType: 'linked_record',
      sortOrder: 1,
    });

    // Create cross-link definition
    await createTestCrossLink({
      tenantId,
      sourceTableId: sourceTable.id,
      sourceFieldId: linkField.id,
      targetTableId: targetTable.id,
      targetDisplayFieldId: targetDisplayField.id,
      relationshipType: 'many_to_one',
      reverseFieldId: reverseField.id,
    });

    const result = await buildTableDescriptor(sourceTable.id, tenantId, db);

    expect(result.fields).toHaveLength(1);
    const linkedField = result.fields[0]!;
    expect(linkedField.type).toBe('linked_record');
    expect(linkedField.linked_table).toBe(targetTable.id);
    expect(linkedField.cardinality).toBe('many_to_one');
    expect(linkedField.symmetric_field).toBe(reverseField.id);
  }, 30_000);

  // ------------------------------------------------------------------
  // Linked record without cross-link row — graceful handling
  // ------------------------------------------------------------------
  it('handles linked_record field without cross-link definition', async () => {
    const table = await createTestTable({ name: 'Orphan Links' });
    const tenantId = table.tenantId;

    await createTestField({
      tenantId,
      tableId: table.id,
      name: 'Broken Link',
      fieldType: 'linked_record',
      sortOrder: 0,
    });

    const result = await buildTableDescriptor(table.id, tenantId, db);

    expect(result.fields).toHaveLength(1);
    const orphanField = result.fields[0]!;
    expect(orphanField.type).toBe('linked_record');
    expect(orphanField.linked_table).toBeUndefined();
    expect(orphanField.cardinality).toBeUndefined();
  }, 30_000);

  // ------------------------------------------------------------------
  // Table not found
  // ------------------------------------------------------------------
  it('throws when table does not exist for the given tenant', async () => {
    const fakeTableId = '00000000-0000-0000-0000-000000000000';
    const fakeTenantId = '00000000-0000-0000-0000-000000000001';

    await expect(
      buildTableDescriptor(fakeTableId, fakeTenantId, db),
    ).rejects.toThrow(/not found/);
  }, 30_000);

  // ------------------------------------------------------------------
  // Fields are returned in sort_order
  // ------------------------------------------------------------------
  it('returns fields ordered by sort_order', async () => {
    const table = await createTestTable({ name: 'Sort Order' });
    const tenantId = table.tenantId;

    // Insert in reverse order to prove sort_order wins, not insertion order
    await createTestField({
      tenantId,
      tableId: table.id,
      name: 'Third',
      fieldType: 'text',
      sortOrder: 20,
    });
    await createTestField({
      tenantId,
      tableId: table.id,
      name: 'First',
      fieldType: 'text',
      sortOrder: 0,
    });
    await createTestField({
      tenantId,
      tableId: table.id,
      name: 'Second',
      fieldType: 'number',
      sortOrder: 10,
    });

    const result = await buildTableDescriptor(table.id, tenantId, db);

    expect(result.fields.map((f) => f.name)).toEqual(['First', 'Second', 'Third']);
  }, 30_000);

  // ------------------------------------------------------------------
  // Tenant isolation
  // ------------------------------------------------------------------
  it('enforces tenant isolation', async () => {
    await testTenantIsolation({
      setup: async (tenantId) => {
        const table = await createTestTable({ tenantId, name: 'Isolated Table' });
        await createTestField({
          tenantId,
          tableId: table.id,
          name: 'Name',
          fieldType: 'text',
        });
      },
      query: async (tenantId) => {
        const tenantTables = await db
          .select()
          .from(tablesSchema)
          .where(and(eq(tablesSchema.tenantId, tenantId), eq(tablesSchema.name, 'Isolated Table')));

        if (tenantTables.length === 0) return [];

        const firstTable = tenantTables[0]!;
        const result = await buildTableDescriptor(firstTable.id, tenantId, db);
        return [result];
      },
    });
  }, 30_000);
});
