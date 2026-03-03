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
import { baseConnections } from './base-connections';
import { tables } from './tables';
import { fields } from './fields';

export const syncedFieldMappings = pgTable(
  'synced_field_mappings',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    baseConnectionId: uuid('base_connection_id')
      .notNull()
      .references(() => baseConnections.id, { onDelete: 'cascade' }),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id),
    externalFieldId: varchar('external_field_id', { length: 255 }).notNull(),
    externalFieldType: varchar('external_field_type', { length: 255 }).notNull(),
    status: varchar('status', { length: 50 }).default('active').notNull(), // active | type_mismatch | disconnected
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('synced_field_mappings_tenant_connection_idx').on(table.tenantId, table.baseConnectionId),
    index('synced_field_mappings_field_idx').on(table.fieldId),
  ],
);

export const syncedFieldMappingsRelations = relations(syncedFieldMappings, ({ one }) => ({
  tenant: one(tenants, {
    fields: [syncedFieldMappings.tenantId],
    references: [tenants.id],
  }),
  baseConnection: one(baseConnections, {
    fields: [syncedFieldMappings.baseConnectionId],
    references: [baseConnections.id],
  }),
  table: one(tables, {
    fields: [syncedFieldMappings.tableId],
    references: [tables.id],
  }),
  field: one(fields, {
    fields: [syncedFieldMappings.fieldId],
    references: [fields.id],
  }),
}));

export type SyncedFieldMapping = InferSelectModel<typeof syncedFieldMappings>;
export type NewSyncedFieldMapping = InferInsertModel<typeof syncedFieldMappings>;
