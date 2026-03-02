# Phase 1C — Authentication, Tenant Isolation, Workspace Roles

## Phase Context

### What Has Been Built

**Phase 1A (Monorepo, CI Pipeline, Dev Environment) — merged to main:**

- Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds
- Docker Compose with PostgreSQL 16, PgBouncer, Redis
- GitHub Actions CI (lint → typecheck → test)
- ESLint + Prettier config, `tsconfig` strict mode, `.env.example`

**Phase 1B (Database Schema, Connection Pooling, Tenant Routing) — merged to main:**

- Drizzle schema for all 50 MVP tables (Tiers 0–7) in `packages/shared/db/schema/`
- PgBouncer connection pooling config (transaction mode)
- `getDbForTenant()` with read/write intent routing (`dbRead` + `db`)
- RLS policies enforcing tenant isolation on all tenant-scoped tables
- UUIDv7 primary key generation utility (no `serial`)
- Initial migration files in `packages/shared/db/migrations/`

**Key tables that now exist (relevant to this sub-phase):**

- `users`: id (UUIDv7 PK), clerk_id, email, name
- `tenants`: id (UUIDv7 PK), name, slug, plan
- `tenant_memberships`: id, tenant_id, user_id, role (`owner` | `admin` | `member`), status (`active` | `invited` | `suspended`)
- `workspace_memberships`: user_id + workspace_id (composite PK), tenant_id, role (`manager` | `team_member` | `viewer`)
- `workspaces`: id, tenant_id, board_id (nullable), name, slug

### What This Phase Delivers

When complete, EveryStack has a working authentication layer: users can sign up via Clerk, the system creates their tenant and membership records via webhooks, every request is authenticated with a resolved `userId` and `tenantId`, workspace role checks protect management operations, and cross-tenant access attempts return 404 (never 403). This is the identity foundation that every subsequent feature depends on.

### What This Phase Does NOT Build

- Full field-level permission model with `views.permissions` JSONB (Core UX — Phase 3A-iii)
- Table View–based access control and permission resolution algorithm (Core UX — Phase 3A-iii)
- Permission configuration UI (Core UX — Phase 3A-iii)
- Permission caching in Redis (Core UX — Phase 3A-iii)
- Portal client authentication (magic link / password) — uses a separate system, not Clerk (Core UX — Phase 3E-i)
- Signup/onboarding wizard UI (Core UX)
- Team member invitation flow UI (Core UX)
- Board membership and board-level permission convenience (Core UX)
- Any UI components — this sub-phase is backend-only infrastructure

### Architecture Patterns for This Phase

1. **Clerk is the auth provider.** EveryStack does NOT implement custom auth for workspace users. Clerk components handle signup/login UI. Clerk middleware handles session validation. The `userId` from Clerk's session is the identity anchor for all platform operations.

2. **Tenant ID comes from the server, never the client.** `getTenantId()` reads from the Clerk session's organization context. Client-supplied tenant IDs are ignored for data access. Workspace ID from the URL is used for navigation only.

3. **Two-layer role model.** Check `tenant_memberships.role` first: Owner/Admin → full access to all workspaces, bypass workspace scoping. Member → fall through to `workspace_memberships.role` for per-workspace role. This is a flat hierarchy presented as five roles in the UI.

4. **Cross-tenant = 404.** RLS already enforces isolation at the DB level (built in 1B). When a query returns zero rows due to RLS, the response is 404 Not Found — never 403 Forbidden. This prevents enumeration attacks.

5. **All queries use `getDbForTenant()`** (built in 1B). This sub-phase adds the auth context that feeds `tenantId` into that function.

6. **CockroachDB safeguards remain active** (UUIDv7, no PG-specific syntax, no advisory locks, explicit transaction boundaries, hash partitioning compatible).

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.
Phase division files are not needed during build execution — their content has been pre-digested into this playbook.

---

## Section Index

| Prompt | Deliverable                                                 | Depends On | Lines (est.) |
| ------ | ----------------------------------------------------------- | ---------- | ------------ |
| 1      | Clerk Middleware & Auth Session Context                     | None       | ~180         |
| 2      | Tenant Resolver & Data Access Context                       | 1          | ~160         |
| 3      | Clerk Webhook Handlers (user.created, organization.created) | 1, 2       | ~200         |
| 4      | Workspace Role Hierarchy & Permission Check Utilities       | 2          | ~180         |
| CP-1   | Integration Checkpoint 1 (final)                            | 1–4        | —            |

