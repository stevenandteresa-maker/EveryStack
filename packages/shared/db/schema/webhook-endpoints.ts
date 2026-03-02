import {
  index,
  integer,
  pgTable,
  text,
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

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    url: varchar('url', { length: 2048 }).notNull(),
    signingSecret: varchar('signing_secret', { length: 64 }).notNull(),
    subscribedEvents: text('subscribed_events').array().notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('webhook_endpoints_tenant_workspace_idx').on(table.tenantId, table.workspaceId),
    index('webhook_endpoints_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one }) => ({
  tenant: one(tenants, {
    fields: [webhookEndpoints.tenantId],
    references: [tenants.id],
  }),
  workspace: one(workspaces, {
    fields: [webhookEndpoints.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [webhookEndpoints.createdBy],
    references: [users.id],
  }),
}));

export type WebhookEndpoint = InferSelectModel<typeof webhookEndpoints>;
export type NewWebhookEndpoint = InferInsertModel<typeof webhookEndpoints>;
