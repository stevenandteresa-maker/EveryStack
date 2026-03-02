# Database Scaling Strategy

> **Reconciliation note (2026-02-27):** Aligned with `GLOSSARY.md` (source of truth). Changes: (1) Tagged pgvector / semantic search / hybrid search pipeline references as post-MVP (Vector Embeddings). (2) Tagged CockroachDB migration as post-MVP. (3) Tagged multi-region routing as post-MVP. (4) No naming drift found — terms (Table View, Record View, Command Bar, Cross-Link, Portal, Workspace) all match glossary.

> PgBouncer, read/write routing, partitioning, RLS, zero-downtime migrations, tsvector indexing, and scaling decision points.
> Cross-references: `cockroachdb-readiness.md` **(post-MVP)** (CockroachDB migration paths for partitioning, tsvector, expression indexes, PgBouncer replacement, `getDbForTenant()` CockroachDB routing)
> Last updated: 2026-02-27 — Glossary reconciliation (MVP scope tags).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                            | Lines   | Covers                                                                                                                                                                                                                                                                |
| -------------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connection Pooling (MVP — Foundation — Day One)    | 29–39   | PgBouncer transaction mode, per-environment config (Docker/Railway/AWS), connection strings                                                                                                                                                                           |
| Read/Write Connection Routing & `getDbForTenant()` | 43–171  | `getDbForTenant()` full implementation, read/write intent routing, usage patterns, multi-region routing (post-MVP), tenant region cache, migration path                                                                                                               |
| Table Partitioning                                 | 175–185 | Hash-partitioned `records` by `tenant_id` (16 partitions), other partitioned tables, autovacuum benefits                                                                                                                                                              |
| Tenant-Aware Resource Protection                   | 189–198 | 30s/5min statement timeouts, per-tenant query budgeting, expensive query guardrails (50K+ limits, cross-link depth cap)                                                                                                                                               |
| Row-Level Security at Scale                        | 202–210 | RLS as defense-in-depth at 100M+ rows, partition pruning mitigation, monitoring strategy, never relaxed on write primary                                                                                                                                              |
| Zero-Downtime Migration Rules                      | 214–222 | 7 safe migration patterns: ADD COLUMN, renames, CONCURRENTLY indexes, type changes, table drops, partition ops, validation                                                                                                                                            |
| tsvector Indexing Strategy                         | 226–482 | 4-weight search vectors (A–D), `extractSearchableText()` full impl, `buildSearchVector()` full impl, `simple` dictionary rationale, prefix matching, update triggers, GIN schema, table-scoped + workspace-scoped search queries, entity search, performance at scale |
| JSONB Expression Indexes                           | 486–498 | Expression indexes on JSONB paths, btree on `canonical_data` fields, `record_cells` decision point                                                                                                                                                                    |
| Scaling Decision Points                            | 502–513 | Trigger → action table: connection count, query latency, record thresholds, tenant count, CockroachDB tier                                                                                                                                                            |

---

## Connection Pooling (MVP — Foundation — Day One)

Both the Next.js web app and the Node.js worker service connect to PostgreSQL through **PgBouncer** in transaction mode. Services never connect directly to PostgreSQL.

**Why non-negotiable from MVP — Foundation:** Next.js on serverless-style platforms spawns many concurrent Node processes — each opening its own Postgres connection. Without pooling, connection exhaustion occurs as low as 50–100 concurrent users. PgBouncer multiplexes hundreds of application connections into ~20–50 actual PostgreSQL connections.

**Implementation per environment:**

- **Development:** PgBouncer container in Docker Compose alongside PostgreSQL. All services connect to PgBouncer port (6432), not PostgreSQL port (5432).
- **Railway/Render:** PgBouncer as sidecar or provider's built-in pooling.
- **AWS:** RDS Proxy (managed PgBouncer equivalent) in front of RDS PostgreSQL.
- **Connection strings:** `DATABASE_URL` always points to the pooler. `DATABASE_URL_DIRECT` for migrations only (session-mode connections).

---

## Read/Write Connection Routing & `getDbForTenant()`

### Connection Instances

