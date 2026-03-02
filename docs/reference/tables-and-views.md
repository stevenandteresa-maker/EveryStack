# EveryStack — Tables & Views

> **Reference doc.** Table type system, table tab colors, grid view architecture (74 design decisions), Card view, Record View (configurable field canvas overlay), saved views, sections.
> See `GLOSSARY.md` for all concept definitions and naming conventions.
> Cross-references: `data-model.md` (field types, schema, record_view_configs), `cross-linking.md` (Linked Record display), `permissions.md` (role-based access, field-level permissions), `mobile.md` (mobile-specific rendering)
> Last updated: 2026-02-28 — View terminology standardized (My Views / Shared Views). Inline Sub-Table summary row deferred to post-MVP.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Table Type System | 27–119 | 5 table types (table, projects, calendar, documents, wiki), default views, type behavior |
| Table (Grid) View Architecture | 120–553 | Grid layout, columns, cell rendering, inline editing, toolbar, filtering, sorting, grouping |
| Record View | 554–615 | Overlay architecture, field canvas, columns, tabs, dimensions, saved configs |
| Card View | 616–656 | Card layout, card fields, grouping, mobile card list |
| Sections — Universal List Organizer | 657–689 | Sidebar sections, drag-to-reorder, section-scoped operations |
| Inline Sub-Table Display for Linked Records | 690–793 | Linked record expansion, inline sub-table rendering in Record View |
| Kanban View — Post-MVP | 794–805 | Kanban columns, drag-and-drop, WIP limits |
| Quick Entry — Post-MVP | 806–812 | Rapid record creation mode, barcode scanning |

---

## Table Type System

Every table has a `table_type` that determines its icon, color, default view, and available views. The data model is the same — all types store data in `records.canonical_data`. The type controls presentation.

| Type | Icon | Tab Color | Default View | Description |
|------|------|-----------|-------------|-------------|
| `table` | Grid/spreadsheet | Gray | Grid | Standard rows, columns, filters, sorts |
| `projects` | Checklist/kanban | Teal | List (post-MVP; Grid for MVP) | Project cards → List/Board/Timeline/Gantt |
| `calendar` | Calendar | Amber | Calendar (post-MVP; Grid for MVP) | Event records: meetings, appointments |
| `documents` | Folder/file | Purple | Gallery (post-MVP; Grid for MVP) | File storage, generated docs |
| `wiki` | Book/pages | Blue | Smart Doc (post-MVP; Grid for MVP) | Base-level knowledge base |

- `table_type` is set at creation; cannot change after records exist
- Any view type is available on any table type — type controls default, not restriction
- A projects table can always be viewed as raw grid

**Default fields on new table creation:**
1. **Primary field** (Text, required, frozen) — the record's display name
2. **Notes** (Rich Text) — positioned last in default field order. Manager can rename, move, hide, or delete.

### Table Tab Colors

Every table tab in the sidebar supports a user-assignable color stripe — a **3px left-edge stripe** that provides visual grouping. Users create visual "neighborhoods": all finance tables amber, all CRM tables green.

**Schema:** `tables.tab_color` — VARCHAR(20), nullable. When null, inherits from `table_type` default.

Default colors by table type:

| table_type | Default Stripe Color |
|------------|---------------------|
| `table` | `textSecondary` (Gray) |
| `projects` | Teal (`#0D9488`) |
| `calendar` | `accent` (Amber) |
| `documents` | `#A78BFA` (Purple) |
| `wiki` | `#60A5FA` (Blue) |

**Tab color palette** (10 colors):

| Color Name | Dark Mode Hex | Light Mode Hex |
|------------|--------------|----------------|
| Gray | `#94A3B8` | `#64748B` |
| Teal | `#2DD4BF` | `#0D9488` |
| Amber | `#FBBF24` | `#D97706` |
| Purple | `#A78BFA` | `#7C3AED` |
| Blue | `#60A5FA` | `#2563EB` |
| Green | `#34D399` | `#059669` |
| Red | `#F87171` | `#DC2626` |
| Pink | `#F472B6` | `#DB2777` |
| Orange | `#FB923C` | `#EA580C` |
| Indigo | `#818CF8` | `#4F46E5` |

**Setting tab color:** Right-click table tab → "Tab Color" → color swatch picker (10 options + "Default" to reset).

**Rendering:** 3px `border-left` on tab element. Opacity: 100% active, 60% inactive, 80% on hover (200ms ease).

