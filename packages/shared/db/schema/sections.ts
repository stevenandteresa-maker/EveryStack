import {
  boolean,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

export const sections = pgTable(
  'sections',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .references(() => users.id),
    context: varchar('context', { length: 50 }).notNull(), // view_switcher | automations | cross_links | documents | sidebar_tables
    contextParentId: uuid('context_parent_id'),
    name: varchar('name', { length: 255 }).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    collapsed: boolean('collapsed').default(false).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('sections_tenant_context_parent_idx').on(table.tenantId, table.context, table.contextParentId),
  ],
);

export const sectionsRelations = relations(sections, ({ one }) => ({
  tenant: one(tenants, {
    fields: [sections.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [sections.userId],
    references: [users.id],
    relationName: 'sectionUser',
  }),
  creator: one(users, {
    fields: [sections.createdBy],
    references: [users.id],
    relationName: 'sectionCreator',
  }),
}));

export type Section = InferSelectModel<typeof sections>;
export type NewSection = InferInsertModel<typeof sections>;
