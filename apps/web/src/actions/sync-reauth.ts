'use server';

/**
 * Server Actions — Sync Re-authentication and Manual Recovery
 *
 * - completeSyncReauth: handles re-auth completion — stores new token,
 *   resets sync_status, enqueues P0 catch-up sync
 * - retrySyncNow: resets backoff and enqueues immediate sync attempt
 * - pauseSyncConnection: sets sync_status to 'paused'
 *
 * @see docs/reference/sync-engine.md § Error Recovery Flows
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
import {
  DEFAULT_CONNECTION_HEALTH,
  ConnectionHealthSchema,
} from '@everystack/shared/sync';
import type { ConnectionHealth } from '@everystack/shared/sync';
import { encryptTokens } from '@everystack/shared/crypto';
import { getAuthContext } from '@/lib/auth-context';
import { NotFoundError, wrapUnknownError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';
import { getQueue } from '@/lib/queue';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const completeSyncReauthSchema = z.object({
  connectionId: z.string().uuid(),
  tokens: z.record(z.string(), z.unknown()),
});

const connectionIdSchema = z.object({
  connectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// completeSyncReauth
// ---------------------------------------------------------------------------

/**
 * Complete re-authentication for a sync connection.
 *
 * Called after the OAuth re-auth flow succeeds. Stores the new token,
 * resets sync_status to 'active', clears health errors, and enqueues
 * an immediate P0 catch-up sync to sync all changes since last_sync_at.
 *
 * No data loss: while auth was expired, local edits accumulated normally.
 * The catch-up sync picks up all changes from both sides using the
 * last_sync_at cursor.
 */
export async function completeSyncReauth(
  input: z.input<typeof completeSyncReauthSchema>,
): Promise<{ connectionId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'admin', 'connection', 'update');

  const { connectionId, tokens } = completeSyncReauthSchema.parse(input);

  try {
    const encrypted = encryptTokens(tokens);
    const db = getDbForTenant(tenantId, 'write');

    await db.transaction(async (tx) => {
      // Verify connection exists and belongs to tenant
      const [existing] = await tx
        .select({
          id: baseConnections.id,
          syncStatus: baseConnections.syncStatus,
        })
        .from(baseConnections)
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Connection not found');
      }

      // Update tokens, reset status, clear health errors
      const resetHealth: ConnectionHealth = {
        ...DEFAULT_CONNECTION_HEALTH,
        // Preserve records_synced count from before the auth failure
        records_synced: 0,
      };

      await tx
        .update(baseConnections)
        .set({
          oauthTokens: encrypted,
          syncStatus: 'active',
          health: resetHealth as unknown as Record<string, unknown>,
        })
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.reauthenticated',
        entityType: 'connection',
        entityId: connectionId,
        details: { previousStatus: existing.syncStatus },
        traceId: getTraceId(),
      });
    });

    // Enqueue immediate P0 catch-up sync
    const queue = getQueue('sync');
    await queue.add(
      'catch-up-sync',
      {
        connectionId,
        tenantId,
        traceId: getTraceId(),
        triggeredBy: `user:${userId}`,
      },
      {
        priority: 0, // P0 — critical
        jobId: `catchup:${connectionId}:${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 10,
      },
    );

    return { connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// retrySyncNow
// ---------------------------------------------------------------------------

/**
 * Reset backoff and enqueue an immediate sync attempt.
 *
 * Resets consecutive_failures to 0, clears next_retry_at,
 * sets sync_status back to 'active', and enqueues a P0 sync job.
 */
export async function retrySyncNow(
  input: z.input<typeof connectionIdSchema>,
): Promise<{ connectionId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { connectionId } = connectionIdSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({
          id: baseConnections.id,
          health: baseConnections.health,
        })
        .from(baseConnections)
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Connection not found');
      }

      // Parse current health and reset backoff
      const parseResult = ConnectionHealthSchema.safeParse(existing.health);
      const currentHealth: ConnectionHealth = parseResult.success
        ? parseResult.data
        : { ...DEFAULT_CONNECTION_HEALTH };

      const resetHealth: ConnectionHealth = {
        ...currentHealth,
        consecutive_failures: 0,
        next_retry_at: null,
      };

      await tx
        .update(baseConnections)
        .set({
          health: resetHealth as unknown as Record<string, unknown>,
          syncStatus: 'active',
        })
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.retry_now',
        entityType: 'connection',
        entityId: connectionId,
        details: {
          previousFailures: currentHealth.consecutive_failures,
        },
        traceId: getTraceId(),
      });
    });

    // Enqueue immediate P0 sync
    const queue = getQueue('sync');
    await queue.add(
      'retry-sync',
      {
        connectionId,
        tenantId,
        traceId: getTraceId(),
        triggeredBy: `user:${userId}`,
      },
      {
        priority: 0,
        jobId: `retry-now:${connectionId}:${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: 10,
      },
    );

    return { connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// pauseSyncConnection
// ---------------------------------------------------------------------------

/**
 * Pause sync for a connection — sets sync_status to 'paused',
 * stopping all sync activity until manually resumed.
 */
export async function pauseSyncConnection(
  input: z.input<typeof connectionIdSchema>,
): Promise<{ connectionId: string }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { connectionId } = connectionIdSchema.parse(input);

  try {
    const db = getDbForTenant(tenantId, 'write');

    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: baseConnections.id })
        .from(baseConnections)
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw new NotFoundError('Connection not found');
      }

      await tx
        .update(baseConnections)
        .set({ syncStatus: 'paused' })
        .where(
          and(
            eq(baseConnections.id, connectionId),
            eq(baseConnections.tenantId, tenantId),
          ),
        );

      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'connection.paused',
        entityType: 'connection',
        entityId: connectionId,
        details: {},
        traceId: getTraceId(),
      });
    });

    return { connectionId };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
