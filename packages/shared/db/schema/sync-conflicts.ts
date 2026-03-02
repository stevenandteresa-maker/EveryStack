import {
  index,
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
import { fields } from './fields';
import { users } from './users';

export const syncConflicts = pgTable(
  'sync_conflicts',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    recordId: uuid('record_id').notNull(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id),
    localValue: jsonb('local_value').$type<unknown>(),
    remoteValue: jsonb('remote_value').$type<unknown>(),
    baseValue: jsonb('base_value').$type<unknown>(),
    platform: varchar('platform', { length: 50 }).notNull(),
    status: varchar('status', { length: 50 }).default('pending').notNull(), // pending | resolved
    resolvedBy: uuid('resolved_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (table) => [
    index('sync_conflicts_tenant_status_idx').on(table.tenantId, table.status),
    index('sync_conflicts_record_idx').on(table.recordId),
  ],
);

export const syncConflictsRelations = relations(syncConflicts, ({ one }) => ({
  tenant: one(tenants, {
    fields: [syncConflicts.tenantId],
    references: [tenants.id],
  }),
  field: one(fields, {
    fields: [syncConflicts.fieldId],
    references: [fields.id],
  }),
  resolver: one(users, {
    fields: [syncConflicts.resolvedBy],
    references: [users.id],
  }),
}));

export type SyncConflict = InferSelectModel<typeof syncConflicts>;
export type NewSyncConflict = InferInsertModel<typeof syncConflicts>;
