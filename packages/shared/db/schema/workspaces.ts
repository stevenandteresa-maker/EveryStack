import {
  index,
  integer,
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
import { boards } from './boards';
import { users } from './users';

export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    boardId: uuid('board_id').references(() => boards.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }).notNull(),
    icon: varchar('icon', { length: 255 }),
    color: varchar('color', { length: 255 }),
    slug: varchar('slug', { length: 255 }).notNull(),
    sortOrder: integer('sort_order'),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('workspaces_tenant_slug_idx').on(table.tenantId, table.slug),
    index('workspaces_tenant_sort_idx').on(table.tenantId, table.sortOrder),
    index('workspaces_board_idx').on(table.boardId),
  ],
);

export const workspacesRelations = relations(workspaces, ({ one }) => ({
  tenant: one(tenants, {
    fields: [workspaces.tenantId],
    references: [tenants.id],
  }),
  board: one(boards, {
    fields: [workspaces.boardId],
    references: [boards.id],
  }),
  creator: one(users, {
    fields: [workspaces.createdBy],
    references: [users.id],
  }),
}));

export type Workspace = InferSelectModel<typeof workspaces>;
export type NewWorkspace = InferInsertModel<typeof workspaces>;
