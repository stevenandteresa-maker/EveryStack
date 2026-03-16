/**
 * Test Data Factories
 *
 * Provides factory functions for creating test data with sensible defaults.
 * Each factory inserts into the real database and returns the created row.
 * Auto-parent creation: when a required FK is not provided, the factory
 * calls the parent factory to create it.
 */

import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
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
  syncedFieldMappings,
  views,
  crossLinks,
  crossLinkIndex,
  portals,
  portalAccess,
  forms,
  automations,
  documentTemplates,
  generatedDocuments,
  threads,
  apiKeys,
  recordViewConfigs,
  tenantRelationships,
  tenantMemberships,
  boards,
  workspaceMemberships,
  syncConflicts,
  sections,
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
  NewSyncedFieldMapping,
  SyncedFieldMapping,
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
  NewGeneratedDocument,
  GeneratedDocument,
  NewThread,
  Thread,
  NewApiKey,
  ApiKey,
  NewRecordViewConfig,
  RecordViewConfig,
  NewTenantRelationship,
  TenantRelationship,
  NewTenantMembership,
  TenantMembership,
  NewBoard,
  Board,
  NewWorkspaceMembership,
  WorkspaceMembership,
  NewSyncConflict,
  SyncConflict,
  NewSection,
  Section,
  CrossLinkIndex,
} from '../db/schema';
import type { CrossLinkFieldValue, LinkedRecordEntry } from '../sync/cross-link-types';

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
 * Creates a tenant membership with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 * Auto-creates a user when userId is not provided.
 * Defaults: role 'member', status 'active'.
 */
export async function createTestTenantMembership(
  overrides?: Partial<NewTenantMembership>,
): Promise<TenantMembership> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const userId = overrides?.userId ?? (await createTestUser()).id;

  const values: NewTenantMembership = {
    id: generateUUIDv7(),
    tenantId,
    userId,
    role: 'member',
    status: 'active',
    ...overrides,
  };

  return firstRow(await db.insert(tenantMemberships).values(values).returning());
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

/**
 * Creates a synced field mapping with sensible defaults.
 * Auto-creates dependent entities when not provided.
 */
