# Subdivision Doc: 3D — Document Templates & PDF Generation

## Big-Picture Anchor

Phase 3D delivers the document generation system — the ability for users
to create rich-text templates with merge-tag placeholders, populate them
with record data (including cross-linked fields), and produce PDFs via
Gotenberg. This is the final sub-phase in Phase 3's first half. It
depends on the data layer from Phase 1B (schema), TipTap patterns from
3C (Environment 1 chat editor), field permissions from 3A-iii (merge-tag
visibility), and cross-link resolution from 3B-i (linked field
traversal). When complete, users can generate professional PDFs from any
record — unlocking document generation for Portals, Forms, and
Automations in Phase 3's second half.

## Seam Analysis

This sub-phase touches all three stack layers (data, service, UI) and
introduces a new external integration (Gotenberg). The primary seam is
the standard data → service → UI layering, with a secondary seam between
the TipTap editor (complex, self-contained) and the PDF generation
pipeline (backend-heavy, async).

**Identified seams:**

1. **Data → Service → UI** — Template CRUD data functions are consumed by
   the editor UI and generation pipeline independently.
2. **Editor vs. Generation** — The TipTap Env 2 editor and the Gotenberg
   PDF pipeline are architecturally independent systems connected by the
   merge-tag resolution service. The editor writes TipTap JSON; the
   pipeline reads and resolves it.
3. **Merge-tag resolution** — A cross-cutting service consumed by both
   the editor (preview mode) and the pipeline (generation time). Sits
   between editor and pipeline as a shared dependency.

**Anti-pattern avoidance:**
- Not splitting by file count or effort.
- Tests co-located with implementation in every unit.
- Schema already exists in 1B — no migration unit needed.

## Dependency Graph

```
Unit 1: Document Template Data Layer
  ↓
  ├──────────────────────┐
  ↓                      ↓
Unit 2: TipTap Env 2     Unit 3: Merge-Tag Resolution
Editor Core               & Field Inserter
  ↓                      ↓
  ├──────────────────────┘
  ↓
Unit 4: PDF Generation Pipeline
  ↓
Unit 5: Template Management & Document Generation UI
```

**Parallel opportunities:** Units 2 and 3 can run concurrently after
Unit 1 completes — the editor core does not depend on merge-tag
resolution, and the resolution service does not depend on the editor.

**Critical path:** Unit 1 → Unit 3 → Unit 4 → Unit 5 (depth 4).

---

### Unit 1: Document Template Data Layer

**Big-Picture Anchor:** Establishes the data access functions, server
actions, and test factories for document templates and generated
documents. All downstream units consume these types and CRUD functions.

**RSA Classification:** D
**RSA Rationale:** The `document_templates` and `generated_documents`
schemas are fully specified in `packages/shared/db/schema/` (1B). CRUD
patterns are well-established from prior phases (3C notifications, 3B-i
cross-links). No implementation choices — this is a mechanical
translation of existing schema into data functions following the
`getDbForTenant()` pattern.

**Produces:**
- `getDocumentTemplate(tenantId: string, templateId: string): Promise<DocumentTemplate | null>` — from `apps/web/src/data/document-templates.ts`
- `listDocumentTemplates(tenantId: string, tableId: string): Promise<DocumentTemplate[]>` — from `apps/web/src/data/document-templates.ts`
- `getGeneratedDocument(tenantId: string, documentId: string): Promise<GeneratedDocument | null>` — from `apps/web/src/data/generated-documents.ts`
- `listGeneratedDocuments(tenantId: string, recordId: string): Promise<GeneratedDocument[]>` — from `apps/web/src/data/generated-documents.ts`
- `createDocumentTemplate` server action — from `apps/web/src/actions/document-templates.ts`
- `updateDocumentTemplate` server action — from `apps/web/src/actions/document-templates.ts`
- `duplicateDocumentTemplate` server action — from `apps/web/src/actions/document-templates.ts`
- `deleteDocumentTemplate` server action — from `apps/web/src/actions/document-templates.ts`
- `createTestDocumentTemplate()` factory — from `packages/shared/testing/factories/`
- `createTestGeneratedDocument()` factory — from `packages/shared/testing/factories/`
- `DocumentTemplate` type (Drizzle infer type) — from schema re-export
- `GeneratedDocument` type (Drizzle infer type) — from schema re-export
- Zod schemas: `createDocumentTemplateSchema`, `updateDocumentTemplateSchema` — from `apps/web/src/lib/schemas/document-templates.ts`

