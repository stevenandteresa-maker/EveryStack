# Task Status

Checklist of subdivision units per sub-phase. Provides orientation for
every agent session — each session starts by reading this file to know
what's done, what's in progress, and what's blocked.

## How to Use This File

**Who writes:** Planner (creates initial checklist when subdivision docs
are produced), Build Agent (updates status during Step 3), Reviewer Agent
(updates status after Step 4 verdict), Docs Agent (marks docs-synced
after Step 5).
**Who reads:** All agents at session start.
**When to update:** At every status transition — when a unit moves from
pending to in-progress, from in-progress to review, from review to
passed/failed, and from passed to docs-synced.

### Status Values

| Status | Meaning | Set By |
|---|---|---|
| `pending` | Not yet started | Planner |
| `in-progress` | Build session active | Build Agent |
| `passed-review` | Review verdict: PASS | Reviewer Agent |
| `failed-review` | Review verdict: FAIL (needs retry) | Reviewer Agent |
| `blocked` | Waiting on a dependency or decision | Any agent |
| `docs-synced` | Step 5 complete, fully done | Docs Agent |

### Sub-Phase Block Format

```
## [Sub-Phase ID] — [Sub-Phase Name]

**Started:** YYYY-MM-DD
**Completed:** YYYY-MM-DD (or "In progress")

### Subdivision Units

- [ ] **Unit 1: [Name]** — `pending`
  - Produces: [interface contract — what this unit outputs]
  - Consumes: [what it needs from prior units, or "None — first unit"]
  - Branch: (filled when build starts)
  - Notes: (optional)

- [x] **Unit 2: [Name]** — `docs-synced`
  - Produces: [interface contract]
  - Consumes: Unit 1 outputs
  - Branch: `build/3a-unit-2-name`
  - Notes: Completed 2025-01-15

- [ ] **Unit 3: [Name]** — `blocked`
  - Produces: [interface contract]
  - Consumes: Unit 2 outputs
  - Branch:
  - Notes: Blocked on DECISIONS.md entry re: [topic]
```

### Completion Criteria

A sub-phase is complete when ALL units show `docs-synced` status.

### Handling Failed Reviews

When a unit moves to `failed-review`:

1. The Reviewer Agent adds the failure reason in Notes.
2. The Planner assesses whether sibling or downstream units need
   context adjustments (replanning).
3. The unit returns to `in-progress` when the Build Agent retries.
4. If a failure affects downstream units, those move to `blocked`
   with a note referencing the failed unit.

---

## Active Sub-Phases

### 3D — Document Templates & PDF Generation

**Started:** 2026-03-16
**Completed:** In progress

#### Subdivision Units

- [x] **Unit 1: Document Template Data Layer** — `passed-review`
  - Produces: `getDocumentTemplate()`, `listDocumentTemplates()`, `getGeneratedDocument()`, `listGeneratedDocuments()` data functions; `createDocumentTemplate`, `updateDocumentTemplate`, `duplicateDocumentTemplate`, `deleteDocumentTemplate` server actions; `DocumentTemplate`, `GeneratedDocument` types; Zod schemas; test factories
  - Consumes: None — first unit
  - Branch: `build/3d-document-templates`
  - Notes: Prompts 1–2 complete. Verified 2026-03-16. All 6 interface contracts confirmed. 2471 tests pass, zero lint/type errors.

- [x] **Unit 2: TipTap Environment 2 Editor Core** — `passed-review`
  - Produces: `SmartDocEditor`, `useSmartDocEditor()` hook; `smartDocExtensions` bundle; custom nodes (`MergeTag`, `RecordRef`, `Callout`); `SlashCommand` extension + list; `EditorToolbar`, `BubbleToolbar`, `BlockHandle`
  - Consumes: None — no unit dependencies (uses TipTap libraries + Env 1 patterns)
  - Branch: `build/3d-document-templates`
  - Notes: Prompts 3–5 complete. Verified 2026-03-17. All 14 interface contracts confirmed. 2551 tests pass, zero lint/type errors.

