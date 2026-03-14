# Modifications Manifest

Per-session changelog of files created, modified, and deleted during builds.
This file bridges the Build Agent (Step 3) and Docs Agent (Step 5) — it
replaces the need to reconstruct changes from `git diff` after the fact.

## How to Use This File

**Who writes:** Build Agent (Step 3), at the end of each build session.
**Who reads:** Reviewer Agent (Step 4) to cross-check the diff, Docs Agent
(Step 5) to drive MANIFEST updates and glossary scans, Planner to assess
completed work.
**When to write:** After each build session completes (whether it passes
review or not). Append a new session block.
**When to reset:** After Step 5 (Docs Sync) merges, the Docs Agent moves
completed session blocks to an archive section at the bottom. The active
section always shows only unsynced sessions.

### Session Block Format

```
## [Session ID] — [Sub-phase ID] — [Branch Name]

**Date:** YYYY-MM-DD
**Status:** built | passed-review | failed-review | docs-synced
**Prompt(s):** [Which playbook prompt(s) this session executed]

### Files Created
- `path/to/new-file.ts` — [1-line description of what it is]

### Files Modified
- `path/to/existing-file.ts` — [1-line description of what changed]

### Files Deleted
- `path/to/removed-file.ts` — [1-line reason for removal]

### Schema Changes
- Added table: `table_name` — [1-line description]
- Added column: `table_name.column_name` — [type, purpose]
- Modified column: `table_name.column_name` — [what changed]

### New Domain Terms Introduced
- `TermName` — [brief definition, for Docs Agent to add to GLOSSARY.md]

### Notes
[Any context the Docs Agent or next session needs. Optional.]
```

### Status Transitions

```
built → passed-review → docs-synced (happy path)
built → failed-review → built (retry after fixes)
```

---

## Active Sessions

## Session A — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** passed-review
**Prompt(s):** Prompts 1–4 (Unit 1: SDS Types & Core Builders)

### Files Created
- `packages/shared/ai/schema-descriptor/types.ts` — SDS descriptor types: FieldDescriptor, TableDescriptor, BaseDescriptor, LinkEdge, WorkspaceDescriptor
- `packages/shared/ai/schema-descriptor/index.ts` — Barrel export for all SDS types + builder functions
- `packages/shared/ai/schema-descriptor/field-mapper.ts` — mapFieldToDescriptor() — maps Drizzle Field row to LLM-optimized FieldDescriptor
- `packages/shared/ai/schema-descriptor/table-builder.ts` — buildTableDescriptor() — assembles TableDescriptor with pg_stat row counts and cross-link metadata
- `packages/shared/ai/schema-descriptor/workspace-builder.ts` — buildWorkspaceDescriptor() — assembles full WorkspaceDescriptor with base grouping and deduplicated link_graph
- `packages/shared/ai/schema-descriptor/__tests__/field-mapper.test.ts` — 46 unit tests for field mapper (all MVP field types, select options, currency_code, linked_record metadata)
- `packages/shared/ai/schema-descriptor/__tests__/table-builder.integration.test.ts` — Integration tests for table builder (tenant isolation, pg_stat row counts, cross-link batch fetch)
- `packages/shared/ai/schema-descriptor/__tests__/workspace-builder.integration.test.ts` — Integration tests for workspace builder (base grouping, native tables, link_graph deduplication)

### Files Modified
- (none beyond files created above)

### Files Deleted
- (none)

### Schema Changes
- None

### New Domain Terms Introduced
- `SchemaDescriptorService / SDS` — Service that produces LLM-optimized workspace metadata for AI consumption
- `WorkspaceDescriptor` — Top-level LLM-optimized schema for a workspace (bases, tables, fields, link_graph)
- `BaseDescriptor` — Groups tables by their source platform base connection
- `TableDescriptor` — Per-table metadata with approximate row count and field descriptors
- `FieldDescriptor` — Per-field metadata with type-specific hints (searchable, aggregatable, options, linked metadata)
- `LinkEdge` — Cross-link relationship in the workspace link graph (from/to dotted paths, cardinality, label)

### Notes
- `linked_base` is not set by `mapFieldToDescriptor()` — requires base connection lookup; workspace builder resolves this via tableToBaseMap.
- All 8 interface contracts verified: 5 types exported, 3 functions exported with correct signatures.

