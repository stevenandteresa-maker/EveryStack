import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

/**
 * Per-tenant feature flag overrides.
 * Environment variables are the platform-level default.
 * Rows in this table override the default for a specific tenant.
 */
export const tenantFeatureFlags = pgTable(
  'tenant_feature_flags',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    flagName: varchar('flag_name', { length: 100 }).notNull(),
    enabled: boolean('enabled').notNull(),
    setBy: uuid('set_by').references(() => users.id),
    reason: text('reason'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_feature_flags_tenant_flag_idx').on(table.tenantId, table.flagName),
    index('idx_tenant_flags').on(table.tenantId),
  ],
);

export const tenantFeatureFlagsRelations = relations(tenantFeatureFlags, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantFeatureFlags.tenantId],
    references: [tenants.id],
  }),
  setter: one(users, {
    fields: [tenantFeatureFlags.setBy],
    references: [users.id],
  }),
}));

export type TenantFeatureFlag = InferSelectModel<typeof tenantFeatureFlags>;
export type NewTenantFeatureFlag = InferInsertModel<typeof tenantFeatureFlags>;
