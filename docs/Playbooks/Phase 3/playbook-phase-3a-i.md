# Phase 3A-i — Grid View Core: Layout, Cell Renderers & Inline Editing

## Phase Context

### What Has Been Built

**Phase 1 (MVP — Foundation) is complete and merged to main.** Key outputs relevant to Phase 3A-i:

- **1A:** Turborepo + pnpm monorepo with `apps/web`, `apps/worker`, `apps/realtime`, `packages/shared` scaffolds. Docker Compose with PostgreSQL 16, PgBouncer, Redis. GitHub Actions CI. ESLint + Prettier.
- **1B:** Drizzle schema for 59 tables including `tables`, `fields`, `records`, `views`, `user_view_preferences`, `record_view_configs`. `getDbForTenant()` with read/write routing. RLS policies. UUIDv7 primary keys. `records` hash-partitioned by `tenant_id`.
- **1C:** Clerk integration with webhook handler. Tenant middleware (`getTenantId` from session). Five workspace roles on `workspace_memberships`. Permission check utilities (`checkRole()`, `requireRole()`, `roleAtLeast()`). `PermissionDeniedError` shape.
- **1D:** Pino structured logging with `AsyncLocalStorage` traceId. Sentry integration. OpenTelemetry basic instrumentation. Security headers middleware.
- **1E:** Vitest workspace config. Playwright E2E setup. Test data factories for all core tables (`createTestTenant()`, `createTestRecord()`, etc.). `testTenantIsolation()` helper. MSW mock setup.
- **1F:** shadcn/ui primitives installed (18 components including checkbox). Tailwind config with three-layer color architecture (surface, accent, data palette). DM Sans + JetBrains Mono fonts. Responsive application shell layout with Icon Rail (48px) + Content Zone (232px) sidebar, accent header (52px).
- **1G:** Socket.io server with Clerk JWT auth and Redis adapter. Room join/leave model. BullMQ worker skeleton with queue definitions. StorageClient + R2.
- **1J:** CP-001/CP-002 schema migrations. Auth middleware updated to `effective_memberships`. Sidebar navigation tree with tenant switching. ShellAccentProvider, TenantSwitcher, WorkspaceTree.

**Phase 2 (MVP — Sync) is complete and merged to main.** Key outputs relevant to Phase 3A-i:

- **2A:** `FieldTypeRegistry` at `packages/shared/sync/field-registry.ts` with canonical JSONB shapes for all MVP field types. AirtableAdapter with `toCanonical()` / `fromCanonical()`.
- **2B:** JSONB expression indexes on `records.canonical_data` for grid query performance. Outbound sync pipeline. Conflict resolution (`sync_conflicts` table with Manager resolution UI). `search_vector` tsvector population.
- **2C:** NotionAdapter (18 property types). Sync error recovery. Priority scheduler. Sync dashboard (6-tab settings page). Sidebar sync badges (PlatformBadge, SyncStatusIcon).

### What This Phase Delivers

A fully functional spreadsheet-style grid view powered by TanStack Table + TanStack Virtual with:
- Windowed virtualization rendering 10K+ rows smoothly
- All ~16 MVP field type cell renderers (display + edit modes)
- Full keyboard navigation (arrow keys, tab, enter, escape, home/end, page up/down)
- Inline cell editing with auto-save on blur and optimistic updates
- Column resize, reorder, and freeze
- Row density modes (compact 32px / medium 44px / tall 64px)
- Row reordering via drag handle
- Persistent "add row" at bottom
- Context menus for column headers (14 items) and rows (9 items)
- Cell error state overlays (broken reference, sync conflict, processing, succeeded, type coercion)
- Multi-cell copy/paste with type coercion
- Undo/redo for inline edits
- Table type system with 5 types and tab colors

### What This Phase Does NOT Build

- Filtering, sorting, grouping UI (3A-ii)
- Summary footer row (3A-ii)
- Grid toolbar layout (3A-ii)
- My Views / Shared Views (3A-ii)
- Multi-user collaboration / field-level presence locking (3A-ii)
- Record View overlay (3A-ii)
- Card View (3A-ii)
- Sections (3A-ii)
- Inline Sub-Table display (3A-ii)
- CSV import (3A-ii)
- Selection & Bulk Actions toolbar (3A-ii — checkbox column is rendered but bulk actions toolbar ships in 3A-ii)
- Field-level permission enforcement (3A-iii — grid renders all fields for Manager+ initially)
- Cross-link creation/resolution (3B-i — Linked Record renderer shows pills from canonical_data but link picker ships in 3B-i)
- Kanban view (post-MVP)
- Formula engine / computed fields (post-MVP)
- Quick Entry mode (post-MVP)

### Architecture Patterns for This Phase

1. **Component architecture:** Grid components live in `apps/web/src/components/grid/`. Cell renderers in `apps/web/src/components/grid/cells/`. Each field type gets a `CellRenderer` (display) and `CellEditor` (edit mode) component.
2. **FieldTypeRegistry consumption:** Cell renderers consume `FieldTypeRegistry` from `packages/shared/sync/field-registry.ts` for canonical JSONB shape information. Never switch on field types — use the registry.
3. **Data loading:** Grid data loaded via `/data` functions using `getDbForTenant()`. Server Components for initial load, TanStack Query for client-side updates.
4. **Optimistic updates:** Cell edits use optimistic updates via TanStack Query's `onMutate` → `onError` rollback pattern. Server Actions for mutations.
5. **Virtualization:** TanStack Virtual for row/column windowing. Row overscan: 10, column overscan: 3.
6. **State management:** Grid-local state (selection, edit mode, density) managed by Zustand store per grid instance. No global grid state.
7. **Responsive:** Desktop-first grid with responsive Tailwind classes. Mobile-specific layout ships in Phase 3H.
8. **i18n:** All user-facing text through next-intl. No hardcoded English strings.
9. **CockroachDB safeguards remain active** (UUIDv7, no PG-specific syntax, no advisory locks).

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
| 1 | Grid data layer — queries and Server Actions for records, fields, views | None | ~250 |
| 2 | TanStack Table + Virtual grid shell with column model | 1 | ~300 |
| 3 | Cell renderers — Text, Number, Date, Checkbox, Rating, Currency, Percent | 2 | ~350 |
| 4 | Cell renderers — Select, Multi-Select, People, Linked Record, Attachment | 2 | ~350 |
| CP-1 | Integration Checkpoint 1 | 1–4 | — |
| 5 | Cell renderers — URL, Email, Phone, Smart Doc, Barcode, Checklist | 2 | ~250 |
| 6 | Inline cell editing with auto-save and optimistic updates | 3, 4, 5 | ~300 |
| 7 | Keyboard navigation and cell error state overlays | 6 | ~250 |
| CP-2 | Integration Checkpoint 2 | 5–7 | — |
| 8 | Column behavior — resize, reorder, freeze, context menu, coloring | 2 | ~250 |
| 9 | Row behavior — density, reorder, context menu, new row, copy/paste, undo | 6, 8 | ~300 |
| 10 | Table type system, tab colors, performance thresholds, loading/empty states | 9 | ~200 |
| CP-3 | Integration Checkpoint 3 (Final) | 8–10 | — |

---

## Prompt 1: Grid Data Layer — Queries and Server Actions for Records, Fields, and Views

