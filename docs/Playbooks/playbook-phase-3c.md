# Phase 3C — Record Thread, DMs, Notifications & System Email

## Phase Context

Covers What Has Been Built, What This Phase Delivers, What This Phase Does NOT Build, Architecture Patterns for This Phase, Mandatory Context for All Prompts, Subdivision Summary.
Touches `thread_messages`, `thread_participants`, `user_saved_messages`, `user_notification_preferences`, `cross_links` tables. See `queues.ts`, `job-wrapper.ts`.

### What Has Been Built

| Phase | Key Deliverables |
|-------|-----------------|
| 1A–1J | Monorepo, DB schema (Drizzle, 52 tables including `threads`, `thread_messages`, `thread_participants`, `user_saved_messages`, `notifications`, `user_notification_preferences`), Clerk auth, observability (Pino), testing infra (factories, `testTenantIsolation()`), design system (shadcn/ui, Tailwind tokens), real-time (Socket.io + Redis adapter, `SocketIORealtimeService`, room handler, auth middleware), BullMQ worker infrastructure (`queues.ts`, `job-wrapper.ts`), AIService, audit log (`writeAuditLog` from `packages/shared/db`), API auth, CP migration + multi-tenant nav shell |
| 2A–2C | FieldTypeRegistry, canonical transform layer, Airtable + Notion adapters, outbound sync, conflict resolution, tsvector search indexes, sync dashboard |
| 3A-i | Grid View: TanStack Table + Virtual, 16 cell renderers, inline editing, keyboard nav |
| 3A-ii | View features (filter/sort/group/summary), Record View overlay (60%/40% layout, `RecordView.tsx`, `RecordViewHeader.tsx`, `RecordViewTabs.tsx`), Card View, Sections, CSV import, My Views/Shared Views, multi-user collaboration |
| 3A-iii | Field-level permissions: 3-state model, 7-step resolution cascade, data layer with Redis cache, permission-aware Grid/RecordView/CardView, Permission Config Panel |
| 3B-i | Cross-linking engine: `cross_links`/`cross_link_index` data layer, query-time resolution (L0–L2), Link Picker, display value maintenance, LinkedRecordTree |
| 3B-ii | Schema Descriptor Service (SDS) + Command Bar: descriptor types & builders, permission filter, 2-tier caching, token estimator, 4-channel Command Bar (fuzzy search, navigation, slash commands, AI search) |

### What This Phase Delivers

The MVP communications backbone: contextual Record Threads (two-thread model with "Team Notes" and "Client Messages" tabs), DMs and group DMs, a lightweight TipTap Chat Editor, real-time presence, an in-app notification pipeline with system email delivery via Resend, and the Chat Quick Panel as a unified conversation feed. When complete, users can converse contextually on any record, message teammates directly, and receive aggregated notifications across their workspace.

### What This Phase Does NOT Build

- Client thread designated-rep model (post-MVP — Manager assigns specific participants to client thread)
- Base-scoped threads, table-scoped threads (post-MVP — Comms & Polish)
- Omnichannel external messaging (post-MVP — Custom Apps & Live Chat)
- Activity logging in record threads (post-MVP — Comms & Polish)
- Slash commands in chat (post-MVP)
- Rich link unfurls / Open Graph (post-MVP)
- Custom workspace emoji (post-MVP)
- Email digest notifications (post-MVP)
- Connected inbox (post-MVP — Comms & Polish)
- Outbound CRM email / compose UI (post-MVP — Documents)
- Custom domain email (post-MVP)
- Personal Notes UI / Share to Thread button (3G-ii — 3C delivers only the schema migration and thread rendering)
- Kanban, List, Gantt views (post-MVP)
- Formula engine (post-MVP)

### Architecture Patterns for This Phase

**Two-thread model.** Every record has two threads, distinguished by `thread_type` on the `threads` table: `internal` (workspace-only, "Team Notes") and `client` (workspace + portal client, "Client Messages"). No visibility toggle — two separate threads eliminate accidental leak risk.

**Thread data uses VARCHAR discriminators.** `thread_type`, `scope_type`, `author_type`, and `message_type` are VARCHAR — never convert to Postgres ENUM. TypeScript types use `string` with inline comments listing known values, not exhaustive union types.

**Messages persisted before real-time broadcast.** Messages write to Postgres first, then publish to Redis for Socket.IO delivery. If real-time fails, the message still exists in DB — client sees it on next poll/reconnect.

**Notification delivery is best-effort.** Notification insert failure does NOT block the originating action. Redis publish failure degrades gracefully — notification exists in DB for tray query.

**Chat Editor (TipTap env 1) is lightweight.** No headings, no tables, no code blocks, no slash menu. Progressive disclosure from simple text input to rich editor. Separate from Smart Doc editor (TipTap env 2 in 3D).

**CockroachDB safeguards remain active** (UUIDv7, no PG-specific syntax, no advisory locks).

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult when naming new things.
`MANIFEST.md` is not needed during build execution.

### Subdivision Summary

This sub-phase is decomposed into 6 units per the subdivision doc (`docs/subdivisions/3c-subdivision.md`):

| Unit | Name | Produces | Depends On |
|------|------|----------|------------|
| 1 | Schema Migration & Thread/Message Data Layer | `source_note_id` migration, thread/message/participant/bookmark/pin CRUD functions, DM thread helpers, server actions, test factories | None |
| 2 | Notification Pipeline & System Email | `NotificationService`, notification CRUD, BullMQ `notification` queue, Resend email service, React Email templates | Unit 1 |
| 3 | Presence & Real-Time Chat Infrastructure | `PresenceService`, `ChatHandler`, `PresenceHandler`, `NotificationHandler`, Redis pub/sub chat events, custom status CRUD | Unit 1 |
| 4 | Chat Editor (TipTap Environment 1) | `ChatEditor`, `ChatEditorToolbar`, `MentionDropdown`, `EmojiPicker`, `EmojiReactions`, `MessageRenderer`, `MessageItem`, `ChatAttachmentButton`, `useChatEditor` hook | None (parallel) |
| 5 | Record Thread & DM UI | `RecordThreadPanel`, `ThreadTabBar`, `ThreadLensBar`, `ThreadMessageList`, `ThreadReplyPanel`, `ThreadSearchBar`, DM views, real-time hooks | Units 1, 3, 4 |
| 6 | Notification UI & Chat Quick Panel | `NotificationBell`, `NotificationTray`, `ChatQuickPanel`, `PresenceIndicator`, `CustomStatusEditor`, `useNotifications`, `usePresence` | Units 2, 3, 5 |

### Skills for This Phase

Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — backend patterns (data access, server actions, Redis, BullMQ)
- `docs/skills/ux-ui/SKILL.md` — UI component conventions (for Units 4, 5, 6)
- `docs/skills/phase-context/SKILL.md` — Always.

---

## Section Index

| Prompt | Unit | Deliverable | Summary | Depends On | Lines (est.) |
|--------|------|-------------|---------|------------|--------------|
| 1 | 1 | source_note_id migration + thread/message Drizzle schema verification | ALTER TABLE thread_messages ADD source_note_id with partial index; schema type verification | None | ~150 |
| 2 | 1 | Thread CRUD data functions (create, get, list, DM helpers) | createThread(), getThread(), getOrCreateDMThread(), createGroupDM() with deterministic scope_id | 1 | ~300 |
| 3 | 1 | Message CRUD data functions (create, get, edit, delete, pin, search) | createMessage(), editMessage(), deleteMessage(), pinMessage(), searchThreadMessages() | 1 | ~300 |
| 4 | 1 | Participant, bookmark/saved, and test factories + server actions | addParticipant(), updateLastRead(), getUnreadCounts(), saveMessage(); thread test factories | 2, 3 | ~350 |
| VP-1 | — | VERIFY — Completes Unit 1 | Thread/message CRUD, DM creation, participant management, and tenant isolation | 1–4 | — |
| 5 | 2 | NotificationService core + notification data functions | NotificationService class, notification CRUD, preference-aware delivery routing | Unit 1 complete | ~300 |
| 6 | 2 | BullMQ notification queue, email send processor + Resend service | notification queue + processor, Resend email delivery, template selection | 5 | ~300 |
| 7 | 2 | React Email templates + notification preferences + server actions | React Email components, per-user notification preferences CRUD, preference server actions | 5, 6 | ~250 |
| VP-2 | — | VERIFY — Completes Unit 2 | Notification pipeline end-to-end from trigger through email delivery | 5–7 | — |
| 8 | 3 | PresenceService (Redis heartbeat + custom status) | Redis heartbeat with TTL, custom status CRUD, online/away/offline state machine | Unit 1 complete | ~250 |
| 9 | 3 | ChatHandler + NotificationHandler (Socket.IO event handlers) | Socket.IO event handlers for message delivery, typing indicators, notification push | 8 | ~300 |
| 10 | 3 | Redis pub/sub chat event publisher + subscriber | Redis pub/sub for cross-server message delivery, subscriber auto-reconnect | 9 | ~200 |
| VP-3 | — | VERIFY — Completes Unit 3 | Presence, Socket.IO handlers, and Redis pub/sub verification | 8–10 | — |
| 11 | 4 | TipTap extension config + useChatEditor hook | TipTap extension set for chat (no headings/tables), useChatEditor() hook with progressive disclosure | None | ~200 |
| 12 | 4 | ChatEditor component (3 input states + toolbar + mentions) | ChatEditor with collapsed/expanded/full states, ChatEditorToolbar, MentionDropdown | 11 | ~350 |
| 13 | 4 | MessageRenderer, MessageItem, EmojiReactions + EmojiPicker | MessageRenderer for rich text, MessageItem with actions menu, emoji reactions + picker | 11 | ~300 |
| VP-4 | — | VERIFY — Completes Unit 4 | Chat editor, message rendering, and emoji components verification | 11–13 | — |
| 14 | 5 | RecordThreadPanel shell + ThreadTabBar + ThreadLensBar + useThread hook | Two-thread panel (Team Notes / Client Messages tabs), lens filtering, useThread() data hook | Units 1, 3, 4 complete | ~350 |
| 15 | 5 | ThreadMessageList + ThreadReplyPanel + ThreadSearchBar | Virtualized message list, reply composer, in-thread search with highlight | 14 | ~300 |
| 16 | 5 | DMConversation + GroupDMHeader + thread nav + Record View integration | DM views, group DM header, thread sidebar navigation, Record View tab integration | 14, 15 | ~350 |
| VP-5 | — | VERIFY — Completes Unit 5 | Record threads, DMs, and Record View integration verification | 14–16 | — |
| 17 | 6 | NotificationBell + NotificationTray + useNotifications hook | Bell icon with unread badge, tray dropdown with grouped notifications, real-time updates | Units 2, 3, 5 complete | ~300 |
| 18 | 6 | ChatQuickPanel + ChatQuickPanelItem | Sidebar quick panel with unified conversation feed, conversation preview cards | 17 | ~250 |
| 19 | 6 | PresenceIndicator + CustomStatusEditor + usePresence hook | Avatar presence dots, custom status modal, usePresence() hook with heartbeat | 17 | ~200 |
| VP-6 | — | VERIFY — Completes Unit 6 | 17–19 | — |

---

## — Unit 1: Schema Migration & Thread/Message Data Layer —

### Unit Context

This unit establishes the data foundation for all communications. It delivers the `source_note_id` schema migration on `thread_messages`, all thread/message/participant/bookmark/pin CRUD functions with tenant isolation, DM thread creation with deterministic scope_id, and test factories. Every subsequent unit consumes these types and functions.

**Interface Contract:**
Produces: `createThread`, `getThread`, `getThreadByScope`, `listThreadsForUser`, `getOrCreateDMThread`, `createGroupDM` from `apps/web/src/data/threads.ts`; `createMessage`, `getMessages`, `editMessage`, `deleteMessage`, `pinMessage`, `unpinMessage`, `getPinnedMessages`, `searchThreadMessages` from `apps/web/src/data/thread-messages.ts`; `addParticipant`, `removeParticipant`, `listParticipants`, `updateLastRead`, `getUnreadCounts` from `apps/web/src/data/thread-participants.ts`; `saveMessage`, `unsaveMessage`, `listSavedMessages` from `apps/web/src/data/saved-messages.ts`; server actions from `apps/web/src/actions/threads.ts`; factories `createTestThread()`, `createTestMessage()`, `createTestParticipant()` from `packages/shared/testing/factories/threads.ts`
Consumes: Existing Drizzle schema (`threads`, `thread_messages`, `thread_participants`, `user_saved_messages`), `getDbForTenant()`, `writeAuditLog`

