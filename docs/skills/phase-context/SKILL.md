---
name: everystack-phase-context
description: Current build state for EveryStack. Load this skill at the start of every build prompt. It documents what exists in the codebase right now — files, modules, patterns, conventions — so Claude Code doesn't have to rediscover it each time.
---

# EveryStack — Phase Context

**Last updated:** 2026-03-02
**Branch:** `feat/phase-1e-testing-infrastructure`
**Latest tag:** `v0.1.3-phase-1d`
**Total commits:** 10 (on main + current branch)

---

## What Exists Now

### Phase 1A — Infrastructure (Complete)

Monorepo scaffold with Turborepo + pnpm workspaces, CI pipeline, and dev environment.

**Key files:**
- `turbo.json` — Task orchestration (dev, build, lint, typecheck, test, db:\*)
- `pnpm-workspace.yaml` — 3 apps + 1 shared package
- `.github/workflows/ci.yml` — 5-job CI (lint, unit/integration, E2E, AI eval, migration timing)
- `.github/dependabot.yml` — Weekly dependency updates
- `docker-compose.yml` — Dev services (PostgreSQL 16 + pgvector, PgBouncer, Redis 7)
- `docker/pgbouncer/pgbouncer.ini` — Transaction-mode pooling (port 6432)
- `docker/postgres/init-extensions.sql` — pgvector extension
- `tsconfig.base.json` — Strict mode, ES2022, noUncheckedIndexedAccess
- `eslint.config.mjs` — no-console, no-any, security plugin
- `.nvmrc` — Node 20

**Patterns established:** Turborepo task graph, pnpm workspaces, strict TypeScript, conventional commits (`type(scope): description [Phase X, Prompt N]`).

### Phase 1B — Database (Complete)

Full Drizzle ORM schema (50 tables), 12 SQL migrations, RLS, connection pooling, tenant routing.

**Key files:**
- `packages/shared/db/client.ts` — `getDbForTenant(tenantId, intent)` routing, PgBouncer clients
- `packages/shared/db/rls.ts` — `setTenantContext()`, 41 tenant-scoped tables with RLS policies
- `packages/shared/db/uuid.ts` — `generateUUIDv7()` (all PKs are UUIDv7)
- `packages/shared/db/schema/` — 50 Drizzle table definitions (see schema index below)
- `packages/shared/db/migrations/` — 12 migrations (0000–0011), including RLS enablement
- `packages/shared/db/operations/user-operations.ts` — `createUserWithTenant()`, `updateUserFromClerk()`
- `packages/shared/db/drizzle.config.ts` — Migration config (uses DATABASE_URL_DIRECT for DDL)

**Schema highlights:** `records` hash-partitioned into 16 partitions by `tenant_id`. `audit_log`, `ai_usage_log`, `api_request_log` time-partitioned monthly. Canonical JSONB pattern: `records.canonical_data` keyed by `fields.id`.

**Patterns established:** `getDbForTenant()` for all DB access, `setTenantContext()` before RLS queries, UUIDv7 everywhere, composite PKs on partitioned tables, no raw SQL outside migrations.

### Phase 1C — Auth & Tenant Isolation (Complete)

Clerk integration, 5-role RBAC hierarchy, tenant resolution, webhook-driven user provisioning.

**Key files:**
- `packages/shared/auth/roles.ts` — Role constants, hierarchy (owner=50 > admin=40 > manager=30 > team_member=20 > viewer=10), `roleAtLeast()`
- `packages/shared/auth/check-role.ts` — `resolveEffectiveRole()`, `checkRole()`, `requireRole()`
- `packages/shared/auth/errors.ts` — `PermissionDeniedError` (403)
- `apps/web/src/lib/auth.ts` — Clerk session extraction
- `apps/web/src/lib/auth-context.ts` — `getAuthContext()` resolves Clerk IDs to internal UUIDs
- `apps/web/src/lib/tenant-resolver.ts` — Maps `clerk_org_id` to internal `tenant_id`
- `apps/web/src/app/api/webhooks/clerk/route.ts` — `user.created` / `org.updated` webhook handler
- `apps/web/src/lib/middleware.ts` — Clerk middleware + route matchers

