import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkspaceDescriptor, FieldDescriptor } from '../types';
import { filterDescriptorByPermissions } from '../permission-filter';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock resolveEffectiveRole
vi.mock('../../../auth/check-role', () => ({
  resolveEffectiveRole: vi.fn(),
}));

// Mock resolveAllFieldPermissions
vi.mock('../../../auth/permissions/resolve', () => ({
  resolveAllFieldPermissions: vi.fn(),
}));

// Mock roleAtLeast
vi.mock('../../../auth/roles', () => ({
  roleAtLeast: vi.fn((role: string, required: string) => {
    const hierarchy: Record<string, number> = {
      owner: 50,
      admin: 40,
      manager: 30,
      team_member: 20,
      viewer: 10,
    };
    return (hierarchy[role] ?? 0) >= (hierarchy[required] ?? 0);
  }),
}));

// Mock viewPermissionsSchema
vi.mock('../../../auth/permissions/schemas', () => ({
  viewPermissionsSchema: {
    parse: vi.fn((input: unknown) => ({
      roles: [],
      specificUsers: [],
      excludedUsers: [],
      fieldPermissions: {
        roleRestrictions: [],
        individualOverrides: [],
      },
      ...(input as Record<string, unknown>),
    })),
  },
}));

import { resolveEffectiveRole } from '../../../auth/check-role';
import { resolveAllFieldPermissions } from '../../../auth/permissions/resolve';
import type { FieldPermissionMap, FieldPermissionState } from '../../../auth/permissions/types';

const mockResolveEffectiveRole = vi.mocked(resolveEffectiveRole);
const mockResolveAllFieldPermissions = vi.mocked(resolveAllFieldPermissions);

// ---------------------------------------------------------------------------
// Test data factories
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const WORKSPACE_ID = 'ws-001';
const USER_ID = 'user-001';

function createField(overrides: Partial<FieldDescriptor> & { field_id: string; name: string }): FieldDescriptor {
  return {
    type: 'text',
    searchable: true,
    aggregatable: false,
    ...overrides,
  };
}

