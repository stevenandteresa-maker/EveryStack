# Subdivision Doc: 3C — Record Thread, DMs, Notifications & System Email

## Big-Picture Anchor

Phase 3C delivers the MVP communications backbone: contextual Record Threads (two-thread model with internal "Team Notes" and client "Client Messages"), DMs and group DMs, a lightweight TipTap Chat Editor, real-time presence, an in-app notification pipeline with system email delivery via Resend, and the Chat Quick Panel as a unified feed. When complete, users can converse contextually on any record, message teammates directly, and receive aggregated notifications across their workspace — the missing conversational layer that turns EveryStack from a data browser into a collaborative workspace. This sub-phase depends on the Record View from 3A-ii (where threads attach), the thread_type schema migration from 1J, and the real-time + worker infrastructure from 1G. It unlocks portal client messaging in 3E-i, the My Office Chat widget in 3G-ii, and the notification pipeline consumed by automations in Phase 4+.

### Seam Analysis

**Primary seam: Data → Service/Infrastructure → UI layers.** The sub-phase touches all three layers with distinct concerns at each.

**Secondary seams within layers:**

1. **Thread/Message domain vs. Notification domain** — Thread CRUD and notification delivery are separate data models, separate service concerns, and separate UI surfaces. The notification pipeline is triggered by message events but is architecturally independent (its own table, its own delivery pipeline, its own BullMQ queue).

2. **Real-time + Presence as infrastructure** — Socket.IO event handlers, presence heartbeat, and Redis pub/sub are shared infrastructure consumed by both the thread UI and the notification UI. This forms a natural service-layer unit.

3. **TipTap Chat Editor as standalone component** — The Chat Editor is a self-contained UI component (TipTap extensions, progressive disclosure states, @mention system, emoji picker) consumed by multiple surfaces (Record Thread, DMs, Chat Quick Panel, and later portals). No unit-to-unit dependencies — only library dependencies.

4. **Thread UI vs. Notification/Quick Panel UI** — The Record Thread panel, DM views, and thread navigation are one UI concern; the notification bell/tray and Chat Quick Panel sidebar are another. They share the real-time infrastructure but are otherwise independent.

**Result: 6 units** — 1 data layer, 2 service/infrastructure, 1 standalone UI component, 2 feature UI surfaces.

## Dependency Graph

```
Unit 4: Chat Editor (TipTap Env 1) ─────────────────────────────┐
  (no unit deps — parallel with all)                             │
                                                                 │
Unit 1: Schema Migration & Thread/Message Data Layer             │
  ↓                    ↓                                         │
Unit 2: Notification   Unit 3: Presence &                        │
Pipeline & System      Real-Time Chat                            │
Email                  Infrastructure                            │
  │                      ↓            ↓                          │
  │                 Unit 5: Record Thread & DM UI ←──────────────┘
  │                 (consumes Units 1, 3, 4)
  ↓                      ↓
Unit 6: Notification UI & Chat Quick Panel
(consumes Units 2, 3, 5)
```

**Parallel opportunities:** Units 2, 3, and 4 can all run concurrently after Unit 1 completes (Unit 4 can even start before Unit 1).

**Critical path:** Unit 1 → Unit 3 → Unit 5 → Unit 6 (depth: 4).

---

### Unit 1: Schema Migration & Thread/Message Data Layer

**Big-Picture Anchor:** This unit establishes the data foundation for all communications. It delivers the `source_note_id` schema migration on `thread_messages`, all thread/message/participant/bookmark/pin CRUD functions with tenant isolation, DM thread creation with deterministic scope_id, and test factories. Every subsequent unit consumes these types and functions.

**Produces:**

