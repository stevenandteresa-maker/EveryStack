import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { generateUUIDv7 } from '../uuid';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    clerkId: varchar('clerk_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 2048 }),
    preferences: jsonb('preferences').$type<{ locale?: string; theme?: string }>().default({}).notNull(),
    // Platform Owner Console — never return in tenant-scoped queries (see RLS_EXCLUDED_COLUMNS)
    isPlatformAdmin: boolean('is_platform_admin').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('users_clerk_id_idx').on(table.clerkId),
    index('users_email_idx').on(table.email),
  ],
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
