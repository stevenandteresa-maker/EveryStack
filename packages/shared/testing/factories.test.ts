import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Mock DB object shared across all tests.
 * getTestDb() caches the connection, so this same object is reused.
 * We reset insert's implementation in beforeEach for clean call counts.
 */
const mockDb = {
  insert: vi.fn(),
};

vi.mock('../db/client', () => ({
  getDbForTenant: vi.fn(() => mockDb),
}));

import { isValidUUID } from '../db/uuid';
import {
  getTestDb,
  createTestTenant,
  createTestUser,
  createTestWorkspace,
  createTestRecord,
} from './factories';

beforeEach(() => {
  mockDb.insert.mockReset();
  mockDb.insert.mockImplementation(() => ({
    values: vi.fn().mockImplementation((vals: unknown) => ({
      returning: vi.fn().mockResolvedValue([vals]),
    })),
  }));
});

describe('getTestDb', () => {
  it('returns a cached DrizzleClient instance', () => {
    const db1 = getTestDb();
    const db2 = getTestDb();
    expect(db1).toBe(db2);
  });
});

describe('createTestTenant', () => {
  it('returns a tenant with a valid UUIDv7 id and default plan', async () => {
    const tenant = await createTestTenant();
    expect(isValidUUID(tenant.id)).toBe(true);
    expect(tenant.plan).toBe('professional');
  });

  it('produces different ids for successive calls', async () => {
    const a = await createTestTenant();
    const b = await createTestTenant();
    expect(a.id).not.toBe(b.id);
  });

  it('applies overrides', async () => {
    const tenant = await createTestTenant({ name: 'Custom Tenant', plan: 'freelancer' });
    expect(tenant.name).toBe('Custom Tenant');
    expect(tenant.plan).toBe('freelancer');
  });
});

describe('createTestUser', () => {
  it('returns a user with a unique auto-generated email', async () => {
    const user = await createTestUser();
    expect(user.email).toMatch(/^test-\w+@example\.com$/);
    expect(isValidUUID(user.id)).toBe(true);
  });

  it('produces different emails for successive calls', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    expect(a.email).not.toBe(b.email);
  });

  it('applies overrides', async () => {
    const user = await createTestUser({ name: 'Jane Doe' });
    expect(user.name).toBe('Jane Doe');
  });
});

describe('createTestWorkspace', () => {
  it('auto-creates a tenant when tenantId is not provided', async () => {
    const workspace = await createTestWorkspace();
    expect(isValidUUID(workspace.tenantId)).toBe(true);
    // 3 inserts: auto-created tenant, auto-created user (for createdBy), workspace
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });

  it('uses provided tenantId without auto-creating', async () => {
    const tenantId = '01900000-0000-7000-8000-000000000001';
    const createdBy = '01900000-0000-7000-8000-000000000002';
    const workspace = await createTestWorkspace({ tenantId, createdBy });
    expect(workspace.tenantId).toBe(tenantId);
    // Only 1 insert: the workspace itself (no auto-created tenant or user)
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

describe('createTestRecord', () => {
  it('auto-creates a tenant when tenantId is not provided', async () => {
    const record = await createTestRecord();
    expect(isValidUUID(record.tenantId)).toBe(true);
    // 2 inserts: auto-created tenant, record
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it('returns a record with valid default canonicalData', async () => {
    const record = await createTestRecord();
    expect(record.canonicalData).toEqual({});
  });

  it('uses provided tenantId without auto-creating', async () => {
    const tenantId = '01900000-0000-7000-8000-000000000001';
    const record = await createTestRecord({ tenantId });
    expect(record.tenantId).toBe(tenantId);
    // Only 1 insert: the record itself
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});
