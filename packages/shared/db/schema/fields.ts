import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
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

export const fields = pgTable(
  'fields',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    fieldType: varchar('field_type', { length: 50 }).notNull(),
    fieldSubType: varchar('field_sub_type', { length: 50 }),
    isPrimary: boolean('is_primary').default(false).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    required: boolean('required').default(false).notNull(),
    unique: boolean('unique').default(false).notNull(),
    readOnly: boolean('read_only').default(false).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    display: jsonb('display').$type<Record<string, unknown>>().default({}).notNull(),
    permissions: jsonb('permissions').$type<Record<string, unknown>>().default({}).notNull(),
    defaultValue: jsonb('default_value').$type<unknown>(),
    description: text('description'),
    sortOrder: integer('sort_order').default(0).notNull(),
    externalFieldId: varchar('external_field_id', { length: 255 }),
    environment: varchar('environment', { length: 20 }).default('live').notNull(), // live | sandbox
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('fields_tenant_table_env_idx').on(table.tenantId, table.tableId, table.environment),
    index('fields_table_sort_idx').on(table.tableId, table.sortOrder),
    uniqueIndex('fields_table_external_idx')
      .on(table.tableId, table.externalFieldId)
      .where(sql`${table.externalFieldId} IS NOT NULL`),
  ],
);

export const fieldsRelations = relations(fields, ({ one }) => ({
  table: one(tables, {
    fields: [fields.tableId],
    references: [tables.id],
  }),
  tenant: one(tenants, {
    fields: [fields.tenantId],
    references: [tenants.id],
  }),
}));

export type Field = InferSelectModel<typeof fields>;
export type NewField = InferInsertModel<typeof fields>;
