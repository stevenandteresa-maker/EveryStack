/**
 * Record data access functions.
 *
 * @see docs/reference/data-model.md § Records
 */

import {
  getDbForTenant,
  eq,
  and,
  isNull,
  asc,
  count,
  records,
} from '@everystack/shared/db';
import type { DbRecord } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';
import { getQueue } from '@/lib/queue';

// ---------------------------------------------------------------------------
// Query option types
// ---------------------------------------------------------------------------

export interface GetRecordsByTableOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface PaginatedRecords {
  records: DbRecord[];
  totalCount: number;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// getRecordsByTable
// ---------------------------------------------------------------------------

/**
 * Paginated records query for a table.
 *
 * Excludes soft-deleted records (archived_at IS NOT NULL).
 * Uses composite PK (tenant_id, id) for all filtering.
 * Default limit: 100.
 */
export async function getRecordsByTable(
  tenantId: string,
  tableId: string,
  options?: GetRecordsByTableOptions,
): Promise<PaginatedRecords> {
  const db = getDbForTenant(tenantId, 'read');
  const limit = options?.limit ?? 100;
  const offset = options?.offset ?? 0;

  const baseWhere = and(
    eq(records.tenantId, tenantId),
    eq(records.tableId, tableId),
    isNull(records.archivedAt),
  );

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(records)
      .where(baseWhere)
      .orderBy(asc(records.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(records)
      .where(baseWhere),
  ]);

  const totalCount = Number(countResult[0]?.value ?? 0);

  return {
    records: rows,
    totalCount,
    hasMore: offset + rows.length < totalCount,
  };
}

// ---------------------------------------------------------------------------
// getRecordById
// ---------------------------------------------------------------------------

/**
 * Fetch a single record by ID.
 *
 * Uses composite PK (tenant_id, id) for lookup.
 * Throws NotFoundError if not found or soft-deleted.
 */
export async function getRecordById(
  tenantId: string,
  recordId: string,
): Promise<DbRecord> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.tenantId, tenantId),
        eq(records.id, recordId),
        isNull(records.archivedAt),
      ),
    )
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new NotFoundError('Record not found');
  }

  return row;
}

// ---------------------------------------------------------------------------
// Outbound sync status types
// ---------------------------------------------------------------------------

export type OutboundSyncStatus = 'synced' | 'pending' | 'failed';

// ---------------------------------------------------------------------------
// getOutboundSyncStatus
// ---------------------------------------------------------------------------

/**
 * Check the outbound sync status for a record edit.
 *
 * Looks up the BullMQ job state for the outbound sync job keyed by
 * `outbound:{tenantId}:{recordId}`. Returns:
 * - 'synced'  — no pending job found (already completed or never enqueued)
 * - 'pending' — job is waiting, delayed, or active
 * - 'failed'  — job has failed all retry attempts
 */
export async function getOutboundSyncStatus(
  tenantId: string,
  recordId: string,
  _fieldId: string,
): Promise<OutboundSyncStatus> {
  const queue = getQueue('sync:outbound');
  const jobId = `outbound:${tenantId}:${recordId}`;

  const job = await queue.getJob(jobId);

  if (!job) {
    return 'synced';
  }

  const state = await job.getState();

  switch (state) {
    case 'waiting':
    case 'delayed':
    case 'active':
    case 'waiting-children':
      return 'pending';
    case 'failed':
      return 'failed';
    case 'completed':
    default:
      return 'synced';
  }
}
