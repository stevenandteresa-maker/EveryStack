import {
  index,
  integer,
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
import { workspaces } from './workspaces';
import { users } from './users';

export const automations = pgTable(
  'automations',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    trigger: jsonb('trigger').$type<Record<string, unknown>>().notNull(),
    steps: jsonb('steps').$type<Record<string, unknown>[]>().array().notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    runCount: integer('run_count').default(0).notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    errorCount: integer('error_count').default(0).notNull(),
    environment: varchar('environment', { length: 20 }).default('live').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('automations_tenant_workspace_env_idx').on(table.tenantId, table.workspaceId, table.environment),
    index('automations_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const automationsRelations = relations(automations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [automations.tenantId],
    references: [tenants.id],
  }),
  workspace: one(workspaces, {
    fields: [automations.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [automations.createdBy],
    references: [users.id],
  }),
}));

export type Automation = InferSelectModel<typeof automations>;
export type NewAutomation = InferInsertModel<typeof automations>;
