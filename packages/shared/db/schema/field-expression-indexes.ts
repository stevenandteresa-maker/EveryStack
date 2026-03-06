import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { tenants } from './tenants';
import { tables } from './tables';
import { fields } from './fields';

/**
 * Tracks expression indexes created on canonical_data JSONB paths.
 *
 * This avoids querying pg_indexes (PG-specific, not CockroachDB-safe)
 * and provides the application with a reliable record of which indexes
 * exist for cleanup and management.
 */
export const fieldExpressionIndexes = pgTable(
  'field_expression_indexes',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    tableId: uuid('table_id')
      .notNull()
      .references(() => tables.id),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id),
    fieldType: varchar('field_type', { length: 50 }).notNull(),
    indexName: varchar('index_name', { length: 63 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tenantId, table.tableId, table.fieldId] }),
    index('field_expr_idx_name_idx').on(table.indexName),
  ],
);

export type FieldExpressionIndex = InferSelectModel<typeof fieldExpressionIndexes>;
export type NewFieldExpressionIndex = InferInsertModel<typeof fieldExpressionIndexes>;
