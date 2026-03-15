import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';
import { records } from './records';

export const userNotes = pgTable(
  'user_notes',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    recordId: uuid('record_id')
      .references(() => records.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 255 }),
    content: jsonb('content').$type<Record<string, unknown>>().default({}).notNull(),
    pinned: boolean('pinned').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('user_notes_user_created_idx').on(table.userId, table.createdAt),
    index('user_notes_user_pinned_idx').on(table.userId, table.pinned),
    index('user_notes_record_idx').on(table.recordId),
  ],
);

export const userNotesRelations = relations(userNotes, ({ one }) => ({
  tenant: one(tenants, {
    fields: [userNotes.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [userNotes.userId],
    references: [users.id],
  }),
  record: one(records, {
    fields: [userNotes.recordId],
    references: [records.id],
  }),
}));

export type UserNote = InferSelectModel<typeof userNotes>;
export type NewUserNote = InferInsertModel<typeof userNotes>;
