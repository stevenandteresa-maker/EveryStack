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
import { baseConnections } from './base-connections';
import { users } from './users';

export const syncSchemaChanges = pgTable(
  'sync_schema_changes',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    baseConnectionId: uuid('base_connection_id')
      .notNull()
      .references(() => baseConnections.id, { onDelete: 'cascade' }),
    changeType: varchar('change_type', { length: 50 }).notNull(), // field_type_changed | field_deleted | field_added | field_renamed
    fieldId: uuid('field_id'),
    platformFieldId: varchar('platform_field_id', { length: 255 }).notNull(),
    oldSchema: jsonb('old_schema').$type<Record<string, unknown>>(),
    newSchema: jsonb('new_schema').$type<Record<string, unknown>>(),
    impact: jsonb('impact').$type<Record<string, unknown>>().default({}).notNull(),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | accepted | rejected
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id),
  },
  (table) => [
    index('sync_schema_changes_tenant_connection_status_idx').on(table.tenantId, table.baseConnectionId, table.status),
  ],
);

export const syncSchemaChangesRelations = relations(syncSchemaChanges, ({ one }) => ({
  tenant: one(tenants, {
    fields: [syncSchemaChanges.tenantId],
    references: [tenants.id],
  }),
  baseConnection: one(baseConnections, {
    fields: [syncSchemaChanges.baseConnectionId],
    references: [baseConnections.id],
  }),
  resolver: one(users, {
    fields: [syncSchemaChanges.resolvedBy],
    references: [users.id],
  }),
}));

export type SyncSchemaChange = InferSelectModel<typeof syncSchemaChanges>;
export type NewSyncSchemaChange = InferInsertModel<typeof syncSchemaChanges>;