```
Sidebar tab rendering:
┌─────────────────────┐
▌ 📊 Invoices         │   ← 3px amber left-edge stripe
├─────────────────────┤
▌ 📊 Expenses         │   ← 3px amber left-edge stripe (same finance group)
├─────────────────────┤
▌ ✅ Projects          │   ← 3px teal left-edge stripe (type default)
├─────────────────────┤
▌ 📊 Client CRM       │   ← 3px green left-edge stripe (user-set)
└─────────────────────┘
```

**Base navigation bar:** Same stripe as **3px bottom-edge border** on horizontal tab indicator.

### Available View Types

**MVP view types:**

| View Type | Icon | Description |
|-----------|------|-------------|
| `grid` | Grid | Spreadsheet grid. Rows, columns, inline editing, filters, sorts, grouping, color. See Grid View Architecture below. |
| `card` | Cards | Card-based view. Customizable field layout per card. Inline editable. See Card View section. |

**Post-MVP view types:**

| View Type | Description | Spec |
|-----------|-------------|------|
| `kanban` | Kanban — cards grouped by status/select. Drag between columns. | See Kanban View section below. |
| `list` | Asana-style indented nested list. | — |
| `timeline` | Horizontal bars on calendar axis. | `project-management.md` |
| `gantt` | Full PM Gantt with dependencies, critical path. | `project-management.md` |
| `calendar` | Date-based day/week/month grid. | `booking-scheduling.md` |
| `gallery` | Visual card grid, thumbnail-forward. | — |
| `smart_doc` | Wiki page tree + rich text editor. | `smart-docs.md` |

---

## Table (Grid) View Architecture

The Grid View is the core spreadsheet — the most fundamental way to view and edit records. Available on all table types.

### Grid Anatomy (Left to Right)

```
Drag Handle (hover) → Checkbox → Row # → Primary Field (frozen) → Field 2 → Field 3 → ... → "+" Column
```

- **Drag handle:** Grip icon on row hover. Drag to reorder records. Disabled when sort is active.
- **Checkbox column:** Always visible, pinned leftmost. Enables multi-select for bulk actions.
- **Row numbers:** Narrow column between checkbox and primary field.
- **Primary field:** Always frozen left. Contains expand icon (⤢) on row hover.
- **"+" column:** Far right. Opens field type picker. **Visible only to Manager+ role.** Team Members/Viewers see last data column as rightmost.

### Permission Gating on Structural UI

| Element | Visible To | Others See |
|---|---|---|
| "+" column (new field) | Manager+ | Last data column is rightmost |
| Double-click field name to rename | Manager+ | Non-interactive header text |
| Right-click column → Edit/Delete field, Edit permissions | Manager+ | Menu items hidden (Sort, Filter, Hide remain) |
| Table settings structural items | Manager+ (≥768px only) | Hidden |

### Row Behavior

**Density modes** (user-selectable, saved per view):
- Compact: 32px
- Medium: 44px (default)
- Tall: 64px

**Row striping:** Alternating zebra stripes always on. Subtle white/light gray.

**New row creation:** Persistent empty row pinned at bottom (Airtable-style). Click to start typing — creates record on first input.

**Manual row reordering:** Drag handle on hover. Manual order stored as `sort_order`. Disabled when sort is active.

**Row hover:** Subtle background highlight + expand icon (⤢) appears in primary field cell.

### Column Behavior

**Resizing:** Drag handle on column borders. Min: 60px. Max: 800px. Widths saved per view.

**Default column widths by field type:**

| Field Type | Default Width (px) |
|-----------|-------------------|
| Text (primary field) | 280 |
| Text | 200 |
| Text Area | 240 |
| Number / Currency / Percent | 120 |
| Date | 140 |
| Date-Time | 180 |
| Single Select | 160 |
| Multiple Select / Tags | 200 |
| Checkbox | 60 |
| People | 160 |
| Phone / Email / URL | 180 |
| Rating | 100 |
| File / Attachment | 120 |
| Linked Record | 200 |
| Smart Doc | 200 |
| Duration | 100 |
| Barcode | 140 |
| All others | 160 |

**Reordering:** Drag-and-drop column headers. Order saved per view.

**Freezing:** Primary field always frozen. Users can freeze additional via right-click header → "Freeze up to here." Max total frozen width: 40% of viewport. Saved per view in `views.config.frozen_column_count`.

**Column coloring (structural):** Columns assignable a light background tint for visual grouping. Multi-select adjacent columns → assign color from palette (8–10 pastels). Organizational (manual) — separate from conditional color rules. Saved per view.

**Column header contents:** Field type icon + sort arrow (▲/▼ when sorted) + filter dot (when column has active filter).

**Header interactions:**
- Click header → selects entire column
- Click sort indicator → cycles sort (none → asc → desc)
- Double-click name → inline rename (Manager+)
- Right-click → column context menu

