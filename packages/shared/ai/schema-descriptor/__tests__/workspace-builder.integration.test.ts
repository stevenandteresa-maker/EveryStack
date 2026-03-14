import { describe, it, expect } from 'vitest';
import { buildWorkspaceDescriptor } from '../workspace-builder';
import {
  getTestDb,
  createTestWorkspace,
  createTestTable,
  createTestField,
  createTestBase,
  createTestCrossLink,
  createTestSyncedFieldMapping,
} from '../../../testing';
import { testTenantIsolation } from '../../../testing/tenant-isolation';

describe('buildWorkspaceDescriptor', () => {
  const db = getTestDb();

  // ------------------------------------------------------------------
  // Full descriptor: 2 base connections with linked tables
  // ------------------------------------------------------------------
  it('assembles a full descriptor with 2 base connections and linked tables', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;
    const createdBy = workspace.createdBy;

    // Base 1: Sales Pipeline (Airtable)
    const base1 = await createTestBase({
      tenantId,
      platform: 'airtable',
      externalBaseName: 'Sales Pipeline',
      createdBy,
    });

    // Base 2: CRM (Notion)
    const base2 = await createTestBase({
      tenantId,
      platform: 'notion',
      externalBaseName: 'CRM',
      createdBy,
    });

    // Tables in base 1
    const dealsTable = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Deals',
      createdBy,
    });

    // Tables in base 2
    const contactsTable = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Contacts',
      createdBy,
    });

    // Fields on Deals
    const dealNameField = await createTestField({
      tenantId,
      tableId: dealsTable.id,
      name: 'Deal Name',
      fieldType: 'text',
      sortOrder: 0,
    });

    const linkField = await createTestField({
      tenantId,
      tableId: dealsTable.id,
      name: 'Primary Contact',
      fieldType: 'linked_record',
      sortOrder: 1,
    });

    // Fields on Contacts
    const contactNameField = await createTestField({
      tenantId,
      tableId: contactsTable.id,
      name: 'Name',
      fieldType: 'text',
      isPrimary: true,
      sortOrder: 0,
    });

    const reverseField = await createTestField({
      tenantId,
      tableId: contactsTable.id,
      name: 'Deals',
      fieldType: 'linked_record',
      sortOrder: 1,
    });

    // Link Deals → Contacts synced field mappings
    await createTestSyncedFieldMapping({
      tenantId,
      baseConnectionId: base1.id,
      tableId: dealsTable.id,
      fieldId: dealNameField.id,
    });

    await createTestSyncedFieldMapping({
      tenantId,
      baseConnectionId: base2.id,
      tableId: contactsTable.id,
      fieldId: contactNameField.id,
    });

    // Cross-link definition
    await createTestCrossLink({
      tenantId,
      sourceTableId: dealsTable.id,
      sourceFieldId: linkField.id,
      targetTableId: contactsTable.id,
      targetDisplayFieldId: contactNameField.id,
      relationshipType: 'many_to_one',
      reverseFieldId: reverseField.id,
      createdBy,
    });

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    expect(result.workspace_id).toBe(workspace.id);
    expect(result.bases).toHaveLength(2);

    // Verify base 1
    const salesBase = result.bases.find((b) => b.base_id === base1.id);
    expect(salesBase).toBeDefined();
    expect(salesBase!.name).toBe('Sales Pipeline');
    expect(salesBase!.platform).toBe('airtable');
    expect(salesBase!.tables).toHaveLength(1);
    expect(salesBase!.tables[0]!.name).toBe('Deals');

    // Verify base 2
    const crmBase = result.bases.find((b) => b.base_id === base2.id);
    expect(crmBase).toBeDefined();
    expect(crmBase!.name).toBe('CRM');
    expect(crmBase!.platform).toBe('notion');
    expect(crmBase!.tables).toHaveLength(1);
    expect(crmBase!.tables[0]!.name).toBe('Contacts');

    // Verify link_graph has exactly 1 edge (deduplicated)
    expect(result.link_graph).toHaveLength(1);
    const edge = result.link_graph[0]!;
    expect(edge.cardinality).toBe('many_to_one');
    expect(edge.from).toContain(dealsTable.id);
    expect(edge.to).toContain(contactsTable.id);
  }, 30_000);

  // ------------------------------------------------------------------
  // Link graph deduplication: symmetric cross-link = 1 edge
  // ------------------------------------------------------------------
  it('deduplicates symmetric cross-links to exactly 1 edge', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;
    const createdBy = workspace.createdBy;

    const tableA = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Table A',
      createdBy,
    });
    const tableB = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Table B',
      createdBy,
    });

    const fieldA = await createTestField({
      tenantId,
      tableId: tableA.id,
      name: 'Link to B',
      fieldType: 'linked_record',
    });

    const displayFieldB = await createTestField({
      tenantId,
      tableId: tableB.id,
      name: 'Name',
      fieldType: 'text',
      isPrimary: true,
    });

    const fieldB = await createTestField({
      tenantId,
      tableId: tableB.id,
      name: 'Link to A',
      fieldType: 'linked_record',
    });

    const displayFieldA = await createTestField({
      tenantId,
      tableId: tableA.id,
      name: 'Name',
      fieldType: 'text',
      isPrimary: true,
    });

    // Forward link: A → B
    await createTestCrossLink({
      tenantId,
      sourceTableId: tableA.id,
      sourceFieldId: fieldA.id,
      targetTableId: tableB.id,
      targetDisplayFieldId: displayFieldB.id,
      relationshipType: 'many_to_one',
      reverseFieldId: fieldB.id,
      createdBy,
    });

    // Reverse link: B → A
    await createTestCrossLink({
      tenantId,
      sourceTableId: tableB.id,
      sourceFieldId: fieldB.id,
      targetTableId: tableA.id,
      targetDisplayFieldId: displayFieldA.id,
      relationshipType: 'one_to_many',
      reverseFieldId: fieldA.id,
      createdBy,
    });

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    // Both directions exist in DB but only 1 should appear in link_graph
    expect(result.link_graph).toHaveLength(1);
  }, 30_000);

  // ------------------------------------------------------------------
  // Link graph labels are human-readable
  // ------------------------------------------------------------------
  it('generates human-readable link graph labels', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;
    const createdBy = workspace.createdBy;

    const ordersTable = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Orders',
      createdBy,
    });

    const customersTable = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Customers',
      createdBy,
    });

    const linkField = await createTestField({
      tenantId,
      tableId: ordersTable.id,
      name: 'Customer',
      fieldType: 'linked_record',
    });

    const displayField = await createTestField({
      tenantId,
      tableId: customersTable.id,
      name: 'Name',
      fieldType: 'text',
      isPrimary: true,
    });

    await createTestCrossLink({
      tenantId,
      sourceTableId: ordersTable.id,
      sourceFieldId: linkField.id,
      targetTableId: customersTable.id,
      targetDisplayFieldId: displayField.id,
      relationshipType: 'many_to_one',
      createdBy,
    });

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    expect(result.link_graph).toHaveLength(1);
    expect(result.link_graph[0]!.label).toBe('Orders \u2192 Customers via Customer');
  }, 30_000);

  // ------------------------------------------------------------------
  // Native tables under synthetic "Native" base grouping
  // ------------------------------------------------------------------
  it('places native tables under synthetic "Native" base grouping', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;
    const createdBy = workspace.createdBy;

    // Create a table with NO synced_field_mappings (native)
    await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'My Native Table',
      createdBy,
    });

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    expect(result.bases).toHaveLength(1);

    const nativeBase = result.bases[0]!;
    expect(nativeBase.base_id).toBe('native');
    expect(nativeBase.name).toBe('Native Tables');
    expect(nativeBase.platform).toBe('everystack');
    expect(nativeBase.tables).toHaveLength(1);
    expect(nativeBase.tables[0]!.name).toBe('My Native Table');
  }, 30_000);

  // ------------------------------------------------------------------
  // Mixed: synced + native tables
  // ------------------------------------------------------------------
  it('handles mix of synced and native tables', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;
    const createdBy = workspace.createdBy;

    const base = await createTestBase({
      tenantId,
      platform: 'airtable',
      externalBaseName: 'External Base',
      createdBy,
    });

    // Synced table
    const syncedTable = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Synced Table',
      createdBy,
    });

    const syncedField = await createTestField({
      tenantId,
      tableId: syncedTable.id,
      name: 'Field',
      fieldType: 'text',
    });

    await createTestSyncedFieldMapping({
      tenantId,
      baseConnectionId: base.id,
      tableId: syncedTable.id,
      fieldId: syncedField.id,
    });

    // Native table (no mapping)
    await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Native Table',
      createdBy,
    });

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    expect(result.bases).toHaveLength(2);

    const externalBase = result.bases.find((b) => b.base_id === base.id);
    expect(externalBase).toBeDefined();
    expect(externalBase!.tables).toHaveLength(1);
    expect(externalBase!.tables[0]!.name).toBe('Synced Table');

    const nativeBase = result.bases.find((b) => b.base_id === 'native');
    expect(nativeBase).toBeDefined();
    expect(nativeBase!.tables).toHaveLength(1);
    expect(nativeBase!.tables[0]!.name).toBe('Native Table');
  }, 30_000);

  // ------------------------------------------------------------------
  // Empty workspace returns empty descriptor
  // ------------------------------------------------------------------
  it('returns empty descriptor for workspace with no tables', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    expect(result.workspace_id).toBe(workspace.id);
    expect(result.bases).toHaveLength(0);
    expect(result.link_graph).toHaveLength(0);
  }, 30_000);

  // ------------------------------------------------------------------
  // Link graph uses dotted path format
  // ------------------------------------------------------------------
  it('uses dotted path format for link_graph from/to', async () => {
    const workspace = await createTestWorkspace();
    const tenantId = workspace.tenantId;
    const createdBy = workspace.createdBy;

    const base = await createTestBase({
      tenantId,
      platform: 'airtable',
      externalBaseName: 'Test Base',
      createdBy,
    });

    const tableA = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Source',
      createdBy,
    });

    const tableB = await createTestTable({
      tenantId,
      workspaceId: workspace.id,
      name: 'Target',
      createdBy,
    });

    const linkField = await createTestField({
      tenantId,
      tableId: tableA.id,
      name: 'Link',
      fieldType: 'linked_record',
    });

    const displayField = await createTestField({
      tenantId,
      tableId: tableB.id,
      name: 'Name',
      fieldType: 'text',
      isPrimary: true,
    });

    // Map both to the same base
    const fieldA = await createTestField({
      tenantId,
      tableId: tableA.id,
      name: 'F1',
      fieldType: 'text',
    });
    const fieldB = await createTestField({
      tenantId,
      tableId: tableB.id,
      name: 'F2',
      fieldType: 'text',
    });

    await createTestSyncedFieldMapping({
      tenantId,
      baseConnectionId: base.id,
      tableId: tableA.id,
      fieldId: fieldA.id,
    });
    await createTestSyncedFieldMapping({
      tenantId,
      baseConnectionId: base.id,
      tableId: tableB.id,
      fieldId: fieldB.id,
    });

    await createTestCrossLink({
      tenantId,
      sourceTableId: tableA.id,
      sourceFieldId: linkField.id,
      targetTableId: tableB.id,
      targetDisplayFieldId: displayField.id,
      relationshipType: 'many_to_one',
      createdBy,
    });

    const result = await buildWorkspaceDescriptor(workspace.id, tenantId, db);

    expect(result.link_graph).toHaveLength(1);
    const edge = result.link_graph[0]!;

    // Dotted path: {base_id}.{table_id}.{field_id}
    expect(edge.from).toBe(`${base.id}.${tableA.id}.${linkField.id}`);
    expect(edge.to).toBe(`${base.id}.${tableB.id}.${displayField.id}`);
  }, 30_000);

  // ------------------------------------------------------------------
  // Tenant isolation
  // ------------------------------------------------------------------
  it('enforces tenant isolation', async () => {
    // Store workspace ID from setup so query can reference it
    let workspaceId = '';

    await testTenantIsolation({
      setup: async (tenantId) => {
        const workspace = await createTestWorkspace({ tenantId });
        workspaceId = workspace.id;
        await createTestTable({
          tenantId,
          workspaceId: workspace.id,
          name: 'Isolated Table',
        });
      },
      query: async (tenantId) => {
        // Query the same workspace ID but with a different tenant —
        // should return empty bases because tables are tenant-scoped
        const result = await buildWorkspaceDescriptor(workspaceId, tenantId, db);
        return result.bases;
      },
    });
  }, 30_000);
});
