# EveryStack — My Office & Quick Panels

> **Reference doc.** My Office widget grid, Quick Panel architecture, sidebar icon rail, personal tasks, personal calendar, personal events, mobile My Office.
> See `GLOSSARY.md` for concept definitions, naming, and layout dimensions.
> Cross-references: `data-model.md` (user_events, user_tasks schema), `communications.md` (Chat/DMs, Record Thread), `command-bar.md` (personal tasks via /todo), `mobile.md` (mobile navigation, bottom tabs), `support-system.md` (Help Panel, sidebar Help button)
> Last updated: 2026-02-28 — Expandable sidebar architecture. Notes deferred to post-MVP. Workspaces widget with Board container tiles. Quick Panel context-dependent behavior documented.
>
> Update: 2026-03-04 — Added Help button (❓) to sidebar icon rail above avatar. See `support-system.md` for full Help Panel spec.

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                       | Lines   | Covers                                                                                        |
| ----------------------------- | ------- | --------------------------------------------------------------------------------------------- |
| My Office                     | 24–80   | Personal hub, widget grid, widget chrome, grid system, cross-workspace scope                  |
| Quick Panels                  | 81–159  | Sidebar icon rail, push-style panels, workspace vs My Office context, content mapping         |
| Tasks Widget / Quick Panel    | 160–193 | Assigned tasks tab, My To-Dos tab, data model for personal tasks                              |
| Calendar Widget / Quick Panel | 194–266 | Aggregated calendar sources, view modes, event management, personal events schema, feed API   |
| Chat Widget / Quick Panel     | 267–278 | DM-only panel, quick-access to recent conversations                                           |
| Mobile My Office              | 279–327 | Workspace tiles, bottom tab bar, contextual tab swap, default panel, header, hamburger drawer |
| Responsive Summary            | 328–360 | Desktop/tablet/phone layout specs, breakpoint behavior table                                  |

---

## My Office

Top-level personal hub. Unified view across all workspaces the user belongs to. Permission-aware — users see only their relevant data. **"My Office, not The Office"** — each user's own personal space.

### My Office vs Workspace Context

My Office and workspace views are fundamentally different contexts:

|                   | My Office                 | Workspace                   |
| ----------------- | ------------------------- | --------------------------- |
| **Scope**         | Cross-workspace, personal | Single workspace, team      |
| **Main content**  | Widget grid               | Table Views, Record Views   |
| **Quick Panels**  | Expand to 2/3 width       | Slide out at 25% width      |
| **Record Thread** | N/A                       | Opens alongside Record View |

### Widget Grid

My Office displays a **3-column widget grid** on desktop. Each widget is a purpose-built platform component with its own internal UX.

**Default widgets (always present):**

- **Tasks** (1×1) — Personal task aggregation
- **Calendar** (1×1) — Personal calendar aggregation
- **Chat** (1×1) — DMs and @mentions feed

Three equal-width columns in a single row. Clean space below.

**Conditional widgets:**

- **Workspaces** — Displays boards as labeled collapsible container tiles with workspace tiles grouped inside. Ungrouped workspaces appear in an "Ungrouped" section. Auto-appears if user belongs to 3+ workspaces.

**Additional widgets available via catalog:**

- **Saved** — Bookmarked messages from any thread
- **Recent** — Recently accessed records/views
- **Notes** — Post-MVP. Ships with the full personal-notes-capture feature set. See `personal-notes-capture.md`.

**Customization nudge:** "Customize your office →" link below widget row. Opens widget catalog modal. Disappears after first customization.

