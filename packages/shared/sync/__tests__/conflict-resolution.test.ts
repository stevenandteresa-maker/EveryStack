/**
 * Tests for conflict resolution strategies.
 *
 * - applyLastWriteWins: remote value applied, sync_conflicts status resolved_remote,
 *   overwritten local values preserved in local_value, sync_metadata updated
 * - Manual mode: conflicts pending, canonical unchanged (tested via writeConflictRecords)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  getTestDb,
  createTestTenant,
  createTestTable,
  createTestField,
  createTestRecord,
} from '../../testing/factories';
import { applyLastWriteWins } from '../conflict-resolution';
import { writeConflictRecords } from '../conflict-detection';
import { createInitialSyncMetadata } from '../sync-metadata';
import { syncConflicts, records } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { DetectedConflict } from '../types';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tenantId: string;
let tenant2Id: string;
let tableId: string;
let field1Id: string;
let field2Id: string;
let field3Id: string;

beforeAll(async () => {
  const tenant = await createTestTenant();
  tenantId = tenant.id;

  const tenant2 = await createTestTenant();
  tenant2Id = tenant2.id;

  const table = await createTestTable({ tenantId });
  tableId = table.id;

  const field1 = await createTestField({ tenantId, tableId, name: 'Name' });
  field1Id = field1.id;

  const field2 = await createTestField({ tenantId, tableId, name: 'Status' });
  field2Id = field2.id;

  const field3 = await createTestField({ tenantId, tableId, name: 'Priority' });
  field3Id = field3.id;
}, 30_000);

afterAll(async () => {
  const db = getTestDb();
  await db.delete(syncConflicts).where(eq(syncConflicts.tenantId, tenantId));
  await db.delete(syncConflicts).where(eq(syncConflicts.tenantId, tenant2Id));
}, 30_000);

// ---------------------------------------------------------------------------
// applyLastWriteWins
// ---------------------------------------------------------------------------

describe('applyLastWriteWins', () => {
  it('applies remote values to canonical_data for each conflict', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: {
        [field1Id]: 'Local Alice',
        [field2Id]: 'Local Open',
      },
    });

    const syncMeta = createInitialSyncMetadata(
      'airtable-rec-1',
      { [field1Id]: 'Base Alice', [field2Id]: 'Base Open' },
      [field1Id, field2Id],
    );

    const conflicts: DetectedConflict[] = [
      {
        fieldId: field1Id,
        localValue: 'Local Alice',
        remoteValue: 'Remote Bob',
        baseValue: 'Base Alice',
      },
      {
        fieldId: field2Id,
        localValue: 'Local Open',
        remoteValue: 'Remote Closed',
        baseValue: 'Base Open',
      },
    ];

    const result = await applyLastWriteWins(
      db,
      tenantId,
      record.id,
      conflicts,
      'airtable',
      { [field1Id]: 'Local Alice', [field2Id]: 'Local Open' },
      syncMeta,
      'airtable-rec-1',
      [field1Id, field2Id],
    );

    // Verify canonical has remote values
    expect(result.updatedCanonical[field1Id]).toBe('Remote Bob');
    expect(result.updatedCanonical[field2Id]).toBe('Remote Closed');
    expect(result.resolvedCount).toBe(2);
  }, 30_000);

  it('writes sync_conflicts with status resolved_remote', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [field1Id]: 'Local' },
    });

    const syncMeta = createInitialSyncMetadata(
      'airtable-rec-2',
      { [field1Id]: 'Base' },
      [field1Id],
    );

    const conflicts: DetectedConflict[] = [
      {
        fieldId: field1Id,
        localValue: 'Local',
        remoteValue: 'Remote',
        baseValue: 'Base',
      },
    ];

    await applyLastWriteWins(
      db,
      tenantId,
      record.id,
      conflicts,
      'airtable',
      { [field1Id]: 'Local' },
      syncMeta,
      'airtable-rec-2',
      [field1Id],
    );

    // Verify conflict rows in DB
    const rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, record.id),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('resolved_remote');
    expect(rows[0]!.fieldId).toBe(field1Id);
    expect(rows[0]!.platform).toBe('airtable');
  }, 30_000);

  it('preserves overwritten local values in sync_conflicts.local_value', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [field3Id]: { type: 'text', value: 'Important Local Data' } },
    });

    const syncMeta = createInitialSyncMetadata(
      'airtable-rec-3',
      { [field3Id]: { type: 'text', value: 'Base Data' } },
      [field3Id],
    );

    const conflicts: DetectedConflict[] = [
      {
        fieldId: field3Id,
        localValue: { type: 'text', value: 'Important Local Data' },
        remoteValue: { type: 'text', value: 'Remote Data' },
        baseValue: { type: 'text', value: 'Base Data' },
      },
    ];

    await applyLastWriteWins(
      db,
      tenantId,
      record.id,
      conflicts,
      'notion',
      { [field3Id]: { type: 'text', value: 'Important Local Data' } },
      syncMeta,
      'airtable-rec-3',
      [field3Id],
    );

    const rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, record.id),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.localValue).toEqual({ type: 'text', value: 'Important Local Data' });
    expect(rows[0]!.remoteValue).toEqual({ type: 'text', value: 'Remote Data' });
    expect(rows[0]!.baseValue).toEqual({ type: 'text', value: 'Base Data' });
  }, 30_000);

  it('updates sync_metadata.last_synced_values with remote values', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [field1Id]: 'Local' },
    });

    const syncMeta = createInitialSyncMetadata(
      'airtable-rec-4',
      { [field1Id]: 'Base' },
      [field1Id],
    );

    const conflicts: DetectedConflict[] = [
      {
        fieldId: field1Id,
        localValue: 'Local',
        remoteValue: 'Remote',
        baseValue: 'Base',
      },
    ];

    const result = await applyLastWriteWins(
      db,
      tenantId,
      record.id,
      conflicts,
      'airtable',
      { [field1Id]: 'Local' },
      syncMeta,
      'airtable-rec-4',
      [field1Id],
    );

    // Verify metadata was updated for resolved field
    const lastSynced = result.updatedSyncMetadata.last_synced_values[field1Id];
    expect(lastSynced).toBeDefined();
    expect(lastSynced!.value).toBe('Remote');
  }, 30_000);

  it('no-ops when conflicts array is empty', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [field1Id]: 'unchanged' },
    });

    const syncMeta = createInitialSyncMetadata(
      'airtable-rec-5',
      { [field1Id]: 'unchanged' },
      [field1Id],
    );

    const result = await applyLastWriteWins(
      db,
      tenantId,
      record.id,
      [],
      'airtable',
      { [field1Id]: 'unchanged' },
      syncMeta,
      'airtable-rec-5',
      [field1Id],
    );

    expect(result.resolvedCount).toBe(0);
    expect(result.updatedCanonical[field1Id]).toBe('unchanged');

    // No conflict rows should be created
    const rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, record.id),
        ),
      );
    expect(rows).toHaveLength(0);
  }, 30_000);

  it('creates initial sync metadata when syncMetadata is null', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [field1Id]: 'Local' },
    });

    const conflicts: DetectedConflict[] = [
      {
        fieldId: field1Id,
        localValue: 'Local',
        remoteValue: 'Remote',
        baseValue: null,
      },
    ];

    const result = await applyLastWriteWins(
      db,
      tenantId,
      record.id,
      conflicts,
      'airtable',
      { [field1Id]: 'Local' },
      null,
      'airtable-rec-6',
      [field1Id],
    );

    expect(result.updatedSyncMetadata.platform_record_id).toBe('airtable-rec-6');
    expect(result.updatedSyncMetadata.sync_status).toBe('active');
    expect(result.updatedCanonical[field1Id]).toBe('Remote');
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Manual mode — conflicts written as pending, canonical unchanged
// ---------------------------------------------------------------------------

describe('manual conflict resolution (writeConflictRecords)', () => {
  it('writes conflicts with status pending', async () => {
    const db = getTestDb();

    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: { [field1Id]: 'Local Value' },
    });

    const conflicts: DetectedConflict[] = [
      {
        fieldId: field1Id,
        localValue: 'Local Value',
        remoteValue: 'Remote Value',
        baseValue: 'Base Value',
      },
    ];

    await writeConflictRecords(db, tenantId, record.id, conflicts, 'airtable');

    const rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, record.id),
        ),
      );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('pending');
    expect(rows[0]!.localValue).toBe('Local Value');
    expect(rows[0]!.remoteValue).toBe('Remote Value');
  }, 30_000);

  it('does not modify canonical_data (caller preserves local)', async () => {
    const db = getTestDb();

    const originalCanonical = { [field1Id]: 'Should Not Change' };
    const record = await createTestRecord({
      tenantId,
      tableId,
      canonicalData: originalCanonical,
    });

    // writeConflictRecords only writes conflict rows — no canonical update
    await writeConflictRecords(db, tenantId, record.id, [
      {
        fieldId: field1Id,
        localValue: 'Should Not Change',
        remoteValue: 'Remote',
        baseValue: 'Base',
      },
    ], 'airtable');

    // Verify canonical_data is unchanged
    const [dbRecord] = await db
      .select({ canonicalData: records.canonicalData })
      .from(records)
      .where(
        and(
          eq(records.tenantId, tenantId),
          eq(records.id, record.id),
        ),
      );

    expect(dbRecord!.canonicalData).toEqual(originalCanonical);
  }, 30_000);
});

// ---------------------------------------------------------------------------
// Tenant isolation
// ---------------------------------------------------------------------------

describe('tenant isolation', () => {
  it('conflict records belong to correct tenant', async () => {
    const db = getTestDb();

    const table2 = await createTestTable({ tenantId: tenant2Id });
    const field2_1 = await createTestField({ tenantId: tenant2Id, tableId: table2.id });

    const record1 = await createTestRecord({ tenantId, tableId });
    const record2 = await createTestRecord({ tenantId: tenant2Id, tableId: table2.id });

    // Write LWW conflict for tenant 1
    await applyLastWriteWins(
      db,
      tenantId,
      record1.id,
      [{ fieldId: field1Id, localValue: 'T1-local', remoteValue: 'T1-remote', baseValue: 'T1-base' }],
      'airtable',
      { [field1Id]: 'T1-local' },
      createInitialSyncMetadata('t1-rec', { [field1Id]: 'T1-base' }, [field1Id]),
      't1-rec',
      [field1Id],
    );

    // Write pending conflict for tenant 2
    await writeConflictRecords(db, tenant2Id, record2.id, [
      { fieldId: field2_1.id, localValue: 'T2-local', remoteValue: 'T2-remote', baseValue: 'T2-base' },
    ], 'notion');

    // Tenant 1 should not see tenant 2's conflicts
    const t1Rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenantId),
          eq(syncConflicts.recordId, record1.id),
        ),
      );

    const t2Rows = await db
      .select()
      .from(syncConflicts)
      .where(
        and(
          eq(syncConflicts.tenantId, tenant2Id),
          eq(syncConflicts.recordId, record2.id),
        ),
      );

    expect(t1Rows.every((r) => r.tenantId === tenantId)).toBe(true);
    expect(t2Rows.every((r) => r.tenantId === tenant2Id)).toBe(true);
    expect(t1Rows[0]!.status).toBe('resolved_remote');
    expect(t2Rows[0]!.status).toBe('pending');
  }, 30_000);
});
