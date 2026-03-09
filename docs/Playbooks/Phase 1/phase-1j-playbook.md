# Phase 1J — Change Proposal Migration, Multi-Tenant Auth & Navigation Shell

## Phase Context

### What Has Been Built

**Phase 1A (Monorepo, CI Pipeline, Dev Environment):** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI (lint → typecheck → test). ESLint + Prettier config. tsconfig strict mode. `.env.example`.

**Phase 1B (Database Schema, Connection Pooling, Tenant Routing):** Drizzle schema for all 51 MVP tables (Tiers 0–7). PgBouncer connection pooling config. `getDbForTenant()` with read/write routing. RLS policies enforcing tenant isolation. UUIDv7 primary key generation. Initial migration files.

**Phase 1C (Authentication, Tenant Isolation, Workspace Roles):** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities. `PermissionDeniedError` shape.

**Phase 1D (Observability, Security Hardening):** Pino + pino-http structured logging. traceId via AsyncLocalStorage. Sentry DSN integration. OpenTelemetry basic instrumentation. Security headers middleware. Encryption at rest/in transit config. Webhook signature verification pattern.

**Phase 1E (Testing Infrastructure):** Vitest workspace config for monorepo. Playwright E2E setup. Test data factories for all core tables. `testTenantIsolation()` helper. Mock Clerk session utilities. MSW mock setup. `docker-compose.test.yml` for CI.

**Phase 1F (Design System Foundation):** shadcn/ui primitives installed. Tailwind config with three-layer color architecture (surface + accent + data palette). DM Sans + JetBrains Mono fonts. Spacing scale. Responsive application shell layout with sidebar.

**Phase 1G (Runtime Services):** Socket.io server with Clerk JWT auth and Redis adapter. Room join/leave model. BullMQ worker skeleton with queue definitions. StorageClient + R2 implementation. Presigned URL endpoints. MIME allowlist. File upload pipeline.

**Phase 1H (AI Service Layer):** AIService skeleton with AIProviderAdapter interface. Anthropic adapter with SDK integration. Capability-based model routing. Prompt registry with versioning. `canonicalToAIContext()` / `aiToCanonical()` type signatures. Credit metering flow with `ai_usage_log` and `ai_credit_ledger`.

**Phase 1I (Audit Log Helper, Platform API Auth Skeleton):** `writeAuditLog()` helper with seven-source attribution. `api_keys` table with SHA-256 hashing. API auth middleware. Token-bucket rate limiting. Structured API error format. `vertical-architecture.md` reviewed (strategy doc, no code).

### What This Phase Delivers

When Phase 1J is complete:

1. **CP-001 and CP-002 schema migrations** are applied — `tenant_relationships` table, `effective_memberships` database view, `portal_access` extended columns, `threads.thread_type` column, `users.personal_tenant_id`, `workspaces` transfer columns, and `portals` constraint change. Final table count: 52 + 1 view.
2. **Auth middleware** queries `effective_memberships` instead of `tenant_memberships` directly — supporting both direct and agency-delegated access patterns.
3. **Personal tenant auto-provisioning** — the `user.created` Clerk webhook handler creates a personal tenant and sets `users.personal_tenant_id`.
4. **Tenant switching** — Clerk `setActive()` + Redis cache hybrid enables fast switching with optimistic UI.
5. **Sidebar navigation tree** — collapsible multi-tenant tree with per-tenant workspace nesting, My Office entries, and portal section.
6. **Shell accent colouring** — per-tenant `--shell-accent` CSS custom property with repainting on tenant switch.
7. **Contextual clarity signals** — three mandatory visual signals ensuring users always know their current context.

### What This Phase Does NOT Build

- Agency Console `/agency` route (post-MVP)
- "Acting as Agency" persistent banner (post-MVP — schema stubs for `tenant_relationships` are present, but agency UX is deferred)
- Workspace transfer UI (post-MVP — schema stubs `transferred_from_tenant_id` and `original_created_by_tenant_id` are present)
- White-label mode UI (post-MVP)
- Agency onboarding flows (post-MVP)
- Client onboarding via agency (post-MVP)
- Portal client auth or portal rendering (Phase 3E-i)
- Table View–based access controls or field-level permissions (Phase 3A-iii)
- My Office widget grid (Phase 3G-ii — this phase builds the My Office navigation entry only)
- Quick Panels (Tasks, Chat, Calendar — Core UX)
- Command Bar (Phase 3B-ii)
- Mobile navigation (Phase 3H)

### Architecture Patterns for This Phase

- **Migrations only** — never modify existing migration files. Create new migration files for all CP-001/CP-002 schema changes.
- **Auth resolution** — all auth middleware must query the `effective_memberships` view, never `tenant_memberships` or `tenant_relationships` directly.
- **VARCHAR for extensible columns** — `thread_type`, `scope_type`, `relationship_type`, `status`, `access_level`, `initiated_by`, `revoked_reason` are all VARCHAR. No Postgres ENUMs.
- **CSS custom properties** — `--shell-accent` and `--portal-accent` tokens set on `:root`, repainting via class swap or CSS transition.
- **CockroachDB safeguards** remain active (UUIDv7, no PG-specific syntax, no advisory locks).
- **i18n** — all user-facing strings through i18n. No hardcoded English.
- **Pino logger** — no `console.log`.
- **Tenant isolation** — `testTenantIsolation()` on every new data access function.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | CP-001 Schema Migration (portals, portal_access, threads) | None | ~180 |
| 2 | CP-002 Schema Migration (users, workspaces, tenant_relationships) | None | ~200 |
| 3 | effective_memberships Database View | 1, 2 | ~150 |
| CP-1 | Integration Checkpoint 1 | 1–3 | — |
| 4 | Auth Middleware Update — effective_memberships Resolution | 3 | ~180 |
| 5 | Personal Tenant Auto-Provisioning | 2, 4 | ~160 |
| 6 | Tenant Switching — Clerk + Redis Hybrid | 4, 5 | ~180 |
| CP-2 | Integration Checkpoint 2 | 4–6 | — |
| 7 | Shell Accent Tokens & Repainting | 6 | ~150 |
| 8 | Sidebar Navigation Tree — Data Layer & Layout | 4, 7 | ~200 |
| 9 | Sidebar Navigation Tree — Tenant Switching UX & Portal Display | 6, 8 | ~180 |
| 10 | Contextual Clarity Signals & Final Polish | 7, 9 | ~140 |
| CP-3 | Integration Checkpoint 3 (Final) | 7–10 | — |

