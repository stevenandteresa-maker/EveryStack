/**
 * Sync Failures — Data access functions for the sync_failures table.
 *
 * Provides CRUD for tracking individual record failures during sync,
 * auto-retry logic (3 attempts then requires_manual_resolution),
 * and bulk retry/skip operations.
 *
 * @see docs/reference/sync-engine.md § Partial Failure Recovery
 */

import {
  getDbForTenant,
  syncFailures,
  eq,
  and,
  inArray,
  sql,
} from '@everystack/shared/db';
import type { SyncFailure } from '@everystack/shared/db';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum auto-retry attempts before requiring manual resolution. */
export const MAX_AUTO_RETRY_COUNT = 3;

/** Retention period for resolved failures (30 days in ms). */
export const RESOLVED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateSyncFailureInput {
  baseConnectionId: string;
  recordId?: string | null;
  direction: 'inbound' | 'outbound';
  errorCode: 'validation' | 'schema_mismatch' | 'payload_too_large' | 'platform_rejected' | 'unknown';
  errorMessage: string;
  platformRecordId?: string | null;
  payload?: unknown;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Record a sync failure for an individual record.
 */
export async function createSyncFailure(
  tenantId: string,
  failure: CreateSyncFailureInput,
): Promise<SyncFailure> {
  const db = getDbForTenant(tenantId, 'write');

  const rows = await db
    .insert(syncFailures)
    .values({
      tenantId,
      baseConnectionId: failure.baseConnectionId,
      recordId: failure.recordId ?? null,
      direction: failure.direction,
      errorCode: failure.errorCode,
      errorMessage: failure.errorMessage,
      platformRecordId: failure.platformRecordId ?? null,
      payload: failure.payload ?? null,
      retryCount: 0,
      status: 'pending',
    })
    .returning();

  return rows[0] as SyncFailure;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get all sync failures for a connection, ordered newest first.
 * Excludes resolved/skipped failures older than 30 days.
 */
export async function getSyncFailuresForConnection(
  tenantId: string,
  baseConnectionId: string,
): Promise<SyncFailure[]> {
  const db = getDbForTenant(tenantId, 'read');

  const cutoff = new Date(Date.now() - RESOLVED_RETENTION_MS);

  return db
    .select()
    .from(syncFailures)
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
        // Exclude old resolved/skipped failures
        sql`(${syncFailures.status} NOT IN ('resolved', 'skipped') OR ${syncFailures.resolvedAt} > ${cutoff})`,
      ),
    )
    .orderBy(sql`${syncFailures.createdAt} DESC`);
}

/**
 * Get pending failures eligible for auto-retry (retry_count < MAX_AUTO_RETRY_COUNT).
 */
export async function getPendingRetriableFailures(
  tenantId: string,
  baseConnectionId: string,
): Promise<SyncFailure[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(syncFailures)
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
        eq(syncFailures.status, 'pending'),
        sql`${syncFailures.retryCount} < ${MAX_AUTO_RETRY_COUNT}`,
      ),
    );
}

// ---------------------------------------------------------------------------
// Single retry / skip
// ---------------------------------------------------------------------------

/**
 * Mark a failure for retry — resets status to 'pending' so the next
 * sync cycle will re-attempt it.
 */
export async function retrySyncFailure(
  tenantId: string,
  failureId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(syncFailures)
    .set({
      status: 'pending',
      resolvedAt: null,
      resolvedBy: null,
    })
    .where(
      and(
        eq(syncFailures.id, failureId),
        eq(syncFailures.tenantId, tenantId),
      ),
    );
}

/**
 * Skip a failure — marks it as resolved without retrying.
 */
export async function skipSyncFailure(
  tenantId: string,
  failureId: string,
  resolvedBy: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(syncFailures)
    .set({
      status: 'skipped',
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(
      and(
        eq(syncFailures.id, failureId),
        eq(syncFailures.tenantId, tenantId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Bulk retry / skip
// ---------------------------------------------------------------------------

/**
 * Re-enqueue all pending/requires_manual_resolution failures for a connection.
 * Returns the count of re-enqueued failures.
 */
export async function bulkRetrySyncFailures(
  tenantId: string,
  baseConnectionId: string,
): Promise<number> {
  const db = getDbForTenant(tenantId, 'write');

  const result = await db
    .update(syncFailures)
    .set({
      status: 'pending',
      resolvedAt: null,
      resolvedBy: null,
    })
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
        inArray(syncFailures.status, ['pending', 'requires_manual_resolution']),
      ),
    )
    .returning({ id: syncFailures.id });

  return result.length;
}

/**
 * Skip all pending/requires_manual_resolution failures for a connection.
 * Returns the count of skipped failures.
 */
export async function bulkSkipSyncFailures(
  tenantId: string,
  baseConnectionId: string,
  resolvedBy: string,
): Promise<number> {
  const db = getDbForTenant(tenantId, 'write');

  const result = await db
    .update(syncFailures)
    .set({
      status: 'skipped',
      resolvedAt: new Date(),
      resolvedBy,
    })
    .where(
      and(
        eq(syncFailures.tenantId, tenantId),
        eq(syncFailures.baseConnectionId, baseConnectionId),
        inArray(syncFailures.status, ['pending', 'requires_manual_resolution']),
      ),
    )
    .returning({ id: syncFailures.id });

  return result.length;
}

// ---------------------------------------------------------------------------
// Auto-retry processing (called from inbound sync pipeline)
// ---------------------------------------------------------------------------

/**
 * Increment retry count on a failure. If retry_count reaches
 * MAX_AUTO_RETRY_COUNT, transition to 'requires_manual_resolution'.
 */
export async function incrementRetryCount(
  tenantId: string,
  failureId: string,
): Promise<{ newRetryCount: number; requiresManual: boolean }> {
  const db = getDbForTenant(tenantId, 'write');

  const [updated] = await db
    .update(syncFailures)
    .set({
      retryCount: sql`${syncFailures.retryCount} + 1`,
      status: sql`CASE WHEN ${syncFailures.retryCount} + 1 >= ${MAX_AUTO_RETRY_COUNT} THEN 'requires_manual_resolution' ELSE 'pending' END`,
    })
    .where(
      and(
        eq(syncFailures.id, failureId),
        eq(syncFailures.tenantId, tenantId),
      ),
    )
    .returning({
      retryCount: syncFailures.retryCount,
      status: syncFailures.status,
    });

  const newRetryCount = updated?.retryCount ?? 0;
  return {
    newRetryCount,
    requiresManual: updated?.status === 'requires_manual_resolution',
  };
}

/**
 * Mark a failure as resolved (successful retry).
 */
export async function markFailureResolved(
  tenantId: string,
  failureId: string,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  await db
    .update(syncFailures)
    .set({
      status: 'resolved',
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(syncFailures.id, failureId),
        eq(syncFailures.tenantId, tenantId),
      ),
    );
}