- Migration: `XXXX_add_source_note_id_to_thread_messages.ts` — `ALTER TABLE thread_messages ADD COLUMN source_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL` with partial index
- `createThread(tenantId, params: CreateThreadParams): Promise<Thread>` — from `apps/web/src/data/threads.ts`
- `getThread(tenantId, threadId): Promise<Thread | null>` — from `apps/web/src/data/threads.ts`
- `getThreadByScope(tenantId, scopeType, scopeId, threadType?): Promise<Thread | null>` — from `apps/web/src/data/threads.ts`
- `listThreadsForUser(tenantId, userId, opts: PaginationOpts): Promise<PaginatedResult<ThreadWithLastMessage>>` — from `apps/web/src/data/threads.ts`
- `createMessage(tenantId, params: CreateMessageParams): Promise<ThreadMessage>` — from `apps/web/src/data/thread-messages.ts`
- `getMessages(tenantId, threadId, opts: MessageListOpts): Promise<PaginatedResult<ThreadMessage>>` — from `apps/web/src/data/thread-messages.ts`
- `editMessage(tenantId, messageId, content): Promise<ThreadMessage>` — from `apps/web/src/data/thread-messages.ts`
- `deleteMessage(tenantId, messageId, userId): Promise<void>` — soft delete, from `apps/web/src/data/thread-messages.ts`
- `addParticipant(tenantId, threadId, userId): Promise<ThreadParticipant>` — from `apps/web/src/data/thread-participants.ts`
- `removeParticipant(tenantId, threadId, userId): Promise<void>` — from `apps/web/src/data/thread-participants.ts`
- `listParticipants(tenantId, threadId): Promise<ThreadParticipant[]>` — from `apps/web/src/data/thread-participants.ts`
- `updateLastRead(tenantId, threadId, userId): Promise<void>` — from `apps/web/src/data/thread-participants.ts`
- `getUnreadCounts(tenantId, userId): Promise<Record<string, number>>` — from `apps/web/src/data/thread-participants.ts`
- `getOrCreateDMThread(tenantId, userId1, userId2): Promise<Thread>` — deterministic scope_id, from `apps/web/src/data/threads.ts`
- `createGroupDM(tenantId, creatorId, participantIds, name?): Promise<Thread>` — 3-8 cap enforced, from `apps/web/src/data/threads.ts`
- `pinMessage(tenantId, messageId, userId): Promise<void>` — from `apps/web/src/data/thread-messages.ts`
- `unpinMessage(tenantId, messageId): Promise<void>` — from `apps/web/src/data/thread-messages.ts`
- `getPinnedMessages(tenantId, threadId): Promise<ThreadMessage[]>` — from `apps/web/src/data/thread-messages.ts`
- `saveMessage(tenantId, userId, messageId, note?): Promise<UserSavedMessage>` — from `apps/web/src/data/saved-messages.ts`
- `unsaveMessage(tenantId, userId, messageId): Promise<void>` — from `apps/web/src/data/saved-messages.ts`
- `listSavedMessages(tenantId, userId, opts: PaginationOpts): Promise<PaginatedResult<UserSavedMessage>>` — from `apps/web/src/data/saved-messages.ts`
- `searchThreadMessages(tenantId, threadId, query): Promise<ThreadMessage[]>` — ILIKE search for in-thread search, from `apps/web/src/data/thread-messages.ts`
- Server actions: `sendMessage`, `editMessageAction`, `deleteMessageAction`, `pinMessageAction`, `unpinMessageAction`, `saveMessageAction`, `unsaveMessageAction`, `createDMAction`, `createGroupDMAction` — from `apps/web/src/actions/threads.ts`
- Types: `Thread`, `ThreadMessage`, `ThreadParticipant`, `UserSavedMessage`, `CreateThreadParams`, `CreateMessageParams`, `MessageListOpts`, `ThreadWithLastMessage` — from `apps/web/src/data/threads.ts` and related files
- Factory: `createTestThread()`, `createTestMessage()`, `createTestParticipant()` — from `packages/shared/testing/factories/threads.ts`

**Consumes:**

- Existing Drizzle schema: `threads`, `thread_messages`, `thread_participants`, `user_saved_messages` from `packages/shared/db/schema/`
- `getDbForTenant()` pattern from existing data layer
- `writeAuditLog()` from `apps/web/src/lib/audit-log.ts` — for message deletion audit
- `testTenantIsolation()` from test utilities

**Side Effects:**

- Migration: adds `source_note_id` column to `thread_messages` table
- Audit log entries on message deletion

**Context Manifest:**

- `communications.md` § MVP Scope (lines 29–55)
- `communications.md` § Thread Scopes (lines 57–113)
- `communications.md` § Threaded Replies (lines 115–128)
- `communications.md` § Pinned, Bookmarks & Presence (lines 148–182) — pin/bookmark subsections only
- `communications.md` § Messaging Error Handling (lines 417–432)
- `data-model.md` § Communications (lines 113–121)
- `data-model.md` § Personal / Notifications (lines 122–130)
- `phase-division-phase3-part1.md` § 3C scope boundaries (lines 184–213) — for source_note_id spec, thread tab lens filtering requirements, in-thread search
- Source files:
  - `packages/shared/db/schema/threads.ts`
  - `packages/shared/db/schema/thread-messages.ts`
  - `packages/shared/db/schema/thread-participants.ts`
  - `packages/shared/db/schema/user-saved-messages.ts`
  - `packages/shared/db/schema/index.ts` — schema exports
  - `apps/web/src/data/records.ts` — reference for data access patterns
  - `apps/web/src/actions/threads.ts` — if exists, for pattern reference
  - `apps/web/src/lib/audit-log.ts` — audit logging pattern

**Acceptance Criteria:**

- [ ] Migration adds `source_note_id UUID NULLABLE REFERENCES user_notes(id) ON DELETE SET NULL` to `thread_messages` with partial index on `(source_note_id) WHERE source_note_id IS NOT NULL`
- [ ] All thread CRUD functions use `getDbForTenant()` and are tenant-scoped
- [ ] `getOrCreateDMThread()` produces deterministic `scope_id` from sorted user IDs
- [ ] `createGroupDM()` enforces 3–8 participant cap (Zod validation)
- [ ] Message soft-delete sets `deleted_at` and writes audit log
- [ ] Pin/unpin updates `pinned_at` and `pinned_by` columns
- [ ] `searchThreadMessages()` performs `ILIKE` on `content::text`
- [ ] All data functions have `testTenantIsolation()` tests
- [ ] Test factories created: `createTestThread()`, `createTestMessage()`, `createTestParticipant()`
- [ ] Server actions wrap data functions with auth checks (Clerk session, workspace membership)
- [ ] ≥90% line coverage on data functions, ≥85% branch coverage

