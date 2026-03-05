-- Phase 1I: Add clerk_org_id to tenants table
-- Maps Clerk organization ID to internal tenant UUID.
-- Column defined in Drizzle schema since Phase 1D but never migrated.
ALTER TABLE "tenants" ADD COLUMN "clerk_org_id" varchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_clerk_org_id_idx" ON "tenants" ("clerk_org_id");
