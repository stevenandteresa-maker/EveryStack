import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';

/**
 * In-app broadcast notices from platform admin.
 *
 * type values: info | warning | maintenance
 * target: { scope: "all" } | { scope: "plan", plans: string[] } | { scope: "tenant", tenant_id: string }
 */
export const platformNotices = pgTable(
  'platform_notices',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    type: varchar('type', { length: 20 }).default('info').notNull(),
    target: jsonb('target')
      .$type<{ scope: string; plans?: string[]; tenant_id?: string }>()
      .notNull(),
    activeFrom: timestamp('active_from', { withTimezone: true }).defaultNow().notNull(),
    activeUntil: timestamp('active_until', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  () => [],
);

export const platformNoticesRelations = relations(platformNotices, ({ one }) => ({
  creator: one(users, {
    fields: [platformNotices.createdBy],
    references: [users.id],
  }),
}));

export type PlatformNotice = InferSelectModel<typeof platformNotices>;
export type NewPlatformNotice = InferInsertModel<typeof platformNotices>;
