# DuckDB Context Layer — Claude Code Reference Document

> **⚠️ POST-MVP — This entire document describes post-MVP functionality.** Per GLOSSARY.md, "DuckDB analytical layer" is explicitly excluded from MVP scope. Do not build until post-MVP phase. Build clean extension points in MVP, but not the DuckDB layer itself.

> **Reconciliation note (2026-02-27):** Aligned with GLOSSARY.md (source of truth). Changes: (1) Added post-MVP scope banner — glossary lists DuckDB analytical layer as post-MVP. (2) Replaced "interface-level permissions" → "view-level and field-level permissions" per glossary permission definitions. (3) Replaced "Interface `summary` tabs" → "App `summary` tabs" per glossary naming discipline ("Interface" as App Designer output → "App"). (4) Tagged "Smart Docs" downstream consumer as post-MVP. (5) Updated cross-reference header to use glossary-aligned permission terminology.

> **Reference doc (Tier 3).** Read-only, ephemeral, in-process analytical query engine. Hydrates Postgres JSONB into DuckDB for cross-base JOINs, aggregations, and rankings, returning concise results for LLM context windows.
> Cross-references: `schema-descriptor-service.md` (upstream — SDS provides schema metadata for type-aware column creation and permission filtering), `ai-data-contract.md` (DuckDB exemption — results are ephemeral and bypass `aiToCanonical()`; type coercion rules here are read-side presentation, not canonical translation), `data-model.md` (field system, canonical JSONB storage shapes), `permissions.md` (view-level, field-level, and row-level permission enforcement), `cross-linking.md` (cross-base link field storage format — arrays of record IDs), `agent-architecture.md` (agents are primary consumers via AI Query Planner), `compliance.md` (SQL injection mitigations, defense in depth), `chart-blocks.md` (Mode B data binding — charts are a downstream consumer of ContextResult for cross-base visualizations)
> Implements: `packages/shared/ai/CLAUDE.md` (Context Builder rules)
> Last updated: 2026-02-27 — Reconciled with GLOSSARY.md.

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                        | Lines   | Covers                                                             |
| ---------------------------------------------- | ------- | ------------------------------------------------------------------ |
| Purpose of This Document                       | 35–39   | Document scope and audience                                        |
| What This Module Does                          | 41–57   | Read-only ephemeral analytical queries, when to use vs Postgres    |
| Where This Module Sits in the Architecture     | 59–100   | Dependency diagram, relationship to SDS/AI Field Agents            |
| Core Design Principles                         | 102–138  | Ephemeral, read-only, tenant-isolated, SQL-safe                    |
| Data Flow: Step by Step                        | 140–396 | QueryPlan → Postgres fetch → DuckDB load → execute → ContextResult |
| Handling Cross-Base JOINs                      | 398–447 | ANY/UNNEST patterns, multi-table analytical queries                |
| JSONB to DuckDB Type Coercion                  | 449–483 | Type mapping from canonical JSONB to DuckDB columns                |
| Performance Considerations                     | 485–522 | DuckDBPoolConfig, memory limits, concurrency, <2s target           |
| Security Considerations                        | 524–560 | SQL safety scanner, query allow-listing, injection prevention      |
| Error Handling Strategy                        | 562–583 | Error categories, fallback behavior, user-facing messages          |
| Node.js Implementation Notes                   | 585–677 | duckdb-node bindings, connection pooling, memory management        |
| Testing Strategy                               | 679–711 | Unit tests, integration tests, performance benchmarks              |
| Claude Code Prompt Roadmap                     | 713–966 | 8-prompt implementation roadmap                                    |
| Appendix: Future Extensions (Do Not Build Yet) | 968–980 | Deferred features                                                  |

---

## Purpose of This Document

This document provides the architectural context, design decisions, interfaces, constraints, and implementation guidance that Claude Code needs to build the DuckDB Context Layer for EveryStack. Read this document fully before writing any implementation code.

---

## What This Module Does

The DuckDB Context Layer is a **read-only, ephemeral, in-process analytical query engine** that sits between EveryStack's primary Postgres database and the AI/LLM layer. Its job is to:

1. Accept a **query plan** describing what data to pull and what analysis to perform
2. **Hydrate** the relevant records from Postgres into a temporary, in-memory DuckDB instance
3. **Execute analytical SQL** — aggregations, cross-base JOINs, rankings, filtering — inside DuckDB
4. **Return a concise result set** small enough to fit in an LLM's context window

It exists because two problems collide:

- **LLM context windows are limited.** Sending 10,000 raw JSONB records to an LLM causes truncation, hallucination, and massive token costs. The LLM needs a concise, pre-computed answer.
- **Analytical queries on Postgres are dangerous in a multi-tenant OLTP system.** Full table scans, cross-base JOINs, and aggregations compete with real-time user operations for database resources.

DuckDB solves both: it runs analytical workloads in-process (no separate server), operates on an ephemeral in-memory instance (no persistence, no cleanup), and produces compact results the LLM can reason about.

---

## Where This Module Sits in the Architecture

Defines `schema-descriptor-service.md`, `ai-field-agents-ref.md`, `summary`, `chart-blocks.md`. See `schema-descriptor-service.md`, `ai-field-agents-ref.md`, `chart-blocks.md`.

```
User asks a natural language question
        │
        ▼
┌──────────────────────────────┐
│       AI Query Planner       │  ← Translates natural language into a QueryPlan
│  (calls SDS for schema,      │    (covered in a separate ref doc)
│   generates QueryPlan)       │
└──────────────┬───────────────┘
               │ QueryPlan
               ▼
┌──────────────────────────────┐
│    DuckDB Context Layer      │  ← THIS MODULE
│                              │
│  1. Validates QueryPlan      │
│  2. Fetches records from PG  │
│  3. Loads into DuckDB        │
│  4. Executes analytical SQL  │
│  5. Returns ContextResult    │
└──────────────┬───────────────┘
               │ ContextResult (concise)
               ▼
┌──────────────────────────────┐
│       LLM / AI Agent         │  ← Receives concise data, generates response
│  (or AI Field Agent prompt)  │
└──────────────────────────────┘
```

