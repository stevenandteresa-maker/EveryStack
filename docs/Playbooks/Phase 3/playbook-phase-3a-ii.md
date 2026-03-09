# Phase 3A-ii — View Features, Record View, Card View & Data Import

## Phase Context

### What Has Been Built

**Phase 1 (MVP — Foundation) is complete and merged to main.** Key outputs relevant to Phase 3A-ii:

- **1A:** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI. ESLint + Prettier.
- **1B:** Drizzle schema for 59 tables including `tables`, `fields`, `records`, `views`, `user_view_preferences`, `record_view_configs`, `sections`. `getDbForTenant()` with read/write routing. RLS policies. UUIDv7 primary keys. `records` hash-partitioned by `tenant_id`.
- **1C:** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities (`checkRole()`, `requireRole()`, `roleAtLeast()`). `PermissionDeniedError` shape.
- **1D:** Pino structured logging with `AsyncLocalStorage` traceId. Sentry integration. OpenTelemetry basic instrumentation.
- **1E:** Vitest workspace config. Playwright E2E setup. 20 test data factories. `testTenantIsolation()` helper. MSW mock setup.
- **1F:** shadcn/ui primitives (18 components including checkbox). Tailwind config with three-layer color architecture. DM Sans + JetBrains Mono fonts. Application shell layout with Icon Rail (48px) + Content Zone (232px) sidebar, accent header (52px).
- **1G:** Socket.io server with Clerk JWT auth and Redis adapter. Room join/leave model. BullMQ worker. StorageClient + R2. Real-time events: `createEventPublisher(redis)`, `REALTIME_EVENTS` with 16 event types.
- **1J:** CP-001/CP-002 schema migrations. Auth middleware updated to `effective_memberships`. Sidebar navigation tree with tenant switching. ShellAccentProvider, TenantSwitcher, WorkspaceTree.

**Phase 2 (MVP — Sync) is complete and merged to main.** Key outputs relevant to Phase 3A-ii:

- **2A:** `FieldTypeRegistry` at `packages/shared/sync/field-registry.ts` with canonical JSONB shapes for all MVP field types. AirtableAdapter.
- **2B:** JSONB expression indexes on `records.canonical_data` for grid query performance. Outbound sync pipeline. Conflict resolution. `search_vector` tsvector population.
- **2C:** NotionAdapter. Sync error recovery. Priority scheduler. Sync dashboard. Sidebar sync badges.

**Phase 3A-i (Grid View Core) is complete and merged to main.** This is the direct predecessor:

- **DataGrid component** (`apps/web/src/components/grid/DataGrid.tsx`) — TanStack Table + TanStack Virtual grid shell with windowed row/column virtualization (overscan 10 rows, 3 columns).
- **18 cell renderers** in `apps/web/src/components/grid/cells/` via Cell Registry pattern (`cell-registry.ts`): Text, Number, Date, Checkbox, Rating, Currency, Percent, SingleSelect, MultiSelect, People, LinkedRecord, Attachment, URL, Email, Phone, SmartDoc, Barcode, Checklist. Each with display + edit modes.
- **Grid store** (`use-grid-store.ts`) — Zustand per-grid-instance: activeCell, editingCell, density, frozenColumnCount, columnWidths, columnOrder, selectedRows, selectionRange.
- **Inline editing** — single-click replace, double-click edit, auto-save on blur, optimistic updates via TanStack Query (`use-cell-edit.ts`, `use-optimistic-record.ts`).
- **Keyboard navigation** (`use-keyboard-navigation.ts`) — full spreadsheet-style: arrows, tab, enter, escape, home/end, page up/down, shift+arrow selection, cmd+A, F2, space toggle, cmd+/, cmd+shift+N.
- **Column behavior** — resize (60–800px), reorder, freeze (40% max viewport), context menu (14 items via `ColumnHeaderMenu.tsx`), column coloring.
- **Row behavior** — 3 density modes (32/44/64px), reorder via drag handle (`use-row-reorder.ts`), row context menu (9 items via `RowContextMenu.tsx`), NewRowInput (persistent add row).
- **Clipboard** (`use-clipboard.ts`) — multi-cell copy/paste (TSV), paste type coercion, drag-to-fill (`DragToFillHandle.tsx`).
- **Undo/redo** (`use-undo-redo.ts`) — inline edit undo/redo stack.
- **Supporting components** — PerformanceBanner (10K/50K/30+ thresholds), GridSkeleton, GridEmptyState, CellErrorOverlay (5 states), TableTypeIcon, KeyboardShortcutsDialog.
- **Data layer** — `apps/web/src/data/tables.ts`, `fields.ts`, `records.ts`, `views.ts`. Server Actions in `record-actions.ts`, `view-actions.ts`.
- **Types** — `grid.ts` with GridRecord, GridField, GridView, ViewConfig Zod schema. `grid-types.ts` with table type constants, tab colors, default column widths.
- **Data hook** — `use-grid-data.ts` (TanStack Query for records + fields + view config).

### What This Phase Delivers

A complete view feature layer on top of the 3A-i grid shell:

- **Selection & Bulk Actions** — bulk actions toolbar (delete, edit value, duplicate, copy) on 2+ rows selected
- **Grouping** — multi-level up to 3 levels with collapsible headers, record count, per-group aggregation, drag-between-groups
- **Sorting** — multi-level sort with drag-to-reorder priority
- **Filtering** — quick filters via column header + full filter builder with AND/OR logic and nested groups
- **Color Coding** — conditional row-level tint + cell-level coloring
- **Summary Footer** — per-column configurable aggregations by field type
- **Grid Toolbar** — view switcher, hide fields, filter, sort, group, color, density, share/export
- **My Views / Shared Views** — personal vs shared views, locked views, promotion flow, default view fallback
- **Multi-User Collaboration** — field-level presence locks via Redis + WebSocket, row-level presence, real-time event coalescing
- **Record View** — configurable field canvas overlay (60% width), 4-column desktop / 2-column mobile, drag-and-drop rearrangeable, multi-tab, multiple saved configs
- **Card View** — 3 layouts (single column / grid 2–3 cols / compact list), inline editable, RecordCard unified component
- **Sections** — universal list organizer (view switcher, tables list, documents list), personal + Manager-created, collapsible, drag-and-drop
- **Inline Sub-Table** — embedded mini-grid for Linked Record fields in Record View (parent-child patterns)
- **CSV Import** — 5-step flow: upload → preview → field mapping → validation → batch execution
- **Record Deletion** — soft delete with 10s undo toast, bulk delete with confirmation dialog

### What This Phase Does NOT Build

- Core grid shell and cell renderers (3A-i — already built)
- Field-level permission enforcement in grid (3A-iii — grid renders all fields for Manager+ initially)
- Cross-link creation and resolution (3B-i — Linked Record renderer shows pills from canonical_data, Link Picker ships in 3B-i)
- Kanban view (post-MVP)
- Excel import (post-MVP)
- Merge/update on import (post-MVP)
- Formula engine / computed fields (post-MVP)
- Inline Sub-Table summary row (post-MVP — requires rollups)
- Quick Entry mode (post-MVP)
- Record Thread / Chat panel attachment to Record View (3C)
- Smart Doc editor in Record View (3D)

### Architecture Patterns for This Phase

1. **Component architecture:** View feature components in `apps/web/src/components/grid/`. Record View in `apps/web/src/components/record-view/`. Card View in `apps/web/src/components/card-view/`. Sections in `apps/web/src/components/sections/`.
2. **View config persistence:** All view-level state (filters, sorts, groups, field visibility, color rules) stored in `views.config` JSONB. Personal overrides in `user_view_preferences.overrides` JSONB. Updates via `updateViewConfig()` Server Action from 3A-i.
3. **Real-time collaboration:** Field-level locks via Redis key `lock:{tenantId}:{recordId}:{fieldId}` with 60s TTL. WebSocket broadcasts via existing `createEventPublisher`. Event coalescing: 100ms idle OR 500ms max buffer.
4. **Data loading:** Record View data via existing `/data` functions. TanStack Query for client-side updates. Server Components for initial Record View config load.
5. **Responsive:** Desktop-first with responsive Tailwind classes. Mobile-specific layout ships in Phase 3H. Record View stacks at <768px.
6. **i18n:** All user-facing text through next-intl. No hardcoded English strings.
7. **CockroachDB safeguards remain active** (UUIDv7, no PG-specific syntax, no advisory locks — use Redis locks for collaboration).

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it from the monorepo root. No manual loading needed.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult it when naming new functions, components, UI labels, or database objects. Do not load in full for every prompt.
`MANIFEST.md` is not needed during build execution.

### Skills for This Phase

Load these skill files before executing any prompt in this phase:
- `docs/skills/ux-ui/SKILL.md` — UI component conventions, design tokens, shadcn/ui patterns
- `docs/skills/backend/SKILL.md` — DB access, Server Actions, data layer patterns
- `docs/skills/phase-context/SKILL.md` — Always. Current build state, existing files/modules, active conventions.

---

## Section Index

| Prompt | Deliverable | Depends On | Lines (est.) |
|--------|-------------|------------|--------------|
| 1 | Selection & Bulk Actions toolbar | None | ~250 |
| 2 | Multi-level sorting with sort panel UI | None | ~200 |
| 3 | Filtering — quick filters + full filter builder | 2 | ~350 |
| 4 | Multi-level grouping with collapsible groups | 2, 3 | ~300 |
| CP-1 | Integration Checkpoint 1 | 1–4 | — |
| 5 | Color coding (conditional row + cell) and summary footer | 4 | ~300 |
| 6 | Grid toolbar and record count display | 2, 3, 4, 5 | ~200 |
| 7 | My Views & Shared Views | 6 | ~250 |
| CP-2 | Integration Checkpoint 2 | 5–7 | — |
| 8 | Multi-user collaboration — field-level presence locking & real-time coalescing | None | ~300 |
| 9 | Record View overlay — layout, field canvas, navigation, saved configs | None | ~350 |
| 10 | Record View — inline editing, tabs, linked record display, responsive | 9 | ~250 |
| CP-3 | Integration Checkpoint 3 | 8–10 | — |
| 11 | Card View — layouts, RecordCard component, inline editing | 9 | ~250 |
| 12 | Sections — universal list organizer | None | ~200 |
| 13 | Inline Sub-Table display for Linked Record fields | 9, 10 | ~250 |
| 14 | CSV import — 5-step guided flow | None | ~300 |
| 15 | Record deletion, responsive grid polish, Grid + Record View combined layout | 9, 10, 11 | ~200 |
| CP-4 | Integration Checkpoint 4 (Final) | 11–15 | — |