---

## Prompt 1: source_note_id Migration & Thread Schema Verification

**Unit:** 1
**Depends on:** None
**Load context:** `communications.md` lines 112–128 (Data Model — threads, thread_messages, thread_participants schema), `data-model.md` lines 113–121 (Communications tables), `phase-division-phase3-part1.md` lines 184–213 (3C scope — source_note_id spec)
**Target files:** `packages/shared/db/migrations/XXXX_add_source_note_id_to_thread_messages.ts`, `packages/shared/db/schema/thread-messages.ts` (verify/update)
**Migration required:** Yes — `ALTER TABLE thread_messages ADD COLUMN source_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL` with partial index
**Git:** Commit with message "feat(db): add source_note_id column to thread_messages [Phase 3C, Prompt 1]"

### Schema Snapshot

```
thread_messages: id (UUIDv7 PK), thread_id (FK → threads.id), author_id (nullable), author_type (VARCHAR), message_type (VARCHAR), content (JSONB), parent_message_id (nullable), mentions (JSONB), attachments (JSONB), reactions (JSONB), pinned_at (nullable), pinned_by (nullable), edited_at (nullable), deleted_at (nullable), created_at
  source_note_id (UUID NULLABLE FK → user_notes.id ON DELETE SET NULL) -- NEW
```

### Task

1. **Read** the existing schema at `packages/shared/db/schema/thread-messages.ts` to understand the current column definitions.
2. **Create migration** `packages/shared/db/migrations/XXXX_add_source_note_id_to_thread_messages.ts`:
   - `ALTER TABLE thread_messages ADD COLUMN source_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL`
   - Add partial index: `CREATE INDEX idx_thread_messages_source_note_id ON thread_messages (source_note_id) WHERE source_note_id IS NOT NULL`
   - Migration must not acquire ACCESS EXCLUSIVE lock >1s
3. **Update** `packages/shared/db/schema/thread-messages.ts` to add `source_note_id` column to the Drizzle schema definition. Use `uuid('source_note_id').references(() => userNotes.id, { onDelete: 'set null' })`.
4. **Update** `packages/shared/db/schema/index.ts` if the new column requires re-exporting.
5. **Verify** all existing schema columns on `threads`, `thread_messages`, `thread_participants`, `user_saved_messages` match the data-model.md spec. Flag any discrepancies but do NOT modify existing migration files.
6. **Update** the Drizzle migration journal (`meta/_journal.json`) to include the new migration entry.

### Acceptance Criteria

- [ ] Migration file adds `source_note_id UUID NULLABLE REFERENCES user_notes(id) ON DELETE SET NULL`
- [ ] Partial index `idx_thread_messages_source_note_id` created on `(source_note_id) WHERE source_note_id IS NOT NULL`
- [ ] Drizzle schema in `thread-messages.ts` includes `source_note_id` column
- [ ] Migration journal updated with new entry
- [ ] `pnpm turbo db:migrate` succeeds
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Thread CRUD functions (Prompt 2)
- Message CRUD functions (Prompt 3)
- Any UI components
- Personal Notes Share to Thread button (3G-ii)

---

## Prompt 2: Thread CRUD Data Functions

**Unit:** 1
**Depends on:** 1
**Load context:** `communications.md` lines 57–113 (Thread Scopes — record, DM, group_dm, two-thread model, DM deterministic scope_id, group DM fixed cap), `communications.md` lines 130–146 (Chat Navigation), `data-model.md` lines 113–121 (Communications tables)
**Target files:** `apps/web/src/data/threads.ts`
**Migration required:** No
**Git:** Commit with message "feat(data): thread CRUD data functions with DM helpers [Phase 3C, Prompt 2]"

### Schema Snapshot

```
threads: id (UUIDv7 PK), tenant_id, scope_type (VARCHAR — 'record'|'dm'|'group_dm'), scope_id, thread_type (VARCHAR DEFAULT 'internal' — 'internal'|'client'), name (nullable), created_by, created_at. UNIQUE(scope_type, scope_id, thread_type)
thread_participants: id, thread_id, user_id (nullable), participant_type (VARCHAR DEFAULT 'user'), external_contact_id (nullable), joined_at, last_read_at, muted (boolean)
```

### Task

1. **Read** `apps/web/src/data/records.ts` for the data access pattern reference (getDbForTenant, query structure, return types).
2. **Create** `apps/web/src/data/threads.ts` with these functions:

   - `createThread(tenantId, params: CreateThreadParams): Promise<Thread>` — validates scope_type, inserts thread row, adds creator as participant.
   - `getThread(tenantId, threadId): Promise<Thread | null>` — fetch by ID, tenant-scoped.
   - `getThreadByScope(tenantId, scopeType, scopeId, threadType?): Promise<Thread | null>` — lookup by scope identifiers, uses UNIQUE constraint.
   - `listThreadsForUser(tenantId, userId, opts: PaginationOpts): Promise<PaginatedResult<ThreadWithLastMessage>>` — all threads the user participates in, joined with last message preview, sorted by last activity. Cursor-based pagination.
   - `getOrCreateDMThread(tenantId, userId1, userId2): Promise<Thread>` — deterministic `scope_id` from sorted user IDs (e.g., `dm:${sorted[0]}:${sorted[1]}`). If thread exists, return it. If not, create with both users as participants.
   - `createGroupDM(tenantId, creatorId, participantIds, name?): Promise<Thread>` — Zod-validate 3–8 participant cap. Generate UUID scope_id. Create thread + add all participants.

3. **Define types** in the same file or a co-located types file:
   - `Thread` — DB row type
   - `CreateThreadParams` — `{ scopeType, scopeId, threadType?, name?, createdBy }`
   - `ThreadWithLastMessage` — Thread + `lastMessage: { content: string; authorId: string; createdAt: Date } | null` + `unreadCount: number`
   - `PaginationOpts` — `{ cursor?: string; limit?: number }` (default limit 50)
   - `PaginatedResult<T>` — `{ items: T[]; nextCursor: string | null }`

4. **Use Zod** for input validation on `createGroupDM` (participant count 3–8).
5. All queries use `getDbForTenant()` and are tenant-scoped.

### Acceptance Criteria

- [ ] `createThread()` inserts thread row and adds creator as first participant
- [ ] `getThreadByScope()` correctly uses scope_type + scope_id + thread_type to lookup
- [ ] `getOrCreateDMThread()` produces deterministic `scope_id` from sorted user IDs — calling with (A, B) and (B, A) returns the same thread
- [ ] `createGroupDM()` enforces 3–8 participant cap via Zod validation, throws on violation
- [ ] `listThreadsForUser()` returns threads with last message preview and unread count, cursor-paginated
- [ ] All functions use `getDbForTenant()` and are tenant-scoped
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Message CRUD (Prompt 3)
- Participant management beyond initial creation (Prompt 4)
- Real-time events for thread creation (Unit 3)
- Thread UI components (Unit 5)

---

## Prompt 3: Message CRUD Data Functions

**Unit:** 1
**Depends on:** 1
**Load context:** `communications.md` lines 112–128 (Data Model — thread_messages, message_type, system messages), `communications.md` lines 115–128 (Threaded Replies), `communications.md` lines 148–182 (Pinned, Bookmarks & Presence — pin mechanics), `communications.md` lines 417–432 (Messaging Error Handling)
**Target files:** `apps/web/src/data/thread-messages.ts`
**Migration required:** No
**Git:** Commit with message "feat(data): message CRUD with pin, search, soft-delete [Phase 3C, Prompt 3]"

### Schema Snapshot

```
thread_messages: id (UUIDv7 PK), thread_id, author_id (nullable), author_type (VARCHAR — 'user'|'portal_client'|'system'), message_type (VARCHAR — 'message'|'system'), content (JSONB — TipTap JSON), parent_message_id (nullable), mentions (JSONB), attachments (JSONB), reactions (JSONB), pinned_at (nullable), pinned_by (nullable), edited_at (nullable), deleted_at (nullable — soft delete), source_note_id (nullable), created_at
```

### Task

1. **Create** `apps/web/src/data/thread-messages.ts` with these functions:

   - `createMessage(tenantId, params: CreateMessageParams): Promise<ThreadMessage>` — inserts message row. `CreateMessageParams`: `{ threadId, authorId, authorType?, messageType?, content, parentMessageId?, mentions?, attachments? }`. Default `authorType: 'user'`, `messageType: 'message'`.
   - `getMessages(tenantId, threadId, opts: MessageListOpts): Promise<PaginatedResult<ThreadMessage>>` — cursor-based pagination, sorted by `created_at ASC` (chronological). Supports filtering: `messageType`, `parentMessageId` (for reply chains), `source_note_id IS NOT NULL` (Notes lens), `attachments IS NOT NULL` (Files lens). Excludes soft-deleted messages (WHERE `deleted_at IS NULL`).
   - `editMessage(tenantId, messageId, content): Promise<ThreadMessage>` — updates content + sets `edited_at`. Does not overwrite other fields.
   - `deleteMessage(tenantId, messageId, userId): Promise<void>` — soft delete: sets `deleted_at = now()`. Writes audit log via `writeAuditLog()` with action `'message.deleted'`.
   - `pinMessage(tenantId, messageId, userId): Promise<void>` — sets `pinned_at = now()`, `pinned_by = userId`.
   - `unpinMessage(tenantId, messageId): Promise<void>` — sets `pinned_at = null`, `pinned_by = null`.
   - `getPinnedMessages(tenantId, threadId): Promise<ThreadMessage[]>` — WHERE `pinned_at IS NOT NULL`, sorted by `pinned_at DESC` (most recent first).
   - `searchThreadMessages(tenantId, threadId, query): Promise<ThreadMessage[]>` — `ILIKE` search on `content::text`. Return matching messages sorted by `created_at DESC`. Limit 50 results.

2. **Define types:**
   - `ThreadMessage` — DB row type
   - `CreateMessageParams` — as described above
   - `MessageListOpts` — `{ cursor?: string; limit?: number; messageType?: string; parentMessageId?: string; lensFilter?: 'notes' | 'activity' | 'files' }`

3. All queries use `getDbForTenant()`. Soft-deleted messages excluded from all reads except explicit admin queries.

### Acceptance Criteria

- [ ] `createMessage()` inserts message with UUIDv7 id and returns the new row
- [ ] `getMessages()` supports cursor pagination with chronological sort and lens filters (notes, activity, files)
- [ ] `editMessage()` updates content and sets `edited_at` timestamp
- [ ] `deleteMessage()` soft-deletes (sets `deleted_at`) and writes audit log
- [ ] `pinMessage()` / `unpinMessage()` update `pinned_at` and `pinned_by` columns
- [ ] `searchThreadMessages()` performs `ILIKE` on `content::text` with 50-result limit
- [ ] All functions use `getDbForTenant()` and are tenant-scoped
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Real-time message broadcast (Unit 3)
- Notification triggers on message creation (Unit 2)
- Message UI rendering (Unit 4)
- Emoji reaction mutations (keep reactions JSONB, add mutation in Prompt 4)

---

## Prompt 4: Participant, Saved Messages, Factories & Server Actions

**Unit:** 1
**Depends on:** 2, 3
**Load context:** `communications.md` lines 115–128 (Threaded Replies — participant auto-add, notification rules), `communications.md` lines 148–182 (Pinned, Bookmarks & Presence — saved messages spec), `data-model.md` lines 122–130 (Personal / Notifications — user_saved_messages)
**Target files:** `apps/web/src/data/thread-participants.ts`, `apps/web/src/data/saved-messages.ts`, `packages/shared/testing/factories/threads.ts`, `apps/web/src/actions/threads.ts`
**Migration required:** No
**Git:** Commit with message "feat(data): participants, saved messages, factories, server actions [Phase 3C, Prompt 4]"

### Schema Snapshot

```
thread_participants: id (UUIDv7 PK), thread_id, user_id (nullable), participant_type (VARCHAR DEFAULT 'user'), external_contact_id (nullable), joined_at, last_read_at, muted (boolean)
user_saved_messages: id (UUIDv7 PK), user_id, message_id (FK → thread_messages.id), tenant_id, note (TEXT nullable), saved_at
```

### Task

1. **Create** `apps/web/src/data/thread-participants.ts`:
   - `addParticipant(tenantId, threadId, userId): Promise<ThreadParticipant>` — insert participant row. Idempotent (upsert on conflict).
   - `removeParticipant(tenantId, threadId, userId): Promise<void>` — delete participant row.
   - `listParticipants(tenantId, threadId): Promise<ThreadParticipant[]>` — all participants for a thread.
   - `updateLastRead(tenantId, threadId, userId): Promise<void>` — set `last_read_at = now()` for unread tracking.
   - `getUnreadCounts(tenantId, userId): Promise<Record<string, number>>` — for each thread the user participates in, count messages after `last_read_at`. Returns `{ [threadId]: count }`.

