# Phase 3A-ii — View Features, Record View, Card View & Data Import — Prompting Roadmap

## Overview

- **Sub-phase:** 3A-ii — View Features, Record View, Card View & Data Import
- **Playbook:** `docs/Playbooks/playbook-phase-3a-ii.md`
- **Prior sub-phase:** Phase 3A-i (Grid View Core — Layout, Cell Renderers & Inline Editing) — merged to main
- **Total building prompts:** 15 (plus 4 integration checkpoints)
- **Estimated duration:** 3–4 sessions across all 6 lifecycle steps

## Section Index

| Section | Summary |
|---------|---------|
| Overview | Sub-phase metadata, 15 building prompts, 4 checkpoints, 3-4 session estimate |
| Step 0 — Doc Prep | Verify tables-and-views.md, design-system.md, glossary terms |
| Step 3 — Build Execution | 15 prompts: selection, sort, filter, group, color, toolbar, views, collaboration, Record View, Card View, sections, sub-table, CSV, deletion |

---

## STEP 0 — DOC PREP (Architect Agent)

Covers What This Step Does, 0.1 — Create the docs branch, 0.2 — Run the Architect Agent, 0.3 — Review and merge.
See `tables-and-views.md`, `design-system.md`.

### What This Step Does

Before building the view features layer, we need to verify that the reference docs (particularly `tables-and-views.md` and `design-system.md`) are current and consistent with the 3A-i codebase that was just merged. This ensures Claude Code builds against accurate specs — especially for view config JSONB shapes, Record View dimensions, and Card View layouts.

### 0.1 — Create the docs branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b docs/phase-3a-ii-prep
```

### 0.2 — Run the Architect Agent

Open Claude Code in the monorepo. Paste:

[PASTE INTO CLAUDE CODE]
```
You are the Architect Agent for EveryStack, preparing docs for Phase 3A-ii (View Features, Record View, Card View & Data Import).

Read these skill files first:
- docs/skills/architect/SKILL.md
- docs/skills/phase-context/SKILL.md

Your mandate: ensure all reference docs consumed by Phase 3A-ii are stable, consistent, and up to date before the build begins.

Tasks:
1. Read docs/reference/tables-and-views.md — verify the sections on Selection & Bulk Actions (lines 372–381), Sorting (lines 392–394), Filtering (lines 404–410), Grouping (lines 382–391), Color Coding & Summary Footer (lines 395–429), Grid Toolbar (lines 430–449), My Views & Shared Views (lines 506–526), Multi-User Collaboration (lines 527–550), Record View (lines 568–628), Card View (lines 631–668), Sections (lines 672–701), Inline Sub-Table (lines 705–811), CSV Import (lines 814–841), Record Deletion (lines 551–565), and Grid + Record View Layout (lines 451–482) are complete and reference the correct schema shapes.
2. Read docs/reference/design-system.md — verify Process State Color Language (lines 139–152) and Progressive Disclosure (lines 247–260) sections are current.
3. Read docs/reference/GLOSSARY.md — verify all terms used in the Phase 3A-ii playbook exist (Record View, Card View, Table View, Sections, Inline Sub-Table, CSV Import, Summary Footer, Color Coding, field-level presence locking).
4. Update docs/reference/MANIFEST.md if any line counts changed.
5. Run a consistency check: glossary terms match usage, MANIFEST is current, no stale cross-references in the sections above.

Forbidden:
- Do NOT modify any application code (src/, apps/, packages/)
- Do NOT create build/ branches
- Only touch files under docs/
```

### 0.3 — Review and merge

[CHECKPOINT]
```
Review the diff:
  git diff main...docs/phase-3a-ii-prep
Look for:
- MANIFEST.md line counts updated for changed docs
- No undefined glossary terms in changed sections
- Dependency graph still holds
- ADR written if a design decision was made
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: phase-3a-ii prep — verify tables-and-views, design-system, glossary"
git push origin docs/phase-3a-ii-prep
```

Open a PR titled "[Step 0] Phase 3A-ii — Doc Prep: tables-and-views verification".
Review the diff. Merge to main. Delete the branch.

[DECISION POINT]
```
If no doc changes were needed:
  → Skip directly to Step 3. No branch, no PR.

If doc changes are merged:
  → Proceed to Step 3.
```

---

## STEP 1 — PLAYBOOK GENERATION

### What This Step Does

You already have the playbook for this sub-phase — it was produced before this roadmap. If you're reading this roadmap, Step 1 is complete.

The playbook is at: `docs/Playbooks/playbook-phase-3a-ii.md`

---

## STEP 2 — PROMPTING ROADMAP GENERATION

You're reading the output of Step 2. Proceed to Step 3.

---

## STEP 3 — BUILD EXECUTION (Builder Agent)

Covers Setup, PROMPT 1: Selection & Bulk Actions Toolbar, PROMPT 2: Multi-Level Sorting with Sort Panel, PROMPT 3: Filtering — Quick Filters + Full Filter Builder, PROMPT 4: Multi-Level Grouping with Collapsible Groups, INTEGRATION CHECKPOINT 1 (after Prompts 1–4).
Touches `inline_table` tables. See `use-row-selection.ts`, `use-grid-store.ts`, `record-actions.ts`.

### Setup

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b build/3a-ii-view-features
```

Open Claude Code. Load skills:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

### PROMPT 1: Selection & Bulk Actions Toolbar

**What This Builds:**
This prompt creates the ability to select multiple rows in the grid and perform actions on them all at once — like deleting, duplicating, or editing a field value across many records. Think of it like selecting multiple emails in Gmail and hitting "Delete" or "Archive." When you select 2 or more rows, a toolbar appears with action buttons.

**What You'll See When It's Done:**
Claude Code will create/update files in `apps/web/src/components/grid/`. You should see a new `BulkActionsToolbar.tsx`, a `use-row-selection.ts` hook, and updates to `DataGrid.tsx`, `use-grid-store.ts`, and `record-actions.ts`. Tests should pass with green checkmarks. The grid will support checkbox selection, shift+click range select, and a bulk actions toolbar.

**How Long This Typically Takes:** 5–10 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 1 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds the Selection & Bulk Actions Toolbar.

Load context: tables-and-views.md lines 372–381 (Selection & Bulk Actions), lines 551–555 (Record Deletion)