### Column Header Right-Click Menu

1. Sort ascending / Sort descending
2. Add filter
3. Group by this field
4. ── separator ──
5. Edit field (open field config)
6. Rename field
7. Duplicate field
8. Insert field left / Insert field right
9. Hide field
10. Delete field
11. ── separator ──
12. Freeze up to here / Unfreeze (contextual)
13. Set column color
14. Edit permissions (Manager+ only)

### Row Right-Click Menu

1. Expand record (open Record View overlay)
2. Copy record / Duplicate record / Delete record
3. ── separator ──
4. Insert row above / Insert row below
5. ── separator ──
6. Copy cell value / Paste / Clear cell value
7. ── separator ──
8. Copy record link
9. Print / export this record

### Scrolling & Performance

**Windowed virtualization:** Render only visible rows + overscan buffer. Library: **TanStack Virtual**.

**Virtualization buffer tuning:**
- **Row overscan:** 10 rows above/below (20 total).
- **Column overscan:** 3 columns before/after (6 total).
- **Frozen columns:** Row number + checkbox + primary field always rendered. Up to 5 additional user-frozen.
- **Scroll debounce:** None for virtualization. Column resize calculations at 16ms.

**Sticky header and footer:** Header sticks top, summary footer sticks bottom. Data scrolls between. Frozen columns pinned horizontally.

**Performance thresholds:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| Visible rows (unfiltered) | >10,000 | Info banner: "Showing 10,000+ records. Apply filters for better performance." |
| Visible rows (unfiltered) | >50,000 | Warning + auto-enable pagination (100 rows/page). |
| Columns visible | >30 | Suggestion: "Hide unused columns for faster rendering." |
| Loading time | >2s | Skeleton shimmer. "Still loading…" after 2s. |

**No hard caps.** No maximum row or field count.

### Cell Behavior

**Overflow:** Truncate with ellipsis. Full content on cell click (edit mode).

**Editing modes (spreadsheet-style):**
- **Single click + type:** Replace mode — existing content cleared.
- **Double-click:** Edit mode — cursor placed within existing content.

Auto-save on blur. No save button.

**Optimistic updates:** UI updates instantly. Server confirmation in background. On error, cell rolls back with error toast.

**Undo/redo:** Ctrl+Z / Cmd+Z for inline cell edits.

**Multi-cell copy/paste:** Click-drag or Shift+click for range. Ctrl+C/V for ranges. Supports paste from Excel/Google Sheets.

**Paste type conflict resolution:**
- **Coercible:** Auto-coerce silently (text "42" → number 42).
- **Incompatible:** Skip cell, leave original. Toast: "3 cells skipped — incompatible types" with "Show Details."

**Drag-to-fill:** Fill handle at bottom-right of selection. Numbers increment, dates increment, text/select repeat. Skips read-only cells.

**Read-only cells** (auto-number, system fields): Subtle lock icon. Click does nothing.

**Edit conflicts:** Field-level locking prevents concurrent edits. See Multi-User Collaboration section.

**Validation errors:** Red cell border + error message below. Cell stays in edit mode. Escape reverts.

**Empty cells:** Blank — no placeholder text.

### Cell Error States (Universal)

Applied via wrapper component across all field type renderers.

| State | Visual | Interaction |
|---|---|---|
| Broken reference | Value with strikethrough + "(deleted)" badge | Tooltip: "This record was deleted in [source]" |
| Sync conflict | Red sync icon in cell corner | Click opens conflict resolution |
| Processing (sync in progress) | Yellow/amber shimmer | Tooltip: "Updating..." |
| Succeeded (just resolved) | Brief green flash (1–2s) | No interaction |
| Type coercion issue | Dash + amber warning icon | Tooltip: "Value couldn't be converted" |
| Attachment loading | File type thumbnail placeholder | Replaced when loaded |

### Cell Type Rendering

