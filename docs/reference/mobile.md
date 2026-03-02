# Mobile Architecture

> **Reconciliation Note (2026-02-27):** Aligned with GLOSSARY.md (source of truth).
> Changes: Renamed "Interface"/"Interfaces" → "Table View"/"Table Views" throughout.
> Renamed "Interface Designer" → "App Designer". Renamed "Portal designers" → "App Designer".
> Renamed "Smart Doc" → "Document Template"/"Document". Renamed "Communications Hub" → "Record Thread and Chat".
> Tagged post-MVP features per glossary MVP scope summary: Kanban View, Calendar View, Map View,
> full Mobile Chat & Messaging, Voice Input, Maps & Geolocation, AI Personalization, Mobile Payments,
> Camera/Scanning/OCR, In-App Support. Updated IndexedDB paths and deep link URL pattern to use
> viewId instead of interfaceId. Updated cross-references to match renamed concepts.

> Device tier strategy, primary mobile surfaces by user type, mobile chat & messaging, mobile view types (card/kanban/calendar/forms), portal mobile PWA, camera/scanning/OCR, maps & geolocation, voice input, mobile input optimization, ergonomic design (thumb zone, one-handed use), AI personalization, mobile payments, offline architecture, notification routing, deep linking, performance budgets, service worker caching, Capacitor decision framework, biometric auth readiness, and mobile testing.
> Cross-references: `inventory-capabilities.md` (Barcode field type — mobile scan target, Quick Entry mobile UX, scan-to-find-record), `tables-and-views.md` (Quick Entry interface mode), `data-model.md` (Barcode field type #41), `custom-apps.md` (Capacitor native shell for Stripe Terminal Tap to Pay, kiosk mode fullscreen, app PWA offline tiers, NFC payment via Capacitor plugin), `approval-workflows.md` (swipe-right-to-approve on approval card — consistent with "swipe right = primary action" pattern; bottom sheet for precondition panel and submission confirmation; approval notification tiers with actionable push; "Review & Approve" deep-link on mobile push; approval queue accessible via More → My Approvals), `chart-blocks.md` (responsive chart rendering — 4→2→1 column collapse, touch interaction behaviors, mobile chart sizing constraints), `booking-scheduling.md` (Calendar View mobile responsive spec — month dots, week blocks, day timeline, touch gestures), `record-templates.md` (new record creation applies default template silently on mobile — no template picker; template selection on Board/Calendar creation; mobile bottom sheet UX for template list on tablet+ only)
> Cross-references (cont.): `workspace-map.md` (phone renders simplified list view instead of canvas — graph too dense for phone-width; tablet renders full canvas with bottom sheet detail panel and 48px touch targets; minimap hidden by default on tablet <1024px), `field-groups.md` (mobile: group headers hidden — horizontal space too constrained; swipe-between-group navigation enabled when field groups exist — **swipe conflict resolution: when field groups exist, horizontal swipe navigates between groups and record-to-record navigation uses prev/next arrows in header instead**; hide/show panel renders as full-screen bottom sheet with long-press 200ms drag initiation; emphasis controls ★/● always visible on touch devices not hover-dependent; tablet: full group header row rendered same as desktop, 320px panel overlay with scrim; **mobile record scroll mitigation: when record has >15 fields and field groups configured, all groups except first auto-collapsed on open**)
> Last updated: 2026-02-27 — Glossary reconciliation: renamed Interface→Table View, Interface Designer→App Designer, Smart Doc→Document Template, Communications Hub→Record Thread/Chat. Tagged post-MVP features. Prior: Added `field-groups.md` cross-reference.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                                                                           | Lines     | Covers                                                                |
| --------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------- |
| Core Principle                                                                    | 58–67     | Desktop = Build, Tablet = Build & Operate, Mobile = Operate & Consume |
| Device Tiers                                                                      | 68–99     | Phone/tablet/desktop breakpoints and capability tiers                 |
| Mobile Navigation Model                                                           | 100–115   | Bottom tab bar, contextual tab swapping, navigation stack             |
| Capability Gating                                                                 | 116–140   | Feature availability by device tier                                   |
| Primary Mobile Surfaces                                                           | 141–191   | My Office, workspace views, Record View, Quick Panels on mobile       |
| Mobile Chat & Messaging _(Post-MVP — MVP includes basic Record Thread tabs only)_ | 192–275   | Chat bubbles, input bar, threading on mobile                          |
| Mobile View Types                                                                 | 276–384   | Card (primary), Kanban, Calendar, Form — mobile adaptations           |
| Portal Mobile PWA (Paid Tiers)                                                    | 385–439   | PWA portal experience, mobile-first portal rendering                  |
| Offline Architecture                                                              | 440–529   | Service worker caching, optimistic writes, sync queue                 |
| Notification Routing                                                              | 530–607   | Push notification delivery, badge counts, deep link targets           |
| Deep Linking                                                                      | 608–641   | URL scheme, universal links, deep link routing                        |
| Camera, Scanning & OCR _(Post-MVP — Portals & Apps)_                              | 642–693   | Barcode scanning, document capture, OCR pipeline                      |
| Maps & Geolocation _(Post-MVP)_                                                   | 694–723   | Location field, map view, geofencing                                  |
| Voice Input & Dictation _(Post-MVP)_                                              | 724–738   | Voice-to-text, speech recognition                                     |
| Mobile Input Optimization                                                         | 739–779   | Keyboard types, input modes, autocomplete attributes                  |
| Ergonomic Design Constraints                                                      | 780–822   | Thumb zones, one-handed use, touch targets                            |
| AI Personalization _(Post-MVP)_                                                   | 823–853   | AI-powered mobile suggestions                                         |
| Mobile Payments _(Post-MVP)_                                                      | 854–875   | Tap to Pay, Stripe Terminal mobile                                    |
| In-App Support _(Post-MVP)_                                                       | 876–900   | Help widget, contextual help                                          |
| Additional Mobile Capabilities                                                    | 901–970   | Haptics, share sheet, clipboard, biometrics                           |
| PWA Capabilities                                                                  | 971–995   | Manifest, install prompt, standalone mode                             |
| Service Worker Caching                                                            | 996–1042  | Cache strategies, offline fallback, background sync                   |
| Performance Budgets                                                               | 1043–1059 | Bundle size, FCP, TTI, LCP targets                                    |
| Biometric Auth Readiness                                                          | 1060–1079 | Face ID / fingerprint unlock for portal sessions                      |
| Capacitor Decision Framework                                                      | 1080–1104 | When to use Capacitor vs PWA                                          |
| Mobile Navigation                                                                 | 1105–1128 | Navigation architecture and transitions                               |
| Mobile Testing Strategy                                                           | 1129–1199 | Device matrix, viewport testing, touch simulation                     |
| Phase Implementation                                                              | 1200–1213 | Mobile milestones per phase                                           |
| Cross-References                                                                  | 1214–1231 | Links to related docs                                                 |

---

## Core Principle

**Desktop = Build. Tablet = Build & Operate. Mobile = Operate.**

Three interaction paradigms, same data, same capabilities — different surfaces. The primary mobile users are **team members working in Table Views** and **portal clients on their phones**, not admins building automations. Mobile is where EveryStack's value is consumed. Desktop is where it's configured.

**Tech:** Progressive Web App (PWA) as primary mobile experience. Branded portal PWAs for paid tiers. Capacitor wrapping for app store distribution when PWA limitations become blocking.

---

## Device Tiers

Three behavioral tiers — not just breakpoints. Each tier defines what the user _can do_, not just how the layout responds.

|                    | Phone (<768px)                                                               | Tablet (768–1439px)                          | Desktop (≥1440px)     |
| ------------------ | ---------------------------------------------------------------------------- | -------------------------------------------- | --------------------- |
| **Paradigm**       | Operate & consume                                                            | Build & operate                              | Build                 |
| **Grid view**      | Record View in compact list layout (see RecordCard in `tables-and-views.md`) | Full grid, inline editing, touch-optimized   | Full spreadsheet grid |
| **Record editing** | Full-screen sheet                                                            | Side panel or modal                          | Inline or side panel  |
| **Right panel**    | Full-screen bottom sheet                                                     | 360px overlay with scrim                     | 360px side-by-side    |
| **Sidebar**        | Hidden, hamburger drawer (280px)                                             | 64px collapsed, icons only                   | 240px expanded        |
| **Bottom bar**     | 56px fixed, contextual two-layer (see Mobile Navigation Model)               | Hidden                                       | Hidden                |
| **Builder tools**  | Not available — blocked with "Open on tablet or desktop"                     | Full feature set with touch-optimized chrome | Full builders         |
| **Drag-and-drop**  | Tap-based reordering                                                         | Touch drag (dnd-kit touch sensor)            | Mouse drag (dnd-kit)  |
| **Offline depth**  | Full Table View working set                                                  | Full Table View working set                  | Recently viewed only  |
| **Split view**     | Never                                                                        | Side-by-side for record + chat               | Side-by-side default  |

**Phone is the only capability-restricted tier.** Everything ≥768px gets the full feature set. Structural configuration (field creation, permission setup, cross-link creation, approval workflow rules, automation/portal builders) is blocked on phone with a prompt: "Open on tablet or desktop." See Capability Gating section.

### Tablet as Small Computer

Tablets are **not wide phones**. Tablet users get the computer-class feature set with touch-optimized chrome:

- **Inline grid editing** — tap cell to edit, same as desktop but with larger touch targets (44px min)
- **Side-by-side panels** — record view + chat panel simultaneously, not stacked
- **Toolbar** — condensed to icons + overflow, but not collapsed to a single "…" button
- **Keyboard shortcuts** — supported when external keyboard attached (detected via `navigator.keyboard` or media query `hover: hover`)
- **Multi-select** — long press to enter selection mode, then tap to add (replaces shift-click)
- **Builder tools** — full feature set with touch-optimized chrome. Automation canvas with touch drag, App Designer with pinch-zoom canvas. Same capabilities as desktop.

---

## Mobile Navigation Model

The mobile bottom bar adapts to context. Two layers replace the previous fixed 5-tab nav + FAB pattern. Full specification in `mobile-navigation-rewrite.md`.

**Layer 1 — Navigation Bar (top-level screens):** My Office, Chat, Calendar, Workspaces, More. 56px fixed, 5 icon+label items. Visible when browsing, not inside a record.

**Layer 2 — Contextual Action Bar (inside a record):** Chat (record thread), Command Bar, + field-type-driven actions auto-populated from record schema (camera if attachment field exists, scanner if barcode field exists, call/SMS if phone field exists, navigate if address field exists, etc.). Max 5 items (2 fixed + up to 3 dynamic).

**Transition:** Tap into a record → bottom bar morphs from Layer 1 to Layer 2. Back out → morphs back. No FAB anywhere.

**Record creation:** "+" button in toolbar/header. Default template applied silently on phone — no template picker.

**View switcher on phone:** Always dropdown mode. Current view name + chevron as first toolbar item. Tap opens bottom sheet with grouped list.

---

## Capability Gating

Phone (<768px) is the only capability-restricted tier.

**Phone: Blocked with "Open on tablet or desktop" prompt:**

- Create / delete fields, tables, bases
- Field type configuration (validation rules, select options, formula editing)
- Cross-link creation and structural modification
- Convert to Native Table
- Permission configuration (role grid, individual overrides)
- Automation builders
- App Designer
- Field group creation and color configuration
- Approval workflow transition rule setup

**Phone: Allowed (light config):**

- Rename fields, tables, views
- Toggle existing settings (ownership field on/off, view sharing)
- Reorder tabs, sections, fields within existing structures
- Edit Table View base filters, field visibility

**Claude Code decision rule:** `if (viewport < 768) → check if structural action → block with prompt`.

---

## Primary Mobile Surfaces

Organized by user type — the people who actually use EveryStack on their phones.

### Team Member in Table View (Primary Mobile User)

Team members see Table Views, not raw tables. On mobile, their world is:

| Surface              | Phone                                                                                                                            | Tablet                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Table View list**  | Full-screen list with search/filter                                                                                              | Sidebar list + content                                                    |
| **Card view**        | Record View in compact list layout. Tap → full-screen record.                                                                    | Grid or card view, user choice                                            |
| **Record view**      | Full-screen sheet. Single-column field layout. Field group swipe navigation.                                                     | Modal (90% width) or side panel. Two-column fields.                       |
| **Tasks**            | My Office dashboard: personal tasks + PM assignments (MVP — Core UX). Unified "Assigned to Me" feed (Post-MVP — Comms & Polish). | Tasks panel accessible from sidebar                                       |
| **Quick actions**    | Swipe right = complete/approve. Swipe left = archive/reject. Long press = context menu.                                          | Same swipe gestures, also right-click context menu with external keyboard |
| **New record**       | "+" button in toolbar/header. Default template applied silently, no picker.                                                      | Toolbar button                                                            |
| **Status updates**   | Tap status badge → bottom action sheet with options                                                                              | Inline dropdown                                                           |
| **File attachments** | Camera/files via Layer 2 contextual action bar (auto-populated from record field types)                                          | Same                                                                      |
| **Chat in context**  | Tap chat icon in Layer 2 action bar → full-screen thread (see Mobile Chat & Messaging)                                           | Side panel, simultaneous with record                                      |

**Progressive disclosure on mobile:**

- **Level 1 (default):** The card view shows 3–5 key fields per record. Tap to expand. All common actions (status change, assignment, comment) are one tap away.
- **Level 2:** Full record view with all fields, activity tab, linked records.
- **Level 3:** Not available on phone. Formula editing, field configuration, advanced filters require tablet or desktop.

### Portal Client on Mobile (Primary External User)

Portal clients are overwhelmingly on phones — they receive a link via email/SMS and tap through. The portal mobile experience must be **instant, branded, and frictionless**.

| Surface                  | Phone                                                                                                                    | Tablet               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| **Portal landing**       | Full-screen, portal-branded (theme colors, logo, favicon).                                                               | Same, wider layout   |
| **Data list**            | Card layout, scoped to client's `data_scope`                                                                             | Card or table layout |
| **Record detail**        | Full-screen sheet                                                                                                        | Modal                |
| **Form submission**      | Full-screen form. One field visible at a time on very small screens. Large touch targets. Submit button fixed at bottom. | Standard form layout |
| **Form drafts**          | Auto-saved to IndexedDB. "You have an unsaved draft" banner on return.                                                   | Same                 |
| **Magic link login**     | Email input → "Check your email" → tap link → session cookie set → redirected to portal                                  | Same                 |
| **Offline (paid tiers)** | Read-only view of last-loaded scoped data. Form drafts preserved. Queued submissions sync on reconnect.                  | Same                 |

### Manager / Admin Operating on Mobile

Managers _can_ use mobile but it's not their primary surface. Mobile gives them:

- Approve/reject workflows (notification → tap → action)
- Monitor sync status and error counts
- Quick record edits
- Chat and communication
- **Not available on phone:** Builder tools (automation canvas, App Designer, field configuration, view creation). These require tablet or desktop.

---

## Mobile Chat & Messaging _(Post-MVP — MVP includes basic Record Thread tabs only)_

Chat is a **primary experience** on mobile, not a panel you open from a record. Team members and portal clients live in chat. The Chat item in the Layer 1 navigation bar is a complete messaging app.

### Threading Model: Flat + AI Topic Grouping

All threads are **flat chronological streams** (WhatsApp-style), not branching (Slack-style). Reply to a specific message via swipe-right → quoted reply block above your message. No sub-threads, no extra navigation layers.

**AI topic grouping:** When a record thread exceeds ~20 messages, the AI (`fast` tier, platform cost — no user credits charged) identifies topic clusters and inserts subtle dividers: "— pricing discussion —" / "— timeline —". Users can tap a divider to jump between topics. This gives readability without navigation complexity. Topic grouping runs in the background and updates asynchronously — it never blocks message delivery or display.

### Chat Surfaces

#### Phone

| Surface                           | Layout                                                                                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chat tab (inbox)**              | Full-screen list. Reverse chronological. Each row: avatar, thread name (record/person/group), last message preview, timestamp, unread count, scope icon. Pull to refresh. Unread threads pinned to top. Swipe right → mark read. Swipe left → mute. |
| **Thread view**                   | Full-screen. Messages bottom-aligned (newest at bottom). Input bar fixed at bottom. Input bar repositions above keyboard.                                                                                                                           |
| **Record context banner**         | 48px bar at top of record threads. Tap → navigate to record. Shows: record title, status badge, table icon.                                                                                                                                         |
| **Chat from record**              | Tap chat icon on record → full-screen thread (not a half-height sheet — chat needs full screen for typing). Back gesture returns to record.                                                                                                         |
| **Quick reply from notification** | Push notification with inline reply field (iOS/Android native). Type and send without opening the app.                                                                                                                                              |

#### Tablet

| Surface              | Layout                                                                          |
| -------------------- | ------------------------------------------------------------------------------- |
| **Chat tab**         | Two-pane: thread list (320px left) + active thread (right). Like iPad Messages. |
| **Chat from record** | Side panel (360px). Record and chat visible simultaneously.                     |
| **Compose**          | Inline in right pane, not a modal.                                              |

### Chat Input Bar

The input bar is where speed lives. It must be **thumb-zone positioned** (bottom of screen) and **fast**.

| Feature           | Behavior                                                                                                                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Text input**    | Auto-growing field (1 → max 4 lines before scroll). Send on tap of send button — Enter = newline on mobile.                                                                                                                                                     |
| **@mentions**     | Type `@` → bottom sheet with team member list, searchable. Tap to insert. Mentioned user gets Action Required notification.                                                                                                                                     |
| **Quick photo**   | Camera icon → native camera → photo sent immediately as message attachment with optional caption. No separate upload flow.                                                                                                                                      |
| **Attachments**   | Paperclip → file picker (gallery, files, cloud). Drag-and-drop on tablet.                                                                                                                                                                                       |
| **Voice message** | Hold mic icon → record → release to review. Waveform preview with play-before-send and cancel. Release-to-send option in preferences. Transcription via AI (`fast` tier, uses AI credits). Transcription stored alongside audio for search indexing (tsvector). |
| **Emoji**         | Emoji button → system emoji picker. Recently-used row above keyboard.                                                                                                                                                                                           |
| **Reactions**     | Long press on message → 6 quick reactions + full picker.                                                                                                                                                                                                        |
| **Reply**         | Swipe right on message → reply with quoted context above input.                                                                                                                                                                                                 |
| **Edit / Delete** | Long press own message → Edit or Delete (no time restriction). Edited messages show "(edited)" indicator. Managers+ can delete any message.                                                                                                                     |

### Record Thread Behavior

**Thread creation is implicit.** Every record has a thread. No "start a thread" UI — open a record, tap chat, start typing. The thread row is created on first message.

**Field change context.** When someone changes a field value, a system message appears in the record thread: "Sarah changed Status to Approved." Data changes and conversation are interwoven — the user sees the _story_ of the record, not just the current state. System messages are visually distinct (smaller, gray, no avatar) and do not trigger notifications.

**AI actionable messages (opt-in per user).** When enabled, the AI (`fast` tier, no credits — platform UX feature) scans messages for questions or requests and renders subtle action suggestions below the message: "Mark as complete?" / "Assign to you?" / "Update status to In Progress?" One-tap action from within chat. The action executes as a normal Server Action with audit trail. User enables via Settings → Chat → "Smart Actions."

**Portal client chat (Post-MVP — Comms & Polish+).** Portal clients on authenticated portals can participate in record threads within their `data_scope`. Messages from portal clients display as "Acme Corp (portal)" with a portal badge. Portal clients see only messages in threads on records they can access — full thread history is visible once they have access, but messages from before their `data_scope` included the record are excluded.

### DM & Group Chat

DMs and group chats feel exactly like texting.

| Feature             | Behavior                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Compose new**     | Compose icon in Chat inbox header → pick person (DM) or multiple people (group)                                                                                                      |
| **Online presence** | Green dot on avatar in thread list. "Last seen 5m ago" in thread header. Typing indicator ("Sarah is typing...") in real-time.                                                       |
| **Read receipts**   | "Seen" indicator below last message. **Admin sets workspace default** (on/off). **User can override** in personal Settings → Chat. Disabled by default in group threads (>2 people). |
| **Rich previews**   | Record link in chat → inline card (record name, status, 2–3 key fields). Tappable to open record. Same for portal links, file links.                                                 |
| **Group DMs**       | Create from compose, add members, name the group. Member list via header tap. Persistent — functions as a chat room.                                                                 |
| **Mute**            | Swipe left on thread → Mute. Muted threads don't generate push or in-app notifications. Still appear in inbox (at bottom, grayed).                                                   |

### Chat Search

The Chat tab has its own search bar (top of inbox). Searches across all threads the user has access to.

- Full-text search via tsvector on message content (including voice message transcriptions)
- Results show: message snippet, thread name, sender, timestamp
- Tap result → jumps to message in thread with highlight
- Chat messages are also indexed in the Command Bar search pipeline (see `vector-embeddings.md`) for workspace-wide search

### Chat Offline

Messages composed offline are queued in the offline action queue (same IndexedDB outbox). On reconnect, messages are sent FIFO with original timestamps preserved for ordering. Incoming messages received while offline are fetched via catch-up query on foreground (Socket.io reconnect fires `chat.catch_up` with `lastMessageId`).

---

## Mobile View Types

Four view types are available on mobile, each with a mobile-native interaction pattern. **Card view is the primary and default mobile view.** The others are accessible via a view-type switcher in the toolbar.

### Record View on Phone (Primary Mobile View)

Mobile Card View is **Record View rendered in compact list layout** with mobile interaction extensions. It is NOT a separate component — it uses the unified `RecordCard` component defined in `tables-and-views.md` with mobile-specific props activated by device context.

**Card layout:** Each card shows 3–5 key fields (configurable per Table View — the `views.config` JSONB `field_overrides` define which fields appear on cards). Cards are vertically stacked, full-width on phone, 2-column grid on tablet.

**Grouping:** Cards can be grouped by any single-select, status, user, or date field. Groups render as collapsible sections with a header showing group name + count. Drag cards between groups to update the grouping field (e.g., drag a card from "In Progress" to "Done" → status field updates). On phone, group headers are sticky during scroll.

**Filtering:** Sticky filter bar at top of card view. Quick filters: tap a field → bottom sheet with values → tap to toggle filter. Active filters show as pills below the bar. "Clear all" button.

**Sorting:** Tap sort icon → bottom sheet with field list → tap field → toggle ascending/descending. Multi-sort supported (primary + secondary).

**Swipe actions:** Right swipe = primary action (complete, approve). Left swipe = secondary action (archive, reject). Configurable per Table View — the `views.config` JSONB `write_permissions` determine which swipe actions are available. Swipe reveals action with icon + color confirmation. Must swipe past threshold (40% of card width) to trigger — prevents accidental swipes.

**Swipe + Status Transition Governance (Mode 2/3 from `approval-workflows.md`):**

When a swipe action triggers a status transition with unmet preconditions:

1. **Swipe animation reverses** — card bounces back with haptic error buzz.
2. **Bottom sheet appears** with precondition panel: "To move to [target status], fill in these fields:" — list of empty required fields as tappable items.
3. **Tapping a field** opens the record sheet scrolled to that field for editing.
4. **After all preconditions met,** bottom sheet updates: green checkmark + "[Move to {status}]" button.

When a swipe triggers a Mode 3 (Approval Gate) transition:

1. **Bottom sheet appears:** "This transition requires approval." + "[Request Approval]" button.
2. **Tapping Request Approval** sends the approval request and the card receives an "Awaiting Approval" badge (amber).
3. **Approver receives** actionable push notification with [Approve] / [Reject] buttons (see `approval-workflows.md` cross-reference).

**Card badges:** Status badges, priority indicators, overdue markers, unread chat indicator (blue dot), pending sync indicator (amber dot) — all visible on the card without opening it.

**Pull to refresh:** Pull down on card list → fetch latest data from server → update IndexedDB cache.

### Kanban View _(Post-MVP)_

Horizontal columns, each representing a grouping value (status, person, stage). Cards are vertically stacked within each column.

|                   | Phone                                                                                                                            | Tablet                                                              |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Layout**        | Horizontal scroll between columns. One column visible at a time. Swipe left/right to change column. Column header sticky at top. | 2–4 columns visible simultaneously. Horizontal scroll for overflow. |
| **Move card**     | Long press → card lifts → drag to column edge → column scrolls → drop. Or: tap card → action sheet → "Move to..."                | Same drag-and-drop, larger targets                                  |
| **New card**      | "+" at bottom of each column                                                                                                     | Same                                                                |
| **Column counts** | Badge on column header                                                                                                           | Same                                                                |

### Calendar View _(Post-MVP)_

Records with date fields rendered on a calendar. Optimized for scheduling, deadlines, and planning. Four modes available via segmented control at the top: `[Month] [Week] [Day] [Schedule]`.

**Phone defaults to Schedule view.** Tablet defaults to Week view. User can switch freely. Last-used mode persisted per user per Table View.

| Mode         | Phone                                                                                                                                                                                                                                                                           | Tablet                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **Month**    | Full-screen day grid. Max 5 color-coded dots per day cell (coded by status/type). If >5 records, show count badge instead of dots. Tap day → bottom sheet with that day's records as cards. Vertical scroll between months (continuous).                                        | Full-screen calendar with record titles visible in cells. Same dot/count behavior.       |
| **Week**     | 7-column layout. Records as time blocks within each day. Swipe horizontally to navigate weeks.                                                                                                                                                                                  | 7-column grid, records as blocks. Two-pane on wide tablets: week + record detail on tap. |
| **Day**      | Single day vertical timeline. Records as positioned cards by time. Swipe horizontally to navigate days.                                                                                                                                                                         | Two-pane: timeline + record detail on tap.                                               |
| **Schedule** | Vertical feed of event tiles, grouped by day header. Chronological, future-biased (starts from today, scrolls forward). Past events accessible by scrolling up. Each tile shows: time, title, 1–2 key fields, status badge. Tap tile → opens event record as full-screen sheet. | Same layout but wider tiles with more fields visible.                                    |

**Schedule view detail:**

```
── Today, Feb 21 ──────────────────
┌─────────────────────────────────┐
│ 9:00 AM   Client call — Acme    │
│           📍 123 Main St         │
│           ● In Progress          │
├─────────────────────────────────┤
│ 10:30 AM  Team standup           │
│           ● Scheduled            │
├─────────────────────────────────┤
│ 2:00 PM   Site visit — Johnson   │
│           📍 456 Oak Ave         │
│           ● Scheduled            │
└─────────────────────────────────┘

── Tomorrow, Feb 22 ───────────────
┌─────────────────────────────────┐
│ 8:00 AM   Morning review         │
│ 11:00 AM  Demo — New prospect    │
└─────────────────────────────────┘
```

Tiles are tappable → opens record full-screen sheet with Layer 2 contextual action bar. Address fields surface Navigate icon. Linked records with phone fields surface Call/SMS. Notes field available for meeting notes entry.

**Persistent "+" button:** Always visible in toolbar across all four calendar modes. Tap → new event creation form (full-screen sheet on phone): title, date/time, duration, location, description, notification settings (remind me: 15min / 1hr / 1day before), plus any custom fields from the source table. Default template applied silently if one exists.

**Other interactions:**
| Action | Phone | Tablet |
|---|---|---|
| **Create from calendar** | Tap empty time slot → new record with date/time pre-filled (Month: date only, Week/Day: date + time) | Same |
| **Reschedule** | Long press record → drag to new date/time (Week and Day views only). On Month view: tap record → edit date in record sheet. | Same drag, also available on Month view cells |

### Form View

Full-screen form for data entry. Used both in the platform (new record) and in portals.

|                      | Phone                                                                                                                                                     | Tablet                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Layout**           | Single column. One field per row. Generous spacing. Submit button fixed at bottom (thumb zone).                                                           | Two-column layout. Submit button bottom-right.          |
| **Field navigation** | Tap field → focus. "Next" button on keyboard advances to next field. Progress indicator at top (Step 2 of 8).                                             | Same, no progress indicator needed (all fields visible) |
| **Required fields**  | Marked with teal asterisk. Submit blocked until all required fields filled. Scroll-to-first-error on submit attempt.                                      | Same                                                    |
| **Long forms**       | Grouped into collapsible sections. "Section 2 of 4" progress. Or paginated: one section per page with Next/Back. Admin configures in Table View settings. | All sections visible, collapsible                       |
| **Validation**       | Inline real-time validation on field blur. Error message appears below field immediately.                                                                 | Same                                                    |
| **Draft auto-save**  | Every 10 seconds, form state saved to IndexedDB. "Unsaved draft" banner if user returns.                                                                  | Same                                                    |

---

## Portal Mobile PWA (Paid Tiers)

Portals on **Professional ($149) and above** can be installed as standalone branded PWAs. Freelancer and Starter portals are browser-only.

### PWA Manifest Generation

Each portal with PWA enabled generates a dynamic `manifest.json` from portal config:

```typescript
// Generated per-portal, served at /portal/{slug}/manifest.json
interface PortalManifest {
  name: string; // portal.name
  short_name: string; // portal.name (truncated to 12 chars)
  start_url: string; // /portal/{slug}
  display: 'standalone';
  theme_color: string; // portal.theme.primaryColor
  background_color: string; // portal.theme.backgroundColor
  icons: Array<{
    // Generated from portal.favicon_url or logo
    src: string;
    sizes: string; // 192x192, 512x512
    type: string;
    purpose: 'any maskable';
  }>;
}
```

**Icon generation:** When a manager uploads a portal logo, the upload pipeline generates PWA icon sizes (192x192, 512x512) via sharp and stores them alongside the original in R2/S3.

### Plan Gating

| Plan         | Portal PWA         | Offline                           |
| ------------ | ------------------ | --------------------------------- |
| Freelancer   | ❌ Browser only    | ❌                                |
| Starter      | ❌ Browser only    | ❌                                |
| Professional | ✅ Installable PWA | ✅ Read-only offline              |
| Business     | ✅ Installable PWA | ✅ Read-only + offline form queue |
| Enterprise   | ✅ Installable PWA | ✅ Full offline                   |

### Service Worker Scope Isolation

Portal PWAs use a **separate service worker scope** from the platform PWA to prevent cache collisions and ensure independent lifecycle.

```
Platform PWA SW scope:  /
Portal PWA SW scope:    /portal/{slug}/
```

Portal service workers:

- Precache the portal shell (HTML, CSS, portal theme assets)
- Runtime cache portal data responses (stale-while-revalidate, 5-min TTL)
- Do NOT cache platform routes or platform JS bundles
- Respect per-plan offline limits (see Plan Gating above)

---

## Offline Architecture

### Table View Working Set Cache

When a team member opens a Table View on mobile or tablet, the **full working set** is cached to IndexedDB — not just the records they scrolled past.

**What "full working set" means:**

- All records matching the Table View's view filter (up to the Table View record cap — 5,000 records)
- Record selection criteria: most recently updated records first (`updated_at DESC`), capped at 5,000
- Field definitions for the Table View's table
- Table View configuration (field overrides, record filter, write permissions)
- Linked record display values (Level 0 — display name only, not full linked records)

**Cache lifecycle:**

```
1. Table View opened → fetch full record set from server
2. Store in IndexedDB: idb://views/{viewId}/records
3. Store metadata: idb://views/{viewId}/meta (field defs, config, lastSync timestamp)
4. Background: subscribe to real-time updates for this Table View
5. On real-time event: patch IndexedDB cache incrementally
6. On app foreground (after background): diff-sync — fetch records modified since lastSync
7. On Table View definition change (field added/removed, filter changed): invalidate and re-fetch
```

**Storage budget:**

| Data type                    | Estimated size per record | Cap                                   |
| ---------------------------- | ------------------------- | ------------------------------------- |
| Canonical record data        | ~2 KB avg (JSONB)         | 5,000 records = ~10 MB per Table View |
| Field definitions            | ~5 KB per table           | Negligible                            |
| Table View config            | ~2 KB                     | Negligible                            |
| Linked record display values | ~200 bytes per link       | Proportional to link density          |

**Total per-Table View budget:** ~12 MB typical, 20 MB worst case.

**Device budget:** Max 5 Table Views cached simultaneously. Total IndexedDB budget: 80 MB (leaves headroom under iOS 50 MB evictable threshold by prioritizing — see eviction below). On Android (no hard limit), allow up to 10 cached Table Views.

**Eviction policy:** LRU by Table View. When budget exceeded, evict the least-recently-opened Table View cache. User never manually manages cache — it's automatic. A "Cached for offline" indicator appears on Table Views that are currently cached.

**Offline cache communication to user:**

- **Offline record count footer:** When viewing a cached Table View without connectivity, footer shows: "[5,000 of 12,000 records · Offline]" — "Offline" rendered in amber (process state color language). Users know immediately they're seeing a subset.
- **Cache timestamp:** Below record count: "Last synced 3 hours ago." Updated on each successful sync.
- **Why subset matters:** If a user searches for a record not in the cached 5,000, they won't find it. The search empty state shows: "Record not found offline. Connect to search all records."

### What's Available Offline

| Data                                      | Offline Availability | Strategy                                   |
| ----------------------------------------- | -------------------- | ------------------------------------------ |
| App shell (HTML/CSS/JS)                   | ✅ Always            | Service Worker precache on install         |
| Table View working set (records + config) | ✅ Cached            | IndexedDB, full working set per Table View |
| Record detail (within cached Table View)  | ✅ Cached            | Served from IndexedDB cache                |
| Document content (last viewed)            | ✅ Cached            | IndexedDB, HTML snapshot                   |
| User preferences + theme                  | ✅ Always            | localStorage                               |
| Portal data (paid tiers)                  | ✅ Cached            | IndexedDB, scoped to client's data_scope   |
| Full workspace data (all tables)          | ❌ Not cached        | Too large for mobile storage budgets       |
| File attachments                          | ❌ Not cached        | On-demand download only                    |
| AI features                               | ❌ Requires network  | API calls cannot be cached                 |
| Builder tools (automation, portal design) | ❌ Requires network  | Real-time collaboration, no offline mode   |

### Offline Action Queue

When the user is offline and performs a mutation (edit cell, create record, update status, send message):

1. Action written to IndexedDB outbox queue with timestamp and originating Table View ID
2. UI shows optimistic update with "pending sync" indicator (subtle amber dot on the record card / cell)
3. When connectivity returns, Service Worker or app foreground handler processes the queue **FIFO**
4. Each action replayed as a normal Server Action with the original `traceId` for correlation
5. On success: remove from queue, remove pending indicator, update IndexedDB cache
6. On conflict: show conflict resolution UI (see `sync-engine.md > Conflict Resolution UX` and `sync-engine.md > Mobile Conflict UX`)

**Queue limits:** Max 100 pending actions (weighted — see below). At 80 weighted actions, show warning: "You have many pending changes — connect to sync soon." At 100, block new mutations with: "Connect to sync your changes before making more edits."

**Action weight in queue cap:** Weighted counting toward the 100-action cap:

- Simple cell edit: weight 1
- Cross-link modification (add/remove link): weight 5
- Bulk operation: weight 10

**Cross-link awareness in offline queue:**

1. **Scope filter validation on replay:** Cross-link additions are validated against `link_scope_filter` on replay. If a queued cross-link addition fails scope validation, the user sees a conflict card: "[Record name] no longer matches the filter [reason]. [Keep Edit] [Revert]"

2. **Sequential replay for cross-link actions:** Cross-link mutations within the same queue batch replay sequentially — each awaits server confirmation before the next sends. This prevents transient states where cascade ordering could cause issues (e.g., exceeding `max_links_per_record`). Other field edits replay in parallel.

3. **Cross-link chips offline:** When offline, cross-link chips render as plain text pills showing the display value. Not tappable. Rendered in gray (no teal tint) to visually distinguish from online interactive chips. The user sees the information but cannot drill into linked records until connectivity is restored.

**Portal offline form queue:** Portal clients on Business+ plans can submit forms offline. Form data is queued in IndexedDB under the portal's service worker scope. Queued submissions replay on reconnect with full `data_scope` re-verification server-side. If `data_scope` has changed while offline (client's access was revoked), the submission is rejected and the client sees "Your access has changed — please contact the portal administrator."

