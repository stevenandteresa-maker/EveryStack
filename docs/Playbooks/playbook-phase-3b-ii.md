# Phase 3B-ii — Schema Descriptor Service & Command Bar

## Phase Context

Covers What Has Been Built, What This Phase Delivers, What This Phase Does NOT Build, Architecture Patterns for This Phase, Mandatory Context for All Prompts, Subdivision Summary.
Touches `cross_links`, `cross_link_index`, `schema_version_hash` tables.

### What Has Been Built

| Phase | Key Deliverables |
|-------|-----------------|
| 1A–1J | Monorepo, DB schema (Drizzle), Clerk auth, observability (Pino), testing infra (factories, `testTenantIsolation()`), design system (shadcn/ui, Tailwind tokens), real-time (Socket.io + Redis), AIService (providers, metering, tools, skills), audit log, API auth |
| 2A | FieldTypeRegistry (`packages/shared/sync/field-registry.ts`), canonical transform layer, Airtable adapter |
| 2B | JSONB expression indexes, tsvector search indexes, outbound sync, conflict resolution |
| 2C | Notion adapter, error recovery, sync dashboard |
| 3A-i | Grid View: TanStack Table + Virtual, 16 cell renderers, inline editing, keyboard nav |
| 3A-ii | View features (filter/sort/group/summary), Record View overlay, Card View, Sections, CSV import, My Views/Shared Views |
| 3A-iii | Field-level permissions: 3-state model, 7-step resolution cascade (`packages/shared/auth/permissions/`), data layer with Redis cache, permission-aware Grid/RecordView/CardView, Permission Config Panel |
| 3B-i | Cross-linking engine: `cross_links`/`cross_link_index` data layer, query-time resolution (L0–L2), Link Picker, display value maintenance, creation constraints, impact analysis, LinkedRecordTree |

### What This Phase Delivers

Two complementary systems:
1. **Schema Descriptor Service (SDS)** — A read-only, LLM-optimized schema API that exposes workspace metadata (tables, fields, cross-links) in condensed JSON, filtered per-user permissions, with 2-tier caching. Foundation for all Phase 4+ AI features.
2. **Command Bar** — A unified `Cmd+K` interface with fuzzy record search, table/view navigation, slash commands, and AI natural language search powered by SDS.

### What This Phase Does NOT Build

- DuckDB analytical query layer (post-MVP)
- Vector embeddings / semantic search (post-MVP)
- AI agents consuming SDS (post-MVP)
- Smart Docs live data in SDS (post-MVP)
- Workspace Map consuming SDS (post-MVP)
- Guide Mode full implementation (post-MVP — channel routing stub only)
- AI prompt template learning ("save as template after 3 similar requests") (post-MVP)
- Custom workspace slash commands (post-MVP — system commands only for MVP)
- Full-text search infrastructure (tsvector indexes already exist from 2B)
- Kanban, List, Gantt views (post-MVP)
- Formula engine (post-MVP)

### Architecture Patterns for This Phase

**SDS is read-only.** It reads metadata only — no record data, no mutations, no sync adapter involvement. Pure consumer of existing FieldTypeRegistry types, Drizzle schema, and cross-link graph.

**Permission-filtered schema.** SDS produces per-user filtered schema descriptors. AI never discovers data the user can't access. Uses the existing 7-step permission resolution from 3A-iii.

**2-tier caching.** Tier 1: unfiltered workspace schema in Redis (keyed by `schema_version_hash`). Tier 2: per-user permission-filtered variants. Event-driven invalidation on schema mutations + permission changes.

**Token budget management.** Large workspaces get progressively condensed descriptors: full → remove options → collapse fields → table names + link graph only.

**Command Bar search channels.** Four channels through one interface: (1) fuzzy record search via tsvector, (2) table/view navigation, (3) slash commands, (4) AI natural language search via SDS + AIService. Intent routing is automatic — user never thinks about modes.

**AIService integration.** Command Bar AI uses `fast` capability tier for intent classification. Never references providers or models directly.

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult when naming new things.
`MANIFEST.md` is not needed during build execution.

### Subdivision Summary

This sub-phase is decomposed into 4 units per the subdivision doc (`docs/subdivisions/3b-ii-subdivision.md`):

| Unit | Name | Produces | Depends On |
|------|------|----------|------------|
| 1 | SDS Types & Core Builders | `WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types; `mapFieldToDescriptor()`, `buildTableDescriptor()`, `buildWorkspaceDescriptor()` functions | None |
| 2 | SDS Permission Filter, Caching & Service Facade | `filterDescriptorByPermissions()`, `computeSchemaVersionHash()`, `SchemaDescriptorCache`, `estimateTokens()`, `condenseDescriptor()`, `SchemaDescriptorService` class | Unit 1 |
| 3 | Command Bar Search & Navigation Data Layer | `SearchResult`, `NavigationResult`, `CommandEntry`, `RecentItem` types; `searchRecords()`, `searchTablesAndViews()`, `getCommandRegistry()`, `trackRecentItem()`, `getRecentItems()` | None (parallel with Units 1–2) |
| 4 | Command Bar UI & AI Search Channel | `CommandBar`, `CommandBarProvider`, `useCommandBar()`, search results, slash menu, AI channel, recent items components; `executeSlashCommand()`, `aiSearchQuery()` server actions | Units 2 + 3 |

### Skills for This Phase

Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — backend patterns (data access, server actions, Redis)
- `docs/skills/ux-ui/SKILL.md` — UI component conventions (for Unit 4)
- `docs/skills/phase-context/SKILL.md` — Always.

---

## Section Index

| Prompt | Unit | Deliverable | Summary | Depends On | Lines (est.) |
|--------|------|-------------|---------|------------|--------------|
| 1 | 1 | SDS descriptor types & LinkEdge | WorkspaceDescriptor, BaseDescriptor, TableDescriptor, FieldDescriptor, LinkEdge types with LLM optimization | None | ~120 |
| 2 | 1 | Field-to-descriptor mapper | mapFieldToDescriptor() mapping all MVP field types with searchable/aggregatable flags | 1 | ~200 |
| 3 | 1 | Table descriptor builder | buildTableDescriptor() using pg_stat approximate row count, field assembly | 2 | ~180 |
| 4 | 1 | Workspace descriptor builder with link graph | buildWorkspaceDescriptor() with batched queries per base, deduplicated link_graph edges | 3 | ~220 |
| VP-1 | — | VERIFY — Completes Unit 1 | Contract verification for descriptor types and builder functions | 1–4 | — |
| 5 | 2 | Permission filter for descriptors | filterDescriptorByPermissions() using 3A-iii 7-step resolution to strip hidden fields/tables | Unit 1 complete | ~200 |
| 6 | 2 | Schema version hash & 2-tier cache | computeSchemaVersionHash(), SchemaDescriptorCache with Redis tier 1 + per-user tier 2 | 5 | ~220 |
| 7 | 2 | Token estimator & progressive condensation | estimateTokens(), condenseDescriptor() with 4-level progressive detail reduction | Unit 1 complete | ~160 |
| 8 | 2 | SchemaDescriptorService facade | Single entry-point class composing builders, permission filter, cache, and condensation | 5, 6, 7 | ~200 |
| VP-2 | — | VERIFY — Completes Unit 2 | Permission filtering, caching, and condensation verification | 5–8 | — |
| 9 | 3 | Command Bar types & record search data layer | SearchResult, NavigationResult types; searchRecords() via tsvector | None | ~220 |
| 10 | 3 | Table/view navigation & command registry data layer | searchTablesAndViews(), getCommandRegistry() with system slash commands | 9 | ~200 |
| 11 | 3 | Recent items tracking | trackRecentItem(), getRecentItems() with Redis sorted set per user | 9 | ~140 |
| VP-3 | — | VERIFY — Completes Unit 3 | Search, navigation, and recent items data layer verification | 9–11 | — |
| 12 | 4 | CommandBar shell, provider & keyboard shortcuts | CommandBar component, CommandBarProvider context, Cmd+K registration | Units 2 + 3 complete | ~250 |
| 13 | 4 | Search results, navigation & slash command channels | Fuzzy record results, table/view nav, slash command menu rendering | 12 | ~250 |
| 14 | 4 | AI search channel & server actions | AI natural language search via SDS + AIService fast tier, aiSearchQuery() action | 12, 13 | ~250 |
| 15 | 4 | Recent items display, scoped mode & analytics | Recent items panel, table-scoped search mode, search analytics tracking | 12, 13 | ~180 |
| VP-4 | — | VERIFY — Completes Unit 4 | 12–15 | — |

---

## — Unit 1: SDS Types & Core Builders —

### Unit Context

Defines the TypeScript type system for LLM-optimized schema descriptors and implements the pure data assembly functions that translate existing DB metadata (tables, fields, cross-links) into `WorkspaceDescriptor` JSON. This unit produces no side effects — it reads existing metadata and assembles descriptor objects. All downstream SDS work (permissions, caching, API) builds on these types and builders.

**Interface Contract:**
Produces: `WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types; `mapFieldToDescriptor()`, `buildTableDescriptor()`, `buildWorkspaceDescriptor()` functions
Consumes: Existing FieldTypeRegistry types, Drizzle schema types, cross-link types from 3B-i

---

