import type { DrizzleClient } from './client';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Row-Level Security (RLS) — Tenant Isolation
// ---------------------------------------------------------------------------
// PostgreSQL RLS policies enforce tenant isolation at the database level.
// Every transaction that touches tenant-scoped tables must call
// setTenantContext() first to set the app.current_tenant_id GUC.
//
// RLS is defense-in-depth — application-level WHERE clauses on tenant_id
// are still required (and are the primary mechanism). RLS catches any
// accidental omission.
// ---------------------------------------------------------------------------

/**
 * All tables with a direct `tenant_id` column that have RLS policies.
 * These are the 47 tenant-scoped tables in the MVP schema.
 *
 * Tables WITHOUT RLS (no tenant_id): users, tenants, platform_notices,
 *   user_dismissed_notices, support_request_messages
 * Tables protected by parent joins (no direct RLS): feature_votes
 *
 * Admin-only tables (have tenant_id but intentionally NO RLS — only
 * accessed via /admin routes, never from tenant-scoped code paths):
 *   - support_requests (nullable tenant_id, cross-tenant admin access)
 *   - admin_impersonation_sessions (admin "View as Tenant" sessions)
 *   - ai_support_sessions (AI support audit trail, admin-only)
 *   - tenant_feature_flags (per-tenant overrides, admin-managed)
 *   - tenant_enterprise_config (enterprise SLA config, admin-managed)
 *   - feature_requests (aggregated feature request log, admin-only)
 */
export const TENANT_SCOPED_TABLES = [
  // Tier 1 — Foundation
  'tenant_memberships',
  // CP-002: RLS uses OR — both agency_tenant_id and client_tenant_id can see the row
  'tenant_relationships',

  // Tier 2 — Workspace & Boards
  'boards',
  'board_memberships',
  'workspaces',
  'workspace_memberships',

  // Tier 3 — Platform Connections
  'base_connections',

  // Tier 4 — Tables, Fields, Records
  'tables',
  'fields',
  'records', // Parent — RLS inherited by 16 hash partitions (records_p0–p15)

  // Tier 5 — Views, Sections, Cross-Links
  'cross_links',
  'cross_link_index',
  'views',
  'record_view_configs',
  'record_templates',
  'sections',

  // Tier 6A — Portals, Forms
  'portals',
  'portal_access',
  'portal_sessions',
  'forms',
  'form_submissions',

  // Tier 6B — Sync Infrastructure
  'synced_field_mappings',
  'field_expression_indexes',
  'sync_conflicts',
  'sync_failures',
  'sync_schema_changes',

  // Tier 7 — Communications
  'threads',
  'thread_participants',
  'thread_messages',
  'user_saved_messages',

  // Tier 8 — Notifications & Preferences
  'notifications',
  'user_notification_preferences',
  'user_view_preferences',
  'user_tasks',
  'user_events',

  // Tier 9 — Documents & Automations
  'document_templates',
  'generated_documents',
  'automations',
  'automation_runs',

  // Tier 10 — Webhooks
  'webhook_endpoints',
  'webhook_delivery_log',

  // Tier 11 — AI & Metering
  'ai_usage_log', // Parent — RLS inherited by monthly time partitions
  'ai_credit_ledger',

  // Tier 12 — Audit, API, Platform Utilities
  'audit_log', // Parent — RLS inherited by monthly time partitions
  'api_keys',
  'api_request_log', // Parent — RLS inherited by monthly time partitions
  'user_recent_items',
  'command_bar_sessions',
  'feature_suggestions',
] as const;

export type TenantScopedTable = (typeof TENANT_SCOPED_TABLES)[number];

/**
 * Columns that must NEVER be returned in tenant-scoped queries.
 * These contain platform-level administrative data that should not
 * be visible to regular tenant users.
 *
 * When building select queries for user-facing surfaces, explicitly
 * exclude these columns from the result set.
 */
export const RLS_EXCLUDED_COLUMNS = {
  users: ['is_platform_admin', 'is_support_agent'],
} as const;

/**
 * Sets the tenant context for the current transaction via PostgreSQL GUC.
 *
 * MUST be called at the start of every database transaction that touches
 * tenant-scoped tables. The `SET LOCAL` ensures the value is scoped to the
 * current transaction only — it does not leak across PgBouncer connections.
 *
 * @param db - The Drizzle client (must be inside a transaction)
 * @param tenantId - The tenant UUID to scope queries to
 *
 * @example
 * ```ts
 * await db.transaction(async (tx) => {
 *   await setTenantContext(tx, tenantId);
 *   // All subsequent queries in this transaction are tenant-scoped by RLS
 *   const rows = await tx.select().from(records).where(...);
 * });
 * ```
 */
export async function setTenantContext(
  db: DrizzleClient,
  tenantId: string,
): Promise<void> {
  // SET LOCAL scopes the GUC to the current transaction.
  // This is critical for PgBouncer transaction-mode pooling — the setting
  // does not persist after the transaction ends, so the next connection
  // user gets a clean slate.
  await db.execute(
    sql`SELECT set_config('app.current_tenant_id', ${tenantId}, true)`,
  );
}
