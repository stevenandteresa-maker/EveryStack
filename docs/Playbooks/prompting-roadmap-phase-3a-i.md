# Phase 3A-i — Grid View Core: Layout, Cell Renderers & Inline Editing — Prompting Roadmap

## Overview

- **Sub-phase:** 3A-i — Grid View Core
- **Playbook:** `playbook-phase-3a-i.md`
- **Estimated duration:** ~8–12 hours across all 6 steps
- **Prior sub-phase:** Phase 2C — Notion Adapter, Error Recovery, Sync Dashboard (merged to main)

---

## STEP 0 — DOC PREP (Architect Agent)

### What This Step Does

Before building the grid view, we need to confirm that the reference docs the playbook points to (`tables-and-views.md`, `data-model.md`, `design-system.md`) have accurate line ranges and that no new glossary terms are needed. Phase 3A-i is a UI-heavy build with no schema migrations, so doc prep is likely minimal or unnecessary.

### 0.1 — Check Whether Doc Prep Is Needed

Open Claude Code in the monorepo. Paste:

**[PASTE INTO CLAUDE CODE]**

```
Read these files and check whether the line ranges referenced in docs/Playbooks/playbook-phase-3a-i.md still match the actual content:

1. docs/reference/tables-and-views.md — check lines 27–42, 120–144, 146–161, 162–232, 233–255, 257–288, 289–301, 302–321, 323–371, 561–564
2. docs/reference/data-model.md — check lines 74–92
3. docs/reference/design-system.md — check lines 44–57, 139–170, 277–284, 310–318

For each range, confirm the section heading and content described in the playbook's "Load context" field actually appears at those line numbers. Report any mismatches.

Also check docs/reference/GLOSSARY.md for these terms — confirm they exist:
- Grid View / Table View
- Cell Renderer
- Canonical Data
- FieldTypeRegistry
- Table Type
- Record View
- Cross-Link

Report: "All line ranges match" or list specific mismatches.
```

**[DECISION POINT]**

```
If Claude Code reports "All line ranges match" and all glossary terms exist:
  → Skip the rest of Step 0. No branch, no PR. Proceed directly to Step 3.

If there are mismatches or missing terms:
  → Continue to 0.2 below.
```

### 0.2 — Create the Docs Branch (only if mismatches found)

**[GIT COMMAND]**

```
git checkout main && git pull origin main
git checkout -b docs/3a-i-line-range-fixes
```

### 0.3 — Run the Architect Agent (only if mismatches found)

Open Claude Code. Paste:

**[PASTE INTO CLAUDE CODE]**

```
You are the Architect Agent for EveryStack Phase 3A-i doc prep.

Fix the line range mismatches found in the previous check. For each mismatch:
1. Find the correct line range for the referenced section heading
2. Update the playbook file (docs/Playbooks/playbook-phase-3a-i.md) with corrected line numbers

If any glossary terms were missing, add definitions to docs/reference/GLOSSARY.md following the existing format.

After making changes, run:
  wc -l docs/reference/GLOSSARY.md docs/reference/tables-and-views.md docs/reference/data-model.md docs/reference/design-system.md

Compare against MANIFEST.md line counts. Update MANIFEST.md if any changed.

Do NOT modify any application code. Only fix docs.
```

### 0.4 — Review and Merge (only if changes were made)

**[CHECKPOINT]**

```
Review the diff:
  git diff main...docs/3a-i-line-range-fixes
Look for:
- Line ranges in the playbook now point to correct sections
- MANIFEST.md line counts updated for changed docs
- No unrelated changes
```

**[GIT COMMAND]**

```
git add -A
git commit -m "docs: fix line ranges for Phase 3A-i playbook [Phase 3A-i prep]"
git push origin docs/3a-i-line-range-fixes
```

Open a PR titled "[Step 0] Phase 3A-i — Doc Prep: Line Range Fixes".
Review the diff. Merge to main. Delete the branch.

---

