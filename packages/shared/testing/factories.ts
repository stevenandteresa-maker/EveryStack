/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data with sensible defaults.
 * Each factory inserts into the real database and returns the created row.
 * Auto-parent creation: when a required FK is not provided, the factory
 * calls the parent factory to create it.
 */

import { createHash, randomBytes } from 'node:crypto';
import { getDbForTenant } from '../db/client';
import type { DrizzleClient } from '../db/client';
import { generateUUIDv7 } from '../db/uuid';
import {
  tenants,
  users,
  workspaces,
  records,
  tables,
  fields,
  baseConnections,
  views,
  crossLinks,
  portals,
  portalAccess,
  forms,
  automations,
  documentTemplates,
  threads,
  apiKeys,
  recordViewConfigs,
} from '../db/schema';
import type {
  NewTenant,
  Tenant,
  NewUser,
  User,
  NewWorkspace,
  Workspace,
  NewDbRecord,
  DbRecord,
  NewTable,
  Table,
  NewField,
  Field,
  NewBaseConnection,
  BaseConnection,
  NewView,
  View,
  NewCrossLink,
  CrossLink,
  NewPortal,
  Portal,
  NewPortalAccess,
  PortalAccess,
  NewForm,
  Form,
  NewAutomation,
  Automation,
  NewDocumentTemplate,
  DocumentTemplate,
  NewThread,
  Thread,
  NewApiKey,
  ApiKey,
  NewRecordViewConfig,
  RecordViewConfig,
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

// ---------------------------------------------------------------------------
// Tier 1 — Foundation Factories
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tier 2 — Tables, Fields, Base Connections
// ---------------------------------------------------------------------------

/**
 * Creates a table with sensible defaults.
 * Auto-creates a workspace (and therefore tenant) when workspaceId is not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestTable(
  overrides?: Partial<NewTable>,
): Promise<Table> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let workspaceId = overrides?.workspaceId;

  if (!workspaceId) {
    const workspace = await createTestWorkspace(tenantId ? { tenantId } : undefined);
    workspaceId = workspace.id;
    tenantId = tenantId ?? workspace.tenantId;
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewTable = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    workspaceId,
    name: 'Test Table',
    tableType: 'table',
    environment: 'live',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(tables).values(values).returning());
}

/**
 * Creates a field with sensible defaults.
 * Auto-creates a table (and therefore workspace and tenant) when tableId is not provided.
 */
export async function createTestField(
  overrides?: Partial<NewField>,
): Promise<Field> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let tableId = overrides?.tableId;

  if (!tableId) {
    const table = await createTestTable(tenantId ? { tenantId } : undefined);
    tableId = table.id;
    tenantId = tenantId ?? table.tenantId;
  }

  const values: NewField = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    tableId,
    name: 'Test Field',
    fieldType: 'text',
    config: {},
    sortOrder: 0,
    environment: 'live',
    ...overrides,
  };

  return firstRow(await db.insert(fields).values(values).returning());
}

/**
 * Creates a base connection with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestBase(
  overrides?: Partial<NewBaseConnection>,
): Promise<BaseConnection> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewBaseConnection = {
    id: generateUUIDv7(),
    tenantId,
    platform: 'airtable',
    syncDirection: 'bidirectional',
    conflictResolution: 'last_write_wins',
    syncStatus: 'active',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(baseConnections).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 3 — Views
// ---------------------------------------------------------------------------

/**
 * Creates a view with sensible defaults.
 * Auto-creates a table (and therefore workspace and tenant) when tableId is not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestView(
  overrides?: Partial<NewView>,
): Promise<View> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let tableId = overrides?.tableId;

  if (!tableId) {
    const table = await createTestTable(tenantId ? { tenantId } : undefined);
    tableId = table.id;
    tenantId = tenantId ?? table.tenantId;
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewView = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    tableId,
    name: 'Default Grid',
    viewType: 'grid',
    config: {},
    isShared: true,
    environment: 'live',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(views).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 4 — Cross-Links
// ---------------------------------------------------------------------------

/**
 * Creates a cross-link with sensible defaults.
 * Auto-creates two tables (source and target) in the same workspace and
 * a field on each table when not provided.
 */
