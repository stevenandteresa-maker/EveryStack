# Testing Strategy & CI/CD

> **Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Replaced "createTestInterface" with "createTestApp" and tagged post-MVP. (2) Replaced "Interface permission escalation" with "Table View permission escalation" — Table Views are the access boundary per glossary. (3) Fixed E2E path: removed "board" (not a glossary concept), clarified "Base Connection". (4) Tagged formula engine references as post-MVP (dependency graph tests, recalculation perf tests, MVP — Core UX formula tests). (5) Tagged vector embedding references as post-MVP (staging seed embeddings, embedding stubs). (6) Renamed "Record expand view" → "Record View". (7) Tagged block-based portal perf test as post-MVP.

> Test priorities, tooling, CI pipeline, coverage targets, staging database management, test utilities, and configuration.
> Cross-references: `observability.md` (CI pipeline evaluation metrics), `ai-architecture.md` (AI evaluation suite), `data-model.md` (schema for test factories)
> Last updated: 2026-02-27 — Glossary reconciliation (see note above).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                          | Lines     | Covers                                                                 |
| -------------------------------- | --------- | ---------------------------------------------------------------------- |
| Test Framework                   | 34–47     | Tool selection per test layer (Vitest, Playwright, axe-core)           |
| Test File Conventions            | 48–120    | Naming patterns, directory structure, 6 test writing rules             |
| Test Utilities                   | 121–279   | Tenant isolation helper, data factories, MSW mocks, Clerk test helpers |
| Test Priority Tiers              | 280–324   | 3-tier priority system for test coverage decisions                     |
| Coverage Targets                 | 325–343   | Per-package line/branch targets, enforcement rules                     |
| Vitest Configuration             | 344–427   | Monorepo workspace setup, per-app config, test setup file              |
| Playwright Configuration         | 428–524   | E2E config, 3 viewport projects, auth setup                            |
| Docker Compose for Test Services | 525–588   | Postgres (pgvector), PgBouncer, Redis — all tmpfs-backed               |
| Accessibility Testing            | 589–630   | axe-core + Playwright WCAG 2.1 AA, mandatory a11y test pages           |
| Performance Regression Testing   | 631–692   | Query timing guards, thresholds by operation, CI behavior              |
| CI Pipeline (GitHub Actions)     | 693–886   | Workflow YAML, 9 pre-merge gates, post-merge pipeline                  |
| Staging Database Management      | 887–943   | Synthetic data seeding, staging volumes, migration testing             |
| Local Development Testing        | 944–1002  | Local dev workflow and quick-run commands                              |
| Phase Implementation             | 1003–1011 | Testing milestones per phase                                           |

---

## Test Framework

| Layer               | Tool                         | Location                                            |
| ------------------- | ---------------------------- | --------------------------------------------------- |
| Unit tests          | **Vitest**                   | `*.test.ts` co-located with source files            |
| Integration tests   | **Vitest** + test database   | `*.integration.test.ts` in `__tests__/` directories |
| E2E tests           | **Playwright**               | `apps/web/e2e/`                                     |
| API tests           | **Vitest** + supertest       | `apps/web/__tests__/api/`                           |
| Component tests     | **Vitest** + Testing Library | `*.test.tsx` co-located with components             |
| Accessibility tests | **axe-core** + Playwright    | `apps/web/e2e/a11y/`                                |
| AI evaluation       | Custom suite                 | `packages/shared/ai/evaluation/`                    |

---

## Test File Conventions

### File Naming

| Test type        | File pattern                    | Example                                        |
| ---------------- | ------------------------------- | ---------------------------------------------- |
| Unit test        | `[source].test.ts`              | `records.test.ts` next to `records.ts`         |
| Integration test | `[feature].integration.test.ts` | `__tests__/records.integration.test.ts`        |
| E2E test         | `[flow].spec.ts`                | `e2e/create-record.spec.ts`                    |
| Component test   | `[Component].test.tsx`          | `RecordCard.test.tsx` next to `RecordCard.tsx` |
| A11y test        | `[feature].a11y.spec.ts`        | `e2e/a11y/grid-view.a11y.spec.ts`              |

### Directory Structure

