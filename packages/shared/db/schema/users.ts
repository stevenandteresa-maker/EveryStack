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
import { tenants } from './tenants';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    clerkId: varchar('clerk_id', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    avatarUrl: varchar('avatar_url', { length: 2048 }),
    preferences: jsonb('preferences').$type<{ locale?: string; theme?: string }>().default({}).notNull(),
    // CP-002: Personal tenant — set on first login via auto-provisioning; identity-bound, cannot be transferred
    personalTenantId: uuid('personal_tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
    // Platform Owner Console — never return in tenant-scoped queries (see RLS_EXCLUDED_COLUMNS)
    isPlatformAdmin: boolean('is_platform_admin').default(false).notNull(),
    // Support System — never return in tenant-scoped queries (see RLS_EXCLUDED_COLUMNS)
    isSupportAgent: boolean('is_support_agent').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('users_clerk_id_idx').on(table.clerkId),
    index('users_email_idx').on(table.email),
    index('users_personal_tenant_id_idx').on(table.personalTenantId),
  ],
);

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