---

## Prompt 1: Clerk Middleware & Auth Session Context

**Depends on:** None (first prompt in this sub-phase; requires Phase 1A + 1B complete)
**Load context:** `permissions.md` lines 452–464 (Tenant Isolation), `CLAUDE.md` lines 158–194 (Platform Authentication & Onboarding — Clerk, Session Handling)
**Target files:** `apps/web/src/middleware.ts`, `apps/web/src/lib/auth.ts`
**Migration required:** No
**Git:** Create and checkout branch `feat/phase-1c-auth-roles` from `main`. Commit with message `feat(auth): add Clerk middleware and auth session context [Phase 1C, Prompt 1]`

### Schema Snapshot

N/A — no schema changes. Reads from existing tables:

```
users: id (UUIDv7 PK), clerk_id, email, name
tenants: id (UUIDv7 PK), name, slug, plan
tenant_memberships: id, tenant_id, user_id, role, status
```

### Task

**1. Create Clerk middleware (`apps/web/src/middleware.ts`):**

Install `@clerk/nextjs` (add to `apps/web/package.json`). Configure Clerk middleware that protects all routes with the following exceptions:

- **Public routes** (unauthenticated access allowed): `/`, `/sign-in(.*)`, `/sign-up(.*)`, `/api/webhooks/(.*)`, `/portal/(.*)`
- **Webhook routes**: `/api/webhooks/clerk`, `/api/webhooks/stripe` (future) — must be accessible without auth
- **Portal routes**: `/portal/(.*)` — these use their own auth system (built in Phase 3E-i), excluded from Clerk entirely

Use Clerk's `clerkMiddleware()` with `createRouteMatcher()` for the public route patterns. All other routes (`/app/(.*)`, `/api/v1/(.*)`, etc.) require a valid Clerk session.

**2. Create auth session helper (`apps/web/src/lib/auth.ts`):**

Export an `auth()` async function that wraps Clerk's `auth()` from `@clerk/nextjs/server` and returns a typed context object:

```typescript
interface AuthContext {
  userId: string; // Clerk user ID (from session)
  clerkOrgId: string | null; // Clerk organization ID (from session, if set)
}
```

Export a `requireAuth()` async function that calls `auth()` and throws a redirect to `/sign-in` if no valid session exists. This is the function Server Actions and data queries will call to get the authenticated user.

**Important:** These helpers extract Clerk-level IDs only. The mapping from Clerk IDs to internal EveryStack UUIDs happens in the tenant resolver (Prompt 2). This separation keeps Clerk-specific code isolated.

### Acceptance Criteria

- [ ] Clerk middleware runs on all requests; unauthenticated users on protected routes are redirected to `/sign-in`
- [ ] Public routes (`/`, `/sign-in`, `/sign-up`) are accessible without authentication
- [ ] Webhook routes (`/api/webhooks/*`) are accessible without Clerk session validation
- [ ] Portal routes (`/portal/*`) are excluded from Clerk middleware entirely
- [ ] `requireAuth()` returns `AuthContext` with `userId` for authenticated requests
- [ ] `requireAuth()` throws redirect for unauthenticated requests on protected routes
- [ ] TypeScript compiles with zero errors; ESLint passes

### Do NOT Build

- Login/signup UI components (Clerk provides these as pre-built components)
- Custom session token management (Clerk handles JWT refresh)
- Portal authentication system (Phase 3E-i)
- Any data access or database queries in this prompt — only session extraction
- OAuth flow handlers for external platforms (Airtable/Notion/SmartSuite — Phase 2)

---

## Prompt 2: Tenant Resolver & Data Access Context

**Depends on:** Prompt 1 (auth session context)
**Load context:** `permissions.md` lines 452–464 (Tenant Isolation), lines 59–86 (Workspace Roles — for role resolution flow understanding)
**Target files:** `apps/web/src/lib/tenant-resolver.ts`, `apps/web/src/lib/auth-context.ts`
**Migration required:** No
**Git:** Commit with message `feat(auth): add tenant resolver and data access context [Phase 1C, Prompt 2]`

### Schema Snapshot

Reads from existing tables (from data-model.md, created in Phase 1B):

```
users: id (UUIDv7 PK), clerk_id, email, name
tenants: id (UUIDv7 PK), name, slug, plan
tenant_memberships: id, tenant_id, user_id, role (owner|admin|member), status (active|invited|suspended)
workspace_memberships: user_id + workspace_id (composite PK), tenant_id, role (manager|team_member|viewer)
workspaces: id, tenant_id, board_id (nullable), name, slug
```