## Session C — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** passed-review
**Prompt(s):** Prompts 9–11 (Unit 3: Command Bar Search & Navigation Data Layer)

### Files Created
- `apps/web/src/lib/command-bar/types.ts` — SearchResult, NavigationResult, CommandEntry, RecentItem, RecentItemInput, CommandBarSearchParams types
- `apps/web/src/data/command-bar-search.ts` — searchRecords() (tsvector full-text search) and searchTablesAndViews() (role-aware ILIKE navigation search)
- `apps/web/src/data/__tests__/command-bar-search.test.ts` — Unit/integration tests for record search and table/view search
- `apps/web/src/data/command-registry.ts` — getCommandRegistry() with hardcoded SYSTEM_COMMANDS, role-based and scope-based filtering
- `apps/web/src/data/__tests__/command-registry.test.ts` — Unit tests for command registry permission and scope filtering
- `apps/web/src/data/recent-items.ts` — trackRecentItem() (upsert dedup, prune at 100) and getRecentItems() (access-filtered via JOIN)
- `apps/web/src/data/__tests__/recent-items.test.ts` — Unit tests for recent item tracking, retrieval, and access filtering
- `packages/shared/testing/factories/command-registry.ts` — createTestCommandRegistryEntry() factory with incremental counter

### Files Modified
- `packages/shared/testing/index.ts` — Added barrel export for command-registry factory
- `packages/shared/db/index.ts` — Added missing re-exports for userRecentItems, userRecentItemsRelations, UserRecentItem, NewUserRecentItem
- `packages/shared/testing/factories/command-registry.ts` — Replaced cross-package import with local CommandEntry interface to fix rootDir violation

### Files Deleted
- (none)

### Schema Changes
- None

### New Domain Terms Introduced
- `CommandBarSearchParams` — Interface for parameterized command bar search (query, workspace_id, scope, limit)
- `CommandEntry` — Interface for system/automation commands in the Command Bar registry
- `command_key` — Unique string identifier for each command in the registry (e.g. 'new_record', 'search')
- `context_scopes` — Array of scope identifiers controlling where a command appears (global, table_view, record_detail, chat)

### Notes
- Verification pass fixed two issues: (1) userRecentItems missing from db barrel export, (2) command-registry factory had cross-package import violating shared rootDir.
- All 7 interface contracts verified. Typecheck, lint, tests (1997), coverage all pass.

## Session B — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** built
**Prompt(s):** Prompt 5 (Unit 2: SDS Permission Filter)

### Files Created
- `packages/shared/ai/schema-descriptor/permission-filter.ts` — filterDescriptorByPermissions() — deep-copies and filters WorkspaceDescriptor by user permissions (role-based Table View access, field-level hidden/read_only resolution, link graph pruning, cross-link restricted target handling)
- `packages/shared/ai/schema-descriptor/__tests__/permission-filter.test.ts` — 15 unit tests covering Owner/Admin bypass, Team Member partial access, hidden field security, link graph pruning, cross-link edge case, deep-copy safety, tenant isolation, manager access, specific user grants, excluded users

### Files Modified
- `packages/shared/ai/schema-descriptor/index.ts` — Added barrel export for filterDescriptorByPermissions

### Files Deleted
- (none)

### Schema Changes
- None

### New Domain Terms Introduced
- (none — uses existing permission and descriptor terminology)

### Notes
- Uses structuredClone() for deep-copy safety — cached descriptors are never mutated
- Permission resolution uses resolveEffectiveRole() + resolveAllFieldPermissions() from existing auth package
- Cross-link edge case: linked_record fields with inaccessible targets get linked_table: null, cardinality: 'restricted'
- Coverage: 89% statements, 88.76% lines on permission-filter.ts

---

## Archive

<!-- Docs Agent moves completed (docs-synced) session blocks here
     during Step 5, newest first. This keeps the active section
     focused on unsynced work. -->

## Session F — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 11–12 (Unit 5)

