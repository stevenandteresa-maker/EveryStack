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
  views,
} from '@everystack/shared/db';
import { resolveEffectiveRole, roleAtLeast } from '@everystack/shared/auth';
import type { EffectiveRole } from '@everystack/shared/auth';
import type { SearchResult, NavigationResult } from '@/lib/command-bar/types';

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

// ---------------------------------------------------------------------------
// Table & View Navigation Search
// ---------------------------------------------------------------------------

/**
 * Search tables and views in a workspace, filtered by the user's role
 * and Table View access assignments.
 *
 * - Owner/Admin: see all tables and views
 * - Manager: see permitted tables + their views
 * - Team Member/Viewer: see only assigned Shared Views (no raw table list)
 *
 * @see docs/reference/permissions.md § Table View–Based Access
 */
export async function searchTablesAndViews(
  tenantId: string,
  workspaceId: string,
  query: string,
  userId: string,
): Promise<NavigationResult[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  // Resolve user's effective role in this workspace
  const role = await resolveEffectiveRole(userId, tenantId, workspaceId);
  if (!role) return [];

  const db = getDbForTenant(tenantId, 'read');
  const likePattern = `%${trimmedQuery}%`;
  const results: NavigationResult[] = [];

  if (roleAtLeast(role, 'manager')) {
    // Owner/Admin/Manager: search tables by name
    const matchedTables = await db
      .select({
        id: tables.id,
        name: tables.name,
      })
      .from(tables)
      .where(
        and(
          eq(tables.tenantId, tenantId),
          eq(tables.workspaceId, workspaceId),
          sql`${tables.name} ILIKE ${likePattern}`,
        ),
      );

    for (const t of matchedTables) {
      results.push({
        entity_type: 'table',
        entity_id: t.id,
        name: t.name,
      });
    }

    // Owner/Admin/Manager: search views for tables in this workspace
    const matchedViews = await db
      .select({
        id: views.id,
        name: views.name,
        tableName: tables.name,
      })
      .from(views)
      .innerJoin(tables, eq(views.tableId, tables.id))
      .where(
        and(
          eq(views.tenantId, tenantId),
          eq(tables.workspaceId, workspaceId),
          sql`${views.name} ILIKE ${likePattern}`,
        ),
      );

    for (const v of matchedViews) {
      results.push({
        entity_type: 'view',
        entity_id: v.id,
        name: v.name,
        parent_name: v.tableName,
      });
    }
  } else {
    // Team Member/Viewer: only see assigned Shared Views
    const assignedViews = await getAssignedSharedViews(
      db,
      tenantId,
      workspaceId,
      userId,
      role,
      likePattern,
    );

    for (const v of assignedViews) {
      results.push({
        entity_type: 'view',
        entity_id: v.id,
        name: v.name,
        parent_name: v.tableName,
      });
    }
  }

  return results;
}

/**
 * Query shared views assigned to a Team Member or Viewer.
 *
 * A view is "assigned" to a user if:
 * - The view is shared (is_shared = true)
 * - The view's permissions.roles includes the user's role OR
 *   the view's permissions.specificUsers includes the user's ID
 * - The user is NOT in permissions.excludedUsers
 *
 * We filter by name ILIKE in SQL, then post-filter by JSONB permissions
 * since JSONB array containment with parameterized values is simpler in JS.
 */
async function getAssignedSharedViews(
  db: ReturnType<typeof getDbForTenant>,
  tenantId: string,
  workspaceId: string,
  userId: string,
  role: EffectiveRole,
  likePattern: string,
): Promise<Array<{ id: string; name: string; tableName: string }>> {
  const rows = await db
    .select({
      id: views.id,
      name: views.name,
      tableName: tables.name,
      permissions: views.permissions,
    })
    .from(views)
    .innerJoin(tables, eq(views.tableId, tables.id))
    .where(
      and(
        eq(views.tenantId, tenantId),
        eq(tables.workspaceId, workspaceId),
        eq(views.isShared, true),
        sql`${views.name} ILIKE ${likePattern}`,
      ),
    );

  return rows.filter((row) => {
    const perms = row.permissions as Record<string, unknown> | null;
    if (!perms) return false;

    const excludedUsers = (perms.excludedUsers ?? []) as string[];
    if (excludedUsers.includes(userId)) return false;

    const specificUsers = (perms.specificUsers ?? []) as string[];
    if (specificUsers.includes(userId)) return true;

    const roles = (perms.roles ?? []) as string[];
    return roles.includes(role);
  }).map((row) => ({
    id: row.id,
    name: row.name,
    tableName: row.tableName,
  }));
}
