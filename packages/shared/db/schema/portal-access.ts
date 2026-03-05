import {
  index,
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
import { portals } from './portals';
import { records } from './records';

export const portalAccess = pgTable(
  'portal_access',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    portalId: uuid('portal_id')
      .notNull()
      .references(() => portals.id, { onDelete: 'cascade' }),
    recordId: uuid('record_id').notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    authHash: varchar('auth_hash', { length: 255 }),
    token: varchar('token', { length: 255 }),
    tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
    // CP-001: Revocation tracking
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    // Known values: 'record_deleted', 'manager_revoked', 'portal_archived'
    revokedReason: varchar('revoked_reason', { length: 255 }),
    // Client-safe slug for portal URLs — raw record UUID never exposed
    recordSlug: varchar('record_slug', { length: 255 }),
    // Optional link to a contact/client record (post-MVP App Portal conversion)
    linkedRecordId: uuid('linked_record_id').references(() => records.id, { onDelete: 'set null' }),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('portal_access_tenant_portal_idx').on(table.tenantId, table.portalId),
    uniqueIndex('portal_access_portal_record_email_idx').on(table.portalId, table.recordId, table.email),
    uniqueIndex('portal_access_portal_record_slug_idx').on(table.portalId, table.recordSlug),
  ],
);

export const portalAccessRelations = relations(portalAccess, ({ one }) => ({
  tenant: one(tenants, {
    fields: [portalAccess.tenantId],
    references: [tenants.id],
  }),
  portal: one(portals, {
    fields: [portalAccess.portalId],
    references: [portals.id],
  }),
}));

export type PortalAccess = InferSelectModel<typeof portalAccess>;
export type NewPortalAccess = InferInsertModel<typeof portalAccess>;