## Prompt 1: SDS Descriptor Types & LinkEdge

**Unit:** 1
**Depends on:** None
**Load context:** `schema-descriptor-service.md` lines 79–193 (Output Schema — full WorkspaceDescriptor JSON structure, field descriptions, design decisions)
**Target files:** `packages/shared/ai/schema-descriptor/types.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS descriptor types — WorkspaceDescriptor, TableDescriptor, FieldDescriptor, LinkEdge [Phase 3B-ii, Prompt 1]`

### Schema Snapshot

N/A — no schema changes. Types reference existing DB entities:
```
tables: id (UUIDv7 PK), tenant_id, workspace_id, name, table_type
fields: id (UUIDv7 PK), tenant_id, table_id, name, field_type (VARCHAR), config (JSONB), is_primary, sort_order
base_connections: id (UUIDv7 PK), tenant_id, platform, external_base_id, external_base_name
cross_links: id, tenant_id, source_table_id, source_field_id, target_table_id, target_display_field_id, relationship_type, card_fields (JSONB)
```

### Task

Create `packages/shared/ai/schema-descriptor/types.ts` with these TypeScript interfaces, all exported with JSDoc explaining LLM optimization choices:

1. **`FieldDescriptor`** — `field_id`, `name`, `type` (string matching FieldTypeRegistry types). Type-specific optional metadata:
   - `options?: string[]` — for `single_select` / `multi_select` fields (valid enum values for AI query generation)
   - `currency_code?: string` — for `currency` fields
   - `linked_base?: string`, `linked_table?: string`, `cardinality?: 'many_to_one' | 'one_to_many' | 'restricted'`, `symmetric_field?: string` — for `linked_record` fields (Cross-Links)
   - `searchable: boolean` — indicates fields suitable for WHERE/full-text search
   - `aggregatable: boolean` — indicates SUM/AVG/MIN/MAX meaningful
   - `hidden_field_count?: number` — used in condensed mode (Level 2) to indicate omitted fields

2. **`TableDescriptor`** — `table_id`, `name`, `record_count_approx` (number, from `pg_stat_user_tables.n_live_tup`), `fields: FieldDescriptor[]`, optional `condensed?: boolean` flag

3. **`BaseDescriptor`** — `base_id`, `name`, `platform` (string), `tables: TableDescriptor[]`

4. **`WorkspaceDescriptor`** — `workspace_id`, `bases: BaseDescriptor[]`, `link_graph: LinkEdge[]`, optional `condensed?: boolean` flag

5. **`LinkEdge`** — `from` (dotted path: `base_id.table_id.field_id`), `to` (dotted path), `cardinality: 'many_to_one' | 'one_to_many'`, `label` (human-readable: "Deals → Primary Contact")

Also export a barrel `packages/shared/ai/schema-descriptor/index.ts` that re-exports all types from this file.

### Acceptance Criteria