---

## Prompt 1: CP-001 Schema Migration — Portal Refinements & Thread Type

**Depends on:** None
**Load context:** `data-model.md` lines 94–103 (Portals & Forms — portal_access, portals), `data-model.md` lines 113–121 (Communications — threads)
**Target files:** `packages/shared/db/migrations/XXXX_cp001_portal_thread_refinements.ts`, `packages/shared/db/schema/portals.ts` (update types), `packages/shared/db/schema/threads.ts` (update types)
**Migration required:** Yes — new migration file. Never modify existing migration files.
**Git:** Commit with message `feat(db): apply CP-001 schema migration — portal refinements and thread_type [Phase 1J, Prompt 1]`

### Schema Snapshot

**portals** — constraint change:
```
-- BEFORE: UNIQUE(slug)
-- AFTER:  UNIQUE(tenant_id, slug) — tenant-scoped, not platform-global
```

**portal_access** — 4 new columns:
```
portal_access:
  ...existing 9 columns...
  revoked_at (TIMESTAMPTZ nullable)                           -- NEW
  revoked_reason (VARCHAR nullable — 'record_deleted'|'manager_revoked'|'portal_archived')  -- NEW
  record_slug (VARCHAR, UNIQUE(portal_id, record_slug))       -- NEW — client-safe slug, raw UUID never exposed
  linked_record_id (UUID nullable FK → records.id)            -- NEW — optional contact record link
```

**threads** — column replacement + constraint:
```
threads:
  ...existing columns...
  -- REMOVE: visibility column (if present)
  thread_type (VARCHAR NOT NULL DEFAULT 'internal' — 'internal'|'client')  -- NEW (replaces visibility)
  UNIQUE(scope_type, scope_id, thread_type)  -- NEW — enforces one of each type per scope
```

### Task

Create a new Drizzle migration that applies the CP-001 schema changes:

1. **portals table** — Drop the existing `UNIQUE(slug)` constraint and replace it with `UNIQUE(tenant_id, slug)`. Use concurrent index creation where possible to avoid ACCESS EXCLUSIVE locks. If a non-concurrent approach is needed, ensure the lock is held for <1s.

2. **portal_access table** — Add four columns:
   - `revoked_at` — TIMESTAMPTZ, nullable, default null.
   - `revoked_reason` — VARCHAR, nullable. Known values: `'record_deleted'`, `'manager_revoked'`, `'portal_archived'`. No CHECK constraint (VARCHAR extensibility).
   - `record_slug` — VARCHAR, with `UNIQUE(portal_id, record_slug)` constraint.
   - `linked_record_id` — UUID, nullable, FK → `records.id` ON DELETE SET NULL.

3. **threads table** — Add `thread_type` column:
   - VARCHAR NOT NULL DEFAULT `'internal'`. Known values: `'internal'`, `'client'`.
   - Add `UNIQUE(scope_type, scope_id, thread_type)` constraint.
   - If a `visibility` column exists from an earlier migration, drop it. If it doesn't exist, skip the drop.

4. **Update Drizzle schema type definitions** in the existing schema files to reflect the new columns and constraints. Add TypeScript comments listing known values for VARCHAR columns (same pattern used for `author_type`, `message_type`, `scope_type` — see CLAUDE.md conventions).

5. **Update test factories** — update `createTestPortalAccess()` and `createTestThread()` factories to support the new columns with sensible defaults.

### Acceptance Criteria

- [ ] Migration runs successfully against a fresh database and against the existing schema
- [ ] `portals.slug` uniqueness is now scoped to `(tenant_id, slug)` — two tenants can have the same slug
- [ ] `portal_access` has all 4 new columns with correct types and constraints
- [ ] `record_slug` UNIQUE constraint scoped to `(portal_id, record_slug)` is enforced
- [ ] `threads.thread_type` defaults to `'internal'` and accepts `'client'`
- [ ] `UNIQUE(scope_type, scope_id, thread_type)` prevents duplicate thread types per scope
- [ ] No ACCESS EXCLUSIVE lock held for >1s (verified via `db:migrate:check`)
- [ ] Drizzle schema types updated with new columns
- [ ] Test factories updated
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Portal client auth, session management, or rendering (Phase 3E-i)
- Thread message delivery or Record Thread UI (Phase 3C)
- Portal URL routing (Phase 3E-i)
- Any application logic using the new columns — this is schema-only

---

## Prompt 2: CP-002 Schema Migration — Users, Workspaces & Tenant Relationships

**Depends on:** None
**Load context:** `data-model.md` lines 29–41 (User, Tenant & Workspace — users, workspaces, tenant_relationships), `data-model.md` lines 42–62 (effective_memberships view — read for context only, view created in Prompt 3)
**Target files:** `packages/shared/db/migrations/XXXX_cp002_multi_tenant_identity.ts`, `packages/shared/db/schema/users.ts` (update), `packages/shared/db/schema/workspaces.ts` (update), `packages/shared/db/schema/tenant-relationships.ts` (new schema file)
**Migration required:** Yes — new migration file.
**Git:** Commit with message `feat(db): apply CP-002 schema migration — personal_tenant_id, workspace transfer stubs, tenant_relationships [Phase 1J, Prompt 2]`

### Schema Snapshot

**users** — 1 new column:
```
users:
  ...existing columns (id, clerk_id, email, name, avatar_url, preferences, is_platform_admin, is_support_agent, created_at, updated_at)...
  personal_tenant_id (UUID nullable FK → tenants.id)  -- NEW — set on first login via auto-provisioning
```

**workspaces** — 2 new columns:
```
workspaces:
  ...existing columns...
  transferred_from_tenant_id (UUID nullable FK → tenants.id)        -- NEW — set on workspace transfer; null if never transferred
  original_created_by_tenant_id (UUID nullable FK → tenants.id)     -- NEW — immutable, records originating tenant
```

**tenant_relationships** — new table (~14 columns):
```
tenant_relationships:
  id (UUIDv7 PK)
  agency_tenant_id (UUID FK → tenants.id NOT NULL)
  client_tenant_id (UUID FK → tenants.id NOT NULL)
  relationship_type (VARCHAR — 'managed'|'white_label'|'reseller'|'referral')
  status (VARCHAR — 'pending'|'active'|'suspended'|'revoked')
  access_level (VARCHAR — 'admin'|'builder'|'read_only')
  initiated_by (VARCHAR — 'agency'|'client')
  authorized_by_user_id (UUID FK → users.id)
  agency_billing_responsible (BOOLEAN)
  accepted_at (TIMESTAMPTZ nullable)
  revoked_at (TIMESTAMPTZ nullable)
  revoked_by_user_id (UUID nullable FK → users.id)
  metadata (JSONB — includes contract_ref, hide_member_identity for white_label)
  created_at (TIMESTAMPTZ DEFAULT NOW())
```

