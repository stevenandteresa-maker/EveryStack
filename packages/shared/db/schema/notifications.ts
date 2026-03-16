import {
  boolean,
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';
import { tenants } from './tenants';

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    /** Known values: 'mention', 'dm', 'thread_reply', 'approval_requested', 'approval_decided', 'automation_failed', 'sync_error', 'system' */
    type: varchar('type', { length: 100 }).notNull(),
    /** Short display text, e.g. "Sarah mentioned you in Project Alpha" */
    title: varchar('title', { length: 255 }).notNull().default(''),
    /** Optional preview text (first 120 chars of message content) */
    body: varchar('body', { length: 500 }),
    /** Known values: 'thread_message', 'approval', 'automation', 'sync', 'system' */
    sourceType: varchar('source_type', { length: 50 }),
    sourceThreadId: uuid('source_thread_id'),
    sourceMessageId: uuid('source_message_id'),
    sourceRecordId: uuid('source_record_id'),
    /** Who triggered the notification (null for system) */
    actorId: uuid('actor_id').references(() => users.id),
    /** Dedup/collapse key, e.g. 'thread:{threadId}' */
    groupKey: varchar('group_key', { length: 255 }),
    read: boolean('read').default(false).notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_read_created_idx').on(
      table.userId,
      table.read,
      table.createdAt.desc(),
    ),
    index('notifications_user_tenant_idx').on(table.userId, table.tenantId),
    index('notifications_user_tenant_created_idx').on(
      table.userId,
      table.tenantId,
      table.createdAt.desc(),
    ),
  ],
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [notifications.tenantId],
    references: [tenants.id],
  }),
  actor: one(users, {
    fields: [notifications.actorId],
    references: [users.id],
    relationName: 'notificationActor',
  }),
}));

export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;
