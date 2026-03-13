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

## Session A — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** passed-review
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
**Status:** passed-review
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
**Status:** passed-review
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
**Status:** built
**Prompt(s):** Prompt 8 (Unit 5 — PermissionProvider context)

### Files Created
- `apps/web/src/components/permissions/PermissionProvider.tsx`
- `apps/web/src/components/permissions/__tests__/PermissionProvider.test.tsx`
- `apps/web/src/lib/hooks/use-field-permissions.ts`
- `apps/web/src/lib/hooks/__tests__/use-field-permissions.test.ts`

### Files Modified
- None

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session E — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** built
**Prompt(s):** Prompt 9 (Unit 6 — Permission-aware rendering)

### Files Created
- None

### Files Modified
- `apps/web/src/components/grid/GridCell.tsx` — Added `readOnly` prop for permission-based read-only, cursor-default and opacity-75 styling
- `apps/web/src/components/grid/GridRow.tsx` — Added `readOnlyFieldIds` prop, passes to GridCell
- `apps/web/src/components/grid/GridHeader.tsx` — Added `readOnlyFieldIds` prop, shows Lock icon on read-only column headers
- `apps/web/src/components/grid/DataGrid.tsx` — Added `readOnlyFieldIds` prop, passes to GridHeader, BulkActionsToolbar, and GridRow
- `apps/web/src/components/grid/BulkActionsToolbar.tsx` — Added `readOnlyFieldIds` prop, filters editable fields list, disables edit button with title when no writable fields
- `apps/web/src/components/record-view/RecordViewCanvas.tsx` — Added `hiddenFieldIds` and `readOnlyFieldIds` props, filters hidden fields from layout, passes readOnly to FieldRenderer
- `apps/web/src/components/card-view/CardView.tsx` — Added `hiddenFieldIds` prop, filters hidden fields from visible fields
- `apps/web/src/components/grid/__tests__/collaboration.test.tsx` — Updated opacity class assertion from `opacity-60` to `opacity-75`
- `apps/web/messages/en.json` — Added `grid.permissions` i18n keys (readOnly, noEditPermission, requiresRole, bulkActionDenied)
- `apps/web/messages/es.json` — Added `grid.permissions` i18n keys (Spanish translations)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Archive

<!-- Docs Agent moves completed (docs-synced) session blocks here
     during Step 5, newest first. This keeps the active section
     focused on unsynced work. -->
