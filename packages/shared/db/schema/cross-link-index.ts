import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { tenants } from './tenants';
import { crossLinks } from './cross-links';
import { tables } from './tables';

export const crossLinkIndex = pgTable(
  'cross_link_index',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    crossLinkId: uuid('cross_link_id')
      .notNull()
      .references(() => crossLinks.id, { onDelete: 'cascade' }),
    sourceRecordId: uuid('source_record_id').notNull(),
    sourceTableId: uuid('source_table_id')
      .notNull()
      .references(() => tables.id),
    targetRecordId: uuid('target_record_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.tenantId, table.crossLinkId, table.sourceRecordId, table.targetRecordId],
      name: 'cross_link_index_pkey',
    }),
    index('cross_link_index_target_idx').on(table.tenantId, table.targetRecordId, table.crossLinkId),
    index('cross_link_index_source_idx').on(table.tenantId, table.sourceRecordId, table.crossLinkId),
  ],
);

export const crossLinkIndexRelations = relations(crossLinkIndex, ({ one }) => ({
  tenant: one(tenants, {
    fields: [crossLinkIndex.tenantId],
    references: [tenants.id],
  }),
  crossLink: one(crossLinks, {
    fields: [crossLinkIndex.crossLinkId],
    references: [crossLinks.id],
  }),
  sourceTable: one(tables, {
    fields: [crossLinkIndex.sourceTableId],
    references: [tables.id],
  }),
}));

export type CrossLinkIndex = InferSelectModel<typeof crossLinkIndex>;
export type NewCrossLinkIndex = InferInsertModel<typeof crossLinkIndex>;