### Task

**1. Create tenant resolver (`apps/web/src/lib/tenant-resolver.ts`):**

This module maps Clerk-level identifiers to internal EveryStack UUIDs. Export the following functions:

`resolveUser(clerkUserId: string): Promise<{ id: string; tenantIds: string[] }>` — Looks up the `users` table by `clerk_id`, returns the internal user UUID and a list of tenant IDs the user belongs to (from `tenant_memberships` where `status = 'active'`). Throws `NotFoundError` if no matching user. Uses `getDbForTenant()` — but note: user lookup is a cross-tenant operation (users can belong to multiple tenants), so use the admin/system database connection, not a tenant-scoped one. Clarify in the implementation which connection pool handles this.

`resolveTenant(userId: string, clerkOrgId: string | null): Promise<string>` — Given an internal user ID and an optional Clerk org ID, resolves the active tenant ID. If `clerkOrgId` is provided, look up the tenant whose Clerk org maps to that ID. If null, use the user's first active tenant membership (single-tenant users). Throws `NotFoundError` if no valid tenant found.

**2. Create data access context (`apps/web/src/lib/auth-context.ts`):**

Export a `getAuthContext()` async function that composes Prompt 1's `requireAuth()` with the tenant resolver to produce a fully resolved context:

```typescript
interface ResolvedAuthContext {
  userId: string; // Internal EveryStack user UUID
  tenantId: string; // Internal EveryStack tenant UUID
  clerkUserId: string; // Original Clerk user ID (for Clerk API calls only)
}
```

This is the primary context object that all Server Actions and data access functions will use. It guarantees:

- `userId` is the internal UUID (not the Clerk ID)
- `tenantId` is resolved from the server-side session (never from client input)
- The user has an active membership in this tenant

**3. Cross-tenant protection pattern:**

Document and enforce in the resolver: if a user attempts to access a tenant they don't belong to (no active `tenant_memberships` row), return 404 — not 403. The user should not be able to determine whether a tenant exists. This aligns with the RLS behavior at the database level.

### Acceptance Criteria

- [ ] `resolveUser()` correctly maps a Clerk user ID to internal EveryStack user UUID
- [ ] `resolveUser()` returns all active tenant IDs for the user
- [ ] `resolveUser()` throws `NotFoundError` for unknown Clerk user IDs
- [ ] `resolveTenant()` resolves the correct tenant given a Clerk org ID
- [ ] `resolveTenant()` falls back to the user's single active tenant when no org ID is provided
- [ ] `getAuthContext()` returns a fully resolved `ResolvedAuthContext` with internal UUIDs
- [ ] Cross-tenant access attempt (user not a member of the tenant) returns 404, not 403
- [ ] `tenantId` is never derived from URL parameters, query strings, or client-supplied headers
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Multi-tenant switching UI (Core UX)
- Workspace picker or workspace switching logic (Core UX)
- Caching of resolved auth context in Redis (premature — profile first)
- Portal tenant resolution (uses a separate `portal_access`-based path — Phase 3E-i)
- Board-level membership resolution (Core UX)

---

## Prompt 3: Clerk Webhook Handlers (user.created, organization.created)

**Depends on:** Prompt 1 (middleware excludes webhook routes), Prompt 2 (tenant resolver for ID mapping)
**Load context:** `CLAUDE.md` lines 158–194 (Platform Authentication & Onboarding — Signup Flow, Invitation Flow)
**Target files:** `apps/web/src/app/api/webhooks/clerk/route.ts`, `packages/shared/db/operations/user-operations.ts`
**Migration required:** No
**Git:** Commit with message `feat(auth): add Clerk webhook handlers for user and org creation [Phase 1C, Prompt 3]`

### Schema Snapshot

Writes to existing tables (created in Phase 1B):

```
users: id (UUIDv7 PK), clerk_id, email, name
tenants: id (UUIDv7 PK), name, slug, plan (default: 'freelancer')
tenant_memberships: id (UUIDv7 PK), tenant_id, user_id, role (owner|admin|member), status (active|invited|suspended)
workspaces: id (UUIDv7 PK), tenant_id, board_id (nullable), name, slug
workspace_memberships: user_id + workspace_id (composite PK), tenant_id, role (manager|team_member|viewer)
```