---

## Prompt 1: Selection & Bulk Actions Toolbar

**Depends on:** None (builds on 3A-i grid shell)
**Load context:** `tables-and-views.md` lines 372–381 (Selection & Bulk Actions), lines 551–555 (Record Deletion)
**Target files:**
- `apps/web/src/components/grid/BulkActionsToolbar.tsx`
- `apps/web/src/components/grid/use-row-selection.ts`
- `apps/web/src/components/grid/DataGrid.tsx` (update — integrate selection + bulk toolbar)
- `apps/web/src/components/grid/use-grid-store.ts` (update — selection state)
- `apps/web/src/actions/record-actions.ts` (update — add bulk operations)
- `apps/web/src/components/grid/__tests__/selection.test.tsx`
**Migration required:** No
**Git:** Create and checkout branch `build/3a-ii-view-features` from main. Commit with message `feat(grid): selection and bulk actions toolbar [Phase 3A-ii, Prompt 1]`

### Schema Snapshot

N/A — uses existing `records` table. Bulk operations use `deleteRecord()` and `updateRecordField()` from 3A-i.

### Task

Build the row selection model and bulk actions toolbar that appears when 2+ rows are selected.

**1. Row selection hook (`use-row-selection.ts`):**
- Manages `selectedRowIds: Set<string>` in the grid store (3A-i already has `selectedRows` — extend or replace)
- Header checkbox: selects all visible rows (respects active filters when filters ship in Prompt 3 — for now, selects all loaded rows)
- Individual row checkbox: toggle selection
- Shift+Click: range select from last-selected to clicked row
- Cmd+Click: toggle individual row (already wired in 3A-i keyboard navigation — integrate)
- Cmd+A: select all (already wired — integrate)

**2. Bulk actions toolbar (`BulkActionsToolbar.tsx`):**
- Appears when 2+ rows are selected. Slides in above the grid (below header, above data rows)
- Contains: selection count label ("{N} selected"), then action buttons:
  - **Delete** — soft delete selected records. If 2+ records: show confirmation dialog (shadcn/ui AlertDialog). Single record: no dialog, soft delete with 10s undo toast
  - **Edit field value** — opens a popover: pick field → enter new value → apply to all selected records. Uses batch `updateRecordField()` calls
  - **Duplicate** — duplicate selected records (creates copies with new UUIDs, same canonical_data). Uses `createRecord()` Server Action in a batch
  - **Copy** — copy selected rows to clipboard as TSV (reuse existing `use-clipboard.ts` logic)
- Clear selection button (✕)
- **Bulk Actions + Record View interaction:** When Record View is open (ships Prompt 9), toolbar compresses to icon-only strip. For now, just build the full toolbar — compression logic added when Record View ships

**3. Bulk Server Actions (`record-actions.ts` update):**
- `bulkDeleteRecords(tenantId, recordIds: string[])` — soft deletes all records. Returns count. Max 500 per call
- `bulkUpdateRecordField(tenantId, recordIds: string[], fieldId: string, value: unknown)` — updates a single field value on all records. Max 500 per call
- `duplicateRecords(tenantId, recordIds: string[])` — duplicates all records. Returns new record IDs. Max 100 per call
- All actions validate `tenantId` via `getAuthContext()` and use `getDbForTenant(tenantId, 'write')`
- All use Zod for input validation

**4. Undo for bulk delete:**
- Single record delete: undo toast (10s window) that calls `restoreRecord()` Server Action (sets `deleted_at = null`)
- Bulk delete: confirmation dialog required — no undo after confirmation
- Add `restoreRecord(tenantId, recordId)` Server Action

### Acceptance Criteria

- [ ] Header checkbox selects/deselects all visible rows
- [ ] Individual checkboxes toggle row selection
- [ ] Shift+Click range-selects rows
- [ ] Bulk actions toolbar appears when 2+ rows are selected
- [ ] Toolbar shows "{N} selected" count
- [ ] Delete action soft-deletes with confirmation dialog for 2+ rows
- [ ] Single record delete shows undo toast (10s window)
- [ ] `restoreRecord()` reverses soft delete within undo window
- [ ] Edit field value action updates a field across all selected records
- [ ] Duplicate action creates copies with new UUIDs
- [ ] Copy action puts TSV on clipboard
- [ ] `bulkDeleteRecords()` validates max 500 records
- [ ] `testTenantIsolation()` passes for `bulkDeleteRecords()`, `bulkUpdateRecordField()`, `duplicateRecords()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Filtering integration (Prompt 3 — header checkbox currently selects all loaded rows)
- Record View interaction with bulk toolbar (Prompt 15)
- Permission checks on bulk operations (3A-iii)
- Cross-link cascade on delete (3B-i)

---

## Prompt 2: Multi-Level Sorting with Sort Panel UI

**Depends on:** None (builds on 3A-i grid shell)
**Load context:** `tables-and-views.md` lines 392–394 (Sorting), lines 195–203 (Column header interactions — sort indicator)
**Target files:**
- `apps/web/src/components/grid/SortPanel.tsx`
- `apps/web/src/components/grid/use-sort.ts`
- `apps/web/src/components/grid/GridHeader.tsx` (update — sort indicators + click-to-sort)
- `apps/web/src/components/grid/use-grid-store.ts` (update — sort state)
- `apps/web/src/data/records.ts` (update — sorted queries)
- `apps/web/src/actions/view-actions.ts` (update — save sort config)
- `apps/web/src/components/grid/__tests__/sorting.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): multi-level sorting with sort panel [Phase 3A-ii, Prompt 2]`

### Schema Snapshot

```
views.config (JSONB) — existing, add sorts key:
{
  ...existing column_widths, column_order, frozen_column_count, density, column_colors...
  sorts: Array<{ fieldId: string, direction: 'asc' | 'desc' }>  // ordered by priority
}
```

### Task

Build multi-level sort with both column header interaction and a dedicated sort panel.

**1. Sort state hook (`use-sort.ts`):**
- Manages `sorts: Array<{ fieldId: string, direction: 'asc' | 'desc' }>` in grid store
- `addSort(fieldId, direction)` — adds a new sort level
- `removeSort(fieldId)` — removes a sort level
- `toggleSort(fieldId)` — cycles: none → asc → desc → none
- `reorderSorts(fromIndex, toIndex)` — drag-to-reorder sort priority
- `clearSorts()` — removes all sorts
- Sort config saved to `views.config.sorts` via `updateViewConfig()` Server Action
- Sort config loaded from view config on mount

**2. Column header sort interaction (`GridHeader.tsx` update):**
- Click sort indicator area → cycle sort (none → asc → desc → none). The 3A-i placeholder is replaced with real behavior
- Sort arrow icon: ▲ for asc, ▼ for desc (using lucide-react `ArrowUp`/`ArrowDown` icons, or Unicode)
- When sorted: icon highlighted. When unsorted: faint icon on hover only

**3. Sort Panel (`SortPanel.tsx`):**
- Opens from toolbar (Prompt 6 wires it — for now, can be opened via `Cmd+Shift+S` keyboard shortcut already wired as placeholder in 3A-i)
- Lists current sort levels with drag handles for reordering
- Each sort row: field name dropdown + direction toggle (Asc/Desc) + remove button
- "Add sort" button at bottom
- Multi-level: up to 3 sort levels for MVP (soft limit, show warning at 4+)

**4. Sorted data queries (`records.ts` update):**
- `getRecordsByTable()` accepts `sorts` option
- Builds Drizzle `orderBy()` clauses from sort config
- Sort on canonical_data JSONB values: use `sql\`canonical_data->>${fieldId}\`` with appropriate casting per field type
- Number/currency/percent fields: cast to numeric for proper numeric sort
- Date fields: cast to timestamp
- Text/select fields: case-insensitive text sort (`LOWER()`)
- Checkbox: false before true (asc)
- Null values sort last (asc) or first (desc)

**5. Disable manual row reorder when sort is active:**
- When any sort is active, disable the drag handle on rows (per reference doc: "Disabled when sort is active")
- Show tooltip on hover: "Disable sorts to reorder rows manually"

### Acceptance Criteria

- [ ] Click column header cycles sort: none → asc → desc → none
- [ ] Sort arrow icon renders correctly (▲ asc, ▼ desc)
- [ ] Multi-level sort (2+ fields) orders records correctly
- [ ] Sort Panel opens via Cmd+Shift+S
- [ ] Sort levels can be reordered via drag-and-drop
- [ ] Sort config persists to `views.config.sorts`
- [ ] Number fields sort numerically (not lexicographically)
- [ ] Date fields sort chronologically
- [ ] Text sorts case-insensitively
- [ ] Null values sort last (asc) or first (desc)
- [ ] Manual row reorder drag handle disabled when sort is active
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Grid toolbar integration (Prompt 6)
- Filter builder (Prompt 3)
- Grouping (Prompt 4)
- Server-side sort in API layer (Phase 6)

---

## Prompt 3: Filtering — Quick Filters + Full Filter Builder

**Depends on:** Prompt 2 (sort infrastructure patterns shared)
**Load context:** `tables-and-views.md` lines 404–410 (Filtering), `design-system.md` lines 247–260 (Progressive Disclosure)
**Target files:**
- `apps/web/src/components/grid/FilterBuilder.tsx`
- `apps/web/src/components/grid/QuickFilterPopover.tsx`
- `apps/web/src/components/grid/use-filters.ts`
- `apps/web/src/components/grid/filter-types.ts`
- `apps/web/src/data/records.ts` (update — filtered queries)
- `apps/web/src/components/grid/GridHeader.tsx` (update — filter indicator dot)
- `apps/web/src/components/grid/__tests__/filtering.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): filtering — quick filters and filter builder [Phase 3A-ii, Prompt 3]`