| Field Type | Grid Rendering | Edit Interaction |
|---|---|---|
| **Single Select / Status** | Configurable: full colored block, colored pill, dot + text, or plain | Click opens dropdown |
| **Multi-Select** | Same display styles. Overflow as "+N" badge | Click opens multi-select dropdown |
| **Linked Record** | Clickable pills showing primary field. Overflow "+N" | Click pill navigates. Edit opens record picker |
| **Attachment** | Thumbnail strip (3–4 small). File icons for non-images. "+N" | Click opens attachment manager |
| **People** | Configurable: grey pill + avatar, colored pill + name, avatar only. Overflow "+N" | Click opens people picker |
| **Percent / Progress** | Inline progress bar filling cell. Value text overlaid | Click to type number |
| **Checklist** | Compact "3/7 done" + mini progress bar | Click opens checklist editor |
| **Date** | Formatted text (e.g., "Feb 9, 2026") | Click opens date picker |
| **Checkbox** | Checkbox | Single click toggles directly |
| **URL** | Clickable link (blue, external icon on hover) | Double-click to edit |
| **Email** | Clickable mailto link | Double-click to edit |
| **Phone** | Formatted number + phone icon | Click to edit on desktop |
| **Rating** | Inline star widget (★★★☆☆) | Click star to set |
| **Currency** | Formatted with symbol ($1,250.00) | Click to type number |
| **Smart Doc** | Badge indicating content exists | Click opens editor in side panel |
| **Barcode** | Value as text + barcode icon | Click → text input. Paste-friendly for USB scanners. |

### Keyboard Shortcuts

Full spreadsheet-style navigation. `Cmd` = `Ctrl` on Windows/Linux.

**Navigation:**

| Shortcut | Action |
|----------|--------|
| Arrow keys | Move between cells |
| Tab / Shift+Tab | Next / previous cell |
| Enter | Edit cell / confirm + move down |
| Escape | Cancel edit / deselect |
| Home / End | First / last column in row |
| Cmd+Home / Cmd+End | First / last row |
| Page Up / Page Down | Scroll one viewport |

**Selection:**

| Shortcut | Action |
|----------|--------|
| Shift+Arrow | Extend selection |
| Shift+Click | Range select |
| Cmd+Click | Toggle individual row |
| Cmd+A | Select all rows |

**Editing:**

| Shortcut | Action |
|----------|--------|
| Cmd+Z / Cmd+Shift+Z | Undo / Redo |
| Cmd+C / Cmd+V | Copy / Paste |
| Cmd+D | Fill down (copy cell above) |
| Delete / Backspace | Clear cell contents |
| Space | Toggle checkbox |
| Type any character | Start editing (overwrites) |
| F2 | Start editing (cursor at end, preserves) |

**Grid Actions:**

| Shortcut | Action |
|----------|--------|
| Cmd+Shift+F | Toggle filter panel |
| Cmd+Shift+S | Toggle sort panel |
| Cmd+F | Command Bar scoped to current table |
| Cmd+Shift+E | Open Record View for selected record |
| Cmd+Shift+N | New record |
| Cmd+K | Command Bar |
| Cmd+/ | Keyboard shortcuts help |

### Selection & Bulk Actions

**Row selection:** Always-visible checkbox column. Header checkbox selects all visible (respects filters).

**Range selection:** Click-drag or Shift+click for multi-cell range.

**Bulk actions toolbar** (2+ rows selected): Delete, Edit field value in bulk, Duplicate, Copy.

**Bulk Actions + Record View interaction:** Opening Record View does NOT clear selection. Bulk toolbar compresses to icon-only strip when Record View is open.

### Grouping

Multi-level grouping up to 3 levels. Each level: collapsible headers, record count, aggregation row per group, drag records between groups to change value.

**Grouped view + summary footer:**
- **Per-group summary:** Each group footer with group-specific aggregates.
- **Table-wide summary:** Sticky bar at bottom, aggregates across all groups.

### Sorting

Multi-level sort with drag-to-reorder priority. Sort config saved per view. Also accessible via column header sort indicator.

### Color Coding (Conditional)

Two levels, combinable:
- **Row-level:** Entire row background tint based on conditions
- **Cell-level:** Individual cells colored by value or conditions

Separate from structural column coloring.

### Filtering

Two paths:
- **Quick filters:** Click filter icon in column header → field-appropriate dropdown.
- **Full filter builder:** Toolbar panel with condition rows. Field + operator + value. AND/OR logic. Nested groups.

### Summary Footer Row

Optional row below data. Each column independently configurable with field-type-appropriate aggregations. Click footer cell to pick type. Sticky to bottom.

**Aggregation Options by Field Type:**

| Field Category | Available Aggregations |
|---|---|
| Number, Currency, Percent, Duration | sum, avg, min, max, count, none |
| Date, Date-Time | earliest, latest, range, count, none |
| Checkbox | checked count, unchecked count, percent checked, none |
| Single Select, Status | count per value (mini distribution bar), none |
| Multi-Select, Tags | unique count, total count, none |
| People | unique count, none |
| Linked Record | linked row count, total link count, none |
| Attachment | row count with files, total file count, none |
| Text, URL, Email, Phone | filled count, empty count, none |
| All others | count, none |

### Grid Toolbar