Key deliverables:
- Row selection hook (use-row-selection.ts) with header checkbox, individual checkboxes, shift+click range, cmd+click toggle, cmd+A
- Bulk actions toolbar (BulkActionsToolbar.tsx) appearing when 2+ rows selected with: delete, edit field value, duplicate, copy, clear selection
- Bulk Server Actions: bulkDeleteRecords (max 500), bulkUpdateRecordField (max 500), duplicateRecords (max 100), restoreRecord
- Single record delete: 10s undo toast. Bulk delete: confirmation dialog, no undo after confirm
- All actions validate tenantId via getAuthContext() and use getDbForTenant(tenantId, 'write')
- All use Zod for input validation
- testTenantIsolation() for all new data access functions
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Filtering integration (Prompt 3)
- Record View interaction with bulk toolbar (Prompt 15)
- Permission checks on bulk operations (3A-iii)
- Cross-link cascade on delete (3B-i)

Git: Commit with message "feat(grid): selection and bulk actions toolbar [Phase 3A-ii, Prompt 1]"
```

[CHECKPOINT]
```
Look for:
- BulkActionsToolbar.tsx created
- use-row-selection.ts created
- record-actions.ts updated with bulk operations
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 2: Multi-Level Sorting with Sort Panel

**What This Builds:**
This prompt adds the ability to sort your grid by one or more columns — just like sorting a spreadsheet. You can click a column header to cycle through ascending/descending sort, or open a sort panel to set up multi-level sorts (e.g., sort by Status first, then by Date within each status). The sort configuration saves to your view settings.

**What You'll See When It's Done:**
Claude Code will create `SortPanel.tsx`, `use-sort.ts`, and update `GridHeader.tsx`, `use-grid-store.ts`, `records.ts`, and `view-actions.ts`. Column headers will show sort arrows. The sort panel will open via Cmd+Shift+S. Manual row reorder will be disabled when sort is active.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 2 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Multi-Level Sorting with Sort Panel UI.

Load context: tables-and-views.md lines 392–394 (Sorting), lines 195–203 (Column header interactions — sort indicator)

Key deliverables:
- Sort state hook (use-sort.ts) managing sorts array in grid store with addSort, removeSort, toggleSort, reorderSorts, clearSorts
- Column header sort interaction: click cycles none → asc → desc → none, with ArrowUp/ArrowDown icons
- Sort Panel (SortPanel.tsx): lists sort levels with drag handles, field dropdown + direction toggle + remove, add sort button, max 3 levels
- Sorted data queries: getRecordsByTable() accepts sorts, builds Drizzle orderBy with appropriate casting (numeric, timestamp, LOWER for text), nulls last/first
- Disable manual row reorder when sort active, with tooltip
- Sort config persists to views.config.sorts via updateViewConfig()
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Grid toolbar integration (Prompt 6)
- Filter builder (Prompt 3)
- Grouping (Prompt 4)
- Server-side sort in API layer (Phase 6)

Git: Commit with message "feat(grid): multi-level sorting with sort panel [Phase 3A-ii, Prompt 2]"
```

[CHECKPOINT]
```
Look for:
- SortPanel.tsx created
- use-sort.ts created
- GridHeader.tsx updated with sort indicators
- records.ts updated with sorted queries
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 3: Filtering — Quick Filters + Full Filter Builder

**What This Builds:**
This prompt creates two ways to filter your data. First, quick filters — click a column header's filter icon and get a simple dropdown to filter by that column. Second, a full filter builder panel where you can combine multiple conditions with AND/OR logic, create nested groups, and build complex queries. Think of it like the advanced search in any email app, but for your database records.

**What You'll See When It's Done:**
Claude Code will create `FilterBuilder.tsx`, `QuickFilterPopover.tsx`, `use-filters.ts`, `filter-types.ts`, and update `records.ts` and `GridHeader.tsx`. Columns with active filters will show a colored dot indicator. The filter builder will open via Cmd+Shift+F.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 3 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Filtering — Quick Filters + Full Filter Builder.

Depends on: Prompt 2 (sort infrastructure patterns shared)
Load context: tables-and-views.md lines 404–410 (Filtering), design-system.md lines 247–260 (Progressive Disclosure)

Key deliverables:
- Filter types (filter-types.ts): FilterCondition, FilterGroup, FilterConfig types + Zod schemas, operator sets per field type (text, number, date, select, multi-select, checkbox, people with $me token, linked record, rating), getOperatorsForFieldType()
- Filter state hook (use-filters.ts): manages filter config in grid store with addCondition, removeCondition, updateCondition, addGroup, setLogic, clearFilters. Active filter count computed
- Quick filter popover (QuickFilterPopover.tsx): field-appropriate dropdown from column header, type-specific value inputs
- Full filter builder (FilterBuilder.tsx): all conditions with field/operator/value dropdowns, top-level AND/OR toggle, nested groups with indentation, add condition/group/clear all
- Filtered data queries (records.ts update): getRecordsByTable() accepts filters, builds Drizzle where() clauses, AND/OR logic, nested groups, $me token resolution, is_empty/is_not_empty
- Header filter indicator: colored dot on filtered columns
- Header checkbox "select all" respects active filters
- Filter config persists to views.config.filters
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Grid toolbar integration (Prompt 6)
- Row-level visibility filters for permissions (3A-iii)
- Server-side filtering for API (Phase 6)
- Saved filter presets (post-MVP)

Git: Commit with message "feat(grid): filtering — quick filters and filter builder [Phase 3A-ii, Prompt 3]"
```

[CHECKPOINT]
```
Look for:
- FilterBuilder.tsx, QuickFilterPopover.tsx, use-filters.ts, filter-types.ts created
- records.ts updated with filtered queries
- GridHeader.tsx updated with filter dot indicator
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 4: Multi-Level Grouping with Collapsible Groups

**What This Builds:**
This prompt adds the ability to group your records by field values — like grouping a project list by Status (To Do, In Progress, Done) with collapsible sections. You can group by up to 3 levels deep (e.g., by Department, then by Status, then by Priority). Each group shows a header with record count, and you can drag records between groups to change their values.

**What You'll See When It's Done:**
Claude Code will create `GroupHeader.tsx`, `GroupFooter.tsx`, `use-grouping.ts`, and update `DataGrid.tsx` and `use-grid-store.ts`. Groups will render as collapsible headers with record counts and per-group aggregation footers.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 4 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Multi-Level Grouping with Collapsible Groups.