### Task

Create a new Drizzle migration that applies the CP-002 schema changes:

1. **users table** — Add `personal_tenant_id` column:
   - UUID, nullable, FK → `tenants.id` ON DELETE SET NULL.
   - Index on `personal_tenant_id` for fast lookup during auth resolution.

2. **workspaces table** — Add 2 columns:
   - `transferred_from_tenant_id` — UUID, nullable, FK → `tenants.id` ON DELETE SET NULL.
   - `original_created_by_tenant_id` — UUID, nullable, FK → `tenants.id` ON DELETE SET NULL.
   - These are schema stubs for post-MVP workspace transfer. No application logic needed.

3. **tenant_relationships table** — Create new table with all columns per the schema snapshot above:
   - UUIDv7 primary key (use the existing UUIDv7 generation utility).
   - All string-typed columns are VARCHAR, not ENUM (per CLAUDE.md convention).
   - `metadata` is JSONB, default `{}`.
   - Indexes: `(agency_tenant_id, status)` for agency portfolio lookups, `(client_tenant_id, status)` for client access checks.
   - `UNIQUE(agency_tenant_id, client_tenant_id)` — one relationship per tenant pair.
   - RLS policy enforcing tenant isolation. Both `agency_tenant_id` and `client_tenant_id` should be checkable — a user in either tenant can see the relationship row.

4. **Create Drizzle schema file** `packages/shared/db/schema/tenant-relationships.ts` for the new table.

5. **Update existing schema files** for users and workspaces with new column definitions and TypeScript comments for known values.

6. **Create test factory** `createTestTenantRelationship()` in `packages/shared/testing/` with sensible defaults (status: `'active'`, access_level: `'builder'`, relationship_type: `'managed'`).

7. **Update existing factories** — `createTestUser()` should accept optional `personal_tenant_id`, `createTestWorkspace()` should accept optional transfer columns.

### Acceptance Criteria

- [ ] Migration runs successfully against existing schema
- [ ] `users.personal_tenant_id` is nullable UUID FK to `tenants.id`
- [ ] `workspaces` has both transfer tracking columns (nullable)
- [ ] `tenant_relationships` table created with all 14 columns
- [ ] `UNIQUE(agency_tenant_id, client_tenant_id)` constraint enforced
- [ ] RLS policy on `tenant_relationships` allows access from either side of the relationship
- [ ] `testTenantIsolation()` passes for `tenant_relationships` — a user in unrelated Tenant C cannot see a relationship between Tenants A and B
- [ ] `createTestTenantRelationship()` factory works correctly
- [ ] No ACCESS EXCLUSIVE lock held for >1s
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Agency Console UI or `/agency` route (post-MVP)
- Workspace transfer logic (post-MVP — schema stubs only)
- Tenant relationship management CRUD endpoints (post-MVP)
- Agency onboarding flows (post-MVP)

---

## Prompt 3: effective_memberships Database View

**Depends on:** Prompt 1 (threads schema), Prompt 2 (tenant_relationships table, users.personal_tenant_id)
**Load context:** `data-model.md` lines 42–62 (effective_memberships view definition, role derivation), `permissions.md` lines 468–475 (Phase Implementation — auth middleware uses effective_memberships), `permissions.md` lines 488–506 (Agency Access Model — access level derivation)
**Target files:** `packages/shared/db/migrations/XXXX_effective_memberships_view.ts`, `packages/shared/db/schema/effective-memberships.ts` (new Drizzle view definition)
**Migration required:** Yes — creates a database view.
**Git:** Commit with message `feat(db): create effective_memberships database view [Phase 1J, Prompt 3]`

### Schema Snapshot

```sql
CREATE VIEW effective_memberships AS
  -- Direct memberships
  SELECT user_id, tenant_id, role, 'direct' AS source, NULL AS agency_tenant_id
  FROM tenant_memberships
  WHERE status = 'active'
  UNION ALL
  -- Agency-delegated access: agency members get synthesized role in client tenant
  SELECT tm.user_id, tr.client_tenant_id AS tenant_id,
         tr.access_level AS role, 'agency' AS source, tr.agency_tenant_id
  FROM tenant_relationships tr
  JOIN tenant_memberships tm ON tm.tenant_id = tr.agency_tenant_id AND tm.status = 'active'
  WHERE tr.status = 'active';
```

### Task

1. **Create the `effective_memberships` database view** via a new Drizzle migration. The view unions:
   - **Direct memberships:** All active `tenant_memberships` rows with `source = 'direct'` and `agency_tenant_id = NULL`.
   - **Agency-delegated access:** For each active `tenant_relationships` row, join to active `tenant_memberships` of the agency tenant. The `role` column maps from `tenant_relationships.access_level` (`admin`/`builder`/`read_only`). The `source` column is `'agency'`. The `agency_tenant_id` column preserves the agency tenant for audit/UI purposes.

2. **Create the Drizzle view definition** in `packages/shared/db/schema/effective-memberships.ts` so that Drizzle ORM can query it like a table. Export the type for use in auth middleware.

3. **Write a data access helper** `getEffectiveMemberships(userId: string)` in `packages/shared/db/` that returns all tenant memberships (direct + agency) for a given user. This is the function the auth middleware will call.

4. **Write a helper** `getEffectiveMembershipForTenant(userId: string, tenantId: string)` that returns the user's membership in a specific tenant (direct or agency-delegated). Returns `null` if no access.

5. **Write tests:**
   - User with direct membership returns `source: 'direct'`.
   - Agency member accessing client tenant returns `source: 'agency'`, correct `access_level` as role, and the `agency_tenant_id`.
   - Suspended tenant_relationships do not appear in the view.
   - Suspended tenant_memberships do not appear in the view.
   - User with both direct and agency access to the same tenant (edge case) returns both rows.
   - `testTenantIsolation()` — a user with no membership in Tenant X gets no rows for Tenant X.

### Acceptance Criteria

