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

export const portals = pgTable(
  'portals',
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
    authType: varchar('auth_type', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('portals_tenant_idx').on(table.tenantId),
    uniqueIndex('portals_slug_idx').on(table.slug),
  ],
);

export const portalsRelations = relations(portals, ({ one }) => ({
  tenant: one(tenants, {
    fields: [portals.tenantId],
    references: [tenants.id],
  }),
  table: one(tables, {
    fields: [portals.tableId],
    references: [tables.id],
  }),
  recordViewConfig: one(recordViewConfigs, {
    fields: [portals.recordViewConfigId],
    references: [recordViewConfigs.id],
  }),
  creator: one(users, {
    fields: [portals.createdBy],
    references: [users.id],
  }),
}));

export type Portal = InferSelectModel<typeof portals>;
export type NewPortal = InferInsertModel<typeof portals>;
