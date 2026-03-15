-- ---------------------------------------------------------------------------
-- 0026_extend_notifications_schema.sql
-- Phase 3C, Prompt 5 — Add missing columns to notifications table for
-- full notification pipeline support: title, body, source_type,
-- source_record_id, actor_id, group_key, read_at.
-- ---------------------------------------------------------------------------
-- All operations are ADD COLUMN (nullable) — no ACCESS EXCLUSIVE lock >1s.
-- ---------------------------------------------------------------------------

-- Add columns required by communications.md § Notification Aggregation
ALTER TABLE notifications
  ADD COLUMN title VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN body VARCHAR(500),
  ADD COLUMN source_type VARCHAR(50),
  ADD COLUMN source_record_id UUID,
  ADD COLUMN actor_id UUID REFERENCES users(id),
  ADD COLUMN group_key VARCHAR(255),
  ADD COLUMN read_at TIMESTAMPTZ;

-- Index for group_key collapse queries
CREATE INDEX notifications_group_key_created_idx
  ON notifications (group_key, created_at)
  WHERE group_key IS NOT NULL;

-- Composite index: user + tenant + created_at DESC for tray pagination
CREATE INDEX notifications_user_tenant_created_idx
  ON notifications (user_id, tenant_id, created_at DESC);
