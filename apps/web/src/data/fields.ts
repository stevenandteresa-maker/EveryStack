/**
 * Field data access functions — queries for the grid data layer.
 *
 * @see docs/reference/data-model.md § Data Layer
 */

import {
  getDbForTenant,
  eq,
  and,
  asc,
  fields,
} from '@everystack/shared/db';
import type { Field } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// getFieldsByTable
// ---------------------------------------------------------------------------

/**
 * Fetch all fields for a table, ordered by sort_order.
 */
export async function getFieldsByTable(
  tenantId: string,
  tableId: string,
): Promise<Field[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(fields)
    .where(and(eq(fields.tenantId, tenantId), eq(fields.tableId, tableId)))
    .orderBy(asc(fields.sortOrder));
}

// ---------------------------------------------------------------------------
// getFieldById
// ---------------------------------------------------------------------------

/**
 * Fetch a single field by ID.
 *
 * Throws NotFoundError if not found.
 */
export async function getFieldById(
  tenantId: string,
  fieldId: string,
): Promise<Field> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(fields)
    .where(and(eq(fields.id, fieldId), eq(fields.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new NotFoundError('Field not found');
  }

  return row;
}
