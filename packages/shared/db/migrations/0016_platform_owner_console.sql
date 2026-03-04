-- ---------------------------------------------------------------------------
-- 0016_platform_owner_console.sql
-- Platform Owner Console — additive schema migration
--
-- Adds billing/subscription columns to tenants, is_platform_admin to users,
-- and creates 6 new tables: support_requests, support_request_messages,
-- admin_impersonation_sessions, tenant_feature_flags, platform_notices,
-- user_dismissed_notices.
--
-- Rollback path:
--   DROP TABLE IF EXISTS "user_dismissed_notices" CASCADE;
--   DROP TABLE IF EXISTS "platform_notices" CASCADE;
--   DROP TABLE IF EXISTS "tenant_feature_flags" CASCADE;
--   DROP TABLE IF EXISTS "admin_impersonation_sessions" CASCADE;
--   DROP TABLE IF EXISTS "support_request_messages" CASCADE;
--   DROP TABLE IF EXISTS "support_requests" CASCADE;
--   DROP INDEX IF EXISTS "idx_tenants_stripe_customer";
--   DROP INDEX IF EXISTS "idx_tenants_subscription_status";
--   DROP INDEX IF EXISTS "idx_tenants_trial_ends";
--   DROP INDEX IF EXISTS "idx_tenants_churn_risk";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripe_customer_id";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "stripe_subscription_id";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "subscription_status";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "trial_ends_at";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "plan_override";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "plan_override_reason";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "plan_override_expires_at";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "is_internal";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "churn_risk_flag";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "churn_risk_note";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "flagged_at";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "first_active_at";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "last_active_at";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "admin_notes";
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "is_platform_admin";
-- ---------------------------------------------------------------------------

-- =========================================================================
-- 1. tenants — new columns
-- =========================================================================

ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" varchar(255);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_status" varchar(50) NOT NULL DEFAULT 'trialing';
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_override" varchar(50);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_override_reason" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_override_expires_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "is_internal" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "churn_risk_flag" varchar(20);
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "churn_risk_note" text;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "flagged_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "first_active_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "last_active_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "admin_notes" text;
--> statement-breakpoint

-- tenants — new indexes
CREATE INDEX "idx_tenants_stripe_customer" ON "tenants" ("stripe_customer_id") WHERE "stripe_customer_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_tenants_subscription_status" ON "tenants" ("subscription_status");
--> statement-breakpoint
CREATE INDEX "idx_tenants_trial_ends" ON "tenants" ("trial_ends_at") WHERE "trial_ends_at" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX "idx_tenants_churn_risk" ON "tenants" ("churn_risk_flag") WHERE "churn_risk_flag" IS NOT NULL;
--> statement-breakpoint

-- =========================================================================
-- 2. users — new column
-- =========================================================================

ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- =========================================================================
-- 3. support_requests — new table
-- =========================================================================

CREATE TABLE "support_requests" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid,
  "submitted_by_user" uuid,
  "category" varchar(50) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "priority" varchar(10) NOT NULL DEFAULT 'normal',
  "admin_notes" text,
  "resolved_at" timestamp with time zone,
  "resolution_notes" text,
  "source" varchar(20) NOT NULL DEFAULT 'in_app',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_submitted_by_user_users_id_fk" FOREIGN KEY ("submitted_by_user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_support_requests_tenant" ON "support_requests" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "idx_support_requests_status" ON "support_requests" ("status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_support_requests_priority" ON "support_requests" ("priority", "status");
--> statement-breakpoint

-- =========================================================================
-- 4. support_request_messages — new table
-- =========================================================================

CREATE TABLE "support_request_messages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "support_request_id" uuid NOT NULL,
  "author_type" varchar(20) NOT NULL,
  "author_user_id" uuid,
  "body" text NOT NULL,
  "is_internal_note" boolean NOT NULL DEFAULT false,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "support_request_messages" ADD CONSTRAINT "support_request_messages_support_request_id_support_requests_id_fk" FOREIGN KEY ("support_request_id") REFERENCES "public"."support_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "support_request_messages" ADD CONSTRAINT "support_request_messages_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_srm_request_id" ON "support_request_messages" ("support_request_id", "created_at");
--> statement-breakpoint

-- =========================================================================
-- 5. admin_impersonation_sessions — new table
-- =========================================================================

CREATE TABLE "admin_impersonation_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "admin_user_id" uuid NOT NULL,
  "tenant_id" uuid NOT NULL,
  "token" varchar(64) NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "ended_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_impersonation_sessions" ADD CONSTRAINT "admin_impersonation_sessions_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_impersonation_sessions" ADD CONSTRAINT "admin_impersonation_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "admin_impersonation_sessions_token_idx" ON "admin_impersonation_sessions" ("token") WHERE "ended_at" IS NULL;
--> statement-breakpoint

-- =========================================================================
-- 6. tenant_feature_flags — new table
-- =========================================================================

CREATE TABLE "tenant_feature_flags" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL,
  "flag_name" varchar(100) NOT NULL,
  "enabled" boolean NOT NULL,
  "set_by" uuid,
  "reason" text,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_feature_flags" ADD CONSTRAINT "tenant_feature_flags_set_by_users_id_fk" FOREIGN KEY ("set_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_feature_flags_tenant_flag_idx" ON "tenant_feature_flags" ("tenant_id", "flag_name");
--> statement-breakpoint
CREATE INDEX "idx_tenant_flags" ON "tenant_feature_flags" ("tenant_id");
--> statement-breakpoint

-- =========================================================================
-- 7. platform_notices — new table
-- =========================================================================

CREATE TABLE "platform_notices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "title" varchar(255) NOT NULL,
  "body" text NOT NULL,
  "type" varchar(20) NOT NULL DEFAULT 'info',
  "target" jsonb NOT NULL,
  "active_from" timestamp with time zone DEFAULT now() NOT NULL,
  "active_until" timestamp with time zone,
  "created_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_notices" ADD CONSTRAINT "platform_notices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- =========================================================================
-- 8. user_dismissed_notices — new table
-- =========================================================================

CREATE TABLE "user_dismissed_notices" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "notice_id" uuid NOT NULL,
  "dismissed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_dismissed_notices" ADD CONSTRAINT "user_dismissed_notices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_dismissed_notices" ADD CONSTRAINT "user_dismissed_notices_notice_id_platform_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."platform_notices"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "user_dismissed_notices_user_notice_idx" ON "user_dismissed_notices" ("user_id", "notice_id");
