import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockInnerJoin = vi.fn();
const mockWhere = vi.fn();

const chainedQuery = {
  select: mockSelect,
  from: mockFrom,
  innerJoin: mockInnerJoin,
  where: mockWhere,
};

mockSelect.mockReturnValue(chainedQuery);
mockFrom.mockReturnValue(chainedQuery);
mockInnerJoin.mockReturnValue(chainedQuery);
// where() returns the final result array by default
mockWhere.mockResolvedValue([]);

const mockResolveEffectiveRole = vi.fn();

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: vi.fn(() => chainedQuery),
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  isNull: vi.fn((col: unknown) => ({ type: 'isNull', col })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings: [...strings],
      values,
    }),
    {
      join: vi.fn((items: unknown[], sep: unknown) => ({ type: 'sql.join', items, sep })),
    },
  ),
  records: {
    id: 'records.id',
    tenantId: 'records.tenant_id',
    tableId: 'records.table_id',
    canonicalData: 'records.canonical_data',
    searchVector: 'records.search_vector',
    archivedAt: 'records.archived_at',
  },
  fields: {
    id: 'fields.id',
    tableId: 'fields.table_id',
    isPrimary: 'fields.is_primary',
  },
  tables: {
    id: 'tables.id',
    name: 'tables.name',
    workspaceId: 'tables.workspace_id',
  },
  views: {
    id: 'views.id',
    name: 'views.name',
    tenantId: 'views.tenant_id',
    tableId: 'views.table_id',
    isShared: 'views.is_shared',
    permissions: 'views.permissions',
  },
}));

vi.mock('@everystack/shared/auth', () => ({
  resolveEffectiveRole: (...args: unknown[]) => mockResolveEffectiveRole(...args),
  roleAtLeast: vi.fn((userRole: string, requiredRole: string) => {
    const hierarchy: Record<string, number> = {
      owner: 50,
      admin: 40,
      manager: 30,
      team_member: 20,
      viewer: 10,
    };
    return (hierarchy[userRole] ?? 0) >= (hierarchy[requiredRole] ?? 0);
  }),
}));

import { searchTablesAndViews } from '../command-bar-search';
import {
  getCommandRegistry,
  filterCommandsByRoleAndScope,
  SYSTEM_COMMANDS,
} from '../command-registry';
import {
  createTestCommandRegistryEntry,
  resetCommandRegistryCounter,
} from '@everystack/shared/testing';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TENANT_A = 'tenant-aaa-0001';
const TENANT_B = 'tenant-bbb-0002';
const WORKSPACE_ID = 'ws-0001';
const USER_ID = 'user-0001';

// ---------------------------------------------------------------------------
// getCommandRegistry tests
// ---------------------------------------------------------------------------

describe('getCommandRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEffectiveRole.mockResolvedValue('owner');
  });

  it('returns system commands filtered by global scope', async () => {
    const results = await getCommandRegistry(TENANT_A, USER_ID, {
      scope: 'global',
    });

    expect(results.length).toBeGreaterThan(0);
    for (const cmd of results) {
      expect(cmd.context_scopes).toContain('global');
      expect(cmd.source).toBe('system');
    }
  });

  it('returns system commands filtered by table_view scope', async () => {
    const results = await getCommandRegistry(TENANT_A, USER_ID, {
      scope: 'table_view',
    });

    expect(results.length).toBeGreaterThan(0);
    for (const cmd of results) {
      expect(cmd.context_scopes).toContain('table_view');
    }
    // /new record should be present (table_view only command)
    expect(results.some((c) => c.command_key === 'new record')).toBe(true);
  });

  it('filters out commands not in the given scope', async () => {
    const results = await getCommandRegistry(TENANT_A, USER_ID, {
      scope: 'chat',
    });

    // /new record is table_view only — should NOT appear in chat
    expect(results.some((c) => c.command_key === 'new record')).toBe(false);
    // /mute is chat only — should appear
    expect(results.some((c) => c.command_key === 'mute')).toBe(true);
  });

  it('returns empty array when user has no role', async () => {
    mockResolveEffectiveRole.mockResolvedValue(null);

    const results = await getCommandRegistry(TENANT_A, USER_ID, {
      scope: 'global',
    });

    expect(results).toEqual([]);
  });

  it('results are sorted by sort_order', async () => {
    const results = await getCommandRegistry(TENANT_A, USER_ID, {
      scope: 'global',
    });

    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.sort_order).toBeGreaterThanOrEqual(results[i - 1]!.sort_order);
    }
  });
});

// ---------------------------------------------------------------------------
// Permission filtering
// ---------------------------------------------------------------------------

