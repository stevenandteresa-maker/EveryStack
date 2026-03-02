import {
  index,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';

export const portalSessions = pgTable(
  'portal_sessions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    authType: varchar('auth_type', { length: 50 }).notNull(),
    authId: uuid('auth_id').notNull(),
    portalId: uuid('portal_id').notNull(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => [
    index('portal_sessions_auth_idx').on(table.authType, table.authId),
    index('portal_sessions_portal_idx').on(table.portalId),
  ],
);

export const portalSessionsRelations = relations(portalSessions, ({ one }) => ({
  tenant: one(tenants, {
    fields: [portalSessions.tenantId],
    references: [tenants.id],
  }),
}));

export type PortalSession = InferSelectModel<typeof portalSessions>;
export type NewPortalSession = InferInsertModel<typeof portalSessions>;
