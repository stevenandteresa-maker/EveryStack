/**
 * Recent Items — tracks and retrieves user's recently accessed entities
 * for the Command Bar recents panel.
 *
 * - Upsert dedup on (user_id, item_type, item_id)
 * - Capped at 100 items per user per tenant
 * - Access filtering: only returns entities that still exist
 *
 * @see docs/reference/command-bar.md § Recent Items
 */

import {
  getDbForTenant,
  eq,
  and,
  desc,
  sql,
  userRecentItems,
  tables,
  views,
} from '@everystack/shared/db';
import type { RecentItem, RecentItemInput } from '@/lib/command-bar/types';

const MAX_RECENT_ITEMS = 100;
const DEFAULT_LIMIT = 20;

/**
 * Track a recently accessed item. Upserts on (user_id, item_type, item_id):
 * - New item: insert with current timestamp
 * - Existing item: update accessed_at to current timestamp
 *
 * After upsert, prunes oldest entries beyond 100 per user per tenant.
 */
export async function trackRecentItem(
  userId: string,
  tenantId: string,
  item: RecentItemInput,
): Promise<void> {
  const db = getDbForTenant(tenantId, 'write');

  // Upsert: insert or update accessed_at on conflict
  await db
    .insert(userRecentItems)
    .values({
      userId,
      tenantId,
      itemType: item.item_type,
      itemId: item.item_id,
      accessedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userRecentItems.userId, userRecentItems.itemType, userRecentItems.itemId],
      set: { accessedAt: new Date() },
    });

  // Prune: delete oldest entries beyond MAX_RECENT_ITEMS per user per tenant
  await db.execute(sql`
    DELETE FROM user_recent_items
    WHERE id IN (
      SELECT id FROM user_recent_items
      WHERE user_id = ${userId} AND tenant_id = ${tenantId}
      ORDER BY accessed_at DESC
      OFFSET ${MAX_RECENT_ITEMS}
    )
  `);
}

/**
 * Get recently accessed items for a user, filtered to entities that
 * still exist (tables/views not deleted).
 *
 * Enriches results with display_name from the entity table.
 */
export async function getRecentItems(
  userId: string,
  tenantId: string,
  limit?: number,
): Promise<RecentItem[]> {
  const db = getDbForTenant(tenantId, 'read');
  const effectiveLimit = limit ?? DEFAULT_LIMIT;

  // Query table-type recent items with access filtering via JOIN
  const tableItems = await db
    .select({
      item_type: userRecentItems.itemType,
      item_id: userRecentItems.itemId,
      display_name: tables.name,
      accessed_at: userRecentItems.accessedAt,
    })
    .from(userRecentItems)
    .innerJoin(tables, eq(userRecentItems.itemId, tables.id))
    .where(
      and(
        eq(userRecentItems.userId, userId),
        eq(userRecentItems.tenantId, tenantId),
        eq(userRecentItems.itemType, 'table'),
      ),
    )
    .orderBy(desc(userRecentItems.accessedAt));

  // Query view-type recent items with access filtering via JOIN
  const viewItems = await db
    .select({
      item_type: userRecentItems.itemType,
      item_id: userRecentItems.itemId,
      display_name: views.name,
      accessed_at: userRecentItems.accessedAt,
    })
    .from(userRecentItems)
    .innerJoin(views, eq(userRecentItems.itemId, views.id))
    .where(
      and(
        eq(userRecentItems.userId, userId),
        eq(userRecentItems.tenantId, tenantId),
        eq(userRecentItems.itemType, 'view'),
      ),
    )
    .orderBy(desc(userRecentItems.accessedAt));

  // Merge, sort by accessed_at DESC, and apply limit
  const allItems = [...tableItems, ...viewItems]
    .sort((a, b) => new Date(b.accessed_at).getTime() - new Date(a.accessed_at).getTime())
    .slice(0, effectiveLimit);

  return allItems.map((row) => ({
    item_type: row.item_type,
    item_id: row.item_id,
    display_name: row.display_name,
    accessed_at: new Date(row.accessed_at).toISOString(),
  }));
}
