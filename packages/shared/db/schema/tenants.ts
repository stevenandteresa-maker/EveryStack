import {
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

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().$defaultFn(generateUUIDv7),
    clerkOrgId: varchar('clerk_org_id', { length: 255 }),
    name: varchar('name', { length: 255 }).notNull(),
    plan: varchar('plan', { length: 50 }).default('freelancer').notNull(),
    defaultLocale: varchar('default_locale', { length: 10 }).default('en').notNull(),
    settings: jsonb('settings')
      .$type<{
        branding_accent_color?: string;
        logo_url?: string;
        email_branding?: Record<string, unknown>;
        personal?: boolean;
        auto_provisioned?: boolean;
      }>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('tenants_clerk_org_id_idx').on(table.clerkOrgId),
    index('tenants_name_idx').on(table.name),
  ],
);

export type Tenant = InferSelectModel<typeof tenants>;
export type NewTenant = InferInsertModel<typeof tenants>;
