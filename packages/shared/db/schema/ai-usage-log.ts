import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

/**
 * AI usage log — tracks all AI metering events.
 * Time-partitioned by created_at (monthly) in the migration.
 * Composite PK (id, created_at) is required for PostgreSQL range partitioning.
 */
export const aiUsageLog = pgTable(
  'ai_usage_log',
  {
    id: uuid('id').notNull().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    feature: varchar('feature', { length: 64 }).notNull(),
    model: varchar('model', { length: 32 }),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cachedInput: integer('cached_input').default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
    creditsCharged: numeric('credits_charged', { precision: 10, scale: 2 }),
    status: varchar('status', { length: 20 }).notNull(),
    durationMs: integer('duration_ms'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index('ai_usage_log_tenant_created_idx').on(table.tenantId, table.createdAt.desc()),
    index('ai_usage_log_tenant_feature_idx').on(table.tenantId, table.feature),
  ],
);

export const aiUsageLogRelations = relations(aiUsageLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [aiUsageLog.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [aiUsageLog.userId],
    references: [users.id],
  }),
}));

export type AiUsageLog = InferSelectModel<typeof aiUsageLog>;
export type NewAiUsageLog = InferInsertModel<typeof aiUsageLog>;