## STEP 1 — PLAYBOOK GENERATION

### What This Step Does

You already have the playbook for this sub-phase — it was produced before this roadmap. The playbook is at `docs/Playbooks/playbook-phase-3a-i.md`.

If you're reading this roadmap, Step 1 is complete.

---

## STEP 2 — PROMPTING ROADMAP GENERATION

This step produced the document you're reading. Proceed to Step 3.

---

## STEP 3 — BUILD EXECUTION (Builder Agent)

### Setup

**[GIT COMMAND]**

```
git checkout main && git pull origin main
git checkout -b build/3a-i-grid-view-core
```

Open Claude Code. Load skills:

**[PASTE INTO CLAUDE CODE]**

```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

### PROMPT 1: Grid Data Layer

**What This Builds:**
This prompt creates the server-side data access functions that the grid will use to fetch and update records, fields, tables, and views. Think of it as building the plumbing — the grid UI (coming next) will call these functions to get data from the database and save changes back. Nothing visual ships in this prompt, but everything visual depends on it.

**What You'll See When It's Done:**
Claude Code will create 6 new TypeScript files in the `data/`, `actions/`, and `lib/types/` folders, plus 2 integration test files. You should see all tests passing, including tenant isolation tests that verify one customer can't see another customer's data.

**How Long This Typically Takes:** 5–10 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 1: Grid Data Layer" section (the section starting with "## Prompt 1").

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)
- docs/reference/data-model.md (lines referenced in the playbook)

Execute all tasks in Prompt 1. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
4. Confirm coverage ≥80% on new files
```

**[CHECKPOINT]**

```
Look for:
- New files created in apps/web/src/data/ (tables.ts, fields.ts, records.ts, views.ts)
- New file: apps/web/src/actions/record-actions.ts
- New file: apps/web/src/lib/types/grid.ts
- Integration tests passing (including testTenantIsolation)
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/data/tables.ts apps/web/src/data/fields.ts apps/web/src/data/records.ts apps/web/src/data/views.ts apps/web/src/actions/record-actions.ts apps/web/src/lib/types/grid.ts apps/web/src/data/__tests__/
git commit -m "feat(data): grid data layer — records, fields, views queries [Phase 3A-i, Prompt 1]"
```

---

### PROMPT 2: Grid Shell with Virtualization

**What This Builds:**
This prompt creates the actual spreadsheet grid component — the main visual surface where users see their data. It uses TanStack Table for managing columns and TanStack Virtual for efficiently rendering thousands of rows without slowing down. Only visible rows are rendered in the browser; as the user scrolls, new rows appear and old ones are removed. This is the visual shell — individual cell content (text, numbers, dates, etc.) gets filled in by later prompts.

**What You'll See When It's Done:**
Claude Code will create the core grid components: DataGrid, GridHeader, GridRow, GridCell, plus a Zustand store for grid state and a data-fetching hook. The grid should render with column headers from field names and placeholder cells for each row. You'll see a checkbox column, row numbers, and a "+" column for adding fields (visible to Managers).

**How Long This Typically Takes:** 8–15 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 2: TanStack Table + Virtual Grid Shell with Column Model" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)
- docs/reference/design-system.md (lines referenced in the playbook)

