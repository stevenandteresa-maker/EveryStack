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
  createTestTable,
  createTestField,
  createTestBase,
  createTestView,
  createTestCrossLink,
  createTestPortal,
  createTestForm,
  createTestAutomation,
  createTestDocumentTemplate,
  createTestThread,
  createTestApiKey,
  createTestRecordViewConfig,
  createTestTenantRelationship,
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

// ---------------------------------------------------------------------------
// New factories — Prompt 4
// ---------------------------------------------------------------------------

describe('createTestTable', () => {
  it('auto-creates a workspace and tenant when not provided', async () => {
    const table = await createTestTable();
    expect(isValidUUID(table.id)).toBe(true);
    expect(isValidUUID(table.tenantId)).toBe(true);
    expect(isValidUUID(table.workspaceId)).toBe(true);
    expect(table.name).toBe('Test Table');
    expect(table.tableType).toBe('table');
    expect(table.environment).toBe('live');
    // Inserts: tenant, user (for workspace.createdBy), workspace, user (for table.createdBy), table
    expect(mockDb.insert).toHaveBeenCalledTimes(5);
  });

  it('uses provided workspaceId without auto-creating', async () => {
    const workspaceId = '01900000-0000-7000-8000-000000000010';
    const tenantId = '01900000-0000-7000-8000-000000000011';
    const createdBy = '01900000-0000-7000-8000-000000000012';
    const table = await createTestTable({ workspaceId, tenantId, createdBy });
    expect(table.workspaceId).toBe(workspaceId);
    expect(table.tenantId).toBe(tenantId);
    // Only 1 insert: the table itself
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('defaults environment to live', async () => {
    const table = await createTestTable();
    expect(table.environment).toBe('live');
  });
});

describe('createTestField', () => {
  it('auto-creates a table, workspace, and tenant when not provided', async () => {
    const field = await createTestField();
    expect(isValidUUID(field.id)).toBe(true);
    expect(isValidUUID(field.tenantId)).toBe(true);
    expect(isValidUUID(field.tableId)).toBe(true);
    expect(field.name).toBe('Test Field');
    expect(field.fieldType).toBe('text');
    expect(field.environment).toBe('live');
    // Inserts: tenant, user (workspace.createdBy), workspace, user (table.createdBy), table, field
    expect(mockDb.insert).toHaveBeenCalledTimes(6);
  });

  it('uses provided tableId without auto-creating', async () => {
    const tableId = '01900000-0000-7000-8000-000000000020';
    const tenantId = '01900000-0000-7000-8000-000000000021';
    const field = await createTestField({ tableId, tenantId });
    expect(field.tableId).toBe(tableId);
    // Only 1 insert: the field itself
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('defaults environment to live', async () => {
    const field = await createTestField();
    expect(field.environment).toBe('live');
  });
});

describe('createTestBase', () => {
  it('auto-creates a tenant when not provided', async () => {
    const base = await createTestBase();
    expect(isValidUUID(base.id)).toBe(true);
    expect(base.platform).toBe('airtable');
    expect(base.syncDirection).toBe('bidirectional');
    expect(base.conflictResolution).toBe('last_write_wins');
    expect(base.syncStatus).toBe('active');
    // Inserts: tenant, user (createdBy), base_connection
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });

  it('uses provided tenantId without auto-creating', async () => {
    const tenantId = '01900000-0000-7000-8000-000000000030';
    const createdBy = '01900000-0000-7000-8000-000000000031';
    const base = await createTestBase({ tenantId, createdBy });
    expect(base.tenantId).toBe(tenantId);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });
});

describe('createTestView', () => {
  it('auto-creates a table when not provided', async () => {
    const view = await createTestView();
    expect(isValidUUID(view.id)).toBe(true);
    expect(view.name).toBe('Default Grid');
    expect(view.viewType).toBe('grid');
    expect(view.environment).toBe('live');
  });

  it('defaults environment to live', async () => {
    const view = await createTestView();
    expect(view.environment).toBe('live');
  });
});

describe('createTestCrossLink', () => {
  it('creates source and target tables with fields when not provided', async () => {
    const crossLink = await createTestCrossLink();
    expect(isValidUUID(crossLink.id)).toBe(true);
    expect(isValidUUID(crossLink.sourceTableId)).toBe(true);
    expect(isValidUUID(crossLink.targetTableId)).toBe(true);
    expect(isValidUUID(crossLink.sourceFieldId)).toBe(true);
    expect(isValidUUID(crossLink.targetDisplayFieldId)).toBe(true);
    expect(crossLink.relationshipType).toBe('many_to_one');
    expect(crossLink.environment).toBe('live');
    // Source and target tables should be different
    expect(crossLink.sourceTableId).not.toBe(crossLink.targetTableId);
    // Both should share the same tenant
    expect(crossLink.tenantId).toBeTruthy();
  });
});

describe('createTestRecordViewConfig', () => {
  it('auto-creates a table when not provided', async () => {
    const config = await createTestRecordViewConfig();
    expect(isValidUUID(config.id)).toBe(true);
    expect(config.name).toBe('Default Record View');
  });
});

describe('createTestPortal', () => {
  it('auto-creates dependencies when not provided', async () => {
    const portal = await createTestPortal();
    expect(isValidUUID(portal.id)).toBe(true);
    expect(portal.name).toBe('Test Portal');
    expect(portal.authType).toBe('magic_link');
    expect(portal.status).toBe('draft');
    expect(portal.slug).toMatch(/^test-portal-\w+$/);
  });
});

describe('createTestForm', () => {
  it('auto-creates dependencies when not provided', async () => {
    const form = await createTestForm();
    expect(isValidUUID(form.id)).toBe(true);
    expect(form.name).toBe('Test Form');
    expect(form.status).toBe('draft');
    expect(form.slug).toMatch(/^test-form-\w+$/);
  });
});

describe('createTestAutomation', () => {
  it('auto-creates a workspace when not provided', async () => {
    const automation = await createTestAutomation();
    expect(isValidUUID(automation.id)).toBe(true);
    expect(automation.name).toBe('Test Automation');
    expect(automation.status).toBe('draft');
    expect(automation.environment).toBe('live');
    expect(automation.trigger).toHaveProperty('type', 'record_created');
    expect(automation.steps).toEqual([]);
  });

  it('defaults environment to live', async () => {
    const automation = await createTestAutomation();
    expect(automation.environment).toBe('live');
  });
});

describe('createTestDocumentTemplate', () => {
  it('auto-creates a table when not provided', async () => {
    const template = await createTestDocumentTemplate();
    expect(isValidUUID(template.id)).toBe(true);
    expect(template.name).toBe('Test Template');
    expect(template.content).toEqual({ body: '<p>Hello {{Name}}</p>' });
    expect(template.environment).toBe('live');
  });

  it('defaults environment to live', async () => {
    const template = await createTestDocumentTemplate();
    expect(template.environment).toBe('live');
  });
});

describe('createTestThread', () => {
  it('auto-creates a tenant when not provided', async () => {
    const thread = await createTestThread();
    expect(isValidUUID(thread.id)).toBe(true);
    expect(thread.scopeType).toBe('record');
    expect(isValidUUID(thread.scopeId)).toBe(true);
  });
});

describe('createTestApiKey', () => {
  it('auto-creates a tenant when not provided', async () => {
    const result = await createTestApiKey();
    expect(isValidUUID(result.apiKey.id)).toBe(true);
    expect(result.apiKey.name).toBe('Test API Key');
    expect(result.apiKey.status).toBe('active');
    expect(result.apiKey.scopes).toEqual(['data:read']);
    expect(result.apiKey.rateLimitTier).toBe('standard');
  });

  it('returns both the inserted row and the raw key value', async () => {
    const result = await createTestApiKey();
    // Raw key starts with the prefix
    expect(result.rawKey).toMatch(/^esk_test_/);
    // Key prefix matches the first 16 chars
    expect(result.apiKey.keyPrefix).toBe(result.rawKey.substring(0, 16));
    // Key hash is a 64-char hex string (SHA-256)
    expect(result.apiKey.keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different keys for successive calls', async () => {
    const a = await createTestApiKey();
    const b = await createTestApiKey();
    expect(a.rawKey).not.toBe(b.rawKey);
    expect(a.apiKey.keyHash).not.toBe(b.apiKey.keyHash);
  });
});

// ---------------------------------------------------------------------------
// CP-002 — Tenant Relationships
// ---------------------------------------------------------------------------

describe('createTestTenantRelationship', () => {
  it('auto-creates agency and client tenants when not provided', async () => {
    const rel = await createTestTenantRelationship();
    expect(isValidUUID(rel.id)).toBe(true);
    expect(isValidUUID(rel.agencyTenantId)).toBe(true);
    expect(isValidUUID(rel.clientTenantId)).toBe(true);
    expect(rel.agencyTenantId).not.toBe(rel.clientTenantId);
    expect(rel.relationshipType).toBe('managed');
    expect(rel.status).toBe('active');
    expect(rel.accessLevel).toBe('builder');
    expect(rel.initiatedBy).toBe('agency');
    // 4 inserts: agency tenant, client tenant, user (authorizedBy), relationship
    expect(mockDb.insert).toHaveBeenCalledTimes(4);
  });

  it('uses provided tenant IDs without auto-creating', async () => {
    const agencyTenantId = '01900000-0000-7000-8000-000000000040';
    const clientTenantId = '01900000-0000-7000-8000-000000000041';
    const authorizedByUserId = '01900000-0000-7000-8000-000000000042';
    const rel = await createTestTenantRelationship({
      agencyTenantId,
      clientTenantId,
      authorizedByUserId,
    });
    expect(rel.agencyTenantId).toBe(agencyTenantId);
    expect(rel.clientTenantId).toBe(clientTenantId);
    expect(rel.authorizedByUserId).toBe(authorizedByUserId);
    // Only 1 insert: the relationship itself
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('applies overrides', async () => {
    const rel = await createTestTenantRelationship({
      relationshipType: 'white_label',
      status: 'pending',
      accessLevel: 'admin',
      initiatedBy: 'client',
      metadata: { contract_ref: 'C-123', hide_member_identity: true },
    });
    expect(rel.relationshipType).toBe('white_label');
    expect(rel.status).toBe('pending');
    expect(rel.accessLevel).toBe('admin');
    expect(rel.initiatedBy).toBe('client');
    expect(rel.metadata).toEqual({ contract_ref: 'C-123', hide_member_identity: true });
  });
});
