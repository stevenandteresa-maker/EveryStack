import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { tables } from './tables';
import { recordViewConfigs } from './record-view-configs';
import { users } from './users';

export const forms = pgTable(
  'forms',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id),
    recordViewConfigId: uuid('record_view_config_id')
      .notNull()
      .references(() => recordViewConfigs.id),
    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('forms_tenant_idx').on(table.tenantId),
    uniqueIndex('forms_slug_idx').on(table.slug),
  ],
);

export const formsRelations = relations(forms, ({ one }) => ({
  tenant: one(tenants, {
    fields: [forms.tenantId],
    references: [tenants.id],
  }),
  table: one(tables, {
    fields: [forms.tableId],
    references: [tables.id],
  }),
  recordViewConfig: one(recordViewConfigs, {
    fields: [forms.recordViewConfigId],
    references: [recordViewConfigs.id],
  }),
  creator: one(users, {
    fields: [forms.createdBy],
    references: [users.id],
  }),
}));

export type Form = InferSelectModel<typeof forms>;
export type NewForm = InferInsertModel<typeof forms>;
