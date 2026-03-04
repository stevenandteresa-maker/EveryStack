import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { threads } from './threads';
import { users } from './users';

export const threadParticipants = pgTable(
  'thread_participants',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .references(() => users.id),
    participantType: varchar('participant_type', { length: 50 }).default('user').notNull(),
    externalContactId: uuid('external_contact_id'),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    muted: boolean('muted').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('thread_participants_thread_user_idx').on(table.threadId, table.userId),
    index('thread_participants_user_idx').on(table.userId),
    check(
      'thread_participants_identity_check',
      sql`${table.userId} IS NOT NULL OR ${table.externalContactId} IS NOT NULL`,
    ),
  ],
);

export const threadParticipantsRelations = relations(threadParticipants, ({ one }) => ({
  tenant: one(tenants, {
    fields: [threadParticipants.tenantId],
    references: [tenants.id],
  }),
  thread: one(threads, {
    fields: [threadParticipants.threadId],
    references: [threads.id],
  }),
  user: one(users, {
    fields: [threadParticipants.userId],
    references: [users.id],
  }),
}));

export type ThreadParticipant = InferSelectModel<typeof threadParticipants>;
export type NewThreadParticipant = InferInsertModel<typeof threadParticipants>;
