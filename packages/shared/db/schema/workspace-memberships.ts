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
import { users } from './users';
import { tenants } from './tenants';
import { workspaces } from './workspaces';

export const workspaceMemberships = pgTable(
  'workspace_memberships',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // manager | team_member | viewer
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    statusEmoji: varchar('status_emoji', { length: 255 }),
    statusText: varchar('status_text', { length: 255 }),
    statusClearAt: timestamp('status_clear_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('workspace_memberships_user_workspace_idx').on(table.userId, table.workspaceId),
    index('workspace_memberships_tenant_workspace_idx').on(table.tenantId, table.workspaceId),
    index('workspace_memberships_user_idx').on(table.userId),
  ],
);

export const workspaceMembershipsRelations = relations(workspaceMemberships, ({ one }) => ({
  user: one(users, {
    fields: [workspaceMemberships.userId],
    references: [users.id],
  }),
  tenant: one(tenants, {
    fields: [workspaceMemberships.tenantId],
    references: [tenants.id],
  }),
  workspace: one(workspaces, {
    fields: [workspaceMemberships.workspaceId],
    references: [workspaces.id],
  }),
}));

export type WorkspaceMembership = InferSelectModel<typeof workspaceMemberships>;
export type NewWorkspaceMembership = InferInsertModel<typeof workspaceMemberships>;