- [ ] `WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] JSDoc on each type explains LLM optimization purpose (e.g., why `record_count_approx` exists, why `cardinality` matters)
- [ ] `FieldDescriptor` includes `searchable` and `aggregatable` boolean flags
- [ ] `FieldDescriptor` includes all type-specific metadata: `options`, `currency_code`, `linked_base`/`linked_table`/`cardinality`/`symmetric_field`
- [ ] `cardinality` on `FieldDescriptor` includes `'restricted'` option (for permission-filtered cross-links)
- [ ] `condensed` flag on `TableDescriptor` and `WorkspaceDescriptor` for progressive detail levels
- [ ] Barrel `index.ts` re-exports all types
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- DuckDB-related types (post-MVP)
- Vector embedding types (post-MVP)
- Agent scope types for SDS (post-MVP — already in `ai/types.ts`)
- Any implementation logic — types only in this prompt

---

## Prompt 2: Field-to-Descriptor Mapper

**Unit:** 1
**Depends on:** Prompt 1
**Load context:** `schema-descriptor-service.md` lines 79–193 (Output Schema), `data-model.md` lines 74–84 (Data Layer — fields schema)
**Target files:** `packages/shared/ai/schema-descriptor/field-mapper.ts`, `packages/shared/ai/schema-descriptor/__tests__/field-mapper.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS field-to-descriptor mapper — mapFieldToDescriptor() for all MVP field types [Phase 3B-ii, Prompt 2]`

### Schema Snapshot

```
fields: id, table_id, tenant_id, name, field_type (VARCHAR), config (JSONB), is_primary, sort_order
cross_links: id, source_field_id, target_table_id, target_display_field_id, relationship_type, reverse_field_id, card_fields (JSONB)
```

### Task

Create `packages/shared/ai/schema-descriptor/field-mapper.ts` exporting:

```typescript
mapFieldToDescriptor(
  field: FieldRecord,
  crossLinkDef?: CrossLinkDefinition
): FieldDescriptor
```

Where `FieldRecord` is the Drizzle select type for the `fields` table and `CrossLinkDefinition` is the Drizzle select type for the `cross_links` table.

Mapping logic:
1. Map `field.field_type` to descriptor `type` (passthrough — FieldTypeRegistry types are already the descriptor types)
2. Set `searchable: true` for: `text`, `email`, `url`, `phone`, `rich_text` (fields suitable for WHERE clause or full-text search)
3. Set `aggregatable: true` for: `number`, `currency`, `percent`, `duration`, `rating` (fields where SUM/AVG/MIN/MAX are meaningful)
4. For `single_select` / `multi_select`: extract `options` array from `field.config` JSONB
5. For `currency`: extract `currency_code` from `field.config`
6. For `linked_record` (when `crossLinkDef` is provided): set `linked_base` (look up from target table's base connection), `linked_table` (target_table_id), `cardinality` (from relationship_type), `symmetric_field` (reverse_field_id)
7. Handle all other MVP field types with default `searchable: false`, `aggregatable: false`

Import types from `types.ts` (Prompt 1). Import Drizzle select types from existing schema files. Do NOT use switch statements on field types — use the FieldTypeRegistry pattern (map object or if/else with registry lookup). However, since this is a mapping function that produces descriptors (not a field behavior function), a `Record<string, ...>` map approach is acceptable.

**Tests** in `__tests__/field-mapper.test.ts`:
- Each MVP field type branch produces correct `searchable`/`aggregatable` flags
- Select fields include `options` from config
- Currency field includes `currency_code`
- Linked record field with cross-link def produces full linked metadata
- Linked record field WITHOUT cross-link def still produces valid descriptor (with undefined linked metadata)
- Unknown field type defaults to non-searchable, non-aggregatable

### Acceptance Criteria

- [ ] `mapFieldToDescriptor()` exported from `packages/shared/ai/schema-descriptor/field-mapper.ts`
- [ ] Correctly maps all MVP field types from FieldTypeRegistry with appropriate `searchable`/`aggregatable` flags
- [ ] Select fields extract `options` from `field.config` JSONB
- [ ] Currency fields extract `currency_code` from `field.config`
- [ ] Linked record fields populate `linked_table`, `cardinality`, `symmetric_field` from cross-link definition
- [ ] No switch statements on field types
- [ ] Unit tests cover each field type branch
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Lookup field mapping (post-MVP — requires formula engine)
- Rollup field mapping (post-MVP)
- Post-MVP field types not in FieldTypeRegistry

---

## Prompt 3: Table Descriptor Builder

**Unit:** 1
**Depends on:** Prompt 2
**Load context:** `schema-descriptor-service.md` lines 79–193 (Output Schema — record_count_approx design decision), `data-model.md` lines 74–84 (tables, fields schema)
**Target files:** `packages/shared/ai/schema-descriptor/table-builder.ts`, `packages/shared/ai/schema-descriptor/__tests__/table-builder.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS table descriptor builder — buildTableDescriptor() with pg_stat row counts [Phase 3B-ii, Prompt 3]`

### Schema Snapshot

```
tables: id, workspace_id, tenant_id, name, table_type
fields: id, table_id, tenant_id, name, field_type, config (JSONB), sort_order
cross_links: id, tenant_id, source_table_id, source_field_id, target_table_id, relationship_type, reverse_field_id
```

### Task

Create `packages/shared/ai/schema-descriptor/table-builder.ts` exporting:

```typescript
buildTableDescriptor(
  tableId: string,
  tenantId: string,
  db: TenantDb
): Promise<TableDescriptor>
```

Where `TenantDb` is the return type from `getDbForTenant()`.

Implementation:
1. Query table metadata (name, id) from `tables` table, scoped by `tenantId`
2. Get approximate row count using `pg_stat_user_tables.n_live_tup` — use `db.execute(sql\`SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = ${tableName}\`)`. This is instant — no table scan. Fall back to 0 if the stat row doesn't exist.
3. Retrieve all field definitions for the table from `fields`, ordered by `sort_order`
4. For each field where `field_type === 'linked_record'`, query the matching `cross_links` row (where `source_field_id = field.id`)
5. Map each field through `mapFieldToDescriptor()` from Prompt 2
6. Return assembled `TableDescriptor`

This function does NOT filter by permissions — that happens in Unit 2.

**Tests** in `__tests__/table-builder.test.ts`:
- Integration tests using test factories (`createTestTable()`, `createTestField()`)
- Correctly assembles table with multiple field types
- Uses `pg_stat_user_tables` for row count (not COUNT(*))
- Linked record fields include cross-link metadata
- Tenant isolation: tenant A's table not accessible to tenant B query

### Acceptance Criteria

- [ ] `buildTableDescriptor()` exported from `packages/shared/ai/schema-descriptor/table-builder.ts`
- [ ] Uses `pg_stat_user_tables.n_live_tup` for approximate record count (no table scan)
- [ ] Queries fields ordered by `sort_order`, includes cross-link definitions for linked_record fields
- [ ] All queries are tenant-scoped via `getDbForTenant()` pattern
- [ ] Integration tests with factories cover: multi-field table, linked record with cross-link, row count estimation
- [ ] `testTenantIsolation()` test for table descriptor builder
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Permission filtering (Unit 2)
- Caching (Unit 2)
- Lookup/rollup field resolution (post-MVP)

---

## Prompt 4: Workspace Descriptor Builder with Link Graph

**Unit:** 1
**Depends on:** Prompt 3
**Load context:** `schema-descriptor-service.md` lines 79–193 (Output Schema — link_graph structure, deduplication), `data-model.md` lines 74–84 (base_connections, cross_links, cross_link_index)
**Target files:** `packages/shared/ai/schema-descriptor/workspace-builder.ts`, `packages/shared/ai/schema-descriptor/__tests__/workspace-builder.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS workspace descriptor builder with deduplicated link graph [Phase 3B-ii, Prompt 4]`

### Schema Snapshot

```
workspaces: id, tenant_id, name
base_connections: id, tenant_id, platform, external_base_id, external_base_name
tables: id, workspace_id, tenant_id, name
cross_links: id, tenant_id, source_table_id, source_field_id, target_table_id, target_display_field_id, relationship_type, reverse_field_id
fields: id, table_id, name, field_type
```

### Task

Create `packages/shared/ai/schema-descriptor/workspace-builder.ts` exporting:

```typescript
buildWorkspaceDescriptor(
  workspaceId: string,
  tenantId: string,
  db: TenantDb
): Promise<WorkspaceDescriptor>
```

Implementation:
1. Query all `base_connections` belonging to the workspace's tables (via `tables.workspace_id → base_connections`). Native EveryStack tables (no base_connection) appear under a synthetic "Native" base grouping with `base_id: 'native'`, `name: 'Native Tables'`, `platform: 'everystack'`.
2. **Batch queries per base connection** — for each base connection, query all tables at once, then all fields for those tables in a single query. Group in application code. Do NOT issue a query per field or per table.
3. Build `TableDescriptor`s using `buildTableDescriptor()` from Prompt 3 for each table.
4. Scan all `cross_links` definitions across the workspace. Build the `link_graph` array of `LinkEdge` objects:
   - Each link appears **once** (deduplicated — don't include both directions of a symmetric link). If `reverse_field_id` exists, only include the direction where `source_table_id < target_table_id` lexicographically (consistent deduplication).
   - Generate a human-readable `label` for each edge: `"{SourceTable} → {TargetTable} via {FieldName}"`
   - `from`/`to` use dotted path format: `{base_id}.{table_id}.{field_id}`
5. Return assembled `WorkspaceDescriptor`

**Tests** in `__tests__/workspace-builder.test.ts`:
- Integration test: workspace with 2 base connections, linked tables, verifies full descriptor structure
- Link graph deduplication: symmetric cross-link produces exactly 1 edge
- Link graph labels are human-readable
- Native tables appear under synthetic "Native" base grouping
- Batched queries verified (mock DB to assert query count)
- Tenant isolation test

### Acceptance Criteria

- [ ] `buildWorkspaceDescriptor()` exported from `packages/shared/ai/schema-descriptor/workspace-builder.ts`
- [ ] [CONTRACT] `buildWorkspaceDescriptor(workspaceId, tenantId, db)` returns `Promise<WorkspaceDescriptor>` with correct signature
- [ ] [CONTRACT] `buildTableDescriptor(tableId, tenantId, db)` returns `Promise<TableDescriptor>` with correct signature
- [ ] [CONTRACT] `mapFieldToDescriptor(field, crossLinkDef?)` returns `FieldDescriptor` with correct signature
- [ ] [CONTRACT] All types (`WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge`) exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] Batches queries per base connection (not per field), verified in tests
- [ ] `link_graph` has deduplicated edges with human-readable labels
- [ ] Native tables appear under synthetic "Native" base grouping
- [ ] All functions are tenant-scoped via `getDbForTenant()` pattern
- [ ] Integration tests cover multi-base + cross-link graph
- [ ] `testTenantIsolation()` for workspace descriptor
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Permission filtering (Unit 2)
- Caching (Unit 2)
- Token budget estimation (Unit 2)
- DuckDB integration (post-MVP)

---

## VERIFY Session Boundary (after Prompts 1–4) — Completes Unit 1

**Scope:** Verify all SDS type definitions and core builder functions integrate correctly.
**Unit status:** Unit 1 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: import `WorkspaceDescriptor` from barrel and confirm all types resolve

**Interface contract check (unit-completing):**
Verify these exports exist and match the subdivision doc's contract:
- [ ] [CONTRACT] `WorkspaceDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `BaseDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `TableDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `FieldDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `LinkEdge` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `mapFieldToDescriptor(field, crossLinkDef?)` exported from `field-mapper.ts`
- [ ] [CONTRACT] `buildTableDescriptor(tableId, tenantId, db)` exported from `table-builder.ts`
- [ ] [CONTRACT] `buildWorkspaceDescriptor(workspaceId, tenantId, db)` exported from `workspace-builder.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 1 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 1–4 [Phase 3B-ii, VP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## — Unit 2: SDS Permission Filter, Caching & Service Facade —

### Unit Context

Applies the security boundary (permission-filtered schema output), adds the performance layer (2-tier Redis + in-memory caching with event-driven invalidation), provides token budget management for large workspaces, and assembles the `SchemaDescriptorService` class that ties the SDS together as a single entry point. This is the security-critical unit — the permission filter ensures AI never discovers data the user can't access.

**Interface Contract:**
Produces: `filterDescriptorByPermissions()`, `computeSchemaVersionHash()`, `SchemaDescriptorCache` class, `estimateTokens()`, `condenseDescriptor()`, `SchemaDescriptorService` class
Consumes: All Unit 1 types and builders; existing `resolveAllFieldPermissions()`, `getFieldPermissions()`, Redis utilities

---

## Prompt 5: Permission Filter for Descriptors

**Unit:** 2
**Depends on:** Unit 1 complete (produces `WorkspaceDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types)
**Load context:** `schema-descriptor-service.md` lines 194–208 (Permissions Integration), `permissions.md` lines 90–179 (Table View–Based Access, Field-Level Permissions, Two-Layer Restriction Model), `permissions.md` lines 278–349 (Permission Resolution at Runtime)
**Target files:** `packages/shared/ai/schema-descriptor/permission-filter.ts`, `packages/shared/ai/schema-descriptor/__tests__/permission-filter.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS permission filter — filterDescriptorByPermissions() with deep-copy safety [Phase 3B-ii, Prompt 5]`

### Schema Snapshot

N/A — no schema changes. Reads permission data from existing structures:
```
views.permissions (JSONB — ViewPermissions: roles, specificUsers, fieldPermissions)
fields.permissions (JSONB — Layer 1 global defaults)
```

### Task

Create `packages/shared/ai/schema-descriptor/permission-filter.ts` exporting:

```typescript
filterDescriptorByPermissions(
  descriptor: WorkspaceDescriptor,
  userId: string,
  tenantId: string,
  db: TenantDb
): Promise<WorkspaceDescriptor>
```

Implementation:
1. **Deep-copy the input** — never mutate the cached unfiltered descriptor. Use `structuredClone()` or equivalent.
2. Resolve the user's workspace role and Table View permissions using existing `resolveAllFieldPermissions()` from `packages/shared/auth/permissions/resolve.ts` and `getFieldPermissions()` from `apps/web/src/data/permissions.ts`.
3. For each base in the descriptor:
   - Remove tables the user has no access to (no Table View assignment, no workspace role granting access)
   - Within accessible tables, remove fields where the user's permission state is `hidden`
   - Mark fields with `read_only` permission state (add to descriptor but don't change the type — this info is for the AI's awareness)
4. Remove entire bases that have zero remaining tables after filtering.
5. **Prune the link_graph:** Remove any `LinkEdge` where either the `from` or `to` field has been removed.
6. **Cross-link edge case:** When a `linked_record` field is visible but the target table is NOT accessible to the user:
   - Keep the field in the descriptor
   - Set `linked_table: null` and `cardinality: 'restricted'`
   - This tells the AI "a link exists but the target is not accessible" — prevents confusing query plans
7. Return the filtered descriptor.

**Tests** in `__tests__/permission-filter.test.ts`:
- User with Owner/Admin role sees everything (no filtering)
- Team Member with partial Table View access sees filtered set
- Hidden fields removed from descriptor
- Link graph pruning when one side is restricted
- Cross-link edge case: visible linked_record field but restricted target → `linked_table: null`, `cardinality: 'restricted'`
- Deep-copy verification: original descriptor not mutated
- Tenant isolation: filtering scoped to correct tenant

### Acceptance Criteria