**Patterns established:** Clerk org ID stored in `tenants.clerk_id`, internal UUIDs for all DB relations. `tenant-resolver.ts` handles the lookup. Never trust client-supplied tenant/user IDs.

### Phase 1D — Observability & Security (Complete)

Pino logging with PII redaction, OpenTelemetry tracing, Sentry error tracking, security headers, compliance foundations.

**Key files:**
- `packages/shared/logging/logger.ts` — `createLogger()`, PII redaction, `webLogger`/`workerLogger`/`realtimeLogger`
- `packages/shared/logging/trace-context.ts` — AsyncLocalStorage trace propagation, `runWithTraceContext()`
- `packages/shared/telemetry/otel.ts` — `initTelemetry()`, custom `TraceIdSpanProcessor`
- `packages/shared/errors/index.ts` — 6 error classes (Validation/NotFound/Forbidden/Conflict/RateLimited/Internal), `toErrorResponse()`
- `packages/shared/webhooks/verify-signature.ts` — Svix + generic HMAC verification
- `packages/shared/compliance/pii-registry.ts` — Declarative PII column registry (7 tables tracked)
- `packages/shared/compliance/verify-encryption.ts` — TLS verification stubs
- `apps/web/src/lib/pino-http.ts` — HTTP logging wrappers with trace context
- `apps/web/src/app/global-error.tsx` — Sentry error boundary with support reporting
- `apps/web/instrumentation.ts` — Runtime instrumentation entry
- `apps/web/sentry.*.config.ts` — Client/server/edge Sentry configs
- `apps/worker/src/lib/job-wrapper.ts` — `createJobProcessor()` with tracing + Sentry
- `apps/worker/src/lib/sentry.ts` — Worker Sentry init + `captureJobError()`
- `apps/worker/src/lib/otel-init.ts` — Worker telemetry init
- Security headers in middleware: CSP, HSTS, X-Frame-Options (DENY for platform, SAMEORIGIN for portal)

**Patterns established:** All errors extend `AppError` with code/statusCode/traceId. PII redacted in logs. AsyncLocalStorage for trace propagation across async boundaries. Different security policies for platform vs portal routes.

### Phase 1E — Testing Infrastructure (In Progress)

Vitest monorepo config, Docker test services, comprehensive test data factories.

**Key files:**
- `vitest.workspace.ts` — Root workspace referencing 4 package configs
- `packages/shared/vitest.config.ts` — Forks pool, V8 coverage (db: 90/85%, sync: 90/85%)
- `apps/web/vitest.config.ts` — Forks pool, coverage (data: 95/90%, actions: 90/85%)
- `apps/worker/vitest.config.ts` — Coverage (jobs: 85/80%)
- `apps/realtime/vitest.config.ts` — passWithNoTests: true
- `apps/web/vitest.setup.ts` — Auto-runs migrations in beforeAll, truncates all tables in afterEach
- `docker-compose.test.yml` — tmpfs PostgreSQL (5434), PgBouncer (6433), Redis (6380)
- `packages/shared/testing/factories.ts` — 19 factory functions with auto-parent creation
- `packages/shared/testing/factories.test.ts` — Factory unit tests

**Done:** Vitest configs (4), Docker test services, 19 factories, factory tests, integration tests (auth-flow, role-check, webhook).
**Remaining:** Additional integration test patterns, E2E scaffold, coverage threshold enforcement validation.

**Existing test files (20):** auth-flow, role-check, webhook integration tests; unit tests for roles, check-role, errors, user-operations, factories, pii-registry, verify-encryption, logger, trace-context, otel, verify-signature, sentry, middleware, job-wrapper.

---

## What Does NOT Exist Yet

**Sync Engine** — `packages/shared/sync/field-registry.ts` is empty. No platform adapters (Airtable, Notion, SmartSuite). No `toCanonical()`/`fromCanonical()` transforms. Schema tables exist but no sync logic.

