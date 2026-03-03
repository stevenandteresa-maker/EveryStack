import {
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
import { boards } from './boards';
import { users } from './users';

export const boardMemberships = pgTable(
  'board_memberships',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    boardId: uuid('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    defaultWorkspaceRole: varchar('default_workspace_role', { length: 20 }).notNull(), // manager | team_member | viewer
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('board_memberships_board_user_idx').on(table.boardId, table.userId),
  ],
);

export const boardMembershipsRelations = relations(boardMemberships, ({ one }) => ({
  tenant: one(tenants, {
    fields: [boardMemberships.tenantId],
    references: [tenants.id],
  }),
  board: one(boards, {
    fields: [boardMemberships.boardId],
    references: [boards.id],
  }),
  user: one(users, {
    fields: [boardMemberships.userId],
    references: [users.id],
  }),
}));

export type BoardMembership = InferSelectModel<typeof boardMemberships>;
export type NewBoardMembership = InferInsertModel<typeof boardMemberships>;
