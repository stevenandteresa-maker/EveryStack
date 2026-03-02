# EveryStack — Booking & Scheduling System

> ⚠️ **POST-MVP FEATURE** — Per GLOSSARY.md MVP Scope Summary, Booking / Scheduling is explicitly post-MVP. Calendar View (day/week/month) is also post-MVP (only Grid + Card ship in MVP). All content in this doc describes post-MVP functionality unless otherwise noted.

> **Reconciliation: 2026-02-27 (pass 2)** — Aligned with GLOSSARY.md (source of truth). Pass 2 changes: (9) "Portal page ID" → "App page ID" in SchedulerBlockConfig `success_page_id` comment. (10) "Portal page in public mode" → "App page in public mode" in Claude Code Prompt Roadmap (Prompt 7). Both were residual "portal page" references in App Designer context that should use "App page" per glossary naming discipline. Pass 1 changes: (1) Added post-MVP scope label per glossary MVP Scope Summary. (2) "Expand Record view" → "Record View" throughout (4 occurrences). (3) "Grid/Board/etc." → "Grid/Card/etc." per glossary Table View types. (4) "interface_tabs" / "interface tab" → clarified as Table View tabs per glossary naming discipline. (5) "Scheduler portal block" / "portal block" → "Scheduler block" / "App block" per glossary (App Designer produces Apps, not portals). (6) "portal page" (App Designer context) → "App page" per glossary. (7) "Comms Hub" → "communications system" / "email integration" per glossary naming (Record Thread for record-level, Chat for personal). (8) Updated cross-reference terminology to match glossary naming discipline.

