/**
 * Conflict Resolution Strategies — determines how detected conflicts
 * are handled during inbound sync.
 *
 * Default: Last-Write-Wins (inbound/remote wins). Overwritten local
 * values are preserved in sync_conflicts for recovery.
 *
 * Manual: Conflicts written as pending. Local canonical_data unchanged.
 * User resolves via the conflict resolution modal (Prompt 7+).
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX
 */

import type { DrizzleClient } from '@everystack/shared/db';
import { syncConflicts } from '@everystack/shared/db';
import type { DetectedConflict, SyncPlatform, SyncMetadata } from './types';
import { updateLastSyncedValues, createInitialSyncMetadata } from './sync-metadata';
import { createLogger } from '@everystack/shared/logging';

const logger = createLogger({ service: 'conflict-resolution' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Connection-level conflict resolution strategy. */
export type ConflictResolutionStrategy = 'last_write_wins' | 'manual';

/** Result from applyLastWriteWins — canonical + metadata with conflicts resolved. */
export interface LastWriteWinsResult {
  /** Canonical data with remote values applied for conflicted fields. */
  updatedCanonical: Record<string, unknown>;
  /** Sync metadata with last_synced_values refreshed for resolved fields. */
  updatedSyncMetadata: SyncMetadata;
  /** Number of conflicts auto-resolved. */
  resolvedCount: number;
}

// ---------------------------------------------------------------------------
// Last-Write-Wins Resolution
// ---------------------------------------------------------------------------

/**
 * Apply last-write-wins resolution: remote (inbound) value wins.
 *
 * For each conflict:
 * 1. Applies remote value to canonical_data (inbound wins)
 * 2. Creates sync_conflicts records with status 'resolved_remote'
 *    (preserving local value for recovery)
 * 3. Updates sync_metadata.last_synced_values with remote values
 *
 * Does NOT write the updated canonical/metadata to the records table —
 * the caller is responsible for the records update (allowing the caller
 * to combine clean remote changes + LWW resolved changes in one write).
 *
 * @param tx               - Drizzle transaction
 * @param tenantId         - Tenant UUID
 * @param recordId         - Record UUID
 * @param conflicts        - Detected conflicts from detectConflicts()
 * @param platform         - Source platform identifier
 * @param currentCanonical - Current canonical_data (should include clean changes already applied)
 * @param syncMetadata     - Current sync_metadata (null for pre-Phase-2B records)
 * @param platformRecordId - Platform record ID (for metadata creation fallback)
 * @param syncedFieldIds   - All synced field IDs (for metadata creation fallback)
 */
export async function applyLastWriteWins(
  tx: DrizzleClient,
  tenantId: string,
  recordId: string,
  conflicts: DetectedConflict[],
  platform: SyncPlatform,
  currentCanonical: Record<string, unknown>,
  syncMetadata: SyncMetadata | null,
  platformRecordId: string,
  syncedFieldIds: string[],
): Promise<LastWriteWinsResult> {
  if (conflicts.length === 0) {
    return {
      updatedCanonical: currentCanonical,
      updatedSyncMetadata: syncMetadata
        ?? createInitialSyncMetadata(platformRecordId, currentCanonical, syncedFieldIds),
      resolvedCount: 0,
    };
  }

  // 1. Apply remote values to canonical_data
  const updatedCanonical = { ...currentCanonical };
  for (const conflict of conflicts) {
    updatedCanonical[conflict.fieldId] = conflict.remoteValue;
  }

  // 2. Write sync_conflicts records with status 'resolved_remote'
  const rows = conflicts.map((conflict) => ({
    tenantId,
    recordId,
    fieldId: conflict.fieldId,
    localValue: conflict.localValue,
    remoteValue: conflict.remoteValue,
    baseValue: conflict.baseValue,
    platform,
    status: 'resolved_remote' as const,
  }));

  await tx.insert(syncConflicts).values(rows);

  // 3. Update sync_metadata.last_synced_values with remote values
  const conflictFieldIds = conflicts.map((c) => c.fieldId);
  const updatedSyncMetadata = syncMetadata
    ? updateLastSyncedValues(syncMetadata, conflictFieldIds, updatedCanonical)
    : createInitialSyncMetadata(platformRecordId, updatedCanonical, syncedFieldIds);

  logger.info(
    { recordId, count: conflicts.length },
    `Auto-resolved ${conflicts.length} conflicts via last-write-wins for record ${recordId}`,
  );

  return {
    updatedCanonical,
    updatedSyncMetadata,
    resolvedCount: conflicts.length,
  };
}
