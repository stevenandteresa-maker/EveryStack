import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const { mockSetTenantContext } = vi.hoisted(() => ({
  mockSetTenantContext: vi.fn(),
}));

const MOCK_PERSONAL_TENANT_ID = 'personal-tenant-uuid-1';

vi.mock('@everystack/shared/db', () => ({
  db: {},
  users: { id: 'users.id', personalTenantId: 'users.personalTenantId' },
  tenants: { id: 'tenants.id' },
  tenantMemberships: { id: 'tenant_memberships.id' },
  workspaces: { id: 'workspaces.id', tenantId: 'workspaces.tenantId' },
  eq: vi.fn((a: unknown, b: unknown) => ({ field: a, value: b })),
  and: vi.fn((...args: unknown[]) => ({ conditions: args })),
  setTenantContext: mockSetTenantContext,
  generateUUIDv7: () => MOCK_PERSONAL_TENANT_ID,
}));

// ---------------------------------------------------------------------------
// Import module under test
// ---------------------------------------------------------------------------

import {
  provisionPersonalTenant,
  isPersonalTenant,
  hasPersonalWorkspace,
  PERSONAL_TENANT_ACCENT_COLOR,
} from '../personal-tenant';
import type { DrizzleClient } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockClient(opts: {
  selectResult?: unknown[];
  personalTenantId?: string | null;
} = {}) {
  const insertedRows: Array<{ values: Record<string, unknown> }> = [];
  const updatedRows: Array<{ values: Record<string, unknown> }> = [];

  const mockSelectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(
        opts.selectResult ?? [{ personalTenantId: opts.personalTenantId ?? null }],
      ),
      limit: vi.fn().mockReturnValue(opts.selectResult ?? []),
    }),
  };

  const mockInsertChain = {
    values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
      insertedRows.push({ values: vals });
      return { returning: () => [vals] };
    }),
  };

  const mockUpdateChain = {
    set: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
      where: vi.fn().mockImplementation(() => {
        updatedRows.push({ values: vals });
        return Promise.resolve();
      }),
    })),
  };

  const client = {
    select: vi.fn().mockReturnValue(mockSelectChain),
    insert: vi.fn().mockReturnValue(mockInsertChain),
    update: vi.fn().mockReturnValue(mockUpdateChain),
    transaction: vi.fn().mockImplementation(async (fn: (tx: DrizzleClient) => Promise<void>) => {
      // Create a transaction client that tracks inserts/updates
      const txInsertChain = {
        values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
          insertedRows.push({ values: vals });
          return { returning: () => [vals] };
        }),
      };
      const txUpdateChain = {
        set: vi.fn().mockImplementation((vals: Record<string, unknown>) => ({
          where: vi.fn().mockImplementation(() => {
            updatedRows.push({ values: vals });
            return Promise.resolve();
          }),
        })),
      };
      const tx = {
        insert: vi.fn().mockReturnValue(txInsertChain),
        update: vi.fn().mockReturnValue(txUpdateChain),
        select: vi.fn().mockReturnValue(mockSelectChain),
      } as unknown as DrizzleClient;
      await fn(tx);
    }),
  } as unknown as DrizzleClient;

  return { client, insertedRows, updatedRows, mockSelectChain };
}

// ---------------------------------------------------------------------------
// Tests — provisionPersonalTenant
// ---------------------------------------------------------------------------

