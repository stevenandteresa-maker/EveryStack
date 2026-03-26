# Subdivision Doc: 3B-ii — Schema Descriptor Service & Command Bar

## Big-Picture Anchor

Phase 3B-ii delivers two complementary systems: the Schema Descriptor Service (SDS) — a read-only, LLM-optimized schema API that exposes EveryStack's data model with per-user permission filtering and 2-tier caching — and the Command Bar — a unified `Cmd+K` interface with fuzzy record search, table navigation, slash commands, and AI natural language search powered by SDS. Together they form the bridge between the user's workspace data and AI-assisted interactions. SDS depends on 3B-i (cross-link graph) and 3A-iii (field-level permissions) for the schema it describes. The Command Bar consumes SDS as the context provider for its AI search channel. Downstream, SDS becomes the foundation for all Phase 4+ AI features (Smart Fill, Record Summarization, Field Suggestions), and the Command Bar becomes the primary interaction surface for AI-assisted operations.

## Dependency Graph

Covers Unit 1: SDS Types & Core Builders, Unit 2: SDS Permission Filter, Caching & Service Facade, Unit 3: Command Bar Search & Navigation Data Layer, Unit 4: Command Bar UI & AI Search Channel.
Touches `base_connections`, `cross_links`, `cross_link_index`, `currency_code`, `linked_base` tables. See `schema-descriptor-service.md`, `data-model.md`, `permissions.md`.

```
Unit 1: SDS Types & Core Builders
  ↓
Unit 2: SDS Permission Filter, Caching & Service Facade
  ↓                                Unit 3: Command Bar Search
  ↓                                & Navigation Data Layer
  ↓                                (parallel with Units 1-2)
  ↓                                  ↓
Unit 4: Command Bar UI & AI Search Channel
```

**Critical path:** Unit 1 → Unit 2 → Unit 4 (depth 3)
**Parallel opportunity:** Unit 3 can be built concurrently with Units 1–2

---

### Unit 1: SDS Types & Core Builders

**Big-Picture Anchor:** Defines the TypeScript type system for LLM-optimized schema descriptors and implements the pure data assembly functions that translate existing DB metadata (tables, fields, cross-links) into `WorkspaceDescriptor` JSON. This unit produces no side effects — it reads existing metadata and assembles descriptor objects. All downstream SDS work (permissions, caching, API) builds on these types and builders.

**Produces:**
- `WorkspaceDescriptor` — type from `packages/shared/ai/schema-descriptor/types.ts`
- `BaseDescriptor` — type from `packages/shared/ai/schema-descriptor/types.ts`
- `TableDescriptor` — type from `packages/shared/ai/schema-descriptor/types.ts`
- `FieldDescriptor` — type from `packages/shared/ai/schema-descriptor/types.ts`
- `LinkEdge` — type from `packages/shared/ai/schema-descriptor/types.ts`
- `mapFieldToDescriptor(field: FieldRecord, crossLinkDef?: CrossLinkDefinition): FieldDescriptor` — function from `packages/shared/ai/schema-descriptor/field-mapper.ts`
- `buildTableDescriptor(tableId: string, tenantId: string, db: TenantDb): Promise<TableDescriptor>` — function from `packages/shared/ai/schema-descriptor/table-builder.ts`
- `buildWorkspaceDescriptor(workspaceId: string, tenantId: string, db: TenantDb): Promise<WorkspaceDescriptor>` — function from `packages/shared/ai/schema-descriptor/workspace-builder.ts`

**Consumes:**
- None — first unit. Uses existing FieldTypeRegistry types, Drizzle schema types (`tables`, `fields`, `base_connections`, `cross_links`, `cross_link_index`), cross-link types from 3B-i (`RelationshipType`, `CrossLinkFieldValue`)

**Side Effects:** None