| Position | Button | Notes |
|----------|--------|-------|
| Left group | View switcher (Grid ▾) | Sets context |
| | Hide fields | Declutter |
| | Filter | Narrow data |
| | Sort | Reorder |
| | Group | Categorical views |
| | Color | Visual coding |
| Right group | Density toggle | Compact / Default / Expanded |
| | Share / Export | Occasional |
| | "…" overflow | Row height, print, copy view URL, field stats |

**No search in grid toolbar.** All search via Command Bar (`Cmd+K` or `Cmd+F`), auto-scoped to current table.

### Record Count

Always visible in grid footer: **"32 of 247 records"** (filtered) or **"247 records"** (unfiltered).

### Grid + Record View Layout

Clicking the expand icon (⤢) on a row opens the Record View as a right-side overlay. The grid remains visible and interactive.

**Layout per GLOSSARY.md dimensions:**

```
Record View only:
┌──────┬────────────┬───────────────────────────┐
│ Icon │  Grid      │  Record View         60%  │
│ Rail │  (dimmed)  │  (overlay from right)     │
│ 48px │   40%      │  [Field canvas]           │
└──────┴────────────┴───────────────────────────┘

Record View + Record Thread:
┌──────┬──────┬─────────────────────┬───────────┐
│ Icon │ Grid │  Record View   55%  │ Record    │
│ Rail │(dim) │                     │ Thread    │
│ 48px │ 20%  │  [Field canvas]     │ 25%       │
└──────┴──────┴─────────────────────┴───────────┘

Quick Panel + Record View overlay (both active):
┌──────┬───────┬──────────┬─────────────────────┐
│ Icon │Quick  │Grid      │ Record View    60%  │
│ Rail │Panel  │(dimmed)  │ (overlay on main)   │
│ 48px │25%    │ 15%      │                     │
└──────┴───────┴──────────┴─────────────────────┘
```

- Record View overlay dimensions are relative to **full screen** (minus icon rail), regardless of Quick Panel state.
- Grid stays interactive behind the dimmed overlay — clicking a different row updates the Record View.
- Record Thread opens alongside Record View by clicking the chat icon within the Record View.

### Permissions in the Grid

Field-level only. Manager configures per field, per role:
- **Hidden** — column not rendered for that role
- **Read-only** — column visible but locked (lock icon)
- **Full access** — visible and editable (default)

Row-level visibility handled by shared view base filters with `$me` token.

### Import / Export

**Import (four paths):**
- CSV import with column mapping step
- Excel (.xlsx) import with column mapping (sheet selector for multi-sheet)
- Copy-paste bulk from external spreadsheet (position-based column alignment)
- Merge/update on import (match by key field, update matched, insert unmatched)

**Export:** CSV and Excel (.xlsx). Exports only visible/filtered rows.

**Print / PDF:** Quick browser print with print-optimized CSS. Server-side PDF generation (styled, paginated).

### My Views & Shared Views

**Visibility model:**
- **My View** (default): Only creator sees it. Any role can create.
- **Shared View**: Visible to all workspace members with table access. Manager+ creates.
- **Locked Shared View**: Shared + filters/sorts can't be modified by non-creators. Manager+ only.

View switcher shows "My Views" and "Shared Views" sections, separated by divider.

**Promotion flow:** A user creates a My View → with sufficient authority (Manager+), they can promote it to a Shared View → a Shared View can optionally be locked.

**Creator deactivation:** Shared views transfer to workspace Owner.

**Default view fallback chain:**
1. Manager-assigned default view
2. First shared Grid view by `sort_order`
3. First shared view of any type by `sort_order`
4. Auto-generated "All Records" Grid view (always exists, cannot be deleted)

### Multi-User Collaboration

#### Field-Level Presence & Locking

When a user focuses a field (click/tap to edit), a lock is acquired on that field for that record.

- **Lock visibility:** Editing user's avatar on the field label. Visible across all surfaces.
- **Lock effect:** Other users see field as temporarily non-interactive.
- **Lock release:** On blur (auto-save fires, lock clears).
- **Lock timeout:** 60 seconds of no keystrokes.
- **No queue.** If locked, you wait.

**Implementation:** Redis key `lock:{tenantId}:{recordId}:{fieldId}` → `{userId, avatar, timestamp}`, TTL 60s, renewed on keystroke. WebSocket broadcasts lock/unlock.

**Row-level presence (secondary):** Colored left border on a row indicates someone is editing somewhere in that record.

#### Real-Time Updates & Event Coalescing

Edits propagate via WebSocket (Redis pub/sub):
- **Buffer window:** 100ms of no new events, OR 500ms max.
- **Flush:** All buffered events applied as single batch update.
- **Indicator:** "Updating..." in amber text during buffer.

