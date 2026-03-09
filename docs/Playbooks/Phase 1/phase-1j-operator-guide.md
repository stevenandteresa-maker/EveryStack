# Phase 1J — CP Migration, Multi-Tenant Auth & Navigation Shell — Operator Guide

> **Document type:** Operator Guide (Session A2 output)
> **Companion playbook:** `phase-1j-playbook.md`
> **Audience:** Steven (non-technical founder)
> **Color key:** 🔵 = Paste into Claude Code | 🟢 = Git command | 🟠 = Checkpoint / Verify | ⬜ = Context (read for understanding)

---

## SETUP

> ⬜ **CONTEXT**
>
> Phase 1J is the final Foundation phase. It applies two "Change Proposal" database updates (CP-001 and CP-002), upgrades the auth system to support multi-tenant access, and builds the sidebar navigation tree with tenant switching. When this phase is done, every user who logs in will see all their workspaces organized by tenant in a collapsible sidebar, with smooth color transitions when switching between organizations.
>
> **Before you start:**
> 1. Make sure Docker Desktop is running (PostgreSQL and Redis need to be up).
> 2. Open your terminal and navigate to the EveryStack monorepo.
> 3. Open Claude Code (either in VS Code or in the terminal).
> 4. Make sure you're on the `main` branch with all previous phases merged.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Create and checkout a new branch from main:
>
> git checkout main && git pull origin main && git checkout -b feat/phase-1j-cp-migration-nav-shell
> ```

> **How long:** Under 1 minute.

---

## PROMPT 1: Portal & Thread Database Updates (CP-001)

> ⬜ **CONTEXT — What This Builds**
>
> This prompt updates three existing database tables with new columns and constraints. Think of it like adding new drawers and labels to filing cabinets that already exist. Specifically:
> - The **portals** table gets a smarter uniqueness rule so two different organizations can use the same portal URL slug (like two companies both having a portal called "client-portal").
> - The **portal_access** table gets four new columns for tracking when access was revoked, why, a client-safe URL slug, and an optional link to a contact record.
> - The **threads** table gets a column to distinguish internal team threads from client-facing threads.
>
> **What You'll See When It's Done:** Claude Code will create a new migration file and update the schema type definitions. Tests will run and pass — you should see all green checkmarks. No UI changes — this is database-only.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: data-model.md lines 94–103 (Portals & Forms — portal_access, portals), data-model.md lines 113–121 (Communications — threads)
>
> Create a new Drizzle migration that applies the CP-001 schema changes:
>
> Target files: packages/shared/db/migrations/XXXX_cp001_portal_thread_refinements.ts, packages/shared/db/schema/portals.ts (update types), packages/shared/db/schema/threads.ts (update types)
>
> 1. **portals table** — Drop the existing UNIQUE(slug) constraint and replace it with UNIQUE(tenant_id, slug). Use concurrent index creation where possible to avoid ACCESS EXCLUSIVE locks. If a non-concurrent approach is needed, ensure the lock is held for <1s.
>
> 2. **portal_access table** — Add four columns:
>    - revoked_at — TIMESTAMPTZ, nullable, default null.
>    - revoked_reason — VARCHAR, nullable. Known values: 'record_deleted', 'manager_revoked', 'portal_archived'. No CHECK constraint (VARCHAR extensibility).
>    - record_slug — VARCHAR, with UNIQUE(portal_id, record_slug) constraint.
>    - linked_record_id — UUID, nullable, FK → records.id ON DELETE SET NULL.
>
> 3. **threads table** — Add thread_type column:
>    - VARCHAR NOT NULL DEFAULT 'internal'. Known values: 'internal', 'client'.
>    - Add UNIQUE(scope_type, scope_id, thread_type) constraint.
>    - If a visibility column exists from an earlier migration, drop it. If it doesn't exist, skip the drop.
>
> 4. **Update Drizzle schema type definitions** in the existing schema files to reflect the new columns and constraints. Add TypeScript comments listing known values for VARCHAR columns (same pattern used for author_type, message_type, scope_type — see CLAUDE.md conventions).
>
> 5. **Update test factories** — update createTestPortalAccess() and createTestThread() factories to support the new columns with sensible defaults.
>
> Migration required: Yes — new migration file. Never modify existing migration files.
> No ACCESS EXCLUSIVE lock held for >1s.
>
> Acceptance Criteria:
> - [ ] Migration runs successfully against a fresh database and against the existing schema
> - [ ] portals.slug uniqueness is now scoped to (tenant_id, slug) — two tenants can have the same slug
> - [ ] portal_access has all 4 new columns with correct types and constraints
> - [ ] record_slug UNIQUE constraint scoped to (portal_id, record_slug) is enforced
> - [ ] threads.thread_type defaults to 'internal' and accepts 'client'
> - [ ] UNIQUE(scope_type, scope_id, thread_type) prevents duplicate thread types per scope
> - [ ] No ACCESS EXCLUSIVE lock held for >1s (verified via db:migrate:check)
> - [ ] Drizzle schema types updated with new columns
> - [ ] Test factories updated
> - [ ] ESLint and TypeScript compile with zero errors
>
> Do NOT build:
> - Portal client auth, session management, or rendering (Phase 3E-i)
> - Thread message delivery or Record Thread UI (Phase 3C)
> - Portal URL routing (Phase 3E-i)
> - Any application logic using the new columns — this is schema-only
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created one new migration file in `packages/shared/db/migrations/`
> - Updated `packages/shared/db/schema/portals.ts` and `packages/shared/db/schema/threads.ts`
> - Updated test factories
> - All tests passing (green checkmarks)
> - No TypeScript or linting errors

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(db): apply CP-001 schema migration — portal refinements and thread_type [Phase 1J, Prompt 1]"
> ```

---

## PROMPT 2: Users, Workspaces & Tenant Relationships (CP-002)

