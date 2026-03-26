# CockroachDB Enterprise Readiness

> **⚠️ SCOPE: Active safeguards (MVP — Foundation) + Post-MVP deployment.** Per GLOSSARY.md, data residency and geo-distribution are post-MVP. However, the **Development Safeguards** section below contains active rules enforced during MVP development to prevent Postgres-only drift. Actual CockroachDB deployment is enterprise/sales-driven (post-MVP).

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) Added scope clarification — development safeguards are active MVP — Foundation rules; actual CockroachDB deployment is post-MVP per glossary's data residency exclusion. (2) Verified all naming against glossary naming discipline — no drift found. Doc already uses glossary-correct terms throughout (Workspace, Command Bar, canonical JSONB, Cross-Links, etc.). (3) Confirmed cross-references to other docs are valid. (4) Tagged approval workflow reference as post-MVP context (already in post-MVP migration playbook section).

> **Reference doc (Tier 3).** CockroachDB compatibility assessment, migration surface analysis, Postgres-specific feature audit, enterprise deployment architecture, `getDbForTenant()` regional routing via CockroachDB localities, serializable isolation transaction retry patterns, tsvector/pgvector migration paths, partitioning translation, and development safeguards.
> Cross-references: `database-scaling.md` (partitioning, `getDbForTenant()`, read/write routing, tsvector indexing, expression indexes, scaling decision points), `compliance.md` (data residency strategy, `data_region` column, multi-region architecture, GDPR/DORA/NIS2 locality requirements), `vector-embeddings.md` (pgvector schema, HNSW indexes, embedding provider abstraction, hybrid search pipeline), `operations.md` (backup strategy, connection pooling, deployment), `data-model.md` (UUID primary keys, JSONB canonical storage, GENERATED columns, tenant_id isolation), `inventory-capabilities.md` (`adjustFieldValue` raw SQL exception — atomic JSONB delta), `CLAUDE.md` (architecture rules, Drizzle ORM policy, PgBouncer)
> Last updated: 2026-02-27 — Reconciled with GLOSSARY.md.

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                         | Lines   | Covers                                                                                                                              |
| ----------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Purpose                                         | 27–33   | Why this doc exists, active constraints on data layer code today                                                                    |
| Compatibility Audit                             | 35–238  | CockroachDB-ready features, migration-required: tsvector, pgvector, advisory locks, LISTEN/NOTIFY, partitioning, expression indexes |
| getDbForTenant() — CockroachDB Regional Routing | 240–267 | Regional routing via CockroachDB localities, connection pool per region                                                             |
| Enterprise Deployment Architecture              | 269–296 | Multi-region topology, 3-region minimum, locality tiers, data residency                                                             |
| Development Safeguards                          | 298–339 | Active MVP rules: no raw SQL, UUIDs only, no new extensions, tsvector isolation, serializable txns                                  |
| Migration Playbook                              | 341–358 | 8-step migration sequence from Postgres to CockroachDB                                                                              |
| Enterprise Sales Positioning                    | 360–364 | Enterprise pricing anchor, compliance differentiator                                                                                |

---

## Purpose

This document tracks EveryStack's readiness to deploy on CockroachDB as an enterprise database tier. The standard deployment uses PostgreSQL 16+. CockroachDB is the upgrade path for enterprise clients requiring geo-distributed resilience, data residency compliance (GDPR, DORA, NIS2), and 99.999% availability SLAs. Both deployments share the same application codebase — the migration surface is infrastructure, not architecture.

**This is not a "someday" migration plan.** The architectural decisions documented here are active constraints on how Claude Code writes data layer code today. Every section includes rules that prevent Postgres-only patterns from accumulating unnoticed.

---

## Compatibility Audit

Covers ✅ CockroachDB-Ready (No Changes Needed), ⚠️ Requires Migration Work (Contained).
Touches `tenant_id`, `jsonb_set`, `data_region`, `record_embeddings`, `to_tsquery` tables. See `data-model.md`, `database-scaling.md`, `compliance.md`.

### ✅ CockroachDB-Ready (No Changes Needed)

