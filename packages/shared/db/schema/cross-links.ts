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
import { fields } from './fields';
import { users } from './users';

export const crossLinks = pgTable(
  'cross_links',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }),
    sourceTableId: uuid('source_table_id')
      .notNull()
      .references(() => tables.id),
    sourceFieldId: uuid('source_field_id')
      .notNull()
      .references(() => fields.id),
    targetTableId: uuid('target_table_id')
      .notNull()
      .references(() => tables.id),
    targetDisplayFieldId: uuid('target_display_field_id')
      .notNull()
      .references(() => fields.id),
    relationshipType: varchar('relationship_type', { length: 20 }).notNull(), // many_to_one | one_to_many
    reverseFieldId: uuid('reverse_field_id').references(() => fields.id),
    linkScopeFilter: jsonb('link_scope_filter').$type<Record<string, unknown>>(),
    cardFields: jsonb('card_fields').$type<string[]>().default([]).notNull(),
    maxLinksPerRecord: integer('max_links_per_record').default(50).notNull(),
    maxDepth: integer('max_depth').default(3).notNull(),
    environment: varchar('environment', { length: 20 }).default('live').notNull(), // live | sandbox
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('cross_links_tenant_idx').on(table.tenantId),
    index('cross_links_source_table_idx').on(table.sourceTableId),
    index('cross_links_target_table_idx').on(table.targetTableId),
  ],
);

export const crossLinksRelations = relations(crossLinks, ({ one }) => ({
  tenant: one(tenants, {
    fields: [crossLinks.tenantId],
    references: [tenants.id],
  }),
  sourceTable: one(tables, {
    fields: [crossLinks.sourceTableId],
    references: [tables.id],
    relationName: 'crossLinkSource',
  }),
  sourceField: one(fields, {
    fields: [crossLinks.sourceFieldId],
    references: [fields.id],
    relationName: 'crossLinkSourceField',
  }),
  targetTable: one(tables, {
    fields: [crossLinks.targetTableId],
    references: [tables.id],
    relationName: 'crossLinkTarget',
  }),
  targetDisplayField: one(fields, {
    fields: [crossLinks.targetDisplayFieldId],
    references: [fields.id],
    relationName: 'crossLinkTargetDisplay',
  }),
  reverseField: one(fields, {
    fields: [crossLinks.reverseFieldId],
    references: [fields.id],
    relationName: 'crossLinkReverse',
  }),
  creator: one(users, {
    fields: [crossLinks.createdBy],
    references: [users.id],
  }),
}));

export type CrossLink = InferSelectModel<typeof crossLinks>;
export type NewCrossLink = InferInsertModel<typeof crossLinks>;
