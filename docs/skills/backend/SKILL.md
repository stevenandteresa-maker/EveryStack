---
name: everystack-backend
description: >
  Backend engineering patterns for EveryStack's multi-tenant SaaS platform.
  Use this skill for ANY prompt that touches database schema (Drizzle ORM),
  server-side data access, API routes, migrations, sync engine adapters,
  BullMQ workers, RLS policies, or tenant isolation. Triggers on: schema work,
  database queries, migrations, backend services, sync adapters, API endpoints,
  server actions, test factories, or anything in packages/shared/db,
  packages/shared/sync, apps/worker, or apps/web/src/data. Also use when
  the prompt references getDbForTenant, canonical_data, JSONB storage,
  FieldTypeRegistry, or CockroachDB safeguards. If in doubt about whether
  this skill applies, it probably does — backend conventions affect nearly
  every phase.
---

# EveryStack Backend Skill

## Section Index

| Section | Lines | Summary |
|---------|-------|---------|
| When to Use This Skill | 37–44 | Trigger conditions: Phases 1A--2, Drizzle schema, data access, migrations |
| Authority Chain | 46–54 | Resolution order: GLOSSARY > CLAUDE.md > this skill > playbook prompt |
| Core Conventions | 56–174 | Drizzle ORM patterns, UUIDv7 PKs, tenant_id column, canonical JSONB, getDbForTenant(), RLS, migration rules |
| CockroachDB Safeguards | 176–197 | 5 non-negotiable safeguards with safe alternatives table |
| Testing Conventions | 199–261 | File locations, testTenantIsolation() pattern, factory usage, coverage targets |
| Error Handling | 263–312 | AppError + Zod validation patterns, domain-specific overrides |
| Sync Engine Patterns | 314–351 | Adapter architecture, FieldTypeRegistry, sync conventions (Phase 2 specific) |
| File Path Quick Reference | 353–369 | Directory map for schema, sync, AI, testing, data, actions, workers |
| Checklist Before Every Commit | 371–386 | 12-item verification checklist for backend code |

This skill encodes the backend engineering conventions for EveryStack.
It is the source of truth for how Claude Code should write server-side code
across all phases. Load this skill before writing any backend code.

## When to Use This Skill

- **Always** for Phases 1A–1D (Foundation) and Phase 2 (Sync)
- **Always** for any prompt that creates or modifies Drizzle schema
- **Always** for any prompt that writes data access functions (queries/mutations)
- **Always** for any prompt that creates migrations
- **Selectively** for Phases 3–6 when the prompt touches backend logic
  (e.g., 3A permission resolution, 4 automation engine, 5 AI service, 6 API)

## Authority Chain

When conventions conflict, resolve in this order:
1. `GLOSSARY.md` — naming, scope, definitions
2. `CLAUDE.md` (project root) — project-wide rules, tech stack, CI gates
3. This skill — backend-specific patterns and templates
4. The playbook prompt — task-specific overrides

---

## Core Conventions

Covers Database: Drizzle ORM on PostgreSQL, Tenant-Scoped Data Access: getDbForTenant(), RLS Policies, Migration Rules.
Touches `tenant_id`, `archived_at`, `deleted_at` tables.

### Database: Drizzle ORM on PostgreSQL

All schema lives in `packages/shared/db/schema/`. One file per domain:

```
packages/shared/db/schema/
├── records.ts        # records, fields tables
├── views.ts          # views, view_configs tables
├── cross-links.ts    # cross_links table
├── permissions.ts    # workspace_memberships, field_permissions
├── portals.ts        # portals, portal_sessions
├── forms.ts          # forms, form_submissions
├── automations.ts    # automations, automation_steps, automation_runs
├── communications.ts # threads, messages, notifications
├── documents.ts      # document_templates
├── files.ts          # file_uploads
├── ai.ts             # ai_credits, ai_usage_log
├── api-keys.ts       # api_keys
├── audit.ts          # audit_log
└── index.ts          # re-exports all schemas
```

**Primary Key Convention — UUIDv7 everywhere:**
```typescript
import { uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from '@/lib/uuid'; // custom UUIDv7 generator

id: uuid('id').primaryKey().$defaultFn(() => uuidv7()),
```
Never use `serial`, `bigserial`, or auto-increment. UUIDv7 is required for
CockroachDB forward-compatibility and gives time-ordered IDs.

**Tenant Isolation Column — every tenant-scoped table:**
```typescript
tenant_id: uuid('tenant_id').notNull().references(() => workspaces.id),
```
Every table that stores tenant data MUST have `tenant_id`. No exceptions.