- [x] **Unit 3: Merge-Tag Resolution & Field Inserter** — `passed-review`
  - Produces: `resolveMergeTags()`, `resolveAndRenderHTML()` resolution functions; `MergeTagInserter` sidebar component; `useMergeTagFields()` hook; `PreviewToggle` component; `MergeTagField` type
  - Consumes: Unit 1 `DocumentTemplate` type; 3B-i cross-link resolution; 3A-iii field permissions
  - Branch: `build/3d-document-templates`
  - Notes: Prompts 6–7 complete. Verified 2026-03-19. All 9 interface contracts confirmed. 123 editor tests pass, zero lint/type errors.

- [ ] **Unit 4: PDF Generation Pipeline** — `in-progress`
  - Produces: `PDFRenderer`, `GotenbergClient`; `processDocumentGeneration` BullMQ processor; `enqueueDocumentGeneration()`, `generateDocument` server action; `document-generation` queue registration
  - Consumes: Unit 1 types + factories, Unit 3 `resolveMergeTags()`, StorageClient from 1G
  - Branch: `build/3d-document-templates`
  - Notes: Started 2026-03-19

- [ ] **Unit 5: Template Management & Document Generation UI** — `pending`
  - Produces: `DocumentTemplateListPage`, `DocumentTemplateEditor`, `GenerateDocumentDialog`, `GenerateDocumentButton`, `GeneratedDocumentList` components; `useDocumentGeneration()` hook; document routes
  - Consumes: Unit 1 data + actions, Unit 2 editor, Unit 3 inserter + preview, Unit 4 generation action
  - Branch:
  - Notes:

---

## Completed Sub-Phases

### 3C — Record Thread, DMs, Notifications & System Email

**Started:** 2026-03-15
**Completed:** 2026-03-16
**Docs synced:** 2026-03-16

#### Subdivision Units

- [x] **Unit 1: Schema Migration & Thread/Message Data Layer** — `docs-synced`
  - Produces: `source_note_id` migration; thread/message/participant/bookmark/pin CRUD functions; DM/Group DM creation; `searchThreadMessages()`; server actions; `Thread`, `ThreadMessage`, `ThreadParticipant` types; test factories
  - Consumes: None — first unit. Uses existing Drizzle schema (threads, thread_messages, thread_participants, user_saved_messages)
  - Branch: `build/3c-comms`
  - Notes: Prompts 1–4 complete. Verified 2026-03-15.

- [x] **Unit 2: Notification Pipeline & System Email** — `docs-synced`
  - Produces: `NotificationService.create()` with delivery routing; notification CRUD; notification preferences CRUD; BullMQ `notification` queue + email send/cleanup processors; `ResendEmailService`; React Email templates (invitation, system alert, client thread reply); `Notification`, `NotificationPreferences` types
  - Consumes: Unit 1 `Thread`, `ThreadMessage` types
  - Branch: `build/3c-comms`
  - Notes: Prompts 5–7 complete. Verified 2026-03-15.

- [x] **Unit 3: Presence & Real-Time Chat Infrastructure** — `docs-synced`
  - Produces: `PresenceService` (Redis heartbeat, state management); Socket.IO handlers (ChatHandler, PresenceHandler, NotificationHandler); Redis pub/sub chat event subscriber; `publishChatEvent()`, `publishNotificationEvent()`; custom status CRUD; `PresenceState`, `ChatEvent` types
  - Consumes: Unit 1 `Thread`, `ThreadMessage` types
  - Branch: `build/3c-comms`
  - Notes: Prompts 8–10 complete. Verified 2026-03-15. All 8 contracts verified, 4585 tests pass.