**Estimated Complexity:** Medium-High — many functions, but all follow established CRUD patterns from prior phases.

---

### Unit 2: Notification Pipeline & System Email

**Big-Picture Anchor:** This unit implements the notification aggregation and delivery pipeline — the system that routes events (mentions, DMs, replies, system alerts) into the notification bell and email. It includes the `NotificationService` with BullMQ job processing, system email templates via Resend (invitations, system alerts), client thread notification email, and notification preference management. This is the server-side backbone; the notification UI renders in Unit 6.

**Produces:**

- `NotificationService.create(params: CreateNotificationParams): Promise<Notification>` — orchestrates insert + delivery routing, from `apps/web/src/lib/notifications/notification-service.ts`
- `getNotifications(tenantId, userId, opts: NotificationListOpts): Promise<PaginatedResult<Notification>>` — from `apps/web/src/data/notifications.ts`
- `getUnreadNotificationCount(tenantId, userId): Promise<number>` — Redis-cached (5s TTL), from `apps/web/src/data/notifications.ts`
- `markNotificationRead(tenantId, userId, notificationId): Promise<void>` — from `apps/web/src/data/notifications.ts`
- `markAllNotificationsRead(tenantId, userId): Promise<void>` — from `apps/web/src/data/notifications.ts`
- `getNotificationPreferences(tenantId, userId): Promise<NotificationPreferences>` — from `apps/web/src/data/notification-preferences.ts`
- `updateNotificationPreferences(tenantId, userId, prefs: Partial<NotificationPreferences>): Promise<void>` — from `apps/web/src/data/notification-preferences.ts`
- BullMQ queue: `notification` with job types `notification.email.send`, `notification.cleanup`
- Processor: `processNotificationEmail(job)` — renders React Email template, sends via Resend, from `apps/worker/src/processors/notification/email-send.ts`
- Processor: `processNotificationCleanup(job)` — deletes notifications older than 90 days, from `apps/worker/src/processors/notification/cleanup.ts`
- React Email templates: `InvitationEmail`, `SystemAlertEmail`, `ClientThreadReplyEmail` — from `apps/web/src/lib/email/templates/`
- `ResendEmailService.send(params: SendEmailParams): Promise<void>` — Resend API wrapper, from `apps/web/src/lib/email/resend-service.ts`
- Types: `Notification`, `CreateNotificationParams`, `NotificationPreferences`, `NotificationType`, `SendEmailParams` — from notification service and data files
- Server actions: `markNotificationReadAction`, `markAllReadAction`, `updateNotificationPreferencesAction` — from `apps/web/src/actions/notifications.ts`

**Consumes:**

- Unit 1 types: `Thread`, `ThreadMessage` — for notification context (source_thread_id, source_message_id)
- Existing Drizzle schema: `notifications`, `user_notification_preferences` from `packages/shared/db/schema/`
- `getDbForTenant()` pattern
- BullMQ queue registration pattern from `apps/worker/src/queues.ts`
- Redis client for unread count caching

**Side Effects:**

- Registers BullMQ queue: `notification`
- Sends emails via Resend API
- Publishes to Redis channel: `user:{userId}:notifications` (consumed by Unit 3 real-time handlers)

**Context Manifest:**

- `communications.md` § Notification Aggregation & Delivery (lines 184–312)
- `email.md` § Email Provider Stack (lines 10–16)
- `email.md` § Sender Identity — Tier 1 (lines 18–34)
- `email.md` § MVP System Emails (lines 37–51)
- `data-model.md` § Personal / Notifications (lines 122–130)
- `phase-division-phase3-part1.md` § 3C scope — client thread notification email spec (lines 184–213)
- Source files:
  - `packages/shared/db/schema/notifications.ts`
  - `packages/shared/db/schema/user-notification-preferences.ts`
  - `apps/worker/src/queues.ts` — queue registration pattern
  - `apps/worker/src/lib/job-wrapper.ts` — job processing pattern
  - `apps/worker/src/processors/file-scan.ts` — processor pattern reference
- From Unit 1:
  - `apps/web/src/data/threads.ts` — Thread type definitions

**Acceptance Criteria:**

- [ ] `NotificationService.create()` inserts notification row, checks user preferences, routes to in-app (Redis publish) and/or email (BullMQ enqueue)
- [ ] 8 notification types supported: `mention`, `dm`, `thread_reply`, `approval_requested`, `approval_decided`, `automation_failed`, `sync_error`, `system`
- [ ] `mention` and `dm` types always deliver immediately regardless of mute schedule (priority override)
- [ ] `thread_participants.muted` suppresses `thread_reply` notifications but NOT `mention` notifications
- [ ] Redis-cached unread count at `cache:notif:unread:t:{tenantId}:u:{userId}` with 5s TTL
- [ ] BullMQ email send job retries 3× with exponential backoff (1min, 5min, 15min)
- [ ] Notification cleanup job deletes rows older than 90 days
- [ ] System email templates render via React Email and send from `notifications@everystack.com`
- [ ] Client thread reply email includes message preview and portal link
- [ ] Notification insert failure does NOT block the originating action (best-effort delivery)
- [ ] All data functions have `testTenantIsolation()` tests
- [ ] ≥90% line coverage on notification data layer, ≥85% branch coverage

