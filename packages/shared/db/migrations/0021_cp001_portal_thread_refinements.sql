-- CP-001: Portal & Thread Schema Refinements
-- 1. portals: Replace UNIQUE(slug) with UNIQUE(tenant_id, slug)
-- 2. portal_access: Add revoked_at, revoked_reason, record_slug, linked_record_id
-- 3. threads: Replace visibility with thread_type, add UNIQUE(scope_type, scope_id, thread_type)

-- Step 1: Drop old portals global slug unique index
DROP INDEX IF EXISTS "portals_slug_idx";
--> statement-breakpoint

-- Step 2: Create new tenant-scoped slug unique index
CREATE UNIQUE INDEX "portals_tenant_slug_idx" ON "portals" ("tenant_id", "slug");
--> statement-breakpoint

-- Step 3: Add revoked_at column to portal_access
ALTER TABLE "portal_access" ADD COLUMN "revoked_at" timestamp with time zone;
--> statement-breakpoint

-- Step 4: Add revoked_reason column to portal_access
ALTER TABLE "portal_access" ADD COLUMN "revoked_reason" varchar(255);
--> statement-breakpoint

-- Step 5: Add record_slug column to portal_access
ALTER TABLE "portal_access" ADD COLUMN "record_slug" varchar(255);
--> statement-breakpoint

-- Step 6: Add linked_record_id column to portal_access with FK
ALTER TABLE "portal_access" ADD COLUMN "linked_record_id" uuid REFERENCES "records"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Step 7: Add unique constraint on (portal_id, record_slug)
CREATE UNIQUE INDEX "portal_access_portal_record_slug_idx" ON "portal_access" ("portal_id", "record_slug");
--> statement-breakpoint

-- Step 8: Drop visibility column from threads
ALTER TABLE "threads" DROP COLUMN IF EXISTS "visibility";
--> statement-breakpoint

-- Step 9: Add thread_type column to threads
ALTER TABLE "threads" ADD COLUMN "thread_type" varchar(50) NOT NULL DEFAULT 'internal';
--> statement-breakpoint

-- Step 10: Add unique constraint on (scope_type, scope_id, thread_type)
CREATE UNIQUE INDEX "threads_scope_thread_type_idx" ON "threads" ("scope_type", "scope_id", "thread_type");
