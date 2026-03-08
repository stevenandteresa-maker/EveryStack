/**
 * Sync Dashboard — Data access functions for the Sync Settings Dashboard.
 *
 * - getSyncDashboardData: aggregates connection details, health, and pending counts
 * - getSyncHistory: approximate sync history from sync_failures grouped by date
 *
 * @see docs/reference/sync-engine.md § Sync Connection Status Model
 */

import {
  getDbForTenant,
  eq,
  and,
  sql,
  baseConnections,
  syncConflicts,
  syncFailures,
  syncSchemaChanges,
  syncedFieldMappings,
} from '@everystack/shared/db';
import {
  ConnectionHealthSchema,
  deriveSyncHealthState,
  DEFAULT_CONNECTION_HEALTH,
} from '@everystack/shared/sync';
import type {
  SyncHealthState,
  ConnectionHealth,
  SyncConfig,
  SyncTableConfig,
} from '@everystack/shared/sync';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface SyncDashboardData {
  connectionId: string;
  platform: string;
  baseName: string | null;
  syncDirection: string;
  conflictResolution: string;
  syncStatus: string;
  healthState: SyncHealthState;
  health: ConnectionHealth;
  lastSyncAt: Date | null;
  pollingIntervalSeconds: number;
  totalSyncedRecords: number;
  pendingConflictCount: number;
  pendingFailureCount: number;
  pendingSchemaChangeCount: number;
  syncConfig: SyncConfig | null;
}

export interface SyncHistoryEntry {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  successCount: number;
  partialCount: number;
  failedCount: number;
  totalRecordsSynced: number;
  averageDurationMs: number | null;
}

// ---------------------------------------------------------------------------
// getSyncDashboardData
// ---------------------------------------------------------------------------

/**
 * Fetch all data needed by the Sync Settings Dashboard in a single call.
 *
 * Aggregates connection details, derived health state, and counts of pending
 * conflicts, failures, and schema changes for the given base connection.
 *
 * @param tenantId - tenant UUID (from auth context)
 * @param baseConnectionId - base_connections.id
 * @returns aggregated dashboard data
 * @throws NotFoundError if the connection does not exist for this tenant
 */
