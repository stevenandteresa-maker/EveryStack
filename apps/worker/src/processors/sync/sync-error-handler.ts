/**
 * Sync Error Handler — Centralized error classification and recovery routing.
 *
 * Invoked by the sync pipeline when a sync attempt fails. Classifies errors
 * into one of the 8 SyncErrorCode categories, updates connection health,
 * transitions sync_status, and schedules retries for retryable errors.
 *
 * Error classification:
 * - HTTP 401/403 → auth_expired or permission_denied
 * - HTTP 429 → rate_limited (auto-recovery via backoff)
 * - HTTP 5xx or timeout → platform_unavailable
 * - Validation errors on records → partial_failure
 * - Schema structure changes → schema_mismatch
 *
 * @see docs/reference/sync-engine.md § Error Recovery Flows
 */

import type { Logger } from '@everystack/shared/logging';
import {
  getDbForTenant,
  baseConnections,
  eq,
  and,
} from '@everystack/shared/db';
import {
  updateConnectionHealth,
} from '@everystack/shared/sync';
import type {
  ConnectionHealth,
  SyncErrorCode,
} from '@everystack/shared/sync';
import { ConnectionHealthSchema } from '@everystack/shared/sync';
import { getQueue } from '../../queues';

// ---------------------------------------------------------------------------
// Backoff schedule — 1m, 5m, 15m, 1h, 3h, 6h
// ---------------------------------------------------------------------------

export const BACKOFF_SCHEDULE = [
  60_000,
  300_000,
  900_000,
  3_600_000,
  10_800_000,
  21_600_000,
] as const;

/**
 * Returns the backoff delay in ms for the given number of consecutive failures,
 * or null if max retries have been exceeded.
 */
export function getBackoffDelay(consecutiveFailures: number): number | null {
  if (consecutiveFailures >= BACKOFF_SCHEDULE.length) return null;
  return BACKOFF_SCHEDULE[consecutiveFailures] ?? null;
}

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Context passed to the sync error handler from the sync pipeline.
 */
export interface SyncJobContext {
  tenantId: string;
  connectionId: string;
  traceId: string;
  logger: Logger;
}

/**
 * Classifies an unknown error into one of the 8 SyncErrorCode categories.
 *
 * Checks for HTTP status codes on common error shapes (e.g. response.status,
 * error.status, statusCode). Falls back to message-based heuristics.
 */