---

## Notification Routing

Mobile.md owns notification channel routing. `communications.md` and `realtime.md` own the delivery infrastructure.

### Channel Hierarchy

Notifications are delivered through the highest-available channel, falling back as needed:

```
1. In-app real-time (Socket.io push to connected client)
   ↓ if client not connected
2. Web Push (PWA with notification permission granted)
   ↓ if PWA not installed or permission denied
3. Native Push (Capacitor — APNs / FCM, if Capacitor shell shipped)
   ↓ if no push channel available
4. Email (via Resend)
   ↓ if email bounced or user preference
5. SMS (via Twilio — only for Critical tier, see below)
```

### Notification Tiers

Not all notifications are equal. Tier determines which channels are used and batching behavior.

| Tier                | Examples                                                                                               | Channels                       | Batching                                                |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------ | ------------------------------------------------------- |
| **Critical**        | Sync failure requiring action, automation error (stopped), security alert (new login), payment failure | All channels including SMS     | Immediate, no batching                                  |
| **Action Required** | Task assigned, approval requested, mention in chat, form submission received                           | Push + email                   | Immediate                                               |
| **Informational**   | Record updated, sync completed, comment on watched record                                              | Push only (in-app or web push) | Batched: max 1 push per 5 minutes, digest if >5 pending |
| **Digest**          | Weekly workspace summary, portal analytics                                                             | Email only                     | Daily or weekly digest                                  |