Depends on: Prompts 2, 3 (sorting + filtering must work for grouped views)
Load context: tables-and-views.md lines 382–391 (Grouping)

Key deliverables:
- Grouping state hook (use-grouping.ts): manages groups array in grid store, addGroup (max 3), removeGroup, reorderGroups, clearGroups, collapsedGroups Set
- Client-side group computation from loaded records, multi-level nesting, records sorted within groups
- Group header (GroupHeader.tsx): collapsible, shows chevron + field name + value + record count badge, colored pills for Select/Status, 16px indent per level
- Per-group aggregation footer (GroupFooter.tsx): field-type-appropriate summaries per column, lighter background
- Drag records between groups for Select/Status fields (changes record value via updateRecordField)
- DataGrid update: render group headers interspersed with data rows, TanStack Virtual variable height, collapsed groups hidden, keyboard nav skips headers
- Group config persists to views.config.groups
- Sorting within groups respects active sort. Filtering applies before grouping
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Summary footer (whole-table aggregation — Prompt 5)
- Grid toolbar group button (Prompt 6)
- Kanban-style column grouping (post-MVP)
- Server-side grouping (post-MVP)

Git: Commit with message "feat(grid): multi-level grouping with collapsible groups [Phase 3A-ii, Prompt 4]"
```

[CHECKPOINT]
```
Look for:
- GroupHeader.tsx, GroupFooter.tsx, use-grouping.ts created
- DataGrid.tsx updated for grouped rendering
- All tests passing
- No TypeScript or ESLint errors
```

---

### INTEGRATION CHECKPOINT 1 (after Prompts 1–4)

[PASTE INTO CLAUDE CODE]
```
Run the full verification suite for Integration Checkpoint 1:
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: Select multiple rows → bulk actions toolbar appears. Sort by column header click. Filter via quick filter popover. Group by a field → collapsible headers. All three (sort + filter + group) work together.

Fix any failures before proceeding.
```

[CHECKPOINT]
```
All commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): integration checkpoint 1 [Phase 3A-ii, CP-1]"
git push origin build/3a-ii-view-features
```

Review the branch on GitHub before proceeding.

---

### PROMPT 5: Color Coding and Summary Footer

**What This Builds:**
This prompt adds two visual features. First, conditional color coding — you can set rules that tint entire rows or individual cells based on their values (e.g., "highlight overdue tasks in red"). Second, a summary footer row that shows aggregations at the bottom of the grid — sums, averages, counts, etc., depending on the field type. Think of it like the totals row in a spreadsheet.

**What You'll See When It's Done:**
Claude Code will create `ColorRuleBuilder.tsx`, `SummaryFooter.tsx`, `use-color-rules.ts`, `use-summary-footer.ts`, `aggregation-utils.ts`, and update `DataGrid.tsx`. Rows/cells will show color tints, and a sticky footer will display aggregations.

**How Long This Typically Takes:** 8–10 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 5 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Color Coding (conditional row + cell) and Summary Footer.

Depends on: Prompt 4 (grouping provides per-group footer context)
Load context: tables-and-views.md lines 395–429 (Color Coding, Summary Footer Row), design-system.md lines 139–152 (Process State Color Language)

Key deliverables:
- Color coding — row-level background tint + cell-level coloring based on conditions, cell rules higher specificity
- Color rule state (use-color-rules.ts): manages color_rules in view config, addRowRule, addCellRule, removeRule. Uses FilterCondition type from Prompt 3
- Color rule builder (ColorRuleBuilder.tsx): row/cell rule sections, condition builder + color picker palette swatches
- Aggregation utilities (aggregation-utils.ts): shared between summary footer and per-group footers, field-type-specific aggregations (sum/avg/min/max for numbers, earliest/latest for dates, checked/unchecked for checkboxes, count_per_value for selects, etc.)
- Summary footer state (use-summary-footer.ts): setSummaryEnabled, setColumnAggregation, persisted to views.config.summary_footer
- Summary footer component (SummaryFooter.tsx): sticky bottom row, click cell to pick aggregation type, computes and displays values
- Refactor GroupFooter from Prompt 4 to use shared aggregation-utils
- Summary footer respects active filters
- Config persists to views.config
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Sparkline charts in summary cells (post-MVP)
- Custom aggregation functions (post-MVP)
- Aggregation across cross-linked records (post-MVP — requires rollups)

Git: Commit with message "feat(grid): conditional color coding and summary footer [Phase 3A-ii, Prompt 5]"
```

[CHECKPOINT]
```
Look for:
- ColorRuleBuilder.tsx, SummaryFooter.tsx, aggregation-utils.ts created
- use-color-rules.ts, use-summary-footer.ts created
- DataGrid.tsx updated
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 6: Grid Toolbar and Record Count Display

**What This Builds:**
This prompt creates the main toolbar that sits above the grid — the control center for all view features. It has buttons for Hide Fields, Filter, Sort, Group, Color, Density, and more. Each button opens the corresponding panel as a popover. Active states show badges (e.g., "3 active filters"). It also adds a record count display that shows "32 of 247 records" when filtered.

**What You'll See When It's Done:**
Claude Code will create `GridToolbar.tsx`, `HideFieldsPanel.tsx`, `RecordCount.tsx`, and update `DataGrid.tsx`. The toolbar will unify all view controls with proper active state badges, and the record count will update dynamically with filters.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 6 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds the Grid Toolbar and Record Count Display.

Depends on: Prompts 2, 3, 4, 5 (toolbar buttons open sort/filter/group/color panels)
Load context: tables-and-views.md lines 430–449 (Grid Toolbar, Record Count)

Key deliverables:
- Grid Toolbar (GridToolbar.tsx): left group (view switcher placeholder, hide fields, filter, sort, group, color), right group (density toggle, share/export placeholder, overflow menu)
- Active state badges on filter/sort/group/color buttons
- Panels open as popovers (shadcn/ui Popover)
- Hide fields panel (HideFieldsPanel.tsx): toggle visibility, drag-to-reorder, show all/hide all, primary field always visible
- Hidden fields stored in views.config.hidden_fields, not rendered as grid columns
- Record count (RecordCount.tsx): "N of M records" when filtered, "N records" when unfiltered
- Wire toolbar into DataGrid above grid header
- Cmd+Shift+F and Cmd+Shift+S open correct toolbar panels
- No search in toolbar (Command Bar handles search in 3B-ii)
- ESLint and TypeScript compile with zero errors
- No hardcoded English strings

Do NOT build:
- Full view switcher with My Views/Shared Views (Prompt 7)
- Share functionality (post-MVP)
- Export to CSV button (Prompt 14 context)
- Search within toolbar (Command Bar, 3B-ii)

Git: Commit with message "feat(grid): toolbar, hide fields panel, record count [Phase 3A-ii, Prompt 6]"
```