### Record Deletion

- **Single record:** Soft delete with undo toast (10 second window). No dialog.
- **Bulk delete (2+):** Confirmation dialog required.

### Responsive Grid

- **Tablet:** Grid with horizontal scroll. Column resizing via touch drag.
- **Mobile:** Grid with horizontal scroll. Column widths adjustable. See `mobile.md`.

### Loading & Empty States

- **Loading:** Skeleton rows with shimmer, matching column layout.
- **Empty:** Illustration + "No records yet" + "+ New Record" button.

---

## Record View

The Record View is a **configurable field canvas** for viewing and editing a single record. It opens as an overlay from the right side of the screen when a user clicks a row in the Grid, a card in Card View, or any record reference anywhere in the platform.

### Layout

**Header:** Record name, colored by workspace theme. Navigation arrows (← →) to move between records in the current Table View. Close button (✕).

**Body:** White canvas displaying selected fields arranged in columns:
- Up to **4 columns** on desktop, up to **2 on mobile**.
- Fields are **rearrangeable** via drag-and-drop.
- Fields are **adjustable in width** (spanning 1–4 columns) and **height**.
- Fields are **inline editable** — click to edit, blur to save.

**Tabs:** Record View can be single-paged or multi-tabbed for complex records with many fields.

**Record View Configs:** Multiple configurations can be saved per table (stored in `record_view_configs` table). Different Table Views of the same table can assign different Record View configs, so expanding a record from the "Sales Pipeline" view can show different fields than expanding from the "All Clients" view.

### Screen Dimensions (per GLOSSARY.md)

- **Record View alone:** 60% of main panel width, overlay from right.
- **Record View + Record Thread:** 80% total (55% Record View + 25% Record Thread).
- **Behind overlay:** Main content dimmed but visible (~20%).

### Record Thread Access

Clicking the chat/thread icon within the Record View header opens the Record Thread panel alongside it. The Record View compresses from 60% to 55%, and the Record Thread takes 25%. See `GLOSSARY.md` > Record Thread.

### Record View as Shared Primitive

The Record View layout engine is the shared foundation for three concepts:

| Concept | Difference from Record View | DB Table |
|---------|---------------------------|----------|
| **Record View** | Workspace user viewing/editing existing record | Uses `record_view_configs` |
| **Portal** | External client viewing a record, read-only default, own auth | Uses `portals` + `record_view_configs` |
| **Form** | Anyone creating a new record, empty fields, submit action | Uses `forms` + `record_view_configs` |

All three share the same field canvas layout engine. They differ in context (workspace vs external), permissions (full vs restricted), and lifecycle (view existing vs create new).

### Expand Icon Placement

- **Grid View:** Inside primary field cell (frozen left). Icon appears on row hover.
- **Card View:** Top-right corner of card, on hover.
- **Post-MVP views** (Board, Gantt, List): On card/bar/row, on hover.

### Linked Records in Record View

Linked Record fields display as clickable pills. Clicking a pill navigates to that record's Record View (same overlay, contents update).

**Inline Sub-Table display** (alternative to pills): For parent-child patterns (invoice → line items), Linked Record fields can be configured to display as an embedded mini-grid within the Record View. See Inline Sub-Table section below.

### Responsive Behavior

| Breakpoint | Record View | Record Thread | Behavior |
|---|---|---|---|
| ≥1024px | 60% overlay (or 55% with Thread) | 25% alongside | Side-by-side |
| 768–1023px | 60% overlay | Overlay with scrim (toggle) | Two modes |
| <768px | Full-screen sheet, single column | Bottom tabs contextual swap | Stacked. See `mobile.md`. |

---

## Card View

Card View is a card-based Table View type (`view_type: card`). MVP view type alongside Grid.

### Card Layout

Manager sets default layout. Users can override in personal preferences.

| Layout | Description | Best For |
|---|---|---|
| **Single column** | Full-width cards, vertical scroll | Detailed records, reading focus |
| **Grid (2–3 cols)** | Fixed grid, equal-height cards with internal scroll | Overview scanning |
| **Compact list** | Narrow cards, key fields only | Large record sets, quick scanning |

### Card Content

Fields displayed in order defined by view's `field_config`. Fields are **inline editable** — click, edit, blur to save.

**Card height:** Variable based on field count. Internal scroll after 80vh. Recommend 15–25 fields per card.

Smart Doc fields show preview (first ~3 lines + "Expand").

### Filtering & Customization

Same capabilities as Grid: hide/show fields, conditional filtering, grouping, sort, color coding.