```
packages/shared/
  db/
    schema/
      records.ts
      records.test.ts        ← Unit test co-located
    __tests__/
      tenant-isolation.integration.test.ts  ← Integration test
  sync/
    adapters/
      airtable.ts
      airtable.test.ts       ← Adapter unit tests
    __tests__/
      round-trip.integration.test.ts
  ai/
    evaluation/
      prompt-compliance.eval.ts

apps/web/
  src/
    data/
      records.ts
      records.test.ts
      __tests__/
        records.integration.test.ts
    actions/
      record-actions.ts
      record-actions.test.ts
    components/
      grid/
        CellRenderer.tsx
        CellRenderer.test.tsx
  e2e/
    auth.setup.ts            ← Playwright global auth setup
    create-workspace.spec.ts
    sync-conflict.spec.ts
    a11y/
      grid-view.a11y.spec.ts
      portal-login.a11y.spec.ts

apps/worker/
  src/jobs/
    sync-job.ts
    sync-job.test.ts
    __tests__/
      sync-job.integration.test.ts
```

### Test Writing Rules

1. **Every `/data` function gets a tenant isolation test.** Use the `testTenantIsolation()` helper. No exceptions.
2. **Tests use factories, not raw inserts.** `createTestTenant()`, `createTestRecord()`, etc. Never hardcode UUIDs.
3. **Integration tests get their own database.** `beforeAll` creates a test database; `afterAll` drops it. Tests within a file share the DB but use unique tenant IDs.
4. **No test interdependence.** Each test creates its own state via factories. No relying on data from a previous test.
5. **Async tests must have timeout.** Default: 10s for unit, 30s for integration, 60s for E2E. Override per-test if needed.
6. **Describe blocks mirror the function/component being tested.** One describe per exported function. Nested describes for edge cases.

---

## Test Utilities

### Tenant Isolation Helper

```typescript
// packages/shared/testing/tenant-isolation.ts
import { createTestTenant, createTestUser } from './factories';

export async function testTenantIsolation<T>(
  queryFn: (tenantId: string, ...args: unknown[]) => Promise<T[]>,
  setupFn: (tenantId: string) => Promise<void>,
  queryArgs?: unknown[],
) {
  const tenantA = await createTestTenant();
  const tenantB = await createTestTenant();

  // Create data in both tenants
  await setupFn(tenantA.id);
  await setupFn(tenantB.id);

  // Query as tenant A — should return ZERO tenant B records
  const results = await queryFn(tenantA.id, ...(queryArgs ?? []));
  for (const result of results) {
    expect((result as any).tenantId).toBe(tenantA.id);
  }

  // Query as tenant B — should return ZERO tenant A records
  const resultsB = await queryFn(tenantB.id, ...(queryArgs ?? []));
  for (const result of resultsB) {
    expect((result as any).tenantId).toBe(tenantB.id);
  }
}

// Usage:
describe('getRecordsByTable', () => {
  it('enforces tenant isolation', async () => {
    await testTenantIsolation(
      (tenantId) => getRecordsByTable(tenantId, tableId),
      async (tenantId) => {
        await createTestRecord({ tenantId, tableId });
      },
    );
  });
});
```

### Test Data Factories

```typescript
// packages/shared/testing/factories.ts
import { randomUUID } from 'node:crypto';
import { getDbForTenant } from '@everystack/db/client';

let testDbConn: ReturnType<typeof getDbForTenant>;

export function getTestDb() {
  if (!testDbConn) {
    testDbConn = getDbForTenant('test', 'write');
  }
  return testDbConn;
}

export async function createTestTenant(overrides: Partial<Tenant> = {}) {
  const db = getTestDb();
  const tenant = {
    id: randomUUID(),
    name: `Test Workspace ${randomUUID().slice(0, 8)}`,
    slug: `test-${randomUUID().slice(0, 8)}`,
    plan: 'professional',
    dataRegion: 'us',
    ...overrides,
  };
  await db.insert(tenants).values(tenant);
  return tenant;
}

export async function createTestUser(overrides: Partial<User> = {}) {
  const db = getTestDb();
  const user = {
    id: randomUUID(),
    email: `test-${randomUUID().slice(0, 8)}@example.com`,
    displayName: 'Test User',
    clerkId: `clerk_${randomUUID()}`,
    ...overrides,
  };
  await db.insert(users).values(user);
  return user;
}

export async function createTestRecord(overrides: Partial<Record> = {}) {
  const db = getTestDb();
  const record = {
    id: randomUUID(),
    tenantId: overrides.tenantId ?? (await createTestTenant()).id,
    tableId: overrides.tableId ?? randomUUID(),
    canonicalData: { fields: {} },
    searchVector: null,
    createdBy: randomUUID(),
    ...overrides,
  };
  await db.insert(records).values(record);
  return record;
}

// Additional factories: createTestTable, createTestField, createTestBase,
// createTestCrossLink, createTestAutomation, createTestPortal,
// createTestPortalClient, createTestApp (post-MVP), createTestView, etc.
// Each follows the same pattern: sensible defaults, overrides, auto-create parents.
```