**Rationale:** Three widgets cover daily essentials (what to do, what's coming up, what did someone say). Additional widgets one click away, never pre-imposed.

### Widget Chrome (Standard Container)

Every widget has a standard wrapper:

- **Title bar** — Widget name. Drag handle in customize mode.
- **Settings gear** (⚙) — Widget-level config (e.g., Tasks: "show only overdue"; Calendar: default view day/week).
- **Expand button** (↗) — Opens widget as Quick Panel (fills 2/3 of screen).

### Grid System

| Property        | Specification                                             |
| --------------- | --------------------------------------------------------- |
| Desktop (1440+) | 3 columns (equal width)                                   |
| Tablet (768+)   | 2 columns                                                 |
| Mobile (<768)   | No grid — tab-switched full panels (see Mobile My Office) |

MVP — Core UX ships with fixed default layout. Drag/resize/add-remove customization enabled when ready.

---

## Quick Panels

Quick Panels are the **same widget components** from My Office, accessible via sidebar icons on **any page** in the platform. They provide persistent access to Tasks, Calendar, and Chat without leaving the current context.

### Sidebar

The sidebar is **collapsed by default (48px icon rail)** and **expandable to ~280px** via a dedicated toggle button (above avatar).

**Collapsed state (48px):** Icons only.

| Icon | Action                                                                                  | Badge                             |
| ---- | --------------------------------------------------------------------------------------- | --------------------------------- |
| 🏠   | My Office — On My Office page: expands sidebar. On other pages: navigates to My Office. | —                                 |
| ☑    | Tasks Quick Panel (context-dependent — see below)                                       | Count (new assignments + overdue) |
| 💬   | Chat / DMs Quick Panel (context-dependent)                                              | Count (unread messages)           |
| 📅   | Calendar Quick Panel (context-dependent)                                                | Dot (upcoming events)             |
| ⟷    | Expand/collapse toggle                                                                  | —                                 |
| ❓   | Help Panel — opens the three-state Help Panel (Ask AI / Browse Help / Contact Support)  | Dot (unread support reply)        |
| 👤   | Avatar / settings                                                                       | —                                 |

**Expanded state (~280px):** Icon rail + content zone. Shows Quick Panel labels and the Workspace tree (Boards → Workspaces). Same content as mobile hamburger drawer.

**Expand/Collapse Toggle (⟷ button, above avatar):** Toggles sidebar between 48px and ~280px. Same behavior everywhere — shows Quick Panel labels + Workspace tree.

### Quick Panel Behavior — Workspace Context

When inside a workspace (viewing tables, records, etc.):

```
Normal (no Quick Panel):
┌──────┬────────────────────────────────────────┐
│ Icon │  Main Panel                       100% │
│ Rail │  (Table View, Record View, etc.)       │
│ 48px │                                        │
└──────┴────────────────────────────────────────┘

Quick Panel open:
┌──────┬──────────┬─────────────────────────────┐
│ Icon │  Quick   │  Main Panel            75%  │
│ Rail │  Panel   │  (pushes right, compresses) │
│ 48px │  25%     │                             │
└──────┴──────────┴─────────────────────────────┘
```

- Quick Panel opens as a **25% side panel** to the right of the sidebar, **pushing** the main panel right.
- Main panel compresses to 75% width — content reflows, nothing is hidden behind.
- Quick Panel is 25% of available width (minus sidebar).
- Click same icon again → close panel. Click different icon → swap panel content.

### Quick Panel Behavior — My Office Context

When on the My Office page:

```
Default (widget grid):
┌──────┬──────────────┬──────────────┬──────────────┐
│ Icon │  Tasks 1/3   │ Calendar 1/3 │ Chat 1/3     │
│ Rail │              │              │              │
│ 48px │              │              │              │
└──────┴──────────────┴──────────────┴──────────────┘

Quick Panel expanded (e.g., Tasks clicked):
┌──────┬──────────────────────────┬──────────────────┐
│ Icon │  Tasks (expanded)   2/3  │ Calendar + Chat  │
│ Rail │                          │ (stacked)   1/3  │
│ 48px │  Full task management    │                  │
│      │  with all features       │                  │
└──────┴──────────────────────────┴──────────────────┘
```

- Clicked widget expands to **2/3 width** with full feature set.
- Remaining widgets **stack in the 1/3** column.
- This is equivalent to clicking the expand button (↗) on a widget.

### Quick Panel Content

Each Quick Panel renders the same component as its My Office widget, but at a larger size with more features exposed. The component is **responsive to its container width** — it renders appropriately whether in a 1/3 widget cell, a 25% Quick Panel, or a 2/3 expanded panel.

---

## Tasks Widget / Quick Panel

Two sub-tabs:

### Assigned Tab

Aggregated from any table across all workspaces where user is in an assignee/people field.

Each task row shows:

- Checkbox (toggles status field on source record)
- Title (primary field of source record)
- Due date pill (color-coded: red = today/overdue, orange = tomorrow, blue = future)
- **Table name badge** (gray pill — identifies source table, e.g., "Marketing Tasks")
- **Workspace color dot** (for multi-workspace users, before table badge)

Click navigates to source record. User can add private subtasks to break down assigned tasks.

### My To-Dos Tab

Private personal task list. Not visible to other workspace members. **One level of subtasks only** — personal tasks are lightweight; deeper nesting belongs in projects tables.

Created via:

- Task widget "+" button
- `/todo` command in Command Bar
- Can be linked to a record/workspace or standalone

No table name badge (tasks are personal).

### Data Model

`user_tasks` table — see `data-model.md`. Private to user. Subtask support via `parent_task_id`. Optional `linked_record_id` + `linked_tenant_id` for record association.

---

## Calendar Widget / Quick Panel

Aggregated personal calendar across all workspaces. Shows time-based data filtered to current user (`$me` implicit).

### What My Calendar Aggregates (MVP)

| Source                      | Records Shown                           | Visual Style                          | Editable          |
| --------------------------- | --------------------------------------- | ------------------------------------- | ----------------- |
| Calendar-type table records | Where user is attendee/assignee         | Solid colored blocks, workspace badge | ✅ (opens record) |
| Projects-type table tasks   | Where user is assignee, has date fields | Hatched/striped blocks, task icon     | ✅ (opens record) |
| Personal events             | All `user_events` for this user         | Neutral/slate color, personal icon    | ✅ (inline edit)  |

**Post-MVP sources:** Booking records (where user is assigned team member), synced external calendar events (Google/Outlook — Post-MVP — Comms & Polish, requires OAuth).

Color coding by source workspace. Personal events get a neutral/distinct color.

### View Modes

- **Day view** (default) — vertical timeline
- **Week view** — time blocks across 7 days
- **Month view** — dot indicators on days, tap to see events

### Event Management

- **Quick-create:** Click empty time slot → popover with title, time, workspace/personal picker, save.
- **Drag-to-reschedule:** Drag events to new time slots.
- **Source filter toggles:** All | Work | Personal
- **Keyboard shortcut:** `⌘+Shift+C` opens Calendar panel from anywhere in My Office.

### Personal Events (`user_events`)

Belongs to the user, not any workspace. For items that don't belong in any workspace (dentist, gym, lunch).

Schema: see `data-model.md` > `user_events` table.

Key fields:

- `show_as`: `busy` (default) | `free` — controls availability blocking
- `recurrence_rule`: JSONB, RFC 5545 RRULE strings internally

**Recurrence support (MVP):**

- **Presets:** Daily, Weekly (pick days), Bi-weekly, Monthly, Quarterly, Yearly
- **Storage:** RRULE strings (`FREQ=WEEKLY;BYDAY=MO,WE,FR`)
- **End conditions:** Never, After N occurrences, Until date
- **Exception handling:** Single-occurrence edits create EXDATE + override. 3-option: "Edit this event" / "Edit all future" / "Edit all events"

**Availability blocking:**

- Personal events block availability by default (`show_as: 'busy'`)
- User can toggle to "Show as Free" for reminder-only events
- All workspace events (meetings, deadlines) always block — no toggle

### Calendar Feed API

Backend endpoint powering all calendar surfaces:

**`GET /api/v1/calendar/feed`**

Parameters: `user_id`, `start_date`, `end_date`, `workspace_ids[]` (optional), `source_types[]` (optional: calendar_record | task | personal), `timezone`

Returns unified list of time blocks:

- `id`, `title`, `start`, `end`, `all_day`
- `source_type` (calendar_record | task | personal)
- `source_workspace_id` (nullable — null for personal)
- `source_workspace_name`
- `source_table_id`, `source_record_id` (nullable)
- `attendees[]`
- `color` (resolved from source)
- `editable` (boolean)
- `metadata` (JSONB — source-specific)

Query logic: parallel queries across calendar records, project tasks, and personal events for the user, merged and sorted by start time.

---

## Chat Widget / Quick Panel

Personalized feed from across all workspaces. Shows @mentions and messages from all thread scopes (record threads, DMs, group DMs).

Each item shows: colored avatar, sender name, message preview, timestamp.

**Filter tabs:** All | @Mentions | DMs

Click navigates to source conversation. In workspace context, clicking a record thread message navigates to that record's Record Thread.

---

## Mobile My Office

Mobile My Office is a **fundamentally different interaction model** — not a scaled-down grid.

### Home Screen: Workspace Tiles

Mobile home screen shows workspace tiles — cards for each workspace the user belongs to. Tap enters workspace.

### Bottom Tab Bar

Fixed 56px bottom navigation:

| Tab      | Icon | Badge                 | Content                    |
| -------- | ---- | --------------------- | -------------------------- |
| Home     | 🏠   | —                     | Workspace tiles            |
| Tasks    | ☑    | Count (new + overdue) | Full-screen Tasks panel    |
| Chat     | 💬   | Count (unread)        | Full-screen Chat panel     |
| Calendar | 📅   | Dot (upcoming)        | Full-screen Calendar panel |

### Contextual Tab Swap

When a user opens a record (full-screen Record View sheet), the bottom tabs contextually swap from Quick Panel tabs to **Record Thread tabs**:

| Tab      | Content                  |
| -------- | ------------------------ |
| Fields   | Record View field canvas |
| Thread   | Record Thread messages   |
| Activity | Activity log (post-MVP)  |

Back navigation returns to the previous bottom tab configuration.

### Default Panel

User chooses which panel opens by default via gear icon (⚙) on any panel → "Set as default." New users default to Home (workspace tiles).

### Mobile Header

- Default: EveryStack logo left, hamburger `≡` center-right, search `🔍` far right
- Search tapped: search bar expands full width with `✕` to close
- No notification bell — notifications surface as badge numbers on bottom tabs

### Hamburger Drawer (~280px)

Same structure as expanded desktop sidebar (~280px): Quick Panel labels (Tasks, Chat, Calendar) + Workspace tree (Boards → Workspaces). Bottom nav remains visible behind scrim. Tap scrim or swipe to close.

**Workspace navigation:** Entering a workspace shows `←` back arrow in header to return to My Office.

---

## Responsive Summary

| Breakpoint      | My Office            | Quick Panels                       | Sidebar                      |
| --------------- | -------------------- | ---------------------------------- | ---------------------------- |
| Desktop (1440+) | 3-column widget grid | 25% in workspace, 2/3 in My Office | ~48px icon rail (expandable) |
| Tablet (768+)   | 2-column widget grid | 25% in workspace, 2/3 in My Office | ~48px icon rail              |
| Mobile (<768)   | Workspace tiles home | Full-screen via bottom tabs        | Hidden, hamburger drawer     |

### Desktop Layout (Default)

```
┌──────┬──────────────┬──────────────┬──────────────┐
│ Icon │  Tasks 1/3   │ Calendar 1/3 │ Chat 1/3     │
│ Rail │  ⊞ Tasks ⚙ ↗ │  ⊞ Cal  ⚙ ↗ │  ⊞ Chat ⚙ ↗ │
│ 48px │              │              │              │
│ ──── │  Assigned My │  Day Wk Mon  │  All @Me DMs │
│ 🏠   │  ☐ Review Q1 │  Mon 20      │  Sarah 10:32 │
│ ☑   │  ☐ Update doc│  Tue 21      │  Mike   9:45 │
│ 💬   │  ☐ Client... │  Wed 22 ████ │  Jess   Yest │
│ 📅   │              │              │              │
│ ⟷    │     Customize your office →  │              │
│ ❓   │              │              │              │
│ 👤   │              │              │              │
└──────┴──────────────┴──────────────┴──────────────┘
```

**Header:**

```
My Office  ──────────  🔍 Search...  🔔  ──────────  EveryStack ◈
```

When Quick Panel expanded (e.g., Tasks):

```
My Office › Tasks  ──  🔍 Search...  🔔  ──────────  EveryStack ◈
```