### RecordCard — Unified Component

Mobile Card View uses compact list layout with mobile interaction extensions. One component, one code path.

| Prop | Desktop/Tablet | Phone |
|------|---------------|-------|
| `swipeActions` | `false` | `true` — configurable swipe right/left |
| `badges` | Status only | Status + priority + overdue + unread + sync |
| `tapBehavior` | Opens Record View overlay | Full-screen Record View sheet |
| `layout` | Configurable | Always compact list |

See `mobile.md` for mobile-specific patterns.

---

## Sections — Universal List Organizer

Sections are a **universal UI primitive** for organizing any long list. A section is a named, collapsible group header that items can be dragged into. Purely organizational — no permissions or data filtering.

### Where Sections Apply

- **View switcher** — group views by purpose ("Client Views," "Reports")
- **Automations list** — group by function ("Invoicing," "Notifications")
- **Cross-links list** — group by relationship domain
- **Documents/templates list** — group by category
- **Sidebar table list** — group tables within a base
- **Any future list surface**

### Two Tiers

**Personal sections (any user):** Visible only to creator. Their own organizational layer.

**Manager-created sections (Manager+):** Default grouping visible to all workspace members. Members can create personal sections alongside.

### Behavior

- **Collapsible:** Click header to expand/collapse. State persists per user.
- **Drag-and-drop:** Reorder sections, drag items into/out of.
- **Empty sections allowed.**
- **Rename/delete:** Right-click or inline edit. Deleting moves items to top level.
- **Visual:** Styled divider row with name, collapse chevron, item count when collapsed.

### Data Model

`sections` table — see `data-model.md`. Items reference via nullable `section_id` FK. `context` column scopes to surface (view_switcher, automations, sidebar_tables, etc.).

---

## Inline Sub-Table Display for Linked Records

A compact linked record widget that displays linked records as an **embedded mini-grid** within Record View. Designed for parent-child patterns: invoice → line items, project → tasks, client → invoices.

### Configuration

Configured via `display` property on a Linked Record field's config:

```
fields.config.display (when style = "inline_table"):
{
  style: "inline_table",
  inline_columns: ["fld_description", "fld_quantity", "fld_rate", "fld_amount"],
  inline_column_widths: { "fld_description": 240, "fld_quantity": 80 },
  allow_inline_create: true,
  allow_inline_delete: true,
  allow_reorder: true,
  max_visible_rows: 10,
  empty_state_text: "No items yet"
  // Post-MVP (requires rollups):
  // "show_summary_row": true,
  // "summary_fields": { "fld_amount": "sum", "fld_quantity": "sum" }
}
```

**Available display styles for Linked Record fields:**

| Style | Rendering | Use When |
|-------|-----------|----------|
| `pills` (default) | Clickable chips showing display field | General linked records |
| `inline_table` | Embedded editable grid | Parent-child patterns |

### Rendering in Record View

```
┌─ Line Items ──────────────────────────────────┐
│ 🔍 Search linked records...                   │
├───────────────────┬──────┬─────────┬──────────┤
│ Description       │ Qty  │ Rate    │ Amount   │
├───────────────────┼──────┼─────────┼──────────┤
│ Frontend dev      │ 20   │ $150.00 │ $3,000   │ ⓧ
│ API integration   │ 12   │ $175.00 │ $2,100   │ ⓧ
│ QA testing        │ 8    │ $125.00 │ $1,000   │ ⓧ
├───────────────────┼──────┼─────────┼──────────┤
│ (new row)         │      │         │          │  ← creation row
└────────────────────────────────────────────────┘

**(Post-MVP)** Summary row with aggregation (sum, count, average) ships with rollup field support.
```

**Widget elements:**
1. **Search bar** — filter existing linked records or find new ones to link.
2. **Linked record list** — rows with configured columns. Max 5 visible, scroll for more. Each row inline-editable.
3. **Creation row** — blank row at bottom. Type to create and link in one action.

### Inline Editing Flow

Spreadsheet-like — no modals:
1. Click "+ Add Row" → new empty row, cursor in first cell.
2. Type and Tab through columns. Auto-save on blur.
3. Enter on last column → save row, create new blank row.
4. Escape → revert cell. If entire row empty, delete it.

### Rendering in Grid View

In the grid, inline_table Linked Record fields show a compact summary:
```
"3 items"
```
**(Post-MVP)** Grid compact summary includes aggregated values (e.g., "3 items · $6,100") when rollup fields are available.

Clicking opens Record View scrolled to the sub-table section.

### Rendering on Mobile (<768px)

Compact summary + action links:
```
Line Items
3 items
[ View All ]  [ + Add ]
```