```typescript
// packages/shared/db/client.ts
const db = createDrizzleClient(env.DATABASE_URL); // Write primary (via pooler)
const dbRead = createDrizzleClient(env.DATABASE_READ_URL); // Read replica (via pooler)
// MVP — Foundation: DATABASE_READ_URL = DATABASE_URL (same instance).
// Adding a read replica later = change one env var.
```

### The `getDbForTenant()` Abstraction

**This is the single entry point for all tenant-scoped database operations.** It's useful at every stage, not just for future multi-region:

```typescript
// packages/shared/db/client.ts
type DbIntent = 'read' | 'write';

export function getDbForTenant(tenantId: string, intent: DbIntent = 'write'): DrizzleClient {
  // MVP — Foundation: Simple read/write split. Immediate value.
  if (intent === 'read') return dbRead;
  return db;

  // MVP — Sync+ (multi-region): Uncomment when regional routing is enabled.
  // const region = getTenantRegionCached(tenantId);
  // return regionConnections[region][intent];
}
```

**MVP — Foundation value:** Every data layer function passes `intent` so we get proper read/write separation from day one. When a read replica is added, ALL reads automatically route to it with zero code changes.

**Usage in the data layer:**

```typescript
// apps/web/src/data/records.ts
export async function getRecords(tenantId: string, tableId: string): Promise<Record[]> {
  const dbConn = getDbForTenant(tenantId, 'read'); // ← Reads go to replica
  return dbConn
    .select()
    .from(records)
    .where(
      and(eq(records.tenantId, tenantId), eq(records.tableId, tableId), isNull(records.deletedAt)),
    );
}

// apps/web/src/data/records.ts
export async function insertRecord(tenantId: string, data: NewRecord): Promise<Record> {
  const dbConn = getDbForTenant(tenantId, 'write'); // ← Writes go to primary
  return dbConn.transaction(async (tx) => {
    const record = await tx
      .insert(records)
      .values({ tenantId, ...data })
      .returning();
    // ... search_vector, cross_link_index, audit log in same transaction
    return record;
  });
}
```

**Routing rules (who uses which intent):**

| Caller                                        | Intent    | Rationale                        |
| --------------------------------------------- | --------- | -------------------------------- |
| Server Components (data fetching)             | `'read'`  | Read replica safe, no mutation   |
| Server Actions (mutations)                    | `'write'` | Must hit primary                 |
| Worker writes (sync, formula recalc)          | `'write'` | Must hit primary                 |
| Worker reads (reports, cross-link resolution) | `'read'`  | Read replica safe                |
| Automation evaluation (read context)          | `'read'`  | Reads to build execution context |
| Automation execution (write steps)            | `'write'` | Mutation steps hit primary       |

### Multi-Region Routing (Post-MVP)

> **Post-MVP:** Multi-region routing, data residency, and geo-distribution are post-MVP per glossary. The `getDbForTenant()` abstraction is MVP (provides read/write split), but the regional routing it enables is deferred.

When EveryStack expands to multiple regions (EU, US, AP), `getDbForTenant()` becomes the routing layer with no call-site changes.

**Tenant region cache:**

```typescript
// packages/shared/db/client.ts
const tenantRegionCache = new Map<string, { region: string; expiresAt: number }>();
const REGION_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getTenantRegionCached(tenantId: string): Promise<string> {
  const cached = tenantRegionCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.region;

  // Cache miss: lookup from DB (uses write primary — regions rarely change)
  const tenant = await db
    .select({ dataRegion: tenants.dataRegion })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  const region = tenant[0]?.dataRegion ?? 'us-east-1';
  tenantRegionCache.set(tenantId, { region, expiresAt: Date.now() + REGION_CACHE_TTL_MS });
  return region;
}
```

**Why in-memory Map, not Redis:** Region lookups happen on every request. An in-memory cache with 5-minute TTL avoids a Redis round-trip. At 10K tenants × 32 bytes per entry = ~320KB — negligible. Cache invalidation happens naturally via TTL. Forced invalidation (tenant region migration) clears all caches via a deployment.

**Regional connection pool:**

