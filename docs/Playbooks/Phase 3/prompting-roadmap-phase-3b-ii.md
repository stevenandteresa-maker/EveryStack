# Phase 3B-ii — Schema Descriptor Service & Command Bar — Prompting Roadmap

## Overview

- **Sub-phase:** 3B-ii — Schema Descriptor Service & Command Bar
- **Playbook:** `docs/Playbooks/playbook-phase-3b-ii.md`
- **Subdivision doc:** `docs/subdivisions/3b-ii-subdivision.md`
- **Units:** 4 — (1) SDS Types & Core Builders, (2) SDS Permission Filter, Caching & Service Facade, (3) Command Bar Search & Navigation Data Layer, (4) Command Bar UI & AI Search Channel
- **Estimated duration:** 6–8 sessions across all 6 lifecycle steps
- **Prior sub-phase:** Phase 3B-i (Cross-Linking Engine) — merged to main

**Parallel opportunity:** Unit 3 can be built concurrently with Units 1–2. They don't depend on each other. Unit 4 depends on both Units 2 and 3.

## Section Index

| Section | Summary |
|---------|---------|
| Overview | Sub-phase metadata, 4 units, 6-8 session estimate, Unit 3 parallel with Units 1-2 |
| Step 3 — Build Execution | 15 prompts in 4 units: SDS types/builders, permission filter/cache, Command Bar data layer, Command Bar UI + AI channel |
| Step 4 — Review | Reviewer Agent verification with security focus on permission filtering |
| Step 5 — Docs Sync | MODIFICATIONS.md template for created/modified files |

---

## STEP 0 — DOC PREP (Architect Agent)

### What This Step Does

**This step is already complete.** The Architect Agent ran doc prep for Phase 3B-ii, verifying `schema-descriptor-service.md`, `command-bar.md`, `data-model.md`, and the glossary. The `docs/` branch was merged to main. The playbook at `docs/Playbooks/playbook-phase-3b-ii.md` was produced against the updated docs.

No action needed. Proceed to Step 3.

---

## STEP 1 — PLAYBOOK GENERATION

### What This Step Does

**This step is already complete.** You already have the playbook for this sub-phase — it was produced before this roadmap.

The playbook is at: `docs/Playbooks/playbook-phase-3b-ii.md`

No action needed. Proceed to Step 3.

---

## STEP 2 — PROMPTING ROADMAP GENERATION

**This step is already complete.** You're reading the output of Step 2. Proceed to Step 3.

---

## STEP 3 — BUILD + VERIFY EXECUTION

Step 3 alternates between BUILD sessions and VERIFY sessions in separate Claude Code contexts. BUILD contexts are focused on writing code with full playbook/reference context. VERIFY contexts are focused on running tests and fixing failures with full testing knowledge. This keeps each context lean and within budget.

This sub-phase is organized into **4 units**. Each unit represents a coherent slice of the build with defined inputs and outputs. You'll see unit headers marking where each unit starts and what it produces.

**Important note on parallel units:** Unit 3 (Command Bar data layer) can be built at any time — it does not depend on Units 1 or 2. However, Unit 4 (Command Bar UI) depends on both Unit 2 and Unit 3 being complete. The roadmap presents them in order 1→2→3→4, but if anything blocks Unit 1 or 2, you can skip ahead to Unit 3.

### Setup

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b build/3b-ii-sds-command-bar
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Find the "3B-ii — Schema Descriptor Service & Command Bar" section.
All units should show `pending`. No changes needed yet.
```

---

### ═══ UNIT 1: SDS Types & Core Builders ═══

**What This Unit Builds:**
This is the foundation for the Schema Descriptor Service — the system that describes your workspace's data structure to the AI in a language it can understand. It creates the type definitions (what a "workspace descriptor" looks like, what a "field descriptor" looks like) and the builder functions that read your existing database tables, fields, and cross-links and assemble them into a structured JSON snapshot. Think of it like creating a detailed floor plan of your data warehouse — the AI reads this floor plan to understand what data exists and how it's connected.

**What Comes Out of It:**
When done, the system can take any workspace ID and produce a complete JSON description of that workspace's structure — every table, every field, every cross-link relationship — assembled from the live database. No permissions filtering or caching yet — that comes in Unit 2.

**What It Needs from Prior Work:**
Nothing — this is the first unit. It uses existing database schema, field type definitions, and cross-link types from prior phases.

---

### BUILD SESSION A — Unit 1, Prompts 1–4

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 1 to `in-progress`.
Add branch name: `build/3b-ii-sds-command-bar`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 1: SDS Descriptor Types & LinkEdge

**What This Builds:**
This creates the TypeScript type definitions that describe what a "schema descriptor" looks like. These are the data shapes the AI will consume — a workspace descriptor containing bases, tables, fields, and a link graph showing how tables connect to each other. Every field carries metadata about whether it's searchable, aggregatable, or linked to another table. These types are purely definitions — no database queries, no logic, just the vocabulary.

**What You'll See When It's Done:**
Claude Code will create two new files: `types.ts` (the type definitions) and `index.ts` (the barrel export). TypeScript and ESLint should compile clean.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii (Schema Descriptor Service & Command Bar), Unit 1, Prompt 1.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 1 (search for "## Prompt 1:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 79–193 (Output Schema — full WorkspaceDescriptor JSON structure, field descriptions, design decisions)
- packages/shared/sync/field-registry.ts (FieldTypeRegistry — existing field type pattern)
- packages/shared/sync/cross-link-types.ts (CrossLinkFieldValue, RelationshipType)
- packages/shared/db/schema/tables.ts (table schema)
- packages/shared/db/schema/fields.ts (field schema)
- packages/shared/db/schema/base-connections.ts (base connection schema)
- packages/shared/db/schema/cross-links.ts (cross-link schema)
- packages/shared/ai/types.ts (existing AI type patterns)
- packages/shared/ai/index.ts (existing AI package exports)

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

Acceptance criteria:
- [ ] `WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] JSDoc on each type explains LLM optimization purpose
- [ ] `FieldDescriptor` includes `searchable` and `aggregatable` boolean flags
- [ ] `FieldDescriptor` includes all type-specific metadata: `options`, `currency_code`, `linked_base`/`linked_table`/`cardinality`/`symmetric_field`
- [ ] `cardinality` on `FieldDescriptor` includes `'restricted'` option
- [ ] `condensed` flag on `TableDescriptor` and `WorkspaceDescriptor`
- [ ] Barrel `index.ts` re-exports all types
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: DuckDB-related types, vector embedding types, agent scope types, or any implementation logic — types only.

Commit with: `feat(ai): SDS descriptor types — WorkspaceDescriptor, TableDescriptor, FieldDescriptor, LinkEdge [Phase 3B-ii, Prompt 1]`
```

[CHECKPOINT]
```
Look for:
- Two new files: types.ts and index.ts in packages/shared/ai/schema-descriptor/
- Five exported types: WorkspaceDescriptor, BaseDescriptor, TableDescriptor, FieldDescriptor, LinkEdge
- JSDoc comments on each type
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 2: Field-to-Descriptor Mapper

**What This Builds:**
This creates the function that translates a single database field definition into the AI-readable "field descriptor" format. For each field type (text, number, select, linked record, etc.), it decides whether it's searchable, aggregatable, and extracts type-specific metadata like select options or currency codes. This is the mapping layer between your raw database schema and the AI-optimized descriptor format.