### Schema Snapshot

```
views.config (JSONB) — add filters key:
{
  ...existing...
  filters: {
    logic: 'and' | 'or',
    conditions: Array<FilterCondition>,
    groups: Array<FilterGroup>  // nested groups for complex logic
  }
}

FilterCondition: {
  fieldId: string,
  operator: string,   // is, is_not, contains, does_not_contain, is_empty, is_not_empty,
                       // gt, gte, lt, lte, between, is_before, is_after, is_within
  value: unknown,
  id: string           // unique ID for each condition (for UI management)
}

FilterGroup: {
  logic: 'and' | 'or',
  conditions: Array<FilterCondition>,
  id: string
}
```

### Task

Build the two-path filtering system: quick filters via column header and the full filter builder panel.

**1. Filter types (`filter-types.ts`):**
- Define `FilterCondition`, `FilterGroup`, `FilterConfig` TypeScript types + Zod schemas
- Define operator sets per field type:
  - **Text, URL, Email, Phone:** is, is_not, contains, does_not_contain, starts_with, ends_with, is_empty, is_not_empty
  - **Number, Currency, Percent:** is, is_not, gt, gte, lt, lte, between, is_empty, is_not_empty
  - **Date:** is, is_before, is_after, is_within (last 7 days, last 30 days, this week, this month, this year), is_empty, is_not_empty
  - **Single Select, Status:** is, is_not, is_any_of, is_none_of, is_empty, is_not_empty
  - **Multi-Select:** contains, does_not_contain, contains_any_of, contains_all_of, is_empty, is_not_empty
  - **Checkbox:** is (checked/unchecked)
  - **People:** is, is_not, contains, is_empty, is_not_empty. Support `$me` token for "assigned to me" filter
  - **Linked Record:** is, is_not, is_empty, is_not_empty
  - **Rating:** is, gt, lt, gte, lte
- `getOperatorsForFieldType(fieldType: string)` function

**2. Filter state hook (`use-filters.ts`):**
- Manages filter config in grid store
- `addCondition(fieldId, operator, value)` — adds filter condition
- `removeCondition(conditionId)` — removes a condition
- `updateCondition(conditionId, updates)` — updates operator or value
- `addGroup()` — adds a nested filter group
- `setLogic(logic: 'and' | 'or')` — sets top-level logic operator
- `clearFilters()` — removes all filters
- Filter config saved to `views.config.filters` via `updateViewConfig()`
- Active filter count computed for toolbar badge

**3. Quick filter popover (`QuickFilterPopover.tsx`):**
- Click filter icon in column header → field-appropriate dropdown popover
- Shows operators relevant to the field type
- Value input appropriate to field type (text input, number input, date picker, select options list, checkbox)
- "Apply" button adds the condition. "Clear" removes it
- When column has an active filter: filter dot indicator on header (colored dot next to sort icon)

**4. Full filter builder (`FilterBuilder.tsx`):**
- Panel component (will be placed in toolbar in Prompt 6 — for now, can be opened via `Cmd+Shift+F` shortcut already wired as placeholder)
- Shows all active filter conditions
- Each condition row: field dropdown + operator dropdown + value input + remove button
- Top-level AND/OR toggle
- "Add condition" and "Add group" buttons
- Nested groups: indented with their own AND/OR toggle
- Clear all button

**5. Filtered data queries (`records.ts` update):**
- `getRecordsByTable()` accepts `filters` option
- Builds Drizzle `where()` clauses from filter config
- Filter on canonical_data JSONB values: use `sql\`canonical_data->>${fieldId}\`` with appropriate operators
- AND/OR logic: use `and()` / `or()` from Drizzle
- Nested groups: recursive clause building
- `$me` token in People filter: resolve to current user ID at query time
- `is_empty` / `is_not_empty`: check for null or missing key in JSONB

**6. Header filter indicator (`GridHeader.tsx` update):**
- When a column has an active filter: render a small colored dot (accent color) next to the field name
- Tooltip: "Filtered"

### Acceptance Criteria

- [ ] Quick filter popover opens from column header click
- [ ] Operators are field-type-appropriate (text ops for text, numeric ops for numbers, etc.)
- [ ] Quick filter applies immediately and filters rows
- [ ] Filter builder shows all conditions with add/remove
- [ ] AND/OR logic toggle works at top level and within groups
- [ ] Nested filter groups render with proper indentation
- [ ] `getRecordsByTable()` with filters returns only matching records
- [ ] `$me` token resolves to current user in People filter
- [ ] `is_empty` / `is_not_empty` works for all field types
- [ ] Filter dot indicator shows on columns with active filters
- [ ] Filter config persists to `views.config.filters`
- [ ] Header checkbox "select all" respects active filters (selects only filtered/visible rows)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Grid toolbar integration (Prompt 6 — filter builder opens via Cmd+Shift+F for now)
- Row-level visibility filters with `$me` token for permission-based visibility (3A-iii)
- Server-side filtering for API layer (Phase 6)
- Saved filter presets (post-MVP)

---

## Prompt 4: Multi-Level Grouping with Collapsible Groups

**Depends on:** Prompts 2, 3 (sorting + filtering must work for grouped views)
**Load context:** `tables-and-views.md` lines 382–391 (Grouping)
**Target files:**
- `apps/web/src/components/grid/GroupHeader.tsx`
- `apps/web/src/components/grid/GroupFooter.tsx`
- `apps/web/src/components/grid/use-grouping.ts`
- `apps/web/src/components/grid/DataGrid.tsx` (update — render grouped layout)
- `apps/web/src/components/grid/use-grid-store.ts` (update — group state)
- `apps/web/src/components/grid/__tests__/grouping.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): multi-level grouping with collapsible groups [Phase 3A-ii, Prompt 4]`

### Schema Snapshot

```
views.config (JSONB) — add groups key:
{
  ...existing...
  groups: Array<{ fieldId: string, direction: 'asc' | 'desc' }>  // ordered by level
}
```

### Task

Build multi-level grouping with collapsible group headers and per-group aggregation.

**1. Grouping state hook (`use-grouping.ts`):**
- Manages `groups: Array<{ fieldId: string, direction: 'asc' | 'desc' }>` in grid store
- `addGroup(fieldId, direction)` — adds a group level. Max 3 levels
- `removeGroup(fieldId)` — removes a group level
- `reorderGroups(fromIndex, toIndex)` — reorder group priority
- `clearGroups()` — removes all groups
- Group config saved to `views.config.groups` via `updateViewConfig()`
- `collapsedGroups: Set<string>` — tracks which groups are collapsed (group key = concatenated field values)

**2. Group computation:**
- Client-side grouping from loaded records
- Group key generated from canonical_data field values
- Records sorted within groups by active sort config (from Prompt 2)
- Multi-level: groups nested (level 1 → level 2 → level 3 → records)
- Each group tracks: group key, field value, record count, nested sub-groups (if multi-level)

**3. Group header (`GroupHeader.tsx`):**
- Collapsible header row spanning full grid width
- Shows: collapse chevron (▶/▼) + field name + field value + record count badge
- For Select/Status fields: show colored pill matching the option color
- Click header: toggle collapse
- Level indent: 16px per level (level 1: 0, level 2: 16px, level 3: 32px)

**4. Per-group aggregation footer (`GroupFooter.tsx`):**
- Shows after each group's records (before next group header)
- Renders field-type-appropriate summary per column (same aggregation types as Summary Footer in Prompt 5 — define shared aggregation logic now)
- Lighter background (`bg-slate-50`) to distinguish from data rows

**5. Drag records between groups:**
- When grouping by a Select/Status field: user can drag a record from one group to another
- Dragging changes the record's value for the grouped field
- Uses `updateRecordField()` Server Action with optimistic update
- Only supported for Select/Status group fields. Other field types: drag disabled

