import { pgView, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Unified access view: direct tenant memberships + agency access via tenant_relationships.
 *
 * This is a read-only Postgres VIEW defined in migration 0023.
 * Drizzle pgView() here provides TypeScript typing only — it does NOT manage the view DDL.
 *
 * source = 'direct'  → row from tenant_memberships (agency_tenant_id is null)
 * source = 'agency'  → row from tenant_relationships JOIN tenant_memberships
 */
export const effectiveMemberships = pgView('effective_memberships', {
  userId: uuid('user_id').notNull(),
  tenantId: uuid('tenant_id').notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  source: varchar('source', { length: 10 }).notNull(), // 'direct' | 'agency'
  agencyTenantId: uuid('agency_tenant_id'), // null for direct memberships
}).existing();

export type EffectiveMembership = typeof effectiveMemberships.$inferSelect;
