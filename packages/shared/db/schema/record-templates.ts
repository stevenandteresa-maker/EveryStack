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
import { users } from './users';
import { sections } from './sections';

export const recordTemplates = pgTable(
  'record_templates',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 50 }),
    color: varchar('color', { length: 20 }),
    canonicalData: jsonb('canonical_data').$type<Record<string, unknown>>().default({}).notNull(),
    linkedRecords: jsonb('linked_records').$type<Record<string, unknown>>(),
    isDefault: boolean('is_default').default(false).notNull(),
    availableIn: varchar('available_in', { length: 50 }).array().default(sql`'{all}'`).notNull(),
    sectionId: uuid('section_id')
      .references(() => sections.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    publishState: varchar('publish_state', { length: 20 }).default('live').notNull(), // live | draft
    environment: varchar('environment', { length: 20 }).default('live').notNull(), // live | sandbox
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('record_templates_tenant_table_env_idx').on(table.tenantId, table.tableId, table.environment),
    index('record_templates_tenant_table_state_idx').on(table.tenantId, table.tableId, table.publishState),
    uniqueIndex('record_templates_tenant_table_default_idx')
      .on(table.tenantId, table.tableId)
      .where(sql`${table.isDefault} = true`),
  ],
);

export const recordTemplatesRelations = relations(recordTemplates, ({ one }) => ({
  table: one(tables, {
    fields: [recordTemplates.tableId],
    references: [tables.id],
  }),
  tenant: one(tenants, {
    fields: [recordTemplates.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [recordTemplates.createdBy],
    references: [users.id],
  }),
  section: one(sections, {
    fields: [recordTemplates.sectionId],
    references: [sections.id],
  }),
}));

export type RecordTemplate = InferSelectModel<typeof recordTemplates>;
export type NewRecordTemplate = InferInsertModel<typeof recordTemplates>;
