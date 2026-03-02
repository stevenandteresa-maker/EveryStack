# Schema Descriptor Service — Technical Spec & Claude Code Prompt Roadmap

> **Reconciliation note (2026-02-27, pass 2):** Re-verified against `GLOSSARY.md` (source of truth).
> **Changes (pass 2):** No naming drift or scope issues found. All terms, post-MVP tags, and cross-references confirmed aligned with glossary. Prior pass was thorough.
>
> **Changes (pass 1, 2026-02-27):**
> - Replaced "interface-level permission model" → "workspace role and Table View-scoped permission model" throughout (glossary naming discipline: "Interface" as a Table View → "Table View")
> - Replaced "assigned interfaces" → "assigned Table Views and workspace role"
> - Replaced `cross_base_link` field type in SDS output → `linked_record` (glossary DB entity reference: fields type=linked_record; concept name is "Cross-Link")
> - Tagged "Smart Docs live data" as **Post-MVP** (Wiki / Knowledge Base is post-MVP per glossary)
> - Tagged "AI-assisted view creation" → clarified as "AI-assisted Table View creation" for MVP context
> - Tagged "DuckDB analytical query layer" references as **Post-MVP** per glossary
> - Tagged "Smart Docs Live Queries" in "What This Unlocks" as **Post-MVP**
> - Tagged "AI Query Planner" references as consuming DuckDB (**post-MVP**)
> - Added "bases" context note: SDS "bases" correspond to Base Connections (connected external platform bases)
> - Updated cross-references to mark post-MVP referenced docs
> - Tagged vector embeddings / semantic retrieval references as **Post-MVP** per glossary