Execute all tasks in Prompt 2. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files in apps/web/src/components/grid/ (DataGrid.tsx, GridHeader.tsx, GridRow.tsx, GridCell.tsx, use-grid-store.ts, grid-types.ts)
- New file: apps/web/src/lib/hooks/use-grid-data.ts
- TanStack Table and TanStack Virtual imported and configured
- Zustand store with activeCell, editingCell, density, columnWidths, columnOrder, frozenColumnCount
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/ apps/web/src/lib/hooks/use-grid-data.ts
git commit -m "feat(grid): TanStack Table + Virtual grid shell with column model [Phase 3A-i, Prompt 2]"
```

---

### PROMPT 3: Cell Renderers — Text, Number, Date, Checkbox, Rating, Currency, Percent

**What This Builds:**
This prompt creates the first batch of cell renderer components — the pieces that know how to display and edit specific types of data inside the grid. Text cells show text with truncation. Number cells show formatted numbers. Date cells show dates with a date picker for editing. Checkbox cells toggle on click. Rating cells show stars. Currency cells show dollar amounts. Percent cells show a progress bar. It also creates the cell registry — the lookup system that maps field types to their renderers.

**What You'll See When It's Done:**
7 new cell component files plus a cell-registry.ts file and component tests. When the grid renders, each column's cells will display data formatted according to their field type.

**How Long This Typically Takes:** 10–15 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 3: Cell Renderers — Text, Number, Date, Checkbox, Rating, Currency, Percent" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)
- docs/reference/design-system.md (lines referenced in the playbook)

Execute all tasks in Prompt 3. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files in apps/web/src/components/grid/cells/ (TextCell.tsx, NumberCell.tsx, DateCell.tsx, CheckboxCell.tsx, RatingCell.tsx, CurrencyCell.tsx, PercentCell.tsx, cell-registry.ts)
- Component tests in apps/web/src/components/grid/cells/__tests__/
- Cell registry maps all 7 field types — NOT using switch statements
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/cells/
git commit -m "feat(grid): cell renderers — text, number, date, checkbox, rating, currency, percent [Phase 3A-i, Prompt 3]"
```

---

### PROMPT 4: Cell Renderers — Select, Multi-Select, People, Linked Record, Attachment

**What This Builds:**
This prompt creates the more complex cell renderers — the ones that show colored pills (for select options), avatar bubbles (for people), linked record references, and file thumbnails. These cells handle overflow gracefully with "+N" badges when there are too many items to fit. It also creates reusable PillBadge and OverflowBadge components that will be used throughout the app.

**What You'll See When It's Done:**
5 new cell component files plus PillBadge and OverflowBadge shared components. Select cells will show colored pills. People cells will show avatars. Linked record cells will show clickable pills (linking functionality comes later). Attachment cells will show thumbnail previews.

**How Long This Typically Takes:** 10–15 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 4: Cell Renderers — Select, Multi-Select, People, Linked Record, Attachment" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)
- docs/reference/design-system.md (lines referenced in the playbook)

Execute all tasks in Prompt 4. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files: SingleSelectCell.tsx, MultiSelectCell.tsx, PeopleCell.tsx, LinkedRecordCell.tsx, AttachmentCell.tsx
- Reusable components: PillBadge, OverflowBadge
- Cell registry updated with all 5 new types (total 12 so far)
- Colors from the 13-color data palette
- LinkedRecordCell edit mode shows placeholder (link picker deferred)
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/cells/
git commit -m "feat(grid): cell renderers — select, multi-select, people, linked record, attachment [Phase 3A-i, Prompt 4]"
```

---

### INTEGRATION CHECKPOINT 1 (after Prompts 1–4)

**What This Does:**
This is a stopping point to verify that everything built so far works together. We run the full test and verification suite, check that the grid renders correctly with the first 12 cell types, and push the branch so you can review the code on GitHub.

**[PASTE INTO CLAUDE CODE]**

```
Run the full verification suite:
1. pnpm turbo typecheck
2. pnpm turbo lint
3. pnpm turbo test
4. pnpm turbo test -- --coverage

Report the results of each command. Fix any failures before reporting.
```

**[CHECKPOINT]**

```
All 4 commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

**[GIT COMMAND]**

```
git add -A
git commit -m "chore(verify): integration checkpoint 1 [Phase 3A-i, CP-1]"
git push origin build/3a-i-grid-view-core
```

Review the branch on GitHub before proceeding.

---

### PROMPT 5: Cell Renderers — URL, Email, Phone, Smart Doc, Barcode, Checklist