**Context Manifest:**
- `schema-descriptor-service.md` § Overview (lines 45–52)
- `schema-descriptor-service.md` § Architecture Position (lines 53–78)
- `schema-descriptor-service.md` § Output Schema (lines 79–193)
- `data-model.md` § Field System Architecture (lines 191–488) — field type definitions and canonical JSONB shapes
- `data-model.md` § Cross-Linking Architecture (lines 489–508) — cross-link data model
- `CLAUDE.md` § CockroachDB Readiness (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/sync/field-registry.ts` — FieldTypeRegistry types and registration pattern
- `packages/shared/sync/cross-link-types.ts` — `RelationshipType`, `CrossLinkFieldValue` types
- `packages/shared/db/schema/tables.ts` — table schema definition
- `packages/shared/db/schema/fields.ts` — field schema definition
- `packages/shared/db/schema/base-connections.ts` — base connection schema
- `packages/shared/db/schema/cross-links.ts` — cross-link schema
- `packages/shared/db/schema/cross-link-index.ts` — cross-link index schema
- `packages/shared/db/schema/workspaces.ts` — workspace schema
- `packages/shared/ai/types.ts` — existing AI type patterns
- `packages/shared/ai/index.ts` — existing AI package exports

**Acceptance Criteria:**
- [ ] `WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types exported with JSDoc explaining LLM optimization choices
- [ ] `FieldDescriptor` carries type-specific metadata: `options` for select fields, `currency_code` for currency, `linked_base`/`linked_table`/`cardinality`/`symmetric_field` for linked_record, `searchable` and `aggregatable` flags for all fields
- [ ] `mapFieldToDescriptor()` correctly maps all MVP field types from FieldTypeRegistry to descriptor format with appropriate `searchable`/`aggregatable` flags
- [ ] `buildTableDescriptor()` assembles a single table's descriptor using `pg_stat_user_tables.n_live_tup` for approximate record count (no table scan)
- [ ] `buildWorkspaceDescriptor()` batches queries per base connection (not per field), builds `link_graph` with deduplicated edges and human-readable labels
- [ ] All functions are tenant-scoped via `getDbForTenant()` pattern
- [ ] Unit tests cover: each field type branch in mapper, table descriptor assembly with mock data, workspace descriptor with multi-base + cross-link graph

**Estimated Complexity:** Medium

---

### Unit 2: SDS Permission Filter, Caching & Service Facade

**Big-Picture Anchor:** Applies the security boundary (permission-filtered schema output), adds the performance layer (2-tier Redis + in-memory caching with event-driven invalidation), provides token budget management for large workspaces, and assembles the `SchemaDescriptorService` class that ties the SDS together as a single entry point. This is the security-critical unit — the permission filter ensures AI never discovers data the user can't access.

**Produces:**
- `filterDescriptorByPermissions(descriptor: WorkspaceDescriptor, userId: string, tenantId: string, db: TenantDb): Promise<WorkspaceDescriptor>` — function from `packages/shared/ai/schema-descriptor/permission-filter.ts`
- `computeSchemaVersionHash(workspaceId: string, tenantId: string, db: TenantDb): Promise<string>` — function from `packages/shared/ai/schema-descriptor/schema-hash.ts`
- `SchemaDescriptorCache` — class from `packages/shared/ai/schema-descriptor/cache.ts` with methods: `getWorkspaceDescriptor(workspaceId, userId)`, `invalidateWorkspace(workspaceId)`, `invalidateUser(workspaceId, userId)`
- `estimateTokens(descriptor: WorkspaceDescriptor): number` — function from `packages/shared/ai/schema-descriptor/token-estimator.ts`
- `condenseDescriptor(descriptor: WorkspaceDescriptor, maxTokens: number): WorkspaceDescriptor` — function from `packages/shared/ai/schema-descriptor/token-estimator.ts`
- `SchemaDescriptorService` — class from `packages/shared/ai/schema-descriptor/service.ts` with methods: `describeWorkspace(workspaceId, userId, tenantId)`, `describeTable(tableId, userId, tenantId)`, `describeLinks(workspaceId, userId, tenantId)`

**Consumes:**
- `WorkspaceDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` from Unit 1 — type definitions for filter input/output
- `buildWorkspaceDescriptor()`, `buildTableDescriptor()` from Unit 1 — called on cache miss
- `mapFieldToDescriptor()` from Unit 1 — used by `describeTable()` for single-table requests
- Existing: `resolveAllFieldPermissions()` from `packages/shared/auth/permissions/resolve.ts`, `getFieldPermissions()` from `apps/web/src/data/permissions.ts`, Redis utilities

**Side Effects:**
- Redis cache keys: `cache:t:{tenantId}:sds:{workspaceId}:{schemaHash}` (Tier 1 unfiltered), `cache:t:{tenantId}:sds:{workspaceId}:{userId}:{schemaHash}` (Tier 2 per-user)
- Subscribes to schema mutation events (field_created, field_updated, field_deleted, table_created, table_deleted, link_created, link_deleted) and permission_updated events for cache invalidation

**Context Manifest:**
- `schema-descriptor-service.md` § Permissions Integration (lines 194–208)
- `schema-descriptor-service.md` § API Surface (lines 209–223)
- `schema-descriptor-service.md` § Caching Strategy (lines 224–237)
- `permissions.md` § Permission Resolution at Runtime (lines 278–339) — 7-step resolution cascade
- `permissions.md` § Permission Caching Strategy (lines 343–350) — existing Redis cache pattern
- `permissions.md` § Field-Level Permissions (lines 121–179) — 3-state visibility model
- `CLAUDE.md` § CockroachDB Readiness (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/auth/permissions/types.ts` — `FieldPermissionState`, `ViewPermissions` types
- `packages/shared/auth/permissions/resolve.ts` — `resolveAllFieldPermissions()` function
- `apps/web/src/data/permissions.ts` — `getFieldPermissions()`, Redis cache pattern reference

**From Prior Units:**
- Unit 1 output: `packages/shared/ai/schema-descriptor/types.ts`
- Unit 1 output: `packages/shared/ai/schema-descriptor/field-mapper.ts`
- Unit 1 output: `packages/shared/ai/schema-descriptor/table-builder.ts`
- Unit 1 output: `packages/shared/ai/schema-descriptor/workspace-builder.ts`

**Acceptance Criteria:**
- [ ] `filterDescriptorByPermissions()` deep-copies the input (never mutates cached descriptor), removes inaccessible bases/tables/fields, prunes link_graph to edges where both sides are accessible
- [ ] When a linked_record field is visible but its target table is not, the field is included with `linked_table: null` and `cardinality: "restricted"`
- [ ] `computeSchemaVersionHash()` produces a stable SHA-256 hash from table/field/cross-link definitions; same schema → same hash
- [ ] `SchemaDescriptorCache` implements 2-tier caching with 300s TTL and event-driven invalidation for schema mutations and permission changes
- [ ] `estimateTokens()` estimates tokens via JSON serialization length / 4
- [ ] `condenseDescriptor()` applies 3-level progressive condensation: Level 1 (>2k tokens) removes field options; Level 2 (>4k) collapses large tables to searchable+aggregatable+link fields with `hidden_field_count`; Level 3 (>8k) shows only table names, record counts, and link graph with `condensed: true` flag
- [ ] `SchemaDescriptorService.describeWorkspace()` uses cache, falls back to build→filter on miss
- [ ] `SchemaDescriptorService.describeTable()` returns null if user has no access
- [ ] `SchemaDescriptorService.describeLinks()` returns permission-filtered link graph only
- [ ] Tenant isolation tests: Tenant A's schema never leaks to Tenant B via SDS
- [ ] Security tests: hidden fields do not appear in filtered descriptor, restricted cross-links handled correctly

**Estimated Complexity:** Medium-High

---

### Unit 3: Command Bar Search & Navigation Data Layer

**Big-Picture Anchor:** Server-side data access for the Command Bar's non-AI search channels: fuzzy record search across all accessible tables via tsvector (Channel 1), table/view navigation (Channel 2), command registry for slash commands (Channel 3), and recent items tracking. This unit runs in parallel with Units 1–2 because it consumes only existing DB schema and data access patterns — it does not depend on SDS.

**Produces:**
- `SearchResult` — type from `apps/web/src/lib/command-bar/types.ts`
- `NavigationResult` — type from `apps/web/src/lib/command-bar/types.ts`
- `CommandEntry` — type from `apps/web/src/lib/command-bar/types.ts`
- `RecentItem` — type from `apps/web/src/lib/command-bar/types.ts`
- `CommandBarSearchParams` — type from `apps/web/src/lib/command-bar/types.ts`
- `searchRecords(tenantId: string, workspaceId: string, query: string, opts?: SearchOpts): Promise<SearchResult[]>` — function from `apps/web/src/data/command-bar-search.ts`
- `searchTablesAndViews(tenantId: string, workspaceId: string, query: string, userId: string): Promise<NavigationResult[]>` — function from `apps/web/src/data/command-bar-search.ts`
- `getCommandRegistry(tenantId: string, userId: string, context: CommandContext): Promise<CommandEntry[]>` — function from `apps/web/src/data/command-registry.ts`
- `trackRecentItem(userId: string, tenantId: string, item: RecentItemInput): Promise<void>` — function from `apps/web/src/data/recent-items.ts`
- `getRecentItems(userId: string, tenantId: string, limit?: number): Promise<RecentItem[]>` — function from `apps/web/src/data/recent-items.ts`
- `createTestCommandRegistryEntry()` — factory from `packages/shared/testing/factories/`

**Consumes:**
- None from prior units (parallel with Units 1–2). Uses existing Drizzle schema (`user_recent_items`, `command_bar_sessions`, `records`, `tables`, `views`), tsvector indexes from 2B, permission utilities from 3A-iii

**Side Effects:** None

**Context Manifest:**
- `command-bar.md` § Unified Command Prompt (lines 10–38) — search channel routing
- `command-bar.md` § Command Registry (lines 90–108) — registry schema
- `command-bar.md` § Slash Command Catalog (lines 110–130) — MVP commands
- `data-model.md` § Database Schema — MVP Entities (lines 24–129) — user_recent_items, command_bar_sessions columns
- `permissions.md` § Table View–Based Access (lines 90–117) — search results filtered by view access
- `CLAUDE.md` § CockroachDB Readiness (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/db/schema/user-recent-items.ts` — recent items table schema
- `packages/shared/db/schema/command-bar-sessions.ts` — analytics table schema
- `packages/shared/db/schema/records.ts` — records table with tsvector
- `packages/shared/db/schema/tables.ts` — tables schema
- `packages/shared/db/schema/views.ts` — views schema with permissions JSONB
- `packages/shared/db/schema/fields.ts` — fields schema
- `apps/web/src/data/permissions.ts` — permission check pattern reference
- `packages/shared/testing/factories/index.ts` — factory pattern reference

**Acceptance Criteria:**
- [ ] `searchRecords()` uses tsvector full-text search across all tables accessible to the user in the workspace, returns ranked results with `table_name`, `primary_field_value`, `record_id`, `table_id`
- [ ] `searchTablesAndViews()` returns fuzzy-matched tables and views the user can access, filtered by workspace role and Table View assignments
- [ ] `getCommandRegistry()` returns system commands + workspace custom commands filtered by user's role (`permission_required` check) and current context scope (`context_scopes` JSONB match)
- [ ] `trackRecentItem()` inserts into `user_recent_items` with dedup (upsert on user_id + entity type + entity ID, updates `last_accessed_at`)
- [ ] `getRecentItems()` returns recent items sorted by `last_accessed_at` DESC, limited to accessible entities
- [ ] All search functions are tenant-scoped via `getDbForTenant()`
- [ ] Tenant isolation tests for `searchRecords()`, `searchTablesAndViews()`, `getRecentItems()`
- [ ] Search ranking: recent items boosted in combined results

**Estimated Complexity:** Medium

---

### Unit 4: Command Bar UI & AI Search Channel

**Big-Picture Anchor:** The user-facing Command Bar component — a `Cmd+K` modal built on shadcn/ui Command (cmdk) that unifies 4 search channels into a single keyboard-first interface. Channel 1 (fuzzy record search) and Channel 2 (table/view navigation) consume the data layer from Unit 3. Channel 3 (slash commands) renders the command registry from Unit 3 with fuzzy filtering. Channel 4 (AI natural language search) sends the user's query plus a permission-filtered `WorkspaceDescriptor` from Unit 2's SDS to AIService for intent classification and schema-aware response. This unit also implements scoped mode (`Cmd+F` for current table), recent items display, and keyboard navigation.

**Produces:**
- `CommandBar` — component from `apps/web/src/components/command-bar/command-bar.tsx`
- `CommandBarProvider` — context provider from `apps/web/src/components/command-bar/command-bar-provider.tsx`
- `useCommandBar()` — hook from `apps/web/src/components/command-bar/command-bar-provider.tsx`
- `CommandBarSearchResults` — component from `apps/web/src/components/command-bar/search-results.tsx`
- `CommandBarSlashMenu` — component from `apps/web/src/components/command-bar/slash-menu.tsx`
- `CommandBarAIChannel` — component from `apps/web/src/components/command-bar/ai-channel.tsx`
- `CommandBarRecentItems` — component from `apps/web/src/components/command-bar/recent-items.tsx`
- `executeSlashCommand(tenantId: string, userId: string, commandKey: string, params?: Record<string, unknown>): Promise<CommandResult>` — server action from `apps/web/src/actions/command-bar.ts`
- `aiSearchQuery(tenantId: string, workspaceId: string, userId: string, query: string): Promise<AISearchResult>` — server action from `apps/web/src/actions/command-bar.ts`

**Consumes:**
- `SchemaDescriptorService.describeWorkspace()` from Unit 2 — provides permission-filtered schema for AI Channel 4 context
- `condenseDescriptor()`, `estimateTokens()` from Unit 2 — fits workspace schema within AI context budget
- `searchRecords()`, `searchTablesAndViews()` from Unit 3 — data for Channels 1–2
- `getCommandRegistry()` from Unit 3 — data for Channel 3
- `getRecentItems()`, `trackRecentItem()` from Unit 3 — recent items display and tracking
- Existing: AIService from `packages/shared/ai/service.ts` for AI channel, shadcn/ui Command (cmdk) component

**Side Effects:**
- Registers `Cmd+K` / `Ctrl+K` global keyboard shortcut in application shell
- Registers `Cmd+F` / `Ctrl+F` scoped search shortcut (overrides browser find when in workspace context)
- Writes to `command_bar_sessions` for analytics on each session open/close

**Context Manifest:**
- `command-bar.md` § Unified Command Prompt (lines 10–38) — intent routing, permission-scoped AI, confirmation architecture
- `command-bar.md` § Slash Command Catalog (lines 110–130) — MVP commands list
- `command-bar.md` § Keyboard Shortcuts (lines 156–163)
- `schema-descriptor-service.md` § Overview (lines 45–52) — SDS as AI context provider
- `schema-descriptor-service.md` § API Surface (lines 209–223) — SDS endpoint signatures
- `ai-architecture.md` § Capability-Based Model Routing (lines 94–143) — AIService capability tiers for intent classification
- `design-system.md` — shadcn/ui component conventions (load on demand if needed)
- `CLAUDE.md` § CockroachDB Readiness (always loaded)
- `GLOSSARY.md` (always loaded)

**Source Files:**
- `packages/shared/ai/service.ts` — AIService class for AI channel integration
- `packages/shared/ai/types.ts` — AI type definitions

**From Prior Units:**
- Unit 2 output: `packages/shared/ai/schema-descriptor/service.ts` — `SchemaDescriptorService` class
- Unit 2 output: `packages/shared/ai/schema-descriptor/token-estimator.ts` — `estimateTokens()`, `condenseDescriptor()`
- Unit 3 output: `apps/web/src/data/command-bar-search.ts` — `searchRecords()`, `searchTablesAndViews()`
- Unit 3 output: `apps/web/src/data/command-registry.ts` — `getCommandRegistry()`
- Unit 3 output: `apps/web/src/data/recent-items.ts` — `trackRecentItem()`, `getRecentItems()`
- Unit 3 output: `apps/web/src/lib/command-bar/types.ts` — all Command Bar types

**Acceptance Criteria:**
- [ ] `CommandBar` opens on `Cmd+K` / `Ctrl+K` and closes on `Escape`; persists in application shell (never unmounts)
- [ ] Typing plain text triggers Channel 1 (record search) + Channel 2 (table/view navigation) simultaneously, with results grouped by category
- [ ] Typing `/` triggers Channel 3 (slash command dropdown) with fuzzy filtering; commands filtered by user role and current context
- [ ] Questions or natural language queries trigger Channel 4 (AI search) — sends query + condensed `WorkspaceDescriptor` to AIService with `fast` capability tier for intent classification
- [ ] `Cmd+F` / `Ctrl+F` opens Command Bar in scoped mode (pre-filters to current table)
- [ ] Recent items shown when Command Bar opens with empty input, boosted in search results
- [ ] Keyboard navigation: arrow keys move selection, Enter selects, Tab completes
- [ ] `trackRecentItem()` called on every item selection (record open, table navigation, command execution)
- [ ] AI search results display with action confirmation UI (read results show immediately, actions require user confirmation)
- [ ] Search results are permission-filtered (user only sees records/tables they have access to)
- [ ] `executeSlashCommand()` routes to the correct handler based on `command_key` and validates permissions before execution
- [ ] Component tests for: render, keyboard shortcuts, channel routing, search result display

**Estimated Complexity:** High

---

## Cross-Unit Integration Points

1. **Unit 1 → Unit 2 type chain:** Unit 2's `filterDescriptorByPermissions()` takes and returns `WorkspaceDescriptor` from Unit 1. The `SchemaDescriptorService` class calls `buildWorkspaceDescriptor()` and `buildTableDescriptor()` from Unit 1 on cache misses.

2. **Unit 2 → Unit 4 AI context:** Unit 4's `aiSearchQuery()` server action calls `SchemaDescriptorService.describeWorkspace()` from Unit 2 to get the permission-filtered schema, then passes it through `condenseDescriptor()` to fit the AI context window before sending to AIService.

3. **Unit 3 → Unit 4 data consumption:** All 4 Command Bar data functions from Unit 3 (`searchRecords`, `searchTablesAndViews`, `getCommandRegistry`, `getRecentItems`) are consumed by Unit 4's React components via server actions or data fetching hooks.

4. **Permission boundary consistency:** Both Unit 2 (SDS permission filter) and Unit 3 (search result filtering) consume the same permission resolution from `packages/shared/auth/permissions/`. The Reviewer should verify that both units respect the same permission model — a field hidden by permissions in SDS must also be invisible in Command Bar search results.

5. **Cache invalidation chain:** Unit 2's `SchemaDescriptorCache.invalidateWorkspace()` must be called whenever schema mutations occur. If the Command Bar caches search results or command registry entries (Unit 3), those caches must also invalidate on the same schema events.

## Context Budget Verification

| Unit | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-------------|-------------|---------------|-------------|--------|
| 1    | 4 sections (~250 lines) | 10 files (~800 lines) | 0 | ~27,500 | Yes (~17%) |
| 2    | 5 sections (~170 lines) | 3 files (~400 lines) | 4 files (~300 lines) | ~25,700 | Yes (~16%) |
| 3    | 4 sections (~200 lines) | 8 files (~600 lines) | 0 | ~25,000 | Yes (~16%) |
| 4    | 5 sections (~180 lines) | 2 files (~300 lines) | 6 files (~500 lines) | ~26,800 | Yes (~17%) |

All units are well within the ~40% context budget ceiling (~64,000 tokens). No further subdivision required.

*Token estimates include the always-loaded baseline: CLAUDE.md (~6,500 tokens) + GLOSSARY.md (~10,500 tokens) = ~17,000 tokens.*
