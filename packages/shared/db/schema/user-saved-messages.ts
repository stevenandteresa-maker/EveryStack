import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';
import { threadMessages } from './thread-messages';
import { tenants } from './tenants';

export const userSavedMessages = pgTable(
  'user_saved_messages',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    messageId: uuid('message_id')
      .notNull()
      .references(() => threadMessages.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    note: text('note'),
    savedAt: timestamp('saved_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('user_saved_messages_user_saved_idx').on(table.userId, table.savedAt),
    uniqueIndex('user_saved_messages_user_message_idx').on(table.userId, table.messageId),
  ],
);

export const userSavedMessagesRelations = relations(userSavedMessages, ({ one }) => ({
  user: one(users, {
    fields: [userSavedMessages.userId],
    references: [users.id],
  }),
  message: one(threadMessages, {
    fields: [userSavedMessages.messageId],
    references: [threadMessages.id],
  }),
  tenant: one(tenants, {
    fields: [userSavedMessages.tenantId],
    references: [tenants.id],
  }),
}));

export type UserSavedMessage = InferSelectModel<typeof userSavedMessages>;
export type NewUserSavedMessage = InferInsertModel<typeof userSavedMessages>;