**6. DataGrid update:**
- When groups are active: render group headers interspersed with data rows
- TanStack Virtual must handle variable height items (group headers + data rows)
- Collapsed groups: hide their records (don't render or virtualize)
- Keyboard navigation skips group header rows (arrows move between data cells)

### Acceptance Criteria

- [ ] Grouping by a field creates collapsible group headers
- [ ] Multi-level grouping (2–3 levels) nests correctly
- [ ] Collapse/expand toggles record visibility within a group
- [ ] Record count badge shows correct count per group
- [ ] Select/Status fields show colored pill in group header
- [ ] Per-group aggregation footer shows field-appropriate summaries
- [ ] Drag-to-regroup works for Select/Status group fields
- [ ] Drag changes the record's grouped field value
- [ ] Group config persists to `views.config.groups`
- [ ] Sorting within groups respects active sort config
- [ ] Filtering applies before grouping (filtered-out records don't appear in groups)
- [ ] Max 3 group levels enforced
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Summary footer (whole-table aggregation — Prompt 5)
- Grid toolbar group button (Prompt 6)
- Kanban-style column grouping (post-MVP)
- Server-side grouping (post-MVP)

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all work from Prompts 1–4 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: Select multiple rows → bulk actions toolbar appears. Sort by column header click. Filter via quick filter popover. Group by a field → collapsible headers. All three (sort + filter + group) work together.

**Git:** Commit with message `chore(verify): integration checkpoint 1 [Phase 3A-ii, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Color Coding and Summary Footer

**Depends on:** Prompt 4 (grouping provides per-group footer context)
**Load context:** `tables-and-views.md` lines 395–429 (Color Coding, Summary Footer Row), `design-system.md` lines 139–152 (Process State Color Language)
**Target files:**
- `apps/web/src/components/grid/ColorRuleBuilder.tsx`
- `apps/web/src/components/grid/SummaryFooter.tsx`
- `apps/web/src/components/grid/use-color-rules.ts`
- `apps/web/src/components/grid/use-summary-footer.ts`
- `apps/web/src/components/grid/aggregation-utils.ts`
- `apps/web/src/components/grid/DataGrid.tsx` (update — render footer + color)
- `apps/web/src/components/grid/__tests__/color-summary.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): conditional color coding and summary footer [Phase 3A-ii, Prompt 5]`

### Schema Snapshot

```
views.config (JSONB) — add color_rules and summary_footer:
{
  ...existing...
  color_rules: {
    row_rules: Array<{ conditions: FilterCondition[], color: string, id: string }>,
    cell_rules: Array<{ fieldId: string, conditions: FilterCondition[], color: string, id: string }>
  },
  summary_footer: {
    enabled: boolean,
    columns: Record<string, string>  // fieldId → aggregation type (sum, avg, min, max, count, etc.)
  }
}
```

### Task

**1. Color coding — conditional row + cell colors:**

Two levels, combinable (per reference doc):

- **Row-level:** Entire row background tint based on conditions. A row matching a rule gets a light tint of the configured color
- **Cell-level:** Individual cells colored by value or conditions. Higher specificity than row color

**Color rule state (`use-color-rules.ts`):**
- Manages `color_rules` in view config
- `addRowRule(conditions, color)` — adds a conditional row coloring rule
- `addCellRule(fieldId, conditions, color)` — adds a conditional cell coloring rule
- `removeRule(ruleId)` — removes a rule
- Rules use the same `FilterCondition` type from Prompt 3
- Color values from the data palette (8–10 light tint options)

**Color rule builder (`ColorRuleBuilder.tsx`):**
- Panel component (will be placed in toolbar — for now, standalone)
- Shows row rules and cell rules in separate sections
- Each rule: condition builder (same as filter builder) + color picker (palette swatches)
- Separate from structural column coloring (which was built in 3A-i)

**Rendering:** Apply row/cell background colors during grid rendering. Use CSS `background-color` with low opacity (0.1–0.15) for tints.

**2. Summary footer row:**

**Aggregation utilities (`aggregation-utils.ts`):**
- Shared between summary footer and per-group footers (from Prompt 4)
- Define aggregation functions per field category:

| Field Category | Available Aggregations |
|----------------|----------------------|
| Number, Currency, Percent, Duration | sum, avg, min, max, count, none |
| Date, Date-Time | earliest, latest, range, count, none |
| Checkbox | checked_count, unchecked_count, percent_checked, none |
| Single Select, Status | count_per_value (mini distribution bar), none |
| Multi-Select, Tags | unique_count, total_count, none |
| People | unique_count, none |
| Linked Record | linked_row_count, total_link_count, none |
| Attachment | rows_with_files, total_file_count, none |
| Text, URL, Email, Phone | filled_count, empty_count, none |
| All others | count, none |

- `computeAggregation(records, fieldId, fieldType, aggregationType)` — returns computed value
- `getAggregationOptions(fieldType)` — returns available aggregation types for a field type

**Summary footer state (`use-summary-footer.ts`):**
- Manages `summary_footer` in view config
- `setSummaryEnabled(enabled)` — toggle footer visibility
- `setColumnAggregation(fieldId, aggregationType)` — set aggregation for a column
- Config persisted to `views.config.summary_footer`

**Summary footer component (`SummaryFooter.tsx`):**
- Sticky row at the bottom of the grid (below all data rows)
- One cell per column, aligned with grid columns
- Click a footer cell → dropdown to pick aggregation type (shows field-appropriate options)
- Renders computed aggregation value
- When grouping is active: this is the table-wide summary (per-group footers show group-specific values from Prompt 4)

**3. Update GroupFooter (Prompt 4):**
- Refactor to use the shared `aggregation-utils.ts`

### Acceptance Criteria

- [ ] Row color rules apply background tint to matching rows
- [ ] Cell color rules apply background tint to matching cells
- [ ] Cell rules take precedence over row rules when both match
- [ ] Color rule builder allows adding conditions + selecting colors
- [ ] Summary footer row renders below data rows, sticky to bottom
- [ ] Click footer cell opens aggregation type picker
- [ ] Sum/avg/min/max compute correctly for number fields
- [ ] Earliest/latest compute correctly for date fields
- [ ] Checked/unchecked count works for checkbox fields
- [ ] Count per value shows mini distribution for select fields
- [ ] Filled/empty count works for text fields
- [ ] Summary footer respects active filters (aggregates only visible rows)
- [ ] Per-group footers (from Prompt 4) now use shared aggregation utilities
- [ ] Table-wide summary and per-group summaries show correct independent values
- [ ] Config persists to `views.config`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Sparkline charts in summary cells (post-MVP)
- Custom aggregation functions (post-MVP)
- Aggregation across cross-linked records (post-MVP — requires rollups)

---

## Prompt 6: Grid Toolbar and Record Count Display

**Depends on:** Prompts 2, 3, 4, 5 (toolbar buttons open sort/filter/group/color panels)
**Load context:** `tables-and-views.md` lines 430–449 (Grid Toolbar, Record Count)
**Target files:**
- `apps/web/src/components/grid/GridToolbar.tsx`
- `apps/web/src/components/grid/HideFieldsPanel.tsx`
- `apps/web/src/components/grid/RecordCount.tsx`
- `apps/web/src/components/grid/DataGrid.tsx` (update — mount toolbar above grid)
- `apps/web/src/components/grid/__tests__/toolbar.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): toolbar, hide fields panel, record count [Phase 3A-ii, Prompt 6]`

### Schema Snapshot

```
views.config (JSONB) — add hidden_fields:
{
  ...existing...
  hidden_fields: string[]  // field IDs to hide
}
```

### Task

Build the grid toolbar that unifies all view controls.

**1. Grid Toolbar (`GridToolbar.tsx`):**

| Position | Button | Behavior |
|----------|--------|----------|
| Left group | **View switcher** (Grid ▾) | Dropdown showing available views — Prompt 7 wires the full view switcher. For now: shows view name + type icon |
| | **Hide fields** | Opens `HideFieldsPanel` |
| | **Filter** | Opens `FilterBuilder` from Prompt 3 |
| | **Sort** | Opens `SortPanel` from Prompt 2 |
| | **Group** | Opens `use-grouping` panel (reuse sort panel pattern — field picker + direction) |
| | **Color** | Opens `ColorRuleBuilder` from Prompt 5 |
| Right group | **Density toggle** | Compact / Default / Expanded — already in grid store from 3A-i |
| | **Share / Export** | Placeholder button (export CSV ships in Prompt 14 context, share ships post-MVP) |
| | **"…" overflow** | Dropdown menu with: Row height settings, Print (browser print), Copy view URL (placeholder) |

- Active state badges: Filter button shows count of active filters. Sort shows count of active sorts. Group shows count of active groups. Color shows dot if rules exist
- Panels open as popovers below toolbar buttons (use shadcn/ui Popover)
- **No search in toolbar.** Search via Command Bar (`Cmd+K` or `Cmd+F`) — ships in 3B-ii

**2. Hide fields panel (`HideFieldsPanel.tsx`):**
- Toggle visibility of each field
- Drag-to-reorder field visibility order
- "Show all" / "Hide all" quick actions
- Primary field cannot be hidden (always shown, disabled toggle)
- Hidden fields stored in `views.config.hidden_fields` array
- Hidden fields not rendered in grid columns

**3. Record count (`RecordCount.tsx`):**
- Always visible in grid footer area (left side, next to summary footer if present)
- When filtered: **"32 of 247 records"** (filtered count of total)
- When unfiltered: **"247 records"**
- Uses the `totalCount` from `getRecordsByTable()` response

**4. Wire toolbar into DataGrid:**
- Mount `GridToolbar` above the grid header
- Keyboard shortcuts (`Cmd+Shift+F`, `Cmd+Shift+S`) now open the correct toolbar panels instead of being no-ops

### Acceptance Criteria

- [ ] Toolbar renders with all button groups (left: view/hide/filter/sort/group/color, right: density/share/overflow)
- [ ] Filter button opens FilterBuilder popover
- [ ] Sort button opens SortPanel popover
- [ ] Active filter count badge shows on filter button
- [ ] Active sort count badge shows on sort button
- [ ] Hide fields panel toggles field visibility
- [ ] Primary field cannot be hidden
- [ ] Hidden fields stored in `views.config.hidden_fields`
- [ ] Hidden fields are not rendered as grid columns
- [ ] Record count shows "N of M records" when filtered
- [ ] Record count shows "N records" when unfiltered
- [ ] Cmd+Shift+F opens filter panel
- [ ] Cmd+Shift+S opens sort panel
- [ ] Density toggle cycles through compact/medium/tall
- [ ] ESLint and TypeScript compile with zero errors
- [ ] No hardcoded English strings

### Do NOT Build

- Full view switcher with My Views/Shared Views (Prompt 7)
- Share functionality (post-MVP)
- Export to CSV button (CSV import in Prompt 14 — export is minimal, placeholder here)
- Search within toolbar (all search via Command Bar, 3B-ii)

---

## Prompt 7: My Views & Shared Views

**Depends on:** Prompt 6 (toolbar view switcher placeholder)
**Load context:** `tables-and-views.md` lines 506–526 (My Views & Shared Views)
**Target files:**
- `apps/web/src/components/grid/ViewSwitcher.tsx`
- `apps/web/src/components/grid/ViewCreateDialog.tsx`
- `apps/web/src/data/views.ts` (update — view queries for My/Shared)
- `apps/web/src/actions/view-actions.ts` (update — create/promote/lock views)
- `apps/web/src/lib/hooks/use-current-view.ts`
- `apps/web/src/components/grid/__tests__/views.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): my views and shared views with promotion flow [Phase 3A-ii, Prompt 7]`

### Schema Snapshot

```
views: id, tenant_id, table_id, name, view_type (grid|card), config (JSONB),
       permissions (JSONB), is_shared (boolean), publish_state (live|draft),
       position, created_by, created_at, updated_at