- [ ] `filterDescriptorByPermissions()` exported from `packages/shared/ai/schema-descriptor/permission-filter.ts`
- [ ] Deep-copies input (never mutates cached descriptor)
- [ ] Removes inaccessible bases, tables, and hidden fields
- [ ] Prunes link_graph to edges where both sides are accessible
- [ ] When linked_record field is visible but target table is not: `linked_table: null`, `cardinality: 'restricted'`
- [ ] Uses existing permission resolution from `packages/shared/auth/permissions/`
- [ ] Security tests: hidden fields never appear in filtered descriptor
- [ ] Tenant isolation test
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Write-path permission checks (SDS is read-only)
- Portal client permission filtering (post-MVP portal scope)
- App Designer block-level permissions (post-MVP)

---

## Prompt 6: Schema Version Hash & 2-Tier Cache

**Unit:** 2
**Depends on:** Prompt 5
**Load context:** `schema-descriptor-service.md` lines 224–237 (Caching Strategy), `permissions.md` lines 343–350 (Permission Caching Strategy — existing Redis pattern reference)
**Target files:** `packages/shared/ai/schema-descriptor/schema-hash.ts`, `packages/shared/ai/schema-descriptor/cache.ts`, `packages/shared/ai/schema-descriptor/__tests__/cache.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS 2-tier cache with schema version hash and event-driven invalidation [Phase 3B-ii, Prompt 6]`

### Schema Snapshot

N/A — no schema changes. Cache keys in Redis:
```
cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}          — Tier 1 (unfiltered)
cache:t:{tenantId}:sds:{workspaceId}:{userId}:{schemaHash} — Tier 2 (per-user)
```

### Task

**File 1:** `packages/shared/ai/schema-descriptor/schema-hash.ts`

```typescript
computeSchemaVersionHash(
  workspaceId: string,
  tenantId: string,
  db: TenantDb
): Promise<string>
```

Produces a stable SHA-256 hash from table definitions, field definitions, and cross-link definitions for the workspace. Same schema → same hash. Hash inputs: sorted table IDs + field metadata (id, type, config) + cross-link metadata (id, source, target, relationship_type). Use Node's `crypto.createHash('sha256')`.

**File 2:** `packages/shared/ai/schema-descriptor/cache.ts`

```typescript
class SchemaDescriptorCache {
  getWorkspaceDescriptor(workspaceId: string, userId: string, tenantId: string): Promise<WorkspaceDescriptor | null>
  invalidateWorkspace(workspaceId: string, tenantId: string): Promise<void>
  invalidateUser(workspaceId: string, userId: string, tenantId: string): Promise<void>
}
```

Implementation:
1. **Tier 1 (unfiltered workspace schema):**
   - Key: `cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}`
   - TTL: 300s (5 minutes — backstop; primary invalidation is event-driven)
   - `getWorkspaceDescriptor()` first computes `schemaHash`, then checks Tier 1. On miss → calls `buildWorkspaceDescriptor()` → stores Tier 1.
2. **Tier 2 (per-user filtered):**
   - Key: `cache:t:{tenantId}:sds:{workspaceId}:{userId}:{schemaHash}`
   - Schema hash in key means auto-invalidates when workspace schema changes
   - Also invalidated on permission_updated events for this user
   - TTL: 300s
   - On Tier 2 miss → calls `filterDescriptorByPermissions()` on Tier 1 result → stores Tier 2.
3. **Invalidation:**
   - `invalidateWorkspace()` — deletes all keys matching `cache:t:{tenantId}:sds:{workspaceId}:*` pattern
   - `invalidateUser()` — deletes keys matching `cache:t:{tenantId}:sds:{workspaceId}:{userId}:*`
   - Subscribe to schema mutation events: `field_created`, `field_updated`, `field_deleted`, `table_created`, `table_deleted`, `link_created`, `link_deleted` → calls `invalidateWorkspace()`
   - Subscribe to `permission_updated` events → calls `invalidateUser()`

Use existing Redis utilities. Follow the Redis key namespace convention from CLAUDE.md.

**Tests** in `__tests__/cache.test.ts`:
- Schema hash is stable (same inputs → same hash)
- Schema hash changes when field/table/link metadata changes
- Cache hit returns stored descriptor
- Cache miss triggers build + filter + store
- `invalidateWorkspace()` clears all tiers
- `invalidateUser()` clears only that user's Tier 2
- TTL is set to 300s

### Acceptance Criteria

- [ ] `computeSchemaVersionHash()` exported, produces stable SHA-256 hash
- [ ] `SchemaDescriptorCache` exported with `getWorkspaceDescriptor()`, `invalidateWorkspace()`, `invalidateUser()` methods
- [ ] 2-tier caching with 300s TTL
- [ ] Event-driven invalidation for schema mutations and permission changes
- [ ] Redis key format: `cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}` (Tier 1), `cache:t:{tenantId}:sds:{workspaceId}:{userId}:{schemaHash}` (Tier 2)
- [ ] Tests verify cache hit/miss/invalidation behavior
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- In-memory LRU cache per process (keep it simple with Redis only for MVP — add in-memory tier post-MVP if needed)
- DuckDB cache layer (post-MVP)

---

## Prompt 7: Token Estimator & Progressive Condensation

**Unit:** 2
**Depends on:** Unit 1 complete (produces `WorkspaceDescriptor` type)
**Load context:** `schema-descriptor-service.md` lines 79–193 (Output Schema — condensation levels referenced in design decisions)
**Target files:** `packages/shared/ai/schema-descriptor/token-estimator.ts`, `packages/shared/ai/schema-descriptor/__tests__/token-estimator.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SDS token estimator with 3-level progressive condensation [Phase 3B-ii, Prompt 7]`

### Schema Snapshot

N/A — pure function operating on `WorkspaceDescriptor` objects.

### Task

Create `packages/shared/ai/schema-descriptor/token-estimator.ts` exporting:

```typescript
estimateTokens(descriptor: WorkspaceDescriptor): number
condenseDescriptor(descriptor: WorkspaceDescriptor, maxTokens: number): WorkspaceDescriptor
```

**`estimateTokens()`:** Serialize descriptor to JSON, divide character count by 4 (approximate tokens). Simple and good enough for budget decisions.

**`condenseDescriptor()`:** Returns a new WorkspaceDescriptor (deep-copy, never mutate input). If under `maxTokens`: return as-is. Otherwise apply progressive condensation:

- **Level 1 (>2k tokens):** Remove field `options` arrays (select field choices). This reduces token count for workspaces with many select fields with long option lists.
- **Level 2 (>4k tokens):** For tables with >20 fields, collapse to show only `searchable`, `aggregatable`, and `linked_record` fields. Add a `hidden_field_count` property on each collapsed table. This ensures the AI knows important fields while acknowledging omissions.
- **Level 3 (>8k tokens):** Show only table names, record counts, and link graph. Remove all field details. Set `condensed: true` flag on workspace and each table. This tells the AI to call `describeTable()` for details on specific tables.

Each level tries to bring the token count under `maxTokens`. If a level succeeds, stop and return.

**Tests** in `__tests__/token-estimator.test.ts`:
- `estimateTokens()` returns reasonable estimate (test with known JSON size)
- Under-budget descriptor returned unchanged
- Level 1 removes options arrays
- Level 2 collapses large tables, adds `hidden_field_count`
- Level 3 shows only table names + counts + link graph, sets `condensed: true`
- Each level applied incrementally (Level 2 includes Level 1 changes)
- Never mutates input descriptor

### Acceptance Criteria

- [ ] `estimateTokens()` exported, estimates via JSON length / 4
- [ ] `condenseDescriptor()` exported, applies 3-level progressive condensation
- [ ] Level 1 (>2k tokens): removes field options
- [ ] Level 2 (>4k tokens): collapses large tables to searchable+aggregatable+link fields with `hidden_field_count`
- [ ] Level 3 (>8k tokens): table names, record counts, link graph only with `condensed: true` flag
- [ ] Deep-copy — never mutates input
- [ ] Tests verify each condensation level triggers at correct thresholds
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Token estimation using actual tokenizer (approximation is sufficient)
- Context Builder semantic relevance ranking (post-MVP — vector embeddings)
- DuckDB-aware condensation (post-MVP)

---

## Prompt 8: SchemaDescriptorService Facade

**Unit:** 2
**Depends on:** Prompts 5, 6, 7
**Load context:** `schema-descriptor-service.md` lines 209–223 (API Surface — three endpoints)
**Target files:** `packages/shared/ai/schema-descriptor/service.ts`, `packages/shared/ai/schema-descriptor/__tests__/service.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(ai): SchemaDescriptorService facade — describeWorkspace, describeTable, describeLinks [Phase 3B-ii, Prompt 8]`

### Schema Snapshot

N/A — facade over existing builders, cache, and filters.

### Task

Create `packages/shared/ai/schema-descriptor/service.ts` exporting:

```typescript
class SchemaDescriptorService {
  constructor(cache: SchemaDescriptorCache, db: TenantDb)

  describeWorkspace(workspaceId: string, userId: string, tenantId: string): Promise<WorkspaceDescriptor>
  describeTable(tableId: string, userId: string, tenantId: string): Promise<TableDescriptor | null>
  describeLinks(workspaceId: string, userId: string, tenantId: string): Promise<LinkEdge[]>
}
```

Implementation:

