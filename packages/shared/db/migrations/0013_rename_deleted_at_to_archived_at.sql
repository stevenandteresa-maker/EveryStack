-- Migration 0013: Rename deleted_at → archived_at
-- Backend convention: use archived_at for soft deletes.
-- Metadata-only operation — no data rewrite, no lock contention.

ALTER TABLE "records" RENAME COLUMN "deleted_at" TO "archived_at";
--> statement-breakpoint
DROP INDEX IF EXISTS "records_tenant_table_deleted_idx";
--> statement-breakpoint
CREATE INDEX "records_tenant_table_archived_idx" ON "records" ("tenant_id", "table_id", "archived_at");
--> statement-breakpoint

ALTER TABLE "thread_messages" RENAME COLUMN "deleted_at" TO "archived_at";