**What You'll See When It's Done:**
Claude Code will create a mapper file and a test file. Tests should cover every MVP field type. All tests should pass.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 1, Prompt 2.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 2 (search for "## Prompt 2:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 79–193 (Output Schema)
- docs/reference/data-model.md lines 74–84 (Data Layer — fields schema)
- packages/shared/ai/schema-descriptor/types.ts (types from Prompt 1)
- packages/shared/sync/field-registry.ts (FieldTypeRegistry — all MVP field types)
- packages/shared/db/schema/fields.ts (field Drizzle schema)
- packages/shared/db/schema/cross-links.ts (cross-link Drizzle schema)

Create `packages/shared/ai/schema-descriptor/field-mapper.ts` exporting:

```typescript
mapFieldToDescriptor(
  field: FieldRecord,
  crossLinkDef?: CrossLinkDefinition
): FieldDescriptor
```

Where `FieldRecord` is the Drizzle select type for the `fields` table and `CrossLinkDefinition` is the Drizzle select type for the `cross_links` table.

Mapping logic:
1. Map `field.field_type` to descriptor `type` (passthrough)
2. Set `searchable: true` for: `text`, `email`, `url`, `phone`, `rich_text`
3. Set `aggregatable: true` for: `number`, `currency`, `percent`, `duration`, `rating`
4. For `single_select` / `multi_select`: extract `options` array from `field.config` JSONB
5. For `currency`: extract `currency_code` from `field.config`
6. For `linked_record` (when `crossLinkDef` provided): set `linked_base`, `linked_table`, `cardinality`, `symmetric_field`
7. Handle all other MVP field types with default `searchable: false`, `aggregatable: false`

Do NOT use switch statements on field types — use a `Record<string, ...>` map or if/else approach.

Write unit tests in `packages/shared/ai/schema-descriptor/__tests__/field-mapper.test.ts`:
- Each MVP field type branch produces correct `searchable`/`aggregatable` flags
- Select fields include `options` from config
- Currency field includes `currency_code`
- Linked record field with cross-link def produces full linked metadata
- Linked record field WITHOUT cross-link def still produces valid descriptor
- Unknown field type defaults to non-searchable, non-aggregatable

Acceptance criteria:
- [ ] `mapFieldToDescriptor()` exported
- [ ] Correctly maps all MVP field types with appropriate flags
- [ ] No switch statements on field types
- [ ] Unit tests cover each field type branch
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

Do NOT build: Lookup/rollup field mapping, post-MVP field types.

Commit with: `feat(ai): SDS field-to-descriptor mapper — mapFieldToDescriptor() for all MVP field types [Phase 3B-ii, Prompt 2]`
```

[CHECKPOINT]
```
Look for:
- field-mapper.ts with mapFieldToDescriptor() function
- Test file covering each field type
- No switch statements on field types
- All tests passing
- TypeScript and ESLint clean
```

---

#### PROMPT 3: Table Descriptor Builder

**What This Builds:**
This creates the function that assembles a complete description of a single table — its name, approximate row count (using a fast database statistic instead of counting every row), and all its fields mapped through the field mapper from Prompt 2. For any fields that are cross-links, it also looks up the cross-link definition to include the link metadata. This is the middle layer — it combines field descriptors into table descriptors.

**What You'll See When It's Done:**
Claude Code will create a builder file and integration tests. The tests need the database (Docker) running since they query real table metadata. Tests should pass.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 1, Prompt 3.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 3 (search for "## Prompt 3:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 79–193 (Output Schema — record_count_approx design decision)
- docs/reference/data-model.md lines 74–84 (tables, fields schema)
- packages/shared/ai/schema-descriptor/types.ts (types from Prompt 1)
- packages/shared/ai/schema-descriptor/field-mapper.ts (mapper from Prompt 2)
- packages/shared/db/schema/tables.ts (table Drizzle schema)
- packages/shared/db/schema/fields.ts (field Drizzle schema)
- packages/shared/db/schema/cross-links.ts (cross-link Drizzle schema)

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
2. Get approximate row count using `pg_stat_user_tables.n_live_tup` — use `db.execute(sql\`SELECT n_live_tup FROM pg_stat_user_tables WHERE relname = ${tableName}\`)`. Fall back to 0 if stat row doesn't exist.
3. Retrieve all field definitions for the table from `fields`, ordered by `sort_order`
4. For each field where `field_type === 'linked_record'`, query the matching `cross_links` row
5. Map each field through `mapFieldToDescriptor()` from Prompt 2
6. Return assembled `TableDescriptor`

This function does NOT filter by permissions — that happens in Unit 2.

Write integration tests in `packages/shared/ai/schema-descriptor/__tests__/table-builder.test.ts`:
- Correctly assembles table with multiple field types
- Uses `pg_stat_user_tables` for row count (not COUNT(*))
- Linked record fields include cross-link metadata
- Tenant isolation: tenant A's table not accessible to tenant B query

Acceptance criteria:
- [ ] `buildTableDescriptor()` exported
- [ ] Uses `pg_stat_user_tables.n_live_tup` for approximate record count
- [ ] Queries fields ordered by `sort_order`, includes cross-link definitions
- [ ] All queries are tenant-scoped via `getDbForTenant()` pattern
- [ ] Integration tests with factories
- [ ] `testTenantIsolation()` test
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

Do NOT build: Permission filtering (Unit 2), caching (Unit 2), lookup/rollup field resolution.

Commit with: `feat(ai): SDS table descriptor builder — buildTableDescriptor() with pg_stat row counts [Phase 3B-ii, Prompt 3]`
```

[CHECKPOINT]
```
Look for:
- table-builder.ts with buildTableDescriptor() function
- Uses pg_stat_user_tables (not COUNT(*))
- Integration tests with test factories
- Tenant isolation test present
- All tests passing
```

---

#### PROMPT 4: Workspace Descriptor Builder with Link Graph

**What This Builds:**
This is the top-level builder — it takes a workspace ID and produces the complete workspace descriptor that the AI will consume. It groups tables by their source platform (Airtable, Notion, SmartSuite, or native EveryStack tables), builds each table's descriptor, and then creates a "link graph" showing all cross-link relationships between tables. The link graph is deduplicated so each relationship appears only once, and each edge gets a human-readable label like "Deals → Primary Contact". This is the final piece of Unit 1 — after this, the system can produce a complete workspace snapshot.

**What You'll See When It's Done:**
Claude Code will create the workspace builder file and integration tests. Tests should verify multi-base workspaces, link graph deduplication, and native table handling.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 1, Prompt 4.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 4 (search for "## Prompt 4:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 79–193 (Output Schema — link_graph structure, deduplication)
- docs/reference/data-model.md lines 74–84 (base_connections, cross_links, cross_link_index)
- packages/shared/ai/schema-descriptor/types.ts (types from Prompt 1)
- packages/shared/ai/schema-descriptor/table-builder.ts (builder from Prompt 3)
- packages/shared/db/schema/workspaces.ts (workspace schema)
- packages/shared/db/schema/base-connections.ts (base connection schema)
- packages/shared/db/schema/tables.ts (table schema)
- packages/shared/db/schema/cross-links.ts (cross-link schema)
- packages/shared/db/schema/fields.ts (field schema)

Create `packages/shared/ai/schema-descriptor/workspace-builder.ts` exporting:

```typescript
buildWorkspaceDescriptor(
  workspaceId: string,
  tenantId: string,
  db: TenantDb
): Promise<WorkspaceDescriptor>
```

Implementation:
1. Query all `base_connections` belonging to the workspace's tables. Native tables (no base_connection) appear under a synthetic "Native" base grouping with `base_id: 'native'`, `name: 'Native Tables'`, `platform: 'everystack'`.
2. **Batch queries per base connection** — for each base connection, query all tables at once, then all fields for those tables in a single query. Do NOT issue a query per field or per table.
3. Build `TableDescriptor`s using `buildTableDescriptor()` for each table.
4. Scan all `cross_links` definitions across the workspace. Build the `link_graph` array:
   - Each link appears **once** (deduplicated). If `reverse_field_id` exists, only include the direction where `source_table_id < target_table_id` lexicographically.
   - Generate human-readable `label`: `"{SourceTable} → {TargetTable} via {FieldName}"`
   - `from`/`to` use dotted path format: `{base_id}.{table_id}.{field_id}`
5. Return assembled `WorkspaceDescriptor`

Write integration tests in `packages/shared/ai/schema-descriptor/__tests__/workspace-builder.test.ts`:
- Workspace with 2 base connections, linked tables, verifies full descriptor structure
- Link graph deduplication: symmetric cross-link produces exactly 1 edge
- Link graph labels are human-readable
- Native tables appear under synthetic "Native" base grouping
- Batched queries verified (mock DB to assert query count)
- Tenant isolation test

Update the barrel `packages/shared/ai/schema-descriptor/index.ts` to re-export all new functions.

Acceptance criteria:
- [ ] [CONTRACT] `buildWorkspaceDescriptor(workspaceId, tenantId, db)` returns `Promise<WorkspaceDescriptor>`
- [ ] [CONTRACT] `buildTableDescriptor(tableId, tenantId, db)` returns `Promise<TableDescriptor>`
- [ ] [CONTRACT] `mapFieldToDescriptor(field, crossLinkDef?)` returns `FieldDescriptor`
- [ ] [CONTRACT] All types exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] Batches queries per base connection
- [ ] `link_graph` has deduplicated edges with human-readable labels
- [ ] Native tables appear under synthetic "Native" base grouping
- [ ] All functions are tenant-scoped
- [ ] Integration tests cover multi-base + cross-link graph
- [ ] `testTenantIsolation()` for workspace descriptor
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files

Do NOT build: Permission filtering (Unit 2), caching (Unit 2), token budget estimation (Unit 2), DuckDB integration.

Commit with: `feat(ai): SDS workspace descriptor builder with deduplicated link graph [Phase 3B-ii, Prompt 4]`
```

[CHECKPOINT]
```
Look for:
- workspace-builder.ts with buildWorkspaceDescriptor() function
- Link graph with deduplicated edges
- Native tables under synthetic "Native" base
- Batched queries (not per-field)
- Integration tests passing
- Tenant isolation test present
```

[GIT COMMAND]
```
git add packages/shared/ai/schema-descriptor/
git commit -m "feat(ai): SDS Unit 1 — types, field mapper, table builder, workspace builder [Phase 3B-ii, Prompts 1-4]"
```

---

### VERIFY SESSION A — Unit 1, Prompts 1–4 — Completes Unit 1

**What This Step Does:**
This runs the full test suite against everything Unit 1 built. It also checks that Unit 1 produced everything it promised (its interface contract) — the five types and three builder functions.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-ii, Unit 1 (Prompts 1–4):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. Unit tests: pnpm turbo test
4. Integration tests (Docker required): pnpm turbo test
5. Coverage: pnpm turbo test -- --coverage — thresholds met

Interface contract verification (Unit 1):
- [ ] [CONTRACT] `WorkspaceDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `BaseDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `TableDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `FieldDescriptor` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `LinkEdge` type exported from `packages/shared/ai/schema-descriptor/types.ts`
- [ ] [CONTRACT] `mapFieldToDescriptor(field, crossLinkDef?)` exported from `field-mapper.ts`
- [ ] [CONTRACT] `buildTableDescriptor(tableId, tenantId, db)` exported from `table-builder.ts`
- [ ] [CONTRACT] `buildWorkspaceDescriptor(workspaceId, tenantId, db)` exported from `workspace-builder.ts`

Verify each contract item by checking the actual exports. Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 1–4, unit 1 complete [Phase 3B-ii, VP-1]"
git push origin build/3b-ii-sds-command-bar
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 1 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session A — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 1–4 (Unit 1: SDS Types & Core Builders)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- SchemaDescriptorService / SDS, WorkspaceDescriptor, BaseDescriptor, TableDescriptor, FieldDescriptor, LinkEdge
```

---

### ═══ UNIT 2: SDS Permission Filter, Caching & Service Facade ═══

**What This Unit Builds:**
This is the security and performance layer for the Schema Descriptor Service. It adds three critical capabilities: (1) a permission filter that removes fields, tables, and link graph edges the user isn't allowed to see — so the AI never discovers hidden data, (2) a 2-tier Redis cache that avoids rebuilding the workspace descriptor on every request, and (3) a token budget manager that progressively simplifies large workspace descriptors to fit within AI context limits. Finally, it wraps everything into a single `SchemaDescriptorService` class that is the one entry point all other features use.

**What Comes Out of It:**
When done, any feature can call `SchemaDescriptorService.describeWorkspace()` and get back a permission-filtered, potentially condensed, cached workspace descriptor for any user. This is the foundation for all AI features in Phases 4+.

**What It Needs from Prior Work:**
This unit uses all the types and builder functions from Unit 1 (the five descriptor types, the three builder functions). It also uses the existing permission resolution system from Phase 3A-iii.

---

### BUILD SESSION B — Unit 2, Prompts 5–8

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 2 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 5: Permission Filter for Descriptors

**What This Builds:**
This is the security boundary for the Schema Descriptor Service. It takes a full workspace descriptor and strips out everything the current user isn't allowed to see — hidden fields are removed, inaccessible tables are removed, and the link graph is pruned so edges pointing to hidden data disappear. There's also a tricky edge case: when a user can see a "linked record" field but can't access the table it links to, the field stays visible but its target is marked as "restricted" — so the AI knows a link exists without exposing the hidden table's details.

**What You'll See When It's Done:**
Claude Code will create a permission filter file and comprehensive tests covering Owner access (sees everything), restricted access (fields/tables removed), and the cross-link edge case. All tests should pass.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 2, Prompt 5.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 5 (search for "## Prompt 5:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 194–208 (Permissions Integration)
- docs/reference/permissions.md lines 90–179 (Table View–Based Access, Field-Level Permissions, Two-Layer Restriction Model)
- docs/reference/permissions.md lines 278–349 (Permission Resolution at Runtime)
- packages/shared/ai/schema-descriptor/types.ts (descriptor types from Unit 1)
- packages/shared/auth/permissions/types.ts (FieldPermissionState, ViewPermissions types)
- packages/shared/auth/permissions/resolve.ts (resolveAllFieldPermissions())
- apps/web/src/data/permissions.ts (getFieldPermissions(), Redis cache pattern reference)

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
1. **Deep-copy the input** — never mutate the cached unfiltered descriptor. Use `structuredClone()`.
2. Resolve the user's workspace role and Table View permissions using existing `resolveAllFieldPermissions()` and `getFieldPermissions()`.
3. For each base:
   - Remove tables the user has no access to
   - Within accessible tables, remove fields where permission state is `hidden`
   - Mark fields with `read_only` permission state (keep in descriptor for AI awareness)
4. Remove entire bases with zero remaining tables.
5. **Prune link_graph:** Remove any `LinkEdge` where either `from` or `to` field has been removed.
6. **Cross-link edge case:** When `linked_record` field is visible but target table is NOT accessible:
   - Keep the field, set `linked_table: null` and `cardinality: 'restricted'`
7. Return filtered descriptor.

Write tests in `packages/shared/ai/schema-descriptor/__tests__/permission-filter.test.ts`:
- Owner/Admin sees everything
- Team Member with partial access sees filtered set
- Hidden fields removed
- Link graph pruning when one side restricted
- Cross-link edge case: visible linked_record but restricted target
- Deep-copy verification: original descriptor not mutated
- Tenant isolation test

Acceptance criteria:
- [ ] `filterDescriptorByPermissions()` exported
- [ ] Deep-copies input (never mutates cached descriptor)
- [ ] Removes inaccessible bases, tables, hidden fields
- [ ] Prunes link_graph to edges where both sides accessible
- [ ] Cross-link edge case: `linked_table: null`, `cardinality: 'restricted'`
- [ ] Uses existing permission resolution
- [ ] Security tests: hidden fields never in filtered output
- [ ] Tenant isolation test
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: Write-path permission checks, portal client filtering, app designer permissions.

Commit with: `feat(ai): SDS permission filter — filterDescriptorByPermissions() with deep-copy safety [Phase 3B-ii, Prompt 5]`
```

[CHECKPOINT]
```
Look for:
- permission-filter.ts with filterDescriptorByPermissions()
- Uses structuredClone() to deep-copy
- Cross-link restricted edge case handled
- Security tests present
- All tests passing
```

---

#### PROMPT 6: Schema Version Hash & 2-Tier Cache

**What This Builds:**
This creates the caching layer that makes the Schema Descriptor Service fast. Instead of rebuilding the workspace descriptor from scratch every time, it stores the result in Redis with a smart key based on a hash of the actual schema (table/field/link definitions). When the schema changes, the hash changes, and the old cache automatically becomes irrelevant. There are two tiers: Tier 1 stores the raw unfiltered descriptor (shared by all users), and Tier 2 stores per-user permission-filtered variants. Events like "field created" or "permission changed" trigger targeted cache invalidation.

**What You'll See When It's Done:**
Claude Code will create a hash function file and a cache class file, plus tests. Tests should verify hash stability, cache hit/miss behavior, and invalidation.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 2, Prompt 6.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 6 (search for "## Prompt 6:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 224–237 (Caching Strategy)
- docs/reference/permissions.md lines 343–350 (Permission Caching Strategy — existing Redis pattern)
- packages/shared/ai/schema-descriptor/types.ts (descriptor types)
- packages/shared/ai/schema-descriptor/workspace-builder.ts (buildWorkspaceDescriptor)
- packages/shared/ai/schema-descriptor/permission-filter.ts (filterDescriptorByPermissions from Prompt 5)

**File 1:** Create `packages/shared/ai/schema-descriptor/schema-hash.ts` exporting:

```typescript
computeSchemaVersionHash(
  workspaceId: string,
  tenantId: string,
  db: TenantDb
): Promise<string>
```

Produces a stable SHA-256 hash from table definitions, field definitions, and cross-link definitions. Same schema → same hash. Use Node's `crypto.createHash('sha256')`.

**File 2:** Create `packages/shared/ai/schema-descriptor/cache.ts` exporting:

```typescript
class SchemaDescriptorCache {
  getWorkspaceDescriptor(workspaceId: string, userId: string, tenantId: string): Promise<WorkspaceDescriptor | null>
  invalidateWorkspace(workspaceId: string, tenantId: string): Promise<void>
  invalidateUser(workspaceId: string, userId: string, tenantId: string): Promise<void>
}
```

Implementation:
1. **Tier 1 (unfiltered):** Key: `cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}`. TTL: 300s. On miss → `buildWorkspaceDescriptor()` → store.
2. **Tier 2 (per-user):** Key: `cache:t:{tenantId}:sds:{workspaceId}:{userId}:{schemaHash}`. TTL: 300s. On miss → `filterDescriptorByPermissions()` on Tier 1 → store.
3. **Invalidation:**
   - `invalidateWorkspace()` — deletes all keys matching `cache:t:{tenantId}:sds:{workspaceId}:*`
   - `invalidateUser()` — deletes keys matching `cache:t:{tenantId}:sds:{workspaceId}:{userId}:*`
   - Subscribe to schema mutation events: `field_created`, `field_updated`, `field_deleted`, `table_created`, `table_deleted`, `link_created`, `link_deleted` → `invalidateWorkspace()`
   - Subscribe to `permission_updated` events → `invalidateUser()`

Write tests in `packages/shared/ai/schema-descriptor/__tests__/cache.test.ts`:
- Schema hash is stable (same inputs → same hash)
- Schema hash changes when field/table/link metadata changes
- Cache hit returns stored descriptor
- Cache miss triggers build + filter + store
- `invalidateWorkspace()` clears all tiers
- `invalidateUser()` clears only that user's Tier 2
- TTL is set to 300s

Acceptance criteria:
- [ ] `computeSchemaVersionHash()` exported, produces stable SHA-256
- [ ] `SchemaDescriptorCache` exported with all methods
- [ ] 2-tier caching with 300s TTL
- [ ] Event-driven invalidation
- [ ] Redis key format matches spec
- [ ] Tests verify cache hit/miss/invalidation
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: In-memory LRU cache, DuckDB cache layer.

Commit with: `feat(ai): SDS 2-tier cache with schema version hash and event-driven invalidation [Phase 3B-ii, Prompt 6]`
```

[CHECKPOINT]
```
Look for:
- schema-hash.ts with computeSchemaVersionHash()
- cache.ts with SchemaDescriptorCache class
- Redis key format: cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}
- 300s TTL
- All tests passing
```

---

#### PROMPT 7: Token Estimator & Progressive Condensation

**What This Builds:**
This creates the token budget manager for large workspaces. When a workspace has dozens of tables with hundreds of fields, the descriptor can get too large for the AI to consume efficiently. This function progressively simplifies the descriptor in three levels: first it removes field options lists, then it collapses tables with many fields to show only the important ones, and finally it strips everything down to just table names, counts, and the link graph. Each level tries to bring the token count under budget — it stops as soon as it succeeds.

**What You'll See When It's Done:**
Claude Code will create a token estimator file and tests that verify each condensation level triggers at the correct thresholds. All tests should pass.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 2, Prompt 7.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 7 (search for "## Prompt 7:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 79–193 (Output Schema — condensation levels)
- packages/shared/ai/schema-descriptor/types.ts (descriptor types — condensed flag, hidden_field_count)

Create `packages/shared/ai/schema-descriptor/token-estimator.ts` exporting:

```typescript
estimateTokens(descriptor: WorkspaceDescriptor): number
condenseDescriptor(descriptor: WorkspaceDescriptor, maxTokens: number): WorkspaceDescriptor
```

**`estimateTokens()`:** Serialize descriptor to JSON, divide character count by 4.

**`condenseDescriptor()`:** Returns a new WorkspaceDescriptor (deep-copy, never mutate). If under `maxTokens`: return as-is. Otherwise apply progressive condensation:

- **Level 1 (>2k tokens):** Remove field `options` arrays
- **Level 2 (>4k tokens):** For tables with >20 fields, collapse to show only `searchable`, `aggregatable`, and `linked_record` fields. Add `hidden_field_count`.
- **Level 3 (>8k tokens):** Show only table names, record counts, and link graph. Remove all field details. Set `condensed: true`.

Each level tries to bring token count under `maxTokens`. If a level succeeds, stop and return.

Write tests in `packages/shared/ai/schema-descriptor/__tests__/token-estimator.test.ts`:
- `estimateTokens()` returns reasonable estimate
- Under-budget descriptor returned unchanged
- Level 1 removes options arrays
- Level 2 collapses large tables, adds `hidden_field_count`
- Level 3 shows only table names + counts + link graph, sets `condensed: true`
- Each level applied incrementally
- Never mutates input

Acceptance criteria:
- [ ] `estimateTokens()` exported, estimates via JSON length / 4
- [ ] `condenseDescriptor()` exported, applies 3-level progressive condensation
- [ ] Each level at correct thresholds (2k, 4k, 8k)
- [ ] Deep-copy — never mutates input
- [ ] Tests verify each level
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: Actual tokenizer, semantic relevance ranking, DuckDB-aware condensation.

Commit with: `feat(ai): SDS token estimator with 3-level progressive condensation [Phase 3B-ii, Prompt 7]`
```

[CHECKPOINT]
```
Look for:
- token-estimator.ts with both functions
- Three condensation levels at correct thresholds
- Deep-copy (structuredClone or equivalent)
- All tests passing
```

---

#### PROMPT 8: SchemaDescriptorService Facade

**What This Builds:**
This is the final piece of the SDS — a single class that wraps all the building blocks (builders, permission filter, cache, token estimator) into three clean methods: `describeWorkspace()` (get the full workspace descriptor for a user), `describeTable()` (get a single table's descriptor), and `describeLinks()` (get just the link graph). Any feature that needs schema context for the AI calls this class — it handles caching, permission filtering, and condensation behind the scenes.

**What You'll See When It's Done:**
Claude Code will create the service class, update the barrel export, and write tests. Tests should verify cache hit/miss behavior and permission filtering through the facade.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 2, Prompt 8.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 8 (search for "## Prompt 8:")

Read these context files:
- docs/reference/schema-descriptor-service.md lines 209–223 (API Surface — three endpoints)
- packages/shared/ai/schema-descriptor/types.ts (types)
- packages/shared/ai/schema-descriptor/workspace-builder.ts (buildWorkspaceDescriptor)
- packages/shared/ai/schema-descriptor/table-builder.ts (buildTableDescriptor)
- packages/shared/ai/schema-descriptor/permission-filter.ts (filterDescriptorByPermissions)
- packages/shared/ai/schema-descriptor/cache.ts (SchemaDescriptorCache)
- packages/shared/ai/schema-descriptor/token-estimator.ts (estimateTokens, condenseDescriptor)

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
1. `describeWorkspace()`: Check cache → on hit return → on miss build→filter→cache→return
2. `describeTable()`: Build single table descriptor → apply permission filter → return null if no access
3. `describeLinks()`: Extract from workspace descriptor (leverage cache) → return filtered link_graph

Update barrel `packages/shared/ai/schema-descriptor/index.ts` to re-export `SchemaDescriptorService` and all new exports from this unit.

Write tests in `packages/shared/ai/schema-descriptor/__tests__/service.test.ts`:
- Cache miss → build → filter → cache hit on repeat
- Cache hit returns stored result
- `describeTable()` returns null for inaccessible table
- `describeTable()` returns filtered descriptor for accessible table
- `describeLinks()` returns filtered link graph only
- Tenant isolation

Acceptance criteria:
- [ ] [CONTRACT] `SchemaDescriptorService` class exported
- [ ] [CONTRACT] `describeWorkspace(workspaceId, userId, tenantId)` returns `Promise<WorkspaceDescriptor>`
- [ ] [CONTRACT] `describeTable(tableId, userId, tenantId)` returns `Promise<TableDescriptor | null>`
- [ ] [CONTRACT] `describeLinks(workspaceId, userId, tenantId)` returns `Promise<LinkEdge[]>`
- [ ] [CONTRACT] `filterDescriptorByPermissions()` exported
- [ ] [CONTRACT] `computeSchemaVersionHash()` exported
- [ ] [CONTRACT] `SchemaDescriptorCache` class exported
- [ ] [CONTRACT] `estimateTokens()` and `condenseDescriptor()` exported
- [ ] Uses cache, falls back to build→filter on miss
- [ ] `describeTable()` returns null for inaccessible table
- [ ] Barrel index.ts re-exports all unit exports
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: HTTP API routes, DuckDB integration, MCP server endpoints.

Commit with: `feat(ai): SchemaDescriptorService facade — describeWorkspace, describeTable, describeLinks [Phase 3B-ii, Prompt 8]`
```

[CHECKPOINT]
```
Look for:
- service.ts with SchemaDescriptorService class
- Three methods: describeWorkspace, describeTable, describeLinks
- Cache integration (hit/miss pattern)
- Updated barrel index.ts
- All tests passing
```

[GIT COMMAND]
```
git add packages/shared/ai/schema-descriptor/
git commit -m "feat(ai): SDS Unit 2 — permission filter, cache, token estimator, service facade [Phase 3B-ii, Prompts 5-8]"
```

---

### VERIFY SESSION B — Unit 2, Prompts 5–8 — Completes Unit 2

**What This Step Does:**
This runs the full test suite against the permission filter, caching, token management, and service facade. It also includes security verification — confirming that hidden fields never leak through the SDS.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-ii, Unit 2 (Prompts 5–8):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: `SchemaDescriptorService.describeWorkspace()` returns a permission-filtered `WorkspaceDescriptor` for a test user

Interface contract verification (Unit 2):
- [ ] [CONTRACT] `filterDescriptorByPermissions(descriptor, userId, tenantId, db)` exported from `permission-filter.ts`
- [ ] [CONTRACT] `computeSchemaVersionHash(workspaceId, tenantId, db)` exported from `schema-hash.ts`
- [ ] [CONTRACT] `SchemaDescriptorCache` class exported from `cache.ts` with `getWorkspaceDescriptor()`, `invalidateWorkspace()`, `invalidateUser()` methods
- [ ] [CONTRACT] `estimateTokens(descriptor)` exported from `token-estimator.ts`
- [ ] [CONTRACT] `condenseDescriptor(descriptor, maxTokens)` exported from `token-estimator.ts`
- [ ] [CONTRACT] `SchemaDescriptorService` class exported from `service.ts` with `describeWorkspace()`, `describeTable()`, `describeLinks()` methods

Security verification:
- [ ] Hidden fields do not appear in any filtered descriptor output
- [ ] Restricted cross-links handled correctly (`linked_table: null`, `cardinality: 'restricted'`)
- [ ] Tenant A's schema never leaks to Tenant B via SDS

Verify each contract and security item. Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
All security items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 5–8, unit 2 complete [Phase 3B-ii, VP-2]"
git push origin build/3b-ii-sds-command-bar
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 2 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session B — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 5–8 (Unit 2: SDS Permission Filter, Caching & Service Facade)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- SchemaDescriptorCache, computeSchemaVersionHash, filterDescriptorByPermissions, condenseDescriptor, estimateTokens
```

---

### ═══ UNIT 3: Command Bar Search & Navigation Data Layer ═══

**What This Unit Builds:**
This creates the server-side data access layer for the Command Bar — the functions that actually find records, tables, views, and commands when a user types into the `Cmd+K` bar. It includes: (1) a full-text record search using the existing search indexes, (2) a table/view navigation search filtered by user permissions, (3) a command registry that returns the available slash commands based on the user's role and current context, and (4) a recent items tracker that remembers what the user has accessed recently.

**What Comes Out of It:**
When done, the system can search records, find tables/views, list available commands, and track/retrieve recent items — all permission-filtered. The UI components in Unit 4 will consume these functions.

**What It Needs from Prior Work:**
Nothing from Units 1 or 2 — this unit runs in parallel. It uses existing database tables, search indexes (from Phase 2B), and permission utilities (from Phase 3A-iii).

---

### BUILD SESSION C — Unit 3, Prompts 9–11

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 3 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 9: Command Bar Types & Record Search Data Layer

**What This Builds:**
This creates the TypeScript types that all Command Bar features share — what a search result looks like, what a navigation result looks like, what a command entry looks like, what a recent item looks like. It also creates the record search function that uses PostgreSQL's full-text search (tsvector) to find records across all accessible tables by matching the user's query, ranked by relevance.

**What You'll See When It's Done:**
Claude Code will create a types file and a data access file with the search function, plus tests. Tests should demonstrate ranked search results filtered by permissions.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 3, Prompt 9.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 9 (search for "## Prompt 9:")

Read these context files:
- docs/reference/command-bar.md lines 10–38 (Unified Command Prompt — search channel routing)
- docs/reference/data-model.md lines 74–84 (records schema with tsvector)
- packages/shared/db/schema/records.ts (records table with search_vector)
- packages/shared/db/schema/tables.ts (tables schema)
- packages/shared/db/schema/fields.ts (fields schema)
- packages/shared/db/schema/views.ts (views schema with permissions JSONB)
- apps/web/src/data/permissions.ts (permission check patterns)

**File 1:** Create `apps/web/src/lib/command-bar/types.ts` with all types:
- `SearchResult` — record_id, table_id, table_name, primary_field_value, rank
- `NavigationResult` — entity_type ('table' | 'view'), entity_id, name, parent_name?, icon?
- `CommandEntry` — id, command_key, label, description, category, source, context_scopes, permission_required, sort_order
- `RecentItem` — item_type, item_id, display_name, entity_context?, accessed_at
- `RecentItemInput` — item_type, item_id, display_name, entity_context?
- `CommandBarSearchParams` — query, workspace_id, scope? ('global' | 'table'), current_table_id?, limit?

**File 2:** Create `apps/web/src/data/command-bar-search.ts` exporting:

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
2. Use PostgreSQL `ts_rank()` with `search_vector` and `plainto_tsquery()`
3. Filter to tables in the given workspace
4. If `opts.tableId` provided, filter to that table (scoped mode)
5. Permission-filter: only records from tables the user can access
6. Join with `fields` (where `is_primary = true`) for primary field display value
7. Join with `tables` for table name
8. Order by `ts_rank` descending, limit to `opts.limit ?? 20`
9. Exclude soft-deleted records (`deleted_at IS NULL`)

Write tests in `apps/web/src/data/__tests__/command-bar-search.test.ts`:
- Returns ranked search results matching query
- Scoped search filters to specific table
- Permission filtering: user only sees records from accessible tables
- Soft-deleted records excluded
- Tenant isolation test

Acceptance criteria:
- [ ] All types exported from `apps/web/src/lib/command-bar/types.ts`
- [ ] `searchRecords()` exported from `apps/web/src/data/command-bar-search.ts`
- [ ] Uses tsvector with `ts_rank()` for relevance ranking
- [ ] Permission-filtered, tenant-scoped
- [ ] Scoped mode filters to specific table
- [ ] Soft-deleted records excluded
- [ ] `testTenantIsolation()` for `searchRecords()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: AI search (Unit 4), semantic/vector search, Command Bar UI, recent items boosting (Prompt 11).

Commit with: `feat(command-bar): search types and record search via tsvector [Phase 3B-ii, Prompt 9]`
```

[CHECKPOINT]
```
Look for:
- types.ts with all 6 type definitions
- command-bar-search.ts with searchRecords()
- Uses ts_rank() and plainto_tsquery()
- Permission filtering in place
- Tenant isolation test
- All tests passing
```

---

#### PROMPT 10: Table/View Navigation & Command Registry Data Layer

**What This Builds:**
This creates two more data access functions: (1) a table/view navigation search that fuzzy-matches table and view names the user can access, and (2) a command registry that returns the available slash commands (like `/new record`, `/goto`, `/settings`) filtered by the user's role and what screen they're on. It also creates a test factory for command entries.

**What You'll See When It's Done:**
Claude Code will add to the existing search file, create a command registry file, and create a test factory. Tests should show filtered navigation results and role-filtered commands.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 3, Prompt 10.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 10 (search for "## Prompt 10:")

Read these context files:
- docs/reference/command-bar.md lines 90–130 (Command Registry schema, Slash Command Catalog)
- docs/reference/permissions.md lines 90–122 (Table View–Based Access — sidebar experience by role)
- apps/web/src/lib/command-bar/types.ts (types from Prompt 9)
- apps/web/src/data/command-bar-search.ts (existing file from Prompt 9)
- packages/shared/db/schema/tables.ts (tables schema)
- packages/shared/db/schema/views.ts (views schema with permissions)
- apps/web/src/data/permissions.ts (permission check patterns)
- packages/shared/testing/factories/index.ts (factory pattern reference)

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
1. Query `tables` in workspace, fuzzy-match by name using `ILIKE` (parameterized)
2. Query `views` for those tables, fuzzy-match by name
3. Filter by user's role and Table View assignments:
   - Owner/Admin: see all
   - Manager: permitted tables + their views
   - Team Member/Viewer: only assigned Shared Views
4. Return as `NavigationResult[]`

**File 2:** Create `apps/web/src/data/command-registry.ts` exporting:

```typescript
getCommandRegistry(
  tenantId: string,
  userId: string,
  context: { scope: string; tableId?: string }
): Promise<CommandEntry[]>
```

Implementation:
1. Define MVP system commands as constant array matching Slash Command Catalog from `command-bar.md` lines 110–130. All have `tenant_id: null`, `source: 'system'`.
2. Filter by `context_scopes` — only commands valid for current context
3. Filter by `permission_required` — check user's workspace role
4. Sort by `sort_order`

**File 3:** Create `packages/shared/testing/factories/command-registry.ts` with `createTestCommandRegistryEntry()` factory.

Write tests in `apps/web/src/data/__tests__/command-registry.test.ts`:
- Returns system commands filtered by context scope
- Permission filtering: Viewer doesn't see Manager+ commands
- Factory produces valid entries
- `searchTablesAndViews()` returns filtered navigation results
- Tenant isolation for navigation search

Acceptance criteria:
- [ ] `searchTablesAndViews()` exported, filtered by role and Table View assignments
- [ ] `getCommandRegistry()` exported, filtered by role and context scope
- [ ] MVP slash commands hardcoded per spec
- [ ] `createTestCommandRegistryEntry()` factory exported
- [ ] Tenant isolation tests
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: Custom workspace slash commands, automation-registered commands, Command Bar Setup Modal, Guide Mode.

Commit with: `feat(command-bar): table/view navigation search and command registry with permission filtering [Phase 3B-ii, Prompt 10]`
```

[CHECKPOINT]
```
Look for:
- searchTablesAndViews() added to command-bar-search.ts
- command-registry.ts with getCommandRegistry()
- Factory file created
- MVP slash commands defined as constant array
- Permission filtering on both functions
- All tests passing
```

---

#### PROMPT 11: Recent Items Tracking

**What This Builds:**
This creates the recent items system — when a user opens a record, navigates to a table, or executes a command, the system remembers it. When they open the Command Bar with an empty search, they see their most recently accessed items. The tracking uses an upsert pattern (if you visit the same record twice, it just updates the timestamp) and caps at 100 items per user. The retrieval function also filters out items the user can no longer access (e.g., if permissions changed since they last visited).

**What You'll See When It's Done:**
Claude Code will create a recent items data access file with track and retrieve functions, plus tests. Tests should verify upsert behavior, the 100-item cap, and access filtering.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 3, Prompt 11.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 11 (search for "## Prompt 11:")

Read these context files:
- docs/reference/data-model.md lines 122–130 (user_recent_items schema)
- apps/web/src/lib/command-bar/types.ts (RecentItem, RecentItemInput types)
- packages/shared/db/schema/user-recent-items.ts (recent items table schema)

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
1. Upsert into `user_recent_items` — use unique index `(user_id, item_type, item_id)` for conflict detection
2. On conflict: update `accessed_at` to current timestamp
3. After upsert, delete oldest entries beyond 100 items per user per tenant

**`getRecentItems()`:**
1. Query `user_recent_items` for user+tenant, ordered by `accessed_at DESC`
2. Limit to `limit ?? 20`
3. Filter to accessible entities — join with tables and views to verify access
4. Enrich with display name by joining with entity table
5. Return as `RecentItem[]`

Write tests in `apps/web/src/data/__tests__/recent-items.test.ts`:
- `trackRecentItem()` inserts new item
- `trackRecentItem()` upserts (updates `accessed_at` on duplicate)
- `getRecentItems()` returns items sorted by `accessed_at` DESC
- Cap: items beyond 100 per user are deleted
- Access filtering: deleted entities not returned
- Tenant isolation test

Acceptance criteria:
- [ ] [CONTRACT] `trackRecentItem(userId, tenantId, item)` exported
- [ ] [CONTRACT] `getRecentItems(userId, tenantId, limit?)` exported
- [ ] [CONTRACT] `searchRecords()` exported from `command-bar-search.ts`
- [ ] [CONTRACT] `searchTablesAndViews()` exported from `command-bar-search.ts`
- [ ] [CONTRACT] `getCommandRegistry()` exported from `command-registry.ts`
- [ ] [CONTRACT] `createTestCommandRegistryEntry()` factory exported
- [ ] [CONTRACT] All Command Bar types exported from `types.ts`
- [ ] Upsert dedup on `(user_id, item_type, item_id)`
- [ ] Recent items capped at 100
- [ ] Access filtering
- [ ] `testTenantIsolation()` for `getRecentItems()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: Private Personal Tasks, Command Bar analytics, real-time recent items sync.

Commit with: `feat(command-bar): recent items tracking with upsert dedup and access filtering [Phase 3B-ii, Prompt 11]`
```

[CHECKPOINT]
```
Look for:
- recent-items.ts with trackRecentItem() and getRecentItems()
- Upsert pattern with conflict handling
- 100-item cap enforcement
- Access filtering on retrieval
- Tenant isolation test
- All tests passing
```

[GIT COMMAND]
```
git add apps/web/src/lib/command-bar/ apps/web/src/data/command-bar-search.ts apps/web/src/data/command-registry.ts apps/web/src/data/recent-items.ts apps/web/src/data/__tests__/ packages/shared/testing/factories/command-registry.ts
git commit -m "feat(command-bar): Unit 3 — search, navigation, command registry, recent items [Phase 3B-ii, Prompts 9-11]"
```

---

### VERIFY SESSION C — Unit 3, Prompts 9–11 — Completes Unit 3

**What This Step Does:**
This runs the full test suite against all Command Bar data layer functions and checks that Unit 3 produced everything it promised.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-ii, Unit 3 (Prompts 9–11):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: `searchRecords()` returns ranked results against test data

Interface contract verification (Unit 3):
- [ ] [CONTRACT] `SearchResult`, `NavigationResult`, `CommandEntry`, `RecentItem`, `CommandBarSearchParams` types from `apps/web/src/lib/command-bar/types.ts`
- [ ] [CONTRACT] `searchRecords(tenantId, workspaceId, query, opts?)` from `apps/web/src/data/command-bar-search.ts`
- [ ] [CONTRACT] `searchTablesAndViews(tenantId, workspaceId, query, userId)` from `apps/web/src/data/command-bar-search.ts`
- [ ] [CONTRACT] `getCommandRegistry(tenantId, userId, context)` from `apps/web/src/data/command-registry.ts`
- [ ] [CONTRACT] `trackRecentItem(userId, tenantId, item)` from `apps/web/src/data/recent-items.ts`
- [ ] [CONTRACT] `getRecentItems(userId, tenantId, limit?)` from `apps/web/src/data/recent-items.ts`
- [ ] [CONTRACT] `createTestCommandRegistryEntry()` factory from `packages/shared/testing/factories/`

Verify each contract item by checking the actual exports. Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 9–11, unit 3 complete [Phase 3B-ii, VP-3]"
git push origin build/3b-ii-sds-command-bar
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 3 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session C — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 9–11 (Unit 3: Command Bar Search & Navigation Data Layer)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- CommandBarSearchParams, CommandEntry, command_key, context_scopes
```

---

### ═══ UNIT 4: Command Bar UI & AI Search Channel ═══

**What This Unit Builds:**
This is the user-facing Command Bar — the `Cmd+K` modal that lets users search records, navigate to tables/views, execute slash commands, and ask natural language questions powered by AI. It's built on the shadcn/ui Command component (cmdk library) which gives you keyboard navigation out of the box. The AI channel sends the user's question along with a permission-filtered workspace descriptor (from Unit 2's SDS) to the AI, which understands the data structure and can give contextual answers. It also tracks recently accessed items and shows them when you open the Command Bar with an empty search.

**What Comes Out of It:**
When done, users can press `Cmd+K` to open the Command Bar, type to search records and tables, type `/` to see slash commands, ask questions to get AI-powered answers, and see their recent items. `Cmd+F` opens it in scoped mode pre-filtered to the current table.

**What It Needs from Prior Work:**
This unit needs both Unit 2 (SDS — for providing schema context to the AI channel) and Unit 3 (data layer — for the search, navigation, command, and recent items functions) to be complete.

---

### BUILD SESSION D — Unit 4, Prompts 12–13

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 4 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 12: CommandBar Shell, Provider & Keyboard Shortcuts

**What This Builds:**
This creates the Command Bar's outer shell — the modal component that appears when you press `Cmd+K`, the React context provider that manages state (is the bar open? what mode? what's the current query?), and the keyboard shortcuts that open/close it. It includes intent routing logic that automatically detects what the user wants based on their input: typing `/` shows slash commands, typing a question triggers AI, and plain text triggers search.

**What You'll See When It's Done:**
Claude Code will create a provider component, the main Command Bar shell component, and tests. The Command Bar won't show search results yet (that's Prompt 13) but should open/close on keyboard shortcuts and route intent correctly.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 4, Prompt 12.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 12 (search for "## Prompt 12:")

Read these context files:
- docs/reference/command-bar.md lines 10–38 (Unified Command Prompt — layout, intent routing)
- docs/reference/command-bar.md lines 156–163 (Keyboard Shortcuts)
- docs/reference/design-system.md (shadcn/ui component conventions — skim for Command/Dialog patterns)
- apps/web/src/lib/command-bar/types.ts (Command Bar types from Unit 3)

**File 1:** Create `apps/web/src/components/command-bar/command-bar-provider.tsx`:

Create the Command Bar context provider:
- State: `isOpen`, `mode` ('global' | 'scoped'), `scopedTableId?`, `query`, `activeChannel` ('search' | 'slash' | 'ai' | null)
- Methods: `open(mode?, tableId?)`, `close()`, `setQuery(query)`
- `activeChannel` derived from query: starts with `/` → 'slash', contains `?` or NL patterns → 'ai', otherwise → 'search'
- Export `CommandBarProvider` and `useCommandBar()` hook

**File 2:** Create `apps/web/src/components/command-bar/command-bar.tsx`:

Build the main Command Bar modal:
1. Built on shadcn/ui `Command` component (cmdk). Use `CommandDialog` (modal overlay).
2. Never unmounts — toggles visibility via `isOpen`
3. **Keyboard shortcuts** — register globally:
   - `Cmd+K` / `Ctrl+K` → open global mode
   - `Cmd+F` / `Ctrl+F` → open scoped mode (pre-filters to current table if in table context; falls back to global)
   - `Escape` → close
4. Single text input at top. Placeholder: "Ask or do anything..."
5. Intent routing renders appropriate channel based on `activeChannel`
6. Empty state: show placeholder for recent items (implemented in Prompt 15)

Wrap the provider around the application shell layout in the appropriate root layout file.

Write tests in `apps/web/src/components/command-bar/__tests__/command-bar.test.tsx`:
- Renders without error
- Opens on Cmd+K, closes on Escape
- Scoped mode sets scopedTableId
- Intent routing: `/` triggers slash, `?` triggers AI, plain text triggers search
- Provider values accessible via `useCommandBar()`

Acceptance criteria:
- [ ] `CommandBarProvider` and `useCommandBar()` exported
- [ ] `CommandBar` component exported
- [ ] Opens on Cmd+K / Ctrl+K, closes on Escape
- [ ] Cmd+F / Ctrl+F opens in scoped mode
- [ ] Persists in shell (never unmounts)
- [ ] Intent routing: `/` → slash, question → AI, plain text → search
- [ ] Built on shadcn/ui Command (cmdk)
- [ ] Component tests pass
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Guide Mode, notification bell, compact toolbar layout, AI prompt template saving.

Commit with: `feat(command-bar): shell component, provider context, and keyboard shortcuts (Cmd+K, Cmd+F) [Phase 3B-ii, Prompt 12]`
```

[CHECKPOINT]
```
Look for:
- command-bar-provider.tsx with CommandBarProvider and useCommandBar()
- command-bar.tsx with CommandBar component
- Provider wrapped in app shell layout
- Keyboard shortcuts registered
- Intent routing logic
- Component tests passing
```

---

#### PROMPT 13: Search Results, Navigation & Slash Command Channels

**What This Builds:**
This creates the visual display for three of the four search channels: (1) record search results grouped with table name badges and primary field values, (2) table/view navigation results with entity type icons, and (3) slash command dropdown with commands grouped by category, fuzzy-filtered by query, and permission-filtered by role. Both search and navigation use a 200ms debounce to avoid excessive queries. Keyboard arrow keys move through results, Enter selects.

**What You'll See When It's Done:**
Claude Code will create search results and slash menu components with tests. You should be able to type in the Command Bar and see grouped results, or type `/` and see filtered slash commands.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 4, Prompt 13.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 13 (search for "## Prompt 13:")

Read these context files:
- docs/reference/command-bar.md lines 10–38 (Unified Command Prompt — channel routing)
- docs/reference/command-bar.md lines 110–130 (Slash Command Catalog)
- apps/web/src/components/command-bar/command-bar.tsx (shell from Prompt 12)
- apps/web/src/components/command-bar/command-bar-provider.tsx (provider from Prompt 12)
- apps/web/src/data/command-bar-search.ts (searchRecords, searchTablesAndViews from Unit 3)
- apps/web/src/data/command-registry.ts (getCommandRegistry from Unit 3)
- apps/web/src/lib/command-bar/types.ts (types)

**File 1:** Create `apps/web/src/components/command-bar/search-results.tsx`:

```typescript
export function CommandBarSearchResults({ query, scopedTableId }: Props)
```

Implementation:
1. Fetch from `searchRecords()` and `searchTablesAndViews()` via Server Actions or hooks
2. **200ms debounce** before firing search
3. Group results: Records section (table name badge, primary field value), Tables & Views section (entity type icon)
4. Keyboard navigation: arrow keys, Enter navigates
5. Record selection → navigate to Record View overlay
6. Table/view selection → navigate to that table/view

**File 2:** Create `apps/web/src/components/command-bar/slash-menu.tsx`:

```typescript
export function CommandBarSlashMenu({ query }: Props)
```

Implementation:
1. Fetch from `getCommandRegistry()` passing current context
2. Fuzzy filter by query (strip leading `/`)
3. Group by category
4. Show label, description, keyboard shortcut hint
5. On selection: simple command → execute inline; complex → open modal/wizard
6. Permission-filtered

Write tests:
- Search results render grouped by category
- Debounce prevents excessive queries
- Slash menu shows permission-filtered commands
- Slash menu fuzzy filters on query
- Keyboard navigation works

Acceptance criteria:
- [ ] `CommandBarSearchResults` exported with grouped results
- [ ] `CommandBarSlashMenu` exported with fuzzy-filtered commands
- [ ] Results grouped by category
- [ ] 200ms debounce on search input
- [ ] Keyboard navigation
- [ ] Commands filtered by role and context
- [ ] Component tests pass
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: AI results rendering (Prompt 14), command execution handlers (Prompt 14), custom commands, Command Bar Setup Modal.

Commit with: `feat(command-bar): search results, navigation, and slash command channels [Phase 3B-ii, Prompt 13]`
```

[CHECKPOINT]
```
Look for:
- search-results.tsx with CommandBarSearchResults
- slash-menu.tsx with CommandBarSlashMenu
- 200ms debounce on search
- Grouped results by category
- Permission filtering on slash commands
- Component tests passing
```

[GIT COMMAND]
```
git add apps/web/src/components/command-bar/
git commit -m "feat(command-bar): shell, search results, navigation, slash commands [Phase 3B-ii, Prompts 12-13]"
```

---

### BUILD SESSION E — Unit 4, Prompts 14–15

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 14: AI Search Channel & Server Actions

**What This Builds:**
This creates the AI-powered search channel — the fourth and most advanced channel in the Command Bar. When a user asks a natural language question like "show me all deals over $50k" or "which contacts haven't been updated this month?", this sends the query along with a condensed, permission-filtered snapshot of the workspace schema to the AI (using the Schema Descriptor Service from Unit 2). The AI understands the data structure and returns relevant answers. It also creates the server action for executing slash commands. Importantly, read-only results display immediately, but any action the AI suggests (like creating or modifying data) requires explicit user confirmation — the AI never takes action without a click.

**What You'll See When It's Done:**
Claude Code will create the AI channel component and two server actions (aiSearchQuery, executeSlashCommand), plus tests. The AI channel should show loading states and action confirmation UI.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 4, Prompt 14.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 14 (search for "## Prompt 14:")

Read these context files:
- docs/reference/command-bar.md lines 10–38 (Unified Command Prompt — permission-scoped AI, confirmation architecture)
- docs/reference/schema-descriptor-service.md lines 209–223 (API Surface — SDS endpoint signatures)
- docs/reference/ai-architecture.md lines 94–143 (Capability-Based Model Routing)
- packages/shared/ai/schema-descriptor/service.ts (SchemaDescriptorService from Unit 2)
- packages/shared/ai/schema-descriptor/token-estimator.ts (estimateTokens, condenseDescriptor)
- packages/shared/ai/service.ts (AIService class)
- packages/shared/ai/types.ts (AI type definitions)
- apps/web/src/components/command-bar/command-bar-provider.tsx (provider)
- apps/web/src/data/command-registry.ts (getCommandRegistry)

**File 1:** Create `apps/web/src/actions/command-bar.ts`:

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
1. Get permission-filtered schema: `SchemaDescriptorService.describeWorkspace()`
2. Condense for AI context: `condenseDescriptor(descriptor, 2000)`
3. Call `AIService.getInstance().execute()` with feature `'command_bar'`, `fast` capability tier
4. Parse AI response — extract intent and structured result
5. Return `AISearchResult`

**`executeSlashCommand()`:**
1. Look up command from registry
2. Validate user's permission
3. Route to correct handler based on `command_key`
4. Return `CommandResult` with success/failure and navigation target

**File 2:** Create `apps/web/src/components/command-bar/ai-channel.tsx`:

```typescript
export function CommandBarAIChannel({ query }: Props)
```

Implementation:
1. Show loading state when AI channel triggered
2. Call `aiSearchQuery()` with 500ms debounce (longer than search)
3. **Read results** display immediately
4. **Action suggestions** show preview card with Confirm/Cancel — never execute without confirmation
5. Show estimated credit cost before AI call fires
6. Handle errors: show "AI is unavailable", don't break Command Bar

Write tests:
- AI channel renders loading state
- Action suggestions show confirmation UI
- Read results display immediately
- `executeSlashCommand()` validates permissions
- `aiSearchQuery()` uses SDS for context

Acceptance criteria:
- [ ] `aiSearchQuery()` server action exported
- [ ] `executeSlashCommand()` server action exported
- [ ] `CommandBarAIChannel` exported
- [ ] AI search sends condensed WorkspaceDescriptor with `fast` tier
- [ ] Action confirmation UI: read results immediate, actions require Confirm/Cancel
- [ ] Credit cost shown before AI execution
- [ ] `executeSlashCommand()` routes by command_key, validates permissions
- [ ] Component tests pass
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: Guide Mode, streaming AI responses, AI prompt template learning, DuckDB query execution.

Commit with: `feat(command-bar): AI natural language search channel with SDS context and slash command execution [Phase 3B-ii, Prompt 14]`
```

[CHECKPOINT]
```
Look for:
- actions/command-bar.ts with aiSearchQuery() and executeSlashCommand()
- ai-channel.tsx with CommandBarAIChannel
- Uses SchemaDescriptorService for AI context
- Uses `fast` capability tier (not a model name)
- Action confirmation UI (Confirm/Cancel)
- Credit cost shown
- All tests passing
```

---

#### PROMPT 15: Recent Items Display, Scoped Mode & Analytics

**What This Builds:**
This is the finishing touch for the Command Bar — three integration features: (1) when you open the Command Bar with an empty search, you see your 10 most recent items (records, tables, views you've accessed), and these get boosted when you start typing; (2) scoped mode refinement where `Cmd+F` shows a visual badge with the table name and pre-filters all results to that table; and (3) session analytics that record what you searched for and what you selected (for future improvements). It also wires up `trackRecentItem()` so every selection in the Command Bar is remembered for next time.

**What You'll See When It's Done:**
Claude Code will create the recent items component and update existing components with integration points. The Command Bar should show recent items on empty input, track selections, and display a scope badge in scoped mode.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3B-ii, Unit 4, Prompt 15.

Read the playbook section:
- docs/Playbooks/playbook-phase-3b-ii.md — Prompt 15 (search for "## Prompt 15:")

Read these context files:
- docs/reference/command-bar.md lines 10–38 (Unified Command Prompt)
- apps/web/src/components/command-bar/command-bar.tsx (shell from Prompt 12)
- apps/web/src/components/command-bar/search-results.tsx (from Prompt 13)
- apps/web/src/components/command-bar/command-bar-provider.tsx (provider)
- apps/web/src/data/recent-items.ts (trackRecentItem, getRecentItems from Unit 3)
- packages/shared/db/schema/command-bar-sessions.ts (analytics table)

**File 1:** Create `apps/web/src/components/command-bar/recent-items.tsx`:

```typescript
export function CommandBarRecentItems()
```

Implementation:
1. Show recent items when Command Bar opens with empty input
2. Fetch from `getRecentItems()` — display 10 most recent
3. Each item: icon (based on item_type), display name, entity context
4. Boost recent items in search results (prepend matching recent items above search results)
5. Keyboard navigation through recent items

**File 2:** Integration updates to `command-bar.tsx` and `search-results.tsx`:

1. **Empty input:** Render `CommandBarRecentItems` instead of search results
2. **Track selections:** Call `trackRecentItem()` on every item selection (record, table, view, command)
3. **Scoped mode:** When `mode === 'scoped'` and `scopedTableId` set:
   - Show visual badge with table name (e.g., "[Deals] ")
   - Filter search results to that table only
   - Slash commands scoped to `table_view` context
4. **Session analytics:** Write to `command_bar_sessions` on open/close:
   - On open: create session row with context
   - On close: update with messages and result_set

Write tests:
- Recent items shown on empty input
- Recent items boosted in search results
- `trackRecentItem()` called on item selection
- Scoped mode shows table badge and filters results
- Session analytics written on open/close

Acceptance criteria:
- [ ] [CONTRACT] `CommandBar` component exported
- [ ] [CONTRACT] `CommandBarProvider` and `useCommandBar()` exported
- [ ] [CONTRACT] `CommandBarSearchResults` exported
- [ ] [CONTRACT] `CommandBarSlashMenu` exported
- [ ] [CONTRACT] `CommandBarAIChannel` exported
- [ ] [CONTRACT] `CommandBarRecentItems` exported
- [ ] [CONTRACT] `executeSlashCommand()` server action exported
- [ ] [CONTRACT] `aiSearchQuery()` server action exported
- [ ] Recent items shown on empty input
- [ ] Recent items boosted in search results
- [ ] `trackRecentItem()` called on every selection
- [ ] Scoped mode (Cmd+F) pre-filters with visual badge
- [ ] Session analytics written to `command_bar_sessions`
- [ ] Component tests pass
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80%

Do NOT build: Command Bar Setup Modal, notification bell, Private Personal Tasks, cross-device recent items sync.

Commit with: `feat(command-bar): recent items display, scoped mode integration, and session analytics [Phase 3B-ii, Prompt 15]`
```

[CHECKPOINT]
```
Look for:
- recent-items.tsx with CommandBarRecentItems
- Recent items on empty input
- trackRecentItem() wired to selections
- Scoped mode badge and filtering
- Session analytics writes
- All tests passing
```

[GIT COMMAND]
```
git add apps/web/src/components/command-bar/ apps/web/src/actions/command-bar.ts
git commit -m "feat(command-bar): Unit 4 — AI channel, recent items, scoped mode, analytics [Phase 3B-ii, Prompts 14-15]"
```

---

### VERIFY SESSION D — Unit 4, Prompts 12–15 — Completes Unit 4

**What This Step Does:**
This runs the full test suite against the entire Command Bar — all four search channels, SDS integration, keyboard shortcuts, scoped mode, recent items, and analytics. It also verifies cross-unit integration: that the AI channel correctly uses SDS from Unit 2, and that all search/command/recent-items functions from Unit 3 are properly consumed.

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3B-ii, Unit 4 (Prompts 12–15):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings (UI text through i18n)
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met
6. Manual verification:
   - Cmd+K opens Command Bar, typing shows search results
   - `/` triggers slash command dropdown
   - Question mark query triggers AI channel
   - Cmd+F opens in scoped mode
   - Recent items show on empty input
   - Selecting an item calls trackRecentItem()

Interface contract verification (Unit 4):
- [ ] [CONTRACT] `CommandBar` component from `command-bar.tsx`
- [ ] [CONTRACT] `CommandBarProvider` from `command-bar-provider.tsx`
- [ ] [CONTRACT] `useCommandBar()` hook from `command-bar-provider.tsx`
- [ ] [CONTRACT] `CommandBarSearchResults` from `search-results.tsx`
- [ ] [CONTRACT] `CommandBarSlashMenu` from `slash-menu.tsx`
- [ ] [CONTRACT] `CommandBarAIChannel` from `ai-channel.tsx`
- [ ] [CONTRACT] `CommandBarRecentItems` from `recent-items.tsx`
- [ ] [CONTRACT] `executeSlashCommand()` from `apps/web/src/actions/command-bar.ts`
- [ ] [CONTRACT] `aiSearchQuery()` from `apps/web/src/actions/command-bar.ts`

Cross-unit integration check:
- [ ] AI channel uses SDS (Unit 2) for permission-filtered schema context
- [ ] Search results use searchRecords() and searchTablesAndViews() (Unit 3)
- [ ] Slash menu uses getCommandRegistry() (Unit 3)
- [ ] Recent items use trackRecentItem() and getRecentItems() (Unit 3)
- [ ] Permission consistency: fields hidden in SDS also invisible in search results

Verify each contract and integration item. Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
All cross-unit integration items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 12–15, unit 4 complete [Phase 3B-ii, VP-4]"
git push origin build/3b-ii-sds-command-bar
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 4 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session D/E — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 12–15 (Unit 4: Command Bar UI & AI Search Channel)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- CommandBar, CommandBarProvider, useCommandBar, activeChannel, intent routing, scoped mode
```

---

### FINAL — Open Pull Request

[GIT COMMAND]
```
git push origin build/3b-ii-sds-command-bar
```

Open PR titled: **"[Step 3] Phase 3B-ii — Schema Descriptor Service & Command Bar"**

List all units completed and their deliverables:
- **Unit 1:** SDS Types & Core Builders — WorkspaceDescriptor types, field mapper, table builder, workspace builder with deduplicated link graph
- **Unit 2:** SDS Permission Filter, Caching & Service Facade — Permission filter with deep-copy safety, 2-tier Redis cache with event-driven invalidation, token estimator with 3-level progressive condensation, SchemaDescriptorService facade
- **Unit 3:** Command Bar Search & Navigation Data Layer — Record search via tsvector, table/view navigation, command registry, recent items tracking
- **Unit 4:** Command Bar UI & AI Search Channel — Cmd+K modal, 4 search channels (record, navigation, slash, AI), scoped mode (Cmd+F), recent items display, session analytics

[DECISION POINT]
```
If PR looks good: → Merge (squash). Delete branch. Proceed to Step 4.
If something wrong: → Do NOT merge. Paste fix instructions into Claude Code.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does
An independent Claude session reviews the build against acceptance criteria and verifies that every unit's interface contract was fulfilled.

### 4.1 — Generate the build diff

[GIT COMMAND]
```
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-3b-ii-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open NEW Claude.ai session. Upload: `playbook-phase-3b-ii.md`, `3b-ii-subdivision.md`, the diff file, `CLAUDE.md`, `GLOSSARY.md`.

[PASTE INTO CLAUDE]
```
You are the Reviewer Agent for EveryStack Phase 3B-ii (Schema Descriptor Service & Command Bar).

Your task: Review the build diff against the playbook's acceptance criteria and the subdivision doc's interface contracts. Produce a structured verdict.

## Review Checklist

Covers Unit 1: SDS Types & Core Builders, Unit 2: SDS Permission Filter, Caching & Service Facade, Unit 3: Command Bar Search & Navigation Data Layer, Unit 4: Command Bar UI & AI Search Channel, Cross-Cutting.

### Unit 1: SDS Types & Core Builders
- [ ] All 5 types exported with JSDoc
- [ ] mapFieldToDescriptor() maps all MVP field types correctly
- [ ] buildTableDescriptor() uses pg_stat_user_tables (not COUNT(*))
- [ ] buildWorkspaceDescriptor() batches queries, deduplicates link graph
- [ ] All functions tenant-scoped
- [ ] Tenant isolation tests present

### Unit 2: SDS Permission Filter, Caching & Service Facade
- [ ] filterDescriptorByPermissions() deep-copies input, removes hidden fields
- [ ] Cross-link restricted edge case handled (linked_table: null, cardinality: 'restricted')
- [ ] computeSchemaVersionHash() produces stable SHA-256
- [ ] SchemaDescriptorCache implements 2-tier caching with 300s TTL
- [ ] estimateTokens() and condenseDescriptor() with 3 levels
- [ ] SchemaDescriptorService facade with 3 methods
- [ ] Security: hidden fields never appear in filtered output
- [ ] Tenant isolation tests present

### Unit 3: Command Bar Search & Navigation Data Layer
- [ ] searchRecords() uses tsvector with ts_rank()
- [ ] searchTablesAndViews() permission-filtered by role
- [ ] getCommandRegistry() filtered by role and context scope
- [ ] trackRecentItem() upsert with 100-item cap
- [ ] getRecentItems() with access filtering
- [ ] Tenant isolation tests present

### Unit 4: Command Bar UI & AI Search Channel
- [ ] CommandBar opens on Cmd+K, closes on Escape
- [ ] Intent routing: / → slash, question → AI, plain text → search
- [ ] Cmd+F opens scoped mode
- [ ] AI channel sends condensed WorkspaceDescriptor with fast tier
- [ ] Action confirmation UI (read results immediate, actions require Confirm)
- [ ] Recent items on empty input, boosted in search
- [ ] trackRecentItem() called on selections
- [ ] Session analytics written

### Cross-Cutting
- [ ] No switch statements on field types
- [ ] No raw SQL outside migrations
- [ ] No hardcoded English strings (i18n)
- [ ] No console.log (Pino logger)
- [ ] No any types
- [ ] All AI uses capability tiers, not model names
- [ ] Permission model consistent between SDS and search

## Output Format

For each unit, produce:
- **PASS** or **FAIL**
- If FAIL: specific items that failed with file paths and line numbers
- Recommendations (optional, for non-blocking improvements)

Final verdict: **PASS** (all units pass) or **FAIL** (any unit fails)
```

[DECISION POINT]
```
If PASS: → Proceed to Step 5.
If FAIL: → Open Claude Code. Paste the specific failure items. Fix. Re-run review.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

Covers What This Step Does, 5.1 — Create the fix branch, 5.2 — Run the Docs Agent, 5.3 — Review and merge, 5.4 — Tag if milestone.

### What This Step Does
Bring docs back into alignment after the build. The Docs Agent reads MODIFICATIONS.md to know exactly what changed.

### 5.1 — Create the fix branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b fix/post-3b-ii-docs-sync
```

### 5.2 — Run the Docs Agent

[PASTE INTO CLAUDE CODE]
```
You are the Docs Agent for EveryStack, running after Phase 3B-ii (Schema Descriptor Service & Command Bar).

Read:
- MODIFICATIONS.md (session blocks for this sub-phase)
- docs/reference/MANIFEST.md
- docs/reference/GLOSSARY.md

Your tasks:

1. **MANIFEST.md updates:**
   - Update line counts for any reference docs that changed
   - Add new entries if new reference docs were created
   - Verify all cross-references are valid

2. **GLOSSARY.md updates:**
   - Add new domain terms introduced during the build (check MODIFICATIONS.md "New Domain Terms" sections):
     - SchemaDescriptorService / SDS
     - WorkspaceDescriptor, BaseDescriptor, TableDescriptor, FieldDescriptor, LinkEdge
     - SchemaDescriptorCache, schema version hash
     - CommandBar, Command Bar search channels
     - Intent routing, scoped mode
     - Slash commands, command registry
   - Verify definitions match the implementation

3. **Cross-reference check:**
   - Verify schema-descriptor-service.md references match actual implementation
   - Verify command-bar.md references match actual implementation
   - Check for stale references in other docs

4. **MODIFICATIONS.md archive:**
   - Move completed session blocks to the archive section

5. **TASK-STATUS.md:**
   - Update all Phase 3B-ii units to `docs-synced`

Do NOT modify application code. Only update documentation files.
```

### 5.3 — Review and merge

[CHECKPOINT]
```
Review diff. Look for:
- MANIFEST line counts match actual file sizes
- No stale cross-references
- No new terms missing from GLOSSARY
- MODIFICATIONS.md sessions archived
- TASK-STATUS.md units show `docs-synced`
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: post-Phase-3B-ii docs sync (MANIFEST, GLOSSARY, cross-refs)"
git push origin fix/post-3b-ii-docs-sync
```

Open PR titled: **"[Step 5] Phase 3B-ii — Post-Build Docs Sync"**. Review. Merge. Delete branch.

### 5.4 — Tag if milestone

[DECISION POINT]
```
Phase 3B-ii completes the Schema Descriptor Service and Command Bar — this is an AI foundation milestone.

Tag it:
  git tag -a v0.3.0-phase-3b-ii -m "Phase 3B-ii: Schema Descriptor Service & Command Bar"
  git push origin v0.3.0-phase-3b-ii

If you prefer to skip tagging: → Proceed to next sub-phase.
```

---

## NEXT SUB-PHASE

Phase 3B-ii is complete. The Schema Descriptor Service is now the AI's window into your data, and the Command Bar is the user's primary interaction surface for search, navigation, and AI-assisted operations.

Next: Phase 3C (or the next sub-phase in the sequence). Return to Step 0.