[CHECKPOINT]
```
Look for:
- GridToolbar.tsx, HideFieldsPanel.tsx, RecordCount.tsx created
- DataGrid.tsx updated with toolbar mount
- Keyboard shortcuts wired to toolbar panels
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 7: My Views & Shared Views

**What This Builds:**
This prompt creates the full view management system. Views are like saved configurations of your grid — each view remembers its own filters, sorts, groups, column arrangement, etc. There are two types: "My Views" (personal, only you see them) and "Shared Views" (visible to everyone with access). Managers can promote personal views to shared, and lock shared views to prevent modification. Think of it like browser bookmarks but for grid configurations.

**What You'll See When It's Done:**
Claude Code will create `ViewSwitcher.tsx`, `ViewCreateDialog.tsx`, `use-current-view.ts`, and update `views.ts` and `view-actions.ts`. The view switcher dropdown will show Shared and My Views sections. Creating, switching, promoting, and locking views will work. Personal overrides on shared views will save separately.

**How Long This Typically Takes:** 8–10 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 7 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds My Views & Shared Views.

Depends on: Prompt 6 (toolbar view switcher placeholder)
Load context: tables-and-views.md lines 506–526 (My Views & Shared Views)

Key deliverables:
- View switcher (ViewSwitcher.tsx): dropdown with Shared Views and My Views sections, view name + type icon + lock icon, click to switch, "Create view" button, context menu (rename, duplicate, delete, promote, lock/unlock)
- View create dialog (ViewCreateDialog.tsx): name + type (Grid/Card), "Copy current view config" toggle, My View by default, Manager+ can make shared
- View data layer (views.ts update): getViewsByTable() returns sharedViews/myViews, getUserViewPreferences()
- View actions (view-actions.ts update): createView, promoteView (Manager+), lockView (Manager+ + creator), deleteView (can't delete default "All Records")
- Current view hook (use-current-view.ts): manages active view ID in URL params, loads and applies view config
- User view preferences: shared view modifications save to user_view_preferences, "Reset to shared" removes overrides
- Default view fallback chain verified
- testTenantIsolation() for getViewsByTable(), createView()
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Card View rendering (Prompt 11)
- View sections/grouping (Prompt 12)
- Permission-filtered view visibility (3A-iii)
- Draft/live publish state workflow (post-MVP)

Git: Commit with message "feat(grid): my views and shared views with promotion flow [Phase 3A-ii, Prompt 7]"
```

[CHECKPOINT]
```
Look for:
- ViewSwitcher.tsx, ViewCreateDialog.tsx, use-current-view.ts created
- views.ts and view-actions.ts updated
- All tests passing
- No TypeScript or ESLint errors
```

---

### INTEGRATION CHECKPOINT 2 (after Prompts 5–7)

[PASTE INTO CLAUDE CODE]
```
Run the full verification suite for Integration Checkpoint 2:
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: Grid toolbar renders with all buttons. Filter/sort/group panels open from toolbar. Color rules apply row tints. Summary footer shows aggregations. View switcher shows My/Shared views. Creating and switching views works. Record count updates with filters.

Fix any failures before proceeding.
```

[CHECKPOINT]
```
All commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): integration checkpoint 2 [Phase 3A-ii, CP-2]"
git push origin build/3a-ii-view-features
```

Review the branch on GitHub before proceeding.

---

### PROMPT 8: Multi-User Collaboration — Field-Level Presence Locking & Real-Time Coalescing

**What This Builds:**
This prompt makes the grid collaborative in real-time. When someone else is editing a field, you'll see their avatar on that cell and the field becomes temporarily locked so you can't edit it simultaneously. Rows being edited by others show a colored border. When other users make changes, they appear in your grid automatically with a brief "Updating..." indicator. Think of it like Google Sheets showing other people's cursors, but for field-level editing.

**What You'll See When It's Done:**
Claude Code will create `use-field-lock.ts`, `use-record-presence.ts`, `use-realtime-updates.ts`, `FieldLockIndicator.tsx`, `RowPresenceIndicator.tsx`, `lock-handler.ts`, and update `GridCell.tsx` and `GridRow.tsx`. Locks will use Redis with 60s TTL, and real-time updates will buffer and batch.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 8 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Multi-User Collaboration — Field-Level Presence Locking & Real-Time Coalescing.

Depends on: None (uses 3A-i grid + 1G realtime infrastructure)
Load context: tables-and-views.md lines 527–550 (Multi-User Collaboration — Field-Level Presence & Locking, Real-Time Updates & Event Coalescing)

Key deliverables:
- Field-level presence locking (use-field-lock.ts): Redis key lock:{tenantId}:{recordId}:{fieldId} with 60s TTL, acquireFieldLock, releaseFieldLock, renewFieldLock on keystroke
- Lock handler on realtime server (lock-handler.ts): Socket.io events field:lock/unlock/lock_renewed, Redis key management, broadcast to room, cleanup on disconnect
- Lock indicator (FieldLockIndicator.tsx): avatar badge on locked cells, tooltip "{userName} is editing", field non-interactive
- Row-level presence (use-record-presence.ts): colored left border when another user editing any field in row
- Row presence indicator (RowPresenceIndicator.tsx): 3px colored left border
- Real-time updates (use-realtime-updates.ts): record.updated events buffered 100ms idle OR 500ms max, batch apply to TanStack Query cache, "Updating..." amber indicator, excludes current user's updates
- GridCell update: check lock before edit, acquire on edit start, release on blur
- GridRow update: show presence indicator
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Field-level permission integration with locks (3A-iii)
- Cursor sharing / collaborative cell selection (post-MVP)
- Conflict resolution UI (lock prevents simultaneous edits)
- Offline edit queue (3H-ii)

Git: Commit with message "feat(grid): multi-user collaboration — field locking and real-time coalescing [Phase 3A-ii, Prompt 8]"
```

[CHECKPOINT]
```
Look for:
- use-field-lock.ts, use-record-presence.ts, use-realtime-updates.ts created
- FieldLockIndicator.tsx, RowPresenceIndicator.tsx created
- lock-handler.ts created in apps/realtime/
- GridCell.tsx and GridRow.tsx updated
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 9: Record View Overlay — Layout, Field Canvas, Navigation, Saved Configs

