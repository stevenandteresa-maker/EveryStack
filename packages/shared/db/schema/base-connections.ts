import {
  index,
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
import { users } from './users';

export const baseConnections = pgTable(
  'base_connections',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    platform: varchar('platform', { length: 50 }).notNull(), // airtable | notion | smartsuite
    externalBaseId: varchar('external_base_id', { length: 255 }),
    externalBaseName: varchar('external_base_name', { length: 255 }),
    oauthTokens: jsonb('oauth_tokens').$type<Record<string, unknown>>(),
    syncConfig: jsonb('sync_config').$type<Record<string, unknown>>().default({}).notNull(),
    syncDirection: varchar('sync_direction', { length: 50 }).default('bidirectional').notNull(), // inbound_only | bidirectional
    conflictResolution: varchar('conflict_resolution', { length: 50 }).default('last_write_wins').notNull(), // last_write_wins | manual
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    syncStatus: varchar('sync_status', { length: 50 }).default('active').notNull(), // active | paused | error | auth_required | converted | converted_dual_write | converted_finalized
    health: jsonb('health').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('base_connections_tenant_idx').on(table.tenantId),
    index('base_connections_tenant_platform_idx').on(table.tenantId, table.platform),
  ],
);

export const baseConnectionsRelations = relations(baseConnections, ({ one }) => ({
  tenant: one(tenants, {
    fields: [baseConnections.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [baseConnections.createdBy],
    references: [users.id],
  }),
}));

export type BaseConnection = InferSelectModel<typeof baseConnections>;
export type NewBaseConnection = InferInsertModel<typeof baseConnections>;