**What This Builds:**
This prompt creates the final batch of cell renderers — simpler ones for URLs (clickable links), email addresses (mailto links), phone numbers, Smart Doc content indicators, barcodes, and checklists (with a mini progress bar). After this prompt, all ~16 MVP field types have renderers in the grid.

**What You'll See When It's Done:**
6 new cell component files and updated tests. The cell registry will now contain all MVP field types. URLs will appear as blue clickable links. Checklists will show "3/7 done" with a mini progress bar.

**How Long This Typically Takes:** 8–12 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 5: Cell Renderers — URL, Email, Phone, Smart Doc, Barcode, Checklist" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)

Execute all tasks in Prompt 5. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files: UrlCell.tsx, EmailCell.tsx, PhoneCell.tsx, SmartDocCell.tsx, BarcodeCell.tsx, ChecklistCell.tsx
- Cell registry now contains ALL ~16 MVP field types
- Component tests for all 6 new cell types
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/cells/
git commit -m "feat(grid): cell renderers — url, email, phone, smart doc, barcode, checklist [Phase 3A-i, Prompt 5]"
```

---

### PROMPT 6: Inline Cell Editing with Auto-Save

**What This Builds:**
This prompt makes the grid feel like a real spreadsheet by wiring up inline editing. Single-click on a cell and start typing to replace its content. Double-click to edit the existing content. Changes save automatically when you click away (blur). Press Escape to cancel. Press Enter to save and move down. Press Tab to save and move right. Behind the scenes, changes appear instantly (optimistic updates) while saving to the server in the background — if the save fails, the cell rolls back and shows an error.

**What You'll See When It's Done:**
Updated GridCell component, two new hooks (use-cell-edit.ts and use-optimistic-record.ts), and cell editing tests. You'll be able to click cells to edit them, and changes will save automatically.

**How Long This Typically Takes:** 10–15 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 6: Inline Cell Editing with Auto-Save and Optimistic Updates" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)

Execute all tasks in Prompt 6. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- Updated: GridCell.tsx, use-grid-store.ts
- New files: use-cell-edit.ts, use-optimistic-record.ts
- Tests in cell-editing.test.tsx
- Single click + type = replace mode, double-click = edit mode
- Auto-save on blur, cancel on Escape, save+move on Enter/Tab
- Optimistic updates with rollback on error
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/ apps/web/src/lib/hooks/
git commit -m "feat(grid): inline cell editing with auto-save and optimistic updates [Phase 3A-i, Prompt 6]"
```

---

### PROMPT 7: Keyboard Navigation and Error Overlays

**What This Builds:**
This prompt adds full spreadsheet-style keyboard navigation — arrow keys to move between cells, Home/End to jump to row edges, Page Up/Down to scroll, Shift+Arrow to select ranges, and many more shortcuts. It also builds cell error state overlays — visual indicators that appear on cells when something is wrong (sync conflict, broken reference, processing state, etc.). A keyboard shortcuts help dialog (Cmd+/) lets users see all available shortcuts.

**What You'll See When It's Done:**
New hook (use-keyboard-navigation.ts), CellErrorOverlay component, updated DataGrid, and tests. Arrow keys will navigate between cells. Cells with sync issues will show colored indicators.

**How Long This Typically Takes:** 10–15 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 7: Keyboard Navigation and Cell Error State Overlays" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)

Execute all tasks in Prompt 7. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files: use-keyboard-navigation.ts, CellErrorOverlay.tsx
- Updated: DataGrid.tsx (keyboard handler integrated)
- Tests in keyboard-navigation.test.tsx
- Arrow key navigation works, active cell highlighted
- Tab/Enter/Escape work correctly
- Cmd+/ opens shortcuts help dialog
- Error overlays render for all 5 states (broken ref, sync conflict, processing, succeeded, type coercion)
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/
git commit -m "feat(grid): keyboard navigation and cell error state overlays [Phase 3A-i, Prompt 7]"
```

---

### INTEGRATION CHECKPOINT 2 (after Prompts 5–7)

**What This Does:**
Second stopping point. All ~16 cell types are now built, inline editing works, and keyboard navigation is functional. We verify everything integrates properly before moving to column and row behavior.

**[PASTE INTO CLAUDE CODE]**

```
Run the full verification suite:
1. pnpm turbo typecheck
2. pnpm turbo lint
3. pnpm turbo test
4. pnpm turbo test -- --coverage
5. pnpm turbo check:i18n

