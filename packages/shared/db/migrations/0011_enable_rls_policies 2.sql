-- Migration 0011: Enable Row-Level Security on all tenant-scoped tables
-- Defense-in-depth: RLS policies enforce tenant isolation at the database level.
-- Application code still uses tenant_id WHERE clauses; RLS catches omissions.
--
-- Policy: tenant_isolation
--   USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
--
-- Partitioned tables: RLS on the parent is automatically inherited by all
-- child partitions (records_p0–p15, ai_usage_log_*, audit_log_*, api_request_log_*).
--
-- Tables WITHOUT RLS: users, tenants (no tenant_id column)
-- Tables protected by parent joins: user_view_preferences, thread_participants,
--   thread_messages, user_tasks, user_events, automation_runs, feature_votes

-- ---------------------------------------------------------------------------
-- Tier 1 — Foundation
-- ---------------------------------------------------------------------------

ALTER TABLE "tenant_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tenant_memberships"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 2 — Workspace & Boards
-- ---------------------------------------------------------------------------

ALTER TABLE "boards" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "boards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "boards"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "workspaces" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspaces" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workspaces"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "workspace_memberships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "workspace_memberships" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "workspace_memberships"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 3 — Platform Connections
-- ---------------------------------------------------------------------------

ALTER TABLE "base_connections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "base_connections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "base_connections"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 4 — Tables, Fields, Records
-- ---------------------------------------------------------------------------

ALTER TABLE "tables" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tables" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "tables"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "fields" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fields" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "fields"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- records: hash-partitioned by tenant_id (16 partitions).
-- RLS on the parent is inherited by all child partitions (records_p0–p15).
ALTER TABLE "records" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "records" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "records"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 5 — Views, Sections, Cross-Links
-- ---------------------------------------------------------------------------

ALTER TABLE "cross_links" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cross_links" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "cross_links"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "cross_link_index" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cross_link_index" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "cross_link_index"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "views" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "views" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "views"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "record_view_configs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_view_configs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "record_view_configs"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "record_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "record_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "record_templates"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "sections" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sections"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 6A — Portals, Forms
-- ---------------------------------------------------------------------------

ALTER TABLE "portals" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "portals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portals"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "portal_access" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "portal_access" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_access"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "portal_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "portal_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "portal_sessions"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "forms" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "forms" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "forms"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "form_submissions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "form_submissions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "form_submissions"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 6B — Sync Infrastructure
-- ---------------------------------------------------------------------------

ALTER TABLE "synced_field_mappings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "synced_field_mappings" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "synced_field_mappings"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "sync_conflicts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_conflicts" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sync_conflicts"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "sync_failures" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_failures" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sync_failures"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "sync_schema_changes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sync_schema_changes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "sync_schema_changes"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 7 — Communications
-- ---------------------------------------------------------------------------

ALTER TABLE "threads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "threads" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "threads"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "user_saved_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_saved_messages" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_saved_messages"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 8 — Notifications & Preferences
-- ---------------------------------------------------------------------------

ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "notifications"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "user_notification_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_notification_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_notification_preferences"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 9 — Documents & Automations
-- ---------------------------------------------------------------------------

ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "document_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "document_templates"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "generated_documents" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "generated_documents" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "generated_documents"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "automations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "automations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "automations"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 10 — Webhooks
-- ---------------------------------------------------------------------------

ALTER TABLE "webhook_endpoints" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_endpoints" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "webhook_endpoints"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "webhook_delivery_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "webhook_delivery_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "webhook_delivery_log"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 11 — AI & Metering
-- ---------------------------------------------------------------------------

-- ai_usage_log: time-partitioned by created_at (monthly).
-- RLS on the parent is inherited by all monthly partitions.
ALTER TABLE "ai_usage_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_usage_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ai_usage_log"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "ai_credit_ledger" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "ai_credit_ledger" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "ai_credit_ledger"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tier 12 — Audit, API, Platform Utilities
-- ---------------------------------------------------------------------------

-- audit_log: time-partitioned by created_at (monthly).
-- RLS on the parent is inherited by all monthly partitions.
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "audit_log"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "api_keys" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "api_keys" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "api_keys"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

-- api_request_log: time-partitioned by created_at (monthly).
-- RLS on the parent is inherited by all monthly partitions.
ALTER TABLE "api_request_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "api_request_log" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "api_request_log"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "user_recent_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_recent_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "user_recent_items"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "command_bar_sessions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "command_bar_sessions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "command_bar_sessions"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
--> statement-breakpoint

ALTER TABLE "feature_suggestions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "feature_suggestions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation" ON "feature_suggestions"
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