2. **Create** `apps/web/src/data/saved-messages.ts`:
   - `saveMessage(tenantId, userId, messageId, note?): Promise<UserSavedMessage>` — insert saved message row.
   - `unsaveMessage(tenantId, userId, messageId): Promise<void>` — delete saved message row.
   - `listSavedMessages(tenantId, userId, opts: PaginationOpts): Promise<PaginatedResult<UserSavedMessage>>` — cursor-paginated, sorted by `saved_at DESC`.

3. **Create** `packages/shared/testing/factories/threads.ts`:
   - `createTestThread(overrides?)` — creates a thread with defaults (scope_type: 'record', thread_type: 'internal').
   - `createTestMessage(overrides?)` — creates a thread_message with defaults.
   - `createTestParticipant(overrides?)` — creates a thread_participant with defaults.
   - All factories use `generateUUIDv7()` for IDs and accept tenant_id as required parameter.

4. **Create** `apps/web/src/actions/threads.ts` with server actions:
   - `sendMessage(formData)` — validates Clerk session, workspace membership, calls `createMessage`.
   - `editMessageAction(messageId, content)` — validates author is current user.
   - `deleteMessageAction(messageId)` — validates author is current user OR Manager+.
   - `pinMessageAction(messageId)` — validates user is thread participant (Members pin in their threads, Manager+ pins anywhere).
   - `unpinMessageAction(messageId)` — same permission check as pin.
   - `saveMessageAction(messageId, note?)` — saves message for current user.
   - `unsaveMessageAction(messageId)` — unsaves for current user.
   - `createDMAction(targetUserId)` — calls `getOrCreateDMThread`.
   - `createGroupDMAction(participantIds, name?)` — calls `createGroupDM`.
   - All actions use Clerk session for auth, extract tenantId from context.

5. **Write tests:**
   - Tenant isolation tests for all data functions using `testTenantIsolation()`.
   - `getOrCreateDMThread` deterministic test: (A,B) and (B,A) return same thread.
   - `createGroupDM` validation: reject <3 or >8 participants.
   - `deleteMessage` audit log verification.
   - `getUnreadCounts` accuracy test.
   - `searchThreadMessages` ILIKE test.

### Acceptance Criteria

- [ ] [CONTRACT] `addParticipant`, `removeParticipant`, `listParticipants`, `updateLastRead`, `getUnreadCounts` exported from `apps/web/src/data/thread-participants.ts`
- [ ] [CONTRACT] `saveMessage`, `unsaveMessage`, `listSavedMessages` exported from `apps/web/src/data/saved-messages.ts`
- [ ] [CONTRACT] `createTestThread()`, `createTestMessage()`, `createTestParticipant()` exported from `packages/shared/testing/factories/threads.ts`
- [ ] [CONTRACT] Server actions `sendMessage`, `editMessageAction`, `deleteMessageAction`, `pinMessageAction`, `unpinMessageAction`, `saveMessageAction`, `unsaveMessageAction`, `createDMAction`, `createGroupDMAction` exported from `apps/web/src/actions/threads.ts`
- [ ] `addParticipant` is idempotent (no error on duplicate)
- [ ] `getUnreadCounts` returns accurate per-thread unread counts based on `last_read_at`
- [ ] Server actions validate Clerk session and workspace membership
- [ ] `testTenantIsolation()` passes for all data functions
- [ ] ≥90% line coverage on data functions, ≥85% branch coverage
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Notification triggers in server actions (Unit 2 integration)
- Real-time event publishing in server actions (Unit 3 integration)
- Emoji reaction CRUD (keep reactions JSONB, mutation added when UI needs it in Unit 5)
- UI components for any of these features

---

## VERIFY SESSION BOUNDARY (after Prompts 1–4) — Completes Unit 1

**Scope:** Verify all work from Prompts 1–4 integrates correctly.
**Unit status:** Unit 1 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met (≥90% lines, ≥85% branches on data functions)
5. `pnpm turbo db:migrate` — migration applies cleanly
6. `pnpm turbo db:migrate:check` — no lock violations

**Interface contract check:**
Verify these exports exist and match the subdivision doc's contract:
- [ ] [CONTRACT] `createThread`, `getThread`, `getThreadByScope`, `listThreadsForUser`, `getOrCreateDMThread`, `createGroupDM` from `apps/web/src/data/threads.ts`
- [ ] [CONTRACT] `createMessage`, `getMessages`, `editMessage`, `deleteMessage`, `pinMessage`, `unpinMessage`, `getPinnedMessages`, `searchThreadMessages` from `apps/web/src/data/thread-messages.ts`
- [ ] [CONTRACT] `addParticipant`, `removeParticipant`, `listParticipants`, `updateLastRead`, `getUnreadCounts` from `apps/web/src/data/thread-participants.ts`
- [ ] [CONTRACT] `saveMessage`, `unsaveMessage`, `listSavedMessages` from `apps/web/src/data/saved-messages.ts`
- [ ] [CONTRACT] Server actions from `apps/web/src/actions/threads.ts`
- [ ] [CONTRACT] Factories from `packages/shared/testing/factories/threads.ts`
- [ ] [CONTRACT] Migration adds `source_note_id` to `thread_messages`

**State file updates:**
- Update TASK-STATUS.md: Unit 1 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 1–4, unit 1 complete [Phase 3C, VP-1]", then push branch to origin.

Fix any failures before proceeding to Prompt 5.

---

## — Unit 2: Notification Pipeline & System Email —

### Unit Context

This unit implements the notification aggregation and delivery pipeline — the system that routes events (mentions, DMs, replies, system alerts) into the notification bell and email. It includes the `NotificationService` with BullMQ job processing, system email templates via Resend, client thread notification email, and notification preference management. This is the server-side backbone; the notification UI renders in Unit 6.

**Interface Contract:**
Produces: `NotificationService.create()` from `apps/web/src/lib/notifications/notification-service.ts`; `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead` from `apps/web/src/data/notifications.ts`; `getNotificationPreferences`, `updateNotificationPreferences` from `apps/web/src/data/notification-preferences.ts`; BullMQ `notification` queue; `ResendEmailService` from `apps/web/src/lib/email/resend-service.ts`; React Email templates; server actions from `apps/web/src/actions/notifications.ts`
Consumes: Unit 1 types (`Thread`, `ThreadMessage`), existing Drizzle schema, BullMQ queue pattern, Redis client

---

## Prompt 5: NotificationService Core & Notification Data Functions

**Unit:** 2
**Depends on:** Unit 1 complete (produces `Thread`, `ThreadMessage` types)
**Load context:** `communications.md` lines 184–312 (Notification Aggregation & Delivery — data model, 8 types, delivery pipeline, error handling), `data-model.md` lines 122–130 (Personal / Notifications tables)
**Target files:** `apps/web/src/lib/notifications/notification-service.ts`, `apps/web/src/data/notifications.ts`
**Migration required:** No
**Git:** Commit with message "feat(notifications): NotificationService core + data functions [Phase 3C, Prompt 5]"

### Schema Snapshot

```
notifications: id (UUIDv7 PK), user_id (FK → users), tenant_id, type (VARCHAR), title (VARCHAR), body (VARCHAR nullable), source_type (VARCHAR), source_thread_id (nullable FK → threads), source_message_id (nullable FK → thread_messages), source_record_id (nullable), actor_id (nullable FK → users), group_key (VARCHAR nullable), read (BOOLEAN default false), read_at (nullable), created_at
  Indexes: (user_id, tenant_id, read, created_at DESC), (user_id, tenant_id, created_at DESC), (group_key, created_at)

user_notification_preferences: id, user_id, tenant_id, preferences (JSONB), updated_at
```

### Task

1. **Read** `packages/shared/db/schema/notifications.ts` and `packages/shared/db/schema/user-notification-preferences.ts` for column definitions.

2. **Create** `apps/web/src/data/notifications.ts`:
   - `createNotification(tenantId, params: CreateNotificationParams): Promise<Notification>` — inserts notification row.
   - `getNotifications(tenantId, userId, opts: NotificationListOpts): Promise<PaginatedResult<Notification>>` — cursor-based pagination, sorted by `created_at DESC`. Supports `read` boolean filter.
   - `getUnreadNotificationCount(tenantId, userId): Promise<number>` — Redis-cached at key `cache:notif:unread:t:{tenantId}:u:{userId}` with 5s TTL. Fallback to DB count on cache miss.
   - `markNotificationRead(tenantId, userId, notificationId): Promise<void>` — sets `read = true`, `read_at = now()`. Invalidates unread count cache.
   - `markAllNotificationsRead(tenantId, userId): Promise<void>` — bulk update. Invalidates unread count cache.

3. **Create** `apps/web/src/lib/notifications/notification-service.ts`:
   - `NotificationService` class with `create(params: CreateNotificationParams)` method that orchestrates:
     a. Insert notification row via `createNotification()`
     b. Check user notification preferences for this notification type
     c. If `inApp` enabled: publish to Redis channel `user:{userId}:notifications`
     d. If `email = 'instant'`: enqueue BullMQ job `notification.email.send`
     e. If notification type is `mention` or `dm`: always deliver immediately regardless of mute schedule (priority override)
     f. If `thread_participants.muted` is true for `thread_reply` type: suppress (but NOT for `mention`)
   - **Failure handling:** Notification insert failure logs error but does NOT throw — best-effort delivery. Wrap in try/catch.

4. **Define types:**
   - `Notification` — DB row type
   - `CreateNotificationParams` — `{ userId, tenantId, type, title, body?, sourceType, sourceThreadId?, sourceMessageId?, sourceRecordId?, actorId?, groupKey? }`
   - `NotificationType` — `'mention' | 'dm' | 'thread_reply' | 'approval_requested' | 'approval_decided' | 'automation_failed' | 'sync_error' | 'system'` (use string type with comment, per VARCHAR convention)
   - `NotificationListOpts` — `{ cursor?, limit?, read? }`

5. **Write tests:** Tenant isolation for all data functions. NotificationService routing tests for each notification type. Priority override test (mention/dm bypass mute). Muted thread_reply suppression test. Redis cache hit/miss test for unread count.

### Acceptance Criteria

- [ ] `NotificationService.create()` inserts notification, checks preferences, routes to in-app and/or email
- [ ] 8 notification types supported: `mention`, `dm`, `thread_reply`, `approval_requested`, `approval_decided`, `automation_failed`, `sync_error`, `system`
- [ ] `mention` and `dm` types always deliver immediately regardless of mute schedule (priority override)
- [ ] `thread_participants.muted` suppresses `thread_reply` notifications but NOT `mention` notifications
- [ ] Redis-cached unread count at `cache:notif:unread:t:{tenantId}:u:{userId}` with 5s TTL
- [ ] Notification insert failure does NOT block the originating action (best-effort)
- [ ] `testTenantIsolation()` passes for all notification data functions
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- BullMQ queue registration or email processor (Prompt 6)
- React Email templates (Prompt 7)
- Notification preferences CRUD (Prompt 7)
- Notification UI (Unit 6)
- Email digest functionality (post-MVP)

---

## Prompt 6: BullMQ Notification Queue + Email Send Processor + Resend Service

**Unit:** 2
**Depends on:** 5
**Load context:** `communications.md` lines 268–312 (Delivery Pipeline + Error Handling), `email.md` lines 10–16 (Email Provider Stack), `email.md` lines 18–34 (Sender Identity — Tier 1), `email.md` lines 37–51 (MVP System Emails)
**Target files:** `apps/worker/src/processors/notification/email-send.ts`, `apps/worker/src/processors/notification/cleanup.ts`, `apps/web/src/lib/email/resend-service.ts`, `apps/worker/src/queues.ts` (update)
**Migration required:** No
**Git:** Commit with message "feat(worker): notification BullMQ queue + Resend email service [Phase 3C, Prompt 6]"

### Task

1. **Read** `apps/worker/src/queues.ts` for queue registration pattern and `apps/worker/src/lib/job-wrapper.ts` for processor pattern.
2. **Read** `apps/worker/src/processors/file-scan.ts` as processor implementation reference.

3. **Register BullMQ queue** `notification` in `apps/worker/src/queues.ts` with job types:
   - `notification.email.send` — send email via Resend
   - `notification.cleanup` — delete notifications older than 90 days