describe('permission filtering', () => {
  it('viewer cannot see manager+ commands', () => {
    const results = filterCommandsByRoleAndScope(SYSTEM_COMMANDS, 'viewer', 'global');

    // /create automation requires manager — should NOT be present
    expect(results.some((c) => c.command_key === 'create automation')).toBe(false);
    // /settings requires admin — should NOT be present
    expect(results.some((c) => c.command_key === 'settings')).toBe(false);
    // /goto requires viewer — should be present
    expect(results.some((c) => c.command_key === 'goto')).toBe(true);
  });

  it('team_member cannot see manager+ commands', () => {
    const results = filterCommandsByRoleAndScope(SYSTEM_COMMANDS, 'team_member', 'global');

    expect(results.some((c) => c.command_key === 'create automation')).toBe(false);
    expect(results.some((c) => c.command_key === 'settings')).toBe(false);
    expect(results.some((c) => c.command_key === 'goto')).toBe(true);
  });

  it('manager can see manager commands but not admin commands', () => {
    const results = filterCommandsByRoleAndScope(SYSTEM_COMMANDS, 'manager', 'global');

    expect(results.some((c) => c.command_key === 'create automation')).toBe(true);
    expect(results.some((c) => c.command_key === 'settings')).toBe(false);
    expect(results.some((c) => c.command_key === 'invite')).toBe(false);
  });

  it('admin can see admin commands', () => {
    const results = filterCommandsByRoleAndScope(SYSTEM_COMMANDS, 'admin', 'global');

    expect(results.some((c) => c.command_key === 'settings')).toBe(true);
    expect(results.some((c) => c.command_key === 'invite')).toBe(true);
  });

  it('owner can see all commands', () => {
    const results = filterCommandsByRoleAndScope(SYSTEM_COMMANDS, 'owner', 'global');

    const globalSystemCommands = SYSTEM_COMMANDS.filter((c) =>
      c.context_scopes.includes('global'),
    );
    expect(results).toHaveLength(globalSystemCommands.length);
  });
});

// ---------------------------------------------------------------------------
// Factory tests
// ---------------------------------------------------------------------------

describe('createTestCommandRegistryEntry', () => {
  beforeEach(() => {
    resetCommandRegistryCounter();
  });

  it('produces valid entries with unique ids', () => {
    const entry1 = createTestCommandRegistryEntry();
    const entry2 = createTestCommandRegistryEntry();

    expect(entry1.id).not.toBe(entry2.id);
    expect(entry1.command_key).not.toBe(entry2.command_key);
    expect(entry1.source).toBe('system');
    expect(entry1.context_scopes).toEqual(['global']);
  });

  it('accepts overrides', () => {
    const entry = createTestCommandRegistryEntry({
      id: 'custom-id',
      command_key: 'custom-cmd',
      category: 'Navigation',
      permission_required: 'admin',
      context_scopes: ['table_view', 'record_detail'],
    });

    expect(entry.id).toBe('custom-id');
    expect(entry.command_key).toBe('custom-cmd');
    expect(entry.category).toBe('Navigation');
    expect(entry.permission_required).toBe('admin');
    expect(entry.context_scopes).toEqual(['table_view', 'record_detail']);
  });

  it('entry has all required CommandEntry fields', () => {
    const entry = createTestCommandRegistryEntry();

    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('command_key');
    expect(entry).toHaveProperty('label');
    expect(entry).toHaveProperty('description');
    expect(entry).toHaveProperty('category');
    expect(entry).toHaveProperty('source');
    expect(entry).toHaveProperty('context_scopes');
    expect(entry).toHaveProperty('permission_required');
    expect(entry).toHaveProperty('sort_order');
  });
});

// ---------------------------------------------------------------------------
// searchTablesAndViews tests
// ---------------------------------------------------------------------------

