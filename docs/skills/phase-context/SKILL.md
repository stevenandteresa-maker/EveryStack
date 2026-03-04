---
name: everystack-phase-context
description: Current build state for EveryStack. Load this skill at the start of every build prompt. It documents what exists in the codebase right now — files, modules, patterns, conventions — so Claude Code doesn't have to rediscover it each time.
---

# EveryStack — Phase Context

**Last updated:** 2026-03-04
**Branch:** `docs/scope-updates` (PR #13 → main)
**Latest tag:** `v0.1.5-phase-1f`
**Total commits:** 22 (17 on main + 5 on docs/scope-updates)

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

Full Drizzle ORM schema (59 tables), 16 SQL migrations, RLS, connection pooling, tenant routing.

**Key files:**
- `packages/shared/db/client.ts` — `getDbForTenant(tenantId, intent)` routing, PgBouncer clients
- `packages/shared/db/rls.ts` — `setTenantContext()`, 47 tenant-scoped tables with RLS policies, `RLS_EXCLUDED_COLUMNS`
- `packages/shared/db/uuid.ts` — `generateUUIDv7()` (all PKs are UUIDv7)
- `packages/shared/db/schema/` — 59 Drizzle table definitions (50 MVP + 2 feature management + 7 platform admin)
- `packages/shared/db/migrations/` — 16 migrations (0000–0015 original + 0015–0018 scope updates)
- `packages/shared/db/operations/user-operations.ts` — `createUserWithTenant()` (now provisions personal tenant), `updateUserFromClerk()`
- `packages/shared/db/drizzle.config.ts` — Migration config (uses DATABASE_URL_DIRECT for DDL)

**Schema highlights:** `records` hash-partitioned into 16 partitions by `tenant_id`. `audit_log`, `ai_usage_log`, `api_request_log` time-partitioned monthly. Canonical JSONB pattern: `records.canonical_data` keyed by `fields.id`.

**Patterns established:** `getDbForTenant()` for all DB access, `setTenantContext()` before RLS queries, UUIDv7 everywhere, composite PKs on partitioned tables, no raw SQL outside migrations. Admin-only tables intentionally skip RLS (accessed only via `/admin` routes).

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

### Phase 1E — Testing Infrastructure (Complete)

Vitest monorepo config, Docker test services, comprehensive test data factories.

**Key files:**
- `vitest.workspace.ts` — Root workspace referencing 4 package configs
- `packages/shared/vitest.config.ts` — Forks pool, V8 coverage (db: 90/85%, sync: 90/85%)
- `apps/web/vitest.config.ts` — Forks pool, coverage (data: 95/90%, actions: 90/85%), env fallbacks for CI
- `apps/worker/vitest.config.ts` — Coverage (jobs: 85/80%)
- `apps/realtime/vitest.config.ts` — passWithNoTests: true
- `apps/web/vitest.setup.ts` — Auto-runs migrations in beforeAll, truncates all tables in afterEach
- `docker-compose.test.yml` — tmpfs PostgreSQL (5434), PgBouncer (6433), Redis (6380)
- `packages/shared/testing/factories.ts` — 19 factory functions with auto-parent creation (`createTestTenant`, `createTestUser`, `createTestWorkspace`, `createTestRecord`, `createTestTable`, `createTestField`, `createTestBase`, `createTestView`, `createTestCrossLink`, `createTestRecordViewConfig`, `createTestPortal`, `createTestForm`, `createTestAutomation`, `createTestDocumentTemplate`, `createTestThread`, `createTestApiKey`)
- `packages/shared/testing/tenant-isolation.ts` — `testTenantIsolation()` helper — **mandatory for every `/data` function** (see CLAUDE.md non-negotiable rules)
- `packages/shared/testing/mock-clerk.ts` — `mockClerkSession()`, `mockClerkSessionWithUser()`, `clearClerkMocks()`, `getMockAuthContext()`, `getMockRole()`, `hasMockSession()`
- `packages/shared/testing/mock-apis.ts` — MSW handlers per platform (`airtableHandlers`, `notionHandlers`, `smartsuiteHandlers`), `mockApiServer`, `setupMockApis()`
- `packages/shared/testing/mock-uuid.ts` — `createMockUUIDs()` for deterministic UUIDs in tests
- `packages/shared/testing/performance.ts` — `expectQueryTime()` for query performance assertions
- `packages/shared/testing/a11y.ts` — `checkAccessibility()` wrapper around axe-core
- `packages/shared/testing/factories.test.ts` — Factory unit tests

**All utilities exported from `@everystack/shared/testing`** — import from the package, not individual files.

**Patterns established:** Vitest configs (4), Docker test services, 19 factories with auto-parent creation, tenant isolation testing helper, Clerk session mocking, MSW-based platform API mocking, performance + a11y test helpers. Integration tests: auth-flow, role-check, webhook.

### Phase 1F — Design System Foundation & i18n (Complete)

Tailwind token system, shadcn/ui primitives, application shell, i18n framework.

**Key files:**
- `apps/web/tailwind.config.ts` — CSS custom properties, DM Sans/JetBrains Mono fonts, Obsidian Teal surface tokens, accent/data-color layers, responsive breakpoints (phone/tablet/desktop)
- `apps/web/src/app/globals.css` — CSS custom properties for surface tokens, accent color, sidebar colors
- `apps/web/src/lib/design-system/colors.ts` — 8 workspace accent colors, 13-color data palette, contrast map, `applyAccentColor()`, `getDataColor()`, `getContrastText()`
- `apps/web/src/lib/design-system/typography.ts` — 9-step type scale (page-title through timestamp)
- `apps/web/src/lib/design-system/breakpoints.ts` — 3 semantic breakpoints (phone <768, tablet >=768, desktop >=1440)
- `apps/web/src/lib/design-system/index.ts` — Re-exports all design system constants
- `apps/web/src/lib/fonts.ts` — DM Sans + JetBrains Mono via next/font/google
- `apps/web/src/components/ui/` — 16 shadcn/ui primitives (badge, button, card, command, dialog, dropdown-menu, input, label, popover, scroll-area, select, separator, sheet, skeleton, tabs, tooltip)
- `apps/web/src/components/layout/app-shell.tsx` — Root layout: dark sidebar + accent header + white content
- `apps/web/src/components/layout/sidebar.tsx` — Collapsible sidebar (48px/280px), workspace nav
- `apps/web/src/components/layout/header.tsx` — Accent-colored header (52px), command bar placeholder
- `apps/web/src/components/layout/main-content.tsx` — White content area
- `apps/web/src/stores/sidebar-store.ts` — Zustand store for sidebar collapsed state
- `apps/web/messages/en.json` — English translations
- `apps/web/messages/es.json` — Spanish translations
- `apps/web/src/i18n/request.ts` — next-intl request config (non-routing locale strategy)
- `apps/web/src/test-utils/intl-wrapper.tsx` — IntlWrapper for component testing with translations
- `scripts/check-i18n.ts` — AST-based CI script enforcing zero hardcoded English strings in UI code
- `apps/web/components.json` — shadcn/ui CLI config

**Patterns established:** Three-layer color architecture (workspace accent, semantic/process, data palette). CSS custom properties for all tokens. `applyAccentColor()` for runtime theme switching. next-intl with non-routing locale strategy. `check:i18n` CI gate active. IntlWrapper for test isolation.

### Scope Updates (PR #13 — docs/scope-updates)

Schema expansions, personal tenant provisioning, Platform Owner Console, Support System, and comprehensive naming/convention audit.

**New schemas (9 tables):**
- `packages/shared/db/schema/support-requests.ts` — Support tickets with priority/status/category
- `packages/shared/db/schema/support-request-messages.ts` — Threaded messages on support requests
- `packages/shared/db/schema/ai-support-sessions.ts` — AI support session audit trail
- `packages/shared/db/schema/feature-requests.ts` — Aggregated feature request log
- `packages/shared/db/schema/admin-impersonation-sessions.ts` — "View as Tenant" admin sessions
- `packages/shared/db/schema/tenant-feature-flags.ts` — Per-tenant feature flag overrides
- `packages/shared/db/schema/tenant-enterprise-config.ts` — Enterprise SLA config
- `packages/shared/db/schema/platform-notices.ts` — Platform-wide announcements
- `packages/shared/db/schema/user-dismissed-notices.ts` — User notice dismissal tracking

**New migrations (4):**
- `0015_update_thread_participants_for_external_contacts.sql` — `participant_type`, `external_contact_id` columns, identity check constraint
- `0016_platform_owner_console.sql` — Platform Owner Console tables + tenant billing columns
- `0017_support_system.sql` — Support System tables
- `0018_rename_indexes_consistency.sql` — Index naming consistency pass

**Schema modifications:**
- `tenants.ts` — Added billing/subscription columns (`stripe_customer_id`, `subscription_status`, `trial_ends_at`, `plan_override`, `support_tier`), churn tracking (`churn_risk_flag`, `first_active_at`, `last_active_at`, `admin_notes`), `is_internal` flag
- `users.ts` — Added `is_platform_admin`, `is_support_agent` boolean columns
- `thread-participants.ts` — Made `user_id` nullable, added `participant_type` + `external_contact_id` for external contacts

**Key logic changes:**
- `user-operations.ts` — `createUserWithTenant()` now auto-provisions a personal tenant (reserved stub, no UI surface). Returns `personalTenantId`.
- `rls.ts` — Updated to 47 tenant-scoped tables. Added `RLS_EXCLUDED_COLUMNS` (hides `is_platform_admin`, `is_support_agent` from tenant queries). Documented 6 admin-only tables that intentionally skip RLS.

**New reference docs:**
- `docs/reference/platform-owner-console.md` — Full spec for platform admin dashboard
- `docs/reference/support-system.md` — 3-tier support architecture (AI → human → admin escalation)

**Audit fixes (commit 175468c):**
- Naming conventions standardized across all reference docs
- Schema drift corrections between Drizzle schemas and data-model.md
- RLS documentation aligned with actual policies
- Scope labels standardized (no more phase numbers in reference docs)

---

## What Does NOT Exist Yet

**Sync Engine** — `packages/shared/sync/field-registry.ts` is empty. No platform adapters (Airtable, Notion, SmartSuite). No `toCanonical()`/`fromCanonical()` transforms. Schema tables exist but no sync logic.

**UI / Design System** — Tailwind config, globals.css, CSS custom properties, and 16 shadcn/ui primitives are installed. Application shell (sidebar, header, content) exists. No TanStack Query/Virtual yet. No Zustand stores beyond sidebar-store.

**Views / Grid / Card** — No view rendering code. Schema for `views` exists but no UI.

**Record View** — No overlay component. Schema for `record_view_configs` exists but no UI.

**Cross-Linking** — Schema for `cross_links` + `cross_link_index` exists but no resolution logic.

**Portals & Forms** — Schema exists, no implementation. No portal auth (magic link/password), no form renderer.

**Automations** — Schema for `automations` + `automation_runs` exists, no execution engine.

**Communications** — Schema for `threads` + `thread_messages` + `thread_participants` (with external contact support) exists, no chat UI or real-time messaging.

**Documents / PDF** — Schema for `document_templates` + `generated_documents` exists, no Gotenberg integration, no merge-tag engine.

**AI Features** — `packages/shared/ai/index.ts` is empty. No AIService, no providers, no prompts, no tools.

**Platform Owner Console** — Schemas and reference doc exist (`platform-owner-console.md`). No admin UI, no Stripe integration, no impersonation flow.

**Support System** — Schemas and reference doc exist (`support-system.md`). No support UI, no AI support chatbot, no escalation flow.

**Platform API** — `apps/web/src/app/api/health/route.ts` exists. No v1 data endpoints.

**i18n** — next-intl installed with non-routing locale strategy. `en.json` + `es.json` locale files exist. `check:i18n` CI gate enforces zero hardcoded English strings. IntlWrapper available for testing.

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
| **RLS** | `setTenantContext(db, tenantId)` before tenant-scoped operations. 47 tenant-scoped tables. 6 admin-only tables skip RLS intentionally |
| **RLS column exclusion** | `RLS_EXCLUDED_COLUMNS` in `rls.ts` — hide `is_platform_admin`, `is_support_agent` from tenant queries |
| **Admin tables** | Admin-only tables (support_requests, admin_impersonation_sessions, etc.) have no RLS — accessed only via `/admin` routes |
| **Personal tenants** | Auto-provisioned on user creation. `settings.personal = true`. Reserved stub, no UI surface yet |
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
| **Design tokens** | CSS custom properties in globals.css. Three-layer color: accent, semantic, data palette |
| **Typography** | DM Sans (UI), JetBrains Mono (code). 9-step scale in `design-system/typography.ts` |
| **UI primitives** | 16 shadcn/ui components in `components/ui/`. Extend via composition, never recreate |
| **i18n** | next-intl, non-routing locale strategy. All user-facing text through `useTranslations()`. `check:i18n` CI gate |
| **Shell layout** | Dark sidebar (48/280px) + accent header (52px) + white content. `block-size: 100dvh` |

---

## How to Update This File

After every phase merge to `main`, re-run this audit:

1. Scan all directories for new files, modules, and patterns
2. Move completed phases from "In Progress" to "Complete"
3. Remove items from "What Does NOT Exist Yet" as they get built
4. Update "Active Conventions" if new patterns are established
5. Update the "Last updated" date, branch, and latest tag

Run the same comprehensive scan that generated this file — check every source file, schema, test, and config. Only document what actually exists in the repo.
