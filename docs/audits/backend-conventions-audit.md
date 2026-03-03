# Backend Conventions Audit

**Date:** 2026-03-02
**Scope:** All code built through Phase 1E (current branch: `feat/phase-1e-testing-infrastructure`)
**Skill audited:** `docs/skills/backend/SKILL.md`
**Result:** 12 conventions followed, 10 deviations found

---

## Conventions Followed

1. **UUIDv7 primary keys** — All 50 tables use `uuid('id').primaryKey().$defaultFn(generateUUIDv7)`. Zero serial, bigserial, or auto-increment anywhere in the codebase.
2. **Composite PKs for partitioned tables** — `records` (hash by tenant_id), `ai_usage_log`, `audit_log`, `api_request_log` (range by created_at) all include partition key in composite PK.
3. **tenant_id on tenant-scoped tables** — 40 of 50 tables have `tenant_id` referencing `tenants.id`. The 10 without are either global entities (`tenants`, `users`) or join/child tables reachable through a parent with tenant_id.
4. **getDbForTenant() for all DB access** — `packages/shared/db/client.ts` exports `getDbForTenant(tenantId, intent)` with read/write routing. All data access goes through this helper.
5. **RLS policies** — `packages/shared/db/rls.ts` defines policies for 41 tenant-scoped tables. Migration `0011_enable_rls_policies.sql` enables RLS. `setTenantContext()` sets the GUC before tenant-scoped operations.
6. **No advisory locks** — Zero instances of `pg_advisory_lock`, `advisory_lock`, or similar patterns anywhere in the codebase.
7. **No LISTEN/NOTIFY** — Zero instances. Redis pub/sub is the designated alternative.
8. **No raw SQL in application code** — All `sql` template literals are confined to migrations, RLS setup, schema index definitions, and test setup. Application queries use Drizzle ORM exclusively.
9. **Migrations never modified** — All 12 migrations (0000-0011) are original and unmodified. No destructive ALTER operations found.
10. **Structured error handling** — All errors extend `AppError` base class (`packages/shared/errors/index.ts`). Six concrete subclasses: `ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`, `RateLimitedError`, `InternalError`. `ERROR_CODES` constants defined.
11. **No console.log in production** — Zero `console.log`, `console.error`, or `console.warn` calls in production code. All logging uses Pino (`webLogger`, `workerLogger`, `realtimeLogger`) with PII redaction.
12. **File naming conventions** — All source files use kebab-case. Functions use camelCase. Database columns use snake_case. Constants use SCREAMING_SNAKE_CASE. `@everystack/` imports used correctly for shared packages. No circular imports detected.

---

## Deviations Found

### 1. Soft delete uses `deletedAt` instead of `archived_at`

- **What the skill says:** Use `archived_at` for soft deletes, not `deleted_at`.
- **What the code does:** Two tables (`records`, `thread_messages`) use `deletedAt` mapped to column `deleted_at`.
- **Where:**
  - `packages/shared/db/schema/records.ts` line 46
  - `packages/shared/db/schema/thread-messages.ts` line 33
- **Risk level:** MEDIUM — Renaming columns later requires a migration + code sweep across all consumers. Easier to fix now while no application code reads these columns yet.
- **Suggested fix:** Create a migration renaming `deleted_at` to `archived_at` on both tables, update schema definitions to use `archivedAt`.

---

### 2. Zod validation not used anywhere

- **What the skill says:** All external inputs validated with Zod at the boundary. API routes and Server Actions always validate input.
- **What the code does:** Zod is installed (`zod@4.3.6` in lockfile) but zero `.parse()`, `.safeParse()`, or `z.object()` calls exist in the codebase.
- **Where:** Entire `apps/web/src/` and `packages/shared/` — no Zod usage found.
- **Risk level:** LOW — Currently only two API routes exist (`/api/health` which takes no input, `/api/webhooks/clerk` which validates via Svix signatures). No Server Actions or data mutation endpoints exist yet. But the pattern must be established before Phase 2 adds mutation routes.
- **Suggested fix:** Not actionable yet. Flag as "must establish with first mutation endpoint" — add a Zod validation example to the testing skill or a reference test.

---

### 3. `testTenantIsolation()` helper does not exist