user_view_preferences: id, view_id, user_id, overrides (JSONB), updated_at
```

### Task

Build the full view management system with My Views, Shared Views, and promotion.

**1. View switcher (`ViewSwitcher.tsx`):**
- Replaces the placeholder in toolbar from Prompt 6
- Dropdown with two sections separated by divider:
  - **Shared Views** — visible to all workspace members with table access. Created by Manager+
  - **My Views** — visible only to the creator. Any role can create
- Each view shows: name + type icon (grid/card) + lock icon (if locked shared view)
- Click view → switch to it (update URL, reload grid config)
- Current view highlighted
- "Create view" button at bottom → opens `ViewCreateDialog`
- Context menu on view items: Rename, Duplicate, Delete, Promote to Shared (if My View + Manager+), Lock/Unlock (if Shared + Manager+)

**2. View create dialog (`ViewCreateDialog.tsx`):**
- Name input + type selector (Grid / Card — MVP types)
- "Copy current view config" toggle (default on — copies filters, sorts, groups, column config from current view)
- Creates as My View by default. Manager+ can toggle "Make shared" option

**3. View data layer (`views.ts` update):**
- `getViewsByTable(tenantId, tableId, userId)` — returns views split into `sharedViews` and `myViews`. Shared: `is_shared = true`. My: `is_shared = false AND created_by = userId`
- `getUserViewPreferences(userId, viewId)` — returns personal overrides

**4. View actions (`view-actions.ts` update):**
- `createView(tenantId, tableId, data)` — creates a new view. `is_shared` based on input + role check (Manager+ for shared)
- `promoteView(tenantId, viewId)` — promotes My View to Shared View. Sets `is_shared = true`. Requires Manager+ role
- `lockView(tenantId, viewId)` — locks a shared view (filters/sorts can't be modified by non-creators). Sets a `locked` flag in config JSONB. Requires Manager+ and must be the view creator
- `deleteView(tenantId, viewId)` — deletes a view. Cannot delete the auto-generated "All Records" default view. Shared views transfer to workspace Owner on creator deactivation (handled at user deactivation time, not here)

**5. Current view hook (`use-current-view.ts`):**
- Manages the active view ID in URL params
- Loads view config and applies to grid store (sorts, filters, groups, column config, hidden fields)
- When no view is specified: uses `getDefaultView()` fallback chain (already in data layer from 3A-i)

**6. User view preferences:**
- When a user modifies a shared view's config (sorts, filters, etc.): save the changes to `user_view_preferences` instead of modifying the shared view
- `saveUserViewPreference(userId, viewId, overrides)` — creates/updates personal override
- Shared view's base config + user overrides = effective config
- "Reset to shared" button removes user overrides

**7. Default view fallback chain** (already in `getDefaultView()` from 3A-i — verify it works):
1. Manager-assigned default view
2. First shared Grid view by `position`
3. First shared view of any type by `position`
4. Auto-generated "All Records" Grid view (always exists, cannot be deleted)

### Acceptance Criteria

- [ ] View switcher shows Shared Views and My Views sections
- [ ] Click view switches the active view and updates grid config
- [ ] Create view dialog creates My View (any role) or Shared View (Manager+)
- [ ] "Copy current view config" copies filters/sorts/groups/column config
- [ ] Promote flow: My View → Shared View (Manager+ only)
- [ ] Lock: prevents non-creator modification of shared view config
- [ ] Delete view works (except auto-generated default view)
- [ ] User view preferences save personal overrides on shared views
- [ ] "Reset to shared" removes user overrides
- [ ] Default view fallback chain works when no view is specified
- [ ] `testTenantIsolation()` passes for `getViewsByTable()`, `createView()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Card View rendering (Prompt 11 — view type selection creates the view, but Card rendering ships separately)
- View sections/grouping in view switcher (Prompt 12 — Sections)
- Permission-filtered view visibility (3A-iii — Team Members/Viewers see only assigned Shared Views)
- Draft/live publish state workflow (post-MVP)

---

## Integration Checkpoint 2 (after Prompts 5–7)

**Task:** Verify all work from Prompts 5–7 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: Grid toolbar renders with all buttons. Filter/sort/group panels open from toolbar. Color rules apply row tints. Summary footer shows aggregations. View switcher shows My/Shared views. Creating and switching views works. Record count updates with filters.

**Git:** Commit with message `chore(verify): integration checkpoint 2 [Phase 3A-ii, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## Prompt 8: Multi-User Collaboration — Field-Level Presence Locking & Real-Time Coalescing

**Depends on:** None (uses 3A-i grid + 1G realtime infrastructure)
**Load context:** `tables-and-views.md` lines 527–550 (Multi-User Collaboration — Field-Level Presence & Locking, Real-Time Updates & Event Coalescing)
**Target files:**
- `apps/web/src/lib/hooks/use-field-lock.ts`
- `apps/web/src/lib/hooks/use-record-presence.ts`
- `apps/web/src/lib/hooks/use-realtime-updates.ts`
- `apps/web/src/components/grid/FieldLockIndicator.tsx`
- `apps/web/src/components/grid/RowPresenceIndicator.tsx`
- `apps/web/src/components/grid/GridCell.tsx` (update — integrate lock indicator)
- `apps/web/src/components/grid/GridRow.tsx` (update — integrate presence indicator)
- `apps/realtime/src/handlers/lock-handler.ts`
- `apps/web/src/components/grid/__tests__/collaboration.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): multi-user collaboration — field locking and real-time coalescing [Phase 3A-ii, Prompt 8]`

### Schema Snapshot

N/A — uses Redis for locks, WebSocket for real-time events. No schema changes.

### Task

Build the multi-user collaboration layer for the grid.

**1. Field-level presence locking (`use-field-lock.ts`):**
- When a user focuses a field (click to edit): acquire lock
- Redis key: `lock:{tenantId}:{recordId}:{fieldId}` → `{ userId, userName, avatarUrl, timestamp }`
- TTL: 60 seconds, renewed on each keystroke
- On blur: release lock (auto-save fires, then lock clears)
- Lock timeout: 60s of no keystrokes → lock auto-expires
- No queue: if locked by another user, field is temporarily non-interactive
- `acquireFieldLock(tenantId, recordId, fieldId)` — returns `{ success: boolean, lockedBy?: { userId, userName, avatarUrl } }`
- `releaseFieldLock(tenantId, recordId, fieldId)` — releases lock
- `renewFieldLock(tenantId, recordId, fieldId)` — extends TTL (called on keystroke)

**2. Lock handler on realtime server (`lock-handler.ts`):**
- Socket.io event handlers: `field:lock`, `field:unlock`, `field:lock_renewed`
- On lock acquire: set Redis key + broadcast `field:locked` to room (table room)
- On lock release: delete Redis key + broadcast `field:unlocked` to room
- On connection disconnect: clean up all locks held by that user

**3. Lock indicator (`FieldLockIndicator.tsx`):**
- When a field is locked by another user: show their avatar on the field (small avatar badge at top-right corner of cell)
- Tooltip: "{userName} is editing"
- Field becomes non-interactive (no click to edit)

**4. Row-level presence (`use-record-presence.ts`):**
- When any user is editing any field in a record: show colored left border on that row
- Color: user's assigned color (use a simple color assignment from a palette based on user index)
- `RowPresenceIndicator.tsx` — renders 3px colored left border

**5. Real-time updates with event coalescing (`use-realtime-updates.ts`):**
- Listen for `record.updated` events via WebSocket
- Buffer window: 100ms of no new events, OR 500ms max
- When buffer flushes: apply all buffered changes as a single batch update to TanStack Query cache
- During buffer: show "Updating..." amber text indicator in grid footer
- Excludes updates made by the current user (already handled by optimistic updates)

**6. GridCell update:**
- Check lock state before allowing edit mode
- If locked by another user: show lock indicator, prevent editing
- On edit start: acquire lock via WebSocket
- On edit end (blur/save): release lock via WebSocket

**7. GridRow update:**
- Show presence indicator when any field in the row is being edited by another user

### Acceptance Criteria

- [ ] Focusing a field acquires a Redis lock with 60s TTL
- [ ] Blur releases the lock
- [ ] Keystroke renews the lock TTL
- [ ] Lock timeout after 60s of inactivity releases the lock
- [ ] Other users see avatar badge on locked fields
- [ ] Locked fields are non-interactive for other users
- [ ] Row-level presence shows colored left border
- [ ] Real-time updates buffer with 100ms idle / 500ms max
- [ ] "Updating..." indicator shows during buffer period
- [ ] Buffered changes apply as batch update to query cache
- [ ] Connection disconnect cleans up all held locks
- [ ] Tests cover lock acquire/release/timeout/conflict scenarios
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Field-level permission integration with locks (3A-iii)
- Cursor sharing / collaborative cell selection (post-MVP)
- Conflict resolution UI for simultaneous edits (lock prevents simultaneous edits)
- Offline edit queue (3H-ii — mobile infrastructure)

---

## Prompt 9: Record View Overlay — Layout, Field Canvas, Navigation, Saved Configs

**Depends on:** None (independent component — uses data layer from 3A-i)
**Load context:** `tables-and-views.md` lines 568–628 (Record View — Layout, Screen Dimensions, Record View as Shared Primitive, Expand Icon, Linked Records, Responsive)
**Target files:**
- `apps/web/src/components/record-view/RecordView.tsx`
- `apps/web/src/components/record-view/RecordViewHeader.tsx`
- `apps/web/src/components/record-view/RecordViewCanvas.tsx`
- `apps/web/src/components/record-view/FieldRenderer.tsx`
- `apps/web/src/components/record-view/use-record-view.ts`
- `apps/web/src/data/record-view-configs.ts`
- `apps/web/src/actions/record-view-actions.ts`
- `apps/web/src/components/record-view/__tests__/RecordView.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(record-view): overlay layout, field canvas, navigation, saved configs [Phase 3A-ii, Prompt 9]`

### Schema Snapshot

```
record_view_configs: id (UUIDv7), tenant_id, table_id, name, layout (JSONB), is_default (boolean),
                     created_by, created_at, updated_at