**Upstream dependency:** Schema Descriptor Service (SDS — see `schema-descriptor-service.md`). The DuckDB Context Layer uses SDS metadata for type-aware column creation when loading JSONB into DuckDB, and SDS permission filtering to scope queries to authorized data.

**Downstream consumers:**

- AI Query Planner (for natural language workspace queries)
- AI Field Agents (for cross-base aggregate context in field prompts — see `ai-field-agents-ref.md` > Aggregate Context)
- Smart Docs (post-MVP — for live data queries embedded in documents)
- Chart Blocks — Mode B data binding (for cross-base chart visualizations in App `summary` tabs and App portal dashboard pages — see `chart-blocks.md` > Mode B: DuckDB Analytical) (post-MVP)

---

## Core Design Principles

Covers 1. Ephemeral — No State, No Persistence, 2. Read-Only — Never Writes to Postgres, 3. Permission-Scoped — The User's View Only, 4. Resource-Bounded — Cannot Starve the System, 5. Multi-Tenant Safe — No Cross-Tenant Data Exposure.
See `permissions.md`, `agent-architecture.md`.

### 1. Ephemeral — No State, No Persistence

Every query gets a fresh DuckDB instance. There is no shared state between queries. The instance is created at the start of query execution and destroyed (garbage collected) at the end. This eliminates cache invalidation problems, stale data risks, and multi-tenant data leakage.

```
Request arrives → create DuckDB instance → hydrate → query → return result → instance dies
```

### 2. Read-Only — Never Writes to Postgres

This module only reads from Postgres. It never writes, updates, or deletes records. There is no code path that mutates EveryStack's primary data. DuckDB operates on a copy of the data.

### 3. Permission-Scoped — The User's View Only

Before any records are fetched from Postgres, the query is filtered through the user's view-level and field-level permissions (see `permissions.md` > Runtime Resolution). The DuckDB instance never contains records the user is not authorized to see. This is a hard security boundary, not a convenience filter. For agent-initiated queries, the agent's `AgentScope` further narrows access (see `agent-architecture.md` > Agent Identity & Delegation).

### 4. Resource-Bounded — Cannot Starve the System

Every query has enforced limits on:

- Maximum number of records hydrated from Postgres (configurable, default: 50,000)
- Maximum DuckDB memory allocation (configurable, default: 256MB)
- Query execution timeout (configurable, default: 30 seconds)
- Result set size (configurable, default: 1,000 rows before further condensation)

If any limit is hit, the query returns a partial result with a `truncated: true` flag and a human-readable explanation of what was limited. The LLM can then decide whether to narrow its query.

### 5. Multi-Tenant Safe — No Cross-Tenant Data Exposure

DuckDB runs in-process. Each query execution creates an isolated instance scoped to one user in one workspace. There is no connection pooling, no shared memory, no way for one tenant's query to observe another's data.

---

## Data Flow: Step by Step

Covers Step 1: Receive QueryPlan, Step 2: Validate QueryPlan, Step 3: Fetch Records from Postgres, Step 4: Load Into DuckDB, Step 5: Execute Analytical SQL, Step 6: Build and Return ContextResult.
Touches `analytical_sql`, `read_csv`, `read_parquet`, `timeout_seconds`, `max_result_rows` tables. See `schema-descriptor-service.md`.

### Step 1: Receive QueryPlan

The QueryPlan is a structured object produced by the AI Query Planner (or by the AI Field Agent prompt assembler). It describes:

- Which tables to pull (by table ID)
- Which fields to include (by field ID) — only what's needed for the query
- Any pre-filters to apply at the Postgres level (e.g., "Stage = 'Closed Won'")
- Cross-base link traversals to follow (with depth limit)
- The analytical SQL to execute in DuckDB once data is loaded
- The user ID and workspace ID (for permission scoping)

```typescript
interface QueryPlan {
  workspace_id: string;
  user_id: string;

  // Tables to hydrate, in order
  sources: TableSource[];

  // Cross-base joins to materialize in DuckDB
  joins: JoinDefinition[];

  // The analytical SQL to run inside DuckDB after hydration
  // Uses the DuckDB table aliases defined in sources[].alias
  analytical_sql: string;

  // Resource limits (optional overrides)
  limits?: {
    max_records_per_table?: number; // default 50,000
    max_memory_mb?: number; // default 256
    timeout_seconds?: number; // default 30
    max_result_rows?: number; // default 1,000
  };
}

interface TableSource {
  table_id: string;
  alias: string; // DuckDB table name, e.g. "deals", "contacts"
  fields: FieldSelection[]; // Which fields to include
  pg_filters?: PgFilter[]; // WHERE clauses to apply at Postgres level
}

interface FieldSelection {
  field_id: string;
  alias: string; // DuckDB column name
  field_type: string; // From FieldTypeRegistry — needed for type mapping
}

interface JoinDefinition {
  left_alias: string; // DuckDB table alias
  left_field: string; // DuckDB column alias (the link field)
  right_alias: string; // DuckDB table alias
  right_field: string; // DuckDB column alias (usually record_id)
  join_type: 'inner' | 'left' | 'right';
}

interface PgFilter {
  field_id: string;
  operator:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'contains'
    | 'is_null'
    | 'is_not_null';
  value: any;
}
```

### Step 2: Validate QueryPlan

Before executing anything, validate:

1. **Permission check:** Confirm the user has access to every table and field referenced in `sources[]` and `joins[]`. Use the SDS permission resolver (see `schema-descriptor-service.md` > Permission Filter Layer). If any source is unauthorized, reject the entire query — do not silently omit tables, as this would produce incorrect analytical results.

2. **Resource limit check:** Ensure the plan doesn't request more tables than a configurable max (default: 10). Ensure pre-filters exist for large tables (tables with >100k estimated rows should have at least one PgFilter to avoid pulling the entire table).

3. **SQL safety check:** The `analytical_sql` must be read-only. Parse or regex-check for any DDL or DML statements (INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE). Reject if found. Only SELECT statements are permitted. Also reject any DuckDB-specific functions that access the filesystem (e.g., `read_csv`, `read_parquet`, `COPY`).

4. **Join validity:** Every join references aliases that exist in `sources[]`. The cardinality of the join is consistent with the link definition in the SDS (prevents nonsensical joins).

