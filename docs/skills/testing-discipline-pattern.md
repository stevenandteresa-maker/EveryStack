---
name: testing-discipline-pattern
category: testing
derivedFrom:
  - doc: CLAUDE.md
    section: Testing Rules
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: Non-Negotiable Testing Rules
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Testing Discipline Pattern

EveryStack enforces comprehensive testing discipline with strict rules for tenant isolation, factory usage, coverage requirements, and test organization. Every data access function must include tenant isolation tests.

## Convention Rules

- Every data access function MUST have a tenant isolation test using testTenantIsolation() helper
- Tests MUST use factories, never raw database inserts
- MUST NOT hardcode UUIDs in tests — always use factories
- Integration tests MUST get their own database (setupTestDb creates, teardownTestDb drops)
- MUST NOT have test interdependence — each test creates its own state via factories
- All async tests MUST have timeouts (Unit: 10s, Integration: 30s, E2E: 60s)
- New code MUST have ≥80% line coverage on changed files
- Test files MUST follow naming conventions based on test type
- MUST use Vitest for unit/integration, Playwright for E2E, axe-core for accessibility

## Pattern Templates

Covers Test File Naming Pattern, Tenant Isolation Test Pattern, Factory Usage Pattern, Integration Test Setup Pattern, Coverage Configuration Pattern, E2E Test Pattern.

### Test File Naming Pattern
```
// Unit tests - co-located with source
src/
├── lib/
│   ├── database-client.ts
│   ├── database-client.test.ts     # Unit test
│   ├── auth-helpers.ts
│   └── auth-helpers.test.ts

// Integration tests - __tests__ directories
src/
├── app/
│   └── api/
│       └── users/
│           ├── route.ts
│           └── __tests__/
│               └── route.integration.test.ts

// E2E tests - co-located with components
src/
├── components/
│   ├── UserProfile.tsx
│   └── UserProfile.e2e.test.ts

// Accessibility tests - co-located
src/
├── components/
│   ├── Button.tsx
│   └── Button.a11y.test.ts
```

### Tenant Isolation Test Pattern
```typescript
import { testTenantIsolation } from '@/lib/test-helpers';
import { createUser, createTenant } from '@/lib/factories';

describe('getUsersByTenant', () => {
  it('enforces tenant isolation', async () => {
    await testTenantIsolation(async (tenantId) => {
      // This helper ensures the function only returns data for the specified tenant
      return await getUsersByTenant(tenantId);
    });
  });

  it('returns users for valid tenant', async () => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id });
    
    const result = await getUsersByTenant(tenant.id);
    
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(user.id);
  });
});
```

### Factory Usage Pattern
```typescript
// ✅ Use factories for test data
import { createUser, createWorkspace, createTable } from '@/lib/factories';

it('creates cross-link between tables', async () => {
  const tenant = await createTenant();
  const workspace = await createWorkspace({ tenantId: tenant.id });
  const sourceTable = await createTable({ workspaceId: workspace.id });
  const targetTable = await createTable({ workspaceId: workspace.id });
  
  const crossLink = await createCrossLink({
    sourceTableId: sourceTable.id,
    targetTableId: targetTable.id,
  });
  
  expect(crossLink.sourceTableId).toBe(sourceTable.id);
});

// ❌ Don't use raw inserts or hardcoded UUIDs
// const userId = '123e4567-e89b-12d3-a456-426614174000'; // Hardcoded UUID
// await db.insert(users).values({ id: userId, ... }); // Raw insert
```

### Integration Test Setup Pattern
```typescript
import { setupTestDb, teardownTestDb } from '@/lib/test-helpers';

describe('User API Integration', () => {
  let testDb: Database;
  
  beforeAll(async () => {
    testDb = await setupTestDb();
  }, 30000); // 30s timeout for integration tests
  
  afterAll(async () => {
    await teardownTestDb(testDb);
  });
  
  beforeEach(async () => {
    // Each test gets clean state via factories
    // No shared state between tests
  });
  
  it('creates user successfully', async () => {
    const tenant = await createTenant();
    const userData = {
      email: 'test@example.com',
      tenantId: tenant.id,
    };
    
    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);
      
    expect(response.body.email).toBe(userData.email);
  }, 30000);
});
```

### Coverage Configuration Pattern
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/migrations/**',
      ],
    },
    timeout: {
      unit: 10000,      // 10s for unit tests
      integration: 30000, // 30s for integration tests
    },
  },
});
```

### E2E Test Pattern
```typescript
import { test, expect } from '@playwright/test';
import { createTenant, createUser } from '@/lib/factories';

test.describe('User Profile', () => {
  test('displays user information correctly', async ({ page }) => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id });
    
    await page.goto(`/profile/${user.id}`);
    
    await expect(page.getByText(user.email)).toBeVisible();
    await expect(page.getByRole('heading', { name: user.name })).toBeVisible();
  });
}, 60000); // 60s timeout for E2E tests
```

## Validation Criteria

- Every data access function has a corresponding tenant isolation test
- All test data is created using factories, never raw database inserts
- No hardcoded UUIDs appear in test files
- Integration tests use setupTestDb/teardownTestDb for database isolation
- Test files follow naming conventions (*.test.ts, *.integration.test.ts, *.e2e.test.ts, *.a11y.test.ts)
- All async tests have appropriate timeouts configured
- Coverage thresholds are met for all changed files (≥80%)
- Tests are independent — no shared state between test cases
- Accessibility tests use axe-core for automated a11y checking