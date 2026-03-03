import {
  customType,
  index,
  jsonb,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { tables } from './tables';
import { users } from './users';

const tsvector = customType<{ data: string }>({
  dataType() {
    return 'tsvector';
  },
});

/**
 * Records — the most critical table in EveryStack.
 *
 * Hash-partitioned by tenant_id into 16 partitions (records_p0–p15).
 * Composite PK (tenant_id, id) is required because the partition key
 * must be part of the primary key in PostgreSQL hash-partitioned tables.
 *
 * The Drizzle schema defines the logical structure; the migration uses
 * raw SQL for PARTITION BY HASH and child partition creation.
 */
export const records = pgTable(
  'records',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    id: uuid('id').notNull().$defaultFn(generateUUIDv7),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id),
    canonicalData: jsonb('canonical_data').$type<Record<string, unknown>>().default({}).notNull(),
    syncMetadata: jsonb('sync_metadata').$type<Record<string, unknown>>(),
    searchVector: tsvector('search_vector'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),
    updatedBy: uuid('updated_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.id], name: 'records_pkey' }),
    index('records_tenant_table_archived_idx').on(table.tenantId, table.tableId, table.archivedAt),
    index('records_tenant_id_idx').on(table.tenantId, table.id),
  ],
);

export const recordsRelations = relations(records, ({ one }) => ({
  tenant: one(tenants, {
    fields: [records.tenantId],
    references: [tenants.id],
  }),
  table: one(tables, {
    fields: [records.tableId],
    references: [tables.id],
  }),
  creator: one(users, {
    fields: [records.createdBy],
    references: [users.id],
    relationName: 'recordCreator',
  }),
  updater: one(users, {
    fields: [records.updatedBy],
    references: [users.id],
    relationName: 'recordUpdater',
  }),
}));

export type DbRecord = InferSelectModel<typeof records>;
export type NewDbRecord = InferInsertModel<typeof records>;