### Step 3: Fetch Records from Postgres

For each `TableSource` in the plan:

1. Build a Postgres query against the records table:

   ```sql
   SELECT record_id, data
   FROM records
   WHERE table_id = $1
     AND workspace_id = $2
     AND deleted_at IS NULL
     -- Apply PgFilters:
     AND data->>'field_xxx' = $3   -- example eq filter
   LIMIT $max_records_per_table
   ```

2. **Permission filtering at the row level:** If EveryStack's permission model includes row-level access control (e.g., "user can only see records they own"), apply that filter in the Postgres WHERE clause. This is the second layer of defense — the first was table/field-level in Step 2.

3. **Field projection:** Only extract the fields listed in `source.fields[]` from the JSONB `data` column. Do not pull the entire JSONB blob. This reduces memory usage and prevents unauthorized field data from entering DuckDB.

   ```sql
   SELECT
     record_id,
     data->'fld_001' AS deal_name,
     data->'fld_002' AS value,
     data->'fld_004' AS primary_contact_link
   FROM records
   WHERE ...
   ```

4. **Batching:** If multiple tables are needed, execute queries concurrently (Promise.all or equivalent). These are independent read queries with no ordering dependency.

**IMPORTANT:** The Postgres queries must be parameterized. Never interpolate user-provided values or AI-generated filter values into SQL strings. The `PgFilter` values come from the AI Query Planner and must be treated as untrusted input.

### Step 4: Load Into DuckDB

For each table source, create a DuckDB table and insert the fetched records.

**Type mapping from EveryStack field types to DuckDB column types:**

| EveryStack Field Type                  | DuckDB Column Type     | Notes                                                                                                                                                                                                                                    |
| -------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| text, rich_text, email, url, phone     | VARCHAR                |                                                                                                                                                                                                                                          |
| number                                 | DOUBLE                 |                                                                                                                                                                                                                                          |
| integer, rating                        | INTEGER                |                                                                                                                                                                                                                                          |
| currency                               | DOUBLE                 | Store raw numeric value; currency_code as separate VARCHAR column if needed                                                                                                                                                              |
| percent                                | DOUBLE                 | Store as decimal (0.15 not 15)                                                                                                                                                                                                           |
| checkbox                               | BOOLEAN                |                                                                                                                                                                                                                                          |
| date, created_time, last_modified_time | TIMESTAMP              | Parse ISO 8601 strings                                                                                                                                                                                                                   |
| duration                               | DOUBLE                 | Store as seconds                                                                                                                                                                                                                         |
| single_select, status                  | VARCHAR                | **Resolve option ID → option label using SDS field metadata.** Canonical JSONB stores option IDs (e.g., `"opt_003"`), but DuckDB must store human-readable labels (e.g., `"Closed Won"`) so analytical SQL can filter and group by them. |
| multi_select                           | VARCHAR[]              | **Resolve each option ID → option label.** DuckDB array of labels, not IDs.                                                                                                                                                              |
| people, created_by, updated_by         | VARCHAR                | **Resolve user ID → display name using workspace membership data.** Canonical stores user IDs; DuckDB stores names for readable analytics.                                                                                               |
| cross_base_link                        | VARCHAR[]              | Array of linked record IDs. These stay as IDs — JOINs resolve them.                                                                                                                                                                      |
| attachment                             | VARCHAR                | Store as JSON string (not queryable, but preserves metadata)                                                                                                                                                                             |
| autonumber                             | INTEGER                |                                                                                                                                                                                                                                          |
| formula, rollup, lookup                | Depends on output type | Map based on the computed field's result type                                                                                                                                                                                            |

**DuckDB table creation pattern:**

```sql
CREATE TABLE deals (
  record_id VARCHAR PRIMARY KEY,
  deal_name VARCHAR,
  value DOUBLE,
  stage VARCHAR,
  primary_contact_link VARCHAR[]
);
```

**Insertion:** Use DuckDB's `INSERT INTO ... VALUES` with parameterized batches, or use DuckDB's native JSON ingestion capabilities if available in the client library. For large record sets (>10k rows), use DuckDB's appender API for bulk loading — it's significantly faster than individual INSERT statements.

**Link field handling:** Cross-base link fields store arrays of record IDs. Load these as VARCHAR arrays in DuckDB. The JOIN step will resolve them.

### Step 5: Execute Analytical SQL

Run the `analytical_sql` from the QueryPlan against the DuckDB instance. This SQL can reference any table alias defined in the plan.

**Example analytical queries the AI might generate:**

```sql
-- Top 10 deals by value with linked contact segment
SELECT d.deal_name, d.value, c.segment
FROM deals d
LEFT JOIN contacts c ON c.record_id = ANY(d.primary_contact_link)
ORDER BY d.value DESC
LIMIT 10;
```

```sql
-- Pipeline summary by stage
SELECT d.stage, COUNT(*) AS deal_count, SUM(d.value) AS total_value, AVG(d.value) AS avg_value
FROM deals d
GROUP BY d.stage
ORDER BY total_value DESC;
```

```sql
-- Win rate by contact segment
SELECT c.segment,
  COUNT(*) AS total_deals,
  COUNT(CASE WHEN d.stage = 'Closed Won' THEN 1 END) AS won,
  ROUND(COUNT(CASE WHEN d.stage = 'Closed Won' THEN 1 END)::DOUBLE / COUNT(*) * 100, 1) AS win_rate_pct
FROM deals d
LEFT JOIN contacts c ON c.record_id = ANY(d.primary_contact_link)
GROUP BY c.segment;
```

**Execution constraints:**

- Set DuckDB's memory limit: `SET memory_limit='256MB';`
- Set a query timeout at the application level (abort execution after `timeout_seconds`)
- Wrap execution in a try/catch. DuckDB errors (type mismatches, syntax errors) should be captured and returned in the ContextResult so the AI agent can self-correct.

### Step 6: Build and Return ContextResult

