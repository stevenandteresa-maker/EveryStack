'use server';

/**
 * Server Actions — Sync Failure retry and skip operations.
 *
 * - retrySyncFailureAction: re-enqueue a single failure for next sync cycle
 * - skipSyncFailureAction: mark a failure as resolved (skipped)
 * - bulkRetrySyncFailuresAction: re-enqueue all pending failures
 * - bulkSkipSyncFailuresAction: skip all pending failures
 *
 * @see docs/reference/sync-engine.md § Partial Failure Recovery
 */

import { z } from 'zod';
import { requireRole } from '@everystack/shared/auth';
import { writeAuditLog } from '@everystack/shared/db';
import type { DrizzleTransaction } from '@everystack/shared/db';
import { getDbForTenant } from '@everystack/shared/db';
import {
  retrySyncFailure,
  skipSyncFailure,
  bulkRetrySyncFailures,
  bulkSkipSyncFailures,
} from '@everystack/shared/sync';
import { getAuthContext } from '@/lib/auth-context';
import { wrapUnknownError } from '@/lib/errors';
import { getTraceId } from '@everystack/shared/logging';

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const failureIdSchema = z.object({
  failureId: z.string().uuid(),
});

const connectionIdSchema = z.object({
  baseConnectionId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// retrySyncFailureAction
// ---------------------------------------------------------------------------

/**
 * Re-enqueue a single sync failure for retry on the next sync cycle.
 */
export async function retrySyncFailureAction(
  input: z.input<typeof failureIdSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { failureId } = failureIdSchema.parse(input);

  try {
    await retrySyncFailure(tenantId, failureId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'sync_failure.retry',
        entityType: 'sync_failure',
        entityId: failureId,
        details: {},
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// skipSyncFailureAction
// ---------------------------------------------------------------------------

/**
 * Skip a sync failure — mark as resolved without retrying.
 */
export async function skipSyncFailureAction(
  input: z.input<typeof failureIdSchema>,
): Promise<void> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { failureId } = failureIdSchema.parse(input);

  try {
    await skipSyncFailure(tenantId, failureId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'sync_failure.skipped',
        entityType: 'sync_failure',
        entityId: failureId,
        details: {},
        traceId: getTraceId(),
      });
    });
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// bulkRetrySyncFailuresAction
// ---------------------------------------------------------------------------

/**
 * Re-enqueue all pending failures for a connection.
 */
export async function bulkRetrySyncFailuresAction(
  input: z.input<typeof connectionIdSchema>,
): Promise<{ retried: number }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { baseConnectionId } = connectionIdSchema.parse(input);

  try {
    const retried = await bulkRetrySyncFailures(tenantId, baseConnectionId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'sync_failure.bulk_retry',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: { retriedCount: retried },
        traceId: getTraceId(),
      });
    });

    return { retried };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}

// ---------------------------------------------------------------------------
// bulkSkipSyncFailuresAction
// ---------------------------------------------------------------------------

/**
 * Skip all pending failures for a connection.
 */
export async function bulkSkipSyncFailuresAction(
  input: z.input<typeof connectionIdSchema>,
): Promise<{ skipped: number }> {
  const { userId, tenantId } = await getAuthContext();
  await requireRole(userId, tenantId, undefined, 'manager', 'connection', 'update');

  const { baseConnectionId } = connectionIdSchema.parse(input);

  try {
    const skipped = await bulkSkipSyncFailures(tenantId, baseConnectionId, userId);

    const db = getDbForTenant(tenantId, 'write');
    await db.transaction(async (tx) => {
      await writeAuditLog(tx as DrizzleTransaction, {
        tenantId,
        actorType: 'user',
        actorId: userId,
        action: 'sync_failure.bulk_skip',
        entityType: 'connection',
        entityId: baseConnectionId,
        details: { skippedCount: skipped },
        traceId: getTraceId(),
      });
    });

    return { skipped };
  } catch (error) {
    throw wrapUnknownError(error);
  }
}
