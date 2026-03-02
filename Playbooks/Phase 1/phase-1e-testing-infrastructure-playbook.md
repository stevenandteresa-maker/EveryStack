# Phase 1E — Testing Infrastructure

## Phase Context

### What Has Been Built

**Phase 1A (Monorepo, CI Pipeline, Dev Environment):**
- Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds
- Docker Compose with PostgreSQL 16, PgBouncer, Redis for development
- GitHub Actions CI workflow (lint → typecheck → test gates)
- ESLint + Prettier config, `tsconfig.json` strict mode
- `.env.example`, `turbo.json` task definitions

**Phase 1B (Database Schema, Connection Pooling, Tenant Routing):**
- Drizzle ORM schema for all 50 MVP tables across Tiers 0–7 in `packages/shared/db/schema/`
- PgBouncer connection pooling config (transaction mode)
- `getDbForTenant()` with read/write intent routing (`dbRead` + `db`)
- RLS policies enforcing tenant isolation on all tenant-scoped tables
- UUIDv7 primary key generation utility (no `serial`)
- Initial migration files in `packages/shared/db/migrations/`

**Phase 1C (Authentication, Tenant Isolation, Workspace Roles):**
- Clerk middleware protecting all routes except public/webhooks/portal
- `getTenantId()` from Clerk session (never from client)
- Clerk webhook handler for `user.created` / `organization.created`
- Five workspace roles on `workspace_memberships.role` (Owner, Admin, Manager, Team Member, Viewer)
- `checkRole()` / `requireRole()` permission utilities
- `PermissionDeniedError` typed error (HTTP 403)