export function classifyError(error: unknown): {
  code: SyncErrorCode;
  message: string;
  retryable: boolean;
} {
  const httpStatus = extractHttpStatus(error);
  const errorMessage = extractErrorMessage(error);

  if (httpStatus === 401) {
    return {
      code: 'auth_expired',
      message: 'OAuth token expired or revoked',
      retryable: false,
    };
  }

  if (httpStatus === 403) {
    return {
      code: 'permission_denied',
      message: 'Integration no longer has access to this resource',
      retryable: false,
    };
  }

  if (httpStatus === 429) {
    return {
      code: 'rate_limited',
      message: 'Platform API rate limit exceeded',
      retryable: true,
    };
  }

  if (httpStatus !== null && httpStatus >= 500) {
    return {
      code: 'platform_unavailable',
      message: `Platform returned ${httpStatus}`,
      retryable: true,
    };
  }

  // Timeout detection (common error codes/messages)
  if (isTimeoutError(error)) {
    return {
      code: 'platform_unavailable',
      message: 'Platform request timed out',
      retryable: true,
    };
  }

  // Validation errors on individual records
  if (isValidationError(error, errorMessage)) {
    return {
      code: 'partial_failure',
      message: errorMessage,
      retryable: false,
    };
  }

  // Schema mismatch
  if (isSchemaError(errorMessage)) {
    return {
      code: 'schema_mismatch',
      message: errorMessage,
      retryable: false,
    };
  }

  // Quota exceeded
  if (isQuotaError(errorMessage)) {
    return {
      code: 'quota_exceeded',
      message: errorMessage,
      retryable: false,
    };
  }

  return {
    code: 'unknown',
    message: errorMessage || 'An unknown sync error occurred',
    retryable: false,
  };
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

/**
 * Centralized sync error handler. Called by the sync pipeline when a sync
 * attempt fails.
 *
 * 1. Classifies the error into one of 8 SyncErrorCode categories
 * 2. Updates base_connections.health via updateConnectionHealth()
 * 3. Transitions sync_status based on error type
 * 4. Schedules retry (for retryable errors) or marks for manual intervention
 */
export async function handleSyncError(
  baseConnectionId: string,
  error: unknown,
  context: SyncJobContext,
): Promise<void> {
  const { tenantId, logger } = context;

  // 1. Classify error
  const classification = classifyError(error);

  logger.error(
    {
      connectionId: baseConnectionId,
      errorCode: classification.code,
      errorMessage: classification.message,
      retryable: classification.retryable,
    },
    'Sync error classified',
  );

  // 2. Load current health
  const db = getDbForTenant(tenantId, 'read');
  const [connection] = await db
    .select({
      health: baseConnections.health,
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
    logger.warn({ connectionId: baseConnectionId }, 'Connection not found for error handling');
    return;
  }

  // Parse existing health
  const parseResult = ConnectionHealthSchema.safeParse(connection.health);
  const currentHealth: ConnectionHealth | null = parseResult.success
    ? parseResult.data
    : null;

  // 3. Update health with error
  const updatedHealth = updateConnectionHealth(currentHealth, 'sync_error', {
    code: classification.code,
    message: classification.message,
    retryable: classification.retryable,
  });

  // 4. Determine sync_status transition and next_retry_at
  let newSyncStatus: string;
  let nextRetryAt: string | null = null;

  switch (classification.code) {
    case 'auth_expired':
    case 'permission_denied':
      // Non-retryable: mark as auth_required, stop sync
      newSyncStatus = 'auth_required';
      break;

    case 'rate_limited':
    case 'platform_unavailable': {
      // Retryable: exponential backoff
      const backoffDelay = getBackoffDelay(updatedHealth.consecutive_failures - 1);
      if (backoffDelay !== null) {
        nextRetryAt = new Date(Date.now() + backoffDelay).toISOString();
        newSyncStatus = connection.syncStatus; // keep current status during retries
      } else {
        // Max retries exceeded — mark as error
        newSyncStatus = 'error';
      }
      break;
    }

    default:
      // partial_failure, schema_mismatch, quota_exceeded, unknown
      // Keep current status for partial failures (connection still works)
      // Mark as error for schema/quota/unknown
      if (classification.code === 'partial_failure') {
        newSyncStatus = connection.syncStatus;
      } else {
        newSyncStatus = 'error';
      }
      break;
  }

  // Set next_retry_at on the health object
  const finalHealth: ConnectionHealth = {
    ...updatedHealth,
    next_retry_at: nextRetryAt,
  };

  // 5. Write updated health and sync_status
  const writeDb = getDbForTenant(tenantId, 'write');
  await writeDb
    .update(baseConnections)
    .set({
      health: finalHealth as unknown as Record<string, unknown>,
      syncStatus: newSyncStatus,
    })
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    );

  // 6. Schedule retry if applicable
  if (nextRetryAt) {
    const delayMs = new Date(nextRetryAt).getTime() - Date.now();
    await scheduleRetrySync(baseConnectionId, tenantId, context.traceId, delayMs);

    logger.info(
      {
        connectionId: baseConnectionId,
        nextRetryAt,
        consecutiveFailures: finalHealth.consecutive_failures,
        delayMs,
      },
      'Retry sync scheduled',
    );
  } else if (newSyncStatus === 'error' || newSyncStatus === 'auth_required') {
    logger.warn(
      {
        connectionId: baseConnectionId,
        syncStatus: newSyncStatus,
        errorCode: classification.code,
      },
      'Sync stopped — manual intervention required',
    );
  }
}

// ---------------------------------------------------------------------------
// Retry scheduling
// ---------------------------------------------------------------------------

async function scheduleRetrySync(
  connectionId: string,
  tenantId: string,
  traceId: string,
  delayMs: number,
): Promise<void> {
  const queue = getQueue('sync');
  await queue.add(
    'retry-sync',
    {
      connectionId,
      tenantId,
      traceId,
      triggeredBy: 'system:retry',
    },
    {
      delay: delayMs,
      jobId: `retry:${connectionId}:${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: 10,
    },
  );
}

// ---------------------------------------------------------------------------
// Manual recovery actions
// ---------------------------------------------------------------------------

/**
 * Reset backoff and enqueue an immediate sync attempt.
 * Called when a user clicks "Retry Now".
 */
export async function retryNow(
  baseConnectionId: string,
  tenantId: string,
  traceId: string,
): Promise<void> {
  const writeDb = getDbForTenant(tenantId, 'write');

  // Load current health
  const db = getDbForTenant(tenantId, 'read');
  const [connection] = await db
    .select({ health: baseConnections.health })
    .from(baseConnections)
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    )
    .limit(1);

  const parseResult = ConnectionHealthSchema.safeParse(connection?.health);
  const currentHealth: ConnectionHealth | null = parseResult.success
    ? parseResult.data
    : null;

  // Reset consecutive_failures and next_retry_at
  const resetHealth: ConnectionHealth = {
    ...(currentHealth ?? {
      last_success_at: null,
      last_error: null,
      consecutive_failures: 0,
      next_retry_at: null,
      records_synced: 0,
      records_failed: 0,
    }),
    consecutive_failures: 0,
    next_retry_at: null,
  };

  await writeDb
    .update(baseConnections)
    .set({
      health: resetHealth as unknown as Record<string, unknown>,
      syncStatus: 'active',
    })
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    );

  // Enqueue immediate sync
  const queue = getQueue('sync');
  await queue.add(
    'retry-sync',
    {
      connectionId: baseConnectionId,
      tenantId,
      traceId,
      triggeredBy: 'user:retry_now',
    },
    {
      priority: 0, // P0 — critical
      jobId: `retry-now:${baseConnectionId}:${Date.now()}`,
      removeOnComplete: true,
      removeOnFail: 10,
    },
  );
}

/**
 * Pause sync — sets sync_status to 'paused', stopping all sync activity.
 * Called when a user clicks "Pause Sync".
 */
export async function pauseSync(
  baseConnectionId: string,
  tenantId: string,
): Promise<void> {
  const writeDb = getDbForTenant(tenantId, 'write');
  await writeDb
    .update(baseConnections)
    .set({ syncStatus: 'paused' })
    .where(
      and(
        eq(baseConnections.id, baseConnectionId),
        eq(baseConnections.tenantId, tenantId),
      ),
    );
}

// ---------------------------------------------------------------------------
// Helpers — HTTP status extraction
// ---------------------------------------------------------------------------

function extractHttpStatus(error: unknown): number | null {
  if (error === null || error === undefined) return null;

  if (typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // Direct status property
    if (typeof err.status === 'number') return err.status;
    if (typeof err.statusCode === 'number') return err.statusCode;

    // Nested response object (e.g. Axios-style)
    if (err.response && typeof err.response === 'object') {
      const resp = err.response as Record<string, unknown>;
      if (typeof resp.status === 'number') return resp.status;
      if (typeof resp.statusCode === 'number') return resp.statusCode;
    }
  }

  return null;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error !== null && error !== undefined && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    if (typeof err.message === 'string') return err.message;
  }
  return 'An unknown sync error occurred';
}

function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes('timeout') ||
      msg.includes('timed out') ||
      msg.includes('econnaborted') ||
      msg.includes('etimedout')
    );
  }
  if (error !== null && error !== undefined && typeof error === 'object') {
    const err = error as Record<string, unknown>;
    return err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';
  }
  return false;
}

function isValidationError(error: unknown, message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('validation') ||
    lower.includes('invalid value') ||
    lower.includes('field type mismatch')
  );
}

function isSchemaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('schema') ||
    lower.includes('field not found') ||
    lower.includes('field renamed') ||
    lower.includes('table not found')
  );
}

function isQuotaError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('quota') ||
    lower.includes('record limit') ||
    lower.includes('plan limit')
  );
}