4. **Create** `apps/web/src/lib/email/resend-service.ts`:
   - `ResendEmailService` class wrapping the Resend API:
     - `send(params: SendEmailParams): Promise<void>` — sends email via Resend SDK
     - `SendEmailParams`: `{ to: string | string[]; subject: string; html: string; from?: string }` — defaults `from` to `notifications@everystack.com`
   - Use `RESEND_API_KEY` env var. Wrap in try/catch with logging on failure.

5. **Create** `apps/worker/src/processors/notification/email-send.ts`:
   - `processNotificationEmail(job)` — receives notification data, renders email HTML from the appropriate template, sends via `ResendEmailService`.
   - Retry config: 3 attempts with exponential backoff (1min, 5min, 15min).
   - On final failure: log error, mark job as failed. Do not retry further.

6. **Create** `apps/worker/src/processors/notification/cleanup.ts`:
   - `processNotificationCleanup(job)` — deletes notifications older than 90 days.
   - Schedule: runs daily (cron job configuration).

7. **Write tests:** Queue registration verification. Email send success/failure paths. Retry backoff configuration verification. Cleanup job deletes correct rows.

### Acceptance Criteria

- [ ] BullMQ queue `notification` registered with `notification.email.send` and `notification.cleanup` job types
- [ ] `ResendEmailService.send()` sends email via Resend API from `notifications@everystack.com`
- [ ] Email send processor retries 3× with exponential backoff (1min, 5min, 15min)
- [ ] Notification cleanup job deletes rows older than 90 days
- [ ] Email send failure does not crash the worker — errors logged gracefully
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- React Email template components (Prompt 7)
- Email tracking / open/click tracking (post-MVP)
- Email compose UI (post-MVP)
- Connected inbox (post-MVP)
- Workspace branded sender domain (post-MVP)

---

## Prompt 7: React Email Templates + Notification Preferences + Server Actions

**Unit:** 2
**Depends on:** 5, 6
**Load context:** `email.md` lines 37–51 (MVP System Emails — invitation and system alert types), `communications.md` lines 234–253 (Notification Preferences JSONB structure), `phase-division-phase3-part1.md` lines 184–213 (3C scope — client thread notification email spec)
**Target files:** `apps/web/src/lib/email/templates/invitation-email.tsx`, `apps/web/src/lib/email/templates/system-alert-email.tsx`, `apps/web/src/lib/email/templates/client-thread-reply-email.tsx`, `apps/web/src/data/notification-preferences.ts`, `apps/web/src/actions/notifications.ts`
**Migration required:** No
**Git:** Commit with message "feat(email): React Email templates + notification preferences + actions [Phase 3C, Prompt 7]"

### Task

1. **Create** React Email templates in `apps/web/src/lib/email/templates/`:
   - `InvitationEmail` — "You've been invited to join {workspaceName} on EveryStack." EveryStack branding, CTA button with invite link. Props: `{ workspaceName, inviterName, inviteUrl }`.
   - `SystemAlertEmail` — system alerts (sync failures, automation errors, storage quota). Props: `{ alertType, alertTitle, alertBody, workspaceName, dashboardUrl }`.
   - `ClientThreadReplyEmail` — fires when workspace user posts in client thread. Includes message preview (first 120 chars) + link to portal. Props: `{ senderName, recordTitle, messagePreview, portalUrl }`.
   - All templates: server-side rendered via React Email. From: `notifications@everystack.com`. EveryStack branding (logo, colors). Not user-editable — system templates.

2. **Install** `@react-email/components` if not already present.

3. **Create** `apps/web/src/data/notification-preferences.ts`:
   - `getNotificationPreferences(tenantId, userId): Promise<NotificationPreferences>` — fetch user preferences. Returns defaults if no row exists.
   - `updateNotificationPreferences(tenantId, userId, prefs: Partial<NotificationPreferences>): Promise<void>` — upsert preferences JSONB.
   - Default preferences: mentions & DMs → inApp: true, email: 'instant'. All others → inApp: true, email: 'digest'. digestFrequency: 'daily'.
   - Type: `NotificationPreferences` per communications.md spec.

4. **Create** `apps/web/src/actions/notifications.ts`:
   - `markNotificationReadAction(notificationId)` — Clerk auth, calls `markNotificationRead`.
   - `markAllReadAction()` — Clerk auth, calls `markAllNotificationsRead`.
   - `updateNotificationPreferencesAction(prefs)` — Clerk auth, Zod validation, calls `updateNotificationPreferences`.

5. **Wire templates** into the email send processor from Prompt 6 — processor determines template based on notification type, renders to HTML, sends via Resend.

6. **Write tests:** Template rendering snapshot tests. Preference defaults test. Preference update merges correctly. Server action auth validation. Tenant isolation for preference functions.

### Acceptance Criteria

- [ ] [CONTRACT] `InvitationEmail`, `SystemAlertEmail`, `ClientThreadReplyEmail` templates exported from `apps/web/src/lib/email/templates/`
- [ ] [CONTRACT] `getNotificationPreferences`, `updateNotificationPreferences` exported from `apps/web/src/data/notification-preferences.ts`
- [ ] [CONTRACT] `markNotificationReadAction`, `markAllReadAction`, `updateNotificationPreferencesAction` exported from `apps/web/src/actions/notifications.ts`
- [ ] [CONTRACT] `ResendEmailService.send()` exported from `apps/web/src/lib/email/resend-service.ts`
- [ ] System email templates render via React Email from `notifications@everystack.com`
- [ ] Client thread reply email includes message preview and portal link
- [ ] Notification preferences return sensible defaults when no row exists
- [ ] `testTenantIsolation()` passes for preference data functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥90% line coverage on notification data layer, ≥85% branch coverage

### Do NOT Build

- Notification bell UI or tray (Unit 6)
- Email digest scheduling (post-MVP)
- Email tracking / webhooks (post-MVP)
- Custom email templates (post-MVP)
- Notification grouping UI logic (Unit 6)

---

## VERIFY SESSION BOUNDARY (after Prompts 5–7) — Completes Unit 2

**Scope:** Verify all work from Prompts 5–7 integrates correctly.
**Unit status:** Unit 2 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: BullMQ notification queue registered in worker

**Interface contract check:**
- [ ] [CONTRACT] `NotificationService.create()` exported from `apps/web/src/lib/notifications/notification-service.ts`
- [ ] [CONTRACT] `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead` from `apps/web/src/data/notifications.ts`
- [ ] [CONTRACT] `getNotificationPreferences`, `updateNotificationPreferences` from `apps/web/src/data/notification-preferences.ts`
- [ ] [CONTRACT] BullMQ queue `notification` registered with `notification.email.send` and `notification.cleanup` job types
- [ ] [CONTRACT] `ResendEmailService.send()` from `apps/web/src/lib/email/resend-service.ts`
- [ ] [CONTRACT] React Email templates: `InvitationEmail`, `SystemAlertEmail`, `ClientThreadReplyEmail`
- [ ] [CONTRACT] Server actions from `apps/web/src/actions/notifications.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 2 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 5–7, unit 2 complete [Phase 3C, VP-2]", then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## — Unit 3: Presence & Real-Time Chat Infrastructure —

### Unit Context

This unit is the real-time transport layer for all communications. It extends the existing Socket.IO server with chat-specific event handlers (message delivery, typing indicators, thread room management), the presence system (online/away/DND/offline with Redis heartbeat), and the notification real-time push channel. Units 5 and 6 consume these handlers from their React components via hooks.

**Interface Contract:**
Produces: `PresenceService` from `apps/realtime/src/services/presence-service.ts`; `ChatHandler`, `PresenceHandler`, `NotificationHandler` from `apps/realtime/src/handlers/`; `publishChatEvent` from `apps/web/src/lib/realtime/chat-events.ts`; `publishNotificationEvent` from `apps/web/src/lib/realtime/notification-events.ts`; custom status CRUD from `apps/web/src/data/presence.ts`; types from `apps/realtime/src/types/chat.ts`
Consumes: Unit 1 types (`Thread`, `ThreadMessage`), existing Socket.IO server, room handler pattern, Redis subscriber pattern, auth middleware

---

## Prompt 8: PresenceService (Redis Heartbeat + Custom Status)

**Unit:** 3
**Depends on:** Unit 1 complete (produces `Thread`, `ThreadMessage` types)
**Load context:** `communications.md` lines 148–182 (Pinned, Bookmarks & Presence — presence states, Redis storage, DND behavior, custom status), `realtime.md` lines 149–164 (Presence System — Redis key pattern, TTL, heartbeat)
**Target files:** `apps/realtime/src/services/presence-service.ts`, `apps/web/src/data/presence.ts`, `apps/realtime/src/types/chat.ts`
**Migration required:** No
**Git:** Commit with message "feat(realtime): PresenceService with Redis heartbeat + custom status [Phase 3C, Prompt 8]"

### Task

1. **Read** `apps/realtime/src/socket-io-realtime-service.ts` for existing service patterns and `packages/shared/db/schema/workspace-memberships.ts` for custom status columns.

2. **Create** `apps/realtime/src/types/chat.ts` — shared types for all chat/presence/notification events:
   - `PresenceState`: `'online' | 'away' | 'dnd' | 'offline'` (use string type with comment)
   - `PresenceEntry`: `{ userId: string; state: PresenceState; lastActiveAt: number; customStatus?: { emoji: string; text: string } }`
   - `ChatEvent`: `{ type: 'message:new' | 'message:edit' | 'message:delete'; threadId: string; payload: unknown }`
   - `TypingEvent`: `{ threadId: string; userId: string; displayName: string }`

3. **Create** `apps/realtime/src/services/presence-service.ts`:
   - `PresenceService` class:
     - `setPresence(tenantId, roomId, userId, state): Promise<void>` — SET Redis key `presence:t:{tenantId}:{roomId}:{userId}` with 60s TTL. Value: JSON `{ state, lastActiveAt }`.
     - `getPresence(tenantId, roomId): Promise<PresenceEntry[]>` — SCAN for `presence:t:{tenantId}:{roomId}:*`, parse values.
     - `heartbeat(tenantId, userId): Promise<void>` — refresh TTL on all user's presence keys. Called every 30s by client.
     - `getUserStatus(tenantId, userId): Promise<PresenceState>` — check any room key for this user. If none found, return 'offline'.
     - `removePresence(tenantId, roomId, userId): Promise<void>` — DEL key immediately on disconnect.

4. **Create** `apps/web/src/data/presence.ts`:
   - `updateCustomStatus(tenantId, userId, emoji, text, clearAt?): Promise<void>` — update `workspace_memberships.status_emoji`, `status_text`, `status_clear_at`.
   - `getCustomStatus(tenantId, userId): Promise<{ emoji: string; text: string; clearAt: Date | null } | null>` — read custom status from workspace_memberships.
   - `clearExpiredStatuses(): Promise<void>` — for scheduled cleanup of auto-clear statuses.

5. **Write tests:** Presence TTL expiry behavior. Heartbeat refreshes TTL. DND state detection. Custom status CRUD. Tenant isolation on presence data.

### Acceptance Criteria

- [ ] Presence heartbeat stores state in Redis `presence:t:{tenantId}:{roomId}:{userId}` with 60s TTL
- [ ] 4 presence states supported: online (green), away (5min idle), DND (mutes notifications), offline
- [ ] Custom status (emoji + text + auto-clear) persists to `workspace_memberships`
- [ ] `heartbeat()` refreshes TTL on all user's presence keys
- [ ] `removePresence()` immediately removes key on disconnect
- [ ] Types `PresenceState`, `PresenceEntry`, `ChatEvent`, `TypingEvent` exported from `apps/realtime/src/types/chat.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Socket.IO event handlers (Prompt 9)
- Presence UI components (Unit 6)
- Cursor broadcasting (post-MVP)

---

## Prompt 9: ChatHandler + PresenceHandler + NotificationHandler (Socket.IO)

**Unit:** 3
**Depends on:** 8
**Load context:** `realtime.md` lines 17–42 (Transport Abstraction), `realtime.md` lines 44–57 (Room Model — thread room pattern), `realtime.md` lines 109–128 (Event Flow), `realtime.md` lines 166–185 (Chat / DM Message Delivery — message flow, typing indicators)
**Target files:** `apps/realtime/src/handlers/chat-handler.ts`, `apps/realtime/src/handlers/presence-handler.ts`, `apps/realtime/src/handlers/notification-handler.ts`
**Migration required:** No
**Git:** Commit with message "feat(realtime): Chat, Presence, Notification Socket.IO handlers [Phase 3C, Prompt 9]"

### Task