**Depends on:** None
**Load context:** `tables-and-views.md` lines 27–42 (Table Type System basics), `data-model.md` lines 74–92 (Data Layer + Views schema)
**Target files:**
- `apps/web/src/data/tables.ts`
- `apps/web/src/data/fields.ts`
- `apps/web/src/data/records.ts`
- `apps/web/src/data/views.ts`
- `apps/web/src/actions/record-actions.ts`
- `apps/web/src/data/__tests__/tables.integration.test.ts`
- `apps/web/src/data/__tests__/records.integration.test.ts`
**Migration required:** No
**Git:** Create and checkout branch `build/3a-i-grid-view-core` from main. Commit with message `feat(data): grid data layer — records, fields, views queries [Phase 3A-i, Prompt 1]`

### Schema Snapshot

```
tables: id (UUIDv7 PK), workspace_id, tenant_id, name, table_type (ENUM: table|projects|calendar|documents|wiki), tab_color (VARCHAR 20, nullable), environment, created_by, created_at, updated_at

fields: id (UUIDv7 PK), table_id, tenant_id, name, field_type (VARCHAR), field_sub_type (nullable), is_primary (boolean), is_system (boolean), required, unique, read_only, config (JSONB), display (JSONB), permissions (JSONB), default_value (JSONB nullable), description (TEXT nullable), sort_order (INTEGER), external_field_id (nullable), environment, created_at, updated_at

records: tenant_id, id (composite PK), table_id, canonical_data (JSONB), sync_metadata (JSONB), search_vector (tsvector), deleted_at, created_by, updated_by, created_at, updated_at

views: id, tenant_id, table_id, name, view_type (VARCHAR: grid|card), config (JSONB), permissions (JSONB), is_shared (boolean), publish_state, environment, position, created_by, created_at, updated_at
```

### Task

Build the server-side data access layer that the grid view will consume. This is the foundation — all grid rendering depends on these queries.

**1. Table queries (`apps/web/src/data/tables.ts`):**
- `getTableById(tenantId, tableId)` — returns table with workspace info
- `getTablesByWorkspace(tenantId, workspaceId)` — returns all tables in workspace, ordered by name
- All queries use `getDbForTenant(tenantId, 'read')` and filter by `tenant_id`

**2. Field queries (`apps/web/src/data/fields.ts`):**
- `getFieldsByTable(tenantId, tableId)` — returns all fields for a table, ordered by `sort_order`. Exclude `deleted_at IS NOT NULL` if soft-delete exists
- `getFieldById(tenantId, fieldId)` — single field lookup

**3. Record queries (`apps/web/src/data/records.ts`):**
- `getRecordsByTable(tenantId, tableId, options?)` — paginated records query. Options: `{ limit?: number, offset?: number, cursor?: string }`. Default limit 100. Returns `{ records, totalCount, hasMore }`. Excludes soft-deleted (`deleted_at IS NULL`)
- `getRecordById(tenantId, recordId)` — single record lookup
- Records use the composite PK `(tenant_id, id)` — always filter by both

**4. View queries (`apps/web/src/data/views.ts`):**
- `getViewsByTable(tenantId, tableId)` — all views for a table, ordered by position
- `getViewById(tenantId, viewId)` — single view with config
- `getDefaultView(tenantId, tableId)` — follows the default view fallback chain: (1) manager-assigned default, (2) first shared grid by position, (3) first shared any type, (4) auto-generated "All Records" grid

**5. Record Server Actions (`apps/web/src/actions/record-actions.ts`):**
- `createRecord(tenantId, tableId, canonicalData)` — creates record with canonical_data JSONB keyed by field.id. Validates with Zod. Returns created record
- `updateRecordField(tenantId, recordId, fieldId, value)` — updates a single field value in canonical_data JSONB. Uses Drizzle's `jsonb_set` or equivalent. This is the action inline cell editing will call
- `deleteRecord(tenantId, recordId)` — soft delete (sets `deleted_at`)
- All actions validate `tenantId` via `getAuthContext()` and use `getDbForTenant(tenantId, 'write')`
- All actions use Zod for input validation

**6. TypeScript types (`apps/web/src/lib/types/grid.ts`):**
- `GridRecord` — typed wrapper around the records table row
- `GridField` — typed wrapper around the fields table row with config JSONB shape
- `GridView` — typed wrapper around the views table row with config JSONB shape
- `ViewConfig` — Zod schema for the `views.config` JSONB shape (column widths, frozen columns, density, etc.)

### Acceptance Criteria

- [ ] `testTenantIsolation()` passes for `getRecordsByTable()`, `getRecordById()`, `getFieldsByTable()`, `getTableById()`, `getViewsByTable()`
- [ ] `getRecordsByTable()` returns paginated results with `totalCount` and `hasMore`
- [ ] `getRecordsByTable()` excludes soft-deleted records (`deleted_at IS NOT NULL`)
- [ ] `createRecord()` with valid canonical_data returns the new record with UUIDv7 id
- [ ] `updateRecordField()` updates a single field value in canonical_data without overwriting other fields
- [ ] `getDefaultView()` follows the 4-step fallback chain correctly
- [ ] All Zod schemas validate input correctly and reject invalid data
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Coverage ≥80% on new files
- [ ] No hardcoded English strings — all user-facing text through i18n

### Do NOT Build

- Filtering, sorting, or grouping query logic (3A-ii)
- Permission filtering on field visibility (3A-iii)
- Cross-link resolution queries (3B-i)
- Full-text search on records (3B-ii — Command Bar)
- Batch record operations (3F-ii)

---

## Prompt 2: TanStack Table + Virtual Grid Shell with Column Model

**Depends on:** Prompt 1
**Load context:** `tables-and-views.md` lines 120–144 (Grid Anatomy, Permission Gating), lines 233–255 (Scrolling & Performance), `design-system.md` lines 44–57 (Foundations — dimensions), lines 277–284 (Table Grid View responsive)
**Target files:**
- `apps/web/src/components/grid/DataGrid.tsx`
- `apps/web/src/components/grid/GridHeader.tsx`
- `apps/web/src/components/grid/GridRow.tsx`
- `apps/web/src/components/grid/GridCell.tsx`
- `apps/web/src/components/grid/use-grid-store.ts`
- `apps/web/src/components/grid/grid-types.ts`
- `apps/web/src/lib/hooks/use-grid-data.ts`
**Migration required:** No
**Git:** Commit with message `feat(grid): TanStack Table + Virtual grid shell with column model [Phase 3A-i, Prompt 2]`

### Schema Snapshot

N/A — no schema changes. Consumes data from Prompt 1's queries.

### Task

Build the core grid component using TanStack Table for column model management and TanStack Virtual for windowed virtualization.

**1. Grid data hook (`apps/web/src/lib/hooks/use-grid-data.ts`):**
- `useGridData(tableId, viewId)` — TanStack Query hook that fetches records, fields, and view config. Returns `{ records, fields, viewConfig, isLoading, error }`. Uses the data functions from Prompt 1.

**2. Grid store (`apps/web/src/components/grid/use-grid-store.ts`):**
- Zustand store scoped per grid instance (not global)
- State: `activeCell: { rowId, fieldId } | null`, `editingCell: { rowId, fieldId } | null`, `density: 'compact' | 'medium' | 'tall'`, `frozenColumnCount: number`, `columnWidths: Record<string, number>`, `columnOrder: string[]`
- Actions: `setActiveCell()`, `startEditing()`, `stopEditing()`, `setDensity()`, `setColumnWidth()`, `reorderColumn()`, `setFrozenCount()`

