/**
 * Command Bar — record search via PostgreSQL tsvector full-text search.
 *
 * Uses ts_rank() with the pre-built search_vector column on records
 * for relevance-ranked results. Permission-filtered via workspace
 * membership check.
 *
 * @see docs/reference/command-bar.md § Unified Command Prompt
 */

import {
  getDbForTenant,
  eq,
  and,
  isNull,
  sql,
  records,
  fields,
  tables,
} from '@everystack/shared/db';
import { resolveEffectiveRole } from '@everystack/shared/auth';
import type { SearchResult } from '@/lib/command-bar/types';

const DEFAULT_LIMIT = 20;

/**
 * Search records using PostgreSQL full-text search (tsvector/tsquery).
 *
 * - Tenant-scoped via getDbForTenant()
 * - Filters to tables in the given workspace
 * - Permission-filtered: only users with a workspace role can search
 * - Optional scoped mode: filters to a specific table
 * - Excludes soft-deleted (archived) records
 * - Returns results ranked by ts_rank() descending
 */
export async function searchRecords(
  tenantId: string,
  workspaceId: string,
  query: string,
  opts?: { tableId?: string; limit?: number; userId?: string },
): Promise<SearchResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  // Permission check: if userId is provided, verify workspace access
  if (opts?.userId) {
    const role = await resolveEffectiveRole(opts.userId, tenantId, workspaceId);
    if (!role) {
      return [];
    }
  }

  const db = getDbForTenant(tenantId, 'read');
  const limit = opts?.limit ?? DEFAULT_LIMIT;

  // Build the tsquery from user input
  const tsquery = sql`plainto_tsquery('english', ${trimmedQuery})`;
  const rankExpr = sql<number>`ts_rank(${records.searchVector}, ${tsquery})`;

  // Base conditions: tenant, workspace, not archived, matches search
  const conditions = [
    eq(records.tenantId, tenantId),
    eq(tables.workspaceId, workspaceId),
    isNull(records.archivedAt),
    sql`${records.searchVector} @@ ${tsquery}`,
  ];

  // Scoped mode: filter to specific table
  if (opts?.tableId) {
    conditions.push(eq(records.tableId, opts.tableId));
  }

  const results = await db
    .select({
      record_id: records.id,
      table_id: records.tableId,
      table_name: tables.name,
      primary_field_value: sql<string>`COALESCE(
        ${records.canonicalData} ->> ${fields.id}::text,
        ''
      )`,
      rank: rankExpr,
    })
    .from(records)
    .innerJoin(tables, eq(records.tableId, tables.id))
    .innerJoin(
      fields,
      and(
        eq(fields.tableId, records.tableId),
        eq(fields.isPrimary, true),
      ),
    )
    .where(and(...conditions))
    .orderBy(sql`${rankExpr} DESC`)
    .limit(limit);

  return results.map((row) => ({
    record_id: row.record_id,
    table_id: row.table_id,
    table_name: row.table_name,
    primary_field_value: row.primary_field_value ?? '',
    rank: Number(row.rank),
  }));
}