function createDescriptor(overrides?: Partial<WorkspaceDescriptor>): WorkspaceDescriptor {
  return {
    workspace_id: WORKSPACE_ID,
    bases: [
      {
        base_id: 'base-001',
        name: 'Sales Base',
        platform: 'airtable',
        tables: [
          {
            table_id: 'tbl-001',
            name: 'Deals',
            record_count_approx: 500,
            fields: [
              createField({ field_id: 'fld-001', name: 'Deal Name' }),
              createField({ field_id: 'fld-002', name: 'Amount', type: 'number', aggregatable: true }),
              createField({ field_id: 'fld-003', name: 'Internal Notes' }),
            ],
          },
          {
            table_id: 'tbl-002',
            name: 'Contacts',
            record_count_approx: 200,
            fields: [
              createField({ field_id: 'fld-004', name: 'Contact Name' }),
              createField({ field_id: 'fld-005', name: 'Email' }),
            ],
          },
        ],
      },
      {
        base_id: 'base-002',
        name: 'HR Base',
        platform: 'notion',
        tables: [
          {
            table_id: 'tbl-003',
            name: 'Employees',
            record_count_approx: 50,
            fields: [
              createField({ field_id: 'fld-006', name: 'Employee Name' }),
              createField({ field_id: 'fld-007', name: 'Salary', type: 'number', aggregatable: true }),
            ],
          },
        ],
      },
    ],
    link_graph: [
      {
        from: 'base-001.tbl-001.fld-010',
        to: 'base-001.tbl-002.fld-011',
        cardinality: 'many_to_one',
        label: 'Deals → Contacts via Primary Contact',
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock DrizzleClient that returns configured view/field results.
 */
function createMockDb(options: {
  views?: Array<{
    id: string;
    tableId: string;
    config: Record<string, unknown>;
    permissions: Record<string, unknown>;
  }>;
  fields?: Array<{
    id: string;
    tableId: string;
    permissions: Record<string, unknown>;
  }>;
}) {
  const viewRows = options.views ?? [];
  const fieldRows = options.fields ?? [];

  let callCount = 0;

  // Each db.select().from().where() chain returns the appropriate results.
  // Call order: 1st = views query, 2nd = fields query
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve(viewRows);
          if (callCount === 2) return Promise.resolve(fieldRows);
          return Promise.resolve([]);
        }),
      })),
    })),
  };

  return mockDb as unknown as Parameters<typeof filterDescriptorByPermissions>[3];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createPermMap(entries: Array<[string, FieldPermissionState]>): FieldPermissionMap {
  return new Map(entries);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('filterDescriptorByPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Owner/Admin bypass
  // -----------------------------------------------------------------------

  it('returns full descriptor for Owner (no filtering)', async () => {
    mockResolveEffectiveRole.mockResolvedValue('owner');
    const descriptor = createDescriptor();
    const db = createMockDb({});

    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.bases).toHaveLength(2);
    expect(result.bases[0]!.tables).toHaveLength(2);
    expect(result.bases[1]!.tables).toHaveLength(1);
    expect(result.link_graph).toHaveLength(1);
  });

  it('returns full descriptor for Admin (no filtering)', async () => {
    mockResolveEffectiveRole.mockResolvedValue('admin');
    const descriptor = createDescriptor();
    const db = createMockDb({});

    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.bases).toHaveLength(2);
    expect(result.bases[0]!.tables).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // No membership → empty
  // -----------------------------------------------------------------------

  it('returns empty descriptor when user has no membership', async () => {
    mockResolveEffectiveRole.mockResolvedValue(null);
    const descriptor = createDescriptor();
    const db = createMockDb({});

    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.workspace_id).toBe(WORKSPACE_ID);
    expect(result.bases).toHaveLength(0);
    expect(result.link_graph).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Team Member with partial access
  // -----------------------------------------------------------------------

  it('filters to accessible tables and visible fields for Team Member', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    // Only one view on tbl-001, none on tbl-002 or tbl-003
    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-002', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-003', tableId: 'tbl-001', permissions: {} },
      ],
    });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([
        ['fld-001', 'read_write'],
        ['fld-002', 'read_only'],
        ['fld-003', 'hidden'],
      ]),
    );

    const descriptor = createDescriptor();
    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    // Only tbl-001 accessible (base-001 kept, base-002 removed)
    expect(result.bases).toHaveLength(1);
    expect(result.bases[0]!.base_id).toBe('base-001');
    expect(result.bases[0]!.tables).toHaveLength(1);
    expect(result.bases[0]!.tables[0]!.table_id).toBe('tbl-001');

    // Hidden field (fld-003) removed
    const fieldIds = result.bases[0]!.tables[0]!.fields.map((f) => f.field_id);
    expect(fieldIds).toContain('fld-001');
    expect(fieldIds).toContain('fld-002');
    expect(fieldIds).not.toContain('fld-003');
  });

  // -----------------------------------------------------------------------
  // Hidden fields security test
  // -----------------------------------------------------------------------

  it('never includes hidden fields in filtered output', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-002', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-003', tableId: 'tbl-001', permissions: {} },
      ],
    });

    // All fields hidden
    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([
        ['fld-001', 'hidden'],
        ['fld-002', 'hidden'],
        ['fld-003', 'hidden'],
      ]),
    );

    const descriptor = createDescriptor();
    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    // All fields hidden → table removed → base removed
    for (const base of result.bases) {
      for (const table of base.tables) {
        for (const field of table.fields) {
          expect(field).toBeDefined(); // No hidden fields should survive
        }
      }
    }

    // With all fields hidden, tbl-001 still has 0 visible fields but is kept
    // (table stays if it has a view grant — just with empty fields)
    // Actually, the table stays but has zero fields. Let's verify no hidden field leaks.
    const allFields = result.bases.flatMap((b) =>
      b.tables.flatMap((t) => t.fields.map((f) => f.field_id)),
    );
    expect(allFields).not.toContain('fld-001');
    expect(allFields).not.toContain('fld-002');
    expect(allFields).not.toContain('fld-003');
  });

  // -----------------------------------------------------------------------
  // Link graph pruning
  // -----------------------------------------------------------------------

  it('prunes link_graph when one side is restricted', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const descriptor = createDescriptor({
      link_graph: [
        {
          from: 'base-001.tbl-001.fld-010',
          to: 'base-001.tbl-002.fld-011',
          cardinality: 'many_to_one',
          label: 'Deals → Contacts',
        },
      ],
    });

    // Only tbl-001 accessible, not tbl-002
    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-010', tableId: 'tbl-001', permissions: {} },
      ],
    });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([
        ['fld-001', 'read_write'],
        ['fld-010', 'read_write'],
      ]),
    );

    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    // fld-011 was in tbl-002 which is inaccessible → edge pruned
    expect(result.link_graph).toHaveLength(0);
  });

  it('keeps link_graph edges where both sides are accessible', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const descriptor = createDescriptor({
      link_graph: [
        {
          from: 'base-001.tbl-001.fld-001',
          to: 'base-001.tbl-002.fld-004',
          cardinality: 'many_to_one',
          label: 'Deals → Contacts',
        },
      ],
    });

    // Both tables accessible
    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
        {
          id: 'view-002',
          tableId: 'tbl-002',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-002', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-003', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-004', tableId: 'tbl-002', permissions: {} },
        { id: 'fld-005', tableId: 'tbl-002', permissions: {} },
      ],
    });

    // First call for view-001 (tbl-001), second for view-002 (tbl-002)
    mockResolveAllFieldPermissions
      .mockReturnValueOnce(
        createPermMap([
          ['fld-001', 'read_write'],
          ['fld-002', 'read_write'],
          ['fld-003', 'read_write'],
        ]),
      )
      .mockReturnValueOnce(
        createPermMap([
          ['fld-004', 'read_write'],
          ['fld-005', 'read_write'],
        ]),
      );

    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.link_graph).toHaveLength(1);
    expect(result.link_graph[0]!.from).toBe('base-001.tbl-001.fld-001');
  });

  // -----------------------------------------------------------------------
  // Cross-link edge case: visible linked_record but restricted target
  // -----------------------------------------------------------------------

  it('sets linked_table to null and cardinality to restricted when target table inaccessible', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const descriptor: WorkspaceDescriptor = {
      workspace_id: WORKSPACE_ID,
      bases: [
        {
          base_id: 'base-001',
          name: 'Sales Base',
          platform: 'airtable',
          tables: [
            {
              table_id: 'tbl-001',
              name: 'Deals',
              record_count_approx: 500,
              fields: [
                createField({ field_id: 'fld-001', name: 'Deal Name' }),
                createField({
                  field_id: 'fld-link',
                  name: 'Primary Contact',
                  type: 'linked_record',
                  linked_base: 'base-001',
                  linked_table: 'tbl-002',
                  cardinality: 'many_to_one',
                }),
              ],
            },
            {
              table_id: 'tbl-002',
              name: 'Contacts',
              record_count_approx: 200,
              fields: [
                createField({ field_id: 'fld-004', name: 'Contact Name' }),
              ],
            },
          ],
        },
      ],
      link_graph: [],
    };

    // Only tbl-001 accessible, NOT tbl-002
    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-link', tableId: 'tbl-001', permissions: {} },
      ],
    });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([
        ['fld-001', 'read_write'],
        ['fld-link', 'read_write'],
      ]),
    );

    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    const linkField = result.bases[0]!.tables[0]!.fields.find((f) => f.field_id === 'fld-link');
    expect(linkField).toBeDefined();
    expect(linkField!.linked_table).toBeNull();
    expect(linkField!.cardinality).toBe('restricted');
  });

  // -----------------------------------------------------------------------
  // Deep-copy verification
  // -----------------------------------------------------------------------

  it('does not mutate the original descriptor', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const descriptor = createDescriptor();
    const originalJson = JSON.stringify(descriptor);

    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-002', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-003', tableId: 'tbl-001', permissions: {} },
      ],
    });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([
        ['fld-001', 'read_write'],
        ['fld-002', 'hidden'],
        ['fld-003', 'hidden'],
      ]),
    );

    await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    // Original must be unchanged
    expect(JSON.stringify(descriptor)).toBe(originalJson);
    // Verify original still has all bases and tables
    expect(descriptor.bases).toHaveLength(2);
    expect(descriptor.bases[0]!.tables).toHaveLength(2);
    expect(descriptor.bases[0]!.tables[0]!.fields).toHaveLength(3);
  });

  // -----------------------------------------------------------------------
  // Tenant isolation
  // -----------------------------------------------------------------------

  it('passes correct tenantId to resolveEffectiveRole and DB queries', async () => {
    const otherTenantId = 'tenant-other';
    mockResolveEffectiveRole.mockResolvedValue('owner');
    const descriptor = createDescriptor();
    const db = createMockDb({});

    await filterDescriptorByPermissions(descriptor, USER_ID, otherTenantId, db);

    expect(mockResolveEffectiveRole).toHaveBeenCalledWith(
      USER_ID,
      otherTenantId,
      WORKSPACE_ID,
    );
  });

  it('scopes permission resolution to the correct tenant', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const tenantA = 'tenant-a';
    const tenantB = 'tenant-b';

    const descriptorA = createDescriptor();
    const descriptorB = createDescriptor();

    // TenantA: user has access
    const dbA = createMockDb({
      views: [
        {
          id: 'view-a',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [{ id: 'fld-001', tableId: 'tbl-001', permissions: {} }],
    });

    // TenantB: user has no view access
    const dbB = createMockDb({ views: [], fields: [] });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([['fld-001', 'read_write']]),
    );

    const resultA = await filterDescriptorByPermissions(descriptorA, USER_ID, tenantA, dbA);
    const resultB = await filterDescriptorByPermissions(descriptorB, USER_ID, tenantB, dbB);

    // Tenant A: has access to tbl-001
    expect(resultA.bases.length).toBeGreaterThan(0);

    // Tenant B: no views → no table access → empty
    expect(resultB.bases).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Empty bases removed
  // -----------------------------------------------------------------------

  it('removes bases with zero accessible tables', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    // No views on any table
    const db = createMockDb({ views: [], fields: [] });

    const descriptor = createDescriptor();
    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.bases).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // Manager access
  // -----------------------------------------------------------------------

  it('grants managers access to shared views', async () => {
    mockResolveEffectiveRole.mockResolvedValue('manager');

    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: [],
            specificUsers: [],
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-002', tableId: 'tbl-001', permissions: {} },
        { id: 'fld-003', tableId: 'tbl-001', permissions: {} },
      ],
    });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([
        ['fld-001', 'read_write'],
        ['fld-002', 'read_write'],
        ['fld-003', 'read_write'],
      ]),
    );

    const descriptor = createDescriptor();
    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.bases).toHaveLength(1);
    expect(result.bases[0]!.tables[0]!.fields).toHaveLength(3);
  });

  // -----------------------------------------------------------------------
  // Specific user grant
  // -----------------------------------------------------------------------

  it('grants access via specificUsers in view permissions', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: [], // No role-based access
            specificUsers: [USER_ID], // But specific user grant
            excludedUsers: [],
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
      ],
    });

    mockResolveAllFieldPermissions.mockReturnValue(
      createPermMap([['fld-001', 'read_write']]),
    );

    const descriptor = createDescriptor();
    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    expect(result.bases).toHaveLength(1);
    expect(result.bases[0]!.tables).toHaveLength(1);
  });

  // -----------------------------------------------------------------------
  // Excluded user
  // -----------------------------------------------------------------------

  it('denies access when user is in excludedUsers', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    const db = createMockDb({
      views: [
        {
          id: 'view-001',
          tableId: 'tbl-001',
          config: {},
          permissions: {
            roles: ['team_member'],
            specificUsers: [],
            excludedUsers: [USER_ID], // Excluded
            fieldPermissions: { roleRestrictions: [], individualOverrides: [] },
          },
        },
      ],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', permissions: {} },
      ],
    });

    const descriptor = createDescriptor();
    const result = await filterDescriptorByPermissions(descriptor, USER_ID, TENANT_ID, db);

    // User excluded → no table access → empty
    expect(result.bases).toHaveLength(0);
  });
});
