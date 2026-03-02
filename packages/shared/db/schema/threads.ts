import {
  index,
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

export const threads = pgTable(
  'threads',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    scopeType: varchar('scope_type', { length: 50 }).notNull(),
    scopeId: uuid('scope_id').notNull(),
    visibility: varchar('visibility', { length: 50 }).default('internal').notNull(),
    name: varchar('name', { length: 255 }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('threads_tenant_scope_idx').on(table.tenantId, table.scopeType, table.scopeId),
    index('threads_tenant_scope_type_idx').on(table.tenantId, table.scopeType),
  ],
);

export const threadsRelations = relations(threads, ({ one }) => ({
  tenant: one(tenants, {
    fields: [threads.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [threads.createdBy],
    references: [users.id],
  }),
}));

export type Thread = InferSelectModel<typeof threads>;
export type NewThread = InferInsertModel<typeof threads>;