```typescript
// Post-MVP: built during app startup from env config
const regionConnections: Record<string, { read: DrizzleClient; write: DrizzleClient }> = {
  'us-east-1': { read: dbReadUS, write: dbUS },
  'eu-west-1': { read: dbReadEU, write: dbEU },
};

export function getDbForTenant(tenantId: string, intent: DbIntent = 'write'): DrizzleClient {
  const region = getTenantRegionCached(tenantId);
  const pool = regionConnections[region];
  if (!pool) {
    // Fallback: if region unknown, use default + log warning
    logger.warn({ tenantId, region }, 'Unknown tenant region, using default');
    return intent === 'read' ? dbRead : db;
  }
  return intent === 'read' ? pool.read : pool.write;
}
```

**Error handling:** If `getTenantRegionCached()` fails (DB unreachable), fall back to default region with a Sentry warning. The system degrades to single-region routing rather than failing requests.

**Migration path (single-region → multi-region):**

| Step                                                | What Changes                                                                                  | Downtime             |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| 1. Deploy regional DB instances                     | Infrastructure only. No code changes.                                                         | None                 |
| 2. Add `regionConnections` env config               | New env vars per region.                                                                      | None                 |
| 3. Uncomment regional routing in `getDbForTenant()` | Feature flag, deploy. New tenants routed regionally.                                          | None                 |
| 4. Migrate existing EU tenants                      | `pg_dump` → restore to EU region → update `data_region` → clear cache. Per-tenant, scheduled. | Per-tenant, ~minutes |

**Scale trigger:** Add read replica when grid query p95 latency exceeds 200ms or when sync write volume causes observable read latency degradation on the primary.

---

## Table Partitioning

The `records` table is **hash-partitioned by `tenant_id`** from initial schema creation.

**Why at creation time:** Partitioning a live table with hundreds of millions of rows requires a full table rewrite and extended locking. Declaring partitioning at creation costs nothing and provides compounding benefits.