### Files Created
- `apps/web/src/components/cross-links/link-picker-provider.tsx` — LinkPickerProvider context managing Link Picker state (open/close, mode, selectedIds)
- `apps/web/src/components/cross-links/use-link-picker.ts` — useLinkPicker hook with open/close/select/confirm/remove actions
- `apps/web/src/components/cross-links/link-picker.tsx` — LinkPicker dialog with Command (cmdk) search, recent section, single/multi-link modes
- `apps/web/src/components/cross-links/link-picker-search-results.tsx` — LinkPickerSearchResults with card_fields preview, permission-aware filtering, scroll-to-load
- `apps/web/src/components/cross-links/link-picker-inline-create.tsx` — LinkPickerInlineCreate for creating new records directly from the Link Picker
- `apps/web/src/components/cross-links/linked-record-chip.tsx` — LinkedRecordChip displaying linked record display value with click-to-open
- `apps/web/src/components/cross-links/__tests__/LinkPickerInlineCreate.test.tsx` — Unit tests for inline create component
- `apps/web/src/components/cross-links/__tests__/LinkedRecordChip.test.tsx` — Unit tests for LinkedRecordChip component

### Files Modified
- `apps/web/src/data/cross-links.ts` — Added `searchLinkableRecords()` (tsvector prefix matching + scope filter) and `getRecentLinkedRecords()`
- `apps/web/src/components/grid/cells/` — Linked Record cell — Link Picker integration
- `apps/web/src/components/record-view/` — Linked field — Link Picker integration
- `apps/web/messages/en.json` — Added `link_picker` namespace with i18n keys
- `apps/web/messages/es.json` — Added `link_picker` namespace with Spanish translations

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session E — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 9–10 (Unit 4)

### Files Created
- `apps/worker/src/processors/cross-link/cascade.ts` — Cross-link display value cascade processor with content hash optimization, batched updates, single-hop rule
- `apps/worker/src/processors/cross-link/index-rebuild.ts` — Cross-link index rebuild processor with cursor-based pagination
- `apps/worker/src/processors/cross-link/integrity-check.ts` — Cross-link integrity check with adaptive sampling and conditional rebuild
- `apps/worker/src/processors/cross-link/__tests__/cascade.test.ts` — Unit tests for cascade processor

### Files Modified
- `packages/shared/queue/constants.ts` — Added `cross-link` to `QUEUE_NAMES`
- `packages/shared/queue/types.ts` — Added `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData` types
- `apps/web/src/lib/cross-link-cascade.ts` — Replaced stub with real BullMQ enqueue implementation with backpressure
- `packages/shared/realtime/events.ts` — Added `DISPLAY_VALUE_UPDATED` to `REALTIME_EVENTS`
- `apps/worker/src/index.ts` — Registered cross-link processors
- `apps/worker/src/queues.ts` — Registered cross-link queue

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session D — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 7–8 (Unit 3)

### Files Created
- `apps/web/src/data/cross-link-resolution.ts` — L0/L1/L2 resolution functions, permission intersection, LinkedRecordTree type
- `apps/web/src/data/__tests__/cross-link-resolution.integration.test.ts` — Integration tests for all resolution levels, permissions, and tenant isolation

### Files Modified
- None

### Schema Changes
- None

### New Domain Terms Introduced
- `LinkedRecordTree` — Return type for L2 bounded traversal containing root, levels, and truncation state

---

## Session C — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 5–6 (Unit 2, second half)

### Files Created
- `apps/web/src/lib/cross-link-cascade.ts` (stub — replaced in Unit 4)

### Files Modified
- `apps/web/src/actions/cross-link-actions.ts` (added linkRecords, unlinkRecords)
- `packages/shared/testing/factories.ts` (added createTestCrossLinkWithIndex)
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extended)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session B — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 3–4 (Unit 2, first half)

### Files Created
- `apps/web/src/actions/cross-link-actions.ts`
- `apps/web/src/actions/__tests__/cross-link-actions.test.ts`

### Files Modified
- `apps/web/src/data/cross-links.ts` (added 5 new data functions)
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extended)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session A — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 1–2 (Unit 1)