**Consumes:**
- None — first unit. Uses existing Drizzle schema (`document_templates`, `generated_documents`), `getDbForTenant()` pattern, existing factory helpers.

**Side Effects:**
- None (schema already exists from 1B).

**Context Manifest:**
- `smart-docs.md` § Document Generation — Two Prongs (lines 337–414) — template storage, generation flow
- `GLOSSARY.md` § Document Template (lines 392–409) — MVP scope definition
- `data-model.md` § document_templates, generated_documents — column definitions
- `CLAUDE.md` § Code Conventions (lines 228–265) — naming, patterns
- `CLAUDE.md` § Testing Rules (lines 267–298) — test file naming, coverage

**Source Files:**
- `packages/shared/db/schema/document-templates.ts` — existing schema
- `packages/shared/db/schema/generated-documents.ts` — existing schema
- `packages/shared/db/schema/index.ts` — schema export pattern
- `packages/shared/testing/factories/index.ts` — factory pattern reference
- `apps/web/src/data/threads.ts` — reference for data function pattern (recent, well-tested)
- `apps/web/src/actions/threads.ts` — reference for server action pattern

**Acceptance Criteria:**
- [ ] `getDocumentTemplate()` and `listDocumentTemplates()` return correct data with tenant isolation
- [ ] `getGeneratedDocument()` and `listGeneratedDocuments()` return correct data with tenant isolation
- [ ] All four template server actions (create, update, duplicate, delete) work correctly with Zod validation
- [ ] `testTenantIsolation()` passes for all data functions
- [ ] Test factories produce valid records with all required fields
- [ ] Duplicate action copies content and settings, generates new name with "(Copy)" suffix
- [ ] Delete action is soft delete (or hard delete with confirmation — per existing pattern)
- [ ] ≥80% line coverage on new code

**Estimated Complexity:** Low

---

### Unit 2: TipTap Environment 2 Editor Core

