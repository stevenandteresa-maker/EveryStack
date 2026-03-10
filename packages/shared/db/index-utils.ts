// ---------------------------------------------------------------------------
// JSONB Expression Index Utilities
// ---------------------------------------------------------------------------
//
// Creates and drops expression indexes on canonical_data JSONB paths for
// grid query performance on synced tables.
//
// Decision point: If expression indexes cannot meet <200ms grid query targets
// on 50K+ record tables, introduce the record_cells denormalized read cache
// (see data-model.md).
// ---------------------------------------------------------------------------

import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { DrizzleClient } from './client';

// ---------------------------------------------------------------------------
// Supported field types for expression indexes
// ---------------------------------------------------------------------------

/**
 * Canonical field types that support expression indexing.
 * Each maps to a specific JSONB extraction path and PostgreSQL type cast.
 */
export const INDEXABLE_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'single_select',
  'checkbox',
] as const;

export type IndexableFieldType = (typeof INDEXABLE_FIELD_TYPES)[number];

/**
 * Maximum PostgreSQL identifier length (63 characters).
 * Index names are truncated to this limit.
 */
const PG_MAX_IDENTIFIER_LENGTH = 63;

/**
 * Prefix for all expression indexes created by this module.
 */
const INDEX_PREFIX = 'idx_rec_';

// ---------------------------------------------------------------------------
// Index name generation
// ---------------------------------------------------------------------------

/**
 * Generates a deterministic, collision-resistant index name for a field.
 *
 * Format: `idx_rec_{shortHash}` where shortHash is a 12-character hex digest
 * of SHA-256(tenantId + tableId + fieldId). The 12-char hex provides 48 bits
 * of entropy — sufficient to avoid collisions across all tenant/table/field
 * combinations while staying well under the 63-char PG limit.
 *
 * @returns Index name, always <= 63 characters
 */
export function generateIndexName(
  tenantId: string,
  tableId: string,
  fieldId: string,
): string {
  const hash = createHash('sha256')
    .update(`${tenantId}:${tableId}:${fieldId}`)
    .digest('hex');

  // 12 hex chars = 48 bits of entropy
  const shortHash = hash.slice(0, 12);
  const name = `${INDEX_PREFIX}${shortHash}`;

  // Defensive: ensure we never exceed PG limit
  return name.slice(0, PG_MAX_IDENTIFIER_LENGTH);
}

// ---------------------------------------------------------------------------
// JSONB path expressions per field type
// ---------------------------------------------------------------------------

/**
 * Type cast suffixes for each indexable field type.
 * Text-like types need no cast; others get a PostgreSQL type cast.
 */
const FIELD_TYPE_CASTS: Record<IndexableFieldType, string> = {
  text: '',
  single_select: '',
  number: '::numeric',
  date: '::timestamptz',
  checkbox: '::boolean',
};

/**
 * Returns the PostgreSQL expression for extracting a typed value from
 * canonical_data for a given field.
 *
 * canonical_data structure: `{ "<fieldId>": { "type": "...", "value": ... } }`
 *
 * The JSONB path is: `canonical_data->'<fieldId>'->>'value'`
 * with appropriate type casting for the field type.
 */
function jsonbValueExpression(fieldId: string, fieldType: IndexableFieldType): string {
  const basePath = `(canonical_data->'${fieldId}'->>'value')`;
  const cast = FIELD_TYPE_CASTS[fieldType];
  return `${basePath}${cast}`;
}

// ---------------------------------------------------------------------------
// Create / Drop index functions
// ---------------------------------------------------------------------------

/**
 * Creates a BTREE expression index on a canonical_data JSONB path.
 *
 * Uses CREATE INDEX CONCURRENTLY to avoid blocking writes.
 * The index is scoped to (tenant_id, table_id) with a WHERE clause
 * filtering to only rows for the specific table and tenant, plus a
 * NULL check to skip records without the field.
 *
 * IMPORTANT: CONCURRENTLY cannot run inside a transaction. The caller
 * must ensure this is NOT wrapped in a Drizzle transaction block.
 *
 * @throws If the field type is not indexable
 */
export async function createFieldExpressionIndex(
  db: DrizzleClient,
  tenantId: string,
  tableId: string,
  fieldId: string,
  fieldType: IndexableFieldType,
): Promise<string> {
  const indexName = generateIndexName(tenantId, tableId, fieldId);
  const expression = jsonbValueExpression(fieldId, fieldType);

  // CREATE INDEX CONCURRENTLY does not support parameterized queries,
  // so we must use raw SQL. Inputs are UUIDs (validated at boundary)
  // and a controlled field type enum — no injection risk.
  const statement = `
    CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName}"
    ON records USING btree (${expression})
    WHERE tenant_id = '${tenantId}'
      AND table_id = '${tableId}'
      AND canonical_data->'${fieldId}' IS NOT NULL
  `;

  await db.execute(sql.raw(statement));
  return indexName;
}

/**
 * Drops an expression index created by createFieldExpressionIndex.
 *
 * Uses DROP INDEX CONCURRENTLY to avoid blocking reads/writes.
 *
 * IMPORTANT: CONCURRENTLY cannot run inside a transaction.
 */
export async function dropFieldExpressionIndex(
  db: DrizzleClient,
  tenantId: string,
  tableId: string,
  fieldId: string,
): Promise<void> {
  const indexName = generateIndexName(tenantId, tableId, fieldId);

  await db.execute(sql.raw(`DROP INDEX CONCURRENTLY IF EXISTS "${indexName}"`));
}
