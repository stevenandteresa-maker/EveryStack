# Phase 3D — Document Templates & PDF Generation — Prompting Roadmap

## Overview

- **Sub-phase:** 3D — Document Templates & PDF Generation
- **Playbook:** `docs/Playbooks/playbook-phase-3d.md`
- **Subdivision doc:** `docs/subdivisions/3d-subdivision.md`
- **Units:** 5 — (1) Document Template Data Layer, (2) TipTap Env 2 Editor Core, (3) Merge-Tag Resolution & Field Inserter, (4) PDF Generation Pipeline, (5) Template Management & Document Generation UI
- **Estimated duration:** 2–3 days across all 6 steps
- **Prior sub-phase:** Phase 3C — Record Thread, DMs, Notifications & System Email (complete, merged to main, tagged `v0.3.0-phase-3c`)

## Section Index

| Section | Summary |
|---------|---------|
| Overview | Sub-phase metadata, 5 units, 2-3 day estimate, Units 1 and 2 parallel |
| Step 3 — Build Execution | 11 prompts in 5 units: template data layer, TipTap Env 2, merge-tag resolution, PDF pipeline, template/generation UI |

---

## STEP 0 — DOC PREP (Architect Agent)

> **Already complete.** No doc changes were required for Phase 3D — the `smart-docs.md` reference doc, `data-model.md` schema, and `GLOSSARY.md` Document Template definition are all up to date from prior reconciliation work. Proceed to Step 3.

---

## STEP 1 — PLAYBOOK GENERATION

> **Already complete.** The playbook is at `docs/Playbooks/playbook-phase-3d.md` (11 prompts, 5 units, 5 VERIFY boundaries). Proceed to Step 3.

---

## STEP 2 — PROMPTING ROADMAP GENERATION

> **You're reading the output of Step 2.** Proceed to Step 3.

---

## STEP 3 — BUILD + VERIFY EXECUTION

Step 3 alternates between BUILD sessions and VERIFY sessions in separate Claude Code contexts. BUILD contexts write code. VERIFY contexts run tests and fix failures. This keeps each context lean.

