// ---------------------------------------------------------------------------
// Connection Health — derivation and transition utilities
//
// deriveSyncHealthState: derives the current health state from DB columns
// updateConnectionHealth: transitions health JSONB on sync success/error
//
// @see docs/reference/sync-engine.md § Sync Connection Status Model
// ---------------------------------------------------------------------------

import type { ConnectionHealth, SyncError } from './types';

// ---------------------------------------------------------------------------
// Health state type — 8 possible states for UI rendering
// ---------------------------------------------------------------------------

/**
 * Derived sync health state for display in the SyncStatusBadge.
 * Computed from base_connections columns, not stored directly.
 */
export type SyncHealthState =
  | 'healthy'       // active + recent sync
  | 'syncing'       // sync currently running
  | 'stale'         // active but >2x polling_interval since last sync
  | 'retrying'      // error but retryable, next_retry_at set
  | 'error'         // non-retryable error
  | 'auth_required' // OAuth token expired/revoked
  | 'paused'        // Manager manually paused
  | 'conflicts';    // active but has pending conflicts

// ---------------------------------------------------------------------------
// Default health state — used when health JSONB is empty or null
// ---------------------------------------------------------------------------

export const DEFAULT_CONNECTION_HEALTH: ConnectionHealth = {
  last_success_at: null,
  last_error: null,
  consecutive_failures: 0,
  next_retry_at: null,
  records_synced: 0,
  records_failed: 0,
};

// ---------------------------------------------------------------------------
// deriveSyncHealthState
// ---------------------------------------------------------------------------

/**
 * Derives the current sync health state from DB columns and runtime context.
 *
 * Priority order (highest to lowest):
 * 1. paused (explicit user action)
 * 2. auth_required (DB sync_status)
 * 3. syncing (runtime flag)
 * 4. error (non-retryable)
 * 5. retrying (retryable with next_retry_at)
 * 6. conflicts (pending > 0)
 * 7. stale (>2x polling interval)
 * 8. healthy (default)
 *
 * @param syncStatus - base_connections.sync_status column value
 * @param health - base_connections.health JSONB (parsed)
 * @param lastSyncAt - base_connections.last_sync_at timestamp
 * @param pollingInterval - polling interval in seconds from sync_config
 * @param pendingConflictCount - number of unresolved sync conflicts
 * @param isSyncing - whether a sync job is currently running
 */
export function deriveSyncHealthState(
  syncStatus: string,
  health: ConnectionHealth | null,
  lastSyncAt: Date | null,
  pollingInterval: number,
  pendingConflictCount: number,
  isSyncing: boolean,
): SyncHealthState {
  // Paused takes absolute priority — explicit user action
  if (syncStatus === 'paused') {
    return 'paused';
  }

  // Auth required — stored in sync_status column
  if (syncStatus === 'auth_required') {
    return 'auth_required';
  }

  // Currently syncing — runtime state
  if (isSyncing) {
    return 'syncing';
  }

  // Check health for error states
  if (health?.last_error) {
    if (!health.last_error.retryable) {
      return 'error';
    }
    if (health.next_retry_at) {
      return 'retrying';
    }
  }

  // DB-level error status without health details
  if (syncStatus === 'error') {
    return 'error';
  }

  // Pending conflicts
  if (pendingConflictCount > 0) {
    return 'conflicts';
  }

  // Staleness check: >2x polling interval since last sync
  if (lastSyncAt) {
    const stalenessThresholdMs = pollingInterval * 2 * 1000;
    const timeSinceSync = Date.now() - lastSyncAt.getTime();
    if (timeSinceSync > stalenessThresholdMs) {
      return 'stale';
    }
  }

  return 'healthy';
}

// ---------------------------------------------------------------------------
// updateConnectionHealth
// ---------------------------------------------------------------------------

/**
 * Transitions the ConnectionHealth JSONB based on a sync event.
 *
 * On success: resets consecutive_failures, clears last_error and next_retry_at,
 *   updates last_success_at and records_synced.
 * On error: increments consecutive_failures, sets last_error.
 *
 * @param existing - current health JSONB (null treated as default)
 * @param event - the sync event type
 * @param details - partial SyncError details (required for 'sync_error')
 * @returns updated ConnectionHealth
 */
export function updateConnectionHealth(
  existing: ConnectionHealth | null,
  event: 'sync_success' | 'sync_error',
  details?: Partial<SyncError> & { records_synced?: number; records_failed?: number },
): ConnectionHealth {
  const current = existing ?? { ...DEFAULT_CONNECTION_HEALTH };

  if (event === 'sync_success') {
    return {
      last_success_at: new Date().toISOString(),
      last_error: null,
      consecutive_failures: 0,
      next_retry_at: null,
      records_synced: details?.records_synced ?? current.records_synced,
      records_failed: 0,
    };
  }

  // sync_error
  const errorCode = details?.code ?? 'unknown';
  const retryable = details?.retryable ?? false;
  const newFailures = current.consecutive_failures + 1;

  const syncError: SyncError = {
    code: errorCode,
    message: details?.message ?? 'An unknown sync error occurred',
    timestamp: details?.timestamp ?? new Date().toISOString(),
    retryable,
    details: details?.details ?? {},
  };

  return {
    last_success_at: current.last_success_at,
    last_error: syncError,
    consecutive_failures: newFailures,
    next_retry_at: details?.timestamp ? current.next_retry_at : null,
    records_synced: current.records_synced,
    records_failed: details?.records_failed ?? current.records_failed,
  };
}