**Canonical JSONB Storage:**
Records store field values in a JSONB column keyed by `fields.id` (UUID),
never by field name:
```typescript
canonical_data: jsonb('canonical_data').$type<Record<string, unknown>>().notNull().default({}),
```

**Timestamps — always include both:**
```typescript
created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
```

**Soft Deletes — use `archived_at` not `deleted_at`:**
```typescript
archived_at: timestamp('archived_at', { withTimezone: true }),
```

### Tenant-Scoped Data Access: getDbForTenant()

Every data access function MUST use the tenant-scoped database helper:

```typescript
import { getDbForTenant } from '@/db/tenant';

export async function getRecordsByTable(tenantId: string, tableId: string) {
  const db = getDbForTenant(tenantId);
  return db.select().from(records).where(eq(records.table_id, tableId));
}
```

**Rules:**
- Never use a raw `db` instance for tenant-scoped queries
- `getDbForTenant()` handles read/write routing and sets the RLS context
- Always pass `tenantId` as the first parameter of any data access function
- The helper is built in Phase 1B — all subsequent phases assume it exists

### RLS Policies

Every tenant-scoped table gets a Row-Level Security policy:

```sql
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON records
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Rules:**
- RLS is enforced at the database level, not just application level
- `getDbForTenant()` sets `app.current_tenant_id` before each query
- Test RLS with explicit cross-tenant access attempts (see Testing section)

### Migration Rules

Migrations live in `packages/shared/db/migrations/`.

**File naming:** `XXXX_descriptive_name.ts` (sequential numbering)

**Hard constraints (from CLAUDE.md):**
- No `ACCESS EXCLUSIVE` lock lasting >1 second
- No migration >30 seconds on staging data volume
- Never modify an existing migration file — always create a new one
- Add columns as nullable first, backfill, then add NOT NULL constraint
  (two-step migration pattern for zero-downtime deploys)

**When a prompt says "Migration required: Yes":**
1. Create the migration file
2. Run `pnpm turbo db:migrate:check` to verify no lock violations
3. Include migration verification in acceptance criteria

**When a prompt says "Migration required: No":**
- Do NOT create a migration file
- Do NOT modify existing migration files

---

## CockroachDB Safeguards (Always Active)

These 5 safeguards apply to ALL code in ALL phases. They are non-negotiable:

1. **UUIDv7 primary keys only** — no serial/sequence IDs
2. **No PostgreSQL-specific syntax** — no `LISTEN/NOTIFY`, no advisory locks,
   no `pg_advisory_lock`, no `pg_trgm` operator classes
3. **No advisory locks** — use Redis-based distributed locks instead
4. **No PG-specific extensions** — no `pgcrypto` for UUIDs (use app-level UUIDv7)
5. **Test with EXPLAIN** — any query on a table expected to exceed 100K rows
   should have an EXPLAIN plan verified during development

**Safe alternatives:**
| Instead of... | Use... |
|---|---|
| `LISTEN/NOTIFY` | Redis pub/sub or BullMQ events |
| `pg_advisory_lock` | Redis `SETNX` with TTL |
| `pg_trgm` similarity | Application-level fuzzy matching or tsvector |
| `serial` / `bigserial` | `uuid` with UUIDv7 |
| Sequences | UUIDv7 (time-ordered, globally unique) |

---

## Testing Conventions

Covers Test File Location and Naming, Tenant Isolation Test (Required for Every Data Access Function), Test Factories, Coverage Targets.

### Test File Location and Naming

Tests live next to the code they test:
```
packages/shared/db/schema/__tests__/records.test.ts
packages/shared/sync/adapters/__tests__/airtable-adapter.test.ts
apps/web/src/data/__tests__/get-records.test.ts
```

**Naming:** `{module-name}.test.ts` — kebab-case, matching the source file.

### Tenant Isolation Test (Required for Every Data Access Function)

```typescript
import { testTenantIsolation } from '@/testing/tenant-isolation';

describe('getRecordsByTable', () => {
  it('enforces tenant isolation', async () => {
    await testTenantIsolation({
      setup: async (tenantId) => {
        // Create test data for this tenant
        await createRecord({ tenantId, tableId: 'test-table', data: {} });
      },
      query: async (tenantId) => {
        // Query using the function under test
        return getRecordsByTable(tenantId, 'test-table');
      },
      // Helper verifies tenant A cannot see tenant B's data
    });
  });
});
```

**Rule:** Every prompt that creates a data access function MUST include
`testTenantIsolation()` in its acceptance criteria. No exceptions.

### Test Factories

Use factories from `packages/shared/testing/factories/` for test data:

```typescript
import { createTestWorkspace, createTestRecord, createTestUser }
  from '@/testing/factories';
