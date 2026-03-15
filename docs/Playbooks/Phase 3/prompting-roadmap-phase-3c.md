# Phase 3C — Record Thread, DMs, Notifications & System Email — Prompting Roadmap

## Overview

- **Sub-phase:** 3C — Record Thread, DMs, Notifications & System Email
- **Playbook:** `docs/Playbooks/playbook-phase-3c.md`
- **Subdivision doc:** `docs/subdivisions/3c-subdivision.md`
- **Units:** 6 — (1) Schema Migration & Thread/Message Data Layer, (2) Notification Pipeline & System Email, (3) Presence & Real-Time Chat Infrastructure, (4) Chat Editor (TipTap Env 1), (5) Record Thread & DM UI, (6) Notification UI & Chat Quick Panel
- **Estimated duration:** 10–14 sessions across all 6 lifecycle steps
- **Prior sub-phase:** Phase 3B-ii (Schema Descriptor Service & Command Bar) — merged to main

**Parallel opportunities:** Units 2, 3, and 4 can all run concurrently after Unit 1 completes. Unit 4 has zero unit dependencies and can even start before Unit 1. Unit 5 depends on Units 1, 3, and 4. Unit 6 depends on Units 2, 3, and 5.

**Critical path:** Unit 1 → Unit 3 → Unit 5 → Unit 6 (depth: 4).

---

## STEP 0 — DOC PREP (Architect Agent)

### What This Step Does

**This step is already complete.** The Architect Agent ran doc prep for Phase 3C, verifying `communications.md`, `email.md`, `realtime.md`, `data-model.md`, and the glossary. The `docs/` branch was merged to main. The playbook at `docs/Playbooks/playbook-phase-3c.md` was produced against the updated docs.

No action needed. Proceed to Step 3.

---

## STEP 1 — PLAYBOOK GENERATION

### What This Step Does

**This step is already complete.** You already have the playbook for this sub-phase — it was produced before this roadmap.

The playbook is at: `docs/Playbooks/playbook-phase-3c.md`

No action needed. Proceed to Step 3.

---

## STEP 2 — PROMPTING ROADMAP GENERATION

**This step is already complete.** You're reading the output of Step 2. Proceed to Step 3.

---

## STEP 3 — BUILD + VERIFY EXECUTION

Step 3 alternates between BUILD sessions and VERIFY sessions in separate Claude Code contexts. BUILD contexts are focused on writing code with full playbook/reference context. VERIFY contexts are focused on running tests and fixing failures with full testing knowledge. This keeps each context lean and within budget.

This sub-phase is organized into **6 units**. Each unit represents a coherent slice of the build with defined inputs and outputs. You'll see unit headers marking where each unit starts and what it produces.

**Important note on parallel units:** Unit 4 (Chat Editor) can be built at any time — it has zero unit dependencies. Units 2 and 3 can both start after Unit 1 completes. Unit 5 requires Units 1, 3, and 4. Unit 6 requires Units 2, 3, and 5. If anything blocks Unit 1, you can skip ahead to Unit 4.

### Setup

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Find the "3C — Record Thread, DMs, Notifications & System Email" section.
All units should show `pending`. No changes needed yet.
```

---

### ═══ UNIT 1: Schema Migration & Thread/Message Data Layer ═══

**What This Unit Builds:**
This is the data foundation for all communications in EveryStack. It creates the database migration that adds a new column for linking personal notes to thread messages, builds all the functions for creating/reading/updating/deleting threads and messages, sets up DM and group DM creation, and creates the test factories that every later unit depends on. Think of it as laying the plumbing — no UI yet, but every pipe and valve that the messaging system needs.

**What Comes Out of It:**
When done, the system can create threads on any record (with separate internal and client threads), send/edit/delete/pin messages, manage thread participants, track unread counts, create DM conversations between two users, create group DMs with 3–8 participants, save/bookmark messages, and search within threads. All with full multi-tenant isolation.

**What It Needs from Prior Work:**
Nothing — this is the first unit. It uses existing database tables (`threads`, `thread_messages`, `thread_participants`, `user_saved_messages`) that were created in Phase 1J.

---

### BUILD SESSION A — Unit 1, Prompts 1–4

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 1 to `in-progress`.
Add branch name: `build/3c-comms`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 1: source_note_id Migration & Thread Schema Verification

**What This Builds:**
This adds a new column to the `thread_messages` table called `source_note_id` — it lets the system know when a message in a thread originally came from a Personal Note (a feature built later in 3G-ii). It also verifies that all existing thread-related database tables match the spec. Think of it as adding one new field to a form and double-checking the rest of the form is correct.

**What You'll See When It's Done:**
Claude Code will create one new migration file and update the Drizzle schema definition. The migration should apply cleanly when you run it.

**How Long This Typically Takes:** 5–8 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C (Record Thread, DMs, Notifications & System Email), Unit 1, Prompt 1.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 1 (search for "## Prompt 1:")

Read these context files:
- docs/reference/communications.md lines 112–128 (Data Model — threads, thread_messages, thread_participants schema)
- docs/reference/data-model.md lines 113–121 (Communications tables)
- docs/phases/phase-division-phase3-part1.md lines 184–213 (3C scope — source_note_id spec)
- packages/shared/db/schema/thread-messages.ts (current schema)
- packages/shared/db/schema/index.ts (barrel exports)
- packages/shared/db/migrations/ (existing migration files — check the latest filename for naming convention)

Tasks:
1. Read the existing schema at `packages/shared/db/schema/thread-messages.ts` to understand current column definitions.
2. Create migration `packages/shared/db/migrations/XXXX_add_source_note_id_to_thread_messages.ts`:
   - `ALTER TABLE thread_messages ADD COLUMN source_note_id UUID REFERENCES user_notes(id) ON DELETE SET NULL`
   - Add partial index: `CREATE INDEX idx_thread_messages_source_note_id ON thread_messages (source_note_id) WHERE source_note_id IS NOT NULL`
   - Migration must not acquire ACCESS EXCLUSIVE lock >1s
3. Update `packages/shared/db/schema/thread-messages.ts` to add `source_note_id` column to the Drizzle schema definition. Use `uuid('source_note_id').references(() => userNotes.id, { onDelete: 'set null' })`.
4. Update `packages/shared/db/schema/index.ts` if the new column requires re-exporting.
5. Verify all existing schema columns on `threads`, `thread_messages`, `thread_participants`, `user_saved_messages` match the data-model.md spec. Flag any discrepancies but do NOT modify existing migration files.
6. Update the Drizzle migration journal (`meta/_journal.json`) to include the new migration entry.

Acceptance criteria:
- [ ] Migration file adds `source_note_id UUID NULLABLE REFERENCES user_notes(id) ON DELETE SET NULL`
- [ ] Partial index `idx_thread_messages_source_note_id` created on `(source_note_id) WHERE source_note_id IS NOT NULL`
- [ ] Drizzle schema in `thread-messages.ts` includes `source_note_id` column
- [ ] Migration journal updated with new entry
- [ ] `pnpm turbo db:migrate` succeeds
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Thread CRUD functions (Prompt 2), Message CRUD functions (Prompt 3), any UI components, Personal Notes Share to Thread button (3G-ii).

Commit with: `feat(db): add source_note_id column to thread_messages [Phase 3C, Prompt 1]`
```

[CHECKPOINT]
```
Look for:
- New migration file in packages/shared/db/migrations/
- source_note_id column added to thread-messages.ts Drizzle schema
- Migration journal updated
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 2: Thread CRUD Data Functions

**What This Builds:**
This creates all the functions for working with threads — creating a new thread on a record, looking up threads, listing all threads a user participates in, and the special DM logic. The DM system uses a clever trick: it generates a predictable ID from two sorted user IDs so that asking "do Alice and Bob have a DM?" always finds the same thread regardless of who asks. Group DMs enforce a 3–8 person cap.

**What You'll See When It's Done:**
Claude Code will create `apps/web/src/data/threads.ts` with 6 exported functions. TypeScript and ESLint should pass.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 1, Prompt 2.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 2 (search for "## Prompt 2:")

Read these context files:
- docs/reference/communications.md lines 57–113 (Thread Scopes — record, DM, group_dm, two-thread model, DM deterministic scope_id, group DM fixed cap)
- docs/reference/communications.md lines 130–146 (Chat Navigation)
- docs/reference/data-model.md lines 113–121 (Communications tables)
- apps/web/src/data/records.ts (data access pattern reference — getDbForTenant, query structure, return types)
- packages/shared/db/schema/threads.ts (thread Drizzle schema)
- packages/shared/db/schema/thread-participants.ts (participant Drizzle schema)

Create `apps/web/src/data/threads.ts` with these functions:

1. `createThread(tenantId, params: CreateThreadParams): Promise<Thread>` — validates scope_type, inserts thread row, adds creator as participant.
2. `getThread(tenantId, threadId): Promise<Thread | null>` — fetch by ID, tenant-scoped.
3. `getThreadByScope(tenantId, scopeType, scopeId, threadType?): Promise<Thread | null>` — lookup by scope identifiers, uses UNIQUE constraint.
4. `listThreadsForUser(tenantId, userId, opts: PaginationOpts): Promise<PaginatedResult<ThreadWithLastMessage>>` — all threads the user participates in, joined with last message preview, sorted by last activity. Cursor-based pagination.
5. `getOrCreateDMThread(tenantId, userId1, userId2): Promise<Thread>` — deterministic `scope_id` from sorted user IDs (e.g., `dm:${sorted[0]}:${sorted[1]}`). If thread exists, return it. If not, create with both users as participants.
6. `createGroupDM(tenantId, creatorId, participantIds, name?): Promise<Thread>` — Zod-validate 3–8 participant cap. Generate UUID scope_id. Create thread + add all participants.

Define types in the same file or a co-located types file:
- `Thread` — DB row type
- `CreateThreadParams` — `{ scopeType, scopeId, threadType?, name?, createdBy }`
- `ThreadWithLastMessage` — Thread + `lastMessage: { content: string; authorId: string; createdAt: Date } | null` + `unreadCount: number`
- `PaginationOpts` — `{ cursor?: string; limit?: number }` (default limit 50)
- `PaginatedResult<T>` — `{ items: T[]; nextCursor: string | null }`

Use Zod for input validation on `createGroupDM` (participant count 3–8).
All queries use `getDbForTenant()` and are tenant-scoped.

Acceptance criteria:
- [ ] `createThread()` inserts thread row and adds creator as first participant
- [ ] `getThreadByScope()` correctly uses scope_type + scope_id + thread_type to lookup
- [ ] `getOrCreateDMThread()` produces deterministic `scope_id` from sorted user IDs — calling with (A, B) and (B, A) returns the same thread
- [ ] `createGroupDM()` enforces 3–8 participant cap via Zod validation, throws on violation
- [ ] `listThreadsForUser()` returns threads with last message preview and unread count, cursor-paginated
- [ ] All functions use `getDbForTenant()` and are tenant-scoped
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Message CRUD (Prompt 3), participant management beyond initial creation (Prompt 4), real-time events (Unit 3), thread UI (Unit 5).

Commit with: `feat(data): thread CRUD data functions with DM helpers [Phase 3C, Prompt 2]`
```

