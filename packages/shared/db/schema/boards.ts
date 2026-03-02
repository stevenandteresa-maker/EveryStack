import {
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';

export const boards = pgTable(
  'boards',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    name: varchar('name', { length: 255 }).notNull(),
    icon: varchar('icon', { length: 255 }),
    color: varchar('color', { length: 20 }),
    sortOrder: integer('sort_order'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('boards_tenant_sort_idx').on(table.tenantId, table.sortOrder),
  ],
);

export const boardsRelations = relations(boards, ({ one }) => ({
  tenant: one(tenants, {
    fields: [boards.tenantId],
    references: [tenants.id],
  }),
}));

export type Board = InferSelectModel<typeof boards>;
export type NewBoard = InferInsertModel<typeof boards>;