- [ ] `effective_memberships` view created via migration
- [ ] View correctly unions direct memberships and agency-delegated access
- [ ] Agency access uses `access_level` as the role column
- [ ] `source` column distinguishes `'direct'` from `'agency'`
- [ ] `agency_tenant_id` populated for agency rows, null for direct rows
- [ ] Suspended relationships and memberships excluded from view
- [ ] `getEffectiveMemberships()` returns correct results for all test cases
- [ ] `getEffectiveMembershipForTenant()` returns null for non-members
- [ ] `testTenantIsolation()` passes
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Auth middleware integration (Prompt 4)
- Role derivation logic beyond simple column mapping (Core UX handles full permission resolution)
- Agency Console or agency management UI (post-MVP)
- Caching layer for effective_memberships (Prompt 6 adds Redis)

---

## Integration Checkpoint 1 (after Prompts 1–3)

**Task:** Verify all schema migration work integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. `pnpm turbo db:migrate` — all migrations apply cleanly to a fresh database
6. `pnpm turbo db:migrate:check` — no lock violations (no ACCESS EXCLUSIVE >1s)
7. Manual verification: Query `effective_memberships` view with test data and confirm it returns correct rows for direct and agency access patterns

**Git:** Commit with message `chore(verify): integration checkpoint 1 — CP-001/CP-002 migrations + effective_memberships view [Phase 1J, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 4.

---

## Prompt 4: Auth Middleware Update — effective_memberships Resolution

**Depends on:** Prompt 3 (effective_memberships view + helpers)
**Load context:** `permissions.md` lines 286–309 (Permission Resolution at Runtime — Internal Users step 1-2), `permissions.md` lines 488–506 (Agency Access Model — access level derivation), `navigation.md` lines 79–102 (Tenant Switcher — what changes on switch)
**Target files:** `apps/web/src/middleware.ts` (update), `apps/web/src/lib/auth/tenant-resolver.ts` (update), `apps/web/src/lib/auth/effective-membership.ts` (new), `apps/web/src/lib/auth/__tests__/effective-membership.test.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(auth): swap auth resolution to effective_memberships view [Phase 1J, Prompt 4]`

### Task

Update the auth middleware to resolve user access through the `effective_memberships` view instead of directly querying `tenant_memberships`.

1. **Create `effective-membership.ts`** — a server-side module that wraps `getEffectiveMembershipForTenant()` and provides:
   - `resolveUserAccess(userId: string, tenantId: string)` → returns `{ role, source, agencyTenantId } | null`
   - Role derivation: `source === 'direct'` → use `role` as-is. `source === 'agency'` → map `access_level` to equivalent role: `admin` → Admin-equivalent, `builder` → Manager-equivalent, `read_only` → Viewer-equivalent.
   - Return `null` for no access (triggers 404 per tenant isolation pattern — cross-tenant returns 404, never 403).

2. **Update `tenant-resolver.ts`** — replace the direct `tenant_memberships` query with `resolveUserAccess()`. The resolver's public interface should remain the same so downstream code is unaffected.

3. **Update `middleware.ts`** — ensure the Clerk session's active organization/tenant is resolved through the updated tenant resolver. No changes to route matching rules or Clerk middleware configuration.

4. **Handle the `source === 'agency'` case** — when a user accesses a tenant via agency delegation:
   - Include `agencyTenantId` in the middleware context so downstream code can distinguish agency vs. direct access.
   - Log agency access at info level: `{ msg: 'agency_access', userId, agencyTenantId, clientTenantId, accessLevel }`.

5. **Ensure backward compatibility** — existing Owner/Admin/Member direct access continues to work identically. No behavior changes for users without agency relationships.

6. **Write tests:**
   - Direct member access resolves correctly (unchanged behavior).
   - Agency member with `access_level: 'admin'` gets Admin-equivalent access.
   - Agency member with `access_level: 'builder'` gets Manager-equivalent access.
   - Agency member with `access_level: 'read_only'` gets Viewer-equivalent access.
   - Suspended agency relationship → no access (returns 404).
   - User with no membership → no access (returns 404).
   - User with both direct and agency access → direct membership takes precedence.

### Acceptance Criteria

- [ ] Auth middleware queries `effective_memberships` view, never `tenant_memberships` directly
- [ ] Direct member access works identically to before
- [ ] Agency member access resolves correct role from `access_level`
- [ ] `agencyTenantId` included in middleware context for agency access
- [ ] Agency access logged at info level
- [ ] Suspended relationships blocked
- [ ] No access returns 404 (not 403)
- [ ] Direct membership takes precedence over agency access for same tenant
- [ ] All existing auth tests still pass (no regressions)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Permission caching in Redis (built as part of tenant-switching in Prompt 6)
- Full field-level permission resolution (Phase 3A-iii)
- Agency-specific UI or banners (post-MVP)
- Role upgrade/downgrade flows for agency members (post-MVP)

---

## Prompt 5: Personal Tenant Auto-Provisioning

**Depends on:** Prompt 2 (users.personal_tenant_id column), Prompt 4 (auth middleware using effective_memberships)
**Load context:** `data-model.md` lines 33 (users table — personal_tenant_id description), `navigation.md` lines 50–57 (Display Rules — personal tenant hidden until workspace created, always listed first), `navigation.md` lines 105–124 (My Office Per-Tenant — personal vs org), `design-system.md` lines 112–121 (Shell Accent — personal tenant warm neutral)
**Target files:** `apps/web/src/app/api/webhooks/clerk/route.ts` (update), `apps/web/src/lib/auth/personal-tenant.ts` (new), `apps/web/src/lib/auth/__tests__/personal-tenant.test.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(auth): add personal tenant auto-provisioning on user.created webhook [Phase 1J, Prompt 5]`

### Task

Update the Clerk `user.created` webhook handler to auto-provision a personal tenant for every new user.

1. **Create `personal-tenant.ts`** — a module that handles personal tenant creation:
   - `provisionPersonalTenant(userId: string, userName: string)` → creates a new tenant row with:
     - `name`: `"{userName}'s Workspace"` (i18n key: `personal_tenant.default_name`).
     - `plan`: `'freelancer'` (default plan).
     - `settings.branding_accent_color`: Fixed warm neutral color (a muted neutral that is NOT one of the 8 curated org accent options — e.g., `#78716C` warm gray/stone-500). This color is **never available** in the org accent picker, ensuring personal tenants are always visually distinct.
   - Creates a `tenant_memberships` row with `role: 'owner'`, `status: 'active'`.
   - Updates `users.personal_tenant_id` to point to the newly created tenant.
   - Returns the personal tenant ID.