**What This Builds:**
This prompt creates the Record View — a panel that slides in from the right side of the screen when you click a record's expand icon. It shows all the fields for a single record in a configurable canvas layout (up to 4 columns). You can rearrange fields by dragging, navigate between records with arrow buttons, and save multiple layout configurations. Think of it like opening an email in a side panel — you can see the full details without leaving your list.

**What You'll See When It's Done:**
Claude Code will create files in `apps/web/src/components/record-view/`: `RecordView.tsx`, `RecordViewHeader.tsx`, `RecordViewCanvas.tsx`, `FieldRenderer.tsx`, `use-record-view.ts`, plus data/action files for configs. The Record View will slide in at 60% width with the grid dimmed behind it.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 9 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds the Record View Overlay — Layout, Field Canvas, Navigation, Saved Configs.

Depends on: None (independent component — uses data layer from 3A-i)
Load context: tables-and-views.md lines 568–628 (Record View — Layout, Screen Dimensions, Record View as Shared Primitive, Expand Icon, Linked Records, Responsive)

Key deliverables:
- Record View state hook (use-record-view.ts): isOpen, currentRecordId, currentConfigId, openRecordView, closeRecordView, navigateRecord (prev/next)
- Record View overlay (RecordView.tsx): slides from right, 60% width, 200ms transition, dimmed grid behind (bg-black/20), grid stays interactive, close on ✕/Escape/click-outside
- Record View header (RecordViewHeader.tsx): record name, nav arrows, close button, chat icon placeholder, table+view breadcrumb
- Record View canvas (RecordViewCanvas.tsx): white canvas, up to 4 columns desktop / 2 mobile, drag-and-drop rearrangeable, fields adjustable width (1–4 column span)
- Field renderer (FieldRenderer.tsx): reuses 3A-i cell renderers adapted for Record View (larger, no truncation), inline editable
- Record View configs data layer (record-view-configs.ts): getRecordViewConfigs, getRecordViewConfigById, getDefaultRecordViewConfig
- Record View config actions (record-view-actions.ts): createRecordViewConfig, updateRecordViewConfig, deleteRecordViewConfig, setDefaultRecordViewConfig
- Auto-generated default config when none exists
- testTenantIsolation() for config queries
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Record Thread panel (3C)
- Smart Doc editor in Record View (3D)
- Portal rendering mode (3E-i)
- Form rendering mode (3E-ii)
- Field-level permission filtering (3A-iii)
- Cross-link traversal navigation (3B-i)

Git: Commit with message "feat(record-view): overlay layout, field canvas, navigation, saved configs [Phase 3A-ii, Prompt 9]"
```

[CHECKPOINT]
```
Look for:
- RecordView.tsx, RecordViewHeader.tsx, RecordViewCanvas.tsx, FieldRenderer.tsx created
- use-record-view.ts created
- record-view-configs.ts and record-view-actions.ts created
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 10: Record View — Tabs, Linked Record Display, Responsive

**What This Builds:**
This prompt enhances the Record View with three features. First, tabs — you can organize fields into named tabs within the Record View (like tabs in a browser). Second, linked record pills — clicking a linked record chip navigates you to that record's view, with a back button to return. Third, responsive behavior — on mobile screens, the Record View becomes a full-screen sheet with a single-column layout instead of a side panel.

**What You'll See When It's Done:**
Claude Code will create `RecordViewTabs.tsx`, `LinkedRecordPills.tsx`, and update `RecordViewCanvas.tsx` and `RecordView.tsx`. Tabs will appear when configured, linked records will be navigable, and the layout will adapt to screen size.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 10 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Record View — Tabs, Linked Record Display, Responsive.

Depends on: Prompt 9
Load context: tables-and-views.md lines 583–585 (Tabs), lines 615–620 (Linked Records in Record View), lines 622–628 (Responsive Behavior)

Key deliverables:
- Multi-tab Record View (RecordViewTabs.tsx): tab bar using shadcn/ui Tabs, each tab shows assigned fields, add/rename/delete tabs, drag fields between tabs
- Linked Record pills (LinkedRecordPills.tsx): clickable pills showing primary field value, click navigates to linked record's Record View (stack navigation), back button returns to previous
- Multiple saved configs per table: config picker dropdown in header, "Save as new config" option, views.config.record_view_config_id
- Responsive: ≥1024px 60% overlay, 768–1023px 60% overlay, <768px full-screen sheet with single column
- Tab between fields in Record View
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Record Thread panel (3C)
- Inline Sub-Table display (Prompt 13)
- Portal record rendering (3E-i)
- Cross-link creation Link Picker (3B-i)

Git: Commit with message "feat(record-view): tabs, linked record display, responsive behavior [Phase 3A-ii, Prompt 10]"
```

[CHECKPOINT]
```
Look for:
- RecordViewTabs.tsx, LinkedRecordPills.tsx created
- RecordViewCanvas.tsx and RecordView.tsx updated
- All tests passing
- No TypeScript or ESLint errors
```

---

### INTEGRATION CHECKPOINT 3 (after Prompts 8–10)

[PASTE INTO CLAUDE CODE]
```
Run the full verification suite for Integration Checkpoint 3:
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: Field locking shows avatar when another user edits. Record View opens from expand icon. Record View fields are inline editable. Tab navigation works. Linked Record pills navigate. Responsive layout at different breakpoints.