export async function createTestCrossLink(
  overrides?: Partial<NewCrossLink>,
): Promise<CrossLink> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let sourceTableId = overrides?.sourceTableId;
  let sourceFieldId = overrides?.sourceFieldId;
  let targetTableId = overrides?.targetTableId;
  let targetDisplayFieldId = overrides?.targetDisplayFieldId;

  // Create source table + field if not provided
  if (!sourceTableId || !sourceFieldId) {
    const sourceTable = sourceTableId
      ? { id: sourceTableId, tenantId: tenantId! }
      : await createTestTable(tenantId ? { tenantId } : undefined);
    sourceTableId = sourceTable.id;
    tenantId = tenantId ?? sourceTable.tenantId;

    if (!sourceFieldId) {
      const sourceField = await createTestField({
        tenantId,
        tableId: sourceTableId,
        name: 'Link Field',
        fieldType: 'cross_link',
      });
      sourceFieldId = sourceField.id;
    }
  }

  // Create target table + field in the same workspace if not provided
  if (!targetTableId || !targetDisplayFieldId) {
    // Look up the source table's workspace to share it
    const sourceTableRow = await createTestTable({
      tenantId: tenantId!,
      ...(targetTableId ? { id: targetTableId } : {}),
    });
    if (!targetTableId) {
      targetTableId = sourceTableRow.id;
    }

    if (!targetDisplayFieldId) {
      const targetField = await createTestField({
        tenantId: tenantId!,
        tableId: targetTableId,
        name: 'Display Field',
        fieldType: 'text',
        isPrimary: true,
      });
      targetDisplayFieldId = targetField.id;
    }
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewCrossLink = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    sourceTableId,
    sourceFieldId,
    targetTableId,
    targetDisplayFieldId,
    relationshipType: 'many_to_one',
    environment: 'live',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(crossLinks).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 5 — Record View Configs (helper for Portals & Forms)
// ---------------------------------------------------------------------------

/**
 * Creates a record view config with sensible defaults.
 * Auto-creates a table when tableId is not provided.
 */
export async function createTestRecordViewConfig(
  overrides?: Partial<NewRecordViewConfig>,
): Promise<RecordViewConfig> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let tableId = overrides?.tableId;

  if (!tableId) {
    const table = await createTestTable(tenantId ? { tenantId } : undefined);
    tableId = table.id;
    tenantId = tenantId ?? table.tenantId;
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewRecordViewConfig = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    tableId,
    name: 'Default Record View',
    layout: {},
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(recordViewConfigs).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 6 — Portals & Forms
// ---------------------------------------------------------------------------

/**
 * Creates a portal with sensible defaults.
 * Auto-creates a table, record view config, and user when not provided.
 */
export async function createTestPortal(
  overrides?: Partial<NewPortal>,
): Promise<Portal> {
  const db = getTestDb();
  const suffix = randomSuffix();

  let tenantId = overrides?.tenantId;
  let tableId = overrides?.tableId;
  let recordViewConfigId = overrides?.recordViewConfigId;

  if (!tableId || !recordViewConfigId) {
    const table = tableId
      ? { id: tableId, tenantId: tenantId! }
      : await createTestTable(tenantId ? { tenantId } : undefined);
    tableId = table.id;
    tenantId = tenantId ?? table.tenantId;

    if (!recordViewConfigId) {
      const config = await createTestRecordViewConfig({
        tenantId,
        tableId,
      });
      recordViewConfigId = config.id;
    }
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewPortal = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    tableId,
    recordViewConfigId,
    name: 'Test Portal',
    slug: `test-portal-${suffix}`,
    authType: 'magic_link',
    status: 'draft',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(portals).values(values).returning());
}

/**
 * Creates a portal access row with sensible defaults.
 * Auto-creates a portal (and therefore table, record view config, tenant) when portalId is not provided.
 * Generates a record_slug when not provided.
 */
export async function createTestPortalAccess(
  overrides?: Partial<NewPortalAccess>,
): Promise<PortalAccess> {
  const db = getTestDb();
  const suffix = randomSuffix();

  let tenantId = overrides?.tenantId;
  let portalId = overrides?.portalId;

  if (!portalId) {
    const portal = await createTestPortal(tenantId ? { tenantId } : undefined);
    portalId = portal.id;
    tenantId = tenantId ?? portal.tenantId;
  }

  const values: NewPortalAccess = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    portalId,
    recordId: overrides?.recordId ?? generateUUIDv7(),
    email: `client-${suffix}@example.com`,
    recordSlug: `rec-${suffix}`,
    ...overrides,
  };

  return firstRow(await db.insert(portalAccess).values(values).returning());
}

/**
 * Creates a form with sensible defaults.
 * Auto-creates a table, record view config, and user when not provided.
 */
export async function createTestForm(
  overrides?: Partial<NewForm>,
): Promise<Form> {
  const db = getTestDb();
  const suffix = randomSuffix();

  let tenantId = overrides?.tenantId;
  let tableId = overrides?.tableId;
  let recordViewConfigId = overrides?.recordViewConfigId;

  if (!tableId || !recordViewConfigId) {
    const table = tableId
      ? { id: tableId, tenantId: tenantId! }
      : await createTestTable(tenantId ? { tenantId } : undefined);
    tableId = table.id;
    tenantId = tenantId ?? table.tenantId;

    if (!recordViewConfigId) {
      const config = await createTestRecordViewConfig({
        tenantId,
        tableId,
      });
      recordViewConfigId = config.id;
    }
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewForm = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    tableId,
    recordViewConfigId,
    name: 'Test Form',
    slug: `test-form-${suffix}`,
    status: 'draft',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(forms).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 7 — Automations
// ---------------------------------------------------------------------------

/**
 * Creates an automation with sensible defaults.
 * Auto-creates a workspace (and therefore tenant) when workspaceId is not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestAutomation(
  overrides?: Partial<NewAutomation>,
): Promise<Automation> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let workspaceId = overrides?.workspaceId;

  if (!workspaceId) {
    const workspace = await createTestWorkspace(tenantId ? { tenantId } : undefined);
    workspaceId = workspace.id;
    tenantId = tenantId ?? workspace.tenantId;
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;
  const tableId = generateUUIDv7();

  const values: NewAutomation = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    workspaceId,
    name: 'Test Automation',
    trigger: { type: 'record_created', tableId },
    steps: [],
    status: 'draft',
    environment: 'live',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(automations).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 8 — Document Templates
// ---------------------------------------------------------------------------

/**
 * Creates a document template with sensible defaults.
 * Auto-creates a table (and therefore workspace and tenant) when tableId is not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestDocumentTemplate(
  overrides?: Partial<NewDocumentTemplate>,
): Promise<DocumentTemplate> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let tableId = overrides?.tableId;

  if (!tableId) {
    const table = await createTestTable(tenantId ? { tenantId } : undefined);
    tableId = table.id;
    tenantId = tenantId ?? table.tenantId;
  }

  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewDocumentTemplate = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    tableId,
    name: 'Test Template',
    content: { body: '<p>Hello {{Name}}</p>' },
    environment: 'live',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(documentTemplates).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 9 — Threads
// ---------------------------------------------------------------------------

/**
 * Creates a thread with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 * Uses a generated UUID for scopeId when not provided.
 * Auto-creates a user when createdBy is not provided.
 */
export async function createTestThread(
  overrides?: Partial<NewThread>,
): Promise<Thread> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewThread = {
    id: generateUUIDv7(),
    tenantId,
    scopeType: 'record',
    scopeId: generateUUIDv7(),
    threadType: 'internal',
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(threads).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 10 — API Keys
// ---------------------------------------------------------------------------

export interface TestApiKeyResult {
  apiKey: ApiKey;
  rawKey: string;
}

/**
 * Creates an API key with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 * Auto-creates a user when createdBy is not provided.
 * Returns both the inserted row and the raw key value so tests can use it for auth.
 */
export async function createTestApiKey(
  overrides?: Partial<NewApiKey>,
): Promise<TestApiKeyResult> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const rawKey = `esk_test_${randomBytes(24).toString('hex')}`;
  const keyHash = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.substring(0, 16);

  const values: NewApiKey = {
    id: generateUUIDv7(),
    tenantId,
    name: 'Test API Key',
    keyHash,
    keyPrefix,
    scopes: ['data:read'],
    rateLimitTier: 'standard',
    status: 'active',
    createdBy,
    ...overrides,
  };

  const apiKey = firstRow(await db.insert(apiKeys).values(values).returning());
  return { apiKey, rawKey };
}
