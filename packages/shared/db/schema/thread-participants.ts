import {
  boolean,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { threads } from './threads';
import { users } from './users';

export const threadParticipants = pgTable(
  'thread_participants',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastReadAt: timestamp('last_read_at', { withTimezone: true }),
    muted: boolean('muted').default(false).notNull(),
  },
  (table) => [
    uniqueIndex('thread_participants_thread_user_idx').on(table.threadId, table.userId),
    index('thread_participants_user_idx').on(table.userId),
  ],
);

export const threadParticipantsRelations = relations(threadParticipants, ({ one }) => ({
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
