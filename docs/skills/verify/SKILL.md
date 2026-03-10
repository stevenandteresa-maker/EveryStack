---
name: everystack-verify
description: >
  Test verification process for EveryStack builds. Use this skill when running
  tests, verifying builds, fixing test failures, or checking coverage thresholds.
  Triggers on: running the test suite, verifying integration checkpoints,
  debugging test failures, checking coverage, or any task labeled "VERIFY" or
  "verification". Contains the full testing process: Docker health checks, port
  mapping, migration verification, coverage thresholds per directory, common
  failure modes and fixes, and unit vs integration separation. Load this skill
  in any Claude Code session focused on test verification — especially in
  dedicated VERIFY contexts that run after BUILD contexts.
---

# EveryStack Verify Skill

This skill encodes the complete test verification process for EveryStack.
It is the source of truth for how to run tests, interpret results, fix
failures, and verify coverage. Load this skill in VERIFY contexts (fresh
Claude Code sessions dedicated to running and fixing tests after a BUILD).

## When to Use This Skill

- **Always** when running the test suite after a build
- **Always** when debugging test failures
- **Always** in dedicated VERIFY contexts
- **Also** during BUILD contexts when running integration checkpoints
- **Never** for playbook generation, roadmap generation, or review

---

## The BUILD/VERIFY Split

The recommended workflow separates building from testing into separate contexts:

**BUILD context (Context A):**
- Load playbook section + reference docs + builder skill
- Build the feature
- Run typecheck + lint only (no Docker needed)
- Commit

**VERIFY context (Context B — fresh):**
- Load this verify skill + test-runner skill
- Run tests
- Fix failures
- Commit fixes

**Why separate:** The BUILD context needs playbook content and reference docs (~64KB). The VERIFY context needs testing knowledge and Docker awareness. Separating them keeps each context focused and within budget.

**When combined is OK:** For small prompts or quick fixes, BUILD and VERIFY can happen in the same context. Use your judgment.

---

## Verification Sequence

Run checks in this order. Each must pass before the next:

### Step 1: TypeScript Compilation
```bash
pnpm turbo typecheck
```
- Must produce zero errors
- Catches type mismatches, missing imports, schema drift
- No Docker required

### Step 2: Linting
```bash
pnpm turbo lint
```
- Must produce zero errors
- Catches: `console.log` in production code, `any` types, hardcoded English strings
- No Docker required

### Step 3: i18n Completeness (if UI changes)
```bash
pnpm turbo check:i18n
```
- Verifies no hardcoded English strings in UI components
- Only needed when components with user-facing text were changed

### Step 4: Unit Tests
```bash
pnpm turbo test -- --testPathPattern='\.test\.(ts|tsx)$' --testPathIgnorePatterns='integration'
```
- Runs unit tests only (no Docker needed)
- Fast feedback — run these first to catch obvious issues
- Timeout: 10s per test

### Step 5: Integration Tests
```bash
pnpm turbo test -- --testPathPattern='integration'
```
- **Requires Docker containers running** (see test-runner skill)
- Tests database queries, tenant isolation, API endpoints
- Timeout: 30s per test
- Each integration test creates its own database state via factories

### Step 6: Coverage Check
```bash
pnpm turbo test -- --coverage
```
- Verifies coverage thresholds are met per directory
- Run after all tests pass

### Step 7: Migration Check (if migrations changed)
```bash
pnpm turbo db:migrate:check
```
- Verifies no ACCESS EXCLUSIVE lock >1s
- Verifies no migration >30s on staging data

---

## Coverage Thresholds

These are enforced in CI and must be met locally:

| Path | Lines | Branches |
|------|-------|----------|
| `apps/web/src/data/` | 95% | 90% |
| `packages/shared/db/` | 90% | 85% |
| `packages/shared/sync/` | 90% | 85% |
| `apps/web/src/actions/` | 90% | 85% |
| `apps/worker/src/jobs/` | 85% | 80% |

**New code must have ≥80% line coverage on changed files.** This applies to all paths.

---

## Common Failure Modes and Fixes

### "Cannot connect to database" / Connection Refused
**Cause:** Docker containers not running or wrong port.
**Fix:** Run `docker compose -f docker-compose.test.yml up -d` and wait for health checks. See test-runner skill for details.

### Tenant Isolation Test Failures
**Cause:** Query missing `tenant_id` filter or RLS not applied.
**Fix:** Ensure all queries use `getDbForTenant()`. Check that the test uses `createTestTenant()` factories for both tenants.

### "Migration file not found" / Schema Mismatch
**Cause:** Drizzle migration journal (`meta/_journal.json`) missing entry for a migration file.
**Fix:** Ensure `_journal.json` includes entries for ALL migration files. Run `pnpm turbo db:migrate` against a fresh database to verify.

### Coverage Below Threshold
**Cause:** New code paths not exercised by tests.
**Fix:** Write additional test cases for uncovered branches. Use `--coverage` output to identify specific uncovered lines.

### Hardcoded English Strings (i18n)
**Cause:** User-facing text not going through next-intl.
**Fix:** Move strings to translation files and use `useTranslations()` or `getTranslations()`.

### Console.log in Production Code
**Cause:** Debug logging left in code.
**Fix:** Replace with Pino logger (`import { logger } from '@/lib/logger'`).

### TypeScript `any` Types
**Cause:** Lazy typing or untyped external data.
**Fix:** Define proper interfaces. Use Zod schemas for runtime validation of external data.

### Redis Connection Errors in Tests
**Cause:** Redis not running or wrong port.
**Fix:** Redis test port is 6380 (not default 6379). Check `REDIS_URL` env var.

### Stale .next Cache
**Cause:** Webpack cache corruption (common with Node v24).
**Fix:** `rm -rf apps/web/.next && pnpm turbo build`

---

## Test Writing Rules (from CLAUDE.md)

### Non-Negotiable
1. Every `/data` function gets a tenant isolation test via `testTenantIsolation()`
2. Tests use factories (`createTestTenant()`, `createTestRecord()`, etc.) — never raw inserts
3. Integration tests get their own database — `beforeAll` creates, `afterAll` drops
4. No test interdependence — each test creates its own state
5. Async tests must have timeouts (unit: 10s, integration: 30s, E2E: 60s)

### File Naming
| Test type | Pattern | Location |
|-----------|---------|----------|
| Unit | `[source].test.ts` | Co-located with source |
| Integration | `[feature].integration.test.ts` | `__tests__/` directories |
| E2E | `[flow].spec.ts` | `apps/web/e2e/` |
| Component | `[Component].test.tsx` | Co-located with component |

---

## Fixing Test Failures — Process

1. **Read the full error output.** Don't skim — the assertion message usually tells you exactly what's wrong.
2. **Determine: is the test wrong or the implementation?** If the test expects behavior matching the spec, the implementation needs fixing.
3. **Fix the root cause.** Don't patch symptoms.
4. **Re-run the specific failing test first** (`pnpm turbo test -- --testPathPattern='<filename>'`)
5. **Then run the full suite** to verify no regressions
6. **Commit the fix** with message: `fix: <description> [Phase X]`

---

## CI Pre-Merge Gates

All 9 must pass before merging to main:

1. TypeScript compiles with zero errors (strict mode)
2. ESLint passes with zero errors
3. i18n completeness check
4. All Tier 1 tests pass
5. All Tier 2 tests pass for changed packages
6. Coverage thresholds met
7. New code coverage ≥80% on changed files
8. Migration check passes (if migrations changed)
9. AI eval passes at ≥95% schema compliance (if prompts changed)