This sub-phase has **5 units**. Units 1 and 2 can be built in parallel (they don't depend on each other). Units 3–5 are sequential.

### Setup

```
[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b build/3d-document-templates
```

```
[STATE UPDATE]
Open TASK-STATUS.md. Find the Phase 3D section.
All units should show `pending`. No changes needed yet.
```

---

### ═══ UNIT 1: Document Template Data Layer ═══

**What This Unit Builds:**
This creates the "plumbing" for document templates — the ability to create, read, update, duplicate, and delete document templates, plus look up any PDF documents that have been generated. Think of it as building the filing system before you build the document editor.

**What Comes Out of It:**
When done, the system can store and retrieve document templates, manage their lifecycle (create, edit, copy, delete), validate inputs, and has test helpers for all downstream units to use. Every other unit in this phase depends on these functions.

**What It Needs from Prior Work:**
Nothing — this is the first unit. The database tables already exist from Phase 1B.

---

### BUILD SESSION A — Unit 1, Prompts 1–2

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 1 to `in-progress`.
Add branch name: `build/3d-document-templates`.
```

Open Claude Code. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 1: Data Functions for Looking Up Templates and Generated Documents

**What This Builds:**
This creates the query functions that let the app look up document templates by ID or by table, and look up generated PDFs by ID or by record. These are simple database read operations with tenant isolation — every query is scoped to the current tenant so one organization can never see another's templates.

**What You'll See When It's Done:**
Claude Code will create 4 new files (2 data files + 2 test files). Tests will pass showing tenant isolation works correctly.

**How Long This Typically Takes:** 5–10 minutes

```
[PASTE INTO CLAUDE CODE]
You are the Builder Agent for EveryStack Phase 3D — Document Templates & PDF Generation.

## Context
Read these reference docs:
- `docs/reference/smart-docs.md` lines 337–414 (Document Generation — Two Prongs)
- `docs/reference/GLOSSARY.md` lines 392–409 (Document Template definition)

## Existing Schema
The `document_templates` and `generated_documents` tables already exist in `packages/shared/db/schema/`. Read those files for exact column definitions.

Reference pattern: `apps/web/src/data/threads.ts` — the most recent well-tested data function pattern.

## Task
Create data access functions for document templates and generated documents following the `getDbForTenant()` pattern.

**`apps/web/src/data/document-templates.ts`:**
1. `getDocumentTemplate(tenantId: string, templateId: string): Promise<DocumentTemplate | null>` — fetch by ID with tenant isolation, join creator name for display.
2. `listDocumentTemplates(tenantId: string, tableId: string): Promise<DocumentTemplate[]>` — list all templates for a table, ordered by `updated_at` desc. Include creator name.
3. Both functions must filter by `tenant_id` for RLS compliance.

**`apps/web/src/data/generated-documents.ts`:**
1. `getGeneratedDocument(tenantId: string, documentId: string): Promise<GeneratedDocument | null>` — fetch by ID with tenant isolation.
2. `listGeneratedDocuments(tenantId: string, recordId: string): Promise<GeneratedDocument[]>` — list all generated documents for a source record, ordered by `generated_at` desc. Include template name join.

**Tests:** Write tenant isolation tests for all 4 data functions using `testTenantIsolation()`. Test that `listDocumentTemplates` correctly scopes to `tableId`. Test that `listGeneratedDocuments` correctly scopes to `recordId`.

## Acceptance Criteria
- [ ] `getDocumentTemplate()` returns template with creator name when found, null when not found
- [ ] `listDocumentTemplates()` returns templates for the given table, ordered by updated_at desc
- [ ] `getGeneratedDocument()` returns generated document when found, null when not found
- [ ] `listGeneratedDocuments()` returns generated docs for the given record, ordered by generated_at desc
- [ ] `testTenantIsolation()` passes for all 4 data functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- Template creation/update server actions (next prompt)
- Zod validation schemas (next prompt)
- Any merge-tag resolution logic
- PDF generation

No migration required.

Git: Commit with message "feat(documents): add document template and generated document data functions [Phase 3D, Prompt 1]"
```

```
[CHECKPOINT]
Look for:
- 4 new files created (2 data + 2 test files)
- All tests passing
- TypeScript compiles with zero errors
```

---

#### PROMPT 2: Server Actions, Validation Schemas, and Test Factories

**What This Builds:**
This creates the "write" side — the actions users trigger when they create, edit, copy, or delete templates. It also creates validation rules (Zod schemas) so bad data can't get in, and test helpers (factories) that every other unit will use to create test data.

**What You'll See When It's Done:**
Claude Code will create several new files. Key thing to look for: the duplicate action copies templates with "(Copy)" appended to the name, and delete is blocked when generated documents exist.

**How Long This Typically Takes:** 10–15 minutes

```
[PASTE INTO CLAUDE CODE]
Continue building Phase 3D — Document Templates.

## Task
Create server actions, Zod validation schemas, and test factories for document templates.

**Zod schemas (`apps/web/src/lib/schemas/document-templates.ts`):**
1. `createDocumentTemplateSchema` — validates: `name` (string, 1–255 chars), `tableId` (uuid), `content` (optional, defaults to empty TipTap doc `{ type: "doc", content: [] }`), `settings` (optional, defaults to `{ pageSize: "A4", orientation: "portrait", margins: { top: 20, right: 20, bottom: 20, left: 20 } }`)
2. `updateDocumentTemplateSchema` — validates: `name` (optional string 1–255), `content` (optional JSONB), `settings` (optional JSONB). At least one field required.

**Server actions (`apps/web/src/actions/document-templates.ts`):**
1. `createDocumentTemplate` — validate with Zod, get tenant from auth context, insert via Drizzle, return created template.
2. `updateDocumentTemplate` — validate, verify template belongs to tenant, increment `version`, update.
3. `duplicateDocumentTemplate` — load existing template, copy `content` and `settings`, set `name` to `"{originalName} (Copy)"`, create new template.
4. `deleteDocumentTemplate` — verify template belongs to tenant, hard delete. If generated documents exist for this template, block deletion with error.

**Test factories (`packages/shared/testing/factories/document-templates.ts`):**
1. `createTestDocumentTemplate(overrides?)` — creates a template with sensible defaults (name, content as empty TipTap doc, settings with A4 defaults).
2. `createTestGeneratedDocument(overrides?)` — creates a generated document with defaults (file_url, file_type: 'pdf').
3. Export both from `packages/shared/testing/factories/index.ts`.

**Tests:** Test all 4 server actions. Test that duplicate copies content correctly and appends "(Copy)". Test that delete blocks when generated documents exist. Test Zod schema validation (valid/invalid inputs).

## Acceptance Criteria
- [ ] `createDocumentTemplateSchema` and `updateDocumentTemplateSchema` validate correctly with proper defaults
- [ ] `createDocumentTemplate` action creates template with Zod validation and auth context
- [ ] `updateDocumentTemplate` action validates ownership, increments version
- [ ] `duplicateDocumentTemplate` copies content/settings, appends "(Copy)" to name
- [ ] `deleteDocumentTemplate` blocks deletion when generated documents exist
- [ ] All server actions exported from `apps/web/src/actions/document-templates.ts`
- [ ] Zod schemas exported from `apps/web/src/lib/schemas/document-templates.ts`
- [ ] Both test factories exported from `packages/shared/testing/factories/`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- `generateDocument` server action (Unit 4 — separate concern)
- Merge-tag resolution (Unit 3)
- Template editor UI (Unit 5)
- AI Draft capability (Phase 5)

No migration required.

Git: Commit with message "feat(documents): add template server actions, Zod schemas, and test factories [Phase 3D, Prompt 2]"
```

```
[CHECKPOINT]
Look for:
- All 4 server actions working
- Factory functions creating valid test data
- Zod schema defaults: A4 page size, portrait orientation, 20mm margins
- Delete correctly blocked when generated docs exist
```

---

### VERIFY SESSION A — Unit 1, Prompts 1–2 — Completes Unit 1

**What This Step Does:**
This runs the full test suite against everything Unit 1 built. It also checks that Unit 1 produced everything it promised.

Close the BUILD session. Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3D Prompts 1–2 (Unit 1 — Document Template Data Layer):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met

Manual verification:
- Confirm `DocumentTemplate` and `GeneratedDocument` types are importable from schema
- Confirm all 4 data functions return correctly typed results

Interface contract verification (Unit 1):
- [ ] `getDocumentTemplate()` exported from `apps/web/src/data/document-templates.ts`
- [ ] `listDocumentTemplates()` exported from `apps/web/src/data/document-templates.ts`
- [ ] `getGeneratedDocument()` exported from `apps/web/src/data/generated-documents.ts`
- [ ] `listGeneratedDocuments()` exported from `apps/web/src/data/generated-documents.ts`
- [ ] All 4 server actions exported from `apps/web/src/actions/document-templates.ts`
- [ ] Zod schemas exported from `apps/web/src/lib/schemas/document-templates.ts`
- [ ] Both test factories exported from `packages/shared/testing/factories/`
- [ ] `DocumentTemplate` and `GeneratedDocument` types available via schema re-export

Fix any failures. Commit fixes.
```

```
[CHECKPOINT]
All checks must pass with zero errors.
All contract items must be verified.
If failing: Claude Code will attempt to fix.
If still failing: paste "The [check] is failing with [error]. Fix it."
```

```
[GIT COMMAND]
git add -A
git commit -m "chore(verify): verify prompts 1–2, unit 1 complete [Phase 3D, VP-1]"
git push origin build/3d-document-templates
```

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 1 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session A — Phase 3D — build/3d-document-templates

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 1–2 (Unit 1 — Document Template Data Layer)

### Files Created
- apps/web/src/data/document-templates.ts
- apps/web/src/data/generated-documents.ts
- apps/web/src/data/document-templates.test.ts
- apps/web/src/data/generated-documents.test.ts
- apps/web/src/actions/document-templates.ts
- apps/web/src/actions/document-templates.test.ts
- apps/web/src/lib/schemas/document-templates.ts
- packages/shared/testing/factories/document-templates.ts

### Files Modified
- packages/shared/testing/factories/index.ts (added factory exports)

### Schema Changes
- None (tables exist from 1B)

### New Domain Terms Introduced
- None
```

---

### ═══ UNIT 2: TipTap Environment 2 Editor Core ═══

**What This Unit Builds:**
This creates the rich-text document editor — the surface where users design their document templates. Think of it like a Google Docs-style editor, but built specifically for template authoring. It has a toolbar for formatting, a slash command menu (type "/" to insert blocks), floating toolbars, drag handles for reordering, and custom "nodes" like merge tags (teal pills that represent data fields) and callouts (colored info boxes).

**What Comes Out of It:**
When done, you have a fully functional rich-text editor component that can be embedded in the template editor page. It supports all the formatting needed for professional documents — headings, tables, code blocks, images, and special EveryStack nodes.

**What It Needs from Prior Work:**
Nothing — this unit can be built in parallel with Unit 1. It uses TipTap libraries and existing UI components.

> **Note:** Units 1 and 2 have no dependency on each other. If you have two Claude Code windows available, you could run them simultaneously. Otherwise, just proceed sequentially.

---

### BUILD SESSION B — Unit 2, Prompts 3–5

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 2 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 3: TipTap Extensions and Custom Nodes (MergeTag, RecordRef, Callout)

**What This Builds:**
This sets up the foundation for the document editor — configuring all the text formatting extensions (bold, italic, headings, tables, etc.) and building three custom "node types" unique to EveryStack: (1) MergeTag — a teal pill that represents a data field placeholder, (2) RecordRef — an inline chip linking to another record, and (3) Callout — a colored info/warning/success/error box.

**What You'll See When It's Done:**
Claude Code will create a new `apps/web/src/components/editor/extensions/` directory with the extension bundle and three custom node subdirectories. Each custom node has a TipTap extension file and a React view component.

**How Long This Typically Takes:** 15–20 minutes

```
[PASTE INTO CLAUDE CODE]
You are the Builder Agent for EveryStack Phase 3D — Document Templates & PDF Generation.

## Context
Read these reference docs:
- `docs/reference/smart-docs.md` lines 49–163 (TipTap Editor Architecture — component structure)
- `docs/reference/smart-docs.md` lines 165–195 (TipTap JSONB Document Schema)
- `docs/reference/smart-docs.md` lines 197–208 (Custom EveryStack Node Definitions)
- `docs/reference/GLOSSARY.md` lines 392–409 (Document Template)

Reference the Env 1 chat editor extensions at `apps/web/src/components/chat/extensions.ts` for pattern guidance. Env 2 is a superset.

## Task
Create the TipTap extension configuration and three custom node types for the Smart Doc editor (Environment 2).

**Extension bundle (`apps/web/src/components/editor/extensions/index.ts`):**
Configure and export `smartDocExtensions` — the full extension bundle. Include:
- StarterKit (bold, italic, strike, code, headings H1–H4, bullet/ordered lists, blockquote, horizontal rule, hard break, history)
- Underline, Highlight
- Link (with preview popup)
- Image (upload to R2, drag-resize, caption, alt text)
- Table (column/row controls, header rows, merge cells)
- CodeBlock (syntax highlighting via `@tiptap/extension-code-block-lowlight` + `lowlight`)
- TaskList / TaskItem
- Placeholder, Typography, CharacterCount
- TextAlign (left, center, right, justify)
- Color / TextStyle
- Custom: MergeTag, RecordRef, Callout, SlashCommand (shell — full impl in next prompt)

**MergeTag custom node (`extensions/merge-tag/`):**
1. `MergeTag.ts` — TipTap `Node.create()`. Attrs: `{ tableId: string, fieldId: string, fallback: string }`. Inline node, not editable. Group: `inline`. Content: none. Atom: true.
2. `MergeTagView.tsx` — React `NodeViewWrapper`. Renders as teal pill (`bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-sm inline-flex items-center gap-1`) with a field type icon and field name display.

**RecordRef custom node (`extensions/record-ref/`):**
1. `RecordRef.ts` — Attrs: `{ tableId: string, recordId: string, displayText: string }`. Inline, atom.
2. `RecordRefView.tsx` — Renders as inline chip with record icon.

**Callout custom node (`extensions/callout/`):**
1. `Callout.ts` — Attrs: `{ emoji: string (default "ℹ️"), color: string (default "blue") }`. Block node. Content: `block+`. 4 variants: info (blue), warning (yellow), success (green), error (red).
2. `CalloutView.tsx` — React `NodeViewWrapper`. Colored left border + background + emoji. Content editable area.

## Acceptance Criteria
- [ ] `smartDocExtensions` exports a configured extension array with all core TipTap extensions
- [ ] MergeTag node stores `{ tableId, fieldId, fallback }` attrs and is inline + atom
- [ ] MergeTag renders as teal pill with field icon
- [ ] RecordRef renders as inline chip
- [ ] Callout has 4 variants (info/warning/success/error)
- [ ] Editor outputs valid TipTap JSON
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- SlashCommand full implementation (next prompt)
- EditorToolbar / BubbleToolbar / BlockHandle (Prompt 5)
- SmartDocEditor wrapper component (next prompt)
- Embed, Signature, FileAttachment, DatabaseViewEmbed nodes (post-MVP)
- Toggle node (post-MVP)
- Collaboration via Yjs/Hocuspocus (post-MVP)
- Backlinks `[[page]]` (post-MVP)

No migration required.

Git: Commit with message "feat(editor): add TipTap Env 2 extension config and custom nodes [Phase 3D, Prompt 3]"
```

```
[CHECKPOINT]
Look for:
- New `apps/web/src/components/editor/extensions/` directory
- MergeTag, RecordRef, Callout each have .ts + .tsx files
- Extension index exports `smartDocExtensions`
```

---

#### PROMPT 4: Editor Shell, Hook, and Slash Command Menu

**What This Builds:**
This creates the main editor component (`SmartDocEditor`) and its initialization hook, plus the slash command system. The editor is a shell with slots for a toolbar at the top, a content area in the middle, and a sidebar on the right (for the merge-tag inserter, built in Unit 3). The slash command menu lets users type "/" to insert block types like headings, lists, tables, and callouts.

**What You'll See When It's Done:**
A working `SmartDocEditor` component that can be rendered in a page. Typing "/" opens a filterable block-insertion menu. Content is saved as TipTap JSON.

**How Long This Typically Takes:** 10–15 minutes

```
[PASTE INTO CLAUDE CODE]
Continue building Phase 3D — TipTap Env 2 Editor.

## Context
Read `docs/reference/smart-docs.md` lines 49–98 (Environment 2 editor, UX pattern) and lines 108–163 (React component structure).

Reference the Env 1 `apps/web/src/components/chat/use-chat-editor.ts` hook for pattern.

## Task
Create the SmartDocEditor shell, useSmartDocEditor hook, and SlashCommand extension.

**`useSmartDocEditor` hook (`apps/web/src/components/editor/use-smart-doc-editor.ts`):**
Initializes a TipTap `Editor` instance with the `smartDocExtensions` bundle. Options:
- `content?: TipTapJSON` — initial document content (for loading saved templates)
- `onUpdate?: (content: TipTapJSON) => void` — callback on content change (for auto-save)
- `editable?: boolean` — defaults to true
- `placeholder?: string`

**`SmartDocEditor` component (`apps/web/src/components/editor/SmartDocEditor.tsx`):**
Main editor wrapper. Accepts: `content`, `onUpdate`, `editable`, `className`, `renderToolbar?: (editor: Editor) => ReactNode` (slot for toolbar), `renderSidebar?: () => ReactNode` (slot for merge-tag inserter sidebar).
Layout: toolbar slot at top → editor content area (full width minus sidebar) → sidebar slot on right. Uses `EditorContent` from `@tiptap/react`. Styled with `prose` Tailwind typography classes.

**SlashCommand extension (`apps/web/src/components/editor/extensions/slash-command/`):**
1. `SlashCommand.ts` — TipTap Suggestion extension. Triggers on `/` at start of line or after whitespace.
2. `SlashCommandList.tsx` — Floating popup. Keyboard navigable (arrow keys + enter). Filterable.
3. `commands.ts` — Block type registry. MVP commands: Heading 1–4, Bullet List, Ordered List, Task List, Blockquote, Code Block, Table, Image, Callout (4 variants), Horizontal Rule.

## Acceptance Criteria
- [ ] `SmartDocEditor` exported and renders with toolbar slot, content area, and sidebar slot
- [ ] `useSmartDocEditor` initializes TipTap editor with smartDocExtensions, accepts content and onUpdate
- [ ] Editor loads saved TipTap JSON content correctly
- [ ] Editor outputs valid TipTap JSON on changes via onUpdate callback
- [ ] Slash command menu opens on `/` and lists available block types
- [ ] Slash command menu is keyboard navigable and filterable
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- EditorToolbar (next prompt)
- BubbleToolbar (next prompt)
- BlockHandle (next prompt)
- Breadcrumb navigation (post-MVP — wiki contexts only)

No migration required.

Git: Commit with message "feat(editor): add SmartDocEditor shell, hook, and slash command [Phase 3D, Prompt 4]"
```

```
[CHECKPOINT]
Look for:
- SmartDocEditor renders with content area
- Typing "/" opens the slash command menu
- Selecting a command inserts the block type
```

---

#### PROMPT 5: Editor Toolbar, Bubble Menu, and Block Handles

**What This Builds:**
This adds the three interaction surfaces around the editor content: (1) a fixed toolbar at the top with formatting buttons (bold, italic, headings, etc.), (2) a floating "bubble" toolbar that appears when you select text, and (3) block handles that appear when you hover over content blocks for drag-to-reorder.

**What You'll See When It's Done:**
The toolbar shows formatting groups. Selecting text pops up the bubble toolbar. Hovering over blocks shows a drag handle on the left.

**How Long This Typically Takes:** 10–15 minutes

```
[PASTE INTO CLAUDE CODE]
Continue building Phase 3D — TipTap Env 2 Editor.

## Context
Read `docs/reference/smart-docs.md` lines 108–163 (React component structure — toolbar, menus) and lines 49–98 (UX Pattern).

## Task
Create the EditorToolbar, BubbleToolbar, and BlockHandle components.

**`EditorToolbar` (`apps/web/src/components/editor/toolbar/EditorToolbar.tsx`):**
Fixed top toolbar. Accepts TipTap `Editor` instance. Contains 4 groups:
1. `FormatGroup.tsx` — Bold, Italic, Underline, Strike, Code, Highlight, Text Color. Toggle buttons with active state.
2. `AlignGroup.tsx` — Left, Center, Right, Justify.
3. `InsertGroup.tsx` — Link, Image upload, Table insert, Code Block, Callout.
4. `HistoryGroup.tsx` — Undo, Redo.
Each group separated by a divider. Use shadcn `Toggle` or `Button` with `variant="ghost"` and `size="sm"`.

**`BubbleToolbar` (`apps/web/src/components/editor/menus/BubbleToolbar.tsx`):**
Floating toolbar on text selection. Uses TipTap's `BubbleMenu` from `@tiptap/react`. Inline formatting: Bold, Italic, Underline, Strike, Code, Link, Highlight, Text Color.

**`BlockHandle` (`apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx`):**
Appears on hover left of each block. Drag handle for reorder. Click opens menu: Delete block, Duplicate block, Move up, Move down.

## Acceptance Criteria
- [ ] EditorToolbar contains FormatGroup, AlignGroup, InsertGroup, HistoryGroup with correct actions
- [ ] Format buttons show active state when formatting is applied
- [ ] BubbleToolbar appears on text selection with inline formatting options
- [ ] BlockHandle appears on block hover for drag-reorder
- [ ] Block handle drag-reorder moves blocks within the document
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- BlockMenu beyond basic actions (post-MVP)
- FloatingPlus (post-MVP)
- Breadcrumb navigation (post-MVP)
- Mention extension in editor toolbar (Env 1 only)

No migration required.

Git: Commit with message "feat(editor): add toolbar, bubble menu, and block handles [Phase 3D, Prompt 5]"
```

```
[CHECKPOINT]
Look for:
- Toolbar renders with 4 groups
- Text selection shows bubble toolbar
- Block hover shows drag handle
```

---

### VERIFY SESSION B — Unit 2, Prompts 3–5 — Completes Unit 2

**What This Step Does:**
This verifies the entire TipTap Env 2 editor — extensions, custom nodes, slash command, toolbar, bubble menu, and block handles — all work together.

Close the BUILD session. Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3D Prompts 3–5 (Unit 2 — TipTap Env 2 Editor Core):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met

Manual verification:
- Render SmartDocEditor in a test page
- Type content, verify toolbar actions work
- Verify slash command opens on "/"
- Verify MergeTag, RecordRef, and Callout nodes render correctly when inserted

Interface contract verification (Unit 2):
- [ ] `SmartDocEditor` exported from `apps/web/src/components/editor/SmartDocEditor.tsx`
- [ ] `useSmartDocEditor` exported from `apps/web/src/components/editor/use-smart-doc-editor.ts`
- [ ] `smartDocExtensions` exported from `apps/web/src/components/editor/extensions/index.ts`
- [ ] `MergeTag` extension exported
- [ ] `MergeTagView` renders as teal pill
- [ ] `RecordRef` extension exported
- [ ] `RecordRefView` renders as inline chip
- [ ] `Callout` extension exported with 4 variants
- [ ] `CalloutView` renders colored callout
- [ ] `SlashCommand` extension exported
- [ ] `SlashCommandList` popup exported
- [ ] `EditorToolbar` exported
- [ ] `BubbleToolbar` exported
- [ ] `BlockHandle` exported

Fix any failures. Commit fixes.
```

```
[CHECKPOINT]
All checks must pass with zero errors.
All 14 contract items must be verified.
```

```
[GIT COMMAND]
git add -A
git commit -m "chore(verify): verify prompts 3–5, unit 2 complete [Phase 3D, VP-2]"
git push origin build/3d-document-templates
```

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 2 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session B — Phase 3D — build/3d-document-templates

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 3–5 (Unit 2 — TipTap Env 2 Editor Core)

### Files Created
- apps/web/src/components/editor/SmartDocEditor.tsx
- apps/web/src/components/editor/use-smart-doc-editor.ts
- apps/web/src/components/editor/extensions/index.ts
- apps/web/src/components/editor/extensions/merge-tag/MergeTag.ts
- apps/web/src/components/editor/extensions/merge-tag/MergeTagView.tsx
- apps/web/src/components/editor/extensions/record-ref/RecordRef.ts
- apps/web/src/components/editor/extensions/record-ref/RecordRefView.tsx
- apps/web/src/components/editor/extensions/callout/Callout.ts
- apps/web/src/components/editor/extensions/callout/CalloutView.tsx
- apps/web/src/components/editor/extensions/slash-command/SlashCommand.ts
- apps/web/src/components/editor/extensions/slash-command/SlashCommandList.tsx
- apps/web/src/components/editor/extensions/slash-command/commands.ts
- apps/web/src/components/editor/toolbar/EditorToolbar.tsx
- apps/web/src/components/editor/toolbar/FormatGroup.tsx
- apps/web/src/components/editor/toolbar/AlignGroup.tsx
- apps/web/src/components/editor/toolbar/InsertGroup.tsx
- apps/web/src/components/editor/toolbar/HistoryGroup.tsx
- apps/web/src/components/editor/menus/BubbleToolbar.tsx
- apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx

### Files Modified
- None

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### ═══ UNIT 3: Merge-Tag Resolution & Field Inserter ═══

**What This Unit Builds:**
This is the "bridge" between templates and real data. The merge-tag resolution service takes a template document and a specific record, finds all the placeholder merge tags, and replaces them with actual field values — including values from linked records in other tables. The field inserter is a sidebar where template authors can browse available fields and click to insert them as merge tags.

**What Comes Out of It:**
When done, the system can resolve all merge tags in a template to real data, render the resolved content as HTML, and the sidebar lets authors browse and insert fields (including fields from linked tables). There's also a three-mode preview toggle: Edit (pills), Preview (resolved data), Raw (placeholder text).

**What It Needs from Prior Work:**
This unit uses the DocumentTemplate types from Unit 1. It also uses existing cross-link resolution functions from Phase 3B-i and field permissions from Phase 3A-iii.

---

### BUILD SESSION C — Unit 3, Prompts 6–7

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 3 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 6: Merge-Tag Resolution Service

**What This Builds:**
This creates the engine that takes a document template and replaces all merge-tag placeholders with actual data from a record. For example, a merge tag for "Client Name" gets replaced with "Acme Corp." It handles both direct fields (from the record's own table) and linked fields (from records in connected tables via cross-links).

**What You'll See When It's Done:**
Two new functions: `resolveMergeTags()` (replaces tags with data, returns JSON) and `resolveAndRenderHTML()` (same but outputs HTML). Tests verify resolution works for direct fields, linked fields, and null/missing fields with fallbacks.

**How Long This Typically Takes:** 10–15 minutes

```
[PASTE INTO CLAUDE CODE]
You are the Builder Agent for EveryStack Phase 3D — Document Templates & PDF Generation.

## Context
Read these reference docs:
- `docs/reference/smart-docs.md` lines 99–106 (Template Authoring Mode — merge-tag categories)
- `docs/reference/smart-docs.md` lines 197–208 (Custom EveryStack Node Definitions — MergeTag attrs)
- `docs/reference/smart-docs.md` lines 210–229 (Rendering Pipelines — merge-tag → output mapping)
- `docs/reference/smart-docs.md` lines 399–407 (Generation Flow — resolution steps)

Read existing source files:
- `apps/web/src/data/cross-link-resolution.ts` — cross-link traversal for linked merge tags
- `apps/web/src/data/records.ts` — record data access
- `packages/shared/sync/field-registry.ts` — field type formatting

## Task
Create the merge-tag resolution service and supporting types.

**Types (`apps/web/src/lib/types/document-templates.ts`):**
Define `MergeTagField` type:
```typescript
interface MergeTagField {
  tableId: string;
  fieldId: string;
  fieldName: string;
  fieldType: string;
  tableName: string;
  isLinked: boolean;
  crossLinkId?: string;
}
```

**Resolution service (`apps/web/src/lib/editor/merge-resolver.ts`):**

1. `resolveMergeTags(content: TipTapJSON, recordId: string, tenantId: string): Promise<TipTapJSON>` — Deep-clones TipTap JSON. Walks all nodes. For each `mergeTag` node:
   - Extract `{ tableId, fieldId, fallback }` from attrs
   - If `tableId` matches source record's table: read `records.canonical_data[fieldId]` directly
   - If `tableId` is a linked table: use `resolveLinkedRecordsL0` or `resolveLinkedRecordsL1` from 3B-i
   - Format field value using `FieldTypeRegistry` display formatting
   - Replace `mergeTag` node with `text` node containing resolved value
   - If null/undefined: use `fallback` attr, or empty string if no fallback
   - Return resolved TipTap JSON

2. `resolveAndRenderHTML(content: TipTapJSON, recordId: string, tenantId: string): Promise<string>` — Calls `resolveMergeTags()` then uses `generateHTML()` from `@tiptap/html` with `smartDocExtensions`.

**Tests:** Test resolution with simple fields. Test linked field resolution. Test fallback for null fields. Test non-mergeTag nodes preserved. Test HTML output.

## Acceptance Criteria
- [ ] `resolveMergeTags()` replaces all MergeTag nodes with field values from `records.canonical_data`
- [ ] Linked field merge tags resolve via cross-link traversal (L0/L1)
- [ ] Missing/null field values use `fallback` attr (or empty string)
- [ ] Non-mergeTag nodes preserved unchanged
- [ ] `resolveAndRenderHTML()` produces valid HTML string
- [ ] `MergeTagField` type exported from `apps/web/src/lib/types/document-templates.ts`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- Loop fields (`{#line_items}...{/line_items}`) — post-MVP
- Conditional fields (`{#if status == "Active"}...{/if}`) — post-MVP
- MergeTagInserter UI (next prompt)
- PDF rendering (Unit 4)

No migration required.

Git: Commit with message "feat(documents): add merge-tag resolution service [Phase 3D, Prompt 6]"
```

```
[CHECKPOINT]
Look for:
- Resolution replaces MergeTag nodes with text values
- Linked field resolution works through cross-links
- Fallback text used for null fields
- HTML output is valid
```

---

#### PROMPT 7: Merge-Tag Inserter Sidebar and Preview Toggle

**What This Builds:**
This creates two UI components: (1) the Merge-Tag Inserter — a sidebar that shows all available fields grouped by table (including linked tables), where clicking a field inserts a merge-tag pill into the editor, and (2) the Preview Toggle — a three-mode switch between Edit (see pills), Preview (see resolved data), and Raw (see placeholder text).

**What You'll See When It's Done:**
The sidebar displays fields grouped by table. Clicking a field inserts a teal pill into the editor. The toggle switches between three views of the same content.

**How Long This Typically Takes:** 10–15 minutes

```
[PASTE INTO CLAUDE CODE]
Continue building Phase 3D — Merge-Tag Resolution & Field Inserter.

## Context
Read `docs/reference/smart-docs.md` lines 99–106 (Template Authoring Mode) and lines 197–208 (MergeTag node attrs).

Read `apps/web/src/data/cross-link-resolution.ts` and `apps/web/src/data/permissions.ts` for cross-link field discovery and permission filtering.

## Task
Create the MergeTagInserter sidebar, useMergeTagFields hook, and PreviewToggle.

**`useMergeTagFields` hook (`apps/web/src/components/editor/use-merge-tag-fields.ts`):**
Fetches available fields for merge-tag insertion given `tableId` and `tenantId`:
1. Fetch fields for the source table
2. Fetch cross-links where `source_table_id = tableId` to discover linked tables
3. For each linked table, fetch its fields (using `card_fields` from cross-link)
4. Filter through `resolveAllFieldPermissions()` from 3A-iii — hidden fields excluded
5. Return as `MergeTagField[]` grouped by table (source first, then linked)

**`MergeTagInserter` component (`apps/web/src/components/editor/MergeTagInserter.tsx`):**
Sidebar for the SmartDocEditor's sidebar slot:
1. Fields grouped by table with table name as section header
2. Each field shows: field type icon + field name
3. Searchable — filter by typing
4. Click → insert MergeTag node at cursor: `editor.chain().focus().insertContent({ type: 'mergeTag', attrs: { tableId, fieldId, fallback: '' } }).run()`
5. Accepts TipTap `Editor` instance as prop

**`PreviewToggle` component (`apps/web/src/components/editor/PreviewToggle.tsx`):**
Three-state toggle: Edit / Preview / Raw.
- Edit: Normal editor with MergeTag pills
- Preview: Merge tags resolved with sample record data
- Raw: Shows merge tags as `{field_name}` text syntax
- Use shadcn `Tabs` or `ToggleGroup`

## Acceptance Criteria
- [ ] `MergeTagInserter` displays fields grouped by table (source first, then linked)
- [ ] Field list respects field-level permissions (hidden fields not shown)
- [ ] Clicking a field inserts a MergeTag node at cursor
- [ ] Field list is searchable
- [ ] Preview mode resolves merge tags with sample data
- [ ] Raw mode shows `{field_name}` text
- [ ] Edit mode shows teal pill MergeTag nodes
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- Loop field inserter (post-MVP)
- Conditional field inserter (post-MVP)
- AI-suggested merge tags (Phase 5)

No migration required.

Git: Commit with message "feat(editor): add merge-tag inserter sidebar and preview toggle [Phase 3D, Prompt 7]"
```

```
[CHECKPOINT]
Look for:
- Sidebar shows fields from source table AND linked tables
- Click inserts teal pill
- Preview toggle switches between 3 modes
- Hidden fields are not shown
```

---

### VERIFY SESSION C — Unit 3, Prompts 6–7 — Completes Unit 3

**What This Step Does:**
Verifies the merge-tag resolution service and field inserter UI work together correctly.

Close the BUILD session. Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3D Prompts 6–7 (Unit 3 — Merge-Tag Resolution & Field Inserter):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met

Manual verification:
- Confirm MergeTagInserter shows fields from source table and linked tables
- Confirm clicking inserts a MergeTag node
- Confirm PreviewToggle switches between Edit/Preview/Raw

Interface contract verification (Unit 3):
- [ ] `resolveMergeTags()` exported from `apps/web/src/lib/editor/merge-resolver.ts`
- [ ] `resolveAndRenderHTML()` exported from `apps/web/src/lib/editor/merge-resolver.ts`
- [ ] `MergeTagInserter` exported from `apps/web/src/components/editor/MergeTagInserter.tsx`
- [ ] `useMergeTagFields()` exported from `apps/web/src/components/editor/use-merge-tag-fields.ts`
- [ ] `MergeTagField` type exported from `apps/web/src/lib/types/document-templates.ts`
- [ ] `PreviewToggle` exported from `apps/web/src/components/editor/PreviewToggle.tsx`

Fix any failures. Commit fixes.
```

```
[CHECKPOINT]
All checks must pass. All 6 contract items verified.
```

```
[GIT COMMAND]
git add -A
git commit -m "chore(verify): verify prompts 6–7, unit 3 complete [Phase 3D, VP-3]"
git push origin build/3d-document-templates
```

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 3 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session C — Phase 3D — build/3d-document-templates

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 6–7 (Unit 3 — Merge-Tag Resolution & Field Inserter)

### Files Created
- apps/web/src/lib/editor/merge-resolver.ts
- apps/web/src/lib/editor/merge-resolver.test.ts
- apps/web/src/lib/types/document-templates.ts
- apps/web/src/components/editor/MergeTagInserter.tsx
- apps/web/src/components/editor/MergeTagInserter.test.tsx
- apps/web/src/components/editor/use-merge-tag-fields.ts
- apps/web/src/components/editor/PreviewToggle.tsx

### Files Modified
- None

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### ═══ UNIT 4: PDF Generation Pipeline ═══

**What This Unit Builds:**
This is the backend engine that turns a completed template into an actual PDF file. It takes the template, fills in all the merge tags with record data, converts everything to printer-friendly HTML, sends it to Gotenberg (a headless Chrome service that renders HTML to PDF), uploads the resulting PDF to cloud storage (R2), and creates a database record tracking the generated document. This all runs as a background job so the user isn't waiting.

**What Comes Out of It:**
When done, the system can accept a "generate PDF" request, process it in the background, and produce a downloadable PDF stored in cloud storage. The user can check on the status of generation (waiting, processing, done, or failed).

**What It Needs from Prior Work:**
Uses template types and data functions from Unit 1, merge-tag resolution from Unit 3, and the StorageClient (R2 upload) from Phase 1G.

---

### BUILD SESSION D — Unit 4, Prompts 8–9

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 4 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/backend/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 8: PDF Renderer and Gotenberg Client

**What This Builds:**
Two key pieces: (1) the PDFRenderer that converts TipTap JSON into a complete, print-ready HTML document with proper CSS for page size, margins, and fonts, and (2) the GotenbergClient that sends that HTML to the Gotenberg service and gets back a PDF file.

**What You'll See When It's Done:**
Claude Code creates two new services. Tests verify the HTML output has correct print CSS and the Gotenberg client handles success, timeout, and error cases.

**How Long This Typically Takes:** 10–15 minutes

```
[PASTE INTO CLAUDE CODE]
You are the Builder Agent for EveryStack Phase 3D — Document Templates & PDF Generation.

## Context
Read these reference docs:
- `docs/reference/smart-docs.md` lines 210–229 (Rendering Pipelines — node-to-HTML mapping, PDF pipeline)
- `docs/reference/smart-docs.md` lines 390–398 (Backend Requirements — Gotenberg endpoints)

Read existing source files:
- `packages/shared/storage/client.ts` — StorageClient for R2 uploads
- `apps/worker/src/processors/notification/email-send.ts` — reference for BullMQ processor pattern

## Task
Create the PDFRenderer and GotenbergClient.

**`PDFRenderer` (`apps/web/src/lib/editor/pdf-renderer.ts`):**
1. `renderToHTML(content: TipTapJSON, settings: DocumentTemplateSettings): string` — Takes resolved TipTap JSON and template settings. Produces complete HTML document:
   - Full `<!DOCTYPE html>` with print-optimized CSS
   - Page size from settings (A4 default), orientation, margins
   - DM Sans font from Google Fonts CDN
   - Node-to-HTML mapping: headings → `<hN>`, tables → `<table>`, images → `<img>` with absolute R2 URLs, callouts → colored `<div>`, recordRef → plain text in PDF
   - Use `generateHTML()` from `@tiptap/html` for content, wrap in HTML document template
2. Export `DocumentTemplateSettings` type: `{ pageSize: 'A4' | 'Letter'; orientation: 'portrait' | 'landscape'; margins: { top: number; right: number; bottom: number; left: number } }`

**`GotenbergClient` (`packages/shared/pdf/gotenberg-client.ts`):**
1. `convertHTMLToPDF(html: string, options?: GotenbergOptions): Promise<Buffer>` — `POST /forms/chromium/convert/html` to Gotenberg with HTML as form-data file upload.
   - `GotenbergOptions`: `{ timeout?: number }` (default 30s)
   - Gotenberg URL from env var `GOTENBERG_URL` (default `http://localhost:3000`)
   - Use native `fetch` with `FormData` for multipart upload
   - Error handling: timeout → specific error, Gotenberg down → clear message

**Tests:** Test `renderToHTML()` produces valid HTML with correct CSS. Test `GotenbergClient` with mocked HTTP (MSW).

## Acceptance Criteria
- [ ] `renderToHTML()` converts TipTap JSON to complete HTML with print CSS
- [ ] HTML includes correct page size, orientation, margins from settings
- [ ] HTML includes DM Sans font import
- [ ] `convertHTMLToPDF()` calls Gotenberg Chromium endpoint correctly
- [ ] Error handling: timeout and service-down cases
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- LibreOffice DOCX→PDF endpoint (post-MVP)
- Docxtemplater integration (post-MVP)
- Email renderer (post-MVP)

No migration required.

Git: Commit with message "feat(documents): add PDFRenderer and GotenbergClient [Phase 3D, Prompt 8]"
```

```
[CHECKPOINT]
Look for:
- HTML output has print CSS with page-size, margins
- Gotenberg client targets `/forms/chromium/convert/html`
- Error handling for timeout and service unavailability
```

---

#### PROMPT 9: BullMQ Generation Pipeline, Server Action, and Status Polling

**What This Builds:**
This wires everything together into the background job pipeline. It registers a new BullMQ queue for document generation, creates the job processor that orchestrates the full pipeline (load template → resolve merge tags → render HTML → Gotenberg → upload to R2 → save record), creates the server action that kicks off generation, and adds a status polling endpoint so the UI can check on progress.

**What You'll See When It's Done:**
The worker has a new `document-generation` queue. The `generateDocument` server action enqueues jobs. The `getDocumentGenerationStatus` function returns job status. Tests verify the pipeline with mocked dependencies.

**How Long This Typically Takes:** 15–20 minutes

```
[PASTE INTO CLAUDE CODE]
Continue building Phase 3D — PDF Generation Pipeline.

## Context
Read `docs/reference/smart-docs.md` lines 399–407 (Generation Flow) and lines 390–398 (Backend Requirements).

Read existing source files:
- `apps/worker/src/queues.ts` — existing queue registration pattern
- `apps/worker/src/index.ts` — worker entry point
- `apps/worker/src/processors/notification/email-send.ts` — BullMQ processor pattern reference

## Task
Create the BullMQ document generation queue, processor, server action, and status polling.

**Queue registration (`apps/worker/src/queues.ts`):** Add `document-generation` queue following the `notification` queue pattern.

**Processor (`apps/worker/src/processors/document-generation/generate.ts`):**
Job data: `{ tenantId, templateId, recordId, generatedBy }`.
Pipeline:
1. Load template via `getDocumentTemplate()`
2. Resolve merge tags via `resolveAndRenderHTML()`
3. Render to print HTML via `PDFRenderer.renderToHTML()`
4. Send to Gotenberg via `GotenbergClient.convertHTMLToPDF()`
5. Upload to R2 at `documents/{tenantId}/{templateId}/{recordId}/{timestamp}.pdf`
6. Create `generated_documents` row
7. Return generated document ID

Error handling: Gotenberg failure → retry max 3 (exponential backoff 5s). Template not found → fail immediately.

**Server action (`apps/web/src/actions/document-generation.ts`):**
1. `generateDocument` — validate with Zod, verify template exists, enqueue job, return job ID
2. `getDocumentGenerationStatus(jobId)` — query BullMQ job, return `{ status, result?, error? }`

**Queue helper:** `enqueueDocumentGeneration(opts): Promise<string>` — adds job and returns ID.

Register processor in `apps/worker/src/index.ts`.

**Tests:** Test processor with mocks. Test server action validation. Test status polling shapes. Test retry on Gotenberg failure.

## Acceptance Criteria
- [ ] `document-generation` BullMQ queue registered
- [ ] Processor orchestrates full pipeline: template → resolve → HTML → Gotenberg → R2 → DB
- [ ] `generateDocument` server action validates input and enqueues job
- [ ] `getDocumentGenerationStatus(jobId)` returns correct status shapes
- [ ] Gotenberg timeout → retry max 3 with exponential backoff
- [ ] PDF stored in R2 with tenant-scoped path
- [ ] `generated_documents` row has correct columns
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- Plan limit / quota enforcement (deferred)
- Batch generation (post-MVP)
- Automation integration (Phase 4)
- Real-time progress via WebSocket (polling sufficient)

No migration required.

Git: Commit with message "feat(documents): add document generation pipeline with BullMQ queue [Phase 3D, Prompt 9]"
```

```
[CHECKPOINT]
Look for:
- Queue registered in queues.ts
- Processor registered in worker index.ts
- Pipeline steps execute in correct order
- R2 path includes tenant scoping
- Retry config: 3 attempts, exponential backoff
```

---

### VERIFY SESSION D — Unit 4, Prompts 8–9 — Completes Unit 4

**What This Step Does:**
Verifies the complete PDF generation pipeline — renderer, Gotenberg client, BullMQ processor, server action, and status polling.

Close the BUILD session. Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3D Prompts 8–9 (Unit 4 — PDF Generation Pipeline):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo test — all pass
4. pnpm turbo test -- --coverage — thresholds met

Manual verification:
- If Gotenberg is available via Docker, test full pipeline end-to-end
- Otherwise verify with mocked HTTP

Interface contract verification (Unit 4):
- [ ] `PDFRenderer` exported from `apps/web/src/lib/editor/pdf-renderer.ts`
- [ ] `GotenbergClient` exported from `packages/shared/pdf/gotenberg-client.ts`
- [ ] `processDocumentGeneration` processor exported
- [ ] `document-generation` queue registered in `apps/worker/src/queues.ts`
- [ ] `generateDocument` server action exported from `apps/web/src/actions/document-generation.ts`
- [ ] `getDocumentGenerationStatus()` exported
- [ ] `enqueueDocumentGeneration()` helper exported

Fix any failures. Commit fixes.
```

```
[CHECKPOINT]
All checks must pass. All 7 contract items verified.
```

```
[GIT COMMAND]
git add -A
git commit -m "chore(verify): verify prompts 8–9, unit 4 complete [Phase 3D, VP-4]"
git push origin build/3d-document-templates
```

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 4 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session D — Phase 3D — build/3d-document-templates

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 8–9 (Unit 4 — PDF Generation Pipeline)

### Files Created
- apps/web/src/lib/editor/pdf-renderer.ts
- apps/web/src/lib/editor/pdf-renderer.test.ts
- packages/shared/pdf/gotenberg-client.ts
- packages/shared/pdf/gotenberg-client.test.ts
- apps/worker/src/processors/document-generation/generate.ts
- apps/web/src/actions/document-generation.ts
- apps/web/src/actions/document-generation.test.ts

### Files Modified
- apps/worker/src/queues.ts (added document-generation queue)
- apps/worker/src/index.ts (registered processor)

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### ═══ UNIT 5: Template Management & Document Generation UI ═══

**What This Unit Builds:**
This is the user-facing layer — the pages and components that let users browse their templates, create new ones, edit them in the rich-text editor with the merge-tag sidebar, and generate PDFs from records. It includes a "Document Templates" section in the workspace, a template editor page, a "Generate Document" button on every record, and a list of previously generated PDFs.

**What Comes Out of It:**
When done, users can navigate to a Documents section, create templates using the Wizard Create pattern (name → pick table → open editor), edit templates with auto-save, and generate PDFs from any record that has templates available. Generated PDFs appear in a Documents tab on the Record View with download links.

**What It Needs from Prior Work:**
Uses everything from Units 1–4: data functions and server actions (Unit 1), the SmartDocEditor (Unit 2), the MergeTagInserter and PreviewToggle (Unit 3), and the generateDocument action and status polling (Unit 4). Also integrates with the existing RecordViewHeader from Phase 3A-ii.

---

### BUILD SESSION E — Unit 5, Prompts 10–11

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 5 to `in-progress`.
```

Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files and keep their conventions in mind for all work in this session:
- docs/skills/ux-ui/SKILL.md
- docs/skills/phase-context/SKILL.md
```

---

#### PROMPT 10: Template List and Editor Pages

**What This Builds:**
This creates the document template management UI — a list page showing all templates, a creation wizard, and the full editor page that combines the SmartDocEditor with the merge-tag inserter sidebar. The editor has auto-save (saves every 3 seconds while you're editing).

**What You'll See When It's Done:**
Three new routes under `/documents/` in the workspace. The list page shows template cards. Clicking "New Template" opens a 3-step wizard. The editor page has the toolbar, content area, and merge-tag sidebar.

**How Long This Typically Takes:** 15–20 minutes

```
[PASTE INTO CLAUDE CODE]
You are the Builder Agent for EveryStack Phase 3D — Document Templates & PDF Generation.

## Context
Read these reference docs:
- `docs/reference/smart-docs.md` lines 99–106 (Template Authoring Mode — editor + inserter layout)
- `docs/reference/GLOSSARY.md` lines 392–409 (Document Template — template list, saved templates per table)

## Task
Create the template list page, editor page, new template wizard, and supporting components.

**Template list page (`apps/web/src/app/[tenantSlug]/[workspaceId]/documents/page.tsx`):**
Server component. Layout:
1. Header: "Document Templates" title + "New Template" button
2. Template cards in grid (3 cols desktop, 2 tablet, 1 mobile)
3. Each `TemplateCard`: name, table name, updated date, creator, actions (Edit, Duplicate, Delete)
4. Duplicate calls `duplicateDocumentTemplate`. Delete shows AlertDialog confirmation.
5. Empty state: "No document templates yet. Create your first template to generate PDFs from record data."

**Template editor page (`apps/web/src/app/[tenantSlug]/[workspaceId]/documents/[templateId]/page.tsx`):**
1. Load template via `getDocumentTemplate()`
2. Render `DocumentTemplateEditor` with template content and settings
3. Header: editable template name, table badge, settings gear, back button

**New template page (`apps/web/src/app/[tenantSlug]/[workspaceId]/documents/new/page.tsx`):**
Wizard Create flow: Step 1: name → Step 2: select table → Step 3: create & redirect to editor.

**`DocumentTemplateEditor` (`apps/web/src/components/documents/DocumentTemplateEditor.tsx`):**
Combines SmartDocEditor + MergeTagInserter + PreviewToggle.
- Top: EditorToolbar + PreviewToggle
- Left (70%): SmartDocEditor content
- Right (30%): MergeTagInserter sidebar
- Auto-save: debounced 3s on change via `updateDocumentTemplate`. Show "Saving..." → "Saved" indicator.

**`TemplateCard` (`apps/web/src/components/documents/TemplateCard.tsx`):**
Card with name, table badge, date, creator. Actions dropdown.

## Acceptance Criteria
- [ ] Template list page shows templates with create/duplicate/delete actions
- [ ] Editor page loads SmartDocEditor with saved content and MergeTagInserter sidebar
- [ ] Auto-save on content change (debounced 3s)
- [ ] Wizard Create: name → select table → open editor
- [ ] Delete shows confirmation, blocks if generated docs exist
- [ ] Empty state shown when no templates
- [ ] Routes: `/documents`, `/documents/new`, `/documents/[templateId]`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- Template settings page (minimal settings modal if needed)
- Template sharing / permissions
- AI Draft button (Phase 5)
- Template versioning UI (post-MVP)

No migration required.

Git: Commit with message "feat(documents): add template list and editor pages [Phase 3D, Prompt 10]"
```

```
[CHECKPOINT]
Look for:
- Three routes working: list, new, editor
- Wizard creates template and opens editor
- Auto-save indicator appears on edit
- Empty state renders correctly
```

---

#### PROMPT 11: Generate Document Dialog, Button, and Record View Integration

**What This Builds:**
This is the final piece — connecting document generation to the Record View. It adds a "Generate Document" button to the Record View header (only visible when templates exist for that table), a dialog for selecting a template and triggering generation, a progress indicator, and a list of previously generated PDFs with download links.

**What You'll See When It's Done:**
The Record View header now has a "Generate Document" button. Clicking it opens a dialog showing available templates. Selecting one and clicking "Generate PDF" starts background generation with a progress indicator. Generated PDFs appear in a "Documents" tab on the Record View.

**How Long This Typically Takes:** 15–20 minutes

```
[PASTE INTO CLAUDE CODE]
Continue building Phase 3D — Document Generation UI.

## Context
Read `docs/reference/smart-docs.md` lines 399–407 (Generation Flow) and `docs/reference/GLOSSARY.md` lines 392–409 ("Generate Document" button on Record View).

Read existing `apps/web/src/components/record-view/RecordViewHeader.tsx` for button placement.

## Task
Create the document generation UI and integrate with Record View.

**`GenerateDocumentButton` (`apps/web/src/components/documents/GenerateDocumentButton.tsx`):**
Button for Record View header. "Generate Document" + document icon. Only visible when table has templates. Click opens dialog.

**`GenerateDocumentDialog` (`apps/web/src/components/documents/GenerateDocumentDialog.tsx`):**
Modal:
1. List available templates for this record's table
2. User selects template
3. "Generate PDF" button → calls `generateDocument` action → receives job ID
4. Show progress via `useDocumentGeneration`
5. Success: download link. Failure: error + retry.

**`useDocumentGeneration` hook (`apps/web/src/components/documents/use-document-generation.ts`):**
Polls `getDocumentGenerationStatus(jobId)` every 2s while `waiting` or `active`. Returns `{ status, result, error, isLoading }`. Stops on `completed` or `failed`.

**`GeneratedDocumentList` (`apps/web/src/components/documents/GeneratedDocumentList.tsx`):**
List for a record: template name, date, generator, download button. Empty: "No documents generated yet."

**Record View integration:**
- Add `GenerateDocumentButton` to `RecordViewHeader.tsx` alongside existing actions
- Add "Documents" tab to `RecordViewTabs` showing `GeneratedDocumentList`

## Acceptance Criteria
- [ ] "Generate Document" button visible in Record View header when templates exist
- [ ] Button hidden when no templates for the table
- [ ] Dialog shows template list and triggers generation
- [ ] Progress: loading → success with download link, or error with retry
- [ ] Generated documents list in Record View with download links
- [ ] Polling every 2s, stops on completion/failure
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

## Do NOT Build
- Real-time progress via WebSocket (polling sufficient)
- Batch generation (post-MVP)
- Document sharing (post-MVP)
- Embedded PDF viewer (download only)

No migration required.

Git: Commit with message "feat(documents): add document generation UI and Record View integration [Phase 3D, Prompt 11]"
```

```
[CHECKPOINT]
Look for:
- Generate Document button in Record View header
- Dialog opens with template selection
- Progress indicator during generation
- Download link on completion
- Documents tab in Record View
```

---

### VERIFY SESSION E — Unit 5, Prompts 10–11 — Completes Unit 5

**What This Step Does:**
Final verification — checks the complete user-facing document workflow end-to-end.

Close the BUILD session. Open a fresh Claude Code session. Paste:

```
[PASTE INTO CLAUDE CODE]
Read these skill files:
- docs/skills/phase-context/SKILL.md

Run the full verification suite for Phase 3D Prompts 10–11 (Unit 5 — Template Management & Document Generation UI):

1. pnpm turbo typecheck — zero errors
2. pnpm turbo lint — zero errors
3. pnpm turbo check:i18n — no hardcoded English strings
4. pnpm turbo test — all pass
5. pnpm turbo test -- --coverage — thresholds met

Manual verification:
- Navigate to `/app/{tenant}/{workspace}/documents`
- Create a template via wizard
- Edit with merge-tag inserter
- Navigate to a record's Record View
- Verify "Generate Document" button appears
- Verify dialog opens and shows templates

Interface contract verification (Unit 5):
- [ ] `DocumentTemplateListPage` at route `/app/[tenantSlug]/[workspaceId]/documents`
- [ ] Route `/app/[tenantSlug]/[workspaceId]/documents/[templateId]` — editor
- [ ] Route `/app/[tenantSlug]/[workspaceId]/documents/new` — wizard
- [ ] `DocumentTemplateEditor` exported
- [ ] `TemplateCard` exported
- [ ] `GenerateDocumentDialog` exported
- [ ] `GenerateDocumentButton` exported
- [ ] `GeneratedDocumentList` exported
- [ ] `useDocumentGeneration()` hook exported

Fix any failures. Commit fixes.
```

```
[CHECKPOINT]
All checks must pass. All 9 contract items verified.
```

```
[GIT COMMAND]
git add -A
git commit -m "chore(verify): verify prompts 10–11, unit 5 complete [Phase 3D, VP-5]"
git push origin build/3d-document-templates
```

```
[STATE UPDATE]
Open TASK-STATUS.md. Update Unit 5 to `passed-review`.

Open MODIFICATIONS.md. Add a session block:

## Session E — Phase 3D — build/3d-document-templates

**Date:** [today's date]
**Status:** passed-review
**Prompt(s):** Prompts 10–11 (Unit 5 — Template Management & Document Generation UI)

### Files Created
- apps/web/src/app/[tenantSlug]/[workspaceId]/documents/page.tsx
- apps/web/src/app/[tenantSlug]/[workspaceId]/documents/[templateId]/page.tsx
- apps/web/src/app/[tenantSlug]/[workspaceId]/documents/new/page.tsx
- apps/web/src/components/documents/DocumentTemplateEditor.tsx
- apps/web/src/components/documents/TemplateCard.tsx
- apps/web/src/components/documents/GenerateDocumentDialog.tsx
- apps/web/src/components/documents/GenerateDocumentButton.tsx
- apps/web/src/components/documents/GeneratedDocumentList.tsx
- apps/web/src/components/documents/use-document-generation.ts

### Files Modified
- apps/web/src/components/record-view/RecordViewHeader.tsx (added Generate Document button)

### Schema Changes
- None

### New Domain Terms Introduced
- None
```

---

### FINAL — Open Pull Request

```
[GIT COMMAND]
git push origin build/3d-document-templates
```

Open PR titled **"[Step 3] Phase 3D — Document Templates & PDF Generation"**.

PR body:

```
## Summary
- Unit 1: Document Template Data Layer — CRUD data functions, server actions, Zod schemas, test factories
- Unit 2: TipTap Env 2 Editor Core — SmartDocEditor, custom nodes (MergeTag, RecordRef, Callout), slash command, toolbar, bubble menu, block handles
- Unit 3: Merge-Tag Resolution & Field Inserter — resolution service (same-table + cross-link), field inserter sidebar, preview toggle
- Unit 4: PDF Generation Pipeline — PDFRenderer, GotenbergClient, BullMQ queue + processor, server action, status polling
- Unit 5: Template Management & Document Generation UI — template list/editor/new pages, Generate Document dialog + button, Record View integration

## Test plan
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Coverage thresholds met
- [ ] TypeScript strict mode — zero errors
- [ ] ESLint — zero errors
- [ ] i18n check — no hardcoded English
- [ ] Manual: create template, edit with merge tags, generate PDF from record
```

```
[DECISION POINT]
If PR looks good: → Merge (squash). Delete branch. Proceed to Step 4.
If something wrong: → Do NOT merge. Paste fix instructions into Claude Code.
```

---

## STEP 4 — REVIEW (Reviewer Agent)

### What This Step Does
An independent Claude session reviews the build against acceptance criteria and verifies that every unit's interface contract was fulfilled.

### 4.1 — Generate the build diff

```
[GIT COMMAND]
git checkout main && git pull origin main
git log --oneline main~1..main
git diff main~1..main > /tmp/phase-3d-diff.txt
```

### 4.2 — Run the Reviewer Agent

Open a NEW Claude.ai session. Upload: the playbook (`docs/Playbooks/playbook-phase-3d.md`), the subdivision doc (`docs/subdivisions/3d-subdivision.md`), the diff file (`/tmp/phase-3d-diff.txt`), `CLAUDE.md`, and `GLOSSARY.md`.

```
[PASTE INTO CLAUDE]
You are the Reviewer Agent for EveryStack Phase 3D — Document Templates & PDF Generation.

## Your Role
Review the build diff against the playbook's acceptance criteria. For each unit, verify:
1. Every prompt's acceptance criteria are met
2. Every [CONTRACT] item is fulfilled (exports exist with correct signatures)
3. No post-MVP features were accidentally built
4. Naming matches GLOSSARY.md
5. Patterns follow CLAUDE.md conventions

## Output Format
For each unit, provide:
- **Verdict:** PASS or FAIL
- **Contract items:** ✅ or ❌ per item
- **Issues found:** (if any)
- **Severity:** Critical (blocks merge) / Minor (note for future)

## Final Verdict
- **PASS:** All 5 units pass. No critical issues. → Proceed to Step 5.
- **FAIL:** At least one unit has critical issues. → Provide fix instructions.

Review the diff now.
```

```
[DECISION POINT]
If PASS: → Proceed to Step 5.
If FAIL: → Open Claude Code. Paste the fix instructions from the Reviewer. Re-run tests. Commit. Re-run review.
```

---

## STEP 5 — POST-BUILD DOCS SYNC (Docs Agent)

### What This Step Does
Bring docs back into alignment after the build. The Docs Agent reads MODIFICATIONS.md to know exactly what changed.

### 5.1 — Create the fix branch

```
[GIT COMMAND]
git checkout main && git pull origin main
git checkout -b fix/post-3d-docs-sync
```

### 5.2 — Run the Docs Agent

```
[PASTE INTO CLAUDE CODE]
You are the Docs Agent for EveryStack, running after Phase 3D — Document Templates & PDF Generation.

## Your Tasks
1. Read MODIFICATIONS.md for all Phase 3D session blocks
2. Update MANIFEST.md:
   - Update line counts for any modified reference docs
   - Verify smart-docs.md status is current
3. Update GLOSSARY.md:
   - No new domain terms expected (Document Template already defined)
   - Verify no terminology drift in new code vs glossary definitions
4. Cross-reference check:
   - Verify all new file paths referenced in docs actually exist
   - Check for stale cross-references in smart-docs.md
5. Archive MODIFICATIONS.md:
   - Move Phase 3D session blocks to the archive section
6. Update TASK-STATUS.md:
   - All 5 units → `docs-synced`

## Constraints
- Never modify reference doc content (only line counts in MANIFEST)
- Never add new terms to GLOSSARY without confirming they're truly new
- Commit all changes together
```

### 5.3 — Review and merge

```
[CHECKPOINT]
Review diff. Look for:
- MANIFEST line counts match actual file sizes
- No stale cross-references
- No new terms missing from GLOSSARY
- MODIFICATIONS.md sessions archived
- TASK-STATUS.md units show `docs-synced`
```

```
[GIT COMMAND]
git add -A
git commit -m "docs: post-Phase-3D docs sync (MANIFEST, GLOSSARY, cross-refs, state files)"
git push origin fix/post-3d-docs-sync
```

Open PR titled **"[Step 5] Phase 3D — Post-Build Docs Sync"**. Review. Merge. Delete branch.

### 5.4 — Tag milestone

```
[DECISION POINT]
Phase 3D completes Phase 3 first half (all of 3A through 3D).

If this is a milestone worth tagging:
→ git tag -a v0.3.1-phase-3d -m "Phase 3D — Document Templates & PDF Generation"
→ git push origin v0.3.1-phase-3d

If not a milestone: → Skip tagging.
```

---

## NEXT SUB-PHASE

Phase 3D is complete. This marks the end of Phase 3 — First Half (3A through 3D).

Next: Phase 3 — Second Half begins with Phase 3E-i (Quick Portals).
Return to Step 0 for Phase 3E-i.
