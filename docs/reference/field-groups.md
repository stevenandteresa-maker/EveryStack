# EveryStack — Field Groups & Column Coloring System

> **Reconciliation: 2026-02-27** — Aligned with `GLOSSARY.md` (source of truth).
> Changes: (1) Renamed "Interfaces" interaction row → "Apps (Post-MVP)" per glossary naming discipline ("Interface" → "App", "Interface Designer" → "App Designer"). (2) Flagged Board/Base sidebar hierarchy — glossary defines a flat Workspace → Table structure with no Board or Base intermediate layers; Board/Base sections retained but marked as needing architectural alignment review. (3) Updated cross-references to use glossary DB entity names. (4) No MVP scope tags needed — doc self-identifies as MVP — Core UX (Core UX); field groups are not explicitly included or excluded from MVP in glossary.

> **Reference doc (Tier 3).** Named field groups, group coloring (header-only / full-column / both), per-field accent color and bold emphasis, enhanced hide/show panel as field management console, conditional cell coloring interaction cascade, synced table tab badges, Board collapse behavior.
> Cross-references: `tables-and-views.md` (grid anatomy, column behavior, column coloring structural Decision #31, column header right-click menu, hide fields toolbar button, views config, cell type rendering, keyboard shortcuts, Sections UI primitive), `data-model.md` (fields, views, tables.tab_color), `design-system.md` (design system palette, 13-color data palette, progressive disclosure, responsive architecture, touch targets), `sync-engine.md` (sync status, conflict indicators, platform adapters), `permissions.md` (workspace roles, field-level permissions — field group config is view-level, follows view visibility model), `mobile.md` (responsive grid behavior, touch interactions)
> Last updated: 2026-02-27 — Glossary reconciliation. Prior: 2026-02-21 — Initial specification from design session.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Strategic Rationale | 35–44 | Why field groups, value proposition for data organization |
| Field Group Anatomy | 45–105 | Group definition, coloring (3 modes), member fields, ordering |
| Per-Field Emphasis | 106–144 | Bold header, accent color, visual weight per field |
| Conditional Cell Coloring | 145–176 | 4-level priority cascade for cell background colors |
| Enhanced Hide/Show Panel | 177–275 | Field visibility panel with group awareness, bulk toggle |
| Synced Table Tab Badges | 276–326 | Platform badge, sync status indicator, 6 health states |
| Board Collapse Behavior | 327–360 | Sidebar board/workspace collapse, saved state |
| Sidebar Visual Hierarchy Summary | 361–392 | Complete sidebar rendering rules |
| Data Model | 393–462 | field_groups table, fields.group_id, group coloring config |
| Field Group Lifecycle | 463–488 | Create, edit, reorder, delete, merge groups |
| Interaction with Existing Features | 489–506 | How groups interact with views, permissions, export |
| Column Header Right-Click Menu (Updated) | 507–532 | Group assignment from column header context menu |
| Group Header Right-Click Menu (New) | 533–549 | Context menu on group headers in grid view |
| Phase Integration | 550–569 | MVP — Core UX delivery scope |

---

## Strategic Rationale

Wide tables with 20–40+ fields are the norm for operational SMBs. A client table might have contact fields, billing fields, project fields, and document fields all in one table. Without structural organization above the individual column level, users scroll horizontally through a flat sequence of columns with no landmarks. Existing structural column coloring (Decision #31 in `tables-and-views.md`) allows assigning pastel tints to adjacent columns, but these are unnamed, ungrouped, and lack management tooling.

Field Groups introduce **named, colored, collapsible column groups** as a first-class organizational layer in the grid. Combined with per-field accent colors and bold emphasis, they create a three-tier visual hierarchy: group → field → cell. The enhanced hide/show panel becomes the central field management console where all visual configuration happens with live preview.

This system is purely organizational — it does not affect data, permissions, or API behavior. All configuration is view-level (saved per view), so different views of the same table can have different groupings.

---

## Field Group Anatomy

A field group is a named span of adjacent columns in the grid, rendered as a group header row above the individual field headers.

### Grid Rendering

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ▾ Contact Info  ●                   │ ▾ Order Details  ●             │ Created Date  │  ← Group header row (28px)
├──────────┬───────────┬──────────────┼────────────┬─────────┬─────────┼───────────────┤
│ Name ★   │ Email     │ Phone        │ Product    │ Qty ★   │ Total   │ Created Date  │  ← Field headers (normal)
├──────────┼───────────┼──────────────┼────────────┼─────────┼─────────┼───────────────┤
│ Acme Co  │ j@acme.co │ 555-0100     │ Widget Pro │ 25      │ $2,500  │ Feb 15, 2026  │
│ Beta Inc │ m@beta.io │ 555-0200     │ Gizmo Std  │ 10      │ $800    │ Feb 18, 2026  │
└──────────┴───────────┴──────────────┴────────────┴─────────┴─────────┴───────────────┘

▾ = collapse chevron     ● = group color indicator     ★ = bold/accented field
```

**Group header row:** 28px height. Spans all member columns. Contains: collapse chevron (left), group name (left-aligned, 13px `textSecondary`, 500 weight), color dot (right of name, 8px circle, clickable). Background: `bgElevated`. Bottom border: 1px `borderSubtle`.

**Ungrouped fields:** Fields not assigned to any group have empty space in the group header row above them — no implicit "Ungrouped" label. The group header row is only rendered when at least one field group exists in the view.

**Group separator:** A 2px vertical rule in the group color at full opacity separates adjacent groups in both the group header row and the field header row. Within a group, standard 1px `borderSubtle` column separators apply.

### Group Color Modes

Each group has a `color_mode` setting that controls how the group color renders in the grid:

| Mode | Group Header | Field Headers | Data Cells |
|------|-------------|---------------|------------|
| `header_only` | Solid color left-edge 3px stripe + color dot | 5–8% opacity tint on member field headers | No tint |
| `full_column` | Solid color left-edge 3px stripe + color dot | 8–12% opacity tint | 4–6% opacity tint on all data cells in member columns |
| `both` | Solid color left-edge 3px stripe + color dot | 8–12% opacity tint | 4–6% opacity tint |

Default: `header_only`. The subtle opacity values ensure the group color provides orientation without competing with cell content or conditional coloring.

**Color palette:** Uses the 13-color data palette defined in `design-system.md`. This keeps the platform's color vocabulary consistent.

### Collapse Behavior

Clicking the collapse chevron (▾) on a group header collapses all member columns into a single narrow column:

```
┌──────────────────────────┬───────┬──────────────────────────────────┐
│ ▾ Contact Info  ●        │ ▸ OD  │ ▾ Tasks  ●                      │  ← "OD" = collapsed Order Details
├──────────┬──────┬────────┤ (3)   ├───────────┬──────────┬───────────┤
│ Name ★   │Email │ Phone  │       │ Task      │ Assignee │ Due       │
├──────────┼──────┼────────┤       ├───────────┼──────────┼───────────┤
│ Acme Co  │ ...  │ ...    │       │ Design    │ Sarah    │ Mar 1     │
└──────────┴──────┴────────┘       └───────────┴──────────┴───────────┘
```

**Collapsed column:** 48px width. Group color as full background at 15% opacity. Chevron changes to ▸. Group name truncated or rendered vertically (CSS `writing-mode: vertical-lr` with 180° rotation for left-to-right reading). Field count badge: "(3)" in `textSecondary`, 11px. Click anywhere on the collapsed column to expand.

**Collapse state:** Persisted per user per view in `user_view_preferences` (same persistence as field visibility toggles). Collapsing a group does not hide the fields — they remain in the data model and are included in exports, filters, and sorts. This is a visual collapse, not a data hide.

**Keyboard shortcut:** When a group header cell is focused, `Space` or `Enter` toggles collapse.

---

## Per-Field Emphasis

Individual fields within or outside of groups support two independent visual emphasis controls:

### Bold Header

Toggleable per field, per view. When enabled:
- Field name renders at **600 weight** (up from 400 default)
- Font size remains 13px (no size change — weight alone provides sufficient contrast)
- The bold indicator (★ or a subtle `B` badge) appears in the hide/show panel next to the field

Use case: Highlighting the "important" fields in a large group — the primary contact field in a Contact Info group, the total field in an Order Details group.

### Field Accent Color

An optional per-field color override that either complements or overrides the parent group color:

| What's Set | Field Header Rendering | Data Cell Rendering |
|-----------|----------------------|-------------------|
| Group color only (no accent) | Inherits group tint | Inherits group tint (if `full_column` or `both` mode) |
| Field accent color, `header_only` | Accent color replaces group tint on this header (10–15% opacity) | No accent tint — inherits group or no color |
| Field accent color, `full_column` | Accent color on header | Accent color at 4–6% opacity on data cells |

Default accent mode: `header_only`. The accent color uses the same 13-color data palette.

**Interaction with group color:** The field accent color overrides (not blends with) the group color for that specific column. Adjacent fields in the same group may show different colors — the group header row still spans them uniformly in the group color, but individual field headers show their own accent.

### Setting Emphasis

Three access paths (all produce the same result):

1. **Right-click column header → field context menu:** Items 13–14 become:
   - `Set column color` → color swatch picker (13 colors + "Default" to inherit group) + mode toggle (header only / full column)
   - `Toggle bold header` → immediate toggle, checkmark indicator in menu
2. **Hide/show panel:** Inline controls per field (see Enhanced Hide/Show Panel section)
3. **Group header right-click → "Edit group":** Opens group config with member field list showing accent/bold state

---

## Conditional Cell Coloring

Conditional color rules apply meaning-based color to individual cells or entire rows based on field values. This is the existing system (specced in `tables-and-views.md` > Color Coding), clarified here for interaction with field groups and accents.

### Color Cascade (Priority Order)

When multiple color layers apply to the same cell, the highest-priority layer wins. There is no blending.

| Priority | Layer | Source | Purpose |
|----------|-------|--------|---------|
| 1 (highest) | **Conditional cell color** | Color rules on the view (field value conditions) | Meaning — "this is overdue," "this deal is won" |
| 2 | **Conditional row color** | Row-level color rules on the view | Meaning — "this record needs attention" |
| 3 | **Field accent color** | Per-field emphasis setting (view config) | Organization — "this field is important" |
| 4 (lowest) | **Group column tint** | Field group color (view config) | Organization — "this field belongs to Contact Info" |

When a conditional rule fires, it fully replaces any structural color beneath it for the affected cell(s). When no conditional rule applies, the structural colors (accent → group) show through.

### Conditional Color Configuration

Configured via the **Color** button in the grid toolbar (already specced). The configuration UI supports:

- **Cell-level rules:** "If {field} {operator} {value}, color this cell {color}." The color applies as a background tint at 15–20% opacity with a left-edge 3px stripe at full opacity — same visual language as table tab colors and field group headers.
- **Row-level rules:** "If {field} {operator} {value}, color the entire row {color}." Row tint at 8–12% opacity. Row tint applies beneath cell-level rules — a row can be amber (warning) while one cell within it is red (error).

**Palette:** Same 13-color data palette. The semantic `success` and `error` tokens from the design system are available as additional options for conditional rules specifically, since conditional coloring often carries pass/fail semantics.

### Conditional Coloring in Hide/Show Panel

The hide/show panel does NOT manage conditional color rules — those live in the Color toolbar panel. The hide/show panel manages only structural/organizational colors (group colors, field accents, bold). This separation keeps the two systems clean: hide/show = structure, Color toolbar = meaning.

---

## Enhanced Hide/Show Panel

The hide/show panel (opened via "Hide fields" in the grid toolbar) evolves from a flat field list into the **field management console** — the single surface where users manage field visibility, grouping, ordering, and visual emphasis with live preview.

### Layout

```
┌─ Hide/Show Fields ────────────────────────────────┐
│  🔍 Search fields...                              │
│                                                    │
│  ▾ Contact Info  ● teal  ▸header  👁 All     ⋯   │
│    ⠿  ☑  Name                ★ ●     👁          │
│    ⠿  ☑  Email                       👁          │
│    ⠿  ☑  Phone                       👁          │
│                                                    │
│  ▾ Order Details  ● amber  ▸header  👁 All   ⋯   │
│    ⠿  ☑  Product                     👁          │
│    ⠿  ☑  Quantity            ★       👁          │
│    ⠿  ☑  Total                       👁          │
│    ⠿  ☐  Discount                    👁̶          │
│                                                    │
│  ── Ungrouped ──────────────────────────────────   │
│    ⠿  ☑  Created Date               👁          │
│    ⠿  ☐  Internal Notes             👁̶          │
│                                                    │
│  + Add Group                                       │
└────────────────────────────────────────────────────┘
```

### Component Anatomy

**Panel dimensions:** 320px width (matches right panel default). Opens as an overlay from the left edge of the grid area, pushing nothing — grid remains interactive behind a scrim on mobile, side-by-side on desktop/tablet.

**Search bar:** Top, sticky. Filters fields by name across all groups. Groups with no matching fields collapse away. Groups with partial matches show only matching fields. Search is instant (no debounce needed for a local list).

**Group header row** (per group):
- **Collapse chevron (▾/▸):** Collapses the field list within this panel (independent of grid collapse state). Purely for panel navigation when there are many groups.
- **Group name:** Inline-editable on double-click. 13px, 600 weight.
- **Color dot (●):** 10px circle in the group color. **Clickable — opens inline color swatch picker** (13 colors in a grid + "Remove color" option). Color change applies instantly to the grid behind the panel.
- **Color mode indicator (▸header / ▸column / ▸both):** Small text label showing current mode. Clickable — cycles through the three modes. Change applies instantly.
- **Bulk visibility toggle (👁 All):** Click to hide all fields in the group. Click again to show all. Icon state reflects: all visible, all hidden, or mixed (half-eye icon).
- **Overflow menu (⋯):** Rename group, Change color mode, Collapse in grid (toggle), Delete group (fields move to ungrouped). Confirmation required only for delete.

**Field row** (per field):
- **Drag handle (⠿):** 16px grip icon, left edge. Drag to reorder within group, between groups, or to/from ungrouped. Drop zones highlight during drag: between fields (horizontal line), between groups (group-colored band), ungrouped zone (subtle highlight).
- **Visibility checkbox (☑/☐):** Toggle field visibility in this view. Instant. Hidden fields show strikethrough name and dimmed row.
- **Field name:** 13px, 400 weight (600 if bold is enabled). Field type icon (same as grid header) precedes name.
- **Emphasis controls (★ ●):** Appear on field row hover (or always visible on touch devices).
  - **★ (bold toggle):** Single click toggles bold header on/off. Filled star = bold active. Instant grid update.
  - **● (accent color):** Small color dot. Clickable — opens the same inline swatch picker as the group color dot. Shows the field's accent color if set, otherwise dim/empty. Selecting a color or "Default" (inherit group) applies instantly.
- **Visibility icon (👁):** Right edge. Mirrors the checkbox — click to toggle. Provides a second click target for quick scanning.

**Ungrouped section:** Always appears below all groups. Label: "── Ungrouped ──" in `textSecondary`, 12px. No collapse chevron, no color, no bulk toggle (use Cmd+A style selection for bulk operations on ungrouped fields). Fields here have the same drag handle, visibility, and emphasis controls.

**"+ Add Group" button:** Bottom of panel, sticky if panel scrolls. `textSecondary`, accent color (`#0D9488`) on hover. Click flow:
1. Inline text input appears for group name (auto-focused)
2. Color swatch picker appears below the name input
3. Enter confirms → empty group created at bottom of group list
4. User drags fields into it

**Alternative fast path — multi-select then group:** Shift+click or Cmd+click field checkboxes to multi-select, then right-click → "Create group from selected." Name + color prompt. Selected fields become the group's members in their current order.

### Drag-Drop Behavior

All drag operations provide live visual feedback and instant grid updates:

| Drag Source | Drop Target | Result |
|------------|-------------|--------|
| Field within a group | Between fields in same group | Reorder within group |
| Field within a group | Between fields in another group | Move field to new group at drop position |
| Field within a group | Ungrouped zone | Remove field from group |
| Ungrouped field | Between fields in a group | Add field to group at drop position |
| Ungrouped field | Ungrouped zone | Reorder within ungrouped |
| Group header | Between group headers | Reorder entire group (all member fields move as a unit) |

**Grid synchronization:** Every drag-drop in the panel instantly rearranges columns in the grid. The grid's column order always mirrors the panel's field order (groups in order, then ungrouped fields in order).

**Frozen column constraint:** The primary field (always frozen leftmost) can belong to a group but cannot be dragged out of the first position. If a group contains the primary field, the primary field is always first within that group, and that group is always first in the grid. Other frozen columns (user-pinned via "Freeze up to here") maintain their freeze state when moved between groups.

### Instant Application

**All changes in the hide/show panel apply instantly to the grid.** There is no "Apply" or "Save" button on the panel. Every interaction — color change, visibility toggle, drag-drop, bold toggle, group creation/deletion, color mode switch — updates the grid in real time.

**Undo:** Ctrl+Z while the panel is open undoes the last panel action (same undo stack as grid edits). Supports multi-step undo through the session.

**Close behavior:** Closing the panel (click outside, press Escape, click the "Hide fields" button again) does nothing special — all changes are already applied and saved to the view config.

### Responsive Behavior

| Breakpoint | Panel Behavior |
|-----------|---------------|
| Desktop (≥1440px) | 320px panel, side-by-side with grid. Grid shrinks to accommodate. |
| Tablet (≥768px) | 320px overlay from left edge with scrim. Grid visible but non-interactive behind scrim. |
| Mobile (<768px) | Full-screen bottom sheet (swipe down to close). Drag-drop uses long-press + drag. |

Touch devices: emphasis controls (★ ●) are always visible (not hover-dependent). Drag handles use long-press (200ms) to initiate drag, preventing accidental drags during scroll.

---

## Synced Table Tab Badges

> ⚠️ **Glossary alignment note:** This section references "base navigation bar" — the glossary does not define this concept. Per glossary, the Workspace is the top-level container; "base" as an intermediate UI layer is pending alignment.

Tables synced from external platforms (Airtable, Notion, SmartSuite) need visual distinction from native EveryStack tables. The tab color system remains user-controllable for organizational grouping — synced status is communicated through an independent badge channel.

### Platform Badge

A 14px platform logo icon renders as an overlay on the table's type icon in the sidebar tab and base navigation bar:

```
Sidebar tab:
┌─────────────────────────┐
▌ 📊⁽ᴬ⁾ Client Tracker    │   ← Airtable badge on table icon
├─────────────────────────┤
▌ 📊⁽ᴺ⁾ Content Calendar  │   ← Notion badge on table icon
├─────────────────────────┤
▌ 📊   Native Table       │   ← No badge (native EveryStack)
└─────────────────────────┘
```

**Badge rendering:** 14×14px platform logo, positioned at the bottom-right of the 18px table type icon with a 2px offset (sub-icon overlay pattern). The badge has a 1px `contentBg` (#FFFFFF) border to separate it from the parent icon. Platform logos:

| Platform | Badge | Notes |
|----------|-------|-------|
| Airtable | Airtable logo mark (yellow/blue) | Simplified to work at 14px |
| Notion | Notion logo mark (black) | |
| SmartSuite | SmartSuite logo mark | |
| Native | No badge | Absence of badge = native |

**Badge + tab color independence:** The platform badge and the tab color stripe are independent visual channels. A synced Airtable table can have an amber tab color (because it's a finance table) AND the Airtable badge (because it's synced). Two pieces of information, two visual treatments, no conflict.

### Sync Status Indicator

Adjacent to the platform badge (or standalone for tables where the badge is too small to read), a sync status icon communicates health:

| Status | Icon | Color | Tooltip |
|--------|------|-------|---------|
| Healthy (syncing normally) | ⇅ (bidirectional arrows) | `textSecondary` | "Synced with {Platform}. Last sync: {time}" |
| Syncing now | ⇅ (animated spin) | `accent` (teal) | "Syncing with {Platform}…" |
| Conflicts pending | ⇅ + ⚠️ dot | `accent` (amber) | "{N} sync conflicts. Click to resolve." |
| Sync paused | ⇅ (paused bars) | `textSecondary` | "Sync paused. Click to resume." |
| Sync error | ⇅ + ✕ | `error` | "Sync failed: {reason}. Click for details." |
| Converted (no longer syncing) | — (none) | — | Badge removed after conversion finalized |

**Placement:** The sync status icon appears in the sidebar tab to the right of the table name, right-aligned. In the base navigation bar, it appears as a small indicator next to the tab label.

**Click action:** Clicking the sync status icon in the sidebar opens the Sync Settings panel for that table (same as navigating to Table Settings → Sync). In the base nav bar, clicking navigates to the table and opens Sync Settings.

---

## Board Collapse Behavior

> ⚠️ **Glossary alignment note:** The glossary defines a flat Workspace → Table hierarchy with no intermediate "Board" or "Base" layers. The `boards` and `bases` DB tables referenced below do not appear in the glossary's DB Entity Quick Reference. This section is retained as-is pending architectural alignment review — the Board/Base organizational layer may be an internal concept not yet reconciled with the glossary's Workspace model.

Boards (organizational groupings of bases, `boards` table in data model) gain collapse/expand behavior in the sidebar, matching the pattern established by Sections.

### Sidebar Rendering

```
┌─────────────────────────────┐
│ ▾ 📁 Operations        (4)  │   ← Board header, expanded
│   ├ 📊 Projects              │
│   ├ 📊 Tasks                  │
│   ├ 📊 Time Tracking          │
│   └ 📊 Team                   │
│                               │
│ ▸ 📁 Finance            (3)  │   ← Board header, collapsed
│                               │
│ ▾ 📁 CRM               (2)  │   ← Board header, expanded
│   ├ 📊 Clients                │
│   └ 📊 Deals                  │
└─────────────────────────────┘
```

**Board header:** Collapse chevron (▾/▸) + board icon + board name + base count badge (when collapsed). Click chevron or double-click header to toggle. Single-click on name selects/navigates to the board's default base.

**Collapse state:** Persisted per user in `user_preferences.sidebar_state`. Independent per board. Collapsed boards show only the header row — all bases, tables, and sections within are hidden.

**Board color:** Boards already have an optional `color` column in the data model. When set, the board header renders a 3px left-edge stripe in the board color — same visual language as table tab colors and base navigation, creating a consistent hierarchy: Board stripe → Base → Table stripe.

**Drag-drop:** Bases can be dragged between boards in the sidebar. Board headers can be reordered via drag. Same interaction pattern as Section drag-drop.

---

## Sidebar Visual Hierarchy Summary

> ⚠️ **Glossary alignment note:** The sidebar groups tables under their Base Connection origin (e.g., "CRM Base"). This is a UI display grouping, not a hierarchy level. The canonical ownership hierarchy is Tenant → Board (optional) → Workspace → Table. See GLOSSARY.md §Workspace and §Base Connection.

The complete organizational and color hierarchy in the sidebar, from top to bottom:

```
┌─────────────────────────────────────┐
│ ▾ 📁 Operations  ● (teal stripe)    │  ← Board (collapsible, optional color)
│   ▾ CRM Base                         │  ← Base Connection grouping (collapsible via Sections)
│     ── Client Management ──          │  ← Section (collapsible, Manager-created)
│     ▌ 📊⁽ᴬ⁾ Clients    ⇅           │  ← Synced table (tab color + platform badge + sync status)
│     ▌ 📊   Deals                     │  ← Native table (tab color, no badge)
│     ── Billing ──                    │  ← Section
│     ▌ 📊   Invoices                  │  ← Native table
│   ▾ Projects Base                    │  ← Base Connection grouping
│     ▌ ✅   Active Projects           │  ← Projects-type table (teal default stripe)
│     ▌ 📅   Team Calendar             │  ← Calendar-type table (amber default stripe)
└─────────────────────────────────────┘
```

Four independent color/badge channels, no conflicts:

| Channel | What It Communicates | Visual Treatment |
|---------|---------------------|-----------------|
| Board color stripe | Workspace-level domain grouping | 3px left-edge stripe on board header |
| Table tab color stripe | Table-level category | 3px left-edge stripe on table tab (sidebar) / 3px bottom-edge border (base nav bar) |
| Platform badge | Synced vs. native origin | 14px logo overlay on table type icon |
| Sync status icon | Sync health | Status icon right of table name |

---

## Data Model

### Field Group Storage

Field groups are **view-level configuration** — different views of the same table can have different groupings. Groups are stored in the view's config JSONB.

**On `views.config`:**

```typescript
interface ViewConfig {
  // ... existing view config ...
  
  field_groups?: FieldGroup[];
}

interface FieldGroup {
  id: string;                           // Stable ID: "fg_" + nanoid(8)
  name: string;                         // Display name (e.g., "Contact Info")
  color: string | null;                 // Color name from 13-color data palette, null = no color
  color_mode: 'header_only' | 'full_column' | 'both';  // Default: 'header_only'
  collapsed: boolean;                   // Grid collapse state (default view state; user overrides stored separately)
  field_ids: string[];                  // Ordered list of field IDs in this group
  sort_order: number;                   // Position relative to other groups
}
```

**On `views.config.field_config[field_id]`** (existing per-field view config, extended):

```typescript
interface FieldViewConfig {
  width?: number;                       // Existing: column width in px
  visible?: boolean;                    // Existing: field visibility
  bold_header?: boolean;                // NEW: render field name at 600 weight
  accent_color?: string | null;         // NEW: color name from palette, null = inherit group
  accent_mode?: 'header_only' | 'full_column';  // NEW: only relevant if accent_color set. Default: 'header_only'
}
```

### User-Level Collapse Overrides

Per-user field group collapse state (separate from the view's default collapse state):

**On `user_view_preferences` (existing table, extended):**

```typescript
interface UserViewPreferences {
  // ... existing preferences ...
  
  field_group_collapsed?: Record<string, boolean>;  // field_group.id → collapsed state
}
```

### Sync Status Badge

No new data model needed. The platform badge derives from `base_connections.platform` (top-level column storing `'airtable' | 'notion' | 'smartsuite'`). Sync status derives from `base_connections.sync_status` and `base_connections.health`. The badge is a rendering concern only.

### Board Collapse

**On `user_preferences.sidebar_state` (existing JSONB, extended):**

```typescript
interface SidebarState {
  // ... existing sidebar preferences ...
  
  board_collapsed?: Record<string, boolean>;  // board.id → collapsed state
}
```

---

## Field Group Lifecycle

### Creation

Three paths:

1. **Hide/show panel → "+ Add Group":** Name input + color picker → empty group created → drag fields in.
2. **Hide/show panel → multi-select → "Create group from selected":** Shift/Cmd+click fields → right-click → "Create group from selected" → name input + color picker → selected fields become group members.
3. **Grid → select adjacent column headers → right-click → "Create group from selected":** Same as #2 but initiated from the grid. Multi-select columns by Shift+clicking headers.

### Modification

- **Rename:** Double-click group name in hide/show panel, or group header right-click → "Rename group" in grid.
- **Recolor:** Click color dot in hide/show panel or grid group header.
- **Change color mode:** Click mode label in hide/show panel, or group ⋯ menu.
- **Add fields:** Drag fields into group in hide/show panel or grid.
- **Remove fields:** Drag fields out of group to ungrouped zone.
- **Reorder fields within group:** Drag within group in hide/show panel or drag column headers in grid.
- **Reorder groups:** Drag group header in hide/show panel or drag group header bar in grid.

### Deletion

**Hide/show panel → group ⋯ menu → "Delete group"** or **grid group header → right-click → "Delete group."** Member fields move to ungrouped, preserving their current order relative to each other. No confirmation dialog — undo via Ctrl+Z within session.

---

## Interaction with Existing Features

| Feature | Interaction |
|---------|------------|
| **Frozen columns** | Primary field (always frozen) can belong to a group. If the primary field's group contains other fields, the group header spans across the freeze boundary — frozen portion shows group name, scrollable portion continues. Freeze indicator (vertical rule) renders on top of group color. |
| **Column reorder (drag in grid)** | Dragging a column header within a group reorders within the group. Dragging a column past a group boundary moves it to the adjacent group (or to ungrouped if dropped past the last group). Dragging the group header bar moves all member columns as a unit. |
| **Column resize** | Resizing a column within a group does not affect the group — the group header span adjusts to accommodate the new total width of member columns. |
| **Filter / Sort / Group-by** | Field groups have no effect on filtering, sorting, or row grouping. These operate on field values, not visual organization. A field can be grouped visually (in a "Contact Info" field group) while simultaneously being the active group-by field (rows grouped by contact name). |
| **Print / PDF export** | Group headers render in print output. Group colors render as grayscale tints in print. Bold headers render as bold. Collapsed groups expand for print (all data visible). |
| **CSV / Excel export** | Field groups do not affect CSV export (flat column list). Excel export can optionally include a merged header row representing field groups (cosmetic — no data impact). |
| **Views** | Field groups are per-view config. Creating a new view copies the current view's groups (if "Duplicate view") or starts with no groups (if "New view"). Shared views share their group config — all viewers see the same groups. Locked shared views prevent group modification by non-creators. |
| **Apps (Post-MVP)** | App page `field_config` can include `field_groups` in its `view_config`. Managers set up field groups as part of App design in the App Designer. If `customizable` and `can_hide_fields` is true, users can modify groups within their user-level app customization overrides. *(Note: "Interfaces" renamed to "Apps" / "App Designer" per glossary naming discipline. The App Designer and Apps are post-MVP.)* |
| **Real-time collaboration** | Field group config changes propagate via the existing view config update WebSocket channel. Two users modifying groups on the same shared view: last-write-wins at the `field_groups` array level (same as other view config). |
| **Responsive** | Desktop: full group header row. Tablet: full group header row (grid is the same, just fewer visible columns). Mobile: group headers hidden (horizontal space too constrained); groups manifest as swipe-between-group navigation if enabled — swipe left/right to jump between field groups. The hide/show panel on mobile (bottom sheet) retains full group management. |
| **Command Bar** | "Go to field group {name}" command navigates the grid horizontally to the first column of the named group. Available when field groups exist on the active view. |

---

## Column Header Right-Click Menu (Updated)

The existing column header right-click menu (from `tables-and-views.md`) gains field group items. Updated menu:

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
13. **Set accent color** (was "Set column color" — renamed for clarity)
14. **Toggle bold header** (new)
15. **Move to group → [Contact Info, Order Details, Tasks, + New Group, Ungrouped]** (new — submenu listing existing groups)
16. Edit permissions (Manager+ only)

When multiple columns are selected (Shift+click headers), additional item:
- **Create group from selected** (new — above item 15)

---

## Group Header Right-Click Menu (New)

Right-clicking on a group header bar in the grid:

1. Rename group
2. Set group color → [color swatch picker]
3. Color mode → [Header only, Full column, Both]
4. ── separator ──
5. Collapse group / Expand group (contextual)
6. ── separator ──
7. Select all fields in group
8. Hide all fields in group
9. ── separator ──
10. Delete group (fields move to ungrouped)

---

## Phase Integration

Field Groups ship as a **MVP — Core UX feature** — part of Core UX alongside the grid, views, and Expand Record. The system is purely view-level configuration with no data model migrations beyond extending existing JSONB config columns. The enhanced hide/show panel is a refinement of the existing hide fields UI, not a new surface.

Synced table tab badges ship with **MVP — Sync (Sync Engine)** — they require the sync infrastructure to exist and are a rendering concern on top of existing `platform_source` metadata.

Board collapse behavior ships with **MVP — Foundation (Foundation)** — Boards and the sidebar already exist; collapse is a UI interaction addition.

| Component | Phase | Depends On |
|-----------|-------|-----------|
| Board collapse in sidebar | MVP — Foundation | Boards data model (exists) — *⚠️ Board/Base not in glossary; pending alignment* |
| Synced table platform badge | MVP — Sync | Sync engine, platform_source metadata |
| Synced table sync status icon | MVP — Sync | Sync engine, sync status tracking |
| Field Groups (grid rendering) | MVP — Core UX | Grid architecture, views |
| Per-field bold / accent color | MVP — Core UX | Grid column headers, views |
| Enhanced hide/show panel | MVP — Core UX | Field groups, existing hide fields UI |
| Conditional cell color cascade | MVP — Core UX | Existing color coding, field groups |
| Field group collapse | MVP — Core UX | Field groups |
| Command Bar "go to group" | MVP — Core UX | Field groups, Command Bar |
| Excel export with group headers | Post-MVP — Documents | Field groups, export system |
