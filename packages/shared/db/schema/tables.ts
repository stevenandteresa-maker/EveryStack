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
import { workspaces } from './workspaces';
import { tenants } from './tenants';
import { users } from './users';

export const tables = pgTable(
  'tables',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    tableType: varchar('table_type', { length: 50 }).default('table').notNull(), // table | projects | calendar | documents | wiki
    tabColor: varchar('tab_color', { length: 20 }),
    environment: varchar('environment', { length: 20 }).default('live').notNull(), // live | sandbox
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('tables_tenant_workspace_idx').on(table.tenantId, table.workspaceId),
    index('tables_workspace_env_idx').on(table.workspaceId, table.environment),
  ],
);

export const tablesRelations = relations(tables, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [tables.workspaceId],
    references: [workspaces.id],
  }),
  tenant: one(tenants, {
    fields: [tables.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [tables.createdBy],
    references: [users.id],
  }),
}));

export type Table = InferSelectModel<typeof tables>;
export type NewTable = InferInsertModel<typeof tables>;
