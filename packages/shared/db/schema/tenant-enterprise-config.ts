import {
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

/**
 * Enterprise-specific support settings per tenant.
 * Stores dedicated contact, SLA terms, on-call info, and contract details.
 * Only populated for enterprise-plan tenants with negotiated support contracts.
 */
export const tenantEnterpriseConfig = pgTable(
  'tenant_enterprise_config',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    dedicatedContactId: uuid('dedicated_contact_id').references(() => users.id),
    slaHours: smallint('sla_hours'),
    onCallInfo: text('on_call_info'),
    contractNotes: text('contract_notes'),
    contractStartAt: timestamp('contract_start_at', { withTimezone: true }),
    contractEndAt: timestamp('contract_end_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('tenant_enterprise_config_tenant_id_idx').on(table.tenantId),
  ],
);

export const tenantEnterpriseConfigRelations = relations(tenantEnterpriseConfig, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantEnterpriseConfig.tenantId],
    references: [tenants.id],
  }),
  dedicatedContact: one(users, {
    fields: [tenantEnterpriseConfig.dedicatedContactId],
    references: [users.id],
  }),
}));

export type TenantEnterpriseConfig = InferSelectModel<typeof tenantEnterpriseConfig>;
export type NewTenantEnterpriseConfig = InferInsertModel<typeof tenantEnterpriseConfig>;