**3. DataGrid component (`apps/web/src/components/grid/DataGrid.tsx`):**
- Consumes `useGridData()` and passes to TanStack Table's `useReactTable()`
- Column definitions generated from `fields` array — each field becomes a column with id, header, cell renderer, size (from default widths table in reference doc)
- TanStack Virtual for row virtualization: `useVirtualizer()` with `estimateSize` based on density mode (32/44/64px), `overscan: 10`
- Column virtualization for horizontal scrolling: separate `useVirtualizer()` with `overscan: 3`
- Fixed columns: row number + checkbox + primary field always rendered (not virtualized). Up to 5 additional user-frozen columns
- Grid anatomy (left to right): drag handle (on hover) → checkbox column → row number → primary field (frozen) → remaining fields → "+" column (Manager+ only via `roleAtLeast('manager')`)
- Sticky header row. Data rows scroll between header and footer area
- Render container with `overflow: auto` for both horizontal and vertical scrolling

**4. GridHeader (`apps/web/src/components/grid/GridHeader.tsx`):**
- Renders column headers with: field type icon + field name + sort indicator placeholder + filter indicator placeholder
- Click header → select column (stores in grid store)
- Click sort indicator area → placeholder (no-op, ships in 3A-ii)

**5. GridRow (`apps/web/src/components/grid/GridRow.tsx`):**
- Renders a single data row
- Shows drag handle on hover (grip icon)
- Row number column
- Checkbox column (always visible, pinned left)
- Zebra striping: alternating `bg-white` / `bg-slate-50`
- Row hover: subtle background highlight `bg-slate-100`
- Expand icon (⤢) appears in primary field cell on hover — placeholder onClick (Record View ships in 3A-ii)

**6. GridCell (`apps/web/src/components/grid/GridCell.tsx`):**
- Wrapper component that: selects the correct cell renderer based on `field.field_type` using FieldTypeRegistry lookup (not a switch statement), handles active cell highlighting (blue border), passes edit mode state
- Overflow: truncate with ellipsis via `truncate` Tailwind class

**7. Default column widths** (from tables-and-views.md lines 166–188):
- Map each field type to its default width. Store as a constant in `grid-types.ts`.

**8. Design tokens:**
- Use `borderDefault` (`#E2E8F0`) for grid lines
- Use `panelBg` (`#F1F5F9`) for header row background
- Use `textPrimary` (`#0F172A`) for cell text
- Use `textSecondary` (`#475569`) for row numbers and secondary text
- 4px base spacing unit for all padding

### Acceptance Criteria

- [ ] DataGrid renders with TanStack Table column model generated from fields
- [ ] TanStack Virtual row virtualization renders only visible rows + 10 overscan
- [ ] Column virtualization renders only visible columns + 3 overscan
- [ ] Primary field is frozen left and never virtualized
- [ ] Checkbox column and row numbers render for all rows
- [ ] "+" column visible only when user role is Manager+ (tested with `roleAtLeast`)
- [ ] Drag handle appears on row hover
- [ ] Expand icon (⤢) appears in primary field on row hover
- [ ] Zebra striping alternates correctly
- [ ] Density modes change row height (32/44/64px)
- [ ] Grid store manages activeCell, editingCell, density, columnWidths, columnOrder, frozenColumnCount
- [ ] ESLint and TypeScript compile with zero errors
- [ ] Component tests pass for DataGrid, GridRow, GridCell

### Do NOT Build

- Cell editing interaction (Prompt 6)
- Keyboard navigation (Prompt 7)
- Column resize/reorder drag interactions (Prompt 8)
- Column header right-click context menu (Prompt 8)
- Filtering, sorting, grouping UI (3A-ii)
- Grid toolbar (3A-ii)
- Summary footer row (3A-ii)

---

## Prompt 3: Cell Renderers — Text, Number, Date, Checkbox, Rating, Currency, Percent

**Depends on:** Prompt 2
**Load context:** `tables-and-views.md` lines 302–321 (Cell Type Rendering table), lines 257–288 (Cell Behavior), `design-system.md` lines 139–170 (Data Color Palette)
**Target files:**
- `apps/web/src/components/grid/cells/TextCell.tsx`
- `apps/web/src/components/grid/cells/NumberCell.tsx`
- `apps/web/src/components/grid/cells/DateCell.tsx`
- `apps/web/src/components/grid/cells/CheckboxCell.tsx`
- `apps/web/src/components/grid/cells/RatingCell.tsx`
- `apps/web/src/components/grid/cells/CurrencyCell.tsx`
- `apps/web/src/components/grid/cells/PercentCell.tsx`
- `apps/web/src/components/grid/cells/cell-registry.ts`
- `apps/web/src/components/grid/cells/__tests__/` (component tests)
**Migration required:** No
**Git:** Commit with message `feat(grid): cell renderers — text, number, date, checkbox, rating, currency, percent [Phase 3A-i, Prompt 3]`

### Schema Snapshot

N/A — reads from `records.canonical_data` JSONB keyed by `fields.id`.

### Task

Build the first batch of cell renderers. Each renderer has two modes: **display** (read-only view in grid) and **edit** (activated by click/double-click — edit interaction wiring ships in Prompt 6, but the edit UI component is built now).

**1. Cell registry (`cell-registry.ts`):**
- Maps `field_type` string → `{ DisplayComponent, EditComponent, defaultWidth }` using the FieldTypeRegistry pattern — NOT a switch statement
- Export `getCellComponents(fieldType: string)` function
- GridCell from Prompt 2 calls this to resolve which renderer to use

**2. TextCell:**
- **Display:** Renders text value. Truncate with ellipsis. Full value on edit
- **Edit:** Text input filling cell. Auto-focus on mount

**3. NumberCell:**
- **Display:** Formatted number (locale-aware via Intl.NumberFormat)
- **Edit:** Number input with type validation

**4. DateCell:**
- **Display:** Formatted date (e.g., "Feb 9, 2026" — locale-aware)
- **Edit:** Date picker (shadcn/ui Calendar + Popover). Click opens picker

**5. CheckboxCell:**
- **Display + Edit combined:** Single click toggles directly. No separate edit mode
- Renders shadcn/ui Checkbox component

**6. RatingCell:**
- **Display:** Inline star widget (★★★☆☆). Number of stars from `field.config.max` (default 5)
- **Edit:** Click star position to set value

**7. CurrencyCell:**
- **Display:** Formatted with currency symbol from `field.config.currency` (e.g., "$1,250.00" — Intl.NumberFormat with currency style)
- **Edit:** Number input. Symbol shown as prefix

**8. PercentCell:**
- **Display:** Inline progress bar filling cell background. Value text overlaid (e.g., "75%")
- **Edit:** Number input (0–100)

**Each renderer must:**
- Accept `value`, `field`, `isEditing`, `onSave(value)`, `onCancel()` props
- Handle `null`/`undefined` values gracefully (render empty cell)
- Use the canonical JSONB value shape from FieldTypeRegistry
- Read-only cells show lock icon (for `field.read_only === true`)
- Use design system tokens for colors and spacing

