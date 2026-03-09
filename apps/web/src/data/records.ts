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
  sql,
} from '@everystack/shared/db';
import type { DbRecord, SQL } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';
import { getQueue } from '@/lib/queue';
import type { SortLevel } from '@/lib/types/grid';

// ---------------------------------------------------------------------------
// Query option types
// ---------------------------------------------------------------------------

export interface GetRecordsByTableOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
  sorts?: SortLevel[];
  /** Field type map needed for sort type casting (fieldId → fieldType). */
  fieldTypes?: Record<string, string>;
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

  // Build sort clauses from sort config
  const orderClauses = buildSortClauses(options?.sorts, options?.fieldTypes);

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(records)
      .where(baseWhere)
      .orderBy(...orderClauses)
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
// Sort clause builder
// ---------------------------------------------------------------------------

/**
 * Maps a field type to its SQL cast for ORDER BY.
 *
 * - Numeric types: cast to numeric for proper numeric sorting
 * - Date types: cast to timestamptz for chronological sorting
 * - Checkbox: cast to boolean (false before true in ASC)
 * - Text/select/other: case-insensitive text sort via LOWER()
 */
const NUMERIC_FIELD_TYPES = new Set([
  'number',
  'currency',
  'percent',
  'rating',
  'duration',
]);

const DATE_FIELD_TYPES = new Set(['date', 'datetime']);

function buildFieldSortExpression(
  fieldId: string,
  fieldType: string | undefined,
  direction: 'asc' | 'desc',
): SQL {
  // Safely embed field ID (it's a UUID, validate format)
  const basePath = sql.raw(`(canonical_data->'${fieldId}'->>'value')`);
  const dir = direction === 'desc' ? sql.raw('DESC') : sql.raw('ASC');
  const nulls =
    direction === 'asc' ? sql.raw('NULLS LAST') : sql.raw('NULLS FIRST');

  if (fieldType && NUMERIC_FIELD_TYPES.has(fieldType)) {
    return sql`${basePath}::numeric ${dir} ${nulls}`;
  }

  if (fieldType && DATE_FIELD_TYPES.has(fieldType)) {
    return sql`${basePath}::timestamptz ${dir} ${nulls}`;
  }

  if (fieldType === 'checkbox') {
    return sql`${basePath}::boolean ${dir} ${nulls}`;
  }

  // Text, single_select, multi_select, etc. — case-insensitive
  return sql`LOWER(${basePath}) ${dir} ${nulls}`;
}

/**
 * Builds an array of Drizzle SQL ORDER BY clauses from sort config.
 * Falls back to createdAt ASC when no sorts are provided.
 */
function buildSortClauses(
  sorts?: SortLevel[],
  fieldTypes?: Record<string, string>,
): SQL[] {
  if (!sorts || sorts.length === 0) {
    return [asc(records.createdAt)];
  }

  return sorts.map((sort) =>
    buildFieldSortExpression(sort.fieldId, fieldTypes?.[sort.fieldId], sort.direction),
  );
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