| Pattern                                        | Where Documented                                                | Why It Works                                                                                                                       |
| ---------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| UUID primary keys (`gen_random_uuid()`)        | `data-model.md` — every entity                                  | CockroachDB prefers UUIDs. Sequential IDs create write hot-spots in distributed systems.                                           |
| `getDbForTenant(tenantId, intent)` abstraction | `database-scaling.md` > Read/Write Connection Routing           | Single entry point for all tenant-scoped DB access. Regional routing = uncomment 3 lines. CockroachDB localities slot in directly. |
| Drizzle ORM only (Rule #10)                    | Root `CLAUDE.md`                                                | Generates standard SQL. No Postgres dialect leakage.                                                                               |
| `tenant_id` on every table                     | Root `CLAUDE.md` Rule #1, `packages/shared/db/CLAUDE.md`        | Maps to CockroachDB geo-partitioning: `PARTITION BY LIST (data_region)` with locality constraints.                                 |
| No stored procedures or triggers               | Root `CLAUDE.md` — all logic in Server Actions + BullMQ workers | CockroachDB has limited PL/pgSQL support. Application-layer logic avoids the biggest migration pain point.                         |
| JSONB canonical storage                        | Root `CLAUDE.md` Rule #4–5, `data-model.md`                     | CockroachDB supports `->`, `->>`, `@>`, `?`, `jsonb_set`, GIN indexes on JSONB.                                                    |
| Zero-downtime migration discipline             | Root `CLAUDE.md` Rule #15, `database-scaling.md`                | `ADD COLUMN` with defaults, online index creation. CockroachDB schema changes are online by default.                               |
| `data_region` column on `tenants`              | `compliance.md` > Data Residency Strategy                       | Already exists. Informational now, partition key for CockroachDB locality placement.                                               |
| Formula engine server-side only                | `formula-engine.md` > Evaluation Model                          | No dependency on Postgres PL/pgSQL functions.                                                                                      |
| DuckDB Context Layer is ephemeral              | `duckdb-context-layer-ref.md`                                   | Reads via Postgres wire protocol. CockroachDB speaks the same protocol.                                                            |
| `EmbeddingProvider` abstraction                | `vector-embeddings.md` > Embedding Provider Abstraction         | Provider-agnostic. No coupling to pgvector internals.                                                                              |
| BullMQ worker retry logic                      | Root `CLAUDE.md` — worker architecture                          | Already handles transient failures. Adapts to CockroachDB transaction retries.                                                     |
| `data_region` routing in `AIProviderAdapter`   | `compliance.md` > Data Residency Strategy                       | AI calls already region-aware.                                                                                                     |

### ⚠️ Requires Migration Work (Contained)

#### 1. Hash Partitioning → Automatic Range Distribution

**Current:** `records` and `record_embeddings` use `PARTITION BY HASH (tenant_id)` with 16 partitions. See `database-scaling.md` > Table Partitioning.

**CockroachDB:** Does not support Postgres declarative hash partitioning. CockroachDB automatically distributes data across ranges (64 MB default range size). For enterprise geo-distribution, use `PARTITION BY LIST (data_region)` with locality constraints.

**Migration:**

```sql
-- Postgres (current)
CREATE TABLE records (...) PARTITION BY HASH (tenant_id);

-- CockroachDB (enterprise)
CREATE TABLE records (...);
ALTER TABLE records PARTITION BY LIST (data_region) (
  PARTITION us VALUES IN ('us-east-1', 'us-west-2'),
  PARTITION eu VALUES IN ('eu-west-1', 'eu-central-1'),
  PARTITION ap VALUES IN ('ap-southeast-1')
);
ALTER PARTITION us OF TABLE records CONFIGURE ZONE USING
  constraints = '[+region=us-east1]';
ALTER PARTITION eu OF TABLE records CONFIGURE ZONE USING
  constraints = '[+region=europe-west1]';
```

**Application code changes:** None. `getDbForTenant()` routing handles it.

**Schema file changes:** Conditional partitioning declaration based on deployment target (env var).

#### 2. tsvector Full-Text Search

**Current:** `records.search_vector` tsvector column, `to_tsquery`, `ts_rank`, `setweight`, GIN indexes. See `database-scaling.md` > tsvector Indexing Strategy.

**CockroachDB:** Experimental full-text search support (v23.1+). `tsvector` columns and `@@` operator are supported but with limitations on weighted ranking and phrase search.

**Migration paths (choose one at deployment time):**

| Option                         | Approach                                                                                                             | Tradeoffs                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **A. CockroachDB native FTS**  | Use CockroachDB's tsvector support directly. Adjust ranking if needed.                                               | Simplest. May have ranking quality differences. Test Command Bar search quality.     |
| **B. Lean on semantic search** | Reduce tsvector to simple keyword matching. Rely on pgvector semantic channel (Channel 4) as primary ranking signal. | Leverages existing hybrid pipeline. RRF already handles one weak channel gracefully. |
| **C. External search service** | Meilisearch or Typesense as a dedicated search layer.                                                                | Best search quality. Adds infrastructure. Only if A/B are insufficient.              |

**Graceful degradation already designed:** The Command Bar pipeline (`vector-embeddings.md` > Command Bar Search Pipeline) handles channel failures silently. If tsvector ranking degrades, RRF fusion compensates via semantic results.

**Rule for Claude Code:** tsvector queries must remain isolated in `packages/shared/db/search.ts`. No tsvector-specific SQL in feature code.

#### 3. pgvector → CockroachDB C-SPANN Vector Index

**Current:** pgvector extension with HNSW indexes, `vector(1024)` columns, cosine distance (`<=>`). See `vector-embeddings.md` > Schema.

**CockroachDB:** Native vector search via C-SPANN (v25.2+). pgvector SQL syntax (`<=>` cosine distance) is compatible. Index creation syntax differs.

**Migration:**

```sql
-- Postgres (current)
CREATE INDEX idx_record_embeddings_vector ON record_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- CockroachDB (enterprise)
CREATE INDEX idx_record_embeddings_vector ON record_embeddings
  USING cspann (embedding vector_cosine_ops);
```

**Query syntax:** Unchanged. `ORDER BY embedding <=> $query_vector LIMIT 20` works on both.

**Rule for Claude Code:** Vector index creation is in migration files only. Query code uses standard pgvector operators — no HNSW-specific hints.

#### 4. PgBouncer → CockroachDB Native Pooling

**Current:** All connections routed through PgBouncer in transaction mode. See `database-scaling.md` > Connection Pooling.

**CockroachDB:** Built-in connection pooling. PgBouncer can interfere with CockroachDB's automatic transaction retry protocol because PgBouncer's transaction-mode pooling doesn't preserve session state between retries.

**Migration:** Remove PgBouncer for CockroachDB deployments. `DATABASE_URL` points directly to CockroachDB (or CockroachDB's built-in SQL proxy). `DATABASE_URL_DIRECT` remains for migrations.

**Application code changes:** None. Connection strings are env vars.

#### 5. Serializable Isolation + Transaction Retries

**Current:** Postgres defaults to Read Committed isolation. No explicit transaction retry logic.

**CockroachDB:** Serializable isolation only. Transactions may receive retriable errors (`40001 serialization_failure`) under contention.

**Migration:** Add a transaction retry wrapper for all write paths:

```typescript
// packages/shared/db/retry.ts
const MAX_RETRIES = 3;
const RETRY_CODES = ['40001']; // serialization_failure

export async function withRetry<T>(
  db: DrizzleClient,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await db.transaction(fn);
    } catch (err: any) {
      if (attempt < MAX_RETRIES && RETRY_CODES.includes(err.code)) {
        // Exponential backoff with jitter
        await sleep(Math.pow(2, attempt) * 10 + Math.random() * 10);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Transaction retry exhausted');
}
```

**Rule for Claude Code:** All `db.transaction()` calls that perform reads and writes in the same transaction should use this wrapper on CockroachDB deployments. Pure write transactions (single INSERT/UPDATE) are less likely to contend. Feature-flag the wrapper per deployment target.

**Paths already retry-safe:** BullMQ workers have built-in retry logic. Sync engine jobs retry on failure. The primary surfaces to wrap are Server Actions with multi-statement transactions.

#### 6. GENERATED Computed Columns

**Current:** `ai_credit_ledger` uses `GENERATED ALWAYS AS` for `credits_remaining` and `usage_pct`. See `data-model.md`, `ai-metering.md`.

**CockroachDB:** Supports `GENERATED ALWAYS AS (expr) STORED`. Basic arithmetic and `ROUND()` are supported.

**Migration:** Verify exact expressions compile. Likely works as-is.

**Risk:** Low. Quick validation during integration test.

#### 7. `adjustFieldValue` Raw SQL (Atomic JSONB Delta)

**Current:** Single documented raw SQL exception using `jsonb_set` for atomic inventory quantity adjustments. See `inventory-capabilities.md` > Primitive 1.

```sql
UPDATE records
SET canonical_data = jsonb_set(
  canonical_data,
  ARRAY['fields', $fieldId, 'value'],
  to_jsonb((canonical_data->'fields'->$fieldId->>'value')::numeric + $delta)
)
WHERE id = $recordId AND tenant_id = $tenantId;
```

**CockroachDB:** Supports `jsonb_set`, `to_jsonb`, JSONB path operators, `::numeric` casting.

**Migration:** Test the exact SQL statement. Expected to work — CockroachDB's JSONB function support covers this pattern.

**Rule for Claude Code:** This remains the only permitted raw SQL exception. If additional raw SQL is ever needed, document it here with a CockroachDB compatibility note.

#### 8. Time-Range Partitioning (Audit + AI Usage Logs)

**Current:** `audit_log` and `ai_usage_log` use monthly time-range partitioning for retention. See `database-scaling.md` > Table Partitioning.

**CockroachDB:** Supports `PARTITION BY RANGE` with different syntax. Preferred approach: CockroachDB row-level TTL.

**Migration:**

```sql
-- CockroachDB: row-level TTL replaces time partitioning
ALTER TABLE audit_log SET (
  ttl_expire_after = '90 days',
  ttl_job_cron = '0 3 * * *'  -- run nightly at 3 AM
);

ALTER TABLE ai_usage_log SET (
  ttl_expire_after = '13 months',
  ttl_job_cron = '0 4 * * *'
);
```

**Application code changes:** None. Retention becomes infrastructure config.

#### 9. Expression Indexes on JSONB Paths

**Current:** `CREATE INDEX CONCURRENTLY` on JSONB path expressions. See `database-scaling.md` > JSONB Expression Indexes.

**CockroachDB:** Supports expression indexes and JSONB path operators. `CONCURRENTLY` keyword not needed (all CockroachDB schema changes are online).

**Migration:** Remove `CONCURRENTLY` keyword from CockroachDB migration files.

---

## `getDbForTenant()` — CockroachDB Regional Routing

The existing `getDbForTenant()` abstraction (`database-scaling.md` > Read/Write Connection Routing) is the keystone. On CockroachDB, it becomes a locality-aware router:

```typescript
// packages/shared/db/client.ts — CockroachDB enterprise deployment

// CockroachDB: single logical cluster with locality-aware routing
// No separate read/write connections — CockroachDB handles replication internally
const crdbConnections: Record<string, DrizzleClient> = {
  'us-east-1': createDrizzleClient(env.CRDB_US_URL),
  'eu-west-1': createDrizzleClient(env.CRDB_EU_URL),
  // Gateway nodes in each region route to local leaseholders
};

export function getDbForTenant(tenantId: string, intent: DbIntent = 'write'): DrizzleClient {
  if (env.DB_ENGINE === 'cockroachdb') {
    const region = getTenantRegionCached(tenantId);
    return crdbConnections[region] ?? crdbConnections[env.CRDB_DEFAULT_REGION];
  }
  // Postgres: existing read/write split
  return intent === 'read' ? dbRead : db;
}
```

**Key difference:** CockroachDB uses a single logical cluster. Regional gateway nodes route queries to local leaseholders automatically. No separate read replica management. The `intent` parameter becomes informational (useful for observability), not routing-critical.

---

## Enterprise Deployment Architecture

```
                   Global Edge / CDN + WAF (Cloudflare)
                   ┌────────────┼────────────┐
              US Region      EU Region      AP Region
              Gateway        Gateway        Gateway
              Node(s)        Node(s)        Node(s)
                   └────────────┼────────────┘
                        CockroachDB Cluster
                     (single logical database,
                      data pinned by locality)

  Tenant A (data_region: us-east-1) → data on US nodes
  Tenant B (data_region: eu-west-1) → data on EU nodes
  Tenant C (data_region: us-east-1) → data on US nodes
```

**vs. Postgres multi-region** (from `compliance.md` > Data Residency Strategy):

```
  US Region: PostgreSQL + Redis + Web + Worker
  EU Region: PostgreSQL + Redis + Web + Worker  (separate instances)
```

CockroachDB simplifies: one cluster, one schema, locality constraints pin data. Cross-region reads are possible (with latency) but not required for tenant-scoped queries.

---

## Development Safeguards

Active rules that prevent Postgres-only drift. These are enforced now, not "someday."

### Rule: No New Raw SQL

The `adjustFieldValue` atomic JSONB delta (`inventory-capabilities.md`) is the only permitted raw SQL exception. Any new raw SQL must:

1. Be documented in this file with a CockroachDB compatibility note
2. Be tested against CockroachDB in CI (when integration tests are added)
3. Be isolated to a single function in `packages/shared/db/`

### Rule: UUIDs Only for Primary Keys

Never use `SERIAL`, `BIGSERIAL`, or `SEQUENCE` for any ID column. All IDs are `UUID DEFAULT gen_random_uuid()`. This is already enforced by `packages/shared/db/CLAUDE.md` — this rule is a reminder of _why_.

### Rule: No New Postgres Extensions

The only permitted extension is `pgvector` (which maps to CockroachDB's native vector support). Adding a new Postgres extension requires a CockroachDB compatibility analysis documented here.

### Rule: tsvector Queries Isolated

All tsvector query construction and execution lives in `packages/shared/db/search.ts`. Feature code calls search helpers — never constructs tsvector queries directly. This containment enables a clean swap to alternative search if needed on CockroachDB.

### Rule: Transactions Designed for Serializable

When writing multi-statement transactions in Server Actions:

- Minimize the read-write span (read what you need, then write)
- Avoid long-running transactions that hold locks
- Document contention expectations with a comment: `// Contention: low — single-tenant single-record`
- These practices improve Postgres performance too — they're not CockroachDB-specific overhead

### Recommended: CI Integration Test (Post-MVP)

Add a nightly test suite that runs core data layer tests against a CockroachDB instance. This is the highest-value safeguard — it catches compatibility regressions automatically before they accumulate.

**Scope:** Test `packages/shared/db/` functions: CRUD operations, search queries, JSONB expression indexes, vector similarity queries, `adjustFieldValue`, `buildSearchVector`.

**Infrastructure:** CockroachDB Serverless free tier or a Docker container in CI.

---

## Migration Playbook (When an Enterprise Client Needs It)

| Step                                                                              | What Changes       | Downtime                 | Application Code             |
| --------------------------------------------------------------------------------- | ------------------ | ------------------------ | ---------------------------- |
| 1. Provision CockroachDB cluster with regional nodes                              | Infrastructure     | None                     | None                         |
| 2. Schema migration: remove `PARTITION BY HASH`, add locality constraints         | DDL scripts        | None (new cluster)       | None                         |
| 3. Schema migration: adjust vector index syntax (HNSW → C-SPANN)                  | DDL scripts        | None                     | None                         |
| 4. Schema migration: replace time partitioning with row-level TTL                 | DDL scripts        | None                     | None                         |
| 5. Add `DB_ENGINE=cockroachdb` env var, configure `CRDB_*_URL` connection strings | Environment config | None                     | `getDbForTenant()` branching |
| 6. Enable transaction retry wrapper                                               | Feature flag       | None                     | `withRetry()` wrapper        |
| 7. Remove PgBouncer from connection path                                          | Infrastructure     | Brief (connection drain) | None                         |
| 8. Data migration: `pg_dump` → CockroachDB import per tenant                      | Data pipeline      | Per-tenant, ~minutes     | None                         |
| 9. Validate: search quality, vector similarity, approval workflow enforcement     | Integration tests  | None                     | None                         |
| 10. DNS cutover per tenant                                                        | Infrastructure     | Per-tenant, seconds      | None                         |

**Total application code changes for CockroachDB deployment:** ~50 lines (transaction retry wrapper + `getDbForTenant()` branch + env var checks). Everything else is schema DDL and infrastructure config.

---

## Enterprise Sales Positioning

> "EveryStack runs on PostgreSQL — the world's most trusted open-source database. For enterprise clients requiring geo-distributed resilience, data residency compliance, and 99.999% availability SLAs, we deploy on CockroachDB using the same codebase. Your data stays in your region, survives regional outages, and meets DORA/GDPR/NIS2 requirements out of the box."

This is credible today. The migration surface is contained (schema DDL + ~50 lines of application code), and the abstraction layers (`getDbForTenant`, Drizzle ORM, `EmbeddingProvider`, `AIProviderAdapter.supportedRegions()`) were designed for exactly this kind of infrastructure flexibility.
