# Meetings

> **🔄 Reconciliation: 2026-02-27** — Aligned with GLOSSARY.md (source of truth). Changes: (1) Added post-MVP scope banner — `meetings` table_type not in glossary's canonical table_type list, feature not in MVP Includes, depends on post-MVP Booking/Scheduling; (2) Replaced "Meeting Interface" → "Meeting Views" per glossary naming discipline (❌ "Interface" → ✅ "Table View" / "App"); (3) "Board View" → "Kanban (post-MVP)" per glossary Table View types; (4) Labeled Calendar View as post-MVP per glossary; (5) "portal pages" → "Portal" per glossary MVP Portal definition (single-record); (6) Flagged Live Chat reference as post-MVP; (7) "task board" → "Tasks Quick Panel" for clarity.

> **⚠️ POST-MVP FEATURE.** The `meetings` table_type is not in GLOSSARY.md's canonical table_type list (which defines: table, projects, calendar, documents, wiki). Meetings are not listed in the MVP Scope Summary. This feature depends on post-MVP capabilities including Booking/Scheduling, Calendar View, and video integration. Build clean extension points in the config overlay pattern, but do not build the Meetings feature set until post-MVP phases.

> Meeting system architecture — `meeting_table_config` overlay, scheduling flows (internal chat + external portal), Meeting Views layout, recurring carry-forward, action item lifecycle, audio recording, video integration roadmap.
> Cross-references: `tables-and-views.md` (table_type, Inline Sub-Table Display, default Notes field, RecordCard), `data-model.md` (meeting_table_config schema, field types), `smart-docs.md` (Smart Doc field type, merge fields, template blocks), `cross-linking.md` (action items cross-link, client cross-link, self-referential previous_meeting link), `project-management.md` (pm_table_config overlay pattern, task records), `calendar-table-config` in `data-model.md` (calendar field mapping pattern), `booking-scheduling.md` (external scheduling, booking links, availability), `communications.md` (chat threads, notifications, push), `mobile.md` (mobile meeting experience, Layer 2 action bar, Schedule view), `record-templates.md` (meeting type templates), `approval-workflows.md` (permission-gated scheduling), `mobile-navigation-rewrite.md` (chat scheduling UI)
> Last updated: 2026-02-27 — Glossary reconciliation. See reconciliation note above for changes. Original: 2026-02-21.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section | Lines | Covers |
|---------|-------|--------|
| Overview | 45–57 | Meeting management as table_type config overlay |
| Architecture: Config Overlay Pattern | 58–118 | meeting_table_config overlay, required fields, Smart Doc integration |
| Meeting Smart Doc Templates | 119–125 | Template structure for meeting notes |
| Attendees | 126–128 | Attendee field, people picker, external attendees |
| Agenda | 129–131 | Agenda items, ordering, time allocation |
| Carried Forward from Last Meeting | 132–134 | Auto-carry forward logic for recurring meetings |
| Discussion Notes | 135–137 | Collaborative note-taking during meetings |
| Decisions Made | 138–140 | Decision log, attribution, linking to records |
| Action Items | 141–143 | Action item extraction, task creation, assignment |
| Next Steps | 144–146 | Follow-up tracking, deadline assignment |
| Next Meeting | 147–153 | Recurring meeting scheduling, next occurrence |
| {meeting_date} — Team Standup | 154–171 | Standup meeting template example |
| 1:1: {attendees} | 172–205 | 1:1 meeting template example |
| Scheduling Flows | 206–269 | Meeting creation, calendar integration, availability check |
| Meeting Views Layout | 270–331 | Meeting list, calendar, agenda views |
| Action Item Lifecycle | 332–374 | Creation → assignment → tracking → completion flow |
| Recurring Meetings | 375–428 | Recurrence rules, series management, exception handling |
| Audio Recording | 429–468 | Meeting recording, transcription, AI summary |
| Video Integration Roadmap | 469–539 | Zoom/Meet/Teams integration plan |
| Portal Integration for External Meetings | 540–564 | External attendee access via portals |
| Notification & Reminder System | 565–595 | Meeting reminders, notification timing |
| Phase Integration | 596–619 | Post-MVP delivery timeline |
| Data Model Impact | 620–641 | meeting_table_config, new columns and tables |

