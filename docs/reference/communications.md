# EveryStack — Communications

> **Reference doc.** Record Thread, DMs, Chat Quick Panel, Chat Editor (TipTap env 1), @mentions, notifications, presence.
> See `GLOSSARY.md` for concept definitions (Record Thread, Quick Panel, Chat Editor).
> Cross-references: `data-model.md` (threads, thread_messages, thread_participants schema), `tables-and-views.md` (Record View + Record Thread layout), `my-office.md` (Chat widget / Quick Panel), `email.md` (email architecture — separate from chat)
> Last updated: 2026-02-27 — Aligned with GLOSSARY.md. Scoped to MVP: Record Thread + DMs + group DMs. Removed base/table thread scopes (post-MVP). Removed omnichannel external messaging (Post-MVP — Custom Apps & Live Chat). Removed activity logging (Post-MVP — Comms & Polish). Removed slash commands in chat. Preserved Chat Editor spec and notification system.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                             | Lines   | Covers                                                                                                                                                                            |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MVP Scope                           | 29–55   | Record Thread, DMs, group DMs; what's post-MVP                                                                                                                                    |
| Thread Scopes (MVP)                 | 57–113  | Record Thread, DMs, thread data model (threads, thread_messages, thread_participants)                                                                                             |
| Threaded Replies                    | 115–128 | Reply-to-parent pattern, participant auto-add, unread markers                                                                                                                     |
| Chat Navigation                     | 130–146 | Hierarchical sidebar for self-referential records, tree dropdown in Record Thread                                                                                                 |
| Pinned, Bookmarks & Presence        | 148–182 | Pinned messages, saved/bookmarked messages, presence indicators, DND/status                                                                                                       |
| Notification Aggregation & Delivery | 184–292 | Data model (notifications table), 8 notification types, delivery pipeline (in-app + push + email digest), API, error handling                                                     |
| Chat Editor (TipTap Env 1)          | 294–415 | Input states, progressive disclosure, keyboard shortcuts, @mentions, markdown shortcuts, bubble toolbar, link handling, attachments, message display/edit/delete, emoji reactions |
| Messaging Error Handling            | 417–432 | Optimistic send, retry logic, failed message UX                                                                                                                                   |
| Emoji Picker                        | 434–440 | emoji-mart, colon autocomplete, skin tone, search                                                                                                                                 |
| Post-MVP Expansion                  | 442–458 | Activity feed, slash commands, base/table threads, omnichannel                                                                                                                    |

---

## MVP Scope

**What ships:**

- Record Thread (contextual comments on records)
- DMs (1:1 direct messages between workspace members)
- Group DMs (3–8 people)
- Chat Quick Panel (unified feed in sidebar)
- Chat Editor (TipTap lightweight editor for all messaging)
- @mentions with notifications
- Threaded replies
- Presence (online/away/DND/offline)
- In-app notification aggregation
- Emoji reactions (JSONB schema designed, UI ships MVP)
- Pinned messages
- Bookmarks / saved messages

**What's post-MVP:**

- Base-scoped threads (workspace-wide conversations)
- Table-scoped threads
- Omnichannel external messaging (WhatsApp, Telegram, Messenger, Viber — Post-MVP — Custom Apps & Live Chat)
- Activity logging in record threads (call/meeting/note/email log entries — Post-MVP — Comms & Polish)
- Slash commands in chat (`/remind`, `/todo`, `/poll`, etc.)
- Rich link unfurls (Open Graph metadata cards)
- Custom workspace emoji
- Email digest notifications (hourly/daily batching)

---

## Thread Scopes (MVP)

| scope_type | Participants                                             | Use Case                                 |
| ---------- | -------------------------------------------------------- | ---------------------------------------- |
| `record`   | Thread participants + portal clients (if client_visible) | Contextual comments on a specific record |
| `dm`       | 2 users (1:1)                                            | "Quick question about the client dinner" |
| `group_dm` | 3–8 users (fixed cap)                                    | "Design team sync"                       |

**Post-MVP scopes:**

| scope_type | Participants                          | Phase |
| ---------- | ------------------------------------- | ----- |
| `base`     | Workspace members with base access    | 7     |
| `table`    | Workspace members with table access   | 7     |
| `external` | Workspace members ↔ external contacts | 9     |

### Record Thread

