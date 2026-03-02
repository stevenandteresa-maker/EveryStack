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
import { users } from './users';

export const tenantMemberships = pgTable(
  'tenant_memberships',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    role: varchar('role', { length: 20 }).notNull(), // owner | admin | member
    status: varchar('status', { length: 20 }).notNull(), // active | invited | suspended
    invitedBy: uuid('invited_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('tenant_memberships_tenant_user_idx').on(table.tenantId, table.userId),
    index('tenant_memberships_user_idx').on(table.userId),
  ],
);

export const tenantMembershipsRelations = relations(tenantMemberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [tenantMemberships.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [tenantMemberships.userId],
    references: [users.id],
    relationName: 'userTenantMemberships',
  }),
  inviter: one(users, {
    fields: [tenantMemberships.invitedBy],
    references: [users.id],
    relationName: 'invitedTenantMemberships',
  }),
}));

export type TenantMembership = InferSelectModel<typeof tenantMemberships>;
export type NewTenantMembership = InferInsertModel<typeof tenantMemberships>;
