# Modifications Manifest

Per-session changelog of files created, modified, and deleted during builds.
This file bridges the Build Agent (Step 3) and Docs Agent (Step 5) — it
replaces the need to reconstruct changes from `git diff` after the fact.

## How to Use This File

**Who writes:** Build Agent (Step 3), at the end of each build session.
**Who reads:** Reviewer Agent (Step 4) to cross-check the diff, Docs Agent
(Step 5) to drive MANIFEST updates and glossary scans, Planner to assess
completed work.
**When to write:** After each build session completes (whether it passes
review or not). Append a new session block.
**When to reset:** After Step 5 (Docs Sync) merges, the Docs Agent moves
completed session blocks to an archive section at the bottom. The active
section always shows only unsynced sessions.

### Session Block Format

```
## [Session ID] — [Sub-phase ID] — [Branch Name]

**Date:** YYYY-MM-DD
**Status:** built | passed-review | failed-review | docs-synced
**Prompt(s):** [Which playbook prompt(s) this session executed]

### Files Created
- `path/to/new-file.ts` — [1-line description of what it is]

### Files Modified
- `path/to/existing-file.ts` — [1-line description of what changed]

### Files Deleted
- `path/to/removed-file.ts` — [1-line reason for removal]

### Schema Changes
- Added table: `table_name` — [1-line description]
- Added column: `table_name.column_name` — [type, purpose]
- Modified column: `table_name.column_name` — [what changed]

### New Domain Terms Introduced
- `TermName` — [brief definition, for Docs Agent to add to GLOSSARY.md]

### Notes
[Any context the Docs Agent or next session needs. Optional.]
```

### Status Transitions

```
built → passed-review → docs-synced (happy path)
built → failed-review → built (retry after fixes)
```

---

## Active Sessions

(No active sessions)

---

## Archive

<!-- Docs Agent moves completed (docs-synced) session blocks here
     during Step 5, newest first. This keeps the active section
     focused on unsynced work. -->

## Session F — Phase 3D — build/3d-document-templates

**Date:** 2026-03-19
**Status:** docs-synced
**Prompt(s):** Prompts 10–11 (Unit 5: Template Management & Document Generation UI)

### Files Created
- `apps/web/src/app/(app)/[workspaceId]/documents/page.tsx` — Document templates list route page (Server Component, Suspense + skeleton, loads all templates via `listAllDocumentTemplates`)
- `apps/web/src/app/(app)/[workspaceId]/documents/[templateId]/page.tsx` — Template editor route page (Server Component, loads template + table, 404 on missing)
- `apps/web/src/app/(app)/[workspaceId]/documents/new/page.tsx` — New template wizard route page (Server Component, loads workspace tables)
- `apps/web/src/components/documents/DocumentTemplateListPage.tsx` — Client component: grid of TemplateCards, empty state, "New Template" button, optimistic duplicate/delete
- `apps/web/src/components/documents/TemplateCard.tsx` — Card component: name, table badge, date, creator, version, dropdown (Duplicate/Delete with confirmation dialog)
- `apps/web/src/components/documents/DocumentTemplateEditorPage.tsx` — Page wrapper: back button, editable name (debounced 1s save), table badge
- `apps/web/src/components/documents/DocumentTemplateEditor.tsx` — Editor: SmartDocEditor with EditorToolbar + PreviewToggle (top), MergeTagInserter (sidebar), 3s debounced auto-save with status indicator
- `apps/web/src/components/documents/NewDocumentTemplateWizard.tsx` — Wizard Create: name input → table select → create & redirect to editor
- `apps/web/src/components/documents/GenerateDocumentButton.tsx` — Record View header icon button, hidden when no templates, opens GenerateDocumentDialog
- `apps/web/src/components/documents/GenerateDocumentDialog.tsx` — Modal: template selector → "Generate PDF" → progress spinner → success download / error retry
- `apps/web/src/components/documents/GeneratedDocumentList.tsx` — Record's generated PDFs: template name, date, generator, AI badge, download link, empty state
- `apps/web/src/components/documents/use-document-generation.ts` — `useDocumentGeneration()` hook: polls `getDocumentGenerationStatus` every 2s, stops on terminal state

### Files Modified
- `apps/web/src/data/document-templates.ts` — Added `DocumentTemplateListItem` type (extends with tableName), `listAllDocumentTemplates()` function (cross-table, joins tables + users)
- `apps/web/src/actions/document-generation.ts` — Added `getGeneratedDocumentUrl()` server action (tenant-scoped URL fetch for generated docs)
- `apps/web/src/components/record-view/RecordViewHeader.tsx` — Added `documentTemplates`, `recordId`, `onDocumentGenerated` props; renders GenerateDocumentButton before chat icon
- `apps/web/messages/en.json` — Added `documentTemplates` namespace (list, editor, wizard keys), `documentGeneration` namespace (dialog, progress, status keys), `record_view.tab_documents` key
- `apps/web/messages/es.json` — Added `documentTemplates` namespace (Spanish), `documentGeneration` namespace (Spanish), `record_view.tab_documents` key

### Files Deleted
(None)

### Schema Changes
(None — uses existing `document_templates` and `generated_documents` tables from Unit 1)

### New Domain Terms Introduced
- `DocumentTemplateListItem` — Extended type adding `tableName` for cross-table template listing
- `GeneratedDocumentItem` — Client-side type for displaying generated PDFs in the list

### Notes
- Verification fix: hardcoded "AI" string in GeneratedDocumentList replaced with `t('aiDrafted')` i18n key
- Auto-save uses two debounce timers: 3s for content (DocumentTemplateEditor), 1s for name (DocumentTemplateEditorPage)
- GenerateDocumentDialog uses server actions exclusively (no direct data function imports from client components)
- `useDocumentGeneration` stops polling on completed/failed/unknown states and cleans up interval on unmount
- All 12 interface contracts verified. 2622 tests pass. Zero lint/type errors.

---

## Session E — Phase 3D — build/3d-document-templates

**Date:** 2026-03-19
**Status:** docs-synced
**Prompt(s):** Prompts 3–5 (Unit 2: TipTap Env 2 Editor Core — Extension Config, Custom Nodes, Editor Shell, Toolbar & Menus)

### Files Created
- `apps/web/src/components/editor/extensions/index.ts` — Smart Doc extension bundle: StarterKit, Underline, Highlight, Link, Image, Table, CodeBlockLowlight, TaskList/TaskItem, Placeholder, Typography, CharacterCount, TextAlign, Color/TextStyle, + custom nodes (MergeTag, RecordRef, Callout, SlashCommand)
- `apps/web/src/components/editor/extensions/merge-tag/merge-tag.ts` — MergeTag custom inline atom node (attrs: tableId, fieldId, fallback)
- `apps/web/src/components/editor/extensions/merge-tag/merge-tag-view.tsx` — MergeTag React NodeView (teal pill)
- `apps/web/src/components/editor/extensions/record-ref/record-ref.ts` — RecordRef custom inline atom node (attrs: tableId, recordId, displayText)
- `apps/web/src/components/editor/extensions/record-ref/record-ref-view.tsx` — RecordRef React NodeView (inline chip with record icon)
- `apps/web/src/components/editor/extensions/callout/callout.ts` — Callout custom block node (attrs: emoji, color) with 4 variants (info/warning/success/error)
- `apps/web/src/components/editor/extensions/callout/callout-view.tsx` — Callout React NodeView (colored admonition with clickable emoji to cycle variant)
- `apps/web/src/components/editor/extensions/slash-command/slash-command.ts` — SlashCommand extension with suggestion plugin, popup positioning, keyboard navigation
- `apps/web/src/components/editor/extensions/slash-command/slash-command-list.tsx` — SlashCommandList forwardRef component with command items, keyboard selection, category grouping
- `apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx` — Block handle component for drag-to-reorder blocks
- `apps/web/src/components/editor/SmartDocEditor.tsx` — SmartDocEditor shell component with EditorContent, toolbar, bubble menu, block handles
- `apps/web/src/components/editor/use-smart-doc-editor.ts` — useSmartDocEditor() hook: editor instance management, content sync, destroy lifecycle
- `apps/web/src/components/editor/toolbar/EditorToolbar.tsx` — Fixed toolbar with formatting buttons, block type selector, alignment, insert actions
- `apps/web/src/components/editor/menus/BubbleToolbar.tsx` — Floating bubble menu for inline formatting on text selection
- `apps/web/src/components/editor/__tests__/extensions.test.ts` — 25 unit tests: extension bundle composition, config verification, MergeTag/RecordRef/Callout commands + HTML round-trip, formatting commands
- `apps/web/src/components/editor/__tests__/smart-doc-editor.test.tsx` — Tests for SmartDocEditor component rendering and integration
- `apps/web/src/components/editor/__tests__/use-smart-doc-editor.test.ts` — Tests for useSmartDocEditor hook lifecycle
- `apps/web/src/components/editor/__tests__/slash-command.test.ts` — Tests for SlashCommand extension and SlashCommandList

