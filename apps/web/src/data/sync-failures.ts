/**
 * Sync Failures Data — Server-side function to fetch sync failures
 * with record display names for the Failures tab UI.
 *
 * @see docs/reference/sync-engine.md § Partial Failure Recovery
 */

import {
  getDbForTenant,
  eq,
  and,
  sql,
  syncFailures,
  records,
} from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface SyncFailureWithRecord {
  id: string;
  baseConnectionId: string;
  recordId: string | null;
  direction: string;
  errorCode: string;
  errorMessage: string | null;
  platformRecordId: string | null;
  payload: unknown;
  retryCount: number;
  status: string;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  /** Display name from the record's canonical_data, if available. */
  recordDisplayName: string | null;
}

// ---------------------------------------------------------------------------
// getSyncFailures
// ---------------------------------------------------------------------------

/**
 * Fetches sync failures for a connection with record display names.
 *
 * Joins sync_failures with records to extract a display name from
 * canonical_data (first text field value or record ID as fallback).
 *
 * Uses getDbForTenant() for tenant isolation.
 */
export async function getSyncFailures(
  tenantId: string,
  baseConnectionId: string,
): Promise<SyncFailureWithRecord[]> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      id: syncFailures.id,
      baseConnectionId: syncFailures.baseConnectionId,
      recordId: syncFailures.recordId,
      direction: syncFailures.direction,
      errorCode: syncFailures.errorCode,
      errorMessage: syncFailures.errorMessage,
      platformRecordId: syncFailures.platformRecordId,
      payload: syncFailures.payload,
      retryCount: syncFailures.retryCount,
      status: syncFailures.status,
      createdAt: syncFailures.createdAt,
      resolvedAt: syncFailures.resolvedAt,
      resolvedBy: syncFailures.resolvedBy,
      // Extract a display name: first non-null text value from canonical_data
      recordDisplayName: sql<string | null>`
        CASE
          WHEN ${records.id} IS NOT NULL THEN
            COALESCE(
              (SELECT value::text FROM jsonb_each_text(${records.canonicalData}) LIMIT 1),
              ${records.id}::text
            )
          ELSE NULL
        END
      `.as('record_display_name'),
    })
    .from(syncFailures)
    .leftJoin(
      records,
      and(
        eq(syncFailures.recordId, records.id),
        eq(records.tenantId, tenantId),
      ),
    )
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
      ),
    )
    .orderBy(sql`${syncFailures.createdAt} DESC`);

  return rows;
}

/**
 * Count pending failures for a connection (used by dashboard badges).
 */
export async function countPendingSyncFailures(
  tenantId: string,
  baseConnectionId: string,
): Promise<number> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(syncFailures)
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
        sql`${syncFailures.status} IN ('pending', 'requires_manual_resolution')`,
      ),
    );

  return row?.count ?? 0;
}
