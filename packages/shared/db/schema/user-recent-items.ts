import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';
import { tenants } from './tenants';

/**
 * User recent items — powers Command Bar recents. Capped per user.
 */
export const userRecentItems = pgTable(
  'user_recent_items',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    itemType: varchar('item_type', { length: 64 }).notNull(),
    itemId: uuid('item_id').notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    accessedAt: timestamp('accessed_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_recent_items_user_tenant_accessed_idx').on(
      table.userId,
      table.tenantId,
      table.accessedAt.desc(),
    ),
    uniqueIndex('user_recent_items_user_item_idx').on(table.userId, table.itemType, table.itemId),
  ],
);

export const userRecentItemsRelations = relations(userRecentItems, ({ one }) => ({
  user: one(users, {
    fields: [userRecentItems.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [userRecentItems.tenantId],
    references: [tenants.id],
  }),
}));

export type UserRecentItem = InferSelectModel<typeof userRecentItems>;
export type NewUserRecentItem = InferInsertModel<typeof userRecentItems>;
