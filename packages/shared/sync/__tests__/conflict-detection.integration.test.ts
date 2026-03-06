/**
 * Integration test for writeConflictRecords — verifies actual DB writes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestDb,
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecord,
} from '../../testing/factories';
import { writeConflictRecords } from '../conflict-detection';
import { syncConflicts } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { DetectedConflict } from '../types';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tenantId: string;
let tableId: string;
let field1Id: string;
let field2Id: string;
let recordId: string;

beforeAll(async () => {
  const tenant = await createTestTenant();
  tenantId = tenant.id;

  const table = await createTestTable({ tenantId });
  tableId = table.id;

  const field1 = await createTestField({ tenantId, tableId, name: 'Name' });
  field1Id = field1.id;

  const field2 = await createTestField({ tenantId, tableId, name: 'Status' });
  field2Id = field2.id;

  const record = await createTestRecord({
    tenantId,
    tableId,
    canonicalData: {
      [field1Id]: { type: 'text', value: 'Local Alice' },
      [field2Id]: { type: 'text', value: 'Local Open' },
    },
  });
  recordId = record.id;
}, 30_000);

afterAll(async () => {
  // Clean up conflict records
  const db = getTestDb();
  await db.delete(syncConflicts).where(eq(syncConflicts.tenantId, tenantId));
}, 30_000);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('writeConflictRecords (integration)', () => {
  it('writes one sync_conflicts row per detected conflict', async () => {
    const db = getTestDb();
    const conflicts: DetectedConflict[] = [
      {
        fieldId: field1Id,
        localValue: { type: 'text', value: 'Local Alice' },
        remoteValue: { type: 'text', value: 'Remote Bob' },
        baseValue: { type: 'text', value: 'Base Alice' },
      },
      {
        fieldId: field2Id,
        localValue: { type: 'text', value: 'Local Open' },
        remoteValue: { type: 'text', value: 'Remote Closed' },
        baseValue: { type: 'text', value: 'Base Open' },
      },
    ];

    await writeConflictRecords(db, tenantId, recordId, conflicts, 'airtable');

    // Verify rows in DB
    const rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, recordId),
        ),
      );

    expect(rows).toHaveLength(2);

    const field1Row = rows.find((r) => r.fieldId === field1Id);
    const field2Row = rows.find((r) => r.fieldId === field2Id);

    expect(field1Row).toBeDefined();
    expect(field1Row!.localValue).toEqual({ type: 'text', value: 'Local Alice' });
    expect(field1Row!.remoteValue).toEqual({ type: 'text', value: 'Remote Bob' });
    expect(field1Row!.baseValue).toEqual({ type: 'text', value: 'Base Alice' });
    expect(field1Row!.platform).toBe('airtable');
    expect(field1Row!.status).toBe('pending');
    expect(field1Row!.resolvedBy).toBeNull();
    expect(field1Row!.resolvedAt).toBeNull();

    expect(field2Row).toBeDefined();
    expect(field2Row!.localValue).toEqual({ type: 'text', value: 'Local Open' });
    expect(field2Row!.remoteValue).toEqual({ type: 'text', value: 'Remote Closed' });
  }, 30_000);

  it('no-ops when conflicts array is empty', async () => {
    const db = getTestDb();

    // Count before
    const before = await db
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.tenantId, tenantId));
    const countBefore = before.length;

    await writeConflictRecords(db, tenantId, recordId, [], 'airtable');

    const after = await db
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.tenantId, tenantId));
    expect(after.length).toBe(countBefore);
  }, 30_000);

  it('enforces tenant isolation — conflicts belong to correct tenant', async () => {
    const db = getTestDb();

    // Create a second tenant
    const tenant2 = await createTestTenant();
    const table2 = await createTestTable({ tenantId: tenant2.id });
    const field3 = await createTestField({ tenantId: tenant2.id, tableId: table2.id });
    const record2 = await createTestRecord({ tenantId: tenant2.id, tableId: table2.id });

    await writeConflictRecords(db, tenant2.id, record2.id, [
      {
        fieldId: field3.id,
        localValue: 'tenant2-local',
        remoteValue: 'tenant2-remote',
        baseValue: 'tenant2-base',
      },
    ], 'notion');

    // Tenant 1 should not see tenant 2's conflicts
    const tenant1Rows = await db
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.tenantId, tenantId));
    const tenant2Rows = await db
      .select()
      .from(syncConflicts)
      .where(eq(syncConflicts.tenantId, tenant2.id));

    expect(tenant1Rows.every((r) => r.tenantId === tenantId)).toBe(true);
    expect(tenant2Rows.every((r) => r.tenantId === tenant2.id)).toBe(true);
    expect(tenant2Rows).toHaveLength(1);
    expect(tenant2Rows[0]!.platform).toBe('notion');

    // Clean up tenant 2
    await db.delete(syncConflicts).where(eq(syncConflicts.tenantId, tenant2.id));
  }, 30_000);
});