- [x] **Unit 4: Chat Editor (TipTap Environment 1)** — `docs-synced`
  - Produces: `ChatEditor` (3 input states, progressive disclosure); `ChatEditorToolbar`; `MentionDropdown`; `EmojiPicker`; `EmojiReactions`; `MessageRenderer`; `MessageItem`; `ChatAttachmentButton`; `useChatEditor()` hook; TipTap extension config
  - Consumes: None — no unit dependencies. Uses TipTap, emoji-mart, shadcn/ui libraries
  - Branch: `build/3c-comms`
  - Notes: Prompts 11–13 complete. Verified 2026-03-16. All 4 contracts verified, 2301 tests pass.

- [x] **Unit 5: Record Thread & DM UI** — `docs-synced`
  - Produces: `RecordThreadPanel`; `ThreadTabBar` (Team Notes / Client Messages); `ThreadLensBar` (All/Notes/Activity/Files); `ThreadMessageList`; `ThreadReplyPanel`; `ThreadSearchBar`; `SharedNoteMessage`; `ClientVisibleBanner`; `PinnedMessagesPanel`; `ThreadNavDropdown`; `DMConversation`; `GroupDMHeader`; `useThread()`, `useThreadSearch()`, `useTypingIndicator()` hooks
  - Consumes: Unit 1 data functions + actions, Unit 3 real-time events + publish functions, Unit 4 ChatEditor + MessageItem + EmojiReactions
  - Branch: `build/3c-comms`
  - Notes: Prompts 14–16 complete. Verified 2026-03-16. All 5 contracts verified, 2385 tests pass.

- [x] **Unit 6: Notification UI & Chat Quick Panel** — `docs-synced`
  - Produces: `NotificationBell`; `NotificationTray`; `NotificationItem`; `NotificationGroup`; `useNotifications()` hook; `ChatQuickPanel`; `ChatQuickPanelItem`; `PresenceIndicator`; `CustomStatusDisplay`; `CustomStatusEditor`; `usePresence()` hook
  - Consumes: Unit 2 notification data + actions, Unit 3 real-time events + presence, Unit 5 DM navigation target + thread list
  - Branch: `build/3c-comms`
  - Notes: Prompts 17–19 complete. Verified 2026-03-16. All 5 contracts verified, 2440 tests pass.

### 3B-ii — Schema Descriptor Service & Command Bar

**Started:** 2026-03-14
**Completed:** 2026-03-15
**Docs synced:** 2026-03-15

#### Subdivision Units

- [x] **Unit 1: SDS Types & Core Builders** — `docs-synced`
  - Produces: `WorkspaceDescriptor`, `BaseDescriptor`, `TableDescriptor`, `FieldDescriptor`, `LinkEdge` types; `mapFieldToDescriptor()`, `buildTableDescriptor()`, `buildWorkspaceDescriptor()` — from `packages/shared/ai/schema-descriptor/`
  - Consumes: None — first unit. Uses existing FieldTypeRegistry, Drizzle schema, cross-link types from 3B-i
  - Branch: `build/3b-ii-sds-command-bar`
  - Notes: Docs synced 2026-03-15.

- [x] **Unit 2: SDS Permission Filter, Caching & Service Facade** — `docs-synced`
  - Produces: `filterDescriptorByPermissions()`, `computeSchemaVersionHash()`, `SchemaDescriptorCache` class, `estimateTokens()`, `condenseDescriptor()`, `SchemaDescriptorService` class with `describeWorkspace()`, `describeTable()`, `describeLinks()` — from `packages/shared/ai/schema-descriptor/`
  - Consumes: Unit 1 types + builder functions
  - Branch: `build/3b-ii-sds-command-bar`
  - Notes: MODIFICATIONS.md Session B only covered permission-filter; cache, schema-hash, token-estimator, and service files were built in a later session not logged. Docs synced 2026-03-15.

