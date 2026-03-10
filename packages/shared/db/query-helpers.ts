// ---------------------------------------------------------------------------
// JSONB Query Helpers for Canonical Data
// ---------------------------------------------------------------------------
//
// Provides Drizzle-compatible SQL fragments for WHERE and ORDER BY clauses
// against canonical_data JSONB fields. Used by grid view queries, filter
// builders, and sort engines.
//
// These helpers generate type-cast expressions that align with the expression
// indexes created by index-utils.ts, ensuring the query planner can use them.
// ---------------------------------------------------------------------------

import { sql } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Supported field types (must match index-utils.ts INDEXABLE_FIELD_TYPES)
// ---------------------------------------------------------------------------

export const QUERYABLE_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'single_select',
  'checkbox',
] as const;

export type QueryableFieldType = (typeof QUERYABLE_FIELD_TYPES)[number];

export type SortDirection = 'asc' | 'desc';

// ---------------------------------------------------------------------------
// Field expression — for WHERE clauses
// ---------------------------------------------------------------------------

/**
 * Returns a Drizzle SQL fragment that extracts a typed value from
 * canonical_data for use in WHERE clauses.
 *
 * The expression matches the index expression created by
 * `createFieldExpressionIndex()`, so PostgreSQL's query planner
 * can use the index for these queries.
 *
 * @example
 * ```ts
 * const expr = canonicalFieldExpression(fieldId, 'number');
 * // Use in a Drizzle where clause:
 * db.select().from(records).where(sql`${expr} > 100`)
 * ```
 */
/**
 * Type cast suffixes for each queryable field type.
 * Text-like types need no cast; others get a PostgreSQL type cast.
 */
const FIELD_TYPE_SQL_CASTS: Record<QueryableFieldType, string> = {
  text: '',
  single_select: '',
  number: '::numeric',
  date: '::timestamptz',
  checkbox: '::boolean',
};

export function canonicalFieldExpression(
  fieldId: string,
  fieldType: QueryableFieldType,
): SQL {
  const cast = FIELD_TYPE_SQL_CASTS[fieldType];
  return sql.raw(`(canonical_data->'${fieldId}'->>'value')${cast}`);
}

/**
 * Returns a Drizzle SQL fragment for checking whether a canonical field
 * has a non-null value. Useful for IS NOT NULL / IS NULL filters.
 */
export function canonicalFieldExists(fieldId: string): SQL {
  return sql.raw(`canonical_data->'${fieldId}' IS NOT NULL`);
}

// ---------------------------------------------------------------------------
// Field ordering — for ORDER BY clauses
// ---------------------------------------------------------------------------

/**
 * Returns a Drizzle SQL fragment for ORDER BY on a canonical field.
 *
 * Applies proper type casting so that:
 * - Numbers sort numerically (not lexicographically)
 * - Dates sort chronologically
 * - Booleans sort false-before-true (ASC) or true-before-false (DESC)
 * - Text/single_select sort lexicographically
 *
 * NULLs are always sorted last regardless of direction (NULLS LAST).
 *
 * @example
 * ```ts
 * const orderExpr = canonicalFieldOrderBy(fieldId, 'date', 'desc');
 * db.select().from(records).orderBy(orderExpr)
 * ```
 */
export function canonicalFieldOrderBy(
  fieldId: string,
  fieldType: QueryableFieldType,
  direction: SortDirection = 'asc',
): SQL {
  const expr = canonicalFieldExpression(fieldId, fieldType);
  const dir = direction === 'desc' ? sql.raw('DESC') : sql.raw('ASC');

  return sql`${expr} ${dir} NULLS LAST`;
}