```

**Rules:**
- Never hardcode test data inline — use factories
- Factories handle tenant setup, cleanup, and realistic defaults
- Each factory returns the created entity with its ID
- Factories are built in Phase 1B — all subsequent phases use them

### Coverage Targets

From `CLAUDE.md`:
- **≥80% coverage** on all new files
- VERIFY session runs: `pnpm turbo test -- --coverage`
- Coverage gate is enforced in CI pre-merge

---

## Error Handling

Covers Default Pattern (from CLAUDE.md), Zod Validation (Input Boundaries), Domain-Specific Overrides.

### Default Pattern (from CLAUDE.md)

```typescript
import { AppError, ErrorCode } from '@/lib/errors';

// Throw structured errors
throw new AppError(ErrorCode.NOT_FOUND, 'Record not found', {
  recordId,
  tenantId,
});

// Never throw raw strings or generic Errors
// ❌ throw new Error('not found');
// ❌ throw 'not found';
```

### Zod Validation (Input Boundaries)

All external inputs validated with Zod at the boundary:

```typescript
import { z } from 'zod';

const CreateRecordInput = z.object({
  tableId: z.string().uuid(),
  canonicalData: z.record(z.string().uuid(), z.unknown()),
});

// In server action or API route:
const input = CreateRecordInput.parse(rawInput);
```

**Rules:**
- Zod schemas live next to the function that uses them
- API routes and Server Actions always validate input
- Internal function-to-function calls can skip Zod if types suffice

### Domain-Specific Overrides

Some domains override the default error pattern. The playbook prompt will
specify when this applies. Common overrides:
- **Permissions:** Denial returns 403 with a generic message (no data leakage)
- **Sync:** Conflict errors include both canonical and source versions
- **Portals:** Auth failures redirect to the portal login, not a JSON error

---

## Sync Engine Patterns (Phase 2 Specific)

Covers Adapter Architecture, Sync Conventions.

> Read `references/sync-patterns.md` for the full adapter specification.
> This section covers the conventions Claude Code must follow.

### Adapter Architecture

```
Source Platform (Airtable/Notion/SmartSuite)
  ↓ toCanonical()
Canonical JSONB (our DB)
  ↓ fromCanonical()
Source Platform (outbound sync)
```

**FieldTypeRegistry** maps platform-specific types to canonical types:
```typescript
// packages/shared/sync/field-registry.ts
registry.register('airtable', 'singleLineText', {
  canonical: 'text',
  toCanonical: (value) => String(value),
  fromCanonical: (value) => String(value),
});
```

### Sync Conventions

- Adapters live in `packages/shared/sync/adapters/{platform}.ts`
- Each adapter implements `SyncAdapter` interface
- Rate limits are per-platform, managed by `RateLimitRegistry`
- Sync jobs run in `apps/worker/src/jobs/sync/`
- Conflict resolution: last-write-wins by default, user-resolvable for
  field-level conflicts
- All sync operations are idempotent — rerunning a sync produces the same result

---

## File Path Quick Reference

```
packages/shared/db/schema/     → Drizzle schema definitions
packages/shared/db/migrations/ → Migration files (never modify existing)
packages/shared/db/tenant.ts   → getDbForTenant() helper
packages/shared/sync/          → Sync engine, adapters, field registry
packages/shared/ai/            → AIService, providers, prompts
packages/shared/testing/       → Test utilities, factories, tenant-isolation helper
apps/web/src/data/             → Server-side queries and mutations
apps/web/src/actions/          → Server Actions (Next.js)
apps/web/src/app/              → Routes and layouts
apps/worker/src/jobs/          → BullMQ job processors
apps/realtime/                 → Socket.io server
```

---

## Checklist Before Every Commit

Claude Code should verify before committing:

- [ ] All new tables have `tenant_id` column (if tenant-scoped)
- [ ] All new tables use UUIDv7 primary keys
- [ ] All data access functions use `getDbForTenant()`
- [ ] All data access functions have `testTenantIsolation()` test
- [ ] All external inputs validated with Zod
- [ ] All errors use `AppError` with `ErrorCode`
- [ ] No PG-specific syntax (advisory locks, LISTEN/NOTIFY, pg_trgm)
- [ ] Migration file created if schema changed (never modify existing)
- [ ] Test factories used for test data (no hardcoded values)
- [ ] `pnpm turbo typecheck` — zero errors
- [ ] `pnpm turbo lint` — zero errors
- [ ] Coverage ≥80% on new files
