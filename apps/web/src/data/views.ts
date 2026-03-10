/**
 * View data access functions — queries for the grid data layer.
 *
 * @see docs/reference/data-model.md § Views
 * @see docs/reference/tables-and-views.md § Default View
 * @see docs/reference/tables-and-views.md § My Views & Shared Views
 */

import {
  getDbForTenant,
  eq,
  and,
  asc,
  views,
  userViewPreferences,
  generateUUIDv7,
} from '@everystack/shared/db';
import type { View, UserViewPreference } from '@everystack/shared/db';
import { NotFoundError } from '@/lib/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ViewsByTable {
  sharedViews: View[];
  myViews: View[];
}

// ---------------------------------------------------------------------------
// getViewsByTable
// ---------------------------------------------------------------------------

/**
 * Fetch all views for a table, split into shared and personal (my) views.
 *
 * - Shared: is_shared = true
 * - My: is_shared = false AND created_by = userId
 */
export async function getViewsByTable(
  tenantId: string,
  tableId: string,
  userId?: string,
): Promise<ViewsByTable> {
  const db = getDbForTenant(tenantId, 'read');

  const allViews = await db
    .select()
    .from(views)
    .where(and(eq(views.tenantId, tenantId), eq(views.tableId, tableId)))
    .orderBy(asc(views.position));

  const sharedViews = allViews.filter((v) => v.isShared);
  const myViews = userId
    ? allViews.filter((v) => !v.isShared && v.createdBy === userId)
    : [];

  return { sharedViews, myViews };
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
  const { sharedViews } = await getViewsByTable(tenantId, tableId);

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

// ---------------------------------------------------------------------------
// getUserViewPreferences
// ---------------------------------------------------------------------------

/**
 * Fetch a user's personal overrides for a shared view.
 * Returns null if no overrides exist.
 */
export async function getUserViewPreferences(
  tenantId: string,
  userId: string,
  viewId: string,
): Promise<UserViewPreference | null> {
  const db = getDbForTenant(tenantId, 'read');

  const rows = await db
    .select()
    .from(userViewPreferences)
    .where(
      and(
        eq(userViewPreferences.tenantId, tenantId),
        eq(userViewPreferences.userId, userId),
        eq(userViewPreferences.viewId, viewId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}
