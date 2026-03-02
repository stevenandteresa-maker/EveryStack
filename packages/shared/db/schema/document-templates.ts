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
import { tables } from './tables';
import { users } from './users';

export const documentTemplates = pgTable(
  'document_templates',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().default({}).notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    version: integer('version').default(1).notNull(),
    environment: varchar('environment', { length: 20 }).default('live').notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('document_templates_tenant_table_idx').on(table.tenantId, table.tableId),
  ],
);

export const documentTemplatesRelations = relations(documentTemplates, ({ one }) => ({
  tenant: one(tenants, {
    fields: [documentTemplates.tenantId],
    references: [tenants.id],
  }),
  table: one(tables, {
    fields: [documentTemplates.tableId],
    references: [tables.id],
  }),
  creator: one(users, {
    fields: [documentTemplates.createdBy],
    references: [users.id],
  }),
}));

export type DocumentTemplate = InferSelectModel<typeof documentTemplates>;
export type NewDocumentTemplate = InferInsertModel<typeof documentTemplates>;