> ⬜ **CONTEXT — What This Builds**
>
> This prompt adds a new column to the **users** table (a link to each user's personal workspace), two new columns to the **workspaces** table (tracking if a workspace was ever transferred between organizations), and creates an entirely new **tenant_relationships** table. The tenant_relationships table is like a registry that records when one organization (an "agency") manages another organization (a "client"). This is the foundation for agencies to manage multiple client workspaces from one account.
>
> **What You'll See When It's Done:** A new migration file and a new schema file for tenant_relationships. A new test factory for creating test tenant relationships. All tests passing.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: data-model.md lines 29–41 (User, Tenant & Workspace — users, workspaces, tenant_relationships), data-model.md lines 42–62 (effective_memberships view — read for context only, view created in Prompt 3)
>
> Create a new Drizzle migration that applies the CP-002 schema changes:
>
> Target files: packages/shared/db/migrations/XXXX_cp002_multi_tenant_identity.ts, packages/shared/db/schema/users.ts (update), packages/shared/db/schema/workspaces.ts (update), packages/shared/db/schema/tenant-relationships.ts (new schema file)
>
> 1. **users table** — Add personal_tenant_id column:
>    - UUID, nullable, FK → tenants.id ON DELETE SET NULL.
>    - Index on personal_tenant_id for fast lookup during auth resolution.
>
> 2. **workspaces table** — Add 2 columns:
>    - transferred_from_tenant_id — UUID, nullable, FK → tenants.id ON DELETE SET NULL.
>    - original_created_by_tenant_id — UUID, nullable, FK → tenants.id ON DELETE SET NULL.
>    - These are schema stubs for post-MVP workspace transfer. No application logic needed.
>
> 3. **tenant_relationships table** — Create new table with all columns:
>    - id (UUIDv7 PK)
>    - agency_tenant_id (UUID FK → tenants.id NOT NULL)
>    - client_tenant_id (UUID FK → tenants.id NOT NULL)
>    - relationship_type (VARCHAR — 'managed'|'white_label'|'reseller'|'referral')
>    - status (VARCHAR — 'pending'|'active'|'suspended'|'revoked')
>    - access_level (VARCHAR — 'admin'|'builder'|'read_only')
>    - initiated_by (VARCHAR — 'agency'|'client')
>    - authorized_by_user_id (UUID FK → users.id)
>    - agency_billing_responsible (BOOLEAN)
>    - accepted_at (TIMESTAMPTZ nullable)
>    - revoked_at (TIMESTAMPTZ nullable)
>    - revoked_by_user_id (UUID nullable FK → users.id)
>    - metadata (JSONB — includes contract_ref, hide_member_identity for white_label)
>    - created_at (TIMESTAMPTZ DEFAULT NOW())
>    - UUIDv7 primary key (use the existing UUIDv7 generation utility).
>    - All string-typed columns are VARCHAR, not ENUM (per CLAUDE.md convention).
>    - metadata is JSONB, default {}.
>    - Indexes: (agency_tenant_id, status) for agency portfolio lookups, (client_tenant_id, status) for client access checks.
>    - UNIQUE(agency_tenant_id, client_tenant_id) — one relationship per tenant pair.
>    - RLS policy enforcing tenant isolation. Both agency_tenant_id and client_tenant_id should be checkable — a user in either tenant can see the relationship row.
>
> 4. Create Drizzle schema file packages/shared/db/schema/tenant-relationships.ts for the new table.
>
> 5. Update existing schema files for users and workspaces with new column definitions and TypeScript comments for known values.
>
> 6. Create test factory createTestTenantRelationship() in packages/shared/testing/ with sensible defaults (status: 'active', access_level: 'builder', relationship_type: 'managed').
>
> 7. Update existing factories — createTestUser() should accept optional personal_tenant_id, createTestWorkspace() should accept optional transfer columns.
>
> Migration required: Yes — new migration file.
> No ACCESS EXCLUSIVE lock held for >1s.
>
> Acceptance Criteria:
> - [ ] Migration runs successfully against existing schema
> - [ ] users.personal_tenant_id is nullable UUID FK to tenants.id
> - [ ] workspaces has both transfer tracking columns (nullable)
> - [ ] tenant_relationships table created with all 14 columns
> - [ ] UNIQUE(agency_tenant_id, client_tenant_id) constraint enforced
> - [ ] RLS policy on tenant_relationships allows access from either side of the relationship
> - [ ] testTenantIsolation() passes for tenant_relationships — a user in unrelated Tenant C cannot see a relationship between Tenants A and B
> - [ ] createTestTenantRelationship() factory works correctly
> - [ ] No ACCESS EXCLUSIVE lock held for >1s
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Agency Console UI or /agency route (post-MVP)
> - Workspace transfer logic (post-MVP — schema stubs only)
> - Tenant relationship management CRUD endpoints (post-MVP)
> - Agency onboarding flows (post-MVP)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created one new migration file
> - Created `packages/shared/db/schema/tenant-relationships.ts`
> - Updated `users.ts` and `workspaces.ts` schema files
> - Created `createTestTenantRelationship()` factory
> - Updated existing factories
> - All tests passing, including tenant isolation test

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(db): apply CP-002 schema migration — personal_tenant_id, workspace transfer stubs, tenant_relationships [Phase 1J, Prompt 2]"
> ```

---

## PROMPT 3: Effective Memberships Database View

> ⬜ **CONTEXT — What This Builds**
>
> This prompt creates a "database view" — think of it like a smart lens that combines data from two places into one easy-to-read list. Right now, to figure out which organizations a user can access, the system only checks their direct memberships. But with the agency relationship system from Prompt 2, users might also have access to client organizations through their agency. This view merges both into one unified list: "Here are all the tenants this user can access, whether directly or through an agency."
>
> **What You'll See When It's Done:** A new migration file that creates the database view, a new schema file, and two new helper functions. Tests will verify both direct and agency access patterns.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: data-model.md lines 42–62 (effective_memberships view definition, role derivation), permissions.md lines 468–475 (Phase Implementation — auth middleware uses effective_memberships), permissions.md lines 488–506 (Agency Access Model — access level derivation)
>
> Target files: packages/shared/db/migrations/XXXX_effective_memberships_view.ts, packages/shared/db/schema/effective-memberships.ts (new Drizzle view definition)
> Migration required: Yes — creates a database view.
>
> 1. Create the effective_memberships database view via a new Drizzle migration. The view unions:
>    - Direct memberships: All active tenant_memberships rows with source = 'direct' and agency_tenant_id = NULL.
>    - Agency-delegated access: For each active tenant_relationships row, join to active tenant_memberships of the agency tenant. The role column maps from tenant_relationships.access_level (admin/builder/read_only). The source column is 'agency'. The agency_tenant_id column preserves the agency tenant for audit/UI purposes.
>
>    SQL reference:
>    CREATE VIEW effective_memberships AS
>      SELECT user_id, tenant_id, role, 'direct' AS source, NULL AS agency_tenant_id
>      FROM tenant_memberships
>      WHERE status = 'active'
>      UNION ALL
>      SELECT tm.user_id, tr.client_tenant_id AS tenant_id,
>             tr.access_level AS role, 'agency' AS source, tr.agency_tenant_id
>      FROM tenant_relationships tr
>      JOIN tenant_memberships tm ON tm.tenant_id = tr.agency_tenant_id AND tm.status = 'active'
>      WHERE tr.status = 'active';
>
> 2. Create the Drizzle view definition in packages/shared/db/schema/effective-memberships.ts so that Drizzle ORM can query it like a table. Export the type for use in auth middleware.
>
> 3. Write a data access helper getEffectiveMemberships(userId: string) in packages/shared/db/ that returns all tenant memberships (direct + agency) for a given user.
>
> 4. Write a helper getEffectiveMembershipForTenant(userId: string, tenantId: string) that returns the user's membership in a specific tenant (direct or agency-delegated). Returns null if no access.
>
> 5. Write tests:
>    - User with direct membership returns source: 'direct'.
>    - Agency member accessing client tenant returns source: 'agency', correct access_level as role, and the agency_tenant_id.
>    - Suspended tenant_relationships do not appear in the view.
>    - Suspended tenant_memberships do not appear in the view.
>    - User with both direct and agency access to the same tenant (edge case) returns both rows.
>    - testTenantIsolation() — a user with no membership in Tenant X gets no rows for Tenant X.
>
> Acceptance Criteria:
> - [ ] effective_memberships view created via migration
> - [ ] View correctly unions direct memberships and agency-delegated access
> - [ ] Agency access uses access_level as the role column
> - [ ] source column distinguishes 'direct' from 'agency'
> - [ ] agency_tenant_id populated for agency rows, null for direct rows
> - [ ] Suspended relationships and memberships excluded from view
> - [ ] getEffectiveMemberships() returns correct results for all test cases
> - [ ] getEffectiveMembershipForTenant() returns null for non-members
> - [ ] testTenantIsolation() passes
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Auth middleware integration (Prompt 4)
> - Role derivation logic beyond simple column mapping (Core UX handles full permission resolution)
> - Agency Console or agency management UI (post-MVP)
> - Caching layer for effective_memberships (Prompt 6 adds Redis)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created a new migration file for the view
> - Created `packages/shared/db/schema/effective-memberships.ts`
> - Created `getEffectiveMemberships()` and `getEffectiveMembershipForTenant()` helpers
> - All tests passing, including tenant isolation

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(db): create effective_memberships database view [Phase 1J, Prompt 3]"
> ```

---

## INTEGRATION CHECKPOINT 1 (after Prompts 1–3)

> ⬜ **CONTEXT**
>
> You've completed all three database migration prompts. Before moving on to the auth and UI work, let's make sure everything is solid. This checkpoint runs the full test suite and verifies all migrations apply cleanly.
>
> **How Long:** 2–3 minutes.

---

> 🟠 **VERIFICATION — Paste into Claude Code**
>
> ```
> Run the following verification checks and fix any failures:
>
> 1. pnpm turbo typecheck — zero errors
> 2. pnpm turbo lint — zero errors
> 3. pnpm turbo test — all pass
> 4. pnpm turbo test -- --coverage — thresholds met
> 5. pnpm turbo db:migrate — all migrations apply cleanly to a fresh database
> 6. pnpm turbo db:migrate:check — no lock violations (no ACCESS EXCLUSIVE >1s)
> 7. Manual verification: Query effective_memberships view with test data and confirm it returns correct rows for direct and agency access patterns
>
> Fix any failures before proceeding.
> ```

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit with message: "chore(verify): integration checkpoint 1 — CP-001/CP-002 migrations + effective_memberships view [Phase 1J, CP-1]"
>
> Then push the branch: git push -u origin feat/phase-1j-cp-migration-nav-shell
> ```

> 🟠 **REVIEW POINT:** Go to GitHub and check the branch. You should see 4 commits (3 prompts + this checkpoint). The migration files and schema changes should be visible in the diff.

---

## PROMPT 4: Update Auth to Use New Memberships View

> ⬜ **CONTEXT — What This Builds**
>
> Right now, when a user logs in, the system checks a single table to see what organizations they belong to. This prompt upgrades that check to use the new "effective memberships" view from Prompt 3 — so it now also recognizes users who have access through an agency relationship. This is an under-the-hood upgrade — existing users won't notice any difference. But it unlocks the ability for agency members to access their client workspaces.
>
> **What You'll See When It's Done:** Updated auth files. All existing auth tests still pass (no regressions), plus new tests for agency access patterns. No visible UI changes yet.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: permissions.md lines 286–309 (Permission Resolution at Runtime — Internal Users step 1-2), permissions.md lines 488–506 (Agency Access Model — access level derivation), navigation.md lines 79–102 (Tenant Switcher — what changes on switch)
>
> Target files: apps/web/src/middleware.ts (update), apps/web/src/lib/auth/tenant-resolver.ts (update), apps/web/src/lib/auth/effective-membership.ts (new), apps/web/src/lib/auth/__tests__/effective-membership.test.ts (new)
> Migration required: No
>
> Update the auth middleware to resolve user access through the effective_memberships view instead of directly querying tenant_memberships.
>
> 1. Create effective-membership.ts — a server-side module that wraps getEffectiveMembershipForTenant() and provides:
>    - resolveUserAccess(userId: string, tenantId: string) → returns { role, source, agencyTenantId } | null
>    - Role derivation: source === 'direct' → use role as-is. source === 'agency' → map access_level to equivalent role: admin → Admin-equivalent, builder → Manager-equivalent, read_only → Viewer-equivalent.
>    - Return null for no access (triggers 404 per tenant isolation pattern — cross-tenant returns 404, never 403).
>
> 2. Update tenant-resolver.ts — replace the direct tenant_memberships query with resolveUserAccess(). The resolver's public interface should remain the same so downstream code is unaffected.
>
> 3. Update middleware.ts — ensure the Clerk session's active organization/tenant is resolved through the updated tenant resolver. No changes to route matching rules or Clerk middleware configuration.
>
> 4. Handle the source === 'agency' case — when a user accesses a tenant via agency delegation:
>    - Include agencyTenantId in the middleware context so downstream code can distinguish agency vs. direct access.
>    - Log agency access at info level: { msg: 'agency_access', userId, agencyTenantId, clientTenantId, accessLevel }.
>
> 5. Ensure backward compatibility — existing Owner/Admin/Member direct access continues to work identically. No behavior changes for users without agency relationships.
>
> 6. Write tests:
>    - Direct member access resolves correctly (unchanged behavior).
>    - Agency member with access_level: 'admin' gets Admin-equivalent access.
>    - Agency member with access_level: 'builder' gets Manager-equivalent access.
>    - Agency member with access_level: 'read_only' gets Viewer-equivalent access.
>    - Suspended agency relationship → no access (returns 404).
>    - User with no membership → no access (returns 404).
>    - User with both direct and agency access → direct membership takes precedence.
>
> Acceptance Criteria:
> - [ ] Auth middleware queries effective_memberships view, never tenant_memberships directly
> - [ ] Direct member access works identically to before
> - [ ] Agency member access resolves correct role from access_level
> - [ ] agencyTenantId included in middleware context for agency access
> - [ ] Agency access logged at info level
> - [ ] Suspended relationships blocked
> - [ ] No access returns 404 (not 403)
> - [ ] Direct membership takes precedence over agency access for same tenant
> - [ ] All existing auth tests still pass (no regressions)
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Permission caching in Redis (built as part of tenant-switching in Prompt 6)
> - Full field-level permission resolution (Phase 3A-iii)
> - Agency-specific UI or banners (post-MVP)
> - Role upgrade/downgrade flows for agency members (post-MVP)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created `apps/web/src/lib/auth/effective-membership.ts`
> - Updated `tenant-resolver.ts` and `middleware.ts`
> - All existing auth tests still pass (this is critical — no regressions)
> - New tests for agency access patterns passing

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(auth): swap auth resolution to effective_memberships view [Phase 1J, Prompt 4]"
> ```

---

## PROMPT 5: Personal Workspace Auto-Setup

> ⬜ **CONTEXT — What This Builds**
>
> Every new user who signs up for EveryStack gets their own personal workspace automatically — like having a personal Google Drive alongside shared team drives. This prompt updates the signup process so that when Clerk (the auth provider) notifies EveryStack about a new user, the system automatically creates a personal tenant for them. The personal workspace gets a distinctive warm gray/stone color so it's always visually distinct from organization workspaces (which use brighter accent colors).
>
> **What You'll See When It's Done:** New files for personal tenant provisioning. The Clerk webhook handler updated. Tests verifying that new users automatically get personal tenants. Still no UI changes — that comes in Prompts 7–10.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: data-model.md lines 33 (users table — personal_tenant_id description), navigation.md lines 50–57 (Display Rules — personal tenant hidden until workspace created, always listed first), navigation.md lines 105–124 (My Office Per-Tenant — personal vs org), design-system.md lines 112–121 (Shell Accent — personal tenant warm neutral)
>
> Target files: apps/web/src/app/api/webhooks/clerk/route.ts (update), apps/web/src/lib/auth/personal-tenant.ts (new), apps/web/src/lib/auth/__tests__/personal-tenant.test.ts (new)
> Migration required: No
>
> Update the Clerk user.created webhook handler to auto-provision a personal tenant for every new user.
>
> 1. Create personal-tenant.ts — a module that handles personal tenant creation:
>    - provisionPersonalTenant(userId: string, userName: string) → creates a new tenant row with:
>      - name: "{userName}'s Workspace" (i18n key: personal_tenant.default_name).
>      - plan: 'freelancer' (default plan).
>      - settings.branding_accent_color: Fixed warm neutral color (a muted neutral that is NOT one of the 8 curated org accent options — e.g., #78716C warm gray/stone-500). This color is never available in the org accent picker, ensuring personal tenants are always visually distinct.
>    - Creates a tenant_memberships row with role: 'owner', status: 'active'.
>    - Updates users.personal_tenant_id to point to the newly created tenant.
>    - Returns the personal tenant ID.
>
> 2. Update the user.created webhook handler — after existing user creation logic, call provisionPersonalTenant(). Wrap in a transaction to ensure atomicity.
>
> 3. Handle idempotency — if the webhook fires twice (Clerk retry), check if users.personal_tenant_id is already set. If yes, skip provisioning and return success.
>
> 4. Personal tenant display rules (implement data access, not UI):
>    - Create isPersonalTenant(tenantId: string, userId: string) helper — checks if tenantId === user.personal_tenant_id.
>    - Create hasPersonalWorkspace(tenantId: string) helper — checks if the personal tenant has at least one workspace.
>
> 5. Write tests:
>    - New user creation provisions a personal tenant.
>    - Personal tenant has warm neutral accent color (not one of the 8 org colors).
>    - users.personal_tenant_id is set correctly.
>    - Owner membership created for user in personal tenant.
>    - Idempotent — second webhook call doesn't create duplicate.
>    - isPersonalTenant() returns true for personal tenant, false for org tenant.
>    - hasPersonalWorkspace() returns false for empty personal tenant, true after workspace creation.
>    - testTenantIsolation() — personal tenant data isolated from org tenants.
>
> Acceptance Criteria:
> - [ ] Clerk user.created webhook provisions a personal tenant
> - [ ] Personal tenant name uses i18n key (no hardcoded English)
> - [ ] Personal tenant accent color is warm neutral, distinct from 8 org colors
> - [ ] users.personal_tenant_id set in same transaction as tenant creation
> - [ ] Owner membership auto-created
> - [ ] Idempotent on webhook retry
> - [ ] isPersonalTenant() and hasPersonalWorkspace() helpers work correctly
> - [ ] testTenantIsolation() passes
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Personal tenant settings UI (Phase 3G-i Settings)
> - My Office widget grid for personal tenant (Phase 3G-ii)
> - Workspace creation flow inside personal tenant (Core UX)
> - Personal tenant billing (personal tenant uses Freelancer plan, no separate billing)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created `apps/web/src/lib/auth/personal-tenant.ts` with provisioning and helper functions
> - Updated the Clerk webhook handler
> - Created tests — all passing
> - Idempotency test confirming no duplicate tenants on retry

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(auth): add personal tenant auto-provisioning on user.created webhook [Phase 1J, Prompt 5]"
> ```

---

## PROMPT 6: Tenant Switching with Redis Cache

> ⬜ **CONTEXT — What This Builds**
>
> When a user belongs to multiple organizations, they need a fast way to switch between them. This prompt builds the switching mechanism. It's like changing which office building you're working in — the system needs to verify you have a keycard for the new building, update your badge, and remember which building you're in so you don't have to re-badge every time you open a door. The system uses Redis (a fast in-memory cache) for speed, with Clerk as the authoritative source of truth.
>
> **What You'll See When It's Done:** New tenant switching module, a Server Action for client-side invocation, and comprehensive tests. No UI yet — the clicking/switching interface comes in Prompt 9.
>
> **How Long:** 4–6 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: navigation.md lines 67–102 (Tenant Switcher — Clerk+Redis hybrid model, switching flow, what changes)
>
> Target files: apps/web/src/lib/auth/tenant-switch.ts (new), apps/web/src/actions/tenant-switch.ts (new Server Action), apps/web/src/lib/auth/__tests__/tenant-switch.test.ts (new)
> Migration required: No
>
> Implement the tenant switching mechanism using Clerk setActive() as the authoritative source with Redis as a fast-lookup cache.
>
> 1. Create tenant-switch.ts — the core switching module:
>    - switchTenant(userId: string, targetTenantId: string) — orchestrates the switch:
>      a. Validate access: Call getEffectiveMembershipForTenant(userId, targetTenantId). If null, throw NotFoundError (404 — tenant isolation pattern).
>      b. Update Redis cache: Set active_tenant:{userId} → targetTenantId with 24h TTL.
>      c. Return { tenantId: targetTenantId, role, source, accentColor } — the data the client needs for optimistic UI.
>    - getActiveTenant(userId: string) — checks Redis first, falls back to Clerk session. On cache miss, populate Redis from Clerk.
>    - invalidateTenantCache(userId: string) — clear Redis key. Called on permission changes, relationship revocation, etc.
>
> 2. Create Server Action switchTenantAction — wraps switchTenant() for client-side invocation:
>    - Uses Clerk's setActive() (via @clerk/nextjs) to update the JWT with the new organization/tenant context. This is the authoritative step.
>    - If Clerk setActive() fails, clear the Redis cache update and throw an error.
>    - Returns the accent color and tenant metadata needed for optimistic shell repainting.
>    - Writes audit log: action: 'tenant_switched', actor_type: 'user'.
>
> 3. Define the TenantSwitchResult type:
>    interface TenantSwitchResult {
>      tenantId: string;
>      tenantName: string;
>      role: string;
>      source: 'direct' | 'agency';
>      accentColor: string;
>      agencyTenantId?: string;
>    }
>
> 4. Error handling:
>    - Target tenant doesn't exist or user has no access → 404.
>    - Clerk setActive() fails → revert Redis, surface toast-compatible error: "Unable to switch workspace. Please try again." (i18n key).
>    - Redis unavailable → fall back to Clerk-only (degraded but functional).
>
> 5. Write tests:
>    - Successful switch updates Redis and returns correct data.
>    - Switch to non-existent tenant returns 404.
>    - Switch to tenant user has no access to returns 404.
>    - Clerk failure reverts Redis update.
>    - Redis failure degrades gracefully (Clerk-only).
>    - getActiveTenant() returns cached value on hit.
>    - getActiveTenant() populates cache on miss.
>    - invalidateTenantCache() clears the Redis key.
>    - Agency member switching to client tenant returns source: 'agency'.
>
> Acceptance Criteria:
> - [ ] switchTenant() validates access via effective_memberships before switching
> - [ ] Redis cache updated with active_tenant:{userId} key
> - [ ] Clerk setActive() called as authoritative source
> - [ ] Clerk failure reverts Redis and returns error
> - [ ] Redis failure degrades to Clerk-only (no crash)
> - [ ] getActiveTenant() uses Redis-first, Clerk-fallback pattern
> - [ ] TenantSwitchResult includes accent color for optimistic repainting
> - [ ] Audit log entry written on successful switch
> - [ ] All error messages use i18n keys
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Client-side optimistic UI components (Prompts 8–9)
> - Shell repainting CSS (Prompt 7)
> - Sidebar tenant list rendering (Prompt 8)
> - Workspace navigation within a tenant (Prompt 8)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created `apps/web/src/lib/auth/tenant-switch.ts`
> - Created `apps/web/src/actions/tenant-switch.ts` Server Action
> - Created tests — all passing
> - Redis and Clerk failure scenarios handled gracefully

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(auth): implement tenant switching with Clerk setActive + Redis cache [Phase 1J, Prompt 6]"
> ```

---

## INTEGRATION CHECKPOINT 2 (after Prompts 4–6)

> ⬜ **CONTEXT**
>
> You've completed the auth middleware update, personal tenant provisioning, and tenant switching. These three pieces work together — let's verify they integrate properly before moving to the UI work.
>
> **How Long:** 2–3 minutes.

---

> 🟠 **VERIFICATION — Paste into Claude Code**
>
> ```
> Run the following verification checks and fix any failures:
>
> 1. pnpm turbo typecheck — zero errors
> 2. pnpm turbo lint — zero errors
> 3. pnpm turbo test — all pass
> 4. pnpm turbo test -- --coverage — thresholds met
> 5. Manual verification:
>    - Create a test user via factory → verify personal tenant provisioned with warm neutral accent
>    - Verify effective_memberships view returns correct rows for direct + agency access
>    - Verify switchTenant() updates Redis and returns correct accent color
>    - Verify tenant-switching with an agency member resolves correct role
>
> Fix any failures before proceeding.
> ```

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit with message: "chore(verify): integration checkpoint 2 — auth middleware + personal tenant + tenant switching [Phase 1J, CP-2]"
>
> Then push the branch: git push origin feat/phase-1j-cp-migration-nav-shell
> ```

> 🟠 **REVIEW POINT:** Check GitHub. You should now see 7 commits on the branch. The auth flow should be fully wired up — Prompts 7–10 build the visual shell on top of this foundation.

---

## PROMPT 7: Color System for Tenant Switching

> ⬜ **CONTEXT — What This Builds**
>
> This is the first visual prompt. It sets up the color system that makes each organization visually distinct. When you switch between organizations, the header bar smoothly transitions to that organization's brand color. Personal workspaces always use a warm gray. There are 8 curated accent colors for organizations (teal, ocean blue, indigo, etc.) and a fixed system color for portals. Think of it like each company having their own colored badge — you always know which company's workspace you're looking at.
>
> **What You'll See When It's Done:** CSS custom properties added. A React context provider created. The header bar now uses a dynamic color variable instead of a hardcoded color. No interactive switching yet — that comes in Prompt 9.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: design-system.md lines 112–141 (Shell Accent Token, Portal Accent Token, Agency Banner — token definitions and repainting rules), navigation.md lines 127–145 (Contextual Clarity — three mandatory signals, personal tenant visual identity)
>
> Target files: apps/web/src/app/globals.css (update), apps/web/src/lib/design-system/shell-accent.ts (new), apps/web/src/components/shell/ShellAccentProvider.tsx (new), apps/web/src/components/shell/__tests__/ShellAccentProvider.test.tsx (new)
> Migration required: No
>
> Implement the per-tenant shell accent color system with CSS custom properties and tenant-switch repainting.
>
> 1. Update globals.css — add the --shell-accent and --portal-accent CSS custom properties:
>    :root {
>      --shell-accent: #0D9488; /* default: Teal — overridden per tenant */
>      --portal-accent: #64748B; /* system-owned, non-customisable — Slate 500 */
>      --personal-accent: #78716C; /* warm neutral for personal tenant */
>    }
>    - --shell-accent is set per tenant from tenants.settings.branding_accent_color.
>    - --portal-accent is fixed, system-owned. Portal entries in the sidebar use this color. Cannot be customized by any tenant.
>    - --personal-accent is the fixed warm neutral for personal tenants — never matches any of the 8 curated org accent options.
>
> 2. Create shell-accent.ts — utility module:
>    - PERSONAL_TENANT_ACCENT = '#78716C' — warm neutral (stone-500).
>    - PORTAL_ACCENT = '#64748B' — system-owned slate.
>    - ORG_ACCENT_OPTIONS — the 8 curated accent colors from design-system.md (Teal, Ocean Blue, Indigo, Deep Purple, Rose, Amber, Forest, Slate). Used for validation and ensuring personal accent never overlaps.
>    - getShellAccent(tenantId: string, isPersonalTenant: boolean, accentColor?: string) — returns PERSONAL_TENANT_ACCENT if personal tenant, otherwise returns the tenant's branding_accent_color or default Teal.
>    - isValidAccentColor(hex: string) — validates against the 8 curated options.
>
> 3. Create ShellAccentProvider.tsx — a React context provider that:
>    - Stores the current --shell-accent value in state.
>    - Updates the CSS custom property on :root when the accent changes.
>    - Exposes setShellAccent(color: string) for optimistic repainting on tenant switch.
>    - Exposes revertShellAccent() for reverting on Clerk failure.
>    - CSS transition: transition: background-color 150ms ease-in-out on the header for smooth repainting.
>    - Wraps the application layout.
>
> 4. Update the header component — the header bar should use background-color: var(--shell-accent) instead of any hardcoded accent color. Ensure white text/icons maintain ≥4.5:1 contrast (all 8 curated colors + personal neutral + default Teal pass this — precomputed, no runtime check needed).
>
> 5. Write tests:
>    - Personal tenant gets warm neutral accent.
>    - Org tenant gets its configured accent color.
>    - Missing accent color defaults to Teal.
>    - setShellAccent() updates :root CSS property.
>    - revertShellAccent() restores previous value.
>    - All 8 org accent colors + personal accent pass contrast validation.
>    - Portal accent is fixed and not affected by tenant switching.
>
> Acceptance Criteria:
> - [ ] --shell-accent CSS custom property set on :root
> - [ ] --portal-accent CSS custom property set and non-customisable
> - [ ] --personal-accent is warm neutral, never matches any org accent
> - [ ] Header uses var(--shell-accent) for background
> - [ ] ShellAccentProvider supports optimistic set and revert
> - [ ] CSS transition on header for smooth repainting
> - [ ] White text on all accent colors passes ≥4.5:1 contrast
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Full tenant settings UI for choosing accent color (Phase 3G-i Settings)
> - Agency banner rendering (post-MVP)
> - Portal theming or portal accent customization (post-MVP)
> - Dark mode or light mode toggles (never — hybrid layout only)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Updated `globals.css` with three new CSS custom properties
> - Created `shell-accent.ts` utility module
> - Created `ShellAccentProvider.tsx` React context
> - Updated the header to use `var(--shell-accent)`
> - Tests passing

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(ui): add shell accent tokens and repainting on tenant switch [Phase 1J, Prompt 7]"
> ```

---

## PROMPT 8: Sidebar Navigation Tree

> ⬜ **CONTEXT — What This Builds**
>
> This is where the sidebar comes to life. Right now the sidebar is a basic shell — this prompt fills it with a tree of all the user's organizations and workspaces. Each organization is a collapsible section showing its workspaces (optionally grouped into boards). The currently active organization is expanded by default; others are collapsed. A "My Office" entry appears at the top of each organization section. There's also a portal section at the bottom for any client portals the user has been granted access to. The sidebar has two states: collapsed (showing just icons) and expanded (showing the full tree).
>
> **What You'll See When It's Done:** The sidebar now shows organizations and workspaces. You can expand/collapse organization sections. Skeleton loading states appear while data loads. The icon rail shows the correct icon order.
>
> **How Long:** 5–8 minutes (this is a larger prompt).

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: navigation.md lines 25–73 (Sidebar Navigation Tree — tree structure, display rules, workspace nesting), design-system.md lines 49–57 (Foundations — sidebar dimensions, icon rail order), design-system.md lines 232–236 (Sidebar Nav component spec)
>
> Target files: apps/web/src/data/sidebar-navigation.ts (new), apps/web/src/components/shell/SidebarNav.tsx (new or update), apps/web/src/components/shell/TenantSection.tsx (new), apps/web/src/components/shell/WorkspaceTree.tsx (new), apps/web/src/data/__tests__/sidebar-navigation.test.ts (new)
> Migration required: No
>
> Build the data layer and layout for the multi-tenant sidebar navigation tree.
>
> 1. Create sidebar-navigation.ts — server-side data fetcher:
>    - getSidebarNavigation(userId: string) → returns the full navigation tree:
>      interface SidebarNavigation {
>        tenants: TenantNavSection[];
>        portals: PortalNavEntry[];
>      }
>      interface TenantNavSection {
>        tenantId: string;
>        tenantName: string;
>        accentColor: string;
>        isPersonalTenant: boolean;
>        isActive: boolean;
>        workspaces: WorkspaceNavEntry[];
>        boards: BoardNavGroup[];
>      }
>      interface BoardNavGroup {
>        boardId: string;
>        boardName: string;
>        workspaces: WorkspaceNavEntry[];
>      }
>      interface WorkspaceNavEntry {
>        workspaceId: string;
>        workspaceName: string;
>        icon?: string;
>      }
>      interface PortalNavEntry {
>        portalId: string;
>        portalName: string;
>        tenantSlug: string;
>        portalSlug: string;
>      }
>    - Query effective_memberships to get all tenants the user has access to.
>    - For each tenant, query workspaces the user can access (Owner/Admin see all, Members see their workspace_memberships).
>    - Group workspaces by board (if board_id is set) or list flat.
>    - Query portal_access for the user's email to get portal entries (non-revoked only — revoked_at IS NULL).
>    - Personal tenant always listed first, regardless of alphabetical order.
>    - Personal tenant hidden in the tenant switcher until it has at least one workspace (use hasPersonalWorkspace() from Prompt 5).
>
> 2. Write testTenantIsolation() test for getSidebarNavigation() — user in Tenant A should not see Tenant B's workspaces.
>
> 3. Create TenantSection.tsx — renders one tenant section in the sidebar:
>    - Collapsed state: tenant header only (logo/avatar + name). One click expands.
>    - Expanded state: "My Office" entry (first item), then workspace tree.
>    - Active tenant is expanded by default, others collapsed.
>    - Tenant header shows accent color indicator (small dot or badge).
>
> 4. Create WorkspaceTree.tsx — renders workspaces within a tenant section:
>    - Board grouping: workspaces nested under board headings (collapsible).
>    - Ungrouped workspaces listed flat after board groups.
>    - Each workspace entry is a navigation link.
>
> 5. Update SidebarNav.tsx (or create if doesn't exist):
>    - Renders the icon rail (48px collapsed / 280px expanded).
>    - Icon rail order (top to bottom): My Office, Tasks, Chat, Calendar, Expand/Collapse, Help, Avatar.
>    - Expanded state renders tenant sections from getSidebarNavigation().
>    - Uses sidebarBg, sidebarBgHover, sidebarText, sidebarTextMuted, sidebarActive tokens.
>    - Sidebar toggle (expand/collapse) persists preference.
>
> 6. Loading state — skeleton screens matching sidebar layout shape (not spinners). Use loading skeleton for tenant sections while data fetches.
>
> Acceptance Criteria:
> - [ ] getSidebarNavigation() returns correct tree for multi-tenant users
> - [ ] Personal tenant listed first, hidden if no workspaces
> - [ ] Workspaces grouped by board where applicable
> - [ ] Portal entries returned from portal_access (non-revoked only)
> - [ ] testTenantIsolation() passes for getSidebarNavigation()
> - [ ] TenantSection renders collapsed/expanded states
> - [ ] Active tenant expanded by default
> - [ ] WorkspaceTree renders board grouping and flat workspaces
> - [ ] Sidebar icon rail with correct icon order
> - [ ] Sidebar expand/collapse toggle works with persisted preference
> - [ ] Skeleton loading states (not spinners)
> - [ ] All user-facing strings use i18n
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Quick Panel content (Tasks, Chat, Calendar — Phase 3C, 3G-ii)
> - Command Bar (Phase 3B-ii)
> - My Office widget grid (Phase 3G-ii — entry point only)
> - Help Panel (support-system — future phase)
> - Workspace creation UI within sidebar (Core UX)
> - Mobile hamburger drawer navigation (Phase 3H)
> - Table or Table View items within workspace (Core UX — workspaces are leaf nodes in this phase)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created `apps/web/src/data/sidebar-navigation.ts` with data fetcher
> - Created `TenantSection.tsx`, `WorkspaceTree.tsx`, and updated `SidebarNav.tsx`
> - Tenant isolation test passing
> - Skeleton loading states (NOT spinners)
> - All strings using i18n

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(ui): build sidebar navigation tree with multi-tenant sections [Phase 1J, Prompt 8]"
> ```

---

## PROMPT 9: Tenant Switching UX & Portal Display

> ⬜ **CONTEXT — What This Builds**
>
> This prompt connects the switching logic (from Prompt 6) to the sidebar UI (from Prompt 8). When you click on a different organization in the sidebar, three things happen instantly: (1) the header color smoothly transitions to the new organization's accent color, (2) the clicked organization expands in the sidebar while the previous one collapses, and (3) the content area navigates to the new organization's workspace. If the switch fails for any reason, everything reverts back — you never get stuck in a half-switched state. This prompt also builds the portal section at the bottom of the sidebar, where client portals are displayed with their own distinct icon and color.
>
> **What You'll See When It's Done:** Clicking a different tenant in the sidebar triggers the color change and sidebar re-arrangement. Portal entries appear below a divider. Failure scenarios show a toast notification and revert.
>
> **How Long:** 4–6 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: navigation.md lines 85–102 (Switching Flow — optimistic UI, what changes), navigation.md lines 147–168 (Portal Display in Sidebar — visual distinction rules, data boundary enforcement, when portals appear)
>
> Target files: apps/web/src/components/shell/TenantSwitcher.tsx (new), apps/web/src/components/shell/PortalSection.tsx (new), apps/web/src/components/shell/__tests__/TenantSwitcher.test.tsx (new), apps/web/src/components/shell/__tests__/PortalSection.test.tsx (new)
> Migration required: No
>
> Build the interactive tenant switching UX and portal section in the sidebar.
>
> 1. Create TenantSwitcher.tsx — handles the tenant switching interaction:
>    - When user clicks a collapsed tenant header in the sidebar:
>      a. Optimistic UI: Immediately repaint shell — update --shell-accent, expand target tenant section, collapse previous.
>      b. Call switchTenantAction() (Server Action from Prompt 6).
>      c. On success: Update My Office heading, navigate to target tenant's last-accessed workspace, update breadcrumbs.
>      d. On failure: Revert shell accent to previous value (via revertShellAccent()), re-expand previous tenant, show toast: "Unable to switch workspace. Please try again." (i18n key).
>    - Track the currently active tenant in client state (Zustand store or context).
>
> 2. What changes on tenant switch (per navigation.md):
>    - Header accent colour → repaint to target tenant's --shell-accent.
>    - Sidebar active state → target tenant expands, previous collapses.
>    - My Office heading → updates to "My Office · [Tenant Name]" (or "My Office · Personal" for personal tenant).
>    - Content area → navigate to target tenant's last-accessed workspace (or default workspace if first visit).
>    - Breadcrumbs → reset to target tenant context.
>
> 3. Create PortalSection.tsx — renders portal entries below a visual divider:
>    - Section divider labeled "Portals" separates portal entries from tenant sections.
>    - Divider hidden when no portal entries exist.
>    - Each portal entry uses:
>      - Portal-specific icon — a distinct icon NOT shared with tenant or workspace icon families (e.g., ExternalLink or Globe icon).
>      - Portal accent color — uses --portal-accent (system-owned, non-customisable). The granting tenant cannot influence this color.
>    - Portal entry click navigates to the portal URL — does NOT trigger shell repainting (reserved for tenant switching).
>    - A persistent but subdued portal indicator in the sidebar header shows portal name and icon when inside a portal context.
>
> 4. Portal data boundary enforcement:
>    - Portal is a display convenience, not a data bridge.
>    - No cross-linking from portal context into user's own workspaces.
>    - Portal rendering in sidebar uses the same auth/data scoping as the standalone portal URL.
>
> 5. Write component tests:
>    - Clicking collapsed tenant triggers optimistic repainting.
>    - Successful switch updates sidebar state.
>    - Failed switch reverts accent and shows error toast.
>    - Portal section hidden when no portal entries.
>    - Portal entries use portal accent color (not tenant accent).
>    - Portal click does not trigger shell repainting.
>
> Acceptance Criteria:
> - [ ] Clicking tenant header triggers optimistic shell repainting
> - [ ] Successful switch updates accent, sidebar, My Office heading, and breadcrumbs
> - [ ] Failed switch reverts optimistically applied changes and shows toast
> - [ ] Toast uses i18n key for error message
> - [ ] Portal section divider visible only when portals exist
> - [ ] Portal entries use --portal-accent color and dedicated icon
> - [ ] Portal click navigates without shell repainting
> - [ ] Data boundary enforcement — no cross-linking from portal context
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Portal client auth or rendering (Phase 3E-i)
> - Portal content display within the main panel (Phase 3E-i)
> - Workspace navigation within tenant (Core UX — table/view navigation)
> - Agency-specific banner when in client tenant (post-MVP)
> - Portal settings or management (Phase 3E-i)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created `TenantSwitcher.tsx` and `PortalSection.tsx`
> - Created component tests for both
> - Optimistic repainting working with revert on failure
> - Portal section hidden when no portals exist

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(ui): implement tenant switching UX and portal display in sidebar [Phase 1J, Prompt 9]"
> ```

---

## PROMPT 10: Contextual Clarity Signals

> ⬜ **CONTEXT — What This Builds**
>
> This is the final build prompt. It implements the "three-signal" system that ensures users always know which organization they're currently working in. The three signals are: (1) the sidebar header showing the organization name and logo, (2) the header bar color matching the organization's accent, and (3) the My Office heading displaying "My Office · [Organization Name]". Having three simultaneous signals means even if a user misses one (color-blind users might miss the color signal, for example), at least two others are always visible. When you switch tenants, all three update together.
>
> **What You'll See When It's Done:** The sidebar header shows the current org name/logo (or user name for personal workspace). My Office heading shows the tenant name. All three signals update in sync when switching tenants. This completes the visual shell.
>
> **How Long:** 3–5 minutes.

---

> 🔵 **PASTE INTO CLAUDE CODE**
>
> ```
> Load context: navigation.md lines 127–145 (Contextual Clarity — three mandatory signals, why three, personal tenant visual identity)
>
> Target files: apps/web/src/components/shell/SidebarHeader.tsx (new or update), apps/web/src/components/shell/MyOfficeHeading.tsx (new), apps/web/src/components/shell/__tests__/contextual-clarity.test.tsx (new)
> Migration required: No
>
> Implement the three mandatory contextual clarity signals so users can determine their current context within one second.
>
> 1. Three mandatory signals — all must be simultaneously present:
>
>    | Signal              | Personal Tenant                      | Org / Agency Tenant                    |
>    |---------------------|--------------------------------------|----------------------------------------|
>    | Sidebar header      | User avatar + "{User}'s Workspace"   | Org logo + org name, always visible    |
>    | Shell colour        | Fixed warm neutral (--personal-accent)| Per-tenant accent via --shell-accent   |
>    | My Office heading   | "My Office · Personal"               | "My Office · [Tenant Name]"            |
>
> 2. Create/update SidebarHeader.tsx:
>    - Always visible at the top of the sidebar (both collapsed and expanded states).
>    - Personal tenant: shows user avatar + user name with "Personal" qualifier.
>    - Org tenant: shows org logo (if available, fallback to first-letter avatar) + org name.
>    - The header is persistent — remains visible during scroll within the sidebar.
>
> 3. Create MyOfficeHeading.tsx:
>    - Renders "My Office · Personal" for personal tenant (i18n key: my_office.heading_personal).
>    - Renders "My Office · [Tenant Name]" for org tenants (i18n key: my_office.heading_org, with tenant name interpolation).
>    - When an agency member is in a client tenant, renders "My Office · [Client Tenant Name]" (the agency banner — post-MVP — will provide additional context).
>    - Updates dynamically on tenant switch.
>
> 4. Personal tenant visual identity:
>    - Warm neutral accent (--personal-accent: #78716C) is never available in the 8 curated org accent options.
>    - This provides an immediate visual signal that the user is in personal context.
>    - Verify: the personal accent color is excluded from the accent color picker options.
>
> 5. Why three signals — any single signal can be missed (user not looking at header, color-blind user, My Office not visible). Three simultaneous signals — visual position, color, text — ensure at least two are always perceivable.
>
> 6. Write tests:
>    - Personal tenant shows all three signals correctly.
>    - Org tenant shows all three signals correctly.
>    - Tenant switch updates all three signals.
>    - Personal accent color is NOT in org accent options.
>    - My Office heading uses i18n keys.
>    - Sidebar header remains visible when scrolling.
>
> Acceptance Criteria:
> - [ ] All three contextual clarity signals render simultaneously
> - [ ] Personal tenant: avatar + name, warm neutral accent, "My Office · Personal"
> - [ ] Org tenant: logo + name, tenant accent, "My Office · [Tenant Name]"
> - [ ] Tenant switch updates all three signals in sync
> - [ ] Personal accent excluded from org accent picker
> - [ ] My Office headings use i18n keys with correct interpolation
> - [ ] Sidebar header visible in both collapsed and expanded sidebar states
> - [ ] ESLint and TypeScript compile with zero errors
> - [ ] Coverage ≥80% on new files
>
> Do NOT build:
> - Agency member banner inside client tenant (post-MVP)
> - Accessibility audit for colour-blind-only mode (covered by three-signal design — no separate mode needed)
> - My Office widget grid content (Phase 3G-ii)
> - Settings page for changing tenant name or logo (Phase 3G-i)
> ```

---

> 🟠 **CHECKPOINT — Verify Before Committing**
>
> Claude Code should have:
> - Created/updated `SidebarHeader.tsx`
> - Created `MyOfficeHeading.tsx`
> - Created contextual clarity tests — all passing
> - All three signals rendering and updating on tenant switch
> - All strings using i18n keys

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit all changes with message: "feat(ui): implement three-signal contextual clarity system [Phase 1J, Prompt 10]"
> ```

---

## INTEGRATION CHECKPOINT 3 — FINAL (after Prompts 7–10)

> ⬜ **CONTEXT**
>
> This is the final checkpoint for Phase 1J. It verifies that everything — database migrations, auth middleware, personal tenants, tenant switching, the color system, sidebar navigation, and contextual clarity — all works together. This is also where you'll push the branch one final time and open the pull request.
>
> **How Long:** 3–5 minutes.

---

> 🟠 **VERIFICATION — Paste into Claude Code**
>
> ```
> Run the following verification checks and fix any failures:
>
> 1. pnpm turbo typecheck — zero errors
> 2. pnpm turbo lint — zero errors
> 3. pnpm turbo check:i18n — no hardcoded English strings
> 4. pnpm turbo test — all pass
> 5. pnpm turbo test -- --coverage — thresholds met
> 6. If migrations were added: pnpm turbo db:migrate:check — no lock violations
> 7. Manual verification:
>    - Sidebar renders multi-tenant navigation tree with personal tenant first
>    - Clicking a tenant triggers optimistic accent repainting
>    - My Office heading updates with tenant name
>    - Three contextual clarity signals visible simultaneously
>    - Portal section appears when user has portal access (hidden otherwise)
>    - Portal entries use system-owned accent color
>    - Shell accent smoothly transitions on tenant switch (150ms CSS transition)
>    - Collapsed sidebar shows icon rail with correct icon order
>    - Expanded sidebar shows full workspace tree
>
> Fix any failures before proceeding.
> ```

---

> 🟢 **GIT COMMAND — Paste into Claude Code**
>
> ```
> Commit with message: "chore(verify): integration checkpoint 3 (final) — shell accent, sidebar tree, contextual clarity [Phase 1J, CP-3]"
>
> Then push the branch: git push origin feat/phase-1j-cp-migration-nav-shell
> ```

---

## PHASE COMPLETE

> ⬜ **CONTEXT**
>
> Phase 1J is done! This was the final Foundation phase. EveryStack now has:
> - **52 tables + 1 database view** — all MVP schema in place
> - **Auth middleware** that supports both direct and agency-delegated access
> - **Personal workspaces** auto-created for every new user
> - **Multi-tenant sidebar** — all organizations and workspaces in a collapsible tree
> - **Tenant switching** — smooth color transitions with Redis-backed speed
> - **Three-signal contextual clarity** — users always know where they are

---

> 🟢 **OPEN PULL REQUEST — Paste into Claude Code**
>
> ```
> Open a pull request to main:
>
> gh pr create --base main --head feat/phase-1j-cp-migration-nav-shell --title "Phase 1J — CP Migration, Multi-Tenant Auth & Navigation Shell" --body "## Summary
>
> Final Foundation phase. Applies CP-001 and CP-002 schema migrations, upgrades auth to effective_memberships view, adds personal tenant auto-provisioning, implements tenant switching with Clerk + Redis hybrid, and builds the sidebar navigation tree with three-signal contextual clarity.
>
> ## Deliverables
>
> - CP-001: Portal slug scoping, portal_access extensions, thread_type column
> - CP-002: users.personal_tenant_id, workspace transfer stubs, tenant_relationships table
> - effective_memberships database view (direct + agency access union)
> - Auth middleware migrated to effective_memberships
> - Personal tenant auto-provisioning on user.created webhook
> - Tenant switching (Clerk setActive + Redis cache hybrid)
> - Shell accent CSS custom properties with optimistic repainting
> - Sidebar navigation tree with multi-tenant sections
> - Tenant switching UX with optimistic UI and failure revert
> - Portal section with system-owned accent color
> - Three-signal contextual clarity system
>
> ## Test Coverage
>
> - Tenant isolation tests on all new data access functions
> - Auth middleware regression tests passing
> - Component tests for all new UI components
> - Coverage ≥80% on all new files
>
> ## Final table count: 52 tables + 1 view"
> ```

---

> 🟠 **REVIEW POINT:** Go to GitHub and review the PR. Check the diff. Once you're satisfied, merge using **squash merge** to keep main's history clean.

---

> 🟢 **AFTER MERGE — Run in terminal (not Claude Code)**
>
> ```
> git checkout main && git pull origin main
> git tag v0.1.9-phase-1j
> git push origin v0.1.9-phase-1j
> git branch -d feat/phase-1j-cp-migration-nav-shell
> ```

---

> ⬜ **WHAT'S NEXT**
>
> With all 10 Foundation phases (1A–1J) complete, the EveryStack platform has its full infrastructure in place. The next phase is **Phase 2 (MVP — Sync)**, which builds the sync engine that connects to Airtable and Notion. Phase 2 builds on top of the database tables, auth system, and testing infrastructure you've now established.