- **What the skill says:** Every data access function MUST include `testTenantIsolation()` in its acceptance criteria. No exceptions.
- **What the code does:** No `testTenantIsolation` function is defined or exported anywhere. One test (`check-role.test.ts`) manually tests cross-tenant access, but does not use a reusable helper.
- **Where:** `packages/shared/testing/` — the helper is missing. `apps/web/src/data/` is empty (no data functions to test yet).
- **Risk level:** HIGH — This is a "no exceptions" rule. If data access functions are written before this helper exists, they will ship without isolation tests. The helper must exist before Phase 2.
- **Suggested fix:** Implement `testTenantIsolation()` in `packages/shared/testing/` that accepts setup/query callbacks and verifies cross-tenant access returns empty results.

---

### 4. Hardcoded UUIDs in test files

- **What the skill says:** Never hardcode UUIDs in tests — use factories.
- **What the code does:** Two test files define arrays of hardcoded UUIDs to mock `generateUUIDv7()` for deterministic signature verification.
- **Where:**
  - `apps/web/src/__tests__/webhook-user-created.integration.test.ts` lines 61-65 (`MOCK_UUIDS` array)
  - `packages/shared/db/operations/user-operations.test.ts` lines 15-20 (`mockUUIDs` array)
- **Risk level:** LOW — These are used for deterministic cryptographic signature generation where the test needs to predict exact UUIDs. The pattern is intentional, but violates the letter of the rule.
- **Suggested fix:** Add a `createDeterministicUUIDGenerator()` helper in `packages/shared/testing/` that produces predictable UUIDs from a seed, replacing the raw arrays.

---

### 5. `board_memberships` table missing `tenant_id`

- **What the skill says:** Every table that stores tenant data MUST have `tenant_id`. No exceptions.
- **What the code does:** `board_memberships` has `board_id` and `user_id` but no `tenant_id` column. The parent `boards` table does have `tenant_id`, so isolation is achievable via JOIN — but not directly enforceable via RLS on this table.
- **Where:** `packages/shared/db/schema/board-memberships.ts` lines 14-30
- **Risk level:** MEDIUM — RLS cannot be applied directly to this table without `tenant_id`. Queries must always JOIN through `boards` to enforce isolation, which is fragile and easy to forget.
- **Suggested fix:** Add `tenant_id` column referencing `tenants.id` and add an RLS policy. Create a new migration (do not modify existing ones).

---

### 6. Raw `new Error()` throws in startup code

- **What the skill says:** All errors use `AppError` with `ErrorCode`. Never throw raw strings or generic Errors.
- **What the code does:** Two files throw raw `new Error()` for startup/initialization checks.
- **Where:**
  - `packages/shared/compliance/verify-encryption.ts` lines 57, 65 — TLS verification checks
  - `packages/shared/db/client.ts` line 13 — missing environment variable check
- **Risk level:** LOW — These are startup-time only, never in request handlers. They crash the process on boot, which is the correct behavior. Using `AppError` would add no value here since there's no HTTP response context.
- **Suggested fix:** Acceptable as-is for initialization code. Optionally wrap in `InternalError` for consistency, but not required.

---

### 7. Duplicate files (macOS artifacts)

- **What the skill says:** (Implicitly) Clean, organized file structure with one file per domain.
- **What the code does:** 13 duplicate files with " 2" suffix exist from macOS Finder save conflicts.
- **Where:**
  - **Schema (9 files):** `ai-credit-ledger 2.ts`, `ai-usage-log 2.ts`, `api-keys 2.ts`, `api-request-log 2.ts`, `audit-log 2.ts`, `command-bar-sessions 2.ts`, `feature-suggestions 2.ts`, `feature-votes 2.ts`, `user-recent-items 2.ts` — all in `packages/shared/db/schema/`
  - **Migrations (2 files):** `0010_curly_ultragirl 2.sql`, `0011_enable_rls_policies 2.sql` — in `packages/shared/db/migrations/`
  - **DB (1 file):** `rls 2.ts` — in `packages/shared/db/`
  - **Root (1 file):** `pnpm-lock 2.yaml`