### Acceptance Criteria

- [ ] Cell registry maps all 7 field types to display + edit components
- [ ] TextCell renders and truncates long text with ellipsis
- [ ] NumberCell formats with locale-aware number formatting
- [ ] DateCell renders formatted date and edit mode opens date picker
- [ ] CheckboxCell toggles on single click
- [ ] RatingCell renders star widget and click sets value
- [ ] CurrencyCell formats with currency symbol from field config
- [ ] PercentCell renders progress bar with value overlay
- [ ] All renderers handle null/undefined values (empty cell)
- [ ] Read-only fields show lock icon
- [ ] Component tests pass for all 7 cell types (display + edit modes)
- [ ] ESLint and TypeScript compile with zero errors
- [ ] No hardcoded English strings

### Do NOT Build

- Cell editing interaction (click/double-click wiring — Prompt 6)
- Save/cancel on blur/escape (Prompt 6)
- Drag-to-fill (Prompt 9)
- Multi-cell copy/paste (Prompt 9)

---

## Prompt 4: Cell Renderers — Select, Multi-Select, People, Linked Record, Attachment

**Depends on:** Prompt 2
**Load context:** `tables-and-views.md` lines 302–321 (Cell Type Rendering table), `design-system.md` lines 139–170 (Data Color Palette — select option colors)
**Target files:**
- `apps/web/src/components/grid/cells/SingleSelectCell.tsx`
- `apps/web/src/components/grid/cells/MultiSelectCell.tsx`
- `apps/web/src/components/grid/cells/PeopleCell.tsx`
- `apps/web/src/components/grid/cells/LinkedRecordCell.tsx`
- `apps/web/src/components/grid/cells/AttachmentCell.tsx`
- `apps/web/src/components/grid/cells/__tests__/` (component tests)
**Migration required:** No
**Git:** Commit with message `feat(grid): cell renderers — select, multi-select, people, linked record, attachment [Phase 3A-i, Prompt 4]`

### Schema Snapshot

N/A — reads from `records.canonical_data` JSONB.

### Task

Build the second batch of cell renderers — these are more complex as they involve pills, avatars, thumbnails, and overflow indicators.

**1. SingleSelectCell:**
- **Display:** Configurable per `field.display.style`: full colored block, colored pill, dot + text, or plain text. Colors from the 13-color data palette (light tone for fills, saturated for pills). Default: colored pill
- **Edit:** Dropdown with all options from `field.config.options`. Search/filter within dropdown. Click to select. Show current selection highlighted

**2. MultiSelectCell:**
- **Display:** Same display styles as SingleSelect. Multiple pills. Overflow as "+N" badge when too many to fit
- **Edit:** Multi-select dropdown. Checkmarks on selected. Search/filter. Click to toggle

**3. PeopleCell:**
- **Display:** Configurable per `field.display.style`: grey pill + avatar, colored pill + name, avatar only. Overflow "+N". Avatars from `users.avatar_url`
- **Edit:** People picker dropdown. Search workspace members. Click to add/remove

**4. LinkedRecordCell:**
- **Display:** Clickable pills showing primary field value of linked record. Overflow "+N". Pills styled with subtle border
- **Edit:** Placeholder — shows pills with "Link Picker ships in Phase 3B-i" message on edit attempt. The Linked Record cell renderer exists now to display existing links from canonical_data, but the Link Picker modal for creating/removing links ships in 3B-i
- Click on a pill is a no-op for now (navigation to linked record ships with Record View in 3A-ii)

**5. AttachmentCell:**
- **Display:** Thumbnail strip (3–4 small thumbnails for images, file type icons for non-images). "+N" overflow badge
- **Edit:** Placeholder — "Attachment manager opens in Record View (3A-ii)". Grid cell is display-only for attachments

**Shared components needed:**
- `PillBadge` — reusable pill component with color, text, optional avatar, optional close button
- `OverflowBadge` — "+N" indicator with tooltip showing remaining items

### Acceptance Criteria

- [ ] SingleSelectCell renders all 4 display styles (block, pill, dot+text, plain)
- [ ] SingleSelectCell edit dropdown filters options and allows selection
- [ ] MultiSelectCell renders multiple pills with "+N" overflow
- [ ] MultiSelectCell edit dropdown supports multi-selection with checkmarks
- [ ] PeopleCell renders all 3 display styles (pill+avatar, pill+name, avatar-only)
- [ ] LinkedRecordCell renders pills with primary field values
- [ ] LinkedRecordCell edit mode shows placeholder message (link picker deferred to 3B-i)
- [ ] AttachmentCell renders thumbnail strip with file type icons
- [ ] PillBadge and OverflowBadge components are reusable
- [ ] Colors match the 13-color data palette from design-system.md
- [ ] All renderers handle null/undefined/empty arrays gracefully
- [ ] Component tests pass for all 5 cell types
- [ ] Cell registry updated with all 5 new types
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Link Picker modal for creating/removing linked records (3B-i)
- Attachment upload or attachment manager modal (3A-ii Record View)
- Cross-link resolution or display value lookup (3B-i)
- People picker that queries workspace members from server (placeholder data for now)

---

## Integration Checkpoint 1 (after Prompts 1–4)

**Task:** Verify all work from Prompts 1–4 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: DataGrid component renders with fields as columns and records as rows. Cell renderers display correct types. Checkbox toggles. Star rating renders.

**Git:** Commit with message `chore(verify): integration checkpoint 1 [Phase 3A-i, CP-1]`, then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## Prompt 5: Cell Renderers — URL, Email, Phone, Smart Doc, Barcode, Checklist

**Depends on:** Prompt 2
**Load context:** `tables-and-views.md` lines 302–321 (Cell Type Rendering table)
**Target files:**
- `apps/web/src/components/grid/cells/UrlCell.tsx`
- `apps/web/src/components/grid/cells/EmailCell.tsx`
- `apps/web/src/components/grid/cells/PhoneCell.tsx`
- `apps/web/src/components/grid/cells/SmartDocCell.tsx`
- `apps/web/src/components/grid/cells/BarcodeCell.tsx`
- `apps/web/src/components/grid/cells/ChecklistCell.tsx`
- `apps/web/src/components/grid/cells/__tests__/` (component tests)
**Migration required:** No
**Git:** Commit with message `feat(grid): cell renderers — url, email, phone, smart doc, barcode, checklist [Phase 3A-i, Prompt 5]`

### Schema Snapshot

N/A — reads from `records.canonical_data` JSONB.

### Task

Build the final batch of cell renderers — these are simpler renderers.

**1. UrlCell:**
- **Display:** Clickable link text (blue, `text-blue-600`). External link icon on hover. Opens in new tab
- **Edit:** Text input. Auto-detect URL format

**2. EmailCell:**
- **Display:** Clickable mailto link (blue text)
- **Edit:** Text input with email validation

**3. PhoneCell:**
- **Display:** Formatted phone number + phone icon
- **Edit:** Text input on desktop

**4. SmartDocCell:**
- **Display:** Badge indicating "Doc" content exists (if value is truthy). Empty if no content
- **Edit:** No inline edit — "Opens in Smart Doc editor (Phase 3D)" placeholder. Click is no-op

**5. BarcodeCell:**
- **Display:** Value as text + barcode icon (QR code icon from lucide-react)
- **Edit:** Text input. Paste-friendly for USB barcode scanners