---

## Overview

Meetings are a first-class workflow primitive in EveryStack, not just calendar events with notes. A meeting record is the single source of truth for what was scheduled, who attended, what was discussed, what was decided, and what needs to happen next.

The meeting system connects existing EveryStack primitives — records, cross-links, tasks, Smart Docs, chat, calendar, portals — into a purpose-built workflow that replaces the 4-5 tool fragmentation teams experience today (calendar + docs + task manager + email + CRM).

**Two primary use cases:**

1. **External client meetings** — scheduling via portal/email/SMS, client-visible agenda and summary, action items with ownership visibility, portal follow-up
2. **Internal team meetings** — scheduling via chat/DM, recurring templates (standup, 1:1, retro), carry-forward of unresolved items, task extraction

---

## Architecture: Config Overlay Pattern

Same pattern as `pm_table_config` and `calendar_table_config`. A meeting table is a standard table with `table_type: 'meetings'` and a `meeting_table_config` row that maps semantic field roles onto regular fields.

### `meeting_table_config`

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant scope |
| `table_id` | UUID | → tables.id |
| `title_field_id` | UUID | Meeting title (primary field) |
| `meeting_type_field_id` | UUID | Single Select — meeting category (1:1, standup, client check-in, sprint retro, discovery call, etc.) |
| `start_time_field_id` | UUID | Date-Time — scheduled start |
| `end_time_field_id` | UUID | Date-Time — scheduled end |
| `duration_field_id` | UUID | Duration — computed or manual |
| `status_field_id` | UUID | Status — lifecycle state (Scheduled, In Progress, Completed, Cancelled, No-Show) |
| `attendees_field_id` | UUID | People/Assignee — internal attendees |
| `external_attendees_field_id` | UUID (nullable) | Cross-link to clients/contacts table — external attendees. Null for internal-only meeting tables. |
| `agenda_field_id` | UUID | Smart Doc or Checklist — pre-meeting agenda |
| `notes_field_id` | UUID | Smart Doc — meeting notes (living document) |
| `action_items_field_id` | UUID | Cross-link to tasks/PM table — inline sub-table display |
| `recording_field_id` | UUID (nullable) | Attachment — audio/video recording |
| `transcript_field_id` | UUID (nullable) | Smart Doc — AI-generated transcript (Post-MVP — Comms & Polish) |
| `summary_field_id` | UUID (nullable) | Smart Doc — AI-generated summary (Post-MVP — Comms & Polish) |
| `recurrence_field_id` | UUID (nullable) | Recurrence config — for recurring meeting series |
| `previous_meeting_field_id` | UUID (nullable) | Self-referential Linked Record — chain to previous meeting in series |
| `call_link_field_id` | UUID (nullable) | URL — Zoom/Meet/Teams link (MVP — Core UX) or internal room ID (Post-MVP — Documents+) |
| `client_field_id` | UUID (nullable) | Cross-link to clients table — the account this meeting is about |
| `project_field_id` | UUID (nullable) | Cross-link to projects table — the project this meeting is about |
| `location_field_id` | UUID (nullable) | Text or Address — physical location or "Virtual" |
| `notification_config` | JSONB | Default reminder settings: `{ reminders: [15, 60, 1440] }` (minutes before, default: 15min + 1hr) |
| `auto_record` | BOOLEAN | Default false. When true, recording starts automatically when call begins. |
| `portal_visible` | BOOLEAN | Default false. When true, meeting summaries and action items visible in client portal. |
| `carry_forward_enabled` | BOOLEAN | Default true for recurring meetings. Unresolved action items auto-linked to next meeting. |

### Auto-Created Fields on Meeting Table

When a user creates a table with `table_type: 'meetings'`, the following fields are auto-created (same pattern as PM and Calendar auto-fields):

