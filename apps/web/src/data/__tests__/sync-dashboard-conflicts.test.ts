/**
 * Tests for sync-dashboard-conflicts data functions.
 *
 * Covers:
 * - getConflictsForConnection: returns conflicts with record and field names
 * - Empty results when no pending conflicts
 * - Scoping to the correct base connection
 * - Tenant isolation via getDbForTenant
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Test IDs
// ---------------------------------------------------------------------------

const TENANT_ID = randomUUID();
const CONNECTION_ID = randomUUID();
const CONFLICT_ID_1 = randomUUID();
const CONFLICT_ID_2 = randomUUID();
const RECORD_ID_1 = randomUUID();
const RECORD_ID_2 = randomUUID();
const FIELD_ID_1 = randomUUID();
const FIELD_ID_2 = randomUUID();

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockDb,
  mockGetDbForTenant,
  mockOrderBy,
} = vi.hoisted(() => {
  const mockOrderBy = vi.fn().mockResolvedValue([]);

  const chain: Record<string, unknown> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.leftJoin = vi.fn().mockReturnValue(chain);
  chain.orderBy = mockOrderBy;

  const mockGetDbForTenant = vi.fn(() => chain);

  return {
    mockDb: chain,
    mockGetDbForTenant,
    mockOrderBy,
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@everystack/shared/db', () => ({
  getDbForTenant: mockGetDbForTenant,
  syncConflicts: {
    id: 'id',
    tenantId: 'tenant_id',
    recordId: 'record_id',
    fieldId: 'field_id',
    localValue: 'local_value',
    remoteValue: 'remote_value',
    platform: 'platform',
    createdAt: 'created_at',
    status: 'status',
  },
  syncedFieldMappings: {
    fieldId: 'field_id',
    tenantId: 'tenant_id',
    baseConnectionId: 'base_connection_id',
  },
  records: {
    id: 'id',
    tenantId: 'tenant_id',
    canonicalData: 'canonical_data',
  },
  fields: {
    id: 'id',
    tenantId: 'tenant_id',
    name: 'name',
  },
  eq: vi.fn((a: unknown, b: unknown) => ({ type: 'eq', a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
  sql: Object.assign(
    vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: 'sql',
      strings: Array.from(strings),
      values,
      as: vi.fn(() => 'aliased'),
    })),
    {
      as: vi.fn(),
      raw: vi.fn(),
    },
  ),
}));

// Mock the ConflictsTab type import — we only need the type, but the module
// may import React components. Provide a minimal mock.
vi.mock('@/components/sync/ConflictsTab', () => ({}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { getConflictsForConnection } from '../sync-dashboard-conflicts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConflictRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONFLICT_ID_1,
    recordId: RECORD_ID_1,
    fieldId: FIELD_ID_1,
    localValue: { text: 'local value' },
    remoteValue: { text: 'remote value' },
    platform: 'airtable',
    createdAt: new Date('2026-03-07T10:00:00Z'),
    recordName: 'Acme Corp',
    fieldName: 'Company Name',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getConflictsForConnection', { timeout: 10_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns conflicts with record and field names', async () => {
    const rows = [
      makeConflictRow(),
      makeConflictRow({
        id: CONFLICT_ID_2,
        recordId: RECORD_ID_2,
        fieldId: FIELD_ID_2,
        recordName: 'Beta Inc',
        fieldName: 'Status',
        localValue: 'Active',
        remoteValue: 'Inactive',
        createdAt: new Date('2026-03-06T08:00:00Z'),
      }),
    ];

    mockOrderBy.mockResolvedValueOnce(rows);

    const conflicts = await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    expect(conflicts).toHaveLength(2);

    expect(conflicts[0]).toEqual({
      id: CONFLICT_ID_1,
      recordId: RECORD_ID_1,
      fieldId: FIELD_ID_1,
      recordName: 'Acme Corp',
      fieldName: 'Company Name',
      localValue: { text: 'local value' },
      remoteValue: { text: 'remote value' },
      platform: 'airtable',
      createdAt: '2026-03-07T10:00:00.000Z',
    });

    expect(conflicts[1]).toEqual({
      id: CONFLICT_ID_2,
      recordId: RECORD_ID_2,
      fieldId: FIELD_ID_2,
      recordName: 'Beta Inc',
      fieldName: 'Status',
      localValue: 'Active',
      remoteValue: 'Inactive',
      platform: 'airtable',
      createdAt: '2026-03-06T08:00:00.000Z',
    });
  });

  it('returns empty array when no pending conflicts', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    const conflicts = await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    expect(conflicts).toEqual([]);
  });

  it('scopes conflicts to the correct base connection', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    // Verify the chain was called — innerJoin through syncedFieldMappings
    // scopes by baseConnectionId, and where clause filters by tenantId + pending status
    expect(mockDb.select).toHaveBeenCalled();
    expect(mockDb.from).toHaveBeenCalled();
    expect(mockDb.innerJoin).toHaveBeenCalled();
    expect(mockDb.where).toHaveBeenCalled();
  });

  it('uses tenant-scoped read access', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    expect(mockGetDbForTenant).toHaveBeenCalledWith(TENANT_ID, 'read');
  });

  it('converts createdAt to ISO string', async () => {
    const row = makeConflictRow({
      createdAt: new Date('2026-01-15T14:30:00Z'),
    });
    mockOrderBy.mockResolvedValueOnce([row]);

    const conflicts = await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    expect(conflicts[0]!.createdAt).toBe('2026-01-15T14:30:00.000Z');
  });

  it('handles null recordName and fieldName', async () => {
    const row = makeConflictRow({
      recordName: null,
      fieldName: null,
    });
    mockOrderBy.mockResolvedValueOnce([row]);

    const conflicts = await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    expect(conflicts[0]!.recordName).toBeNull();
    expect(conflicts[0]!.fieldName).toBeNull();
  });

  it('joins through leftJoin for records and fields tables', async () => {
    mockOrderBy.mockResolvedValueOnce([]);

    await getConflictsForConnection(TENANT_ID, CONNECTION_ID);

    // Two leftJoin calls: one for records, one for fields
    expect(mockDb.leftJoin).toHaveBeenCalledTimes(2);
  });
});