### Files Created
- `packages/shared/sync/cross-link-types.ts` — Types, constants, and canonical field value utilities for cross-linking
- `packages/shared/sync/cross-link-schemas.ts` — Zod validation schemas for cross-link CRUD and linking ops
- `packages/shared/sync/cross-link-field-type.ts` — FieldTypeRegistry registration for `linked_record` on canonical platform
- `packages/shared/sync/__tests__/cross-link-types.test.ts` — Unit tests for cross-link types and utilities
- `packages/shared/sync/__tests__/cross-link-schemas.test.ts` — Unit tests for cross-link Zod schemas
- `packages/shared/sync/__tests__/cross-link-field-type.test.ts` — Unit tests for linked_record registry registration

### Files Modified
- `TASK-STATUS.md` — Updated Unit 1 status to passed-review

### Schema Changes
- None

### New Domain Terms Introduced
- None (RelationshipType, CrossLinkFieldValue, LinkScopeFilter already in GLOSSARY)

---

## Session A — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 1–2 (Unit 1)

### Files Created
- `packages/shared/auth/permissions/types.ts`
- `packages/shared/auth/permissions/schemas.ts`
- `packages/shared/auth/permissions/resolve.ts`
- `packages/shared/auth/permissions/resolve.test.ts`
- `packages/shared/auth/permissions/index.ts`

### Files Modified
- `packages/shared/auth/index.ts` (added permission re-exports)

### Schema Changes
- None

### New Domain Terms Introduced
- `FieldPermissionState` — Union type for field access levels: `read_write | read_only | hidden`
- `ViewPermissions` — Interface defining role/user access and field permissions for a Table View
- `ViewFieldPermissions` — Interface grouping role restrictions and individual overrides for a view
- `RoleRestriction` — Interface for Layer 2a per-role field access narrowing
- `IndividualOverride` — Interface for Layer 2b per-user field access override
- `FieldPermissionMap` — Map<fieldId, FieldPermissionState> returned by batch resolution
- `ResolvedPermissionContext` — Interface containing all inputs needed for the 7-step permission cascade

## Session B — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 3–4 (Unit 2)

### Files Created
- `apps/web/src/data/permissions.ts`
- `apps/web/src/data/permissions.test.ts`
- `apps/web/src/data/permissions.integration.test.ts`

### Files Modified
- `packages/shared/testing/factories.ts` (added createTestViewWithPermissions)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session C — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 5–7 (Units 3 + 4)

### Files Created
- apps/web/src/lib/auth/field-permissions.ts
- apps/web/src/lib/auth/field-permissions.test.ts
- apps/web/src/lib/realtime/permission-events.ts
- apps/web/src/lib/realtime/permission-handlers.ts
- apps/web/src/lib/realtime/permission-events.test.ts

### Files Modified
- packages/shared/realtime/events.ts (added PERMISSION_UPDATED)
- packages/shared/realtime/types.ts (added PermissionUpdatedPayload)
- apps/web/src/actions/record-actions.ts (added permission checks)
- apps/web/src/data/records.ts (added filterHiddenFields)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session D — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 8–9 (Unit 5)

### Files Created
- apps/web/src/hooks/use-field-permissions.ts
- apps/web/src/hooks/use-field-permissions.test.ts
- apps/web/src/components/permissions/PermissionProvider.tsx

### Files Modified
- apps/web/src/components/grid/DataGrid.tsx (permission-aware column filtering)
- apps/web/src/components/grid/GridCell.tsx (read-only prop)
- apps/web/src/components/grid/GridHeader.tsx (lock icon for read-only)
- apps/web/src/components/grid/BulkActionsToolbar.tsx (permission gating)
- apps/web/src/components/record-view/ (hidden/read-only fields)
- apps/web/src/components/card-view/ (hidden fields)
- apps/web/messages/en.json (permission i18n keys)
- apps/web/messages/es.json (permission i18n keys)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session E — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 10–11 (Unit 6 — phase complete)

### Files Created
- apps/web/src/actions/permission-actions.ts
- apps/web/src/actions/permission-actions.test.ts
- apps/web/src/components/permissions/PermissionStateBadge.tsx
- apps/web/src/components/permissions/RoleLevelPermissionGrid.tsx
- apps/web/src/components/permissions/PermissionConfigPanel.tsx
- apps/web/src/components/permissions/IndividualOverrideView.tsx
- apps/web/src/components/permissions/IndividualOverrideView.test.tsx