1. **Title** (Text, primary field) — meeting title
2. **Meeting Type** (Single Select) — pre-seeded options: "1:1", "Team Standup", "Client Check-in", "Sprint Retro", "Discovery Call", "Internal", "External". Manager can add/rename.
3. **Start Time** (Date-Time)
4. **End Time** (Date-Time)
5. **Duration** (Duration, formula: End Time - Start Time)
6. **Status** (Status) — Scheduled → In Progress → Completed. Also: Cancelled, No-Show. Mode 1 (Simple Select) by default.
7. **Attendees** (People/Assignee)
8. **Agenda** (Smart Doc) — pre-loaded with meeting type template if applicable
9. **Notes** (Smart Doc) — the living document for during-meeting capture
10. **Action Items** (Linked Record → tasks table, inline sub-table display) — auto-created cross-link to workspace's PM/tasks table if one exists. If not, creates a companion Tasks table.
11. **Recording** (Attachment)
12. **Call Link** (URL)
13. **Location** (Text)
14. **Previous Meeting** (Linked Record, self-referential) — for recurring series chain

Manager can add, remove, rename, reorder, or hide any of these. The config overlay maps to whichever fields exist.

**Progressive field reveal on table creation.** All 14 fields are created in the schema, but the default grid view only shows fields 1–7 (Title through Attendees) and field 9 (Notes) as visible columns. Fields 8 (Agenda), 10–14 (Action Items, Recording, Call Link, Location, Previous Meeting) are created but hidden in the default view. The user sees 8 columns on first load — a complete, uncluttered meeting table. Hidden fields are discoverable via the "Hide Fields" toolbar button, which shows them grouped under a "Meeting — Optional Fields" section. This pattern applies to all specialized table types (meetings, PM, calendar) — auto-create all semantic fields, but only show the essential subset in the default view.

---

## Meeting Smart Doc Templates

Each meeting type can have an associated Smart Doc template that auto-populates the Notes field when a new meeting record is created. Stored via `record_templates` (see `record-templates.md`).

### Example: Client Check-in Template

```
## Attendees
{attendees} | {external_attendees}

## Agenda
{agenda}

## Carried Forward from Last Meeting
{previous_unresolved_items}

## Discussion Notes
[free-form area]

## Decisions Made
[free-form area]

## Action Items
{action_items_widget}

## Next Steps
[free-form area]

## Next Meeting
{next_meeting_date}
```

### Example: Weekly Standup Template

```
## {meeting_date} — Team Standup

### Updates
[Each person's section — can be pre-populated from recent task activity in Post-MVP — Comms & Polish]

### Blockers
[free-form area]

### Announcements
[free-form area]

### Action Items
{action_items_widget}
```

### Example: 1:1 Template

```
## 1:1: {attendees}

### Carried Forward
{previous_unresolved_items}

### Discussion Topics
[free-form area]

### Feedback
[free-form area]

### Action Items
{action_items_widget}

### Personal Notes (Private)
[visible only to the record creator — field-level permission: hidden from other attendees]
```

**Merge fields in templates:**

| Merge Field | Source |
|---|---|
| `{attendees}` | Attendees People field — names, avatars |
| `{external_attendees}` | External Attendees cross-link — names from client/contact records |
| `{agenda}` | Agenda field content (checklist or Smart Doc) |
| `{previous_unresolved_items}` | Action items from `previous_meeting_field_id` where status ≠ Complete. Rendered as a linked checklist. |
| `{action_items_widget}` | Live inline sub-table widget for the Action Items cross-link field |
| `{meeting_date}` | Start Time field, formatted |
| `{next_meeting_date}` | Next occurrence from recurrence config, or blank if not recurring |

Templates applied automatically on meeting creation based on meeting type. On phone, template applied silently (no picker). On tablet/desktop, template selected via the record template picker (see `record-templates.md`).

---

## Scheduling Flows

### Internal Scheduling: Chat-Initiated (Primary)

The most common way internal meetings are created. Happens inside any chat thread — record thread, DM, or group chat.

**Flow:**

1. **User types `/meet` or taps the Schedule Meeting action** in the chat input toolbar
2. **Scheduling bottom sheet / popover appears:**
   - **Title** — pre-filled from chat context (record name if in a record thread, or blank)
   - **Attendees** — pre-filled from chat participants. User can add/remove.
   - **Meeting Type** — dropdown (1:1, standup, client check-in, etc.)
   - **Duration** — 15min, 30min, 45min, 1hr, custom
   - **Time proposal:** System reads attendees' calendar availability (from `calendar_table_config` events) and proposes 3 available time slots in the next 48 hours. User can pick one or choose a custom time.
   - **Location / Call Link** — auto-generated if video integration configured, or manual entry