Report the results of each command. Fix any failures before reporting.
```

**[CHECKPOINT]**

```
All 5 commands above must pass with zero errors.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until all checks pass.
```

**[GIT COMMAND]**

```
git add -A
git commit -m "chore(verify): integration checkpoint 2 [Phase 3A-i, CP-2]"
git push origin build/3a-i-grid-view-core
```

Review the branch on GitHub before proceeding.

---

### PROMPT 8: Column Behavior — Resize, Reorder, Freeze, Context Menu, Coloring

**What This Builds:**
This prompt makes columns interactive. Users can drag column borders to resize them, drag column headers to reorder them, and freeze columns so they stay visible while scrolling horizontally. Right-clicking a column header opens a 14-item context menu with options like sort, filter, rename, hide, freeze, and color. Column coloring lets users apply pastel background tints to columns for visual organization. All column settings are saved per-view so different views of the same table can have different layouts.

**What You'll See When It's Done:**
New components (ColumnResizer, ColumnHeaderMenu), hooks for resize and reorder, a view config Server Action, and updated GridHeader. Columns will be resizable, reorderable, and freezeable. The right-click menu will appear with all 14 items (some are placeholders for later phases).

**How Long This Typically Takes:** 12–18 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 8: Column Behavior — Resize, Reorder, Freeze, Context Menu, Coloring" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)
- docs/reference/design-system.md (lines referenced in the playbook)

Execute all tasks in Prompt 8. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files: ColumnResizer.tsx, ColumnHeaderMenu.tsx, use-column-resize.ts, use-column-reorder.ts
- New file: apps/web/src/actions/view-actions.ts
- Updated: GridHeader.tsx, use-grid-store.ts
- Tests in column-behavior.test.tsx
- Column resize works with 60–800px bounds
- Right-click menu shows 14 items with permission gating (Manager+ items hidden for lower roles)
- Column freeze prevents horizontal scroll for frozen columns
- updateViewConfig() has tenant isolation test
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/ apps/web/src/actions/view-actions.ts
git commit -m "feat(grid): column resize, reorder, freeze, context menu, coloring [Phase 3A-i, Prompt 8]"
```

---

### PROMPT 9: Row Behavior — Density, Reorder, Context Menu, New Row, Copy/Paste, Undo

**What This Builds:**
This prompt adds row-level interactions. Users can switch between three density modes (compact, medium, tall) to show more or fewer rows on screen. A persistent empty row at the bottom lets users create new records by clicking and typing. Right-clicking a row opens a 9-item context menu. Multi-cell copy/paste works with clipboard (compatible with Excel/Google Sheets). Drag-to-fill lets users drag a handle to copy values down. Undo/redo (Cmd+Z / Cmd+Shift+Z) tracks the last 50 cell edits.

**What You'll See When It's Done:**
New components (RowContextMenu, NewRowInput, DragToFillHandle), hooks for clipboard, undo/redo, and row reorder, plus tests. The grid will feel like a full spreadsheet with all these row interactions working.

**How Long This Typically Takes:** 15–20 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 9: Row Behavior — Density, Reorder, Context Menu, New Row, Copy/Paste, Undo" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)

