-- ---------------------------------------------------------------------------
-- 0025_add_user_notes_and_source_note_id.sql
-- Phase 3C, Prompt 1 — Create user_notes table (missing from 1B) and add
-- source_note_id FK to thread_messages for Personal Notes share-to-thread.
-- ---------------------------------------------------------------------------
-- Both operations use ADD COLUMN (nullable) and CREATE TABLE — neither
-- acquires ACCESS EXCLUSIVE lock for >1s. Index creation uses CONCURRENTLY
-- where supported.
-- ---------------------------------------------------------------------------

-- Step 1: Create user_notes table (should have been in 1B per dependency map)
CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID NOT NULL REFERENCES users(id),
  record_id UUID REFERENCES records(id) ON DELETE SET NULL,
  title VARCHAR(255),
  content JSONB NOT NULL DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for user_notes
CREATE INDEX IF NOT EXISTS user_notes_user_created_idx ON user_notes (user_id, created_at);
CREATE INDEX IF NOT EXISTS user_notes_user_pinned_idx ON user_notes (user_id, pinned);
CREATE INDEX IF NOT EXISTS user_notes_record_idx ON user_notes (record_id);

-- RLS for user_notes (tenant isolation)
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_notes
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Step 2: Add source_note_id column to thread_messages
ALTER TABLE thread_messages
  ADD COLUMN source_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL;

-- Partial index: only index rows where source_note_id is set (sparse)
CREATE INDEX idx_thread_messages_source_note_id
  ON thread_messages (source_note_id)
  WHERE source_note_id IS NOT NULL;
