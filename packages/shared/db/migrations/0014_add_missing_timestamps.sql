-- Migration 0014: Add missing created_at / updated_at columns
-- Convention: all tables include both created_at and updated_at.
-- Immutable event/log tables (notifications, form_submissions, command_bar_sessions, feature_votes) skipped.

-- ---------------------------------------------------------------------------
-- Add created_at to tables that only had updated_at
-- ---------------------------------------------------------------------------

ALTER TABLE "user_notification_preferences" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Add updated_at to mutable tables that only had created_at
-- ---------------------------------------------------------------------------

ALTER TABLE "boards" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "sections" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "synced_field_mappings" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_events" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "feature_suggestions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