3. **Meeting proposal posted to chat** as a structured card:
   ```
   ┌─────────────────────────────────────────┐
   │ 📅 Meeting Proposal                      │
   │ Weekly Sync — Project Alpha              │
   │ Thu Feb 22, 2:00 PM – 2:30 PM           │
   │ Attendees: You, Sarah, Mike              │
   │                                          │
   │ [✓ Accept]  [✕ Decline]  [📅 Suggest]   │
   └─────────────────────────────────────────┘
   ```
4. **Attendees respond:**
   - **Accept** — adds to their calendar, updates card with checkmark
   - **Decline** — updates card, notifies organizer
   - **Suggest Alternative** — opens time picker, proposes new time, card updates with counter-proposal
5. **When all (or required) attendees accept:** Meeting record auto-created, cross-linked to the originating record (if from a record thread), attendees populated, agenda seeded from template, calendar events created for all attendees.

**Permission gating for scheduling:**
- Managers+ can always schedule meetings
- Team Members require `can_schedule_meetings: true` on their role (configurable per base or workspace-level). Default: true.
- Viewers cannot schedule meetings.

**Chat scheduling on mobile:** Same flow via `/meet` command or a calendar icon in the chat input bar. Bottom sheet UI for the scheduling form. Time slot proposals shown as tappable cards.

### External Scheduling: Portal + Notifications

External meeting scheduling bridges to the booking system (`booking-scheduling.md`) but with meeting-specific additions.

**Option A — Manager initiates (push):**

1. Manager creates a meeting record with external attendees (cross-linked to client/contact records)
2. System sends notification to external attendees via their preferred channel:
   - **Portal notification** — if client has portal access, meeting appears in their portal with [Accept] [Decline] [Suggest Alternative]
   - **Email** — formatted meeting invitation with one-click response buttons (Accept/Decline/Suggest — tokenized URLs, no login required)
   - **SMS** — brief text with meeting details + response link
   - **Push notification** — if client has portal PWA installed
3. Client responds → meeting record status updates, organizer notified

**Option B — Client initiates (pull):**

Uses the booking system from `booking-scheduling.md`. Client visits booking page → selects meeting type → picks available slot → meeting record auto-created and linked to their client record.

**Option C — Chat-initiated with external participants:**

If the chat thread is a portal client chat thread (see `embeddable-extensions.md` > Live Chat — **post-MVP**), the `/meet` command works the same way. The portal client sees the meeting proposal in their chat thread and can respond.

---

## Meeting Views Layout

The Meeting Views are a purpose-built set of Table Views (workspace-level scope) with tabs designed for the meeting workflow.

### Default View Tabs

| Tab | View Type | Source | Purpose |
|---|---|---|---|
| **Upcoming** | Calendar View (post-MVP; Schedule mode on phone) | Meetings table, filter: status = Scheduled, start_time ≥ now | What's coming up |
| **This Week** | Card View | Meetings table, filter: start_time within current week | Weekly overview |
| **All Meetings** | Table View | Meetings table, no filter | Full archive |
| **Action Items** | Table View or Kanban (post-MVP) | Tasks table, filter: linked to any meeting record | Cross-meeting task tracking |

### Meeting Record Layout (Expand Record / Full-Screen Sheet)

The meeting record view is divided into a main content area and a context panel.

**Desktop / Tablet (≥768px):**

