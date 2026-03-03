import {
  boolean,
  index,
  integer,
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
import { tenants } from './tenants';
import { users } from './users';

export const userEvents = pgTable(
  'user_events',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    startTime: timestamp('start_time', { withTimezone: true }).notNull(),
    endTime: timestamp('end_time', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').default(false).notNull(),
    location: varchar('location', { length: 500 }),
    notes: text('notes'),
    color: varchar('color', { length: 50 }),
    showAs: varchar('show_as', { length: 20 }).default('busy').notNull(),
    recurrenceRule: jsonb('recurrence_rule').$type<Record<string, unknown>>(),
    reminderMinutes: integer('reminder_minutes').array(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('user_events_user_time_idx').on(table.userId, table.startTime, table.endTime),
    index('user_events_user_all_day_idx').on(table.userId, table.allDay),
  ],
);

export const userEventsRelations = relations(userEvents, ({ one }) => ({
  tenant: one(tenants, {
    fields: [userEvents.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [userEvents.userId],
    references: [users.id],
  }),
}));

export type UserEvent = InferSelectModel<typeof userEvents>;
export type NewUserEvent = InferInsertModel<typeof userEvents>;