**6. ChecklistCell:**
- **Display:** Compact "3/7 done" text + mini progress bar
- **Edit:** Popover with checklist items. Checkbox per item. Add new item. Reorder via drag

**Update the cell registry** to include all 6 new types.

### Acceptance Criteria

- [ ] UrlCell renders clickable link that opens in new tab
- [ ] EmailCell renders clickable mailto link
- [ ] PhoneCell renders formatted number with phone icon
- [ ] SmartDocCell renders badge when content exists, empty when not
- [ ] BarcodeCell renders text with barcode icon
- [ ] ChecklistCell renders "X/Y done" with mini progress bar
- [ ] ChecklistCell edit popover allows checking/unchecking items
- [ ] Cell registry now contains all ~16 MVP field types
- [ ] Component tests pass for all 6 cell types
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Smart Doc editor or TipTap integration (Phase 3D)
- Barcode scanning via camera (post-MVP)
- Checklist drag-and-drop reordering (can be simplified for MVP)

---

## Prompt 6: Inline Cell Editing with Auto-Save and Optimistic Updates

**Depends on:** Prompts 3, 4, 5
**Load context:** `tables-and-views.md` lines 257–288 (Cell Behavior — editing modes, optimistic updates, validation errors)
**Target files:**
- `apps/web/src/components/grid/GridCell.tsx` (update)
- `apps/web/src/components/grid/use-grid-store.ts` (update)
- `apps/web/src/lib/hooks/use-cell-edit.ts`
- `apps/web/src/lib/hooks/use-optimistic-record.ts`
- `apps/web/src/components/grid/__tests__/cell-editing.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): inline cell editing with auto-save and optimistic updates [Phase 3A-i, Prompt 6]`

### Schema Snapshot

N/A — uses `updateRecordField()` Server Action from Prompt 1.

### Task

Wire up the inline cell editing interaction model that makes the grid feel like a spreadsheet.

**1. Editing modes (spreadsheet-style):**
- **Single click + type:** Replace mode — existing content cleared, new keystroke becomes the value. Cell enters edit mode with empty input
- **Double-click:** Edit mode — cursor placed within existing content. Cell enters edit mode with current value
- **Checkbox/Rating:** Single click directly toggles value (no edit mode transition)

**2. Edit lifecycle hook (`use-cell-edit.ts`):**
- `useCellEdit(recordId, fieldId)` — manages edit state for a single cell
- Handles: focus, blur, save, cancel, validation
- **Auto-save on blur:** When cell loses focus, save the current value. No explicit save button
- **Cancel on Escape:** Revert to original value
- **Confirm on Enter:** Save and move to next row (same column)
- **Confirm on Tab:** Save and move to next column (same row)

**3. Optimistic updates hook (`use-optimistic-record.ts`):**
- Uses TanStack Query's mutation with optimistic update pattern:
  - `onMutate`: immediately update the query cache with new value
  - `onError`: roll back to previous value, show error toast
  - `onSettled`: invalidate and refetch
- Calls `updateRecordField()` Server Action

**4. Update GridCell component:**
- Integrate `useCellEdit` hook
- Handle single-click → replace mode, double-click → edit mode
- Pass `isEditing`, `onSave`, `onCancel` to cell renderer
- Show blue border on active cell, thicker blue border + shadow on editing cell
- Validation error: red cell border + error message below cell. Cell stays in edit mode. Escape reverts

**5. Empty cells:** Render blank — no placeholder text per reference doc.

**6. Read-only cells:** `field.read_only === true` or system fields — click does nothing. Subtle lock icon already rendered by cell renderers.

### Acceptance Criteria

- [ ] Single click + type enters replace mode (clears content)
- [ ] Double-click enters edit mode (preserves content, cursor at end)
- [ ] Checkbox toggles on single click without entering edit mode
- [ ] Rating sets value on star click without entering edit mode
- [ ] Auto-save fires on blur
- [ ] Escape cancels edit and reverts to original value
- [ ] Enter saves and moves to cell below
- [ ] Tab saves and moves to cell right
- [ ] Optimistic update shows new value immediately
- [ ] On server error, cell rolls back with error toast
- [ ] Validation error shows red border + error message
- [ ] Read-only cells ignore click/double-click
- [ ] Empty cells render blank (no placeholder)
- [ ] Tests cover all edit lifecycle states
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Multi-cell copy/paste (Prompt 9)
- Drag-to-fill (Prompt 9)
- Undo/redo stack (Prompt 9)
- Field-level locking for concurrent edits (3A-ii multi-user collaboration)

---

## Prompt 7: Keyboard Navigation and Cell Error State Overlays

**Depends on:** Prompt 6
**Load context:** `tables-and-views.md` lines 323–371 (Keyboard Shortcuts), lines 289–301 (Cell Error States)
**Target files:**
- `apps/web/src/components/grid/use-keyboard-navigation.ts`
- `apps/web/src/components/grid/CellErrorOverlay.tsx`
- `apps/web/src/components/grid/DataGrid.tsx` (update — integrate keyboard handler)
- `apps/web/src/components/grid/__tests__/keyboard-navigation.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): keyboard navigation and cell error state overlays [Phase 3A-i, Prompt 7]`

### Schema Snapshot

N/A — no schema changes.

### Task

**1. Keyboard navigation hook (`use-keyboard-navigation.ts`):**

Implement full spreadsheet-style keyboard navigation. `Cmd` = `Ctrl` on Windows/Linux.

**Navigation:**
| Shortcut | Action |
|----------|--------|
| Arrow keys | Move active cell between cells |
| Tab / Shift+Tab | Next / previous cell (wraps to next/prev row) |
| Enter | If not editing: start editing. If editing: confirm + move down |
| Escape | Cancel edit / deselect active cell |
| Home / End | First / last column in current row |
| Cmd+Home / Cmd+End | First / last row (first/last column) |
| Page Up / Page Down | Scroll one viewport of rows |

**Selection:**
| Shortcut | Action |
|----------|--------|
| Shift+Arrow | Extend selection range |
| Shift+Click | Range select from active cell to clicked cell |
| Cmd+Click | Toggle individual row selection (checkbox) |
| Cmd+A | Select all rows |

**Editing:**
| Shortcut | Action |
|----------|--------|
| Cmd+Z / Cmd+Shift+Z | Undo / Redo (placeholder — stack built in Prompt 9) |
| Cmd+C / Cmd+V | Copy / Paste (placeholder — full impl in Prompt 9) |
| Cmd+D | Fill down (copy cell above — placeholder, full impl in Prompt 9) |
| Delete / Backspace | Clear cell contents |
| Space | Toggle checkbox (if active cell is checkbox type) |
| Any character | Start editing in replace mode |
| F2 | Start editing in edit mode (cursor at end) |

**Grid Actions (placeholder — functional integration in later prompts):**
| Shortcut | Action |
|----------|--------|
| Cmd+Shift+F | Toggle filter panel (no-op, 3A-ii) |
| Cmd+Shift+S | Toggle sort panel (no-op, 3A-ii) |
| Cmd+F | Command Bar scoped (no-op, 3B-ii) |
| Cmd+Shift+E | Open Record View (no-op, 3A-ii) |
| Cmd+Shift+N | New record (triggers add row) |
| Cmd+K | Command Bar (no-op, 3B-ii) |
| Cmd+/ | Keyboard shortcuts help dialog |