- [x] **Unit 3: Command Bar Search & Navigation Data Layer** — `docs-synced`
  - Produces: `searchRecords()`, `searchTablesAndViews()`, `getCommandRegistry()`, `trackRecentItem()`, `getRecentItems()` data functions; `SearchResult`, `NavigationResult`, `CommandEntry`, `RecentItem` types — from `apps/web/src/data/` and `apps/web/src/lib/command-bar/`
  - Consumes: None — parallel with Units 1–2. Uses existing DB schema, tsvector indexes, permission utilities
  - Branch: `build/3b-ii-sds-command-bar`
  - Notes: Parallel with Units 1–2. All 7 contracts verified 2026-03-14. Docs synced 2026-03-15.

- [x] **Unit 4: Command Bar UI & AI Search Channel** — `docs-synced`
  - Produces: `CommandBar`, `CommandBarProvider`, `CommandBarSearchResults`, `CommandBarSlashMenu`, `CommandBarAIChannel`, `CommandBarRecentItems` components; `useCommandBar()` hook; `executeSlashCommand()`, `aiSearchQuery()` server actions — from `apps/web/src/components/command-bar/` and `apps/web/src/actions/`
  - Consumes: Unit 2 `SchemaDescriptorService` + token estimator, Unit 3 search/command/recent data functions
  - Branch: `build/3b-ii-sds-command-bar`
  - Notes: All 9 contracts verified. All 7 cross-unit integrations verified. 2077 tests pass. 2026-03-14. Docs synced 2026-03-15.

### 3B-i — Cross-Linking Engine

**Started:** 2026-03-13
**Completed:** 2026-03-14
**Docs synced:** 2026-03-14

#### Subdivision Units

- [x] **Unit 1: Cross-Link Types, Validation Schemas & Registry** — `docs-synced`
  - Produces: `RelationshipType`, `LinkScopeFilter`, `CrossLinkFieldValue`, `CROSS_LINK_LIMITS` types/constants; `createCrossLinkSchema`, `updateCrossLinkSchema`, `linkScopeFilterSchema` Zod schemas; `linked_record` FieldTypeRegistry registration; `extractCrossLinkField()`, `setCrossLinkField()` utilities — all from `packages/shared/sync/cross-link-*.ts`
  - Consumes: None — first unit. Uses existing `FieldTypeRegistry`, Drizzle schema types
  - Branch: `build/3b-i-cross-linking`
  - Notes:

- [x] **Unit 2: Cross-Link Definition CRUD & Record Linking** — `docs-synced`
  - Produces: `createCrossLinkDefinition`, `updateCrossLinkDefinition`, `deleteCrossLinkDefinition`, `linkRecords`, `unlinkRecords` server actions; `getCrossLinkDefinition`, `listCrossLinkDefinitions`, `getCrossLinksByTarget`, `validateLinkTarget`, `checkCrossLinkPermission` data functions; `createTestCrossLinkWithIndex` factory
  - Consumes: Unit 1 types, schemas, utilities
  - Branch: `build/3b-i-cross-linking`
  - Notes:

- [x] **Unit 3: Query-Time Resolution & Permission Intersection** — `docs-synced`
  - Produces: `resolveLinkedRecordsL0`, `resolveLinkedRecordsL1`, `resolveLinkedRecordsL2` resolution functions; `LinkedRecordTree` type; `resolveLinkedRecordPermissions`, `filterLinkedRecordByPermissions` permission functions — from `apps/web/src/data/cross-link-resolution.ts`
  - Consumes: Unit 1 types + utilities, Unit 2 `getCrossLinkDefinition()`
  - Branch: `build/3b-i-cross-linking`
  - Notes: Parallel with Units 4 and 5

- [x] **Unit 4: Display Value Cascade & Scalability Infrastructure** — `docs-synced`
  - Produces: `cross-link` BullMQ queue + job types; `processCrossLinkCascade`, `processIndexRebuild` processors; `enqueueCascadeJob`, `checkCascadeBackpressure` helpers; `scheduleIntegrityCheck` — from `apps/worker/src/processors/cross-link/`
  - Consumes: Unit 1 types + utilities, Unit 2 cross-link index data
  - Branch: `build/3b-i-cross-linking`
  - Notes: Parallel with Units 3 and 5