**Benefits at scale:** Partition pruning on `tenant_id` (every query includes it — architecture rule #1) keeps per-tenant queries fast regardless of total table size. Autovacuum operates per-partition. Indexes are per-partition and smaller. Large tenants can be isolated to dedicated tablespaces.

**Scheme:** `PARTITION BY HASH (tenant_id)` with 16 partitions (sufficient to ~10K tenants). Can split further without downtime via partition detach/reattach.

**Other partitioned tables:** `record_embeddings` by `tenant_id` hash (matching records) **(post-MVP: Vector Embeddings)**. `audit_log` and `ai_usage_log` by time range (monthly partitions) for efficient retention.

---

## Tenant-Aware Resource Protection

**Statement timeout:** 30 seconds for web requests, 5 minutes for worker jobs. Configured at PgBouncer pool level.

**Per-tenant query budgeting (scale phase):** Track query execution time per tenant via OpenTelemetry. Alert when a tenant exceeds 2× the median query budget. Observability first, enforcement later.

**Expensive query guardrails:**

- Grid queries on tables >50K records without a filter: implicit `LIMIT 10000` with UI indicator
- Cross-link resolution: capped at 3 levels depth (configurable, hard cap 5)
- Full-text search: `ts_rank` with cutoff to avoid scoring every row

---

## Row-Level Security at Scale

RLS is defense-in-depth (application-level `tenant_id` filtering is primary enforcement). At 100M+ rows, RLS adds measurable overhead.

**Mitigation:**

1. Partition pruning runs _before_ RLS — most queries touch 1 of 16 partitions
2. RLS policies use simple equality checks (no subqueries, no function calls)
3. Monitor overhead via OpenTelemetry. If RLS adds >10% latency on grid queries, evaluate relaxing on read-replica connections
4. RLS is **never relaxed** on the write primary

---

## Zero-Downtime Migration Rules

1. **`ADD COLUMN`:** Always with `DEFAULT` or nullable. Never `NOT NULL` without default on existing table.
2. **Column renames:** Never `ALTER COLUMN RENAME`. Add new → backfill → update code → drop old (across deploys).
3. **Index creation:** Always `CREATE INDEX CONCURRENTLY`. Never inside a transaction.
4. **Column type changes:** Never in-place. Add new → backfill → switch reads → drop old.
5. **Table drops:** Rename to `_archived_YYYYMMDD` → drop after 30 days.
6. **Partition operations:** `CREATE TABLE ... PARTITION OF` (non-blocking). Detach/reattach for splits.
7. **Validation:** All migrations run against staging with production-scale volume. Migrations acquiring `ACCESS EXCLUSIVE` locks >1s are rejected.

---

## tsvector Indexing Strategy

Full-text search requires `tsvector` columns populated from the canonical JSONB data stored in `records.canonical_data`.

### Approach: Application-Layer Maintenance

**Not generated columns.** PostgreSQL generated columns cannot reference JSONB paths with dynamic keys (field IDs vary per table). Not triggers — they add write latency and complexity for the sync engine's bulk operations.

**Application-layer update:** A dedicated function extracts searchable text from `canonical_data` and writes the `search_vector` column whenever a record is created or updated.

### Search Weight Strategy

Four PostgreSQL tsvector weights (A–D) reflect field importance for ranking:

| Weight | Assigned To                                               | Rank Boost | Example Fields                               |
| ------ | --------------------------------------------------------- | ---------- | -------------------------------------------- |
| **A**  | Primary field                                             | Highest    | Record title, project name, contact name     |
| **B**  | Fields marked `searchPriority: 'high'`                    | High       | Status, email, tags, category                |
| **C**  | Default (all other searchable fields)                     | Medium     | Description, notes, custom text fields       |
| **D**  | Derived text (cross-link display values, computed labels) | Lowest     | Linked record titles, formula string results |

### The `searchable` Field Property

Every field definition includes a `searchable` boolean (default: `true`) and an optional `searchPriority` setting:

```typescript
interface FieldDefinition {
  // ... existing properties
  searchable: boolean; // Default: true. Set false for binary/internal fields.
  searchPriority: 'high' | 'normal'; // Default: 'normal'. 'high' → weight B.
}
```

**Always non-searchable (hardcoded, regardless of field config):**

- File/attachment fields (binary data — but file _names_ are searchable)
- Embedding vector fields
- Internal ID fields

**Searchable by default:** All text, select, multi-select, email, URL, phone, date (as formatted string), number (as string), checkbox ("true"/"false"), cross-link display values.

### `extractSearchableText()` Implementation

This function converts any canonical field value into a plain text string suitable for tsvector indexing:

```typescript
// packages/shared/db/search.ts
function extractSearchableText(value: CanonicalFieldValue, fieldType: string): string | null {
  if (value === null || value === undefined) return null;

  switch (fieldType) {
    // Simple text fields → use directly
    case 'single_line_text':
    case 'email':
    case 'url':
    case 'phone':
      return String(value);

    // Rich text → strip HTML/markdown, extract plain text
    case 'rich_text':
      return stripMarkdown(String(value));

    // Select/status → use the label (human-readable)
    case 'single_select':
    case 'status':
      return (value as { label: string }).label;

    // Multi-select/tags → join all labels
    case 'multi_select':
    case 'tags':
      return (value as { label: string }[]).map((v) => v.label).join(' ');

    // Number → string representation (enables searching "500" or "3.14")
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration':
      return String(value);

    // Date → formatted string ("2026-02-12", "February 12, 2026")
    case 'date':
    case 'datetime':
      return formatDateForSearch(value as string); // Returns both ISO and human-readable

    // Checkbox → "yes"/"no" (searchable as words)
    case 'checkbox':
      return value ? 'yes' : 'no';

    // Cross-link → display value (the linked record's primary field text)
    case 'cross_link':
      return (value as { displayValues: string[] }).displayValues?.join(' ') ?? null;

    // File/attachment → file names only (not content)
    case 'file':
      return (value as { name: string }[]).map((f) => f.name).join(' ');

    // Formula → string representation of computed result
    case 'formula':
      return value?.result != null ? String(value.result) : null;

    // Rating → number as string
    case 'rating':
      return String(value);

    // User/assignee → display name
    case 'user':
      return (value as { displayName: string }).displayName;

    // Multi-user → join display names
    case 'multi_user':
      return (value as { displayName: string }[]).map((u) => u.displayName).join(' ');

    default:
      // Unknown field types — attempt string coercion, skip if object
      return typeof value === 'string' ? value : null;
  }
}
```

### `buildSearchVector()` Full Implementation

```typescript
// packages/shared/db/search.ts
function buildSearchVector(canonicalData: CanonicalData, fields: FieldDefinition[]): string {
  const parts: string[] = [];

  for (const field of fields) {
    // Skip non-searchable fields
    if (field.searchable === false) continue;

    const value = canonicalData.fields[field.id];
    const text = extractSearchableText(value, field.fieldType);
    if (!text || text.trim() === '') continue;

    // Determine weight
    let weight: 'A' | 'B' | 'C' | 'D';
    if (field.isPrimary) {
      weight = 'A';
    } else if (field.searchPriority === 'high') {
      weight = 'B';
    } else if (field.fieldType === 'cross_link' || field.fieldType === 'formula') {
      weight = 'D'; // Derived content
    } else {
      weight = 'C'; // Default
    }

    // Sanitize text: remove null bytes, limit length per field (prevent one field dominating)
    const sanitized = text.replace(/\0/g, '').slice(0, 5000);
    parts.push(`setweight(to_tsvector('simple', ${sqlLiteral(sanitized)}), '${weight}')`);
  }

  return parts.length > 0 ? parts.join(' || ') : "''::tsvector";
}
```

### Language Configuration

**Decision: `'simple'` dictionary for tsvector, not a language-specific one.**

Rationale:

- EveryStack is multi-tenant and multi-language. A tenant in Japan and a tenant in Germany share the same database. PostgreSQL tsvector dictionaries are per-column, not per-row — we cannot use `'english'` for some records and `'german'` for others within the same column.
- `'simple'` performs no stemming but matches exact tokens and prefixes. This is predictable and consistent across all languages.
- Semantic search (pgvector) **(post-MVP: Vector Embeddings)** handles the "fuzzy/conceptual" matching that stemming would provide. The hybrid search pipeline (tsvector + pgvector + RRF) **(post-MVP)** gives users the best of both: exact keyword matches from tsvector, conceptual matches from embeddings.
- If a tenant requires language-specific stemming, a future enhancement could add a `search_vector_stemmed` column using a per-table language config. Not in scope for MVP.

**Prefix matching enabled:** Queries use `to_tsquery('simple', $term || ':*')` to support "type-ahead" partial matching in the filter bar and Command Bar. For example, typing "proj" matches "project", "projection", etc.

### When Updated

| Trigger                                                                            | Mechanism                                                                                      | Synchronous?                                      |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Record create/update (Server Action)                                               | `buildSearchVector()` called in same transaction                                               | Yes — same DB transaction                         |
| Inbound sync batch                                                                 | Bulk `UPDATE ... SET search_vector = ...` after canonical data write                           | Yes — same job, after data commit                 |
| Field definition change (field renamed, `searchable` toggled, `isPrimary` changed) | Background BullMQ job recalculates `search_vector` for all records in that table               | No — async job, may take minutes for large tables |
| Cross-link display value change                                                    | Background job recalculates `search_vector` for records with cross-links to the changed record | No — async job                                    |

### Schema

```sql
ALTER TABLE records ADD COLUMN search_vector tsvector;

-- Composite GIN index for table-scoped search (filter bar)
CREATE INDEX idx_records_search_table ON records
  USING gin(search_vector) WHERE search_vector IS NOT NULL;
-- Partition-aware: index created per partition automatically.

-- The tenant_id filter comes from partition pruning.
-- The table_id filter uses the existing btree index on (tenant_id, table_id).
-- Query planner combines both: partition prune → btree filter → GIN scan.
```

### Two Search Scopes

**1. Table-scoped search (toolbar filter bar):**

Search within a single table. Used for the search box in the grid toolbar. Fast — scoped to one table_id within one tenant partition.

```sql
SELECT id, canonical_data FROM records
WHERE tenant_id = $1
  AND table_id = $2
  AND deleted_at IS NULL
  AND search_vector @@ to_tsquery('simple', $3 || ':*')
ORDER BY ts_rank(search_vector, to_tsquery('simple', $3 || ':*')) DESC
LIMIT 50;
```

Performance: <20ms for tables up to 250K records (partition pruning + btree filter + GIN scan).

**2. Workspace-scoped search (Command Bar):**

Search across all tables in a workspace. Used by the Command Bar for record search. Broader — scans all tables in the tenant partition.

```sql
SELECT id, table_id, canonical_data FROM records
WHERE tenant_id = $1
  AND deleted_at IS NULL
  AND search_vector @@ to_tsquery('simple', $2 || ':*')
ORDER BY ts_rank(search_vector, to_tsquery('simple', $2 || ':*')) DESC
LIMIT 20;
```

Performance: <50ms for tenants with up to 500K total records (single partition GIN scan). For the Command Bar, this runs in parallel with semantic search (pgvector, **post-MVP**) and entity search — see `vector-embeddings.md` > Command Bar Search Pipeline.

### Non-Record Entity Search

The Command Bar also needs to find tables, views, fields, automations, and portals by name. These are small datasets (<1,000 entities per workspace) that don't warrant tsvector — simple ILIKE with tenant_id is sufficient:

```sql
-- Example: search tables by name
SELECT id, name FROM tables
WHERE tenant_id = $1 AND name ILIKE '%' || $2 || '%'
ORDER BY name LIMIT 10;
```

**Entity search is implemented in `apps/web/src/data/search.ts`** as a single function that queries multiple entity tables in parallel:

```typescript
async function searchEntities(tenantId: string, query: string): Promise<EntitySearchResults> {
  const [tables, views, fields, automations, portals] = await Promise.all([
    searchTables(tenantId, query),
    searchViews(tenantId, query),
    searchFields(tenantId, query),
    searchAutomations(tenantId, query),
    searchPortals(tenantId, query),
  ]);
  return { tables, views, fields, automations, portals };
}
```

Each entity query is an ILIKE with LIMIT 5 — total cost <10ms for 5 parallel queries on small tables.

### Performance at Scale

At 100M+ records with 16 partitions: each partition holds ~6M records. GIN index scan within a single partition is fast (<50ms). Combined with semantic search (pgvector, **post-MVP**), this feeds the Command Bar hybrid search pipeline (see `vector-embeddings.md` > Command Bar Search Pipeline).

---

## JSONB Expression Indexes

For frequently filtered/sorted fields, expression indexes on JSONB paths provide column-level performance without denormalization:

```sql
CREATE INDEX CONCURRENTLY idx_records_status ON records USING btree (
  tenant_id, (canonical_data->'fields'->'status_field_id'->>'value')
) WHERE canonical_data->'fields'->'status_field_id' IS NOT NULL;
```

**Strategy:** Create expression indexes for the most common sort/filter patterns per-tenant. Initially manual (admin identifies hot fields). Future: automatic index suggestion based on query patterns observed via OpenTelemetry.

**Decision point:** If expression indexes cannot meet <200ms grid query targets on 50K+ record tables, introduce the `record_cells` denormalized read cache (see data-model.md). This is MVP — Core UX optimization.

---

## Scaling Decision Points

| Trigger                                                                     | Action                                                                                        |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| >100 concurrent DB connections                                              | Verify PgBouncer pool sizing, increase if needed                                              |
| Grid query p95 > 200ms                                                      | Add read replica, route Server Components to replica                                          |
| Single tenant > 250K records                                                | Monitor partition performance, verify expression indexes                                      |
| Total records > 50M                                                         | Benchmark expression indexes vs `record_cells` denormalization                                |
| Total records > 200M                                                        | Evaluate partition count increase (16 → 64)                                                   |
| >5,000 tenants                                                              | Benchmark RLS overhead, establish per-tenant query budgets                                    |
| >10,000 tenants                                                             | Evaluate multi-region read replicas, dedicated partition tablespaces                          |
| Enterprise client requires geo-distribution, data residency, or 99.999% SLA | **(Post-MVP)** Deploy CockroachDB tier. See `cockroachdb-readiness.md` for migration playbook |