**Big-Picture Anchor:** Builds the full-featured Smart Doc editor — a
superset of the Environment 1 chat editor from 3C. This is the
authoring surface for document templates. It provides headings, tables,
code blocks, images, callouts, custom nodes (MergeTag, RecordRef), slash
commands, bubble menu, block handles, and the fixed toolbar.

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` § TipTap Editor Architecture (lines
49–229) specifies the exact extension list, custom node definitions
(attrs, behavior), React component structure, and UX patterns (toolbar,
slash command, bubble menu, block handles). Builder decides internal
component composition, extension configuration details, TipTap plugin
authoring patterns, and CSS styling. The node definitions table (lines
197–208) is specific enough to be nearly D, but the editor shell assembly
and interaction between extensions requires implementation judgment.

**Produces:**
- `SmartDocEditor` — main editor wrapper component from `apps/web/src/components/editor/SmartDocEditor.tsx`
- `useSmartDocEditor(options: SmartDocEditorOptions): Editor` — hook from `apps/web/src/components/editor/use-smart-doc-editor.ts`
- `smartDocExtensions` — configured extension bundle from `apps/web/src/components/editor/extensions/index.ts`
- `MergeTag` — custom TipTap node extension from `apps/web/src/components/editor/extensions/merge-tag/MergeTag.ts`
- `MergeTagView` — React NodeView (teal pill with field icon) from `apps/web/src/components/editor/extensions/merge-tag/MergeTagView.tsx`
- `RecordRef` — custom TipTap node extension from `apps/web/src/components/editor/extensions/record-ref/RecordRef.ts`
- `RecordRefView` — React NodeView (inline chip) from `apps/web/src/components/editor/extensions/record-ref/RecordRefView.tsx`
- `Callout` — custom TipTap node extension from `apps/web/src/components/editor/extensions/callout/Callout.ts`
- `CalloutView` — React NodeView from `apps/web/src/components/editor/extensions/callout/CalloutView.tsx`
- `SlashCommand` — custom TipTap extension from `apps/web/src/components/editor/extensions/slash-command/SlashCommand.ts`
- `SlashCommandList` — popup component from `apps/web/src/components/editor/extensions/slash-command/SlashCommandList.tsx`
- `EditorToolbar` — fixed top toolbar from `apps/web/src/components/editor/toolbar/EditorToolbar.tsx`
- `BubbleToolbar` — floating selection toolbar from `apps/web/src/components/editor/menus/BubbleToolbar.tsx`
- `BlockHandle` — drag reorder handle from `apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx`

**Consumes:**
- None — no unit-to-unit dependencies. Uses TipTap libraries (`@tiptap/react`, `@tiptap/starter-kit`, etc.), existing shadcn/ui primitives, existing chat editor patterns from Environment 1.

**Side Effects:**
- None.

**Context Manifest:**
- `smart-docs.md` § TipTap Editor Architecture — Environment 2 (lines 49–163) — extensions, custom nodes, component structure
- `smart-docs.md` § TipTap JSONB Document Schema (lines 165–195) — JSON structure
- `smart-docs.md` § Custom EveryStack Node Definitions (lines 197–208) — node attrs and behavior
- `smart-docs.md` § Rendering Pipelines (lines 210–229) — output mapping
- `GLOSSARY.md` § Document Template (lines 392–409) — MVP scope

**Source Files:**
- `apps/web/src/components/chat/extensions.ts` — Env 1 extension config (pattern reference)
- `apps/web/src/components/chat/ChatEditor.tsx` — Env 1 editor component (pattern reference)
- `apps/web/src/components/chat/use-chat-editor.ts` — Env 1 hook (pattern reference)
- `apps/web/src/components/chat/ChatEditorToolbar.tsx` — Env 1 toolbar (pattern reference)

**Acceptance Criteria:**
- [ ] `SmartDocEditor` renders with full toolbar, supports all core extensions listed in smart-docs.md (StarterKit, Underline, Highlight, Link, Image, Table, CodeBlock, TaskList, Callout, Mention, SlashCommand, DragHandle, TextAlign, Color/TextStyle, Placeholder, Typography, CharacterCount)
- [ ] MergeTag node renders as teal pill with field icon, stores `{ tableId, fieldId, fallback }` attrs
- [ ] RecordRef node renders as inline chip with `{ tableId, recordId, displayText }` attrs
- [ ] Callout node renders with 4 variants (info/warning/success/error) using `{ emoji, color }` attrs
- [ ] Slash command menu opens on `/` and lists available block types
- [ ] Bubble toolbar appears on text selection with inline formatting options
- [ ] Block handles appear on hover for drag-reorder
- [ ] Editor outputs valid TipTap JSON matching the JSONB schema in smart-docs.md
- [ ] Editor accepts TipTap JSON input (loads saved templates)
- [ ] ≥80% line coverage on new code

**Estimated Complexity:** High

---

### Unit 3: Merge-Tag Resolution & Field Inserter

**Big-Picture Anchor:** The merge-tag system is the bridge between
document templates and record data. The resolution service takes a TipTap
JSON document and a record, resolves all MergeTag nodes to field values
(including cross-link traversal), and returns resolved HTML or JSON. The
field inserter is a sidebar UI that lets template authors browse table
fields and linked table fields, inserting merge-tag nodes into the
editor.

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` § Template Authoring Mode (lines
99–106) specifies three merge-tag categories (simple fields, loop fields,
conditional fields) and the preview toggle (Edit/Preview/Raw). The
MergeTag node attrs are defined (lines 197–208). Builder decides the
resolution algorithm (how to traverse cross-links for linked field
merge tags), the field picker UX layout, preview rendering strategy,
and how to handle missing/null field values (fallback behavior).

**Produces:**
- `resolveMergeTags(content: TipTapJSON, recordId: string, tenantId: string): Promise<TipTapJSON>` — from `apps/web/src/lib/editor/merge-resolver.ts`
- `resolveAndRenderHTML(content: TipTapJSON, recordId: string, tenantId: string): Promise<string>` — from `apps/web/src/lib/editor/merge-resolver.ts`
- `MergeTagInserter` — sidebar component from `apps/web/src/components/editor/MergeTagInserter.tsx`
- `useMergeTagFields(tableId: string, tenantId: string): MergeTagField[]` — hook that fetches available fields including cross-linked fields from `apps/web/src/components/editor/use-merge-tag-fields.ts`
- `MergeTagField` type — from `apps/web/src/lib/types/document-templates.ts`
- `PreviewToggle` — Edit/Preview/Raw mode toggle from `apps/web/src/components/editor/PreviewToggle.tsx`