- [x] **Unit 5: Link Picker UI** — `docs-synced`
  - Produces: `LinkPicker`, `LinkPickerProvider`, `LinkedRecordChip`, `LinkPickerSearchResults`, `LinkPickerInlineCreate` components; `useLinkPicker` hook; `searchLinkableRecords`, `getRecentLinkedRecords` data functions — from `apps/web/src/components/cross-links/`
  - Consumes: Unit 1 types, Unit 2 CRUD actions, Unit 3 permission resolution
  - Branch: `build/3b-i-cross-linking`
  - Notes: Prompts 11–12 complete. All contracts verified. Phase 3B-i fully passed review 2026-03-14. Docs synced 2026-03-14.

### 3A-iii — Field-Level Permissions: Model, Resolution & Config UI

**Started:** 2026-03-12
**Completed:** 2026-03-13
**Docs synced:** 2026-03-13

#### Subdivision Units

- [x] **Unit 1: Permission Types & Resolution Engine** — `docs-synced`
  - Produces: `FieldPermissionState`, `ViewPermissions`, `ViewFieldPermissions`, `RoleRestriction`, `IndividualOverride`, `FieldPermissionMap`, `ResolvedPermissionContext` types; `viewPermissionsSchema`, `fieldPermissionsSchema` Zod schemas; `resolveFieldPermission()`, `resolveAllFieldPermissions()` pure functions — all from `packages/shared/auth/permissions/`
  - Consumes: None — first unit. Uses existing `EffectiveRole`, `roleAtLeast()` from `packages/shared/auth/`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 2: Data Layer — resolveFieldPermissions() + Redis Cache** — `docs-synced`
  - Produces: `getFieldPermissions()`, `invalidatePermissionCache()`, `PERMISSION_CACHE_KEY_PATTERN`, `PERMISSION_CACHE_TTL` from `apps/web/src/data/permissions.ts`; `createTestViewWithPermissions()` factory
  - Consumes: Unit 1 types + resolution functions
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 3: Action Layer — Permission Enforcement + Audit Logging** — `docs-synced`
  - Produces: `checkFieldPermission()`, `checkFieldPermissions()`, `filterHiddenFields()`, `logPermissionDenial()` from `apps/web/src/lib/auth/field-permissions.ts`; updated `updateRecord`, `bulkUpdateRecords` server actions
  - Consumes: Unit 1 types, Unit 2 `getFieldPermissions()`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 4: Real-Time Invalidation** — `docs-synced`
  - Produces: `REALTIME_EVENTS.PERMISSION_UPDATED`, `PermissionUpdatedPayload`, `publishPermissionUpdate()`, `handlePermissionUpdated` client handler
  - Consumes: Unit 2 `invalidatePermissionCache()`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 5: Grid/View Permission-Aware Rendering** — `docs-synced`
  - Produces: `useFieldPermissions()` hook, `PermissionProvider` context, `usePermission()` hook; updated `DataGrid`, `GridCell`, `RecordView`, `CardView`, `BulkActionsToolbar` with permission filtering
  - Consumes: Unit 1 types, Unit 2 `getFieldPermissions()`, Unit 4 `handlePermissionUpdated`
  - Branch: `build/3a-iii-field-permissions`

- [x] **Unit 6: Permission Configuration UI** — `docs-synced`
  - Produces: `RoleLevelPermissionGrid`, `IndividualOverrideView`, `PermissionConfigPanel`, `PermissionStateBadge` components; `updateViewPermissions()`, `updateFieldGlobalPermissions()` server actions
  - Consumes: Unit 1 types + schemas, Unit 2 data access + cache, Unit 4 `publishPermissionUpdate()`, Unit 5 `PermissionProvider`
  - Branch: `build/3a-iii-field-permissions`