export async function getSyncDashboardData(
  tenantId: string,
  baseConnectionId: string,
): Promise<SyncDashboardData> {
  const db = getDbForTenant(tenantId, 'read');

  // 1. Fetch connection row
  const [connection] = await db
    .select({
      id: baseConnections.id,
      platform: baseConnections.platform,
      externalBaseName: baseConnections.externalBaseName,
      syncDirection: baseConnections.syncDirection,
      conflictResolution: baseConnections.conflictResolution,
      syncStatus: baseConnections.syncStatus,
      syncConfig: baseConnections.syncConfig,
      health: baseConnections.health,
      lastSyncAt: baseConnections.lastSyncAt,
    })
    .from(baseConnections)
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!connection) {
    throw new NotFoundError('Connection not found');
  }

  // 2. Parse health JSONB
  const healthResult = ConnectionHealthSchema.safeParse(connection.health);
  const health: ConnectionHealth = healthResult.success
    ? healthResult.data
    : { ...DEFAULT_CONNECTION_HEALTH };

  // 3. Parse sync config
  const rawConfig = connection.syncConfig as Record<string, unknown> | null;
  const syncConfig: SyncConfig | null =
    rawConfig && Array.isArray((rawConfig as unknown as SyncConfig).tables)
      ? (rawConfig as unknown as SyncConfig)
      : null;

  const pollingIntervalSeconds =
    syncConfig?.polling_interval_seconds ?? 300;

  // 4. Calculate total synced records from enabled tables in syncConfig
  const totalSyncedRecords = syncConfig
    ? syncConfig.tables
        .filter((t: SyncTableConfig) => t.enabled)
        .reduce(
          (sum: number, t: SyncTableConfig) =>
            sum + (t.estimated_record_count ?? 0),
          0,
        )
    : 0;

  // 5. Count pending conflicts for records belonging to this connection
  // sync_conflicts lacks a baseConnectionId, so join through
  // synced_field_mappings to scope by connection
  const [conflictRow] = await db
    .select({
      count: sql<number>`count(distinct ${syncConflicts.id})::int`,
    })
    .from(syncConflicts)
    .innerJoin(
      syncedFieldMappings,
      and(
        eq(syncedFieldMappings.fieldId, syncConflicts.fieldId),
        eq(syncedFieldMappings.tenantId, syncConflicts.tenantId),
      ),
    )
    .where(
      and(
        eq(syncConflicts.tenantId, tenantId),
        eq(syncConflicts.status, 'pending'),
        eq(syncedFieldMappings.baseConnectionId, baseConnectionId),
      ),
    );

  const pendingConflictCount = conflictRow?.count ?? 0;

  // 6. Count pending failures (direct FK to base_connection_id)
  const [failureRow] = await db
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

  const pendingFailureCount = failureRow?.count ?? 0;

  // 7. Count pending schema changes (direct FK to base_connection_id)
  const [schemaRow] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(syncSchemaChanges)
    .where(
      and(
        eq(syncSchemaChanges.tenantId, tenantId),
        eq(syncSchemaChanges.baseConnectionId, baseConnectionId),
        eq(syncSchemaChanges.status, 'pending'),
      ),
    );

  const pendingSchemaChangeCount = schemaRow?.count ?? 0;

  // 8. Derive health state
  const healthState = deriveSyncHealthState(
    connection.syncStatus,
    health,
    connection.lastSyncAt,
    pollingIntervalSeconds,
    pendingConflictCount,
    false, // isSyncing — not available from DB, UI layer may override
  );

  return {
    connectionId: connection.id,
    platform: connection.platform,
    baseName: connection.externalBaseName,
    syncDirection: connection.syncDirection,
    conflictResolution: connection.conflictResolution,
    syncStatus: connection.syncStatus,
    healthState,
    health,
    lastSyncAt: connection.lastSyncAt,
    pollingIntervalSeconds,
    totalSyncedRecords,
    pendingConflictCount,
    pendingFailureCount,
    pendingSchemaChangeCount,
    syncConfig,
  };
}

// ---------------------------------------------------------------------------
// getSyncHistory
// ---------------------------------------------------------------------------

/**
 * Approximate sync history for the last N days.
 *
 * Since there is no dedicated sync_runs table, this aggregates from
 * sync_failures grouped by date. Success data is estimated from the
 * connection health (records_synced). This provides a rough timeline
 * until a sync_runs table is introduced.
 *
 * @param tenantId - tenant UUID
 * @param baseConnectionId - base_connections.id
 * @param days - number of past days to query (default: 7)
 * @returns array of daily history entries, ordered most recent first
 */
export async function getSyncHistory(
  tenantId: string,
  baseConnectionId: string,
  days: number = 7,
): Promise<SyncHistoryEntry[]> {
  const db = getDbForTenant(tenantId, 'read');

  // Query sync_failures grouped by day for the last N days
  const rows = await db
    .select({
      date: sql<string>`to_char(${syncFailures.createdAt}::date, 'YYYY-MM-DD')`,
      failedCount: sql<number>`count(*) FILTER (WHERE ${syncFailures.status} IN ('pending', 'requires_manual_resolution'))::int`,
      retriedCount: sql<number>`count(*) FILTER (WHERE ${syncFailures.status} = 'retrying')::int`,
      resolvedCount: sql<number>`count(*) FILTER (WHERE ${syncFailures.status} IN ('resolved', 'skipped'))::int`,
    })
    .from(syncFailures)
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
        sql`${syncFailures.createdAt} >= now() - make_interval(days => ${days})`,
      ),
    )
    .groupBy(sql`${syncFailures.createdAt}::date`)
    .orderBy(sql`${syncFailures.createdAt}::date DESC`);

  return rows.map((row) => ({
    date: row.date,
    // Resolved failures indicate syncs that eventually succeeded
    successCount: row.resolvedCount,
    // Retrying failures suggest partial sync runs
    partialCount: row.retriedCount,
    failedCount: row.failedCount,
    // Without a sync_runs table, record-level counts are not available per-day
    totalRecordsSynced: 0,
    averageDurationMs: null,
  }));
}