Execute all tasks in Prompt 9. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
```

**[CHECKPOINT]**

```
Look for:
- New files: RowContextMenu.tsx, NewRowInput.tsx, use-row-reorder.ts, use-clipboard.ts, use-undo-redo.ts, DragToFillHandle.tsx
- Updated: use-grid-store.ts
- Tests in row-behavior.test.tsx, clipboard.test.tsx
- Density toggle between 32/44/64px works
- New row at bottom creates record on first keystroke
- Row context menu shows 9 items
- Cmd+C/V copies/pastes cells, Cmd+Z/Shift+Z undoes/redoes
- Delete record shows 10s undo toast
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/
git commit -m "feat(grid): row behavior — density, reorder, context menu, new row, copy/paste, undo [Phase 3A-i, Prompt 9]"
```

---

### PROMPT 10: Table Type System, Tab Colors, Performance, Loading & Empty States

**What This Builds:**
This prompt adds the finishing touches. The table type system defines 5 types of tables (table, projects, calendar, documents, wiki) — each with its own icon and default tab color in the sidebar. Tab colors show as a 3px colored stripe on sidebar tabs. Performance banners warn users when the dataset is very large. A loading skeleton shows a shimmer animation while data loads. An empty state with a friendly message and "New Record" button appears when a table has no data.

**What You'll See When It's Done:**
New components (TableTypeIcon, PerformanceBanner, GridSkeleton, GridEmptyState), updated sidebar TableTab, table type constants, and tests. The sidebar tabs will show colored stripes. Loading the grid will show a skeleton. Empty tables will show a helpful message.

**How Long This Typically Takes:** 8–12 minutes

**[PASTE INTO CLAUDE CODE]**

```
Read the playbook at docs/Playbooks/playbook-phase-3a-i.md — specifically the "Prompt 10: Table Type System, Tab Colors, Performance Thresholds, Loading & Empty States" section.

Load the context files it specifies:
- docs/reference/tables-and-views.md (lines referenced in the playbook)
- docs/reference/design-system.md (lines referenced in the playbook)

Execute all tasks in Prompt 10. Follow every acceptance criterion. Respect every "Do NOT Build" item.

After completing:
1. Run pnpm turbo typecheck — fix any errors
2. Run pnpm turbo lint — fix any errors
3. Run pnpm turbo test — fix any failures
4. Run pnpm turbo check:i18n — fix any hardcoded strings
```

**[CHECKPOINT]**

```
Look for:
- New files: TableTypeIcon.tsx, PerformanceBanner.tsx, GridSkeleton.tsx, GridEmptyState.tsx, table-types.ts
- Updated: TableTab.tsx in sidebar (3px color stripe)
- Tests in table-types.test.tsx
- All 5 table types have icons and default colors
- Tab colors respect custom color > table type default fallback
- Performance banners appear at >10K and >50K rows
- Skeleton shows shimmer animation matching grid layout
- Empty state shows illustration + "No records yet" + button
- No hardcoded English strings (i18n check passes)
- All tests green, no TypeScript or ESLint errors
```

**[GIT COMMAND]**

```
git add apps/web/src/components/grid/ apps/web/src/components/sidebar/ apps/web/src/lib/constants/
git commit -m "feat(grid): table type system, tab colors, performance banners, loading/empty states [Phase 3A-i, Prompt 10]"
```

---

### INTEGRATION CHECKPOINT 3 — FINAL (after Prompts 8–10)

**What This Does:**
Final verification. Every component of Phase 3A-i must work together. This is the last check before opening the pull request.

**[PASTE INTO CLAUDE CODE]**

```
Run the full verification suite for the complete Phase 3A-i build:
1. pnpm turbo typecheck
2. pnpm turbo lint
3. pnpm turbo test
4. pnpm turbo test -- --coverage
5. pnpm turbo check:i18n

Verify coverage thresholds:
- apps/web/src/data/ — 95% lines, 90% branches
- apps/web/src/actions/ — 90% lines, 85% branches
- New grid component files — ≥80% lines

Report the results of each command. Fix any failures before reporting.
```

**[CHECKPOINT]**

```
All 5 commands must pass with zero errors and coverage thresholds met.
If any fail: Claude Code will attempt to fix automatically.
If still failing: paste this into Claude Code:
  "The [specific check] is failing with [error]. Fix it."
