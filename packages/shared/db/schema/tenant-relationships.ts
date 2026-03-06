import {
  boolean,
  index,
  jsonb,
  pgTable,
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
 * Formal tenant-to-tenant agency relationships.
 *
 * An agency tenant holds authorized access to client tenants.
 * Agency members access client tenants via this row — they are NOT added
 * to the client's tenant_memberships. Revoking the relationship cleanly
 * removes all access.
 *
 * All string columns are VARCHAR, not Postgres ENUM — per CLAUDE.md convention
 * for extensible value sets.
 */
export const tenantRelationships = pgTable(
  'tenant_relationships',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    agencyTenantId: uuid('agency_tenant_id')
      .notNull()
      .references(() => tenants.id),
    clientTenantId: uuid('client_tenant_id')
      .notNull()
      .references(() => tenants.id),
    // Values: 'managed' | 'white_label' | 'reseller' | 'referral'
    relationshipType: varchar('relationship_type', { length: 50 }).notNull(),
    // Values: 'pending' | 'active' | 'suspended' | 'revoked'
    status: varchar('status', { length: 50 }).notNull(),
    // Values: 'admin' | 'builder' | 'read_only'
    accessLevel: varchar('access_level', { length: 50 }).notNull(),
    // Values: 'agency' | 'client'
    initiatedBy: varchar('initiated_by', { length: 50 }).notNull(),
    authorizedByUserId: uuid('authorized_by_user_id').references(() => users.id),
    agencyBillingResponsible: boolean('agency_billing_responsible').default(false).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
    // JSONB metadata: includes contract_ref, hide_member_identity for white_label
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('tenant_relationships_agency_client_idx').on(
      table.agencyTenantId,
      table.clientTenantId,
    ),
    index('tenant_relationships_agency_status_idx').on(
      table.agencyTenantId,
      table.status,
    ),
    index('tenant_relationships_client_status_idx').on(
      table.clientTenantId,
      table.status,
    ),
  ],
);

export const tenantRelationshipsRelations = relations(tenantRelationships, ({ one }) => ({
  agencyTenant: one(tenants, {
    fields: [tenantRelationships.agencyTenantId],
    references: [tenants.id],
    relationName: 'agencyTenantRelationships',
  }),
  clientTenant: one(tenants, {
    fields: [tenantRelationships.clientTenantId],
    references: [tenants.id],
    relationName: 'clientTenantRelationships',
  }),
  authorizedBy: one(users, {
    fields: [tenantRelationships.authorizedByUserId],
    references: [users.id],
    relationName: 'authorizedTenantRelationships',
  }),
  revokedBy: one(users, {
    fields: [tenantRelationships.revokedByUserId],
    references: [users.id],
    relationName: 'revokedTenantRelationships',
  }),
}));

export type TenantRelationship = InferSelectModel<typeof tenantRelationships>;
export type NewTenantRelationship = InferInsertModel<typeof tenantRelationships>;