- Hook attaches to the DataGrid container via `onKeyDown`
- When editing a cell, most navigation shortcuts are suppressed (let the input handle them)
- Arrow key navigation should scroll the virtualizer to keep the active cell visible

**2. Keyboard shortcuts help dialog:**
- `Cmd+/` opens a modal showing all available shortcuts grouped by category
- Use shadcn/ui Dialog

**3. Cell error state overlays (`CellErrorOverlay.tsx`):**

Wrapper component applied to any cell renderer. Inspects `record.sync_metadata` and cell state to determine overlay.

| State | Visual | Interaction |
|-------|--------|-------------|
| Broken reference | Value with strikethrough + "(deleted)" badge | Tooltip: "This record was deleted in [source]" |
| Sync conflict | Red sync icon in cell corner | Tooltip: "Sync conflict — click to resolve" (resolution UI built in 2B) |
| Processing (sync in progress) | Yellow/amber shimmer animation | Tooltip: "Updating..." |
| Succeeded (just resolved) | Brief green flash (1–2s, then normal) | No interaction |
| Type coercion issue | Dash + amber warning icon | Tooltip: "Value couldn't be converted" |

- Each overlay is a thin wrapper that conditionally renders an indicator over the cell
- Use CSS `position: relative` on cell + `position: absolute` on overlay indicator
- Use process state colors from design-system.md: red=error, amber=warning, green=success

### Acceptance Criteria

- [ ] Arrow keys move active cell. Active cell highlighted with blue border
- [ ] Tab/Shift+Tab moves between cells, wrapping at row boundaries
- [ ] Enter starts editing. Escape cancels. Enter while editing saves + moves down
- [ ] Home/End jump to first/last column in row
- [ ] Cmd+Home/End jump to first/last row
- [ ] Page Up/Down scroll one viewport
- [ ] Shift+Arrow extends selection range
- [ ] Cmd+A selects all rows
- [ ] Any character keystroke starts replace-mode editing
- [ ] F2 starts edit-mode editing (preserves content)
- [ ] Delete/Backspace clears cell contents
- [ ] Space toggles checkbox cells
- [ ] Cmd+Shift+N creates a new record
- [ ] Cmd+/ opens keyboard shortcuts help dialog
- [ ] Active cell scrolls into view when navigating with keyboard
- [ ] Cell error overlays render correctly for all 5 states
- [ ] Tooltips show on hover for error overlay indicators
- [ ] Tests cover navigation, editing shortcuts, and error overlays
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Filtering/sorting keyboard shortcuts functional behavior (3A-ii)
- Command Bar integration (3B-ii)
- Record View keyboard shortcut (3A-ii)
- Full undo/redo stack (Prompt 9 — placeholder handlers wired here)
- Full copy/paste logic (Prompt 9 — placeholder handlers wired here)

---

## Integration Checkpoint 2 (after Prompts 5–7)

**Task:** Verify all work from Prompts 5–7 integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: All ~16 cell types render correctly. Click/double-click editing works. Tab/Enter/Escape transitions work. Arrow key navigation moves between cells. Error overlays display. Keyboard shortcuts help dialog opens with Cmd+/

**Git:** Commit with message `chore(verify): integration checkpoint 2 [Phase 3A-i, CP-2]`, then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## Prompt 8: Column Behavior — Resize, Reorder, Freeze, Context Menu, Coloring

**Depends on:** Prompt 2
**Load context:** `tables-and-views.md` lines 162–232 (Column Behavior, Column Header Right-Click Menu, Row Right-Click Menu — column portion), `design-system.md` lines 139–170 (Data Color Palette — column coloring)
**Target files:**
- `apps/web/src/components/grid/ColumnResizer.tsx`
- `apps/web/src/components/grid/ColumnHeaderMenu.tsx`
- `apps/web/src/components/grid/use-column-resize.ts`
- `apps/web/src/components/grid/use-column-reorder.ts`
- `apps/web/src/components/grid/GridHeader.tsx` (update)
- `apps/web/src/components/grid/use-grid-store.ts` (update — persist column widths/order)
- `apps/web/src/actions/view-actions.ts`
- `apps/web/src/components/grid/__tests__/column-behavior.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): column resize, reorder, freeze, context menu, coloring [Phase 3A-i, Prompt 8]`

### Schema Snapshot

```
views.config (JSONB) — stores per-view column configuration:
{
  column_widths: Record<string, number>,  // field_id → width in px
  column_order: string[],                  // ordered field_id array
  frozen_column_count: number,             // how many columns frozen (beyond primary)
  density: 'compact' | 'medium' | 'tall',
  column_colors: Record<string, string>   // field_id → color name from palette
}
```

### Task

**1. Column resizing (`use-column-resize.ts` + `ColumnResizer.tsx`):**
- Drag handle on column borders (right edge of header)
- Min width: 60px. Max width: 800px
- Resize calculations at 16ms (requestAnimationFrame)
- Widths saved to `views.config.column_widths` via `updateViewConfig()` Server Action
- Default widths by field type from the constant defined in Prompt 2

**2. Column reordering (`use-column-reorder.ts`):**
- Drag-and-drop column headers to reorder
- Use HTML5 Drag and Drop API or a lightweight drag library
- Primary field cannot be reordered (always first data column)
- Order saved to `views.config.column_order` via `updateViewConfig()`

**3. Column freezing:**
- Primary field always frozen (not counted in user-frozen count)
- Right-click header → "Freeze up to here" / "Unfreeze" (contextual)
- Max total frozen width: 40% of viewport
- Frozen columns are always rendered (not virtualized horizontally)
- Saved to `views.config.frozen_column_count`

**4. Column header right-click context menu (`ColumnHeaderMenu.tsx`):**
14 items from tables-and-views.md:
1. Sort ascending / Sort descending → placeholder (3A-ii)
2. Add filter → placeholder (3A-ii)
3. Group by this field → placeholder (3A-ii)
4. ── separator ──
5. Edit field (open field config) → placeholder (field config modal not in 3A-i scope)
6. Rename field → inline rename (Manager+ only, `roleAtLeast('manager')`)
7. Duplicate field → placeholder
8. Insert field left / Insert field right → placeholder
9. Hide field → updates `views.config` to hide field
10. Delete field → placeholder with confirmation
11. ── separator ──
12. Freeze up to here / Unfreeze → functional
13. Set column color → color picker popover (8–10 pastel palette from design-system.md)
14. Edit permissions (Manager+ only) → placeholder (3A-iii)

Permission gating: items 5–6, 7–8, 10, 14 visible only to Manager+ role.

Use shadcn/ui ContextMenu component.

**5. Column coloring:**
- Assignable light background tint from pastel palette
- Multi-select adjacent columns → assign color (use the 13-color data palette light tones)
- Saved per view in `views.config.column_colors`

**6. Column header contents update:**
- Field type icon (from lucide-react icon set) + field name
- Sort indicator (▲/▼ when sorted) — placeholder, visual only
- Filter dot (small colored dot when column has active filter) — placeholder

**7. View config Server Action (`apps/web/src/actions/view-actions.ts`):**
- `updateViewConfig(tenantId, viewId, configPatch)` — merges partial config update into `views.config` JSONB
- Validates with Zod ViewConfig schema

