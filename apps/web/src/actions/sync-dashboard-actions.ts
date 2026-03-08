'use server';

/**
 * Server Actions — Sync Dashboard operations.
 *
 * - syncNowAction: enqueue an immediate P0 incremental sync
 * - pauseSyncAction: pause the sync connection
 * - resumeSyncAction: resume a paused connection and enqueue catch-up sync
 * - disconnectSyncAction: disconnect (revoke tokens, keep data)
 *
 * @see docs/reference/sync-engine.md § Sync Connection Status Model
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import {
  getDbForTenant,
  eq,
  and,
  writeAuditLog,
  baseConnections,
} from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError, NotFoundError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import { getQueue } from '@/lib/queue';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const baseConnectionIdSchema = z.object({
  baseConnectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// syncNowAction
// ---------------------------------------------------------------------------

/**
 * Trigger an immediate incremental sync for a connection.
 *
 * Enqueues a P0 (highest priority) sync job. The connection must be active
 * (not paused) to trigger a manual sync.
 */
export async function syncNowAction(
  input: z.input<typeof baseConnectionIdSchema>,
): Promise<{ success: true }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { baseConnectionId } = baseConnectionIdSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'read');

    // Verify connection exists and is not paused
    const [connection] = await db
      .select({
        id: baseConnections.id,
        syncStatus: baseConnections.syncStatus,
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

    if (connection.syncStatus === 'paused') {
      throw new Error('Cannot trigger sync on a paused connection. Resume the connection first.');
    }

    // Enqueue P0 incremental sync
    const queue = getQueue('sync');
    await queue.add(
      'sync.incremental',
      {
        tenantId,
        connectionId: baseConnectionId,
        traceId: getTraceId() ?? '',
        triggeredBy: userId,
      },
      { priority: 0 },
    );

    // Audit log
    const writeDb = getDbForTenant(tenantId, 'write');
    await writeDb.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.sync_now',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: {},
        traceId: getTraceId(),
      });
    });

    return { success: true };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// pauseSyncAction
// ---------------------------------------------------------------------------

/**
 * Pause a sync connection.
 *
 * Sets syncStatus to 'paused'. No further sync jobs will be processed
 * until the connection is resumed.
 */
export async function pauseSyncAction(
  input: z.input<typeof baseConnectionIdSchema>,
): Promise<{ success: true; syncStatus: 'paused' }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { baseConnectionId } = baseConnectionIdSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    // Verify connection exists
    const [connection] = await db
      .select({ id: baseConnections.id })
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

    await db.transaction(async (tx) => {
      await tx
        .update(baseConnections)
        .set({ syncStatus: 'paused' })
        .where(eq(baseConnections.id, baseConnectionId));

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.paused',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: {},
        traceId: getTraceId(),
      });
    });

    return { success: true, syncStatus: 'paused' };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// resumeSyncAction
// ---------------------------------------------------------------------------

/**
 * Resume a paused sync connection.
 *
 * Sets syncStatus back to 'active' and enqueues an immediate P1 catch-up
 * sync to re-sync any changes that occurred while paused.
 */
export async function resumeSyncAction(
  input: z.input<typeof baseConnectionIdSchema>,
): Promise<{ success: true; syncStatus: 'active' }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { baseConnectionId } = baseConnectionIdSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    // Verify connection exists
    const [connection] = await db
      .select({ id: baseConnections.id })
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

    await db.transaction(async (tx) => {
      await tx
        .update(baseConnections)
        .set({ syncStatus: 'active' })
        .where(eq(baseConnections.id, baseConnectionId));

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.resumed',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: {},
        traceId: getTraceId(),
      });
    });

    // Enqueue P1 catch-up sync after resume
    const queue = getQueue('sync');
    await queue.add(
      'sync.incremental',
      {
        tenantId,
        connectionId: baseConnectionId,
        traceId: getTraceId() ?? '',
        triggeredBy: userId,
      },
      { priority: 1 },
    );

    return { success: true, syncStatus: 'active' };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// disconnectSyncAction
// ---------------------------------------------------------------------------

/**
 * Disconnect a sync connection.
 *
 * Pauses the connection and clears OAuth tokens. Synced data (tables, records)
 * is NOT deleted — tables remain as local-only. This is a destructive action
 * requiring admin role.
 */
export async function disconnectSyncAction(
  input: z.input<typeof baseConnectionIdSchema>,
): Promise<{ success: true }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'delete');

  const { baseConnectionId } = baseConnectionIdSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    // Verify connection exists
    const [connection] = await db
      .select({ id: baseConnections.id })
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

    await db.transaction(async (tx) => {
      // Pause and clear tokens — tables remain as local-only
      await tx
        .update(baseConnections)
        .set({
          syncStatus: 'paused',
          oauthTokens: null,
        })
        .where(eq(baseConnections.id, baseConnectionId));

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.disconnected',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: {},
        traceId: getTraceId(),
      });
    });

    return { success: true };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
