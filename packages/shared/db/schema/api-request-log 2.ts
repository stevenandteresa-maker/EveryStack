import {
  index,
  integer,
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
import { apiKeys } from './api-keys';

/**
 * Platform API request log — usage tracking and analytics.
 * Time-partitioned by created_at (monthly) in the migration.
 * 30-day retention policy (enforced outside schema).
 * Composite PK (id, created_at) is required for PostgreSQL range partitioning.
 */
export const apiRequestLog = pgTable(
  'api_request_log',
  {
    id: uuid('id').notNull().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    apiKeyId: uuid('api_key_id')
      .notNull()
      .references(() => apiKeys.id),
    method: varchar('method', { length: 8 }).notNull(),
    path: varchar('path', { length: 512 }).notNull(),
    statusCode: integer('status_code').notNull(),
    durationMs: integer('duration_ms'),
    requestSize: integer('request_size'),
    responseSize: integer('response_size'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index('api_request_log_tenant_key_created_idx').on(
      table.tenantId,
      table.apiKeyId,
      table.createdAt.desc(),
    ),
  ],
);

export const apiRequestLogRelations = relations(apiRequestLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [apiRequestLog.tenantId],
    references: [tenants.id],
  }),
  apiKey: one(apiKeys, {
    fields: [apiRequestLog.apiKeyId],
    references: [apiKeys.id],
  }),
}));

export type ApiRequestLog = InferSelectModel<typeof apiRequestLog>;
export type NewApiRequestLog = InferInsertModel<typeof apiRequestLog>;
