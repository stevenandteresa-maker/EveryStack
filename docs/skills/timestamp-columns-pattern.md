---
name: timestamp-columns-pattern
category: data-pattern
derivedFrom:
  - doc: docs/reference/data-model.md
    section: Database Schema — MVP Entities
    sourceHash: placeholder
  - doc: CLAUDE.md
    section: CockroachDB Readiness — Active Safeguards
    sourceHash: placeholder
generatedAt: 2026-03-24T15:06:36Z
ablespecVersion: 0
---

# Timestamp Columns Pattern

All entities in EveryStack include standardized timestamp columns for audit trails and change tracking. These columns use PostgreSQL's timestamptz type for timezone-aware storage.

## Convention Rules

- All entity tables MUST include created_at and updated_at columns
- Timestamp columns MUST use timestamptz type (timezone-aware)
- created_at MUST default to NOW() and be NOT NULL
- updated_at MUST default to NOW() and be NOT NULL
- updated_at MUST be automatically updated on record modification
- Never use timestamp without timezone — always use timestamptz for CockroachDB compatibility

## Pattern Templates

Covers Table Schema Pattern, Drizzle Schema Pattern, Query Pattern for Ordering.

### Table Schema Pattern
```sql
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- entity-specific columns here
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_example_table_updated_at
  BEFORE UPDATE ON example_table
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Drizzle Schema Pattern
```typescript
import { pgTable, uuid, timestamptz } from 'drizzle-orm/pg-core';

export const exampleTable = pgTable('example_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  // entity-specific columns
  createdAt: timestamptz('created_at').notNull().defaultNow(),
  updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});
```

### Query Pattern for Ordering
```typescript
// Order by most recent first
const recentRecords = await db
  .select()
  .from(exampleTable)
  .orderBy(desc(exampleTable.createdAt));

// Filter by date range
const recordsInRange = await db
  .select()
  .from(exampleTable)
  .where(
    and(
      gte(exampleTable.createdAt, startDate),
      lte(exampleTable.createdAt, endDate)
    )
  );
```

## Validation Criteria

- Every entity table includes both created_at and updated_at columns
- All timestamp columns use timestamptz type, never timestamp
- created_at and updated_at columns have NOT NULL constraints
- Both columns default to NOW()
- Database triggers or application logic ensures updated_at is modified on record updates
- Drizzle schema definitions use timestamptz() helper with .defaultNow()
- No hardcoded timestamp values in migrations or seed data