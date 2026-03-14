import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeSchemaVersionHash } from '../schema-hash';

// ---------------------------------------------------------------------------
// Mock DB
// ---------------------------------------------------------------------------

const TENANT_ID = 'tenant-001';
const WORKSPACE_ID = 'ws-001';

type MockRow = Record<string, unknown>;

/**
 * Creates a mock DrizzleClient that returns results in query order:
 * 1st select = tables, 2nd = fields, 3rd = cross-links.
 */
function createMockDb(options: {
  tables: MockRow[];
  fields: MockRow[];
  crossLinks: MockRow[];
}) {
  let selectCallCount = 0;

  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => {
          const chainable = {
            orderBy: vi.fn(() => {
              selectCallCount++;
              if (selectCallCount === 1) return Promise.resolve(options.tables);
              if (selectCallCount === 2) return Promise.resolve(options.fields);
              if (selectCallCount === 3) return Promise.resolve(options.crossLinks);
              return Promise.resolve([]);
            }),
          };
          return chainable;
        }),
      })),
    })),
  };

  return mockDb as unknown as Parameters<typeof computeSchemaVersionHash>[2];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeSchemaVersionHash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Stability — same inputs → same hash
  // -----------------------------------------------------------------------

  it('produces the same hash for identical inputs', async () => {
    const dbConfig = {
      tables: [{ id: 'tbl-001' }, { id: 'tbl-002' }],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} },
        { id: 'fld-002', tableId: 'tbl-001', fieldType: 'number', config: {} },
        { id: 'fld-003', tableId: 'tbl-002', fieldType: 'single_select', config: { options: ['A', 'B'] } },
      ],
      crossLinks: [
        {
          id: 'cl-001',
          sourceTableId: 'tbl-001',
          sourceFieldId: 'fld-link-001',
          targetTableId: 'tbl-002',
          targetDisplayFieldId: 'fld-003',
          relationshipType: 'many_to_one',
        },
      ],
    };

    const db1 = createMockDb(dbConfig);
    const db2 = createMockDb(dbConfig);

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).toBe(hash2);
    // SHA-256 produces 64 hex characters
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  // -----------------------------------------------------------------------
  // Changes propagate — different inputs → different hash
  // -----------------------------------------------------------------------

  it('produces different hash when a field is added', async () => {
    const baseTables = [{ id: 'tbl-001' }];
    const baseFields = [
      { id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} },
    ];

    const db1 = createMockDb({ tables: baseTables, fields: baseFields, crossLinks: [] });

    const db2 = createMockDb({
      tables: baseTables,
      fields: [
        ...baseFields,
        { id: 'fld-002', tableId: 'tbl-001', fieldType: 'number', config: {} },
      ],
      crossLinks: [],
    });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when a field type changes', async () => {
    const baseTables = [{ id: 'tbl-001' }];

    const db1 = createMockDb({
      tables: baseTables,
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} }],
      crossLinks: [],
    });

    const db2 = createMockDb({
      tables: baseTables,
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'number', config: {} }],
      crossLinks: [],
    });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when a table is added', async () => {
    const db1 = createMockDb({
      tables: [{ id: 'tbl-001' }],
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} }],
      crossLinks: [],
    });

    const db2 = createMockDb({
      tables: [{ id: 'tbl-001' }, { id: 'tbl-002' }],
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} }],
      crossLinks: [],
    });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when a table is deleted', async () => {
    const db1 = createMockDb({
      tables: [{ id: 'tbl-001' }, { id: 'tbl-002' }],
      fields: [
        { id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} },
        { id: 'fld-002', tableId: 'tbl-002', fieldType: 'text', config: {} },
      ],
      crossLinks: [],
    });

    const db2 = createMockDb({
      tables: [{ id: 'tbl-001' }],
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} }],
      crossLinks: [],
    });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when a cross-link is added', async () => {
    const baseTables = [{ id: 'tbl-001' }, { id: 'tbl-002' }];
    const baseFields = [
      { id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} },
      { id: 'fld-002', tableId: 'tbl-002', fieldType: 'text', config: {} },
    ];

    const db1 = createMockDb({ tables: baseTables, fields: baseFields, crossLinks: [] });

    const db2 = createMockDb({
      tables: baseTables,
      fields: baseFields,
      crossLinks: [
        {
          id: 'cl-001',
          sourceTableId: 'tbl-001',
          sourceFieldId: 'fld-link',
          targetTableId: 'tbl-002',
          targetDisplayFieldId: 'fld-002',
          relationshipType: 'many_to_one',
        },
      ],
    });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when a cross-link is deleted', async () => {
    const baseTables = [{ id: 'tbl-001' }, { id: 'tbl-002' }];
    const baseFields = [
      { id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} },
      { id: 'fld-002', tableId: 'tbl-002', fieldType: 'text', config: {} },
    ];
    const crossLink = {
      id: 'cl-001',
      sourceTableId: 'tbl-001',
      sourceFieldId: 'fld-link',
      targetTableId: 'tbl-002',
      targetDisplayFieldId: 'fld-002',
      relationshipType: 'many_to_one',
    };

    const db1 = createMockDb({ tables: baseTables, fields: baseFields, crossLinks: [crossLink] });
    const db2 = createMockDb({ tables: baseTables, fields: baseFields, crossLinks: [] });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hash when field config changes', async () => {
    const baseTables = [{ id: 'tbl-001' }];

    const db1 = createMockDb({
      tables: baseTables,
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'single_select', config: { options: ['A', 'B'] } }],
      crossLinks: [],
    });

    const db2 = createMockDb({
      tables: baseTables,
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'single_select', config: { options: ['A', 'B', 'C'] } }],
      crossLinks: [],
    });

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db1);
    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db2);

    expect(hash1).not.toBe(hash2);
  });

  // -----------------------------------------------------------------------
  // Empty workspace
  // -----------------------------------------------------------------------

  it('returns a deterministic hash for empty workspace', async () => {
    // Empty workspace triggers early return — no fields/crossLinks queries
    const emptyDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    } as unknown as Parameters<typeof computeSchemaVersionHash>[2];

    const hash1 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, emptyDb);

    const emptyDb2 = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => Promise.resolve([])),
          })),
        })),
      })),
    } as unknown as Parameters<typeof computeSchemaVersionHash>[2];

    const hash2 = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, emptyDb2);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  // -----------------------------------------------------------------------
  // SHA-256 format
  // -----------------------------------------------------------------------

  it('produces a valid hex-encoded SHA-256 hash (64 chars)', async () => {
    const db = createMockDb({
      tables: [{ id: 'tbl-001' }],
      fields: [{ id: 'fld-001', tableId: 'tbl-001', fieldType: 'text', config: {} }],
      crossLinks: [],
    });

    const hash = await computeSchemaVersionHash(WORKSPACE_ID, TENANT_ID, db);

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toHaveLength(64);
  });
});