2. **Update the `user.created` webhook handler** — after existing user creation logic, call `provisionPersonalTenant()`. Wrap in a transaction to ensure atomicity.

3. **Handle idempotency** — if the webhook fires twice (Clerk retry), check if `users.personal_tenant_id` is already set. If yes, skip provisioning and return success.

4. **Personal tenant display rules** (implement data access, not UI):
   - Create `isPersonalTenant(tenantId: string, userId: string)` helper — checks if `tenantId === user.personal_tenant_id`.
   - Create `hasPersonalWorkspace(tenantId: string)` helper — checks if the personal tenant has at least one workspace. This will be used by the sidebar to decide whether to show the personal tenant in the tenant switcher.

5. **Write tests:**
   - New user creation provisions a personal tenant.
   - Personal tenant has warm neutral accent color (not one of the 8 org colors).
   - `users.personal_tenant_id` is set correctly.
   - Owner membership created for user in personal tenant.
   - Idempotent — second webhook call doesn't create duplicate.
   - `isPersonalTenant()` returns true for personal tenant, false for org tenant.
   - `hasPersonalWorkspace()` returns false for empty personal tenant, true after workspace creation.
   - `testTenantIsolation()` — personal tenant data isolated from org tenants.

### Acceptance Criteria

- [ ] Clerk `user.created` webhook provisions a personal tenant
- [ ] Personal tenant name uses i18n key (no hardcoded English)
- [ ] Personal tenant accent color is warm neutral, distinct from 8 org colors
- [ ] `users.personal_tenant_id` set in same transaction as tenant creation
- [ ] Owner membership auto-created
- [ ] Idempotent on webhook retry
- [ ] `isPersonalTenant()` and `hasPersonalWorkspace()` helpers work correctly
- [ ] `testTenantIsolation()` passes
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Personal tenant settings UI (Phase 3G-i Settings)
- My Office widget grid for personal tenant (Phase 3G-ii)
- Workspace creation flow inside personal tenant (Core UX)
- Personal tenant billing (personal tenant uses Freelancer plan, no separate billing)

---

## Prompt 6: Tenant Switching — Clerk + Redis Hybrid

**Depends on:** Prompt 4 (auth middleware with effective_memberships), Prompt 5 (personal tenant provisioning)
**Load context:** `navigation.md` lines 67–102 (Tenant Switcher — Clerk+Redis hybrid model, switching flow, what changes)
**Target files:** `apps/web/src/lib/auth/tenant-switch.ts` (new), `apps/web/src/actions/tenant-switch.ts` (new Server Action), `apps/web/src/lib/auth/__tests__/tenant-switch.test.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(auth): implement tenant switching with Clerk setActive + Redis cache [Phase 1J, Prompt 6]`

### Task

Implement the tenant switching mechanism using Clerk `setActive()` as the authoritative source with Redis as a fast-lookup cache.

1. **Create `tenant-switch.ts`** — the core switching module:
   - `switchTenant(userId: string, targetTenantId: string)` — orchestrates the switch:
     a. **Validate access:** Call `getEffectiveMembershipForTenant(userId, targetTenantId)`. If null, throw `NotFoundError` (404 — tenant isolation pattern).
     b. **Update Redis cache:** Set `active_tenant:{userId}` → `targetTenantId` with 24h TTL.
     c. Return `{ tenantId: targetTenantId, role, source, accentColor }` — the data the client needs for optimistic UI.
   - `getActiveTenant(userId: string)` — checks Redis first, falls back to Clerk session. On cache miss, populate Redis from Clerk.
   - `invalidateTenantCache(userId: string)` — clear Redis key. Called on permission changes, relationship revocation, etc.

2. **Create Server Action `switchTenantAction`** — wraps `switchTenant()` for client-side invocation:
   - Uses Clerk's `setActive()` (via `@clerk/nextjs`) to update the JWT with the new organization/tenant context. This is the authoritative step.
   - If Clerk `setActive()` fails, clear the Redis cache update and throw an error.
   - Returns the accent color and tenant metadata needed for optimistic shell repainting.
   - Writes audit log: `action: 'tenant_switched'`, actor_type: `'user'`.

3. **Define the `TenantSwitchResult` type:**
   ```typescript
   interface TenantSwitchResult {
     tenantId: string;
     tenantName: string;
     role: string; // effective role in target tenant
     source: 'direct' | 'agency';
     accentColor: string; // hex from tenants.settings.branding_accent_color
     agencyTenantId?: string; // only if source === 'agency'
   }
   ```

4. **Error handling:**
   - Target tenant doesn't exist or user has no access → 404.
   - Clerk `setActive()` fails → revert Redis, surface toast-compatible error: `"Unable to switch workspace. Please try again."` (i18n key).
   - Redis unavailable → fall back to Clerk-only (degraded but functional).

5. **Write tests:**
   - Successful switch updates Redis and returns correct data.
   - Switch to non-existent tenant returns 404.
   - Switch to tenant user has no access to returns 404.
   - Clerk failure reverts Redis update.
   - Redis failure degrades gracefully (Clerk-only).
   - `getActiveTenant()` returns cached value on hit.
   - `getActiveTenant()` populates cache on miss.
   - `invalidateTenantCache()` clears the Redis key.
   - Agency member switching to client tenant returns `source: 'agency'`.

### Acceptance Criteria

- [ ] `switchTenant()` validates access via `effective_memberships` before switching
- [ ] Redis cache updated with `active_tenant:{userId}` key
- [ ] Clerk `setActive()` called as authoritative source
- [ ] Clerk failure reverts Redis and returns error
- [ ] Redis failure degrades to Clerk-only (no crash)
- [ ] `getActiveTenant()` uses Redis-first, Clerk-fallback pattern
- [ ] `TenantSwitchResult` includes accent color for optimistic repainting
- [ ] Audit log entry written on successful switch
- [ ] All error messages use i18n keys
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Client-side optimistic UI components (Prompts 8–9)
- Shell repainting CSS (Prompt 7)
- Sidebar tenant list rendering (Prompt 8)
- Workspace navigation within a tenant (Prompt 8)

---

## Integration Checkpoint 2 (after Prompts 4–6)

