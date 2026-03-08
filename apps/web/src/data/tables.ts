/**
 * Table data access functions — queries for the grid data layer.
 *
 * @see docs/reference/data-model.md § Data Layer
 * @see docs/reference/tables-and-views.md § Table Type System
 */

import {
  getDbForTenant,
  eq,
  and,
  asc,
  tables,
  workspaces,
} from '@everystack/shared/db';
import type { Table } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface TableWithWorkspace extends Table {
  workspace: {
    id: string;
    name: string;
  };
}

// ---------------------------------------------------------------------------
// getTableById
// ---------------------------------------------------------------------------

/**
 * Fetch a single table with its parent workspace info.
 *
 * Throws NotFoundError if not found (404, not 403, to prevent enumeration).
 */
export async function getTableById(
  tenantId: string,
  tableId: string,
): Promise<TableWithWorkspace> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select({
      table: tables,
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
      },
    })
    .from(tables)
    .innerJoin(workspaces, eq(tables.workspaceId, workspaces.id))
    .where(and(eq(tables.id, tableId), eq(tables.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new NotFoundError('Table not found');
  }

  return {
    ...row.table,
    workspace: row.workspace,
  };
}

// ---------------------------------------------------------------------------
// getTablesByWorkspace
// ---------------------------------------------------------------------------

/**
 * Fetch all tables in a workspace, ordered by name.
 */
export async function getTablesByWorkspace(
  tenantId: string,
  workspaceId: string,
): Promise<Table[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(tables)
    .where(
      and(eq(tables.tenantId, tenantId), eq(tables.workspaceId, workspaceId)),
    )
    .orderBy(asc(tables.name));
}