```typescript
interface ContextResult {
  success: boolean;

  // The query results as structured data
  columns: ColumnMeta[]; // column names and types
  rows: any[][]; // row data

  // Metadata for the LLM
  row_count: number;
  truncated: boolean; // true if max_result_rows was hit
  truncation_reason?: string; // human-readable explanation

  // Provenance — helps the LLM cite its answer
  sources: {
    table_id: string;
    table_name: string;
    record_count_loaded: number;
    filters_applied: string[]; // human-readable filter descriptions
  }[];

  // Performance
  execution_time_ms: number;
  records_hydrated: number; // total records loaded across all tables

  // Error information (if success is false)
  error?: {
    stage: 'validation' | 'hydration' | 'execution';
    message: string;
    sql_error?: string; // DuckDB error message if applicable
  };
}

interface ColumnMeta {
  name: string;
  type: string; // DuckDB type as string
}
```

**Result condensation:** If the result exceeds `max_result_rows`, truncate and set `truncated: true`. The LLM can then either accept the partial result or ask the AI Query Planner to add more specific filters.

**Formatting for LLM consumption:** The ContextResult is a structured object. The consuming layer (AI Query Planner or AI Field Agent) is responsible for formatting it into a text representation suitable for the LLM prompt. Typical formats:

- **Tabular summary:** Markdown table for small result sets (<20 rows)
- **Narrative summary:** "12 deals totaling $2.3M, average $192k, 67% win rate" for aggregate results
- **JSON:** For structured data the LLM needs to reason about programmatically

This module returns the raw structured result. Formatting is the consumer's responsibility.

---

## Handling Cross-Base JOINs

Cross-base JOINs are the core differentiator. Here's exactly how they work in DuckDB. See `cross-linking.md` for the link field storage format and cardinality definitions, and `schema-descriptor-service.md` > Output Schema for how the `link_graph` and `cardinality` metadata guide query planning.

### The Problem

EveryStack stores cross-base links as arrays of record IDs in the linking field's JSONB value. For example, a Deal record's `primary_contact` field might contain `["rec_abc", "rec_def"]`. To JOIN deals with contacts, you need to unnest this array and match against the contacts table's `record_id`.

### The Solution

DuckDB supports `UNNEST` and the `ANY` operator for array matching. Two patterns:

**Pattern A: ANY operator (simpler, works for many-to-one or one-to-one)**

```sql
SELECT d.deal_name, d.value, c.name AS contact_name, c.segment
FROM deals d
LEFT JOIN contacts c ON c.record_id = ANY(d.primary_contact_link)
```

**Pattern B: UNNEST (required for one-to-many links or when you need the link position)**

```sql
SELECT d.deal_name, d.value, c.name AS contact_name, c.segment
FROM deals d,
  LATERAL UNNEST(d.primary_contact_link) AS t(linked_id)
LEFT JOIN contacts c ON c.record_id = t.linked_id
```

**Which pattern to use:**

- If the link cardinality is `many_to_one` or `one_to_one` (the array always has 0 or 1 elements), use Pattern A. It's cleaner.
- If the link cardinality is `one_to_many` (the array can have multiple elements), use Pattern B with UNNEST. Be aware this fans out rows — a deal linked to 3 contacts produces 3 rows. The analytical SQL should account for this (e.g., GROUP BY the deal to avoid double-counting).

**The AI Query Planner is responsible for generating the correct pattern** based on cardinality information from the SDS. This module just executes whatever SQL it receives. However, the validation step (Step 2) should verify that JOIN definitions are consistent with known cardinalities as a safety check.

### Multi-Hop JOINs

The AI might need to traverse multiple links: Deals → Contacts → Companies. This requires two tables and two JOINs:

```sql
SELECT d.deal_name, d.value, co.company_name, co.industry
FROM deals d
LEFT JOIN contacts c ON c.record_id = ANY(d.primary_contact_link)
LEFT JOIN companies co ON co.record_id = ANY(c.company_link)
```

The QueryPlan supports this via multiple entries in `sources[]` and `joins[]`. The practical depth limit should be 3 hops — beyond that, the combinatorial fan-out becomes problematic and the results hard to interpret. Enforce this in validation.

---

## JSONB to DuckDB Type Coercion

EveryStack stores all field values as JSONB (see `data-model.md` > Field System Architecture for canonical storage shapes). When loading into DuckDB, values must be coerced to the appropriate DuckDB type. This is a **read-side presentation concern** — distinct from `ai-data-contract.md`'s `aiToCanonical()` write path. DuckDB results are ephemeral and never write back to `canonical_data` (see `ai-data-contract.md` > DuckDB Context Layer — The Exemption).

### Coercion Rules

1. **Null handling:** JSONB `null` or missing keys → DuckDB `NULL`. Never fail on nulls.