### Files Modified
- `package.json` — Added pnpm overrides pinning all @tiptap/* packages to 3.20.2 (3.20.3 ships source-only, no dist/ — breaks Vite resolution)
- `apps/web/package.json` — Added Env 2 TipTap extensions: highlight, image, table (+row/cell/header), code-block-lowlight, task-list/task-item, typography, character-count, text-align, color, text-style, code-block; added lowlight
- `pnpm-lock.yaml` — Updated lockfile
- `apps/web/src/components/editor/extensions/callout/callout.ts` — Added `?? 'info'` fallback for `noUncheckedIndexedAccess` compliance on variant cycling
- `apps/web/src/components/editor/extensions/callout/callout-view.tsx` — Added `?? 'info'` fallback for `noUncheckedIndexedAccess` compliance on variant cycling
- `apps/web/src/components/editor/__tests__/extensions.test.ts` — Cast TipTap JSON node types to `Record<string, unknown>` to fix `.attrs` property access on union type

### Files Deleted
(None)

### Schema Changes
(None — this session is UI/editor-only)

### New Domain Terms Introduced
(None — MergeTag, RecordRef, Callout, SmartDocEditor already defined in smart-docs.md)

### Notes
- TipTap v3.20.3 ships raw TypeScript source without pre-built dist/ files, causing Vite/Vitest resolution failures. All TipTap packages pinned to 3.20.2 via pnpm overrides in root package.json.
- StarterKit configured with `link: false, underline: false, codeBlock: false` to avoid duplicate extensions (Link, Underline configured separately with options; CodeBlock replaced by CodeBlockLowlight).
- Three typecheck fixes during verification: `noUncheckedIndexedAccess` requires fallback values for array index access; TipTap's `getJSON()` returns a union type that doesn't include `.attrs` on all branches.
- All 14 interface contracts verified: SmartDocEditor, useSmartDocEditor, createSmartDocExtensions, MergeTag, MergeTagView, RecordRef, RecordRefView, Callout, CalloutView, SlashCommand, SlashCommandList, EditorToolbar, BubbleToolbar, BlockHandle.

## Session C — Phase 3D — build/3d-document-templates

**Date:** 2026-03-19
**Status:** docs-synced
**Prompt(s):** Prompts 6–7 (Unit 3: Merge-Tag Resolution & Field Inserter)

### Files Created
- `apps/web/src/lib/editor/merge-resolver.ts` — Merge-tag resolution service: `formatCanonicalValue()` (20+ field types), `resolveMergeTags()` (deep-clone, walk, resolve simple + cross-linked fields), `resolveAndRenderHTML()` (resolve → generateHTML pipeline for PDF/portal)
- `apps/web/src/lib/types/document-templates.ts` — `MergeTagField` interface (fieldId, tableId, fieldName, fieldType, isLinked, crossLinkId)
- `apps/web/src/lib/editor/__tests__/merge-resolver.test.ts` — 18 tests for formatCanonicalValue, resolveMergeTags, resolveAndRenderHTML (field types, linked fields, fallbacks, immutability)
- `apps/web/src/components/editor/hooks/use-merge-tag-fields.ts` — `useMergeTagFields()` hook: fetches fields from source + cross-linked tables via API, filters excluded types (attachment/button/linked_record), returns `MergeTagFieldGroup[]`
- `apps/web/src/components/editor/sidebar/MergeTagInserter.tsx` — Sidebar component: searchable field list grouped by table, collapsible groups, click inserts MergeTag node at cursor
- `apps/web/src/components/editor/toolbar/PreviewToggle.tsx` — Edit/Preview/Raw mode toggle component + `usePreviewToggle()` hook managing content swapping (preview resolves merge tags, raw shows `{field_name}` text)
- `apps/web/src/app/api/editor/merge-tag-fields/route.ts` — POST endpoint: loads fields + cross-links for source table, filters hidden fields via permissions when viewId provided
- `apps/web/src/components/editor/__tests__/merge-tag-inserter.test.tsx` — 9 tests for MergeTagInserter (loading, groups, search, insert, collapse)
- `apps/web/src/components/editor/__tests__/preview-toggle.test.tsx` — 10 tests for PreviewToggle component + usePreviewToggle hook (modes, resolve, raw conversion, restore)
- `apps/web/src/components/editor/__tests__/use-merge-tag-fields.test.ts` — 6 tests for useMergeTagFields hook (fetch, filter, error, refetch)

### Files Modified
- `apps/web/messages/en.json` — Added `smartDocEditor.mergeTagInserter` and `smartDocEditor.previewToggle` i18n namespaces
- `apps/web/messages/es.json` — Added `smartDocEditor.mergeTagInserter` and `smartDocEditor.previewToggle` i18n namespaces (Spanish)

### Files Deleted
(None)

### Schema Changes
(None — this session is resolution logic + UI components only)

### New Domain Terms Introduced
- `MergeTagField` — Interface describing a field available for merge-tag insertion (simple or cross-linked)
- `MergeTagFieldGroup` — Interface grouping merge-tag fields by table (source vs linked)
- `PreviewMode` — Union type for document view modes: `edit | preview | raw`

### Notes
- `resolveMergeTags()` uses deep-clone + walk pattern — never mutates original TipTap JSONB content
- `formatCanonicalValue()` handles 20+ field types including currency (Intl.NumberFormat), date, checkbox (Yes/No), select/tag (label extraction), people (name extraction)
- `usePreviewToggle` stores edit-mode content in a ref before mode switch, restores on return to edit
- Raw mode replaces mergeTag nodes with `{fallback}` text nodes (no server round-trip)
- All 9 interface contracts verified: resolveMergeTags, resolveAndRenderHTML, MergeTagInserter, useMergeTagFields, MergeTagField, MergeTagFieldGroup, PreviewToggle, usePreviewToggle, PreviewMode

---

## Session D — Phase 3D — build/3d-document-templates

**Date:** 2026-03-19
**Status:** docs-synced
**Prompt(s):** Prompt 8 (Unit 4: PDF Generation Pipeline — PDFRenderer & GotenbergClient)

### Files Created
- `apps/web/src/lib/editor/pdf-renderer.ts` — `renderToHTML()` function: converts TipTap JSONB → complete HTML document with print CSS (@page rule, DM Sans/JetBrains Mono fonts, page size/margins). Exports `DocumentTemplateSettings` type.
- `packages/shared/pdf/gotenberg-client.ts` — `GotenbergClient` class: HTTP client for Gotenberg's Chromium HTML→PDF endpoint (`POST /forms/chromium/convert/html`). FormData upload, AbortController timeout, configurable paper/margin options.
- `packages/shared/pdf/index.ts` — Package barrel export for `GotenbergClient` and `GotenbergConvertOptions`
- `apps/web/src/lib/editor/__tests__/pdf-renderer.test.ts` — 15 tests: HTML structure, font inclusion, @page dimensions (A4/Letter/Legal/landscape), custom margins, print-color-adjust, heading/bold/italic/table/list rendering, empty doc
- `packages/shared/pdf/__tests__/gotenberg-client.test.ts` — 18 tests: constructor (base URL, trailing slashes, env var fallback, missing env), convertHTMLToPDF (POST endpoint, FormData file upload, Buffer return, paper/margin/landscape options, HTTP errors, timeout, abort signal, network errors)

### Files Modified
- `packages/shared/package.json` — Added `"./pdf"` export mapping to `pdf/index.ts`

### Files Deleted
(None)

### Schema Changes
(None — this session is rendering/HTTP client code only)

### New Domain Terms Introduced
- `DocumentTemplateSettings` — Type defining page configuration (pageSize, orientation, margins) for PDF rendering
- `GotenbergConvertOptions` — Type for optional Gotenberg Chromium conversion parameters (paper size, margins, landscape, timeout)

### Notes
- `renderToHTML()` uses `generateHTML()` from `@tiptap/html` with the full Smart Doc extension set, then wraps in a complete HTML page with embedded print CSS
- Page size lookup supports A4/Letter/Legal with landscape dimension swap; unknown sizes fall back to A4
- `GotenbergClient` sends HTML as a Blob file upload named `index.html` per Gotenberg's multipart API
- Timeout uses `AbortController` with configurable ms (default 30s); distinguishes abort errors from network errors
- All 33 tests pass. Zero lint/type errors.

---

## Session B — Phase 3D — build/3d-document-templates

**Date:** 2026-03-17
**Status:** docs-synced
**Prompt(s):** Prompts 3–5 (Unit 2: TipTap Env 2 Editor Core — Extension Config, Custom Nodes, Editor Shell, Toolbar & Menus)

### Files Created
- `apps/web/src/components/editor/extensions/index.ts` — Smart Doc extension bundle
- `apps/web/src/components/editor/extensions/merge-tag/merge-tag.ts` — MergeTag custom inline atom node
- `apps/web/src/components/editor/extensions/merge-tag/merge-tag-view.tsx` — MergeTag React NodeView (teal pill)
- `apps/web/src/components/editor/extensions/record-ref/record-ref.ts` — RecordRef custom inline atom node
- `apps/web/src/components/editor/extensions/record-ref/record-ref-view.tsx` — RecordRef React NodeView (inline chip)
- `apps/web/src/components/editor/extensions/callout/callout.ts` — Callout custom block node (4 variants)
- `apps/web/src/components/editor/extensions/callout/callout-view.tsx` — Callout React NodeView
- `apps/web/src/components/editor/extensions/slash-command/slash-command.ts` — SlashCommand extension
- `apps/web/src/components/editor/extensions/slash-command/slash-command-list.tsx` — SlashCommandList popup
- `apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx` — Block handle for drag-reorder
- `apps/web/src/components/editor/SmartDocEditor.tsx` — SmartDocEditor shell component
- `apps/web/src/components/editor/use-smart-doc-editor.ts` — useSmartDocEditor() hook
- `apps/web/src/components/editor/toolbar/EditorToolbar.tsx` — Fixed toolbar with formatting groups
- `apps/web/src/components/editor/menus/BubbleToolbar.tsx` — Floating bubble menu on text selection
- `apps/web/src/components/editor/__tests__/` — 8 test files (extensions, smart-doc-editor, use-smart-doc-editor, slash-command, editor-toolbar, bubble-toolbar, block-handle)

### Files Modified
- `package.json` — Added pnpm overrides pinning @tiptap/* to 3.20.2
- `apps/web/package.json` — Added Env 2 TipTap extension dependencies
- `pnpm-lock.yaml` — Updated lockfile

### Schema Changes
(None)

### New Domain Terms Introduced
(None — MergeTag, RecordRef, Callout, SmartDocEditor already defined in smart-docs.md)

---

## Session A — Phase 3D — build/3d-document-templates

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompts 1–2 (Unit 1: Document Template Data Layer)

### Files Created
- `apps/web/src/data/document-templates.ts` — Tenant-scoped read queries: `getDocumentTemplate()`, `listDocumentTemplates()`
- `apps/web/src/data/generated-documents.ts` — Tenant-scoped read queries: `getGeneratedDocument()`, `listGeneratedDocuments()`
- `apps/web/src/data/__tests__/document-templates.integration.test.ts` — Integration tests with tenant isolation
- `apps/web/src/data/__tests__/generated-documents.integration.test.ts` — Integration tests with tenant isolation
- `apps/web/src/lib/schemas/document-templates.ts` — Zod schemas for template CRUD
- `apps/web/src/actions/document-templates.ts` — Server actions: create, update, duplicate, delete
- `apps/web/src/actions/__tests__/document-template-actions.test.ts` — 17 tests for server actions

### Files Modified
- `packages/shared/db/index.ts` — Added schema/type exports
- `packages/shared/testing/factories.ts` — Added `createTestDocumentTemplate()` and `createTestGeneratedDocument()`
- `packages/shared/testing/index.ts` — Re-exported factories

### Schema Changes
(None — tables exist from Phase 1B)

### New Domain Terms Introduced
- `DocumentTemplate` — A TipTap Smart Doc template with merge tags, bound to a table, versioned
- `GeneratedDocument` — A PDF generated from a template + record, stored in R2

---

## Session F — Phase 3C — build/3c-comms

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompts 17–19 (Unit 6: Notification UI & Chat Quick Panel)

### Files Created
- `apps/web/src/components/notifications/NotificationBell.tsx` — Bell icon button with real-time unread badge, opens NotificationTray
- `apps/web/src/components/notifications/NotificationTray.tsx` — Popover tray displaying grouped notifications with mark-all-read and load-more
- `apps/web/src/components/notifications/NotificationItem.tsx` — Single notification row with click handler and relative timestamp
- `apps/web/src/components/notifications/NotificationGroup.tsx` — Grouped notifications with expand/collapse
- `apps/web/src/components/notifications/use-notifications.ts` — useNotifications hook: notifications array, unread count, loading state, mutation callbacks
- `apps/web/src/components/notifications/notification-grouping.ts` — Notification grouping logic by group_key
- `apps/web/src/components/notifications/index.ts` — Barrel export for notification components and hook
- `apps/web/src/components/notifications/__tests__/NotificationBell.test.tsx` — 10 tests for NotificationBell
- `apps/web/src/components/notifications/__tests__/use-notifications.test.ts` — 5 tests for useNotifications hook
- `apps/web/src/components/notifications/__tests__/notification-grouping.test.ts` — 7 tests for notification grouping logic
- `apps/web/src/components/chat/ChatQuickPanel.tsx` — Sidebar conversation list with infinite scroll and real-time Socket.IO updates
- `apps/web/src/components/chat/ChatQuickPanelItem.tsx` — Conversation row with avatar, unread badge, last message preview, relative timestamp
- `apps/web/src/components/chat/__tests__/ChatQuickPanel.test.tsx` — 13 tests for ChatQuickPanel
- `apps/web/src/components/presence/PresenceIndicator.tsx` — Colored dot indicator (online/away/dnd/offline) with size variants
- `apps/web/src/components/presence/CustomStatusDisplay.tsx` — Inline emoji + text display with truncation
- `apps/web/src/components/presence/CustomStatusEditor.tsx` — Popover editor with EmojiPicker, auto-clear options
- `apps/web/src/components/presence/use-presence.ts` — usePresence hook: presence map, idle detection, heartbeat, Socket.IO subscriptions
- `apps/web/src/components/presence/index.ts` — Barrel export for presence components and hook
- `apps/web/src/components/presence/__tests__/presence.test.tsx` — 20 tests for presence components and hook
- `apps/web/src/actions/notification-queries.ts` — Server-side notification query actions
- `apps/web/src/actions/presence.ts` — Server actions for presence and custom status operations

### Files Modified
- `apps/web/src/components/layout/header.tsx` — Integrated NotificationBell into workspace header
- `apps/web/src/components/layout/sidebar.tsx` — Integrated ChatQuickPanel into sidebar content zone
- `apps/web/src/stores/sidebar-store.ts` — Added chat panel visibility state
- `apps/web/src/actions/threads.ts` — Extended with thread list query for ChatQuickPanel
- `apps/web/src/components/chat/GroupDMHeader.tsx` — Updated with presence indicator integration
- `apps/web/src/components/chat/MentionDropdown.tsx` — Updated with presence dots on user entries
- `apps/web/src/components/chat/MessageItem.tsx` — Updated with presence-aware author avatars
- `apps/web/messages/en.json` — Added notifications, presence, chatQuickPanel i18n namespaces
- `apps/web/messages/es.json` — Added notifications, presence, chatQuickPanel i18n namespaces (Spanish)

### Schema Changes
- None

### New Domain Terms Introduced
- `NotificationBell` — Header component showing unread notification count with real-time badge updates
- `NotificationTray` — Popover UI displaying grouped notifications with mark-all-read action
- `ChatQuickPanel` — Sidebar panel showing recent conversations (threads + DMs) with unread indicators
- `PresenceIndicator` — Visual dot component showing user online/away/dnd/offline state
- `CustomStatusEditor` — Popover UI for setting emoji + text custom status with auto-clear scheduling

---

## Session E — Phase 3C — build/3c-comms

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompts 14–16 (Unit 5: Record Thread & DM UI)

### Files Created
- `apps/web/src/components/thread/ThreadMessageList.tsx` — Virtualized message list with date separators, scroll-to-bottom, infinite scroll for older messages
- `apps/web/src/components/thread/ThreadReplyPanel.tsx` — Inline reply panel with quoted message preview, ChatEditor input, cancel/send actions
- `apps/web/src/components/thread/ThreadSearchBar.tsx` — In-thread search with match highlighting, prev/next navigation, result count
- `apps/web/src/components/thread/PinnedMessagesPanel.tsx` — Slide-over panel listing pinned messages with unpin action and jump-to-message
- `apps/web/src/components/thread/ThreadNavDropdown.tsx` — Hierarchical dropdown for parent/current/sibling/child record navigation with unread indicators
- `apps/web/src/components/thread/use-thread-search.ts` — useThreadSearch() hook: debounced query, match positions, active match cycling, scroll-to-match
- `apps/web/src/components/thread/use-typing-indicator.ts` — useTypingIndicator() hook: Socket.IO typing events, debounced broadcast, typingUsers list
- `apps/web/src/components/chat/DMConversation.tsx` — DM/group DM conversation view with message list, typing indicator, chat editor, failed message retry
- `apps/web/src/components/chat/GroupDMHeader.tsx` — Editable group name, participant avatars (3–8 cap), add participant button, settings icon
- `apps/web/src/components/chat/MessageErrorHandler.tsx` — Failed message error cards with retry (3 attempts with exponential delay) and dismiss
- `apps/web/src/components/thread/__tests__/thread-prompt15.test.tsx` — Tests for ThreadMessageList, ThreadReplyPanel, ThreadSearchBar, PinnedMessagesPanel
- `apps/web/src/components/thread/__tests__/thread-prompt16.test.tsx` — Tests for DMConversation, GroupDMHeader, ThreadNavDropdown, RecordView thread integration

### Files Modified
- `apps/web/src/components/record-view/RecordView.tsx` — Added thread panel slot (25% width right panel), main content shrinks to 75% when thread open
- `apps/web/src/components/record-view/RecordViewHeader.tsx` — Chat icon (MessageCircle) with teal unread badge (99+ cap), toggle thread open/close
- `apps/web/src/components/record-view/__tests__/RecordView.test.tsx` — Updated stale test: old placeholder label → new i18n aria-label
- `apps/web/src/components/thread/RecordThreadPanel.tsx` — Extended shell with ThreadMessageList, ThreadReplyPanel, ThreadSearchBar, PinnedMessagesPanel integration
- `apps/web/src/actions/thread-queries.ts` — Added searchThreadMessagesAction, pinMessageAction, unpinMessageAction, getPinnedMessagesAction
- `apps/web/messages/en.json` — Added thread search, pinned messages, DM, group DM, error handler i18n keys
- `apps/web/messages/es.json` — Added thread search, pinned messages, DM, group DM, error handler i18n keys (Spanish)
- `apps/web/package.json` — Added dependencies for Prompts 15–16 components
- `pnpm-lock.yaml` — Updated lockfile

### Schema Changes
- None

### New Domain Terms Introduced
- None (all terms already in GLOSSARY.md)

### Notes
- Verification fixes: removed unused beforeEach import (lint), added eslint-disable for img element in GroupDMHeader avatars, updated stale RecordView test aria-label.
- All 5 interface contracts verified: thread components, chat components, hooks, chat icon + badge, thread panel slot.

---

## Session H — Phase 3C — build/3c-comms

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompt 14 (Unit 5: RecordThreadPanel shell, tabs, lenses, useThread hook)

### Files Created
- `apps/web/src/components/thread/use-thread.ts` — useThread() hook: TanStack Query infinite query + Socket.IO subscriptions for message:new/edit/delete, mark-as-read, send/edit/delete actions
- `apps/web/src/components/thread/RecordThreadPanel.tsx` — 25% width panel with ThreadTabBar, ThreadLensBar, message list, ChatEditor input; opens from RecordView header chat icon
- `apps/web/src/components/thread/ThreadTabBar.tsx` — Two tabs: "Team Notes" (internal, always) + "Client Messages" (client, when enabled); teal underline active indicator
- `apps/web/src/components/thread/ThreadLensBar.tsx` — Four lens filter buttons: All | Notes | Activity | Files
- `apps/web/src/components/thread/ClientVisibleBanner.tsx` — Persistent amber warning banner above chat input in client thread tab
- `apps/web/src/components/thread/SharedNoteMessage.tsx` — Visual wrapper: 📝 icon, 3px teal left border, muted bg, inset container
- `apps/web/src/actions/thread-queries.ts` — Server actions: getMessagesAction, markThreadReadAction, getUnreadCountAction
- `apps/web/src/components/thread/__tests__/thread-components.test.tsx` — 12 tests: ThreadTabBar, ThreadLensBar, ClientVisibleBanner, SharedNoteMessage
- `apps/web/src/components/thread/__tests__/use-thread.test.ts` — 8 tests: message loading, null threadId, lensFilter, mark-read, socket subscribe/join, real-time append, own-message filter, hasMore

### Files Modified
- `apps/web/src/components/record-view/RecordViewHeader.tsx` — Wired chat icon: added isThreadOpen, onToggleThread props; replaced disabled placeholder with functional toggle button with aria-pressed
- `apps/web/messages/en.json` — Added `thread` i18n namespace (17 keys); updated `record_view.chat_placeholder` → `record_view.toggle_thread`
- `apps/web/messages/es.json` — Added `thread` i18n namespace (17 keys, Spanish); updated `record_view.chat_placeholder` → `record_view.toggle_thread`

### Schema Changes
- None

### New Domain Terms Introduced
- None (all terms already in GLOSSARY.md)

### Notes
- RecordThreadPanel accepts pre-resolved thread IDs (internalThreadId, clientThreadId) — thread lookup via getThreadByScope is done by the parent (RecordView integration in Prompt 15).
- useThread uses injectable fetchMessages/markRead for testability without server action mocking.

---

## Session D — Phase 3C — build/3c-comms

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompts 11–13 (Unit 4: Chat Editor — TipTap Env 1)

### Files Created
- `apps/web/src/components/chat/types.ts` — ChatEditorConfig, ChatEditorInstance, MentionSuggestion, ChatEditorState types
- `apps/web/src/components/chat/extensions.ts` — createChatEditorExtensions() factory, CHAT_EDITOR_EXTENSION_NAMES, CHAT_EDITOR_EXCLUDED_EXTENSIONS
- `apps/web/src/components/chat/use-chat-editor.ts` — useChatEditor() hook with 3-state machine (Compact/Focused/Expanded)
- `apps/web/src/components/chat/ChatEditor.tsx` — Main chat editor with progressive disclosure, drag-drop attachments, mention dropdown
- `apps/web/src/components/chat/ChatEditorToolbar.tsx` — BubbleMenu toolbar with 6 formatting actions
- `apps/web/src/components/chat/MentionDropdown.tsx` — @mention autocomplete with fuzzy filtering, person/group sections
- `apps/web/src/components/chat/ChatAttachmentButton.tsx` — Paperclip attachment button with file picker and preview
- `apps/web/src/components/chat/MessageRenderer.tsx` — Read-only TipTap JSON → styled HTML renderer (no editor instances)
- `apps/web/src/components/chat/MessageItem.tsx` — Single message display with avatar, hover menu, inline edit mode
- `apps/web/src/components/chat/EmojiReactions.tsx` — Reaction chips below messages with toggle and add button
- `apps/web/src/components/chat/EmojiPicker.tsx` — emoji-mart wrapper in shadcn/ui Popover
- `apps/web/src/components/chat/__tests__/extensions.test.ts` — 14 tests for TipTap extension config
- `apps/web/src/components/chat/__tests__/use-chat-editor.test.ts` — 13 tests for useChatEditor hook
- `apps/web/src/components/chat/__tests__/ChatEditor.test.tsx` — 28 tests for ChatEditor component
- `apps/web/src/components/chat/__tests__/MessageRenderer.test.tsx` — 16 tests for MessageRenderer
- `apps/web/src/components/chat/__tests__/MessageItem.test.tsx` — 15 tests for MessageItem
- `apps/web/src/components/chat/__tests__/EmojiReactions.test.tsx` — 8 tests for EmojiReactions
- `apps/web/src/components/chat/__tests__/EmojiPicker.test.tsx` — 4 tests for EmojiPicker

### Files Modified
- `apps/web/package.json` — Added @tiptap/react, @tiptap/starter-kit, @tiptap/core, @tiptap/extension-mention, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/extension-underline, @tiptap/extension-bubble-menu, @tiptap/pm, emoji-mart, @emoji-mart/react, @emoji-mart/data
- `apps/web/messages/en.json` — Added chatEditor, chat.messageItem, chat.emojiReactions, chat.emojiPicker i18n namespaces
- `apps/web/messages/es.json` — Added chatEditor, chat.messageItem, chat.emojiReactions, chat.emojiPicker i18n namespaces (Spanish)
- `pnpm-lock.yaml` — Updated lockfile with TipTap and emoji-mart dependencies
- `scripts/check-i18n.ts` — Added `/lib/email/templates/` to EXCLUDED_PATHS (React Email templates are server-rendered outside next-intl)

### Schema Changes
- None

### New Domain Terms Introduced
- `chatEditorExtensions` — TipTap Environment 1 extension configuration (chat, not docs). 12 named extensions
- `ChatEditorState` — 3-state machine: compact (single-line), focused (active with actions), expanded (paragraph mode)
- `ReactionsMap` — JSONB shape type: `Record<string, string[]>` mapping emoji → user IDs

### Notes
- Verification fixes: (1) Disabled link/underline in StarterKit (TipTap v3 bundles them, causing duplicates), (2) Fixed CHAT_EDITOR_EXTENSION_NAMES to use `undoRedo` (actual TipTap name, not `history`), (3) Excluded email templates from i18n check.
- MessageRenderer avoids creating TipTap editor instances — uses pure recursive React element rendering for performance.

---

## Session G — Phase 3C — build/3c-comms

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompt 13 (Unit 4: MessageRenderer, MessageItem, EmojiReactions, EmojiPicker)

### Files Created
- `apps/web/src/components/chat/MessageRenderer.tsx` — Read-only TipTap JSON → styled HTML renderer (no editor instances). Renders: bold, italic, underline, strike, code, link, bullet list, ordered list, blockquote, mention pill (teal @Name), hard break.
- `apps/web/src/components/chat/MessageItem.tsx` — Single message display: avatar (initials fallback), author name, timestamp, content (via MessageRenderer), hover menu (Edit/Delete/Pin/Save/Reply), inline edit mode with ChatEditor, "(edited)" indicator, deleted placeholder, system message (centered, muted).
- `apps/web/src/components/chat/EmojiReactions.tsx` — Reaction chips below message: emoji + count + active highlight, click to toggle, "+" button opens EmojiPicker.
- `apps/web/src/components/chat/EmojiPicker.tsx` — emoji-mart wrapper in shadcn/ui Popover: categories, search, skin tone selector.
- `apps/web/src/components/chat/__tests__/MessageRenderer.test.tsx` — 16 tests: all mark types, lists, blockquote, mention pill, combined marks, hard break, empty doc, no contenteditable.
- `apps/web/src/components/chat/__tests__/MessageItem.test.tsx` — 15 tests: avatar/name/timestamp, hover menu visibility, edit mode toggle, "(edited)" indicator, deleted placeholder, system message, callback invocations, pin/unpin text.
- `apps/web/src/components/chat/__tests__/EmojiReactions.test.tsx` — 8 tests: chip rendering, active state, toggle callback, add reaction button, empty reactions, filtered empty arrays.
- `apps/web/src/components/chat/__tests__/EmojiPicker.test.tsx` — 4 tests: popover rendering, config pass-through, emoji selection callback, trigger rendering.

### Files Modified
- `apps/web/messages/en.json` — Added `chat.messageItem`, `chat.emojiReactions`, `chat.emojiPicker` i18n namespaces
- `apps/web/messages/es.json` — Added `chat.messageItem`, `chat.emojiReactions`, `chat.emojiPicker` i18n namespaces (Spanish)

### Schema Changes
- None

### New Domain Terms Introduced
- `ThreadMessage` — TypeScript interface for message data consumed by MessageItem (id, content, reactions, is_edited, is_deleted, message_type)
- `ReactionsMap` — JSONB shape type: `Record<string, string[]>` mapping emoji → user IDs

### Notes
- MessageRenderer deliberately avoids creating TipTap editor instances — uses pure recursive React element rendering for performance (200 messages = 200 HTML renders, not 200 editors).
- MessageItem hover menu uses Radix DropdownMenu. Edit/Delete only shown for own messages. System messages render as centered muted text with no interaction affordances.
- EmojiPicker wraps emoji-mart with `searchPosition="sticky"`, `skinTonePosition="search"`, `previewPosition="none"`, native emoji set.

---

## Session F-sub — Phase 3C — build/3c-comms

**Date:** 2026-03-16
**Status:** docs-synced
**Prompt(s):** Prompt 12 (Unit 4: ChatEditor Component with Toolbar, Mentions, Attachments)

### Files Created
- `apps/web/src/components/chat/ChatEditor.tsx` — Main chat editor component with 3-state progressive disclosure (Compact/Focused/Expanded), drag-drop attachment support, mention dropdown integration
- `apps/web/src/components/chat/ChatEditorToolbar.tsx` — Bubble toolbar on text selection (BubbleMenu) with 6 formatting actions: B, I, U, Link, Bullets, Numbers
- `apps/web/src/components/chat/MentionDropdown.tsx` — @mention autocomplete dropdown with fuzzy filtering, person/group sections, arrow key navigation, teal pill rendering via TipTap Mention extension
- `apps/web/src/components/chat/ChatAttachmentButton.tsx` — Paperclip attachment button with file picker, image thumbnails, file icon + name + size preview, remove functionality
- `apps/web/src/components/chat/__tests__/ChatEditor.test.tsx` — 28 tests: 3 editor states, toolbar buttons/labels, mention dropdown rendering/filtering/selection, attachment button/preview/removal, drag-drop

### Files Modified
- `apps/web/src/components/chat/types.ts` — Added MentionDropdownState, ChatMentionSuggestionConfig types; added `type` field to MentionSuggestion; added mentionSuggestion to ChatEditorConfig
- `apps/web/src/components/chat/extensions.ts` — Fixed Link/Underline as separate imports (not bundled in StarterKit v3); added mentionSuggestion pass-through to Mention.configure; fixed extension names list
- `apps/web/src/components/chat/use-chat-editor.ts` — Pass mentionSuggestion from config to createChatEditorExtensions
- `apps/web/package.json` — Added @tiptap/extension-bubble-menu dependency
- `pnpm-lock.yaml` — Updated lockfile
- `apps/web/messages/en.json` — Added chatEditor i18n namespace (placeholder, send, cancel, expand, collapse, attach, toolbar labels)
- `apps/web/messages/es.json` — Added chatEditor i18n namespace (Spanish translations)

### Schema Changes
- None

### Notes
- Fixed bug in extensions.ts from Prompt 11: Link and Underline were listed in extension names but not actually imported/registered (StarterKit v3 doesn't bundle them). Now imported from @tiptap/extension-link and @tiptap/extension-underline respectively.
- BubbleMenu is in @tiptap/react/menus (not @tiptap/react) in TipTap v3. Uses Floating UI `options` prop instead of deprecated `tippyOptions`.
- Mention suggestion uses ref-bridge pattern: TipTap's imperative suggestion callbacks update React state via refs, MentionDropdown exposes onKeyDown via useImperativeHandle.

---

## Session E-sub — Phase 3C — build/3c-comms

**Date:** 2026-03-15
**Status:** docs-synced
**Prompt(s):** Prompt 11 (Unit 4: TipTap Extension Config + useChatEditor Hook)

### Files Created
- `apps/web/src/components/chat/types.ts` — ChatEditorConfig, ChatEditorInstance, MentionSuggestion, ChatEditorState types
- `apps/web/src/components/chat/extensions.ts` — createChatEditorExtensions() factory, CHAT_EDITOR_EXTENSION_NAMES, CHAT_EDITOR_EXCLUDED_EXTENSIONS constants
- `apps/web/src/components/chat/use-chat-editor.ts` — useChatEditor() hook with 3-state machine (Compact/Focused/Expanded), keyboard shortcuts, TipTap integration
- `apps/web/src/components/chat/__tests__/extensions.test.ts` — 14 tests: extension list verification, excluded extensions, link/mention config, markdown shortcuts
- `apps/web/src/components/chat/__tests__/use-chat-editor.test.ts` — 13 tests: state machine transitions, send behavior, keyboard extension, types shape

### Files Modified
- `apps/web/package.json` — Added @tiptap/react, @tiptap/starter-kit, @tiptap/core, @tiptap/extension-mention, @tiptap/extension-link, @tiptap/extension-placeholder, @tiptap/extension-underline, @tiptap/pm, emoji-mart, @emoji-mart/react, @emoji-mart/data
- `pnpm-lock.yaml` — Updated lockfile with TipTap and emoji-mart dependencies

### Schema Changes
- None

### New Domain Terms Introduced
- `chatEditorExtensions` — TipTap Environment 1 extension configuration (chat, not docs). 12 named extensions: bold, italic, underline, strike, code, bulletList, orderedList, blockquote, link, mention, placeholder, undoRedo
- `ChatEditorState` — 3-state machine: compact (single-line), focused (active with actions), expanded (paragraph mode)
- `chatKeyboard` — Custom TipTap extension handling Enter/Shift+Enter/Cmd+Enter/Escape/ArrowUp per state

---

## Session D — Phase 3C — build/3c-comms

**Date:** 2026-03-15
**Status:** docs-synced
**Prompt(s):** Prompts 8–10 (Unit 3: Presence & Real-Time Chat Infrastructure)

### Files Created
- `apps/realtime/src/handlers/chat-handler.ts` — ChatHandler: thread:join, thread:leave, typing:start, typing:stop listeners + message broadcast
- `apps/realtime/src/handlers/presence-handler.ts` — PresenceHandler: presence:heartbeat, presence:update, presence:status listeners + disconnect cleanup
- `apps/realtime/src/handlers/notification-handler.ts` — NotificationHandler: subscribes to user:{userId}:notifications Redis channel, DND suppression
- `apps/realtime/src/subscribers/chat-event-subscriber.ts` — Redis pub/sub subscriber bridging chat events to Socket.IO rooms
- `apps/web/src/lib/realtime/chat-events.ts` — publishChatEvent() for message:new/edit/delete via Redis pub/sub
- `apps/web/src/lib/realtime/notification-events.ts` — publishNotificationEvent() to user:{userId}:notifications channel
- `apps/realtime/src/handlers/__tests__/chat-handler.test.ts` — Unit tests for ChatHandler
- `apps/realtime/src/handlers/__tests__/presence-handler.test.ts` — Unit tests for PresenceHandler
- `apps/realtime/src/handlers/__tests__/notification-handler.test.ts` — Unit tests for NotificationHandler
- `apps/realtime/src/subscribers/__tests__/chat-event-subscriber.test.ts` — Unit tests for chat event subscriber
- `apps/web/src/lib/realtime/__tests__/chat-events.test.ts` — Unit tests for publishChatEvent (9 tests)
- `apps/web/src/lib/realtime/__tests__/notification-events.test.ts` — Unit tests for publishNotificationEvent (6 tests)

### Files Modified
- `apps/realtime/src/server.ts` — Registered ChatHandler, PresenceHandler, NotificationHandler
- `apps/web/src/actions/threads.ts` — Wired publishChatEvent into message create/edit/delete actions
- `apps/web/src/lib/notifications/notification-service.ts` — Wired publishNotificationEvent into delivery routing
- `packages/shared/realtime/events.ts` — Added MESSAGE_NEW, MESSAGE_EDIT, MESSAGE_DELETE, NOTIFICATION_NEW, TYPING_START, TYPING_STOP events
- `packages/shared/realtime/__tests__/types.test.ts` — Updated tests for new event constants

### Schema Changes
- None

### New Domain Terms Introduced
- `ChatHandler` — Socket.IO handler for thread join/leave and typing events, with message broadcast via Redis pub/sub
- `PresenceHandler` — Socket.IO handler for heartbeat, status updates, and disconnect cleanup
- `NotificationHandler` — Socket.IO handler subscribing to per-user Redis notification channels with DND bypass logic
- `ChatEventSubscriber` — Redis pub/sub subscriber that bridges chat events from the web app to Socket.IO rooms

---

## Session C — Phase 3C — build/3c-comms

**Date:** 2026-03-15
**Status:** docs-synced
**Prompt(s):** Prompt 8 (Unit 3: PresenceService — Redis Heartbeat + Custom Status)

### Files Created
- `apps/realtime/src/types/chat.ts` — Shared types for chat/presence/notification events (ChatPresenceState, PresenceEntry, ChatEvent, TypingEvent)
- `apps/realtime/src/services/presence-service.ts` — PresenceService class with Redis-backed presence state (setPresence, getPresence, heartbeat, getUserStatus, removePresence)
- `apps/web/src/data/presence.ts` — Custom status CRUD data functions (updateCustomStatus, getCustomStatus, clearExpiredStatuses)
- `apps/realtime/src/services/__tests__/presence-service.test.ts` — 21 unit tests for PresenceService (TTL, heartbeat, DND, tenant isolation, SCAN pagination)
- `apps/web/src/data/__tests__/presence.test.ts` — 9 integration tests for custom status CRUD (CRUD, expiry cleanup, tenant isolation)

### Files Modified
- None

### Files Deleted
- None

### Schema Changes
- None (custom status columns already exist on workspace_memberships: status_emoji, status_text, status_clear_at)

### New Domain Terms
- `ChatPresenceState` — string type for chat presence states (online, away, dnd, offline); distinct from existing `PresenceState` in `packages/shared/realtime/types.ts` which is for grid collaboration presence

---

## Session A — Phase 3C — build/3c-comms

**Date:** 2026-03-15
**Status:** docs-synced
**Prompt(s):** Prompts 1–4 (Unit 1: Schema Migration & Thread/Message Data Layer)

### Files Created
- `packages/shared/db/migrations/0025_add_user_notes_and_source_note_id.sql` — Migration adding user_notes table and source_note_id FK column to thread_messages
- `packages/shared/db/schema/user-notes.ts` — Drizzle schema for user_notes table
- `apps/web/src/data/threads.ts` — Thread CRUD: createThread, getThread, getThreadByScope, listThreadsForUser, getOrCreateDMThread, createGroupDM
- `apps/web/src/data/thread-messages.ts` — Message CRUD: createMessage, getMessage, listMessages, updateMessage, softDeleteMessage, pinMessage, unpinMessage, getPinnedMessages, searchThreadMessages
- `apps/web/src/data/thread-participants.ts` — Participant CRUD: addParticipant, removeParticipant, getParticipants, updateLastRead
- `apps/web/src/data/saved-messages.ts` — Saved message CRUD: saveMessage, unsaveMessage, getSavedMessages
- `apps/web/src/actions/threads.ts` — Server actions for thread/message/participant/saved-message operations
- `apps/web/src/data/__tests__/thread-comms.integration.test.ts` — Integration tests for all thread, message, participant, and saved-message data functions
- `packages/shared/testing/factories/threads.ts` — Test factories: createTestThread, createTestThreadMessage, createTestThreadParticipant
- `docs/Playbooks/Phase 3/prompting-roadmap-phase-3c.md` — Phase 3C prompting roadmap
- `docs/Playbooks/Phase 3/prompting-roadmap-phase-3c.docx` — Phase 3C prompting roadmap (Word format)

### Files Modified
- `packages/shared/db/schema/thread-messages.ts` — Added source_note_id column (UUID, nullable, FK → user_notes)
- `packages/shared/db/schema/index.ts` — Added user-notes schema export
- `packages/shared/db/migrations/meta/_journal.json` — Added entry for migration 0025
- `packages/shared/db/index.ts` — Added re-exports for user_notes, thread-related types
- `packages/shared/testing/index.ts` — Added barrel export for thread factories
- `TASK-STATUS.md` — Updated Unit 1 status

### Schema Changes
- Added table: `user_notes` — Stores shared notes that can be referenced by thread messages
- Added column: `thread_messages.source_note_id` — UUID, nullable, FK → user_notes(id), links a message to its source note

### New Domain Terms Introduced
- None (thread, message, participant, saved message already in GLOSSARY)

## Session B — Phase 3C — build/3c-comms

**Date:** 2026-03-15
**Status:** docs-synced
**Prompt(s):** Prompts 5–7 (Unit 2: Notification Pipeline & System Email)

### Files Created
- `packages/shared/db/migrations/0026_extend_notifications_schema.sql` — Migration adding missing columns to notifications table (title, body, source_type, source_record_id, actor_id, group_key, read_at)
- `apps/web/src/data/notifications.ts` — Notification CRUD: createNotification, getNotifications, getUnreadNotificationCount, markNotificationRead, markAllNotificationsRead (Redis-cached unread count)
- `apps/web/src/lib/notifications/notification-service.ts` — NotificationService class with create() method: inserts notification, checks preferences, routes to in-app (Redis pub/sub) and/or email (BullMQ enqueue)
- `apps/web/src/data/__tests__/notifications.integration.test.ts` — Integration tests: tenant isolation, CRUD, pagination, unread count, mark-read
- `apps/web/src/lib/notifications/__tests__/notification-service.test.ts` — Unit tests: routing logic, 8 notification types, priority override, mute suppression, error handling
- `apps/web/src/lib/email/resend-service.ts` — ResendEmailService wrapping Resend SDK with rate limiting, retry, and structured logging
- `apps/web/src/lib/email/__tests__/resend-service.test.ts` — Unit tests for ResendEmailService
- `apps/worker/src/processors/notification/notification-router.ts` — BullMQ notification router processor dispatching to email-send and cleanup sub-processors
- `apps/worker/src/processors/notification/email-send.ts` — Email send processor using ResendEmailService with template resolution
- `apps/worker/src/processors/notification/cleanup.ts` — Notification cleanup processor for purging old read notifications
- `apps/worker/src/processors/notification/__tests__/notification-router.test.ts` — Unit tests for notification router
- `apps/worker/src/processors/notification/__tests__/email-send.test.ts` — Unit tests for email send processor
- `apps/worker/src/processors/notification/__tests__/cleanup.test.ts` — Unit tests for cleanup processor
- `apps/web/src/data/notification-preferences.ts` — Notification preferences CRUD: getPreferences, updatePreferences, muteThread, unmuteThread
- `apps/web/src/data/__tests__/notification-preferences.integration.test.ts` — Integration tests for notification preferences
- `apps/web/src/actions/notifications.ts` — Server actions for notification operations (mark read, update preferences, mute/unmute)
- `apps/web/src/actions/__tests__/notifications.test.ts` — Unit tests for notification server actions
- `apps/web/src/lib/email/templates/invitation-email.tsx` — React Email invitation template
- `apps/web/src/lib/email/templates/system-alert-email.tsx` — React Email system alert template
- `apps/web/src/lib/email/templates/client-thread-reply-email.tsx` — React Email client thread reply template
- `apps/web/src/lib/email/templates/index.ts` — Template barrel export
- `apps/web/src/lib/email/__tests__/templates.test.tsx` — Snapshot tests for email templates
- `apps/worker/src/processors/notification/email-templates.ts` — Email template resolver mapping notification types to React Email templates
- `apps/worker/src/processors/notification/__tests__/email-templates.test.ts` — Unit tests for email template resolver

### Files Modified
- `packages/shared/db/schema/notifications.ts` — Added columns: title, body, sourceType, sourceRecordId, actorId, groupKey, readAt; added actor relation
- `packages/shared/db/index.ts` — Added notifications, userNotificationPreferences table/type exports
- `packages/shared/db/migrations/meta/_journal.json` — Added entry for migration 0026
- `packages/shared/queue/constants.ts` — Added 'notification' queue name
- `packages/shared/queue/types.ts` — Added NotificationEmailSendJobData, NotificationCleanupJobData interfaces and notification queue mapping; updated for template data
- `packages/shared/queue/index.ts` — Added notification job type exports
- `packages/shared/queue/__tests__/constants.test.ts` — Updated for new queue name
- `apps/web/package.json` — Added @react-email/components, react-email dependencies
- `apps/worker/package.json` — Added resend dependency
- `apps/worker/src/index.ts` — Registered notification processors
- `apps/web/src/__tests__/auth-flow.integration.test.ts` — Test fixes for verification pass
- `apps/web/src/__tests__/role-check.integration.test.ts` — Test fixes for verification pass
- `apps/web/src/__tests__/webhook-user-created.integration.test.ts` — Test fixes for verification pass
- `pnpm-lock.yaml` — Updated lockfile

### Schema Changes
- Extended table: `notifications` — Added columns: title (VARCHAR 255), body (VARCHAR 500 nullable), source_type (VARCHAR 50), source_record_id (UUID), actor_id (UUID FK → users), group_key (VARCHAR 255), read_at (TIMESTAMPTZ)
- Added index: `notifications_group_key_created_idx` on (group_key, created_at) WHERE group_key IS NOT NULL
- Added index: `notifications_user_tenant_created_idx` on (user_id, tenant_id, created_at DESC)

### New Domain Terms Introduced
- `NotificationService` — Service class that orchestrates notification creation and delivery routing (in-app via Redis pub/sub, email via BullMQ)
- `NotificationType` — 8 notification categories: mention, dm, thread_reply, approval_requested, approval_decided, automation_failed, sync_error, system
- `ResendEmailService` — Wrapper around Resend SDK providing rate limiting, retry, and structured logging for transactional email

---

## Session D/E — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 12–15 (Unit 4: Command Bar UI & AI Search Channel)

### Files Created
- `apps/web/src/components/command-bar/command-bar-provider.tsx` — CommandBarProvider context, useCommandBar() hook, deriveChannel() intent routing
- `apps/web/src/components/command-bar/command-bar.tsx` — CommandBar modal with keyboard shortcuts, session analytics, trackRecentItem wiring
- `apps/web/src/components/command-bar/search-results.tsx` — CommandBarSearchResults with parallel record + navigation search, recent item boosting
- `apps/web/src/components/command-bar/slash-menu.tsx` — CommandBarSlashMenu with fuzzy filtering by command_key, label, description
- `apps/web/src/components/command-bar/ai-channel.tsx` — CommandBarAIChannel with SDS-powered natural language search via AIService
- `apps/web/src/components/command-bar/recent-items.tsx` — CommandBarRecentItems with icon mapping, entity context display, filterRecentItemsByQuery()
- `apps/web/src/components/command-bar/__tests__/command-bar.test.tsx` — 18 tests: deriveChannel, provider state, keyboard shortcuts
- `apps/web/src/components/command-bar/__tests__/recent-items.test.tsx` — 17 tests: recent items rendering, selection tracking, scoped mode, session analytics, search boosting
- `apps/web/src/actions/command-bar.ts` — executeSlashCommand() and aiSearchQuery() server actions (SDS + AIService integration)
- `apps/web/src/data/command-bar-sessions.ts` — createCommandBarSession(), closeCommandBarSession(), getCommandBarSession() analytics data layer

### Files Modified
- `apps/web/messages/en.json` — Added commandBar i18n namespace (placeholder, searchHeading, slashHeading, aiHeading, recentHeading, scopedLabel, scopedHint, etc.)
- `apps/web/messages/es.json` — Added commandBar i18n namespace (Spanish translations)
- `packages/shared/db/index.ts` — Added re-exports for commandBarSessions, CommandBarSession, NewCommandBarSession

### Schema Changes
None

### New Domain Terms Introduced
- `CommandBar` — Persistent modal UI component for search, slash commands, and AI queries (Cmd+K global, Cmd+F scoped)
- `CommandBarProvider` — React context provider managing Command Bar state (open/close, mode, query, channel)
- `useCommandBar` — Hook exposing Command Bar state and actions (open, close, setQuery)
- `activeChannel` — Derived channel (search | slash | ai) based on query intent routing
- `intent routing` — Pattern where query prefix determines the active channel (plain text → search, / → slash, ? → AI)
- `scoped mode` — Command Bar mode (Cmd+F) filtering results to the current table context

### Notes
- Session G (Prompt 12 initial build) was superseded by this combined D/E session covering Prompts 12–15.

---

## Session G — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompt 12 (Unit 4: CommandBar Shell, Provider & Keyboard Shortcuts — initial build, superseded by Session D/E)

### Files Created
- `apps/web/src/components/command-bar/command-bar-provider.tsx` — CommandBarProvider context, useCommandBar() hook, deriveChannel() intent routing
- `apps/web/src/components/command-bar/command-bar.tsx` — CommandBar modal component built on shadcn/ui Command (cmdk), global keyboard shortcuts (Cmd+K, Cmd+F)
- `apps/web/src/components/command-bar/__tests__/command-bar.test.tsx` — 18 tests: deriveChannel unit tests, provider state tests, keyboard shortcut tests

### Files Modified
- `apps/web/src/app/(app)/layout.tsx` — Wrapped AppShell with CommandBarProvider, added CommandBar component
- `apps/web/messages/en.json` — Added commandBar i18n namespace
- `apps/web/messages/es.json` — Added commandBar i18n namespace (Spanish)

### Schema Changes
- None

### New Domain Terms Introduced
- CommandBarProvider, useCommandBar, deriveChannel, activeChannel (search | slash | ai)

---

## Session C — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 9–11 (Unit 3: Command Bar Search & Navigation Data Layer)

### Files Created
- `apps/web/src/lib/command-bar/types.ts` — SearchResult, NavigationResult, CommandEntry, RecentItem, RecentItemInput, CommandBarSearchParams types
- `apps/web/src/data/command-bar-search.ts` — searchRecords() (tsvector full-text search) and searchTablesAndViews() (role-aware ILIKE navigation search)
- `apps/web/src/data/__tests__/command-bar-search.test.ts` — Unit/integration tests for record search and table/view search
- `apps/web/src/data/command-registry.ts` — getCommandRegistry() with hardcoded SYSTEM_COMMANDS, role-based and scope-based filtering
- `apps/web/src/data/__tests__/command-registry.test.ts` — Unit tests for command registry permission and scope filtering
- `apps/web/src/data/recent-items.ts` — trackRecentItem() (upsert dedup, prune at 100) and getRecentItems() (access-filtered via JOIN)
- `apps/web/src/data/__tests__/recent-items.test.ts` — Unit tests for recent item tracking, retrieval, and access filtering
- `packages/shared/testing/factories/command-registry.ts` — createTestCommandRegistryEntry() factory with incremental counter

### Files Modified
- `packages/shared/testing/index.ts` — Added barrel export for command-registry factory
- `packages/shared/db/index.ts` — Added missing re-exports for userRecentItems, userRecentItemsRelations, UserRecentItem, NewUserRecentItem
- `packages/shared/testing/factories/command-registry.ts` — Replaced cross-package import with local CommandEntry interface to fix rootDir violation

### Files Deleted
- (none)

### Schema Changes
- None

### New Domain Terms Introduced
- `CommandBarSearchParams` — Interface for parameterized command bar search (query, workspace_id, scope, limit)
- `CommandEntry` — Interface for system/automation commands in the Command Bar registry
- `command_key` — Unique string identifier for each command in the registry (e.g. 'new_record', 'search')
- `context_scopes` — Array of scope identifiers controlling where a command appears (global, table_view, record_detail, chat)

### Notes
- Verification pass fixed two issues: (1) userRecentItems missing from db barrel export, (2) command-registry factory had cross-package import violating shared rootDir.
- All 7 interface contracts verified. Typecheck, lint, tests (1997), coverage all pass.

---

## Session B — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompt 5 (Unit 2: SDS Permission Filter — partial; cache, schema-hash, token-estimator, and service files built in a later unlogged session)

### Files Created
- `packages/shared/ai/schema-descriptor/permission-filter.ts` — filterDescriptorByPermissions() — deep-copies and filters WorkspaceDescriptor by user permissions (role-based Table View access, field-level hidden/read_only resolution, link graph pruning, cross-link restricted target handling)
- `packages/shared/ai/schema-descriptor/__tests__/permission-filter.test.ts` — 15 unit tests covering Owner/Admin bypass, Team Member partial access, hidden field security, link graph pruning, cross-link edge case, deep-copy safety, tenant isolation, manager access, specific user grants, excluded users

### Files Modified
- `packages/shared/ai/schema-descriptor/index.ts` — Added barrel export for filterDescriptorByPermissions

### Files Deleted
- (none)

### Schema Changes
- None

### New Domain Terms Introduced
- (none — uses existing permission and descriptor terminology)

### Notes
- Uses structuredClone() for deep-copy safety — cached descriptors are never mutated
- Permission resolution uses resolveEffectiveRole() + resolveAllFieldPermissions() from existing auth package
- Cross-link edge case: linked_record fields with inaccessible targets get linked_table: null, cardinality: 'restricted'
- Coverage: 89% statements, 88.76% lines on permission-filter.ts
- **Docs Agent note (2026-03-15):** Session B only logged permission-filter.ts. The remaining Unit 2 files (cache.ts, schema-hash.ts, token-estimator.ts, service.ts + tests) were built in a later session that was not logged in MODIFICATIONS.md. All files verified present on main via git log.

---

## Session A — Phase 3B-ii — build/3b-ii-sds-command-bar

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 1–4 (Unit 1: SDS Types & Core Builders)

### Files Created
- `packages/shared/ai/schema-descriptor/types.ts` — SDS descriptor types: FieldDescriptor, TableDescriptor, BaseDescriptor, LinkEdge, WorkspaceDescriptor
- `packages/shared/ai/schema-descriptor/index.ts` — Barrel export for all SDS types + builder functions
- `packages/shared/ai/schema-descriptor/field-mapper.ts` — mapFieldToDescriptor() — maps Drizzle Field row to LLM-optimized FieldDescriptor
- `packages/shared/ai/schema-descriptor/table-builder.ts` — buildTableDescriptor() — assembles TableDescriptor with pg_stat row counts and cross-link metadata
- `packages/shared/ai/schema-descriptor/workspace-builder.ts` — buildWorkspaceDescriptor() — assembles full WorkspaceDescriptor with base grouping and deduplicated link_graph
- `packages/shared/ai/schema-descriptor/__tests__/field-mapper.test.ts` — 46 unit tests for field mapper (all MVP field types, select options, currency_code, linked_record metadata)
- `packages/shared/ai/schema-descriptor/__tests__/table-builder.integration.test.ts` — Integration tests for table builder (tenant isolation, pg_stat row counts, cross-link batch fetch)
- `packages/shared/ai/schema-descriptor/__tests__/workspace-builder.integration.test.ts` — Integration tests for workspace builder (base grouping, native tables, link_graph deduplication)

### Files Modified
- (none beyond files created above)

### Files Deleted
- (none)

### Schema Changes
- None

### New Domain Terms Introduced
- `SchemaDescriptorService / SDS` — Service that produces LLM-optimized workspace metadata for AI consumption
- `WorkspaceDescriptor` — Top-level LLM-optimized schema for a workspace (bases, tables, fields, link_graph)
- `BaseDescriptor` — Groups tables by their source platform base connection
- `TableDescriptor` — Per-table metadata with approximate row count and field descriptors
- `FieldDescriptor` — Per-field metadata with type-specific hints (searchable, aggregatable, options, linked metadata)
- `LinkEdge` — Cross-link relationship in the workspace link graph (from/to dotted paths, cardinality, label)

### Notes
- `linked_base` is not set by `mapFieldToDescriptor()` — requires base connection lookup; workspace builder resolves this via tableToBaseMap.
- All 8 interface contracts verified: 5 types exported, 3 functions exported with correct signatures.

---

## Session F — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 11–12 (Unit 5)

### Files Created
- `apps/web/src/components/cross-links/link-picker-provider.tsx` — LinkPickerProvider context managing Link Picker state (open/close, mode, selectedIds)
- `apps/web/src/components/cross-links/use-link-picker.ts` — useLinkPicker hook with open/close/select/confirm/remove actions
- `apps/web/src/components/cross-links/link-picker.tsx` — LinkPicker dialog with Command (cmdk) search, recent section, single/multi-link modes
- `apps/web/src/components/cross-links/link-picker-search-results.tsx` — LinkPickerSearchResults with card_fields preview, permission-aware filtering, scroll-to-load
- `apps/web/src/components/cross-links/link-picker-inline-create.tsx` — LinkPickerInlineCreate for creating new records directly from the Link Picker
- `apps/web/src/components/cross-links/linked-record-chip.tsx` — LinkedRecordChip displaying linked record display value with click-to-open
- `apps/web/src/components/cross-links/__tests__/LinkPickerInlineCreate.test.tsx` — Unit tests for inline create component
- `apps/web/src/components/cross-links/__tests__/LinkedRecordChip.test.tsx` — Unit tests for LinkedRecordChip component

### Files Modified
- `apps/web/src/data/cross-links.ts` — Added `searchLinkableRecords()` (tsvector prefix matching + scope filter) and `getRecentLinkedRecords()`
- `apps/web/src/components/grid/cells/` — Linked Record cell — Link Picker integration
- `apps/web/src/components/record-view/` — Linked field — Link Picker integration
- `apps/web/messages/en.json` — Added `link_picker` namespace with i18n keys
- `apps/web/messages/es.json` — Added `link_picker` namespace with Spanish translations

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session E — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 9–10 (Unit 4)

### Files Created
- `apps/worker/src/processors/cross-link/cascade.ts` — Cross-link display value cascade processor with content hash optimization, batched updates, single-hop rule
- `apps/worker/src/processors/cross-link/index-rebuild.ts` — Cross-link index rebuild processor with cursor-based pagination
- `apps/worker/src/processors/cross-link/integrity-check.ts` — Cross-link integrity check with adaptive sampling and conditional rebuild
- `apps/worker/src/processors/cross-link/__tests__/cascade.test.ts` — Unit tests for cascade processor

### Files Modified
- `packages/shared/queue/constants.ts` — Added `cross-link` to `QUEUE_NAMES`
- `packages/shared/queue/types.ts` — Added `CrossLinkCascadeJobData`, `CrossLinkIndexRebuildJobData` types
- `apps/web/src/lib/cross-link-cascade.ts` — Replaced stub with real BullMQ enqueue implementation with backpressure
- `packages/shared/realtime/events.ts` — Added `DISPLAY_VALUE_UPDATED` to `REALTIME_EVENTS`
- `apps/worker/src/index.ts` — Registered cross-link processors
- `apps/worker/src/queues.ts` — Registered cross-link queue

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session D — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 7–8 (Unit 3)

### Files Created
- `apps/web/src/data/cross-link-resolution.ts` — L0/L1/L2 resolution functions, permission intersection, LinkedRecordTree type
- `apps/web/src/data/__tests__/cross-link-resolution.integration.test.ts` — Integration tests for all resolution levels, permissions, and tenant isolation

### Files Modified
- None

### Schema Changes
- None

### New Domain Terms Introduced
- `LinkedRecordTree` — Return type for L2 bounded traversal containing root, levels, and truncation state

---

## Session C — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 5–6 (Unit 2, second half)

### Files Created
- `apps/web/src/lib/cross-link-cascade.ts` (stub — replaced in Unit 4)

### Files Modified
- `apps/web/src/actions/cross-link-actions.ts` (added linkRecords, unlinkRecords)
- `packages/shared/testing/factories.ts` (added createTestCrossLinkWithIndex)
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extended)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session B — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-14
**Status:** docs-synced
**Prompt(s):** Prompts 3–4 (Unit 2, first half)

### Files Created
- `apps/web/src/actions/cross-link-actions.ts`
- `apps/web/src/actions/__tests__/cross-link-actions.test.ts`

### Files Modified
- `apps/web/src/data/cross-links.ts` (added 5 new data functions)
- `apps/web/src/data/__tests__/cross-links.integration.test.ts` (extended)

### Schema Changes
- None

### New Domain Terms Introduced
- None

---

## Session A — 3B-i Cross-Linking Engine — build/3b-i-cross-linking

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 1–2 (Unit 1)

### Files Created
- `packages/shared/sync/cross-link-types.ts` — Types, constants, and canonical field value utilities for cross-linking
- `packages/shared/sync/cross-link-schemas.ts` — Zod validation schemas for cross-link CRUD and linking ops
- `packages/shared/sync/cross-link-field-type.ts` — FieldTypeRegistry registration for `linked_record` on canonical platform
- `packages/shared/sync/__tests__/cross-link-types.test.ts` — Unit tests for cross-link types and utilities
- `packages/shared/sync/__tests__/cross-link-schemas.test.ts` — Unit tests for cross-link Zod schemas
- `packages/shared/sync/__tests__/cross-link-field-type.test.ts` — Unit tests for linked_record registry registration

### Files Modified
- `TASK-STATUS.md` — Updated Unit 1 status to passed-review

### Schema Changes
- None

### New Domain Terms Introduced
- None (RelationshipType, CrossLinkFieldValue, LinkScopeFilter already in GLOSSARY)

---

## Session A — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 1–2 (Unit 1)

### Files Created
- `packages/shared/auth/permissions/types.ts`
- `packages/shared/auth/permissions/schemas.ts`
- `packages/shared/auth/permissions/resolve.ts`
- `packages/shared/auth/permissions/resolve.test.ts`
- `packages/shared/auth/permissions/index.ts`

### Files Modified
- `packages/shared/auth/index.ts` (added permission re-exports)

### Schema Changes
- None

### New Domain Terms Introduced
- `FieldPermissionState` — Union type for field access levels: `read_write | read_only | hidden`
- `ViewPermissions` — Interface defining role/user access and field permissions for a Table View
- `ViewFieldPermissions` — Interface grouping role restrictions and individual overrides for a view
- `RoleRestriction` — Interface for Layer 2a per-role field access narrowing
- `IndividualOverride` — Interface for Layer 2b per-user field access override
- `FieldPermissionMap` — Map<fieldId, FieldPermissionState> returned by batch resolution
- `ResolvedPermissionContext` — Interface containing all inputs needed for the 7-step permission cascade

## Session B — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 3–4 (Unit 2)

### Files Created
- `apps/web/src/data/permissions.ts`
- `apps/web/src/data/permissions.test.ts`
- `apps/web/src/data/permissions.integration.test.ts`

### Files Modified
- `packages/shared/testing/factories.ts` (added createTestViewWithPermissions)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session C — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 5–7 (Units 3 + 4)

### Files Created
- apps/web/src/lib/auth/field-permissions.ts
- apps/web/src/lib/auth/field-permissions.test.ts
- apps/web/src/lib/realtime/permission-events.ts
- apps/web/src/lib/realtime/permission-handlers.ts
- apps/web/src/lib/realtime/permission-events.test.ts

### Files Modified
- packages/shared/realtime/events.ts (added PERMISSION_UPDATED)
- packages/shared/realtime/types.ts (added PermissionUpdatedPayload)
- apps/web/src/actions/record-actions.ts (added permission checks)
- apps/web/src/data/records.ts (added filterHiddenFields)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session D — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 8–9 (Unit 5)

### Files Created
- apps/web/src/hooks/use-field-permissions.ts
- apps/web/src/hooks/use-field-permissions.test.ts
- apps/web/src/components/permissions/PermissionProvider.tsx

### Files Modified
- apps/web/src/components/grid/DataGrid.tsx (permission-aware column filtering)
- apps/web/src/components/grid/GridCell.tsx (read-only prop)
- apps/web/src/components/grid/GridHeader.tsx (lock icon for read-only)
- apps/web/src/components/grid/BulkActionsToolbar.tsx (permission gating)
- apps/web/src/components/record-view/ (hidden/read-only fields)
- apps/web/src/components/card-view/ (hidden fields)
- apps/web/messages/en.json (permission i18n keys)
- apps/web/messages/es.json (permission i18n keys)

### Schema Changes
- None

### New Domain Terms Introduced
- None

## Session E — 3A-iii — build/3a-iii-field-permissions

**Date:** 2026-03-13
**Status:** docs-synced
**Prompt(s):** Prompts 10–11 (Unit 6 — phase complete)

### Files Created
- apps/web/src/actions/permission-actions.ts
- apps/web/src/actions/permission-actions.test.ts
- apps/web/src/components/permissions/PermissionStateBadge.tsx
- apps/web/src/components/permissions/RoleLevelPermissionGrid.tsx
- apps/web/src/components/permissions/PermissionConfigPanel.tsx
- apps/web/src/components/permissions/IndividualOverrideView.tsx
- apps/web/src/components/permissions/IndividualOverrideView.test.tsx

### Files Modified
- apps/web/messages/en.json (permission config i18n keys)
- apps/web/messages/es.json (permission config i18n keys)

### Schema Changes
- None

### New Domain Terms Introduced
- Permission Config Panel, RoleLevelPermissionGrid, IndividualOverrideView, PermissionStateBadge