Fix any failures before proceeding.
```

[CHECKPOINT]
```
All commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): integration checkpoint 3 [Phase 3A-ii, CP-3]"
git push origin build/3a-ii-view-features
```

Review the branch on GitHub before proceeding.

---

### PROMPT 11: Card View — Layouts, RecordCard Component, Inline Editing

**What This Builds:**
This prompt creates Card View — an alternative way to see your records as cards instead of grid rows. There are three layouts: single column (full-width cards for detailed viewing), grid (2–3 columns of equal-height cards for scanning), and compact list (narrow cards showing key fields only). Cards share all the same filtering, sorting, and grouping features as the grid. Clicking a card's expand icon opens the Record View. Think of it like switching between list view and card view on a Trello board.

**What You'll See When It's Done:**
Claude Code will create files in `apps/web/src/components/card-view/`: `CardView.tsx`, `RecordCard.tsx`, `CardViewToolbar.tsx`, and `use-card-view.ts`. Card View will be selectable from the view switcher and support inline editing.

**How Long This Typically Takes:** 8–10 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 11 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Card View — Layouts, RecordCard Component, Inline Editing.

Depends on: Prompt 9 (Record View — Card View opens Record View on card click)
Load context: tables-and-views.md lines 631–668 (Card View — Card Layout, Card Content, Filtering & Customization, RecordCard Unified Component)

Key deliverables:
- Card View (CardView.tsx): renders records as cards, three layouts (single column, grid 2–3 cols, compact list), uses same data source as grid (useGridData hook)
- RecordCard component (RecordCard.tsx): unified desktop+mobile component, fields in configured order, inline editable, expand icon opens Record View, Smart Doc preview (3 lines + "Expand"), variable height with internal scroll after 80vh
- Card View toolbar (CardViewToolbar.tsx): reuse/extend toolbar pattern, same controls (filter/sort/group/color/hide/density), layout picker, column count picker for grid layout
- Card View with grouping: cards within GroupHeader sections
- State hook (use-card-view.ts): layout, column count, field config, persists to views.config
- Component tests for RecordCard in all 3 layouts
- ESLint and TypeScript compile with zero errors
- No hardcoded English strings

Do NOT build:
- Mobile swipe actions on RecordCard (3H-i)
- Mobile compact list as default (3H-i)
- Kanban view (post-MVP)
- Gallery view (post-MVP)

Git: Commit with message "feat(card-view): layouts, RecordCard component, inline editing [Phase 3A-ii, Prompt 11]"
```

[CHECKPOINT]
```
Look for:
- CardView.tsx, RecordCard.tsx, CardViewToolbar.tsx, use-card-view.ts created
- Component tests for 3 layout modes
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 12: Sections — Universal List Organizer

**What This Builds:**
This prompt creates Sections — a reusable organizing feature that lets you group items in any list with collapsible headers. Think of it like folders or categories you can create in a sidebar. You can drag items into sections, collapse sections to hide their contents, and create personal sections (only you see them) or shared sections (everyone sees them, Manager+ can create). This will be used to organize views, tables in the sidebar, and more.

**What You'll See When It's Done:**
Claude Code will create files in `apps/web/src/components/sections/`: `SectionList.tsx`, `SectionHeader.tsx`, `use-sections.ts`, plus `sections.ts` data layer and `section-actions.ts`. The view switcher from Prompt 7 will gain section support.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 12 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Sections — Universal List Organizer.

Depends on: None (independent UI primitive)
Load context: tables-and-views.md lines 672–701 (Sections — Universal List Organizer)

Key deliverables:
- Sections data layer (sections.ts): getSectionsByContext (shared + personal), getSectionById
- Section actions (section-actions.ts): createSection (personal any user, shared Manager+), updateSection, deleteSection (items move to top level), moveItemToSection, reorderSections
- Section header (SectionHeader.tsx): collapsible with chevron + name + item count, right-click rename/delete, inline rename on double-click, collapse state persists per user
- Section list (SectionList.tsx): generic component accepting items + sections + render function, drag-and-drop for reorder and moving items into/out of sections, empty sections with placeholder, unsectioned items render at top
- Two tiers: personal (any user, visible only to creator) and Manager-created (visible to all)
- Initial integration: view switcher gets section support, sidebar table list gets section support
- testTenantIsolation() for getSectionsByContext()
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Automations list sections (Phase 4)
- Documents list sections (3D)
- Section permission enforcement (3A-iii)
- Nested sections (single level only)

Git: Commit with message "feat(sections): universal list organizer [Phase 3A-ii, Prompt 12]"
```

[CHECKPOINT]
```
Look for:
- SectionList.tsx, SectionHeader.tsx, use-sections.ts created
- sections.ts data layer and section-actions.ts created
- View switcher updated with sections
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 13: Inline Sub-Table Display for Linked Record Fields

**What This Builds:**
This prompt creates the Inline Sub-Table — an embedded mini-grid that appears inside the Record View for Linked Record fields. Instead of just showing linked records as clickable pills, you can configure the field to show them as an editable table with specific columns. You can add new linked records by typing directly into a creation row (like a mini spreadsheet within the record). Think of it like a "Line Items" table inside an invoice record.

**What You'll See When It's Done:**
Claude Code will create `InlineSubTable.tsx`, `InlineSubTableRow.tsx`, `use-inline-sub-table.ts` in the record-view directory, and `cross-links.ts` in the data layer. Linked Record fields configured with `inline_table` display style will render as editable mini-grids.

**How Long This Typically Takes:** 8–10 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 13 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Inline Sub-Table Display for Linked Record Fields.

Depends on: Prompts 9, 10 (Record View)
Load context: tables-and-views.md lines 705–811 (Inline Sub-Table Display for Linked Records)

Key deliverables:
- Inline Sub-Table (InlineSubTable.tsx): renders in Record View for Linked Record fields with display.style='inline_table', search bar placeholder (Link Picker ships 3B-i), linked record list with configured columns, creation row, delete button
- Inline Sub-Table row (InlineSubTableRow.tsx): single linked record row, inline editable cells (click, Tab, auto-save on blur, Enter creates new row, Escape reverts), compact cell renderers
- Cross-link data queries (cross-links.ts): getLinkedRecords (queries cross_link_index), getLinkedRecordCount
- Grid cell rendering for inline_table fields: shows "N items" summary, clicking opens Record View scrolled to sub-table
- Mobile rendering (<768px): compact summary with "View All" and "+ Add" buttons
- Permission stubs: column visibility, +Add Row, Delete icon use roleAtLeast('manager') for now
- testTenantIsolation() for getLinkedRecords()
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Link Picker modal (3B-i)
- Cross-link resolution at L1/L2 depth (3B-i)
- Summary row with aggregation (post-MVP — requires rollups)
- Display value maintenance / cache (3B-i)

Git: Commit with message "feat(record-view): inline sub-table display for linked record fields [Phase 3A-ii, Prompt 13]"
```

