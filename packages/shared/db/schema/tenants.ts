import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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

    // Platform Owner Console — billing & subscription
    stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
    stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
    subscriptionStatus: varchar('subscription_status', { length: 50 }).default('trialing').notNull(),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    planOverride: varchar('plan_override', { length: 50 }),
    planOverrideReason: text('plan_override_reason'),
    planOverrideExpiresAt: timestamp('plan_override_expires_at', { withTimezone: true }),

    // Support System — plan-derived but manually overridable by platform admin
    // Values: standard | priority | enterprise
    supportTier: varchar('support_tier', { length: 20 }).default('standard').notNull(),

    // Platform Owner Console — internal & churn tracking
    isInternal: boolean('is_internal').default(false).notNull(),
    churnRiskFlag: varchar('churn_risk_flag', { length: 20 }),
    churnRiskNote: text('churn_risk_note'),
    flaggedAt: timestamp('flagged_at', { withTimezone: true }),
    firstActiveAt: timestamp('first_active_at', { withTimezone: true }),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    adminNotes: text('admin_notes'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('tenants_clerk_org_id_idx').on(table.clerkOrgId),
    index('tenants_name_idx').on(table.name),
    index('idx_tenants_stripe_customer').on(table.stripeCustomerId).where(sql`${table.stripeCustomerId} IS NOT NULL`),
    index('idx_tenants_subscription_status').on(table.subscriptionStatus),
    index('idx_tenants_trial_ends').on(table.trialEndsAt).where(sql`${table.trialEndsAt} IS NOT NULL`),
    index('idx_tenants_churn_risk').on(table.churnRiskFlag).where(sql`${table.churnRiskFlag} IS NOT NULL`),
  ],
);

export type Tenant = InferSelectModel<typeof tenants>;
export type NewTenant = InferInsertModel<typeof tenants>;