> **Reference doc (Tier 3).** Calendar View architecture (post-MVP), bookable tables, computed availability engine, Scheduler block (App Designer), public booking pages, event types (one-on-one, group, round-robin, collective), buffer time / meeting limits / minimum notice, confirmation & reminder flows, self-service rescheduling & cancellation, routing & pre-booking qualification, no-show detection, video conferencing integration, meeting polls, single-use links, managed booking templates, scheduling analytics, data model additions, phase integration.
> Cross-references: `my-office.md` (My Calendar feed API, personal events, availability blocking, workspace default calendar, calendar_table_config, right panel tab architecture), `data-model.md` (calendar_table_config, user_events, workspace_calendars, calendar_exceptions, resource_profiles schema), `tables-and-views.md` (calendar table type, Calendar View type in view switcher, Table View tabs, Record View), `app-designer.md` (Scheduler block placeholder, App block model, App access modes, embeddable forms, Stripe payment blocks, portal client auth, record scoping, App route architecture), `automations.md` (triggers #10 Client Portal Action — appointment booked, automation recipes, template resolution engine, Send Email #7, Send SMS #8, Wait for Event), `communications.md` (notification delivery, thread model), `embeddable-extensions.md` (Commerce Embed architecture pattern, embed protocol — script tag / iframe / React), `project-management.md` (workspace_calendars, calendar_exceptions, resource_profiles), `design-system.md` (responsive breakpoints, design system palette), `mobile.md` (calendar view mobile spec, touch gestures, input optimization), `permissions.md` (workspace roles, portal client permissions), `chart-blocks.md` (scheduling analytics dashboard via summary view type), `email.md` (Post-MVP — Comms & Polish shared OAuth — Google/Microsoft calendar sync)
> Cross-references (cont.): `workspace-map.md` (bookable table config produces `booking_manages` edges in topology graph — booking-enabled tables show has_booking_config flag on TableNode)
> Last updated: 2026-02-27 — Glossary reconciliation pass 2 (2 residual Portal→App naming fixes). Prior: 2026-02-27 pass 1 — Full glossary reconciliation (naming, MVP scope tagging, cross-references). Prior: 2026-02-21 — Added `workspace-map.md` cross-reference. Prior: Initial creation.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                                                      | Lines     | Covers                                                                           |
| ---------------------------------------------------------------------------- | --------- | -------------------------------------------------------------------------------- |
| Design Philosophy                                                            | 46–57     | Tables-as-calendars, availability as computation, progressive complexity         |
| Calendar View Architecture                                                   | 58–172    | Day/week/month views, event rendering, drag-and-drop, mobile calendar            |
| Bookable Tables — The Core Model                                             | 173–278   | 4 bookable types (appointments, resources, services, events), table_type overlay |
| Computed Availability Engine                                                 | 279–393   | Availability computation, business hours, buffer times, conflict detection       |
| Scheduler Block (App Designer)                                               | 394–466   | Embeddable scheduling UI block, slot picker, booking form                        |
| Public Booking Pages & Shareable Links                                       | 467–551   | Public booking URLs, embed options, Turnstile protection                         |
| Booking Lifecycle & Record Creation                                          | 552–617   | 8-step booking flow, confirmation, reminders                                     |
| Self-Service Rescheduling & Cancellation                                     | 618–656   | Client-initiated changes, cancellation policies                                  |
| Routing & Pre-Booking Qualification                                          | 657–700   | Routing forms, conditional assignment, qualification questions                   |
| No-Show Detection & Workflows                                                | 701–730   | No-show detection, automated follow-up, penalty tracking                         |
| Video Conferencing Integration                                               | 731–758   | Zoom integration, meeting link generation                                        |
| Meeting Polls                                                                | 759–812   | Poll creation, voting, auto-scheduling                                           |
| Single-Use Booking Links                                                     | 813–861   | One-time use links, expiration                                                   |
| Managed Booking Templates                                                    | 862–897   | Pre-configured booking types, template library                                   |
| Scheduling Analytics                                                         | 898–922   | Booking metrics, utilization, no-show rates                                      |
| Quick Setup Wizard                                                           | 923–977   | 3-step booking setup wizard                                                      |
| Automation Integration                                                       | 978–1014  | 6 triggers, 3 actions, 5 recipes for booking automations                         |
| External Calendar Sync (Post-MVP — Comms & Polish Dependency — Designed Now) | 1015–1040 | Google/Outlook calendar sync architecture                                        |
| Data Model Additions Summary                                                 | 1041–1069 | New tables and columns for booking system                                        |
| Permissions                                                                  | 1070–1085 | Booking-specific permission rules                                                |
| Phase Implementation Summary                                                 | 1086–1111 | Post-MVP — Portals & Apps (Fast-Follow) delivery scope                           |
| Reconciliation with Existing Docs                                            | 1112–1132 | Cross-reference alignment notes                                                  |
| Key Architectural Decisions                                                  | 1133–1153 | ADR-style decisions with rationale                                               |

---

## Design Philosophy

**Simple and intuitive first. Capable underneath.**

A small business owner should go from zero to shareable booking link in under five minutes. The wizard-driven creation flow hides the platform's full power behind progressive disclosure. Advanced users discover that bookings are records in tables with fields, links, automations, and portals — the same infrastructure they already know.

**Bookable scheduling is not a separate system.** It is a configuration layer on existing infrastructure: calendar-type tables store appointments as records, the availability engine queries the calendar feed API, the Scheduler block renders in Apps (Custom Portal type), and automations handle the lifecycle. No new execution runtime. No isolated data store.

**Availability is computed, not configured.** Unlike Calendly, where availability rules are manually defined in isolation, EveryStack computes real availability from everything the platform knows: internal meetings, project deadlines, personal blocked time, holidays, and (when connected) external calendar commitments. A consultant 80% allocated to a project this week automatically shows fewer booking slots — no manual blocking required.

---

## Calendar View Architecture

> **This section fills the specification gap in `tables-and-views.md`.** Calendar View is referenced as an available view type but has no dedicated behavioral spec. This is the canonical spec.

Calendar View renders records from any table that has date or date-range fields as events on a day, week, or month grid. Available on all table types (not restricted to calendar-type tables), but calendar-type tables get enhanced behavior via `calendar_table_config`.

### View Switcher

Three modes accessible via segmented control in the view toolbar:

| Mode      | Default For               | Layout                                                                                                                                                |
| --------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Month** | Overview / planning       | 7-column grid. Day cells show up to 3 event chips; "+N more" overflow opens day popover. Dot indicators on mobile.                                    |
| **Week**  | Day-to-day work (default) | 7-day columns, vertical time axis (00:00–23:59, visible range 06:00–22:00 with scroll). 30-minute row height slots. All-day events in top banner row. |
| **Day**   | Detailed single-day       | Single column, vertical time axis. Wider event blocks with more detail (title + location + attendees). All-day events in top banner.                  |

### Time Axis & Grid

- **Time axis:** 24-hour, labeled in user's locale format (12h/24h from browser or profile setting). Half-hour gridlines (solid), quarter-hour gridlines (dotted, subtle).
- **Current time indicator:** Red horizontal line with dot, updates every minute. Visible in Week and Day modes.
- **Week start:** Follows user locale (Monday default, Sunday for en-US). Configurable in workspace settings.
- **Business hours highlight:** Rows within working hours (from `workspace_calendars` or user default 9am–5pm) have white/light background; outside hours have subtle gray tint.

### Event Rendering

**Event blocks** are colored rectangles positioned by start/end time.

- **Color source (priority):** Record's color field (via `calendar_table_config.color_field_id`) → table type accent color → workspace default palette rotation.
- **Minimum height:** 30 minutes equivalent (shorter events render at 30-min height with actual time shown).
- **Content in block:** Title (bold, truncated), time range, location icon + text (if field mapped), attendee avatars (max 3 + overflow count).
- **All-day events:** Rendered in dedicated banner row above time grid. Span columns for multi-day. Stacked if multiple (max 3 visible, "+N" overflow).

**Multi-day events (Week/Month):**

- Week: Span across day columns in all-day banner, connected visual bar.
- Month: Span across day cells, wrap at week boundary, continuation arrow indicator.

**Overlap handling (Week/Day):**

- Two overlapping events: side-by-side, each 50% width.
- Three+ overlapping: cascade layout, each offset right by 20%, stacked by start time.
- Maximum visible overlap: 4 events before "+N more" in the time slot.

### Interactions

**Click empty slot → Quick-create popover:**

- Pre-fills date and time from clicked position (snaps to nearest 15-minute increment).
- Fields: title (auto-focused), start time, end time (defaults to +1 hour), target table picker (if multiple calendar tables exist in workspace). Save button creates the record.
- If table has `calendar_table_config`: quick-create also shows mapped fields (location, event type) as optional inputs.

**Click existing event → Open Record View:**

- Opens the record in the standard Record View (overlay panel from right side).
- All record fields visible and editable per normal permissions.

**Drag event to new time (Week/Day):**

- Drag handle on event block. Snaps to 15-minute increments during drag. Ghost preview shows new position. Drop updates start_time and end_time fields on the record.
- Drag in Month view changes date only (time preserved).
- Permission check: requires edit access to the date/time fields.

**Resize event (Week/Day):**

- Bottom edge drag handle. Extends or shrinks end time. Minimum duration: 15 minutes. Snaps to 15-minute increments.

**Drag to reschedule across days (Week):**

- Drag event from one day column to another. Updates date. Time adjusts to drop position.

### Date Field Binding

Calendar View requires at least one date or date_range field to render. Configuration in view settings:

| Setting         | Purpose                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Start field** | Which date/datetime field positions the event start. Required.                                                                 |
| **End field**   | Which date/datetime field positions the event end. Optional — if unset, events render as point-in-time (1-hour default block). |
| **Color field** | Select or status field that determines event color. Optional.                                                                  |
| **Group field** | Field to visually group events (colored sidebar stripe or legend). Optional.                                                   |

For calendar-type tables with `calendar_table_config`, these bindings are pre-configured from the config and inherited automatically. Users can override per-view.

### Calendar View Toolbar

Standard view toolbar (consistent with Grid/Card/etc.) plus calendar-specific controls:

`[ ◀ Today ▶ ] [ Month | Week | Day ] [ Filter ▼ ] [ Group ▼ ] [ Color ▼ ] [ + New Event ]`

- **◀ / ▶:** Navigate backward/forward by one period (month/week/day).
- **Today:** Jump to current date.
- **Filter / Group / Color:** Standard view filter/group/color controls from the shared toolbar system.
- **+ New Event:** Opens quick-create popover anchored to current date/time.

### Responsive Behavior

| Breakpoint        | Layout                                                                                                                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Desktop (1024+)   | Full week/day grid with time axis. Month grid with event chips. Side panel expand record.                                                                                                                                                                                                              |
| Tablet (768–1023) | Week shows 5 days (work week default), swipe for weekends. Day view full-featured. Month grid with dot indicators (tap day → bottom sheet day view).                                                                                                                                                   |
| Mobile (<768)     | **Month:** Dot indicators per day. Tap day → scrollable day list below calendar. **Week:** Horizontal swipe through days (one day visible at a time, day header shows week context). **Day:** Vertical timeline, full width. Long press empty slot → new event. Long press event → drag to reschedule. |

### Calendar View Data Model

No new tables. Calendar View is a `view_type = 'calendar'` on Table View tabs (DB: `interface_tabs`) / Table Views. Configuration stored in `view_config` JSONB:

```typescript
interface CalendarViewConfig {
  start_field_id: string; // Required: date/datetime field
  end_field_id: string | null; // Optional: renders as duration block
  color_field_id: string | null; // Optional: event color source
  group_field_id: string | null; // Optional: visual grouping
  default_mode: 'month' | 'week' | 'day'; // Default: 'week'
  working_hours_start: string; // Default: '09:00' (from workspace calendar)
  working_hours_end: string; // Default: '17:00'
  week_start: 'monday' | 'sunday'; // Default: locale-based
  show_weekends: boolean; // Default: true
}
```

---

## Bookable Tables — The Core Model

A booking in EveryStack is a record in a calendar-type table. The table _is_ the booking system. When booking is enabled on a calendar table, external parties (portal clients or public visitors) can create records in it by selecting available time slots.

### Enabling Booking

Booking is enabled per calendar-type table via `calendar_table_config.booking_enabled: true`. This unlocks:

- The availability computation engine for that table's assigned team members.
- The Scheduler block (App Designer) pointing to this table.
- Public booking page generation.
- Booking-specific automation triggers.
- Self-service rescheduling/cancellation for invitees.

### Booking Configuration

`calendar_table_config` gains new booking-related columns (extending the existing config table):

```typescript
interface BookingConfig {
  // --- Existing fields (unchanged) ---
  title_field_id: string;
  start_time_field_id: string;
  end_time_field_id: string;
  attendee_field_id: string;
  location_field_id: string | null;
  event_type_field_id: string | null;
  recurrence_field_id: string | null;
  booking_source_field_id: string | null;
  is_default_calendar: boolean;
  color_field_id: string | null;

  // --- New: Booking configuration ---
  booking_enabled: boolean; // Default: false. Enables the entire booking system for this table.

  // Event type
  booking_type: 'one_on_one' | 'group' | 'round_robin' | 'collective';
  duration_minutes: number; // Default slot duration (15, 30, 45, 60, 90, 120). User-facing as "Meeting length."
  duration_options: number[] | null; // Optional: let invitee choose (e.g., [15, 30, 60]). Null = fixed duration.

  // Assignment
  assignee_field_id: string; // User/collaborator field — who hosts the booking. Required.
  assignee_pool: string[]; // User IDs eligible for assignment (round-robin / collective pools).
  round_robin_mode: 'availability' | 'equal_distribution' | null; // Only for round_robin type.

  // Scheduling constraints
  buffer_before_minutes: number; // Gap before each booking. Default: 0.
  buffer_after_minutes: number; // Gap after each booking. Default: 0.
  max_bookings_per_day: number | null; // Per-assignee daily cap. Null = unlimited.
  min_notice_hours: number; // Minimum advance booking time. Default: 1.
  max_advance_days: number; // How far ahead can someone book. Default: 60.
  slot_interval_minutes: number; // Slot start alignment (15, 30, 60). Default: 30. Controls "start times offered every N minutes."

  // Group booking (only for booking_type = 'group')
  group_max_invitees: number | null; // Max attendees per slot. Null = unlimited.
  group_show_remaining: boolean; // Show "3 spots left" on booking page. Default: true.

  // Invitee experience
  require_approval: boolean; // If true, bookings land as "Pending" — host must confirm. Default: false.
  cancellation_policy: 'anytime' | 'before_buffer' | 'custom_hours';
  cancellation_cutoff_hours: number | null; // For 'custom_hours': minimum hours before event to cancel. Default: 24.
  rescheduling_policy: 'anytime' | 'before_buffer' | 'custom_hours';
  rescheduling_cutoff_hours: number | null; // Same pattern as cancellation.
  collect_payment: boolean; // If true, Stripe payment required at booking. Uses App Stripe infrastructure.
  payment_amount_cents: number | null; // Fixed amount. Null = from table field.
  payment_amount_field_id: string | null; // Dynamic amount from record field.

  // Confirmation & reminders
  confirmation_email: boolean; // Send confirmation on booking. Default: true.
  reminder_minutes: number[]; // Reminder offsets before event. Default: [1440, 60] (24h + 1h).
  follow_up_enabled: boolean; // Send follow-up after event. Default: false.
  follow_up_delay_minutes: number; // How long after event ends. Default: 60.

  // Video conferencing
  video_provider: 'zoom' | 'google_meet' | 'microsoft_teams' | null;
  video_auto_generate: boolean; // Auto-create meeting link on booking. Default: true when provider set.
  video_link_field_id: string | null; // URL field where generated link is stored on the record.

  // Branding
  booking_page_title: string | null; // Custom title for public booking page. Default: table name.
  booking_page_description: string | null; // Description shown to invitees.
  booking_page_slug: string | null; // URL slug: workspace.everystack.app/book/{slug}

  // No-show tracking
  noshow_enabled: boolean; // Enable no-show detection. Default: false.
  noshow_status_value: string | null; // Status field value that marks a no-show (e.g., "No Show").
  noshow_auto_mark_minutes: number | null; // Auto-mark as no-show if not checked in N minutes after start. Null = manual only.
}
```

### How Booking Types Work

**One-on-One (default):** One host, one invitee. Invitee sees the host's available slots and picks one. The created record links the invitee to the host.

**Group:** One host, multiple invitees book the same slot. Think: workshop, webinar, group fitness class. The host defines a time slot; invitees fill it. `group_max_invitees` caps attendance. The attendee field on the record is a multi-user/multi-link field — each booking adds to it. The Scheduler block shows remaining spots.

**Round Robin:** A pool of hosts (`assignee_pool`). Invitees see the combined availability of the pool. On booking, the system assigns a host based on `round_robin_mode`:

- `availability`: Maximize bookable slots — show any time at least one pool member is free. Assign to whichever pool member is available at the selected time (priority tiebreaker: fewest bookings today → fewest bookings this week → alphabetical).
- `equal_distribution`: Spread bookings evenly. Track per-member booking counts. If a member is more than 2 bookings ahead, temporarily hide their slots until others catch up. Show fewer total slots in exchange for fairness.

Assignment is computed at booking time (not at page-load time) to avoid race conditions. The assignee is resolved server-side when the booking request is submitted.

**Collective:** Multiple hosts must ALL be free (e.g., panel interview, co-hosted demo). `assignee_pool` defines the required attendees. Available slots = intersection of all pool members' availability. The created record lists all pool members in the attendee field.

---

## Computed Availability Engine

The availability engine answers: "What time slots can a given user (or pool of users) accept bookings?"

### Computation Model

```
Available Slots = Bookable Hours Schedule
                  MINUS  Calendar Feed Busy Blocks
                  MINUS  Buffer Zones Around Existing Bookings
                  MINUS  Slots Exceeding Daily Booking Cap
                  MINUS  Slots Within Minimum Notice Window
                  MINUS  Slots Beyond Maximum Advance Window
```

### Bookable Hours Schedule

Each user has a weekly availability template — the hours they're open for bookings. This is the _starting_ availability before any subtractions.

Stored on a new `booking_availability` table (user-level, one row per user):

```typescript
interface BookableHoursSchedule {
  user_id: string;
  tenant_id: string;
  timezone: string; // User's booking timezone. IANA format.
  weekly_schedule: {
    monday: { start: string; end: string }[] | null; // e.g., [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "17:00" }]
    tuesday: { start: string; end: string }[] | null;
    wednesday: { start: string; end: string }[] | null;
    thursday: { start: string; end: string }[] | null;
    friday: { start: string; end: string }[] | null;
    saturday: { start: string; end: string }[] | null; // Null = not available
    sunday: { start: string; end: string }[] | null;
  };
  date_overrides: {
    // Specific date exceptions
    [date: string]: { start: string; end: string }[] | null; // ISO date key. Null = unavailable that day. Array = custom hours.
  };
}
```

**Per-table override:** `calendar_table_config` can optionally include a `booking_hours_override` JSONB column with the same structure. When set, it overrides the user-level schedule for bookings in that specific table only. When null (default), the user-level schedule applies. This mirrors Calendly's per-event-type availability.

**Default schedule on first enable:** When a user first enables booking, the system generates a default schedule: Monday–Friday 09:00–17:00 in their browser timezone. Editable immediately.

### Busy Block Sources (Calendar Feed Integration)

The availability engine consumes the existing Calendar Feed API (`GET /api/v1/calendar/feed`) with a new parameter: `busy_only: true` — returns only events that block availability.

Busy block sources, in order of existing implementation status:

| Source                                                 | Blocks Availability                                 | Available Now                              | How                            |
| ------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------ | ------------------------------ |
| **Calendar-type table records**                        | ✅ Always (where user is attendee/assignee)         | ✅ MVP — Core UX                           | Calendar feed query            |
| **Projects-type tasks**                                | ✅ Always (where user is assignee, has date fields) | ✅ MVP — Core UX                           | Calendar feed query            |
| **Other bookings in same table**                       | ✅ Always                                           | ✅ Post-MVP — Portals & Apps (Fast-Follow) | Calendar feed query            |
| **Personal events** (`user_events`)                    | ✅ When `show_as = 'busy'` (default)                | ✅ MVP — Core UX                           | Calendar feed query            |
| **Holidays** (`calendar_exceptions`)                   | ✅ Always                                           | ✅ MVP — Core UX                           | Calendar exceptions query      |
| **Workspace non-working days** (`workspace_calendars`) | ✅ Always                                           | ✅ MVP — Core UX                           | Working days check             |
| **External calendar events** (Google/Outlook)          | ✅ When `show_as = 'busy'` (default)                | ⏳ Post-MVP — Comms & Polish               | Calendar feed, external source |

**Post-MVP — Portals & Apps (Fast-Follow) ships with all internal sources.** External calendar sync plugs in as an additional source when Post-MVP — Comms & Polish lands — no architectural change, just a new `source_type` in the feed. The system is accurate against everything EveryStack knows; the Post-MVP — Comms & Polish addition makes it accurate against everything the user's _entire calendar_ knows.

**Messaging to users before Post-MVP — Comms & Polish:** Booking settings page shows: "Availability is computed from your EveryStack calendar, tasks, and blocked time. Connect Google or Outlook Calendar in Settings → Integrations for complete accuracy." Non-blocking — the system works without it.

### Slot Generation Algorithm

Given a booking request for a specific date range and user (or user pool):

```
1. Load bookable hours for each day in range (weekly_schedule + date_overrides).
2. For each day, generate candidate slot start times at slot_interval_minutes.
3. For each candidate slot, compute slot_end = slot_start + duration_minutes.
4. Query calendar feed for user's busy blocks in the date range (single batch query).
5. For each candidate slot:
   a. Check: slot_start ≥ now + min_notice_hours? Skip if not.
   b. Check: slot_start ≤ now + max_advance_days? Skip if not.
   c. Check: no busy block overlaps [slot_start - buffer_before, slot_end + buffer_after]? Skip if conflict.
   d. Check: booking count for this user on this day < max_bookings_per_day? Skip if at cap.
   e. For round_robin: repeat (c) and (d) per pool member. Slot is available if at least one member passes.
   f. For collective: repeat (c) and (d) per pool member. Slot is available only if ALL members pass.
6. Return available slots with metadata (which assignee(s) available, remaining group spots).
```

### Availability API

**`GET /api/v1/booking/availability`**

Parameters: `table_id`, `start_date`, `end_date`, `timezone`, `duration_minutes` (optional override from invitee duration picker).

Returns:

```typescript
interface AvailabilityResponse {
  slots: {
    start: string; // ISO datetime
    end: string; // ISO datetime
    available_hosts: string[]; // User IDs (for round robin/collective display)
  }[];
  timezone: string;
  booking_config: {
    duration_minutes: number;
    duration_options: number[] | null;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    group_remaining: number | null; // For group bookings: spots left per slot
  };
}
```

**Caching:** Availability is computed on request, not pre-materialized. The calendar feed already has Redis caching (30s TTL, event-driven invalidation). Availability computation adds <50ms on top. No separate cache needed — staleness is bounded by the feed cache.

**Timezone handling:** All computation is done in UTC internally. The invitee's timezone (from browser or explicit selection) is used only for display. Slot start/end times are returned as ISO strings with UTC offset. The Scheduler block renders in the invitee's local time.

---

## Scheduler Block (App Designer)

The Scheduler block is an App block type (post-MVP App Designer) that renders an interactive booking calendar for App visitors. It is the primary booking surface.

### Block Configuration

```typescript
interface SchedulerBlockConfig {
  source_table_id: string; // Calendar-type table with booking_enabled
  booking_config_override: Partial<BookingConfig> | null; // Optional per-block overrides (e.g., different duration)
  display: {
    style: 'calendar' | 'list'; // Calendar grid or time-slot list. Default: 'calendar'.
    show_timezone_picker: boolean; // Let invitee change timezone. Default: true.
    show_host_info: boolean; // Show host name + photo. Default: true (one_on_one), false (round_robin).
    show_remaining_spots: boolean; // For group bookings. Default: true.
    accent_color: string | null; // Override App theme for this block. Null = inherit.
  };
  intake_fields: IntakeField[]; // Additional fields to collect from invitee at booking.
  success_action: 'message' | 'redirect' | 'page';
  success_message: string | null; // "You're booked! Check your email for confirmation."
  success_redirect_url: string | null; // External URL redirect.
  success_page_id: string | null; // App page ID to navigate to.
}

interface IntakeField {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'textarea';
  required: boolean;
  options: string[] | null; // For select type.
  maps_to_field_id: string | null; // Table field to write value into. Null = stored in booking metadata.
}
```

### Invitee Booking Flow (3 Steps)

**Step 1 — Select Time:**

- Calendar or list view showing available slots (from Availability API).
- Date navigation (previous/next week, month picker).
- Timezone display with optional picker.
- For duration_options: segmented control to pick meeting length (updates available slots).
- For group bookings: "N spots remaining" badge per slot.
- Click a slot → selected state (highlight), proceed button appears.

**Step 2 — Your Details:**

- Name (required — always).
- Email (required — always. Used for confirmation, reminders, rescheduling link).
- Phone (optional, configurable).
- Intake fields as configured.
- If `collect_payment: true`: Stripe Elements payment form (card input). Amount displayed. Apple Pay / Google Pay shown when available.
- "Notes for the host" free-text field (always present, optional).
- Book button.

**Step 3 — Confirmation:**

- Success message, calendar event download (.ics file link), "Add to Google Calendar" / "Add to Outlook" buttons.
- Rescheduling and cancellation links (if policies allow).
- If `require_approval: true`: message changes to "Your booking request has been submitted. You'll receive confirmation once the host approves."

### Authenticated vs. Public Access

**In authenticated portal (existing client):**

- Step 2 pre-fills name and email from portal client profile.
- The created record is automatically linked to the client's scoped records via the portal's `record_scope` config.
- Client sees the booking in their portal's data blocks alongside their other records.

**On public booking page (new visitor):**

- No authentication required. Name + email collected in Step 2.
- Turnstile spam protection (same as embeddable forms).
- Record created with the visitor's info. If an email match exists in a workspace contacts/CRM table, the record is auto-linked. If no match, a new contact record can be auto-created (configurable in booking settings: "Auto-create contact on booking from new visitor" toggle).
- Rate limiting: Max 5 bookings per email per hour. Max 10 bookings per IP per hour.

---

## Public Booking Pages & Shareable Links

Every bookable table can generate a public booking page — a standalone URL where anyone can book without authentication.

### URL Structure

```
workspace.everystack.app/book/{slug}
```

- `{slug}` is `booking_page_slug` from `BookingConfig`. Auto-generated from table name on enable, editable by Manager.
- Custom domain support (Post-MVP — Portals & Apps (Fast-Follow)): `acmeconsulting.com/book/{slug}` via App custom domain infrastructure.
- Short links for sharing: `evsck.co/b/{short_code}` (6-char alphanumeric, stored in `booking_links` table).

### Per-User Booking Links

For one-on-one and round-robin tables, individual team members get personal booking links:

```
workspace.everystack.app/book/{table_slug}/{user_slug}
```

- `{user_slug}` is derived from user's display name (auto-generated, editable). E.g., `/book/consultations/steven`.
- For round-robin tables: the personal link bypasses round-robin assignment and books directly with that user.
- For one-on-one tables: same behavior as the table link (user is the only host).

### Booking Page Rendering

Public booking pages are lightweight — server-rendered HTML with the Scheduler block, App theme, and minimal chrome:

```
┌──────────────────────────────────────────────┐
│  [Logo]  Company Name                         │
│                                               │
│  Booking Page Title                           │
│  Description text...                          │
│                                               │
│  ┌─────────────────────────────────────────┐  │
│  │        Scheduler Block                   │  │
│  │   (Calendar/list view + booking form)    │  │
│  └─────────────────────────────────────────┘  │
│                                               │
│  Powered by EveryStack (Freelancer plan)      │
│  [Privacy Policy link]                        │
└──────────────────────────────────────────────┘
```

- Styled with workspace's App theme (or booking-specific theme override).
- "Powered by EveryStack" branding on Freelancer/Starter plans. Removed on Professional+.
- No navigation, no login prompt, no workspace chrome.
- SEO: `noindex, nofollow` by default (booking pages are private). Toggle in settings.
- Meta tags for link sharing: `og:title`, `og:description` from booking page config.

### Embeddable Booking Widget

Same embed protocol as Commerce Embed and embeddable forms:

**Script tag:**

```html
<script src="https://book.everystack.app/embed/{table_id}.js" async></script>
<div id="everystack-booking-{table_id}"></div>
```

**Iframe:**

```html
<iframe
  src="https://book.everystack.app/b/{table_id}"
  style="width:100%;border:none;min-height:600px;"
></iframe>
```

**React component:**

```jsx
import { EveryStackBooking } from '@everystack/booking-widget';

<EveryStackBooking
  tableId="tbl_xyz789"
  userSlug="steven" // Optional: pre-select host
  duration={30} // Optional: pre-select duration
  onBooked={(result) => console.log('Booking confirmed:', result)}
/>;
```

---

## Booking Lifecycle & Record Creation

When an invitee completes the booking flow, the system executes an atomic sequence:

### Creation Sequence

```
1. Validate: slot still available (re-check availability at submission time — prevents race conditions).
2. Resolve assignee:
   - One-on-one / collective: assignee(s) already determined.
   - Round robin: run assignment algorithm NOW (not at page load), using real-time availability.
   - Group: add invitee to existing slot record's attendee field (don't create new record).
3. Create record in calendar table:
   - title_field: "{Invitee Name} — {Booking Page Title}" (or "{Invitee Name} + {Host Name}").
   - start_time_field: selected slot start (UTC).
   - end_time_field: selected slot end (UTC).
   - attendee_field / assignee_field: resolved host(s).
   - location_field: video conferencing link (if auto-generated) or configured location.
   - booking_source_field: 'booking_page' | 'portal' | 'embed' | 'api'.
   - event_type_field: from booking config or routing form selection.
   - Intake field values mapped to table fields.
   - booking_status system field: 'confirmed' (or 'pending' if require_approval).
   - booking_metadata (JSONB): invitee email, phone, notes, IP, user_agent, Turnstile token, referrer URL.
4. Process payment (if collect_payment):
   - Create Stripe PaymentIntent server-side.
   - Confirm payment.
   - On failure: rollback record creation, return to payment form with error.
   - On success: store payment_intent_id in record metadata.
5. Generate video conferencing link (if video_provider configured):
   - Call provider API (Zoom/Google Meet/Teams) to create meeting.
   - Store meeting URL in video_link_field on the record.
6. Send confirmation email to invitee (if confirmation_email enabled):
   - Template: booking title, date/time in invitee's timezone, host name, location/video link, .ics attachment.
   - Includes reschedule and cancel links (tokenized, single-use per action).
7. Send notification to host:
   - In-app notification via communications system.
   - Email notification (configurable in user notification preferences).
   - Push notification (mobile).
8. Fire automation trigger: "Client Portal Action — appointment booked" (#10).
   - Execution context includes: record_id, table_id, invitee details, booking_source, payment status.
9. Schedule reminders:
   - For each offset in reminder_minutes, create BullMQ delayed job.
   - Reminder sends to both invitee (email) and host (notification + optional email).
10. Schedule follow-up (if follow_up_enabled):
    - BullMQ delayed job at event_end + follow_up_delay_minutes.
    - Fires automation trigger: "Booking Follow-Up Due."
```

### Booking Status System Field

Every bookable calendar table gets a system-managed `booking_status` field (hidden by default, visible in view settings):

| Status                 | Meaning                                                 | Set By                                                       |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `confirmed`            | Booking is active and confirmed.                        | System on creation (or host approval).                       |
| `pending`              | Awaiting host approval (`require_approval = true`).     | System on creation.                                          |
| `cancelled_by_invitee` | Invitee cancelled via self-service link.                | System on cancellation.                                      |
| `cancelled_by_host`    | Host cancelled from record view.                        | System on host cancellation.                                 |
| `rescheduled`          | Original booking was rescheduled (new booking created). | System on reschedule.                                        |
| `completed`            | Event time has passed and no no-show flag.              | System (BullMQ job after event_end + grace period).          |
| `no_show`              | Invitee did not attend.                                 | System (auto after noshow_auto_mark_minutes) or host manual. |

Status transitions are enforced — only valid transitions allowed (e.g., can't go from `cancelled` to `confirmed`).

---

## Self-Service Rescheduling & Cancellation

Invitees receive tokenized action links in their confirmation and reminder emails.

### Reschedule Flow

1. Invitee clicks reschedule link → lands on a reschedule page (same Scheduler block UI, pre-loaded with original booking context).
2. Selects a new time slot.
3. On submit:
   - Original record's `booking_status` → `rescheduled`. Original times preserved in `booking_metadata.original_start/end`.
   - New record created with updated times (inherits all other fields from original).
   - Linked: new record's `booking_metadata.rescheduled_from` points to original record ID.
   - New confirmation email sent to invitee with updated details.
   - Notification to host: "{Invitee} rescheduled from {old_time} to {new_time}."
   - Existing reminders cancelled. New reminders scheduled.
4. Policy enforcement: if `rescheduling_cutoff_hours` is set and the event is within the cutoff, the reschedule link shows: "This booking can no longer be rescheduled. Please contact {host_name} directly."

### Cancellation Flow

1. Invitee clicks cancel link → lands on cancellation confirmation page.
2. Optional: reason field (free text, stored in `booking_metadata.cancellation_reason`).
3. On confirm:
   - Record's `booking_status` → `cancelled_by_invitee`.
   - Cancellation email sent to invitee.
   - Notification to host: "{Invitee} cancelled their {booking_title} on {date}."
   - Reminders cancelled.
   - If payment was collected: refund logic per workspace policy (full refund / partial / no refund — configurable in booking settings, actioned via Stripe Refund API).
   - Freed slot becomes available for new bookings immediately.
4. Policy enforcement: same cutoff pattern as rescheduling.

### Host-Initiated Actions

Hosts can cancel or reschedule from the Record View:

- **Cancel:** "Cancel Booking" button in record toolbar → confirmation modal with required reason → status update → cancellation email to invitee with reason.
- **Reschedule:** "Reschedule" button → date/time picker inline → update record times → reschedule email to invitee with new details.

---

## Routing & Pre-Booking Qualification

Routing forms let the workspace qualify and direct invitees before they see the booking calendar. This uses the existing App form infrastructure with a new routing destination type.

### How It Works

1. Manager creates an App form page (standard form builder) with screening questions.
2. In the form's completion action, instead of "Thank you message" or "Redirect URL," a new option: **"Route to Booking Page."**
3. Routing rules are configured as conditions on form field values:

```typescript
interface BookingRoutingRule {
  conditions: FormCondition[]; // AND-combined conditions on form field values.
  destination_type: 'booking_table' | 'booking_user' | 'external_url' | 'message';
  destination_table_id: string | null; // Route to a specific bookable table.
  destination_user_slug: string | null; // Route to a specific user's booking page.
  destination_url: string | null; // External redirect (e.g., disqualified leads → marketing page).
  destination_message: string | null; // "Thanks for your interest, we'll be in touch." (no booking offered).
}
```

4. On form submission, routing rules are evaluated top-to-bottom. First match wins. Fallback is configurable (default: show booking page for the default bookable table).

### Example: Law Firm Intake

```
Form: "What can we help you with?"
  - Question 1: "What area of law?" [Family, Business, Criminal, Immigration]
  - Question 2: "Is this urgent?" [Yes, No]

Routing Rules:
  1. If area = "Family" → Route to: /book/family-law (round-robin among family lawyers)
  2. If area = "Business" → Route to: /book/business-law
  3. If area = "Criminal" AND urgent = "Yes" → Route to: /book/urgent-criminal (specific senior partner)
  4. If area = "Criminal" AND urgent = "No" → Route to: /book/criminal-law (round-robin)
  5. If area = "Immigration" → Show message: "We don't currently handle immigration law. We recommend..."
```

### Routing Form Data Pass-Through

Form field values are passed to the Scheduler block as pre-filled intake data. The booking record stores both the routing form responses (in `booking_metadata.routing_form_data`) and any additional intake fields from the Scheduler block itself. This avoids asking the invitee the same questions twice.

---

## No-Show Detection & Workflows

### Detection Methods

**Manual:** Host marks a booking as "No Show" from the Record View or from a bulk action in Grid/Calendar View. Button appears in the record toolbar after the event's start time has passed.

**Automatic:** If `noshow_auto_mark_minutes` is set (e.g., 15 minutes), a BullMQ delayed job fires at `event_start + noshow_auto_mark_minutes`. If `booking_status` is still `confirmed` at that point (not manually marked as completed or checked in), status auto-updates to `no_show`.

**Check-in integration:** For in-person bookings, the Quick Entry interface (existing) or a portal check-in page can mark attendance. On check-in: `booking_status` → `checked_in` (new transient status), which prevents auto-no-show. After event end: `checked_in` → `completed`.

### No-Show Automation Trigger

New automation trigger: **"Booking No-Show"** (extends trigger #10 Client Portal Action with sub-type `no_show`).

Execution context: `record_id`, `invitee_email`, `invitee_name`, `host_user_id`, `booking_table_id`, `event_start`, `event_end`, `no_show_method` (manual | auto).

**Pre-built recipe: No-Show Follow-Up**

| Step          | Action                                                                                 |
| ------------- | -------------------------------------------------------------------------------------- |
| Trigger       | Booking No-Show                                                                        |
| Wait          | 30 minutes                                                                             |
| Send Email    | To invitee: "Sorry we missed you. Would you like to reschedule?" with reschedule link. |
| Condition     | If invitee rescheduled within 48 hours → end.                                          |
| Wait          | 48 hours                                                                               |
| Send Email    | To invitee: "Your missed appointment — here's a link to rebook when you're ready."     |
| Update Record | Tag invitee contact record with "No Show History."                                     |

---

## Video Conferencing Integration

### Supported Providers

| Provider            | Auth Method                       | Auto-Link Generation                                                   | Phase                                                             |
| ------------------- | --------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **Zoom**            | OAuth 2.0 (user-level)            | Create meeting via Zoom API → return join URL + host URL               | Post-MVP — Portals & Apps (Fast-Follow)                           |
| **Google Meet**     | OAuth 2.0 (same as calendar sync) | Create event in Google Calendar with conferenceData → return meet link | Post-MVP — Comms & Polish (ships with calendar sync — same OAuth) |
| **Microsoft Teams** | OAuth 2.0 (same as calendar sync) | Create online meeting via Graph API → return join URL                  | Post-MVP — Comms & Polish (same OAuth)                            |

### How It Works

1. User connects their video provider in workspace Integrations tab (same tab as calendar sync, payment, etc. — already spec'd in `automations.md` sidebar Tab 2).
2. On booking creation, if `video_auto_generate: true`, the system calls the provider API to create a meeting with:
   - Title: booking record title.
   - Start/end: booking times.
   - Attendees: host email + invitee email.
3. The returned meeting URL is stored in the record's `video_link_field`.
4. The URL is included in the confirmation email, reminders, and the Scheduler block's confirmation step.
5. On cancellation: meeting is deleted via provider API.
6. On reschedule: meeting time is updated via provider API (or deleted + recreated if update fails).

**Post-MVP — Portals & Apps (Fast-Follow) ships with Zoom only** (Zoom uses a standalone OAuth flow, not tied to calendar sync). Google Meet and Microsoft Teams ship with Post-MVP — Comms & Polish since they share the Google/Microsoft OAuth consent flow with calendar sync.

**Manual fallback:** If no provider is connected, the user can configure a static location/link in `location_field` (e.g., a permanent Zoom room link, a Google Meet link, or a physical address). This works from day one with zero integration.

---

## Meeting Polls

Meeting polls solve the "find a time that works for everyone" problem for internal or semi-internal scheduling (colleagues, existing contacts) — distinct from the booking page model which is for external invitees.

### How It Works

1. User creates a poll from: Command Bar (`/poll`), Calendar View ("New Poll" button), or My Calendar.
2. Poll creation form:
   - Title: "Team sync" / "Client kickoff" / etc.
   - Proposed times: user picks 3–8 time slots from a mini calendar picker.
   - Participants: select users (internal) and/or enter emails (external).
   - Options: "Participants can suggest new times" toggle. Deadline date for responses.
3. System generates a unique poll URL and sends invitations (email + in-app notification for internal users).
4. Participants vote: for each proposed time, select ✅ Available / ⚠️ If needed / ❌ Unavailable.
5. Poll creator sees a response matrix — times ranked by availability overlap.
6. Creator selects the winning time → "Schedule" button → creates a calendar record with all participants as attendees. Confirmation sent to all.

### Data Model

```typescript
// New table
interface MeetingPoll {
  id: string;
  tenant_id: string;
  created_by: string; // User ID
  title: string;
  description: string | null;
  proposed_times: { start: string; end: string }[];
  participant_emails: string[]; // External participants
  participant_user_ids: string[]; // Internal participants
  allow_suggestions: boolean;
  deadline: string | null; // ISO datetime
  status: 'open' | 'booked' | 'expired';
  selected_time_index: number | null; // Which proposed time was chosen
  result_record_id: string | null; // Created calendar record
  created_at: string;
}

// New table
interface MeetingPollResponse {
  id: string;
  poll_id: string;
  respondent_email: string;
  respondent_user_id: string | null; // If internal user
  votes: ('available' | 'if_needed' | 'unavailable')[]; // One per proposed_time
  suggested_times: { start: string; end: string }[] | null;
  responded_at: string;
}
```

### Scope: Post-MVP — Portals & Apps (Fast-Follow) (ships alongside booking system — shared calendar UI components).

---

## Single-Use Booking Links

For sales outreach, recruitment, or any situation where the host wants to send a unique, trackable booking link to a specific person.

### How It Works

1. Host creates a single-use link from: record toolbar ("Send Booking Link"), Command Bar (`/booklink`), or booking table's link management view.
2. Configuration: target table, pre-filled invitee name/email (optional), expiry (24h / 48h / 7 days / 30 days / never), custom message.
3. System generates a unique URL: `workspace.everystack.app/book/{table_slug}/i/{token}` (token = 32-char base64url).
4. Host shares the link (manually, or via Send Email automation action with template variable `{{booking_link}}`).
5. Invitee opens link → standard Scheduler block UI, with name/email pre-filled if provided.
6. Once booked or expired, the link deactivates. Visiting an expired/used link shows: "This booking link has expired. Contact {host_name} for a new link."

### Link Tracking

| Status    | Meaning                                |
| --------- | -------------------------------------- |
| `created` | Link generated, not yet accessed.      |
| `viewed`  | Invitee opened the link (page loaded). |
| `booked`  | Invitee completed a booking.           |
| `expired` | Expiry time passed without booking.    |

Tracking visible to the host in a "Booking Links" management view (table-level, accessible from booking settings).

### Data Model

```typescript
// New table
interface BookingLink {
  id: string;
  tenant_id: string;
  table_id: string;
  created_by: string;
  token: string; // Unique, URL-safe, indexed
  invitee_name: string | null;
  invitee_email: string | null;
  custom_message: string | null;
  expires_at: string | null;
  status: 'created' | 'viewed' | 'booked' | 'expired';
  viewed_at: string | null;
  booked_record_id: string | null;
  created_at: string;
}
```

### Scope: Post-MVP — Portals & Apps (Fast-Follow).

---

## Managed Booking Templates

Workspace Admins/Owners can create standardized booking configurations that are locked and distributed to team members — ensuring consistent meeting experiences across the organization.

### How It Works

1. Admin creates a "Managed Template" in workspace settings → Booking section.
2. Template defines: duration, buffer times, intake fields, branding, confirmation text, reminder schedule, cancellation/rescheduling policy.
3. Admin assigns the template to one or more bookable calendar tables.
4. When assigned, the template's settings override the table's `BookingConfig` for the configured fields. Managers can still customize non-locked fields.
5. Admin can lock individual settings (e.g., lock cancellation policy but allow managers to customize duration).

### Data Model

```typescript
// New table
interface BookingTemplate {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  config: Partial<BookingConfig>; // Subset of BookingConfig fields
  locked_fields: string[]; // Which config keys are locked (non-overridable by Manager)
  assigned_table_ids: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

Admin changes to a template propagate immediately to all assigned tables (template is the source of truth for locked fields; table config stores the effective merged result).

### Scope: Post-MVP — Verticals & Advanced. Requires multi-table booking management UI. Low priority for initial launch.

---

## Scheduling Analytics

Scheduling analytics are powered by the existing chart blocks system (`chart-blocks.md`) using `summary` view type Table View tabs.

### Pre-Built Scheduling Dashboard

When booking is enabled on a table, EveryStack auto-generates a "Booking Analytics" Table View tab (summary view type) with these chart blocks:

| Chart                            | Type          | Data                                                                                                                    |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Bookings This Week**           | `number_card` | Count of records with booking_status in (confirmed, completed) and start_time in current week. Delta vs. previous week. |
| **Bookings by Day of Week**      | `bar`         | Aggregate booking count grouped by day of week over trailing 30 days. Identifies busiest days.                          |
| **Bookings by Time of Day**      | `bar`         | Aggregate booking count grouped by hour over trailing 30 days. Identifies peak hours.                                   |
| **Completion Rate**              | `donut`       | Breakdown: completed vs. cancelled_by_invitee vs. cancelled_by_host vs. no_show over trailing 30 days.                  |
| **Average Lead Time**            | `number_card` | Average hours between booking creation and event start. Trend vs. previous period.                                      |
| **Top Hosts** (round-robin only) | `bar`         | Booking count per team member over trailing 30 days. Identifies distribution balance.                                   |
| **Booking Source**               | `donut`       | Breakdown by booking_source: booking_page, portal, embed, api.                                                          |
| **No-Show Rate**                 | `number_card` | Percentage of bookings marked no_show. Delta vs. previous period. Red accent if above 15%.                              |

All charts use the Table Aggregate data binding mode (Mode A from `chart-blocks.md`). Record-scoped in portals — clients see analytics for their own bookings only.

### Scope: Ships with chart blocks system (Post-MVP — Portals & Apps (Fast-Follow) for basic NumberCard metrics, full dashboard in Post-MVP — Verticals & Advanced with summary view type).

---

## Quick Setup Wizard

**The critical UX piece.** Most SMB users should go from zero to shareable booking link in under 5 minutes.

### Entry Points

- Workspace home: "+ New" menu → "Booking Page"
- Command Bar: `/booking` → "Create Booking Page"
- Calendar-type table settings: "Enable Booking" toggle (skips step 1)
- My Calendar right panel: "Create booking page" link in settings gear

### Wizard Steps (4 steps, ~3 minutes)

**Step 1 — What are you scheduling?**

- Meeting name (e.g., "30-min Consultation", "Strategy Call", "Group Workshop")
- Duration picker: quick-select buttons [15, 30, 45, 60] with custom option
- Type picker: One-on-one (default, radio selected) / Group / Round Robin / With Multiple Hosts
- For round robin / multiple hosts: user picker to add team members

**Step 2 — When are you available?**

- Visual weekly grid (Mon–Sun, scrollable time axis)
- Pre-populated with workspace default working hours (Mon–Fri 9–5)
- Drag to paint available/unavailable blocks (intuitive, similar to Google Calendar's working hours UI)
- Quick toggles: "Copy Monday to all weekdays" / "Include weekends"
- "Different hours for different days" expand toggle (most users skip this)

**Step 3 — Details & Branding**

- Booking page title (pre-filled from step 1)
- Description (optional, placeholder: "Book a time to chat with me about...")
- Location: Auto-detect connected Zoom → default to Zoom. Otherwise: text input for custom location, or "No location" for phone calls
- Payment: "Collect payment at booking?" toggle (off by default). Amount field appears on toggle.
- Logo: auto-pulls workspace logo. Override option.
- Preview pane on right side (live rendering of booking page)

**Step 4 — Your Link**

- Generated URL shown prominently with copy button
- QR code rendered inline (downloadable)
- "Share via" buttons: Copy Link, Email, Embed on Website (shows embed code)
- "Customize further" link → opens full booking settings in table config

### What the Wizard Creates

Behind the scenes, the wizard:

1. Creates a calendar-type table (if not starting from existing table) with appropriate fields.
2. Sets `calendar_table_config` with booking config populated from wizard inputs.
3. Creates `booking_availability` record for the user with the weekly schedule from step 2.
4. Creates an App page in public access mode with the Scheduler block.
5. Generates the booking page slug and URL.
6. Creates a draft automation for confirmation emails (pre-configured, activated automatically).
7. Creates a draft automation for reminders (pre-configured, activated automatically).

The user can customize everything after creation. The wizard just gets them to "working and shareable" as fast as possible.

---

## Automation Integration

### New Triggers

Extending the existing trigger system (currently 16 triggers):

| #   | Trigger                        | Fires When                                | Context                                                                                                      |
| --- | ------------------------------ | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 17  | **Booking Created**            | New booking record created (any source)   | record_id, table_id, invitee_email, invitee_name, host_user_id, booking_source, payment_status, booking_type |
| 18  | **Booking Rescheduled**        | Invitee or host reschedules               | record_id, original_record_id, old_start, new_start, rescheduled_by (invitee \| host)                        |
| 19  | **Booking Cancelled**          | Invitee or host cancels                   | record_id, cancelled_by (invitee \| host), cancellation_reason, refund_status                                |
| 20  | **Booking No-Show**            | Record marked as no-show (manual or auto) | record_id, invitee_email, host_user_id, detection_method (manual \| auto)                                    |
| 21  | **Booking Follow-Up Due**      | Follow-up delay elapsed after event end   | record_id, invitee_email, host_user_id, event_end                                                            |
| 22  | **Booking Approval Requested** | New booking with require_approval = true  | record_id, invitee_email, host_user_id                                                                       |

**Note:** Trigger #10 (Client Portal Action — appointment booked) remains for portal-context bookings. Triggers 17–22 fire for ALL booking sources and provide richer context. Automations can use either.

### New Actions

| #   | Action                 | What It Does                                                                                                               |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 40  | **Send Booking Link**  | Generates a single-use booking link and makes it available as `{{step.booking_link_url}}` for email/SMS templates.         |
| 41  | **Reschedule Booking** | Updates a booking record's time to a new specified datetime. Sends reschedule notification to invitee.                     |
| 42  | **Cancel Booking**     | Sets booking_status to cancelled_by_host. Sends cancellation email with configured reason. Processes refund if applicable. |

### Pre-Built Booking Recipes

| Recipe                          | Trigger                                              | Steps                                                                                                                                                                             | Outcome                                 |
| ------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **New Client Onboarding**       | Booking Created (source = booking_page, new contact) | Create contact record → Link booking to contact → Send welcome email → Create onboarding project → Assign tasks → Provision portal access                                         | Full client setup from a single booking |
| **No-Show Recovery**            | Booking No-Show                                      | Wait 30 min → Send "Sorry we missed you" email with reschedule link → Wait 48h → Send follow-up → Tag contact                                                                     | Automated no-show recovery              |
| **Post-Meeting Follow-Up**      | Booking Follow-Up Due                                | Send thank-you email → Create follow-up task for host → If payment: send invoice                                                                                                  | Post-meeting workflow                   |
| **Booking + Payment → Invoice** | Booking Created (payment = succeeded)                | Create invoice record → Link to contact → Push to accounting (#31) → Send receipt email                                                                                           | Payment reconciliation                  |
| **Approval Queue**              | Booking Approval Requested                           | Notify host (in-app + email) → Wait for Event (booking_status changes) → If approved: send confirmation to invitee. If rejected: send "unfortunately" email with alternative link | Managed approval flow                   |

---

## External Calendar Sync (Post-MVP — Comms & Polish Dependency — Designed Now)

The booking system is designed to consume external calendar data when available. This section specifies the interface contract so the booking system works from Post-MVP — Portals & Apps (Fast-Follow) and improves automatically when Post-MVP — Comms & Polish lands.

### Interface Contract

The calendar feed API already accepts `source_types[]` filter. External events will appear as `source_type: 'external'` with `show_as: 'busy' | 'free'`.

The availability engine's busy block subtraction step already handles any source type — it subtracts anything the feed returns as busy. No booking-system changes are needed when external sync ships.

### What Ships When

| Phase | Calendar Sync Capability                                                    | Booking System Impact                                                                                         |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 4b    | Internal sources only (EveryStack events, tasks, personal events, holidays) | Availability accurate against EveryStack data. Users manually block external commitments via personal events. |
| 7     | One-way pull from Google Calendar + Outlook Calendar (read-only, busy/free) | Availability automatically accounts for external commitments. Zero user action needed.                        |
| 7+    | Bidirectional push (EveryStack bookings appear on external calendars)       | Bookings auto-appear on host's Google/Outlook calendar. Invitees get calendar invites.                        |

### OAuth Scope Requirements (for Post-MVP — Comms & Polish implementation)

**Google:** `https://www.googleapis.com/auth/calendar.readonly` (one-way pull) → `https://www.googleapis.com/auth/calendar.events` (bidirectional). Same OAuth consent screen as Gmail API for email integration (see `email.md`).

**Microsoft:** `Calendars.Read` (one-way pull) → `Calendars.ReadWrite` (bidirectional). Same Azure AD app registration as Outlook Mail for email integration (see `email.md`).

---

## Data Model Additions Summary

### New Tables

| Table                    | Key Columns                                                                                                                                                             | Purpose                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `booking_availability`   | id, user_id, tenant_id, timezone, weekly_schedule (JSONB), date_overrides (JSONB), created_at, updated_at                                                               | Per-user bookable hours schedule                                         |
| `meeting_polls`          | id, tenant_id, created_by, title, proposed_times (JSONB), participant_emails, participant_user_ids, status, selected_time_index, result_record_id, deadline, created_at | Meeting poll definitions                                                 |
| `meeting_poll_responses` | id, poll_id, respondent_email, respondent_user_id, votes (JSONB), suggested_times (JSONB), responded_at                                                                 | Poll votes                                                               |
| `booking_links`          | id, tenant_id, table_id, created_by, token (indexed, unique), invitee_name, invitee_email, status, expires_at, booked_record_id, created_at                             | Single-use trackable booking links                                       |
| `booking_templates`      | id, tenant_id, name, config (JSONB), locked_fields (JSONB), assigned_table_ids (JSONB), created_by, created_at, updated_at                                              | Admin-managed booking config templates (Post-MVP — Verticals & Advanced) |

### Modified Tables

| Table                    | Changes                                                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `calendar_table_config`  | Add all `BookingConfig` columns (booking_enabled through noshow_auto_mark_minutes). Add `booking_hours_override` (JSONB, nullable). |
| `records.canonical_data` | Booking records store `booking_status` and `booking_metadata` in standard JSONB field values — no schema change needed.             |

### New System Fields (Auto-Created on Booking-Enabled Tables)

| Field              | Type              | Purpose                                                                                                                                                   |
| ------------------ | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `booking_status`   | Status (select)   | Lifecycle tracking. Values: confirmed, pending, cancelled_by_invitee, cancelled_by_host, rescheduled, completed, no_show, checked_in. Hidden by default.  |
| `booking_metadata` | Long Text (JSONB) | Invitee contact info, notes, routing form data, payment ID, reschedule history, cancellation reason, source, referrer. Hidden by default. System-managed. |
| `booking_source`   | Select            | How the booking was created: booking_page, portal, embed, api, internal. Hidden by default.                                                               |

---

## Permissions

| Action                          | Owner | Admin | Manager | Team Member  | Viewer | Portal Client               |
| ------------------------------- | ----- | ----- | ------- | ------------ | ------ | --------------------------- |
| Enable/disable booking on table | ✅    | ✅    | ✅      | ❌           | ❌     | ❌                          |
| Configure booking settings      | ✅    | ✅    | ✅      | ❌           | ❌     | ❌                          |
| Edit own availability schedule  | ✅    | ✅    | ✅      | ✅           | ❌     | ❌                          |
| View booking analytics          | ✅    | ✅    | ✅      | Own bookings | ❌     | Own bookings                |
| Cancel/reschedule any booking   | ✅    | ✅    | ✅      | Own bookings | ❌     | Own bookings (self-service) |
| Mark no-show                    | ✅    | ✅    | ✅      | Own bookings | ❌     | ❌                          |
| Create booking templates        | ✅    | ✅    | ❌      | ❌           | ❌     | ❌                          |
| Create meeting polls            | ✅    | ✅    | ✅      | ✅           | ❌     | ❌                          |
| Book via public page            | —     | —     | —       | —            | —      | ✅ (unauthenticated)        |

---

## Phase Implementation Summary

| Phase                                         | Booking Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Post-MVP — Portals & Apps (Calendar View)** | Calendar View architecture (day/week/month grid rendering, event blocks, drag interactions, click-to-create, responsive behavior). No booking functionality — just the view type. Calendar View is post-MVP per GLOSSARY.md:678.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Post-MVP — Portals & Apps (Fast-Follow)**   | **Full booking system.** `booking_availability` table + availability engine + Scheduler block (App Designer) + public booking pages + shareable links + embeddable widget. All 4 booking types (one_on_one, group, round_robin, collective). Buffer time, meeting limits, minimum notice, max advance. Quick Setup Wizard. Booking lifecycle (creation sequence, status system, confirmation emails, reminders). Self-service rescheduling & cancellation. Routing forms. Single-use booking links. Meeting polls. No-show detection (manual + auto). Zoom video integration. Booking automation triggers (#17–22) + actions (#40–42). 5 pre-built recipes. Basic scheduling analytics (NumberCard metrics). |
| **Post-MVP — Comms & Polish**                 | External calendar sync (Google + Outlook one-way pull → bidirectional push). Google Meet + Microsoft Teams video integration (shared OAuth). Availability engine automatically gains external calendar awareness — no booking system changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Post-MVP — Verticals & Advanced**           | Managed booking templates. Full scheduling analytics dashboard (summary view type with 8 chart blocks). Advanced round-robin weighting. Booking page A/B testing.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

> **⚠️ BUILD SEQUENCE NOTE:** The prompts below are a suggested decomposition of this feature into buildable units. They are **not a build plan**. The active phase build doc controls what to build and in what order. When creating a phase build doc, cherry-pick from these prompts and reorder as needed for the sprint's scope.

### Claude Code Prompt Roadmap (10 Prompts)

| Prompt | Scope                                | Output                                                                                                                                                                                                                                                         |
| ------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | **Calendar View rendering**          | CalendarView component (month/week/day), event block rendering, overlap layout algorithm, time axis, responsive breakpoints. CalendarViewConfig in view_config JSONB.                                                                                          |
| 2      | **Calendar View interactions**       | Click-to-create popover, drag-to-reschedule, resize-to-change-duration, date field binding, toolbar controls. Permission checks on drag/resize.                                                                                                                |
| 3      | **Availability engine**              | `booking_availability` table + migration. `BookableHoursSchedule` CRUD. Slot generation algorithm. `GET /api/v1/booking/availability` endpoint. Calendar feed integration for busy blocks. Buffer/limit/notice constraint filtering. Timezone handling.        |
| 4      | **Booking config + bookable tables** | `calendar_table_config` booking columns migration. BookingConfig validation. System field auto-creation (booking_status, booking_metadata, booking_source). Booking type logic (one_on_one, group, round_robin assignment algorithm, collective intersection). |
| 5      | **Scheduler block (App Designer)**   | SchedulerBlock component (calendar/list display modes). 3-step booking flow (select time → details → confirmation). Intake fields. Stripe payment integration. Authenticated vs. public mode. Rate limiting. Turnstile.                                        |
| 6      | **Booking lifecycle**                | Atomic creation sequence (10 steps). Status transitions. Confirmation + reminder email templates (Resend). BullMQ scheduled jobs for reminders + follow-ups + auto-complete + auto-no-show. .ics file generation.                                              |
| 7      | **Public booking pages + links**     | App page in public mode with Scheduler block. URL routing (`/book/{slug}`, `/book/{slug}/{user}`). Short link generation. Embeddable widget (script tag + iframe). Single-use booking links (BookingLink CRUD + token validation + status tracking).           |
| 8      | **Self-service + routing**           | Reschedule flow (tokenized link → new time → record update → notifications). Cancel flow (tokenized link → confirmation → status update → refund). Routing form integration (completion action → booking page routing rules). Routing data pass-through.       |
| 9      | **Meeting polls + no-show**          | `meeting_polls` + `meeting_poll_responses` tables + migrations. Poll creation UI. Voting interface. Response matrix. Schedule from poll. No-show detection (manual + auto BullMQ job). Check-in status.                                                        |
| 10     | **Automation integration + wizard**  | Triggers #17–22 registration in TriggerRegistry. Actions #40–42. 5 pre-built recipes. Quick Setup Wizard (4-step flow → auto-creates table + config + App page + automations). Zoom OAuth + meeting creation.                                                  |

---

## Reconciliation with Existing Docs

| Document                   | Change Required                                                                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app-designer.md`          | Replace "Booking/Scheduling System (Dedicated Spec Session — Build Post-MVP — Portals & Apps (Fast-Follow))" placeholder with: "See `booking-scheduling.md` for full specification." Scheduler block added to block library under "Scheduling" category. |
| `tables-and-views.md`      | Add cross-reference to this doc for Calendar View architecture. Calendar View entry in Available View Types table gains: "Full spec in `booking-scheduling.md` > Calendar View Architecture."                                                            |
| `data-model.md`            | Add `booking_availability`, `meeting_polls`, `meeting_poll_responses`, `booking_links`, `booking_templates` to table list. Add booking columns to `calendar_table_config` description. Note 3 new system fields on booking-enabled tables.               |
| `automations.md`           | Add triggers #17–22, actions #40–42, 5 booking recipes. Update trigger count 16 → 22, action count 39 → 42. Update cross-references header.                                                                                                              |
| `my-office.md`             | Add cross-reference: booking records appear in My Calendar feed as `source_type: 'booking'` (already in the feed spec table).                                                                                                                            |
| _(Phase build doc)_        | When creating a Portals & Apps phase build doc, include the booking system scope from this reference doc.                                                                                                                                                |
| `mobile.md`                | Calendar view mobile spec (month dots, week blocks, day timeline) now cross-references this doc's responsive behavior section for authoritative spec.                                                                                                    |
| `MANIFEST.md`              | Add `booking-scheduling.md` entry to "Created from Strategic Planning Sessions" section. Add to Post-MVP — Portals & Apps reading order.                                                                                                                 |
| `embeddable-extensions.md` | Add cross-reference for embeddable booking widget (follows same embed protocol as Commerce Embed).                                                                                                                                                       |
| `communications.md`        | Add cross-reference: booking confirmation/reminder/cancellation notifications delivered via communications system (notifications channel).                                                                                                               |
| `design-system.md`         | Add cross-reference: booking UI follows responsive breakpoints and design system palette.                                                                                                                                                                |
| `permissions.md`           | Add cross-reference: booking permission matrix (Manager+ configures, Team Member manages own bookings, portal clients book/reschedule/cancel).                                                                                                           |
| `chart-blocks.md`          | Add cross-reference: scheduling analytics dashboard uses `summary` view type with NumberCard metrics and chart blocks.                                                                                                                                   |
| `email.md`                 | Add cross-reference: Post-MVP — Comms & Polish shared OAuth enables Google/Microsoft calendar sync for booking availability engine.                                                                                                                      |

---

## Key Architectural Decisions

1. **Bookings are records, not a separate entity.** No `bookings` table. A booking is a record in a calendar-type table. This means bookings get fields, formulas, cross-links, automations, portal access, and every other platform capability for free.

2. **Availability is computed from the calendar feed, not stored as static rules.** The feed already aggregates all time-based data. The availability engine is a thin layer that generates candidate slots and subtracts feed conflicts. This means availability automatically reflects project task changes, moved meetings, and new personal events — no manual sync.

3. **Round-robin assignment happens at booking time, not page-load time.** Prevents race conditions where two invitees see the same slot and both book it, expecting different hosts.

4. **External calendar sync is an enhancement, not a prerequisite.** The booking system works fully with internal sources from Post-MVP — Portals & Apps (Fast-Follow). External sync adds accuracy without requiring any booking system changes — just a new source_type in the calendar feed.

5. **Public booking pages are App pages in public access mode.** No new rendering infrastructure. Reuses App themes, block rendering, Turnstile protection, and route architecture.

6. **The Quick Setup Wizard is essential, not optional.** The underlying system is powerful but complex. The wizard is how 80% of users will create their first booking page. It ships in the same prompt as the core system, not as a follow-up.

7. **Zoom ships in Post-MVP — Portals & Apps (Fast-Follow); Google Meet and Teams ship in Post-MVP — Comms & Polish.** Zoom has a standalone OAuth flow. Google Meet and Teams share OAuth with calendar sync and email — building one OAuth flow in Post-MVP — Comms & Polish covers all three capabilities.

8. **Meeting polls are separate from the booking page model.** Polls are for finding a time among known participants. Booking pages are for external invitees selecting from the host's availability. Different UX, different data model, but shared calendar UI components.

9. **Managed booking templates are Post-MVP — Verticals & Advanced.** They require multi-table management UI and are primarily useful for larger teams. Solo consultants and small teams — the Post-MVP — Portals & Apps (Fast-Follow) target — don't need them.

10. **No-show auto-detection uses BullMQ delayed jobs, not polling.** Consistent with the existing reminder and follow-up scheduling pattern. One job per booking, fires at the configured time, checks status, and updates if needed.