The Record Thread is a **contextual conversation attached to a record**. Every record in every table has an implicit thread. The thread activates when someone posts the first message.

**Where it appears:**

- **Record View overlay:** Click chat icon → Record Thread opens alongside at 25% width. See `tables-and-views.md` > Record View.
- **Mobile:** Bottom tab contextual swap — "Thread" tab on record detail. See `mobile.md`.
- **Chat Quick Panel:** Record thread notifications appear in the Chat feed.

**Visibility:** Threads default to `internal` (workspace members only). Manager can mark a thread as `client_visible` — portal clients with access to that record can then see and post to it.

### DMs

DMs are workspace-scoped (you DM a teammate within a workspace context).

**1:1 DMs:** `scope_id` is a deterministic hash of sorted participant user_ids — ensures one thread per pair regardless of who initiates.

**Group DMs:** `scope_id` is a generated UUID. User-editable group name. **Fixed 3–8 participants** — larger conversations should use record-scoped threads.

**DM surfaces:** Chat Quick Panel feed, dedicated DM section in Chat panel.

### Data Model

**`threads` table:** `scope_type`, `scope_id`, `tenant_id`, `visibility` (internal | client_visible), `name` (nullable — for group_dm display), `created_by`, `created_at`.

**`thread_participants` table:** `thread_id`, `user_id`, `joined_at`, `last_read_at` (unread tracking), `muted` (boolean). Required for DMs/group DMs (defines membership). For record threads, explicit entries created on first interaction for unread tracking.

**`thread_messages` table:** `thread_id`, `author_id` (nullable — null for system messages), `author_type` (user | portal_client | system), `content` (TipTap JSON), `parent_message_id` (nullable — threaded replies), `mentions` (JSONB), `attachments` (JSONB), `reactions` (JSONB), `pinned_at` (nullable), `pinned_by` (nullable), `edited_at` (nullable), `deleted_at` (nullable — soft delete), `created_at`.

**`thread_messages.message_type` enum:**

| Value     | Purpose                                    |
| --------- | ------------------------------------------ |
| `message` | Standard user message                      |
| `system`  | System-generated (join, pin, field change) |

Post-MVP additions: `activity_log`, `email_outbound`, `email_inbound`.

**System message behavior:** System messages (`message_type = 'system'`) are auto-generated by the platform — not authored by users. They have `author_type = 'system'` and a null `author_id`. Examples: user joined thread, message pinned, linked record field changed. Content is a structured TipTap JSON node with a `system_event` type (e.g., `{type: "system_event", event: "user_joined", actor_id: "...", timestamp: "..."}`). Rendered as centered, muted-text timeline entries — visually distinct from user messages. System messages cannot be edited, replied to, or reacted to.

---

## Threaded Replies

Messages can be replies to a parent message within a thread. `parent_message_id` (nullable) — when null, top-level; when set, it's a reply.

**UX (Progressive Disclosure):**

- **Level 1 — Flat timeline (default):** Messages chronological. Messages with replies show chip: "3 replies · last 2h ago".
- **Level 2 — Expand replies:** Click chip → opens reply chain in side panel (360px). New replies compose at bottom.

**Reply notification rules:**

- **Notified:** Parent message author + explicit thread followers + @mentioned users. NOT all thread participants.
- **Auto-follow:** Posting in a thread auto-follows it. Unfollow via thread menu.
- **Follow button:** Bell icon on any thread to follow without posting.

---

## Hierarchical Chat Navigation

Tables with a self-referential linked record field get hierarchical chat navigation. The Record Thread panel includes a **dropdown picker** at the top for navigating the record tree without leaving chat context.

**Dropdown layout:**

- Parent record (top) — click to navigate up
- Current record (highlighted) + siblings — each with unread indicator (teal dot + count)
- Children of current record — each with unread indicators

**Hierarchical unread rollup:**

- **One level up only:** Parent record shows aggregate unread badge from direct child threads.
- **No deeper recursion.** Covers the key case: "My project has 12 unread messages across tasks."
- **Implementation:** Materialized counter on parent's thread, incremented on child message events.

**Applies to:** Any table with a self-referential linked record field. Auto-detected, no configuration.

---

## Pinned Messages

Any message can be pinned to its thread. Accessible via 📌 icon in thread header.

