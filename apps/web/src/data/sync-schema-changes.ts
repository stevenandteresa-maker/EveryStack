/**
 * Sync Schema Changes Data — Server-side functions to fetch schema changes
 * for the Schema Changes tab UI.
 *
 * @see docs/reference/sync-engine.md § Schema Mismatch
 */

import {
  getSchemaChangesForConnection,
  countPendingSchemaChanges,
} from '@everystack/shared/sync';
import type { SyncSchemaChangeRow } from '@everystack/shared/sync';

// Re-export for UI consumption
export type { SyncSchemaChangeRow };

// ---------------------------------------------------------------------------
// getSyncSchemaChanges
// ---------------------------------------------------------------------------

/**
 * Fetches schema changes for a connection.
 * Used by the Schema Changes tab of the Sync Settings Dashboard.
 */
export async function getSyncSchemaChanges(
  tenantId: string,
  baseConnectionId: string,
): Promise<SyncSchemaChangeRow[]> {
  return getSchemaChangesForConnection(tenantId, baseConnectionId);
}

// ---------------------------------------------------------------------------
// getPendingSchemaChangeCount
// ---------------------------------------------------------------------------

/**
 * Count pending schema changes for badge display.
 */
export async function getPendingSchemaChangeCount(
  tenantId: string,
  baseConnectionId: string,
): Promise<number> {
  return countPendingSchemaChanges(tenantId, baseConnectionId);
}
