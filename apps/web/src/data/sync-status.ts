/**
 * Sync Status Data — Server-side function to fetch sync status for a table.
 *
 * Returns the derived health state, last sync time, pending conflict count,
 * and platform info for rendering the SyncStatusBadge.
 *
 * @see docs/reference/sync-engine.md § Sync Status Indicators
 */

import {
  getDbForTenant,
  eq,
  and,
  sql,
  baseConnections,
  syncConflicts,
  syncedFieldMappings,
  records,
} from '@everystack/shared/db';
import {
  ConnectionHealthSchema,
  deriveSyncHealthState,
  DEFAULT_CONNECTION_HEALTH,
} from '@everystack/shared/sync';
import type { SyncHealthState, ConnectionHealth } from '@everystack/shared/sync';

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export interface SyncStatus {
  /** Derived health state for the badge. */
  healthState: SyncHealthState;
  /** Platform name (airtable, notion, smartsuite). */
  platform: string;
  /** Last successful sync timestamp, or null. */
  lastSyncAt: Date | null;
  /** Number of pending sync conflicts on this table. */
  pendingConflictCount: number;
  /** Raw health JSONB for tooltip details. */
  health: ConnectionHealth;
  /** Base connection ID for navigation. */
  connectionId: string;
  /** sync_status column value. */
  syncStatus: string;
  /** Polling interval in seconds. */
  pollingIntervalSeconds: number;
}

// ---------------------------------------------------------------------------
// getSyncStatusForTable
// ---------------------------------------------------------------------------

/**
 * Fetches sync status for a table by looking up its base connection
 * through synced_field_mappings.
 *
 * Returns null if the table is not synced (no field mappings exist).
 */
export async function getSyncStatusForTable(
  tenantId: string,
  tableId: string,
): Promise<SyncStatus | null> {
  const db = getDbForTenant(tenantId, 'read');

  // Find the base connection for this table via synced_field_mappings
  const [mapping] = await db
    .select({
      baseConnectionId: syncedFieldMappings.baseConnectionId,
    })
    .from(syncedFieldMappings)
    .where(
      and(
        eq(syncedFieldMappings.tenantId, tenantId),
        eq(syncedFieldMappings.tableId, tableId),
      ),
    )
    .limit(1);

  if (!mapping) {
    return null;
  }

  // Fetch the connection details
  const [connection] = await db
    .select({
      id: baseConnections.id,
      platform: baseConnections.platform,
      syncStatus: baseConnections.syncStatus,
      syncConfig: baseConnections.syncConfig,
      health: baseConnections.health,
      lastSyncAt: baseConnections.lastSyncAt,
    })
    .from(baseConnections)
    .where(
      and(
        eq(baseConnections.id, mapping.baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!connection) {
    return null;
  }

  // Count pending conflicts for this table
  const [conflictRow] = await db
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

  const pendingConflictCount = conflictRow?.count ?? 0;

  // Parse health JSONB with Zod (safe fallback on invalid shape)
  const healthResult = ConnectionHealthSchema.safeParse(connection.health);
  const health: ConnectionHealth = healthResult.success
    ? healthResult.data
    : { ...DEFAULT_CONNECTION_HEALTH };

  // Extract polling interval from sync_config
  const syncConfig = connection.syncConfig as Record<string, unknown> | null;
  const pollingIntervalSeconds =
    typeof syncConfig?.polling_interval_seconds === 'number'
      ? syncConfig.polling_interval_seconds
      : 300;

  // Derive health state (isSyncing = false; real-time syncing state comes from Socket.io)
  const healthState = deriveSyncHealthState(
    connection.syncStatus,
    health,
    connection.lastSyncAt,
    pollingIntervalSeconds,
    pendingConflictCount,
    false,
  );

  return {
    healthState,
    platform: connection.platform,
    lastSyncAt: connection.lastSyncAt,
    pendingConflictCount,
    health,
    connectionId: connection.id,
    syncStatus: connection.syncStatus,
    pollingIntervalSeconds,
  };
}