**Task:** Verify auth middleware update, personal tenant provisioning, and tenant switching work together.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification:
   - Create a test user via factory → verify personal tenant provisioned with warm neutral accent
   - Verify `effective_memberships` view returns correct rows for direct + agency access
   - Verify `switchTenant()` updates Redis and returns correct accent color
   - Verify tenant-switching with an agency member resolves correct role

**Git:** Commit with message `chore(verify): integration checkpoint 2 — auth middleware + personal tenant + tenant switching [Phase 1J, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 7.

---

## Prompt 7: Shell Accent Tokens & Repainting

**Depends on:** Prompt 6 (tenant switching returns accent color)
**Load context:** `design-system.md` lines 112–141 (Shell Accent Token, Portal Accent Token, Agency Banner — token definitions and repainting rules), `navigation.md` lines 127–145 (Contextual Clarity — three mandatory signals, personal tenant visual identity)
**Target files:** `apps/web/src/app/globals.css` (update), `apps/web/src/lib/design-system/shell-accent.ts` (new), `apps/web/src/components/shell/ShellAccentProvider.tsx` (new), `apps/web/src/components/shell/__tests__/ShellAccentProvider.test.tsx` (new)
**Migration required:** No
**Git:** Commit with message `feat(ui): add shell accent tokens and repainting on tenant switch [Phase 1J, Prompt 7]`

### Task

Implement the per-tenant shell accent color system with CSS custom properties and tenant-switch repainting.

1. **Update `globals.css`** — add the `--shell-accent` and `--portal-accent` CSS custom properties:
   ```css
   :root {
     --shell-accent: #0D9488; /* default: Teal — overridden per tenant */
     --portal-accent: #64748B; /* system-owned, non-customisable — Slate 500 */
     --personal-accent: #78716C; /* warm neutral for personal tenant */
   }
   ```
   - `--shell-accent` is set per tenant from `tenants.settings.branding_accent_color`.
   - `--portal-accent` is fixed, system-owned. Portal entries in the sidebar use this color. Cannot be customized by any tenant.
   - `--personal-accent` is the fixed warm neutral for personal tenants — never matches any of the 8 curated org accent options.

2. **Create `shell-accent.ts`** — utility module:
   - `PERSONAL_TENANT_ACCENT = '#78716C'` — warm neutral (stone-500).
   - `PORTAL_ACCENT = '#64748B'` — system-owned slate.
   - `ORG_ACCENT_OPTIONS` — the 8 curated accent colors from `design-system.md` (Teal, Ocean Blue, Indigo, Deep Purple, Rose, Amber, Forest, Slate). Used for validation and ensuring personal accent never overlaps.
   - `getShellAccent(tenantId: string, isPersonalTenant: boolean, accentColor?: string)` — returns `PERSONAL_TENANT_ACCENT` if personal tenant, otherwise returns the tenant's `branding_accent_color` or default Teal.
   - `isValidAccentColor(hex: string)` — validates against the 8 curated options.

3. **Create `ShellAccentProvider.tsx`** — a React context provider that:
   - Stores the current `--shell-accent` value in state.
   - Updates the CSS custom property on `:root` when the accent changes.
   - Exposes `setShellAccent(color: string)` for optimistic repainting on tenant switch.
   - Exposes `revertShellAccent()` for reverting on Clerk failure.
   - CSS transition: `transition: background-color 150ms ease-in-out` on the header for smooth repainting.
   - Wraps the application layout.

4. **Update the header component** — the header bar should use `background-color: var(--shell-accent)` instead of any hardcoded accent color. Ensure white text/icons maintain ≥4.5:1 contrast (all 8 curated colors + personal neutral + default Teal pass this — precomputed, no runtime check needed).

5. **Write tests:**
   - Personal tenant gets warm neutral accent.
   - Org tenant gets its configured accent color.
   - Missing accent color defaults to Teal.
   - `setShellAccent()` updates `:root` CSS property.
   - `revertShellAccent()` restores previous value.
   - All 8 org accent colors + personal accent pass contrast validation.
   - Portal accent is fixed and not affected by tenant switching.

### Acceptance Criteria

- [ ] `--shell-accent` CSS custom property set on `:root`
- [ ] `--portal-accent` CSS custom property set and non-customisable
- [ ] `--personal-accent` is warm neutral, never matches any org accent
- [ ] Header uses `var(--shell-accent)` for background
- [ ] `ShellAccentProvider` supports optimistic set and revert
- [ ] CSS transition on header for smooth repainting
- [ ] White text on all accent colors passes ≥4.5:1 contrast
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Full tenant settings UI for choosing accent color (Phase 3G-i Settings)
- Agency banner rendering (post-MVP)
- Portal theming or portal accent customization (post-MVP)
- Dark mode or light mode toggles (never — hybrid layout only)

---

## Prompt 8: Sidebar Navigation Tree — Data Layer & Layout

**Depends on:** Prompt 4 (auth middleware with effective_memberships), Prompt 7 (shell accent provider)
**Load context:** `navigation.md` lines 25–73 (Sidebar Navigation Tree — tree structure, display rules, workspace nesting), `design-system.md` lines 49–57 (Foundations — sidebar dimensions, icon rail order), `design-system.md` lines 232–236 (Sidebar Nav component spec)
**Target files:** `apps/web/src/data/sidebar-navigation.ts` (new), `apps/web/src/components/shell/SidebarNav.tsx` (new or update), `apps/web/src/components/shell/TenantSection.tsx` (new), `apps/web/src/components/shell/WorkspaceTree.tsx` (new), `apps/web/src/data/__tests__/sidebar-navigation.test.ts` (new)
**Migration required:** No
**Git:** Commit with message `feat(ui): build sidebar navigation tree with multi-tenant sections [Phase 1J, Prompt 8]`

### Task

Build the data layer and layout for the multi-tenant sidebar navigation tree.

1. **Create `sidebar-navigation.ts`** — server-side data fetcher:
   - `getSidebarNavigation(userId: string)` → returns the full navigation tree:
     ```typescript
     interface SidebarNavigation {
       tenants: TenantNavSection[];
       portals: PortalNavEntry[];
     }

     interface TenantNavSection {
       tenantId: string;
       tenantName: string;
       accentColor: string;
       isPersonalTenant: boolean;
       isActive: boolean; // currently selected tenant
       workspaces: WorkspaceNavEntry[];
       boards: BoardNavGroup[];
     }

     interface BoardNavGroup {
       boardId: string;
       boardName: string;
       workspaces: WorkspaceNavEntry[];
     }

     interface WorkspaceNavEntry {
       workspaceId: string;
       workspaceName: string;
       icon?: string;
     }

     interface PortalNavEntry {
       portalId: string;
       portalName: string;
       tenantSlug: string;
       portalSlug: string;
     }
     ```
   - Query `effective_memberships` to get all tenants the user has access to.
   - For each tenant, query workspaces the user can access (Owner/Admin see all, Members see their workspace_memberships).
   - Group workspaces by board (if `board_id` is set) or list flat.
   - Query `portal_access` for the user's email to get portal entries (non-revoked only — `revoked_at IS NULL`).
   - **Personal tenant always listed first**, regardless of alphabetical order.
   - **Personal tenant hidden** in the tenant switcher until it has at least one workspace (use `hasPersonalWorkspace()` from Prompt 5).

2. **Write `testTenantIsolation()`** test for `getSidebarNavigation()` — user in Tenant A should not see Tenant B's workspaces.

3. **Create `TenantSection.tsx`** — renders one tenant section in the sidebar:
   - Collapsed state: tenant header only (logo/avatar + name). One click expands.
   - Expanded state: "My Office" entry (first item), then workspace tree.
   - Active tenant is expanded by default, others collapsed.
   - Tenant header shows accent color indicator (small dot or badge).

4. **Create `WorkspaceTree.tsx`** — renders workspaces within a tenant section:
   - Board grouping: workspaces nested under board headings (collapsible).
   - Ungrouped workspaces listed flat after board groups.
   - Each workspace entry is a navigation link.

5. **Update `SidebarNav.tsx`** (or create if doesn't exist):
   - Renders the icon rail (48px collapsed / 280px expanded).
   - Icon rail order (top to bottom): My Office, Tasks, Chat, Calendar, Expand/Collapse, Help, Avatar.
   - Expanded state renders tenant sections from `getSidebarNavigation()`.
   - Uses `sidebarBg`, `sidebarBgHover`, `sidebarText`, `sidebarTextMuted`, `sidebarActive` tokens.
   - Sidebar toggle (expand/collapse) persists preference.

6. **Loading state** — skeleton screens matching sidebar layout shape (not spinners). Use loading skeleton for tenant sections while data fetches.

### Acceptance Criteria

- [ ] `getSidebarNavigation()` returns correct tree for multi-tenant users
- [ ] Personal tenant listed first, hidden if no workspaces
- [ ] Workspaces grouped by board where applicable
- [ ] Portal entries returned from `portal_access` (non-revoked only)
- [ ] `testTenantIsolation()` passes for `getSidebarNavigation()`
- [ ] `TenantSection` renders collapsed/expanded states
- [ ] Active tenant expanded by default
- [ ] `WorkspaceTree` renders board grouping and flat workspaces
- [ ] Sidebar icon rail with correct icon order
- [ ] Sidebar expand/collapse toggle works with persisted preference
- [ ] Skeleton loading states (not spinners)
- [ ] All user-facing strings use i18n
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Quick Panel content (Tasks, Chat, Calendar — Phase 3C, 3G-ii)
- Command Bar (Phase 3B-ii)
- My Office widget grid (Phase 3G-ii — entry point only)
- Help Panel (support-system — future phase)
- Workspace creation UI within sidebar (Core UX)
- Mobile hamburger drawer navigation (Phase 3H)
- Table or Table View items within workspace (Core UX — workspaces are leaf nodes in this phase)

---

## Prompt 9: Sidebar Tenant Switching UX & Portal Display

**Depends on:** Prompt 6 (tenant switching Server Action), Prompt 8 (sidebar navigation tree)
**Load context:** `navigation.md` lines 85–102 (Switching Flow — optimistic UI, what changes), `navigation.md` lines 147–168 (Portal Display in Sidebar — visual distinction rules, data boundary enforcement, when portals appear)
**Target files:** `apps/web/src/components/shell/TenantSwitcher.tsx` (new), `apps/web/src/components/shell/PortalSection.tsx` (new), `apps/web/src/components/shell/__tests__/TenantSwitcher.test.tsx` (new), `apps/web/src/components/shell/__tests__/PortalSection.test.tsx` (new)
**Migration required:** No
**Git:** Commit with message `feat(ui): implement tenant switching UX and portal display in sidebar [Phase 1J, Prompt 9]`

### Task

Build the interactive tenant switching UX and portal section in the sidebar.

1. **Create `TenantSwitcher.tsx`** — handles the tenant switching interaction:
   - When user clicks a collapsed tenant header in the sidebar:
     a. **Optimistic UI:** Immediately repaint shell — update `--shell-accent`, expand target tenant section, collapse previous.
     b. **Call `switchTenantAction()`** (Server Action from Prompt 6).
     c. **On success:** Update My Office heading, navigate to target tenant's last-accessed workspace, update breadcrumbs.
     d. **On failure:** Revert shell accent to previous value (via `revertShellAccent()`), re-expand previous tenant, show toast: "Unable to switch workspace. Please try again." (i18n key).
   - Track the currently active tenant in client state (Zustand store or context).

2. **What changes on tenant switch** (per navigation.md):
   - Header accent colour → repaint to target tenant's `--shell-accent`.
   - Sidebar active state → target tenant expands, previous collapses.
   - My Office heading → updates to "My Office · [Tenant Name]" (or "My Office · Personal" for personal tenant).
   - Content area → navigate to target tenant's last-accessed workspace (or default workspace if first visit).
   - Breadcrumbs → reset to target tenant context.

3. **Create `PortalSection.tsx`** — renders portal entries below a visual divider:
   - Section divider labeled "Portals" separates portal entries from tenant sections.
   - Divider hidden when no portal entries exist.
   - Each portal entry uses:
     - **Portal-specific icon** — a distinct icon NOT shared with tenant or workspace icon families (e.g., `ExternalLink` or `Globe` icon).
     - **Portal accent color** — uses `--portal-accent` (system-owned, non-customisable). The granting tenant cannot influence this color.
   - Portal entry click navigates to the portal URL — does NOT trigger shell repainting (reserved for tenant switching).
   - A persistent but subdued portal indicator in the sidebar header shows portal name and icon when inside a portal context.

4. **Portal data boundary enforcement:**
   - Portal is a display convenience, not a data bridge.
   - No cross-linking from portal context into user's own workspaces.
   - Portal rendering in sidebar uses the same auth/data scoping as the standalone portal URL.

5. **Write component tests:**
   - Clicking collapsed tenant triggers optimistic repainting.
   - Successful switch updates sidebar state.
   - Failed switch reverts accent and shows error toast.
   - Portal section hidden when no portal entries.
   - Portal entries use portal accent color (not tenant accent).
   - Portal click does not trigger shell repainting.

### Acceptance Criteria

- [ ] Clicking tenant header triggers optimistic shell repainting
- [ ] Successful switch updates accent, sidebar, My Office heading, and breadcrumbs
- [ ] Failed switch reverts optimistically applied changes and shows toast
- [ ] Toast uses i18n key for error message
- [ ] Portal section divider visible only when portals exist
- [ ] Portal entries use `--portal-accent` color and dedicated icon
- [ ] Portal click navigates without shell repainting
- [ ] Data boundary enforcement — no cross-linking from portal context
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Portal client auth or rendering (Phase 3E-i)
- Portal content display within the main panel (Phase 3E-i)
- Workspace navigation within tenant (Core UX — table/view navigation)
- Agency-specific banner when in client tenant (post-MVP)
- Portal settings or management (Phase 3E-i)

---

## Prompt 10: Contextual Clarity Signals & Final Polish

**Depends on:** Prompt 7 (shell accent), Prompt 9 (tenant switching UX)
**Load context:** `navigation.md` lines 127–145 (Contextual Clarity — three mandatory signals, why three, personal tenant visual identity)
**Target files:** `apps/web/src/components/shell/SidebarHeader.tsx` (new or update), `apps/web/src/components/shell/MyOfficeHeading.tsx` (new), `apps/web/src/components/shell/__tests__/contextual-clarity.test.tsx` (new)
**Migration required:** No
**Git:** Commit with message `feat(ui): implement three-signal contextual clarity system [Phase 1J, Prompt 10]`

### Task

Implement the three mandatory contextual clarity signals so users can determine their current context within one second.

1. **Three mandatory signals** — all must be simultaneously present:

   | Signal | Personal Tenant | Org / Agency Tenant |
   |--------|-----------------|---------------------|
   | **Sidebar header** | User avatar + "{User}'s Workspace" | Org logo + org name, always visible |
   | **Shell colour** | Fixed warm neutral (`--personal-accent`) | Per-tenant accent via `--shell-accent` |
   | **My Office heading** | "My Office · Personal" | "My Office · [Tenant Name]" |

2. **Create/update `SidebarHeader.tsx`:**
   - Always visible at the top of the sidebar (both collapsed and expanded states).
   - Personal tenant: shows user avatar + user name with "Personal" qualifier.
   - Org tenant: shows org logo (if available, fallback to first-letter avatar) + org name.
   - The header is persistent — remains visible during scroll within the sidebar.

3. **Create `MyOfficeHeading.tsx`:**
   - Renders "My Office · Personal" for personal tenant (i18n key: `my_office.heading_personal`).
   - Renders "My Office · [Tenant Name]" for org tenants (i18n key: `my_office.heading_org`, with tenant name interpolation).
   - When an agency member is in a client tenant, renders "My Office · [Client Tenant Name]" (the agency banner — post-MVP — will provide additional context).
   - Updates dynamically on tenant switch.

4. **Personal tenant visual identity:**
   - Warm neutral accent (`--personal-accent: #78716C`) is never available in the 8 curated org accent options.
   - This provides an immediate visual signal that the user is in personal context.
   - Verify: the personal accent color is excluded from the accent color picker options.