### Mock Clerk Session

```typescript
// packages/shared/testing/mock-clerk.ts
import { vi } from 'vitest';

export function mockClerkSession(tenantId: string, userId: string, role: string = 'manager') {
  // Mock the getTenantId() function used by every /data function
  vi.mock('@/lib/auth', () => ({
    getTenantId: vi.fn().mockResolvedValue(tenantId),
    getUserId: vi.fn().mockResolvedValue(userId),
    getUserRole: vi.fn().mockResolvedValue(role),
  }));
}

// For Playwright E2E: Clerk test mode with seeded users
// See auth.setup.ts for Playwright global auth state
```

### Mock External APIs

```typescript
// packages/shared/testing/mock-apis.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

export const airtableHandlers = [
  http.get('https://api.airtable.com/v0/:baseId/:tableId', ({ params }) => {
    return HttpResponse.json({
      records: [{ id: 'rec1', fields: { Name: 'Test Record', Status: 'Active' } }],
    });
  }),
  http.patch('https://api.airtable.com/v0/:baseId/:tableId', ({ params }) => {
    return HttpResponse.json({ records: [{ id: 'rec1', fields: {} }] });
  }),
];

export const mockApiServer = setupServer(...airtableHandlers);

// In test setup:
// beforeAll(() => mockApiServer.listen());
// afterEach(() => mockApiServer.resetHandlers());
// afterAll(() => mockApiServer.close());
```

---

## Test Priority Tiers

### Tier 1 — Mandatory (blocks merge)

These must pass before any PR merges. They protect the invariants that, if broken, cause data corruption or security breaches.

**Tenant isolation tests:** Every `/data` query function has a test that creates data for tenant A and tenant B, then verifies querying as tenant A returns zero tenant B records. Parameterized test helper: `testTenantIsolation(queryFn, setupFn)`.

**Permission boundary tests:** For each of the 5 roles, verify: what they CAN access, and what they CANNOT access. Test both data access and Server Action authorization.

**Data integrity tests:** JSONB canonical form round-trips correctly through `toCanonical()` → storage → retrieval → `fromCanonical()`. Cross-link index stays consistent with canonical*data. Formula dependency graph is acyclic *(post-MVP — formula engine)\_.

**Zod validation tests:** Every Server Action rejects malformed input. Every boundary validates tenant_id is not client-provided.

**Security tests:**

- **SQL injection via JSONB:** Verify that JSONB filter values containing SQL metacharacters do not escape the query. Test with `'; DROP TABLE records; --` in filter values.
- **XSS in canonical data:** Verify that field values containing `<script>` tags are sanitized on output, not stored raw. The canonical form stores raw; renderers must escape.
- **Portal data scope bypass:** Verify that a portal client cannot access records outside their `data_scope` by manipulating request parameters.
- **Table View permission escalation:** Verify that a Team Member cannot access records via a Table View they're not permitted to view, even if they know the Table View ID.
- **Inbound webhook signature verification:** Verify that Clerk (MVP — Foundation), Resend (Post-MVP — Documents), and Stripe (Post-MVP — Comms & Polish) webhook handlers reject payloads with invalid or missing signatures with 401.
- **Security header presence:** Verify that all responses include HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, and CSP headers. Verify portal routes use the portal-specific CSP profile.
- **RLS enforcement:** Verify that a database query without a WHERE tenant_id clause still returns only the current tenant's data when RLS is active (the `testTenantIsolation()` helper covers this).

### Tier 2 — Required (blocks merge if touching related code)

**Sync round-trip fidelity:** Per-field-type: Airtable value → `toCanonical()` → `fromCanonical()` → identical Airtable value. Mark lossy fields correctly.

**AI prompt template compliance:** Each template produces valid structured output against its Zod schema with at least 3 representative inputs.

**Real-time event delivery:** Record mutation → Redis publish → real-time service relay → client receives event within 500ms.

