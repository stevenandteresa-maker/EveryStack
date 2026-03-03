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
import { users } from './users';
import { tenants } from './tenants';

export const userNotificationPreferences = pgTable(
  'user_notification_preferences',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    preferences: jsonb('preferences').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('user_notification_preferences_user_tenant_idx').on(table.userId, table.tenantId),
  ],
);

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [userNotificationPreferences.tenantId],
    references: [tenants.id],
  }),
}));

export type UserNotificationPreference = InferSelectModel<typeof userNotificationPreferences>;
export type NewUserNotificationPreference = InferInsertModel<typeof userNotificationPreferences>;