- Multiple pins per thread, most-recent first.
- Pin/unpin via hover menu (⋯). Members pin in their threads. Manager+ pins anywhere.
- System message on pin: "📌 Sarah pinned a message" with preview.

---

## Bookmarks / Saved Messages

Users bookmark any message for personal reference. Private — no one else sees.

- `user_saved_messages` table: `id`, `user_id`, `message_id`, `tenant_id`, `note` (nullable — personal annotation), `saved_at`.
- Save via hover menu (⋯ → Save message).
- Access: My Office Saved widget, Command Bar search.

---

## Presence & Status

Real-time presence via WebSocket heartbeat + Redis.

**Presence states:** Online (green dot), Away (yellow — 5min idle), Do Not Disturb (red — mutes notifications), Offline (gray).

**Custom status:** Optional emoji + text (e.g., "🏖 On vacation until Feb 15"). Auto-clear options: 1h, 4h, today, this week, custom date.

**Where presence shows:** Avatars everywhere — sidebar, @mention dropdown, DM list, thread participants.

**Storage:** Presence in Redis (ephemeral, TTL heartbeat). Custom status in `workspace_memberships`: `status_emoji`, `status_text`, `status_clear_at`.

**DND behavior:** Suppresses all notifications except direct @mentions from Owners. "Notify anyway" option on DMs to DND users.

---

## Notification Aggregation & Delivery

### Data Model

**`notifications` table** (per `data-model.md`):

| Column              | Type                                  | Purpose                                                    |
| ------------------- | ------------------------------------- | ---------------------------------------------------------- | ------------ | -------------- | -------- | ---------- |
| `id`                | UUID                                  | Primary key                                                |
| `user_id`           | UUID (FK → users)                     | Notification recipient                                     |
| `tenant_id`         | UUID (FK → tenants)                   | Workspace scope (notifications are workspace-scoped)       |
| `type`              | VARCHAR                               | Notification category (see Notification Types below)       |
| `title`             | VARCHAR                               | Short display text: "Sarah mentioned you in Project Alpha" |
| `body`              | VARCHAR (nullable)                    | Optional preview text (first 120 chars of message content) |
| `source_type`       | VARCHAR                               | `'thread_message'`                                         | `'approval'` | `'automation'` | `'sync'` | `'system'` |
| `source_thread_id`  | UUID (nullable, FK → threads)         | Thread context for navigation                              |
| `source_message_id` | UUID (nullable, FK → thread_messages) | Specific message for deep-link                             |
| `source_record_id`  | UUID (nullable)                       | Record context for approval/automation notifications       |
| `actor_id`          | UUID (nullable, FK → users)           | Who triggered the notification (null for system)           |
| `group_key`         | VARCHAR (nullable)                    | Dedup/collapse key: e.g., `thread:{threadId}` for grouping |
| `read`              | BOOLEAN (default false)               | Read state                                                 |
| `read_at`           | TIMESTAMP (nullable)                  | When marked read                                           |
| `created_at`        | TIMESTAMP                             |                                                            |

**Indexes:** `(user_id, tenant_id, read, created_at DESC)` — primary query: unread notifications for bell icon. `(user_id, tenant_id, created_at DESC)` — notification tray pagination. `(group_key, created_at)` — collapse grouping.

**Retention:** 90 days. Nightly cleanup job deletes older rows.

**`user_notification_preferences` table** (per `data-model.md`):

`preferences` JSONB structure:

```typescript
interface NotificationPreferences {
  // Per-category toggles
  mentions: { inApp: boolean; email: 'instant' | 'digest' | 'off' };
  dms: { inApp: boolean; email: 'instant' | 'digest' | 'off' };
  threadReplies: { inApp: boolean; email: 'instant' | 'digest' | 'off' };
  approvals: { inApp: boolean; email: 'instant' | 'digest' | 'off' };
  automationFailures: { inApp: boolean; email: 'instant' | 'digest' | 'off' };
  syncErrors: { inApp: boolean; email: 'instant' | 'digest' | 'off' };
  // Global
  digestFrequency: 'hourly' | 'daily' | 'off'; // When email mode is 'digest'
  muteSchedule: { enabled: boolean; start: string; end: string; timezone: string }; // "Do not disturb"
}
```

Defaults: `mentions` and `dms` — inApp: true, email: 'instant'. All others — inApp: true, email: 'digest'. `digestFrequency`: 'daily'.