1. **Read** `apps/realtime/src/handlers/room-handler.ts` for handler pattern reference and `apps/realtime/src/middleware/auth.ts` for auth middleware pattern.

2. **Create** `apps/realtime/src/handlers/chat-handler.ts` — `ChatHandler` class:
   - `thread:join` — add user to Socket.IO room `thread:{threadId}`. Validate tenant context via auth middleware. Set presence in thread room.
   - `thread:leave` — remove user from room. Remove presence from thread room.
   - `message:new` — receive from Redis subscriber (not directly from client). Broadcast to all room members except sender.
   - `message:edit` — broadcast edit event to thread room.
   - `message:delete` — broadcast delete event to thread room.
   - `typing:start` — broadcast to thread room excluding sender. Include user display name.
   - `typing:stop` — broadcast stop event. Auto-fires 3 seconds after last keystroke (client-side).

3. **Create** `apps/realtime/src/handlers/presence-handler.ts` — `PresenceHandler` class:
   - `presence:heartbeat` — calls `PresenceService.heartbeat()`. Client sends every 30s.
   - `presence:update` — user manually sets state (e.g., DND toggle). Calls `PresenceService.setPresence()`, broadcasts to workspace room.
   - `presence:status` — request current user's presence state.
   - On disconnect: `PresenceService.removePresence()` for all rooms.

4. **Create** `apps/realtime/src/handlers/notification-handler.ts` — `NotificationHandler` class:
   - On connect: subscribe to Redis channel `user:{userId}:notifications`.
   - On notification event: push payload to client via Socket.IO `notification:new` event.
   - DND suppression: check user's presence state. If DND, suppress all push events except `mention` and `dm` from Owners.
   - On disconnect: unsubscribe from Redis channel.

5. **Register handlers** in `apps/realtime/src/server.ts` — add ChatHandler, PresenceHandler, NotificationHandler to the Socket.IO server setup.

6. **Write tests:** Handler registration. Room join/leave lifecycle. Message broadcast excludes sender. Typing indicator broadcast. DND notification suppression (suppress non-priority, allow mention/dm). Auth middleware validation on room join.

### Acceptance Criteria

- [ ] `thread:join` adds user to Socket.IO room `thread:{threadId}`, `thread:leave` removes
- [ ] `message:new` event broadcasts to all room members except sender
- [ ] Typing indicator events (`typing:start`, `typing:stop`) broadcast to thread room
- [ ] NotificationHandler subscribes to user's Redis notification channel on connect, pushes events via Socket.IO
- [ ] DND state suppresses all notification push events except `mention` and `dm` from Owners
- [ ] All handlers validate tenant context via existing auth middleware
- [ ] Handlers registered in `apps/realtime/src/server.ts`
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Redis pub/sub publisher (Prompt 10 — web app side)
- Cursor broadcasting (post-MVP)
- Approval workflow events (post-MVP)
- Portal real-time blocks (post-MVP)

---

## Prompt 10: Redis Pub/Sub Chat Event Publisher + Subscriber

**Unit:** 3
**Depends on:** 9
**Load context:** `realtime.md` lines 109–128 (Event Flow — Redis as event bus, publisher/subscriber pattern), `realtime.md` lines 166–185 (Chat / DM Message Delivery — target <200ms)
**Target files:** `apps/web/src/lib/realtime/chat-events.ts`, `apps/web/src/lib/realtime/notification-events.ts`, `apps/realtime/src/subscribers/chat-event-subscriber.ts`
**Migration required:** No
**Git:** Commit with message "feat(realtime): Redis pub/sub chat event publisher + subscriber [Phase 3C, Prompt 10]"

### Task

1. **Read** `apps/realtime/src/subscribers/redis-event-subscriber.ts` for existing subscriber pattern.

2. **Create** `apps/web/src/lib/realtime/chat-events.ts` — publisher functions called from web app Server Actions:
   - `publishChatEvent(tenantId, threadId, event: ChatEvent): Promise<void>` — publishes to Redis channel `thread:{threadId}`. Called after message is persisted to DB. Fire-and-forget — failure logged but does not block.
   - Event types: `message:new`, `message:edit`, `message:delete`

3. **Create** `apps/web/src/lib/realtime/notification-events.ts` — publisher function:
   - `publishNotificationEvent(userId, notification: Notification): Promise<void>` — publishes to Redis channel `user:{userId}:notifications`. Called by NotificationService after creating notification.

4. **Create** `apps/realtime/src/subscribers/chat-event-subscriber.ts`:
   - Subscribes to `thread:*` Redis channels for cross-process message delivery.
   - On message: forward event to the appropriate Socket.IO room via ChatHandler.
   - Pattern subscription for dynamic thread channels.

5. **Integration point:** Update Unit 1's server actions (`apps/web/src/actions/threads.ts`) to call `publishChatEvent()` after successful message creation. Update Unit 2's `NotificationService` to call `publishNotificationEvent()` after notification creation. If these files already exist from earlier prompts, add the integration calls.

6. **Write tests:** Publisher encodes events correctly. Subscriber forwards to correct room. Cross-process delivery end-to-end test (mock Redis pub/sub). Notification event publishing. Publisher failure does not throw.

### Acceptance Criteria

- [ ] [CONTRACT] `publishChatEvent(tenantId, threadId, event)` exported from `apps/web/src/lib/realtime/chat-events.ts`
- [ ] [CONTRACT] `publishNotificationEvent(userId, notification)` exported from `apps/web/src/lib/realtime/notification-events.ts`
- [ ] [CONTRACT] Chat event subscriber at `apps/realtime/src/subscribers/chat-event-subscriber.ts`
- [ ] Redis pub/sub used for cross-process message delivery (horizontal scaling via Redis adapter)
- [ ] Server actions call `publishChatEvent()` after message creation
- [ ] NotificationService calls `publishNotificationEvent()` after notification creation
- [ ] Publisher failure is fire-and-forget — logged but does not block
- [ ] ≥85% line coverage on handlers, ≥80% branch coverage
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Client-side Socket.IO subscription hooks (Unit 5)
- Notification UI (Unit 6)
- Redis Streams catch-up (existing from 1G)

---

## VERIFY SESSION BOUNDARY (after Prompts 8–10) — Completes Unit 3

**Scope:** Verify all work from Prompts 8–10 integrates correctly.
**Unit status:** Unit 3 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: Socket.IO handlers registered, Redis pub/sub channels functional

**Interface contract check:**
- [ ] [CONTRACT] `PresenceService` with `setPresence`, `getPresence`, `heartbeat`, `getUserStatus` from `apps/realtime/src/services/presence-service.ts`
- [ ] [CONTRACT] `ChatHandler` handling `thread:join`, `thread:leave`, `message:new`, `message:edit`, `message:delete`, `typing:start`, `typing:stop` from `apps/realtime/src/handlers/chat-handler.ts`
- [ ] [CONTRACT] `PresenceHandler` handling `presence:heartbeat`, `presence:update`, `presence:status` from `apps/realtime/src/handlers/presence-handler.ts`
- [ ] [CONTRACT] `NotificationHandler` subscribed to `user:{userId}:notifications` from `apps/realtime/src/handlers/notification-handler.ts`
- [ ] [CONTRACT] `publishChatEvent` from `apps/web/src/lib/realtime/chat-events.ts`
- [ ] [CONTRACT] `publishNotificationEvent` from `apps/web/src/lib/realtime/notification-events.ts`
- [ ] [CONTRACT] Custom status CRUD from `apps/web/src/data/presence.ts`
- [ ] [CONTRACT] Types from `apps/realtime/src/types/chat.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 3 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 8–10, unit 3 complete [Phase 3C, VP-3]", then push branch to origin.

Fix any failures before proceeding to Prompt 11.

---

## — Unit 4: Chat Editor (TipTap Environment 1) —

### Unit Context

The Chat Editor is a standalone, lightweight TipTap editor component used across all messaging surfaces: Record Thread, DMs, Group DMs, Chat Quick Panel, and later portals. It implements progressive disclosure from a simple text input to a full rich-text composer with @mentions, markdown shortcuts, emoji reactions, and attachments. This unit has no unit-to-unit dependencies and can be built in parallel with all other units.

**Interface Contract:**
Produces: `ChatEditor`, `ChatEditorToolbar`, `MentionDropdown`, `EmojiPicker`, `EmojiReactions`, `MessageRenderer`, `MessageItem`, `ChatAttachmentButton` from `apps/web/src/components/chat/`; `useChatEditor` hook; `chatEditorExtensions` config; `ChatEditorConfig`, `ChatEditorInstance`, `MentionSuggestion` types
Consumes: TipTap libraries, emoji-mart, existing shadcn/ui components

---

## Prompt 11: TipTap Extension Config + useChatEditor Hook

**Unit:** 4
**Depends on:** None
**Load context:** `communications.md` lines 294–415 (Chat Editor TipTap Env 1 — full spec: input states, progressive disclosure, keyboard shortcuts, @mentions, markdown shortcuts, bubble toolbar, link handling, TipTap extensions loaded)
**Target files:** `apps/web/src/components/chat/extensions.ts`, `apps/web/src/components/chat/use-chat-editor.ts`, `apps/web/src/components/chat/types.ts`
**Migration required:** No
**Git:** Commit with message "feat(chat): TipTap extension config + useChatEditor hook [Phase 3C, Prompt 11]"

### Task

1. **Install TipTap dependencies** (if not already present): `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-mention`, `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/extension-underline`. Install `emoji-mart` and `@emoji-mart/react` and `@emoji-mart/data`.

2. **Create** `apps/web/src/components/chat/types.ts`:
   - `ChatEditorConfig`: `{ placeholder?: string; onSend: (content: JSONContent) => void; onAttach?: (files: File[]) => void; mentionSuggestions?: MentionSuggestion[]; maxHeight?: number }`
   - `ChatEditorInstance`: `{ editor: Editor; state: 'compact' | 'focused' | 'expanded'; send: () => void; isEmpty: boolean }`
   - `MentionSuggestion`: `{ id: string; label: string; avatar?: string; role?: string }`

3. **Create** `apps/web/src/components/chat/extensions.ts` — `chatEditorExtensions` array:
   - Bold, Italic, Underline, Strike, Code (inline marks)
   - BulletList, OrderedList, Blockquote
   - Link (autolink + Cmd+K)
   - Mention (custom — renders as teal pill, non-editable inline)
   - Placeholder
   - History (undo/redo)
   - InputRules (markdown shortcuts: `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `- ` bullets, `1. ` ordered, `> ` blockquote)
   - **NOT included:** Headings, Tables, CodeBlock, Image, HorizontalRule (chat, not docs)

4. **Create** `apps/web/src/components/chat/use-chat-editor.ts` — `useChatEditor(config: ChatEditorConfig): ChatEditorInstance`:
   - Manages 3 input states: Compact → Focused → Expanded.
   - State transitions: click/focus → Focused; Shift+Enter/paste multi-line → Expanded; blur empty → Compact.
   - Keyboard handling:
     - Enter sends in Compact/Focused
     - Cmd+Enter sends in Expanded
     - Escape collapses (confirm if content)
     - `↑` in empty input → edit last sent message (expose callback)
   - Wraps TipTap `useEditor` with `chatEditorExtensions`.
   - Exposes `send()`, `isEmpty`, and `state` for consumer components.

5. **Write tests:** Extension list verification (13 extensions loaded). State machine transitions (compact→focused→expanded→compact). Keyboard send behavior per state. Markdown shortcut conversion.

### Acceptance Criteria