export async function createTestSyncedFieldMapping(
  overrides?: Partial<NewSyncedFieldMapping>,
): Promise<SyncedFieldMapping> {
  const db = getTestDb();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const baseConnectionId = overrides?.baseConnectionId ?? (await createTestBase({ tenantId })).id;
  const tableId = overrides?.tableId ?? (await createTestTable({ tenantId })).id;
  const fieldId = overrides?.fieldId ?? (await createTestField({ tenantId, tableId })).id;

  const values: NewSyncedFieldMapping = {
    id: generateUUIDv7(),
    tenantId,
    baseConnectionId,
    tableId,
    fieldId,
    externalFieldId: `ext_${randomSuffix()}`,
    externalFieldType: 'singleLineText',
    status: 'active',
    ...overrides,
  };

  return firstRow(await db.insert(syncedFieldMappings).values(values).returning());
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

/**
 * Creates a generated document with sensible defaults.
 * Auto-creates a document template (and therefore table, workspace, tenant)
 * when templateId is not provided. Auto-creates a user for generatedBy.
 */
export async function createTestGeneratedDocument(
  overrides?: Partial<NewGeneratedDocument>,
): Promise<GeneratedDocument> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let templateId = overrides?.templateId;

  if (!templateId) {
    const template = await createTestDocumentTemplate(
      tenantId ? { tenantId } : undefined,
    );
    templateId = template.id;
    tenantId = tenantId ?? template.tenantId;
  }

  const generatedBy = overrides?.generatedBy ?? (await createTestUser()).id;
  const sourceRecordId = overrides?.sourceRecordId ?? generateUUIDv7();

  const values: NewGeneratedDocument = {
    id: generateUUIDv7(),
    tenantId: tenantId!,
    templateId,
    sourceRecordId,
    fileUrl: `https://r2.example.com/docs/${generateUUIDv7()}.pdf`,
    fileType: 'pdf',
    generatedBy,
    ...overrides,
  };

  return firstRow(await db.insert(generatedDocuments).values(values).returning());
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

// ---------------------------------------------------------------------------
// Tier 11 — Tenant Relationships (CP-002)
// ---------------------------------------------------------------------------

/**
 * Creates a tenant relationship with sensible defaults.
 * Auto-creates agency and client tenants when not provided.
 * Auto-creates a user when authorizedByUserId is not provided.
 * Default: status 'active', access_level 'builder', relationship_type 'managed'.
 */
export async function createTestTenantRelationship(
  overrides?: Partial<NewTenantRelationship>,
): Promise<TenantRelationship> {
  const db = getTestDb();

  const agencyTenantId = overrides?.agencyTenantId ?? (await createTestTenant({ name: 'Agency Tenant' })).id;
  const clientTenantId = overrides?.clientTenantId ?? (await createTestTenant({ name: 'Client Tenant' })).id;
  const authorizedByUserId = overrides?.authorizedByUserId ?? (await createTestUser()).id;

  const values: NewTenantRelationship = {
    id: generateUUIDv7(),
    agencyTenantId,
    clientTenantId,
    relationshipType: 'managed',
    status: 'active',
    accessLevel: 'builder',
    initiatedBy: 'agency',
    authorizedByUserId,
    metadata: {},
    ...overrides,
  };

  return firstRow(await db.insert(tenantRelationships).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 12 — Boards (CP-Prompt 8)
// ---------------------------------------------------------------------------

/**
 * Creates a board with sensible defaults.
 * Auto-creates a tenant when tenantId is not provided.
 */
export async function createTestBoard(
  overrides?: Partial<NewBoard>,
): Promise<Board> {
  const db = getTestDb();
  const suffix = randomSuffix();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;

  const values: NewBoard = {
    id: generateUUIDv7(),
    tenantId,
    name: `Test Board ${suffix}`,
    ...overrides,
  };

  return firstRow(await db.insert(boards).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 13 — Workspace Memberships (CP-Prompt 8)
// ---------------------------------------------------------------------------

/**
 * Creates a workspace membership with sensible defaults.
 * Auto-creates a workspace (and therefore tenant) when workspaceId is not provided.
 * Auto-creates a user when userId is not provided.
 * Defaults: role 'manager'.
 */
export async function createTestWorkspaceMembership(
  overrides?: Partial<NewWorkspaceMembership>,
): Promise<WorkspaceMembership> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let workspaceId = overrides?.workspaceId;

  if (!workspaceId) {
    const workspace = await createTestWorkspace(tenantId ? { tenantId } : undefined);
    workspaceId = workspace.id;
    tenantId = tenantId ?? workspace.tenantId;
  }

  const userId = overrides?.userId ?? (await createTestUser()).id;

  const values: NewWorkspaceMembership = {
    id: generateUUIDv7(),
    userId,
    tenantId: tenantId!,
    workspaceId,
    role: 'manager',
    ...overrides,
  };

  return firstRow(await db.insert(workspaceMemberships).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 14 — Sync Conflicts (Phase 2B)
// ---------------------------------------------------------------------------

/**
 * Creates a sync conflict with sensible defaults.
 * Auto-creates a tenant, field (and table chain) when not provided.
 * Default: status 'pending', platform 'airtable'.
 */
export async function createTestSyncConflict(
  overrides?: Partial<NewSyncConflict>,
): Promise<SyncConflict> {
  const db = getTestDb();

  let tenantId = overrides?.tenantId;
  let fieldId = overrides?.fieldId;

  if (!fieldId) {
    const field = await createTestField(tenantId ? { tenantId } : undefined);
    fieldId = field.id;
    tenantId = tenantId ?? field.tenantId;
  }

  const recordId = overrides?.recordId ?? generateUUIDv7();

  const values: NewSyncConflict = {
    id: generateUUIDv7(),
    tenantId: tenantId ?? (await createTestTenant()).id,
    recordId,
    fieldId,
    localValue: 'local value',
    remoteValue: 'remote value',
    baseValue: 'base value',
    platform: 'airtable',
    status: 'pending',
    ...overrides,
  };

  return firstRow(await db.insert(syncConflicts).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 15 — Sections (Phase 3A-ii Prompt 12)
// ---------------------------------------------------------------------------

/**
 * Creates a section with sensible defaults.
 * Auto-creates a tenant and user when not provided.
 * Default: context 'view_switcher', shared scope (userId = null).
 */
export async function createTestSection(
  overrides?: Partial<NewSection>,
): Promise<Section> {
  const db = getTestDb();
  const suffix = randomSuffix();

  const tenantId = overrides?.tenantId ?? (await createTestTenant()).id;
  const createdBy = overrides?.createdBy ?? (await createTestUser()).id;

  const values: NewSection = {
    id: generateUUIDv7(),
    tenantId,
    userId: overrides?.userId ?? null,
    context: 'view_switcher',
    contextParentId: overrides?.contextParentId ?? null,
    name: `Test Section ${suffix}`,
    sortOrder: 0,
    collapsed: false,
    createdBy,
    ...overrides,
  };

  return firstRow(await db.insert(sections).values(values).returning());
}

// ---------------------------------------------------------------------------
// Tier 16 — View with Permissions (Phase 3A-iii Prompt 4)
// ---------------------------------------------------------------------------

export interface TestViewWithPermissionsResult {
  view: View;
  table: Table;
  fields: Field[];
}

/**
 * Creates a view with field-level permissions pre-configured.
 * Accepts optional ViewPermissions shape (roleRestrictions, individualOverrides).
 * Defaults to a view with no restrictions (empty arrays).
 * Auto-creates parent table and fields if not provided.
 *
 * @param options.tenantId - Use an existing tenant
 * @param options.tableId - Use an existing table (must belong to tenantId)
 * @param options.fieldCount - Number of fields to create (default: 3)
 * @param options.fieldOverrides - Partial<NewField>[] for specific field configs
 * @param options.permissions - ViewPermissions JSONB shape (defaults to empty)
 * @param options.viewOverrides - Additional overrides for the view itself
 */
export async function createTestViewWithPermissions(
  options?: {
    tenantId?: string;
    tableId?: string;
    fieldCount?: number;
    fieldOverrides?: Array<Partial<NewField>>;
    permissions?: {
      roles?: Array<'team_member' | 'viewer'>;
      specificUsers?: string[];
      excludedUsers?: string[];
      fieldPermissions?: {
        roleRestrictions?: Array<{
          tableId: string;
          role: 'team_member' | 'viewer' | 'manager';
          fieldId: string;
          accessState: 'read_write' | 'read_only' | 'hidden';
        }>;
        individualOverrides?: Array<{
          tableId: string;
          userId: string;
          fieldId: string;
          accessState: 'read_write' | 'read_only' | 'hidden';
        }>;
      };
    };
    viewOverrides?: Partial<NewView>;
  },
): Promise<TestViewWithPermissionsResult> {
  const fieldCount = options?.fieldCount ?? 3;

  // Create table (or reuse provided tableId + tenantId)
  let tableId = options?.tableId;
  let resolvedTenantId = options?.tenantId;

  if (!tableId) {
    const table = await createTestTable(resolvedTenantId ? { tenantId: resolvedTenantId } : undefined);
    tableId = table.id;
    resolvedTenantId = table.tenantId;
  }

  if (!resolvedTenantId) {
    throw new Error('createTestViewWithPermissions: tenantId is required when tableId is provided');
  }

  // Create fields
  const createdFields: Field[] = [];
  for (let i = 0; i < fieldCount; i++) {
    const fieldOverride = options?.fieldOverrides?.[i] ?? {};
    const field = await createTestField({
      tenantId: resolvedTenantId,
      tableId,
      name: `Field ${i + 1}`,
      sortOrder: i,
      ...fieldOverride,
    });
    createdFields.push(field);
  }

  // Build permissions JSONB with defaults
  const permissionsPayload = {
    roles: options?.permissions?.roles ?? [],
    specificUsers: options?.permissions?.specificUsers ?? [],
    excludedUsers: options?.permissions?.excludedUsers ?? [],
    fieldPermissions: {
      roleRestrictions: options?.permissions?.fieldPermissions?.roleRestrictions ?? [],
      individualOverrides: options?.permissions?.fieldPermissions?.individualOverrides ?? [],
    },
  };

  // Build view config with all fields visible
  const columns = createdFields.map((f) => ({
    fieldId: f.id,
    visible: true,
  }));

  const view = await createTestView({
    tenantId: resolvedTenantId,
    tableId,
    config: { columns },
    permissions: permissionsPayload,
    ...options?.viewOverrides,
  });

  // Retrieve the table row for the return value
  const db = getTestDb();
  const [tableRow] = await db.select().from(tables).where(
    eq(tables.id, tableId),
  );

  return { view, table: tableRow!, fields: createdFields };
}

// ---------------------------------------------------------------------------
// Tier 17 — Cross-Link with Index (Phase 3B-i Prompt 6)
// ---------------------------------------------------------------------------

export interface TestCrossLinkWithIndexResult {
  crossLink: CrossLink;
  sourceTable: Table;
  targetTable: Table;
  sourceField: Field;
  targetDisplayField: Field;
  sourceRecords: DbRecord[];
  targetRecords: DbRecord[];
  indexEntries: CrossLinkIndex[];
}

/**
 * Creates a complete cross-link test fixture: definition + source/target
 * records + index entries + canonical field values on source records.
 *
 * Uses existing `createTestCrossLink` and `createTestRecord` factories.
 *
 * @param options.tenantId - Use an existing tenant
 * @param options.crossLinkOverrides - Overrides for the cross-link definition
 * @param options.sourceRecordCount - Number of source records (default: 2)
 * @param options.targetRecordCount - Number of target records (default: 3)
 * @param options.linksPerSourceRecord - Target records to link per source (default: all targets)
 */
export async function createTestCrossLinkWithIndex(
  options?: {
    tenantId?: string;
    crossLinkOverrides?: Partial<NewCrossLink>;
    sourceRecordCount?: number;
    targetRecordCount?: number;
    linksPerSourceRecord?: number;
  },
): Promise<TestCrossLinkWithIndexResult> {
  const db = getTestDb();

  const tenantId = options?.tenantId ?? (await createTestTenant()).id;
  const sourceRecordCount = options?.sourceRecordCount ?? 2;
  const targetRecordCount = options?.targetRecordCount ?? 3;

  // Create source table + field
  const sourceTable = await createTestTable({ tenantId });
  const sourceField = await createTestField({
    tenantId,
    tableId: sourceTable.id,
    name: 'Link Field',
    fieldType: 'cross_link',
  });

  // Create target table + display field
  const targetTable = await createTestTable({ tenantId });
  const targetDisplayField = await createTestField({
    tenantId,
    tableId: targetTable.id,
    name: 'Display Name',
    fieldType: 'text',
    isPrimary: true,
  });

  // Create cross-link definition
  const crossLink = await createTestCrossLink({
    tenantId,
    sourceTableId: sourceTable.id,
    sourceFieldId: sourceField.id,
    targetTableId: targetTable.id,
    targetDisplayFieldId: targetDisplayField.id,
    ...options?.crossLinkOverrides,
  });

  // Create target records with display values
  const targetRecords: DbRecord[] = [];
  for (let i = 0; i < targetRecordCount; i++) {
    const record = await createTestRecord({
      tenantId,
      tableId: targetTable.id,
      canonicalData: { [targetDisplayField.id]: `Target ${i + 1}` },
    });
    targetRecords.push(record);
  }

  // Determine how many targets each source links to
  const linksPerSource = options?.linksPerSourceRecord ?? targetRecordCount;
  const targetsToLink = targetRecords.slice(0, linksPerSource);

  // Create source records, index entries, and canonical field values
  const sourceRecords: DbRecord[] = [];
  const allIndexEntries: CrossLinkIndex[] = [];
  const now = new Date().toISOString();

  for (let i = 0; i < sourceRecordCount; i++) {
    // Build linked record entries for canonical data
    const linkedRecords: LinkedRecordEntry[] = targetsToLink.map((t) => ({
      record_id: t.id,
      table_id: targetTable.id,
      display_value: String(
        (t.canonicalData as Record<string, unknown>)[targetDisplayField.id] ?? '',
      ),
      _display_updated_at: now,
    }));

    const canonicalData: Record<string, unknown> = {
      [sourceField.id]: {
        type: 'cross_link',
        value: {
          linked_records: linkedRecords,
          cross_link_id: crossLink.id,
        },
      } satisfies CrossLinkFieldValue,
    };

    const sourceRecord = await createTestRecord({
      tenantId,
      tableId: sourceTable.id,
      canonicalData,
    });
    sourceRecords.push(sourceRecord);

    // Insert index entries
    const entries = targetsToLink.map((t) => ({
      tenantId,
      crossLinkId: crossLink.id,
      sourceRecordId: sourceRecord.id,
      sourceTableId: sourceTable.id,
      targetRecordId: t.id,
    }));

    const inserted = await db.insert(crossLinkIndex).values(entries).returning();
    allIndexEntries.push(...inserted);
  }

  return {
    crossLink,
    sourceTable,
    targetTable,
    sourceField,
    targetDisplayField,
    sourceRecords,
    targetRecords,
    indexEntries: allIndexEntries,
  };
}