**Estimated Complexity:** Medium-High — notification routing logic has many branches (preference checks, priority overrides, muting), but patterns are established from prior worker processors.

---

### Unit 3: Presence & Real-Time Chat Infrastructure

**Big-Picture Anchor:** This unit is the real-time transport layer for all communications. It extends the existing Socket.IO server with chat-specific event handlers (message delivery, typing indicators, thread room management), the presence system (online/away/DND/offline with Redis heartbeat), and the notification real-time push channel. Units 5 and 6 consume these handlers from their React components via hooks.

**Produces:**

- `PresenceService.setPresence(tenantId, roomId, userId, state): Promise<void>` — from `apps/realtime/src/services/presence-service.ts`
- `PresenceService.getPresence(tenantId, roomId): Promise<PresenceEntry[]>` — from same
- `PresenceService.heartbeat(tenantId, userId): Promise<void>` — refreshes TTL, from same
- `PresenceService.getUserStatus(tenantId, userId): Promise<PresenceState>` — from same
- Redis key pattern: `presence:t:{tenantId}:{roomId}:{userId}` with 60s TTL
- Socket.IO handler: `ChatHandler` — handles `thread:join`, `thread:leave`, `message:new`, `message:edit`, `message:delete`, `typing:start`, `typing:stop` events, from `apps/realtime/src/handlers/chat-handler.ts`
- Socket.IO handler: `PresenceHandler` — handles `presence:heartbeat`, `presence:update`, `presence:status` events, from `apps/realtime/src/handlers/presence-handler.ts`
- Socket.IO handler: `NotificationHandler` — subscribes to `user:{userId}:notifications` Redis channel, pushes to client, from `apps/realtime/src/handlers/notification-handler.ts`
- Redis subscriber: `chat-event-subscriber.ts` — subscribes to `thread:{threadId}` Redis channels for cross-process message delivery, from `apps/realtime/src/subscribers/chat-event-subscriber.ts`
- `publishChatEvent(tenantId, threadId, event, payload): Promise<void>` — Redis pub/sub publish for message broadcast, from `apps/web/src/lib/realtime/chat-events.ts`
- `publishNotificationEvent(userId, notification): Promise<void>` — Redis pub/sub for notification push, from `apps/web/src/lib/realtime/notification-events.ts`
- Custom status CRUD: `updateCustomStatus(tenantId, userId, emoji, text, clearAt)`, `getCustomStatus(tenantId, userId)` — persists to `workspace_memberships.status_emoji/status_text/status_clear_at`, from `apps/web/src/data/presence.ts`
- Types: `PresenceState`, `PresenceEntry`, `ChatEvent`, `TypingEvent` — from `apps/realtime/src/types/chat.ts`

**Consumes:**

- Unit 1 types: `Thread`, `ThreadMessage` — for event payload shapes
- Existing Socket.IO server: `apps/realtime/src/server.ts`, `apps/realtime/src/socket-io-realtime-service.ts`
- Existing room handler pattern: `apps/realtime/src/handlers/room-handler.ts`
- Existing Redis event subscriber pattern: `apps/realtime/src/subscribers/redis-event-subscriber.ts`
- Existing auth middleware: `apps/realtime/src/middleware/auth.ts`
- `workspace_memberships` schema — for custom status columns

**Side Effects:**

- New Socket.IO event namespace for chat/presence/notifications
- Redis pub/sub channels: `thread:{threadId}`, `user:{userId}:notifications`, `presence:t:{tenantId}`

**Context Manifest:**

- `communications.md` § Pinned, Bookmarks & Presence (lines 148–182) — presence states, Redis storage, DND behavior
- `realtime.md` § Transport Abstraction (lines 17–42)
- `realtime.md` § Room Model (lines 44–57)
- `realtime.md` § Connection Lifecycle (lines 59–107)
- `realtime.md` § Event Flow (lines 109–128)
- `realtime.md` § Presence System (lines 149–164)
- `realtime.md` § Chat / DM Message Delivery (lines 166–185)
- Source files:
  - `apps/realtime/src/server.ts` — server setup
  - `apps/realtime/src/socket-io-realtime-service.ts` — service implementation
  - `apps/realtime/src/handlers/room-handler.ts` — handler pattern
  - `apps/realtime/src/subscribers/redis-event-subscriber.ts` — subscriber pattern
  - `apps/realtime/src/middleware/auth.ts` — auth pattern
  - `packages/shared/db/schema/workspace-memberships.ts` — custom status columns
- From Unit 1:
  - Type definitions: `Thread`, `ThreadMessage` from `apps/web/src/data/threads.ts`

**Acceptance Criteria:**

- [ ] Presence heartbeat stores state in Redis `presence:t:{tenantId}:{roomId}:{userId}` with 60s TTL
- [ ] 4 presence states supported: online (green), away (5min idle), DND (mutes notifications), offline
- [ ] Custom status (emoji + text + auto-clear) persists to `workspace_memberships`
- [ ] `thread:join` adds user to Socket.IO room `thread:{threadId}`, `thread:leave` removes
- [ ] `message:new` event broadcasts to all room members except sender
- [ ] Typing indicator events (`typing:start`, `typing:stop`) broadcast to thread room
- [ ] NotificationHandler subscribes to user's Redis notification channel on connect, pushes events via Socket.IO
- [ ] DND state suppresses all notification push events except `mention` and `dm` from Owners
- [ ] Redis pub/sub used for cross-process message delivery (horizontal scaling via Redis adapter)
- [ ] All handlers validate tenant context via existing auth middleware
- [ ] ≥85% line coverage on handlers, ≥80% branch coverage