**8. Header interactions:**
- Click header → selects entire column (visual highlight)
- Double-click name → inline rename (Manager+)

### Acceptance Criteria

- [ ] Column resize via drag handle works within 60–800px bounds
- [ ] Column resize uses requestAnimationFrame for smooth 16ms updates
- [ ] Column widths persist to views.config on drag end
- [ ] Column drag-and-drop reorder works (primary field immovable)
- [ ] Column order persists to views.config
- [ ] "Freeze up to here" freezes columns; frozen columns don't scroll horizontally
- [ ] Max frozen width enforced at 40% viewport
- [ ] Right-click context menu shows all 14 items with correct permission gating
- [ ] Manager-only items hidden for Team Member/Viewer roles
- [ ] Inline rename works on double-click (Manager+)
- [ ] Hide field removes column from grid and updates views.config
- [ ] Column coloring applies pastel tint to column cells
- [ ] updateViewConfig() Server Action merges config patch correctly
- [ ] testTenantIsolation() passes for updateViewConfig()
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Sort, filter, or group functional behavior (3A-ii)
- Field config editor modal (later phase)
- Field deletion logic (later phase — needs impact analysis)
- Permission configuration UI (3A-iii)

---

## Prompt 9: Row Behavior — Density, Reorder, Context Menu, New Row, Copy/Paste, Undo

**Depends on:** Prompts 6, 8
**Load context:** `tables-and-views.md` lines 146–161 (Row Behavior), lines 221–232 (Row Right-Click Menu), lines 257–288 (Cell Behavior — copy/paste, drag-to-fill, undo/redo)
**Target files:**
- `apps/web/src/components/grid/RowContextMenu.tsx`
- `apps/web/src/components/grid/NewRowInput.tsx`
- `apps/web/src/components/grid/use-row-reorder.ts`
- `apps/web/src/components/grid/use-clipboard.ts`
- `apps/web/src/components/grid/use-undo-redo.ts`
- `apps/web/src/components/grid/DragToFillHandle.tsx`
- `apps/web/src/components/grid/use-grid-store.ts` (update)
- `apps/web/src/components/grid/__tests__/row-behavior.test.tsx`
- `apps/web/src/components/grid/__tests__/clipboard.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): row behavior — density, reorder, context menu, new row, copy/paste, undo [Phase 3A-i, Prompt 9]`

### Schema Snapshot

```
records: tenant_id, id, table_id, canonical_data (JSONB), sort_order (if exists), ...
```

### Task

**1. Row density modes:**
- Compact: 32px, Medium: 44px (default), Tall: 64px
- User-selectable. Saved per view in `views.config.density`
- Updates TanStack Virtual's `estimateSize` and triggers re-render

**2. Row striping:**
- Alternating zebra stripes: `bg-white` / `bg-slate-50`. Always on

**3. New row creation (`NewRowInput.tsx`):**
- Persistent empty row pinned at bottom (Airtable-style)
- Click to start typing in primary field — creates record on first input via `createRecord()` Server Action
- After creation, new row appears above and another empty row takes its place
- Auto-focus primary field after click

**4. Manual row reordering (`use-row-reorder.ts`):**
- Drag handle (grip icon) on row hover
- Drag to reorder records. Updates `sort_order` or `position` field
- Disabled when a sort is active (sort ships in 3A-ii, but the guard should exist now)

**5. Row right-click context menu (`RowContextMenu.tsx`):**
9 items from tables-and-views.md:
1. Expand record (open Record View overlay) → placeholder (3A-ii)
2. Copy record / Duplicate record / Delete record
3. ── separator ──
4. Insert row above / Insert row below
5. ── separator ──
6. Copy cell value / Paste / Clear cell value
7. ── separator ──
8. Copy record link → copies URL to clipboard
9. Print / export this record → placeholder

Use shadcn/ui ContextMenu component.

**6. Multi-cell copy/paste (`use-clipboard.ts`):**
- Click-drag or Shift+click for multi-cell range selection
- Cmd+C copies selected cells as tab-separated values (compatible with Excel/Google Sheets paste)
- Cmd+V pastes from clipboard into selected range
- **Paste type conflict resolution:**
  - Coercible: auto-coerce silently (text "42" → number 42)
  - Incompatible: skip cell, leave original. Toast: "N cells skipped — incompatible types" with "Show Details"
- Cmd+D: fill down (copy cell above into selected cells below)

**7. Drag-to-fill (`DragToFillHandle.tsx`):**
- Small square handle at bottom-right corner of selection
- Drag down/right to fill: numbers increment, dates increment by interval, text/select repeat
- Skips read-only cells

**8. Undo/redo (`use-undo-redo.ts`):**
- Cmd+Z / Cmd+Shift+Z for undo/redo
- Stack of cell edit operations (field_id, record_id, old_value, new_value)
- Max stack depth: 50 operations
- Undo calls `updateRecordField()` with old_value
- Clear stack on page navigation

**9. Row hover:**
- Subtle background highlight `bg-slate-100/50`
- Expand icon (⤢) in primary field cell

**10. Record deletion:**
- From context menu: soft delete with undo toast (10 second window, no confirmation dialog for single)
- Undo toast calls restore (clear `deleted_at`)

### Acceptance Criteria

- [ ] Density toggle switches between 32/44/64px row heights
- [ ] Density persists to views.config
- [ ] Zebra striping renders alternating row backgrounds
- [ ] New row at bottom creates record on first keystroke in primary field
- [ ] Row drag reorder works via grip handle
- [ ] Row reorder disabled when a sort config exists in views.config
- [ ] Right-click context menu shows all 9 items
- [ ] Copy record duplicates the record via Server Action
- [ ] Delete record soft-deletes with 10s undo toast
- [ ] Undo toast restores deleted record
- [ ] Cmd+C copies selected cells as tab-separated text
- [ ] Cmd+V pastes from clipboard with type coercion
- [ ] Incompatible paste shows "N cells skipped" toast
- [ ] Cmd+D fills down from cell above
- [ ] Drag-to-fill increments numbers and dates, repeats text
- [ ] Cmd+Z / Cmd+Shift+Z undo/redo cell edits (stack of 50)
- [ ] Insert row above/below works from context menu
- [ ] Tests cover clipboard operations, undo/redo, and row interactions
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Bulk actions toolbar (3A-ii — selection via checkboxes exists but toolbar ships later)
- Multi-user collaboration locking (3A-ii)
- Record View expand (3A-ii)
- Sort-aware row positioning (3A-ii)

---

## Prompt 10: Table Type System, Tab Colors, Performance Thresholds, Loading & Empty States

**Depends on:** Prompt 9
**Load context:** `tables-and-views.md` lines 27–97 (Table Type System, Tab Colors), lines 246–255 (Performance Thresholds), lines 561–564 (Loading & Empty States), `design-system.md` lines 310–318 (Loading patterns)
**Target files:**
- `apps/web/src/components/grid/TableTypeIcon.tsx`
- `apps/web/src/components/grid/PerformanceBanner.tsx`
- `apps/web/src/components/grid/GridSkeleton.tsx`
- `apps/web/src/components/grid/GridEmptyState.tsx`
- `apps/web/src/components/sidebar/TableTab.tsx` (update — add tab color stripe)
- `apps/web/src/lib/constants/table-types.ts`
- `apps/web/src/components/grid/__tests__/table-types.test.tsx`
**Migration required:** No
**Git:** Commit with message `feat(grid): table type system, tab colors, performance banners, loading/empty states [Phase 3A-i, Prompt 10]`