**Consumes:**
- `DocumentTemplate` type from Unit 1 — template content shape
- `resolveLinkedRecordsL0`, `resolveLinkedRecordsL1` from 3B-i — cross-link field resolution for linked merge tags
- `resolveAllFieldPermissions()` from 3A-iii — filter merge-tag field list by user's field visibility
- `FieldTypeRegistry` from `packages/shared/sync/field-registry.ts` — field type display formatting

**Side Effects:**
- None.

**Context Manifest:**
- `smart-docs.md` § Template Authoring Mode (lines 99–106) — merge-tag categories, preview modes
- `smart-docs.md` § Custom EveryStack Node Definitions (lines 197–208) — MergeTag attrs
- `smart-docs.md` § Rendering Pipelines (lines 210–229) — merge-tag → output mapping
- `smart-docs.md` § Generation Flow (lines 399–407) — resolution steps
- `GLOSSARY.md` § Document Template (lines 392–409) — merge tag picker scope

**Source Files:**
- `apps/web/src/data/cross-link-resolution.ts` — cross-link traversal for linked merge tags
- `apps/web/src/data/permissions.ts` — field permission filtering
- `packages/shared/sync/field-registry.ts` — field type formatting reference
- `apps/web/src/data/records.ts` — record data access for merge-tag resolution

**From Prior Units:**
- Unit 1 output: `apps/web/src/lib/types/document-templates.ts` (types), `apps/web/src/data/document-templates.ts` (data functions)

**Acceptance Criteria:**
- [ ] `resolveMergeTags()` replaces all MergeTag nodes with their field values from `records.canonical_data`
- [ ] Linked field merge tags resolve via cross-link traversal (L0/L1)
- [ ] Missing/null field values render using the MergeTag's `fallback` attr (or empty string if no fallback)
- [ ] `MergeTagInserter` displays fields grouped by table (source table first, then linked tables)
- [ ] Field list respects field-level permissions (hidden fields not shown)
- [ ] Clicking a field in the inserter inserts a MergeTag node into the editor at cursor
- [ ] Preview mode resolves merge tags with sample record data and renders inline
- [ ] Raw mode shows `{placeholder}` text syntax
- [ ] ≥80% line coverage on new code

**Estimated Complexity:** Medium

---

### Unit 4: PDF Generation Pipeline

