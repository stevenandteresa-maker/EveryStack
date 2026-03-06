'use server';

/**
 * Server Action — Toggle manual conflict resolution for a synced connection.
 *
 * Updates base_connections.conflict_resolution between 'last_write_wins'
 * and 'manual'. Requires Manager+ permission.
 *
 * @see docs/reference/sync-engine.md § Conflict Resolution UX
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import {
  getDbForTenant,
  baseConnections,
  eq,
  and,
  writeAuditLog,
} from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { NotFoundError, wrapUnknownError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------

const toggleManualConflictResolutionSchema = z.object({
  baseConnectionId: z.string().uuid(),
  tableId: z.string().uuid(),
  enabled: z.boolean(),
});

export type ToggleManualConflictResolutionInput = z.input<
  typeof toggleManualConflictResolutionSchema
>;

// ---------------------------------------------------------------------------
// Server Action
// ---------------------------------------------------------------------------

/**
 * Toggle manual conflict resolution mode for a base connection.
 *
 * - enabled: true → 'manual' (conflicts held as pending, user resolves)
 * - enabled: false → 'last_write_wins' (remote wins, auto-resolved)
 *
 * Requires Owner, Admin, or Manager role.
 */
export async function toggleManualConflictResolution(
  input: z.input<typeof toggleManualConflictResolutionSchema>,
): Promise<{ baseConnectionId: string; enabled: boolean }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { baseConnectionId, tableId, enabled } =
    toggleManualConflictResolutionSchema.parse(input);

  const newMode = enabled ? 'manual' : 'last_write_wins';

  try {
    const db = getDbForTenant(tenantId, 'write');

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: baseConnections.id })
        .from(baseConnections)
        .where(
          and(
            eq(baseConnections.id, baseConnectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Connection not found');
      }

      await tx
        .update(baseConnections)
        .set({ conflictResolution: newMode })
        .where(
          and(
            eq(baseConnections.id, baseConnectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.conflict_resolution_updated',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: { conflictResolution: newMode, tableId },
        traceId: getTraceId(),
      });
    });

    return { baseConnectionId, enabled };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