### Files Modified
- apps/web/messages/en.json (permission config i18n keys)
- apps/web/messages/es.json (permission config i18n keys)

### Schema Changes
- None

### New Domain Terms Introduced
- Permission Config Panel, RoleLevelPermissionGrid, IndividualOverrideView, PermissionStateBadge

## Session G — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** built
**Prompt(s):** Prompt 12 (Unit 4: CommandBar Shell, Provider & Keyboard Shortcuts)

### Files Created
- `apps/web/src/components/command-bar/command-bar-provider.tsx` — CommandBarProvider context, useCommandBar() hook, deriveChannel() intent routing
- `apps/web/src/components/command-bar/command-bar.tsx` — CommandBar modal component built on shadcn/ui Command (cmdk), global keyboard shortcuts (Cmd+K, Cmd+F)
- `apps/web/src/components/command-bar/__tests__/command-bar.test.tsx` — 18 tests: deriveChannel unit tests, provider state tests, keyboard shortcut tests

### Files Modified
- `apps/web/src/app/(app)/layout.tsx` — Wrapped AppShell with CommandBarProvider, added CommandBar component
- `apps/web/messages/en.json` — Added commandBar i18n namespace
- `apps/web/messages/es.json` — Added commandBar i18n namespace (Spanish)

### Schema Changes
- None

### New Domain Terms Introduced
- CommandBarProvider, useCommandBar, deriveChannel, activeChannel (search | slash | ai)

## Session D/E — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** passed-review
**Prompt(s):** Prompts 12–15 (Unit 4: Command Bar UI & AI Search Channel)

### Files Created
- `apps/web/src/components/command-bar/command-bar-provider.tsx` — CommandBarProvider context, useCommandBar() hook, deriveChannel() intent routing
- `apps/web/src/components/command-bar/command-bar.tsx` — CommandBar modal with keyboard shortcuts, session analytics, trackRecentItem wiring
- `apps/web/src/components/command-bar/search-results.tsx` — CommandBarSearchResults with parallel record + navigation search, recent item boosting
- `apps/web/src/components/command-bar/slash-menu.tsx` — CommandBarSlashMenu with fuzzy filtering by command_key, label, description
- `apps/web/src/components/command-bar/ai-channel.tsx` — CommandBarAIChannel with SDS-powered natural language search via AIService
- `apps/web/src/components/command-bar/recent-items.tsx` — CommandBarRecentItems with icon mapping, entity context display, filterRecentItemsByQuery()
- `apps/web/src/components/command-bar/__tests__/command-bar.test.tsx` — 18 tests: deriveChannel, provider state, keyboard shortcuts
- `apps/web/src/components/command-bar/__tests__/recent-items.test.tsx` — 17 tests: recent items rendering, selection tracking, scoped mode, session analytics, search boosting
- `apps/web/src/actions/command-bar.ts` — executeSlashCommand() and aiSearchQuery() server actions (SDS + AIService integration)
- `apps/web/src/data/command-bar-sessions.ts` — createCommandBarSession(), closeCommandBarSession(), getCommandBarSession() analytics data layer

### Files Modified
- `apps/web/messages/en.json` — Added commandBar i18n namespace (placeholder, searchHeading, slashHeading, aiHeading, recentHeading, scopedLabel, scopedHint, etc.)
- `apps/web/messages/es.json` — Added commandBar i18n namespace (Spanish translations)
- `packages/shared/db/index.ts` — Added re-exports for commandBarSessions, CommandBarSession, NewCommandBarSession

### Schema Changes
None

### New Domain Terms Introduced
- `CommandBar` — Persistent modal UI component for search, slash commands, and AI queries (Cmd+K global, Cmd+F scoped)
- `CommandBarProvider` — React context provider managing Command Bar state (open/close, mode, query, channel)
- `useCommandBar` — Hook exposing Command Bar state and actions (open, close, setQuery)
- `activeChannel` — Derived channel (search | slash | ai) based on query intent routing
- `intent routing` — Pattern where query prefix determines the active channel (plain text → search, / → slash, ? → AI)
- `scoped mode` — Command Bar mode (Cmd+F) filtering results to the current table context