[CHECKPOINT]
```
Look for:
- InlineSubTable.tsx, InlineSubTableRow.tsx, use-inline-sub-table.ts created
- cross-links.ts data layer created
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 14: CSV Import — 5-Step Guided Flow

**What This Builds:**
This prompt creates a guided wizard for importing CSV files into your tables. It has 5 steps: (1) upload the file, (2) preview the data and detect headers, (3) map CSV columns to your table's fields, (4) validate the data and show any issues, (5) run the import in batches with a progress bar. At the end, you get a summary of how many records were imported and a downloadable report of any failed rows. Think of it like importing contacts into a CRM from a spreadsheet.

**What You'll See When It's Done:**
Claude Code will create files in `apps/web/src/components/import/`: `CsvImportWizard.tsx`, `ImportUpload.tsx`, `ImportPreview.tsx`, `ImportFieldMapping.tsx`, `ImportValidation.tsx`, `ImportExecution.tsx`, plus `import-actions.ts`. An "Import" button will appear in the grid toolbar for Manager+.

**How Long This Typically Takes:** 8–12 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 14 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds CSV Import — 5-Step Guided Flow.

Depends on: None (standalone feature, uses record creation from 3A-i)
Load context: tables-and-views.md lines 814–841 (CSV/Data Import — MVP)

Key deliverables:
- CSV Import Wizard (CsvImportWizard.tsx): 5-step linear flow with back/next, opens from toolbar "Import" button
- Step 1 Upload (ImportUpload.tsx): .csv/.tsv, drag-and-drop or file input, 10MB max, Papaparse client-side parsing
- Step 2 Preview (ImportPreview.tsx): first 10 rows preview, "First row is header" toggle with auto-detect
- Step 3 Field Mapping (ImportFieldMapping.tsx): CSV columns → EveryStack fields dropdown, fuzzy auto-mapping, skip unmapped, primary field required
- Step 4 Validation (ImportValidation.tsx): dry-run on first 100 rows, per-column pass/fail with expand for details, type mismatch warnings
- Step 5 Execution (ImportExecution.tsx): batches of 100, progress bar, completion summary toast, downloadable CSV error report
- Import Server Action (import-actions.ts): importRecords with Manager+ role check, plan limit check, batch processing via createRecord(), blocked for synced tables
- testTenantIsolation() for importRecords()
- ESLint and TypeScript compile with zero errors
- Coverage ≥80% on new files
- No hardcoded English strings

Do NOT build:
- Excel (.xlsx) import (post-MVP)
- Linked Record resolution during import (post-MVP)
- Update existing records by match (post-MVP)
- Import into synced tables (blocked)
- CSV export (minimal, no dedicated feature)

Git: Commit with message "feat(import): CSV import 5-step guided flow [Phase 3A-ii, Prompt 14]"
```

[CHECKPOINT]
```
Look for:
- CsvImportWizard.tsx and all 5 step components created
- import-actions.ts created
- Import button added to toolbar
- All tests passing
- No TypeScript or ESLint errors
```

---

### PROMPT 15: Record Deletion, Responsive Grid Polish, Grid + Record View Combined Layout

**What This Builds:**
This prompt polishes the integration between all the components built so far. It sets up the proper layout when Grid and Record View are shown side-by-side (grid at 40%, Record View at 60%), makes the bulk actions toolbar compress to icons when Record View is open, ensures record deletion works smoothly with undo toasts, and verifies the grid degrades gracefully on tablets and mobile. Think of it as the final fitting and finishing — making sure all the pieces work together seamlessly.

**What You'll See When It's Done:**
Claude Code will update `DataGrid.tsx`, `BulkActionsToolbar.tsx`, `RecordView.tsx`, and create `combined-layout.test.tsx`. The Grid + Record View layout will match the spec dimensions, deletion will have proper undo behavior, and responsive layouts will work at all breakpoints.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
Read these skill files before starting:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md

Execute Prompt 15 from the Phase 3A-ii playbook at docs/Playbooks/playbook-phase-3a-ii.md.

This prompt builds Record Deletion, Responsive Grid Polish, Grid + Record View Combined Layout.

Depends on: Prompts 9, 10, 11 (Record View and Card View)
Load context: tables-and-views.md lines 451–482 (Grid + Record View Layout), lines 551–565 (Record Deletion, Responsive Grid, Loading & Empty States)

Key deliverables:
- Grid + Record View combined layout: Record View at 60%, grid at 40% dimmed but interactive, clicking different row updates Record View. Record Thread 25% placeholder panel (no content until 3C)
- Bulk Actions + Record View interaction: compress toolbar to icon-only strip when Record View open, icons-only (trash, copy, clipboard), selection count badge
- Quick Panel + Record View overlay: when Quick Panel open, Record View dimensions remain relative to full screen
- Record deletion polish: single record soft delete with 10s undo toast, bulk delete confirmation dialog for 2+, optimistic removal with rollback
- Responsive grid: tablet horizontal scroll with touch resize, mobile horizontal scroll with simplified toolbar, skeleton/empty states verified
- ESLint and TypeScript compile with zero errors
- No hardcoded English strings

Do NOT build:
- Record Thread panel content (3C)
- Quick Panel content (3G-ii)
- Mobile-specific grid optimizations (3H-i)

Git: Commit with message "feat(grid): record deletion, responsive polish, grid + record view combined layout [Phase 3A-ii, Prompt 15]"
```

[CHECKPOINT]
```
Look for:
- DataGrid.tsx updated with combined layout
- BulkActionsToolbar.tsx updated with compressed mode
- RecordView.tsx updated with layout dimensions
- All tests passing
- No TypeScript or ESLint errors
```

---

### INTEGRATION CHECKPOINT 4 — FINAL (after Prompts 11–15)

[PASTE INTO CLAUDE CODE]
```
Run the full verification suite for Integration Checkpoint 4 (Final):
1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met for all changed packages
6. Manual verification:
   - Grid: select rows → bulk toolbar → delete/duplicate/edit. Sort + filter + group together. Color rules apply. Summary footer aggregations. View switcher shows My/Shared views. Create and switch views. Hide/show fields
   - Record View: open from expand icon → inline edit fields → navigate between records → tabs → linked record pills → responsive at different breakpoints
   - Card View: switch to card view → 3 layouts → inline editing → grouping
   - Sections: create sections in view switcher → drag views into sections → collapse/expand
   - Inline Sub-Table: linked record field with inline_table config → mini-grid in Record View → add/edit/delete rows
   - CSV Import: upload CSV → preview → map fields → validate → import → verify records created
   - Collaboration: two browser windows → edit same field → lock indicator appears → real-time updates propagate