### Permissions

- Column visibility respects linked table's field permissions.
- Cell editability respects field `edit` permission per role.
- "+ Add Row" visible only if user has `create` permission on linked table.
- Delete icon visible only if user has `delete` permission.

### Common Use Cases

| Parent Table | Linked Table | Inline Columns | Summary |
|-------------|-------------|----------------|---------|
| Invoices | Line Items | Description, Qty, Rate, Amount | (Post-MVP) Amount: sum |
| Projects | Tasks | Title, Assignee, Status, Due Date | — |
| Clients | Invoices | Invoice #, Date, Total, Status | (Post-MVP) Total: sum |
| Orders | Order Items | Product, Qty, Unit Price, Amount | (Post-MVP) Amount: sum |

### Data Model Impact

**No new tables.** Inline sub-table is a rendering mode on existing Linked Record fields. Data stored in linked table's `records` as normal records with normal cross-link pairs. The `display` config is additive — existing Linked Record fields default to `pills`.

---

## CSV/Data Import — MVP

### Scope: MVP — Core UX

Data import is a standard expectation for any database product. EveryStack supports CSV import into existing tables via a guided mapping flow.

### Import Flow (5 Steps)

1. **Upload:** User clicks "Import" button (table toolbar, next to "+ New Record"). Accepts `.csv` and `.tsv` files. Max file size: 10MB (covers ~100K rows for typical business data). File parsed client-side using Papaparse.
2. **Preview & Header Detection:** First 10 rows displayed in a preview table. Auto-detect header row (toggle: "First row is header" — default on). Column count shown.
3. **Field Mapping:** Each CSV column mapped to an EveryStack field via dropdown. Auto-mapping: fuzzy match column headers to field names (case-insensitive, ignore spaces/underscores). Unmapped columns shown in gray with "Skip" label. User can reassign or skip any column. Primary field mapping is required.
4. **Validation Preview:** Dry-run validation using `FieldTypeRegistry.validate()` on first 100 rows. Results shown: green checkmark per column = all valid, amber warning icon = N rows with issues (click to expand). Issues: type mismatches (text in number field), values exceeding max_length, invalid select option values. User can fix the CSV and re-upload, or proceed (invalid values are skipped per-cell, not per-row).
5. **Import Execution:** Server Action `importRecords` processes the file in batches of 100 rows. Each batch: validate → create records via standard record creation path (triggers record templates, automation triggers, audit logging). Progress bar shown. On completion: summary toast "Imported 847 of 850 records. 3 rows had errors." Link to error report (downloadable CSV of failed rows with error reasons).

### Technical Details

- **Write path:** Import uses the standard record creation path (`createRecord` Server Action called in batch). This ensures all existing behavior applies: validation, record templates, `record_creation_source: 'import'`, automation triggers (with batch mode — see `automations.md`), audit logging, search vector updates.
- **Deduplication:** No automatic dedup on import. If the table has unique fields, the unique constraint rejects duplicate rows (reported in error summary). User can choose to update existing records by unique field match in a post-MVP enhancement.
- **Plan limits:** Record quota enforcement applies. If import would exceed the plan's cached record limit, server rejects before processing with: "This import would exceed your plan's record limit ({current}/{max}). Import the first {available} rows?" — user confirms or cancels.
- **Permissions:** Manager+ role required. Team Members and Viewers cannot import.

### What's NOT Supported (MVP)

- Excel (`.xlsx`) import — post-MVP. Use CSV export from Excel.
- Import into synced tables — blocked. Synced tables are read-only for inbound data from the sync source.
- Linked Record resolution during import — post-MVP. Import creates records in one table only. Linked Record columns in the CSV are skipped.
- Update existing records by match — post-MVP.

---

## Kanban View — Post-MVP

> Ships after MVP. Abbreviated spec retained for planning.

Cards grouped by status/select field columns. Drag between columns to change value. Core CRM/sales view.

**Pipeline Value Rollups:** Per-column summary (count + sum of value field). Summary bar at top.

**Record-Level Ownership:** Manager+ designates People field as "ownership field." Team Members/Viewers see only their records. GIN indexed.

---

## Quick Entry — Post-MVP

> Quick Entry is a post-MVP feature. It was previously specced using the legacy `interface_views` system which has been retired. When implemented post-MVP, Quick Entry will be rebuilt as either a Table View mode or an App Designer template.

**Concept:** Stripped-down, speed-optimized view for rapid data entry: inventory receiving, stocktake counting, time logging, inspection checklists. Features scan-to-find-record, quantity inputs, session tracking.

Full spec to be reconciled with current architecture before implementation.