**Cross-link resolution:** Depth-limited traversal returns correct records at each level. Circuit breaker triggers at >1,000 records per level.

### Tier 3 — Recommended (run in CI, don't block merge)

**E2E critical paths (Playwright):** Sign up → create workspace → add Base Connection → create table → add field → create record → edit cell → verify in grid.

**Portal rendering:** Published portal loads within performance targets.

**Mobile responsive:** Key screens render correctly at 375px, 768px, 1440px breakpoints.

**Accessibility (axe-core):** Key pages pass WCAG 2.1 AA with no violations. See Accessibility Testing below.

---

## Coverage Targets

| Package/App                | Line Coverage | Branch Coverage | Enforced                 |
| -------------------------- | ------------- | --------------- | ------------------------ |
| `packages/shared/db/`      | 90%           | 85%             | Yes (blocks merge)       |
| `packages/shared/ai/`      | 80%           | 75%             | Yes                      |
| `packages/shared/sync/`    | 90%           | 85%             | Yes                      |
| `apps/web/src/data/`       | 95%           | 90%             | Yes (critical path)      |
| `apps/web/src/actions/`    | 90%           | 85%             | Yes                      |
| `apps/worker/src/jobs/`    | 85%           | 80%             | Yes                      |
| `apps/web/src/components/` | 60%           | 50%             | No (UI coverage via E2E) |
| Overall                    | 80%           | 75%             | CI warning, not blocking |

**Coverage tool:** Vitest's built-in V8 coverage provider. Reports in `lcov` format for CI integration. `istanbul` thresholds configured per workspace in `vitest.workspace.ts`.

**New code coverage:** PRs must have ≥80% line coverage on changed files. Enforced by `vitest --coverage --changed` in the CI unit-test job.

---

## Vitest Configuration

### Monorepo Workspace Setup

```typescript
// vitest.workspace.ts (root)
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/shared/vitest.config.ts',
  'apps/web/vitest.config.ts',
  'apps/worker/vitest.config.ts',
  'apps/realtime/vitest.config.ts',
]);
```

### Per-App Config

```typescript
// apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Server-side tests (data, actions)
    include: ['src/**/*.test.{ts,tsx}', '__tests__/**/*.test.ts'],
    exclude: ['e2e/**'],
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/data/**', 'src/actions/**', 'src/lib/**'],
      thresholds: {
        'src/data/': { lines: 95, branches: 90 },
        'src/actions/': { lines: 90, branches: 85 },
      },
    },
    testTimeout: 10_000, // 10s default
    hookTimeout: 30_000, // 30s for setup/teardown
    pool: 'forks', // Isolation for DB tests
    poolOptions: { forks: { singleFork: false } },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@everystack/db': path.resolve(__dirname, '../../packages/shared/db'),
    },
  },
});
```

### Test Setup File

```typescript
// apps/web/vitest.setup.ts
import { beforeAll, afterAll, afterEach } from 'vitest';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { getTestDb } from '@everystack/testing/factories';

beforeAll(async () => {
  // Run migrations on test database
  const db = getTestDb();
  await migrate(db, { migrationsFolder: '../../packages/shared/db/migrations' });
});

afterEach(async () => {
  // Clean up test data between tests (truncate, not drop)
  const db = getTestDb();
  await db.execute(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
});
```

---