```
┌─────────────────────────────────────────────────────────────────┐
│  Meeting: Weekly Client Check-in — Acme Corp      [✏️] [⋯]     │
│  Status: ● Scheduled  │  Thu Feb 22, 2:00–2:30 PM  │  Virtual  │
├───────────────────────────────────┬─────────────────────────────┤
│  MAIN PANEL                       │  CONTEXT PANEL (360px)      │
│                                   │                             │
│  [Video Area — Post-MVP — Documents+]          │  📋 Agenda                  │
│  When no call active: collapsed   │  □ Q1 review                │
│                                   │  □ Budget approval          │
│  📝 Notes (Smart Doc)             │  ☑ Scope change (done)      │
│  ┌─────────────────────────────┐  │                             │
│  │ ## Discussion Notes         │  │  👥 Attendees               │
│  │ Sarah mentioned the Q1...   │  │  You, Sarah, Bob (Acme)    │
│  │                             │  │                             │
│  │ ## Decisions Made           │  │  📎 Attachments             │
│  │ Approved budget increase... │  │  Q1-report.pdf              │
│  └─────────────────────────────┘  │                             │
│                                   │  🔗 Linked Records          │
│  ✅ Action Items (inline sub-table)│  → Acme Corp (Client)      │
│  ┌─────────────────────────────┐  │  → Project Alpha            │
│  │ 🔍 Search...               │  │                             │
│  │ Task        │ Owner │ Due   │  │  📅 Previous Meeting        │
│  │ Call vendor  │ Sarah │ 2/25 │  │  → Feb 15 Check-in          │
│  │ Send report  │ You   │ 2/23 │  │                             │
│  │ (new row)    │       │      │  │  💬 Chat Thread             │
│  └─────────────────────────────┘  │  [chat messages]            │
│                                   │                             │
│  🎙 Recording                     │                             │
│  [▶ Play] 32:14  │  [Transcript]  │                             │
└───────────────────────────────────┴─────────────────────────────┘
```

**Main panel** (left, scrollable): The working area. Notes Smart Doc takes primary real estate — this is where the user types during the meeting. Action items inline sub-table below notes. Recording player below that.

**Context panel** (right, 360px): Reference information. Agenda, attendees, attachments, linked records (client, project), previous meeting link, chat thread. Collapsible to icon strip (same pattern as three-zone layout in `tables-and-views.md`).

**Phone (<768px):** Stacked full-screen sheet. Header shows title + status + time. Scrollable single column: Agenda → Notes → Action Items → Recording → Linked Records → Chat. Layer 2 action bar shows: Chat, Command Bar, and field-type-driven actions (Call if phone field on linked client, Navigate if address field, Camera for attachment).

**During an active call (Post-MVP — Documents+):** Video area expands in the main panel top section. Notes area remains below — user can type notes while on the call. Context panel stays visible on desktop. On mobile: video takes top half, notes bottom half with swipe to toggle.

---

## Action Item Lifecycle

Action items are the most important output of any meeting. The flow from "mentioned in conversation" to "tracked task" must be frictionless.

### Inline Creation (MVP — Core UX)

The Action Items field renders as an inline sub-table (see `tables-and-views.md` > Inline Sub-Table Display) with the compact 5-row widget. The target table is the workspace's PM/tasks table.

**During-meeting workflow:**
1. Something actionable comes up in discussion
2. User clicks into the action items creation row at the bottom of the inline sub-table
3. Types: task title, tabs to assignee (picks from attendees), tabs to due date
4. Record created in the tasks table, cross-linked back to this meeting record
5. The task now appears in the assignee's Tasks Quick Panel, in My Office, and in the meeting record

**Fields shown in the inline sub-table** (from `card_fields` on the cross-link):
- Title, Assignee, Due Date, Status, Priority

### Carry-Forward for Recurring Meetings

When `carry_forward_enabled: true` and a new meeting is created in a recurring series:

1. System queries the previous meeting's action items (via `previous_meeting_field_id` → action_items cross-link)
2. Items where `status ≠ Complete` are automatically linked to the new meeting's action items field
3. The Smart Doc template merge field `{previous_unresolved_items}` renders these as a checklist in the notes
4. In the meeting, the team reviews carried-forward items first — check off resolved ones, discuss blocked ones

**No duplication.** Carried-forward items are the same task records, now linked to both the old meeting and the new meeting. The task's cross-link field shows both meetings in its history. Complete the task from either meeting's inline sub-table — it updates everywhere.

### AI-Assisted Extraction (Post-MVP — Comms & Polish)

After a meeting with a recording and transcript:

1. AI scans the transcript for action-like language ("we need to...", "can you...", "[name] will...", "by Friday...")
2. Proposes a list of extracted action items with: suggested title, inferred assignee (from speaker identification), inferred due date
3. User reviews in a confirmation panel: checkboxes to accept/reject each item, inline editing
4. Accepted items → created as task records, cross-linked to meeting
5. Rejected items → discarded