### Task

**1. Create the Clerk webhook route handler (`apps/web/src/app/api/webhooks/clerk/route.ts`):**

This is a Next.js Route Handler (App Router) that receives Clerk webhook events. Install `svix` for webhook signature verification.

**Webhook verification:** Every incoming request must be verified using the Svix webhook secret (`CLERK_WEBHOOK_SECRET` env var). Unverified requests return 400. This prevents spoofed webhook calls.

**Handle `user.created` event:**

When a new user signs up via Clerk:

1. Create a `users` row: generate UUIDv7 `id`, set `clerk_id` from the event payload, extract `email` and `name` (from `first_name` + `last_name` or email prefix as fallback).
2. Create a `tenants` row: generate UUIDv7 `id`, set `name` to "{user's name}'s Workspace" (or similar default), generate a unique `slug`, set `plan` to `'freelancer'` (default tier).
3. Create a `tenant_memberships` row: link the new user to the new tenant with `role: 'owner'` and `status: 'active'`.
4. Create a default `workspaces` row: generate UUIDv7 `id`, set `tenant_id`, `name` to "My Workspace" (default), generate a unique `slug`.
5. Create a `workspace_memberships` row: link the user to the default workspace with `role: 'manager'`.

All five inserts must happen in a single database transaction. If any insert fails, the entire operation rolls back and the webhook returns 500 (Clerk will retry).

**Handle `organization.created` event (if applicable):**

