import {
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { users } from './users';
import { tenants } from './tenants';

/**
 * Short-lived impersonation sessions for platform admin "View as Tenant".
 * Token is a cryptographically random 64-character string (not JWT).
 * Sessions expire after 15 minutes.
 */
export const adminImpersonationSessions = pgTable(
  'admin_impersonation_sessions',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    adminUserId: uuid('admin_user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    token: varchar('token', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('admin_impersonation_sessions_token_idx')
      .on(table.token)
      .where(sql`${table.endedAt} IS NULL`),
  ],
);

export const adminImpersonationSessionsRelations = relations(adminImpersonationSessions, ({ one }) => ({
  adminUser: one(users, {
    fields: [adminImpersonationSessions.adminUserId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [adminImpersonationSessions.tenantId],
    references: [tenants.id],
  }),
}));

export type AdminImpersonationSession = InferSelectModel<typeof adminImpersonationSessions>;
export type NewAdminImpersonationSession = InferInsertModel<typeof adminImpersonationSessions>;