[CHECKPOINT]
```
Look for:
- apps/web/src/data/threads.ts exists with 6 exported functions
- Types defined: Thread, CreateThreadParams, ThreadWithLastMessage, PaginationOpts, PaginatedResult
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 3: Message CRUD Data Functions

**What This Builds:**
This creates all the functions for working with messages inside threads — sending messages, editing them, soft-deleting them (they're never truly erased — just hidden), pinning important messages, and searching within a thread. Messages support threaded replies via a `parent_message_id` field, and different "lenses" let you filter to see only notes, activity logs, or files.

**What You'll See When It's Done:**
Claude Code will create `apps/web/src/data/thread-messages.ts` with 8 exported functions. Soft delete uses `deleted_at` timestamp. Search uses ILIKE for case-insensitive matching.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 1, Prompt 3.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 3 (search for "## Prompt 3:")

Read these context files:
- docs/reference/communications.md lines 112–128 (Data Model — thread_messages, message_type, system messages)
- docs/reference/communications.md lines 115–128 (Threaded Replies)
- docs/reference/communications.md lines 148–182 (Pinned, Bookmarks & Presence — pin mechanics)
- docs/reference/communications.md lines 417–432 (Messaging Error Handling)
- packages/shared/db/schema/thread-messages.ts (Drizzle schema with source_note_id from Prompt 1)
- apps/web/src/data/threads.ts (thread data functions from Prompt 2 — pattern reference)

Create `apps/web/src/data/thread-messages.ts` with these functions:

1. `createMessage(tenantId, params: CreateMessageParams): Promise<ThreadMessage>` — inserts message row. Default authorType: 'user', messageType: 'message'.
2. `getMessages(tenantId, threadId, opts: MessageListOpts): Promise<PaginatedResult<ThreadMessage>>` — cursor-based pagination, sorted by created_at ASC. Supports filtering: messageType, parentMessageId (reply chains), source_note_id IS NOT NULL (Notes lens), attachments IS NOT NULL (Files lens). Excludes soft-deleted (WHERE deleted_at IS NULL).
3. `editMessage(tenantId, messageId, content): Promise<ThreadMessage>` — updates content + sets edited_at.
4. `deleteMessage(tenantId, messageId, userId): Promise<void>` — soft delete: sets deleted_at = now(). Writes audit log via writeAuditLog() with action 'message.deleted'.
5. `pinMessage(tenantId, messageId, userId): Promise<void>` — sets pinned_at = now(), pinned_by = userId.
6. `unpinMessage(tenantId, messageId): Promise<void>` — sets pinned_at = null, pinned_by = null.
7. `getPinnedMessages(tenantId, threadId): Promise<ThreadMessage[]>` — WHERE pinned_at IS NOT NULL, sorted by pinned_at DESC.
8. `searchThreadMessages(tenantId, threadId, query): Promise<ThreadMessage[]>` — ILIKE search on content::text. Limit 50 results, sorted by created_at DESC.

Define types:
- `ThreadMessage` — DB row type
- `CreateMessageParams` — `{ threadId, authorId, authorType?, messageType?, content, parentMessageId?, mentions?, attachments? }`
- `MessageListOpts` — `{ cursor?, limit?, messageType?, parentMessageId?, lensFilter?: 'notes' | 'activity' | 'files' }`

All queries use `getDbForTenant()`. Soft-deleted messages excluded from all reads.

Acceptance criteria:
- [ ] `createMessage()` inserts message with UUIDv7 id and returns the new row
- [ ] `getMessages()` supports cursor pagination with chronological sort and lens filters
- [ ] `editMessage()` updates content and sets `edited_at` timestamp
- [ ] `deleteMessage()` soft-deletes and writes audit log
- [ ] `pinMessage()` / `unpinMessage()` update pinned_at and pinned_by
- [ ] `searchThreadMessages()` performs ILIKE on content::text with 50-result limit
- [ ] All functions use `getDbForTenant()` and are tenant-scoped
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Real-time message broadcast (Unit 3), notification triggers (Unit 2), message UI (Unit 4), emoji reaction mutations (Prompt 4).

Commit with: `feat(data): message CRUD with pin, search, soft-delete [Phase 3C, Prompt 3]`
```

[CHECKPOINT]
```
Look for:
- apps/web/src/data/thread-messages.ts with 8 exported functions
- Types: ThreadMessage, CreateMessageParams, MessageListOpts
- writeAuditLog call in deleteMessage
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

#### PROMPT 4: Participants, Saved Messages, Factories & Server Actions

**What This Builds:**
This is the final piece of the data foundation. It creates participant management (adding/removing people from threads, tracking what they've read), saved/bookmarked messages (like starring an email), test factories that make writing tests easy for every future unit, and the server actions that the UI will eventually call. Server actions are the secure bridge between the browser and the server — they validate that the user is who they say they are before doing anything.

**What You'll See When It's Done:**
Claude Code will create 4 new files: `thread-participants.ts`, `saved-messages.ts`, `factories/threads.ts`, and `actions/threads.ts`. Plus test files with tenant isolation tests and other key scenarios.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 1, Prompt 4.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 4 (search for "## Prompt 4:")

Read these context files:
- docs/reference/communications.md lines 115–128 (Threaded Replies — participant auto-add, notification rules)
- docs/reference/communications.md lines 148–182 (Pinned, Bookmarks & Presence — saved messages spec)
- docs/reference/data-model.md lines 122–130 (Personal / Notifications — user_saved_messages)
- packages/shared/db/schema/thread-participants.ts (participant Drizzle schema)
- packages/shared/db/schema/user-saved-messages.ts (saved messages Drizzle schema)
- apps/web/src/data/threads.ts (thread data functions from Prompt 2)
- apps/web/src/data/thread-messages.ts (message data functions from Prompt 3)
- packages/shared/testing/factories/ (existing factory pattern reference)
- apps/web/src/actions/ (existing server action pattern reference)

Tasks:

1. Create `apps/web/src/data/thread-participants.ts`:
   - `addParticipant(tenantId, threadId, userId)` — idempotent upsert on conflict
   - `removeParticipant(tenantId, threadId, userId)`
   - `listParticipants(tenantId, threadId)`
   - `updateLastRead(tenantId, threadId, userId)` — set last_read_at = now()
   - `getUnreadCounts(tenantId, userId)` — count messages after last_read_at per thread

2. Create `apps/web/src/data/saved-messages.ts`:
   - `saveMessage(tenantId, userId, messageId, note?)`
   - `unsaveMessage(tenantId, userId, messageId)`
   - `listSavedMessages(tenantId, userId, opts: PaginationOpts)` — cursor-paginated, saved_at DESC

3. Create `packages/shared/testing/factories/threads.ts`:
   - `createTestThread(overrides?)` — defaults: scope_type 'record', thread_type 'internal'
   - `createTestMessage(overrides?)` — defaults for thread_message
   - `createTestParticipant(overrides?)` — defaults for thread_participant
   - All use `generateUUIDv7()`, accept tenant_id as required param

4. Create `apps/web/src/actions/threads.ts` with server actions:
   - `sendMessage(formData)` — Clerk session validation, workspace membership check, calls createMessage
   - `editMessageAction(messageId, content)` — validates author is current user
   - `deleteMessageAction(messageId)` — validates author is current user OR Manager+
   - `pinMessageAction(messageId)` — thread participant validation
   - `unpinMessageAction(messageId)` — same permission check as pin
   - `saveMessageAction(messageId, note?)` — saves for current user
   - `unsaveMessageAction(messageId)` — unsaves for current user
   - `createDMAction(targetUserId)` — calls getOrCreateDMThread
   - `createGroupDMAction(participantIds, name?)` — calls createGroupDM

5. Write tests:
   - Tenant isolation tests for all data functions using testTenantIsolation()
   - getOrCreateDMThread deterministic test: (A,B) and (B,A) return same thread
   - createGroupDM validation: reject <3 or >8 participants
   - deleteMessage audit log verification
   - getUnreadCounts accuracy test
   - searchThreadMessages ILIKE test

Acceptance criteria:
- [ ] [CONTRACT] addParticipant, removeParticipant, listParticipants, updateLastRead, getUnreadCounts exported from thread-participants.ts
- [ ] [CONTRACT] saveMessage, unsaveMessage, listSavedMessages exported from saved-messages.ts
- [ ] [CONTRACT] createTestThread(), createTestMessage(), createTestParticipant() exported from factories/threads.ts
- [ ] [CONTRACT] Server actions exported from actions/threads.ts
- [ ] addParticipant is idempotent (no error on duplicate)
- [ ] getUnreadCounts returns accurate per-thread unread counts
- [ ] Server actions validate Clerk session and workspace membership
- [ ] testTenantIsolation() passes for all data functions
- [ ] ≥90% line coverage on data functions, ≥85% branch coverage
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Notification triggers in server actions (Unit 2), real-time event publishing (Unit 3), emoji reaction CRUD, UI components.

Commit with: `feat(data): participants, saved messages, factories, server actions [Phase 3C, Prompt 4]`
```

[CHECKPOINT]
```
Look for:
- 4 new files: thread-participants.ts, saved-messages.ts, factories/threads.ts, actions/threads.ts
- Test files with tenant isolation tests
- testTenantIsolation() calls for all data functions
- TypeScript compiles with zero errors
- ESLint passes with zero errors
```

---

### VERIFY SESSION A — Unit 1, Prompts 1–4 — Completes Unit 1

**What This Step Does:**
"This runs the full test suite against everything Unit 1 built. It also checks that Unit 1 produced everything it promised (its interface contract)."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Phase 3C Prompts 1–4 (Unit 1: Schema Migration & Thread/Message Data Layer):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met (≥90% lines, ≥85% branches on data functions)
5. pnpm turbo db:migrate — migration applies cleanly
6. pnpm turbo db:migrate:check — no lock violations

Interface contract verification (Unit 1):
- [ ] [CONTRACT] `createThread`, `getThread`, `getThreadByScope`, `listThreadsForUser`, `getOrCreateDMThread`, `createGroupDM` from `apps/web/src/data/threads.ts`
- [ ] [CONTRACT] `createMessage`, `getMessages`, `editMessage`, `deleteMessage`, `pinMessage`, `unpinMessage`, `getPinnedMessages`, `searchThreadMessages` from `apps/web/src/data/thread-messages.ts`
- [ ] [CONTRACT] `addParticipant`, `removeParticipant`, `listParticipants`, `updateLastRead`, `getUnreadCounts` from `apps/web/src/data/thread-participants.ts`
- [ ] [CONTRACT] `saveMessage`, `unsaveMessage`, `listSavedMessages` from `apps/web/src/data/saved-messages.ts`
- [ ] [CONTRACT] Server actions from `apps/web/src/actions/threads.ts`
- [ ] [CONTRACT] Factories from `packages/shared/testing/factories/threads.ts`
- [ ] [CONTRACT] Migration adds `source_note_id` to `thread_messages`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
If failing: Claude Code will attempt to fix using verify skill knowledge.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 1–4, unit 1 complete [Phase 3C, VP-1]"
git push origin build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 1 to `passed-review`.
Open MODIFICATIONS.md. Add a session block:

## Session A — Phase 3C — build/3c-comms

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 1–4 (Unit 1: Schema Migration & Thread/Message Data Layer)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- thread_messages: added source_note_id column (UUID, nullable, FK → user_notes)

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### ═══ UNIT 2: Notification Pipeline & System Email ═══

**What This Unit Builds:**
This is the notification engine — the system that routes events (someone mentioned you, you got a DM, a sync failed) into the notification bell and optionally sends you an email. It includes the core NotificationService that decides what to deliver and how, a background job queue for sending emails without slowing down the app, email templates for invitations and system alerts, and preference management so users can control what they get notified about.