This is a convenience layer on top of the manual inline creation. The MVP — Core UX structure supports it without changes.

---

## Recurring Meetings

### Series Model

A recurring meeting series is defined by a `recurrence_field` on the meeting record (same recurrence model as calendar events in `booking-scheduling.md`):

```jsonb
{
  "pattern": "weekly",           // daily, weekly, biweekly, monthly, custom
  "day_of_week": [1, 3],         // Monday, Wednesday (for weekly)
  "time": "14:00",
  "duration_minutes": 30,
  "timezone": "America/New_York",
  "series_id": "uuid",           // Groups all meetings in the series
  "occurrence_index": 12,        // This is the 12th occurrence
  "end_condition": {
    "type": "count",             // count, date, or never
    "value": 52                  // 52 occurrences (1 year of weekly)
  }
}
```

### Meeting Chain via Self-Referential Link

Each meeting in a series links to its predecessor via `previous_meeting_field_id`. This creates a traversable chain:

```
Meeting #12 (this week)
  → previous: Meeting #11 (last week)
    → previous: Meeting #10 (two weeks ago)
      → ...
```

Navigating backward through the chain gives full meeting history. The Smart Doc `{previous_unresolved_items}` merge field reads from the immediate predecessor, but a "View Series History" action can display the full chain.

### Auto-Creation of Next Occurrence

When a recurring meeting's status changes to "Completed":

1. System checks recurrence config
2. If next occurrence doesn't exist yet, creates it:
   - Title: same (or with date appended)
   - Attendees: copied from current meeting
   - Meeting Type: same
   - Agenda: seeded from meeting type template
   - Previous Meeting: linked to the just-completed meeting
   - Start/End Time: computed from recurrence pattern
   - Carry-forward items: unresolved tasks from current meeting auto-linked
3. Attendees notified via their preferred channel

Auto-creation happens on meeting completion, not on a schedule. This prevents orphaned future meetings if the series is cancelled.

---

## Audio Recording

### MVP — Core UX: Manual Recording (No Video)

Before embedded video (Post-MVP — Documents+), audio recording is available as a standalone feature for in-person meetings or meetings held on external video platforms.

**Recording flow:**
1. User opens the meeting record during/after the meeting
2. Taps "Record" button (microphone icon) in the recording section or Layer 2 action bar on mobile
3. Browser's MediaRecorder API captures microphone audio
4. Audio streamed to the server in chunks (WebSocket or chunked upload) for resilience — no data lost if browser crashes
5. On stop: final audio file assembled server-side, stored as Attachment on `recording_field_id`
6. Recording appears in the meeting record with playback controls

**Audio format:** WebM/Opus (native browser format, small file size, good quality). Server-side conversion to MP3 available for download/portability.

**Storage:** Counted against the workspace's file storage quota. Typical 30-minute meeting ≈ 5-10 MB (Opus) or 15-30 MB (MP3).

**Mobile recording:** Layer 2 action bar shows microphone icon when on a meeting record. Tap to start/stop. Recording continues when phone is locked (via MediaRecorder background audio session). Amber recording indicator in status bar.

### Post-MVP — Documents+: Integrated Recording via Video SDK

When embedded video is active (Daily.co / LiveKit), recording is handled server-side by the video SDK — no client-side recording needed. Higher quality, captures all participants, includes video if desired.

Recording webhook → download → store as Attachment → same playback UX.

### Post-MVP — Comms & Polish: Transcription + AI Summary

1. Recording completed → audio sent to transcription service (Whisper API or Deepgram)
2. Transcript with speaker diarization (who said what) → stored in `transcript_field_id` Smart Doc
3. AI summary pipeline:
   - Identifies key discussion topics
   - Extracts decisions made
   - Proposes action items (see AI-Assisted Extraction above)
   - Generates a concise summary paragraph
4. Summary → stored in `summary_field_id` Smart Doc
5. If `portal_visible: true`, summary and action items become visible to external attendees in their portal

---

## Video Integration Roadmap

### MVP — Core UX: External Video Links (No Integration)

Meeting records have a `call_link_field_id` (URL field). User manually pastes Zoom/Meet/Teams link. "Join Call" button on the meeting record opens the link in a new tab. No deeper integration.