**Estimated Complexity:** Medium — extends existing Socket.IO patterns with new event types. Presence Redis lifecycle is the trickiest part.

---

### Unit 4: Chat Editor (TipTap Environment 1)

**Big-Picture Anchor:** The Chat Editor is a standalone, lightweight TipTap editor component used across all messaging surfaces: Record Thread, DMs, Group DMs, Chat Quick Panel, and later portals. It implements progressive disclosure from a simple text input to a full rich-text composer with @mentions, markdown shortcuts, emoji reactions, and attachments. This unit has no unit-to-unit dependencies and can be built in parallel with all other units.

**Produces:**

- `ChatEditor` — React component: TipTap editor with 3 input states (Compact/Focused/Expanded), from `apps/web/src/components/chat/ChatEditor.tsx`
- `ChatEditorToolbar` — bubble toolbar (B/I/U/Link/Bullets/Numbers), from `apps/web/src/components/chat/ChatEditorToolbar.tsx`
- `MentionDropdown` — @mention autocomplete dropdown with people + groups, from `apps/web/src/components/chat/MentionDropdown.tsx`
- `EmojiPicker` — emoji-mart wrapper with colon autocomplete, from `apps/web/src/components/chat/EmojiPicker.tsx`
- `EmojiReactions` — reaction chips below message with add/remove, from `apps/web/src/components/chat/EmojiReactions.tsx`
- `MessageRenderer` — read-only TipTap JSON → HTML render (no editor instances for displayed messages), from `apps/web/src/components/chat/MessageRenderer.tsx`
- `MessageItem` — single message display with avatar/name/timestamp/content, hover menu, edit/delete actions, from `apps/web/src/components/chat/MessageItem.tsx`
- `ChatAttachmentButton` — file picker + drag-drop attachment handler, from `apps/web/src/components/chat/ChatAttachmentButton.tsx`
- `useChatEditor(config: ChatEditorConfig): ChatEditorInstance` — hook wrapping TipTap useEditor with EveryStack extensions, from `apps/web/src/components/chat/use-chat-editor.ts`
- TipTap extension config: `chatEditorExtensions` — Bold, Italic, Underline, Strike, Code, BulletList, OrderedList, Blockquote, Link, Mention (custom), Placeholder, History, InputRules, from `apps/web/src/components/chat/extensions.ts`
- Types: `ChatEditorConfig`, `ChatEditorInstance`, `MentionSuggestion` — from `apps/web/src/components/chat/types.ts`

**Consumes:**

- No unit-to-unit dependencies
- TipTap libraries: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`
- `emoji-mart` library for emoji picker
- Existing shadcn/ui components: `Button`, `Popover`, `Tooltip` from `apps/web/src/components/ui/`
- StorageClient (from 1G) for attachment uploads

**Side Effects:**

- npm dependencies added: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-*`, `emoji-mart`

**Context Manifest:**

- `communications.md` § Chat Editor TipTap Env 1 (lines 294–415)
- `communications.md` § Emoji Picker (lines 434–440)
- `design-system.md` § Typography (for DM Sans/JetBrains Mono application in chat)
- Source files:
  - `apps/web/src/components/ui/button.tsx` — shadcn pattern reference
  - `apps/web/src/components/ui/popover.tsx` — shadcn popover for emoji picker
  - `apps/web/src/lib/storage-client.ts` — attachment upload (if exists from 1G)

**Acceptance Criteria:**