5. **Why three signals** — any single signal can be missed (user not looking at header, color-blind user, My Office not visible). Three simultaneous signals — visual position, color, text — ensure at least two are always perceivable. This is documented for accessibility reasoning.

6. **Write tests:**
   - Personal tenant shows all three signals correctly.
   - Org tenant shows all three signals correctly.
   - Tenant switch updates all three signals.
   - Personal accent color is NOT in org accent options.
   - My Office heading uses i18n keys.
   - Sidebar header remains visible when scrolling.

### Acceptance Criteria

- [ ] All three contextual clarity signals render simultaneously
- [ ] Personal tenant: avatar + name, warm neutral accent, "My Office · Personal"
- [ ] Org tenant: logo + name, tenant accent, "My Office · [Tenant Name]"
- [ ] Tenant switch updates all three signals in sync
- [ ] Personal accent excluded from org accent picker
- [ ] My Office headings use i18n keys with correct interpolation
- [ ] Sidebar header visible in both collapsed and expanded sidebar states
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Agency member banner inside client tenant (post-MVP)
- Accessibility audit for colour-blind-only mode (covered by three-signal design — no separate mode needed)
- My Office widget grid content (Phase 3G-ii)
- Settings page for changing tenant name or logo (Phase 3G-i)

---

## Integration Checkpoint 3 — Final (after Prompts 7–10)

