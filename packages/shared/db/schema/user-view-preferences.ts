import {
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { views } from './views';
import { users } from './users';

export const userViewPreferences = pgTable(
  'user_view_preferences',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    viewId: uuid('view_id')
      .notNull()
      .references(() => views.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    overrides: jsonb('overrides').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_view_preferences_view_user_idx').on(table.viewId, table.userId),
  ],
);

export const userViewPreferencesRelations = relations(userViewPreferences, ({ one }) => ({
  tenant: one(tenants, {
    fields: [userViewPreferences.tenantId],
    references: [tenants.id],
  }),
  view: one(views, {
    fields: [userViewPreferences.viewId],
    references: [views.id],
  }),
  user: one(users, {
    fields: [userViewPreferences.userId],
    references: [users.id],
  }),
}));

export type UserViewPreference = InferSelectModel<typeof userViewPreferences>;
export type NewUserViewPreference = InferInsertModel<typeof userViewPreferences>;