layout JSONB shape:
{
  columns: number,        // 1–4 (desktop), 1–2 (mobile)
  fields: Array<{
    fieldId: string,
    columnSpan: number,   // 1–4
    height: 'auto' | 'compact' | 'expanded',
    tab: string | null    // tab name, null = default tab
  }>,
  tabs: Array<{ name: string, id: string }>  // optional multi-tab
}
```

### Task

Build the Record View overlay — the configurable field canvas for viewing/editing a single record.

**1. Record View state hook (`use-record-view.ts`):**
- Manages: `isOpen`, `currentRecordId`, `currentConfigId`
- `openRecordView(recordId, configId?)` — opens the overlay for a record
- `closeRecordView()` — closes the overlay
- `navigateRecord(direction: 'prev' | 'next')` — moves to prev/next record in the current table view's record list
- Record View opens when user clicks the expand icon (⤢) on a row (3A-i already renders the icon — wire it here)

**2. Record View overlay (`RecordView.tsx`):**
- Overlay from the right side of the screen
- Width: 60% of main panel (minus icon rail), per GLOSSARY.md dimensions
- Transition: slide in from right (200ms ease)
- Behind overlay: main content dimmed but visible (~20% — `bg-black/20` overlay on grid)
- Grid stays interactive behind the dimmed overlay — clicking a different row updates the Record View
- Close on: ✕ button, Escape key, click outside (on dimmed area)

**3. Record View header (`RecordViewHeader.tsx`):**
- Record name (primary field value), colored by workspace theme
- Navigation arrows (← →) to move between records in the current table view's order
- Close button (✕)
- Chat/thread icon placeholder (functional in 3C — render icon but no-op on click)
- Display table name + view name as breadcrumb

**4. Record View canvas (`RecordViewCanvas.tsx`):**
- White canvas displaying selected fields arranged in columns
- Up to 4 columns on desktop, up to 2 on mobile (<768px)
- Fields rearrangeable via drag-and-drop (use a drag library or HTML5 DnD)
- Fields adjustable in width (spanning 1–4 columns)
- Each field: label (field name + type icon) + value (inline editable — uses same cell edit components from 3A-i)
- Empty fields show field name with empty value area

**5. Field renderer (`FieldRenderer.tsx`):**
- Renders a single field in the Record View canvas
- Reuses the cell renderers from 3A-i `cell-registry.ts` but adapted for the Record View context (larger size, no truncation, full value display)
- Inline editable: click to edit, blur to save (same `use-cell-edit.ts` + `use-optimistic-record.ts` pattern)
- Read-only fields show lock icon

**6. Record View configs data layer (`record-view-configs.ts`):**
- `getRecordViewConfigs(tenantId, tableId)` — returns all saved configs for a table
- `getRecordViewConfigById(tenantId, configId)` — single config
- `getDefaultRecordViewConfig(tenantId, tableId)` — returns the default config (is_default = true), or auto-generates one from all table fields if none exists

**7. Record View config actions (`record-view-actions.ts`):**
- `createRecordViewConfig(tenantId, tableId, data)` — creates a new saved config
- `updateRecordViewConfig(tenantId, configId, layout)` — updates the layout
- `deleteRecordViewConfig(tenantId, configId)` — deletes (cannot delete if referenced by portals/forms — check refs)
- `setDefaultRecordViewConfig(tenantId, tableId, configId)` — sets as default (unsets prior default)

**8. Auto-generated default config:**
- When a table has no Record View configs: generate one automatically showing all fields in 2-column layout, ordered by `field.sort_order`
- This mirrors the "All Records" auto-generated view concept

### Acceptance Criteria

- [ ] Clicking expand icon (⤢) on a row opens Record View overlay
- [ ] Record View slides in from right at 60% width
- [ ] Grid is dimmed but visible behind the overlay
- [ ] Clicking a different row in the dimmed grid updates Record View
- [ ] Navigation arrows (← →) move between records
- [ ] Close button, Escape, and click-outside close the overlay
- [ ] Field canvas renders fields in columns (up to 4)
- [ ] Fields are drag-and-drop rearrangeable
- [ ] Fields are inline editable (same cell edit pattern as grid)
- [ ] Record View config is loaded from `record_view_configs` table
- [ ] Multiple configs can be saved per table
- [ ] Default config auto-generates when none exists
- [ ] `testTenantIsolation()` passes for `getRecordViewConfigs()`, `getRecordViewConfigById()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Record Thread panel alongside Record View (3C)
- Smart Doc editor within Record View (3D)
- Portal rendering mode (3E-i)
- Form rendering mode (3E-ii)
- Field-level permission filtering in Record View (3A-iii)
- Cross-link traversal navigation (3B-i)

---

## Prompt 10: Record View — Inline Editing, Tabs, Linked Record Display, Responsive

**Depends on:** Prompt 9
**Load context:** `tables-and-views.md` lines 583–585 (Tabs), lines 615–620 (Linked Records in Record View), lines 622–628 (Responsive Behavior)
**Target files:**
- `apps/web/src/components/record-view/RecordViewTabs.tsx`
- `apps/web/src/components/record-view/RecordViewCanvas.tsx` (update — tabs integration)
- `apps/web/src/components/record-view/RecordView.tsx` (update — responsive)
- `apps/web/src/components/record-view/LinkedRecordPills.tsx`
- `apps/web/src/components/record-view/__tests__/RecordViewEditing.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(record-view): tabs, linked record display, responsive behavior [Phase 3A-ii, Prompt 10]`

### Schema Snapshot

N/A — uses `record_view_configs.layout` JSONB `tabs` array from Prompt 9.

### Task

**1. Multi-tab Record View (`RecordViewTabs.tsx`):**
- When a Record View config has `tabs`: render tab bar at top of canvas
- Tabs: shadcn/ui Tabs component
- Each tab shows its assigned fields from the layout config
- Default tab (first or `tab: null` fields) is always present
- Add tab / rename tab / delete tab — updates the config's `tabs` array via `updateRecordViewConfig()`
- Drag fields between tabs to reassign

**2. Linked Record display in Record View (`LinkedRecordPills.tsx`):**
- Linked Record fields display as clickable pills showing primary field value
- Click a pill → navigates to that record's Record View (same overlay, contents update — like a stack navigation)
- Back button (←) returns to the previous record
- Maintain a simple navigation stack: `[recordId1, recordId2, ...]`

**3. Multiple saved configs per table:**
- Config picker dropdown in Record View header (next to record name)
- Shows all saved configs for this table
- "Save as new config" option
- Different Table Views of the same table can assign different Record View configs (via `views.config.record_view_config_id`)

**4. Responsive behavior:**

| Breakpoint | Record View | Behavior |
|------------|------------|----------|
| ≥1024px | 60% overlay (or 55% with Thread — Thread ships in 3C) | Side-by-side with grid |
| 768–1023px | 60% overlay | Overlay on grid |
| <768px | Full-screen sheet, single column | Stacked layout, 1–2 columns max |

- At <768px: Record View becomes a full-screen bottom sheet instead of side overlay
- At <768px: field canvas uses 1 column layout
- Use responsive Tailwind classes

**5. Field-level inline editing polish:**
- Ensure all cell edit components from 3A-i work correctly in the Record View context (larger dimensions, no cell truncation)
- Tab between fields: Tab key moves focus to next field in layout order
- Enter: saves current field

### Acceptance Criteria

- [ ] Multi-tab Record View renders tab bar when config has tabs
- [ ] Switching tabs shows different field sets
- [ ] Add/rename/delete tabs works
- [ ] Linked Record pills are clickable → navigates to linked record
- [ ] Back button returns to previous record in navigation stack
- [ ] Config picker shows all saved configs for the table
- [ ] "Save as new config" creates a new config
- [ ] At <768px: Record View renders as full-screen sheet
- [ ] At <768px: field canvas uses single column
- [ ] Tab key moves between fields in Record View
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Record Thread panel (3C)
- Inline Sub-Table display (Prompt 13)
- Portal record rendering (3E-i)
- Cross-link creation Link Picker (3B-i)

---

## Integration Checkpoint 3 (after Prompts 8–10)

**Task:** Verify all work from Prompts 8–10 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: Field locking shows avatar when another user edits. Record View opens from expand icon. Record View fields are inline editable. Tab navigation works. Linked Record pills navigate. Responsive layout at different breakpoints.

**Git:** Commit with message `chore(verify): integration checkpoint 3 [Phase 3A-ii, CP-3]`, then push branch to origin.

Fix any failures before proceeding to Prompt 11.

---

## Prompt 11: Card View — Layouts, RecordCard Component, Inline Editing

**Depends on:** Prompt 9 (Record View — Card View opens Record View on card click)
**Load context:** `tables-and-views.md` lines 631–668 (Card View — Card Layout, Card Content, Filtering & Customization, RecordCard Unified Component)
**Target files:**
- `apps/web/src/components/card-view/CardView.tsx`
- `apps/web/src/components/card-view/RecordCard.tsx`
- `apps/web/src/components/card-view/CardViewToolbar.tsx`
- `apps/web/src/lib/hooks/use-card-view.ts`
- `apps/web/src/components/card-view/__tests__/CardView.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(card-view): layouts, RecordCard component, inline editing [Phase 3A-ii, Prompt 11]`

### Schema Snapshot

```
views: view_type = 'card', config (JSONB):
{
  ...common config (sorts, filters, groups, hidden_fields)...
  card_layout: 'single_column' | 'grid' | 'compact_list',
  card_columns: 2 | 3,    // only for grid layout
  field_config: string[]   // ordered field IDs shown on card
}
```

### Task

Build Card View as an alternative Table View type alongside Grid.

**1. Card View (`CardView.tsx`):**
- Renders records as cards instead of grid rows
- Three layouts (Manager sets default, users can override):

| Layout | Description | Best For |
|--------|-------------|----------|
| **Single column** | Full-width cards, vertical scroll | Detailed records |
| **Grid (2–3 cols)** | Fixed grid, equal-height cards with internal scroll | Overview scanning |
| **Compact list** | Narrow cards, key fields only | Large record sets |

- Uses same data source as grid (same `useGridData` hook)
- Same toolbar with view controls (filter/sort/group/color — reuse GridToolbar from Prompt 6, or extract shared ViewToolbar)

**2. RecordCard component (`RecordCard.tsx`):**
- Unified component used across desktop + mobile (mobile adapts via props in 3H-i)
- Props:

| Prop | Desktop/Tablet | Phone (3H-i) |
|------|----------------|---------------|
| `swipeActions` | `false` | `true` |
| `badges` | Status only | Status + priority + overdue + unread + sync |
| `tapBehavior` | Opens Record View overlay | Full-screen Record View sheet |
| `layout` | Configurable | Always compact list |

- Fields displayed in order defined by view's `field_config`
- Fields are inline editable — click, edit, blur to save (same cell edit pattern)
- Card height: variable based on field count. Internal scroll after 80vh
- Smart Doc fields show preview (first ~3 lines + "Expand")
- Expand icon (⤢) at top-right corner on hover → opens Record View overlay

**3. Card View toolbar (`CardViewToolbar.tsx`):**
- Reuse or extend the toolbar pattern from Prompt 6
- Same controls: filter, sort, group, color, hide fields, density
- Layout picker: single column / grid / compact list
- Column count picker for grid layout: 2 or 3 columns

**4. Card View with grouping:**
- When groups are active: cards grouped under group headers (same GroupHeader from Prompt 4)
- Cards rendered within each group

**5. State hook (`use-card-view.ts`):**
- Manages card-specific state: layout, column count, field config
- Persists to `views.config` for Card View type views

### Acceptance Criteria

- [ ] Card View renders records as cards
- [ ] Three layout modes: single column, grid (2–3 cols), compact list
- [ ] RecordCard shows fields in configured order
- [ ] Fields are inline editable on cards
- [ ] Expand icon opens Record View overlay
- [ ] Card View shares filter/sort/group with Grid View (same toolbar)
- [ ] Grouping works in Card View (cards within group headers)
- [ ] Smart Doc fields show preview with "Expand"
- [ ] Card height scrolls internally after 80vh
- [ ] Layout picker switches between layouts
- [ ] Config persists to view config
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Component tests for RecordCard (3 layouts)
- [ ] No hardcoded English strings

### Do NOT Build

- Mobile swipe actions on RecordCard (3H-i)
- Mobile compact list as default (3H-i)
- Kanban view (post-MVP)
- Gallery view (post-MVP)

---

## Prompt 12: Sections — Universal List Organizer

**Depends on:** None (independent UI primitive)
**Load context:** `tables-and-views.md` lines 672–701 (Sections — Universal List Organizer)
**Target files:**
- `apps/web/src/components/sections/SectionList.tsx`
- `apps/web/src/components/sections/SectionHeader.tsx`
- `apps/web/src/components/sections/use-sections.ts`
- `apps/web/src/data/sections.ts`
- `apps/web/src/actions/section-actions.ts`
- `apps/web/src/components/sections/__tests__/Sections.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(sections): universal list organizer [Phase 3A-ii, Prompt 12]`

### Schema Snapshot

```
sections: id (UUIDv7), tenant_id, name, context (VARCHAR — view_switcher|automations|sidebar_tables|
           cross_links|documents|other), scope ('personal'|'shared'), parent_list_id (nullable —
           the container entity ID), sort_order, collapsed_default (boolean), created_by,
           created_at, updated_at

Items reference sections via nullable section_id FK column (already on relevant tables).
```

### Task

Build Sections as a reusable UI primitive for organizing any list in the application.

**1. Sections data layer (`sections.ts`):**
- `getSectionsByContext(tenantId, context, parentListId, userId)` — returns sections for a context. Includes both shared (scope='shared') and personal (scope='personal', created_by=userId)
- `getSectionById(tenantId, sectionId)` — single section lookup

**2. Section actions (`section-actions.ts`):**
- `createSection(tenantId, data)` — creates a section. Personal sections: any user. Shared (Manager+): visible to all workspace members
- `updateSection(tenantId, sectionId, data)` — rename, reorder
- `deleteSection(tenantId, sectionId)` — deletes section. Items in the section move to top level (section_id set to null)
- `moveItemToSection(tenantId, itemId, sectionId)` — moves an item into a section (updates the item's section_id FK)
- `reorderSections(tenantId, sectionIds)` — reorders sections by updating sort_order

**3. Section header (`SectionHeader.tsx`):**
- Styled divider row with: collapse chevron (▶/▼) + name + item count when collapsed
- Click header: toggle collapse
- Collapse state persists per user (in local storage or `user_view_preferences`)
- Right-click: Rename, Delete
- Inline rename on double-click

**4. Section list (`SectionList.tsx`):**
- Renders a list of items organized into sections
- Generic — accepts `items`, `sections`, and a render function for items
- Drag-and-drop: reorder sections, drag items into/out of sections
- Empty sections allowed (rendered with "No items" placeholder)
- Unsectioned items render at the top (before any sections)

**5. Two tiers (per reference doc):**
- **Personal sections (any user):** visible only to creator
- **Manager-created sections (Manager+):** default grouping visible to all workspace members
- Members see Manager sections + their own personal sections alongside

**6. Initial integration points:**
- View switcher (Prompt 7): group views into sections — add section_id to view switcher rendering
- Sidebar table list: group tables into sections (integrate with existing sidebar navigation from 1J)
- Future integration points (automations list, documents list, cross-links list) are extension points only — no code for them now

### Acceptance Criteria

- [ ] Sections render as collapsible headers in a list
- [ ] Items can be dragged into/out of sections
- [ ] Sections can be reordered via drag-and-drop
- [ ] Personal sections visible only to creator
- [ ] Shared sections (Manager+) visible to all
- [ ] Empty sections render with placeholder
- [ ] Delete section moves items to top level
- [ ] Inline rename works
- [ ] Collapse state persists per user
- [ ] `testTenantIsolation()` passes for `getSectionsByContext()`
- [ ] View switcher integrates sections for grouping views
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Automations list sections (Phase 4)
- Documents list sections (3D)
- Section permission enforcement (3A-iii)
- Nested sections (not specced — single level only)

---

## Prompt 13: Inline Sub-Table Display for Linked Record Fields

**Depends on:** Prompts 9, 10 (Record View — sub-table renders within Record View)
**Load context:** `tables-and-views.md` lines 705–811 (Inline Sub-Table Display for Linked Records)
**Target files:**
- `apps/web/src/components/record-view/InlineSubTable.tsx`
- `apps/web/src/components/record-view/InlineSubTableRow.tsx`
- `apps/web/src/components/record-view/use-inline-sub-table.ts`
- `apps/web/src/data/cross-links.ts` (create — query linked records)
- `apps/web/src/components/record-view/__tests__/InlineSubTable.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(record-view): inline sub-table display for linked record fields [Phase 3A-ii, Prompt 13]`

### Schema Snapshot

```
fields.config.display (when style = 'inline_table'):
{
  style: 'inline_table',
  inline_columns: string[],       // field IDs from linked table to show as columns
  inline_column_widths: Record<string, number>,
  allow_inline_create: boolean,
  allow_inline_delete: boolean,
  allow_reorder: boolean,
  max_visible_rows: 10,
  empty_state_text: string
}

Available display styles for Linked Record fields:
- pills (default): clickable chips showing display field
- inline_table: embedded editable grid
```

### Task

Build the Inline Sub-Table widget that displays linked records as an embedded mini-grid within Record View.

**1. Inline Sub-Table component (`InlineSubTable.tsx`):**
- Renders within Record View when a Linked Record field has `display.style = 'inline_table'`
- Widget elements:
  - **Search bar** — filter existing linked records or find new ones to link (placeholder — Link Picker ships in 3B-i)
  - **Linked record list** — rows with configured columns from `inline_columns`. Max visible rows from config (default 10), scroll for more
  - **Creation row** — blank row at bottom. Type to create and link in one action (if `allow_inline_create`)
  - **Delete button** (ⓧ) on each row (if `allow_inline_delete`)

**2. Inline Sub-Table row (`InlineSubTableRow.tsx`):**
- Renders a single linked record as a row in the mini-grid
- Columns defined by `inline_columns` field IDs
- Cells are inline editable — spreadsheet-like:
  - Click "+ Add Row" → new empty row, cursor in first cell
  - Type and Tab through columns. Auto-save on blur
  - Enter on last column → save row, create new blank row
  - Escape → revert cell. If entire row empty, delete it
- Reuses cell renderers from 3A-i but in a compact form

**3. Cross-link data queries (`cross-links.ts`):**
- `getLinkedRecords(tenantId, recordId, fieldId)` — returns linked records for a Linked Record field. Queries `cross_link_index` for pairs, then fetches target records
- `getLinkedRecordCount(tenantId, recordId, fieldId)` — returns count for grid display

**4. Grid cell rendering for inline_table fields:**
- In the grid: Linked Record fields with `display.style = 'inline_table'` show compact summary: "3 items"
- Clicking opens Record View scrolled to the sub-table section
- (Post-MVP: grid summary includes aggregated values like "3 items · $6,100" when rollups available)

**5. Mobile rendering (<768px):**
- Compact summary + action links:
  ```
  Line Items
  3 items
  [ View All ]  [ + Add ]
  ```

**6. Permissions awareness (stubs):**
- Column visibility respects linked table's field permissions (stub — full enforcement in 3A-iii)
- "+ Add Row" visible only if user would have `create` permission on linked table (stub — check `roleAtLeast('manager')` for now)
- Delete icon visible only if user would have `delete` permission (stub)

### Acceptance Criteria

- [ ] Inline Sub-Table renders in Record View for Linked Record fields with `inline_table` display style
- [ ] Configured columns show from `inline_columns`
- [ ] Rows are inline editable (click → edit → tab → auto-save)
- [ ] Creation row creates and links a new record
- [ ] Delete button removes link (and optionally deletes the record)
- [ ] Max visible rows limits display, scroll for more
- [ ] Grid cell shows "N items" summary for inline_table linked fields
- [ ] Mobile renders compact summary with action buttons
- [ ] `getLinkedRecords()` queries cross_link_index correctly
- [ ] `testTenantIsolation()` passes for `getLinkedRecords()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Link Picker modal for searching/adding linked records (3B-i)
- Cross-link resolution at L1/L2 depth (3B-i)
- Summary row with aggregation (post-MVP — requires rollups)
- Display value maintenance / cache (3B-i)

---

## Prompt 14: CSV Import — 5-Step Guided Flow

**Depends on:** None (standalone feature, uses record creation from 3A-i)
**Load context:** `tables-and-views.md` lines 814–841 (CSV/Data Import — MVP)
**Target files:**
- `apps/web/src/components/import/CsvImportWizard.tsx`
- `apps/web/src/components/import/ImportUpload.tsx`
- `apps/web/src/components/import/ImportPreview.tsx`
- `apps/web/src/components/import/ImportFieldMapping.tsx`
- `apps/web/src/components/import/ImportValidation.tsx`
- `apps/web/src/components/import/ImportExecution.tsx`
- `apps/web/src/actions/import-actions.ts`
- `apps/web/src/components/import/__tests__/CsvImport.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(import): CSV import 5-step guided flow [Phase 3A-ii, Prompt 14]`

### Schema Snapshot

N/A — uses existing `records` table + `createRecord()` Server Action from 3A-i. No new tables.

### Task

Build the 5-step CSV import wizard. Manager+ only.

**1. CSV Import Wizard (`CsvImportWizard.tsx`):**
- Multi-step wizard (shadcn/ui Tabs or step indicator pattern)
- 5 steps, linear flow with back/next navigation
- Opens from "Import" button in grid toolbar (add button to toolbar)

**2. Step 1 — Upload (`ImportUpload.tsx`):**
- Accepts `.csv` and `.tsv` files via file input or drag-and-drop zone
- Max file size: 10MB
- File parsed client-side using Papaparse (add as dependency)
- Show file name + size after selection
- Error on invalid file type or oversized file

**3. Step 2 — Preview & Header Detection (`ImportPreview.tsx`):**
- First 10 rows displayed in a preview table
- "First row is header" toggle (default on — auto-detect)
- Column count shown
- If header row toggled: first row becomes column names

**4. Step 3 — Field Mapping (`ImportFieldMapping.tsx`):**
- Each CSV column mapped to an EveryStack field via dropdown
- Auto-mapping: fuzzy match column headers to field names (case-insensitive, ignore spaces/underscores)
- Unmapped columns shown in gray with "Skip" label
- User can reassign or skip any column
- Primary field mapping is required — show validation error if not mapped
- Dropdown shows field name + type icon

**5. Step 4 — Validation Preview (`ImportValidation.tsx`):**
- Dry-run validation using `FieldTypeRegistry.validate()` (or equivalent) on first 100 rows
- Results per column: green checkmark = all valid, amber warning icon = N rows with issues (click to expand)
- Issue types: type mismatches (text in number field), values exceeding max_length, invalid select option values
- User can: fix CSV and re-upload, or proceed (invalid values skipped per-cell, not per-row)

**6. Step 5 — Import Execution (`ImportExecution.tsx`):**
- `importRecords` Server Action processes in batches of 100 rows
- Each batch: validate → create records via `createRecord()` (standard creation path)
- Progress bar shown (N of total processed)
- On completion: summary toast "Imported 847 of 850 records. 3 rows had errors."
- Link to error report (downloadable CSV of failed rows with error reasons)

**7. Import Server Action (`import-actions.ts`):**
- `importRecords(tenantId, tableId, data)` — processes the mapped CSV data
- Validates role: Manager+ required
- Plan limits: check record quota before processing. If would exceed: "This import would exceed your plan's record limit ({current}/{max}). Import the first {available} rows?"
- Batch processing: 100 rows per batch
- Uses `createRecord()` from 3A-i for each record (ensures validation, audit logging, search vector updates)
- Returns: `{ imported: number, failed: number, errors: Array<{ row: number, field: string, error: string }> }`
- Blocked for synced tables (read-only for inbound sync data)

### Acceptance Criteria

- [ ] Import button visible in toolbar for Manager+ only
- [ ] CSV/TSV file upload with 10MB limit
- [ ] File parsed with Papaparse client-side
- [ ] Preview shows first 10 rows with header detection toggle
- [ ] Field mapping auto-matches column headers to field names
- [ ] Primary field mapping is required
- [ ] Validation preview shows per-column pass/fail status
- [ ] Import executes in batches of 100 with progress bar
- [ ] Summary toast shows imported/failed counts
- [ ] Failed rows downloadable as CSV error report
- [ ] Plan limit check prevents exceeding record quota
- [ ] Synced tables block import
- [ ] Manager+ role check on import action
- [ ] `testTenantIsolation()` passes for `importRecords()`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings

### Do NOT Build

- Excel (.xlsx) import (post-MVP)
- Linked Record resolution during import (post-MVP)
- Update existing records by match (post-MVP)
- Import into synced tables (blocked)
- CSV export (minimal — browser-based only, no dedicated feature)

---

## Prompt 15: Record Deletion, Responsive Grid Polish, Grid + Record View Combined Layout

**Depends on:** Prompts 9, 10, 11 (Record View and Card View)
**Load context:** `tables-and-views.md` lines 451–482 (Grid + Record View Layout), lines 551–565 (Record Deletion, Responsive Grid, Loading & Empty States)
**Target files:**
- `apps/web/src/components/grid/DataGrid.tsx` (update — combined layout with Record View)
- `apps/web/src/components/grid/BulkActionsToolbar.tsx` (update — compress when Record View open)
- `apps/web/src/components/grid/GridLoadingState.tsx` (update if needed)
- `apps/web/src/components/record-view/RecordView.tsx` (update — combined layout)
- `apps/web/src/components/grid/__tests__/combined-layout.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): record deletion, responsive polish, grid + record view combined layout [Phase 3A-ii, Prompt 15]`

### Schema Snapshot

N/A — no schema changes.

### Task

Polish the integration between Grid, Record View, and Card View.

**1. Grid + Record View combined layout:**

Per reference doc dimensions:

```
Record View only:
┌──────┬────────────┬───────────────────────────┐
│ Icon │  Grid      │  Record View         60%  │
│ Rail │  (dimmed)  │  (overlay from right)     │
│ 48px │   40%      │  [Field canvas]           │
└──────┴────────────┴───────────────────────────┘