Fix any failures before proceeding.
```

[CHECKPOINT]
```
All commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): integration checkpoint 4 — final [Phase 3A-ii, CP-4]"
git push origin build/3a-ii-view-features
```

### FINAL — Open Pull Request

[GIT COMMAND]
```
git push origin build/3a-ii-view-features
```

Open a PR titled "[Step 3] Phase 3A-ii — View Features, Record View, Card View & Data Import".
Description: list all 15 prompts completed and their deliverables.
Review the diff.

[DECISION POINT]
```
If the PR looks good:
  → Merge to main (squash merge). Delete the branch. Proceed to Step 4.

If something looks wrong:
  → Do NOT merge. Paste this into Claude Code:
    "Review the diff for build/3a-ii-view-features. The following looks wrong: <describe>.
     Fix it and commit."
  → Re-push. Re-review. Then merge.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

Covers What This Step Does, 4.1 — Generate the build diff, 4.2 — Run the Reviewer Agent.

### What This Step Does

An independent Claude session reviews the build output against the playbook's acceptance criteria. It catches anything that was missed — naming inconsistencies, unmet criteria, convention violations.

### 4.1 — Generate the build diff

[GIT COMMAND]
```
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-3a-ii-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open a NEW Claude.ai session. Upload:
- The playbook: `docs/Playbooks/playbook-phase-3a-ii.md`
- `/tmp/phase-3a-ii-diff.txt` (the build diff)
- `CLAUDE.md`
- `docs/reference/GLOSSARY.md`

Paste:

[PASTE INTO CLAUDE]
```
You are the Reviewer Agent for EveryStack Phase 3A-ii (View Features, Record View, Card View & Data Import).

Read this skill file first:
- docs/skills/reviewer/SKILL.md

Your mandate: evaluate the build diff against the playbook's acceptance criteria. Produce a structured pass/fail verdict.

Rules:
- Check every acceptance criterion in every prompt (Prompts 1–15)
- Name specific files when reporting failures
- Provide actionable fix instructions for every failure
- Never suggest code changes — only report what's wrong
- Check naming against GLOSSARY.md
- Check conventions against CLAUDE.md
- Verify all i18n compliance (no hardcoded English strings)
- Verify testTenantIsolation() exists for every new data access function
- Verify coverage ≥80% on new files

Output format:
  ## Verdict: PASS or FAIL

  ### Prompt 1: Selection & Bulk Actions Toolbar
  - [x] Criterion 1 — met
  - [ ] Criterion 2 — NOT MET: [specific finding + fix instruction]
  ...

  ### Prompt 2: Multi-Level Sorting
  ...

  [Continue for all 15 prompts]

  ### Overall
  [Summary of findings. If FAIL: prioritized list of fixes needed.]
```

[DECISION POINT]
```
If PASS:
  → Proceed to Step 5.

If FAIL:
  → Open Claude Code in the monorepo.
  → For each failure, paste this:

  [PASTE INTO CLAUDE CODE]
  "The Reviewer Agent found these issues in the Phase 3A-ii build:
   1. [failure description + fix instruction from verdict]
   2. [next failure]
   Fix all of them. Run the full test suite after each fix."

  → After fixes, commit and push:
    git add -A
    git commit -m "fix: address review findings [Phase 3A-ii]"
    git push origin main

  → Re-run Step 4 from the beginning.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

Covers What This Step Does, 5.1 — Create the fix branch, 5.2 — Run the Docs Agent, 5.3 — Review and merge, 5.4 — Tag if milestone.

### What This Step Does

The build may have changed line counts in reference docs, introduced new domain terms, or made cross-references stale. This step brings docs back into alignment with what was actually built.

### 5.1 — Create the fix branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b fix/post-3a-ii-docs-sync
```

### 5.2 — Run the Docs Agent

Open Claude Code in the monorepo. Paste:

[PASTE INTO CLAUDE CODE]
```
You are the Docs Agent for EveryStack, running after Phase 3A-ii build (View Features, Record View, Card View & Data Import).

Read this skill file first:
- docs/skills/docs-sync/SKILL.md

Your mandate: bring documentation back into alignment with the codebase.

Tasks:
1. Run: wc -l docs/**/*.md
   Compare against MANIFEST.md line counts. Update any that changed.
2. Review GLOSSARY.md. Check if any new domain terms were introduced
   during the build (search the git diff for new type names, table names,
   or concept names). Add definitions for any missing terms.
   Key terms to check: BulkActionsToolbar, SortPanel, FilterBuilder, GroupHeader,
   SummaryFooter, ColorRuleBuilder, GridToolbar, ViewSwitcher, RecordView,
   RecordViewCanvas, FieldRenderer, RecordViewTabs, CardView, RecordCard,
   SectionList, InlineSubTable, CsvImportWizard, FieldLockIndicator
3. Check cross-references in docs that reference files changed during
   the build. Fix any stale section references or line ranges.
4. Update section indexes in any doc whose line counts changed significantly.
5. Update docs/skills/phase-context/SKILL.md with Phase 3A-ii deliverables.

Files changed during this build:
<paste output of: git diff --name-only main~1..main>

Forbidden:
- Do NOT modify any application code
- Do NOT modify any file outside docs/
- Only fix docs — do not add features or refactor
```

### 5.3 — Review and merge

[CHECKPOINT]
```
Review the diff:
  git diff main...fix/post-3a-ii-docs-sync
Look for:
- MANIFEST.md line counts match actual file sizes
- No stale cross-references remain
- No new terms missing from GLOSSARY.md
- Section indexes updated where needed
- phase-context/SKILL.md updated with 3A-ii deliverables
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: post-Phase-3A-ii docs sync (MANIFEST, GLOSSARY, cross-refs, phase-context)"
git push origin fix/post-3a-ii-docs-sync
```

Open a PR titled "[Step 5] Phase 3A-ii — Post-Build Docs Sync".
Review. Merge to main. Delete the branch.

### 5.4 — Tag if milestone

[DECISION POINT]
```
Phase 3A-ii completes the view features layer but does not complete
all of Phase 3. This is NOT a major milestone tag.

  → Skip tagging. Proceed to the next sub-phase (3A-iii).
```

---

## NEXT SUB-PHASE

Phase 3A-ii is complete. The next sub-phase is **3A-iii — Field-Level Permissions**.
Return to Step 0 for Phase 3A-iii using that sub-phase's Prompting Roadmap.