If Clerk organizations are used to model tenants, handle the `organization.created` event similarly — create the tenant and link the creating user. If Clerk organizations are NOT used (and tenants are managed entirely on EveryStack's side), document this decision clearly and skip the handler.

**Handle `user.updated` event:**

Update the `users` row when a user changes their email or name in Clerk. Match by `clerk_id`, update `email` and `name` fields.

**2. Create user operations module (`packages/shared/db/operations/user-operations.ts`):**

Extract the database operations into a shared module (not inline in the route handler) so they can be reused by the invitation flow (Core UX) and tested independently:

- `createUserWithTenant(clerkId, email, name): Promise<{ userId, tenantId, workspaceId }>`
- `updateUserFromClerk(clerkId, updates: { email?, name? }): Promise<void>`

Use UUIDv7 generation from the utility built in Phase 1B. Use `getDbForTenant()` (or the system-level connection for cross-tenant writes). All operations must be tenant-isolated via RLS once the tenant row exists.

**3. Add `CLERK_WEBHOOK_SECRET` to `.env.example`.**

### Acceptance Criteria

- [ ] Webhook endpoint verifies Svix signature; returns 400 for invalid signatures
- [ ] `user.created` event creates `users`, `tenants`, `tenant_memberships`, `workspaces`, and `workspace_memberships` rows in a single transaction
- [ ] New tenant gets `plan: 'freelancer'` by default
- [ ] New tenant membership gets `role: 'owner'` and `status: 'active'`
- [ ] New workspace membership gets `role: 'manager'`
- [ ] All new rows use UUIDv7 primary keys (no serial/auto-increment)
- [ ] Transaction rolls back entirely if any insert fails — no partial state
- [ ] `user.updated` event updates `email` and `name` on the matching `users` row
- [ ] Unrecognized event types return 200 (acknowledge but no-op — don't block Clerk)
- [ ] `createUserWithTenant()` is independently testable via unit tests with test factories
- [ ] `CLERK_WEBHOOK_SECRET` is in `.env.example`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Onboarding wizard UI (the 3-step flow described in CLAUDE.md — Core UX)
- Team member invitation email sending (Core UX)
- Pending membership resolution on signup (Core UX)
- Stripe/billing webhook handling (future)
- Organization invitation webhooks (Core UX)
- Workspace creation UI (Core UX)

---

## Prompt 4: Workspace Role Hierarchy & Permission Check Utilities

**Depends on:** Prompt 2 (tenant resolver for `ResolvedAuthContext`)
**Load context:** `permissions.md` lines 43–86 (Core Principles + Workspace Roles), lines 409–448 (Permission Denial Behavior — error shape, UI behavior), lines 468–475 (Phase Implementation — Foundation scope)
**Target files:** `packages/shared/auth/roles.ts`, `packages/shared/auth/errors.ts`, `packages/shared/auth/check-role.ts`
**Migration required:** No
**Git:** Commit with message `feat(auth): add workspace role hierarchy and permission check utilities [Phase 1C, Prompt 4]`

### Schema Snapshot

Reads from existing tables (created in Phase 1B):

```
tenant_memberships: id, tenant_id, user_id, role (owner|admin|member), status
workspace_memberships: user_id + workspace_id (composite PK), tenant_id, role (manager|team_member|viewer)
```

### Task

**1. Define role constants and types (`packages/shared/auth/roles.ts`):**

Define the five-role hierarchy as TypeScript types and constants:

```typescript
// Tenant-level roles
const TENANT_ROLES = ['owner', 'admin', 'member'] as const;
type TenantRole = (typeof TENANT_ROLES)[number];

// Workspace-level roles (for tenant members with role 'member')
const WORKSPACE_ROLES = ['manager', 'team_member', 'viewer'] as const;
type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

// Combined role type for the flat five-role hierarchy
type EffectiveRole = 'owner' | 'admin' | 'manager' | 'team_member' | 'viewer';
```

Define a `ROLE_HIERARCHY` constant that establishes the ordering: `owner > admin > manager > team_member > viewer`. This is used by `checkRole()` to determine if a user meets a minimum role requirement.

Export a `roleAtLeast(userRole: EffectiveRole, requiredRole: EffectiveRole): boolean` function that returns `true` if the user's role is equal to or higher than the required role in the hierarchy.

**2. Create `PermissionDeniedError` (`packages/shared/auth/errors.ts`):**

Implement the error interface exactly as specified in `permissions.md`:

```typescript
class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED' as const;
  readonly httpStatus = 403;
  readonly details: {
    action: string; // 'read' | 'edit' | 'delete' | 'manage' | 'create'
    resource: string; // 'workspace' | 'table' | 'view' | 'field' | 'record' | 'automation'
    resourceId?: string;
    requiredRole?: string; // Minimum role needed
  };
}
```

This error class must:

- Extend `Error` with a human-readable `message`
- Include the structured `details` object for audit logging
- Match the `AppError` pattern from CLAUDE.md (code, message, details)
- Be catchable by the global error boundary (which will return HTTP 403 for API surfaces)

**3. Create role check utilities (`packages/shared/auth/check-role.ts`):**

`resolveEffectiveRole(userId: string, tenantId: string, workspaceId?: string): Promise<EffectiveRole | null>`:

- Query `tenant_memberships` for the user's tenant role.
- If tenant role is `'owner'` or `'admin'` → return it immediately (these bypass workspace scoping).
- If tenant role is `'member'` AND `workspaceId` is provided → query `workspace_memberships` for the workspace role. Return the workspace role.
- If tenant role is `'member'` AND no `workspaceId` → return `null` (no role resolved without workspace context).
- If no tenant membership found → return `null`.
- All queries use `getDbForTenant()` with the resolved `tenantId`.

`checkRole(userId: string, tenantId: string, workspaceId: string | undefined, requiredRole: EffectiveRole): Promise<boolean>`:

- Calls `resolveEffectiveRole()`, then checks via `roleAtLeast()`.
- Returns `true` if the user meets or exceeds the required role.

`requireRole(userId: string, tenantId: string, workspaceId: string | undefined, requiredRole: EffectiveRole, resource: string, action: string): Promise<void>`:

- Calls `checkRole()`. If `false`, throws `PermissionDeniedError` with the appropriate details.
- This is the function that Server Actions will call to gate management operations.

**Key constraints from the spec:**

- Owners and Admins always see everything — they bypass workspace scoping.
- Owners and Admins do NOT need `workspace_memberships` rows for access.
- Restriction hierarchy is strictly one-directional downward — no lateral or upward restrictions.

**4. Re-export from `packages/shared/auth/index.ts`:**

Create a barrel export file for clean imports: `import { requireRole, PermissionDeniedError } from '@everystack/shared/auth'`.

### Acceptance Criteria

- [ ] `roleAtLeast('admin', 'manager')` returns `true`; `roleAtLeast('viewer', 'team_member')` returns `false`
- [ ] `resolveEffectiveRole()` returns `'owner'` for an Owner regardless of whether a `workspaceId` is provided
- [ ] `resolveEffectiveRole()` returns `'admin'` for an Admin regardless of workspace context
- [ ] `resolveEffectiveRole()` returns the workspace role (`manager` | `team_member` | `viewer`) for a `member`-tier tenant user when a `workspaceId` is provided
- [ ] `resolveEffectiveRole()` returns `null` for a `member`-tier user with no matching `workspace_memberships` row
- [ ] `requireRole()` throws `PermissionDeniedError` with correct `details` when role check fails
- [ ] `PermissionDeniedError` has `code: 'PERMISSION_DENIED'`, `httpStatus: 403`, and structured `details`
- [ ] `PermissionDeniedError` matches the `AppError` pattern from CLAUDE.md
- [ ] Tenant isolation test: `resolveEffectiveRole()` with a user from Tenant A and a workspace from Tenant B returns `null` (RLS prevents cross-tenant resolution)
- [ ] All queries use `getDbForTenant()` — no raw SQL, no bypassing tenant routing
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files, with branch coverage for all role combinations

### Do NOT Build

- Field-level permission model (`views.permissions` JSONB, resolution algorithm, config UI) — Core UX Phase 3A-iii
- Table View–based access control — Core UX Phase 3A-iii
- Permission caching in Redis with `permission.updated` real-time push — Core UX Phase 3A-iii
- Board membership checking or board-level permission convenience — Core UX
- Audit logging of permission denials (the `audit_log` write helper ships in Phase 1I — for now, `PermissionDeniedError` is thrown but not logged to the audit table)
- Permission denial deduplication (5-minute window) — Core UX Phase 3A-iii
- Portal client permission resolution — Core UX Phase 3E-i

---

## Integration Checkpoint 1 (after Prompts 1–4) — Final

**Task:** Verify all work from Prompts 1–4 integrates correctly. This is the final checkpoint for Phase 1C.

Run:

1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass (including new auth and role tests)
4. `pnpm turbo test -- --coverage` — thresholds met, ≥80% on all new files
5. No migrations were added in this sub-phase — skip migration check

Manual verification: 6. Confirm `@clerk/nextjs` and `svix` are in `apps/web/package.json` dependencies 7. Confirm `.env.example` includes `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` 8. Confirm the barrel export `packages/shared/auth/index.ts` exports: `PermissionDeniedError`, `requireRole`, `checkRole`, `resolveEffectiveRole`, `roleAtLeast`, role type constants 9. Confirm Clerk middleware correctly splits public vs. protected routes by reviewing `apps/web/src/middleware.ts`

Integration tests to verify: 10. Auth flow integration: `requireAuth()` → `resolveUser()` → `resolveTenant()` → `getAuthContext()` chain produces a valid `ResolvedAuthContext` 11. Role check integration: `getAuthContext()` → `requireRole('admin', 'manage', 'workspace')` throws `PermissionDeniedError` for a viewer-role user 12. Webhook integration: Simulated `user.created` event with valid Svix signature creates all expected rows in the database in a single transaction

**Git:** Commit with message `chore(verify): integration checkpoint 1 — auth, tenant resolver, roles verified [Phase 1C, CP-1]`, then push branch to origin. Open PR to `main` with title `Phase 1C — Authentication, Tenant Isolation, Workspace Roles`.

Fix any failures before opening the PR.

---

## Dependency Graph

```
Prompt 1 (Clerk Middleware & Auth Session)
  ├── Prompt 2 (Tenant Resolver & Data Access Context)
  │     ├── Prompt 3 (Clerk Webhook Handlers)
  │     └── Prompt 4 (Workspace Role Hierarchy & Permission Checks)
  └── Prompt 3 (Clerk Webhook Handlers — also depends on 1 directly for route exclusion)

CP-1 (Integration Checkpoint) ← depends on all 4 prompts
```

Prompts 3 and 4 are independent of each other and could run in parallel after Prompt 2 completes.

---

## Reference Doc Traceability

| Prompt | Reference Doc Sections Used                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | `permissions.md` lines 452–464 (Tenant Isolation); `CLAUDE.md` lines 158–194 (Platform Auth)                                                      |
| 2      | `permissions.md` lines 452–464 (Tenant Isolation), lines 59–86 (Workspace Roles)                                                                  |
| 3      | `CLAUDE.md` lines 158–194 (Signup Flow, Invitation Flow, Session Handling)                                                                        |
| 4      | `permissions.md` lines 43–86 (Core Principles, Workspace Roles), lines 409–448 (Permission Denial Behavior), lines 468–475 (Phase Implementation) |

Total reference doc lines loaded across all prompts: ~132 lines from `permissions.md` + ~37 lines from `CLAUDE.md` auth section = ~169 lines (well within the ~800-line budget per prompt).