### Notification Types

| Type                 | Source                                    | Template Example                                  |
| -------------------- | ----------------------------------------- | ------------------------------------------------- |
| `mention`            | @mention in thread message                | "{actor} mentioned you in {threadName}"           |
| `dm`                 | New DM or group DM message                | "{actor} sent you a message"                      |
| `thread_reply`       | Reply to a thread user participates in    | "{actor} replied in {threadName}"                 |
| `approval_requested` | Approval workflow                         | "Approval requested: {recordTitle}"               |
| `approval_decided`   | Approval workflow                         | "{recordTitle} was approved by {actor}"           |
| `automation_failed`  | Automation execution error                | "Automation '{automationName}' failed"            |
| `sync_error`         | Sync engine error                         | "Sync error on {connectionName}: {errorCategory}" |
| `system`             | Platform-level (plan limits, maintenance) | "You've used 80% of your AI credits this month"   |

### Delivery Pipeline

```
Event occurs (message sent, approval requested, etc.)
  → NotificationService.create({ userId, tenantId, type, title, ... })
  → Insert into `notifications` table
  → Check user_notification_preferences
  → If inApp enabled:
      → Publish to Redis channel: `user:{userId}:notifications`
      → Client receives via Socket.IO → bell badge increments
  → If email = 'instant':
      → Enqueue BullMQ job: `notification.email.send`
      → Worker sends via Resend (see email.md)
  → If email = 'digest':
      → No immediate action. Digest job runs on schedule.
```

**Bell icon (🔔) delivery:** The bell badge shows a count of unread notifications. On click, opens the notification tray (right-aligned dropdown, max 400px wide, max 480px tall, scrollable). Real-time updates via Socket.IO — when a new notification is published to the user's Redis channel, the client receives the notification payload and prepends it to the tray without page refresh.

**Smart grouping:** Multiple notifications with the same `group_key` within 5 minutes collapse in the tray display. Example: "Sarah, James, and 2 others commented on Project Alpha thread." The individual notification rows still exist in the database (for read tracking), but the tray renders them as one grouped item. Grouping is client-side using `group_key` and `created_at` proximity.

**Priority override:** `mention` and `dm` type notifications always deliver immediately (in-app and email) regardless of mute schedule or digest settings. Users can disable this per-category in preferences, but it's opt-out, not opt-in.

**Per-thread mute:** `thread_participants.muted` suppresses `thread_reply` notifications for that thread. Thread still shows unread count in the sidebar but doesn't push to bell or email. `mention` notifications in muted threads still deliver (you explicitly called this person).

### Notification API

| Endpoint                          | Method  | Purpose                                                                          |
| --------------------------------- | ------- | -------------------------------------------------------------------------------- |
| `/api/notifications`              | GET     | Paginated notification list. Params: `read` (boolean filter), `limit`, `cursor`. |
| `/api/notifications/unread-count` | GET     | Returns `{ count: number }`. Used by bell badge. Cached in Redis (5s TTL).       |
| `/api/notifications/{id}/read`    | PATCH   | Mark single notification as read.                                                |
| `/api/notifications/read-all`     | PATCH   | Mark all notifications as read for current workspace.                            |
| `/api/notifications/preferences`  | GET/PUT | Read or update notification preferences.                                         |

### Error Handling

| Scenario                             | Behavior                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Notification insert fails (DB error) | Log error. Do not block the originating action (message send, approval). Notification is best-effort.                                   |
| Redis publish fails                  | Notification exists in DB. Client will see it on next tray open (DB query fallback). Log warning.                                       |
| Email send fails                     | BullMQ retry with exponential backoff (3 attempts, 1min/5min/15min). After 3 failures, mark as failed in job log. Do not retry further. |
| Notification for deleted user        | Skip silently. `user_id` FK is not cascade-delete — cleanup job removes orphaned notifications nightly.                                 |

**Email notifications (MVP):** `mention` and `dm` types support instant email delivery via Resend (see `email.md`). All other types default to digest-only email. Full email notification support for all types ships in Post-MVP — Comms & Polish.

---

## Chat Editor (TipTap Environment 1)

The Chat Editor is the lightweight TipTap instance for all messaging. Looks and feels like a chat input — not a document editor. Progressive disclosure: new user sees simple text input; power user has formatting, mentions, and markdown.

