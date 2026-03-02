import {
  boolean,
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
import { tables } from './tables';
import { tenants } from './tenants';
import { users } from './users';

export const views = pgTable(
  'views',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    viewType: varchar('view_type', { length: 50 }).default('grid').notNull(), // grid | card — MVP
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    permissions: jsonb('permissions').$type<Record<string, unknown>>().default({}).notNull(),
    isShared: boolean('is_shared').default(true).notNull(),
    publishState: varchar('publish_state', { length: 20 }).default('live').notNull(), // live | draft
    environment: varchar('environment', { length: 20 }).default('live').notNull(), // live | sandbox
    position: integer('position').default(0).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('views_tenant_table_env_idx').on(table.tenantId, table.tableId, table.environment),
    index('views_table_position_idx').on(table.tableId, table.position),
  ],
);

export const viewsRelations = relations(views, ({ one }) => ({
  table: one(tables, {
    fields: [views.tableId],
    references: [tables.id],
  }),
  tenant: one(tenants, {
    fields: [views.tenantId],
    references: [tenants.id],
  }),
  creator: one(users, {
    fields: [views.createdBy],
    references: [users.id],
  }),
}));

export type View = InferSelectModel<typeof views>;
export type NewView = InferInsertModel<typeof views>;
