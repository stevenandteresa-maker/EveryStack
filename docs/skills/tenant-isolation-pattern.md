---
name: tenant-isolation-pattern
category: data-pattern
derivedFrom:
  - doc: docs/reference/data-model.md
    section: Database Schema — MVP Entities
    sourceHash: placeholder
  - doc: docs/reference/permissions.md
    section: Tenant Isolation
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: Architecture Fundamentals
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Tenant Isolation Pattern

Every data table in EveryStack enforces strict tenant isolation through a tenant_id column and Row-Level Security (RLS) policies. This ensures complete data separation between tenants at the database level.

## Convention Rules

- All data tables MUST include a tenant_id column of type UUIDv7
- All queries MUST use getTenantDb() for read/write routing — never bypass tenant routing
- Row-Level Security (RLS) policies MUST enforce tenant isolation at the database level
- Cross-tenant access attempts MUST return 404 (not found) rather than 403 (forbidden) to prevent enumeration attacks
- Every data access function MUST have a tenant isolation test using the testTenantIsolation() helper
- Portal clients MUST be scoped to a single tenant via tenant_id verification on every query

## Pattern Templates

Covers Table Schema Pattern, Database Access Pattern, Tenant Isolation Test Pattern.

### Table Schema Pattern
```sql
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- other columns
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policy
CREATE POLICY tenant_isolation ON example_table
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

### Database Access Pattern
```typescript
// Always use getTenantDb() for tenant-scoped queries
const db = getTenantDb(tenantId);
const records = await db.select().from(exampleTable);

// Never bypass tenant routing
// ❌ DON'T: const records = await globalDb.select().from(exampleTable);
```

### Tenant Isolation Test Pattern
```typescript
import { testTenantIsolation } from '@/lib/test-helpers';

describe('exampleFunction', () => {
  it('enforces tenant isolation', async () => {
    await testTenantIsolation(async (tenantId) => {
      return await exampleFunction(tenantId, /* other params */);
    });
  });
});
```

## Validation Criteria

- Every data table definition includes a tenant_id column with NOT NULL constraint and foreign key to tenants(id)
- All data tables have RLS enabled with tenant isolation policies
- All database queries use getTenantDb() helper function
- Cross-tenant access returns 404 status codes, never 403
- Every data access function has a corresponding tenant isolation test
- Portal data resolvers re-verify tenant_id on every query
- No hardcoded tenant IDs in application code — always extracted from authenticated session context