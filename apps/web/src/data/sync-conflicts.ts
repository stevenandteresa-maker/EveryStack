/**
 * Sync Conflict Queries — Data access for grid-level conflict indicators.
 *
 * - getPendingConflictsForTable: nested map { [recordId]: { [fieldId]: ConflictMeta } }
 * - getPendingConflictCount: total pending conflicts for a table
 *
 * These populate the `_conflicts` map on record rows for TanStack Table cell
 * renderers and the toolbar badge count.
 *
 * @see docs/reference/sync-engine.md § Grid-Level Conflict Rendering
 */

import {
  getDbForTenant,
  eq,
  and,
  sql,
  syncConflicts,
  records,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Conflict metadata for a single field on a single record.
 * This is the shape surfaced to the grid cell renderer.
 */
export interface ConflictMeta {
  /** sync_conflicts.id */
  id: string;
  /** Value in canonical_data before the conflict (local edit). */
  localValue: unknown;
  /** Incoming value from the platform. */
  remoteValue: unknown;
  /** Source platform identifier. */
  platform: string;
  /** When the conflict was detected. */
  createdAt: string;
}

/**
 * Nested conflict map: recordId → fieldId → ConflictMeta.
 * Mirrors the `record._conflicts` shape used by TanStack Table column defs.
 */
export type ConflictMap = Record<string, Record<string, ConflictMeta>>;

// ---------------------------------------------------------------------------
// getPendingConflictsForTable
// ---------------------------------------------------------------------------

/**
 * Returns all pending conflicts for a table as a nested map keyed by
 * recordId then fieldId.
 *
 * Joins sync_conflicts → records (to filter by tableId) and only returns
 * rows with status = 'pending'. The result is ready to be merged onto
 * record rows as `record._conflicts`.
 */
export async function getPendingConflictsForTable(
  tenantId: string,
  tableId: string,
): Promise<ConflictMap> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: syncConflicts.id,
      recordId: syncConflicts.recordId,
      fieldId: syncConflicts.fieldId,
      localValue: syncConflicts.localValue,
      remoteValue: syncConflicts.remoteValue,
      platform: syncConflicts.platform,
      createdAt: syncConflicts.createdAt,
    })
    .from(syncConflicts)
    .innerJoin(records, eq(syncConflicts.recordId, records.id))
    .where(
      and(
        eq(syncConflicts.tenantId, tenantId),
        eq(syncConflicts.status, 'pending'),
        eq(records.tableId, tableId),
        eq(records.tenantId, tenantId),
      ),
    );

  const result: ConflictMap = {};

  for (const row of rows) {
    if (!result[row.recordId]) {
      result[row.recordId] = {};
    }
    const recordConflicts = result[row.recordId]!;
    recordConflicts[row.fieldId] = {
      id: row.id,
      localValue: row.localValue,
      remoteValue: row.remoteValue,
      platform: row.platform,
      createdAt: row.createdAt.toISOString(),
    };
  }

  return result;
}

// ---------------------------------------------------------------------------
// getPendingConflictCount
// ---------------------------------------------------------------------------

/**
 * Returns the total number of pending conflicts for a table.
 *
 * Used by the ConflictToolbarBadge to show the count without loading
 * full conflict data.
 */
export async function getPendingConflictCount(
  tenantId: string,
  tableId: string,
): Promise<number> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(syncConflicts)
    .innerJoin(records, eq(syncConflicts.recordId, records.id))
    .where(
      and(
        eq(syncConflicts.tenantId, tenantId),
        eq(syncConflicts.status, 'pending'),
        eq(records.tableId, tableId),
        eq(records.tenantId, tenantId),
      ),
    );

  return row?.count ?? 0;
}