**Phase 1D (Observability, Security Hardening):**
- Pino + pino-http structured logging with PII redaction
- `traceId` via `AsyncLocalStorage` on all requests/jobs
- Sentry DSN + error boundary config
- OpenTelemetry auto-instrumentation (HTTP, Postgres, Redis)
- Security headers middleware (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- Encryption-at-rest verification, TLS 1.2+ enforcement
- Webhook HMAC signature verification pattern (Clerk, Stripe, Resend)
- Typed error classes (`NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`)

### What This Phase Delivers

A complete, production-grade test infrastructure that every subsequent phase depends on. After this phase, any developer (or Claude Code session) can: write unit tests with Vitest and sensible defaults, spin up isolated test databases via Docker Compose, create realistic test data using type-safe factories for all core entities, assert tenant isolation with a single helper call, mock Clerk sessions for any role, mock external APIs with MSW, run Playwright E2E tests across three viewport sizes, and measure query performance with built-in timing guards. The test infrastructure is the quality backbone — every prompt in every future phase uses the utilities created here.

### What This Phase Does NOT Build

- Actual feature tests (written alongside features in later phases)
- E2E test scenarios (written during Core UX — this phase sets up the Playwright harness only)
- CI pipeline YAML (already complete in 1A — this phase builds what CI calls)
- AI evaluation suite (ships with Phase 1H — AI Service Layer)
- Monitoring dashboards or alerting rules (operational concern, not testing)
- Formula engine tests (post-MVP)
- Vector embedding stubs in seed scripts (post-MVP)
- Portal-specific performance tests with block rendering (post-MVP — App Designer portals)

### Architecture Patterns for This Phase

1. **Factories over fixtures.** Every test entity is created via a factory function with sensible defaults and an `overrides` parameter. Factories auto-create parent entities when not provided (e.g., `createTestRecord()` auto-creates a tenant if `tenantId` not supplied). Never hardcode UUIDs.

2. **Isolation by design.** Integration tests get their own database connection via `getTestDb()`. Each test creates its own state — no test depends on data from another test. `afterEach` truncates all tables with `CASCADE`.

3. **Docker test services on tmpfs.** Test Postgres and Redis run entirely in RAM for speed. No data persistence needed. Different ports from dev services (Postgres: 5433, PgBouncer: 6433, Redis: 6380).

4. **Type-safe factories.** Factory functions accept `Partial<EntityType>` from Drizzle schema types. Return types match the Drizzle insert return shape. This ensures factories stay in sync with schema changes — a schema change that removes a required column breaks the factory at compile time.

5. **Consistent test file naming.** Unit: `[source].test.ts` co-located. Integration: `[feature].integration.test.ts` in `__tests__/`. E2E: `[flow].spec.ts` in `apps/web/e2e/`. Component: `[Component].test.tsx` co-located. Accessibility: `[feature].a11y.spec.ts` in `apps/web/e2e/a11y/`.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | Vitest Monorepo Workspace + Per-Package Configs | None | ~200 |
| 2 | Docker Compose Test Services + Environment Config | 1 | ~150 |
| 3 | Core Test Data Factories (Tenant, User, Workspace, Record) | 1, 2 | ~250 |
| 4 | Extended Test Data Factories (Table, Field, Base, View, and remaining entities) | 3 | ~250 |
| CP-1 | Integration Checkpoint 1 (after Prompts 1–4) | 1–4 | — |
| 5 | Tenant Isolation Test Helper | 3 | ~120 |
| 6 | Mock Clerk Session + Auth Test Utilities | 3 | ~150 |
| 7 | MSW External API Mocks, Performance Guard, and Accessibility Helper | 1 | ~200 |
| 8 | Playwright Configuration + Staging Seed Script Skeleton | 2 | ~250 |
| CP-2 | Integration Checkpoint 2 — Final (after Prompts 5–8) | 5–8 | — |

---

## Prompt 1: Vitest Monorepo Workspace + Per-Package Configs

**Depends on:** None (Phase 1A monorepo scaffold exists)
**Load context:** `testing.md` lines 34–47 (Test Framework), 48–120 (Test File Conventions), 344–427 (Vitest Configuration)
**Target files:**
- `vitest.workspace.ts` (monorepo root)
- `packages/shared/vitest.config.ts`
- `apps/web/vitest.config.ts`
- `apps/worker/vitest.config.ts`
- `apps/realtime/vitest.config.ts`
- `apps/web/vitest.setup.ts`
**Migration required:** No

**Git:** Create and checkout branch `feat/phase-1e-testing-infrastructure` from `main`. After completing this prompt, commit with message `feat(testing): vitest monorepo workspace config with per-package configs [Phase 1E, Prompt 1]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the Vitest monorepo workspace configuration and per-package test configs.

**Root workspace file (`vitest.workspace.ts`):**
Define a workspace using `defineWorkspace()` from `vitest/config` that includes all four project config files: `packages/shared/vitest.config.ts`, `apps/web/vitest.config.ts`, `apps/worker/vitest.config.ts`, `apps/realtime/vitest.config.ts`.

**Per-package configs — each must include:**

1. **`apps/web/vitest.config.ts`:**
   - `environment: 'node'` (server-side tests for data/actions)
   - Include patterns: `src/**/*.test.{ts,tsx}`, `__tests__/**/*.test.ts`
   - Exclude patterns: `e2e/**`
   - Setup file: `./vitest.setup.ts`
   - Coverage provider: `v8`, reporters: `['text', 'lcov', 'json-summary']`
   - Coverage includes: `src/data/**`, `src/actions/**`, `src/lib/**`
   - Coverage thresholds: `src/data/` → 95% lines / 90% branches, `src/actions/` → 90% lines / 85% branches
   - `testTimeout: 10_000`, `hookTimeout: 30_000`
   - `pool: 'forks'` with `singleFork: false` (isolation for DB tests)
   - Path aliases: `@` → `./src`, `@everystack/db` → `../../packages/shared/db`

2. **`apps/worker/vitest.config.ts`:**
   - `environment: 'node'`
   - Include patterns: `src/**/*.test.ts`, `__tests__/**/*.test.ts`
   - Coverage thresholds: `src/jobs/` → 85% lines / 80% branches
   - `testTimeout: 10_000`, `hookTimeout: 30_000`
   - `pool: 'forks'`

3. **`apps/realtime/vitest.config.ts`:**
   - `environment: 'node'`
   - Include patterns: `src/**/*.test.ts`, `__tests__/**/*.test.ts`
   - `testTimeout: 10_000`

4. **`packages/shared/vitest.config.ts`:**
   - `environment: 'node'`
   - Include patterns: `**/*.test.ts`, `**/__tests__/**/*.test.ts`
   - Coverage thresholds: `db/` → 90% lines / 85% branches, `ai/` → 80% lines / 75% branches, `sync/` → 90% lines / 85% branches
   - `pool: 'forks'`

**Test setup file (`apps/web/vitest.setup.ts`):**
- In `beforeAll`: get the test DB connection via `getTestDb()` (from `@everystack/testing/factories` — will be created in Prompt 3; for now, stub the import), run Drizzle migrations against the test database.
- In `afterEach`: truncate all tables with `CASCADE` using a dynamic query that iterates `pg_tables` where `schemaname = 'public'`. This ensures no test data leaks between tests.
- Do NOT drop/recreate the database between tests — truncation is faster and sufficient.

**Install Vitest** as a dev dependency at the workspace root if not already present: `pnpm add -D vitest @vitest/coverage-v8 --workspace-root`.

### Acceptance Criteria

- [ ] `vitest.workspace.ts` at monorepo root references all 4 package configs
- [ ] Each of the 4 per-package Vitest configs compiles with zero TypeScript errors
- [ ] `apps/web/vitest.config.ts` includes V8 coverage with per-directory thresholds matching the testing reference doc
- [ ] `apps/web/vitest.setup.ts` exists with `beforeAll` (migration) and `afterEach` (truncation) hooks
- [ ] `pnpm turbo test` runs successfully (no tests exist yet — should report 0 tests found, not errors)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual test files (those ship alongside features)
- Test data factories (Prompt 3)
- Docker Compose test services (Prompt 2 — the setup file's DB connection will fail without them, which is expected at this stage)
- AI evaluation suite config (Phase 1H)
- i18n completeness check config (already in CI from Phase 1A)

---

## Prompt 2: Docker Compose Test Services + Environment Config

**Depends on:** Prompt 1 (Vitest workspace config exists)
**Load context:** `testing.md` lines 525–588 (Docker Compose for Test Services), 944–1002 (Local Development Testing)
**Target files:**
- `docker-compose.test.yml` (monorepo root)
- `.env.test.example` (monorepo root)
- Updates to `turbo.json` (add test-related task definitions)
**Migration required:** No

**Git:** Commit with message `feat(testing): docker-compose test services with tmpfs and turbo task config [Phase 1E, Prompt 2]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create the Docker Compose file for test services and the test environment configuration.

**`docker-compose.test.yml`:**
Three services, all RAM-backed for speed:

1. **`postgres-test`:**
   - Image: `pgvector/pgvector:pg16` (matches dev)
   - Env: `POSTGRES_USER=everystack_test`, `POSTGRES_PASSWORD=test_password`, `POSTGRES_DB=everystack_test`
   - Port: `5433:5432` (different from dev's 5432)
   - `tmpfs: /var/lib/postgresql/data` (RAM-backed, no persistence)
   - Healthcheck: `pg_isready -U everystack_test` with 2s interval, 5s timeout, 10 retries

2. **`pgbouncer-test`:**
   - Image: `bitnami/pgbouncer:latest`
   - Env: `POSTGRESQL_HOST=postgres-test`, port 5432, same credentials, `PGBOUNCER_POOL_MODE=transaction`, `PGBOUNCER_MAX_CLIENT_CONN=100`, `PGBOUNCER_DEFAULT_POOL_SIZE=10`
   - Port: `6433:6432` (different from dev)
   - `depends_on: postgres-test` with `condition: service_healthy`

3. **`redis-test`:**
   - Image: `redis:7-alpine`
   - Port: `6380:6379` (different from dev)
   - `tmpfs: /data`
   - Healthcheck: `redis-cli ping` with 2s interval, 5s timeout, 10 retries

**`.env.test.example`:**
```
DATABASE_URL=postgres://everystack_test:test_password@localhost:5433/everystack_test
PGBOUNCER_URL=postgres://everystack_test:test_password@localhost:6433/everystack_test
REDIS_URL=redis://localhost:6380
CLERK_SECRET_KEY=sk_test_xxx
```

Add `.env.test` to `.gitignore` if not already present. The `.example` file is committed; the actual `.env.test` is not.

**Turborepo test tasks — update `turbo.json`:**
Add or verify these task definitions exist:
```json
{
  "test": {
    "dependsOn": ["^build"],
    "env": ["DATABASE_URL", "REDIS_URL"],
    "inputs": ["src/**/*.ts", "src/**/*.tsx", "vitest.config.ts"]
  },
  "test:integration": {
    "dependsOn": ["^build"],
    "env": ["DATABASE_URL", "REDIS_URL"]
  },
  "test:e2e": {
    "dependsOn": ["build"],
    "env": ["PLAYWRIGHT_BASE_URL", "TEST_USER_EMAIL", "TEST_USER_PASSWORD"]
  },
  "test:coverage-check": {
    "dependsOn": ["test"]
  },
  "test:ai-eval": {
    "env": ["ANTHROPIC_API_KEY"]
  }
}
```

If 1A already defined some of these, verify they match and update if needed. Do not duplicate tasks.

### Acceptance Criteria

- [ ] `docker compose -f docker-compose.test.yml config` validates without errors
- [ ] `docker compose -f docker-compose.test.yml up -d` starts all 3 services with healthy status
- [ ] Postgres test instance is accessible on port 5433 (verified with `pg_isready -h localhost -p 5433 -U everystack_test`)
- [ ] Redis test instance is accessible on port 6380 (verified with `redis-cli -p 6380 ping` returning `PONG`)
- [ ] `.env.test.example` exists with all 4 environment variables
- [ ] `.env.test` is in `.gitignore`
- [ ] `turbo.json` contains all 5 test-related task definitions
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Dev Docker Compose changes (the dev `docker-compose.yml` from 1A is untouched)
- Test database seeding (Prompt 8 — staging seed skeleton)
- CI pipeline updates to use test Docker Compose (already handled in 1A's GitHub Actions workflow)

---

## Prompt 3: Core Test Data Factories (Tenant, User, Workspace, Record)

**Depends on:** Prompt 1 (Vitest config), Prompt 2 (test DB connection available)
**Load context:** `testing.md` lines 121–229 (Test Utilities — Factories section)
**Target files:**
- `packages/shared/testing/index.ts` (barrel export)
- `packages/shared/testing/factories.ts`
- `packages/shared/testing/factories.test.ts`
- `packages/shared/testing/package.json` (if needed for package resolution)
**Migration required:** No

**Git:** Commit with message `feat(testing): core test data factories for tenant, user, workspace, record [Phase 1E, Prompt 3]`

### Schema Snapshot

These factories insert into existing tables from Phase 1B:

```
tenants: id (UUIDv7 PK), name, slug, plan, data_region, created_at, updated_at
users: id (UUIDv7 PK), email, display_name, clerk_id, created_at, updated_at
workspace_memberships: user_id (FK), workspace_id (FK), role, status, created_at (composite PK: user_id + workspace_id)
workspaces: id (UUIDv7 PK), tenant_id (FK), name, slug, created_at, updated_at
records: id (UUIDv7 PK), tenant_id (FK), table_id (FK), canonical_data (JSONB), source_refs (JSONB), search_vector, created_by (FK), created_at, updated_at
```

### Task

Create the foundational test factory module at `packages/shared/testing/`.

**`packages/shared/testing/factories.ts`:**

1. **`getTestDb()`** — Returns a singleton Drizzle DB connection pointing at the test database (from `DATABASE_URL` env). Uses `getDbForTenant('test', 'write')` from the existing DB client module. Caches the connection so it's not recreated per call.

2. **`createTestTenant(overrides?: Partial<NewTenant>)`** — Creates a tenant with sensible defaults:
   - `id`: UUIDv7 via the project's UUID utility
   - `name`: `Test Workspace ${randomSuffix}`
   - `slug`: `test-${randomSuffix}`
   - `plan`: `'professional'`
   - `dataRegion`: `'us'`
   - Apply overrides, insert, return the created row.

3. **`createTestUser(overrides?: Partial<NewUser>)`** — Creates a user:
   - `id`: UUIDv7
   - `email`: `test-${randomSuffix}@example.com`
   - `displayName`: `'Test User'`
   - `clerkId`: `clerk_${randomSuffix}`
   - Apply overrides, insert, return.

4. **`createTestWorkspace(overrides?: Partial<NewWorkspace>)`** — Creates a workspace:
   - `id`: UUIDv7
   - `tenantId`: if not provided, auto-create a tenant via `createTestTenant()`
   - `name`: `Test Workspace ${randomSuffix}`
   - `slug`: `test-ws-${randomSuffix}`
   - Apply overrides, insert, return.

5. **`createTestRecord(overrides?: Partial<NewRecord>)`** — Creates a record:
   - `id`: UUIDv7
   - `tenantId`: if not provided, auto-create a tenant
   - `tableId`: if not provided, use a random UUID (table may not exist in test — that's OK for unit tests; integration tests should create the table first)
   - `canonicalData`: `{ fields: {} }` (empty but valid JSONB)
   - `searchVector`: `null`
   - `createdBy`: random UUID
   - Apply overrides, insert, return.

**Auto-parent creation pattern:** When a factory needs a parent entity (e.g., a record needs a tenant), and the caller doesn't provide one, the factory calls the parent factory to create it. This ensures tests can create deep entities with a single call: `const record = await createTestRecord()` creates a tenant + record automatically.

**Type safety:** Use Drizzle's `InferInsertModel<typeof tableName>` types (aliased as `NewTenant`, `NewUser`, etc.) for the `overrides` parameter. This ensures compile-time checking — if a schema column is renamed or removed, the factory breaks at `tsc --noEmit`, not silently at runtime.

**`packages/shared/testing/factories.test.ts`:**
Write basic unit tests for each factory:
- `createTestTenant()` returns an object with a valid `id` and default `plan`
- `createTestUser()` returns an object with a unique `email`
- `createTestWorkspace()` auto-creates a tenant when `tenantId` not provided
- `createTestRecord()` auto-creates a tenant when `tenantId` not provided
- Two calls to `createTestTenant()` produce different `id` values

**`packages/shared/testing/index.ts`:**
Barrel export: re-export everything from `factories.ts`. This will later also re-export from `tenant-isolation.ts`, `mock-clerk.ts`, `mock-apis.ts`, and `performance.ts` as those are created in subsequent prompts.

### Acceptance Criteria

- [ ] `createTestTenant()` inserts a row into `tenants` and returns it with a valid UUIDv7 `id`
- [ ] `createTestUser()` inserts a row into `users` with a unique auto-generated email
- [ ] `createTestWorkspace()` auto-creates a parent tenant when `tenantId` is not provided
- [ ] `createTestRecord()` inserts into `records` with valid default `canonicalData` structure (`{ fields: {} }`)
- [ ] All factory return types use Drizzle's inferred types — no `any` casts
- [ ] `packages/shared/testing/index.ts` barrel-exports all factories
- [ ] Factory unit tests pass: `pnpm vitest run packages/shared/testing/factories.test.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Factories for entities beyond Tenant/User/Workspace/Record (Prompt 4)
- Tenant isolation helper (Prompt 5)
- Mock Clerk session (Prompt 6)
- Complex relationship setups (e.g., full workspace with members, tables, fields, and records — that's a test scenario concern, not a factory concern)

---

## Prompt 4: Extended Test Data Factories (Table, Field, Base, View, and Remaining Entities)

**Depends on:** Prompt 3 (core factories exist)
**Load context:** `testing.md` lines 121–229 (Test Utilities — Factories), `GLOSSARY.md` Schema Table (lines 720–768 for entity column reference)
**Target files:**
- `packages/shared/testing/factories.ts` (extend with new factories)
- `packages/shared/testing/factories.test.ts` (extend with new tests)
**Migration required:** No

**Git:** Commit with message `feat(testing): extended test data factories for all MVP entities [Phase 1E, Prompt 4]`

### Schema Snapshot

Additional tables these factories insert into (from Phase 1B):

```
tables: id (UUIDv7 PK), tenant_id, workspace_id, name, table_type, source_platform, external_table_id, environment, created_at, updated_at
fields: id (UUIDv7 PK), tenant_id, table_id, name, field_type, config (JSONB), position, environment, created_at
base_connections: id (UUIDv7 PK), tenant_id, platform, external_base_id, external_base_name, oauth_tokens, sync_config (JSONB), sync_direction, conflict_resolution, sync_status, last_sync_at, health (JSONB)
views: id (UUIDv7 PK), tenant_id, table_id, name, view_type, config (JSONB), is_default, created_by, created_at, updated_at
cross_links: id (UUIDv7 PK), tenant_id, source_table_id, target_table_id, source_field_id, target_field_id, created_at
cross_link_index: source_record_id, target_record_id, cross_link_id
portals: id (UUIDv7 PK), tenant_id, workspace_id, record_id, name, config (JSONB), auth_type, status, created_at
forms: id (UUIDv7 PK), tenant_id, workspace_id, table_id, name, config (JSONB), status, created_at
automations: id (UUIDv7 PK), tenant_id, workspace_id, name, trigger (JSONB), steps (JSONB[]), status
document_templates: id (UUIDv7 PK), tenant_id, workspace_id, table_id, name, content, created_at
threads: id (UUIDv7 PK), tenant_id, scope_type, scope_id, created_at
api_keys: id (UUIDv7 PK), tenant_id, name, key_hash, key_prefix, scopes (TEXT[]), rate_limit_tier, status
```

### Task

Extend `packages/shared/testing/factories.ts` with factories for all remaining MVP entities. Each factory follows the same pattern established in Prompt 3: sensible defaults, `Partial<NewEntityType>` overrides, auto-parent creation.

**Required factories (add all of these):**

1. **`createTestTable(overrides?)`** — Defaults: `name: 'Test Table'`, `tableType: 'table'`, `sourcePlatform: null` (native), `environment: 'live'`. Auto-creates workspace (and therefore tenant) if not provided.

2. **`createTestField(overrides?)`** — Defaults: `name: 'Test Field'`, `fieldType: 'text'`, `config: {}`, `position: 0`, `environment: 'live'`. Auto-creates table if `tableId` not provided.

3. **`createTestBase(overrides?)`** — For `base_connections`. Defaults: `platform: 'airtable'`, `syncDirection: 'bidirectional'`, `conflictResolution: 'last_write_wins'`, `syncStatus: 'active'`. Auto-creates tenant if not provided.

4. **`createTestView(overrides?)`** — Defaults: `name: 'Default Grid'`, `viewType: 'grid'`, `config: {}`, `isDefault: true`. Auto-creates table if not provided.

5. **`createTestCrossLink(overrides?)`** — Defaults: auto-creates two tables (source and target) in the same workspace if not provided. Creates the cross-link between them.

6. **`createTestPortal(overrides?)`** — Defaults: `name: 'Test Portal'`, `authType: 'magic_link'`, `status: 'published'`. Auto-creates workspace and a record if not provided.

7. **`createTestForm(overrides?)`** — Defaults: `name: 'Test Form'`, `status: 'published'`. Auto-creates workspace and table if not provided.

8. **`createTestAutomation(overrides?)`** — Defaults: `name: 'Test Automation'`, `trigger: { type: 'record_created', tableId: '<auto>' }`, `steps: []`, `status: 'active'`. Auto-creates workspace if not provided.

9. **`createTestDocumentTemplate(overrides?)`** — Defaults: `name: 'Test Template'`, `content: '<p>Hello {{Name}}</p>'`. Auto-creates workspace and table if not provided.

10. **`createTestThread(overrides?)`** — Defaults: `scopeType: 'record'`, `scopeId: '<auto-created record id>'`. Auto-creates tenant if not provided.

11. **`createTestApiKey(overrides?)`** — Defaults: `name: 'Test API Key'`, `keyHash: '<sha256 of random string>'`, `keyPrefix: 'esk_test_'`, `scopes: ['data:read']`, `rateLimitTier: 'standard'`, `status: 'active'`. Auto-creates tenant if not provided. Return the raw key alongside the inserted row so tests can use it for auth.

**Environment column enforcement:** Every factory that creates an entity with an `environment` column MUST default to `'live'`. The `environment` column exists on `tables` and `fields`. This matches the EveryStack convention that Foundation only builds the `'live'` environment.

**Extend tests in `factories.test.ts`:**
- `createTestTable()` auto-creates a workspace and tenant
- `createTestField()` auto-creates a table, workspace, and tenant
- `createTestCrossLink()` creates two tables in the same workspace
- `createTestApiKey()` returns both the inserted row and the raw key value

### Acceptance Criteria

- [ ] All 11 new factories compile with correct Drizzle inferred types — no `any`
- [ ] `createTestTable()` auto-creates parent workspace and tenant when not provided
- [ ] `createTestField()` auto-creates parent table, workspace, and tenant when not provided
- [ ] `createTestCrossLink()` creates two tables in the same workspace by default
- [ ] `createTestApiKey()` returns the raw API key value in addition to the inserted row
- [ ] Every factory with an `environment` column defaults to `'live'`
- [ ] All factory tests pass: `pnpm vitest run packages/shared/testing/factories.test.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- `createTestApp()` (post-MVP — App Designer)
- Factories for `portal_clients` (post-MVP — App Portals)
- Complex graph setup utilities (e.g., "create a full workspace with 5 tables, 10 fields each, and 100 records") — individual factories compose for this
- Seed scripts (Prompt 8)

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all testing infrastructure from Prompts 1–4 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `docker compose -f docker-compose.test.yml up -d` — all 3 services healthy
4. `pnpm turbo test` — factory tests pass, zero failures
5. Verify that `vitest.workspace.ts` discovers all 4 package configs (check Vitest output for workspace names)
6. Manual verification: confirm `packages/shared/testing/index.ts` exports all factory functions by checking import autocompletion in an IDE or running `pnpm turbo typecheck`

**Git:** Commit with message `chore(verify): integration checkpoint 1 — testing infra foundations [Phase 1E, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Tenant Isolation Test Helper

**Depends on:** Prompt 3 (core factories — `createTestTenant`, used inside the helper)
**Load context:** `testing.md` lines 121–165 (Tenant Isolation Helper)
**Target files:**
- `packages/shared/testing/tenant-isolation.ts`
- `packages/shared/testing/tenant-isolation.test.ts`
- Update `packages/shared/testing/index.ts` (add re-export)
**Migration required:** No

**Git:** Commit with message `feat(testing): testTenantIsolation() helper with generic query function support [Phase 1E, Prompt 5]`

### Schema Snapshot

N/A — this helper is schema-agnostic. It works with any query function that accepts a `tenantId` and returns an array of objects with a `tenantId` property.

### Task

Create the `testTenantIsolation()` helper that every subsequent `/data` function will use to prove tenant isolation.

**`packages/shared/testing/tenant-isolation.ts`:**

```typescript
export async function testTenantIsolation<T extends { tenantId: string }>(
  queryFn: (tenantId: string, ...args: unknown[]) => Promise<T[]>,
  setupFn: (tenantId: string) => Promise<void>,
  queryArgs?: unknown[],
): Promise<void>
```

**Implementation:**
1. Create two tenants: `tenantA = await createTestTenant()`, `tenantB = await createTestTenant()`.
2. Call `setupFn(tenantA.id)` and `setupFn(tenantB.id)` to create test data in both tenants.
3. Query as tenant A: `const resultsA = await queryFn(tenantA.id, ...(queryArgs ?? []))`.
4. Assert every result in `resultsA` has `tenantId === tenantA.id`. Zero tenant B records.
5. Query as tenant B: `const resultsB = await queryFn(tenantB.id, ...(queryArgs ?? []))`.
6. Assert every result in `resultsB` has `tenantId === tenantB.id`. Zero tenant A records.

**Important design decisions:**
- The generic constraint `T extends { tenantId: string }` ensures compile-time safety — the helper only works with entities that have a `tenantId` field.
- `queryArgs` is optional additional arguments passed to the query function (e.g., a `tableId` for `getRecordsByTable(tenantId, tableId)`).
- Use `expect` from Vitest globals for assertions inside the helper.

**`packages/shared/testing/tenant-isolation.test.ts`:**
Write a self-contained test that validates the helper works:
- Create a simple mock query function that filters an in-memory array by `tenantId`.
- Call `testTenantIsolation()` with the mock — should pass.
- Create a deliberately broken query function that ignores `tenantId` (returns all records) — calling `testTenantIsolation()` with this should fail/throw.

**Update `packages/shared/testing/index.ts`:**
Add re-export: `export { testTenantIsolation } from './tenant-isolation';`

### Acceptance Criteria

- [ ] `testTenantIsolation()` creates two separate tenants and verifies query isolation
- [ ] Generic constraint `T extends { tenantId: string }` enforces type safety at compile time
- [ ] Self-contained test with mock query function passes
- [ ] Self-contained test with deliberately broken query function correctly detects the isolation violation
- [ ] Helper is exported from `packages/shared/testing/index.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual data access functions to test (built in later phases)
- Permission-based isolation helpers (permission model ships in Core UX)
- Portal data scope isolation helper (post-MVP)

---

## Prompt 6: Mock Clerk Session + Auth Test Utilities

**Depends on:** Prompt 3 (factories for `createTestUser`)
**Load context:** `testing.md` lines 230–248 (Mock Clerk Session)
**Target files:**
- `packages/shared/testing/mock-clerk.ts`
- `packages/shared/testing/mock-clerk.test.ts`
- Update `packages/shared/testing/index.ts` (add re-export)
**Migration required:** No

**Git:** Commit with message `feat(testing): mock Clerk session and auth test utilities [Phase 1E, Prompt 6]`

### Schema Snapshot

N/A — mocks the auth layer, not the database.

### Task

Create mock Clerk session utilities for unit and integration tests. These mock the auth functions that Phase 1C established (`getTenantId`, `getUserId`, `getUserRole`).

**`packages/shared/testing/mock-clerk.ts`:**

1. **`mockClerkSession(tenantId: string, userId: string, role?: string)`:**
   - Uses `vi.mock()` to mock the auth module (`@/lib/auth` or the actual path used in 1C).
   - Mocks `getTenantId` to return `tenantId`.
   - Mocks `getUserId` to return `userId`.
   - Mocks `getUserRole` to return `role` (default: `'manager'`).
   - This allows any test to simulate being logged in as a specific user with a specific role without hitting Clerk's API.

2. **`mockClerkSessionWithUser(overrides?: { tenantId?: string; role?: string })`:**
   - Convenience wrapper: auto-creates a test user and test tenant via factories, then calls `mockClerkSession()` with the generated IDs.
   - Returns `{ tenant, user, role }` so the test can reference the created entities.
   - Useful for tests that need auth context but don't care about the specific user details.

3. **`clearClerkMocks()`:**
   - Calls `vi.restoreAllMocks()` for the auth module.
   - Should be called in `afterEach` blocks when using Clerk mocks.
   - Alternatively, tests can rely on `vi.restoreAllMocks()` in a global `afterEach`.

**Important:** The mock paths must match the actual module paths used in Phase 1C's auth implementation. Check the existing codebase for the exact import path of `getTenantId`, `getUserId`, and `getUserRole` and use those paths in the mock. If Phase 1C used a different module structure, adapt accordingly.

**`packages/shared/testing/mock-clerk.test.ts`:**
- `mockClerkSession()` makes `getTenantId()` return the specified tenant ID
- `mockClerkSessionWithUser()` auto-creates a user and tenant, returns them
- `clearClerkMocks()` restores original implementations
- After `clearClerkMocks()`, the mock functions no longer return mock values

**Update `packages/shared/testing/index.ts`:**
Add re-export: `export { mockClerkSession, mockClerkSessionWithUser, clearClerkMocks } from './mock-clerk';`

### Acceptance Criteria

- [ ] `mockClerkSession()` mocks `getTenantId`, `getUserId`, and `getUserRole` with provided values
- [ ] `mockClerkSessionWithUser()` auto-creates tenant + user via factories and returns them
- [ ] Default role is `'manager'` when not specified
- [ ] `clearClerkMocks()` restores original auth functions
- [ ] All five workspace roles can be mocked: `'owner'`, `'admin'`, `'manager'`, `'team_member'`, `'viewer'`
- [ ] Mock test file passes: `pnpm vitest run packages/shared/testing/mock-clerk.test.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Playwright Clerk auth setup (Prompt 8 — that's E2E, not unit/integration)
- Portal session mocks (portals ship in Core UX)
- Role-based permission assertion helpers (full permission model ships in Core UX)

---

## Prompt 7: MSW External API Mocks, Performance Guard, and Accessibility Helper

**Depends on:** Prompt 1 (Vitest config)
**Load context:** `testing.md` lines 250–278 (Mock External APIs), 631–692 (Performance Regression Testing), 589–630 (Accessibility Testing)
**Target files:**
- `packages/shared/testing/mock-apis.ts`
- `packages/shared/testing/performance.ts`
- `packages/shared/testing/performance.test.ts`
- `packages/shared/testing/a11y.ts`
- Update `packages/shared/testing/index.ts` (add re-exports)
**Migration required:** No

**Git:** Commit with message `feat(testing): MSW mock handlers, performance timing guard, and a11y helper [Phase 1E, Prompt 7]`

### Schema Snapshot

N/A — no schema changes.

### Task

Create three testing utility modules: external API mocks, performance regression guards, and accessibility test helpers.

**1. MSW External API Mocks (`packages/shared/testing/mock-apis.ts`):**

Install MSW: `pnpm add -D msw --filter @everystack/shared`

Create a mock API server and initial handler sets:

- **`airtableHandlers`** — Array of MSW `http` handlers:
  - `GET https://api.airtable.com/v0/:baseId/:tableId` → returns a mock response with 1 sample record: `{ records: [{ id: 'rec1', fields: { Name: 'Test Record', Status: 'Active' } }] }`
  - `PATCH https://api.airtable.com/v0/:baseId/:tableId` → returns success: `{ records: [{ id: 'rec1', fields: {} }] }`

- **`notionHandlers`** — Array of MSW `http` handlers:
  - `POST https://api.notion.com/v1/databases/:databaseId/query` → returns mock page list
  - `PATCH https://api.notion.com/v1/pages/:pageId` → returns success

- **`smartsuiteHandlers`** — Array of MSW `http` handlers:
  - Placeholder handlers for SmartSuite API (basic GET/PATCH stubs)

- **`mockApiServer`** — `setupServer(...airtableHandlers, ...notionHandlers, ...smartsuiteHandlers)`

- **`setupMockApis()`** — Convenience function: `beforeAll(() => mockApiServer.listen({ onUnhandledRequest: 'warn' }))`, `afterEach(() => mockApiServer.resetHandlers())`, `afterAll(() => mockApiServer.close())`.

- Export individual handler arrays so tests can add custom overrides via `mockApiServer.use(...)`.

**2. Performance Timing Guard (`packages/shared/testing/performance.ts`):**

```typescript
export function expectQueryTime(
  label: string,
  queryFn: () => Promise<unknown>,
  maxMs: number,
): void
```

Implementation:
- Registers an `it()` test case with the label: `${label} completes within ${maxMs}ms`.
- Runs `queryFn()` once as warm-up (query plan caching).
- Runs `queryFn()` a second time and measures elapsed time with `performance.now()`.
- Asserts `elapsed < maxMs`.

This function is designed to be called inside a `describe()` block. It creates a test case, not a standalone function.

**`packages/shared/testing/performance.test.ts`:**
- `expectQueryTime()` passes when the function completes under the threshold
- `expectQueryTime()` fails when the function exceeds the threshold (use a deliberate `setTimeout` to force slowness)

**3. Accessibility Test Helper (`packages/shared/testing/a11y.ts`):**

This is a lightweight helper for Playwright-based axe-core tests. Note: `@axe-core/playwright` will be installed alongside Playwright in Prompt 8. For now, create the helper with the correct import that will resolve after Prompt 8.

```typescript
export async function checkAccessibility(
  page: Page,
  options?: {
    excludeSelectors?: string[];
    tags?: string[];
  },
): Promise<void>
```

Implementation:
- Default tags: `['wcag2a', 'wcag2aa', 'wcag21aa']`
- Builds an `AxeBuilder` instance from `@axe-core/playwright`
- Applies `.withTags()` from options or defaults
- Applies `.exclude()` for each selector in `excludeSelectors` (e.g., `.recharts-wrapper`)
- Calls `.analyze()` and asserts `results.violations` is empty
- If violations exist, format a helpful error message listing each violation's `id`, `impact`, and `description`

**Update `packages/shared/testing/index.ts`:**
Add re-exports for `mock-apis`, `performance`, and `a11y` modules.

### Acceptance Criteria

- [ ] MSW `mockApiServer` is created with handlers for Airtable, Notion, and SmartSuite stub APIs
- [ ] `setupMockApis()` convenience function provides `beforeAll`/`afterEach`/`afterAll` lifecycle hooks
- [ ] Individual handler arrays (e.g., `airtableHandlers`) are exported for selective use
- [ ] `expectQueryTime()` creates a test case that passes when timing is under threshold
- [ ] `expectQueryTime()` creates a test case that fails when timing exceeds threshold
- [ ] `checkAccessibility()` helper wraps axe-core with WCAG 2.1 AA tags by default
- [ ] All modules are re-exported from `packages/shared/testing/index.ts`
- [ ] Performance guard tests pass: `pnpm vitest run packages/shared/testing/performance.test.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual sync tests using MSW (Phase 2 — Sync)
- Actual performance regression test suites with seeded data (written alongside features)
- Actual accessibility test scenarios (written during Core UX)
- AI evaluation mocks (Phase 1H)

---

## Prompt 8: Playwright Configuration + Staging Seed Script Skeleton

**Depends on:** Prompt 2 (Docker Compose test services for seed script DB target)
**Load context:** `testing.md` lines 428–524 (Playwright Configuration), 887–943 (Staging Database Management)
**Target files:**
- `apps/web/playwright.config.ts`
- `apps/web/e2e/auth.setup.ts`
- `apps/web/e2e/auth.teardown.ts`
- `apps/web/e2e/.gitkeep` (or initial directory structure)
- `apps/web/e2e/a11y/.gitkeep`
- `packages/shared/db/scripts/seed-staging.ts`
**Migration required:** No

**Git:** Commit with message `feat(testing): playwright config with 3 viewports and staging seed script skeleton [Phase 1E, Prompt 8]`

### Schema Snapshot

Seed script references these tables (all exist from Phase 1B):

```
tenants: id, name, slug, plan, data_region
workspaces: id, tenant_id, name, slug
tables: id, tenant_id, workspace_id, name, table_type, environment
fields: id, tenant_id, table_id, name, field_type, config, position, environment
records: id, tenant_id, table_id, canonical_data, search_vector, created_by
cross_links: id, tenant_id, source_table_id, target_table_id
cross_link_index: source_record_id, target_record_id, cross_link_id
```

### Task

Create the Playwright E2E test configuration and a staging database seed script skeleton.

**Part 1 — Playwright Configuration (`apps/web/playwright.config.ts`):**

Install Playwright: `pnpm add -D @playwright/test @axe-core/playwright --filter @everystack/web`

Configure with `defineConfig`:
- `testDir: './e2e'`
- `fullyParallel: true`
- `forbidOnly: !!process.env.CI`
- `retries`: 2 in CI, 0 locally
- `workers`: 2 in CI, default locally
- `reporter`: `[['html'], ['github']]` in CI, `[['list']]` locally
- `use`:
  - `baseURL`: from `PLAYWRIGHT_BASE_URL` env or `http://localhost:3000`
  - `trace: 'on-first-retry'`
  - `screenshot: 'only-on-failure'`
  - `video: 'retain-on-failure'`

- **Projects (5 total):**
  1. `setup` — matches `auth.setup.ts`, teardown references `teardown` project
  2. `teardown` — matches `auth.teardown.ts`
  3. `desktop-chrome` — `devices['Desktop Chrome']`, viewport `1440×900`, `storageState: 'e2e/.auth/user.json'`, depends on `setup`
  4. `tablet-safari` — `devices['iPad Pro 11']`, `storageState: 'e2e/.auth/user.json'`, depends on `setup`
  5. `mobile-chrome` — `devices['Pixel 5']`, `storageState: 'e2e/.auth/user.json'`, depends on `setup`

- `webServer` (local only, not CI): command `pnpm dev`, url `http://localhost:3000`, `reuseExistingServer: true`, timeout 120s.

**Part 2 — Auth Setup (`apps/web/e2e/auth.setup.ts`):**
- Uses Clerk test mode for deterministic auth.
- Navigates to `/sign-in`.
- Fills email from `TEST_USER_EMAIL` env, clicks Continue.
- Fills password from `TEST_USER_PASSWORD` env, clicks Continue.
- Waits for workspace redirect (`/w/` pattern).
- Asserts sidebar is visible (`[data-testid="sidebar"]`).
- Saves storage state to `e2e/.auth/user.json`.

**Part 3 — Auth Teardown (`apps/web/e2e/auth.teardown.ts`):**
- Cleanup: remove the saved auth state file (`e2e/.auth/user.json`).
- Add `e2e/.auth/` to `.gitignore`.

**Part 4 — Directory Structure:**
- Create `apps/web/e2e/a11y/` directory with a `.gitkeep` (accessibility tests will be added in Core UX).
- Create `apps/web/e2e/.auth/` in `.gitignore`.

**Part 5 — Staging Seed Script (`packages/shared/db/scripts/seed-staging.ts`):**

Create a skeleton script registered as `pnpm turbo db:seed-staging`:

```typescript
async function seedStaging() {
  const tenantSizes = [
    { count: 300, recordsPer: 100 },      // Small tenants
    { count: 150, recordsPer: 5_000 },    // Medium tenants
    { count: 40,  recordsPer: 50_000 },   // Large tenants
    { count: 10,  recordsPer: 200_000 },  // Enterprise tenants
  ];

  for (const tier of tenantSizes) {
    for (let i = 0; i < tier.count; i++) {
      // TODO: Implement with staging-specific factories
      // const tenant = await createStagingTenant();
      // const workspace = await createStagingWorkspace(tenant.id);
      // const tables = await createStagingTables(workspace.id, 5);
      // for (const table of tables) {
      //   const fields = await createStagingFields(table.id, 15);
      //   await createStagingRecords(tenant.id, table.id, fields, tier.recordsPer / 5);
      // }
      // await createStagingCrossLinks(tenant.id, tables, Math.floor(tier.recordsPer * 0.1));
    }
  }

  // Build search vectors (requires tsvector setup from Core UX)
  // await rebuildAllSearchVectors();

  console.log('Staging seed complete');
}

seedStaging().catch(console.error);
```

The script is a **skeleton** — the loop structure and tier definitions are real, but the actual seeding functions are TODO stubs. They will be implemented when feature code exists to populate realistic data. The structure ensures the staging volume targets are documented: 500 tenants, 5M records, 10K fields, 500K cross-link index rows.

**Note:** Exclude `post-MVP` items from the seed script. The reference doc mentions embedding stubs — do NOT include those (vector embeddings are post-MVP).

### Acceptance Criteria

- [ ] `apps/web/playwright.config.ts` defines 5 projects: setup, teardown, desktop-chrome (1440×900), tablet-safari, mobile-chrome
- [ ] Auth setup file uses Clerk test mode with env vars for credentials
- [ ] Auth teardown cleans up the storage state file
- [ ] `e2e/.auth/` is in `.gitignore`
- [ ] `apps/web/e2e/a11y/` directory exists
- [ ] `packages/shared/db/scripts/seed-staging.ts` exists with the 4-tier tenant structure skeleton
- [ ] Seed script does NOT include vector embedding stubs (post-MVP)
- [ ] `pnpm turbo test:e2e -- --list` lists zero tests but does not error (Playwright installed, config valid)
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Actual E2E test scenarios (written during Core UX)
- Actual accessibility test scenarios (written during Core UX)
- Full seed script implementation (populated incrementally as features are built)
- Clerk test user provisioning in CI (operational concern — documented in `.env.test.example`)
- Vector embedding stubs in seed script (post-MVP)
- Formula engine dependency graph tests (post-MVP)

---

## Integration Checkpoint 2 — Final (after Prompts 5–8)

**Task:** Verify all testing infrastructure from the complete Phase 1E integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `docker compose -f docker-compose.test.yml up -d` — all 3 services healthy
4. `pnpm turbo test` — all tests pass (factory tests, tenant isolation tests, mock clerk tests, performance guard tests)
5. `pnpm turbo test -- --coverage` — verify coverage reporting works (thresholds won't be enforced yet since there's minimal code)
6. `pnpm turbo test:e2e -- --list` — Playwright config loads without errors (zero tests is fine)
7. Manual verification: import check — create a temporary test file that imports `{ createTestTenant, testTenantIsolation, mockClerkSession, expectQueryTime, mockApiServer }` from `@everystack/testing` and verify all resolve. Delete the temp file after.

**Full export verification from `packages/shared/testing/index.ts`:**
- `createTestTenant`, `createTestUser`, `createTestWorkspace`, `createTestRecord`
- `createTestTable`, `createTestField`, `createTestBase`, `createTestView`, `createTestCrossLink`
- `createTestPortal`, `createTestForm`, `createTestAutomation`, `createTestDocumentTemplate`
- `createTestThread`, `createTestApiKey`
- `testTenantIsolation`
- `mockClerkSession`, `mockClerkSessionWithUser`, `clearClerkMocks`
- `mockApiServer`, `airtableHandlers`, `notionHandlers`, `smartsuiteHandlers`, `setupMockApis`
- `expectQueryTime`
- `checkAccessibility`
- `getTestDb`

**Git:** Commit with message `chore(verify): integration checkpoint 2 — complete testing infrastructure [Phase 1E, CP-2]`, then push branch to origin. Open PR to main with title **"Phase 1E — Testing Infrastructure"**.

Fix any failures before merging.