### Post-MVP — Documents: Embedded Video via SDK

**Recommended provider:** Daily.co (React SDK, server-side recording, up to 200 participants, screen sharing, noise suppression).

**Integration scope:**

| EveryStack Builds | SDK Provides |
|---|---|
| "Start Call" button → creates Daily room via API | Video/audio transmission, WebRTC |
| Room URL stored on meeting record `call_link_field_id` | Screen sharing (browser native picker) |
| `<DailyProvider>` React component embedded in meeting main panel | Server-side recording |
| Attendee auth — pass EveryStack user JWT to Daily for participant identity | Echo cancellation, noise suppression |
| Recording webhook handler → download → store as Attachment | Bandwidth adaptation, quality management |
| UI layout — video panel + notes panel side-by-side | Participant grid layout (speaker view, gallery) |
| Permission gating — who can start/join/record calls | Connection quality indicators |
| External guest access — time-limited token URL for portal clients | Guest participant support |

**Call controls embedded in meeting record:**
- Mute/unmute microphone
- Camera on/off
- Screen share
- Start/stop recording
- Leave call
- Participant list with mute controls (for organizer)

**Desktop layout during call:** Video in main panel top section (resizable). Notes Smart Doc below — user types notes during the call. Context panel shows agenda, attendees, linked records.

**Mobile layout during call:** Full-width video top half. Bottom half scrollable: notes field focused for typing. Swipe down to minimize video to picture-in-picture (PiP) and see full meeting record. Layer 2 action bar: mute, camera, share, record.

**External participant (portal client) experience:**
1. Client receives meeting link via portal notification / email / SMS
2. Clicks link → opens in browser (no download, no account needed)
3. Enters name → joins call
4. Sees: video grid + chat thread. Does NOT see: notes, action items, internal linked records
5. After meeting: client sees summary and their action items in portal (if `portal_visible: true`)

**Cost model:**

| Plan | Included Video Minutes/Month | Overage |
|---|---|---|
| Starter | Not included (external link only) | — |
| Professional | 2,000 participant-minutes | $0.01/min/participant |
| Business | 10,000 participant-minutes | $0.008/min/participant |
| Enterprise | 25,000 participant-minutes | $0.005/min/participant |

*Participant-minutes = number of participants × duration. A 30-minute meeting with 4 people = 120 participant-minutes.*

**Typical monthly cost at Daily's rates (~$0.004/min/participant):**

| Usage Pattern | Participant-Minutes | Daily Cost to EveryStack | Revenue at $0.01/min |
|---|---|---|---|
| Small team, 5 meetings/week, 30min, 4 people | 2,400/mo | ~$10/mo | $24/mo |
| Medium team, 15 meetings/week, 45min, 5 people | 13,500/mo | ~$54/mo | $135/mo |
| Heavy usage, 30 meetings/week, 60min, 6 people | 43,200/mo | ~$173/mo | $432/mo |

Margins are healthy. Include enough in each plan tier that most users never hit overage.

### Post-MVP — Comms & Polish: AI-Enhanced Video

- Real-time transcription overlay during call (speaker-attributed captions)
- Live action item detection — AI highlights "sounds like an action item" in the transcript sidebar during the call, user taps to confirm
- Post-call: full pipeline (transcription → summary → action items → carry-forward)

---

## Portal Integration for External Meetings

When `portal_visible: true` on a meeting table config, external attendees see meeting information in their client portal.

### What the Client Sees in Their Portal

| Meeting State | Portal Visibility |
|---|---|
| **Scheduled** | Meeting title, date/time, attendees, agenda, location/call link, [Accept] [Decline] [Suggest] buttons |
| **In Progress** | "Meeting in progress" indicator. Join Call button if video enabled. |
| **Completed** | Meeting title, date/time, attendees, summary (if generated), action items assigned to the client |
| **Action items** | Items where the client is the assignee. Status visible. Client can mark items complete from the portal. |

### What the Client Does NOT See

- Internal notes (unless specifically shared via field-level portal permissions)
- Internal action items assigned to team members
- Private notes sections (1:1 template "Personal Notes")
- Recording / transcript (unless Manager enables in portal config)
- Linked internal records (projects, other clients)

