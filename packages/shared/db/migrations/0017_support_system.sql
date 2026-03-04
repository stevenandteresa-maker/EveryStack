-- ---------------------------------------------------------------------------
-- 0017_support_system.sql
-- Support System — additive schema migration
--
-- Extends the platform owner console schema with support system tables and
-- columns: AI support sessions, feature requests, enterprise config,
-- urgency scoring, support agent role, and support tier tracking.
--
-- All changes are additive — no existing columns, RLS policies, or
-- application code are modified.
--
-- Rollback path:
--   ALTER TABLE "support_requests" DROP CONSTRAINT IF EXISTS "support_requests_ai_session_id_ai_support_sessions_id_fk";
--   DROP TABLE IF EXISTS "tenant_enterprise_config" CASCADE;
--   DROP TABLE IF EXISTS "feature_requests" CASCADE;
--   DROP TABLE IF EXISTS "ai_support_sessions" CASCADE;
--   DROP INDEX IF EXISTS "idx_ai_support_tenant";
--   DROP INDEX IF EXISTS "idx_ai_support_request";
--   DROP INDEX IF EXISTS "idx_feature_requests_status";
--   DROP INDEX IF EXISTS "idx_feature_requests_tenant";
--   DROP INDEX IF EXISTS "tenant_enterprise_config_tenant_id_idx";
--   ALTER TABLE "support_requests" DROP COLUMN IF EXISTS "urgency_score";
--   ALTER TABLE "support_requests" DROP COLUMN IF EXISTS "ai_session_id";
--   ALTER TABLE "support_requests" DROP COLUMN IF EXISTS "assigned_to";
--   ALTER TABLE "support_requests" DROP COLUMN IF EXISTS "resolved_by";
--   ALTER TABLE "support_requests" DROP COLUMN IF EXISTS "tier";
--   ALTER TABLE "tenants" DROP COLUMN IF EXISTS "support_tier";
--   ALTER TABLE "users" DROP COLUMN IF EXISTS "is_support_agent";
-- ---------------------------------------------------------------------------

-- =========================================================================
-- 1. users — new column
-- =========================================================================

ALTER TABLE "users" ADD COLUMN "is_support_agent" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

-- =========================================================================
-- 2. tenants — new column
-- =========================================================================

ALTER TABLE "tenants" ADD COLUMN "support_tier" varchar(20) NOT NULL DEFAULT 'standard';
--> statement-breakpoint

-- =========================================================================
-- 3. support_requests — new columns
-- =========================================================================

ALTER TABLE "support_requests" ADD COLUMN "urgency_score" smallint NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "ai_session_id" uuid;
--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "assigned_to" uuid;
--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "resolved_by" varchar(20);
--> statement-breakpoint
ALTER TABLE "support_requests" ADD COLUMN "tier" varchar(20) NOT NULL DEFAULT 'standard';
--> statement-breakpoint

-- assigned_to FK to users
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- =========================================================================
-- 4. ai_support_sessions — new table
-- =========================================================================

CREATE TABLE "ai_support_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "support_request_id" uuid,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "classified_category" varchar(50),
  "urgency_score" smallint,
  "rephrase_text" text,
  "user_confirmed" boolean,
  "clarification_rounds" smallint NOT NULL DEFAULT 0,
  "kb_chunks_used" jsonb,
  "confidence_score" smallint,
  "draft_reply" text,
  "auto_sent" boolean NOT NULL DEFAULT false,
  "outcome" varchar(20),
  "ai_credits_used" integer NOT NULL DEFAULT 0,
  "model_used" varchar(100),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_support_sessions" ADD CONSTRAINT "ai_support_sessions_support_request_id_support_requests_id_fk" FOREIGN KEY ("support_request_id") REFERENCES "public"."support_requests"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_support_sessions" ADD CONSTRAINT "ai_support_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_support_sessions" ADD CONSTRAINT "ai_support_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_ai_support_tenant" ON "ai_support_sessions" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "idx_ai_support_request" ON "ai_support_sessions" ("support_request_id");
--> statement-breakpoint

-- Now add the deferred FK from support_requests.ai_session_id → ai_support_sessions.id
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_ai_session_id_ai_support_sessions_id_fk" FOREIGN KEY ("ai_session_id") REFERENCES "public"."ai_support_sessions"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint

-- =========================================================================
-- 5. feature_requests — new table
-- =========================================================================

CREATE TABLE "feature_requests" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid,
  "submitted_by_user" uuid,
  "source" varchar(20) NOT NULL DEFAULT 'support_ai',
  "request_text" text NOT NULL,
  "ai_summary" text,
  "category" varchar(50),
  "status" varchar(20) NOT NULL DEFAULT 'new',
  "admin_notes" text,
  "vote_count" integer NOT NULL DEFAULT 1,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "feature_requests" ADD CONSTRAINT "feature_requests_submitted_by_user_users_id_fk" FOREIGN KEY ("submitted_by_user") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_feature_requests_status" ON "feature_requests" ("status", "created_at" DESC);
--> statement-breakpoint
CREATE INDEX "idx_feature_requests_tenant" ON "feature_requests" ("tenant_id");
--> statement-breakpoint

-- =========================================================================
-- 6. tenant_enterprise_config — new table
-- =========================================================================

CREATE TABLE "tenant_enterprise_config" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tenant_id" uuid NOT NULL,
  "dedicated_contact_id" uuid,
  "sla_hours" smallint,
  "on_call_info" text,
  "contract_notes" text,
  "contract_start_at" timestamp with time zone,
  "contract_end_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_enterprise_config" ADD CONSTRAINT "tenant_enterprise_config_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_enterprise_config" ADD CONSTRAINT "tenant_enterprise_config_dedicated_contact_id_users_id_fk" FOREIGN KEY ("dedicated_contact_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_enterprise_config_tenant_id_idx" ON "tenant_enterprise_config" ("tenant_id");