1. **`describeWorkspace()`:**
   - Check cache via `SchemaDescriptorCache.getWorkspaceDescriptor()`
   - On cache hit: return cached descriptor
   - On cache miss: call `buildWorkspaceDescriptor()` → `filterDescriptorByPermissions()` → store in cache → return

2. **`describeTable()`:**
   - Build single table descriptor via `buildTableDescriptor()`
   - Apply permission filtering for this user on this table
   - Return `null` if user has no access to the table
   - No separate cache for single-table — reuse workspace descriptor cache where possible

3. **`describeLinks()`:**
   - Extract from workspace descriptor (leverage cache)
   - Returns only the permission-filtered `link_graph` array
   - Lightweight — useful when AI only needs link topology

Update the barrel `packages/shared/ai/schema-descriptor/index.ts` to re-export `SchemaDescriptorService` and all other new exports from this unit.

**Tests** in `__tests__/service.test.ts`:
- `describeWorkspace()`: cache miss → build → filter → cache hit on repeat
- `describeWorkspace()`: cache hit returns stored result
- `describeTable()`: returns null for inaccessible table
- `describeTable()`: returns filtered table descriptor for accessible table
- `describeLinks()`: returns filtered link graph only
- Tenant isolation: service scoped to tenant

### Acceptance Criteria

- [ ] [CONTRACT] `SchemaDescriptorService` class exported from `packages/shared/ai/schema-descriptor/service.ts`
- [ ] [CONTRACT] `describeWorkspace(workspaceId, userId, tenantId)` returns `Promise<WorkspaceDescriptor>`
- [ ] [CONTRACT] `describeTable(tableId, userId, tenantId)` returns `Promise<TableDescriptor | null>`
- [ ] [CONTRACT] `describeLinks(workspaceId, userId, tenantId)` returns `Promise<LinkEdge[]>`
- [ ] [CONTRACT] `filterDescriptorByPermissions()` exported from `permission-filter.ts`
- [ ] [CONTRACT] `computeSchemaVersionHash()` exported from `schema-hash.ts`
- [ ] [CONTRACT] `SchemaDescriptorCache` class exported from `cache.ts`
- [ ] [CONTRACT] `estimateTokens()` and `condenseDescriptor()` exported from `token-estimator.ts`
- [ ] Uses cache, falls back to build→filter on miss
- [ ] `describeTable()` returns null for inaccessible table
- [ ] Tenant isolation tests
- [ ] Barrel index.ts re-exports all unit exports
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Internal HTTP API routes (not needed — SDS is consumed as a library within the app, not via HTTP)
- DuckDB integration (post-MVP)
- MCP server endpoints (post-MVP)

---

## VERIFY Session Boundary (after Prompts 5–8) — Completes Unit 2

**Scope:** Verify all SDS permission filtering, caching, token management, and the service facade work together.
**Unit status:** Unit 2 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: `SchemaDescriptorService.describeWorkspace()` returns a permission-filtered `WorkspaceDescriptor` for a test user

**Interface contract check (unit-completing):**
Verify these exports exist and match the subdivision doc's contract:
- [ ] [CONTRACT] `filterDescriptorByPermissions(descriptor, userId, tenantId, db)` exported from `permission-filter.ts`
- [ ] [CONTRACT] `computeSchemaVersionHash(workspaceId, tenantId, db)` exported from `schema-hash.ts`
- [ ] [CONTRACT] `SchemaDescriptorCache` class exported from `cache.ts` with `getWorkspaceDescriptor()`, `invalidateWorkspace()`, `invalidateUser()` methods
- [ ] [CONTRACT] `estimateTokens(descriptor)` exported from `token-estimator.ts`
- [ ] [CONTRACT] `condenseDescriptor(descriptor, maxTokens)` exported from `token-estimator.ts`
- [ ] [CONTRACT] `SchemaDescriptorService` class exported from `service.ts` with `describeWorkspace()`, `describeTable()`, `describeLinks()` methods

**Security verification:**
- [ ] Hidden fields do not appear in any filtered descriptor output
- [ ] Restricted cross-links handled correctly (`linked_table: null`, `cardinality: 'restricted'`)
- [ ] Tenant A's schema never leaks to Tenant B via SDS