### Schema Snapshot

```
tables: id, workspace_id, tenant_id, name, table_type (ENUM: table|projects|calendar|documents|wiki), tab_color (VARCHAR 20, nullable), ...
```

### Task

**1. Table type constants (`table-types.ts`):**
Define the 5 table types with their metadata:

| Type | Icon | Tab Color Default | Default View (MVP) |
|------|------|-------------------|-------------------|
| `table` | Grid/spreadsheet | textSecondary (Gray) | Grid |
| `projects` | Checklist | Teal (#0D9488) | Grid (List is post-MVP) |
| `calendar` | Calendar | Amber (accent) | Grid (Calendar is post-MVP) |
| `documents` | Folder/file | Purple (#A78BFA) | Grid (Gallery is post-MVP) |
| `wiki` | Book/pages | Blue (#60A5FA) | Grid (Smart Doc is post-MVP) |

- All default to Grid view for MVP (non-grid defaults are post-MVP)
- `table_type` is set at creation; immutable after records exist
- Any view type is available on any table type — type controls default, not restriction

**2. TableTypeIcon component:**
- Renders the correct lucide-react icon for each table type
- Props: `tableType`, `size`, `className`

**3. Tab color rendering (update `TableTab.tsx` in sidebar):**
- 3px `border-left` stripe on sidebar tab element
- Color from `tables.tab_color` if set, otherwise from table type default
- Opacity: 100% active, 60% inactive, 80% on hover (200ms ease transition)
- 10-color palette: Gray, Teal, Amber, Purple, Blue, Green, Red, Pink, Orange, Indigo (with hex values for both dark/light mode from tables-and-views.md)
- Right-click table tab → "Tab Color" → color swatch picker (10 options + "Default" to reset)

**4. Performance thresholds (`PerformanceBanner.tsx`):**
| Metric | Threshold | Action |
|--------|-----------|--------|
| Visible rows (unfiltered) >10,000 | Info banner: "Showing 10,000+ records. Apply filters for better performance." |
| Visible rows (unfiltered) >50,000 | Warning + auto-enable pagination (100 rows/page) |
| Columns visible >30 | Suggestion: "Hide unused columns for faster rendering." |
| Loading time >2s | "Still loading…" indicator |

- No hard caps — no maximum row or field count
- Banners appear above the grid, dismissible
- Use shadcn/ui Alert component with appropriate variant (info, warning)

**5. Loading state (`GridSkeleton.tsx`):**
- Skeleton rows with shimmer animation, matching column layout
- Skeleton fills same space as actual grid with correct number of columns
- Uses design system skeleton pattern: pulse animation, `bg-slate-200`

**6. Empty state (`GridEmptyState.tsx`):**
- Illustration (simple SVG or emoji) + "No records yet" text + "+ New Record" button
- Button triggers new row creation (same as bottom row click)
- Centered in the grid content area

**7. Default fields on new table creation:**
- When a new table is created, it starts with: Primary field (Text, required, frozen) + Notes field (Rich Text, positioned last)
- This is informational context for the grid — the actual table creation flow is not in 3A-i scope

### Acceptance Criteria

- [ ] TableTypeIcon renders correct icon for all 5 table types
- [ ] Sidebar table tabs show 3px left-edge color stripe
- [ ] Tab color uses custom color if set, falls back to table type default
- [ ] Tab color opacity transitions: 100% active, 60% inactive, 80% hover
- [ ] Right-click tab shows color picker with 10 options + "Default"
- [ ] Performance banner appears at >10K rows (info) and >50K rows (warning)
- [ ] >30 columns shows "hide unused columns" suggestion
- [ ] Loading state shows skeleton with shimmer matching grid layout
- [ ] Empty state shows illustration + "No records yet" + CTA button
- [ ] New Record button in empty state creates a record
- [ ] Table type constants export correct metadata for all 5 types
- [ ] Tests cover table type rendering, performance thresholds, loading/empty states
- [ ] ESLint and TypeScript compile with zero errors
- [ ] No hardcoded English strings (i18n for all banners, labels, empty state text)

### Do NOT Build

- Table creation wizard or form (later phase)
- Non-grid default views (post-MVP — Kanban, Calendar, Gallery, Smart Doc)
- Tab color storage/update Server Action if not already covered — use `updateTable()` pattern

---

## Integration Checkpoint 3 — Final (after Prompts 8–10)

**Task:** Verify all work from Prompts 8–10 and full Phase 3A-i integrates correctly.

Run:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met for all changed packages:
   - `apps/web/src/data/` — 95% lines, 90% branches
   - `apps/web/src/actions/` — 90% lines, 85% branches
   - New grid component files — ≥80% lines
5. `pnpm turbo check:i18n` — no hardcoded English strings
6. Manual verification:
   - Grid renders with correct columns from fields and rows from records
   - All ~16 cell types display correctly with appropriate formatting
   - Inline editing works: single-click replace, double-click edit, auto-save on blur
   - Keyboard navigation: arrow keys, tab, enter, escape, home/end
   - Column resize, reorder, and freeze work
   - Row density toggle (compact/medium/tall) works
   - Row drag reorder works
   - New row at bottom creates record
   - Copy/paste works across cells
   - Undo/redo reverts cell edits
   - Context menus for columns (14 items) and rows (9 items) display with correct permission gating
   - Cell error overlays render for sync conflict, broken reference, etc.
   - Table tab colors show in sidebar
   - Performance banner appears with large datasets
   - Loading skeleton and empty state render correctly
   - Expand icon appears on row hover in primary field

**Git:** Commit with message `chore(verify): integration checkpoint 3 — final [Phase 3A-i, CP-3]`, then push branch to origin. Open PR to main with title `[Step 3] Phase 3A-i — Grid View Core: Layout, Cell Renderers & Inline Editing`.

---

## Dependency Graph Summary

```
Prompt 1 (Data Layer)
  │
  └── Prompt 2 (Grid Shell)
       │
       ├── Prompt 3 (Cells: Text/Number/Date/Checkbox/Rating/Currency/Percent) ──┐
       ├── Prompt 4 (Cells: Select/Multi/People/Linked/Attachment) ──────────────┤
       ├── Prompt 5 (Cells: URL/Email/Phone/SmartDoc/Barcode/Checklist) ─────────┤
       │                                                                          │
       │   ┌──────────────────────────────────────────────────────────────────────┘
       │   │
       │   └── Prompt 6 (Inline Editing + Optimistic Updates)
       │        │
       │        └── Prompt 7 (Keyboard Nav + Error Overlays)
       │
       └── Prompt 8 (Column Behavior)
            │
            └── (Prompt 6 +) Prompt 9 (Row Behavior + Copy/Paste + Undo)
                 │
                 └── Prompt 10 (Table Types + Performance + Loading/Empty)
```

**Parallel execution potential:** Prompts 3, 4, and 5 can run in parallel (independent cell renderer batches). Prompt 8 can run in parallel with Prompts 3–7 (column behavior is independent of cell renderer implementation).