- **Risk level:** MEDIUM — Duplicate migration files could confuse Drizzle tooling. Duplicate schema files are not imported but add noise. The duplicate lockfile could cause install confusion.
- **Suggested fix:** Delete all 13 duplicate files. Add `* 2.*` to `.gitignore` to prevent recurrence.

---

### 8. `tsvector` PostgreSQL-specific type in records schema

- **What the skill says:** No PostgreSQL-specific syntax in application queries. CockroachDB safeguard #2.
- **What the code does:** A custom `tsvector` Drizzle type is defined and used as a column on the `records` table.
- **Where:** `packages/shared/db/schema/records.ts` lines 17-21 (type definition), line 45 (`searchVector` column)
- **Risk level:** LOW — The column exists in the schema but has no GIN/GIST index, no application code reads or writes to it, and full-text search is not implemented. It's a placeholder for post-MVP search. CockroachDB does not support `tsvector`.
- **Suggested fix:** Document this as a known CockroachDB migration item. When FTS is implemented, use an external search service (Meilisearch/Elasticsearch) instead of tsvector. No action needed now.

---

### 9. Missing timestamps on some tables

- **What the skill says:** Always include both `created_at` and `updated_at` timestamps.
- **What the code does:** Several tables are missing one or both standard timestamps.
- **Where:**
  - `user_tasks` (`packages/shared/db/schema/user-tasks.ts`) — NO timestamps at all (only `dueDate`)
  - `board_memberships` (`packages/shared/db/schema/board-memberships.ts`) — only `grantedAt`, no `created_at`/`updated_at`
  - `user_view_preferences`, `user_notification_preferences`, `ai_credit_ledger` — only `updated_at`, no `created_at`
  - 11 tables have `created_at` but no `updated_at`
- **Risk level:** LOW — These tables have no application logic yet. Missing timestamps make auditing harder but don't break functionality.
- **Suggested fix:** Add `created_at` and `updated_at` to tables that are missing them, prioritizing `user_tasks` and `board_memberships`. Batch into a single migration.

---

### 10. Several tables missing from RLS coverage

- **What the skill says:** Every tenant-scoped table gets a Row-Level Security policy.
- **What the code does:** `rls.ts` defines policies for 41 tables, but a few tenant-scoped tables may be missing direct RLS policies due to not having `tenant_id` (e.g., `board_memberships`, `thread_participants`, `thread_messages`, `automation_runs`). These rely on foreign key JOINs for isolation instead of direct RLS.
- **Where:**
  - `packages/shared/db/rls.ts` — 41 tables covered
  - `board_memberships` — no `tenant_id`, no RLS
  - `thread_participants`, `thread_messages`, `automation_runs` — no `tenant_id`, no direct RLS
- **Risk level:** MEDIUM — Tables without `tenant_id` cannot have RLS policies. Isolation depends on application-layer JOINs, which is a weaker guarantee. Any direct query on these tables without a JOIN is a potential tenant leak.
- **Suggested fix:** Add `tenant_id` to `board_memberships`, `thread_participants`, `thread_messages`, and `automation_runs`. Add RLS policies for each. This is the same pattern used everywhere else.

---

## Summary

The codebase has a **strong foundation** — the critical CockroachDB safeguards (UUIDv7, no advisory locks, no PG-specific syntax in app code, hash partitioning) are all properly implemented. Error handling is well-structured with a clean class hierarchy. Logging is disciplined with zero console usage. File organization and naming conventions are excellent.

**Before starting Phase 2, fix these HIGH-risk items:**

1. **Implement `testTenantIsolation()` helper** — This is a "no exceptions" rule and the helper doesn't exist. Every data access function in Phase 2 will need it. (Deviation #3)
2. **Delete 13 duplicate files** — Duplicate migration files risk confusing Drizzle. Quick cleanup commit. (Deviation #7)
3. **Add `tenant_id` to tables missing it** — `board_memberships`, `thread_participants`, `thread_messages`, `automation_runs` lack direct tenant isolation. Add the column + RLS policies in a new migration. (Deviations #5 and #10)

The remaining deviations (soft delete naming, missing timestamps, tsvector, raw Error throws, Zod not yet used, hardcoded test UUIDs) are LOW-MEDIUM risk and can be addressed in a cleanup sprint or as part of Phase 2 setup.
