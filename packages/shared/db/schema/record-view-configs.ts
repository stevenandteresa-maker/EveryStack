import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tables } from './tables';
import { tenants } from './tenants';
import { users } from './users';

export const recordViewConfigs = pgTable(
  'record_view_configs',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    layout: jsonb('layout').$type<Record<string, unknown>>().default({}).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('record_view_configs_tenant_table_idx').on(table.tenantId, table.tableId),
    uniqueIndex('record_view_configs_tenant_table_default_idx')
      .on(table.tenantId, table.tableId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const recordViewConfigsRelations = relations(recordViewConfigs, ({ one }) => ({
  table: one(tables, {
    fields: [recordViewConfigs.tableId],
    references: [tables.id],
  }),
  tenant: one(tenants, {
    fields: [recordViewConfigs.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [recordViewConfigs.createdBy],
    references: [users.id],
  }),
}));

export type RecordViewConfig = InferSelectModel<typeof recordViewConfigs>;
export type NewRecordViewConfig = InferInsertModel<typeof recordViewConfigs>;
