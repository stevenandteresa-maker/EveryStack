/**
 * View data access functions — queries for the grid data layer.
 *
 * @see docs/reference/data-model.md § Views
 * @see docs/reference/tables-and-views.md § Default View
 */

import {
  getDbForTenant,
  eq,
  and,
  asc,
  views,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { View } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// getViewsByTable
// ---------------------------------------------------------------------------

/**
 * Fetch all views for a table, ordered by position.
 */
export async function getViewsByTable(
  tenantId: string,
  tableId: string,
): Promise<View[]> {
  const db = getDbForTenant(tenantId, 'read');

  return db
    .select()
    .from(views)
    .where(and(eq(views.tenantId, tenantId), eq(views.tableId, tableId)))
    .orderBy(asc(views.position));
}

// ---------------------------------------------------------------------------
// getViewById
// ---------------------------------------------------------------------------

/**
 * Fetch a single view by ID.
 *
 * Throws NotFoundError if not found.
 */
export async function getViewById(
  tenantId: string,
  viewId: string,
): Promise<View> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(views)
    .where(and(eq(views.id, viewId), eq(views.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];

  if (!row) {
    throw new NotFoundError('View not found');
  }

  return row;
}

// ---------------------------------------------------------------------------
// getDefaultView
// ---------------------------------------------------------------------------

/**
 * Resolve the default view for a table using a 4-step fallback chain:
 *
 * 1. Manager-assigned default (config.isDefault === true on a shared view)
 * 2. First shared grid view by position
 * 3. First shared view of any type by position
 * 4. Auto-generated "All Records" grid (not persisted — returned as virtual)
 */
export async function getDefaultView(
  tenantId: string,
  tableId: string,
): Promise<View> {
  const allViews = await getViewsByTable(tenantId, tableId);
  const sharedViews = allViews.filter((v) => v.isShared);

  // Step 1: Manager-assigned default
  const managerDefault = sharedViews.find(
    (v) => (v.config as Record<string, unknown>)?.isDefault === true,
  );
  if (managerDefault) return managerDefault;

  // Step 2: First shared grid view by position
  const firstSharedGrid = sharedViews.find((v) => v.viewType === 'grid');
  if (firstSharedGrid) return firstSharedGrid;

  // Step 3: First shared view of any type
  const firstShared = sharedViews[0];
  if (firstShared) return firstShared;

  // Step 4: Auto-generated "All Records" grid (virtual — not persisted)
  return {
    id: generateUUIDv7(),
    tenantId,
    tableId,
    name: 'All Records',
    viewType: 'grid',
    config: {},
    permissions: {},
    isShared: true,
    publishState: 'live',
    environment: 'live',
    position: 0,
    createdBy: tenantId, // placeholder — virtual view
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
