import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { baseConnections } from './base-connections';
import { users } from './users';

export const syncFailures = pgTable(
  'sync_failures',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    baseConnectionId: uuid('base_connection_id')
      .notNull()
      .references(() => baseConnections.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id'),
    direction: varchar('direction', { length: 20 }).notNull(), // inbound | outbound
    errorCode: varchar('error_code', { length: 50 }).notNull(), // validation | schema_mismatch | payload_too_large | platform_rejected | unknown
    errorMessage: text('error_message'),
    platformRecordId: varchar('platform_record_id', { length: 255 }),
    payload: jsonb('payload').$type<unknown>(),
    retryCount: integer('retry_count').default(0).notNull(),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | retrying | resolved | skipped | requires_manual_resolution
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id),
  },
  (table) => [
    index('sync_failures_tenant_connection_status_idx').on(table.tenantId, table.baseConnectionId, table.status),
    index('sync_failures_tenant_status_idx').on(table.tenantId, table.status),
  ],
);

export const syncFailuresRelations = relations(syncFailures, ({ one }) => ({
  tenant: one(tenants, {
    fields: [syncFailures.tenantId],
    references: [tenants.id],
  }),
  baseConnection: one(baseConnections, {
    fields: [syncFailures.baseConnectionId],
    references: [baseConnections.id],
  }),
  resolver: one(users, {
    fields: [syncFailures.resolvedBy],
    references: [users.id],
  }),
}));

export type SyncFailure = InferSelectModel<typeof syncFailures>;
export type NewSyncFailure = InferInsertModel<typeof syncFailures>;
