import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { supportRequests } from './support-requests';
import { users } from './users';

/**
 * Messages within a support request thread.
 *
 * author_type values: user | platform_admin | ai_auto | ai_draft | support_agent
 *   - ai_auto: message sent autonomously by AI (confidence ≥95%)
 *   - ai_draft: message drafted by AI, pending human review (never shown to user directly)
 *   - support_agent: message sent by a support staff member (is_support_agent = true)
 * is_internal_note: TRUE = only visible to platform admin / support agent
 */
export const supportRequestMessages = pgTable(
  'support_request_messages',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    supportRequestId: uuid('support_request_id')
      .notNull()
      .references(() => supportRequests.id, { onDelete: 'cascade' }),
    authorType: varchar('author_type', { length: 20 }).notNull(),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    body: text('body').notNull(),
    isInternalNote: boolean('is_internal_note').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('support_request_messages_request_id_created_at_idx').on(table.supportRequestId, table.createdAt),
  ],
);

export const supportRequestMessagesRelations = relations(supportRequestMessages, ({ one }) => ({
  supportRequest: one(supportRequests, {
    fields: [supportRequestMessages.supportRequestId],
    references: [supportRequests.id],
  }),
  author: one(users, {
    fields: [supportRequestMessages.authorUserId],
    references: [users.id],
  }),
}));

export type SupportRequestMessage = InferSelectModel<typeof supportRequestMessages>;
export type NewSupportRequestMessage = InferInsertModel<typeof supportRequestMessages>;