### Input States & Transitions

Three states: **Compact** (single-line), **Focused** (compact + active), **Expanded** (paragraph mode).

- **Compact → Focused:** Click or keyboard focus. Border highlights teal. Action icons appear (📎 attach, ↕ expand, 😊 emoji).
- **Focused → Expanded:** `Shift+Enter`, click ↕, or paste multi-line. Input grows (min 80px, max 240px before scroll). Cancel/Send buttons appear.
- **Expanded → Compact:** Cancel, Escape (confirm if content), or send. Clears and collapses.
- **Focused → Compact:** Blur with empty input. Content prevents accidental collapse.

### Progressive Disclosure Levels

| Level             | What's Visible                                                    | How Accessed                       |
| ----------------- | ----------------------------------------------------------------- | ---------------------------------- |
| **L1 — Default**  | Single-line input, Enter to send, attach, emoji                   | Start typing                       |
| **L2 — Expanded** | Bubble toolbar (B/I/U/Link/Bullets/Numbers), Cancel/Send, @people | Select text, type `@`, Shift+Enter |
| **L3 — Power**    | Markdown shortcuts, full keyboard shortcuts                       | Just know them                     |

### Keyboard Shortcuts

| Shortcut                | State           | Action                        |
| ----------------------- | --------------- | ----------------------------- |
| `Enter`                 | Compact/Focused | Send message                  |
| `Shift+Enter`           | Compact/Focused | Expand to paragraph mode      |
| `Enter`                 | Expanded        | New line                      |
| `Cmd+Enter`             | Expanded        | Send message                  |
| `Escape`                | Expanded        | Collapse (confirm if content) |
| `↑`                     | Focused (empty) | Edit last sent message        |
| `Tab`                   | In list         | Indent list item              |
| `Shift+Tab`             | In list         | Outdent list item             |
| `Cmd+B/I/U`             | Any             | Bold / Italic / Underline     |
| `Cmd+K`                 | Any             | Insert/edit link              |
| `Cmd+Z` / `Cmd+Shift+Z` | Any             | Undo / Redo                   |

### @Mention System

Typing `@` triggers contextual autocomplete dropdown:

**Dropdown layout (top to bottom):**

1. **People** (primary): Avatar + display name + role badge. Fuzzy-filtered as user types. Arrow keys + Enter to select.
2. **Notify Group** (divider below people): `@here` (all thread participants, any role), `@channel` (all members with scope access, Manager+ only).

**Contextual filtering:**

- Record thread: Workspace members + portal clients (if client_visible)
- DM/Group DM: Participants only

**Rendering:** Selected mention → teal pill (`@Sarah Chen`), non-editable inline. Backspace deletes whole pill.

### Markdown Shortcuts (Auto-converted to rich text)

- `**text**` → bold
- `*text*` → italic
- `~~text~~` → strikethrough
- `` `text` `` → inline code
- `- ` or `* ` at line start → bullet list
- `1. ` at line start → ordered list
- `> ` at line start → blockquote

### Bubble Toolbar (on text selection in expanded mode)

`B` | `I` | `U` | `🔗` | `•` | `1.` — six items only. Strikethrough, code, blockquote via markdown shortcuts.

### Link Handling

- Auto-detect URLs on paste/type → clickable link
- Display: inline link text, no rich preview (keeps messages lightweight)
- `Cmd+K`: link insertion dialog (URL + optional display text)

### What's NOT Supported (Deliberate)

- No headings (chat, not docs)
- No images inline (attach button → thumbnail below message)
- No tables, code blocks, embeds
- No TipTap slash menu (conflicts with Command Bar)
- No collaboration/Yjs (messages are atomic)

### TipTap Extensions Loaded

Bold, Italic, Underline, Strike, Code (inline marks), BulletList, OrderedList, Blockquote, Link, Mention (custom), Placeholder, History, InputRules.

### Attachments

- 📎 button in input bar
- Images (thumbnail preview below message), files (icon + name + size)
- Drag-and-drop onto input area
- Uploaded to S3/R2, referenced in `thread_messages.attachments` JSONB
- Max file size per plan tier

### Message Display

- Sent messages: TipTap JSON → styled HTML in chat feed
- **Read-only rendering** — no editor instances for displayed messages. Pure HTML + CSS. Thread with 200 messages = 200 HTML renders, not 200 editor instances.