### User Notification Preferences

Stored in `users.preferences` JSONB (existing field):

```typescript
interface NotificationPreferences {
  channels: {
    push: boolean; // Web Push / native push enabled (default: true)
    email: boolean; // Email notifications (default: true)
    sms: boolean; // SMS for Critical only (default: false, requires phone number)
  };
  quiet_hours: {
    enabled: boolean; // Default: false
    start: string; // "22:00" (local time)
    end: string; // "08:00"
    timezone: string; // IANA timezone
    override_critical: boolean; // Critical notifications ignore quiet hours (default: true)
  };
  per_workspace: Record<
    string,
    {
      muted: boolean; // Mute all from this workspace
      digest_only: boolean; // Only receive daily digest
    }
  >;
}
```

**Quiet hours:** During quiet hours, Informational and Digest notifications are held and delivered as a batch when quiet hours end. Action Required notifications are delivered by email only (no push). Critical notifications always deliver immediately unless `override_critical` is false.

### Portal Client Notifications

Portal clients receive notifications via **email only** — no push, no SMS. Notifications are opt-in and configured per portal by the manager:

- Record status changed (within client's `data_scope`)
- Form submission confirmed
- New message in portal chat (Post-MVP — Comms & Polish)
- Portal client can unsubscribe via email footer link

### Notification Grouping

On mobile, ungrouped notifications are overwhelming. Rules:

- **Same-record updates** within 5 minutes are collapsed into one notification: "3 fields updated on Project Alpha"
- **Same-table batch** operations (bulk status change) are collapsed: "12 records updated in Projects"
- **Chat messages** in the same thread within 2 minutes: "3 new messages from Sarah in Project Alpha"
- **Group key:** `{workspace_id}:{entity_type}:{entity_id}:{5min_window}`

---

## Deep Linking

### URL Scheme

All EveryStack entities have stable, deep-linkable URLs:

```
Platform:   https://app.everystack.com/w/{workspaceId}/t/{tableId}/v/{viewId}/r/{recordId}
Portal:     https://{slug}.everystack.app/portal/{slug}/r/{recordId}
Custom:     https://portal.clientcompany.com/r/{recordId}
```

### Link Resolution on Mobile

When a user taps a link from an email, SMS, or external app:

| State                             | Behavior                                                      |
| --------------------------------- | ------------------------------------------------------------- |
| PWA installed (home screen)       | Opens directly in PWA with correct route                      |
| PWA not installed, app in browser | Opens in browser, renders normally                            |
| Capacitor app installed           | Universal Links (iOS) / App Links (Android) open native shell |
| No EveryStack context             | Opens in browser, Clerk auth prompt if needed                 |

### Capacitor Readiness

To ensure deep links work when/if Capacitor ships:

- All internal links use `window.location` or Next.js `<Link>`, never `window.open` (Capacitor intercepts navigation)
- URL structure is flat and parseable — no hash routing, no query-param-only routes
- `assetlinks.json` (Android) and `apple-app-site-association` (iOS) templates prepared but not deployed until Capacitor decision
- Portal custom domains include CNAME validation for future universal link association

---

## Camera, Scanning & OCR _(Post-MVP — Portals & Apps)_

### Photo Capture

Camera access is available from any attachment field, the chat input bar, and a dedicated "Scan" action.

| Feature                | Behavior                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Quick photo**        | Tap camera icon → native camera → photo attached. No intermediate upload screen.                                                                                                                                                                                                                                                |
| **Bulk photo capture** | Long press camera icon → multi-shot mode. Camera stays open with counter ("3 photos"). Tap done when finished. All photos attached to the same record. Essential for job sites, property walkthroughs, inventory.                                                                                                               |
| **Photo annotation**   | After capture (or on any image attachment), tap "Annotate" → canvas overlay. Draw (freehand, circle, arrow), add text labels, highlight. Save annotated version as new attachment (original preserved). Use case: circle a defect, arrow to a location, label a component. Canvas implemented with `<canvas>` API or CanvasKit. |
| **Gallery pick**       | Tap gallery icon → native image picker → multi-select supported.                                                                                                                                                                                                                                                                |

### Document Scanning & OCR

Scan physical documents and extract structured data into record fields. This is a core mobile differentiator.

**Scan types:**

| Scan Type               | Detection                                                  | Output                                                   | Technology                                   |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------- |
| **Business card**       | AI detects card layout, name, title, email, phone, company | Populates contact record fields via field mapping        | AI `standard` tier (OCR + entity extraction) |
| **Invoice**             | AI detects vendor, date, line items, total, tax            | Populates invoice record fields                          | AI `standard` tier                           |
| **Contract / document** | AI extracts full text, key dates, parties, clauses         | PDF attachment + extracted text in fields                | AI `standard` tier                           |
| **Barcode**             | Client-side decode (zxing-js, no AI credits)               | Lookup record by barcode value or populate barcode field | Client-side — `zxing-js` library             |
| **QR code**             | Client-side decode                                         | Deep link to record, URL action, or field population     | Client-side — `zxing-js` library             |

**Scan UX flow:**

```
1. User taps "Scan" (in record view Layer 2 action bar, or standalone from More tab)
2. Camera opens with viewfinder overlay (auto-detect document edges)
3. Auto-capture when edges detected OR manual shutter
4. Perspective correction + contrast enhancement (client-side, sharp or Canvas)
5. For barcode/QR: instant client-side decode → action
6. For documents: upload image → AI pipeline:
   a. OCR text extraction
   b. Entity extraction (AI `standard` tier, uses AI credits)
   c. Return structured data as key-value pairs
7. Field mapping UI: "We found these values — which fields?"
   - Auto-map by field name similarity (AI `fast` tier, no credits)
   - User confirms/corrects mapping
   - "Remember this mapping for [vendor/document type]" → saved as scan template
8. Confirmed values written to record fields via normal Server Action
```

**Scan templates:** After a user maps fields for a document type (e.g., "invoices from Acme Corp always have vendor in top-left, total in bottom-right"), the mapping is saved per table as a scan template. Future scans from similar documents auto-apply the template. Templates stored in `extraction_templates` table (shared with web upload extraction — see `document-intelligence.md` > Extraction Templates).

**AI credit cost:** Each document scan (OCR + extraction) costs 2–5 AI credits depending on complexity. Barcode/QR scanning is free (client-side). Credit cost shown before scan confirmation: "This scan will use ~3 AI credits."

---

## Maps & Geolocation _(Post-MVP)_

### Location Capture

Any address or geolocation field provides:

| Feature                   | Behavior                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Current location**      | Tap "Use my location" → Geolocation API → reverse geocode to address → populate field                                                                                                                                                                                                                            |
| **Address autocomplete**  | Type address → autocomplete suggestions via Google Places API (or Mapbox). Tap to select and populate.                                                                                                                                                                                                           |
| **Pin on map**            | Tap "Pick on map" → full-screen map → long press to drop pin → confirm → coordinates + address                                                                                                                                                                                                                   |
| **GPS tracking (opt-in)** | For field workers: "Track location while at this job" → periodic location updates to a location history field. Uses Geolocation API `watchPosition()`. Stops when user taps "Stop tracking" or leaves the record. Privacy: opt-in only, visible indicator (blue pulse in header), stored in record activity log. |

### Map View _(Post-MVP)_

A new view type showing records with address/geolocation fields as pins on a map.

|                    | Phone                                                                                                                                                                                                                | Tablet                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **Layout**         | Full-screen map. Record list as a draggable bottom sheet (half-height, pull up for full list). Tap pin → bottom sheet shows record card.                                                                             | Map (70%) + record list sidebar (30%). Tap pin → sidebar highlights record. |
| **Clustering**     | Pins cluster at zoom levels where they'd overlap. Cluster badge shows count. Tap cluster → zoom in.                                                                                                                  | Same                                                                        |
| **Filtering**      | Same filter bar as card view, overlaid at top of map. Filters apply to both pins and list.                                                                                                                           | Same                                                                        |
| **Navigation**     | Tap pin → record card in bottom sheet → "Navigate" button → opens Google Maps / Waze / Apple Maps (user default). Deep link: `comgooglemaps://`, `waze://`, or `maps://` with fallback to `https://maps.google.com`. | Same                                                                        |
| **Route planning** | Select multiple records (long press pins) → "Route" → opens turn-by-turn in external maps app with waypoints in order.                                                                                               | Same                                                                        |
| **Offline**        | Map tiles are NOT cached offline (too large). Cached records still show in list view when offline but map is replaced with "Map requires internet" message.                                                          | Same                                                                        |

**Map provider:** Google Maps JS API (primary), Mapbox GL JS (fallback/alternative for cost). Configured per workspace via env var. Map tiles served via CDN. API key restricted to EveryStack domains.

---

## Voice Input & Dictation _(Post-MVP)_

Voice input is available anywhere there's a text field — chat, long text fields, notes, search.

| Feature                      | Behavior                                                                                                                                                                                                                                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dictation to text field**  | Tap mic icon on any text input → Web Speech API (PWA) or native speech-to-text (Capacitor) → real-time transcription into field. Tap mic again to stop.                                                                                                                                                   |
| **Voice message in chat**    | Hold mic icon → record audio → release to review waveform → send. AI transcription (`fast` tier, uses AI credits) stored alongside audio for search.                                                                                                                                                      |
| **AI cleanup (opt-in)**      | After dictation, user can tap "Clean up" → AI (`fast` tier, 1 credit) improves grammar, removes filler words, formats properly. Original preserved as undo.                                                                                                                                               |
| **Voice to record creation** | From quick actions: "New record by voice" → dictate → AI (`standard` tier, 2–3 credits) extracts field values from natural language → field mapping confirmation → record created. "Add a task for Sarah to review the Johnson proposal by Friday" → Title, Assignee, Related Record, Due Date populated. |

**Language:** Dictation uses the device's speech recognition locale. EveryStack does not provide its own speech model — it relies on the platform's (Web Speech API uses the browser/OS engine, Capacitor uses iOS/Android native). The AI cleanup step can handle any language the AI provider supports.

---

## Mobile Input Optimization

Every field type declares its optimal mobile input mode. This is enforced in the field type renderer spec and in the components CLAUDE.md.

| Field Type                | `inputMode` / Picker              | Mobile Behavior                                                                                                                                                                                    |
| ------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Number**                | `inputMode="decimal"`             | Large number pad. No QWERTY.                                                                                                                                                                       |
| **Currency**              | `inputMode="decimal"`             | Number pad with currency symbol prefix.                                                                                                                                                            |
| **Phone**                 | `inputMode="tel"`                 | Phone dial pad.                                                                                                                                                                                    |
| **Email**                 | `inputMode="email"`               | Email keyboard (@ and . prominent).                                                                                                                                                                |
| **URL**                   | `inputMode="url"`                 | URL keyboard (.com, /, : visible).                                                                                                                                                                 |
| **Date**                  | Custom calendar picker            | Calendar grid, tap day. Swipe months. "Today" shortcut. NOT native `<input type="date">` (too inconsistent across browsers). Use shadcn DatePicker (react-day-picker) with mobile-optimized sheet. |
| **Time**                  | Scroll wheel picker               | Hour + minute wheels (iOS-style). AM/PM toggle.                                                                                                                                                    |
| **Date + Time**           | Combined picker                   | Calendar grid → time wheel. Two-step.                                                                                                                                                              |
| **Single Select**         | Bottom action sheet               | Tap field → bottom sheet with options. Search filter if >8 options.                                                                                                                                |
| **Multi Select**          | Bottom sheet with checkboxes      | Tap to toggle. Selected items as pills above list.                                                                                                                                                 |
| **Long Text / Rich Text** | Full-screen editor                | Tap → expand to full-screen. TipTap editor with mobile toolbar (bold, italic, link, list). Mic icon for dictation.                                                                                 |
| **Rating**                | Star row (56px tall)              | Tap or swipe across stars. Haptic feedback on each star.                                                                                                                                           |
| **Checkbox**              | Large toggle (56×32px)            | Tap to toggle. Haptic feedback.                                                                                                                                                                    |
| **Slider / Percent**      | Drag handle (48px)                | Thumb-friendly handle. Value label above thumb during drag.                                                                                                                                        |
| **Attachment**            | Camera + gallery + file           | Tap → action sheet: "Take Photo," "Choose from Gallery," "Scan Document," "Browse Files."                                                                                                          |
| **Barcode**               | Camera viewfinder                 | Tap → camera with barcode overlay → auto-detect → populate.                                                                                                                                        |
| **Signature**             | Full-screen canvas                | Tap → full-screen signing pad. Finger drawing. Clear / Undo. Save as SVG.                                                                                                                          |
| **Address**               | `inputMode="text"` + autocomplete | Type → autocomplete suggestions. "Use my location" button.                                                                                                                                         |
| **User / Person**         | Bottom sheet with avatar list     | Searchable user list. Recent selections at top.                                                                                                                                                    |
| **Linked Record**         | Bottom sheet with record search   | Search + recent. Shows record card previews.                                                                                                                                                       |

**Rule:** Every field type renderer MUST specify `inputMode` or use a custom picker. The default text keyboard (`inputMode="text"`) is only acceptable for Single Line Text and Long Text. All other types must optimize.

### Digital Signatures

The Signature field type deserves special attention — it's a new field type.

- **Capture:** Full-screen canvas. White background, dark stroke. Finger or stylus input. Undo last stroke, clear all.
- **Storage:** Captured as SVG path data, stored in canonical_data JSONB. Rendered as an `<img>` in record view and documents.
- **Immutability:** Once signed, the signature field is locked (cannot be edited, only cleared and re-signed by the original signer). Audit log records signing timestamp and signer identity.
- **Use cases:** Contract approval, delivery confirmation, inspection sign-off, client consent.
- **Doc gen integration:** Signatures are insertable into Document Templates via `{{signature_field}}` placeholder.

---

## Ergonomic Design Constraints

These are **layout rules** enforced in `design-system.md` and `components/CLAUDE.md`, not optional features.

### Thumb Zone

The bottom 40% of the screen is the natural thumb zone for one-handed use. Layout rules:

| Zone                | What Goes Here                                                                                      | What Does NOT Go Here                 |
| ------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Bottom (0–40%)**  | Primary actions: submit, confirm, send. Bottom bar (Layer 1 nav / Layer 2 actions). Chat input bar. | Destructive actions (delete, archive) |
| **Middle (40–70%)** | Content: cards, messages, record fields. Scrollable area.                                           | Fixed UI elements                     |
| **Top (70–100%)**   | Navigation: back, close, title, search. Destructive actions (harder to accidentally tap).           | Primary action buttons                |

**Bottom bar:** Two-layer contextual bottom bar at 56px in the thumb zone. Layer 1 (navigation) at top-level screens. Layer 2 (contextual actions) inside records. Touch targets 44×44px minimum (WCAG 2.5.8). See `mobile-navigation-rewrite.md` for full specification.

**No FAB.** Record creation uses "+" button in toolbar/header. Field-type-driven actions (camera, scanner, call) are in the Layer 2 contextual action bar. Long-press is reserved exclusively for system-level interactions (text selection, context menus).

**Submit / send buttons:** Always at the bottom of the screen, never at the top. Full-width on phone for forms. Right-aligned in chat input bar.

### One-Handed Use

All primary mobile interactions must be completable with one hand (right-thumb dominant, mirrored for left-hand mode in RTL layouts via CSS logical properties).

**Design rules:**

- No essential interactions in the top-left corner (hardest to reach with right thumb)
- Swipe gestures are horizontal (natural thumb motion), not vertical (awkward stretch)
- Bottom sheets, not top modals, for selection
- Action sheets from bottom, not dropdown menus from top
- Back navigation via swipe-from-left-edge (system gesture), not a top-left back button as the sole method
- Large tap targets: 48px minimum for action buttons (exceeds WCAG 44px minimum). 56px for primary actions (submit, create).
- Generous spacing between tappable elements: minimum 8px gap (prevents mis-taps)

### Pull to Refresh

Available on all scrollable mobile views: card list, chat inbox, thread view, kanban columns, calendar, task list. Implementation via touch event detection (pull down past threshold → loading indicator → fetch latest data → update view). Haptic feedback on trigger.

### Shake to Undo

On mobile, shaking the device triggers an undo prompt for the last action (if within the undo window). Pairs with the existing optimistic UI + undo pattern. Uses the DeviceMotion API (PWA) or Capacitor motion plugin. "Undo [action]?" confirmation toast with 5-second timeout.

---

## AI Personalization _(Post-MVP)_

The AI learns user patterns to make the mobile experience faster. This operates at two levels.

### Adaptive UI (Always On, No Credits)

Local usage analytics (stored in IndexedDB, never sent to server) drive UI adaptations:

| Signal                          | Adaptation                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------- |
| Frequently accessed Table Views | Pinned to top of Workspace tab. Cached proactively for offline.                   |
| Common field values             | "Recently used" section in select pickers. Smart defaults on new record creation. |
| Typical working hours           | Proactive cache refresh before user's usual start time.                           |
| Common navigation paths         | "Quick access" row in My Office (3 most-used destinations).                       |
| Frequently used filters         | Saved as suggested filter pills in card view toolbar.                             |

**Privacy:** All adaptive data is local (IndexedDB). No server-side behavioral tracking for personalization. Cleared on app data clear or user logout. No PII in adaptive storage.

### AI-Powered Personalization (Opt-In, Uses Credits)

When enabled in Settings → AI → "Personalized Suggestions":

| Feature                      | Behavior                                                                                                                    | Cost                       |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| **Smart field defaults**     | AI pre-fills new record fields based on context (current Table View, recent records, time of day). User confirms or clears. | 1 credit per suggestion    |
| **Actionable chat messages** | AI detects questions/requests in chat, suggests one-tap actions. (See Mobile Chat > Record Thread Behavior.)                | No credits (platform cost) |
| **Smart search**             | Command Bar learns from search→action patterns. "You usually open [X] after searching for [Y]."                             | No credits (local)         |
| **Digest prioritization**    | Daily/weekly digest email sorts items by AI-predicted relevance to this user's role and patterns.                           | 1 credit per digest        |

---

## Mobile Payments _(Post-MVP)_

Stripe is the payment provider (enforced in tech stack). Mobile payment UX:

### Workspace Billing (Manager)

- Plan upgrade/downgrade from Settings → Billing (accessible on mobile)
- Payment method management (add/update card)
- **Apple Pay / Google Pay:** For plan payments and one-time charges. Uses Stripe Payment Intents with the Payment Request API (PWA-compatible). Falls back to card form if Payment Request API unavailable. Capacitor: Stripe's native iOS/Android SDKs.
- Invoice history and receipt download

### Portal Payment Blocks (Post-MVP — Comms & Polish+)

Portals can include payment blocks (pay an invoice, purchase a service). On mobile:

- Stripe Checkout embedded in portal page
- Apple Pay / Google Pay via Payment Request API
- Payment confirmation → record update (e.g., invoice status → "Paid")
- Receipt sent via portal client email notification

---

## In-App Support _(Post-MVP)_

Support speaks the user's language — literally.

### Multilingual Support

EveryStack's i18n infrastructure (`t('key')`, `resolveContent()`) extends to all support content:

| Support Surface                           | Language Behavior                                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Help tooltips**                         | Translated via i18n. Part of the main locale files.                                                                 |
| **In-app help articles**                  | Markdown content in `src/i18n/help/{lang}/`. Falls back to English if translation unavailable.                      |
| **AI assistant (Command Bar → "Ask AI")** | AI responds in the user's locale (detected from `i18next.language`). System prompt includes: "Respond in {locale}." |
| **Error messages**                        | All user-facing errors via `t('errors.{code}')`. Never raw English.                                                 |
| **Onboarding tours**                      | Step-by-step overlay tours (first-use), translated.                                                                 |

### Support Access on Mobile

- **Help button:** In "More" item (Layer 1 navigation bar) → "Help & Support"
- **Contextual help:** Long press on any field label or section header → tooltip with help text
- **Chat support (future):** In-app chat widget (Intercom-style) accessible from More tab. Speaks user's language via AI translation layer.
- **Status page:** Link to external status page from More tab for incident visibility

---

## Additional Mobile Capabilities

### Quick Actions from App Icon

PWA manifest `shortcuts` field (and Capacitor App Shortcuts) for direct actions from the home screen:

```json
{
  "shortcuts": [
    { "name": "New Record", "url": "/quick/new-record", "icons": [...] },
    { "name": "My Tasks", "url": "/office/tasks", "icons": [...] },
    { "name": "Scan Document", "url": "/quick/scan", "icons": [...] },
    { "name": "Quick Chat", "url": "/chat", "icons": [...] }
  ]
}
```

On iOS: long press app icon → shortcut menu. On Android: long press → shortcut chips.

### Share Sheet Integration (Inbound)

User shares content from another app (email, browser, photo) to EveryStack → creates a new record or attachment.

**PWA:** Web Share Target API in manifest. Receives shared text, URLs, and files. Routes to "Create record" flow with shared content pre-filled.

**Capacitor:** Native share sheet receiver. Richer support (multiple files, specific MIME types).

**Note:** Web Share Target API does NOT work in Capacitor WebView. If Capacitor is shipped, share sheet must use the Capacitor native plugin. This is a Capacitor decision framework consideration — if share sheet usage is high in PWA mode, it strengthens the case for Capacitor.

### Home Screen Widgets (Post-MVP, Capacitor Only)

Small data displays on the phone's home screen:

| Widget            | Content                                                     | Size         |
| ----------------- | ----------------------------------------------------------- | ------------ |
| **Tasks Due**     | Count + top 3 task titles                                   | Small (2×2)  |
| **KPI**           | Single number from a summary field (e.g., "Open Deals: 12") | Small (2×2)  |
| **Quick Actions** | 2×2 grid: New Record, Scan, Tasks, Chat                     | Medium (2×4) |

Widgets poll a lightweight API endpoint (`/api/widget/{widgetType}`) every 15 minutes. Data is minimal (JSON, <1 KB). Requires Capacitor + native widget plugins (WidgetKit on iOS, App Widgets on Android).

### Wearable Notifications (Post-MVP, Capacitor Only)

Apple Watch and Wear OS receive push notifications with quick actions:

- Notification shows: title, preview, action buttons ("Approve" / "Reject" or "Reply")
- Quick action from wrist → Server Action via push notification response
- No full app on wearable — notification-only

### NFC Scanning (Post-MVP, Capacitor Only)

Tap NFC tag → deep link to record. Use case: asset tags on equipment, location markers, inventory items.

- Capacitor NFC plugin reads tag data (URL or ID)
- If URL: navigate directly to record
- If ID: lookup record by NFC ID field value → navigate
- Write mode: from record view, "Write NFC tag" → encode record URL onto blank NFC tag

### Split Screen / Slide Over (Tablet)

iPad Split View and Android Split Screen are supported — EveryStack works correctly in a half-screen window.

**Constraints:**

- App must not assume full-screen ownership (no `100vw` assumptions — use `100%` of container)
- Responsive breakpoints trigger based on actual window width, not device width
- When in split screen at <768px width on a tablet, the phone layout activates (including bottom nav)
- Tested in Playwright at 512px width (half of 1024px iPad) to simulate split screen

---

## PWA Capabilities

**Handles well (ship with PWA):**

- Offline-capable Table View data and document reading (Service Worker + Cache API + IndexedDB)
- Installable on home screen (Android and iOS)
- Responsive UI with mobile-optimized patterns (fully designed per responsive matrix in `design-system.md`)
- Socket.io WebSocket connections for real-time
- Camera access for file attachments
- Geolocation for address fields
- Web Push notifications (Android full, iOS since 16.4 with home screen install)

### iOS Limitations

| Capability            | Android PWA             | iOS PWA                                          | Impact                                                    |
| --------------------- | ----------------------- | ------------------------------------------------ | --------------------------------------------------------- |
| Push notifications    | ✅ Full (FCM)           | ⚠️ Since iOS 16.4, requires "Add to Home Screen" | Mitigate: email/SMS fallback per channel hierarchy        |
| Background sync       | ✅ Background Sync API  | ❌ Service Worker killed when backgrounded       | Offline-queued actions sync on reopen                     |
| Badge count           | ✅ Badging API          | ⚠️ Since iOS 16.4, home screen only              | Acceptable                                                |
| Persistent storage    | ✅ Storage Manager API  | ⚠️ ~50 MB default, evictable                     | IndexedDB budget constrained to 80 MB total, LRU eviction |
| WebSocket reliability | ✅ Stable in background | ⚠️ Dropped when backgrounded                     | Socket.io reconnect + catch-up query on foreground        |

**Assessment:** None are blocking for the "operate" use case. Primary gap is iOS push requiring home screen install — mitigated by email fallback. iOS storage limit shapes the Table View cache budget (max 5 cached Table Views on iOS, 10 on Android).

---

## Service Worker Caching

### Platform Service Worker

```
Precache (install time):
  - App shell: all route HTML shells, JS bundles, CSS
  - shadcn/ui component assets
  - Locale files (current language only — switch triggers re-precache)
  - Design system theme assets (surface tokens, accent color)

Runtime cache (stale-while-revalidate):
  - Table View record data → IndexedDB (NOT Cache API — IndexedDB for structured queries)
  - Field definitions → IndexedDB, 1-hour TTL
  - Table View config → IndexedDB, 1-hour TTL
  - Image thumbnails → Cache API, 24-hour TTL, max 50 MB
  - Max combined cache size: 80 MB (iOS) / 150 MB (Android)

Network-only:
  - Server Actions (mutations always go to server, or offline queue)
  - AI API calls
  - File uploads
  - Real-time subscriptions (Socket.io)
```

### Portal Service Worker (Separate Scope)

```
Scope: /portal/{slug}/

Precache (install time):
  - Portal shell HTML
  - Portal theme CSS + assets (logo, favicon, brand colors)
  - Portal-specific JS bundle (subset of platform bundle)

Runtime cache (stale-while-revalidate):
  - Portal page data → IndexedDB, 5-min TTL
  - Scoped record data → IndexedDB (only client's data_scope)
  - Max cache: 30 MB

Network-only:
  - Form submissions (or offline queue on Business+)
  - Magic link auth flow
```

---

## Performance Budgets

| Metric                                 | Target (Phone, 4G)     | Target (Tablet, WiFi)    | Measurement                         |
| -------------------------------------- | ---------------------- | ------------------------ | ----------------------------------- |
| **LCP** (Largest Contentful Paint)     | < 2.5s                 | < 1.5s                   | Lighthouse CI in GitHub Actions     |
| **FID** (First Input Delay)            | < 100ms                | < 100ms                  | Web Vitals RUM                      |
| **CLS** (Cumulative Layout Shift)      | < 0.1                  | < 0.1                    | Lighthouse CI                       |
| **TTI** (Time to Interactive)          | < 3.5s                 | < 2.0s                   | Lighthouse CI                       |
| **JS bundle (mobile critical path)**   | < 150 KB gzipped       | < 200 KB gzipped         | Build-time check                    |
| **SW install + precache**              | < 5s on 4G             | < 2s on WiFi             | Manual benchmark quarterly          |
| **IndexedDB initial Table View cache** | < 3s for 1,000 records | < 1.5s for 1,000 records | `expectQueryTime()` helper in tests |
| **Offline → online queue replay**      | < 500ms per action     | < 500ms per action       | Integration test                    |

**Enforcement:** LCP and bundle size budgets are CI-enforced (fail the build if exceeded). Other metrics are monitored via RUM dashboards (see `observability.md > Monitoring Dashboards`) with alerting thresholds.

---

## Biometric Auth Readiness

Biometric authentication is a Capacitor trigger (see decision framework below) but architectural groundwork is laid now.

**Web Authentication API (WebAuthn):** Supported in PWA context on both Android and iOS. Can provide biometric-gated session unlock without Capacitor.

**Two modes (design now, implement when triggered):**

| Mode             | Behavior                                                                           | Use Case                       |
| ---------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| **App lock**     | Biometric prompt on every app open. Session persists but UI is locked.             | Enterprise security policy     |
| **Session lock** | Biometric replaces password/magic-link for re-authentication after session expiry. | Convenience for frequent users |

**What to protect now:**

- Session token storage abstracted behind `SessionStore` interface (localStorage today, Keychain/Keystore via Capacitor later)
- No session token in URL parameters (already enforced by Clerk)
- Auth state check on app foreground event — if session expired, prompt re-auth (biometric or Clerk redirect)

---

## Capacitor Decision Framework

**When to wrap (check quarterly after Post-MVP — Comms & Polish):**

| Trigger                         | Threshold                        | Capacitor Solves                         |
| ------------------------------- | -------------------------------- | ---------------------------------------- |
| iOS push notification issues    | >10% iOS users never install PWA | ✅ Native APNs                           |
| Offline action queue unreliable | Reports of lost edits on iOS     | ✅ Background fetch + native storage     |
| App store presence demanded     | Enterprise deals blocked         | ✅ iOS + Google Play listing             |
| Biometric auth required         | Enterprise security policy       | ✅ Face ID / Touch ID / Keychain         |
| File system access needed       | Bulk file up/download workflows  | ✅ Native file picker + download manager |

**If triggered:** 2–4 week effort (not a rebuild). Web app runs in native WebView. Capacitor plugins provide native push, background fetch, biometrics, file access. Same codebase → web + iOS + Android.

### What to Protect Now

Avoid web APIs that Capacitor can't intercept:

- Use standard `fetch()` for network (Capacitor HTTP plugin intercepts)
- Use IndexedDB for structured data, localStorage for preferences (Capacitor provides native overrides)
- Don't rely on browser-specific PWA features (Web Share Target API, Payment Request API) that wouldn't exist in WebView
- All navigation via Next.js `<Link>` or `router.push` — never `window.open` for internal routes
- Session storage behind `SessionStore` interface (see Biometric Auth Readiness)

---

## Mobile Navigation

### Phone

- **Bottom nav (56px fixed):** My Office, Tasks, Chat, Workspaces, More
- **My Office mobile:** Single column. Order: Tasks (most actionable), Chat, Calendar, Workspaces, Saved.
- **Workspace mobile:** Section list (Table Views grouped by table) → tap → full-screen content. No split view.
- **Back navigation:** System back button / swipe-from-edge. Breadcrumb trail in header for deep navigation.

### Tablet

- **No bottom nav.** Sidebar (64px collapsed) serves as primary navigation.
- **My Office tablet:** Two-column layout. Tasks + Calendar side-by-side.
- **Workspace tablet:** Sidebar list → content area. Side-by-side panels supported.

### Portal Mobile Navigation

- **No bottom nav.** Portal navigation is defined by the portal's page tree.
- **Top bar:** Portal name + logo + hamburger (if multi-page). Branded per portal theme.
- **Single-page portals:** No navigation chrome — just content.
- **Multi-page portals:** Hamburger → slide-in page list.

---

## Mobile Testing Strategy

Beyond "Playwright at 375px width" — mobile-specific behaviors require targeted testing.

### E2E Tests (Playwright, `apps/web/e2e/mobile/`)

| Test                          | What It Validates                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `interface-card-view.spec.ts` | Card rendering, grouping, filtering, tap-to-expand, swipe actions, "+" button placement |
| `kanban-view.spec.ts`         | Column scroll, card drag between columns, count badges                                  |
| `calendar-view.spec.ts`       | Month/week/day rendering, tap-to-create, drag-to-reschedule                             |
| `form-view.spec.ts`           | Field navigation, validation, draft auto-save, submit from thumb zone                   |
| `chat-inbox.spec.ts`          | Thread list, unread badges, swipe-to-mute, swipe-to-mark-read                           |
| `chat-thread.spec.ts`         | Message send, quoted reply, voice message, quick photo, @mention, reactions             |
| `chat-record-thread.spec.ts`  | Record context banner, field change system messages, navigate to record                 |
| `offline-queue.spec.ts`       | Airplane mode → edit → reconnect → sync. Conflict handling. Offline chat queue.         |
| `sw-cache.spec.ts`            | Service Worker install, Table View cache population, cache eviction on budget           |
| `bottom-nav.spec.ts`          | Navigation between all 5 tabs, badge counts, active state                               |
| `portal-mobile.spec.ts`       | Portal form submission, magic link flow, branded PWA manifest, portal chat              |
| `notification-mobile.spec.ts` | Push permission prompt, fallback to email, quiet hours, notification grouping           |
| `tablet-grid.spec.ts`         | Inline cell editing at tablet width, side-by-side panels, toolbar                       |
| `tablet-split-screen.spec.ts` | App at 512px width (iPad split), verify phone layout activates                          |
| `deep-link.spec.ts`           | Link from email → correct route, auth redirect if needed                                |
| `touch-gestures.spec.ts`      | Swipe left/right, long press, pull-to-refresh, shake-to-undo                            |
| `scan-ocr.spec.ts`            | Barcode decode (mock camera), OCR flow (mock AI response), field mapping                |
| `input-modes.spec.ts`         | Number field → `inputMode="decimal"`, date → calendar picker, etc.                      |
| `thumb-zone.spec.ts`          | Primary actions in bottom 40%, destructive in top 30%, bottom bar position              |
| `maps-view.spec.ts`           | Pin display, bottom sheet record card, navigate-to action                               |

### Unit Tests

| Test                             | What It Validates                                                             |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Offline queue serialization      | Actions serialize/deserialize correctly to IndexedDB. Chat messages included. |
| Cache eviction logic             | LRU eviction respects budget, evicts correct Table View                       |
| Notification tier classification | Events map to correct tier and channel set                                    |
| Notification grouping            | Same-record updates within 5min collapsed, chat batching                      |
| Portal manifest generation       | Manifest JSON matches portal config, icons generated                          |
| Input mode mapping               | Every field type returns correct `inputMode` or picker type                   |
| Chat topic grouping              | AI divider insertion at correct message threshold, topic boundaries           |
| Read receipt visibility          | Admin default + user override logic, group thread suppression                 |
| Scan template matching           | Template auto-applies to similar documents, field mapping correct             |
| Voice transcription flow         | Audio → AI → transcript stored alongside message                              |
| Adaptive UI signals              | Frequently accessed Table Views correctly ranked, recency weighted            |

### Manual Test Checklist (Per Release)

Automated tests can't catch everything on real devices. Before each release:

- [ ] iOS Safari PWA: install from "Add to Home Screen", verify standalone mode
- [ ] iOS PWA: background app, return — verify Socket.io reconnects and catch-up query fires
- [ ] Android PWA: push notification received, tapped, navigates to correct record
- [ ] iOS PWA: push notification (requires home screen install)
- [ ] Offline: airplane mode, edit 3 records, reconnect — all 3 sync without data loss
- [ ] Offline chat: send 3 messages offline, reconnect — all 3 delivered in order
- [ ] Portal: open portal link on phone, submit form, verify record created
- [ ] Tablet: grid view with inline editing, verify touch targets ≥ 44px
- [ ] Tablet: external keyboard attached — verify keyboard shortcuts work
- [ ] Tablet: iPad Split View at 50% — verify phone layout activates
- [ ] Chat: send photo from camera, verify immediate delivery
- [ ] Chat: record voice message, verify transcription appears
- [ ] Chat: swipe-to-reply, quoted context displays correctly
- [ ] OCR: scan business card, verify field mapping prompt appears
- [ ] Barcode: scan barcode, verify record lookup
- [ ] Number field: verify large number pad appears (no QWERTY)
- [ ] Date field: verify calendar picker (not native date input)
- [ ] One-handed: complete create → edit → status change → chat message flow with right thumb only
- [ ] Pull to refresh: card view, chat inbox, calendar view

---

## Phase Implementation

Mobile work lands **with each feature**, not retroactively. Every phase includes its mobile surface.

| Phase                                      | Mobile Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MVP — Foundation**                       | Responsive CSS for all shell components. Mobile bottom nav. Tablet sidebar (64px collapsed). Touch targets (44/48/56px per zone). Thumb zone layout rules enforced. One-handed use design constraint applied to shell. Three Playwright viewport configs (phone/tablet/desktop) + split-screen (512px). `SessionStore` interface. Field type `inputMode` mapping in renderer spec. Pull-to-refresh on scrollable views. No offline yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **MVP — Core UX**                          | **Card view** as primary mobile view — grouping, filtering, sorting, swipe actions, card badges. **Form view** with field-by-field navigation, draft auto-save, thumb-zone submit. Inline grid editing on tablet. Record view: full-screen sheet (phone), modal (tablet). IndexedDB schema for Table View working set cache. Mobile input optimization for all 40 field types (inputMode, pickers, action sheets). **Signature field type.** Mobile E2E test suite (20+ specs).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Post-MVP — Portals & Apps (View Types)** | **Kanban view** on mobile (horizontal swipe between columns). **Calendar view** (month/week/day). Kanban and Calendar views are post-MVP per GLOSSARY.md:678.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Post-MVP — Portals & Apps**              | Service Worker precache. Table View working set cache (full offline). Portal PWA manifest generation (Professional+). Portal mobile form flow. Portal service worker (separate scope). Portal offline. Deep link URL structure. **Camera capture + photo annotation** in attachment fields. **Barcode/QR scanning** (client-side, zxing-js). **Document scanning + OCR** (AI pipeline, field mapping UI, scan templates). **Bulk photo capture.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Post-MVP — Comms & Polish**              | **Mobile chat & messaging** — full Chat tab inbox, thread view, record threads with field change context, DM/group chat, voice messages with AI transcription, @mentions, reactions, read receipts (admin default + user override), AI topic grouping, AI actionable messages (opt-in), chat search, portal client chat, chat offline queue. Offline action queue (platform). Notification routing engine (tiers, channels, quiet hours, batching, grouping). Push notifications. **Maps & geolocation** — location capture, address autocomplete, map view (pins + bottom sheet + navigation to Waze/Google Maps). **Voice input & dictation** (speech-to-text in fields + chat). **AI personalization** — adaptive UI (local) + opt-in AI suggestions. **Mobile payments** (Apple Pay / Google Pay via Stripe Payment Request API). **In-app support** in user's language. PWA install flow. Performance budget CI. Quick actions (PWA manifest shortcuts). Capacitor evaluation. |
| **Post-MVP**                               | Capacitor wrapping (if triggered). Biometric auth (app lock / session lock). Tablet builder tools. Native file picker. App store submission. Share sheet integration (inbound). Home screen widgets (Capacitor). Wearable notifications (Capacitor). NFC scanning (Capacitor). GPS tracking for field workers. Route planning (multi-stop). Voice-to-record creation (AI). Offline map tile caching evaluation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

---

## Cross-References

- Responsive component matrix: `design-system.md > Responsive Architecture`
- Thumb zone + one-handed rules: `design-system.md > Ergonomic Design Constraints`
- Field type renderer spec (inputMode): `apps/web/src/components/CLAUDE.md`
- Sync conflict mobile UX: `sync-engine.md > Mobile Conflict UX`
- Portal auth and data_scope: `gaps/portals-client-auth.md`
- Portal page view limits: `gaps/portals-client-auth.md > Portal Client Limits`
- Chat delivery infrastructure: `realtime.md > Chat Message Delivery`
- Record Thread and Chat architecture: `communications.md` (when created)
- Notification delivery infrastructure: `realtime.md`
- AI capability tiers and credit system: `ai-architecture.md`, `ai-metering.md`
- File upload pipeline (photo/annotation storage): `files.md`
- tsvector indexing (chat search): `database-scaling.md > tsvector Indexing Strategy`
- Observability dashboards for mobile metrics: `observability.md > Monitoring Dashboards`
- Performance testing: `testing.md > Performance Regression Testing`
- Stripe payments: Post-MVP — Comms & Polish playbook
- i18n architecture: Root `CLAUDE.md` Rule 20, `apps/web/CLAUDE.md` Rule 6