- [ ] `chatEditorExtensions` includes: Bold, Italic, Underline, Strike, Code, BulletList, OrderedList, Blockquote, Link, Mention, Placeholder, History, InputRules
- [ ] `useChatEditor` manages 3 states: Compact, Focused, Expanded
- [ ] State transitions: click/focus → Focused; Shift+Enter → Expanded; blur empty → Compact
- [ ] Keyboard: Enter sends in Compact/Focused; Cmd+Enter sends in Expanded; Escape collapses
- [ ] Markdown shortcuts auto-convert: `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `- ` bullets, `1. ` numbers, `> ` blockquote
- [ ] Types `ChatEditorConfig`, `ChatEditorInstance`, `MentionSuggestion` exported from types file
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- ChatEditor React component (Prompt 12)
- MessageRenderer or MessageItem (Prompt 13)
- EmojiPicker or EmojiReactions (Prompt 13)
- Headings, tables, code blocks (TipTap env 2, Phase 3D)
- Slash menu (conflicts with Command Bar, explicitly excluded)

---

## Prompt 12: ChatEditor Component (3 Input States + Toolbar + Mentions)

**Unit:** 4
**Depends on:** 11
**Load context:** `communications.md` lines 294–415 (Chat Editor — input states, progressive disclosure levels, bubble toolbar, @mention system, attachments, link handling)
**Target files:** `apps/web/src/components/chat/ChatEditor.tsx`, `apps/web/src/components/chat/ChatEditorToolbar.tsx`, `apps/web/src/components/chat/MentionDropdown.tsx`, `apps/web/src/components/chat/ChatAttachmentButton.tsx`
**Migration required:** No
**Git:** Commit with message "feat(chat): ChatEditor with toolbar, mentions, attachments [Phase 3C, Prompt 12]"

### Task

1. **Read** existing shadcn/ui components (`apps/web/src/components/ui/button.tsx`, `apps/web/src/components/ui/popover.tsx`, `apps/web/src/components/ui/tooltip.tsx`) for UI pattern reference.

2. **Create** `apps/web/src/components/chat/ChatEditor.tsx`:
   - Uses `useChatEditor` hook from Prompt 11.
   - Three visual states matching progressive disclosure:
     - **Compact:** Single-line input, Enter to send. Minimal border.
     - **Focused:** Border highlights teal. Action icons appear: 📎 attach, ↕ expand, 😊 emoji.
     - **Expanded:** Multi-line (min 80px, max 240px before scroll). Cancel/Send buttons. Bubble toolbar visible on text selection.
   - Props: `{ onSend, mentionSuggestions, onAttach?, placeholder?, className? }`

3. **Create** `apps/web/src/components/chat/ChatEditorToolbar.tsx`:
   - Bubble toolbar on text selection in Expanded mode: `B` | `I` | `U` | `🔗` | `•` | `1.`
   - Six items only. Minimal, floating above selection.

4. **Create** `apps/web/src/components/chat/MentionDropdown.tsx`:
   - Triggered by `@` in editor.
   - Layout: People (avatar + name + role badge), fuzzy-filtered as user types.
   - Group mentions: `@here` (all participants), `@channel` (all scope members, Manager+ only).
   - Arrow keys + Enter to select. Escape to dismiss.
   - Selected mention → teal pill (`@Name`), non-editable inline. Backspace deletes whole pill.

5. **Create** `apps/web/src/components/chat/ChatAttachmentButton.tsx`:
   - 📎 button in input bar.
   - Triggers file picker on click.
   - Drag-drop supported onto input area.
   - Calls `onAttach` callback with selected files.
   - File preview: images (thumbnail), files (icon + name + size).

6. **Write tests:** Component render in all 3 states. Toolbar appears on selection. Mention dropdown filters on input. Mention pill rendering. Attachment button triggers file picker. Responsive behavior.

### Acceptance Criteria

- [ ] Three input states: Compact (single-line), Focused (compact + icons), Expanded (multi-line + toolbar)
- [ ] `@` triggers MentionDropdown with fuzzy-filtered workspace members, arrow keys + Enter to select
- [ ] Selected mention renders as teal pill (`@Name`), non-editable inline, backspace deletes whole pill
- [ ] Bubble toolbar appears on text selection in Expanded mode: B | I | U | Link | Bullets | Numbers
- [ ] Link auto-detection on paste/type, Cmd+K for link insertion dialog
- [ ] Attachment button triggers file picker, drag-drop supported
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Message display rendering (Prompt 13)
- Emoji picker / reactions (Prompt 13)
- Thread integration (Unit 5)
- Rich link unfurls (post-MVP)
- Inline images (attach button only)

---

## Prompt 13: MessageRenderer + MessageItem + EmojiReactions + EmojiPicker

**Unit:** 4
**Depends on:** 11
**Load context:** `communications.md` lines 410–432 (Message Display, Message Editing, Message Deletion, Emoji Reactions), `communications.md` lines 434–440 (Emoji Picker — emoji-mart spec)
**Target files:** `apps/web/src/components/chat/MessageRenderer.tsx`, `apps/web/src/components/chat/MessageItem.tsx`, `apps/web/src/components/chat/EmojiReactions.tsx`, `apps/web/src/components/chat/EmojiPicker.tsx`
**Migration required:** No
**Git:** Commit with message "feat(chat): MessageRenderer, MessageItem, EmojiReactions, EmojiPicker [Phase 3C, Prompt 13]"

### Task

1. **Create** `apps/web/src/components/chat/MessageRenderer.tsx`:
   - Read-only TipTap JSON → styled HTML renderer. **No editor instances** for displayed messages.
   - Renders all supported marks (bold, italic, underline, strike, code, link) and nodes (bullet list, ordered list, blockquote, mention pill).
   - Mention pills render as teal `@Name` spans.

2. **Create** `apps/web/src/components/chat/MessageItem.tsx`:
   - Single message display: avatar, display name, timestamp, content (via MessageRenderer).
   - Hover menu (⋯): Edit, Delete, Pin, Save, Reply actions.
   - Edit mode: inline ChatEditor replaces rendered message. Save (Cmd+Enter) / Cancel (Escape). Shows "(edited)" gray text after save.
   - Deleted messages: "This message was deleted" placeholder.
   - System messages (`message_type: 'system'`): centered, muted-text timeline entry. No edit/reply/react.
   - Props: `{ message: ThreadMessage; currentUserId: string; onEdit, onDelete, onPin, onSave, onReply callbacks }`

3. **Create** `apps/web/src/components/chat/EmojiReactions.tsx`:
   - Emoji chips below message. Each chip shows emoji + count + active state (if current user reacted).
   - Click chip to toggle add/remove reaction.
   - "+" button opens EmojiPicker for new reaction.
   - Stored in `thread_messages.reactions` JSONB: `{ "👍": ["user_id_1", "user_id_2"] }`

4. **Create** `apps/web/src/components/chat/EmojiPicker.tsx`:
   - Wraps `emoji-mart` React component.
   - Categories: Frequently Used, Smileys, People, Animals, Food, etc.
   - Search bar. Skin tone selector.
   - Colon autocomplete: `:thu` → suggests 👍.
   - Renders in Popover (shadcn/ui).

5. **Write tests:** MessageRenderer snapshot tests for each mark type. MessageItem hover menu visibility. Edit mode toggle. System message rendering (no edit/reply). Emoji reaction add/remove. Emoji picker search. Deleted message placeholder.

### Acceptance Criteria

- [ ] [CONTRACT] `ChatEditor` exported from `apps/web/src/components/chat/ChatEditor.tsx`
- [ ] [CONTRACT] `ChatEditorToolbar` exported from `apps/web/src/components/chat/ChatEditorToolbar.tsx`
- [ ] [CONTRACT] `MentionDropdown` exported from `apps/web/src/components/chat/MentionDropdown.tsx`
- [ ] [CONTRACT] `EmojiPicker` exported from `apps/web/src/components/chat/EmojiPicker.tsx`
- [ ] [CONTRACT] `EmojiReactions` exported from `apps/web/src/components/chat/EmojiReactions.tsx`
- [ ] [CONTRACT] `MessageRenderer` exported from `apps/web/src/components/chat/MessageRenderer.tsx`
- [ ] [CONTRACT] `MessageItem` exported from `apps/web/src/components/chat/MessageItem.tsx`
- [ ] [CONTRACT] `ChatAttachmentButton` exported from `apps/web/src/components/chat/ChatAttachmentButton.tsx`
- [ ] [CONTRACT] `useChatEditor` exported from `apps/web/src/components/chat/use-chat-editor.ts`
- [ ] `MessageRenderer` renders TipTap JSON as styled HTML without editor instances
- [ ] `MessageItem` shows avatar, name, timestamp, content; hover menu with edit/delete/pin/save/reply
- [ ] Edit mode: inline editor replaces rendered message, Save/Cancel, shows "(edited)"
- [ ] `EmojiReactions` renders reaction chips, click to add/remove, "+" opens emoji picker
- [ ] `EmojiPicker` uses emoji-mart with categories, search, skin tone selector, colon autocomplete
- [ ] ≥80% line coverage on components
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Thread panel integration (Unit 5)
- DM conversation view (Unit 5)
- Real-time message subscription (Unit 5)
- TipTap environment 2 features: headings, tables, code blocks, images (Phase 3D)

---

## VERIFY SESSION BOUNDARY (after Prompts 11–13) — Completes Unit 4

**Scope:** Verify all work from Prompts 11–13 integrates correctly.
**Unit status:** Unit 4 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met (≥80% on components)

**Interface contract check:**
- [ ] [CONTRACT] `ChatEditor`, `ChatEditorToolbar`, `MentionDropdown`, `EmojiPicker`, `EmojiReactions`, `MessageRenderer`, `MessageItem`, `ChatAttachmentButton` exported from `apps/web/src/components/chat/`
- [ ] [CONTRACT] `useChatEditor` hook exported from `apps/web/src/components/chat/use-chat-editor.ts`
- [ ] [CONTRACT] `chatEditorExtensions` exported from `apps/web/src/components/chat/extensions.ts`
- [ ] [CONTRACT] `ChatEditorConfig`, `ChatEditorInstance`, `MentionSuggestion` types exported from `apps/web/src/components/chat/types.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 4 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 11–13, unit 4 complete [Phase 3C, VP-4]", then push branch to origin.

Fix any failures before proceeding to Prompt 14.

---

## — Unit 5: Record Thread & DM UI —

### Unit Context

This unit builds the main messaging interfaces: the Record Thread panel that attaches to Record View (two-thread tabs, threaded replies, tab lenses, in-thread search), the DM and Group DM conversation views, and chat navigation. It wires together the data layer (Unit 1), real-time infrastructure (Unit 3), and Chat Editor (Unit 4) into interactive, real-time messaging surfaces.

**Interface Contract:**
Produces: `RecordThreadPanel`, `ThreadTabBar`, `ThreadLensBar`, `ThreadMessageList`, `ThreadReplyPanel`, `ThreadSearchBar`, `SharedNoteMessage`, `ClientVisibleBanner`, `PinnedMessagesPanel`, `ThreadNavDropdown` from `apps/web/src/components/thread/`; `DMConversation`, `GroupDMHeader` from `apps/web/src/components/chat/`; `useThread`, `useThreadSearch`, `useTypingIndicator` hooks
Consumes: Unit 1 data functions + server actions; Unit 3 `publishChatEvent` + Socket.IO events; Unit 4 `ChatEditor`, `MessageItem`, `EmojiReactions` components

---

## Prompt 14: RecordThreadPanel Shell + ThreadTabBar + ThreadLensBar + useThread Hook

**Unit:** 5
**Depends on:** Units 1, 3, 4 complete
**Load context:** `communications.md` lines 57–113 (Thread Scopes — two-thread model, Record Thread UX), `communications.md` lines 29–55 (MVP Scope — Chat Quick Panel, Chat Editor), `phase-division-phase3-part1.md` lines 184–213 (3C scope — thread tab lenses, visual distinction, client-visible indicator)
**Target files:** `apps/web/src/components/thread/RecordThreadPanel.tsx`, `apps/web/src/components/thread/ThreadTabBar.tsx`, `apps/web/src/components/thread/ThreadLensBar.tsx`, `apps/web/src/components/thread/ClientVisibleBanner.tsx`, `apps/web/src/components/thread/SharedNoteMessage.tsx`, `apps/web/src/components/thread/use-thread.ts`
**Migration required:** No
**Git:** Commit with message "feat(thread): RecordThreadPanel shell with tabs, lenses, useThread [Phase 3C, Prompt 14]"

### Task

1. **Read** `apps/web/src/components/record-view/RecordView.tsx` and `apps/web/src/components/record-view/RecordViewHeader.tsx` for layout integration.

2. **Create** `apps/web/src/components/thread/use-thread.ts` — `useThread(threadId)` hook:
   - Loads messages via `getMessages` server action (cursor-paginated, chronological).
   - Subscribes to Socket.IO `message:new`, `message:edit`, `message:delete` events for the thread room.
   - Manages unread state via `updateLastRead` on view.
   - Exposes: `{ messages, isLoading, hasMore, loadMore, unreadCount, sendMessage, editMessage, deleteMessage }`.
   - Uses TanStack Query for server state + Socket.IO for real-time updates.

3. **Create** `apps/web/src/components/thread/RecordThreadPanel.tsx`:
   - 25% width panel alongside Record View.
   - Opens from Record View header chat icon.
   - Contains: ThreadTabBar, ThreadLensBar, message list, ChatEditor input.
   - Props: `{ recordId, tenantId, onClose }`

