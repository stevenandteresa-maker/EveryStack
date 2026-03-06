-- CP-002: Multi-Tenant Identity & Agency
-- 1. users: Add personal_tenant_id (nullable UUID FK -> tenants.id)
-- 2. workspaces: Add transferred_from_tenant_id, original_created_by_tenant_id
-- 3. tenant_relationships: New table for agency-client relationships
-- No ACCESS EXCLUSIVE locks held >1s — all ADD COLUMN are nullable (no rewrite)

-- Step 1: Add personal_tenant_id to users
ALTER TABLE "users" ADD COLUMN "personal_tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Step 2: Index on personal_tenant_id for fast auth resolution lookup
CREATE INDEX "users_personal_tenant_id_idx" ON "users" ("personal_tenant_id");
--> statement-breakpoint

-- Step 3: Add transferred_from_tenant_id to workspaces
ALTER TABLE "workspaces" ADD COLUMN "transferred_from_tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Step 4: Add original_created_by_tenant_id to workspaces
ALTER TABLE "workspaces" ADD COLUMN "original_created_by_tenant_id" uuid REFERENCES "tenants"("id") ON DELETE SET NULL;
--> statement-breakpoint

-- Step 5: Create tenant_relationships table
CREATE TABLE "tenant_relationships" (
  "id" uuid PRIMARY KEY,
  "agency_tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "client_tenant_id" uuid NOT NULL REFERENCES "tenants"("id"),
  "relationship_type" varchar(50) NOT NULL,
  "status" varchar(50) NOT NULL,
  "access_level" varchar(50) NOT NULL,
  "initiated_by" varchar(50) NOT NULL,
  "authorized_by_user_id" uuid REFERENCES "users"("id"),
  "agency_billing_responsible" boolean NOT NULL DEFAULT false,
  "accepted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "revoked_by_user_id" uuid REFERENCES "users"("id"),
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint

-- Step 6: UNIQUE constraint on (agency_tenant_id, client_tenant_id)
CREATE UNIQUE INDEX "tenant_relationships_agency_client_idx" ON "tenant_relationships" ("agency_tenant_id", "client_tenant_id");
--> statement-breakpoint

-- Step 7: Composite index for agency-side queries filtered by status
CREATE INDEX "tenant_relationships_agency_status_idx" ON "tenant_relationships" ("agency_tenant_id", "status");
--> statement-breakpoint

-- Step 8: Composite index for client-side queries filtered by status
CREATE INDEX "tenant_relationships_client_status_idx" ON "tenant_relationships" ("client_tenant_id", "status");
--> statement-breakpoint

-- Step 9: Enable RLS on tenant_relationships
-- Both the agency tenant and client tenant can see the row
ALTER TABLE "tenant_relationships" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_relationships_isolation" ON "tenant_relationships"
  USING (
    "agency_tenant_id" = current_setting('app.current_tenant_id')::uuid
    OR "client_tenant_id" = current_setting('app.current_tenant_id')::uuid
  );