The portal view is a curated subset of the meeting record, controlled by the same field-level permissions as all Portal configurations (see `portals.md`).

---

## Notification & Reminder System

Meeting notifications use the existing notification routing from `mobile.md` > Notification Routing.

### Notification Events

| Event | Recipients | Channels | Tier |
|---|---|---|---|
| Meeting scheduled | All attendees | In-app, push, email | Standard |
| Meeting reminder (15min, 1hr — configurable) | All attendees | In-app, push | Standard |
| Meeting starting now | All attendees | In-app, push | High |
| Meeting cancelled | All attendees | In-app, push, email | Standard |
| Meeting rescheduled | All attendees | In-app, push, email | Standard |
| Meeting proposal (chat) | Proposed attendees | In-app (chat card) | Standard |
| Meeting proposal response | Organizer | In-app (chat card update) | Standard |
| Action item assigned | Assignee | In-app, push | Standard |
| Action item due soon (1 day before) | Assignee | In-app, push | Standard |
| Summary available | All attendees + portal clients (if portal_visible) | In-app, push, email (portal), SMS (portal) | Standard |

### External Attendee Notifications

External attendees (portal clients) receive meeting notifications through their configured portal notification channels:
- Portal in-app notification
- Email (via Resend)
- SMS (via Twilio, Business+ plans)
- Push notification (if portal PWA installed)

The meeting invitation email includes: meeting title, date/time (in client's timezone), attendees, agenda preview, and one-click response buttons (Accept / Decline / Suggest Alternative) via tokenized URLs.

---

## Phase Integration

| Phase | Meeting Capabilities |
|---|---|
| **Post-MVP — Portals & Apps (Meetings Foundation)** | `meeting_table_config` overlay. Auto-created fields. Meeting type templates (Smart Doc). Recurring series with self-referential chain. Action items inline sub-table. Carry-forward of unresolved items. Chat-initiated scheduling (`/meet` command). External scheduling via portal + notifications. Calendar View with Schedule mode. Audio recording (browser MediaRecorder). Agenda field. Manual call link (URL). |
| **Post-MVP — Documents** | Embedded video via Daily.co/LiveKit SDK. Server-side recording. Screen sharing. In-call notes + action items panel. External guest access via token URL. Video minute metering per plan tier. |
| **Post-MVP — Comms & Polish** | AI transcription (Whisper/Deepgram). Speaker diarization. AI summary generation. AI action item extraction with review UI. Real-time transcription overlay during calls. Voice recording → notes field transcription. AI topic grouping for long meetings. |

### Meetings Foundation Build Scope (Post-MVP)

The foundation meeting system is fully functional without video or AI:

1. **Schema:** `meeting_table_config` table, auto-field creation on `table_type: 'meetings'`
2. **Templates:** 3 built-in Smart Doc templates (Client Check-in, Standup, 1:1). Manager can create custom templates.
3. **Scheduling:** `/meet` command in chat with availability checking, proposal cards, accept/decline/suggest. External scheduling via portal and email.
4. **Recurring:** Recurrence config, auto-creation of next occurrence on completion, carry-forward of unresolved action items.
5. **Recording:** Browser-based audio recording, chunked upload, playback in meeting record.
6. **Calendar:** Schedule view as default on phone. Persistent "+" for new meetings.
7. **Portal:** Meeting visibility for external attendees. Accept/decline from portal. Action item visibility.

This gives teams a complete meeting workflow — scheduling through follow-up — without video or AI. Video and AI are additive layers that enhance the existing structure.

---

## Data Model Impact

### New Table

| Table | Columns | Purpose |
|---|---|---|
| `meeting_table_config` | See schema above | Maps meeting semantic fields to table fields. Config overlay pattern. |

### Modified Tables

| Table | Change |
|---|---|
| `tables` | `table_type` enum gains `'meetings'` value |
| `records` | No change — meeting records are standard records |
| `record_templates` | Meeting type templates stored here (no change to schema) |

### New `table_type` Value

`'meetings'` joins existing types: `'table'`, `'projects'`, `'calendar'`, `'documents'`, `'wiki'`.

Table creation type picker updated: Table, Projects, Calendar, **Meetings**, Documents, Wiki.

