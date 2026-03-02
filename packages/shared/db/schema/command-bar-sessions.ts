import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';
import { tenants } from './tenants';

/**
 * Command Bar sessions — AI search sessions in Command Bar.
 */
export const commandBarSessions = pgTable(
  'command_bar_sessions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    context: jsonb('context').$type<Record<string, unknown>>().default({}).notNull(),
    messages: jsonb('messages').$type<Record<string, unknown>[]>().default([]).notNull(),
    resultSet: jsonb('result_set').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('command_bar_sessions_user_tenant_created_idx').on(
      table.userId,
      table.tenantId,
      table.createdAt.desc(),
    ),
  ],
);

export const commandBarSessionsRelations = relations(commandBarSessions, ({ one }) => ({
  user: one(users, {
    fields: [commandBarSessions.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [commandBarSessions.tenantId],
    references: [tenants.id],
  }),
}));

export type CommandBarSession = InferSelectModel<typeof commandBarSessions>;
export type NewCommandBarSession = InferInsertModel<typeof commandBarSessions>;