4. **Create** `apps/web/src/components/thread/ThreadTabBar.tsx`:
   - Two tabs: "Team Notes" (internal thread, always present) + "Client Messages" (client thread, visible when Client Messaging enabled).
   - Active tab highlighted with teal underline.
   - Tab switch loads different thread (internal vs client) via `getThreadByScope`.

5. **Create** `apps/web/src/components/thread/ThreadLensBar.tsx`:
   - Below thread tabs: `[ All ] [ Notes ] [ Activity ] [ Files ]`
   - All: chronological default (no filter).
   - Notes: filters `WHERE source_note_id IS NOT NULL`.
   - Activity: filters `WHERE message_type = 'activity'`.
   - Files: filters `WHERE attachments IS NOT NULL`.
   - Uses `lensFilter` parameter in `getMessages`.

6. **Create** `apps/web/src/components/thread/ClientVisibleBanner.tsx`:
   - Persistent, non-dismissible banner above chat input in client thread tab.
   - Text: "Messages here are visible to the portal client." (i18n key)
   - Teal/warning styling to draw attention.

7. **Create** `apps/web/src/components/thread/SharedNoteMessage.tsx`:
   - Wrapper for messages where `source_note_id IS NOT NULL`.
   - Visual distinction: 📝 icon in header, 3px solid `--ws-accent` left border, inset container.
   - Tailwind: `border-l-4 border-ws-accent bg-muted/40 pl-3 rounded-r-md` on message body wrapper.

8. **Write tests:** useThread hook loads messages and subscribes to events. Tab switching loads correct thread. Lens filtering applies correct criteria. Client banner visibility only on client tab. Shared note visual distinction rendering.

### Acceptance Criteria

- [ ] Record Thread panel opens from Record View header chat icon at 25% width
- [ ] Two-thread tabs: "Team Notes" (internal, always present) + "Client Messages" (visible when Client Messaging enabled)
- [ ] Tab lenses below thread tabs: All | Notes | Activity | Files — filter `thread_messages` by criteria
- [ ] Notes lens: `WHERE source_note_id IS NOT NULL`; Activity lens: `WHERE message_type = 'activity'`; Files lens: `WHERE attachments IS NOT NULL`
- [ ] Client-visible banner: persistent, non-dismissible warning above chat input in client thread tab
- [ ] Shared note messages render with 📝 icon, `--ws-accent` left border, inset container
- [ ] `useThread` hook loads messages with pagination and subscribes to real-time events
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Message virtualization (Prompt 15)
- Reply panel (Prompt 15)
- In-thread search (Prompt 15)
- DM views (Prompt 16)
- Thread navigation dropdown (Prompt 16)

---

## Prompt 15: ThreadMessageList + ThreadReplyPanel + ThreadSearchBar

**Unit:** 5
**Depends on:** 14
**Load context:** `communications.md` lines 115–128 (Threaded Replies — reply chip, expand side panel, notification rules), `communications.md` lines 148–182 (Pinned — pin panel), `phase-division-phase3-part1.md` lines 184–213 (3C scope — in-thread search spec)
**Target files:** `apps/web/src/components/thread/ThreadMessageList.tsx`, `apps/web/src/components/thread/ThreadReplyPanel.tsx`, `apps/web/src/components/thread/ThreadSearchBar.tsx`, `apps/web/src/components/thread/PinnedMessagesPanel.tsx`, `apps/web/src/components/thread/use-thread-search.ts`, `apps/web/src/components/thread/use-typing-indicator.ts`
**Migration required:** No
**Git:** Commit with message "feat(thread): message list, replies, search, typing indicator [Phase 3C, Prompt 15]"

### Task

1. **Create** `apps/web/src/components/thread/ThreadMessageList.tsx`:
   - Virtualized message list using TanStack Virtual.
   - Renders `MessageItem` (from Unit 4) for each message.
   - Auto-scroll to bottom on new messages (unless user has scrolled up).
   - Load more on scroll-to-top (reverse pagination).
   - Messages with `source_note_id` wrapped in `SharedNoteMessage`.
   - Typing indicator display at bottom: "X is typing..." with animated dots.

2. **Create** `apps/web/src/components/thread/ThreadReplyPanel.tsx`:
   - 360px side panel for expanding threaded replies.
   - Opens when user clicks reply chip "N replies · last Xm ago".
   - Shows reply chain with `ChatEditor` at bottom for composing replies.
   - Reply messages loaded via `getMessages` with `parentMessageId` filter.

3. **Create** `apps/web/src/components/thread/ThreadSearchBar.tsx`:
   - Triggered by ⌘+F when thread panel is focused.
   - Short threads (all messages in memory): client-side string filter on rendered content.
   - Long threads (paginated/not all loaded): calls `searchThreadMessages` server ILIKE query.
   - Highlights matched text inline. Scroll to first match.
   - Escape closes search bar.
   - Uses `useThreadSearch` hook.

4. **Create** `apps/web/src/components/thread/use-thread-search.ts` — `useThreadSearch(threadId)`:
   - Determines search mode: client-side (all messages loaded) or server-side (ILIKE).
   - Returns `{ query, setQuery, results, highlightPositions, scrollToMatch }`.

5. **Create** `apps/web/src/components/thread/use-typing-indicator.ts` — `useTypingIndicator(threadId)`:
   - Broadcasts `typing:start` on keystroke (debounced 500ms).
   - Broadcasts `typing:stop` after 3 seconds of no keystrokes.
   - Listens for other users' typing events.
   - Returns `{ typingUsers: string[], startTyping: () => void }`.

6. **Create** `apps/web/src/components/thread/PinnedMessagesPanel.tsx`:
   - Accessible via 📌 icon in thread header.
   - Lists pinned messages via `getPinnedMessages`, most recent first.
   - Click pin → scroll to original message in thread.

7. **Write tests:** Message list auto-scroll behavior. Reply panel opens/closes. Search highlight. Typing indicator 3-second timeout. Pinned messages panel rendering. Virtualization with >100 messages.

### Acceptance Criteria

- [ ] Threaded replies: reply chip shows "N replies · last Xm ago"; click expands reply chain in 360px side panel
- [ ] In-thread search (⌘+F when thread panel focused): client-side filter for short threads, server ILIKE for long; highlights matches
- [ ] Typing indicator: "X is typing..." with 3-second debounce
- [ ] Pinned messages accessible via 📌 icon in thread header
- [ ] Message list auto-scrolls to bottom on new messages (respects scroll-up state)
- [ ] Virtualized message rendering via TanStack Virtual
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- DM conversation view (Prompt 16)
- Thread navigation dropdown (Prompt 16)
- Messaging error states (add in Prompt 16 integration)
- Record View layout modification (Prompt 16)

---

## Prompt 16: DMConversation + GroupDMHeader + Thread Nav + Record View Integration

**Unit:** 5
**Depends on:** 14, 15
**Load context:** `communications.md` lines 57–113 (Thread Scopes — DMs, group DMs), `communications.md` lines 130–146 (Chat Navigation — hierarchical sidebar, tree dropdown), `communications.md` lines 417–432 (Messaging Error Handling — all error states)
**Target files:** `apps/web/src/components/chat/DMConversation.tsx`, `apps/web/src/components/chat/GroupDMHeader.tsx`, `apps/web/src/components/thread/ThreadNavDropdown.tsx`, `apps/web/src/components/record-view/RecordView.tsx` (modify), `apps/web/src/components/record-view/RecordViewHeader.tsx` (modify)
**Migration required:** No
**Git:** Commit with message "feat(thread): DM views, thread nav, Record View integration [Phase 3C, Prompt 16]"

### Task

1. **Create** `apps/web/src/components/chat/DMConversation.tsx`:
   - DM/Group DM conversation view.
   - Uses `useThread` hook for message loading + real-time.
   - Renders `ThreadMessageList` + `ChatEditor`.
   - Persistent thread — messages appear instantly via Socket.IO.
   - Props: `{ threadId, tenantId }`

2. **Create** `apps/web/src/components/chat/GroupDMHeader.tsx`:
   - Group DM header with: group name (editable), participant list (avatars), settings icon.
   - 3–8 participant cap display.
   - "Add participant" button (up to cap).

3. **Create** `apps/web/src/components/thread/ThreadNavDropdown.tsx`:
   - Hierarchical tree dropdown for self-referential record navigation.
   - Layout: parent record (top) → current record (highlighted) + siblings → children.
   - Each entry shows: record title + unread indicator (teal dot + count).
   - Click navigates to that record's thread without leaving chat context.
   - Auto-detected for tables with self-referential linked record fields.

4. **Modify** `apps/web/src/components/record-view/RecordView.tsx`:
   - Add thread panel slot. When thread is open: layout adjusts to accommodate 25% thread panel.
   - Thread toggle state managed via `useState` or Zustand store.

5. **Modify** `apps/web/src/components/record-view/RecordViewHeader.tsx`:
   - Add chat icon button that toggles `RecordThreadPanel`.
   - Unread count badge on chat icon.

6. **Add messaging error states** per communications.md error handling spec:
   - Failed messages: red outline + retry icon. 3 retries (1s, 3s, 10s), then "Message could not be sent. Tap to retry."
   - Permission denied: toast + remove thread.
   - Attachment upload failure: inline error on thumbnail.
   - Rate limiting (30 msg/min/user/thread): toast + disable composer for 5s.

7. **Write tests:** DM conversation loads and receives real-time messages. Group DM header editable name. Thread nav dropdown renders tree structure. Record View layout with/without thread panel. Error state rendering. Chat icon unread badge.

### Acceptance Criteria

- [ ] [CONTRACT] `RecordThreadPanel` exported from `apps/web/src/components/thread/RecordThreadPanel.tsx`
- [ ] [CONTRACT] `ThreadTabBar` exported from `apps/web/src/components/thread/ThreadTabBar.tsx`
- [ ] [CONTRACT] `ThreadLensBar` exported from `apps/web/src/components/thread/ThreadLensBar.tsx`
- [ ] [CONTRACT] `ThreadMessageList` exported from `apps/web/src/components/thread/ThreadMessageList.tsx`
- [ ] [CONTRACT] `ThreadReplyPanel` exported from `apps/web/src/components/thread/ThreadReplyPanel.tsx`
- [ ] [CONTRACT] `ThreadSearchBar` exported from `apps/web/src/components/thread/ThreadSearchBar.tsx`
- [ ] [CONTRACT] `SharedNoteMessage` exported from `apps/web/src/components/thread/SharedNoteMessage.tsx`
- [ ] [CONTRACT] `ClientVisibleBanner` exported from `apps/web/src/components/thread/ClientVisibleBanner.tsx`
- [ ] [CONTRACT] `PinnedMessagesPanel` exported from `apps/web/src/components/thread/PinnedMessagesPanel.tsx`
- [ ] [CONTRACT] `ThreadNavDropdown` exported from `apps/web/src/components/thread/ThreadNavDropdown.tsx`
- [ ] [CONTRACT] `DMConversation` exported from `apps/web/src/components/chat/DMConversation.tsx`
- [ ] [CONTRACT] `GroupDMHeader` exported from `apps/web/src/components/chat/GroupDMHeader.tsx`
- [ ] [CONTRACT] `useThread`, `useThreadSearch`, `useTypingIndicator` hooks exported
- [ ] DM conversation view with persistent thread, real-time message delivery
- [ ] Group DM with name, participant list, 3-8 cap
- [ ] Chat navigation dropdown for self-referential records with unread indicators
- [ ] Real-time message delivery: new messages appear instantly via Socket.IO subscription
- [ ] Messaging error states: failed messages show red outline + retry; 3 retries then manual
- [ ] Message hover menu: edit, delete, pin, save, reply actions
- [ ] Record View layout accommodates 25% thread panel
- [ ] ≥80% line coverage on components
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Notification bell/tray (Unit 6)
- Chat Quick Panel (Unit 6)
- Presence indicators (Unit 6)
- Client thread designated-rep model (post-MVP)
- Activity logging in threads (post-MVP)

---

## VERIFY SESSION BOUNDARY (after Prompts 14–16) — Completes Unit 5

**Scope:** Verify all work from Prompts 14–16 integrates correctly.
**Unit status:** Unit 5 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met (≥80% on components)
6. Manual verification: Open Record View, click chat icon, thread panel opens at 25% width with correct tabs and lenses

**Interface contract check:**
- [ ] [CONTRACT] All thread components exported from `apps/web/src/components/thread/`
- [ ] [CONTRACT] `DMConversation`, `GroupDMHeader` exported from `apps/web/src/components/chat/`
- [ ] [CONTRACT] `useThread`, `useThreadSearch`, `useTypingIndicator` hooks exported
- [ ] [CONTRACT] Record View header has chat icon with unread badge
- [ ] [CONTRACT] Record View layout accommodates thread panel