## Playwright Configuration

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['list']],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup — creates Clerk test session, saves state
    { name: 'setup', testMatch: /auth\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /auth\.teardown\.ts/ },

    // Desktop tests
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['setup'],
    },

    // Tablet tests
    {
      name: 'tablet-safari',
      use: {
        ...devices['iPad Pro 11'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    // Mobile tests
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
```

### Playwright Auth Setup

```typescript
// apps/web/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

// Clerk test mode: use Clerk's testing tokens for deterministic auth
// https://clerk.com/docs/testing/overview
setup('authenticate as manager', async ({ page }) => {
  await page.goto('/sign-in');

  // Use Clerk test credentials (seeded in CI)
  await page.fill('[name="identifier"]', process.env.TEST_USER_EMAIL!);
  await page.click('button:has-text("Continue")');
  await page.fill('[name="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button:has-text("Continue")');

  // Wait for workspace redirect
  await page.waitForURL(/\/w\//);
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();

  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
```

---

## Docker Compose for Test Services

```yaml
# docker-compose.test.yml
# Used by CI and local `pnpm test:integration`
services:
  postgres-test:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: everystack_test
      POSTGRES_PASSWORD: test_password
      POSTGRES_DB: everystack_test
    ports:
      - '5433:5432' # Different port from dev
    tmpfs: /var/lib/postgresql/data # RAM-backed for speed
    healthcheck:
      test: ['CMD', 'pg_isready', '-U', 'everystack_test']
      interval: 2s
      timeout: 5s
      retries: 10

  pgbouncer-test:
    image: bitnami/pgbouncer:latest
    environment:
      POSTGRESQL_HOST: postgres-test
      POSTGRESQL_PORT: 5432
      POSTGRESQL_USERNAME: everystack_test
      POSTGRESQL_PASSWORD: test_password
      POSTGRESQL_DATABASE: everystack_test
      PGBOUNCER_POOL_MODE: transaction
      PGBOUNCER_MAX_CLIENT_CONN: 100
      PGBOUNCER_DEFAULT_POOL_SIZE: 10
    ports:
      - '6433:6432'
    depends_on:
      postgres-test:
        condition: service_healthy

  redis-test:
    image: redis:7-alpine
    ports:
      - '6380:6379' # Different port from dev
    tmpfs: /data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 2s
      timeout: 5s
      retries: 10
```

**Why tmpfs:** Test databases run in RAM (`tmpfs`) for speed. No data persistence needed — tests create and destroy their own state. This makes integration tests 3–5× faster than disk-backed PostgreSQL.

**Environment variables for tests:**

```env
# .env.test (gitignored, created by CI or local setup)
DATABASE_URL=postgres://everystack_test:test_password@localhost:5433/everystack_test
PGBOUNCER_URL=postgres://everystack_test:test_password@localhost:6433/everystack_test
REDIS_URL=redis://localhost:6380
CLERK_SECRET_KEY=sk_test_xxx  # Clerk test mode key
```

---

## Accessibility Testing

Automated WCAG 2.1 AA compliance checks using axe-core via Playwright:

```typescript
// apps/web/e2e/a11y/grid-view.a11y.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Grid View Accessibility', () => {
  test('passes WCAG 2.1 AA', async ({ page }) => {
    await page.goto('/w/test-workspace/tables/test-table');
    await page.waitForSelector('[data-testid="grid-view"]');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('.recharts-wrapper') // Chart SVGs have known issues
      .analyze();

    expect(results.violations).toEqual([]);
  });

  test('grid cells are keyboard navigable', async ({ page }) => {
    await page.goto('/w/test-workspace/tables/test-table');
    const firstCell = page.locator('[data-testid="grid-cell"]').first();
    await firstCell.focus();
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('role', 'gridcell');
  });
});
```

**Pages with mandatory a11y tests:**

- Grid view (keyboard navigation, screen reader labels)
- Record View (form field labels, focus management)
- Command Bar (ARIA roles, search announcement)
- Portal login page (form accessibility)
- Settings pages (form labels, error announcements)

---

## Performance Regression Testing

Query timing guards prevent slow queries from shipping undetected:

```typescript
// packages/shared/testing/performance.ts
export function expectQueryTime(label: string, queryFn: () => Promise<unknown>, maxMs: number) {
  it(`${label} completes within ${maxMs}ms`, async () => {
    // Warm up (first query may be slower due to query plan caching)
    await queryFn();

    const start = performance.now();
    await queryFn();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(maxMs);
  });
}

// Usage in integration tests:
describe('getRecordsByTable performance', () => {
  beforeAll(async () => {
    // Seed 10K records for performance testing
    await seedRecords(tenantId, tableId, 10_000);
  });

  expectQueryTime(
    '10K records with 3 filters',
    () => getRecordsByTable(tenantId, tableId, { filters: threeFilters }),
    200, // Must complete in 200ms
  );

  expectQueryTime(
    '10K records with tsvector search',
    () => searchRecords(tenantId, tableId, 'search term'),
    150,
  );

  expectQueryTime(
    'cross-link resolution depth 2',
    () => resolveCrossLinks(tenantId, recordId, { maxDepth: 2 }),
    500,
  );
});
```

**Performance thresholds by operation:**

| Operation                               | Max Time | Dataset Size         | Enforced                                   |
| --------------------------------------- | -------- | -------------------- | ------------------------------------------ |
| Grid page load (50 records)             | 200ms    | 10K records in table | Tier 2                                     |
| Full-text search (tsvector)             | 150ms    | 10K records in table | Tier 2                                     |
| Cross-link resolution (depth 2)         | 500ms    | 1K links per record  | Tier 2                                     |
| Record create (single)                  | 100ms    | N/A                  | Tier 2                                     |
| Portal page render (5 blocks)           | 300ms    | 5K records bound     | Tier 3 _(post-MVP — App Designer portals)_ |
| Formula recalculation chain (10 fields) | 1,000ms  | 10K records          | Tier 3 _(post-MVP — formula engine)_       |

**CI behavior:** Performance tests run against the staging-seeded test database. Failures are **warnings** (not blocking) in MVP — Foundation–3. From Post-MVP — Portals & Apps onward, Tier 2 performance tests block merge.

---

## CI Pipeline (GitHub Actions)

### Concrete Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo lint # ESLint (no-console, no-any)
      - run: pnpm turbo typecheck # tsc --noEmit (strict mode)
      - run: pnpm turbo check:i18n # No hardcoded English strings

  unit-test:
    runs-on: ubuntu-latest
    needs: lint
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: everystack_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: everystack_test
        ports:
          - 5433:5432
        options: >-
          --health-cmd "pg_isready -U everystack_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
          --tmpfs /var/lib/postgresql/data:rw
      redis:
        image: redis:7-alpine
        ports:
          - 6380:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Run migrations
        run: pnpm turbo db:migrate
        env:
          DATABASE_URL: postgres://everystack_test:test_password@localhost:5433/everystack_test
      - name: Run unit + integration tests
        run: pnpm turbo test -- --coverage
        env:
          DATABASE_URL: postgres://everystack_test:test_password@localhost:5433/everystack_test
          REDIS_URL: redis://localhost:6380
      - name: Check coverage thresholds
        run: pnpm turbo test:coverage-check
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        if: github.event_name == 'pull_request'
        with:
          files: ./coverage/lcov.info

  e2e-test:
    runs-on: ubuntu-latest
    needs: unit-test
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright browsers
        run: pnpm exec playwright install --with-deps chromium
      - name: Run E2E tests
        run: pnpm turbo test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7

  ai-eval:
    runs-on: ubuntu-latest
    needs: lint
    if: |
      contains(github.event.pull_request.changed_files, 'packages/shared/ai/prompts/')
      || contains(github.event.pull_request.changed_files, 'packages/shared/ai/tools/')
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Run AI evaluation suite
        run: pnpm turbo test:ai-eval
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
      # Fails if any template drops below 95% schema compliance

  migration-check:
    runs-on: ubuntu-latest
    needs: lint
    if: |
      contains(github.event.pull_request.changed_files, 'packages/shared/db/migrations/')
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: everystack_test
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: everystack_staging
        ports:
          - 5434:5432
        options: >-
          --health-cmd "pg_isready -U everystack_test"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Seed staging-scale data
        run: pnpm turbo db:seed-staging
        env:
          DATABASE_URL: postgres://everystack_test:test_password@localhost:5434/everystack_staging
      - name: Run migration and check timing
        run: pnpm turbo db:migrate:check
        env:
          DATABASE_URL: postgres://everystack_test:test_password@localhost:5434/everystack_staging
        # Fails if any migration acquires ACCESS EXCLUSIVE lock > 1s
        # Fails if migration takes > 30s on staging data
```

### Pre-Merge Gates (Must Pass)

1. TypeScript compiles with zero errors (strict mode)
2. ESLint passes with zero errors
3. i18n completeness check passes (no hardcoded English strings)
4. All Tier 1 tests pass
5. All Tier 2 tests pass for changed packages
6. Coverage thresholds met for changed packages
7. New code coverage ≥80% on changed files
8. Migration check passes (if migrations changed)
9. AI eval passes at ≥95% schema compliance (if prompts changed)

### Post-Merge (Main Branch)

1. Deploy to staging environment
2. Run full E2E suite against staging (all 3 viewports: desktop, tablet, mobile)
3. Run accessibility tests against staging
4. Run AI evaluation suite (full, not just changed templates)
5. Run performance regression tests against staging-seeded DB
6. If all pass: auto-deploy to production (or manual approval gate for MVP — Foundation–3)

---

## Staging Database Management

**Problem:** Tests need production-scale data volume to catch performance issues that don't appear on small datasets (partition pruning behavior, index effectiveness, query planner decisions).

**Strategy:** Staging database seeded with synthetic data matching production scale:

| Entity           | Staging Volume | Production Estimate (1K tenants) |
| ---------------- | -------------- | -------------------------------- | -------------------------------- |
| Tenants          | 500            | 1,000                            |
| Records          | 5M             | 10M+                             |
| Fields           | 10K            | 20K+                             |
| Cross-link index | 500K           | 1M+                              |
| Embeddings       | 1M             | 2M+                              | _(post-MVP — vector embeddings)_ |

**Seeding:** A `seed-staging` script generates realistic synthetic data: varied tenant sizes (10 records to 100K records), multiple field types, cross-links between tables, realistic JSONB canonical data shapes. Re-run monthly or when schema changes.

**Migration testing:** Every migration runs against the staging database before production. Timing is logged. Migrations taking >10 seconds on staging are flagged for review.

### Seed Script Structure

```typescript
// packages/shared/db/scripts/seed-staging.ts
// pnpm turbo db:seed-staging
async function seedStaging() {
  const tenantSizes = [
    { count: 300, records: 100 }, // Small tenants
    { count: 150, records: 5_000 }, // Medium tenants
    { count: 40, records: 50_000 }, // Large tenants
    { count: 10, records: 200_000 }, // Enterprise tenants
  ];

  for (const tier of tenantSizes) {
    for (let i = 0; i < tier.count; i++) {
      const tenant = await createStagingTenant();
      const base = await createStagingBase(tenant.id);
      const tables = await createStagingTables(base.id, 5); // 5 tables per base

      for (const table of tables) {
        const fields = await createStagingFields(table.id, 15); // 15 fields per table
        await createStagingRecords(tenant.id, table.id, fields, tier.records / tables.length);
      }

      // Cross-links between tables (10% of records linked)
      await createStagingCrossLinks(tenant.id, tables, Math.floor(tier.records * 0.1));
    }
  }

  // Build search vectors and embedding stubs (post-MVP — vector embeddings)
  await rebuildAllSearchVectors();
  await createEmbeddingStubs(); // post-MVP

  console.log('Staging seed complete');
}
```

---

## Local Development Testing

### Commands

```bash
# Run all unit tests
pnpm turbo test

# Run tests for a specific package
pnpm turbo test --filter=@everystack/web

# Run integration tests (requires Docker services)
docker compose -f docker-compose.test.yml up -d
pnpm turbo test:integration

# Run E2E tests locally
pnpm turbo test:e2e

# Run with coverage
pnpm turbo test -- --coverage

# Run specific test file
pnpm vitest run src/data/records.test.ts

# Watch mode (re-runs on file change)
pnpm vitest watch
```

### Turborepo Test Tasks

```json
// turbo.json (test-related tasks)
{
  "tasks": {
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
}
```

---

## Phase Implementation

| Phase                     | Testing Work                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP — Foundation          | Vitest workspace setup (`vitest.workspace.ts`), Docker Compose test services, test factories (`createTestTenant`, `createTestUser`, `createTestRecord`), `testTenantIsolation()` helper, mock Clerk session utility, Tier 1 tests for all `/data` functions, CI pipeline (GitHub Actions: lint → typecheck → unit-test → migration-check), basic staging seed script, `.env.test` template. Playwright skeleton (config + auth setup, no E2E tests yet). |
| MVP — Sync                | Sync round-trip tests per field type (Airtable, Notion), MSW mock API server setup, rate limiter tests, integration tests with mock external APIs, performance regression tests for query timing.                                                                                                                                                                                                                                                        |
| MVP — Core UX             | Playwright E2E for critical paths (create workspace → create table → add record → edit cell), component tests for grid cell renderers, cross-link resolution tests, formula engine tests _(post-MVP)_ (dependency graph, circular detection, recalculation), AI eval pipeline, accessibility tests (grid view, record expand).                                                                                                                           |
| Post-MVP — Portals & Apps | Portal auth flow tests (magic link, session, data_scope), portal rendering tests, cookie security tests.                                                                                                                                                                                                                                                                                                                                                 |
| Post-MVP — Comms & Polish | Full E2E suite (all viewports: desktop + tablet + mobile), comprehensive accessibility audit, performance benchmarks on staging-scale data, automated deployment pipeline with approval gates.                                                                                                                                                                                                                                                           |