**Big-Picture Anchor:** The backend pipeline that converts a resolved
document template into a PDF. Takes TipTap JSON → resolves merge tags →
renders to styled HTML → sends to Gotenberg (headless Chromium) → stores
the resulting PDF in R2 → creates a `generated_documents` row with the
download URL. Runs as an async BullMQ job to avoid blocking the UI.

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` § Rendering Pipelines (lines 210–229)
specifies the pipeline stages (JSONB → generateHTML() → Gotenberg → PDF)
and § Generation Flow (lines 399–407) specifies the end-to-end flow.
Builder decides the HTML template structure, print-optimized CSS, the
Gotenberg HTTP client implementation, BullMQ job configuration (retries,
timeout, concurrency), and error recovery patterns.

**Produces:**
- `PDFRenderer` — service from `apps/web/src/lib/editor/pdf-renderer.ts` — converts TipTap JSON to print-optimized HTML
- `GotenbergClient` — HTTP client from `packages/shared/pdf/gotenberg-client.ts` — sends HTML to Gotenberg, receives PDF buffer
- `processDocumentGeneration` — BullMQ job processor from `apps/worker/src/processors/document-generation/generate.ts`
- `enqueueDocumentGeneration(opts: GenerateDocumentOpts): Promise<string>` — queue helper from `apps/web/src/lib/queue.ts` (or co-located)
- `generateDocument` server action — from `apps/web/src/actions/document-generation.ts` — orchestrates: validate → check plan limits → enqueue job → return job ID
- `getDocumentGenerationStatus(jobId: string): Promise<JobStatus>` — polling endpoint
- `document-generation` BullMQ queue registration — in `apps/worker/src/queues.ts`

**Consumes:**
- `DocumentTemplate`, `GeneratedDocument` types from Unit 1
- `createTestGeneratedDocument()` factory from Unit 1
- `resolveMergeTags()`, `resolveAndRenderHTML()` from Unit 3
- `StorageClient` from `packages/shared/storage/` (1G) — R2 upload
- `getDbForTenant()` — write `generated_documents` row

**Side Effects:**
- Registers BullMQ queue: `document-generation`
- Writes to `generated_documents` table
- Uploads PDF to Cloudflare R2

**Context Manifest:**
- `smart-docs.md` § Rendering Pipelines (lines 210–229) — pipeline stages, node-to-HTML mapping
- `smart-docs.md` § Generation Flow (lines 399–407) — end-to-end flow
- `smart-docs.md` § Backend Requirements (lines 390–398) — Gotenberg endpoints (Chromium for HTML→PDF)
- `GLOSSARY.md` § Document Template (lines 392–409) — MVP scope (PDF output via Gotenberg)
- `CLAUDE.md` § Tech Stack (lines 46–71) — Gotenberg, R2, BullMQ

**Source Files:**
- `packages/shared/storage/client.ts` — StorageClient for R2 uploads
- `packages/shared/storage/r2-client.ts` — R2 client implementation
- `apps/worker/src/queues.ts` — existing queue registration pattern
- `apps/worker/src/processors/notification/email-send.ts` — reference for BullMQ processor pattern
- `apps/worker/src/index.ts` — worker entry point (queue registration)

**From Prior Units:**
- Unit 1 output: `apps/web/src/data/document-templates.ts`, `apps/web/src/data/generated-documents.ts`, types, factories
- Unit 3 output: `apps/web/src/lib/editor/merge-resolver.ts` (resolution functions)

**Acceptance Criteria:**
- [ ] `PDFRenderer` converts TipTap JSON to valid HTML with print-optimized CSS (A4 page size, margins, font embedding)
- [ ] `GotenbergClient` successfully calls Gotenberg's Chromium HTML→PDF endpoint and returns PDF buffer
- [ ] BullMQ processor orchestrates: load template → resolve merge tags → render HTML → Gotenberg → upload to R2 → create `generated_documents` row
- [ ] `generateDocument` server action validates input, checks plan document generation quota, and enqueues the job
- [ ] Error handling: Gotenberg timeout → job retry (max 3), Gotenberg down → graceful error to user
- [ ] Generated PDF stored in R2 with tenant-scoped path
- [ ] `generated_documents` row includes correct `file_url`, `file_type`, `template_id`, `source_record_id`
- [ ] ≥80% line coverage on new code

**Estimated Complexity:** Medium-High

---

### Unit 5: Template Management & Document Generation UI

**Big-Picture Anchor:** The user-facing surfaces for the complete document
workflow: browsing/managing templates, authoring templates in the editor
with the merge-tag inserter, selecting a record to generate a document,
and viewing/downloading generated documents. Includes the "Generate
Document" button on Record View and the template list within workspace
settings.

**RSA Classification:** SH
**RSA Rationale:** The phase division doc specifies the UI surfaces
(template mapper, "Generate Document" on Record View) and smart-docs.md
specifies the editor layout (toolbar + content + merge-tag inserter
sidebar). Builder decides component structure, page routing, template
list layout, generation progress UX (polling vs. real-time), and the
record selector UI for the template mapper.

**Produces:**
- `DocumentTemplateListPage` — page component from `apps/web/src/app/[tenantSlug]/[workspaceId]/documents/page.tsx`
- `DocumentTemplateEditor` — full editor page combining SmartDocEditor + MergeTagInserter from `apps/web/src/components/documents/DocumentTemplateEditor.tsx`
- `TemplateCard` — card component for template list from `apps/web/src/components/documents/TemplateCard.tsx`
- `GenerateDocumentDialog` — modal for record selection + generation trigger from `apps/web/src/components/documents/GenerateDocumentDialog.tsx`
- `GenerateDocumentButton` — Record View header action from `apps/web/src/components/documents/GenerateDocumentButton.tsx`
- `GeneratedDocumentList` — list of generated docs for a record from `apps/web/src/components/documents/GeneratedDocumentList.tsx`
- `useDocumentGeneration(jobId: string)` — hook for generation progress polling from `apps/web/src/components/documents/use-document-generation.ts`
- Route: `/app/[tenantSlug]/[workspaceId]/documents` — template list page
- Route: `/app/[tenantSlug]/[workspaceId]/documents/[templateId]` — template editor page
- Route: `/app/[tenantSlug]/[workspaceId]/documents/new` — new template page

**Consumes:**
- `listDocumentTemplates()`, `getDocumentTemplate()`, `listGeneratedDocuments()` from Unit 1
- `createDocumentTemplate`, `updateDocumentTemplate`, `duplicateDocumentTemplate`, `deleteDocumentTemplate` actions from Unit 1
- `SmartDocEditor`, `useSmartDocEditor()` from Unit 2
- `MergeTagInserter`, `PreviewToggle` from Unit 3
- `generateDocument` action, `getDocumentGenerationStatus()` from Unit 4
- Existing `RecordView` components from 3A-ii — for "Generate Document" button placement

**Side Effects:**
- Adds routes under `/app/[tenantSlug]/[workspaceId]/documents/`

**Context Manifest:**
- `smart-docs.md` § Template Authoring Mode (lines 99–106) — editor + inserter layout
- `smart-docs.md` § Template Mapper UI (lines 369–388) — mapper layout (reference for record selector)
- `smart-docs.md` § Generation Flow (lines 399–407) — user-facing generation steps
- `GLOSSARY.md` § Document Template (lines 392–409) — "Generate Document" button, template list
- `CLAUDE.md` § Design Philosophy (lines 372–388) — progressive disclosure, creation flow patterns (Wizard Create for templates)

**Source Files:**
- `apps/web/src/app/[tenantSlug]/[workspaceId]/` — existing workspace route structure
- `apps/web/src/components/record-view/RecordViewHeader.tsx` — placement for Generate Document button
- `apps/web/src/components/grid/toolbar/` — reference for workspace-level toolbar patterns

**From Prior Units:**
- Unit 1 output: data functions, server actions, types
- Unit 2 output: `SmartDocEditor`, `useSmartDocEditor()`
- Unit 3 output: `MergeTagInserter`, `PreviewToggle`
- Unit 4 output: `generateDocument` action, `getDocumentGenerationStatus()`

**Acceptance Criteria:**
- [ ] Template list page shows all templates for the workspace with create/duplicate/delete actions
- [ ] Template editor page loads SmartDocEditor with saved content and MergeTagInserter sidebar
- [ ] Auto-save on editor content change (debounced 3s) via `updateDocumentTemplate` action
- [ ] "Generate Document" button visible in Record View header for records with available templates
- [ ] `GenerateDocumentDialog` allows selecting a template, shows preview, and triggers generation
- [ ] Generation progress shown (loading state → success with download link, or error with retry)
- [ ] Generated documents list visible on Record View (with download links and generation metadata)
- [ ] Template creation follows Wizard Create pattern (name → select table → open editor)
- [ ] ≥80% line coverage on new code

**Estimated Complexity:** Medium

---

## Cross-Unit Integration Points

1. **TipTap JSON schema** — Unit 2 writes TipTap JSON (including
   MergeTag nodes), Unit 3 reads and resolves MergeTag nodes, Unit 4
   renders resolved JSON to HTML. The `MergeTag` node definition from
   Unit 2 (`{ tableId, fieldId, fallback }`) is the shared contract.

2. **Template content storage** — Unit 1 defines the `content` JSONB
   column on `document_templates`. Unit 2's editor reads/writes this
   column. Unit 4's pipeline reads it for generation.

3. **Merge-tag resolution** — Unit 3's `resolveMergeTags()` is consumed
   by both Unit 3's preview mode (client-side) and Unit 4's generation
   pipeline (server-side). The function must work in both contexts.

4. **Record View integration** — Unit 5 adds the "Generate Document"
   button to the existing `RecordViewHeader` from 3A-ii. This is a
   surgical addition, not a rewrite.

5. **BullMQ queue** — Unit 4 registers the `document-generation` queue
   in `apps/worker/src/queues.ts` and adds the processor. Unit 5's
   `generateDocument` action enqueues jobs to this queue.

## Context Budget Verification

| Unit | RSA | Doc Sections | Source Files | Prior Outputs | Est. Tokens | Passes |
|------|-----|-------------|-------------|---------------|-------------|--------|
| 1    | D   | 3 sections  | 6 files     | 0             | ~12,000     | Yes    |
| 2    | SH  | 4 sections  | 4 files     | 0             | ~14,000     | Yes    |
| 3    | SH  | 4 sections  | 4 files     | 2 (Unit 1)    | ~15,000     | Yes    |
| 4    | SH  | 4 sections  | 5 files     | 3 (Units 1,3) | ~16,000     | Yes    |
| 5    | SH  | 4 sections  | 3 files     | 4 (Units 1–4) | ~17,000     | Yes    |

All units are well within the ~40% context budget (~80,000 tokens).
The tightest budget is Unit 5 at ~17,000 tokens estimated, safely
under the threshold.
