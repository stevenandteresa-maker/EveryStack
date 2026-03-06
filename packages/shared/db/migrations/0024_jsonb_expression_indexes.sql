-- ---------------------------------------------------------------------------
-- 0024_jsonb_expression_indexes.sql
-- Phase 2B — JSONB Expression Index Infrastructure
-- ---------------------------------------------------------------------------
-- This migration creates a helper function for managing expression indexes
-- on canonical_data JSONB paths. The actual per-field indexes are created
-- at runtime via createFieldExpressionIndex() — not in this migration.
--
-- IMPORTANT: CREATE INDEX CONCURRENTLY cannot run inside a transaction.
-- This migration file is intentionally NOT wrapped in BEGIN/COMMIT.
-- Drizzle migrations run each statement sequentially outside transactions
-- when the file contains no explicit transaction control.
-- ---------------------------------------------------------------------------

-- Create a tracking table for managed expression indexes.
-- This allows the application to know which indexes exist without
-- querying pg_indexes (which is PG-specific and not CockroachDB-safe).
CREATE TABLE IF NOT EXISTS field_expression_indexes (
  tenant_id UUID NOT NULL,
  table_id UUID NOT NULL,
  field_id UUID NOT NULL,
  field_type VARCHAR(50) NOT NULL,
  index_name VARCHAR(63) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, table_id, field_id)
);

-- RLS policy for tenant isolation
ALTER TABLE field_expression_indexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON field_expression_indexes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Index for lookups by index_name (used during cleanup)
CREATE INDEX IF NOT EXISTS field_expr_idx_name_idx
  ON field_expression_indexes (index_name);
