import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { generateUUIDv7 } from '../uuid';
import { tenants } from './tenants';
import { users } from './users';

export const userTasks = pgTable(
  'user_tasks',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 255 }).notNull(),
    completed: boolean('completed').default(false).notNull(),
    dueDate: date('due_date'),
    sortOrder: integer('sort_order').default(0).notNull(),
    parentTaskId: uuid('parent_task_id').references(
      (): AnyPgColumn => userTasks.id,
      { onDelete: 'cascade' },
    ),
    linkedRecordId: uuid('linked_record_id'),
    linkedTenantId: uuid('linked_tenant_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    index('user_tasks_user_completed_idx').on(table.userId, table.completed),
    index('user_tasks_user_due_date_idx').on(table.userId, table.dueDate),
    index('user_tasks_parent_idx').on(table.parentTaskId),
  ],
);

export const userTasksRelations = relations(userTasks, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [userTasks.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [userTasks.userId],
    references: [users.id],
  }),
  parentTask: one(userTasks, {
    fields: [userTasks.parentTaskId],
    references: [userTasks.id],
    relationName: 'subtasks',
  }),
  subtasks: many(userTasks, {
    relationName: 'subtasks',
  }),
}));

export type UserTask = InferSelectModel<typeof userTasks>;
export type NewUserTask = InferInsertModel<typeof userTasks>;