describe('searchTablesAndViews', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEffectiveRole.mockResolvedValue('owner');
    // Default: both queries return empty
    mockWhere.mockResolvedValue([]);
  });

  it('returns empty array for empty query', async () => {
    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, '', USER_ID);
    expect(results).toEqual([]);
  });

  it('returns empty array for whitespace-only query', async () => {
    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, '   ', USER_ID);
    expect(results).toEqual([]);
  });

  it('returns empty array when user has no role', async () => {
    mockResolveEffectiveRole.mockResolvedValue(null);

    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'test', USER_ID);
    expect(results).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('owner sees tables and views', async () => {
    // First query (tables) returns a table
    mockWhere
      .mockResolvedValueOnce([{ id: 'tbl-1', name: 'Projects' }])
      // Second query (views) returns a view
      .mockResolvedValueOnce([{ id: 'view-1', name: 'Active Projects', tableName: 'Projects' }]);

    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'proj', USER_ID);

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      entity_type: 'table',
      entity_id: 'tbl-1',
      name: 'Projects',
    });
    expect(results[1]).toEqual({
      entity_type: 'view',
      entity_id: 'view-1',
      name: 'Active Projects',
      parent_name: 'Projects',
    });
  });

  it('manager sees tables and views', async () => {
    mockResolveEffectiveRole.mockResolvedValue('manager');
    mockWhere
      .mockResolvedValueOnce([{ id: 'tbl-1', name: 'Tasks' }])
      .mockResolvedValueOnce([]);

    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'tasks', USER_ID);

    expect(results).toHaveLength(1);
    expect(results[0]!.entity_type).toBe('table');
  });

  it('team_member sees only assigned shared views', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    // The query for shared views returns views with permissions
    mockWhere.mockResolvedValueOnce([
      {
        id: 'view-1',
        name: 'My Tasks',
        tableName: 'Tasks',
        permissions: {
          roles: ['team_member'],
          specificUsers: [],
          excludedUsers: [],
        },
      },
      {
        id: 'view-2',
        name: 'All Projects',
        tableName: 'Projects',
        permissions: {
          roles: [],
          specificUsers: [],
          excludedUsers: [],
        },
      },
    ]);

    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'tasks', USER_ID);

    // Only view-1 matches (roles includes team_member), view-2 does not
    expect(results).toHaveLength(1);
    expect(results[0]!.entity_id).toBe('view-1');
    expect(results[0]!.entity_type).toBe('view');
  });

  it('viewer sees only specifically assigned shared views', async () => {
    mockResolveEffectiveRole.mockResolvedValue('viewer');

    mockWhere.mockResolvedValueOnce([
      {
        id: 'view-1',
        name: 'Dashboard View',
        tableName: 'Dashboard',
        permissions: {
          roles: [],
          specificUsers: [USER_ID],
          excludedUsers: [],
        },
      },
      {
        id: 'view-2',
        name: 'Admin View',
        tableName: 'Admin',
        permissions: {
          roles: [],
          specificUsers: ['other-user'],
          excludedUsers: [],
        },
      },
    ]);

    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'view', USER_ID);

    expect(results).toHaveLength(1);
    expect(results[0]!.entity_id).toBe('view-1');
  });

  it('excluded users are filtered out even if in specificUsers', async () => {
    mockResolveEffectiveRole.mockResolvedValue('team_member');

    mockWhere.mockResolvedValueOnce([
      {
        id: 'view-1',
        name: 'Secret View',
        tableName: 'Secrets',
        permissions: {
          roles: ['team_member'],
          specificUsers: [USER_ID],
          excludedUsers: [USER_ID],
        },
      },
    ]);

    const results = await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'secret', USER_ID);

    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Tenant isolation
// ---------------------------------------------------------------------------

describe('searchTablesAndViews — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveEffectiveRole.mockResolvedValue('owner');
    mockWhere.mockResolvedValue([]);
  });

  it('passes tenantId to getDbForTenant for scoping', async () => {
    await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'test', USER_ID);
    await searchTablesAndViews(TENANT_B, WORKSPACE_ID, 'test', USER_ID);

    const { getDbForTenant } = await import('@everystack/shared/db');
    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_A, 'read');
    expect(getDbForTenant).toHaveBeenCalledWith(TENANT_B, 'read');
  });

  it('includes tenantId in query conditions via eq()', async () => {
    await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'test', USER_ID);

    const { eq: mockEq } = await import('@everystack/shared/db');
    // Owner/Admin path uses eq(tables.tenantId, ...) and eq(views.tenantId, ...)
    expect(mockEq).toHaveBeenCalledWith(expect.anything(), TENANT_A);
  });

  it('resolves role per tenant', async () => {
    await searchTablesAndViews(TENANT_A, WORKSPACE_ID, 'test', USER_ID);
    await searchTablesAndViews(TENANT_B, WORKSPACE_ID, 'test', USER_ID);

    expect(mockResolveEffectiveRole).toHaveBeenCalledWith(USER_ID, TENANT_A, WORKSPACE_ID);
    expect(mockResolveEffectiveRole).toHaveBeenCalledWith(USER_ID, TENANT_B, WORKSPACE_ID);
  });
});

// ---------------------------------------------------------------------------
// SYSTEM_COMMANDS integrity
// ---------------------------------------------------------------------------

describe('SYSTEM_COMMANDS', () => {
  it('all entries have required fields', () => {
    for (const cmd of SYSTEM_COMMANDS) {
      expect(cmd.id).toBeTruthy();
      expect(cmd.command_key).toBeTruthy();
      expect(cmd.label).toBeTruthy();
      expect(cmd.description).toBeTruthy();
      expect(cmd.category).toBeTruthy();
      expect(cmd.source).toBe('system');
      expect(cmd.context_scopes.length).toBeGreaterThan(0);
      expect(cmd.permission_required).toBeTruthy();
      expect(typeof cmd.sort_order).toBe('number');
    }
  });

  it('has unique command keys', () => {
    const keys = SYSTEM_COMMANDS.map((c) => c.command_key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has unique ids', () => {
    const ids = SYSTEM_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all MVP categories', () => {
    const categories = new Set(SYSTEM_COMMANDS.map((c) => c.category));
    expect(categories).toContain('Navigation');
    expect(categories).toContain('Record Creation');
    expect(categories).toContain('Data Operations');
    expect(categories).toContain('Communication');
    expect(categories).toContain('Document Generation');
    expect(categories).toContain('Automation');
    expect(categories).toContain('Settings');
    expect(categories).toContain('Utility');
    expect(categories).toContain('AI Actions');
  });
});