Record View + Record Thread (placeholder for 3C):
┌──────┬──────┬─────────────────────┬───────────┐
│ Icon │ Grid │  Record View   55%  │ Record    │
│ Rail │(dim) │                     │ Thread    │
│ 48px │ 20%  │  [Field canvas]     │ 25%       │
└──────┴──────┴─────────────────────┴───────────┘
```

- Record View overlay dimensions relative to full screen (minus icon rail)
- Grid stays interactive behind dimmed overlay — clicking a different row updates Record View
- Record Thread placeholder: just reserve the 25% panel space — no content until 3C

**2. Bulk Actions + Record View interaction:**
- When Record View is open and rows are selected: compress bulk toolbar to icon-only strip
- Icons-only mode: delete (trash), duplicate (copy), copy (clipboard) — no labels
- Selection count still visible as a small badge

**3. Quick Panel + Record View overlay:**
```
┌──────┬───────┬──────────┬─────────────────────┐
│ Icon │Quick  │Grid      │ Record View    60%  │
│ Rail │Panel  │(dimmed)  │ (overlay on main)   │
│ 48px │25%    │ 15%      │                     │
└──────┴───────┴──────────┴─────────────────────┘
```
- When Quick Panel is open (sidebar expanded to Quick Panel mode from 1J): Record View overlay dimensions remain relative to full screen

**4. Record deletion polish:**
- Single record delete from row context menu: soft delete (`deleted_at` timestamp), undo toast (10s). Uses `deleteRecord()` from 3A-i
- Bulk delete from bulk toolbar (Prompt 1): confirmation dialog for 2+ records, no undo after confirm
- Deleted records disappear from grid immediately (optimistic) with rollback on server error

**5. Responsive grid polish:**
- Tablet (768–1023px): grid with horizontal scroll. Column resizing via touch
- Mobile (<768px): grid with horizontal scroll. Simplified toolbar
- Ensure all grid features degrade gracefully on smaller screens
- Loading states: skeleton shimmer (GridSkeleton from 3A-i) — verify it matches the current column layout shape
- Empty state: GridEmptyState from 3A-i — verify "No records yet" + "+ New Record" button works

### Acceptance Criteria

- [ ] Record View opens at 60% with grid at 40% behind
- [ ] Grid remains interactive behind dimmed overlay
- [ ] Clicking different row in grid updates Record View content
- [ ] Bulk toolbar compresses to icons when Record View is open
- [ ] Quick Panel + Record View layout works correctly
- [ ] Single record delete shows undo toast (10s)
- [ ] Bulk delete shows confirmation dialog for 2+ records
- [ ] Deleted records disappear immediately (optimistic)
- [ ] Grid scrolls horizontally on tablet/mobile
- [ ] Loading skeleton matches column layout
- [ ] Empty state shows "+ New Record" button
- [ ] ESLint and TypeScript compile with zero errors
- [ ] No hardcoded English strings

### Do NOT Build

- Record Thread panel content (3C)
- Quick Panel content (3G-ii — My Office)
- Mobile-specific grid optimizations (3H-i)

---

## Integration Checkpoint 4 — Final (after Prompts 11–15)

**Task:** Verify all work from Prompts 11–15 and the entire 3A-ii phase integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met for all changed packages
6. Manual verification:
   - Grid: select rows → bulk toolbar → delete/duplicate/edit. Sort + filter + group together. Color rules apply. Summary footer aggregations. View switcher shows My/Shared views. Create and switch views. Hide/show fields
   - Record View: open from expand icon → inline edit fields → navigate between records → tabs → linked record pills → responsive at different breakpoints
   - Card View: switch to card view → 3 layouts → inline editing → grouping
   - Sections: create sections in view switcher → drag views into sections → collapse/expand
   - Inline Sub-Table: linked record field with inline_table config → mini-grid in Record View → add/edit/delete rows
   - CSV Import: upload CSV → preview → map fields → validate → import → verify records created
   - Collaboration: two browser windows → edit same field → lock indicator appears → real-time updates propagate

**Git:** Commit with message `chore(verify): integration checkpoint 4 — final [Phase 3A-ii, CP-4]`, then push branch to origin. Open PR to main with title `[Step 3] Phase 3A-ii — View Features, Record View, Card View & Data Import`.
