import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateIndexName,
  createFieldExpressionIndex,
  dropFieldExpressionIndex,
  INDEXABLE_FIELD_TYPES,
} from '../index-utils';
import type { DrizzleClient } from '../client';

// ---------------------------------------------------------------------------
// Mock DB client
// ---------------------------------------------------------------------------

function createMockDb() {
  const executeFn = vi.fn().mockResolvedValue(undefined);
  return {
    db: { execute: executeFn } as unknown as DrizzleClient,
    executeFn,
  };
}

// ---------------------------------------------------------------------------
// Test UUIDs (deterministic for assertion stability)
// ---------------------------------------------------------------------------

const TENANT_ID = '01912345-6789-7abc-8def-0123456789ab';
const TABLE_ID = '01912345-6789-7abc-8def-0123456789cd';
const FIELD_ID = '01912345-6789-7abc-8def-0123456789ef';

// ---------------------------------------------------------------------------
// generateIndexName
// ---------------------------------------------------------------------------

describe('generateIndexName', () => {
  it('produces a deterministic name for the same inputs', () => {
    const name1 = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    const name2 = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    expect(name1).toBe(name2);
  });

  it('starts with idx_rec_ prefix', () => {
    const name = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    expect(name).toMatch(/^idx_rec_/);
  });

  it('does not exceed 63 characters', () => {
    const name = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    expect(name.length).toBeLessThanOrEqual(63);
  });

  it('is exactly idx_rec_ + 12 hex chars (20 total)', () => {
    const name = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    expect(name).toMatch(/^idx_rec_[0-9a-f]{12}$/);
    expect(name.length).toBe(20);
  });

  it('produces different names for different fields', () => {
    const name1 = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    const name2 = generateIndexName(TENANT_ID, TABLE_ID, '01912345-6789-7abc-8def-999999999999');
    expect(name1).not.toBe(name2);
  });

  it('produces different names for different tenants', () => {
    const name1 = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    const name2 = generateIndexName('01912345-6789-7abc-8def-aaaaaaaaaaaa', TABLE_ID, FIELD_ID);
    expect(name1).not.toBe(name2);
  });

  it('produces different names for different tables', () => {
    const name1 = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    const name2 = generateIndexName(TENANT_ID, '01912345-6789-7abc-8def-bbbbbbbbbbbb', FIELD_ID);
    expect(name1).not.toBe(name2);
  });
});

// ---------------------------------------------------------------------------
// INDEXABLE_FIELD_TYPES
// ---------------------------------------------------------------------------

describe('INDEXABLE_FIELD_TYPES', () => {
  it('contains exactly the 5 supported types', () => {
    expect(INDEXABLE_FIELD_TYPES).toEqual([
      'text',
      'number',
      'date',
      'single_select',
      'checkbox',
    ]);
  });
});

// ---------------------------------------------------------------------------
// createFieldExpressionIndex
// ---------------------------------------------------------------------------

describe('createFieldExpressionIndex', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('returns the generated index name', async () => {
    const name = await createFieldExpressionIndex(
      mockDb.db,
      TENANT_ID,
      TABLE_ID,
      FIELD_ID,
      'text',
    );
    expect(name).toBe(generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID));
  });

  it('executes a CREATE INDEX CONCURRENTLY statement', async () => {
    await createFieldExpressionIndex(mockDb.db, TENANT_ID, TABLE_ID, FIELD_ID, 'text');
    expect(mockDb.executeFn).toHaveBeenCalledOnce();

    const sqlArg = mockDb.executeFn.mock.calls[0]?.[0];
    const sqlString = sqlArg?.queryChunks?.map((c: unknown) =>
      typeof c === 'object' && c !== null && 'value' in c ? (c as { value: unknown[] }).value[0] : c
    )?.join('') ?? String(sqlArg);

    expect(sqlString).toContain('CREATE INDEX CONCURRENTLY');
    expect(sqlString).toContain('IF NOT EXISTS');
  });

  it.each([
    ['text', "->>'value')"],
    ['single_select', "->>'value')"],
    ['number', '::numeric'],
    ['date', '::timestamptz'],
    ['checkbox', '::boolean'],
  ] as const)('generates correct expression for %s field type', async (fieldType, expectedFragment) => {
    await createFieldExpressionIndex(mockDb.db, TENANT_ID, TABLE_ID, FIELD_ID, fieldType);

    const sqlArg = mockDb.executeFn.mock.calls[0]?.[0];
    const sqlString = sqlArg?.queryChunks?.map((c: unknown) =>
      typeof c === 'object' && c !== null && 'value' in c ? (c as { value: unknown[] }).value[0] : c
    )?.join('') ?? String(sqlArg);

    expect(sqlString).toContain(expectedFragment);
  });

  it('includes tenant_id and table_id in WHERE clause', async () => {
    await createFieldExpressionIndex(mockDb.db, TENANT_ID, TABLE_ID, FIELD_ID, 'text');

    const sqlArg = mockDb.executeFn.mock.calls[0]?.[0];
    const sqlString = sqlArg?.queryChunks?.map((c: unknown) =>
      typeof c === 'object' && c !== null && 'value' in c ? (c as { value: unknown[] }).value[0] : c
    )?.join('') ?? String(sqlArg);

    expect(sqlString).toContain(`tenant_id = '${TENANT_ID}'`);
    expect(sqlString).toContain(`table_id = '${TABLE_ID}'`);
  });

  it('includes NULL check for the field in WHERE clause', async () => {
    await createFieldExpressionIndex(mockDb.db, TENANT_ID, TABLE_ID, FIELD_ID, 'text');

    const sqlArg = mockDb.executeFn.mock.calls[0]?.[0];
    const sqlString = sqlArg?.queryChunks?.map((c: unknown) =>
      typeof c === 'object' && c !== null && 'value' in c ? (c as { value: unknown[] }).value[0] : c
    )?.join('') ?? String(sqlArg);

    expect(sqlString).toContain(`canonical_data->'${FIELD_ID}' IS NOT NULL`);
  });
});

// ---------------------------------------------------------------------------
// dropFieldExpressionIndex
// ---------------------------------------------------------------------------

describe('dropFieldExpressionIndex', () => {
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
  });

  it('executes a DROP INDEX CONCURRENTLY statement', async () => {
    await dropFieldExpressionIndex(mockDb.db, TENANT_ID, TABLE_ID, FIELD_ID);
    expect(mockDb.executeFn).toHaveBeenCalledOnce();

    const sqlArg = mockDb.executeFn.mock.calls[0]?.[0];
    const sqlString = sqlArg?.queryChunks?.map((c: unknown) =>
      typeof c === 'object' && c !== null && 'value' in c ? (c as { value: unknown[] }).value[0] : c
    )?.join('') ?? String(sqlArg);

    expect(sqlString).toContain('DROP INDEX CONCURRENTLY');
    expect(sqlString).toContain('IF EXISTS');
  });

  it('uses the same index name as createFieldExpressionIndex', async () => {
    await dropFieldExpressionIndex(mockDb.db, TENANT_ID, TABLE_ID, FIELD_ID);

    const expectedName = generateIndexName(TENANT_ID, TABLE_ID, FIELD_ID);
    const sqlArg = mockDb.executeFn.mock.calls[0]?.[0];
    const sqlString = sqlArg?.queryChunks?.map((c: unknown) =>
      typeof c === 'object' && c !== null && 'value' in c ? (c as { value: unknown[] }).value[0] : c
    )?.join('') ?? String(sqlArg);

    expect(sqlString).toContain(expectedName);
  });
});