**State file updates:**
- Update TASK-STATUS.md: Unit 5 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 14–16, unit 5 complete [Phase 3C, VP-5]", then push branch to origin.

Fix any failures before proceeding to Prompt 17.

---

## — Unit 6: Notification UI & Chat Quick Panel —

### Unit Context

This unit completes the communications surface layer with the notification bell and tray (in-app notification display with real-time updates), the Chat Quick Panel (unified conversation feed in the sidebar), and presence indicator components. It wires the notification pipeline (Unit 2) and real-time infrastructure (Unit 3) into the user-facing workspace shell.

**Interface Contract:**
Produces: `NotificationBell`, `NotificationTray`, `NotificationItem`, `NotificationGroup` from `apps/web/src/components/notifications/`; `ChatQuickPanel`, `ChatQuickPanelItem` from `apps/web/src/components/chat/`; `PresenceIndicator`, `CustomStatusDisplay`, `CustomStatusEditor` from `apps/web/src/components/presence/`; `useNotifications`, `usePresence` hooks
Consumes: Unit 2 notification data + server actions; Unit 3 real-time handlers + presence service; Unit 5 `DMConversation` (navigation target), Unit 1 `listThreadsForUser`

---

## Prompt 17: NotificationBell + NotificationTray + useNotifications Hook

**Unit:** 6
**Depends on:** Units 2, 3, 5 complete
**Load context:** `communications.md` lines 184–312 (Notification Aggregation & Delivery — bell icon, tray, smart grouping, priority override display)
**Target files:** `apps/web/src/components/notifications/NotificationBell.tsx`, `apps/web/src/components/notifications/NotificationTray.tsx`, `apps/web/src/components/notifications/NotificationItem.tsx`, `apps/web/src/components/notifications/NotificationGroup.tsx`, `apps/web/src/components/notifications/use-notifications.ts`
**Migration required:** No
**Git:** Commit with message "feat(notifications): bell, tray, notification grouping UI [Phase 3C, Prompt 17]"

### Task

1. **Read** existing sidebar components (`apps/web/src/components/sidebar/`) for shell integration patterns.

2. **Create** `apps/web/src/components/notifications/use-notifications.ts` — `useNotifications(tenantId, userId)`:
   - Loads notifications via `getNotifications` (cursor-paginated).
   - Loads unread count via `getUnreadNotificationCount` (Redis-cached).
   - Subscribes to Socket.IO `notification:new` events (from NotificationHandler, Unit 3).
   - On new notification: prepend to list, increment unread count.
   - Returns `{ notifications, unreadCount, isLoading, markRead, markAllRead, loadMore }`.

3. **Create** `apps/web/src/components/notifications/NotificationBell.tsx`:
   - Bell icon (🔔) with unread count badge.
   - Badge shows count (red circle, white text). Hidden when 0.
   - Real-time updated via `useNotifications` hook.
   - Click opens NotificationTray.

4. **Create** `apps/web/src/components/notifications/NotificationTray.tsx`:
   - Dropdown panel: 400px wide × 480px max height, right-aligned, scrollable.
   - "Mark all as read" button at top.
   - Renders NotificationItem or NotificationGroup for each entry.
   - Client-side grouping: notifications with same `group_key` within 5 minutes rendered as NotificationGroup.
   - Load more on scroll to bottom.

5. **Create** `apps/web/src/components/notifications/NotificationItem.tsx`:
   - Single notification row: type icon, title, body preview, timestamp, read/unread state.
   - Click marks as read + navigates to source (thread, record, etc.).
   - Unread: bold text + teal left border. Read: normal weight.

6. **Create** `apps/web/src/components/notifications/NotificationGroup.tsx`:
   - Collapsed group: "Sarah, James, and 2 others commented on {threadName}".
   - Click expands to show individual notifications.
   - Grouped by `group_key` + 5-minute proximity.

7. **Add NotificationBell** to workspace header/toolbar (in the appropriate layout component).

8. **Write tests:** useNotifications real-time update. Bell badge count. Tray opens/closes. Grouping logic (same group_key within 5min). Mark read on click. Mark all read.

### Acceptance Criteria

- [ ] Notification bell renders in workspace header with unread count badge (real-time updated)
- [ ] Click bell opens notification tray dropdown (400px × 480px max, right-aligned, scrollable)
- [ ] Notifications grouped by `group_key` within 5 minutes: "Sarah, James, and 2 others commented..."
- [ ] Mark as read on click; "Mark all as read" button at top of tray
- [ ] New notifications prepend to tray in real-time via Socket.IO without page refresh
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Chat Quick Panel (Prompt 18)
- Presence indicators (Prompt 19)
- Notification preferences UI (3G-i Settings page)
- Email digest scheduling (post-MVP)

---

## Prompt 18: ChatQuickPanel + ChatQuickPanelItem

**Unit:** 6
**Depends on:** 17
**Load context:** `communications.md` lines 29–55 (MVP Scope — Chat Quick Panel as unified feed)
**Target files:** `apps/web/src/components/chat/ChatQuickPanel.tsx`, `apps/web/src/components/chat/ChatQuickPanelItem.tsx`
**Migration required:** No
**Git:** Commit with message "feat(chat): Chat Quick Panel unified conversation feed [Phase 3C, Prompt 18]"

### Task

1. **Read** sidebar components for Quick Panel slot integration.

2. **Create** `apps/web/src/components/chat/ChatQuickPanel.tsx`:
   - Unified conversation feed in sidebar Quick Panel area.
   - Shows all conversations: Record Threads + DMs + Group DMs, sorted by recency (last message timestamp).
   - Uses `listThreadsForUser` (Unit 1) for conversation list.
   - Real-time updates: new messages bump conversation to top.
   - Click conversation navigates to:
     - Record Thread → opens RecordThreadPanel on that record
     - DM/Group DM → opens DMConversation view

3. **Create** `apps/web/src/components/chat/ChatQuickPanelItem.tsx`:
   - Conversation preview row:
     - Avatar (user for DM, group icon for group DM, record icon for record thread)
     - Name (user name, group name, record title)
     - Last message preview (truncated to ~60 chars)
     - Timestamp (relative: "2m", "1h", "Yesterday")
     - Unread count badge (teal circle)
   - Click navigates to conversation.

4. **Integrate** ChatQuickPanel into the sidebar Quick Panel area.

5. **Write tests:** Conversation list sorted by recency. Unread badge accuracy. Click navigation to correct view. Real-time conversation reordering on new message.

### Acceptance Criteria

- [ ] Chat Quick Panel shows all conversations (Record Threads + DMs + Group DMs) sorted by recency
- [ ] Each conversation preview shows avatar, name/record title, last message preview, timestamp, unread count badge
- [ ] Click conversation navigates to Record Thread panel (for record threads) or DM view (for DMs)
- [ ] Real-time: new messages bump conversation to top of list
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- Inline reply in Quick Panel (post-MVP convenience)
- Conversation search/filter within Quick Panel (post-MVP)
- Presence indicators (Prompt 19)

---

## Prompt 19: PresenceIndicator + CustomStatusEditor + usePresence Hook

**Unit:** 6
**Depends on:** 17
**Load context:** `communications.md` lines 148–182 (Pinned, Bookmarks & Presence — presence states, custom status, DND indicator, where presence shows)
**Target files:** `apps/web/src/components/presence/PresenceIndicator.tsx`, `apps/web/src/components/presence/CustomStatusDisplay.tsx`, `apps/web/src/components/presence/CustomStatusEditor.tsx`, `apps/web/src/components/presence/use-presence.ts`
**Migration required:** No
**Git:** Commit with message "feat(presence): indicator, custom status editor, usePresence hook [Phase 3C, Prompt 19]"

### Task

1. **Create** `apps/web/src/components/presence/use-presence.ts` — `usePresence(tenantId, roomId?)`:
   - Subscribes to Socket.IO `presence:update` events.
   - Sends heartbeat every 30 seconds via `presence:heartbeat` event.
   - Tracks idle state (5min no activity → 'away').
   - Returns `{ presenceMap: Record<string, PresenceState>, myStatus: PresenceState }`.

2. **Create** `apps/web/src/components/presence/PresenceIndicator.tsx`:
   - Colored dot component for avatars:
     - Online: green
     - Away: yellow
     - DND: red (with small minus icon)
     - Offline: gray
   - Size variants: small (8px, for lists), medium (10px, for avatars), large (12px, for profiles).
   - Props: `{ userId, size?, className? }` — reads from `usePresence` context.

3. **Create** `apps/web/src/components/presence/CustomStatusDisplay.tsx`:
   - Shows emoji + text next to user name.
   - Truncates long status text with ellipsis.
   - Props: `{ emoji, text, className? }`

4. **Create** `apps/web/src/components/presence/CustomStatusEditor.tsx`:
   - Status editor modal/popover:
     - Emoji picker (reuse EmojiPicker from Unit 4).
     - Text input for status message.
     - Auto-clear options: 1 hour, 4 hours, Today, This week, Custom date.
     - Save button calls `updateCustomStatus` server action.
     - Clear button removes status.

5. **Integrate presence indicators** into existing avatar components across the workspace: sidebar user list, @mention dropdown, DM list, thread participants.

6. **Write tests:** Presence dot colors per state. Heartbeat interval. Idle detection (5min). Custom status set/clear. Auto-clear expiry. Presence map update on Socket.IO event.

### Acceptance Criteria

- [ ] [CONTRACT] `NotificationBell` exported from `apps/web/src/components/notifications/NotificationBell.tsx`
- [ ] [CONTRACT] `NotificationTray` exported from `apps/web/src/components/notifications/NotificationTray.tsx`
- [ ] [CONTRACT] `NotificationItem`, `NotificationGroup` exported from `apps/web/src/components/notifications/`
- [ ] [CONTRACT] `useNotifications` exported from `apps/web/src/components/notifications/use-notifications.ts`
- [ ] [CONTRACT] `ChatQuickPanel`, `ChatQuickPanelItem` exported from `apps/web/src/components/chat/`
- [ ] [CONTRACT] `PresenceIndicator` exported from `apps/web/src/components/presence/PresenceIndicator.tsx`
- [ ] [CONTRACT] `CustomStatusDisplay`, `CustomStatusEditor` exported from `apps/web/src/components/presence/`
- [ ] [CONTRACT] `usePresence` exported from `apps/web/src/components/presence/use-presence.ts`
- [ ] PresenceIndicator renders as colored dot (green/yellow/red/gray) on avatar
- [ ] Presence updates in real-time as users go online/away/DND/offline
- [ ] Custom status editor: emoji picker + text input + auto-clear options (1h, 4h, today, this week, custom)
- [ ] Custom status displays next to user name in sidebar, @mention dropdown, DM list
- [ ] ≥80% line coverage on components
- [ ] ESLint and TypeScript compile with zero errors

### Do NOT Build

- DND mode full notification suppression UI (post-MVP polish)
- "Notify anyway" option on DMs to DND users (post-MVP)
- Cursor broadcasting / field presence (post-MVP)

---

## VERIFY SESSION BOUNDARY (after Prompts 17–19) — Completes Unit 6

**Scope:** Verify all work from Prompts 17–19 integrates correctly.
**Unit status:** Unit 6 complete — verify contract. Phase 3C complete.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met (≥80% on components, ≥90% on data layer)
6. Manual verification:
   - Notification bell in workspace header with real-time badge
   - Click bell → tray opens with grouped notifications
   - Chat Quick Panel in sidebar with conversation list
   - Presence dots on user avatars
   - Custom status set/clear flow

**Interface contract check:**
- [ ] [CONTRACT] `NotificationBell`, `NotificationTray`, `NotificationItem`, `NotificationGroup` from `apps/web/src/components/notifications/`
- [ ] [CONTRACT] `useNotifications` from `apps/web/src/components/notifications/use-notifications.ts`
- [ ] [CONTRACT] `ChatQuickPanel`, `ChatQuickPanelItem` from `apps/web/src/components/chat/`
- [ ] [CONTRACT] `PresenceIndicator`, `CustomStatusDisplay`, `CustomStatusEditor` from `apps/web/src/components/presence/`
- [ ] [CONTRACT] `usePresence` from `apps/web/src/components/presence/use-presence.ts`

**State file updates:**
- Update TASK-STATUS.md: Unit 6 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 17–19, unit 6 complete [Phase 3C, VP-6]", then push branch to origin.

**Phase 3C is complete.** All 6 units delivered. Proceed to Step 5 (Docs Sync).