**UI / Design System** — No Tailwind config, no `globals.css`, no CSS variables. No shadcn/ui components installed. `apps/web/src/components/` is empty. No Zustand stores, no TanStack Query/Virtual. The home page is just `<h1>EveryStack is running.</h1>`.

**Views / Grid / Card** — No view rendering code. Schema for `views` exists but no UI.

**Record View** — No overlay component. Schema for `record_view_configs` exists but no UI.

**Cross-Linking** — Schema for `cross_links` + `cross_link_index` exists but no resolution logic.

**Portals & Forms** — Schema exists, no implementation. No portal auth (magic link/password), no form renderer.

**Automations** — Schema for `automations` + `automation_runs` exists, no execution engine.

**Communications** — Schema for `threads` + `thread_messages` exists, no chat UI or real-time messaging.

**Documents / PDF** — Schema for `document_templates` + `generated_documents` exists, no Gotenberg integration, no merge-tag engine.

**AI Features** — `packages/shared/ai/index.ts` is empty. No AIService, no providers, no prompts, no tools.

**Platform API** — `apps/web/src/app/api/health/route.ts` exists. No v1 data endpoints.

**i18n** — `scripts/check-i18n.ts` is a stub that always passes. No translation framework, no locale files.

**Realtime** — `apps/realtime/src/index.ts` logs a startup message. No Socket.io server, no Redis adapter.

**Worker Jobs** — `apps/worker/src/index.ts` is a skeleton. Job wrapper infra exists but no BullMQ queue setup or job processors.

**E2E Tests** — `apps/web/e2e/` contains only `.gitkeep`. Playwright not configured.

**Server Actions / Data Functions** — `apps/web/src/actions/` and `apps/web/src/data/` are empty.

---

## Active Conventions

| Convention | Implementation |
|---|---|
| **Primary keys** | UUIDv7 via `generateUUIDv7()` — no serial/auto-increment anywhere |
| **ORM** | Drizzle ORM exclusively. No raw SQL outside migrations |
| **Tenant routing** | `getDbForTenant(tenantId, intent)` for every query |
| **RLS** | `setTenantContext(db, tenantId)` before tenant-scoped operations |
| **Error handling** | All errors extend `AppError` with code/statusCode/details/traceId |
| **Logging** | Pino with PII redaction. `webLogger`/`workerLogger`/`realtimeLogger` |
| **Tracing** | AsyncLocalStorage via `runWithTraceContext()`. TraceId flows to logs + OTel spans |
| **Auth** | Clerk for platform users. `getAuthContext()` resolves to internal IDs |
| **Roles** | 5-role hierarchy checked via `roleAtLeast()` or `requireRole()` |
| **Testing** | Vitest with forks pool. Factories with auto-parent creation. Mocked DB in unit tests, real DB in integration |
| **Test isolation** | `afterEach` truncates all tables. Each test creates own state via factories |
| **Coverage** | V8 provider. Per-path thresholds enforced (data: 95%, db/sync: 90%, actions: 90%, jobs: 85%) |
| **Commits** | `type(scope): description [Phase X, Prompt N]` — types: feat, chore(verify), fix |
| **Branches** | `feat/phase-XX-description` (kebab-case) |
| **Tags** | `v0.1.X-phase-YZ` |
| **Security headers** | CSP + HSTS + X-Frame-Options. Platform (strict) vs Portal (embeddable) |
| **Webhook verification** | Svix for Clerk, generic HMAC for others |

---

## How to Update This File

After every phase merge to `main`, re-run this audit:

1. Scan all directories for new files, modules, and patterns
2. Move completed phases from "In Progress" to "Complete"
3. Remove items from "What Does NOT Exist Yet" as they get built
4. Update "Active Conventions" if new patterns are established
5. Update the "Last updated" date, branch, and latest tag

Run the same comprehensive scan that generated this file — check every source file, schema, test, and config. Only document what actually exists in the repo.