### Message Editing

- Hover menu (⋯ → Edit) — always available for own messages
- `↑` in empty input → edit last sent message (power user, Slack convention)
- Inline editor replaces rendered message. Save (`Cmd+Enter`) / Cancel (`Escape`).
- Shows "(edited)" gray text. No time restriction. No edit history.

### Message Deletion

- Soft delete. Shows "This message was deleted" placeholder.
- Users delete own messages. Manager+ deletes any message.

### Emoji Reactions

- Emoji chips below message. Click to add/remove. "+" for emoji picker.
- Stored in `thread_messages.reactions` JSONB: `{ "👍": ["user_id_1", "user_id_2"] }`
- Library: `emoji-mart`. Categories: Frequently Used, Smileys, People, etc. Skin tone selector.

### Where Chat Editor Is Used

- Record Thread (alongside Record View)
- DMs and Group DMs (Chat Quick Panel)
- My Office Chat widget (reply inline)
- Portal client messages (client_visible threads)

---

## Messaging Error Handling

| Scenario                              | Client behavior                                                                                                                                       | Server behavior                                                                        |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **Message send fails (network)**      | Message shows "failed to send" state (red outline, retry icon). Tap/click to retry. Message stays in composer until confirmed sent.                   | No server action needed — message never arrived.                                       |
| **Message send fails (server error)** | Same "failed to send" state. After 3 retries (1s, 3s, 10s), show: "Message could not be sent. Tap to retry."                                          | Log error with `traceId`. Return 500 to client.                                        |
| **Message send fails (permission)**   | Toast: "You no longer have access to this thread." Remove thread from sidebar.                                                                        | Return 403. Log `permission_denied` audit event.                                       |
| **Attachment upload fails**           | Inline error on the attachment thumbnail: "Upload failed — tap to retry." Message can still be sent without the failed attachment.                    | Return upload error. Do not create partial `thread_messages` row.                      |
| **Attachment too large**              | Client-side validation before upload: "File exceeds 25MB limit." File rejected, not queued.                                                           | Never reaches server. Limit enforced client-side + server-side (reject at middleware). |
| **@mention resolution fails**         | Mention pill renders as `@Unknown User` in gray. Notification still attempts delivery using stored user_id.                                           | Log warning. Do not block message creation.                                            |
| **Thread not found (deleted/moved)**  | Redirect to parent context (record, DM list) with toast: "This conversation is no longer available."                                                  | Return 404.                                                                            |
| **Real-time delivery fails**          | Message persisted to DB first. Client receives on next poll/reconnect. No data loss.                                                                  | Redis pub/sub is fire-and-forget. Message exists in DB as fallback.                    |
| **Concurrent edit conflict**          | Last-write-wins for message edits (rare case — only author can edit). No merge. Stale edit toast: "Message was updated. Your changes were not saved." | Compare `edited_at` timestamp. Reject if stale.                                        |
| **Rate limiting on message send**     | Toast: "You're sending messages too quickly. Please slow down." Composer disabled for 5 seconds.                                                      | 30 messages/minute per user per thread. Return 429.                                    |

---

## Emoji Picker

Library: `emoji-mart` (React). Triggered by 😊 button or `:` colon autocomplete (`:thu` → 👍).

Categories: Frequently Used (personalized), Smileys, People, Animals, Food, Travel, Activities, Objects, Symbols, Flags. Search bar. Skin tone selector.

---

## Post-MVP Expansion

**Post-MVP — Comms & Polish — Advanced Communications:**

- Base-scoped and table-scoped threads
- Activity logging in record threads (call/meeting/note/email structured entries)
- Slash commands in chat (`/remind`, `/todo`, `/poll`, `/status`)
- Rich link unfurls (Open Graph metadata cards)
- Email digest notifications (hourly/daily batching)
- Connected inbox integration (email threads in Chat — see `email.md`)

**Post-MVP — Custom Apps & Live Chat — Omnichannel:**

- External messaging (WhatsApp, Telegram, Messenger, Viber)
- External contacts CRM auto-linking
- Channel connections management
- AI auto-responses from knowledge base
- Platform-specific constraints (24h messaging windows, business verification)
- Usage-based messaging pricing (pass-through + markup)