> **Reference doc (Tier 3).** Read-only module that exposes EveryStack's data model in a condensed, LLM-optimized format. Foundation for all AI features: natural language querying, AI-assisted Table View creation, **post-MVP:** Smart Docs live data, agent workspace understanding, and the DuckDB analytical query layer.
> Cross-references: `ai-architecture.md` (Context Builder, tool definitions, MCP server), `data-model.md` (field system, FieldTypeRegistry), `permissions.md` (workspace role and Table View-scoped permission model, field-level visibility), `cross-linking.md` (Cross-Link definitions, cardinality, link graph), `vector-embeddings.md` **(post-MVP)** (semantic retrieval, Context Builder token budgets — SDS provides structured schema, embeddings provide semantic relevance ranking), `ai-data-contract.md` (FieldTypeRegistry shared — `canonicalToAIContext()` for read path), `agent-architecture.md` **(post-MVP)** (agents are primary consumers — §1.7 Context Builder gap analysis), `command-bar.md` (Command Bar AI is a primary consumer surface), `duckdb-context-layer-ref.md` **(post-MVP)** (companion query execution module — SDS provides schema discovery, DuckDB provides analytical execution)
> Implements: `packages/shared/ai/CLAUDE.md` (Context Builder rules)
> Cross-references (cont.): `workspace-map.md` **(post-MVP)** (SDS `describe_workspace()` and `describe_links()` are primary data sources for the topology graph — `WorkspaceDescriptor` JSON shape consumed by graph generator, permission-filtered schema ensures map never leaks structural info beyond user's scope)
> Last updated: 2026-02-27 — Glossary reconciliation pass 2 (confirmed alignment, no changes needed). Prior: 2026-02-27 pass 1 — Initial glossary reconciliation. Prior: 2026-02-21 — Added `workspace-map.md` cross-reference.

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Overview | 45–52 | SDS purpose, relationship to AI features |
| Architecture Position | 53–78 | Where SDS sits in the stack, dependencies |
| Output Schema | 79–193 | WorkspaceDescriptor JSON structure, field descriptions, cross-link mapping |
| Permissions Integration | 194–208 | Per-user filtered schema output based on role |
| API Surface | 209–223 | 3 endpoints, request/response formats |
| Caching Strategy | 224–237 | 2-tier cache, schema_version_hash invalidation |
| DuckDB Context Layer — Companion Module (Post-MVP) | 238–272 | How SDS feeds DuckDB for analytical queries |
| Claude Code Prompt Roadmap | 273–499 | 8-prompt implementation roadmap |
| Implementation Order | 500–516 | Dependency-ordered build sequence |
| What This Unlocks (Next Modules) | 517–530 | Features that depend on SDS being complete |
| Notes | 531–536 | Implementation notes and caveats |

---

## Overview

The Schema Descriptor Service (SDS) is a read-only module that exposes EveryStack's existing data model — Base Connections, tables, fields, field types, Cross-Links, and relationship cardinality — in a condensed, LLM-optimized format. It serves as the foundation for all downstream AI features: natural language querying, AI-assisted Table View creation, and **(post-MVP)** Smart Docs live data and the DuckDB analytical query layer.

The SDS does not modify any existing infrastructure. It is a consumer of the FieldTypeRegistry, the records table metadata, and the Cross-Link graph.

---

## Architecture Position

```
┌─────────────────────────────────────────────────────────┐
│                    AI Layer                               │
│  (Natural language → query plan → response)               │
│  Post-MVP: → DuckDB → analytical response                 │
└──────────────────────┬──────────────────────────────────┘
                       │ calls
┌──────────────────────▼──────────────────────────────────┐
│              Schema Descriptor Service                   │
│  describe_workspace() → condensed schema JSON            │
│  describe_table()     → single table + linked fields     │
│  describe_links()     → Cross-Link relationship graph    │
└──────┬──────────┬────────────────┬──────────────────────┘
       │ reads    │ reads          │ reads
       ▼          ▼                ▼
 FieldType    Records Table    Cross-Link
 Registry     Metadata         Definitions
 (existing)   (existing)       (existing)
```

**Key principle:** The SDS never touches the write path. It reads metadata only — no record data, no mutations, no sync adapter involvement. See `data-model.md` > Field Type Registry for the source data model, `cross-linking.md` for Cross-Link definitions and cardinality, and `permissions.md` for the workspace role and Table View-scoped access model the permission filter enforces.

---

## Output Schema

The SDS produces a JSON structure optimized for LLM consumption. This means: short keys, type hints the LLM can reason about, cardinality indicators for query planning, and human-readable field descriptions where available.

**Note on "bases":** In SDS output, `bases` refers to connected external platform bases (Airtable bases, SmartSuite workspaces, Notion databases) — these correspond to **Base Connection** entities in the DB (`base_connections` table). A single EveryStack Workspace can contain tables from multiple Base Connections across different platforms. Native EveryStack tables (not synced from any platform) appear under a synthetic "Native" base grouping.

### Workspace Descriptor (condensed)

```json
{
  "workspace_id": "ws_abc123",
  "bases": [
    {
      "base_id": "base_001",
      "name": "Sales Pipeline",
      "tables": [
        {
          "table_id": "tbl_deals",
          "name": "Deals",
          "record_count_approx": 12400,
          "fields": [
            {
              "field_id": "fld_001",
              "name": "Deal Name",
              "type": "text",
              "searchable": true
            },
            {
              "field_id": "fld_002",
              "name": "Value",
              "type": "currency",
              "currency_code": "USD",
              "aggregatable": true
            },
            {
              "field_id": "fld_003",
              "name": "Stage",
              "type": "single_select",
              "options": ["Prospect", "Qualified", "Proposal", "Closed Won", "Closed Lost"]
            },
            {
              "field_id": "fld_004",
              "name": "Primary Contact",
              "type": "linked_record",
              "linked_base": "base_002",
              "linked_table": "tbl_contacts",
              "cardinality": "many_to_one",
              "symmetric_field": "fld_101"
            }
          ]
        }
      ]
    },
    {
      "base_id": "base_002",
      "name": "CRM",
      "tables": [
        {
          "table_id": "tbl_contacts",
          "name": "Contacts",
          "record_count_approx": 8200,
          "fields": [
            {
              "field_id": "fld_100",
              "name": "Name",
              "type": "text",
              "searchable": true
            },
            {
              "field_id": "fld_101",
              "name": "Deals",
              "type": "linked_record",
              "linked_base": "base_001",
              "linked_table": "tbl_deals",
              "cardinality": "one_to_many",
              "symmetric_field": "fld_004"
            },
            {
              "field_id": "fld_102",
              "name": "Segment",
              "type": "single_select",
              "options": ["SMB", "Mid-Market", "Enterprise"]
            }
          ]
        }
      ]
    }
  ],
  "link_graph": [
    {
      "from": "base_001.tbl_deals.fld_004",
      "to": "base_002.tbl_contacts.fld_101",
      "cardinality": "many_to_one",
      "label": "Deal → Primary Contact"
    }
  ]
}
```

### Design Decisions for LLM Optimization

1. **`record_count_approx`** — Lets the AI estimate whether a full table scan is feasible or whether it needs to filter first. Sourced from Postgres `pg_stat_user_tables.n_live_tup` (fast, no table scan).

2. **`aggregatable` flag on numeric/currency fields** — Signals to the AI that SUM/AVG/MIN/MAX operations are meaningful on this field. Prevents the LLM from trying to aggregate text fields.

3. **`searchable` flag** — Indicates fields suitable for WHERE clause filtering or full-text search. Guides the AI toward efficient query plans.

4. **`options` array on select fields** — Gives the LLM the valid enum values so it can generate correct filter predicates without guessing.

5. **`link_graph` as a separate top-level array** — Provides the AI with a quick traversal map for Cross-Link JOINs without having to reconstruct it from individual field definitions.

6. **`cardinality` on link fields** — Critical for the AI to understand whether a JOIN will fan out (one-to-many) or collapse (many-to-one). This directly affects whether **(post-MVP)** DuckDB aggregation is needed.

---

## Permissions Integration

The SDS respects EveryStack's workspace role and Table View-scoped permission model. The schema descriptor is **filtered per-user**: a user only sees tables and fields they have access to through their workspace role and assigned Table Views. This ensures the AI can never discover or reference data the user shouldn't know about.

```
describe_workspace(workspace_id, user_id)
  → resolve user's workspace role and Table View permissions
  → filter tables/fields to visible set
  → return filtered schema
```

This is a critical security boundary. The AI receives a permission-scoped schema, so every downstream query it generates is inherently constrained to authorized data. Defense in depth: **(post-MVP)** the DuckDB hydration step (separate module) also applies row-level filtering. See `permissions.md` > Runtime Resolution for the 5-step permission resolution algorithm, and **(post-MVP)** `agent-architecture.md` > Agent Identity & Delegation for how agent scope further narrows permissions beyond the delegating user's access.

---

## API Surface

Three endpoints/functions, all read-only:

### `describe_workspace(workspace_id, user_id)`
Returns the full condensed schema for all tables/fields the user can access across all Base Connections in the workspace. This is the primary entry point for AI sessions. Cached aggressively (see Caching section).

### `describe_table(table_id, user_id)`
Returns detailed schema for a single table including all field metadata, linked field targets, and **(post-MVP)** lookup/rollup definitions. Used when the AI needs to drill into a specific table after initial workspace discovery.

### `describe_links(workspace_id, user_id)`
Returns only the Cross-Link graph. Lightweight call for when the AI is specifically planning a Cross-Link JOIN and doesn't need full field details.

---

## Caching Strategy

Schema metadata changes infrequently relative to record data. The SDS uses a two-layer cache:

1. **In-memory cache (per-workspace)** — Stores the full unfiltered workspace schema. Invalidated on any schema mutation event (field added/removed/modified, table created/deleted, Cross-Link created/deleted). These events already exist in EveryStack's event system.

2. **Per-user filtered cache** — Stores the permission-filtered version for each user. Invalidated when the user's Table View permissions change OR when the underlying workspace schema cache invalidates.

Cache key: `sds:{workspace_id}:{schema_version_hash}:{user_id}`

The `schema_version_hash` is a hash of all schema-relevant metadata (field definitions, table structure, Cross-Link definitions). Redis key patterns follow the conventions in `CLAUDE.md` > Redis Key Namespace Convention. Both tiers use TTLs, consistent with the `volatile-lru` eviction policy.

---

## DuckDB Context Layer — Companion Module (Post-MVP)

> **Post-MVP per glossary:** The DuckDB analytical layer is explicitly excluded from MVP scope.

While the SDS is the schema discovery layer, the DuckDB Context Layer is the query execution layer. They work together but are separate modules. Documenting the interface here for completeness:

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI asks         │────▶│  SDS returns     │────▶│  AI generates    │
│  "top 10 deals   │     │  schema: deals   │     │  query plan:     │
│   by value with  │     │  has Value field, │     │  1. Pull deals   │
│   enterprise     │     │  links to         │     │  2. Pull contacts│
│   contacts"      │     │  contacts with    │     │  3. DuckDB JOIN  │
│                  │     │  Segment field    │     │  4. Filter+rank  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                               ┌──────────────────┐
                                               │  DuckDB Sandbox   │
                                               │  (Post-MVP)       │
                                               │                   │
                                               │  1. Hydrate from  │
                                               │     Postgres      │
                                               │  2. Load JSONB    │
                                               │     into DuckDB   │
                                               │  3. Execute SQL   │
                                               │  4. Return top 10 │
                                               │     (concise)     │
                                               └──────────────────┘
```

The DuckDB module is a separate implementation effort. This spec focuses on the SDS only. See `ai-data-contract.md` > DuckDB Context Layer for the canonical JSONB exemption (DuckDB results are ephemeral and bypass `aiToCanonical()`), and `duckdb-context-layer-ref.md` for the full query execution spec.

---

## Claude Code Prompt Roadmap

Below are the bite-sized prompts for implementing the Schema Descriptor Service, ordered for incremental build-up. Each prompt is scoped to a single, testable deliverable.

---


> **⚠️ BUILD SEQUENCE NOTE:** The prompts below are a suggested decomposition of this feature into buildable units. They are **not a build plan**. The active phase build doc controls what to build and in what order. When creating a phase build doc, cherry-pick from these prompts and reorder as needed for the sprint's scope.

### Prompt 1: Schema Descriptor Types

```
Define the TypeScript types for the Schema Descriptor Service output.

Create a file `src/services/schema-descriptor/types.ts` with these interfaces:

- `WorkspaceDescriptor` — top-level workspace schema containing bases array and link_graph
- `BaseDescriptor` — base_id, name, tables array (corresponds to Base Connections)
- `TableDescriptor` — table_id, name, record_count_approx, fields array
- `FieldDescriptor` — field_id, name, type (string matching FieldTypeRegistry types), plus optional type-specific metadata:
  - For select fields: `options: string[]`
  - For currency fields: `currency_code: string`
  - For linked_record fields (Cross-Links): `linked_base`, `linked_table`, `cardinality` (one_to_one | one_to_many | many_to_one), `symmetric_field`
  - For all fields: `searchable: boolean`, `aggregatable: boolean`
- `LinkEdge` — from (dotted path), to (dotted path), cardinality, label

All types should be exported. Add JSDoc comments explaining LLM optimization choices (e.g., why record_count_approx exists, why cardinality matters for query planning).

No implementation logic — types only.
```

---

### Prompt 2: Field Metadata Mapper

```
Create the field metadata mapper that translates FieldTypeRegistry entries into FieldDescriptor objects optimized for LLM consumption.

File: `src/services/schema-descriptor/field-mapper.ts`

This module exports a function `mapFieldToDescriptor(field: FieldDefinition): FieldDescriptor` that:

1. Maps the field's type from the FieldTypeRegistry to the descriptor type string
2. Sets `searchable: true` for text, email, url, phone, and rich_text field types
3. Sets `aggregatable: true` for number, currency, percent, duration, and rating field types
4. For single_select and multi_select: extracts the `options` array from the field config
5. For currency fields: extracts `currency_code`
6. For linked_record fields (Cross-Links): extracts `linked_base`, `linked_table`, `cardinality`, and `symmetric_field` from the Cross-Link definition
7. For lookup fields (post-MVP): includes `source_link_field` and `source_value_field` so the AI knows how lookups resolve
8. For rollup fields (post-MVP): includes `source_link_field`, `source_value_field`, and `rollup_function`

Import the existing FieldTypeRegistry types. Do not modify any existing code. This is a pure read-only mapping function. See `data-model.md` > Field Type Registry for the canonical field type definitions, and `ai-data-contract.md` for the `canonicalToAIContext()` read path that the AI uses alongside these descriptors.

Add unit tests in `src/services/schema-descriptor/__tests__/field-mapper.test.ts` covering each field type branch.
```

---

### Prompt 3: Table Descriptor Builder

```
Create the table descriptor builder that assembles a TableDescriptor from existing table metadata.

File: `src/services/schema-descriptor/table-builder.ts`

Export a function `buildTableDescriptor(tableId: string, db: DatabaseConnection): Promise<TableDescriptor>` that:

1. Queries the table metadata (name, id) from the existing tables table/config
2. Gets approximate row count using `SELECT reltuples::bigint FROM pg_class WHERE relname = $1` — this is instant and doesn't scan the table
3. Retrieves all field definitions for the table from the existing field configuration store
4. Maps each field through `mapFieldToDescriptor()` from Prompt 2
5. Returns the assembled TableDescriptor

This function does NOT filter by permissions — that happens at a higher layer.

Add unit tests that mock the database calls and verify correct assembly.
```

---

### Prompt 4: Workspace Descriptor Builder (Unfiltered)

```
Create the workspace descriptor builder that assembles the full unfiltered WorkspaceDescriptor.

File: `src/services/schema-descriptor/workspace-builder.ts`

Export a function `buildWorkspaceDescriptor(workspaceId: string, db: DatabaseConnection): Promise<WorkspaceDescriptor>` that:

1. Queries all Base Connections belonging to the workspace
2. For each Base Connection, queries all tables and builds TableDescriptors using `buildTableDescriptor()` from Prompt 3
3. Scans all linked_record (Cross-Link) fields across the workspace and builds the `link_graph` array of `LinkEdge` objects. Each link appears once (deduplicated — don't include both directions of a symmetric link)
4. Generates a human-readable `label` for each link edge: "{SourceTable} → {TargetTable} via {FieldName}"
5. Returns the assembled WorkspaceDescriptor

Performance requirement: Use batched queries where possible. Don't issue a separate query per field — query all fields for a Base Connection at once and group in application code.

Add integration tests that set up a test workspace with two Base Connections, linked tables, and verify the full descriptor output including link_graph correctness.
```

---

### Prompt 5: Permission Filter Layer

```
Create the permission filter that scopes a WorkspaceDescriptor to what a specific user can see.

File: `src/services/schema-descriptor/permission-filter.ts`

Export a function `filterDescriptorByPermissions(descriptor: WorkspaceDescriptor, userId: string, permissionResolver: PermissionResolver): Promise<WorkspaceDescriptor>` that:

1. Takes the full unfiltered WorkspaceDescriptor from Prompt 4
2. Resolves the user's workspace role and Table View-scoped permissions using the existing permission system
3. Removes bases the user has no access to
4. Within accessible bases, removes tables the user has no access to
5. Within accessible tables, removes fields the user has no access to (respects field-level visibility if configured)
6. Prunes the link_graph to only include edges where BOTH sides are accessible to the user
7. Returns the filtered WorkspaceDescriptor

IMPORTANT: This must be a deep copy — never mutate the cached unfiltered descriptor.

Edge case: If a linked_record (Cross-Link) field is visible but the linked table is not, include the field but set `linked_table` to null and `cardinality` to "restricted". This tells the AI that a link exists but the target is not accessible — preventing confusing query plans.

Add unit tests covering:
- User with full access sees everything
- User with partial access sees filtered set
- Link graph pruning when one side is restricted
- Deep copy verification (original not mutated)
```

---

### Prompt 6: Caching Layer

```
Create the caching layer for the Schema Descriptor Service.

File: `src/services/schema-descriptor/cache.ts`

Implement a two-tier cache:

**Tier 1: Workspace schema cache (unfiltered)**
- Key: `sds:workspace:{workspaceId}`
- Value: Full unfiltered WorkspaceDescriptor + a `schema_hash` (SHA-256 of the serialized descriptor)
- TTL: 5 minutes (backstop — primary invalidation is event-driven)
- Invalidation: Subscribe to existing schema mutation events (field_created, field_updated, field_deleted, table_created, table_deleted, link_created, link_deleted). On any such event for the workspace, invalidate this cache entry.

**Tier 2: Per-user filtered cache**
- Key: `sds:user:{workspaceId}:{userId}:{schema_hash}`
- Value: Permission-filtered WorkspaceDescriptor
- The schema_hash in the key means this auto-invalidates when the workspace schema changes
- Also invalidate when user permissions change (subscribe to permission_updated events)
- TTL: 5 minutes

Export a class `SchemaDescriptorCache` with methods:
- `getWorkspaceDescriptor(workspaceId, userId)` — checks both tiers, rebuilds as needed
- `invalidateWorkspace(workspaceId)` — clears tier 1 + all tier 2 for that workspace
- `invalidateUser(workspaceId, userId)` — clears tier 2 for that user only

Use your existing cache infrastructure (Redis or in-memory, whatever EveryStack currently uses). Don't introduce new dependencies.

Add tests verifying cache hit/miss/invalidation behavior.
```

---

### Prompt 7: Service Facade & API Endpoints

```
Create the Schema Descriptor Service facade that ties everything together, plus the internal API endpoints.

File: `src/services/schema-descriptor/service.ts`

Export a class `SchemaDescriptorService` with three methods matching the API surface:

1. `describeWorkspace(workspaceId: string, userId: string): Promise<WorkspaceDescriptor>`
   - Uses the cache from Prompt 6
   - Falls back to building + filtering if cache miss

2. `describeTable(tableId: string, userId: string): Promise<TableDescriptor | null>`
   - Builds a single table descriptor
   - Applies permission filtering
   - Returns null if user has no access

3. `describeLinks(workspaceId: string, userId: string): Promise<LinkEdge[]>`
   - Returns just the permission-filtered link graph
   - Lightweight — can extract from cached workspace descriptor if available

File: `src/routes/internal/schema-descriptor.ts`

Create internal API routes (not exposed to end users — these are for the AI layer):
- `GET /internal/schema/workspace/{workspaceId}` — calls describeWorkspace
- `GET /internal/schema/table/{tableId}` — calls describeTable  
- `GET /internal/schema/links/{workspaceId}` — calls describeLinks

All routes require authentication and pass the authenticated userId. Standard error handling.

Add integration tests for the service facade verifying the full flow: cache miss → build → filter → cache hit on repeat call.
```

---

### Prompt 8: Token Budget Estimator

```
Create a token budget estimator for schema descriptors.

File: `src/services/schema-descriptor/token-estimator.ts`

Large workspaces with many Base Connections/tables/fields could produce schema descriptors that consume too much of the LLM's context window. This module estimates token count and provides condensation strategies.

Export functions:

1. `estimateTokens(descriptor: WorkspaceDescriptor): number`
   - Rough estimate: serialize to JSON, divide character count by 4 (approximate tokens)
   - Good enough for budget decisions

2. `condenseDescriptor(descriptor: WorkspaceDescriptor, maxTokens: number): WorkspaceDescriptor`
   - If under budget: return as-is
   - Level 1 condensation (>2k tokens): Remove field options arrays (select field choices), remove lookup/rollup source details
   - Level 2 condensation (>4k tokens): Collapse tables with >20 fields to show only searchable + aggregatable + link fields. Add a `hidden_field_count` property.
   - Level 3 condensation (>8k tokens): Show only table names, record counts, and link graph. Add `condensed: true` flag so the AI knows to call `describeTable()` for details on specific tables.

This enables the AI to work with workspaces of any size: small workspaces get the full schema in one shot, large workspaces get a map that the AI can drill into as needed. This complements the Context Builder's **post-MVP** semantic retrieval token budget (see `vector-embeddings.md` > AI Context Retrieval) — the SDS provides a structural schema budget, embeddings provide a semantic relevance budget.

Add tests verifying each condensation level triggers at the right thresholds.
```

---

## Implementation Order

| Order | Prompt | Depends On | Deliverable |
|-------|--------|------------|-------------|
| 1     | Prompt 1 | Nothing | Types only — zero risk |
| 2     | Prompt 2 | Prompt 1, existing FieldTypeRegistry | Field mapping logic |
| 3     | Prompt 3 | Prompt 2 | Single table descriptor |
| 4     | Prompt 4 | Prompt 3 | Full workspace descriptor |
| 5     | Prompt 5 | Prompt 4, existing permissions | Security boundary |
| 6     | Prompt 6 | Prompt 4, Prompt 5 | Performance layer |
| 7     | Prompt 7 | All above | Service facade + API |
| 8     | Prompt 8 | Prompt 4 | LLM context optimization |

Prompts 1–5 are the core path. Prompt 6 (caching) and Prompt 8 (token budget) can be deferred if needed — the service works without them, just slower and potentially context-heavy for large workspaces. Prompt 7 is the integration point.

---

## What This Unlocks (Next Modules)

Once the SDS is in place, these become buildable:

1. **(Post-MVP)** **DuckDB Query Sandbox** — Receives query plans from the AI, hydrates from Postgres, executes analytical SQL. Uses SDS for schema-aware type coercion when loading JSONB into DuckDB columns.

2. **(Post-MVP)** **AI Query Planner** — Takes natural language + SDS output, generates a query plan (which tables to pull, what JOINs to perform, what SQL to run in DuckDB). This is the module that calls `describeWorkspace()` as its first step.

3. **(Post-MVP)** **Smart Docs Live Queries** — Embeds SDS-aware queries in documents that resolve at render time.

4. **MCP Server for EveryStack** (Post-MVP — Automations) — Exposes SDS as an MCP tool so external AI agents (Claude Code, Cursor, etc.) can discover and query EveryStack workspaces. See `ai-architecture.md` > MCP (Model Context Protocol) for the MCP server architecture.

---

## Notes

- The SDS is entirely read-only and introduces zero risk to existing write paths
- All prompts are designed to be self-contained with clear inputs/outputs for Claude Code
- Test coverage is specified in each prompt — don't skip it, the AI layer depends on schema accuracy
- The permission filter (Prompt 5) is the security-critical piece — review that output carefully
