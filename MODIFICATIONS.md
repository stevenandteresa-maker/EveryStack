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

## Session E — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** built
**Prompt(s):** Prompt 6 (Unit 2 — test factory extension + integration tests)

### Files Created
- None

### Files Modified
- `packages/shared/testing/factories.ts` — Added `createTestCrossLinkWithIndex()` factory with configurable source/target record counts, links per source, and canonical field value population
- `packages/shared/testing/index.ts` — Exported `createTestCrossLinkWithIndex` and `TestCrossLinkWithIndexResult` type
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` — Added 12 integration tests: factory validation (4), lifecycle create→link→unlink→cleanup (1), delete cascade (1), validateLinkTarget edge cases (4), MAX_DEFINITIONS_PER_TABLE (1), display value population (1)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session D — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** built
**Prompt(s):** Prompt 5 (Unit 2 — record link/unlink actions + index maintenance)

### Files Created
- `apps/web/src/lib/cross-link-cascade.ts` — Stub module for display value cascade job enqueueing (no-op, implemented in Unit 4)

### Files Modified
- `apps/web/src/actions/cross-link-actions.ts` — Added `linkRecords()` and `unlinkRecords()` server actions with index maintenance, canonical JSONB updates, and audit logging
- `apps/web/src/actions/__tests__/cross-link-actions.test.ts` — Added 8 tests for linkRecords/unlinkRecords (index creation, max_links_per_record, invalid targets, duplicate handling, canonical JSONB updates, audit log)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session C — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** built
**Prompt(s):** Prompt 4 (Unit 2 — definition CRUD server actions)

### Files Created
- `apps/web/src/actions/cross-link-actions.ts` — Server actions for cross-link definition CRUD (create, update, delete) with permission checks, tenant boundary enforcement, and audit logging
- `apps/web/src/actions/__tests__/cross-link-actions.test.ts` — Unit tests for all 3 CRUD actions (15 tests covering permissions, limits, cascading delete)

### Files Modified
- `packages/shared/sync/index.ts` — Added cross-link Zod schema and type re-exports (createCrossLinkSchema, updateCrossLinkSchema, etc.)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session B — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-13
**Status:** built
**Prompt(s):** Prompt 3 (Unit 2 — data functions)

### Files Modified
- `apps/web/src/data/cross-links.ts` — Added getCrossLinkDefinition, listCrossLinkDefinitions, getCrossLinksByTarget, validateLinkTarget, checkCrossLinkPermission data functions
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` — Extended with integration tests for all 5 new data functions + tenant isolation tests
- `packages/shared/sync/index.ts` — Added cross-link type and utility re-exports from barrel

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session A — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-13
**Status:** passed-review
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

## Archive

<!-- Docs Agent moves completed (docs-synced) session blocks here
     during Step 5, newest first. This keeps the active section
     focused on unsynced work. -->

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
