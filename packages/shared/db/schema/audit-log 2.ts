import {
  index,
  jsonb,
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

/**
 * Immutable audit trail.
 * Time-partitioned by created_at (monthly) in the migration.
 * Composite PK (id, created_at) is required for PostgreSQL range partitioning.
 *
 * Seven valid actor_type values:
 *   user | sync | automation | portal_client | system | agent | api_key
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').notNull().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    actorType: varchar('actor_type', { length: 32 }).notNull(),
    actorId: uuid('actor_id').notNull(),
    actorLabel: varchar('actor_label', { length: 255 }),
    action: varchar('action', { length: 64 }).notNull(),
    entityType: varchar('entity_type', { length: 64 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().default({}).notNull(),
    traceId: varchar('trace_id', { length: 255 }),
    ipAddress: varchar('ip_address', { length: 45 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.id, table.createdAt] }),
    index('audit_log_tenant_created_idx').on(table.tenantId, table.createdAt.desc()),
    index('audit_log_tenant_entity_idx').on(table.tenantId, table.entityType, table.entityId),
    index('audit_log_tenant_actor_idx').on(table.tenantId, table.actorType, table.actorId),
  ],
);

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLog.tenantId],
    references: [tenants.id],
  }),
}));

export type AuditLog = InferSelectModel<typeof auditLog>;
export type NewAuditLog = InferInsertModel<typeof auditLog>;
