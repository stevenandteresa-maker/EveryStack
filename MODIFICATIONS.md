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

## Session B — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** passed-review
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

## Session D — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** built
**Prompt(s):** Prompt 8 (Unit 3, L2 bounded traversal)

### Files Created
- None

### Files Modified
- `apps/web/src/data/cross-link-resolution.ts` — Added `LinkedRecordTree` type and `resolveLinkedRecordsL2()` with iterative bounded traversal, cycle detection, and circuit breaker
- `apps/web/src/data/__tests__/cross-link-resolution.integration.test.ts` — Added 8 L2 tests: traversal, maxDepth, circuit breaker, cycle detection, performance, tenant isolation

### Schema Changes
- None

### New Domain Terms Introduced
- `LinkedRecordTree` — Return type for L2 bounded traversal containing root, levels, and truncation state

---

## Session C — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** passed-review
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