**What Comes Out of It:**
When done, the system can create notifications for 8 different event types, route them to in-app display and/or email based on user preferences, send formatted emails via Resend, and respect DM/mention priority overrides (these always get through even if you've muted a thread). The notification UI that actually displays these lives in Unit 6.

**What It Needs from Prior Work:**
This unit uses the `Thread` and `ThreadMessage` types from Unit 1, which you just built.

---

### BUILD SESSION B — Unit 2, Prompts 5–7

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 2 to `in-progress`.
Add branch name: `build/3c-comms`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 5: NotificationService Core + Notification Data Functions

**What This Builds:**
This creates the central NotificationService — the brain that decides how to deliver each notification. When something happens (a mention, a DM, a sync error), this service inserts the notification into the database, checks the user's preferences, and routes it to in-app display via Redis and/or to email via a background job queue. It also handles special rules: mentions and DMs always get through even if you've muted a thread, and notification failure never blocks the action that triggered it (best-effort delivery).

**What You'll See When It's Done:**
Claude Code will create 2 new files: `notification-service.ts` and `data/notifications.ts`. The service handles 8 notification types with Redis-cached unread counts.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 2, Prompt 5.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 5 (search for "## Prompt 5:")

Read these context files:
- docs/reference/communications.md lines 184–312 (Notification Aggregation & Delivery — data model, 8 types, delivery pipeline, error handling)
- docs/reference/data-model.md lines 122–130 (Personal / Notifications tables)
- packages/shared/db/schema/notifications.ts (notification Drizzle schema)
- packages/shared/db/schema/user-notification-preferences.ts (preferences schema)
- apps/web/src/data/threads.ts (data access pattern reference from Unit 1)

Tasks:

1. Create `apps/web/src/data/notifications.ts`:
   - `createNotification(tenantId, params: CreateNotificationParams): Promise<Notification>`
   - `getNotifications(tenantId, userId, opts: NotificationListOpts): Promise<PaginatedResult<Notification>>` — cursor-based, created_at DESC, supports `read` boolean filter
   - `getUnreadNotificationCount(tenantId, userId): Promise<number>` — Redis-cached at `cache:notif:unread:t:{tenantId}:u:{userId}` with 5s TTL. Fallback to DB count.
   - `markNotificationRead(tenantId, userId, notificationId): Promise<void>` — sets read = true, read_at = now(). Invalidates cache.
   - `markAllNotificationsRead(tenantId, userId): Promise<void>` — bulk update. Invalidates cache.

2. Create `apps/web/src/lib/notifications/notification-service.ts`:
   - `NotificationService` class with `create(params)` method:
     a. Insert notification via createNotification()
     b. Check user preferences for this type
     c. If inApp enabled: publish to Redis channel `user:{userId}:notifications`
     d. If email = 'instant': enqueue BullMQ job `notification.email.send`
     e. mention/dm types: always deliver immediately regardless of mute (priority override)
     f. thread_reply with muted thread: suppress (but NOT for mention)
   - Failure handling: notification insert failure logs error but does NOT throw — best-effort

3. Define types:
   - `Notification` — DB row type
   - `CreateNotificationParams` — { userId, tenantId, type, title, body?, sourceType, sourceThreadId?, sourceMessageId?, sourceRecordId?, actorId?, groupKey? }
   - `NotificationType` — 'mention' | 'dm' | 'thread_reply' | 'approval_requested' | 'approval_decided' | 'automation_failed' | 'sync_error' | 'system' (string type with comment, per VARCHAR convention)
   - `NotificationListOpts` — { cursor?, limit?, read? }

4. Write tests: Tenant isolation for all data functions. NotificationService routing tests for each type. Priority override test (mention/dm bypass mute). Muted thread_reply suppression. Redis cache hit/miss for unread count.

Acceptance criteria:
- [ ] NotificationService.create() inserts notification, checks preferences, routes to in-app and/or email
- [ ] 8 notification types supported
- [ ] mention and dm always deliver immediately regardless of mute (priority override)
- [ ] Muted thread_reply suppressed but NOT mention
- [ ] Redis-cached unread count with 5s TTL
- [ ] Notification insert failure does NOT block originating action
- [ ] testTenantIsolation() passes for all notification data functions
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: BullMQ queue (Prompt 6), React Email templates (Prompt 7), notification preferences CRUD (Prompt 7), notification UI (Unit 6).

Commit with: `feat(notifications): NotificationService core + data functions [Phase 3C, Prompt 5]`
```

[CHECKPOINT]
```
Look for:
- apps/web/src/data/notifications.ts with 5 functions
- apps/web/src/lib/notifications/notification-service.ts with NotificationService class
- Redis cache key pattern: cache:notif:unread:t:{tenantId}:u:{userId}
- TypeScript compiles with zero errors
```

---

#### PROMPT 6: BullMQ Notification Queue + Email Send Processor + Resend Service

**What This Builds:**
This creates the background job infrastructure for sending notification emails. Instead of sending emails synchronously (which would slow down the app), the NotificationService from Prompt 5 drops a job into a queue, and a separate worker process picks it up and sends the email via Resend (our email provider). It also includes a cleanup job that deletes notifications older than 90 days to keep the database lean. Failed emails retry 3 times with increasing delays.

**What You'll See When It's Done:**
Claude Code will create 3 new files (email processor, cleanup processor, Resend service) and update the existing queue registration file. The worker should recognize the new `notification` queue.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 2, Prompt 6.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 6 (search for "## Prompt 6:")

Read these context files:
- docs/reference/communications.md lines 268–312 (Delivery Pipeline + Error Handling)
- docs/reference/email.md lines 10–16 (Email Provider Stack)
- docs/reference/email.md lines 18–34 (Sender Identity — Tier 1)
- docs/reference/email.md lines 37–51 (MVP System Emails)
- apps/worker/src/queues.ts (existing queue registration pattern)
- apps/worker/src/lib/job-wrapper.ts (processor pattern)
- apps/worker/src/processors/file-scan.ts (processor implementation reference)

Tasks:

1. Register BullMQ queue `notification` in `apps/worker/src/queues.ts` with job types:
   - `notification.email.send` — send email via Resend
   - `notification.cleanup` — delete notifications older than 90 days

2. Create `apps/web/src/lib/email/resend-service.ts`:
   - `ResendEmailService` class wrapping Resend API
   - `send(params: SendEmailParams): Promise<void>` — sends via Resend SDK
   - `SendEmailParams`: { to, subject, html, from? } — defaults from to `notifications@everystack.com`
   - Use RESEND_API_KEY env var. Try/catch with logging on failure.

3. Create `apps/worker/src/processors/notification/email-send.ts`:
   - `processNotificationEmail(job)` — renders email HTML from template, sends via ResendEmailService
   - Retry: 3 attempts with exponential backoff (1min, 5min, 15min)
   - On final failure: log error, mark failed, no further retry

4. Create `apps/worker/src/processors/notification/cleanup.ts`:
   - `processNotificationCleanup(job)` — deletes notifications older than 90 days
   - Schedule: daily cron

5. Write tests: Queue registration. Email send success/failure. Retry backoff config. Cleanup deletes correct rows.

Acceptance criteria:
- [ ] BullMQ queue `notification` registered with email.send and cleanup job types
- [ ] ResendEmailService.send() sends via Resend API from notifications@everystack.com
- [ ] Email send processor retries 3× with exponential backoff (1min, 5min, 15min)
- [ ] Cleanup job deletes rows older than 90 days
- [ ] Email send failure does not crash worker
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: React Email templates (Prompt 7), email tracking (post-MVP), email compose UI (post-MVP).

Commit with: `feat(worker): notification BullMQ queue + Resend email service [Phase 3C, Prompt 6]`
```

[CHECKPOINT]
```
Look for:
- apps/worker/src/queues.ts updated with notification queue
- apps/web/src/lib/email/resend-service.ts with ResendEmailService
- apps/worker/src/processors/notification/email-send.ts
- apps/worker/src/processors/notification/cleanup.ts
- TypeScript compiles with zero errors
```

---

#### PROMPT 7: React Email Templates + Notification Preferences + Server Actions

**What This Builds:**
This creates the actual email templates — what the notification emails look like when they land in someone's inbox. There are three templates: workspace invitation emails, system alert emails (sync failures, automation errors), and client thread reply emails (notifying portal clients when someone responds). It also builds the notification preferences system so users can control what they get notified about, and the server actions that the UI will call.

**What You'll See When It's Done:**
Claude Code will create 3 email template components, a notification preferences data file, and a server actions file. Templates use React Email for server-side rendering.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 2, Prompt 7.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 7 (search for "## Prompt 7:")

Read these context files:
- docs/reference/email.md lines 37–51 (MVP System Emails — invitation and system alert types)
- docs/reference/communications.md lines 234–253 (Notification Preferences JSONB structure)
- docs/phases/phase-division-phase3-part1.md lines 184–213 (3C scope — client thread notification email spec)
- apps/web/src/lib/email/resend-service.ts (Resend service from Prompt 6)
- apps/worker/src/processors/notification/email-send.ts (email processor from Prompt 6)

Tasks:

1. Create React Email templates in `apps/web/src/lib/email/templates/`:
   - `InvitationEmail` — "You've been invited to join {workspaceName} on EveryStack." Props: { workspaceName, inviterName, inviteUrl }
   - `SystemAlertEmail` — system alerts (sync failures, automation errors). Props: { alertType, alertTitle, alertBody, workspaceName, dashboardUrl }
   - `ClientThreadReplyEmail` — fires when workspace user posts in client thread. Message preview (first 120 chars) + portal link. Props: { senderName, recordTitle, messagePreview, portalUrl }
   - All: server-side rendered via React Email. From: notifications@everystack.com. EveryStack branding.

2. Install `@react-email/components` if not already present.

3. Create `apps/web/src/data/notification-preferences.ts`:
   - `getNotificationPreferences(tenantId, userId)` — fetch preferences, return defaults if no row
   - `updateNotificationPreferences(tenantId, userId, prefs)` — upsert JSONB
   - Defaults: mentions & DMs → inApp: true, email: 'instant'. All others → inApp: true, email: 'digest'. digestFrequency: 'daily'.

4. Create `apps/web/src/actions/notifications.ts`:
   - `markNotificationReadAction(notificationId)` — Clerk auth
   - `markAllReadAction()` — Clerk auth
   - `updateNotificationPreferencesAction(prefs)` — Clerk auth, Zod validation

5. Wire templates into email send processor — processor determines template based on notification type, renders to HTML, sends via Resend.

6. Write tests: Template rendering snapshots. Preference defaults. Preference update merges. Server action auth. Tenant isolation for preferences.

Acceptance criteria:
- [ ] [CONTRACT] InvitationEmail, SystemAlertEmail, ClientThreadReplyEmail templates exported
- [ ] [CONTRACT] getNotificationPreferences, updateNotificationPreferences exported from notification-preferences.ts
- [ ] [CONTRACT] markNotificationReadAction, markAllReadAction, updateNotificationPreferencesAction exported from actions/notifications.ts
- [ ] [CONTRACT] ResendEmailService.send() exported from resend-service.ts
- [ ] Client thread reply email includes message preview and portal link
- [ ] Notification preferences return sensible defaults when no row exists
- [ ] testTenantIsolation() passes for preference data functions
- [ ] ≥90% line coverage on notification data layer, ≥85% branch coverage
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Notification bell UI (Unit 6), email digest scheduling (post-MVP), email tracking (post-MVP).

Commit with: `feat(email): React Email templates + notification preferences + actions [Phase 3C, Prompt 7]`
```

[CHECKPOINT]
```
Look for:
- 3 email templates in apps/web/src/lib/email/templates/
- apps/web/src/data/notification-preferences.ts with 2 functions
- apps/web/src/actions/notifications.ts with 3 actions
- Email processor wired to templates
- TypeScript compiles with zero errors
```

---

### VERIFY SESSION B — Unit 2, Prompts 5–7 — Completes Unit 2

**What This Step Does:**
"This runs the full test suite against everything Unit 2 built. It also checks that Unit 2 produced everything it promised (its interface contract)."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Phase 3C Prompts 5–7 (Unit 2: Notification Pipeline & System Email):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: BullMQ notification queue registered in worker

Interface contract verification (Unit 2):
- [ ] [CONTRACT] `NotificationService.create()` exported from `apps/web/src/lib/notifications/notification-service.ts`
- [ ] [CONTRACT] `getNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead` from `apps/web/src/data/notifications.ts`
- [ ] [CONTRACT] `getNotificationPreferences`, `updateNotificationPreferences` from `apps/web/src/data/notification-preferences.ts`
- [ ] [CONTRACT] BullMQ queue `notification` registered with `notification.email.send` and `notification.cleanup` job types
- [ ] [CONTRACT] `ResendEmailService.send()` from `apps/web/src/lib/email/resend-service.ts`
- [ ] [CONTRACT] React Email templates: InvitationEmail, SystemAlertEmail, ClientThreadReplyEmail
- [ ] [CONTRACT] Server actions from `apps/web/src/actions/notifications.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 5–7, unit 2 complete [Phase 3C, VP-2]"
git push origin build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 2 to `passed-review`.
Open MODIFICATIONS.md. Add a session block:

## Session B — Phase 3C — build/3c-comms

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 5–7 (Unit 2: Notification Pipeline & System Email)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### ═══ UNIT 3: Presence & Real-Time Chat Infrastructure ═══

**What This Unit Builds:**
This is the real-time transport layer — the system that makes messages appear instantly without refreshing the page. It extends the existing Socket.IO server with chat-specific event handlers (message delivery, typing indicators, room management), builds the presence system (tracking who's online, away, in Do Not Disturb mode, or offline using Redis heartbeats), and creates the notification push channel. Without this unit, every message would require a page refresh to see.

**What Comes Out of It:**
When done, the real-time server can manage chat rooms per thread, broadcast messages to all participants, show "X is typing..." indicators, track user presence with automatic timeout, push notifications in real-time, and support custom status messages (emoji + text like "🏖️ On vacation").

**What It Needs from Prior Work:**
This unit uses the `Thread` and `ThreadMessage` types from Unit 1, which you already built. It also extends the existing Socket.IO server infrastructure from Phase 1G.

---

### BUILD SESSION C — Unit 3, Prompts 8–10

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 3 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 8: PresenceService (Redis Heartbeat + Custom Status)

**What This Builds:**
This creates the presence tracking system — how EveryStack knows whether someone is online, away, in DND mode, or offline. It uses Redis keys with 60-second expiration: the client sends a "heartbeat" every 30 seconds to keep the key alive. If someone closes their laptop, the key expires after 60 seconds and they appear offline. Custom statuses (like "🏖️ On vacation until Friday") are stored in the database since they persist longer than a session.

**What You'll See When It's Done:**
Claude Code will create the PresenceService, custom status data functions, and shared types for all chat/presence events.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 3, Prompt 8.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 8 (search for "## Prompt 8:")

Read these context files:
- docs/reference/communications.md lines 148–182 (Pinned, Bookmarks & Presence — presence states, Redis storage, DND behavior, custom status)
- docs/reference/realtime.md lines 149–164 (Presence System — Redis key pattern, TTL, heartbeat)
- apps/realtime/src/socket-io-realtime-service.ts (existing service patterns)
- packages/shared/db/schema/workspace-memberships.ts (custom status columns)

Tasks:

1. Create `apps/realtime/src/types/chat.ts` — shared types:
   - `PresenceState`: 'online' | 'away' | 'dnd' | 'offline' (string type with comment)
   - `PresenceEntry`: { userId, state, lastActiveAt, customStatus?: { emoji, text } }
   - `ChatEvent`: { type: 'message:new' | 'message:edit' | 'message:delete', threadId, payload }
   - `TypingEvent`: { threadId, userId, displayName }

2. Create `apps/realtime/src/services/presence-service.ts`:
   - `PresenceService` class:
     - `setPresence(tenantId, roomId, userId, state)` — SET Redis key `presence:t:{tenantId}:{roomId}:{userId}` with 60s TTL
     - `getPresence(tenantId, roomId)` — SCAN for presence keys, parse values
     - `heartbeat(tenantId, userId)` — refresh TTL on all user's presence keys (called every 30s)
     - `getUserStatus(tenantId, userId)` — check any room key, return 'offline' if none
     - `removePresence(tenantId, roomId, userId)` — DEL key immediately on disconnect

3. Create `apps/web/src/data/presence.ts`:
   - `updateCustomStatus(tenantId, userId, emoji, text, clearAt?)` — update workspace_memberships columns
   - `getCustomStatus(tenantId, userId)` — read custom status
   - `clearExpiredStatuses()` — cleanup auto-clear statuses

4. Write tests: Presence TTL expiry. Heartbeat refreshes TTL. DND state detection. Custom status CRUD. Tenant isolation.

Acceptance criteria:
- [ ] Presence heartbeat stores state in Redis with 60s TTL
- [ ] 4 presence states: online, away, dnd, offline
- [ ] Custom status (emoji + text + auto-clear) persists to workspace_memberships
- [ ] heartbeat() refreshes TTL on all user's presence keys
- [ ] removePresence() immediately removes key on disconnect
- [ ] Types exported from apps/realtime/src/types/chat.ts
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Socket.IO event handlers (Prompt 9), presence UI (Unit 6).

Commit with: `feat(realtime): PresenceService with Redis heartbeat + custom status [Phase 3C, Prompt 8]`
```

[CHECKPOINT]
```
Look for:
- apps/realtime/src/types/chat.ts with 4 exported types
- apps/realtime/src/services/presence-service.ts with PresenceService class
- apps/web/src/data/presence.ts with custom status functions
- Redis key pattern: presence:t:{tenantId}:{roomId}:{userId}
- TypeScript compiles with zero errors
```

---

#### PROMPT 9: ChatHandler + PresenceHandler + NotificationHandler (Socket.IO)

**What This Builds:**
This creates the Socket.IO event handlers — the code that listens for and responds to real-time events. The ChatHandler manages thread rooms (joining, leaving, broadcasting messages). The PresenceHandler manages heartbeats and status updates. The NotificationHandler subscribes each connected user to their personal notification channel so they get instant alerts. DND mode suppresses most notifications but still lets through mentions and DMs from Owners.

**What You'll See When It's Done:**
Claude Code will create 3 handler files and register them in the Socket.IO server. Each handler follows the existing room-handler pattern.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 3, Prompt 9.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 9 (search for "## Prompt 9:")

Read these context files:
- docs/reference/realtime.md lines 17–42 (Transport Abstraction)
- docs/reference/realtime.md lines 44–57 (Room Model — thread room pattern)
- docs/reference/realtime.md lines 109–128 (Event Flow)
- docs/reference/realtime.md lines 166–185 (Chat / DM Message Delivery)
- apps/realtime/src/handlers/room-handler.ts (handler pattern reference)
- apps/realtime/src/middleware/auth.ts (auth middleware pattern)
- apps/realtime/src/services/presence-service.ts (PresenceService from Prompt 8)
- apps/realtime/src/types/chat.ts (types from Prompt 8)

Tasks:

1. Create `apps/realtime/src/handlers/chat-handler.ts` — ChatHandler class:
   - `thread:join` — add user to Socket.IO room `thread:{threadId}`, validate tenant, set presence
   - `thread:leave` — remove from room, remove presence
   - `message:new` — receive from Redis subscriber, broadcast to room except sender
   - `message:edit` — broadcast to thread room
   - `message:delete` — broadcast to thread room
   - `typing:start` — broadcast to room excluding sender, include display name
   - `typing:stop` — broadcast stop event

2. Create `apps/realtime/src/handlers/presence-handler.ts` — PresenceHandler class:
   - `presence:heartbeat` — calls PresenceService.heartbeat(), client sends every 30s
   - `presence:update` — user sets state (e.g., DND), broadcasts to workspace room
   - `presence:status` — request current state
   - On disconnect: removePresence() for all rooms

3. Create `apps/realtime/src/handlers/notification-handler.ts` — NotificationHandler class:
   - On connect: subscribe to Redis channel `user:{userId}:notifications`
   - On notification: push via Socket.IO `notification:new`
   - DND suppression: suppress all push except mention/dm from Owners
   - On disconnect: unsubscribe

4. Register handlers in `apps/realtime/src/server.ts`.

5. Write tests: Handler registration. Room join/leave. Message broadcast excludes sender. Typing broadcast. DND notification suppression. Auth middleware on room join.

Acceptance criteria:
- [ ] thread:join adds user to room, thread:leave removes
- [ ] message:new broadcasts to all room members except sender
- [ ] Typing indicators broadcast to thread room
- [ ] NotificationHandler subscribes to user's Redis channel, pushes via Socket.IO
- [ ] DND suppresses all except mention/dm from Owners
- [ ] All handlers validate tenant via auth middleware
- [ ] Handlers registered in server.ts
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Redis pub/sub publisher (Prompt 10), cursor broadcasting (post-MVP).

Commit with: `feat(realtime): Chat, Presence, Notification Socket.IO handlers [Phase 3C, Prompt 9]`
```

[CHECKPOINT]
```
Look for:
- 3 handler files in apps/realtime/src/handlers/
- Handlers registered in apps/realtime/src/server.ts
- TypeScript compiles with zero errors
```

---

#### PROMPT 10: Redis Pub/Sub Chat Event Publisher + Subscriber

**What This Builds:**
This creates the bridge between the web app and the real-time server. When a user sends a message through a server action, the web app publishes the event to Redis. The real-time server subscribes to Redis and forwards the event to the right Socket.IO room. This Redis-based architecture is what allows EveryStack to scale horizontally — multiple server instances all see the same events because Redis acts as the central event bus. Publisher failure is fire-and-forget: the message is already saved in the database, so if Redis hiccups, the client sees it on next poll.

**What You'll See When It's Done:**
Claude Code will create publisher functions, a subscriber, and update existing server actions and NotificationService to call the publishers.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 3, Prompt 10.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 10 (search for "## Prompt 10:")

Read these context files:
- docs/reference/realtime.md lines 109–128 (Event Flow — Redis as event bus)
- docs/reference/realtime.md lines 166–185 (Chat / DM Message Delivery — target <200ms)
- apps/realtime/src/subscribers/redis-event-subscriber.ts (existing subscriber pattern)
- apps/web/src/actions/threads.ts (server actions from Unit 1 — will add publishChatEvent calls)
- apps/web/src/lib/notifications/notification-service.ts (NotificationService from Unit 2 — will add publishNotificationEvent call)

Tasks:

1. Create `apps/web/src/lib/realtime/chat-events.ts` — publisher functions:
   - `publishChatEvent(tenantId, threadId, event: ChatEvent)` — publish to Redis channel `thread:{threadId}`. Fire-and-forget — failure logged but does not block.
   - Event types: message:new, message:edit, message:delete

2. Create `apps/web/src/lib/realtime/notification-events.ts`:
   - `publishNotificationEvent(userId, notification)` — publish to Redis channel `user:{userId}:notifications`

3. Create `apps/realtime/src/subscribers/chat-event-subscriber.ts`:
   - Subscribe to `thread:*` Redis channels for cross-process delivery
   - Forward events to Socket.IO room via ChatHandler
   - Pattern subscription for dynamic thread channels

4. Integration: Update `apps/web/src/actions/threads.ts` to call publishChatEvent() after message creation. Update NotificationService to call publishNotificationEvent() after notification creation.

5. Write tests: Publisher encodes correctly. Subscriber forwards to correct room. Cross-process delivery (mock Redis). Notification event publishing. Publisher failure does not throw.

Acceptance criteria:
- [ ] [CONTRACT] publishChatEvent exported from chat-events.ts
- [ ] [CONTRACT] publishNotificationEvent exported from notification-events.ts
- [ ] [CONTRACT] Chat event subscriber at subscribers/chat-event-subscriber.ts
- [ ] Redis pub/sub for cross-process message delivery
- [ ] Server actions call publishChatEvent() after message creation
- [ ] NotificationService calls publishNotificationEvent() after notification creation
- [ ] Publisher failure is fire-and-forget
- [ ] ≥85% line coverage on handlers, ≥80% branch coverage
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Client-side Socket.IO hooks (Unit 5), notification UI (Unit 6).

Commit with: `feat(realtime): Redis pub/sub chat event publisher + subscriber [Phase 3C, Prompt 10]`
```

[CHECKPOINT]
```
Look for:
- apps/web/src/lib/realtime/chat-events.ts with publishChatEvent
- apps/web/src/lib/realtime/notification-events.ts with publishNotificationEvent
- apps/realtime/src/subscribers/chat-event-subscriber.ts
- Server actions updated with publishChatEvent calls
- TypeScript compiles with zero errors
```

---

### VERIFY SESSION C — Unit 3, Prompts 8–10 — Completes Unit 3

**What This Step Does:**
"This runs the full test suite against everything Unit 3 built. It also checks that Unit 3 produced everything it promised (its interface contract)."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Phase 3C Prompts 8–10 (Unit 3: Presence & Real-Time Chat Infrastructure):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met
5. Manual verification: Socket.IO handlers registered, Redis pub/sub channels functional

Interface contract verification (Unit 3):
- [ ] [CONTRACT] `PresenceService` with setPresence, getPresence, heartbeat, getUserStatus from `apps/realtime/src/services/presence-service.ts`
- [ ] [CONTRACT] `ChatHandler` handling thread:join, thread:leave, message:new, message:edit, message:delete, typing:start, typing:stop from `apps/realtime/src/handlers/chat-handler.ts`
- [ ] [CONTRACT] `PresenceHandler` handling presence:heartbeat, presence:update, presence:status from `apps/realtime/src/handlers/presence-handler.ts`
- [ ] [CONTRACT] `NotificationHandler` subscribed to user:{userId}:notifications from `apps/realtime/src/handlers/notification-handler.ts`
- [ ] [CONTRACT] `publishChatEvent` from `apps/web/src/lib/realtime/chat-events.ts`
- [ ] [CONTRACT] `publishNotificationEvent` from `apps/web/src/lib/realtime/notification-events.ts`
- [ ] [CONTRACT] Custom status CRUD from `apps/web/src/data/presence.ts`
- [ ] [CONTRACT] Types from `apps/realtime/src/types/chat.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 8–10, unit 3 complete [Phase 3C, VP-3]"
git push origin build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 3 to `passed-review`.
Open MODIFICATIONS.md. Add a session block:

## Session C — Phase 3C — build/3c-comms

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 8–10 (Unit 3: Presence & Real-Time Chat Infrastructure)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### ═══ UNIT 4: Chat Editor (TipTap Environment 1) ═══

**What This Unit Builds:**
The Chat Editor is the text input component used across all messaging surfaces — Record Threads, DMs, Group DMs, and later portals. It's a lightweight rich-text editor built on TipTap that supports bold/italic/underline, @mentions (rendered as teal pills), emoji reactions, markdown shortcuts, and file attachments. It uses "progressive disclosure" — it starts as a simple single-line input, grows a toolbar when you click into it, and expands to a full multi-line editor when you need more space. This unit also builds the message display components: how sent messages look, how emoji reactions work, and the emoji picker.

**What Comes Out of It:**
When done, you have a complete chat input component (ChatEditor) with 3 visual states, a mention system, an emoji picker, a message renderer that turns stored JSON into styled HTML, individual message display with hover actions (edit, delete, pin, save, reply), and emoji reactions on messages.

**What It Needs from Prior Work:**
Nothing — this unit has zero dependencies on other units. It only uses TipTap libraries, emoji-mart, and existing shadcn/ui components. It can be built in parallel with Units 1, 2, and 3.

---

### BUILD SESSION D — Unit 4, Prompts 11–13

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 4 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 11: TipTap Extension Config + useChatEditor Hook

**What This Builds:**
This sets up the TipTap editor foundation — which formatting features are available (bold, italic, lists, links, @mentions, markdown shortcuts) and which are intentionally excluded (headings, tables, code blocks — those are for the document editor in Phase 3D, not chat). It also creates the hook that manages the editor's 3 input states: Compact (single line, Enter to send), Focused (shows action icons), and Expanded (multi-line with full toolbar). The state machine handles keyboard shortcuts differently per state.

**What You'll See When It's Done:**
Claude Code will create 3 new files: the extension config, the editor hook, and types. Tests should verify state transitions and keyboard behavior.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 4, Prompt 11.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 11 (search for "## Prompt 11:")

Read these context files:
- docs/reference/communications.md lines 294–415 (Chat Editor TipTap Env 1 — full spec: input states, progressive disclosure, keyboard shortcuts, @mentions, markdown shortcuts, bubble toolbar, link handling, TipTap extensions)

Tasks:

1. Install TipTap dependencies (if not present): @tiptap/react, @tiptap/starter-kit, @tiptap/extension-mention, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/extension-underline. Install emoji-mart, @emoji-mart/react, @emoji-mart/data.

2. Create `apps/web/src/components/chat/types.ts`:
   - ChatEditorConfig: { placeholder?, onSend, onAttach?, mentionSuggestions?, maxHeight? }
   - ChatEditorInstance: { editor, state: 'compact' | 'focused' | 'expanded', send, isEmpty }
   - MentionSuggestion: { id, label, avatar?, role? }

3. Create `apps/web/src/components/chat/extensions.ts` — chatEditorExtensions array:
   - Bold, Italic, Underline, Strike, Code (inline marks)
   - BulletList, OrderedList, Blockquote
   - Link (autolink + Cmd+K)
   - Mention (custom — renders as teal pill, non-editable inline)
   - Placeholder, History (undo/redo)
   - InputRules (markdown shortcuts: **bold**, *italic*, ~~strike~~, `code`, - bullets, 1. ordered, > blockquote)
   - NOT included: Headings, Tables, CodeBlock, Image, HorizontalRule

4. Create `apps/web/src/components/chat/use-chat-editor.ts` — useChatEditor(config):
   - 3 states: Compact → Focused → Expanded
   - Transitions: click/focus → Focused; Shift+Enter/paste multi-line → Expanded; blur empty → Compact
   - Keyboard: Enter sends in Compact/Focused; Cmd+Enter sends in Expanded; Escape collapses; ↑ in empty → edit last sent
   - Wraps TipTap useEditor with chatEditorExtensions
   - Exposes send(), isEmpty, state

5. Write tests: Extension list verification. State machine transitions. Keyboard send behavior per state. Markdown shortcut conversion.

Acceptance criteria:
- [ ] chatEditorExtensions includes 13 extensions (no headings/tables/code blocks)
- [ ] useChatEditor manages 3 states: Compact, Focused, Expanded
- [ ] State transitions: click → Focused; Shift+Enter → Expanded; blur empty → Compact
- [ ] Keyboard: Enter sends in Compact/Focused; Cmd+Enter in Expanded; Escape collapses
- [ ] Markdown shortcuts auto-convert
- [ ] Types exported from types file
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: ChatEditor React component (Prompt 12), MessageRenderer (Prompt 13), EmojiPicker (Prompt 13), headings/tables/code blocks (TipTap env 2, Phase 3D).

Commit with: `feat(chat): TipTap extension config + useChatEditor hook [Phase 3C, Prompt 11]`
```

[CHECKPOINT]
```
Look for:
- apps/web/src/components/chat/types.ts with 3 types
- apps/web/src/components/chat/extensions.ts with chatEditorExtensions
- apps/web/src/components/chat/use-chat-editor.ts with useChatEditor hook
- TypeScript compiles with zero errors
```

---

#### PROMPT 12: ChatEditor Component (3 Input States + Toolbar + Mentions)

**What This Builds:**
This creates the visual ChatEditor React component — the actual text input box you type messages into. It renders differently based on the 3 states from the hook: Compact is a simple line, Focused adds action icons (attach, expand, emoji), and Expanded shows a multi-line editor with Cancel/Send buttons and a floating toolbar on text selection. The @mention system triggers when you type `@`, shows a filterable dropdown of workspace members, and inserts a teal pill when you select someone. There are also group mentions (`@here` for participants, `@channel` for all scope members).

**What You'll See When It's Done:**
Claude Code will create 4 component files: the main editor, toolbar, mention dropdown, and attachment button. The editor should render in all 3 states.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 4, Prompt 12.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 12 (search for "## Prompt 12:")

Read these context files:
- docs/reference/communications.md lines 294–415 (Chat Editor — input states, progressive disclosure, bubble toolbar, @mention system, attachments, link handling)
- apps/web/src/components/chat/use-chat-editor.ts (hook from Prompt 11)
- apps/web/src/components/chat/extensions.ts (extensions from Prompt 11)
- apps/web/src/components/chat/types.ts (types from Prompt 11)
- apps/web/src/components/ui/button.tsx (shadcn/ui pattern)
- apps/web/src/components/ui/popover.tsx (shadcn/ui pattern)

Tasks:

1. Create `apps/web/src/components/chat/ChatEditor.tsx`:
   - Uses useChatEditor hook
   - 3 visual states: Compact (single-line, Enter to send, minimal border), Focused (teal border, action icons: attach/expand/emoji), Expanded (multi-line 80–240px, Cancel/Send buttons, bubble toolbar on selection)
   - Props: { onSend, mentionSuggestions, onAttach?, placeholder?, className? }

2. Create `apps/web/src/components/chat/ChatEditorToolbar.tsx`:
   - Bubble toolbar on text selection in Expanded mode: B | I | U | Link | Bullets | Numbers
   - 6 items, floating above selection

3. Create `apps/web/src/components/chat/MentionDropdown.tsx`:
   - Triggered by @ in editor
   - Shows people (avatar + name + role badge), fuzzy-filtered
   - Group mentions: @here (all participants), @channel (Manager+ only)
   - Arrow keys + Enter to select, Escape to dismiss
   - Selected → teal pill, non-editable, backspace deletes whole pill

4. Create `apps/web/src/components/chat/ChatAttachmentButton.tsx`:
   - Paperclip button, triggers file picker
   - Drag-drop supported onto input area
   - File preview: images (thumbnail), files (icon + name + size)

5. Write tests: Component render in all 3 states. Toolbar on selection. Mention dropdown filters. Mention pill rendering. Attachment trigger.

Acceptance criteria:
- [ ] Three input states: Compact, Focused, Expanded
- [ ] @ triggers MentionDropdown with fuzzy filter, arrow keys + Enter select
- [ ] Selected mention = teal pill, non-editable, backspace deletes whole pill
- [ ] Bubble toolbar on text selection in Expanded: B | I | U | Link | Bullets | Numbers
- [ ] Link auto-detection on paste/type, Cmd+K for link dialog
- [ ] Attachment button with file picker + drag-drop
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Message display (Prompt 13), emoji picker (Prompt 13), thread integration (Unit 5).

Commit with: `feat(chat): ChatEditor with toolbar, mentions, attachments [Phase 3C, Prompt 12]`
```

[CHECKPOINT]
```
Look for:
- ChatEditor.tsx with 3 visual states
- ChatEditorToolbar.tsx with 6 toolbar items
- MentionDropdown.tsx with fuzzy filter + group mentions
- ChatAttachmentButton.tsx with file picker
- TypeScript compiles with zero errors
```

---

#### PROMPT 13: MessageRenderer + MessageItem + EmojiReactions + EmojiPicker

**What This Builds:**
This creates the message display components — how sent messages look in a thread. The MessageRenderer takes stored TipTap JSON and renders it as styled HTML without needing an actual editor instance (much more efficient for displaying many messages). MessageItem wraps each message with the avatar, name, timestamp, and a hover menu for actions (edit, delete, pin, save, reply). EmojiReactions shows reaction chips below messages. The EmojiPicker wraps emoji-mart for picking emoji in reactions and custom statuses.

**What You'll See When It's Done:**
Claude Code will create 4 component files. Messages should render with all formatting marks, mentions as teal pills, hover actions, and emoji reaction chips.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 4, Prompt 13.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 13 (search for "## Prompt 13:")

Read these context files:
- docs/reference/communications.md lines 410–440 (Message Display, Editing, Deletion, Emoji Reactions, Emoji Picker)
- apps/web/src/components/chat/use-chat-editor.ts (hook from Prompt 11 — used for inline edit mode)
- apps/web/src/components/chat/ChatEditor.tsx (editor from Prompt 12 — used in edit mode)
- apps/web/src/components/ui/popover.tsx (shadcn/ui pattern for emoji picker)

Tasks:

1. Create `apps/web/src/components/chat/MessageRenderer.tsx`:
   - Read-only TipTap JSON → styled HTML renderer. No editor instances.
   - Renders: bold, italic, underline, strike, code, link, bullet list, ordered list, blockquote, mention pill (teal @Name)

2. Create `apps/web/src/components/chat/MessageItem.tsx`:
   - Single message: avatar, display name, timestamp, content (via MessageRenderer)
   - Hover menu (⋯): Edit, Delete, Pin, Save, Reply
   - Edit mode: inline ChatEditor replaces rendered message. Save (Cmd+Enter) / Cancel (Escape). Shows "(edited)"
   - Deleted: "This message was deleted" placeholder
   - System messages: centered, muted-text, no edit/reply/react
   - Props: { message, currentUserId, onEdit, onDelete, onPin, onSave, onReply }

3. Create `apps/web/src/components/chat/EmojiReactions.tsx`:
   - Chips below message: emoji + count + active state (if current user reacted)
   - Click chip to toggle add/remove
   - "+" opens EmojiPicker for new reaction
   - Stored in reactions JSONB: { "👍": ["user_id_1", "user_id_2"] }

4. Create `apps/web/src/components/chat/EmojiPicker.tsx`:
   - Wraps emoji-mart React component
   - Categories, search, skin tone selector
   - Colon autocomplete: :thu → suggests 👍
   - Renders in Popover (shadcn/ui)

5. Write tests: MessageRenderer snapshots per mark type. MessageItem hover menu. Edit mode toggle. System message rendering. Emoji add/remove. Emoji picker search. Deleted message placeholder.

Acceptance criteria:
- [ ] [CONTRACT] ChatEditor, ChatEditorToolbar, MentionDropdown, EmojiPicker, EmojiReactions, MessageRenderer, MessageItem, ChatAttachmentButton exported from components/chat/
- [ ] [CONTRACT] useChatEditor exported from use-chat-editor.ts
- [ ] MessageRenderer renders TipTap JSON as styled HTML without editor instances
- [ ] MessageItem: avatar, name, timestamp, content; hover menu with edit/delete/pin/save/reply
- [ ] Edit mode: inline editor, Save/Cancel, shows "(edited)"
- [ ] EmojiReactions: chips, click toggle, "+" opens picker
- [ ] EmojiPicker: emoji-mart with categories, search, skin tone, colon autocomplete
- [ ] ≥80% line coverage on components
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Thread panel integration (Unit 5), DM view (Unit 5), TipTap env 2 features (Phase 3D).

Commit with: `feat(chat): MessageRenderer, MessageItem, EmojiReactions, EmojiPicker [Phase 3C, Prompt 13]`
```

[CHECKPOINT]
```
Look for:
- MessageRenderer.tsx (read-only renderer)
- MessageItem.tsx with hover menu and edit mode
- EmojiReactions.tsx with reaction chips
- EmojiPicker.tsx wrapping emoji-mart
- TypeScript compiles with zero errors
```

---

### VERIFY SESSION D — Unit 4, Prompts 11–13 — Completes Unit 4

**What This Step Does:**
"This runs the full test suite against everything Unit 4 built. It also checks that Unit 4 produced everything it promised (its interface contract)."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Phase 3C Prompts 11–13 (Unit 4: Chat Editor — TipTap Env 1):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met (≥80% on components)

Interface contract verification (Unit 4):
- [ ] [CONTRACT] ChatEditor, ChatEditorToolbar, MentionDropdown, EmojiPicker, EmojiReactions, MessageRenderer, MessageItem, ChatAttachmentButton exported from `apps/web/src/components/chat/`
- [ ] [CONTRACT] useChatEditor hook exported from `apps/web/src/components/chat/use-chat-editor.ts`
- [ ] [CONTRACT] chatEditorExtensions exported from `apps/web/src/components/chat/extensions.ts`
- [ ] [CONTRACT] ChatEditorConfig, ChatEditorInstance, MentionSuggestion types exported from `apps/web/src/components/chat/types.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 11–13, unit 4 complete [Phase 3C, VP-4]"
git push origin build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 4 to `passed-review`.
Open MODIFICATIONS.md. Add a session block:

## Session D — Phase 3C — build/3c-comms

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 11–13 (Unit 4: Chat Editor — TipTap Env 1)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### ═══ UNIT 5: Record Thread & DM UI ═══

**What This Unit Builds:**
This is where messaging becomes visible and interactive. It builds the Record Thread panel (the chat panel that slides out from the right side of a Record View), the DM and Group DM conversation views, and all the real-time messaging hooks that wire the data layer to the UI. The thread panel has two tabs (Team Notes for internal discussion, Client Messages for portal client conversations), tab lenses (All/Notes/Activity/Files), threaded replies, in-thread search, pinned messages, and typing indicators. This unit is the biggest integration point — it wires together the data layer (Unit 1), real-time infrastructure (Unit 3), and Chat Editor components (Unit 4).

**What Comes Out of It:**
When done, users can open a chat panel on any record, switch between internal and client threads, filter messages by type, reply to specific messages in a side panel, search within threads, see who's typing, view pinned messages, open DM conversations, create group DMs, and see messaging error states (failed sends with retry, rate limiting). The Record View layout adjusts to accommodate the thread panel at 25% width.

**What It Needs from Prior Work:**
This unit uses data functions and server actions from Unit 1, real-time event publishing and Socket.IO events from Unit 3, and ChatEditor/MessageItem/EmojiReactions components from Unit 4. All three must be complete before starting.

---

### BUILD SESSION E — Unit 5, Prompts 14–16

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 5 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 14: RecordThreadPanel Shell + ThreadTabBar + ThreadLensBar + useThread Hook

**What This Builds:**
This creates the main thread panel — the chat interface that opens alongside the Record View. It includes the two-tab system (Team Notes for workspace-only discussion, Client Messages for conversations that portal clients can see), the lens filter bar that lets you narrow messages to just notes, activity, or files, and the `useThread` hook that loads messages with pagination and subscribes to real-time events. It also creates the "client-visible" warning banner and the visual treatment for messages that originated from Personal Notes.

**What You'll See When It's Done:**
Claude Code will create 6 new component files and a hook. The panel shell should render with tabs and lenses, though the message list and input will come in the next prompts.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 5, Prompt 14.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 14 (search for "## Prompt 14:")

Read these context files:
- docs/reference/communications.md lines 57–113 (Thread Scopes — two-thread model, Record Thread UX)
- docs/reference/communications.md lines 29–55 (MVP Scope — Chat Quick Panel, Chat Editor)
- docs/phases/phase-division-phase3-part1.md lines 184–213 (3C scope — thread tab lenses, visual distinction, client-visible indicator)
- apps/web/src/components/record-view/RecordView.tsx (Record View layout)
- apps/web/src/components/record-view/RecordViewHeader.tsx (header for chat icon)
- apps/web/src/data/threads.ts (thread data functions from Unit 1)
- apps/web/src/lib/realtime/chat-events.ts (chat events from Unit 3)
- apps/web/src/components/chat/ChatEditor.tsx (ChatEditor from Unit 4)

Tasks:

1. Create `apps/web/src/components/thread/use-thread.ts` — useThread(threadId):
   - Loads messages via getMessages server action (cursor-paginated, chronological)
   - Subscribes to Socket.IO message:new, message:edit, message:delete events
   - Manages unread state via updateLastRead on view
   - Exposes: { messages, isLoading, hasMore, loadMore, unreadCount, sendMessage, editMessage, deleteMessage }
   - Uses TanStack Query for server state + Socket.IO for real-time

2. Create `apps/web/src/components/thread/RecordThreadPanel.tsx`:
   - 25% width panel alongside Record View
   - Opens from Record View header chat icon
   - Contains: ThreadTabBar, ThreadLensBar, message list, ChatEditor input
   - Props: { recordId, tenantId, onClose }

3. Create `apps/web/src/components/thread/ThreadTabBar.tsx`:
   - Two tabs: "Team Notes" (internal, always present) + "Client Messages" (visible when Client Messaging enabled)
   - Active tab: teal underline
   - Tab switch loads different thread via getThreadByScope

4. Create `apps/web/src/components/thread/ThreadLensBar.tsx`:
   - Below tabs: [ All ] [ Notes ] [ Activity ] [ Files ]
   - All: no filter. Notes: source_note_id IS NOT NULL. Activity: message_type = 'activity'. Files: attachments IS NOT NULL.
   - Uses lensFilter param in getMessages

5. Create `apps/web/src/components/thread/ClientVisibleBanner.tsx`:
   - Persistent, non-dismissible banner above input in client thread tab
   - Text: "Messages here are visible to the portal client." (i18n key)

6. Create `apps/web/src/components/thread/SharedNoteMessage.tsx`:
   - Wrapper for messages where source_note_id IS NOT NULL
   - Visual: 📝 icon, 3px --ws-accent left border, inset container

7. Write tests: useThread loads messages + subscribes. Tab switching. Lens filtering. Client banner only on client tab. Shared note styling.

Acceptance criteria:
- [ ] Thread panel opens from Record View header chat icon at 25% width
- [ ] Two tabs: Team Notes (always) + Client Messages (when enabled)
- [ ] Tab lenses: All | Notes | Activity | Files
- [ ] Client-visible banner: persistent warning above input in client tab
- [ ] Shared note messages: 📝 icon, accent left border, inset container
- [ ] useThread hook: pagination + real-time subscription
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Message virtualization (Prompt 15), reply panel (Prompt 15), search (Prompt 15), DM views (Prompt 16).

Commit with: `feat(thread): RecordThreadPanel shell with tabs, lenses, useThread [Phase 3C, Prompt 14]`
```

[CHECKPOINT]
```
Look for:
- 6 new files in apps/web/src/components/thread/
- use-thread.ts hook with TanStack Query + Socket.IO
- TypeScript compiles with zero errors
```

---

#### PROMPT 15: ThreadMessageList + ThreadReplyPanel + ThreadSearchBar

**What This Builds:**
This creates the message list (virtualized for performance with many messages), the threaded reply panel (a 360px side panel that expands when you click "N replies"), the in-thread search bar (Cmd+F within the thread panel), the pinned messages panel, and the typing indicator hook. The message list auto-scrolls to the bottom on new messages but respects when a user has scrolled up to read history. Search automatically switches between client-side filtering (when all messages are loaded) and server-side ILIKE queries (for longer threads).

**What You'll See When It's Done:**
Claude Code will create 6 new files: the message list, reply panel, search bar, pinned panel, search hook, and typing indicator hook.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 5, Prompt 15.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 15 (search for "## Prompt 15:")

Read these context files:
- docs/reference/communications.md lines 115–128 (Threaded Replies — reply chip, expand side panel, notification rules)
- docs/reference/communications.md lines 148–182 (Pinned — pin panel)
- docs/phases/phase-division-phase3-part1.md lines 184–213 (3C scope — in-thread search spec)
- apps/web/src/components/thread/RecordThreadPanel.tsx (panel shell from Prompt 14)
- apps/web/src/components/thread/use-thread.ts (hook from Prompt 14)
- apps/web/src/components/chat/MessageItem.tsx (message display from Unit 4)
- apps/web/src/data/thread-messages.ts (message data functions from Unit 1)

Tasks:

1. Create `apps/web/src/components/thread/ThreadMessageList.tsx`:
   - Virtualized via TanStack Virtual
   - Renders MessageItem for each message
   - Auto-scroll to bottom on new messages (unless user scrolled up)
   - Load more on scroll-to-top (reverse pagination)
   - Messages with source_note_id wrapped in SharedNoteMessage
   - Typing indicator at bottom: "X is typing..." with animated dots

2. Create `apps/web/src/components/thread/ThreadReplyPanel.tsx`:
   - 360px side panel for threaded replies
   - Opens on click: "N replies · last Xm ago" chip
   - Reply chain with ChatEditor at bottom
   - Loads via getMessages with parentMessageId filter

3. Create `apps/web/src/components/thread/ThreadSearchBar.tsx`:
   - Triggered by Cmd+F when thread panel focused
   - Short threads (all in memory): client-side string filter
   - Long threads (paginated): server ILIKE via searchThreadMessages
   - Highlights matched text, scroll to first match
   - Escape closes

4. Create `apps/web/src/components/thread/use-thread-search.ts`:
   - Determines search mode: client-side or server-side
   - Returns { query, setQuery, results, highlightPositions, scrollToMatch }

5. Create `apps/web/src/components/thread/use-typing-indicator.ts`:
   - Broadcasts typing:start on keystroke (debounced 500ms)
   - typing:stop after 3s no keystrokes
   - Listens for other users' typing events
   - Returns { typingUsers, startTyping }

6. Create `apps/web/src/components/thread/PinnedMessagesPanel.tsx`:
   - 📌 icon in thread header
   - Lists pinned messages via getPinnedMessages, most recent first
   - Click pin → scroll to original message

7. Write tests: Auto-scroll behavior. Reply panel open/close. Search highlight. Typing 3s timeout. Pinned panel. Virtualization with >100 messages.

Acceptance criteria:
- [ ] Threaded replies: "N replies · last Xm ago" chip; 360px side panel
- [ ] In-thread search: Cmd+F, client-side or server ILIKE, highlights matches
- [ ] Typing indicator: "X is typing..." with 3s debounce
- [ ] Pinned messages: 📌 icon, sorted by pinned_at DESC
- [ ] Auto-scroll to bottom (respects scroll-up state)
- [ ] Virtualized rendering via TanStack Virtual
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: DM views (Prompt 16), thread nav (Prompt 16), Record View layout modification (Prompt 16).

Commit with: `feat(thread): message list, replies, search, typing indicator [Phase 3C, Prompt 15]`
```

[CHECKPOINT]
```
Look for:
- ThreadMessageList.tsx with TanStack Virtual
- ThreadReplyPanel.tsx (360px side panel)
- ThreadSearchBar.tsx with dual search mode
- PinnedMessagesPanel.tsx
- Two hooks: use-thread-search.ts, use-typing-indicator.ts
- TypeScript compiles with zero errors
```

---

#### PROMPT 16: DMConversation + GroupDMHeader + Thread Nav + Record View Integration

**What This Builds:**
This creates the DM conversation view (for one-on-one and group direct messages), the group DM header (with editable name and participant list), the thread navigation dropdown (for quickly jumping between related records' threads), and integrates the thread panel into the Record View. It also adds all the messaging error states: failed messages show a red outline with retry, permission denied shows a toast, and rate limiting temporarily disables the composer. This is the final integration piece that makes everything work together.

**What You'll See When It's Done:**
Claude Code will create 3 new files and modify 2 existing files (RecordView and RecordViewHeader). The Record View should now have a chat icon that opens the thread panel. DM views should load and show real-time messages.

**How Long This Typically Takes:** 15–20 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 5, Prompt 16.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 16 (search for "## Prompt 16:")

Read these context files:
- docs/reference/communications.md lines 57–113 (Thread Scopes — DMs, group DMs)
- docs/reference/communications.md lines 130–146 (Chat Navigation — hierarchical sidebar, tree dropdown)
- docs/reference/communications.md lines 417–432 (Messaging Error Handling — all error states)
- apps/web/src/components/thread/RecordThreadPanel.tsx (panel from Prompt 14)
- apps/web/src/components/thread/ThreadMessageList.tsx (message list from Prompt 15)
- apps/web/src/components/thread/use-thread.ts (hook from Prompt 14)
- apps/web/src/components/record-view/RecordView.tsx (existing Record View)
- apps/web/src/components/record-view/RecordViewHeader.tsx (existing header)

Tasks:

1. Create `apps/web/src/components/chat/DMConversation.tsx`:
   - DM/Group DM conversation view
   - Uses useThread hook for messages + real-time
   - Renders ThreadMessageList + ChatEditor
   - Props: { threadId, tenantId }

2. Create `apps/web/src/components/chat/GroupDMHeader.tsx`:
   - Group name (editable), participant avatars, settings icon
   - 3–8 participant cap display, "Add participant" button

3. Create `apps/web/src/components/thread/ThreadNavDropdown.tsx`:
   - Hierarchical tree: parent → current (highlighted) + siblings → children
   - Each entry: record title + unread indicator (teal dot + count)
   - Click navigates to that record's thread
   - Auto-detected for tables with self-referential linked record fields

4. Modify `apps/web/src/components/record-view/RecordView.tsx`:
   - Add thread panel slot. Layout adjusts to 25% thread panel when open.

5. Modify `apps/web/src/components/record-view/RecordViewHeader.tsx`:
   - Add chat icon button that toggles RecordThreadPanel
   - Unread count badge on chat icon

6. Add messaging error states:
   - Failed messages: red outline + retry. 3 retries (1s, 3s, 10s), then manual retry.
   - Permission denied: toast + remove thread
   - Attachment failure: inline error on thumbnail
   - Rate limiting (30 msg/min/user/thread): toast + disable composer 5s

7. Write tests: DM loads + real-time. Group DM header edit. Thread nav tree. Record View layout with/without panel. Error states. Chat icon badge.

Acceptance criteria:
- [ ] [CONTRACT] All thread components exported from components/thread/
- [ ] [CONTRACT] DMConversation, GroupDMHeader exported from components/chat/
- [ ] [CONTRACT] useThread, useThreadSearch, useTypingIndicator hooks exported
- [ ] DM conversation with real-time delivery
- [ ] Group DM with name, participant list, 3–8 cap
- [ ] Thread nav dropdown for self-referential records with unread indicators
- [ ] Messaging error states: failed (red + retry), permission denied (toast), rate limited (disable 5s)
- [ ] Record View layout accommodates 25% thread panel
- [ ] ≥80% line coverage on components
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Notification bell (Unit 6), Chat Quick Panel (Unit 6), presence indicators (Unit 6).

Commit with: `feat(thread): DM views, thread nav, Record View integration [Phase 3C, Prompt 16]`
```

[CHECKPOINT]
```
Look for:
- DMConversation.tsx and GroupDMHeader.tsx in components/chat/
- ThreadNavDropdown.tsx in components/thread/
- RecordView.tsx modified with thread panel slot
- RecordViewHeader.tsx modified with chat icon + badge
- Error state handling
- TypeScript compiles with zero errors
```

---

### VERIFY SESSION E — Unit 5, Prompts 14–16 — Completes Unit 5

**What This Step Does:**
"This runs the full test suite against everything Unit 5 built. It also checks that Unit 5 produced everything it promised (its interface contract)."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Phase 3C Prompts 14–16 (Unit 5: Record Thread & DM UI):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met (≥80% on components)
6. Manual verification: Open Record View, click chat icon, thread panel opens at 25% width with correct tabs and lenses

Interface contract verification (Unit 5):
- [ ] [CONTRACT] All thread components exported from `apps/web/src/components/thread/`
- [ ] [CONTRACT] DMConversation, GroupDMHeader exported from `apps/web/src/components/chat/`
- [ ] [CONTRACT] useThread, useThreadSearch, useTypingIndicator hooks exported
- [ ] [CONTRACT] Record View header has chat icon with unread badge
- [ ] [CONTRACT] Record View layout accommodates thread panel

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 14–16, unit 5 complete [Phase 3C, VP-5]"
git push origin build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 5 to `passed-review`.
Open MODIFICATIONS.md. Add a session block:

## Session E — Phase 3C — build/3c-comms

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 14–16 (Unit 5: Record Thread & DM UI)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### ═══ UNIT 6: Notification UI & Chat Quick Panel ═══

**What This Unit Builds:**
This is the final unit — it completes the communications surface layer. The notification bell and tray give users an aggregated feed of everything that needs their attention (mentions, DMs, replies, system alerts) with smart grouping and real-time updates. The Chat Quick Panel in the sidebar is a unified conversation feed showing all threads sorted by recency — like a messaging app's conversation list. Presence indicators show who's online/away/DND as colored dots on avatars throughout the workspace.

**What Comes Out of It:**
When done, the notification bell appears in the workspace header with a real-time unread count badge. Clicking it opens a tray with grouped notifications. The Chat Quick Panel in the sidebar shows all conversations sorted by most recent message. Presence dots appear on avatars everywhere. Users can set custom statuses with emoji and auto-clear times. Phase 3C is complete.

**What It Needs from Prior Work:**
This unit uses the notification data and server actions from Unit 2, the real-time handlers and presence service from Unit 3, and the DM navigation and thread list from Unit 5.

---

### BUILD SESSION F — Unit 6, Prompts 17–19

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 6 to `in-progress`.
```

Open Claude Code. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 17: NotificationBell + NotificationTray + useNotifications Hook

**What This Builds:**
This creates the notification bell icon (with a red unread count badge that updates in real-time), the notification tray that drops down when you click the bell, and the hook that manages notification state. The tray shows notifications grouped by context (so "Sarah, James, and 2 others commented on Project X" instead of 4 separate entries). Notifications are grouped by `group_key` within 5-minute windows. Clicking a notification marks it as read and navigates to the source.

**What You'll See When It's Done:**
Claude Code will create 5 new component files and a hook. The bell should render in the workspace header area.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 6, Prompt 17.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 17 (search for "## Prompt 17:")

Read these context files:
- docs/reference/communications.md lines 184–312 (Notification Aggregation & Delivery — bell icon, tray, smart grouping, priority override display)
- apps/web/src/data/notifications.ts (notification data from Unit 2)
- apps/web/src/actions/notifications.ts (notification actions from Unit 2)
- apps/web/src/components/sidebar/ (sidebar components for shell integration)

Tasks:

1. Create `apps/web/src/components/notifications/use-notifications.ts` — useNotifications(tenantId, userId):
   - Loads via getNotifications (cursor-paginated)
   - Loads unread count via getUnreadNotificationCount (Redis-cached)
   - Subscribes to Socket.IO notification:new events
   - On new: prepend to list, increment count
   - Returns { notifications, unreadCount, isLoading, markRead, markAllRead, loadMore }

2. Create `apps/web/src/components/notifications/NotificationBell.tsx`:
   - Bell icon with unread count badge (red circle, white text). Hidden when 0.
   - Real-time updated via useNotifications
   - Click opens NotificationTray

3. Create `apps/web/src/components/notifications/NotificationTray.tsx`:
   - Dropdown: 400px × 480px max, right-aligned, scrollable
   - "Mark all as read" button at top
   - Renders NotificationItem or NotificationGroup
   - Client-side grouping: same group_key within 5 minutes → NotificationGroup
   - Load more on scroll to bottom

4. Create `apps/web/src/components/notifications/NotificationItem.tsx`:
   - Type icon, title, body preview, timestamp, read/unread state
   - Click: mark read + navigate to source
   - Unread: bold + teal left border. Read: normal weight.

5. Create `apps/web/src/components/notifications/NotificationGroup.tsx`:
   - Collapsed: "Sarah, James, and 2 others commented on {threadName}"
   - Click expands to individual notifications
   - Grouped by group_key + 5-minute proximity

6. Add NotificationBell to workspace header.

7. Write tests: useNotifications real-time update. Bell badge count. Tray opens/closes. Grouping logic. Mark read. Mark all read.

Acceptance criteria:
- [ ] Bell in workspace header with real-time unread count badge
- [ ] Click bell → tray (400px × 480px, right-aligned, scrollable)
- [ ] Notifications grouped by group_key within 5 minutes
- [ ] Mark as read on click; "Mark all as read" at top
- [ ] New notifications prepend in real-time via Socket.IO
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Chat Quick Panel (Prompt 18), presence indicators (Prompt 19), notification preferences UI (3G-i).

Commit with: `feat(notifications): bell, tray, notification grouping UI [Phase 3C, Prompt 17]`
```

[CHECKPOINT]
```
Look for:
- 5 files in apps/web/src/components/notifications/
- use-notifications.ts hook
- NotificationBell added to workspace header
- TypeScript compiles with zero errors
```

---

#### PROMPT 18: ChatQuickPanel + ChatQuickPanelItem

**What This Builds:**
This creates the Chat Quick Panel — a unified conversation feed that lives in the sidebar. Think of it like the conversation list in any messaging app: it shows all your conversations (record threads, DMs, group DMs) sorted by the most recent message. Each entry shows an avatar, name/record title, a preview of the last message, a relative timestamp ("2m ago"), and an unread count badge. When a new message arrives, that conversation bumps to the top of the list. Clicking navigates to the full conversation.

**What You'll See When It's Done:**
Claude Code will create 2 new component files and integrate the panel into the sidebar.

**How Long This Typically Takes:** 10–15 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 6, Prompt 18.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 18 (search for "## Prompt 18:")

Read these context files:
- docs/reference/communications.md lines 29–55 (MVP Scope — Chat Quick Panel as unified feed)
- apps/web/src/data/threads.ts (listThreadsForUser from Unit 1)
- apps/web/src/components/thread/RecordThreadPanel.tsx (navigation target for record threads)
- apps/web/src/components/chat/DMConversation.tsx (navigation target for DMs)
- apps/web/src/components/sidebar/ (sidebar for Quick Panel slot)

Tasks:

1. Create `apps/web/src/components/chat/ChatQuickPanel.tsx`:
   - Unified conversation feed in sidebar Quick Panel area
   - Shows all conversations (Record Threads + DMs + Group DMs) sorted by recency
   - Uses listThreadsForUser from Unit 1
   - Real-time: new messages bump conversation to top
   - Click: Record Thread → opens RecordThreadPanel; DM → opens DMConversation

2. Create `apps/web/src/components/chat/ChatQuickPanelItem.tsx`:
   - Avatar (user for DM, group icon for group DM, record icon for record thread)
   - Name/record title
   - Last message preview (truncated ~60 chars)
   - Timestamp (relative: "2m", "1h", "Yesterday")
   - Unread count badge (teal circle)

3. Integrate ChatQuickPanel into sidebar Quick Panel area.

4. Write tests: Sorted by recency. Unread badge accuracy. Click navigation. Real-time reordering on new message.

Acceptance criteria:
- [ ] Chat Quick Panel shows all conversations sorted by recency
- [ ] Each preview: avatar, name/title, last message, timestamp, unread badge
- [ ] Click navigates to Record Thread panel or DM view
- [ ] Real-time: new messages bump conversation to top
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: Inline reply in Quick Panel (post-MVP), conversation search (post-MVP).

Commit with: `feat(chat): Chat Quick Panel unified conversation feed [Phase 3C, Prompt 18]`
```

[CHECKPOINT]
```
Look for:
- ChatQuickPanel.tsx and ChatQuickPanelItem.tsx in components/chat/
- Integration into sidebar
- TypeScript compiles with zero errors
```

---

#### PROMPT 19: PresenceIndicator + CustomStatusEditor + usePresence Hook

**What This Builds:**
This creates the presence indicators — colored dots on user avatars that show who's online (green), away (yellow), in DND mode (red with minus icon), or offline (gray). It also creates the custom status editor where users can set a status with an emoji and text (like "🏖️ On vacation") with auto-clear options, and the hook that manages presence state. Presence indicators appear on avatars throughout the workspace: sidebar user list, @mention dropdown, DM list, and thread participants.

**What You'll See When It's Done:**
Claude Code will create 4 new component files, a hook, and integrate presence dots into existing avatar components.

**How Long This Typically Takes:** 12–18 minutes

[PASTE INTO CLAUDE CODE]
```
You are the Build Agent for EveryStack Phase 3C, Unit 6, Prompt 19.

Read the playbook section:
- docs/Playbooks/playbook-phase-3c.md — Prompt 19 (search for "## Prompt 19:")

Read these context files:
- docs/reference/communications.md lines 148–182 (Pinned, Bookmarks & Presence — presence states, custom status, DND indicator, where presence shows)
- apps/realtime/src/services/presence-service.ts (PresenceService from Unit 3)
- apps/web/src/data/presence.ts (custom status data from Unit 3)
- apps/web/src/components/chat/EmojiPicker.tsx (EmojiPicker from Unit 4 — reuse)

Tasks:

1. Create `apps/web/src/components/presence/use-presence.ts` — usePresence(tenantId, roomId?):
   - Subscribes to Socket.IO presence:update events
   - Sends heartbeat every 30s via presence:heartbeat
   - Tracks idle state (5min → 'away')
   - Returns { presenceMap, myStatus }

2. Create `apps/web/src/components/presence/PresenceIndicator.tsx`:
   - Colored dot: online (green), away (yellow), DND (red + minus), offline (gray)
   - Sizes: small (8px, lists), medium (10px, avatars), large (12px, profiles)
   - Props: { userId, size?, className? } — reads from usePresence context

3. Create `apps/web/src/components/presence/CustomStatusDisplay.tsx`:
   - Emoji + text next to user name. Truncates long text.

4. Create `apps/web/src/components/presence/CustomStatusEditor.tsx`:
   - Emoji picker (reuse EmojiPicker from Unit 4) + text input
   - Auto-clear: 1 hour, 4 hours, Today, This week, Custom date
   - Save → updateCustomStatus server action. Clear button.

5. Integrate presence indicators into existing avatar components: sidebar user list, @mention dropdown, DM list, thread participants.

6. Write tests: Dot colors per state. Heartbeat interval. Idle detection (5min). Custom status set/clear. Auto-clear expiry. Presence map update on Socket.IO.

Acceptance criteria:
- [ ] [CONTRACT] NotificationBell, NotificationTray, NotificationItem, NotificationGroup exported from components/notifications/
- [ ] [CONTRACT] useNotifications exported from use-notifications.ts
- [ ] [CONTRACT] ChatQuickPanel, ChatQuickPanelItem exported from components/chat/
- [ ] [CONTRACT] PresenceIndicator exported from components/presence/
- [ ] [CONTRACT] CustomStatusDisplay, CustomStatusEditor exported from components/presence/
- [ ] [CONTRACT] usePresence exported from use-presence.ts
- [ ] Presence dot: green/yellow/red/gray on avatar
- [ ] Real-time presence updates
- [ ] Custom status: emoji picker + text + auto-clear (1h, 4h, today, this week, custom)
- [ ] Custom status shows in sidebar, @mention, DM list
- [ ] ≥80% line coverage
- [ ] ESLint and TypeScript compile with zero errors

Do NOT build: DND full suppression UI (post-MVP), cursor broadcasting (post-MVP).

Commit with: `feat(presence): indicator, custom status editor, usePresence hook [Phase 3C, Prompt 19]`
```

[CHECKPOINT]
```
Look for:
- 4 files in apps/web/src/components/presence/
- use-presence.ts hook
- Presence dots integrated into existing avatar components
- TypeScript compiles with zero errors
```

---

### VERIFY SESSION F — Unit 6, Prompts 17–19 — Completes Unit 6 — Completes Phase 3C

**What This Step Does:**
"This runs the full test suite against everything Unit 6 built. It also checks that Unit 6 produced everything it promised. This is the final verification for Phase 3C."

Close the BUILD session. Open a fresh Claude Code session. Paste:

[PASTE INTO CLAUDE CODE]
```
Read these skill files:
- docs/skills/verify/SKILL.md
- docs/skills/test-runner/SKILL.md

Run the full verification suite for Phase 3C Prompts 17–19 (Unit 6: Notification UI & Chat Quick Panel):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met (≥80% on components, ≥90% on data layer)
6. Manual verification:
   - Notification bell in workspace header with real-time badge
   - Click bell → tray opens with grouped notifications
   - Chat Quick Panel in sidebar with conversation list
   - Presence dots on user avatars
   - Custom status set/clear flow

Interface contract verification (Unit 6):
- [ ] [CONTRACT] NotificationBell, NotificationTray, NotificationItem, NotificationGroup from `apps/web/src/components/notifications/`
- [ ] [CONTRACT] useNotifications from `apps/web/src/components/notifications/use-notifications.ts`
- [ ] [CONTRACT] ChatQuickPanel, ChatQuickPanelItem from `apps/web/src/components/chat/`
- [ ] [CONTRACT] PresenceIndicator, CustomStatusDisplay, CustomStatusEditor from `apps/web/src/components/presence/`
- [ ] [CONTRACT] usePresence from `apps/web/src/components/presence/use-presence.ts`

Fix any failures. Commit fixes.
```

[CHECKPOINT]
```
All checks must pass with zero errors.
All [CONTRACT] items must be verified.
Phase 3C is complete — all 6 units delivered.
```

[GIT COMMAND]
```
git add -A
git commit -m "chore(verify): verify prompts 17–19, unit 6 complete [Phase 3C, VP-6]"
git push origin build/3c-comms
```

[STATE UPDATE]
```
Open TASK-STATUS.md. Update Unit 6 to `passed-review`.
Open MODIFICATIONS.md. Add a session block:

## Session F — Phase 3C — build/3c-comms

**Date:** [today]
**Status:** passed-review
**Prompt(s):** Prompts 17–19 (Unit 6: Notification UI & Chat Quick Panel)

### Files Created
- [list from what Claude Code created]

### Files Modified
- [list from what Claude Code modified]

### Schema Changes
- None

### New Domain Terms Introduced
- [any new terms, or "None"]
```

---

### FINAL — Open Pull Request

[GIT COMMAND]
```
git push origin build/3c-comms
```

Open PR titled **"[Step 3] Phase 3C — Record Thread, DMs, Notifications & System Email"**.

List all units completed and their deliverables:
- **Unit 1:** Schema Migration & Thread/Message Data Layer — source_note_id migration, thread/message/participant/saved CRUD, DM helpers, factories, server actions
- **Unit 2:** Notification Pipeline & System Email — NotificationService, BullMQ queue, Resend email service, React Email templates, notification preferences
- **Unit 3:** Presence & Real-Time Chat Infrastructure — PresenceService, ChatHandler, PresenceHandler, NotificationHandler, Redis pub/sub publishers
- **Unit 4:** Chat Editor (TipTap Env 1) — ChatEditor (3 states), ChatEditorToolbar, MentionDropdown, EmojiPicker, EmojiReactions, MessageRenderer, MessageItem
- **Unit 5:** Record Thread & DM UI — RecordThreadPanel, thread tabs/lenses, message list, replies, search, typing indicator, DM views, Record View integration
- **Unit 6:** Notification UI & Chat Quick Panel — NotificationBell, NotificationTray, ChatQuickPanel, PresenceIndicator, CustomStatusEditor

[DECISION POINT]
```
If PR looks good: → Merge (squash). Delete branch. Proceed to Step 4.
If something wrong: → Do NOT merge. Paste fix instructions into Claude Code.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does

"An independent Claude session reviews the build against acceptance criteria and verifies that every unit's interface contract was fulfilled."

### 4.1 — Generate the build diff

[GIT COMMAND]
```
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-3c-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open NEW Claude.ai session. Upload: playbook (`docs/Playbooks/playbook-phase-3c.md`), subdivision doc (`docs/subdivisions/3c-subdivision.md`), diff (`/tmp/phase-3c-diff.txt`), `CLAUDE.md`, `GLOSSARY.md`.

[PASTE INTO CLAUDE]
```
You are the Reviewer Agent for EveryStack Phase 3C (Record Thread, DMs, Notifications & System Email).

Review the attached build diff against the playbook acceptance criteria.

For each of the 6 units, verify:
1. All [CONTRACT] items from the playbook VERIFY SESSION are present in the diff
2. Acceptance criteria from each prompt are met
3. No scope violations (nothing built that's listed in "Do NOT Build")
4. Code follows CLAUDE.md conventions (tenant isolation, no raw SQL, Zod validation, no switch on field types, no console.log)
5. Test coverage requirements met (≥90% data layer, ≥80% components)

Output format:
- PASS or FAIL for each unit
- If FAIL: specific items that failed, with file paths and line references
- Overall verdict: PASS or FAIL

Units to review:
1. Schema Migration & Thread/Message Data Layer (Prompts 1–4)
2. Notification Pipeline & System Email (Prompts 5–7)
3. Presence & Real-Time Chat Infrastructure (Prompts 8–10)
4. Chat Editor — TipTap Env 1 (Prompts 11–13)
5. Record Thread & DM UI (Prompts 14–16)
6. Notification UI & Chat Quick Panel (Prompts 17–19)
```

[DECISION POINT]
```
If PASS: → Proceed to Step 5.
If FAIL: → Paste fix instructions into Claude Code. Re-run review after fixes.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

### What This Step Does

"Bring docs back into alignment after the build. The Docs Agent reads MODIFICATIONS.md to know exactly what changed."

### 5.1 — Create the fix branch

[GIT COMMAND]
```
git checkout main && git pull origin main
git checkout -b fix/post-3c-docs-sync
```

### 5.2 — Run the Docs Agent

[PASTE INTO CLAUDE CODE]
```
You are the Docs Agent for EveryStack, running after Phase 3C (Record Thread, DMs, Notifications & System Email).

Read MODIFICATIONS.md for the session blocks from Phase 3C builds (Sessions A through F).

Tasks:
1. Update MANIFEST.md: line counts for any modified reference docs, add new entries if docs were created
2. Update GLOSSARY.md: add any new domain terms introduced (check MODIFICATIONS.md "New Domain Terms")
3. Cross-reference check: ensure all new exports, types, and components referenced in docs match actual file paths
4. Archive completed MODIFICATIONS.md sessions (move to archive section)
5. Update TASK-STATUS.md: all 6 units → `docs-synced`
6. Update docs/skills/phase-context/SKILL.md with Phase 3C completion summary

Do NOT modify any source code files. Docs only.
```

### 5.3 — Review and merge

[CHECKPOINT]
```
Review diff. Look for:
- MANIFEST line counts match actual file sizes
- No stale cross-references
- No new terms missing from GLOSSARY
- MODIFICATIONS.md sessions archived
- TASK-STATUS.md units show `docs-synced`
```

[GIT COMMAND]
```
git add -A
git commit -m "docs: post-Phase-3C docs sync (MANIFEST, GLOSSARY, cross-refs, state files)"
git push origin fix/post-3c-docs-sync
```

Open PR titled **"[Step 5] Phase 3C — Post-Build Docs Sync"**. Review. Merge. Delete branch.

### 5.4 — Tag if milestone

[DECISION POINT]
```
Phase 3C completes the communications backbone. Consider tagging:
  git tag -a v0.3.0-phase-3c -m "Phase 3C: Record Thread, DMs, Notifications & System Email"
  git push origin v0.3.0-phase-3c

If not a milestone tag: → Skip.
```

---

## NEXT SUB-PHASE

Phase 3C is complete. The MVP communications backbone is delivered: contextual Record Threads, DMs, notifications, presence, and the Chat Quick Panel.

Next: **Phase 3D** (Smart Docs & Document Templates).

Return to Step 0 for Phase 3D.
