import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTableName } from 'drizzle-orm';
import type { DrizzleClient } from '../client';

// ---- Mocks ----------------------------------------------------------------

// Mock the client module to avoid DATABASE_URL requirement
vi.mock('../client', () => ({
  db: {},
  dbRead: {},
  getDbForTenant: vi.fn(),
}));

// Mock the uuid module to return predictable UUIDs
import { createMockUUIDs } from '../../testing/mock-uuid';

const MOCK_UUIDS = createMockUUIDs(4);
let uuidIndex = 0;

vi.mock('../uuid', () => ({
  generateUUIDv7: () => MOCK_UUIDS[uuidIndex++] ?? 'fallback-uuid',
}));

vi.mock('../rls', () => ({
  setTenantContext: vi.fn(),
}));

// Build a minimal fake Drizzle client that tracks calls
function createMockClient() {
  const insertedRows: Array<{ table: string; values: Record<string, unknown> }> = [];
  const updatedRows: Array<{ table: string; values: Record<string, unknown>; where: unknown }> = [];

  const mockInsert = (tableName: string) => ({
    values: (vals: Record<string, unknown>) => {
      insertedRows.push({ table: tableName, values: vals });
      return { returning: () => [vals] };
    },
  });

  const mockUpdate = (tableName: string) => ({
    set: (vals: Record<string, unknown>) => ({
      where: (condition: unknown) => {
        updatedRows.push({ table: tableName, values: vals, where: condition });
        return Promise.resolve();
      },
    }),
  });

  const client = {
    insert: (table: unknown) => {
      const tableName = getTableName(table as Parameters<typeof getTableName>[0]);
      return mockInsert(tableName);
    },
    update: (table: unknown) => {
      const tableName = getTableName(table as Parameters<typeof getTableName>[0]);
      return mockUpdate(tableName);
    },
    transaction: async (fn: (tx: DrizzleClient) => Promise<void>) => {
      await fn(client as unknown as DrizzleClient);
    },
  } as unknown as DrizzleClient;

  return { client, insertedRows, updatedRows };
}

// ---- Tests -----------------------------------------------------------------

describe('createUserWithTenant', () => {
  beforeEach(() => {
    uuidIndex = 0;
    vi.clearAllMocks();
  });

  it('creates user, tenant, membership, workspace, and workspace membership in a transaction', async () => {
    const { createUserWithTenant } = await import('./user-operations');
    const { client, insertedRows } = createMockClient();

    const result = await createUserWithTenant(
      { clerkId: 'user_clerk123', email: 'test@example.com', name: 'John Doe' },
      client,
    );

    // Returns the correct IDs
    expect(result.userId).toBe(MOCK_UUIDS[0]!);
    expect(result.tenantId).toBe(MOCK_UUIDS[1]!);
    expect(result.workspaceId).toBe(MOCK_UUIDS[2]!);

    // Five inserts in the transaction (user, tenant, membership, workspace, workspace membership)
    expect(insertedRows).toHaveLength(5);

    // 1. User
    expect(insertedRows[0]?.table).toBe('users');
    expect(insertedRows[0]?.values).toMatchObject({
      id: MOCK_UUIDS[0]!,
      clerkId: 'user_clerk123',
      email: 'test@example.com',
      name: 'John Doe',
    });

    // 2. Tenant
    expect(insertedRows[1]?.table).toBe('tenants');
    expect(insertedRows[1]?.values).toMatchObject({
      id: MOCK_UUIDS[1]!,
      name: "John Doe's Workspace",
      plan: 'freelancer',
    });

    // 3. Tenant membership
    expect(insertedRows[2]?.table).toBe('tenant_memberships');
    expect(insertedRows[2]?.values).toMatchObject({
      tenantId: MOCK_UUIDS[1]!,
      userId: MOCK_UUIDS[0]!,
      role: 'owner',
      status: 'active',
    });

    // 4. Workspace
    expect(insertedRows[3]?.table).toBe('workspaces');
    expect(insertedRows[3]?.values).toMatchObject({
      id: MOCK_UUIDS[2]!,
      tenantId: MOCK_UUIDS[1]!,
      name: 'My Workspace',
      createdBy: MOCK_UUIDS[0]!,
    });
    // Slug should be a non-empty string
    expect(insertedRows[3]?.values.slug).toBeTruthy();
    expect(typeof insertedRows[3]?.values.slug).toBe('string');

    // 5. Workspace membership
    expect(insertedRows[4]?.table).toBe('workspace_memberships');
    expect(insertedRows[4]?.values).toMatchObject({
      userId: MOCK_UUIDS[0]!,
      tenantId: MOCK_UUIDS[1]!,
      workspaceId: MOCK_UUIDS[2]!,
      role: 'manager',
    });
  });

  it('calls setTenantContext before inserting RLS-protected rows', async () => {
    const { createUserWithTenant } = await import('./user-operations');
    const { setTenantContext } = await import('../rls');
    const { client } = createMockClient();

    await createUserWithTenant(
      { clerkId: 'user_abc', email: 'a@b.com', name: 'Test' },
      client,
    );

    // Called once for the primary tenant
    expect(setTenantContext).toHaveBeenCalledTimes(1);
    expect(setTenantContext).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_UUIDS[1]!,
    );
  });

  it('sets tenant plan to freelancer', async () => {
    const { createUserWithTenant } = await import('./user-operations');
    const { client, insertedRows } = createMockClient();

    await createUserWithTenant(
      { clerkId: 'user_x', email: 'x@y.com', name: 'X' },
      client,
    );

    const tenantInsert = insertedRows.find((r) => r.table === 'tenants');
    expect(tenantInsert?.values.plan).toBe('freelancer');
  });

  it('generates a slug containing "my-workspace"', async () => {
    const { createUserWithTenant } = await import('./user-operations');
    const { client, insertedRows } = createMockClient();

    await createUserWithTenant(
      { clerkId: 'user_x', email: 'x@y.com', name: 'X' },
      client,
    );

    const wsInsert = insertedRows.find((r) => r.table === 'workspaces');
    expect(wsInsert?.values.slug).toMatch(/^my-workspace-/);
  });
});

describe('updateUserFromClerk', () => {
  beforeEach(() => {
    uuidIndex = 0;
    vi.clearAllMocks();
  });

  it('updates email and name', async () => {
    const { updateUserFromClerk } = await import('./user-operations');
    const { client, updatedRows } = createMockClient();

    await updateUserFromClerk(
      'user_clerk456',
      { email: 'new@example.com', name: 'New Name' },
      client,
    );

    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]?.table).toBe('users');
    expect(updatedRows[0]?.values).toEqual({
      email: 'new@example.com',
      name: 'New Name',
    });
  });

  it('updates only email when name is undefined', async () => {
    const { updateUserFromClerk } = await import('./user-operations');
    const { client, updatedRows } = createMockClient();

    await updateUserFromClerk('user_x', { email: 'only@email.com' }, client);

    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]?.values).toEqual({ email: 'only@email.com' });
  });

  it('updates only name when email is undefined', async () => {
    const { updateUserFromClerk } = await import('./user-operations');
    const { client, updatedRows } = createMockClient();

    await updateUserFromClerk('user_x', { name: 'Only Name' }, client);

    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]?.values).toEqual({ name: 'Only Name' });
  });

  it('skips update when no fields provided', async () => {
    const { updateUserFromClerk } = await import('./user-operations');
    const { client, updatedRows } = createMockClient();

    await updateUserFromClerk('user_x', {}, client);

    expect(updatedRows).toHaveLength(0);
  });
});