**State file updates:**
- Update TASK-STATUS.md: Unit 2 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 5–8 [Phase 3B-ii, VP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 9.

---

## — Unit 3: Command Bar Search & Navigation Data Layer —

### Unit Context

Server-side data access for the Command Bar's non-AI search channels: fuzzy record search across all accessible tables via tsvector (Channel 1), table/view navigation (Channel 2), command registry for slash commands (Channel 3), and recent items tracking. This unit runs in parallel with Units 1–2 because it consumes only existing DB schema and data access patterns — it does not depend on SDS.

**Interface Contract:**
Produces: `SearchResult`, `NavigationResult`, `CommandEntry`, `RecentItem`, `CommandBarSearchParams` types; `searchRecords()`, `searchTablesAndViews()`, `getCommandRegistry()`, `trackRecentItem()`, `getRecentItems()` functions; `createTestCommandRegistryEntry()` factory
Consumes: Existing Drizzle schema, tsvector indexes from 2B, permission utilities from 3A-iii

---

## Prompt 9: Command Bar Types & Record Search Data Layer

**Unit:** 3
**Depends on:** None (parallel with Units 1–2)
**Load context:** `command-bar.md` lines 10–38 (Unified Command Prompt — search channel routing, permission-scoped AI), `data-model.md` lines 74–84 (records schema with tsvector)
**Target files:** `apps/web/src/lib/command-bar/types.ts`, `apps/web/src/data/command-bar-search.ts`, `apps/web/src/data/__tests__/command-bar-search.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): search types and record search via tsvector [Phase 3B-ii, Prompt 9]`

### Schema Snapshot

```
records: tenant_id, id, table_id, canonical_data (JSONB), search_vector (tsvector), deleted_at
tables: id, workspace_id, tenant_id, name
fields: id, table_id, name, is_primary
views: id, table_id, tenant_id, permissions (JSONB — ViewPermissions)
```

### Task

**File 1:** `apps/web/src/lib/command-bar/types.ts`

Define and export:

```typescript
interface SearchResult {
  record_id: string;
  table_id: string;
  table_name: string;
  primary_field_value: string;
  rank: number; // tsvector rank score
}

interface NavigationResult {
  entity_type: 'table' | 'view';
  entity_id: string;
  name: string;
  parent_name?: string; // workspace or table name for context
  icon?: string;
}

interface CommandEntry {
  id: string;
  command_key: string;
  label: string;
  description: string;
  category: string;
  source: string; // 'system' | 'automation' | 'custom'
  context_scopes: string[]; // 'global' | 'table_view' | 'record_detail' | 'chat'
  permission_required: string;
  sort_order: number;
}

interface RecentItem {
  item_type: string;
  item_id: string;
  display_name: string;
  entity_context?: string; // e.g., table name for a record
  accessed_at: string; // ISO 8601
}

interface RecentItemInput {
  item_type: string;
  item_id: string;
  display_name: string;
  entity_context?: string;
}

interface CommandBarSearchParams {
  query: string;
  workspace_id: string;
  scope?: 'global' | 'table'; // 'table' = scoped to current table (Cmd+F)
  current_table_id?: string; // when scope = 'table'
  limit?: number; // default 20
}
```

**File 2:** `apps/web/src/data/command-bar-search.ts`

Export:

```typescript
searchRecords(
  tenantId: string,
  workspaceId: string,
  query: string,
  opts?: { tableId?: string; limit?: number; userId?: string }
): Promise<SearchResult[]>
```

Implementation:
1. Use `getDbForTenant()` for tenant-scoped query
2. Use PostgreSQL `ts_rank()` with the `search_vector` tsvector column and `plainto_tsquery()` on the user's query
3. Filter to tables in the given workspace (`tables.workspace_id = workspaceId`)
4. If `opts.tableId` provided, further filter to that table (scoped mode)
5. Filter by permission — only return records from tables the user has access to (via workspace role + Table View assignments). Use existing permission check patterns from `apps/web/src/data/permissions.ts`.
6. Join with `fields` (where `is_primary = true`) to get primary field value for display
7. Join with `tables` for table name
8. Order by `ts_rank` descending
9. Limit to `opts.limit ?? 20`
10. Exclude soft-deleted records (`deleted_at IS NULL`)

**Tests** in `__tests__/command-bar-search.test.ts`:
- Returns ranked search results matching query
- Scoped search filters to specific table
- Permission filtering: user only sees records from accessible tables
- Soft-deleted records excluded
- Tenant isolation test

### Acceptance Criteria

- [ ] All types exported from `apps/web/src/lib/command-bar/types.ts`: `SearchResult`, `NavigationResult`, `CommandEntry`, `RecentItem`, `RecentItemInput`, `CommandBarSearchParams`
- [ ] `searchRecords()` exported from `apps/web/src/data/command-bar-search.ts`
- [ ] Uses tsvector full-text search with `ts_rank()` for relevance ranking
- [ ] Results include `table_name`, `primary_field_value`, `record_id`, `table_id`
- [ ] Permission-filtered: user only sees records from accessible tables
- [ ] Scoped mode: filters to specific table when `tableId` provided
- [ ] Soft-deleted records excluded
- [ ] Tenant-scoped via `getDbForTenant()`
- [ ] `testTenantIsolation()` for `searchRecords()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- AI natural language search (Unit 4)
- Semantic/vector search (post-MVP)
- Command Bar UI components (Unit 4)
- Recent items boosting in search results (Prompt 11)

---

## Prompt 10: Table/View Navigation & Command Registry Data Layer

**Unit:** 3
**Depends on:** Prompt 9 (uses types from `command-bar/types.ts`)
**Load context:** `command-bar.md` lines 90–130 (Command Registry schema, Slash Command Catalog), `permissions.md` lines 90–122 (Table View–Based Access — sidebar experience by role)
**Target files:** `apps/web/src/data/command-bar-search.ts` (add to existing), `apps/web/src/data/command-registry.ts`, `apps/web/src/data/__tests__/command-registry.test.ts`, `packages/shared/testing/factories/command-registry.ts`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): table/view navigation search and command registry with permission filtering [Phase 3B-ii, Prompt 10]`

### Schema Snapshot

```
tables: id, workspace_id, tenant_id, name, table_type
views: id, table_id, tenant_id, name, view_type, is_shared, permissions (JSONB)
command_bar_sessions: id, userId, tenantId, context (JSONB), messages (JSONB), resultSet (JSONB)
```

Command Registry — currently no DB table exists. System commands are hardcoded in a registry. Per `command-bar.md`, the `command_registry` table columns are: `id, tenant_id (nullable), command_key, label, description, category, source, automation_id (nullable), context_scopes (JSONB), permission_required, sort_order`.

### Task

**File 1:** Add to `apps/web/src/data/command-bar-search.ts`:

```typescript
searchTablesAndViews(
  tenantId: string,
  workspaceId: string,
  query: string,
  userId: string
): Promise<NavigationResult[]>
```

Implementation:
1. Query `tables` in the workspace, fuzzy-match by name using `ILIKE '%${query}%'` (parameterized — no SQL injection)
2. Query `views` for those tables, fuzzy-match by name
3. Filter by user's role and Table View assignments:
   - Owner/Admin: see all tables and views
   - Manager: see permitted tables + their views
   - Team Member/Viewer: see only assigned Shared Views (per `permissions.md` sidebar experience)
4. Return results as `NavigationResult[]` with entity_type, entity_id, name, parent_name

**File 2:** `apps/web/src/data/command-registry.ts`

Export the system command registry and a query function:

```typescript
getCommandRegistry(
  tenantId: string,
  userId: string,
  context: { scope: string; tableId?: string }
): Promise<CommandEntry[]>
```

Implementation:
1. Define the MVP system commands as a constant array matching the Slash Command Catalog from `command-bar.md` lines 110–130. All system commands have `tenant_id: null`, `source: 'system'`.
2. Filter by `context_scopes` — only return commands valid for the current context (e.g., `/new record` only in `table_view` scope)
3. Filter by `permission_required` — check user's workspace role against the minimum role required for each command
4. Sort by `sort_order`
5. Future: query `command_registry` DB table for tenant-specific custom commands (for now, system commands only)

**File 3:** `packages/shared/testing/factories/command-registry.ts`

Create `createTestCommandRegistryEntry()` factory that produces valid `CommandEntry` objects for testing.

**Tests** in `__tests__/command-registry.test.ts`:
- `getCommandRegistry()` returns system commands filtered by context scope
- Permission filtering: Viewer doesn't see Manager+ commands
- Factory produces valid entries
- `searchTablesAndViews()` returns filtered navigation results
- Tenant isolation for navigation search

### Acceptance Criteria

- [ ] `searchTablesAndViews()` exported, returns fuzzy-matched tables and views filtered by user's role and Table View assignments
- [ ] `getCommandRegistry()` exported, returns system commands filtered by user's role and current context scope
- [ ] MVP slash commands hardcoded per `command-bar.md` Slash Command Catalog
- [ ] Permission filtering: commands respect `permission_required`, navigation respects Table View access
- [ ] `createTestCommandRegistryEntry()` factory exported
- [ ] Tenant isolation tests for `searchTablesAndViews()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Custom workspace slash commands (post-MVP — system commands only)
- Automation-registered commands (post-MVP — requires full automation system)
- Command Bar Setup Modal (post-MVP — command reordering)
- Guide Mode (post-MVP)

---

## Prompt 11: Recent Items Tracking

**Unit:** 3
**Depends on:** Prompt 9 (uses types from `command-bar/types.ts`)
**Load context:** `data-model.md` lines 122–130 (user_recent_items schema)
**Target files:** `apps/web/src/data/recent-items.ts`, `apps/web/src/data/__tests__/recent-items.test.ts`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): recent items tracking with upsert dedup and access filtering [Phase 3B-ii, Prompt 11]`

### Schema Snapshot

```
user_recent_items: id (UUIDv7 PK), user_id, item_type (VARCHAR 64), item_id (UUID), tenant_id, accessed_at
  indexes: (user_id, tenant_id, accessed_at DESC), UNIQUE(user_id, item_type, item_id)
```

### Task

Create `apps/web/src/data/recent-items.ts` exporting:

```typescript
trackRecentItem(
  userId: string,
  tenantId: string,
  item: RecentItemInput
): Promise<void>

getRecentItems(
  userId: string,
  tenantId: string,
  limit?: number
): Promise<RecentItem[]>
```

**`trackRecentItem()`:**
1. Upsert into `user_recent_items` — use the unique index `(user_id, item_type, item_id)` for conflict detection
2. On conflict: update `accessed_at` to current timestamp (dedup — same item tracked twice just updates the timestamp)
3. Cap recent items per user — after upsert, delete oldest entries beyond 100 items per user per tenant

**`getRecentItems()`:**
1. Query `user_recent_items` for user+tenant, ordered by `accessed_at DESC`
2. Limit to `limit ?? 20`
3. Filter to accessible entities — join with `tables` and `views` to verify user still has access (entities may have been deleted or permissions revoked since they were tracked)
4. Enrich with display name by joining with the entity table (tables.name, views.name, etc.)
5. Return as `RecentItem[]`

**Tests** in `__tests__/recent-items.test.ts`:
- `trackRecentItem()` inserts new item
- `trackRecentItem()` upserts (updates `accessed_at` on duplicate)
- `getRecentItems()` returns items sorted by `accessed_at` DESC
- Cap: items beyond 100 per user are deleted
- Access filtering: deleted entities not returned
- Tenant isolation test

### Acceptance Criteria

- [ ] [CONTRACT] `trackRecentItem(userId, tenantId, item)` exported from `apps/web/src/data/recent-items.ts`
- [ ] [CONTRACT] `getRecentItems(userId, tenantId, limit?)` exported from `apps/web/src/data/recent-items.ts`
- [ ] [CONTRACT] `searchRecords()` exported from `apps/web/src/data/command-bar-search.ts`
- [ ] [CONTRACT] `searchTablesAndViews()` exported from `apps/web/src/data/command-bar-search.ts`
- [ ] [CONTRACT] `getCommandRegistry()` exported from `apps/web/src/data/command-registry.ts`
- [ ] [CONTRACT] `createTestCommandRegistryEntry()` factory exported
- [ ] [CONTRACT] All Command Bar types exported from `apps/web/src/lib/command-bar/types.ts`
- [ ] Upsert dedup on `(user_id, item_type, item_id)`
- [ ] Recent items capped at 100 per user per tenant
- [ ] Access filtering: only accessible entities returned
- [ ] `testTenantIsolation()` for `getRecentItems()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Private Personal Tasks (separate feature — My Office)
- Command Bar analytics (session tracking) — separate from recent items
- Real-time recent items sync across devices (post-MVP)

---

## VERIFY Session Boundary (after Prompts 9–11) — Completes Unit 3

**Scope:** Verify all Command Bar data layer functions work correctly with permissions.
**Unit status:** Unit 3 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: `searchRecords()` returns ranked results against test data

**Interface contract check (unit-completing):**
Verify these exports exist and match the subdivision doc's contract:
- [ ] [CONTRACT] `SearchResult`, `NavigationResult`, `CommandEntry`, `RecentItem`, `CommandBarSearchParams` types from `apps/web/src/lib/command-bar/types.ts`
- [ ] [CONTRACT] `searchRecords(tenantId, workspaceId, query, opts?)` from `apps/web/src/data/command-bar-search.ts`
- [ ] [CONTRACT] `searchTablesAndViews(tenantId, workspaceId, query, userId)` from `apps/web/src/data/command-bar-search.ts`
- [ ] [CONTRACT] `getCommandRegistry(tenantId, userId, context)` from `apps/web/src/data/command-registry.ts`
- [ ] [CONTRACT] `trackRecentItem(userId, tenantId, item)` from `apps/web/src/data/recent-items.ts`
- [ ] [CONTRACT] `getRecentItems(userId, tenantId, limit?)` from `apps/web/src/data/recent-items.ts`
- [ ] [CONTRACT] `createTestCommandRegistryEntry()` factory from `packages/shared/testing/factories/`

**State file updates:**
- Update TASK-STATUS.md: Unit 3 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 9–11 [Phase 3B-ii, VP-3]`, then push branch to origin.

Fix any failures before proceeding to Prompt 12.

---

## — Unit 4: Command Bar UI & AI Search Channel —

### Unit Context

The user-facing Command Bar component — a `Cmd+K` modal built on shadcn/ui Command (cmdk) that unifies 4 search channels into a single keyboard-first interface. Channel 1 (fuzzy record search) and Channel 2 (table/view navigation) consume the data layer from Unit 3. Channel 3 (slash commands) renders the command registry from Unit 3 with fuzzy filtering. Channel 4 (AI natural language search) sends the user's query plus a permission-filtered `WorkspaceDescriptor` from Unit 2's SDS to AIService for intent classification and schema-aware response.

**Interface Contract:**
Produces: `CommandBar`, `CommandBarProvider`, `useCommandBar()`, `CommandBarSearchResults`, `CommandBarSlashMenu`, `CommandBarAIChannel`, `CommandBarRecentItems` components; `executeSlashCommand()`, `aiSearchQuery()` server actions
Consumes: `SchemaDescriptorService` from Unit 2, all data functions from Unit 3, AIService from `packages/shared/ai/service.ts`, shadcn/ui Command (cmdk)

---

## Prompt 12: CommandBar Shell, Provider & Keyboard Shortcuts

**Unit:** 4
**Depends on:** Units 2 + 3 complete
**Load context:** `command-bar.md` lines 10–38 (Unified Command Prompt — layout, intent routing), `command-bar.md` lines 156–163 (Keyboard Shortcuts)
**Target files:** `apps/web/src/components/command-bar/command-bar-provider.tsx`, `apps/web/src/components/command-bar/command-bar.tsx`, `apps/web/src/components/command-bar/__tests__/command-bar.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): shell component, provider context, and keyboard shortcuts (Cmd+K, Cmd+F) [Phase 3B-ii, Prompt 12]`

### Schema Snapshot

N/A — UI components only.

### Task

**File 1:** `apps/web/src/components/command-bar/command-bar-provider.tsx`

Create the Command Bar context provider:

```typescript
interface CommandBarState {
  isOpen: boolean;
  mode: 'global' | 'scoped'; // global = Cmd+K, scoped = Cmd+F (current table)
  scopedTableId?: string;
  query: string;
  activeChannel: 'search' | 'slash' | 'ai' | null;
}

const CommandBarContext = createContext<{
  state: CommandBarState;
  open: (mode?: 'global' | 'scoped', tableId?: string) => void;
  close: () => void;
  setQuery: (query: string) => void;
}>(...)

export function CommandBarProvider({ children }: { children: ReactNode })
export function useCommandBar(): CommandBarContextValue
```

State management:
- `isOpen` toggled by keyboard shortcuts and programmatic calls
- `mode` determines search scope: `global` searches all workspace tables, `scoped` pre-filters to `scopedTableId`
- `query` is the current input value
- `activeChannel` is derived from query content: starts with `/` → `slash`, contains `?` or natural language → `ai`, otherwise → `search`

**File 2:** `apps/web/src/components/command-bar/command-bar.tsx`

Create the main Command Bar modal component:

```typescript
export function CommandBar()
```

Implementation:
1. Build on shadcn/ui `Command` component (cmdk library). This provides keyboard navigation, fuzzy filtering, and grouping out of the box.
2. Render as a `CommandDialog` (modal overlay) — never unmounts from DOM, just toggles visibility via `isOpen`.
3. **Keyboard shortcuts** — register globally in the application shell:
   - `Cmd+K` / `Ctrl+K` → open in `global` mode
   - `Cmd+F` / `Ctrl+F` → open in `scoped` mode (pre-filters to current table if in a table context; falls back to global if not)
   - `Escape` → close
4. **Input area:** Single text input at top. Placeholder: "Ask or do anything..." Renders appropriate channel content below based on `activeChannel`.
5. **Intent routing** — detect channel from input:
   - Input starts with `/` → show slash command dropdown (Channel 3)
   - Input is a question (contains `?`, starts with "how", "what", "why", "find", "show me") → route to AI channel (Channel 4)
   - Otherwise → show search results (Channels 1+2 combined)
6. **Empty state:** When input is empty, show recent items (to be implemented in Prompt 15).

Wrap the provider around the application shell layout in the appropriate root layout file.

**Tests** in `__tests__/command-bar.test.tsx`:
- Renders without error
- Opens on Cmd+K, closes on Escape
- Scoped mode sets `scopedTableId`
- Intent routing: `/` triggers slash, `?` triggers AI, plain text triggers search
- Provider values accessible via `useCommandBar()`

### Acceptance Criteria

- [ ] `CommandBarProvider` and `useCommandBar()` exported from `command-bar-provider.tsx`
- [ ] `CommandBar` component exported from `command-bar.tsx`
- [ ] Opens on `Cmd+K` / `Ctrl+K` and closes on `Escape`
- [ ] `Cmd+F` / `Ctrl+F` opens in scoped mode (pre-filters to current table)
- [ ] Persists in application shell (never unmounts)
- [ ] Intent routing: `/` → slash, question → AI, plain text → search
- [ ] Built on shadcn/ui Command (cmdk)
- [ ] Component tests pass
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Guide Mode overlay (post-MVP)
- Notification bell integration (separate feature)
- Compact state toolbar layout (post-MVP polish)
- AI prompt template saving (post-MVP)

---

## Prompt 13: Search Results, Navigation & Slash Command Channels

**Unit:** 4
**Depends on:** Prompt 12
**Load context:** `command-bar.md` lines 10–38 (Unified Command Prompt — channel routing), `command-bar.md` lines 110–130 (Slash Command Catalog)
**Target files:** `apps/web/src/components/command-bar/search-results.tsx`, `apps/web/src/components/command-bar/slash-menu.tsx`, `apps/web/src/components/command-bar/__tests__/search-results.test.tsx`, `apps/web/src/components/command-bar/__tests__/slash-menu.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): search results, navigation, and slash command channels [Phase 3B-ii, Prompt 13]`

### Schema Snapshot

N/A — UI components consuming data layer from Unit 3.

### Task

**File 1:** `apps/web/src/components/command-bar/search-results.tsx`

```typescript
export function CommandBarSearchResults({ query, scopedTableId }: Props)
```

Implementation:
1. Fetch results from `searchRecords()` and `searchTablesAndViews()` (Unit 3 data layer) using Server Actions or data fetching hooks
2. **Debounce** query input — 200ms debounce before firing search
3. Group results by category:
   - **Records** section — shows record results with table name badge, primary field value
   - **Tables & Views** section — shows navigation results with entity type icon
4. **Keyboard navigation:** Arrow keys move selection within cmdk, Enter navigates to selected item
5. On record selection: navigate to Record View overlay for that record
6. On table/view selection: navigate to that table/view

**File 2:** `apps/web/src/components/command-bar/slash-menu.tsx`

```typescript
export function CommandBarSlashMenu({ query }: Props)
```

Implementation:
1. Fetch commands from `getCommandRegistry()` (Unit 3 data layer), passing current context
2. Filter commands by fuzzy matching against the query (strip leading `/`)
3. Group by category (Navigation, Record Creation, Data Operations, Communication, etc.)
4. Show command label, description, and keyboard shortcut hint if applicable
5. On selection: if simple command → execute inline; if complex → open appropriate modal/wizard
6. Permission-filtered: only commands the user's role allows

**Tests:**
- Search results render grouped by category
- Debounce prevents excessive queries
- Slash menu shows permission-filtered commands
- Slash menu fuzzy filters on query
- Keyboard navigation works within results

### Acceptance Criteria

- [ ] `CommandBarSearchResults` exported, shows grouped search results from Channels 1+2
- [ ] `CommandBarSlashMenu` exported, shows fuzzy-filtered slash commands from Channel 3
- [ ] Results grouped by category (Records, Tables & Views for search; command categories for slash)
- [ ] 200ms debounce on search input
- [ ] Keyboard navigation: arrow keys move selection, Enter selects
- [ ] Commands filtered by user role (`permission_required` check) and current context (`context_scopes`)
- [ ] Component tests for search results display and slash menu filtering
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- AI search results rendering (Prompt 14)
- Command execution handlers (Prompt 14 for server actions)
- Custom workspace commands (post-MVP)
- Command Bar Setup Modal (post-MVP)

---

## Prompt 14: AI Search Channel & Server Actions

**Unit:** 4
**Depends on:** Prompts 12, 13
**Load context:** `command-bar.md` lines 10–38 (Unified Command Prompt — permission-scoped AI, confirmation architecture), `schema-descriptor-service.md` lines 209–223 (API Surface — SDS endpoint signatures), `ai-architecture.md` lines 94–143 (Capability-Based Model Routing)
**Target files:** `apps/web/src/components/command-bar/ai-channel.tsx`, `apps/web/src/actions/command-bar.ts`, `apps/web/src/components/command-bar/__tests__/ai-channel.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): AI natural language search channel with SDS context and slash command execution [Phase 3B-ii, Prompt 14]`

### Schema Snapshot

```
command_bar_sessions: id (UUIDv7 PK), user_id, tenant_id, context (JSONB), messages (JSONB), result_set (JSONB), created_at
```

### Task

**File 1:** `apps/web/src/actions/command-bar.ts`

Create server actions:

```typescript
'use server'

export async function aiSearchQuery(
  tenantId: string,
  workspaceId: string,
  userId: string,
  query: string
): Promise<AISearchResult>

export async function executeSlashCommand(
  tenantId: string,
  userId: string,
  commandKey: string,
  params?: Record<string, unknown>
): Promise<CommandResult>
```

**`aiSearchQuery()`:**
1. Get permission-filtered workspace schema: `SchemaDescriptorService.describeWorkspace(workspaceId, userId, tenantId)`
2. Condense for AI context: `condenseDescriptor(descriptor, 2000)` — fit within AI context budget
3. Estimate token cost: `estimateTokens(condensedDescriptor)`
4. Call `AIService.getInstance().execute()` with:
   - `feature: 'command_bar'`
   - `prompt`: the user's query
   - `context: { tableSchemas: [condensedDescriptor] }`
   - Task type inferred from feature → `classify_intent` → `fast` capability tier
5. Parse the AI response — extract intent and structured result
6. Return `AISearchResult` with the AI's response, intent classification, and any action suggestions

**`executeSlashCommand()`:**
1. Look up the command from the registry
2. Validate the user's permission against `permission_required`
3. Route to the correct handler based on `command_key`:
   - Navigation commands (`/goto`, `/office`): return a redirect URL
   - Creation commands (`/new record`, `/todo`): create the entity and return result
   - Settings commands (`/settings`): return a redirect URL
   - Other commands: return appropriate result
4. Validate permissions before execution
5. Return `CommandResult` with success/failure and any navigation target

**File 2:** `apps/web/src/components/command-bar/ai-channel.tsx`

```typescript
export function CommandBarAIChannel({ query }: Props)
```

Implementation:
1. When query triggers AI channel (detected by intent routing in provider), show loading state
2. Call `aiSearchQuery()` server action with debounce (500ms for AI — longer than search)
3. Display AI response:
   - **Read results** (search-like responses): show immediately, no confirmation
   - **Action suggestions** (AI suggests creating/modifying something): show preview card with Confirm/Cancel buttons — never execute without user confirmation
4. Show estimated credit cost before the AI call fires (use `estimateTokens()` on client side or server-provided estimate)
5. Handle errors gracefully — show "AI is unavailable" message, don't break the Command Bar

**Tests:**
- AI channel renders loading state
- Action suggestions show confirmation UI
- Read results display immediately
- `executeSlashCommand()` validates permissions
- `aiSearchQuery()` uses SDS for context

### Acceptance Criteria

- [ ] `aiSearchQuery()` server action exported from `apps/web/src/actions/command-bar.ts`
- [ ] `executeSlashCommand()` server action exported from `apps/web/src/actions/command-bar.ts`
- [ ] `CommandBarAIChannel` exported, renders AI search results
- [ ] AI search sends query + condensed `WorkspaceDescriptor` to AIService with `fast` capability tier
- [ ] Permission-filtered: SDS provides filtered schema, commands validate permissions
- [ ] Action confirmation UI: read results show immediately, actions require Confirm/Cancel
- [ ] Credit cost shown before AI execution
- [ ] `executeSlashCommand()` routes to correct handler based on `command_key`
- [ ] Component tests for AI channel rendering
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Guide Mode (post-MVP)
- Streaming AI responses (post-MVP — use standard execute for MVP)
- AI prompt template learning (post-MVP)
- DuckDB query execution (post-MVP)

---

## Prompt 15: Recent Items Display, Scoped Mode & Analytics

**Unit:** 4
**Depends on:** Prompts 12, 13
**Load context:** `command-bar.md` lines 10–38 (Unified Command Prompt)
**Target files:** `apps/web/src/components/command-bar/recent-items.tsx`, `apps/web/src/components/command-bar/__tests__/recent-items.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(command-bar): recent items display, scoped mode integration, and session analytics [Phase 3B-ii, Prompt 15]`

### Schema Snapshot

```
user_recent_items: id, user_id, item_type, item_id, tenant_id, accessed_at
command_bar_sessions: id, user_id, tenant_id, context (JSONB), messages (JSONB), result_set (JSONB), created_at
```

### Task

**File 1:** `apps/web/src/components/command-bar/recent-items.tsx`

```typescript
export function CommandBarRecentItems()
```

Implementation:
1. Show recent items when Command Bar opens with empty input
2. Fetch from `getRecentItems()` (Unit 3 data layer) — display 10 most recent
3. Render each item with icon (based on `item_type`), display name, and entity context
4. Boost recent items in search results — when query is entered, prepend matching recent items above search results (matching by name)
5. Keyboard navigation through recent items (arrow keys, Enter to select)

**File 2:** Integration points — update `command-bar.tsx` and `search-results.tsx`:

1. **Recent items on empty input:** In `CommandBar`, when `query` is empty, render `CommandBarRecentItems` instead of search results
2. **Track item selection:** Call `trackRecentItem()` on every item selection:
   - Record opened → track record
   - Table navigated → track table
   - View navigated → track view
   - Command executed → track command
3. **Scoped mode refinement:** When `mode === 'scoped'` and `scopedTableId` is set:
   - Pre-fill Command Bar with a visual badge showing the table name (e.g., "[Deals] ")
   - Filter search results to that table only
   - Slash commands scoped to `table_view` context only
4. **Session analytics:** Write to `command_bar_sessions` on each session open/close:
   - On open: create session row with `context` (current page, scope mode)
   - On close: update with `messages` (queries entered) and `result_set` (items selected)

**Tests:**
- Recent items shown on empty input
- Recent items boosted in search results
- `trackRecentItem()` called on item selection
- Scoped mode shows table badge and filters results
- Session analytics written on open/close

### Acceptance Criteria

- [ ] [CONTRACT] `CommandBar` component exported from `command-bar.tsx`
- [ ] [CONTRACT] `CommandBarProvider` and `useCommandBar()` exported from `command-bar-provider.tsx`
- [ ] [CONTRACT] `CommandBarSearchResults` exported from `search-results.tsx`
- [ ] [CONTRACT] `CommandBarSlashMenu` exported from `slash-menu.tsx`
- [ ] [CONTRACT] `CommandBarAIChannel` exported from `ai-channel.tsx`
- [ ] [CONTRACT] `CommandBarRecentItems` exported from `recent-items.tsx`
- [ ] [CONTRACT] `executeSlashCommand()` server action exported from `apps/web/src/actions/command-bar.ts`
- [ ] [CONTRACT] `aiSearchQuery()` server action exported from `apps/web/src/actions/command-bar.ts`
- [ ] Recent items shown when Command Bar opens with empty input
- [ ] Recent items boosted in search results
- [ ] `trackRecentItem()` called on every item selection
- [ ] Scoped mode (Cmd+F) pre-filters to current table with visual badge
- [ ] Session analytics written to `command_bar_sessions`
- [ ] Component tests pass
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

### Do NOT Build

- Command Bar Setup Modal (post-MVP — command reordering)
- Notification bell integration (separate feature)
- Private Personal Tasks from Command Bar (separate My Office feature)
- Cross-device recent items sync (post-MVP)

---

## VERIFY Session Boundary (after Prompts 12–15) — Completes Unit 4

**Scope:** Verify the full Command Bar UI integrates correctly with all 4 search channels, SDS, and the data layer.
**Unit status:** Unit 4 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings (UI text through i18n)
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. Manual verification:
   - `Cmd+K` opens Command Bar, typing shows search results
   - `/` triggers slash command dropdown
   - Question mark query triggers AI channel
   - `Cmd+F` opens in scoped mode
   - Recent items show on empty input
   - Selecting an item calls `trackRecentItem()`

**Interface contract check (unit-completing):**
Verify these exports exist and match the subdivision doc's contract:
- [ ] [CONTRACT] `CommandBar` component from `apps/web/src/components/command-bar/command-bar.tsx`
- [ ] [CONTRACT] `CommandBarProvider` from `apps/web/src/components/command-bar/command-bar-provider.tsx`
- [ ] [CONTRACT] `useCommandBar()` hook from `apps/web/src/components/command-bar/command-bar-provider.tsx`
- [ ] [CONTRACT] `CommandBarSearchResults` from `search-results.tsx`
- [ ] [CONTRACT] `CommandBarSlashMenu` from `slash-menu.tsx`
- [ ] [CONTRACT] `CommandBarAIChannel` from `ai-channel.tsx`
- [ ] [CONTRACT] `CommandBarRecentItems` from `recent-items.tsx`
- [ ] [CONTRACT] `executeSlashCommand()` from `apps/web/src/actions/command-bar.ts`
- [ ] [CONTRACT] `aiSearchQuery()` from `apps/web/src/actions/command-bar.ts`

**Cross-unit integration check:**
- [ ] AI channel uses SDS (Unit 2) for permission-filtered schema context
- [ ] Search results use `searchRecords()` and `searchTablesAndViews()` (Unit 3)
- [ ] Slash menu uses `getCommandRegistry()` (Unit 3)
- [ ] Recent items use `trackRecentItem()` and `getRecentItems()` (Unit 3)
- [ ] Permission consistency: fields hidden in SDS also invisible in search results

**State file updates:**
- Update TASK-STATUS.md: Unit 4 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message `chore(verify): verify prompts 12–15 [Phase 3B-ii, VP-4]`, then push branch to origin.

Fix any failures before marking the sub-phase complete.