Do not proceed until ALL checks pass.
```

**[GIT COMMAND]**

```
git add -A
git commit -m "chore(verify): integration checkpoint 3 — final [Phase 3A-i, CP-3]"
git push origin build/3a-i-grid-view-core
```

---

### FINAL — Open Pull Request

**[GIT COMMAND]**

```
git push origin build/3a-i-grid-view-core
```

Open a PR titled "[Step 3] Phase 3A-i — Grid View Core: Layout, Cell Renderers & Inline Editing".

Description should list all prompts completed:
- Prompt 1: Grid data layer (queries + Server Actions)
- Prompt 2: TanStack Table + Virtual grid shell
- Prompt 3: Cell renderers — Text, Number, Date, Checkbox, Rating, Currency, Percent
- Prompt 4: Cell renderers — Select, Multi-Select, People, Linked Record, Attachment
- Prompt 5: Cell renderers — URL, Email, Phone, Smart Doc, Barcode, Checklist
- Prompt 6: Inline cell editing with auto-save and optimistic updates
- Prompt 7: Keyboard navigation and cell error state overlays
- Prompt 8: Column behavior — resize, reorder, freeze, context menu, coloring
- Prompt 9: Row behavior — density, reorder, context menu, new row, copy/paste, undo
- Prompt 10: Table type system, tab colors, performance, loading/empty states

Review the diff.

**[DECISION POINT]**

```
If the PR looks good:
  → Merge to main (squash merge). Delete the branch. Proceed to Step 4.

If something looks wrong:
  → Do NOT merge. Paste this into Claude Code:
    "Review the diff for build/3a-i-grid-view-core. The following looks wrong: <describe>.
     Fix it and commit."
  → Re-push. Re-review. Then merge.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does

An independent Claude session reviews the build output against the playbook's acceptance criteria. It catches anything that was missed — wrong naming, missing tests, conventions not followed, acceptance criteria not met.

### 4.1 — Generate the Build Diff

**[GIT COMMAND]**

```
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-3a-i-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open a NEW Claude.ai session. Upload:
- The playbook: `docs/Playbooks/playbook-phase-3a-i.md`
- `/tmp/phase-3a-i-diff.txt` (the build diff)
- `CLAUDE.md`
- `docs/reference/GLOSSARY.md`

Paste:

**[PASTE INTO CLAUDE]**

```
You are the Reviewer Agent for EveryStack Phase 3A-i — Grid View Core.

Your mandate: evaluate the build diff against the playbook's acceptance criteria. Produce a structured pass/fail verdict.

Rules:
- Check every acceptance criterion in every prompt (Prompts 1–10)
- Name specific files when reporting failures
- Provide actionable fix instructions for every failure
- Never suggest code changes — only report what's wrong
- Check naming against GLOSSARY.md
- Check conventions against CLAUDE.md
- Specifically verify:
  - No switch statements on field types (FieldTypeRegistry pattern used)
  - testTenantIsolation() exists for all /data functions
  - All tests use factories, not hardcoded UUIDs
  - No console.log (Pino logger used)
  - No hardcoded English strings (i18n used)
  - Zod validation on all Server Action inputs
  - getDbForTenant() used for all DB access
  - No raw SQL

Output format:
  ## Verdict: PASS or FAIL

  ### Prompt 1: Grid Data Layer
  - [x] Criterion 1 — met
  - [ ] Criterion 2 — NOT MET: [specific finding + fix instruction]
  ...

  ### Prompt 2: Grid Shell
  ...

  [Continue for all 10 prompts]

  ### Overall
  [Summary of findings. If FAIL: prioritized list of fixes needed.]
```

**[DECISION POINT]**

```
If PASS:
  → Proceed to Step 5.

