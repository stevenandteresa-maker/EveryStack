/**
 * Sync Settings — Data access functions for sync conflict resolution settings.
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX
 */

import {
  getDbForTenant,
  eq,
  and,
  baseConnections,
} from '@everystack/shared/db';
import type { ConflictResolutionStrategy } from '@everystack/shared/sync';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// getConflictResolutionMode
// ---------------------------------------------------------------------------

/**
 * Read the conflict resolution mode for a base connection.
 *
 * Returns 'last_write_wins' (default) or 'manual'.
 * Throws NotFoundError if the connection doesn't exist for this tenant.
 */
export async function getConflictResolutionMode(
  tenantId: string,
  baseConnectionId: string,
): Promise<ConflictResolutionStrategy> {
  const db = getDbForTenant(tenantId, 'read');

  const [row] = await db
    .select({
      conflictResolution: baseConnections.conflictResolution,
    })
    .from(baseConnections)
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new NotFoundError('Connection not found');
  }

  return (row.conflictResolution as ConflictResolutionStrategy) ?? 'last_write_wins';
}
