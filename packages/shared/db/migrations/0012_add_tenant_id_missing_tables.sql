-- Migration 0012: Add tenant_id column to 7 tables previously relying on parent joins
-- These tables need direct tenant_id for RLS enforcement.
-- Safe for dev (no existing data to backfill).

-- ---------------------------------------------------------------------------
-- board_memberships
-- ---------------------------------------------------------------------------

ALTER TABLE "board_memberships" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "board_memberships" ADD CONSTRAINT "board_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "board_memberships" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "board_memberships" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "board_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "board_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "board_memberships"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- thread_participants
-- ---------------------------------------------------------------------------

ALTER TABLE "thread_participants" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "thread_participants" ADD CONSTRAINT "thread_participants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "thread_participants" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "thread_participants" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "thread_participants"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- thread_messages
-- ---------------------------------------------------------------------------

ALTER TABLE "thread_messages" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "thread_messages" ADD CONSTRAINT "thread_messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "thread_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "thread_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "thread_messages"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- automation_runs
-- ---------------------------------------------------------------------------

ALTER TABLE "automation_runs" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "automation_runs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "automation_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "automation_runs"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- user_tasks
-- ---------------------------------------------------------------------------

ALTER TABLE "user_tasks" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_tasks" ADD CONSTRAINT "user_tasks_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_tasks" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_tasks" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_tasks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_tasks"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- user_events
-- ---------------------------------------------------------------------------

ALTER TABLE "user_events" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_events" ADD CONSTRAINT "user_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_events" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_events"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- user_view_preferences
-- ---------------------------------------------------------------------------

ALTER TABLE "user_view_preferences" ADD COLUMN "tenant_id" uuid NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_view_preferences" ADD CONSTRAINT "user_view_preferences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_view_preferences" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "user_view_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_view_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_view_preferences"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