If FAIL:
  → Open Claude Code in the monorepo.
  → For each failure, paste this:

  [PASTE INTO CLAUDE CODE]
  "The Reviewer Agent found these issues in the Phase 3A-i build:
   1. [failure description + fix instruction from verdict]
   2. [next failure]
   Fix all of them. Run the full test suite after each fix."

  → After fixes, commit and push:
    git add -A
    git commit -m "fix: address review findings [Phase 3A-i]"
    git push origin main

  → Re-run Step 4 from the beginning.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

### What This Step Does

The build may have changed line counts in reference docs, introduced new domain terms, or made cross-references stale. This step brings docs back into alignment with the codebase.

### 5.1 — Create the Fix Branch

**[GIT COMMAND]**

```
git checkout main && git pull origin main
git checkout -b fix/post-3a-i-docs-sync
```

### 5.2 — Run the Docs Agent

Open Claude Code in the monorepo. Paste:

**[PASTE INTO CLAUDE CODE]**

```
You are the Docs Agent for EveryStack, running after Phase 3A-i build.

Your mandate: bring documentation back into alignment with the codebase.

Tasks:
1. Run: wc -l docs/reference/*.md
   Compare against MANIFEST.md line counts. Update any that changed.
2. Review GLOSSARY.md. Check if any new domain terms were introduced
   during the build (search the git diff for new type names, component names,
   or concept names not already in the glossary). Add definitions for any missing terms.
3. Check cross-references in docs that reference files changed during
   the build. Fix any stale section references or line ranges.
4. Update the phase-context skill file (docs/skills/phase-context/SKILL.md)
   with Phase 3A-i deliverables — what was built, key files created, patterns established.
5. Update section indexes in any doc whose line counts changed significantly.

Key files created during this build:
- apps/web/src/data/tables.ts, fields.ts, records.ts, views.ts
- apps/web/src/actions/record-actions.ts, view-actions.ts
- apps/web/src/lib/types/grid.ts
- apps/web/src/lib/hooks/use-grid-data.ts, use-cell-edit.ts, use-optimistic-record.ts
- apps/web/src/components/grid/ (DataGrid, GridHeader, GridRow, GridCell, cells/*, use-grid-store, use-keyboard-navigation, use-column-resize, use-column-reorder, use-row-reorder, use-clipboard, use-undo-redo, ColumnResizer, ColumnHeaderMenu, RowContextMenu, NewRowInput, DragToFillHandle, CellErrorOverlay, PerformanceBanner, GridSkeleton, GridEmptyState, TableTypeIcon)
- apps/web/src/lib/constants/table-types.ts

Forbidden:
- Do NOT modify any application code
- Do NOT modify any file outside docs/
- Only fix docs — do not add features or refactor
```

### 5.3 — Review and Merge

**[CHECKPOINT]**

```
Review the diff:
  git diff main...fix/post-3a-i-docs-sync
Look for:
- MANIFEST.md line counts match actual file sizes
- No stale cross-references remain
- No new terms missing from GLOSSARY.md
- Phase context skill file updated with 3A-i deliverables
- Section indexes updated where needed
```

**[GIT COMMAND]**

```
git add -A
git commit -m "docs: post-Phase-3A-i docs sync (MANIFEST, GLOSSARY, cross-refs, phase-context)"
git push origin fix/post-3a-i-docs-sync
```

Open a PR titled "[Step 5] Phase 3A-i — Post-Build Docs Sync".
Review. Merge to main. Delete the branch.

### 5.4 — Tag If Milestone

**[DECISION POINT]**

```
Phase 3A-i is NOT a major milestone (it's the first sub-phase of Phase 3A).
  → Skip tagging. Proceed to the next sub-phase.
```

---

## NEXT SUB-PHASE

Phase 3A-i is complete. The next sub-phase is **3A-ii** — Grid View Extended: Filtering, Sorting, Grouping, Views, Record View, Card View.

Return to Step 0 for Phase 3A-ii using that sub-phase's Prompting Roadmap. If no Prompting Roadmap exists yet, start from Step 1 (playbook generation) for Phase 3A-ii.