**Task:** Verify all UI work integrates correctly and the full Phase 1J deliverable is complete.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. If migrations were added: `pnpm turbo db:migrate:check` — no lock violations
7. Manual verification:
   - Sidebar renders multi-tenant navigation tree with personal tenant first
   - Clicking a tenant triggers optimistic accent repainting
   - My Office heading updates with tenant name
   - Three contextual clarity signals visible simultaneously
   - Portal section appears when user has portal access (hidden otherwise)
   - Portal entries use system-owned accent color
   - Shell accent smoothly transitions on tenant switch (150ms CSS transition)
   - Collapsed sidebar shows icon rail with correct icon order
   - Expanded sidebar shows full workspace tree

**Git:** Commit with message `chore(verify): integration checkpoint 3 (final) — shell accent, sidebar tree, contextual clarity [Phase 1J, CP-3]`, then push branch to origin. Open PR to main with title "Phase 1J — CP Migration, Multi-Tenant Auth & Navigation Shell".

---

## Phase Complete — Summary

After merging Phase 1J, the EveryStack foundation is fully complete:

- **52 tables + 1 view** — all MVP schema in place.
- **Auth middleware** resolves access through `effective_memberships` — ready for both direct and agency access patterns.
- **Personal tenants** auto-provisioned for every user.
- **Multi-tenant sidebar** — users see all their tenants, workspaces, and portal entries in a collapsible tree.
- **Tenant switching** — optimistic shell repainting with Clerk + Redis hybrid.
- **Three-signal contextual clarity** — users always know where they are.

**What's next:** Phase 2 (MVP — Sync) builds the sync engine on this foundation, followed by Phase 3 (MVP — Core UX) which renders actual workspace content inside the navigation shell.
