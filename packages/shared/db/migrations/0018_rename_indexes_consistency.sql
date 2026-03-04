-- Migration: Rename indexes for naming convention consistency
-- All indexes should use {table_name}_{columns}_idx suffix pattern.
-- The 13 indexes below used idx_{name} prefix pattern from today's schema additions.

-- tenants table (4 indexes)
ALTER INDEX IF EXISTS "idx_tenants_stripe_customer" RENAME TO "tenants_stripe_customer_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_tenants_subscription_status" RENAME TO "tenants_subscription_status_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_tenants_trial_ends" RENAME TO "tenants_trial_ends_at_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_tenants_churn_risk" RENAME TO "tenants_churn_risk_flag_idx";
--> statement-breakpoint

-- tenant_feature_flags table (1 index)
ALTER INDEX IF EXISTS "idx_tenant_flags" RENAME TO "tenant_feature_flags_tenant_id_idx";
--> statement-breakpoint

-- support_requests table (3 indexes)
ALTER INDEX IF EXISTS "idx_support_requests_tenant" RENAME TO "support_requests_tenant_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_support_requests_status" RENAME TO "support_requests_status_created_at_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_support_requests_priority" RENAME TO "support_requests_priority_status_idx";
--> statement-breakpoint

-- support_request_messages table (1 index)
ALTER INDEX IF EXISTS "idx_srm_request_id" RENAME TO "support_request_messages_request_id_created_at_idx";
--> statement-breakpoint

-- ai_support_sessions table (2 indexes)
ALTER INDEX IF EXISTS "idx_ai_support_tenant" RENAME TO "ai_support_sessions_tenant_id_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_ai_support_request" RENAME TO "ai_support_sessions_support_request_id_idx";
--> statement-breakpoint

-- feature_requests table (2 indexes)
ALTER INDEX IF EXISTS "idx_feature_requests_status" RENAME TO "feature_requests_status_created_at_idx";
--> statement-breakpoint
ALTER INDEX IF EXISTS "idx_feature_requests_tenant" RENAME TO "feature_requests_tenant_id_idx";
