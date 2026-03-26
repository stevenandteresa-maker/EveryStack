# Mobile Navigation & Interaction Model — Revised Spec

> **Reconciliation Note (2026-02-27):** Aligned with GLOSSARY.md (source of truth).
> Changes: Renamed "Interface"/"interfaces" → "Table View"/"Table Views" throughout.
> Consolidated "Portal designers" + "Interface Designer" → "App Designer".
> Tagged Board View and Calendar View references as post-MVP per glossary MVP scope.
> Updated Command Bar search channel to reference "Table Views" instead of "interfaces".

> **Purpose:** Replaces the fixed bottom nav + FAB model in `mobile.md` with a contextual two-layer navigation system. Incorporates all audit findings from the MVP — Core UX UX Operability review.
> **Scope:** Phone (<768px) only. Tablet (≥768px) uses sidebar navigation identical to desktop with touch-optimized chrome.
> **Status:** DRAFT — pending merge into `mobile.md`
> **Note:** The bottom nav is **context-dependent**. My Office uses its own 4-item bottom nav (Tasks, Chat, Calendar, +) with tab-switched full panels — see `my-office.md > Mobile My Office`. The two-layer model below applies to **workspace context** (tables, records, Table Views).

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                               | Lines   | Covers                                                                |
| ----------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| Core Principle (Unchanged)                            | 43–49   | Desktop = Build, Tablet = Build & Operate, Mobile = Operate & Consume |
| Two-Layer Bottom Bar                                  | 51–138  | Primary nav + contextual tabs, swapping behavior                      |
| FAB Removal                                           | 140–151 | Why FAB was removed, replacement patterns                             |
| Record Templates on Mobile                            | 153–162 | Template picker as bottom sheet, split button adaptation              |
| Active Field Input Behavior                           | 164–224 | Keyboard handling, field focus, input mode switching                  |
| Field-Level Presence on Mobile                        | 226–236 | Real-time presence indicators in Record View                          |
| Navigation Patterns                                   | 238–270 | Stack navigation, swipe gestures, back behavior                       |
| Mobile Card/Record View (Finding #5 Reconciliation)   | 272–291 | Card tap → Record View transition on mobile                           |
| Record View: Inline Sub-Table on Mobile (Finding #13) | 293–309 | Linked record inline display on small screens                         |
| Offline Interaction with Cross-Links (Finding #8)     | 311–344 | Cross-link behavior when offline                                      |
| Display Value Staleness Signal (Finding #6)           | 346–350 | Visual indicator for stale linked record values                       |
| Process State Color Language (Design System Addition) | 352–364 | Red/amber/green state colors on mobile                                |
| Cell Error States on Mobile (Finding #7)              | 366–378 | Error display in mobile grid/card views                               |
| Tasks Tab Scope (Finding #10 — Revised)               | 380–397 | Personal tasks vs record tasks tab behavior                           |
| Capability Gating (Finding #11 Revised)               | 399–422 | Feature availability by device tier — revised rules                   |
| View Switcher on Mobile (Finding #12)                 | 424–453 | Table View switching UI on mobile                                     |
| Command Bar: Unified Search with Context Scoping      | 455–536 | Mobile Command Bar behavior, scoped search                            |
| Cross-References                                      | 538–561 | Links to related docs                                                 |

---

## Core Principle (Unchanged)

**Desktop = Build. Tablet = Build & Operate. Mobile = Operate.**

Phone is the only capability-restricted tier. Everything ≥768px gets the full feature set. Structural configuration (field creation, permission setup, cross-link creation, approval workflow rules) is blocked on phone with a prompt: "Open on tablet or desktop."

---

## Two-Layer Bottom Bar

The bottom bar adapts to the user's current context. Two modes:

### Layer 1: Navigation Bar (Top-Level Screens)

Visible when the user is at a top-level destination — not inside a specific record.

**Bar spec:** 56px height, fixed to bottom, icon+label items, active item highlighted in teal.

**Note:** Layer 1 is **context-dependent**. My Office and workspace contexts have different bottom nav configurations.

#### Workspace Context (tables, Table Views, records list)

| Position | Item       | Icon        | Badge               | Destination                              |
| -------- | ---------- | ----------- | ------------------- | ---------------------------------------- |
| 1        | Home       | Home        | —                   | My Office (user's default panel)         |
| 2        | Chat       | Chat bubble | Unread count        | Chat inbox (DMs, groups, record threads) |
| 3        | Calendar   | Calendar    | Today's event count | Aggregated calendar view                 |
| 4        | Workspaces | Grid/Layers | —                   | Workspace + base browser                 |
| 5        | More       | Ellipsis    | —                   | Settings, Help, Scan, Search, Profile    |

#### My Office Context

My Office uses a separate 4-item bottom nav with tab-switched full panels. See `my-office.md > Mobile My Office` for full specification.

| Position | Item     | Icon        | Badge                      | Destination                                  |
| -------- | -------- | ----------- | -------------------------- | -------------------------------------------- |
| 1        | Tasks    | Checkbox    | Unread/due count (number)  | Tasks panel (full screen)                    |
| 2        | Chat     | Chat bubble | Unread count (number)      | Chat panel (full screen)                     |
| 3        | Calendar | Calendar    | Dot indicator (has events) | Calendar panel (full screen)                 |
| 4        | +        | Plus        | —                          | Action tray (other widgets, barcode/scanner) |

**Where Layer 1 is visible:**

- My Office (4-item variant)
- Chat inbox (not inside a thread)
- Calendar
- Workspace browser (5-item variant)
- Table View list (table/base level, browsing views)
- Card/Record View (browsing records in a list — not expanded into one)

### Layer 2: Contextual Action Bar (Inside a Record)

Visible when the user has opened/expanded a specific record. The navigation bar is replaced by actions relevant to this record.

**Bar spec:** 56px height, fixed to bottom, icon+label items, dynamically populated from record context.

**Transition:** Tap a record to open full-screen sheet → bottom bar morphs from Layer 1 to Layer 2. Back gesture (swipe-from-edge or header back arrow) → morphs back to Layer 1.

**Fixed items (always present in Layer 2):**

| Position | Item        | Icon                                               | Action                                            |
| -------- | ----------- | -------------------------------------------------- | ------------------------------------------------- |
| 1        | Chat        | Chat bubble (with unread dot if thread has unread) | Opens record's chat thread as full-screen overlay |
| 2        | Command Bar | Search/Slash                                       | Opens Command Bar bottom sheet                    |

**Dynamic items (populated from record schema, positions 3–5):**

The system inspects the current record's field types and surfaces the most relevant actions. Max 3 dynamic items. Priority order (first 3 that match are shown):

| Field Type Present    | Item           | Icon            | Action                                                            |
| --------------------- | -------------- | --------------- | ----------------------------------------------------------------- |
| Attachment            | Camera / Files | Camera          | Action sheet: "Take Photo," "Choose from Gallery," "Browse Files" |
| Barcode               | Scan           | Barcode scanner | Opens camera with barcode overlay, auto-detect, populate field    |
| Phone                 | Call / Text    | Phone           | Action sheet: "Call [number]," "Send SMS"                         |
| Address / Geolocation | Navigate       | Map pin         | Opens external maps app with address                              |
| Signature             | Sign           | Pen             | Opens full-screen signature capture canvas                        |
| Email                 | Email          | Envelope        | Opens mail compose to the email address                           |
| URL                   | Open Link      | External link   | Opens URL in browser                                              |

**If fewer than 3 dynamic items match:** Empty positions are not filled. The bar shows 2–5 items total (2 fixed + 0–3 dynamic). No placeholder icons.

**If more than 3 dynamic items match:** The 3rd position becomes a "More Actions" item (ellipsis icon) that opens a bottom sheet listing all remaining field-driven actions.

**Example — Invoice record with Attachment, Phone, Email fields:**

```
[ Chat ]  [ ⌘ Command ]  [ 📷 Camera ]  [ 📞 Call ]  [ ✉️ Email ]
```

**Example — Simple task record with no special fields:**

```
[ Chat ]  [ ⌘ Command ]
```

---

## FAB Removal

The FAB is eliminated entirely. Record creation is handled by:

- **Card/Record View:** "+" button in the header/toolbar area (not floating). Tapping it creates a new record. If a default template exists for the table, it's applied silently — no template picker on mobile.
- **Board View _(post-MVP)_:** "+" at the bottom of each column.
- **Calendar View _(post-MVP)_:** Tap empty time slot → new record with date pre-filled.
- **Chat:** Compose icon in the Chat inbox header.

**No long-press actions anywhere.** Long-press is reserved exclusively for system-level interactions (text selection, context menus provided by the OS).

---

## Record Templates on Mobile

Templates are applied silently. When a table has a default record template configured by the Manager:

- New record creation applies the default template automatically
- No template picker UI on phone
- If the user needs a different template, they create the record on tablet/desktop
- The template's pre-filled values appear in the new record for the user to review and edit

---

## Active Field Input Behavior

When the user taps a field to edit it within the full-screen record sheet, the input method adapts to the field type. The bottom action bar (Layer 2) is hidden while a field input is active — the keyboard or picker occupies the bottom of the screen.

### Input Mode by Field Type

| Field Type                 | Input Method                         | Behavior                                                                                                                                                         |
| -------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single Line Text**       | Standard keyboard                    | Auto-growing field, Done button commits                                                                                                                          |
| **Long Text / Rich Text**  | Full-screen editor                   | Expand to full-screen with formatting toolbar (bold, italic, link, list). Mic icon for dictation. Back to save.                                                  |
| **Number**                 | Large number pad + calculator strip  | See Calculator Strip section below                                                                                                                               |
| **Currency**               | Large number pad + calculator strip  | Currency symbol prefix shown. Calculator strip available.                                                                                                        |
| **Percent**                | Large number pad                     | % symbol suffix shown                                                                                                                                            |
| **Phone**                  | Tel dial pad (`inputMode="tel"`)     | Large phone-style number pad                                                                                                                                     |
| **Email**                  | Email keyboard (`inputMode="email"`) | @ and . prominent                                                                                                                                                |
| **URL**                    | URL keyboard (`inputMode="url"`)     | .com, /, : visible                                                                                                                                               |
| **Date**                   | Calendar picker (bottom sheet)       | Calendar grid, tap day, swipe months, "Today" shortcut. NOT native `<input type="date">`. Uses shadcn DatePicker (react-day-picker) with mobile-optimized sheet. |
| **Time**                   | Scroll wheel picker (bottom sheet)   | Hour + minute wheels (iOS-style). AM/PM toggle.                                                                                                                  |
| **Date + Time**            | Two-step picker                      | Calendar grid → time wheel.                                                                                                                                      |
| **Single Select / Status** | Bottom action sheet                  | Tap field → bottom sheet with options. Search filter if >8 options.                                                                                              |
| **Multi Select / Tags**    | Bottom sheet with checkboxes         | Tap to toggle. Selected items as pills above list.                                                                                                               |
| **People / Assignee**      | Bottom sheet with avatar list        | Searchable user list. Recent selections at top.                                                                                                                  |
| **Linked Record**          | Bottom sheet with record search      | Search + recent. Record card previews. Create inline if no match.                                                                                                |
| **Rating**                 | Star row (56px tall)                 | Tap or swipe across stars. Haptic feedback on each star.                                                                                                         |
| **Checkbox**               | Large toggle (56×32px)               | Tap to toggle directly. Haptic feedback. No edit mode.                                                                                                           |
| **Slider / Percent**       | Drag handle (48px)                   | Thumb-friendly handle. Value label above thumb during drag.                                                                                                      |
| **Attachment**             | Action sheet                         | "Take Photo," "Choose from Gallery," "Scan Document," "Browse Files."                                                                                            |
| **Barcode**                | Camera viewfinder                    | Camera with barcode overlay → auto-detect → populate.                                                                                                            |
| **Signature**              | Full-screen canvas                   | Full-screen signing pad. Finger drawing. Clear / Undo. Save as SVG.                                                                                              |
| **Address**                | Text + autocomplete                  | Type → autocomplete suggestions. "Use my location" button.                                                                                                       |
| **Duration**               | Number pad or scroll wheel           | Configurable per field: HH:MM scroll wheels or total minutes via number pad                                                                                      |

### Calculator Strip

When editing a Number or Currency field, a calculator strip appears between the number pad and the field display. This allows inline arithmetic without leaving the record.

**Layout (44px tall, full width, above number pad):**

```
┌─────────────────────────────────────────────────┐
│  [ running calculation display ]    [ C ]       │
│  [ + ]  [ − ]  [ × ]  [ ÷ ]  [ % ]  [ = ]     │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│           Standard number pad                    │
│         (from inputMode="decimal")               │
└─────────────────────────────────────────────────┘
```

**Behavior:**

- User taps number field → number pad appears with calculator strip above it
- Type a number → it appears in the field AND in the calculator display
- Tap an operator (+, −, ×, ÷) → display shows running calculation
- Tap = → result commits to the field
- Tap C → clears calculator state (field retains its last committed value)
- If the user just types a number and taps Done (no operators used), the calculator strip is invisible overhead — it's only active when an operator is pressed

**Use case:** Field worker entering expense total: `125.50 + 47.25 + 18.00 =` → field gets `190.75`.

---

## Field-Level Presence on Mobile

When another user is editing a field on a record the mobile user is viewing, that field shows:

- The editing user's avatar overlaid on the field label (small, 20px)
- The field is temporarily non-interactive (tap does nothing, no error message)
- When the other user blurs, the avatar disappears and the field becomes editable

This is the same field-level locking model as desktop/tablet, just rendered in the single-column mobile layout.

---

## Navigation Patterns

Covers Back Navigation, Deep Linking, Swipe Gestures.

### Back Navigation

- **Primary:** Swipe-from-left-edge (system gesture). Always available.
- **Secondary:** Back arrow in header (top-left). Always visible inside records and drill-down screens.
- **Breadcrumb:** Header shows truncated breadcrumb trail for deep navigation: `Workspace > Base > Table > Record`. Tap any breadcrumb level to jump back.

### Deep Linking

All entities have stable URLs. Tapping a link from email/SMS/notification:

- If record: opens full-screen record sheet with Layer 2 action bar
- If table/Table View: opens the view with Layer 1 navigation bar
- If chat thread: opens the thread full-screen

### Swipe Gestures

| Gesture                    | Context                                | Action                                                          |
| -------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| Swipe from left edge       | Anywhere                               | Back navigation                                                 |
| Swipe right on card        | Card/Record View list                  | Primary action (complete/approve) — configurable per Table View |
| Swipe left on card         | Card/Record View list                  | Secondary action (archive/reject) — configurable per Table View |
| Swipe right on chat row    | Chat inbox                             | Mark as read                                                    |
| Swipe left on chat row     | Chat inbox                             | Mute thread                                                     |
| Swipe between field groups | Record sheet (when field groups exist) | Navigate between field groups                                   |
| Pull down                  | Any scrollable view                    | Refresh data from server                                        |

**Swipe conflict resolution (Finding #3):** When viewing a record with field groups, swipe-left/right navigates between field groups. Record-to-record navigation uses explicit prev/next arrows in the record header instead of horizontal swipe.

---

## Mobile Card/Record View (Finding #5 Reconciliation)

Mobile Card View is **Record View rendered in compact list layout** with mobile interaction extensions. It is not a separate component.

**RecordCard component** renders identically on all surfaces. Mobile-specific props activated by device context:

| Prop           | Desktop                                     | Mobile                                                   |
| -------------- | ------------------------------------------- | -------------------------------------------------------- |
| `swipeActions` | `false`                                     | `true` — enables swipe right/left actions                |
| `badges`       | Status only                                 | Status + priority + overdue + unread chat + pending sync |
| `tapBehavior`  | Expand in side panel                        | Full-screen record sheet                                 |
| `layout`       | Configurable (single column, grid, compact) | Always compact list                                      |

**Card content:** 3–5 key fields per card (configured per Table View via `field_config`). Full-width cards, vertical scroll.

**Grouping on mobile:** Cards grouped by any single-select, status, user, or date field. Group headers are sticky during scroll. Collapsible. Drag cards between groups to update the grouping field value.

**Mobile record scroll mitigation (Finding #3):** When a record has >15 fields and field groups are configured, all groups except the first are auto-collapsed on initial open. User expands what they need. Progressive disclosure: Level 1 = first group visible, Level 2 = expand additional groups.

---

## Record View: Inline Sub-Table on Mobile (Finding #13)

On phone, inline sub-tables (cross-link fields with `display.style: "inline_table"`) render as a **compact summary + link** instead of an embedded grid:

```
┌──────────────────────────────────┐
│  Line Items                      │
│  3 items                         │
│  [ View All ]  [ + Add ]         │
└──────────────────────────────────┘
```

- **"View All"** navigates to the child table filtered to this parent record
- **"+ Add"** opens a new record creation sheet for the child table, pre-linked to the current record, with template applied silently if one exists
- On tablet (≥768px), the inline sub-table renders with the same 5-row compact widget as desktop

---

## Offline Interaction with Cross-Links (Finding #8)

The offline action queue has cross-link awareness:

### Scope Filter Validation on Replay

When a queued cross-link addition fails scope filter validation on replay, the user sees a conflict card:

```
┌──────────────────────────────────────┐
│  ⚠️ Link couldn't be added           │
│                                      │
│  "Acme Corp" no longer matches the   │
│  filter: Status = Active             │
│                                      │
│  [ Keep Edit ]    [ Revert ]         │
└──────────────────────────────────────┘
```

### Sequential Replay for Cross-Link Actions

Cross-link mutations within the same queue batch replay sequentially — each awaits server confirmation before the next sends. Other field edits replay in parallel.

### Action Weight in Queue Cap

The 100-action queue cap uses weighted counting:

- Simple cell edit: weight 1
- Cross-link modification: weight 5
- Bulk operation: weight 10

At 80 weighted actions, warning: "You have many pending changes — connect to sync soon." At 100, block new mutations.

---

## Display Value Staleness Signal (Finding #6)

When a display value cascade is in-flight for cross-link chips visible on the current screen, the chip shows a subtle shimmer animation (same pattern as loading skeletons). Resolves to the new value when the cascade completes and the real-time event arrives.

---

## Process State Color Language (Design System Addition)

Universal across all mobile (and desktop) surfaces:

| Color           | Meaning                 | Examples                                                     |
| --------------- | ----------------------- | ------------------------------------------------------------ |
| 🔴 Red          | Failed, needs attention | Sync error, validation failure, broken reference             |
| 🟡 Yellow/Amber | Processing, in progress | Cascade updating, sync in progress, pending offline action   |
| 🟢 Green        | Succeeded, resolved     | Sync complete, cascade done (brief flash, 1–2s, then normal) |

Applied to: sync badges, cell error states, automation run status, import/export progress, cascade indicators, offline queue status.

---

## Cell Error States on Mobile (Finding #7)

The same universal cell error patterns from the grid apply to mobile record field rendering:

| State                              | Visual                                       | Interaction                                |
| ---------------------------------- | -------------------------------------------- | ------------------------------------------ |
| Broken reference (deleted/missing) | Value with strikethrough + "(deleted)" badge | Tooltip on long-press                      |
| Sync conflict                      | Red sync icon                                | Tap opens conflict resolution bottom sheet |
| Processing (cascade/sync)          | Yellow shimmer / yellow dot                  | Auto-resolves                              |
| Type coercion issue                | Dash + amber warning icon                    | Tooltip on long-press                      |
| Attachment loading                 | Generic file type thumbnail                  | Replaced when loaded                       |

---

## Tasks Tab Scope (Finding #10 — Revised)

Tasks **is** a bottom nav tab on My Office mobile (position 1 in the 4-item nav). In workspace context, tasks are accessed via My Office or the sidebar.

### MVP — Core UX

My Office dashboard shows two task sources:

- **Personal tasks** from `user_tasks` (created via `/todo` command)
- **PM assignments** — records in `table_type = 'projects'` tables where `pm_table_config.assignee_field_id` = `$me`

Both rendered as a unified task list in My Office, sorted by due date. On mobile, Tasks is the default panel (user-configurable) — see `my-office.md > Mobile My Office`.

### Post-MVP — Comms & Polish (Future)

Unified "Assigned to Me" feed: every record with a People/Assignee field containing `$me`, across all tables, all bases, all workspaces. Powered by the communications infrastructure and notification routing engine.

---

## Capability Gating (Finding #11 Revised)

**Phone (<768px) is the only capability-restricted tier.** Tablet and desktop share the same full feature set.

### Phone: Blocked with "Open on tablet or desktop" prompt

- Create / delete fields, tables, bases
- Field type configuration (validation rules, select options, formula editing)
- Cross-link creation and structural modification
- Convert to Native Table
- Permission configuration (role grid, individual overrides)
- Automation builders
- App Designer
- Field group creation and color configuration
- Approval workflow transition rule setup

### Phone: Allowed (Light Config)

- Rename fields, tables, views
- Toggle existing settings (ownership field on/off, view sharing)
- Reorder tabs, sections, fields within existing structures
- Edit Table View base filters, field visibility

---

## View Switcher on Mobile (Finding #12)

The view switcher is always in dropdown mode on phone. Shown as the first toolbar item: current view name with a chevron. Tapping opens a bottom sheet with the grouped list (organized by Sections if configured by the Manager).

```
┌──────────────────────────────────┐
│  📊 Table View              ▾   │  ← tap to open
│  🔍 [search]  [filter icon]     │
└──────────────────────────────────┘

         ↓ opens bottom sheet ↓

┌──────────────────────────────────┐
│  Views                           │
│                                  │
│  Standard Views                  │
│    📊 Table View          ✓     │
│    📋 Board View                │
│    📅 Calendar View             │
│                                  │
│  Client Views                    │
│    🔷 Client Manager            │
│    🔷 Exec Overview             │
│                                  │
│  My Views                        │
│    📊 Filtered by Region        │
└──────────────────────────────────┘
```

---

## Command Bar: Unified Search with Context Scoping

The Command Bar is the single search surface across the entire platform. No separate filter bar search exists.

### Scope Pill Behavior

When the Command Bar is opened from within a table, it shows a scope indicator:

**Desktop/Tablet:**

```
┌─────────────────────────────────────────┐
│  ⌘  [ in: Projects ✕ ]  search...      │
│                                          │
│  ── Records in Projects ──               │
│  Acme Website Redesign                   │
│  Johnson Q2 Campaign                     │
│                                          │
│  ── Workspace ──                         │
│  (appears as broader results load)       │
└─────────────────────────────────────────┘
```

**Mobile (bottom sheet):**

```
┌──────────────────────────────────┐
│  [ in: Projects ✕ ]             │
│  [ search...                  ] │
│                                  │
│  Records in Projects             │
│  Acme Website Redesign           │
│  Johnson Q2 Campaign             │
│                                  │
│  Workspace                       │
│  (broader results below)         │
└──────────────────────────────────┘
```

**Rules:**

- Opened from within a table → scoped to that table. Scope pill visible.
- Tap ✕ on the scope pill → broadens to full workspace search.
- Opened from My Office, Chat, or non-table screen → no scope pill, searches everything.
- `Cmd+K` and `Cmd+F` both open Command Bar. When in a table, both pre-scope to that table.
- Scoped results appear first (fastest). Broader results populate below as they resolve.

### AI Search Routing (Credit-Aware)

The Command Bar has 4 search channels. Only Channel 4 (semantic/AI) costs credits. The routing logic ensures day-to-day searching is completely free:

**Channels (all fire in parallel except Channel 4):**

| Channel              | What It Searches                                | Cost        | Speed     |
| -------------------- | ----------------------------------------------- | ----------- | --------- |
| 1 — Commands         | Fuzzy match on command registry                 | Free        | Instant   |
| 2 — Entities         | Tables, Table Views, fields via ILIKE           | Free        | Instant   |
| 3 — Keyword records  | tsvector prefix matching on record text content | Free        | <100ms    |
| 4 — Semantic records | Vector embedding similarity search              | 1 AI credit | 200–500ms |

**Routing logic:**

1. User types a query → Channels 1–3 fire immediately (free, fast).
2. If Channel 3 returns 5+ results → Channel 4 does NOT fire. User found what they need.
3. If Channel 3 returns 0–4 results → after 500ms, show hint: `No exact matches. [🔮 Search with AI — 1 credit]`
4. User taps the hint → Channel 4 fires. Semantic results appear below.
5. **Power-user shortcut:** Prefix query with `?` to fire Channel 4 immediately alongside 1–3. Example: `?deals closing this month`

**Credit transparency (see `design-system.md > AI Credit Display Pattern`):**

- The AI search hint always shows the credit cost before firing: `[🔮 Search with AI — 1 credit]`.
- AI search is never silent — the user always explicitly opts in.
- If the user has zero AI credits remaining, the hint shows: `[🔮 Search with AI — no credits remaining]` (disabled state).
- For the `?` power-user prefix, credit cost badge appears inline right of input field.

**In table-scoped context:**

- Channel 3 searches only the scoped table (fast, focused).
- If the user clears the scope pill, Channel 3 searches all accessible tables.
- Channel 4, when fired, respects the scope pill — scoped search uses the table's embeddings only.

---

## Cross-References

This spec replaces or modifies the following sections in existing docs:

| Existing Doc                  | Section                                                                                                                                           | Change                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `mobile.md`                   | Mobile Navigation > Phone (line 950)                                                                                                              | **Replace** fixed 5-tab bottom nav with two-layer contextual bar                               |
| `mobile.md`                   | Primary Mobile Surfaces > Team Member (line 56)                                                                                                   | **Update** FAB references → "+" button in toolbar                                              |
| `mobile.md`                   | Mobile View Types > Card View (line 192)                                                                                                          | **Replace** with Record View compact layout + mobile extensions                                |
| `mobile.md`                   | Ergonomic Design Constraints > Thumb Zone (line 629)                                                                                              | **Update** FAB positioning → "+" button positioning                                            |
| `mobile.md`                   | Phase Implementation (line 1043)                                                                                                                  | **Update** MVP — Core UX mobile scope                                                          |
| `tables-and-views.md`         | Record View (line 682)                                                                                                                            | **Add** swipe actions, badges, pending sync as props (not mobile-only)                         |
| `tables-and-views.md`         | Multi-User Collaboration (line 467)                                                                                                               | **Replace** last-write-wins with field-level locking                                           |
| `tables-and-views.md`         | Expand Record (line 409)                                                                                                                          | **Add** three-zone state table with breakpoints and min widths                                 |
| `tables-and-views.md`         | Grid Toolbar (line 388)                                                                                                                           | **Remove** search icon from toolbar. Remap `Cmd+F` to Command Bar.                             |
| `tables-and-views.md`         | Keyboard Shortcuts (line 327)                                                                                                                     | **Update** `Cmd+F` → "Open Command Bar scoped to current table"                                |
| `command-bar.md`              | Entire doc                                                                                                                                        | **Add** scope pill behavior, context-aware scoping, AI search routing with credit transparency |
| _(Phase build doc — Core UX)_ | When creating a Core UX phase build doc, fold "Table-scoped filter bar search" into Command Bar scope behavior rather than listing it separately. |
| `tables-and-views.md`         | Inline Sub-Table Display                                                                                                                          | **Rewrite** as 5-row compact widget with search + create row                                   |
| `cross-linking.md`            | Display Value Maintenance (line 252)                                                                                                              | **Add** shimmer signal for in-flight cascades                                                  |
| `cross-linking.md`            | relationship_type enum (line 31)                                                                                                                  | **Removed** `many_to_many` — not planned                                                       |
| `cross-linking.md`            | New section needed                                                                                                                                | **Add** Link Picker UX (search, recent, inline create, single/multi select behavior)           |
| `design-system.md`            | New section needed                                                                                                                                | **Add** Process State Color Language (red/yellow/green)                                        |
| `design-system.md`            | New section needed                                                                                                                                | **Add** Cell Error States universal pattern                                                    |