2. **Text types (text, email, url, phone):** Extract as string. JSONB strings are already strings. If the value is not a string (shouldn't happen, but data quality), cast with `toString()`.

3. **Number types (number, currency, percent, rating):** Extract as number. If the JSONB value is a string that looks like a number (e.g., `"42.5"`), parse it. If it's not parseable, insert `NULL` and log a warning. Never fail the entire hydration because one cell has bad data.

4. **Boolean (checkbox):** JSONB `true`/`false`. Also accept `1`/`0` and `"true"`/`"false"` strings.

5. **Dates:** JSONB stores ISO 8601 strings. Parse to DuckDB TIMESTAMP. If parsing fails, insert `NULL`.

6. **Arrays (multi_select, cross_base_link):** JSONB arrays. Map to DuckDB `VARCHAR[]`. If the value is not an array, wrap it in one: `"value"` → `["value"]`.

7. **Nested objects (attachment, rich_text internal structure):** Serialize to JSON string in DuckDB. These are not directly queryable in DuckDB but preserve the data for the LLM to reference if needed.

8. **Selection fields requiring ID → label resolution (single_select, multi_select, status):** Canonical JSONB stores option IDs (`"opt_003"`), not human-readable labels. Before loading into DuckDB, resolve each option ID to its label using the field's `options` array from SDS field metadata. If an option ID is not found in the options list (stale data), insert the raw ID as-is and log a warning. For multi_select, resolve each element in the array independently. This resolution is critical — without it, all analytical SQL that filters or groups by select values (e.g., `WHERE stage = 'Closed Won'`) will fail silently, producing zero-row results.

9. **People fields requiring ID → name resolution (people, created_by, updated_by):** Canonical JSONB stores user IDs. Resolve to display names using workspace membership data. For people fields with multiple values (array of user IDs), resolve each independently. If a user ID is not found (deleted user), insert `"Unknown User"` and log a warning.

### Coercion Error Handling

The principle is **best-effort, never fail the query.** If a single cell value can't be coerced:

- Insert NULL for that cell
- Increment a `coercion_warnings` counter on the ContextResult
- If `coercion_warnings` exceeds a threshold (e.g., >10% of cells in a column), add a warning to the result: "Column 'value' had 342 unparseable values out of 3,000 rows — results may be incomplete."

This lets the LLM know the data quality isn't perfect and it should caveat its answer accordingly.

---

## Performance Considerations

Covers Postgres Query Optimization, DuckDB Performance, Concurrency.
Touches `workspace_id`, `table_id`, `memory_limit` tables. See `database-scaling.md`.

### Postgres Query Optimization

- **Use indexes:** The records table is partitioned by `workspace_id` and indexed by `table_id` (see `database-scaling.md` for partitioning strategy). The Postgres queries naturally benefit from this.
- **Field projection:** Only extract needed fields from JSONB. `data->'fld_001'` is cheaper than `data` when JSONB is large.
- **PgFilters push work down:** Filters applied at the Postgres level reduce the volume of data transferred. The AI Query Planner should generate PgFilters aggressively for large tables. Example: if the analytical query filters on `stage = 'Closed Won'`, that filter should be in `PgFilters`, not just in the DuckDB SQL.
- **Connection pooling:** Use EveryStack's existing Postgres connection pool. Do not create dedicated connections for DuckDB hydration queries.

### DuckDB Performance

- **Bulk loading:** Use DuckDB's appender API or `INSERT INTO ... SELECT` from a JSON structure. Do not use individual INSERT statements for large datasets.
- **Memory management:** Set `memory_limit` per instance. DuckDB spills to disk if memory is exceeded, but in an ephemeral context, disk spill should be avoided (slow, and cleanup is uncertain). Instead, fail fast if the data doesn't fit in the configured memory.
- **Column types matter:** Specifying correct types at table creation time lets DuckDB use efficient storage and vectorized operations. Don't use VARCHAR for everything — numbers as VARCHAR prevents aggregation pushdown.

### Concurrency

Multiple users may trigger DuckDB queries simultaneously. Since each query gets its own in-process DuckDB instance:

- There is no lock contention between queries
- Memory usage is additive — 10 concurrent queries at 256MB each = 2.5GB
- A global memory budget (configurable, default: 2GB) should cap the total number of concurrent DuckDB instances. Queue additional requests.

```typescript
interface DuckDBPoolConfig {
  max_concurrent_instances: number; // default: 8
  max_total_memory_mb: number; // default: 2048
  per_instance_memory_mb: number; // default: 256
  queue_timeout_ms: number; // default: 10000 — how long to wait for a slot
}
```

If the queue times out, return an error: "System is busy processing other queries. Please try again in a moment."

---

## Security Considerations

Covers Data Isolation, SQL Injection, Permission Enforcement.
Touches `analytical_sql`, `read_csv`, `read_parquet`, `read_json` tables.

### Data Isolation

- Each DuckDB instance is ephemeral and in-process. No files are written to disk. No shared state between instances.
- After query execution, the DuckDB instance is explicitly closed/destroyed. The garbage collector reclaims the memory.
- There is no way for a DuckDB query to access data from another DuckDB instance, from the filesystem, or from the network.

### SQL Injection

The `analytical_sql` is generated by the AI Query Planner — which is an LLM. LLM-generated SQL is inherently untrustworthy.

**Mitigations:**

1. **Read-only enforcement:** Parse or scan the SQL for write operations. Reject DDL and DML.
2. **No filesystem access:** Block DuckDB functions that access the filesystem: `read_csv`, `read_parquet`, `read_json`, `COPY`, `EXPORT`, `IMPORT`, `ATTACH`, `LOAD`.
3. **No external access:** Block any function that makes network calls (DuckDB's httpfs extension should NOT be loaded).
4. **No shell execution:** Block DuckDB shell/system functions if any exist.
5. **Parameterize where possible:** If the analytical SQL contains literal values that originated from user input, those should be parameterized. However, since the SQL is AI-generated as a complete string, full parameterization may not be practical. The SQL safety scan is the primary defense.
6. **Execution timeout:** Hard timeout prevents infinite loops or resource exhaustion.

**Defense in depth:** Even if malicious SQL somehow executes, DuckDB is operating on an ephemeral in-memory instance containing only data the user is already authorized to see. The blast radius is limited to the user's own data for the duration of the query.

### Permission Enforcement

Permissions are checked at **two** points:

1. **QueryPlan validation (Step 2):** Verify the user has access to every table and field in the plan. This catches permission violations before any Postgres queries execute.

2. **Postgres query construction (Step 3):** Apply permission filters in the WHERE clause. This catches any discrepancy between the SDS permission data and the actual permission state (belt and suspenders).

If permissions change between validation and execution (unlikely but possible in a concurrent system), the Postgres-level filter is the authoritative check.

---

## Error Handling Strategy

### Error Categories

| Category               | Example                                      | Response                                                           |
| ---------------------- | -------------------------------------------- | ------------------------------------------------------------------ |
| **Validation error**   | User doesn't have access to referenced table | Return error immediately, don't execute                            |
| **Hydration error**    | Postgres query fails, timeout                | Return error with stage: 'hydration'                               |
| **Execution error**    | DuckDB SQL syntax error, type mismatch       | Return error with stage: 'execution', include DuckDB error message |
| **Resource limit hit** | Too many records, memory exceeded            | Return partial result with truncated: true                         |
| **Coercion warning**   | Bad data in a column                         | Continue execution, include warning in result                      |

### Error Messages for LLM Consumption

Error messages should be written so that the AI agent can understand and act on them. Instead of opaque error codes:

- Bad: `"ERROR: 42703"`
- Good: `"Column 'revnue' not found in table 'deals'. Available columns: deal_name, value, stage, primary_contact_link. Did you mean 'value'?"`

The AI Query Planner can use these error messages to self-correct and regenerate the QueryPlan.

---

## Node.js Implementation Notes

Covers DuckDB Client Library, Timeout Implementation, Memory Monitoring.

### DuckDB Client Library

Use `duckdb-async` (or the latest stable DuckDB Node.js binding). Key operations:

```typescript
import { Database } from 'duckdb-async';

// Create ephemeral in-memory instance
const db = await Database.create(':memory:');
const conn = await db.connect();

// Set resource limits
await conn.run("SET memory_limit='256MB'");
await conn.run('SET threads=2'); // limit CPU usage per instance

// Create table
await conn.run(`CREATE TABLE deals (
  record_id VARCHAR PRIMARY KEY,
  deal_name VARCHAR,
  value DOUBLE,
  stage VARCHAR,
  primary_contact_link VARCHAR[]
)`);

// Bulk insert (use prepared statements for safety)
const stmt = await conn.prepare('INSERT INTO deals VALUES ($1, $2, $3, $4, $5)');
for (const record of records) {
  await stmt.run(record.id, record.name, record.value, record.stage, record.links);
}
await stmt.finalize();

// Execute analytical query
const result = await conn.all(analyticalSql);

// Clean up
await conn.close();
await db.close();
```

### Timeout Implementation

DuckDB doesn't have a native query timeout in all client libraries. Implement at the application level:

```typescript
async function executeWithTimeout(
  conn: Connection,
  sql: string,
  timeoutMs: number,
): Promise<any[]> {
  return Promise.race([
    conn.all(sql),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}
```

Note: This aborts the Promise, but the underlying DuckDB execution may continue until the instance is closed. Always close the instance in a `finally` block.

### Memory Monitoring

Before creating a new DuckDB instance, check the global memory budget:

```typescript
class DuckDBPool {
  private activeInstances: number = 0;
  private totalMemoryAllocated: number = 0;
  private queue: Array<{ resolve: Function; reject: Function }> = [];

  async acquire(memoryMb: number): Promise<Database> {
    if (this.totalMemoryAllocated + memoryMb > this.config.max_total_memory_mb) {
      // Wait for a slot or timeout
      return this.enqueue(memoryMb);
    }
    this.activeInstances++;
    this.totalMemoryAllocated += memoryMb;
    return Database.create(':memory:');
  }

  release(memoryMb: number): void {
    this.activeInstances--;
    this.totalMemoryAllocated -= memoryMb;
    this.processQueue();
  }
}
```

---

## Testing Strategy

Covers Unit Tests, Integration Tests, Performance Benchmarks.
Touches `read_csv` tables.

### Unit Tests

1. **Type coercion:** Test every EveryStack field type → DuckDB type mapping, including edge cases (nulls, malformed values, empty arrays, nested objects). **Critically: test option ID → label resolution for single_select, multi_select, and status fields (including stale/missing option IDs). Test user ID → display name resolution for people, created_by, and updated_by fields (including deleted users).**
2. **SQL safety scanner:** Test that all prohibited statements and functions are caught. Include adversarial cases: `SELECT * FROM deals; DROP TABLE deals`, SQL in comments, `read_csv` in subqueries.
3. **Permission filtering:** Test that unauthorized tables/fields are rejected at validation.
4. **PgFilter generation:** Test that each filter operator produces correct Postgres WHERE clauses with proper parameterization.

### Integration Tests

1. **End-to-end simple query:** Create test records in Postgres, build a QueryPlan, execute through the full pipeline, verify ContextResult.
2. **Cross-base JOIN:** Two tables with link fields, verify JOIN produces correct results.
3. **Aggregation accuracy:** Load known data, run SUM/AVG/COUNT, verify exact results (no floating point drift).
4. **Large dataset handling:** Load 50,000 records, verify memory stays within limits and query completes within timeout.
5. **Concurrent queries:** Run 8 simultaneous queries, verify isolation (no data leakage between instances) and resource limits (queue activates at capacity).
6. **Error recovery:** Malformed SQL, missing columns, type mismatches — verify clean error messages in ContextResult.
7. **Permission enforcement:** Query that references a table the user can't access — verify rejection.
8. **ID→label resolution end-to-end:** Create records with single_select option IDs and people user IDs. Execute a query that filters by option label (e.g., `WHERE stage = 'Closed Won'`). Verify DuckDB contains resolved labels, not raw IDs, and the filter produces correct results.

### Performance Benchmarks

Establish baselines for:

- Hydration time: 10k records from Postgres → DuckDB (target: <500ms)
- Simple aggregation: COUNT/SUM/AVG over 50k records (target: <100ms)
- Cross-base JOIN: 10k records × 5k records with link field (target: <200ms)
- Full pipeline: hydration + query + result construction (target: <2s for typical queries)

---

## Claude Code Prompt Roadmap

Covers Prompt 1: Core Types and Interfaces, Prompt 2: SQL Safety Scanner, Prompt 3: Type Coercion Module, Prompt 4: QueryPlan Validator, Prompt 5: Postgres Hydration Module, Prompt 6: DuckDB Instance Manager (Pool).
See `ai-data-contract.md`, `data-model.md`.

### Prompt 1: Core Types and Interfaces

```
Define the TypeScript types for the DuckDB Context Layer.

File: `src/services/duckdb-context/types.ts`

Create interfaces for:
- QueryPlan, TableSource, FieldSelection, JoinDefinition, PgFilter (as specified in the reference doc)
- ContextResult, ColumnMeta (as specified in the reference doc)
- DuckDBPoolConfig
- TypeCoercionWarning: { table_alias: string, column: string, row_count_affected: number, message: string }

Also create:
- A constant map FIELD_TYPE_TO_DUCKDB mapping EveryStack field type strings to DuckDB type strings (see the type mapping table in the reference doc)
- A constant set BLOCKED_SQL_PATTERNS containing regex patterns for prohibited SQL operations (INSERT, UPDATE, DELETE, DROP, CREATE, ALTER, TRUNCATE, read_csv, read_parquet, read_json, COPY, EXPORT, IMPORT, ATTACH, LOAD, httpfs)

Types only, no implementation. Add JSDoc comments explaining design decisions.
```

### Prompt 2: SQL Safety Scanner

```
Implement the SQL safety scanner that validates analytical SQL before execution.

File: `src/services/duckdb-context/sql-scanner.ts`

Export a function `validateAnalyticalSql(sql: string): { valid: boolean; reason?: string }` that:

1. Rejects empty or whitespace-only SQL
2. Strips SQL comments (both -- and /* */ style) before scanning, to prevent hiding prohibited operations in comments
3. Checks against BLOCKED_SQL_PATTERNS from the types file
4. Ensures the SQL starts with SELECT (after stripping whitespace and comments)
5. Rejects SQL containing semicolons followed by non-whitespace (prevents multi-statement injection like "SELECT ...; DROP TABLE ...")
6. Returns { valid: true } if all checks pass, or { valid: false, reason: "..." } with a human-readable explanation of what was rejected and why

The reason string should be useful to an LLM for self-correction. Example: "SQL contains 'DROP TABLE' which is a prohibited write operation. Only SELECT statements are allowed."

Add comprehensive unit tests in `src/services/duckdb-context/__tests__/sql-scanner.test.ts` covering:
- Valid SELECT statements (simple, with JOINs, with subqueries, with CTEs)
- All blocked patterns
- Multi-statement injection attempts
- Prohibited operations hidden in comments
- Edge cases: empty string, only whitespace, only comments
```

### Prompt 3: Type Coercion Module

```
Implement the type coercion module that converts EveryStack JSONB values to DuckDB-compatible values.

Reference docs to read first:
- `ai-data-contract.md` — canonical JSONB format per field type
- `data-model.md` > Field System Architecture — canonical storage shapes for each field type
- Schema Descriptor Service spec — SDS provides field metadata including option labels and user names

File: `src/services/duckdb-context/type-coercion.ts`

Export a function `coerceValue(jsonbValue: any, fieldType: string, fieldMeta?: FieldDescriptor): { value: any; warning?: string }` that:

1. Handles null/undefined → returns { value: null }
2. Maps each EveryStack field type to the appropriate JavaScript value for DuckDB insertion (see type mapping table in reference doc)
3. For numbers: attempts to parse strings that look like numbers. Returns null + warning for unparseable values.
4. For booleans: accepts true/false, 1/0, "true"/"false"
5. For dates: parses ISO 8601 strings. Returns null + warning for unparseable dates.
6. For arrays (cross_base_link): ensures result is always an array. Wraps single values.
7. For nested objects: JSON.stringify them to a string.
8. For single_select and status: resolve option ID → option label using fieldMeta.options[]. If fieldMeta is unavailable or option ID not found, return raw ID + warning.
9. For multi_select: resolve each option ID in the array → option label using fieldMeta.options[]. Return as VARCHAR[].
10. For people, created_by, updated_by: resolve user ID → display name. Accept a user lookup map (see resolveUserNames below). If user not found, return "Unknown User" + warning.
11. Never throws. Always returns a value (even if null) and optionally a warning string.

Also export:

`buildCreateTableSql(alias: string, fields: FieldSelection[]): string` — generates a DuckDB CREATE TABLE statement with correctly typed columns based on the FIELD_TYPE_TO_DUCKDB mapping.

`resolveUserNames(userIds: string[], workspaceId: string, db: DatabaseConnection): Promise<Map<string, string>>` — batch-fetches display names for all user IDs referenced across all people-type fields in a table's hydration batch. Called once per table, not once per row.

Add unit tests covering every field type, null handling, malformed values, option ID→label resolution (including missing options), user ID→name resolution (including deleted users), and the CREATE TABLE generator.
```

### Prompt 4: QueryPlan Validator

```
Implement the QueryPlan validation module.

File: `src/services/duckdb-context/plan-validator.ts`

Export a function `validateQueryPlan(plan: QueryPlan, sds: SchemaDescriptorService): Promise<{ valid: boolean; errors: string[] }>` that:

1. Checks that workspace_id and user_id are non-empty
2. Checks that sources[] is non-empty and has no more than 10 entries
3. For each source: verifies the user has access to the table and all referenced fields using SDS permission checks
4. For large tables (record_count_approx > 100,000 from SDS): warns if no PgFilters are specified (performance concern, not a hard error)
5. Validates all JOIN definitions: both aliases exist in sources, the join fields exist in their respective table's field selections
6. Checks JOIN cardinality consistency with SDS link definitions
7. Validates analytical_sql using the SQL safety scanner from Prompt 2
8. Enforces max join depth of 3 (count the longest chain of JOINs)
9. Returns all validation errors as an array (not just the first one) so the AI can fix multiple issues at once

Add tests covering permission denial, invalid joins, SQL rejection, and oversized queries.
```

### Prompt 5: Postgres Hydration Module

```
Implement the module that fetches records from Postgres and prepares them for DuckDB loading.

Reference docs to read first:
- `ai-data-contract.md` — explains why canonical JSONB stores option IDs/user IDs that need resolution
- `data-model.md` > Field System Architecture — canonical storage shapes

File: `src/services/duckdb-context/hydrator.ts`

Export a function `hydrateTable(source: TableSource, workspaceId: string, userId: string, db: DatabaseConnection, sds: SchemaDescriptorService): Promise<HydrationResult>` that:

1. Builds a parameterized Postgres query that:
   - Filters by workspace_id and table_id
   - Excludes soft-deleted records (deleted_at IS NULL)
   - Applies all PgFilters as parameterized WHERE clauses
   - Projects only the specified fields from the JSONB data column
   - Applies LIMIT based on max_records_per_table
2. Executes the query using EveryStack's existing connection pool
3. Retrieves field metadata from SDS for all fields in source.fields[] (needed for option ID→label and user ID→name resolution in the coercion step)
4. For people-type fields: batch-fetch user display names using resolveUserNames() from the type coercion module (one query for all unique user IDs across all rows, not per-row)
5. For each row, coerces each field value using the type coercion module from Prompt 3, passing the field's FieldDescriptor metadata
6. Collects coercion warnings
7. Returns a HydrationResult containing the typed rows (with labels/names, not IDs), the count, and any warnings

Interface HydrationResult:
  rows: Record<string, any>[]  — each row is { record_id, ...field_aliases }
  count: number
  warnings: TypeCoercionWarning[]
  query_time_ms: number

Also export `buildPgFilterClause(filter: PgFilter, paramIndex: number): { sql: string; params: any[] }` as a separate testable function that generates a parameterized WHERE clause fragment for each filter operator.

IMPORTANT: All SQL must be parameterized. Never interpolate values. The PgFilter values are AI-generated and must be treated as untrusted.

Add unit tests for filter clause generation (every operator) and integration tests for the full hydration flow.
```

### Prompt 6: DuckDB Instance Manager (Pool)

```
Implement the DuckDB instance pool that manages ephemeral DuckDB instances with resource limits.

File: `src/services/duckdb-context/instance-pool.ts`

Implement a class `DuckDBPool` with:

Constructor: accepts DuckDBPoolConfig (max_concurrent_instances, max_total_memory_mb, per_instance_memory_mb, queue_timeout_ms)

Methods:
- `acquire(): Promise<DuckDBInstance>` — creates a new in-memory DuckDB instance if within resource limits, otherwise queues the request. Returns a wrapper object that tracks the instance's memory allocation.
- `release(instance: DuckDBInstance): Promise<void>` — closes the DuckDB connection and database, frees the memory allocation, processes any queued requests.
- `getStatus(): PoolStatus` — returns current active count, queued count, total memory allocated.

DuckDBInstance wrapper:
- Exposes `connection` for running queries
- Tracks creation time for timeout enforcement
- Has a `close()` method that calls pool.release()

The pool must:
- Enforce max_concurrent_instances
- Enforce max_total_memory_mb
- Queue requests that exceed limits, with queue_timeout_ms
- Clean up instances that have been alive longer than a hard timeout (5 minutes — safety net for leaked instances)
- Be safe for concurrent access (multiple async operations acquiring/releasing simultaneously)

Add tests for:
- Basic acquire/release cycle
- Queueing when at capacity
- Queue timeout rejection
- Concurrent acquire/release
- Leaked instance cleanup
```

### Prompt 7: Query Executor (Core Pipeline)

```
Implement the core query execution pipeline that ties everything together.

File: `src/services/duckdb-context/executor.ts`

Export a class `DuckDBQueryExecutor` with:

Constructor: accepts DuckDBPool, DatabaseConnection (Postgres), SchemaDescriptorService

Method: `execute(plan: QueryPlan): Promise<ContextResult>`

This is the main entry point. It orchestrates the full pipeline:

1. Validate the QueryPlan using plan-validator
2. Acquire a DuckDB instance from the pool
3. In a try/finally block (always release the instance):
   a. Hydrate all tables concurrently using the hydrator (Promise.all)
   b. For each hydrated table: create the DuckDB table and bulk-insert rows
   c. Execute the analytical_sql with a timeout
   d. Build and return the ContextResult
4. On any error at any stage: return a ContextResult with success: false and appropriate error info

Implementation details:
- Use Promise.all for concurrent Postgres hydration (all table sources are independent). Pass the SDS instance to each hydrateTable() call for option ID→label and user ID→name resolution.
- For DuckDB table creation and insertion: do these sequentially per table (they're in the same DuckDB instance)
- Use the DuckDB appender API for bulk insertion if available in the Node.js client, otherwise use batched INSERT statements (batch size: 1000 rows)
- Set DuckDB memory_limit and threads after acquiring the instance
- Apply execution timeout using Promise.race pattern
- Collect all coercion warnings from hydration and include in ContextResult
- Measure and include execution_time_ms (wall clock for the entire execute() call)
- Populate sources[] in ContextResult with table names, record counts, and human-readable filter descriptions

Add integration tests covering:
- Simple single-table query
- Cross-base JOIN query
- Aggregation query
- Error handling at each stage (validation, hydration, execution)
- Resource limit enforcement (timeout, max records)
```

### Prompt 8: Service Facade

```
Create the DuckDB Context Layer service facade and internal API endpoint.

File: `src/services/duckdb-context/service.ts`

Export a class `DuckDBContextService` that:

1. Initializes the DuckDBPool with configuration from environment/config
2. Exposes a single method: `query(plan: QueryPlan): Promise<ContextResult>`
   - Delegates to DuckDBQueryExecutor.execute()
   - Adds request-level logging: plan summary, execution time, result row count, any errors
   - Emits metrics: query duration, records hydrated, cache hit/miss (for future use), error rate

File: `src/routes/internal/duckdb-context.ts`

Create an internal API route:
- `POST /internal/query/execute` — accepts a QueryPlan in the request body, calls DuckDBContextService.query(), returns ContextResult
- Requires authentication, extracts user_id from auth context
- Validates that the user_id in the QueryPlan matches the authenticated user (prevents privilege escalation)
- Standard error handling and request logging

This is an internal endpoint not exposed to end users. It's called by the AI Query Planner and AI Field Agent services.

Add integration tests for the full service flow including the API endpoint.
```

---

## Appendix: Future Extensions (Do Not Build Yet)

These are documented for awareness. Do not implement until explicitly needed.

1. **Result caching:** Cache ContextResults keyed by a hash of the QueryPlan. Invalidate on record changes. Useful for Smart Docs live queries that re-execute on page load.

2. **Materialized views in DuckDB:** For very frequent queries (e.g., dashboard widgets), pre-hydrate and keep a DuckDB instance alive longer. Trades memory for latency.

3. **Streaming results:** For very large result sets, stream rows back instead of collecting them all. Useful for export-to-CSV flows.

4. **Query cost estimation:** Before executing, estimate the cost (time, memory, Postgres load) of a QueryPlan and reject or warn on expensive queries. Useful for self-serve AI features where users might accidentally ask questions that scan millions of records.

5. **Write-through for AI Field Agents:** After the DuckDB query produces a result, write it back to the record's AI field in Postgres. This is a controlled write path specific to AI Field Agents (see `ai-field-agents-ref.md` > Execution Engine for the value write step), not a general mutation capability. This write path would use `aiToCanonical()` (see `ai-data-contract.md` > DuckDB Context Layer — The Exemption).
