import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { threads } from './threads';

export const threadMessages = pgTable(
  'thread_messages',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => threads.id, { onDelete: 'cascade' }),
    authorId: uuid('author_id'),
    authorType: varchar('author_type', { length: 50 }).default('user').notNull(),
    messageType: varchar('message_type', { length: 50 }).default('message').notNull(),
    content: jsonb('content').notNull(),
    parentMessageId: uuid('parent_message_id').references((): AnyPgColumn => threadMessages.id),
    mentions: jsonb('mentions').$type<string[]>().default([]).notNull(),
    attachments: jsonb('attachments').$type<Record<string, unknown>[]>().default([]).notNull(),
    reactions: jsonb('reactions').$type<Record<string, string[]>>().default({}).notNull(),
    pinnedAt: timestamp('pinned_at', { withTimezone: true }),
    pinnedBy: uuid('pinned_by'),
    editedAt: timestamp('edited_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('thread_messages_thread_created_idx').on(table.threadId, table.createdAt),
    index('thread_messages_thread_parent_idx').on(table.threadId, table.parentMessageId),
  ],
);

export const threadMessagesRelations = relations(threadMessages, ({ one }) => ({
  thread: one(threads, {
    fields: [threadMessages.threadId],
    references: [threads.id],
  }),
  parentMessage: one(threadMessages, {
    fields: [threadMessages.parentMessageId],
    references: [threadMessages.id],
  }),
}));

export type ThreadMessage = InferSelectModel<typeof threadMessages>;
export type NewThreadMessage = InferInsertModel<typeof threadMessages>;