describe('provisionPersonalTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provisions a personal tenant for a new user', async () => {
    const { client, insertedRows, updatedRows } = createMockClient({
      personalTenantId: null,
    });

    const result = await provisionPersonalTenant('user-1', 'John Doe', client);

    expect(result).toBe(MOCK_PERSONAL_TENANT_ID);

    // Should have created tenant + membership (2 inserts) + 1 user update
    expect(insertedRows).toHaveLength(2);
    expect(updatedRows).toHaveLength(1);
  });

  it('creates personal tenant with warm neutral accent color', async () => {
    const { client, insertedRows } = createMockClient({
      personalTenantId: null,
    });

    await provisionPersonalTenant('user-1', 'John Doe', client);

    const tenantInsert = insertedRows[0];
    expect(tenantInsert?.values).toMatchObject({
      id: MOCK_PERSONAL_TENANT_ID,
      plan: 'freelancer',
      settings: expect.objectContaining({
        personal: true,
        auto_provisioned: true,
        branding_accent_color: '#78716C',
      }),
    });
  });

  it('accent color is warm neutral, distinct from 8 org colors', () => {
    // The 8 org accent colors from design system (none should match personal)
    const orgColors = [
      '#0D9488', // Teal-600
      '#2563EB', // Blue-600
      '#7C3AED', // Violet-600
      '#DB2777', // Pink-600
      '#EA580C', // Orange-600
      '#059669', // Emerald-600
      '#DC2626', // Red-600
      '#4F46E5', // Indigo-600
    ];
    expect(orgColors).not.toContain(PERSONAL_TENANT_ACCENT_COLOR);
    expect(PERSONAL_TENANT_ACCENT_COLOR).toBe('#78716C');
  });

  it('sets users.personal_tenant_id in the transaction', async () => {
    const { client, updatedRows } = createMockClient({
      personalTenantId: null,
    });

    await provisionPersonalTenant('user-1', 'Jane Doe', client);

    expect(updatedRows).toHaveLength(1);
    expect(updatedRows[0]?.values).toMatchObject({
      personalTenantId: MOCK_PERSONAL_TENANT_ID,
    });
  });

  it('creates owner membership for user in personal tenant', async () => {
    const { client, insertedRows } = createMockClient({
      personalTenantId: null,
    });

    await provisionPersonalTenant('user-1', 'Test User', client);

    const membershipInsert = insertedRows[1];
    expect(membershipInsert?.values).toMatchObject({
      tenantId: MOCK_PERSONAL_TENANT_ID,
      userId: 'user-1',
      role: 'owner',
      status: 'active',
    });
  });

  it('is idempotent — second call returns existing personal tenant ID', async () => {
    const existingPersonalTenantId = 'existing-personal-tenant-uuid';
    const { client } = createMockClient({
      personalTenantId: existingPersonalTenantId,
    });

    const result = await provisionPersonalTenant('user-1', 'John Doe', client);

    // Returns existing ID
    expect(result).toBe(existingPersonalTenantId);

    // No transaction should have been called (no new inserts)
    expect(client.transaction).not.toHaveBeenCalled();
  });

  it('uses the userName in the personal tenant name', async () => {
    const { client, insertedRows } = createMockClient({
      personalTenantId: null,
    });

    await provisionPersonalTenant('user-1', 'Alice Smith', client);

    const tenantInsert = insertedRows[0];
    expect(tenantInsert?.values.name).toBe("Alice Smith's Workspace");
  });

  it('calls setTenantContext before RLS-protected inserts', async () => {
    const { client } = createMockClient({
      personalTenantId: null,
    });

    await provisionPersonalTenant('user-1', 'Test User', client);

    expect(mockSetTenantContext).toHaveBeenCalledWith(
      expect.anything(),
      MOCK_PERSONAL_TENANT_ID,
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — isPersonalTenant
// ---------------------------------------------------------------------------

describe('isPersonalTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when tenantId matches user personal_tenant_id', async () => {
    const personalTenantId = 'personal-tenant-123';
    const { client } = createMockClient({
      personalTenantId: personalTenantId,
    });

    const result = await isPersonalTenant(personalTenantId, 'user-1', client);

    expect(result).toBe(true);
  });

  it('returns false when tenantId does not match personal_tenant_id', async () => {
    const { client } = createMockClient({
      personalTenantId: 'personal-tenant-123',
    });

    const result = await isPersonalTenant('org-tenant-456', 'user-1', client);

    expect(result).toBe(false);
  });

  it('returns false when user has no personal tenant', async () => {
    const { client } = createMockClient({
      personalTenantId: null,
    });

    const result = await isPersonalTenant('any-tenant', 'user-1', client);

    expect(result).toBe(false);
  });

  it('returns false when user not found', async () => {
    const { client } = createMockClient({
      selectResult: [],
    });

    const result = await isPersonalTenant('any-tenant', 'nonexistent-user', client);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — hasPersonalWorkspace
// ---------------------------------------------------------------------------

describe('hasPersonalWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when personal tenant has no workspaces', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([]),
        }),
      }),
    };
    const client = {
      select: vi.fn().mockReturnValue(mockSelectChain),
    } as unknown as DrizzleClient;

    const result = await hasPersonalWorkspace('personal-tenant-1', client);

    expect(result).toBe(false);
  });

  it('returns true when personal tenant has a workspace', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue([{ id: 'workspace-1' }]),
        }),
      }),
    };
    const client = {
      select: vi.fn().mockReturnValue(mockSelectChain),
    } as unknown as DrizzleClient;

    const result = await hasPersonalWorkspace('personal-tenant-1', client);

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — PERSONAL_TENANT_ACCENT_COLOR constant
// ---------------------------------------------------------------------------

describe('PERSONAL_TENANT_ACCENT_COLOR', () => {
  it('is warm neutral stone-500', () => {
    expect(PERSONAL_TENANT_ACCENT_COLOR).toBe('#78716C');
  });
});