- [ ] Three input states: Compact (single-line), Focused (compact + icons), Expanded (multi-line + toolbar)
- [ ] State transitions: click/focus → Focused; Shift+Enter/paste multi-line → Expanded; blur empty → Compact
- [ ] Keyboard: Enter sends in Compact/Focused; Cmd+Enter sends in Expanded; Escape collapses
- [ ] `@` triggers MentionDropdown with fuzzy-filtered workspace members, arrow keys + Enter to select
- [ ] Selected mention renders as teal pill (`@Name`), non-editable inline, backspace deletes whole pill
- [ ] Markdown shortcuts auto-convert: `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `- ` bullets, `1. ` numbered
- [ ] Bubble toolbar appears on text selection in Expanded mode: B | I | U | Link | Bullets | Numbers
- [ ] Link auto-detection on paste/type, Cmd+K for link insertion dialog
- [ ] Attachment button triggers file picker, drag-drop supported, uploads via presigned URL
- [ ] `MessageRenderer` renders TipTap JSON as styled HTML without editor instances
- [ ] `MessageItem` shows avatar, name, timestamp, content; hover menu with edit/delete/pin/save/reply
- [ ] Edit mode: inline editor replaces rendered message, Save (Cmd+Enter) / Cancel (Escape), shows "(edited)"
- [ ] `EmojiReactions` renders reaction chips, click to add/remove, "+" opens emoji picker
- [ ] `EmojiPicker` uses emoji-mart with categories, search, skin tone selector, colon autocomplete
- [ ] ≥80% line coverage on components

**Estimated Complexity:** Medium-High — TipTap setup with custom extensions, progressive disclosure state machine, and emoji integration are substantial, but no data layer or real-time complexity.

---

### Unit 5: Record Thread & DM UI

**Big-Picture Anchor:** This unit builds the main messaging interfaces: the Record Thread panel that attaches to Record View (two-thread tabs, threaded replies, tab lenses, in-thread search), the DM and Group DM conversation views, and chat navigation. It wires together the data layer (Unit 1), real-time infrastructure (Unit 3), and Chat Editor (Unit 4) into interactive, real-time messaging surfaces.

**Produces:**

- `RecordThreadPanel` — 25% width panel alongside Record View, from `apps/web/src/components/thread/RecordThreadPanel.tsx`
- `ThreadTabBar` — "Team Notes" / "Client Messages" tab switcher, from `apps/web/src/components/thread/ThreadTabBar.tsx`
- `ThreadLensBar` — tab lens navigation: All | Notes | Activity | Files, from `apps/web/src/components/thread/ThreadLensBar.tsx`
- `ThreadMessageList` — virtualized message list with pagination and auto-scroll, from `apps/web/src/components/thread/ThreadMessageList.tsx`
- `ThreadReplyPanel` — reply chain side panel (360px) for expanding threaded replies, from `apps/web/src/components/thread/ThreadReplyPanel.tsx`
- `ThreadSearchBar` — ⌘+F in-thread search with highlight and scroll-to-match, from `apps/web/src/components/thread/ThreadSearchBar.tsx`
- `SharedNoteMessage` — visual distinction for messages with `source_note_id` (📝 icon, accent left border, inset container), from `apps/web/src/components/thread/SharedNoteMessage.tsx`
- `ClientVisibleBanner` — persistent non-dismissible banner above chat input in client thread, from `apps/web/src/components/thread/ClientVisibleBanner.tsx`
- `PinnedMessagesPanel` — pinned messages drawer accessible via 📌 icon, from `apps/web/src/components/thread/PinnedMessagesPanel.tsx`
- `ThreadNavDropdown` — hierarchical tree dropdown for self-referential record navigation with unread indicators, from `apps/web/src/components/thread/ThreadNavDropdown.tsx`
- `DMConversation` — DM/Group DM conversation view, from `apps/web/src/components/chat/DMConversation.tsx`
- `GroupDMHeader` — group DM name, participants, settings, from `apps/web/src/components/chat/GroupDMHeader.tsx`
- `useThread(threadId)` — hook: loads messages, subscribes to real-time events, manages unread state, from `apps/web/src/components/thread/use-thread.ts`
- `useThreadSearch(threadId)` — hook: client-side filter for short threads, server ILIKE for long, from `apps/web/src/components/thread/use-thread-search.ts`
- `useTypingIndicator(threadId)` — hook: broadcasts typing events, renders "X is typing...", from `apps/web/src/components/thread/use-typing-indicator.ts`

**Consumes:**

- Unit 1: `createMessage`, `getMessages`, `editMessage`, `deleteMessage`, `pinMessage`, `unpinMessage`, `getPinnedMessages`, `getOrCreateDMThread`, `createGroupDM`, `searchThreadMessages`, `addParticipant`, `updateLastRead`, `getUnreadCounts` data functions + server actions; `Thread`, `ThreadMessage` types
- Unit 3: `publishChatEvent`, `ChatHandler` events (for real-time message delivery); `PresenceService` (for typing indicators); Socket.IO event subscriptions for `message:new`, `message:edit`, `message:delete`, `typing:start`, `typing:stop`
- Unit 4: `ChatEditor`, `MessageItem`, `MessageRenderer`, `EmojiReactions` components; `useChatEditor` hook
- Existing: `RecordView` component from `apps/web/src/components/record-view/RecordView.tsx` — thread panel attaches alongside

**Side Effects:**

- Modifies `RecordView` layout to accommodate 25% thread panel (Grid+Record View layout: 60%/40% → 55%/25%/20% or 60%/40% with thread as overlay)
- Adds thread icon to `RecordViewHeader`

**Context Manifest:**

- `communications.md` § MVP Scope (lines 29–55)
- `communications.md` § Thread Scopes (lines 57–113)
- `communications.md` § Threaded Replies (lines 115–128)
- `communications.md` § Chat Navigation (lines 130–146)
- `communications.md` § Pinned, Bookmarks & Presence (lines 148–182) — pin/bookmark display
- `communications.md` § Messaging Error Handling (lines 417–432)
- `phase-division-phase3-part1.md` § 3C scope — thread tab lenses, in-thread search, visual distinction specs, client-visible indicator (lines 184–213)
- Source files:
  - `apps/web/src/components/record-view/RecordView.tsx` — layout integration point
  - `apps/web/src/components/record-view/RecordViewHeader.tsx` — thread icon placement
  - `apps/web/src/components/record-view/RecordViewTabs.tsx` — tab pattern reference
- From Unit 1:
  - `apps/web/src/data/threads.ts` — data functions
  - `apps/web/src/data/thread-messages.ts` — message functions
  - `apps/web/src/data/thread-participants.ts` — participant functions
  - `apps/web/src/actions/threads.ts` — server actions
- From Unit 3:
  - `apps/web/src/lib/realtime/chat-events.ts` — event publishing
  - `apps/realtime/src/types/chat.ts` — event type definitions
- From Unit 4:
  - `apps/web/src/components/chat/ChatEditor.tsx` — editor component
  - `apps/web/src/components/chat/MessageItem.tsx` — message rendering
  - `apps/web/src/components/chat/EmojiReactions.tsx` — reactions

**Acceptance Criteria:**

- [ ] Record Thread panel opens from Record View header chat icon at 25% width
- [ ] Two-thread tabs: "Team Notes" (internal, always present) + "Client Messages" (visible when Client Messaging enabled)
- [ ] Tab lenses below thread tabs: All | Notes | Activity | Files — filter `thread_messages` by criteria
- [ ] Notes lens: `WHERE source_note_id IS NOT NULL`; Activity lens: `WHERE message_type = 'activity'`; Files lens: `WHERE attachments IS NOT NULL`
- [ ] Client-visible banner: persistent, non-dismissible warning above chat input in client thread tab
- [ ] Shared note messages render with 📝 icon, `--ws-accent` left border, inset container
- [ ] In-thread search (⌘+F when thread panel focused): client-side filter for short threads, server ILIKE for long; highlights matches
- [ ] Threaded replies: reply chip shows "N replies · last Xm ago"; click expands reply chain in 360px side panel
- [ ] Chat navigation dropdown for self-referential records: parent/current/siblings/children with unread indicators
- [ ] Pinned messages accessible via 📌 icon in thread header
- [ ] DM conversation view with persistent thread, real-time message delivery
- [ ] Group DM with name, participant list, 3-8 cap
- [ ] Real-time message delivery: new messages appear instantly via Socket.IO subscription
- [ ] Typing indicator: "X is typing..." with 3-second debounce
- [ ] Messaging error states: failed messages show red outline + retry icon; 3 retries then manual
- [ ] Message hover menu: edit, delete, pin, save, reply actions
- [ ] ≥80% line coverage on components

**Estimated Complexity:** High — largest UI unit with many interactive features, real-time subscriptions, and integration with Record View layout.

---

### Unit 6: Notification UI & Chat Quick Panel

**Big-Picture Anchor:** This unit completes the communications surface layer with the notification bell and tray (in-app notification display with real-time updates), the Chat Quick Panel (unified conversation feed in the sidebar), and presence indicator components. It wires the notification pipeline (Unit 2) and real-time infrastructure (Unit 3) into the user-facing workspace shell.

**Produces:**

- `NotificationBell` — bell icon with unread count badge, real-time updates, from `apps/web/src/components/notifications/NotificationBell.tsx`
- `NotificationTray` — dropdown panel (400px × 480px max, scrollable), from `apps/web/src/components/notifications/NotificationTray.tsx`
- `NotificationItem` — single notification row with icon, text, timestamp, read state, from `apps/web/src/components/notifications/NotificationItem.tsx`
- `NotificationGroup` — grouped notifications (same `group_key` within 5 min), from `apps/web/src/components/notifications/NotificationGroup.tsx`
- `useNotifications(tenantId, userId)` — hook: loads notifications, subscribes to real-time push, manages unread count, from `apps/web/src/components/notifications/use-notifications.ts`
- `ChatQuickPanel` — unified chat feed in sidebar Quick Panel: all conversations (Record Threads + DMs + Group DMs) sorted by recency, from `apps/web/src/components/chat/ChatQuickPanel.tsx`
- `ChatQuickPanelItem` — conversation preview row (avatar, name, last message preview, timestamp, unread badge), from `apps/web/src/components/chat/ChatQuickPanelItem.tsx`
- `PresenceIndicator` — green/yellow/red/gray dot component for avatars, from `apps/web/src/components/presence/PresenceIndicator.tsx`
- `CustomStatusDisplay` — emoji + text status display, from `apps/web/src/components/presence/CustomStatusDisplay.tsx`
- `CustomStatusEditor` — status emoji/text editor with auto-clear options, from `apps/web/src/components/presence/CustomStatusEditor.tsx`
- `usePresence(tenantId, roomId?)` — hook: subscribes to presence events, returns presence map, from `apps/web/src/components/presence/use-presence.ts`

**Consumes:**

- Unit 2: `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead` data functions + server actions; `Notification`, `NotificationPreferences` types
- Unit 3: `NotificationHandler` events (real-time notification push via Socket.IO); `PresenceHandler` events (presence state updates); `publishNotificationEvent` for Redis pub/sub; `getCustomStatus`, `updateCustomStatus` for status management
- Unit 5: `DMConversation` component (navigate from Quick Panel to DM); conversation list from `listThreadsForUser` (Unit 1)
- Existing: sidebar shell components from `apps/web/src/components/sidebar/`

**Side Effects:**

- Adds NotificationBell to workspace header/toolbar
- Adds ChatQuickPanel to sidebar Quick Panel area
- Adds PresenceIndicator to avatar components across the workspace

**Context Manifest:**

- `communications.md` § Notification Aggregation & Delivery (lines 184–312) — bell icon, notification tray, smart grouping, priority override display
- `communications.md` § Pinned, Bookmarks & Presence (lines 148–182) — presence states, custom status display, DND indicator
- `communications.md` § MVP Scope (lines 29–55) — Chat Quick Panel scope
- `design-system.md` § Quick Panels (if applicable — sidebar layout patterns)
- Source files:
  - `apps/web/src/components/sidebar/` — sidebar component patterns
  - `apps/web/src/components/ui/popover.tsx` — dropdown pattern for notification tray
  - `apps/web/src/components/ui/badge.tsx` — unread count badge
- From Unit 2:
  - `apps/web/src/data/notifications.ts` — notification data functions
  - `apps/web/src/data/notification-preferences.ts` — preference data
  - `apps/web/src/actions/notifications.ts` — server actions
- From Unit 3:
  - `apps/realtime/src/types/chat.ts` — event types for presence
  - `apps/web/src/data/presence.ts` — custom status functions
  - `apps/web/src/lib/realtime/notification-events.ts` — notification event shapes
- From Unit 5:
  - `apps/web/src/components/chat/DMConversation.tsx` — DM navigation target

**Acceptance Criteria:**

- [ ] Notification bell renders in workspace header with unread count badge (real-time updated)
- [ ] Click bell opens notification tray dropdown (400px × 480px max, right-aligned, scrollable)
- [ ] Notifications grouped by `group_key` within 5 minutes: "Sarah, James, and 2 others commented..."
- [ ] Mark as read on click; "Mark all as read" button at top of tray
- [ ] New notifications prepend to tray in real-time via Socket.IO without page refresh
- [ ] Chat Quick Panel shows all conversations (Record Threads + DMs + Group DMs) sorted by recency
- [ ] Each conversation preview shows avatar, name/record title, last message preview (truncated), timestamp, unread count badge
- [ ] Click conversation navigates to Record Thread panel (for record threads) or DM view (for DMs)
- [ ] PresenceIndicator renders as colored dot (green/yellow/red/gray) on avatar
- [ ] Presence updates in real-time as users go online/away/DND/offline
- [ ] Custom status editor: emoji picker + text input + auto-clear options (1h, 4h, today, this week, custom)
- [ ] Custom status displays next to user name in sidebar, @mention dropdown, DM list
- [ ] ≥80% line coverage on components

**Estimated Complexity:** Medium — mostly rendering components consuming established data + real-time hooks. Notification grouping logic is the most complex part.

---

## Cross-Unit Integration Points

1. **Message creation → Notification trigger:** Unit 1's `createMessage()` must call Unit 2's `NotificationService.create()` for mentions, replies, and DMs. This integration is built in Unit 2 (which imports Unit 1's types and wraps/extends the message creation flow).

2. **Message creation → Real-time broadcast:** Unit 1's `createMessage()` must call Unit 3's `publishChatEvent()` to broadcast to thread room members. This integration is built in Unit 5's hooks (which call the server action and then the real-time publish).

3. **Notification creation → Real-time push:** Unit 2's `NotificationService.create()` publishes to Redis channel, which Unit 3's `NotificationHandler` picks up and pushes to the client via Socket.IO. This integration is verified in Unit 6.

4. **Presence state → DND notification suppression:** Unit 3's presence state is checked by Unit 2's notification routing to suppress push delivery for DND users (except priority overrides).

5. **Chat Editor → All messaging surfaces:** Unit 4's `ChatEditor` component is embedded in Unit 5's `RecordThreadPanel` and `DMConversation`, and in Unit 6's `ChatQuickPanel` inline reply.

6. **Thread data → Quick Panel:** Unit 1's `listThreadsForUser()` powers Unit 6's `ChatQuickPanel` conversation list. Unit 5's navigation targets (Record Thread panel, DM view) are the click destinations.

7. **Record View → Thread Panel:** Unit 5 modifies the existing Record View layout (from 3A-ii) to accommodate the thread panel at 25% width.

## Context Budget Verification

| Unit | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-------------|-------------|---------------|-------------|--------|
| 1    | 5 sections (~170 lines) | 8 files (~800 lines) | 0 | ~24,000 | Yes |
| 2    | 4 sections (~140 lines) | 5 files (~400 lines) | 1 (Unit 1 types, ~200 lines) | ~18,500 | Yes |
| 3    | 6 sections (~130 lines) | 6 files (~500 lines) | 1 (Unit 1 types, ~200 lines) | ~20,800 | Yes |
| 4    | 2 sections (~130 lines) | 3 files (~200 lines) | 0 | ~8,300 | Yes |
| 5    | 6 sections (~170 lines) | 3 files + 6 Unit outputs (~900 lines) | 3 (Units 1, 3, 4 — ~600 lines) | ~31,500 | Yes |
| 6    | 3 sections (~140 lines) | 3 files (~300 lines) | 3 (Units 2, 3, 5 — ~500 lines) | ~23,500 | Yes |

All units pass the 40% context budget test (~80,000 token limit). Tightest budget: Unit 5 at ~31,500 tokens estimated.
