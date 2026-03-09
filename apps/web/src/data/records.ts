/**
 * Record data access functions.
 *
 * @see docs/reference/data-model.md § Records
 */

import {
  getDbForTenant,
  eq,
  and,
  or,
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
import type {
  FilterConfig,
  FilterCondition,
  FilterGroup,
} from '@/components/grid/filter-types';
import { ME_TOKEN } from '@/components/grid/filter-types';

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
  /** Filter config for WHERE clause building. */
  filters?: FilterConfig;
  /** Current user ID for $me token resolution in People filters. */
  currentUserId?: string;
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

  // Build filter WHERE clauses
  const filterClause = buildFilterClauses(
    options?.filters,
    options?.fieldTypes,
    options?.currentUserId,
  );

  const baseWhere = and(
    eq(records.tenantId, tenantId),
    eq(records.tableId, tableId),
    isNull(records.archivedAt),
    ...(filterClause ? [filterClause] : []),
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
// Filter clause builder
// ---------------------------------------------------------------------------

/**
 * Field types that should be compared as numeric values.
 */
const NUMERIC_FILTER_TYPES = new Set([
  'number',
  'currency',
  'percent',
  'rating',
  'duration',
]);

/**
 * Builds a SQL expression to extract a field value from canonical_data.
 * Returns the raw text value.
 */
function fieldValueExpr(fieldId: string): SQL {
  return sql.raw(`(canonical_data->'${fieldId}'->>'value')`);
}

/**
 * Builds a SQL WHERE clause for a single filter condition.
 */
function buildConditionClause(
  condition: FilterCondition,
  fieldTypes?: Record<string, string>,
  currentUserId?: string,
): SQL | null {
  const fieldType = fieldTypes?.[condition.fieldId];
  const valueExpr = fieldValueExpr(condition.fieldId);

  // Resolve $me token for People filters
  let resolvedValue = condition.value;
  if (resolvedValue === ME_TOKEN && currentUserId) {
    resolvedValue = currentUserId;
  }

  switch (condition.operator) {
    case 'is':
      if (fieldType === 'checkbox') {
        return sql`${valueExpr}::boolean = ${resolvedValue as boolean}`;
      }
      if (fieldType && NUMERIC_FILTER_TYPES.has(fieldType)) {
        return sql`${valueExpr}::numeric = ${resolvedValue as number}`;
      }
      return sql`${valueExpr} = ${resolvedValue as string}`;

    case 'is_not':
      if (fieldType && NUMERIC_FILTER_TYPES.has(fieldType)) {
        return sql`${valueExpr}::numeric != ${resolvedValue as number}`;
      }
      return sql`${valueExpr} != ${resolvedValue as string}`;

    case 'contains':
      return sql`${valueExpr} ILIKE ${'%' + String(resolvedValue) + '%'}`;

    case 'does_not_contain':
      return sql`(${valueExpr} IS NULL OR ${valueExpr} NOT ILIKE ${'%' + String(resolvedValue) + '%'})`;

    case 'starts_with':
      return sql`${valueExpr} ILIKE ${String(resolvedValue) + '%'}`;

    case 'ends_with':
      return sql`${valueExpr} ILIKE ${'%' + String(resolvedValue)}`;

    case 'gt':
      if (fieldType && NUMERIC_FILTER_TYPES.has(fieldType)) {
        return sql`${valueExpr}::numeric > ${resolvedValue as number}`;
      }
      return sql`${valueExpr} > ${resolvedValue as string}`;

    case 'gte':
      if (fieldType && NUMERIC_FILTER_TYPES.has(fieldType)) {
        return sql`${valueExpr}::numeric >= ${resolvedValue as number}`;
      }
      return sql`${valueExpr} >= ${resolvedValue as string}`;

    case 'lt':
      if (fieldType && NUMERIC_FILTER_TYPES.has(fieldType)) {
        return sql`${valueExpr}::numeric < ${resolvedValue as number}`;
      }
      return sql`${valueExpr} < ${resolvedValue as string}`;

    case 'lte':
      if (fieldType && NUMERIC_FILTER_TYPES.has(fieldType)) {
        return sql`${valueExpr}::numeric <= ${resolvedValue as number}`;
      }
      return sql`${valueExpr} <= ${resolvedValue as string}`;

    case 'between': {
      const between = resolvedValue as { min?: number; max?: number } | null;
      if (!between) return null;
      const clauses: SQL[] = [];
      if (between.min !== undefined) {
        clauses.push(sql`${valueExpr}::numeric >= ${between.min}`);
      }
      if (between.max !== undefined) {
        clauses.push(sql`${valueExpr}::numeric <= ${between.max}`);
      }
      if (clauses.length === 0) return null;
      return clauses.length === 1 ? clauses[0]! : and(...clauses)!;
    }

    case 'is_before':
      return sql`${valueExpr}::timestamptz < ${resolvedValue as string}::timestamptz`;

    case 'is_after':
      return sql`${valueExpr}::timestamptz > ${resolvedValue as string}::timestamptz`;

    case 'is_within': {
      const preset = resolvedValue as string;
      const now = sql`NOW()`;
      switch (preset) {
        case 'last_7_days':
          return sql`${valueExpr}::timestamptz >= ${now} - INTERVAL '7 days'`;
        case 'last_30_days':
          return sql`${valueExpr}::timestamptz >= ${now} - INTERVAL '30 days'`;
        case 'this_week':
          return sql`${valueExpr}::timestamptz >= date_trunc('week', ${now})`;
        case 'this_month':
          return sql`${valueExpr}::timestamptz >= date_trunc('month', ${now})`;
        case 'this_year':
          return sql`${valueExpr}::timestamptz >= date_trunc('year', ${now})`;
        default:
          return null;
      }
    }

    case 'is_any_of': {
      const values = resolvedValue as string[];
      if (!values || values.length === 0) return null;
      const orClauses = values.map((v) => sql`${valueExpr} = ${v}`);
      return or(...orClauses)!;
    }

    case 'is_none_of': {
      const values = resolvedValue as string[];
      if (!values || values.length === 0) return null;
      const andClauses = values.map((v) => sql`${valueExpr} != ${v}`);
      return and(...andClauses)!;
    }

    case 'contains_any_of': {
      const values = resolvedValue as string[];
      if (!values || values.length === 0) return null;
      const jsonArrayExpr = sql.raw(
        `(canonical_data->'${condition.fieldId}'->'value')`,
      );
      const orClauses = values.map(
        (v) => sql`${jsonArrayExpr}::jsonb @> ${JSON.stringify([v])}::jsonb`,
      );
      return or(...orClauses)!;
    }

    case 'contains_all_of': {
      const values = resolvedValue as string[];
      if (!values || values.length === 0) return null;
      const jsonArrayExpr = sql.raw(
        `(canonical_data->'${condition.fieldId}'->'value')`,
      );
      return sql`${jsonArrayExpr}::jsonb @> ${JSON.stringify(values)}::jsonb`;
    }

    case 'is_empty':
      return sql`(${valueExpr} IS NULL OR ${valueExpr} = '' OR NOT (canonical_data ? '${sql.raw(condition.fieldId)}'))`;

    case 'is_not_empty':
      return sql`(${valueExpr} IS NOT NULL AND ${valueExpr} != '' AND canonical_data ? '${sql.raw(condition.fieldId)}')`;

    default:
      return null;
  }
}

/**
 * Builds a SQL WHERE clause for a filter group (nested conditions with own logic).
 */
function buildGroupClause(
  group: FilterGroup,
  fieldTypes?: Record<string, string>,
  currentUserId?: string,
): SQL | null {
  const clauses = group.conditions
    .map((c) => buildConditionClause(c, fieldTypes, currentUserId))
    .filter((c): c is SQL => c !== null);

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0]!;

  return group.logic === 'or' ? or(...clauses)! : and(...clauses)!;
}

/**
 * Builds a complete filter WHERE clause from a FilterConfig.
 * Combines top-level conditions and nested groups using the top-level logic.
 */
export function buildFilterClauses(
  filters?: FilterConfig,
  fieldTypes?: Record<string, string>,
  currentUserId?: string,
): SQL | null {
  if (!filters) return null;

  const allClauses: SQL[] = [];

  // Top-level conditions
  for (const condition of filters.conditions) {
    const clause = buildConditionClause(condition, fieldTypes, currentUserId);
    if (clause) allClauses.push(clause);
  }

  // Nested groups
  for (const group of filters.groups) {
    const clause = buildGroupClause(group, fieldTypes, currentUserId);
    if (clause) allClauses.push(clause);
  }

  if (allClauses.length === 0) return null;
  if (allClauses.length === 1) return allClauses[0]!;

  return filters.logic === 'or' ? or(...allClauses)! : and(...allClauses)!;
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
