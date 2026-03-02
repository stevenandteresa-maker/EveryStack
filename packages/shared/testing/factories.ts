/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data with sensible defaults.
 * Each factory inserts into the real database and returns the created row.
 * Auto-parent creation: when a required FK is not provided, the factory
 * calls the parent factory to create it.
 */

import { getDbForTenant } from '../db/client';
import type { DrizzleClient } from '../db/client';
import { generateUUIDv7 } from '../db/uuid';
import { tenants, users, workspaces, records } from '../db/schema';
import type {
  NewTenant,
  Tenant,
  NewUser,
  User,
  NewWorkspace,
  Workspace,
  NewDbRecord,
  DbRecord,
} from '../db/schema';

let testDbConn: DrizzleClient | undefined;

/**
 * Returns a singleton Drizzle DB connection pointed at the test database.
 * Uses getDbForTenant('test', 'write') from the existing DB client module.
 */
export function getTestDb(): DrizzleClient {
  if (!testDbConn) {
    testDbConn = getDbForTenant('test', 'write');
  }
  return testDbConn;
}

function randomSuffix(): string {
  return Math.random().toString(36).substring(2, 8);
}

function firstRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) throw new Error('Expected at least one row from insert');
  return row;
}

/**
 * Creates a tenant with sensible defaults.
 * Default plan is 'professional' (suitable for testing most features).
 */
export async function createTestTenant(
  overrides?: Partial<NewTenant>,
): Promise<Tenant> {
  const db = getTestDb();
  const suffix = randomSuffix();

  const values: NewTenant = {
    id: generateUUIDv7(),
    name: `Test Tenant ${suffix}`,
    plan: 'professional',
    ...overrides,
  };

  return firstRow(await db.insert(tenants).values(values).returning());
}

/**
 * Creates a user with sensible defaults.
 * Generates a unique email and clerk ID per call.
 */
export async function createTestUser(
  overrides?: Partial<NewUser>,
): Promise<User> {
  const db = getTestDb();
  const suffix = randomSuffix();

  const values: NewUser = {
    id: generateUUIDv7(),
    email: `test-${suffix}@example.com`,
    name: 'Test User',
    clerkId: `clerk_${suffix}`,
    ...overrides,
  };

  return firstRow(await db.insert(users).values(values).returning());
}

/**
 * Creates a workspace with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestWorkspace(
  overrides?: Partial<NewWorkspace>,
): Promise<Workspace> {
  const db = getTestDb();
  const suffix = randomSuffix();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewWorkspace = {
    id: generateUUIDv7(),
    tenantId,
    name: `Test Workspace ${suffix}`,
    slug: `test-ws-${suffix}`,
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(workspaces).values(values).returning());
}

/**
 * Creates a record with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 * Uses a generated UUID for tableId when not provided (caller should
 * provide a valid tableId for integration tests with FK constraints).
 */
export async function createTestRecord(
  overrides?: Partial<NewDbRecord>,
): Promise<DbRecord> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;

  const values: NewDbRecord = {
    id: generateUUIDv7(),
    tenantId,
    tableId: generateUUIDv7(),
    canonicalData: {},
    ...overrides,
  };

  return firstRow(await db.insert(records).values(values).returning());
}
