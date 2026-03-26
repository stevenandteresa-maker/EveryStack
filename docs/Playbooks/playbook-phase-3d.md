# Phase 3D — Document Templates & PDF Generation

## Phase Context

Covers What Has Been Built, What This Phase Delivers, What This Phase Does NOT Build, Architecture Patterns for This Phase, Mandatory Context for All Prompts, Subdivision Summary.
Touches `document_templates`, `generated_documents`, `cross_links`, `cross_link_index`, `table_type` tables. See `queues.ts`, `job-wrapper.ts`.

### What Has Been Built

| Phase | Key Deliverables |
|-------|-----------------|
| 1A–1J | Monorepo, DB schema (Drizzle, 52 tables including `document_templates`, `generated_documents`), Clerk auth, observability (Pino), testing infra (factories, `testTenantIsolation()`), design system (shadcn/ui, Tailwind tokens), real-time (Socket.io + Redis adapter), BullMQ worker infrastructure (`queues.ts`, `job-wrapper.ts`), StorageClient (R2), AIService, audit log, API auth, CP migration + multi-tenant nav shell |
| 2A–2C | FieldTypeRegistry, canonical transform layer, Airtable + Notion adapters, outbound sync, conflict resolution, tsvector search indexes, sync dashboard |
| 3A-i | Grid View: TanStack Table + Virtual, 16 cell renderers, inline editing, keyboard nav |
| 3A-ii | View features (filter/sort/group/summary), Record View overlay (60%/40% layout, `RecordView.tsx`, `RecordViewHeader.tsx`, `RecordViewTabs.tsx`), Card View, Sections, CSV import |
| 3A-iii | Field-level permissions: 3-state model, 7-step resolution cascade, `resolveAllFieldPermissions()`, Redis cache, permission-aware Grid/RecordView/CardView |
| 3B-i | Cross-linking engine: `cross_links`/`cross_link_index` data layer, query-time resolution (L0–L2 via `resolveLinkedRecordsL0`, `resolveLinkedRecordsL1`), Link Picker, display value maintenance |
| 3B-ii | Schema Descriptor Service (SDS) + Command Bar |
| 3C | Record Thread (two-thread model), DMs, Chat Editor (TipTap env 1), notification pipeline, presence system, system email via Resend |

### What This Phase Delivers

The document generation system: users create rich-text templates with merge-tag placeholders using a full-featured TipTap editor, populate them with record data (including cross-linked fields), and generate PDFs via Gotenberg. When complete, any record with available templates gets a "Generate Document" button in its Record View header, and generated PDFs are stored in R2 with download links.

### What This Phase Does NOT Build

- Wiki architecture and wiki `table_type` (post-MVP — Documents)
- Smart Doc field type (post-MVP — per-record authored/generated doc fields)
- Smart Doc View (wiki mode two-panel page tree — post-MVP)
- Prong 2: Upload template generation / Docxtemplater / DOCX templates (post-MVP)
- AI content blocks (`{ai:summarize(notes)}` — post-MVP)
- Chart embeds in documents (post-MVP)
- Knowledge base mode (post-MVP)
- Smart Doc co-editing via Hocuspocus (post-MVP)
- Document versioning and snapshots (`smart_doc_versions`, `smart_doc_snapshots` — post-MVP)
- Backlinks / `[[page]]` references (post-MVP)
- Formula engine (post-MVP)
- Batch document generation (post-MVP — App Designer)
- Email renderer pipeline (post-MVP — Comms & Polish)

### Architecture Patterns for This Phase

**TipTap Environment 2 is a superset of Environment 1.** The Smart Doc editor extends the chat editor with headings, tables, code blocks, images, callouts, custom nodes (MergeTag, RecordRef), slash commands, bubble menu, block handles, and a fixed toolbar. Env 2 is a separate component — not a reconfiguration of Env 1.

**Merge tags resolve by field ID, not field name.** MergeTag node attrs are `{ tableId, fieldId, fallback }`. Resolution reads `records.canonical_data` keyed by `fields.id` (UUID). Cross-linked merge tags resolve via `resolveLinkedRecordsL0`/`L1` from 3B-i.

**PDF generation is async.** The `generateDocument` server action enqueues a BullMQ job. The pipeline: load template → resolve merge tags → render HTML → Gotenberg Chromium HTML→PDF → upload to R2 → create `generated_documents` row. Client polls for completion.

**Gotenberg via Chromium endpoint.** MVP uses `POST /forms/chromium/convert/html` for HTML→PDF. The LibreOffice endpoint (`POST /forms/libreoffice/convert`) is post-MVP (DOCX→PDF for Prong 2).

**No schema migrations needed.** `document_templates` and `generated_documents` were created in 1B. This phase only creates data functions, services, and UI.

**CockroachDB safeguards remain active** (UUIDv7, no PG-specific syntax, no advisory locks).

### Mandatory Context for All Prompts

`CLAUDE.md` is the project root file — Claude Code auto-loads it.
`GLOSSARY.md` is available at `docs/reference/GLOSSARY.md` — consult when naming new things.
`MANIFEST.md` is not needed during build execution.

### Subdivision Summary

This sub-phase is decomposed into 5 units per the subdivision doc (`docs/subdivisions/3d-subdivision.md`):

| Unit | Name | Produces | Depends On |
|------|------|----------|------------|
| 1 | Document Template Data Layer | Template/generated-doc CRUD data functions, server actions, Zod schemas, test factories, `DocumentTemplate`/`GeneratedDocument` types | None |
| 2 | TipTap Environment 2 Editor Core | `SmartDocEditor`, `useSmartDocEditor`, `smartDocExtensions`, MergeTag/RecordRef/Callout custom nodes, SlashCommand, EditorToolbar, BubbleToolbar, BlockHandle | None (parallel with Unit 1) |
| 3 | Merge-Tag Resolution & Field Inserter | `resolveMergeTags()`, `resolveAndRenderHTML()`, `MergeTagInserter`, `useMergeTagFields`, `PreviewToggle` | Unit 1 |
| 4 | PDF Generation Pipeline | `PDFRenderer`, `GotenbergClient`, BullMQ `document-generation` queue + processor, `generateDocument` server action, `getDocumentGenerationStatus()` | Units 1, 3 |
| 5 | Template Management & Document Generation UI | Template list/editor pages, `GenerateDocumentDialog`, `GenerateDocumentButton`, `GeneratedDocumentList`, routes | Units 1, 2, 3, 4 |

### Skills for This Phase

Load these skill files before executing any prompt:
- `docs/skills/backend/SKILL.md` — backend patterns (data access, server actions, Redis, BullMQ)
- `docs/skills/ux-ui/SKILL.md` — UI component conventions (for Units 2, 3, 5)
- `docs/skills/phase-context/SKILL.md` — Always.

---

## PJ Decision Gate

**PJ Decision Gate:** None — all prompts are D or SH.

---

## Section Index

| Prompt | Unit | Deliverable | Summary | Depends On | Lines (est.) |
|--------|------|-------------|---------|------------|--------------|
| 1 | 1 | Document template data functions (CRUD + queries) | getDocumentTemplate(), listDocumentTemplates() with tenant isolation | None | ~250 |
| 2 | 1 | Generated document data functions + Zod schemas + test factories + server actions | Generated doc queries, Zod schemas, test factories, template CRUD server actions | 1 | ~350 |
| VP-1 | — | VERIFY — Completes Unit 1 | Template/generated doc CRUD, validation, and tenant isolation verification | 1–2 | — |
| 3 | 2 | TipTap extension config + custom nodes (MergeTag, RecordRef, Callout) | MergeTag node (tableId, fieldId, fallback), RecordRef, Callout for TipTap Env 2 | None | ~350 |
| 4 | 2 | SmartDocEditor shell + useSmartDocEditor hook + SlashCommand extension | SmartDocEditor (Env 2 superset of Env 1), useSmartDocEditor(), slash command menu | 3 | ~300 |
| 5 | 2 | EditorToolbar + BubbleToolbar + BlockHandle | Fixed toolbar, floating bubble toolbar, block drag handles | 4 | ~250 |
| VP-2 | — | VERIFY — Completes Unit 2 | Editor, custom nodes, slash commands, and toolbar verification | 3–5 | — |
| 6 | 3 | Merge-tag resolution service (resolveMergeTags + resolveAndRenderHTML) | Field ID resolution from canonical_data, cross-link traversal via L0/L1, HTML rendering | Unit 1 complete | ~300 |
| 7 | 3 | MergeTagInserter sidebar + useMergeTagFields hook + PreviewToggle | Sidebar field picker for merge tag insertion, live preview toggle | 6 | ~300 |
| VP-3 | — | VERIFY — Completes Unit 3 | Merge-tag resolution, inserter, and preview verification | 6–7 | — |
| 8 | 4 | PDFRenderer (TipTap JSON → print-optimized HTML) + GotenbergClient | TipTap JSON to print-CSS HTML, GotenbergClient Chromium HTML-to-PDF | Units 1, 3 complete | ~300 |
| 9 | 4 | BullMQ document-generation queue + processor + generateDocument server action + status polling | Async pipeline: template load, tag resolution, HTML render, Gotenberg PDF, R2 upload | 8 | ~350 |
| VP-4 | — | VERIFY — Completes Unit 4 | PDF generation pipeline from template to R2-stored PDF | 8–9 | — |
| 10 | 5 | Template list page + TemplateCard + template editor page with SmartDocEditor integration | Template CRUD pages, TemplateCard grid, SmartDocEditor integration | Units 1, 2, 3 complete | ~350 |
| 11 | 5 | GenerateDocumentDialog + GenerateDocumentButton + GeneratedDocumentList + Record View integration | Generate button in Record View header, dialog, generated docs list with download links | 10, Unit 4 complete | ~300 |
| VP-5 | — | VERIFY — Completes Unit 5 | Template management and document generation UI end-to-end | 10–11 | — |

---

## — Unit 1: Document Template Data Layer —

### Unit Context

Establishes the data access functions, server actions, Zod schemas, and test factories for document templates and generated documents. All downstream units consume these types and CRUD functions. The `document_templates` and `generated_documents` schemas already exist from Phase 1B — this unit builds the application layer on top.

**Interface Contract:**
Produces: `getDocumentTemplate()`, `listDocumentTemplates()` from `apps/web/src/data/document-templates.ts`; `getGeneratedDocument()`, `listGeneratedDocuments()` from `apps/web/src/data/generated-documents.ts`; `createDocumentTemplate`, `updateDocumentTemplate`, `duplicateDocumentTemplate`, `deleteDocumentTemplate` server actions from `apps/web/src/actions/document-templates.ts`; `createDocumentTemplateSchema`, `updateDocumentTemplateSchema` Zod schemas from `apps/web/src/lib/schemas/document-templates.ts`; `createTestDocumentTemplate()`, `createTestGeneratedDocument()` test factories; `DocumentTemplate`, `GeneratedDocument` types
Consumes: Existing Drizzle schema, `getDbForTenant()` pattern, existing factory helpers

---

## Prompt 1: Document Template Data Functions

**Unit:** 1
**Depends on:** None
**Load context:** `smart-docs.md` lines 337–414 (Document Generation — Two Prongs), `GLOSSARY.md` lines 392–409 (Document Template definition), `CLAUDE.md` lines 228–265 (Code Conventions), `CLAUDE.md` lines 267–298 (Testing Rules)
**Target files:** `apps/web/src/data/document-templates.ts`, `apps/web/src/data/generated-documents.ts`, `apps/web/src/data/document-templates.test.ts`, `apps/web/src/data/generated-documents.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(documents): add document template and generated document data functions [Phase 3D, Prompt 1]"

### Schema Snapshot

```
document_templates: id (UUIDv7 PK), tenant_id (→ tenants), table_id (→ tables, CASCADE), name (varchar 255), content (JSONB), settings (JSONB), version (int default 1), environment (varchar 'live'), created_by (→ users), created_at, updated_at
generated_documents: id (UUIDv7 PK), tenant_id (→ tenants), template_id (→ document_templates), source_record_id (uuid), file_url (varchar 2048), file_type (varchar 'pdf'), generated_by (→ users), generated_at, automation_run_id (uuid nullable), ai_drafted (boolean false)
```

### Task

Create the data access functions for document templates and generated documents following the `getDbForTenant()` pattern established in prior phases (reference `apps/web/src/data/threads.ts` for the most recent pattern).

**`apps/web/src/data/document-templates.ts`:**
1. `getDocumentTemplate(tenantId: string, templateId: string): Promise<DocumentTemplate | null>` — fetch by ID with tenant isolation, join creator name for display.
2. `listDocumentTemplates(tenantId: string, tableId: string): Promise<DocumentTemplate[]>` — list all templates for a table, ordered by `updated_at` desc. Include creator name.
3. Both functions must filter by `tenant_id` for RLS compliance.

**`apps/web/src/data/generated-documents.ts`:**
1. `getGeneratedDocument(tenantId: string, documentId: string): Promise<GeneratedDocument | null>` — fetch by ID with tenant isolation.
2. `listGeneratedDocuments(tenantId: string, recordId: string): Promise<GeneratedDocument[]>` — list all generated documents for a source record, ordered by `generated_at` desc. Include template name join.

**Tests:** Write tenant isolation tests for all 4 data functions using `testTenantIsolation()`. Test that `listDocumentTemplates` correctly scopes to `tableId`. Test that `listGeneratedDocuments` correctly scopes to `recordId`.

### Acceptance Criteria

- [ ] `getDocumentTemplate()` returns template with creator name when found, null when not found
- [ ] `listDocumentTemplates()` returns templates for the given table, ordered by updated_at desc
- [ ] `getGeneratedDocument()` returns generated document when found, null when not found
- [ ] `listGeneratedDocuments()` returns generated docs for the given record, ordered by generated_at desc
- [ ] `testTenantIsolation()` passes for all 4 data functions
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** D
**RSA Rationale:** CRUD data functions with tenant isolation follow the well-established `getDbForTenant()` pattern from prior phases (threads.ts, cross-link data layer). Schema is fully specified in `packages/shared/db/schema/document-templates.ts` and `generated-documents.ts`. No implementation choices.
**Reviewer Focus:** Spec-match check against schema columns. Verify tenant isolation in every query.

### Do NOT Build

- Template creation/update server actions (Prompt 2)
- Zod validation schemas (Prompt 2)
- Any merge-tag resolution logic (Unit 3)
- PDF generation (Unit 4)

---

## Prompt 2: Server Actions, Zod Schemas, Test Factories

**Unit:** 1
**Depends on:** 1
**Load context:** `smart-docs.md` lines 337–414 (Document Generation — Two Prongs), `GLOSSARY.md` lines 392–409 (Document Template definition), `CLAUDE.md` lines 228–265 (Code Conventions), `CLAUDE.md` lines 267–298 (Testing Rules)
**Target files:** `apps/web/src/actions/document-templates.ts`, `apps/web/src/lib/schemas/document-templates.ts`, `packages/shared/testing/factories/document-templates.ts`, `packages/shared/testing/factories/index.ts` (update exports), `apps/web/src/actions/document-templates.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(documents): add template server actions, Zod schemas, and test factories [Phase 3D, Prompt 2]"

### Schema Snapshot

```
document_templates: id (UUIDv7 PK), tenant_id, table_id, name (varchar 255), content (JSONB), settings (JSONB), version (int default 1), environment (varchar 'live'), created_by, created_at, updated_at
generated_documents: id (UUIDv7 PK), tenant_id, template_id, source_record_id, file_url (varchar 2048), file_type (varchar 'pdf'), generated_by, generated_at, automation_run_id, ai_drafted (boolean)
```

### Task

**Zod schemas (`apps/web/src/lib/schemas/document-templates.ts`):**
1. `createDocumentTemplateSchema` — validates: `name` (string, 1–255 chars), `tableId` (uuid), `content` (optional, defaults to empty TipTap doc `{ type: "doc", content: [] }`), `settings` (optional, defaults to `{ pageSize: "A4", orientation: "portrait", margins: { top: 20, right: 20, bottom: 20, left: 20 } }`)
2. `updateDocumentTemplateSchema` — validates: `name` (optional string 1–255), `content` (optional JSONB), `settings` (optional JSONB). At least one field required.

**Server actions (`apps/web/src/actions/document-templates.ts`):**
1. `createDocumentTemplate` — validate with Zod, get tenant from auth context, insert via Drizzle, return created template.
2. `updateDocumentTemplate` — validate, verify template belongs to tenant, increment `version`, update.
3. `duplicateDocumentTemplate` — load existing template, copy `content` and `settings`, set `name` to `"{originalName} (Copy)"`, create new template.
4. `deleteDocumentTemplate` — verify template belongs to tenant, hard delete (following existing pattern — templates have no external references at this stage). If generated documents exist for this template, block deletion with error.

**Test factories (`packages/shared/testing/factories/document-templates.ts`):**
1. `createTestDocumentTemplate(overrides?)` — creates a template with sensible defaults (name, content as empty TipTap doc, settings with A4 defaults).
2. `createTestGeneratedDocument(overrides?)` — creates a generated document with defaults (file_url, file_type: 'pdf').
3. Export both from factory index file.

**Tests:** Test all 4 server actions. Test that duplicate copies content correctly and appends "(Copy)". Test that delete blocks when generated documents exist. Test Zod schema validation (valid/invalid inputs).

### Acceptance Criteria

- [ ] `createDocumentTemplateSchema` and `updateDocumentTemplateSchema` validate correctly with proper defaults
- [ ] `createDocumentTemplate` action creates template with Zod validation and auth context
- [ ] `updateDocumentTemplate` action validates ownership, increments version
- [ ] `duplicateDocumentTemplate` copies content/settings, appends "(Copy)" to name
- [ ] `deleteDocumentTemplate` blocks deletion when generated documents exist
- [ ] [CONTRACT] `createDocumentTemplate` server action exported from `apps/web/src/actions/document-templates.ts`
- [ ] [CONTRACT] `updateDocumentTemplate` server action exported from `apps/web/src/actions/document-templates.ts`
- [ ] [CONTRACT] `duplicateDocumentTemplate` server action exported from `apps/web/src/actions/document-templates.ts`
- [ ] [CONTRACT] `deleteDocumentTemplate` server action exported from `apps/web/src/actions/document-templates.ts`
- [ ] [CONTRACT] `createDocumentTemplateSchema`, `updateDocumentTemplateSchema` exported from `apps/web/src/lib/schemas/document-templates.ts`
- [ ] [CONTRACT] `createTestDocumentTemplate()` factory exported from `packages/shared/testing/factories/`
- [ ] [CONTRACT] `createTestGeneratedDocument()` factory exported from `packages/shared/testing/factories/`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** D
**RSA Rationale:** Server action patterns are well-established from 3C (threads.ts actions), Zod schemas follow existing pattern, factory helpers follow testing factory template. No implementation choices beyond mechanical translation.
**Reviewer Focus:** Spec-match check — verify all 4 server actions exist, Zod defaults match spec (A4 page size, margins), factory produces valid records. Verify delete protection when generated docs exist.

### Do NOT Build

- `generateDocument` server action (Unit 4 — separate concern)
- Merge-tag resolution (Unit 3)
- Template editor UI (Unit 5)
- AI Draft capability (Phase 5)

---

## VERIFY Session Boundary (after Prompts 1–2) — Completes Unit 1

**Scope:** Verify all work from Prompts 1–2 integrates correctly.
**Unit status:** Unit 1 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: import `DocumentTemplate` and `GeneratedDocument` types from schema, confirm data functions return correctly typed results

**Interface contract check:**
- [ ] [CONTRACT] `getDocumentTemplate()` exported from `apps/web/src/data/document-templates.ts`
- [ ] [CONTRACT] `listDocumentTemplates()` exported from `apps/web/src/data/document-templates.ts`
- [ ] [CONTRACT] `getGeneratedDocument()` exported from `apps/web/src/data/generated-documents.ts`
- [ ] [CONTRACT] `listGeneratedDocuments()` exported from `apps/web/src/data/generated-documents.ts`
- [ ] [CONTRACT] All 4 server actions exported from `apps/web/src/actions/document-templates.ts`
- [ ] [CONTRACT] Zod schemas exported from `apps/web/src/lib/schemas/document-templates.ts`
- [ ] [CONTRACT] Both test factories exported from `packages/shared/testing/factories/`
- [ ] [CONTRACT] `DocumentTemplate` and `GeneratedDocument` types available via schema re-export

**State file updates:**
- Update TASK-STATUS.md: Unit 1 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 1–2 [Phase 3D, VP-1]", then push branch to origin.

Fix any failures before proceeding to Prompt 3.

---

## — Unit 2: TipTap Environment 2 Editor Core —

### Unit Context

Builds the full-featured Smart Doc editor — a superset of the Environment 1 chat editor from 3C. This is the authoring surface for document templates. It provides headings, tables, code blocks, images, callouts, custom nodes (MergeTag, RecordRef), slash commands, bubble menu, block handles, and the fixed toolbar. This unit has no dependency on Unit 1 — it can be built in parallel.

**Interface Contract:**
Produces: `SmartDocEditor` from `apps/web/src/components/editor/SmartDocEditor.tsx`; `useSmartDocEditor(options)` from `apps/web/src/components/editor/use-smart-doc-editor.ts`; `smartDocExtensions` from `apps/web/src/components/editor/extensions/index.ts`; `MergeTag` extension, `MergeTagView`, `RecordRef` extension, `RecordRefView`, `Callout` extension, `CalloutView`, `SlashCommand` extension, `SlashCommandList`, `EditorToolbar`, `BubbleToolbar`, `BlockHandle`
Consumes: TipTap libraries, existing shadcn/ui primitives, existing chat editor patterns from Env 1

---

## Prompt 3: TipTap Extension Config + Custom Nodes (MergeTag, RecordRef, Callout)

**Unit:** 2
**Depends on:** None
**Load context:** `smart-docs.md` lines 49–163 (TipTap Editor Architecture — component structure), `smart-docs.md` lines 165–195 (TipTap JSONB Document Schema), `smart-docs.md` lines 197–208 (Custom EveryStack Node Definitions), `GLOSSARY.md` lines 392–409 (Document Template)
**Target files:** `apps/web/src/components/editor/extensions/index.ts`, `apps/web/src/components/editor/extensions/merge-tag/MergeTag.ts`, `apps/web/src/components/editor/extensions/merge-tag/MergeTagView.tsx`, `apps/web/src/components/editor/extensions/record-ref/RecordRef.ts`, `apps/web/src/components/editor/extensions/record-ref/RecordRefView.tsx`, `apps/web/src/components/editor/extensions/callout/Callout.ts`, `apps/web/src/components/editor/extensions/callout/CalloutView.tsx`
**Migration required:** No
**Git:** Commit with message "feat(editor): add TipTap Env 2 extension config and custom nodes [Phase 3D, Prompt 3]"

### Schema Snapshot

N/A — no schema changes.

### Task

**Reference the Env 1 chat editor extensions** at `apps/web/src/components/chat/extensions.ts` for pattern guidance. Env 2 is a superset — all Env 1 extensions plus additional ones.

**Extension bundle (`apps/web/src/components/editor/extensions/index.ts`):**
Configure and export `smartDocExtensions` — the full extension bundle for the Smart Doc editor. Include:
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
- Custom: MergeTag, RecordRef, Callout, SlashCommand (shell — full impl in Prompt 4)

**MergeTag custom node (`extensions/merge-tag/`):**
1. `MergeTag.ts` — TipTap `Node.create()`. Attrs: `{ tableId: string, fieldId: string, fallback: string }`. Inline node, not editable. Group: `inline`. Content: none. Atom: true.
2. `MergeTagView.tsx` — React `NodeViewWrapper`. Renders as teal pill (`bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full text-sm inline-flex items-center gap-1`) with a field type icon and field name display. The field name is looked up client-side (passed via a context provider or resolved from attrs).

**RecordRef custom node (`extensions/record-ref/`):**
1. `RecordRef.ts` — Attrs: `{ tableId: string, recordId: string, displayText: string }`. Inline, atom.
2. `RecordRefView.tsx` — Renders as inline chip with record icon. Clickable (navigates to record in future — for now, just display).

**Callout custom node (`extensions/callout/`):**
1. `Callout.ts` — Attrs: `{ emoji: string (default "ℹ️"), color: string (default "blue") }`. Block node. Content: `block+`. 4 variants: info (blue), warning (yellow), success (green), error (red).
2. `CalloutView.tsx` — React `NodeViewWrapper`. Colored left border + background + emoji. Content editable area.

### Acceptance Criteria

- [ ] `smartDocExtensions` exports a configured extension array with all core TipTap extensions listed in smart-docs.md
- [ ] MergeTag node stores `{ tableId, fieldId, fallback }` attrs and is inline + atom
- [ ] [CONTRACT] `MergeTag` extension exported from `apps/web/src/components/editor/extensions/merge-tag/MergeTag.ts`
- [ ] [CONTRACT] `MergeTagView` renders as teal pill with field icon from `apps/web/src/components/editor/extensions/merge-tag/MergeTagView.tsx`
- [ ] [CONTRACT] `RecordRef` extension exported from `apps/web/src/components/editor/extensions/record-ref/RecordRef.ts`
- [ ] [CONTRACT] `RecordRefView` renders as inline chip from `apps/web/src/components/editor/extensions/record-ref/RecordRefView.tsx`
- [ ] [CONTRACT] `Callout` extension exported with 4 variants (info/warning/success/error) from `apps/web/src/components/editor/extensions/callout/Callout.ts`
- [ ] [CONTRACT] `CalloutView` renders colored callout from `apps/web/src/components/editor/extensions/callout/CalloutView.tsx`
- [ ] Editor outputs valid TipTap JSON matching the JSONB schema in smart-docs.md lines 165–195
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 197–208 specify exact node attrs and behavior for all three custom nodes. The extension list is fully enumerated in lines 66–82. Builder decides internal TipTap plugin authoring patterns, CSS styling details, and React NodeView component structure.
**Reviewer Focus:** Validate node attrs match smart-docs.md §Custom EveryStack Node Definitions (lines 197–208). Verify extension bundle includes all items from lines 66–82.

### Do NOT Build

- SlashCommand full implementation (Prompt 4)
- EditorToolbar / BubbleToolbar / BlockHandle (Prompt 5)
- SmartDocEditor wrapper component (Prompt 4)
- Merge-tag resolution logic (Unit 3)
- Embed, Signature, FileAttachment, DatabaseViewEmbed nodes (post-MVP)
- Toggle node (post-MVP)
- Collaboration via Yjs/Hocuspocus (post-MVP)
- Backlinks `[[page]]` (post-MVP)
- UniqueID extension (post-MVP — collaboration)

---

## Prompt 4: SmartDocEditor Shell + useSmartDocEditor Hook + SlashCommand

**Unit:** 2
**Depends on:** 3
**Load context:** `smart-docs.md` lines 49–98 (Environment 2 editor, UX pattern, core extensions, context-specific extensions), `smart-docs.md` lines 108–163 (React component structure)
**Target files:** `apps/web/src/components/editor/SmartDocEditor.tsx`, `apps/web/src/components/editor/use-smart-doc-editor.ts`, `apps/web/src/components/editor/extensions/slash-command/SlashCommand.ts`, `apps/web/src/components/editor/extensions/slash-command/SlashCommandList.tsx`, `apps/web/src/components/editor/extensions/slash-command/commands.ts`
**Migration required:** No
**Git:** Commit with message "feat(editor): add SmartDocEditor shell, hook, and slash command [Phase 3D, Prompt 4]"

### Schema Snapshot

N/A — no schema changes.

### Task

**`useSmartDocEditor` hook (`use-smart-doc-editor.ts`):**
Create a hook that initializes a TipTap `Editor` instance with the `smartDocExtensions` bundle. Options:
- `content?: TipTapJSON` — initial document content (for loading saved templates)
- `onUpdate?: (content: TipTapJSON) => void` — callback on content change (for auto-save)
- `editable?: boolean` — defaults to true
- `placeholder?: string`

Reference the Env 1 `use-chat-editor.ts` hook for pattern. The Env 2 hook is simpler (no enter-to-send, no 3-state machine) but structurally similar.

**`SmartDocEditor` component (`SmartDocEditor.tsx`):**
Main editor wrapper. Accepts:
- `content?: TipTapJSON` — initial content
- `onUpdate?: (content: TipTapJSON) => void`
- `editable?: boolean`
- `className?: string`
- `renderToolbar?: (editor: Editor) => ReactNode` — slot for toolbar (injected by parent page)
- `renderSidebar?: () => ReactNode` — slot for merge-tag inserter sidebar (injected by parent page)

Layout: toolbar slot at top → editor content area (full width minus sidebar) → sidebar slot on right. Uses `EditorContent` from `@tiptap/react`. Styled with `prose` Tailwind typography classes for content formatting.

**SlashCommand extension (`extensions/slash-command/`):**
1. `SlashCommand.ts` — TipTap Suggestion extension. Triggers on `/` at the start of a line or after whitespace. Opens the command list popup.
2. `SlashCommandList.tsx` — Floating popup using shadcn Popover or custom positioning. Keyboard navigable (arrow keys + enter). Filterable by typing after `/`.
3. `commands.ts` — Block type registry. Include MVP commands: Heading 1–4, Bullet List, Ordered List, Task List, Blockquote, Code Block, Table, Image, Callout (4 variants), Horizontal Rule. Each command: `{ title, description, icon, command: (editor) => void }`.

### Acceptance Criteria

- [ ] [CONTRACT] `SmartDocEditor` exported from `apps/web/src/components/editor/SmartDocEditor.tsx`
- [ ] [CONTRACT] `useSmartDocEditor` hook exported from `apps/web/src/components/editor/use-smart-doc-editor.ts`
- [ ] SmartDocEditor renders with toolbar slot, content area, and sidebar slot
- [ ] `useSmartDocEditor` initializes TipTap editor with smartDocExtensions, accepts content and onUpdate
- [ ] Editor loads saved TipTap JSON content correctly
- [ ] Editor outputs valid TipTap JSON on changes via onUpdate callback
- [ ] [CONTRACT] `SlashCommand` extension exported from `apps/web/src/components/editor/extensions/slash-command/SlashCommand.ts`
- [ ] [CONTRACT] `SlashCommandList` popup component exported from `apps/web/src/components/editor/extensions/slash-command/SlashCommandList.tsx`
- [ ] Slash command menu opens on `/` and lists available block types
- [ ] Slash command menu is keyboard navigable and filterable
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 59–64 specify the UX pattern (full toolbar, slash command, floating bubble menu, block handles, breadcrumb). Lines 108–163 specify the React component structure. Builder decides internal component composition, TipTap Suggestion plugin configuration, and popup positioning strategy.
**Reviewer Focus:** Validate SmartDocEditor layout matches spec (toolbar top, content area, sidebar right). Verify slash command triggers on `/` with correct block type list.

### Do NOT Build

- EditorToolbar (Prompt 5)
- BubbleToolbar (Prompt 5)
- BlockHandle (Prompt 5)
- Breadcrumb navigation (post-MVP — wiki contexts only)
- FloatingPlus menu (post-MVP — handled by slash command for MVP)

---

## Prompt 5: EditorToolbar + BubbleToolbar + BlockHandle

**Unit:** 2
**Depends on:** 4
**Load context:** `smart-docs.md` lines 108–163 (React component structure — toolbar, menus), `smart-docs.md` lines 49–98 (UX Pattern, context-specific extensions)
**Target files:** `apps/web/src/components/editor/toolbar/EditorToolbar.tsx`, `apps/web/src/components/editor/toolbar/FormatGroup.tsx`, `apps/web/src/components/editor/toolbar/AlignGroup.tsx`, `apps/web/src/components/editor/toolbar/InsertGroup.tsx`, `apps/web/src/components/editor/toolbar/HistoryGroup.tsx`, `apps/web/src/components/editor/menus/BubbleToolbar.tsx`, `apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx`
**Migration required:** No
**Git:** Commit with message "feat(editor): add toolbar, bubble menu, and block handles [Phase 3D, Prompt 5]"

### Schema Snapshot

N/A — no schema changes.

### Task

**`EditorToolbar` (`toolbar/EditorToolbar.tsx`):**
Fixed top toolbar for the Smart Doc editor. Accepts the TipTap `Editor` instance. Contains 4 groups:
1. `FormatGroup` — Bold, Italic, Underline, Strike, Code, Highlight, Text Color. Toggle buttons using `editor.chain().focus().toggleBold().run()` pattern. Active state from `editor.isActive('bold')`.
2. `AlignGroup` — Left, Center, Right, Justify alignment.
3. `InsertGroup` — Link, Image upload, Table insert, Code Block, Callout. Dropdowns where needed (table size picker).
4. `HistoryGroup` — Undo, Redo.

Each group separated by a visual divider. Use shadcn `Toggle` or `Button` components with `variant="ghost"` and `size="sm"`. Toolbar is responsive — groups collapse into an overflow menu on narrow widths.

**`BubbleToolbar` (`menus/BubbleToolbar.tsx`):**
Floating toolbar that appears on text selection. Uses TipTap's `BubbleMenu` component from `@tiptap/react`. Contains inline formatting options: Bold, Italic, Underline, Strike, Code, Link, Highlight, Text Color. Compact horizontal layout.

**`BlockHandle` (`extensions/block-handle/BlockHandle.tsx`):**
Appears on hover to the left of each block. Provides:
1. Drag handle icon for drag-to-reorder blocks (using TipTap's drag handle extension or custom ProseMirror plugin)
2. Click opens a small menu: Delete block, Duplicate block, Move up, Move down

Use `@tiptap-pro/extension-drag-handle-react` if available, otherwise implement a custom solution using ProseMirror decorations that show a grip icon on block hover.

### Acceptance Criteria

- [ ] [CONTRACT] `EditorToolbar` exported from `apps/web/src/components/editor/toolbar/EditorToolbar.tsx`
- [ ] EditorToolbar contains FormatGroup, AlignGroup, InsertGroup, HistoryGroup with correct actions
- [ ] Format buttons show active state when formatting is applied
- [ ] [CONTRACT] `BubbleToolbar` appears on text selection with inline formatting options from `apps/web/src/components/editor/menus/BubbleToolbar.tsx`
- [ ] [CONTRACT] `BlockHandle` appears on block hover for drag-reorder from `apps/web/src/components/editor/extensions/block-handle/BlockHandle.tsx`
- [ ] Block handle drag-reorder moves blocks within the document
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 108–163 specifies the component structure and toolbar groups. Lines 59–64 describe the UX pattern. Builder decides responsive collapse behavior, dropdown interactions, and drag handle implementation approach.
**Reviewer Focus:** Validate toolbar groups match spec component structure. Verify bubble menu appears on selection. Verify block handle enables drag-reorder.

### Do NOT Build

- BlockMenu (per-block context menu beyond basic actions — post-MVP)
- FloatingPlus (post-MVP)
- Breadcrumb navigation (post-MVP — wiki contexts)
- Mention extension in editor toolbar (not needed for template authoring — `@mention` is Env 1)

---

## VERIFY Session Boundary (after Prompts 3–5) — Completes Unit 2

**Scope:** Verify all work from Prompts 3–5 integrates correctly.
**Unit status:** Unit 2 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: render `SmartDocEditor` in a test page, type content, verify toolbar actions work, verify slash command opens, verify MergeTag/RecordRef/Callout nodes render correctly when inserted programmatically

**Interface contract check:**
- [ ] [CONTRACT] `SmartDocEditor` exported from `apps/web/src/components/editor/SmartDocEditor.tsx`
- [ ] [CONTRACT] `useSmartDocEditor` exported from `apps/web/src/components/editor/use-smart-doc-editor.ts`
- [ ] [CONTRACT] `smartDocExtensions` exported from `apps/web/src/components/editor/extensions/index.ts`
- [ ] [CONTRACT] `MergeTag` extension exported
- [ ] [CONTRACT] `MergeTagView` renders as teal pill
- [ ] [CONTRACT] `RecordRef` extension exported
- [ ] [CONTRACT] `RecordRefView` renders as inline chip
- [ ] [CONTRACT] `Callout` extension exported with 4 variants
- [ ] [CONTRACT] `CalloutView` renders colored callout
- [ ] [CONTRACT] `SlashCommand` extension exported
- [ ] [CONTRACT] `SlashCommandList` popup exported
- [ ] [CONTRACT] `EditorToolbar` exported
- [ ] [CONTRACT] `BubbleToolbar` exported
- [ ] [CONTRACT] `BlockHandle` exported

**State file updates:**
- Update TASK-STATUS.md: Unit 2 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 3–5 [Phase 3D, VP-2]", then push branch to origin.

Fix any failures before proceeding to Prompt 6.

---

## — Unit 3: Merge-Tag Resolution & Field Inserter —

### Unit Context

The merge-tag system bridges document templates and record data. The resolution service takes TipTap JSON and a record, resolves all MergeTag nodes to field values (including cross-link traversal), and returns resolved JSON or HTML. The field inserter is a sidebar UI that lets template authors browse and insert merge-tag nodes. This unit depends on Unit 1 (DocumentTemplate types) but not Unit 2.

**Interface Contract:**
Produces: `resolveMergeTags()`, `resolveAndRenderHTML()` from `apps/web/src/lib/editor/merge-resolver.ts`; `MergeTagInserter` from `apps/web/src/components/editor/MergeTagInserter.tsx`; `useMergeTagFields()` from `apps/web/src/components/editor/use-merge-tag-fields.ts`; `MergeTagField` type from `apps/web/src/lib/types/document-templates.ts`; `PreviewToggle` from `apps/web/src/components/editor/PreviewToggle.tsx`
Consumes: `DocumentTemplate` type from Unit 1; `resolveLinkedRecordsL0`/`L1` from 3B-i; `resolveAllFieldPermissions()` from 3A-iii; `FieldTypeRegistry` from `packages/shared/sync/field-registry.ts`

---

## Prompt 6: Merge-Tag Resolution Service

**Unit:** 3
**Depends on:** Unit 1 complete (produces `DocumentTemplate` type, data functions)
**Load context:** `smart-docs.md` lines 99–106 (Template Authoring Mode — merge-tag categories), `smart-docs.md` lines 197–208 (Custom EveryStack Node Definitions — MergeTag attrs), `smart-docs.md` lines 210–229 (Rendering Pipelines — merge-tag → output mapping), `smart-docs.md` lines 399–407 (Generation Flow — resolution steps)
**Target files:** `apps/web/src/lib/editor/merge-resolver.ts`, `apps/web/src/lib/types/document-templates.ts`, `apps/web/src/lib/editor/merge-resolver.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(documents): add merge-tag resolution service [Phase 3D, Prompt 6]"

### Schema Snapshot

```
records: id (UUIDv7 PK), tenant_id, table_id, canonical_data (JSONB — keyed by fields.id)
fields: id (UUIDv7 PK), tenant_id, table_id, name, field_type, config (JSONB)
cross_links: id, tenant_id, source_table_id, target_table_id, card_fields (JSONB)
```

### Task

**Types (`apps/web/src/lib/types/document-templates.ts`):**
Define `MergeTagField` type:
```typescript
interface MergeTagField {
  tableId: string;
  fieldId: string;
  fieldName: string;
  fieldType: string;
  tableName: string;
  isLinked: boolean; // true if from a linked table via cross-link
  crossLinkId?: string; // if isLinked, the cross_link ID
}
```

**Resolution service (`apps/web/src/lib/editor/merge-resolver.ts`):**

1. `resolveMergeTags(content: TipTapJSON, recordId: string, tenantId: string): Promise<TipTapJSON>` — Deep-clones the TipTap JSON document tree. Walks all nodes. For each `mergeTag` node:
   - Extract `{ tableId, fieldId, fallback }` from attrs
   - If `tableId` matches the source record's table: read `records.canonical_data[fieldId]` directly
   - If `tableId` is a linked table: use `resolveLinkedRecordsL0` or `resolveLinkedRecordsL1` from 3B-i to get the linked record's canonical_data, then read `[fieldId]`
   - Format the field value using `FieldTypeRegistry` display formatting (dates, currencies, etc.)
   - Replace the `mergeTag` node with a `text` node containing the resolved value
   - If field value is null/undefined: use `fallback` attr value, or empty string if no fallback
   - Return the resolved TipTap JSON

2. `resolveAndRenderHTML(content: TipTapJSON, recordId: string, tenantId: string): Promise<string>` — Calls `resolveMergeTags()` then uses TipTap's `generateHTML()` utility to convert the resolved JSON to HTML string. Import `generateHTML` from `@tiptap/html`. Pass the `smartDocExtensions` for node rendering.

**Tests:** Test resolution with simple field merge tags. Test resolution with linked field merge tags. Test fallback behavior for null fields. Test that non-mergeTag nodes are preserved unchanged. Test `resolveAndRenderHTML` produces valid HTML.

### Acceptance Criteria

- [ ] [CONTRACT] `resolveMergeTags(content, recordId, tenantId)` exported from `apps/web/src/lib/editor/merge-resolver.ts`
- [ ] [CONTRACT] `resolveAndRenderHTML(content, recordId, tenantId)` exported from `apps/web/src/lib/editor/merge-resolver.ts`
- [ ] [CONTRACT] `MergeTagField` type exported from `apps/web/src/lib/types/document-templates.ts`
- [ ] `resolveMergeTags()` replaces all MergeTag nodes with their field values from `records.canonical_data`
- [ ] Linked field merge tags resolve via cross-link traversal (L0/L1)
- [ ] Missing/null field values render using the MergeTag's `fallback` attr (or empty string if no fallback)
- [ ] Non-mergeTag nodes are preserved unchanged in the output
- [ ] `resolveAndRenderHTML()` produces valid HTML string
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 197–208 specifies MergeTag attrs and behavior ("resolved at render time, `fallback` for empty fields"). Lines 399–407 specifies the generation flow including cross-link resolution. Builder decides the tree-walking algorithm, how to integrate with existing cross-link resolution functions, and field value formatting strategy.
**Reviewer Focus:** Validate merge-tag resolution covers both same-table and linked-table fields per smart-docs.md §Generation Flow. Verify fallback behavior. Verify cross-link traversal uses existing `resolveLinkedRecordsL0`/`L1`.

### Do NOT Build

- Loop fields (`{#line_items}...{/line_items}`) — post-MVP complexity; MVP merge tags are simple field replacement
- Conditional fields (`{#if status == "Active"}...{/if}`) — post-MVP
- MergeTagInserter UI (Prompt 7)
- PDF rendering (Unit 4)

---

## Prompt 7: MergeTagInserter Sidebar + useMergeTagFields + PreviewToggle

**Unit:** 3
**Depends on:** 6
**Load context:** `smart-docs.md` lines 99–106 (Template Authoring Mode — field picker sidebar, preview toggle), `smart-docs.md` lines 197–208 (MergeTag node attrs), `GLOSSARY.md` lines 392–409 (merge tag picker scope)
**Target files:** `apps/web/src/components/editor/MergeTagInserter.tsx`, `apps/web/src/components/editor/use-merge-tag-fields.ts`, `apps/web/src/components/editor/PreviewToggle.tsx`, `apps/web/src/components/editor/MergeTagInserter.test.tsx`
**Migration required:** No
**Git:** Commit with message "feat(editor): add merge-tag inserter sidebar and preview toggle [Phase 3D, Prompt 7]"

### Schema Snapshot

N/A — reads existing fields and cross_links data.

### Task

**`useMergeTagFields` hook (`use-merge-tag-fields.ts`):**
Fetches all available fields for merge-tag insertion given a `tableId` and `tenantId`:
1. Fetch fields for the source table from the fields table
2. Fetch cross-links where `source_table_id = tableId` to discover linked tables
3. For each linked table, fetch its fields (using `card_fields` from the cross-link to determine which fields are available)
4. Filter all fields through `resolveAllFieldPermissions()` from 3A-iii — hidden fields are excluded from the inserter
5. Return as `MergeTagField[]` grouped by table (source table first, then linked tables)

**`MergeTagInserter` component (`MergeTagInserter.tsx`):**
Sidebar component rendered in the SmartDocEditor's sidebar slot. Displays available merge-tag fields:
1. Fields grouped by table with table name as section header (source table first, linked tables after with a "Linked Fields" separator)
2. Each field shows: field type icon + field name
3. Searchable — filter field list by typing
4. Click a field → insert a `MergeTag` node into the editor at cursor position using `editor.chain().focus().insertContent({ type: 'mergeTag', attrs: { tableId, fieldId, fallback: '' } }).run()`
5. Accepts the TipTap `Editor` instance as prop (to insert nodes)

**`PreviewToggle` component (`PreviewToggle.tsx`):**
Three-state toggle: Edit / Preview / Raw.
- **Edit:** Normal editor mode with MergeTag pills (teal chips showing field names)
- **Preview:** Merge tags resolved with sample record data and rendered inline (uses `resolveMergeTags()` from Prompt 6 with a sample record)
- **Raw:** Shows merge tags as `{field_name}` text syntax
- Use shadcn `Tabs` or `ToggleGroup` for the toggle UI

### Acceptance Criteria

- [ ] [CONTRACT] `MergeTagInserter` exported from `apps/web/src/components/editor/MergeTagInserter.tsx`
- [ ] [CONTRACT] `useMergeTagFields(tableId, tenantId)` exported from `apps/web/src/components/editor/use-merge-tag-fields.ts`
- [ ] [CONTRACT] `PreviewToggle` exported from `apps/web/src/components/editor/PreviewToggle.tsx`
- [ ] `MergeTagInserter` displays fields grouped by table (source table first, then linked tables)
- [ ] Field list respects field-level permissions (hidden fields not shown)
- [ ] Clicking a field in the inserter inserts a MergeTag node into the editor at cursor
- [ ] Field list is searchable
- [ ] Preview mode resolves merge tags with sample record data and renders inline
- [ ] Raw mode shows `{field_name}` text syntax
- [ ] Edit mode shows teal pill MergeTag nodes
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 99–106 specifies the three merge-tag categories, field picker sidebar, and preview toggle (Edit/Preview/Raw). Builder decides the field picker UX layout, search implementation, preview rendering strategy with sample data, and cross-link field discovery approach.
**Reviewer Focus:** Validate field list includes cross-linked fields per smart-docs.md §Template Authoring Mode. Verify preview toggle has all 3 modes. Verify permission filtering.

### Do NOT Build

- Loop field inserter (`{#line_items}...{/line_items}` — post-MVP)
- Conditional field inserter (`{#if}...{/if}` — post-MVP)
- AI-suggested merge tags (post-MVP — Phase 5)

---

## VERIFY Session Boundary (after Prompts 6–7) — Completes Unit 3

**Scope:** Verify all work from Prompts 6–7 integrates correctly.
**Unit status:** Unit 3 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings (MergeTagInserter UI text)
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. Manual verification: confirm MergeTagInserter shows fields from source table and linked tables, confirm clicking inserts a MergeTag node, confirm PreviewToggle switches between Edit/Preview/Raw

**Interface contract check:**
- [ ] [CONTRACT] `resolveMergeTags()` exported from `apps/web/src/lib/editor/merge-resolver.ts`
- [ ] [CONTRACT] `resolveAndRenderHTML()` exported from `apps/web/src/lib/editor/merge-resolver.ts`
- [ ] [CONTRACT] `MergeTagInserter` exported from `apps/web/src/components/editor/MergeTagInserter.tsx`
- [ ] [CONTRACT] `useMergeTagFields()` exported from `apps/web/src/components/editor/use-merge-tag-fields.ts`
- [ ] [CONTRACT] `MergeTagField` type exported from `apps/web/src/lib/types/document-templates.ts`
- [ ] [CONTRACT] `PreviewToggle` exported from `apps/web/src/components/editor/PreviewToggle.tsx`

**State file updates:**
- Update TASK-STATUS.md: Unit 3 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 6–7 [Phase 3D, VP-3]", then push branch to origin.

Fix any failures before proceeding to Prompt 8.

---

## — Unit 4: PDF Generation Pipeline —

### Unit Context

The backend pipeline that converts a resolved document template into a PDF. Takes TipTap JSON → resolves merge tags → renders to styled HTML → sends to Gotenberg (headless Chromium) → stores the resulting PDF in R2 → creates a `generated_documents` row with the download URL. Runs as an async BullMQ job to avoid blocking the UI.

**Interface Contract:**
Produces: `PDFRenderer` from `apps/web/src/lib/editor/pdf-renderer.ts`; `GotenbergClient` from `packages/shared/pdf/gotenberg-client.ts`; `processDocumentGeneration` BullMQ processor from `apps/worker/src/processors/document-generation/generate.ts`; `enqueueDocumentGeneration()` queue helper; `generateDocument` server action from `apps/web/src/actions/document-generation.ts`; `getDocumentGenerationStatus()` polling endpoint; `document-generation` BullMQ queue registration
Consumes: `DocumentTemplate`, `GeneratedDocument` types from Unit 1; `createTestGeneratedDocument()` factory from Unit 1; `resolveMergeTags()`, `resolveAndRenderHTML()` from Unit 3; `StorageClient` from 1G; `getDbForTenant()`

---

## Prompt 8: PDFRenderer + GotenbergClient

**Unit:** 4
**Depends on:** Unit 1 complete, Unit 3 complete (produces `resolveAndRenderHTML()`)
**Load context:** `smart-docs.md` lines 210–229 (Rendering Pipelines — node-to-HTML mapping, PDF pipeline), `smart-docs.md` lines 390–398 (Backend Requirements — Gotenberg endpoints), `GLOSSARY.md` lines 392–409 (Document Template — PDF via Gotenberg), `CLAUDE.md` lines 46–71 (Tech Stack — Gotenberg, R2)
**Target files:** `apps/web/src/lib/editor/pdf-renderer.ts`, `packages/shared/pdf/gotenberg-client.ts`, `apps/web/src/lib/editor/pdf-renderer.test.ts`, `packages/shared/pdf/gotenberg-client.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(documents): add PDFRenderer and GotenbergClient [Phase 3D, Prompt 8]"

### Schema Snapshot

N/A — no schema changes. Reads `document_templates.content` (JSONB) and `document_templates.settings` (JSONB: `{ pageSize, orientation, margins: { top, right, bottom, left } }`).

### Task

**`PDFRenderer` (`apps/web/src/lib/editor/pdf-renderer.ts`):**
Service that converts TipTap JSON to print-optimized HTML suitable for Gotenberg's Chromium endpoint.

1. `renderToHTML(content: TipTapJSON, settings: DocumentTemplateSettings): string` — Takes resolved TipTap JSON (merge tags already replaced) and template settings. Produces a complete HTML document:
   - Full `<!DOCTYPE html>` with `<head>` containing print-optimized CSS
   - Print CSS: page size from settings (A4 default), orientation, margins, font embedding (DM Sans from Google Fonts CDN), prose-like typography
   - Node-to-HTML mapping per smart-docs.md lines 221–231: headings → `<hN>`, tables → `<table>`, images → `<img>` with absolute R2 URLs, callouts → colored `<div>`, recordRef → `<a>` link (plain text in PDF), mergeTag nodes should already be resolved (if any remain, render as empty string), signatures → `<img>` base64
   - Use `generateHTML()` from `@tiptap/html` with the extension bundle for the main content, then wrap in the full HTML document template with CSS

2. Export a `DocumentTemplateSettings` type: `{ pageSize: 'A4' | 'Letter'; orientation: 'portrait' | 'landscape'; margins: { top: number; right: number; bottom: number; left: number } }`

**`GotenbergClient` (`packages/shared/pdf/gotenberg-client.ts`):**
HTTP client for Gotenberg's Chromium HTML→PDF endpoint.

1. `convertHTMLToPDF(html: string, options?: GotenbergOptions): Promise<Buffer>` — Sends `POST /forms/chromium/convert/html` to Gotenberg with the HTML as a form-data file upload. Returns the PDF buffer.
   - `GotenbergOptions`: `{ timeout?: number }` (default 30s)
   - Gotenberg URL from environment variable `GOTENBERG_URL` (default `http://localhost:3000`)
   - Use `node-fetch` or native `fetch` with `FormData` for multipart upload
   - Error handling: timeout → throw specific error, Gotenberg down → throw with clear message
   - Parse Gotenberg HTTP response: 200 → return body as Buffer, non-200 → throw with status and message

**Tests:** Test `PDFRenderer.renderToHTML()` produces valid HTML with correct CSS (check page-size, margins, font includes). Test `GotenbergClient` with mocked HTTP (MSW) — verify correct endpoint, form data payload, and error handling for timeout and service down.

### Acceptance Criteria

- [ ] [CONTRACT] `PDFRenderer` service exported from `apps/web/src/lib/editor/pdf-renderer.ts`
- [ ] `renderToHTML()` converts TipTap JSON to a complete HTML document with print-optimized CSS
- [ ] HTML includes correct page size, orientation, and margins from template settings
- [ ] HTML includes DM Sans font import for consistent typography
- [ ] Node-to-HTML mapping follows smart-docs.md lines 221–231
- [ ] [CONTRACT] `GotenbergClient` exported from `packages/shared/pdf/gotenberg-client.ts`
- [ ] `convertHTMLToPDF()` calls Gotenberg's Chromium HTML→PDF endpoint correctly
- [ ] Error handling: Gotenberg timeout throws specific error, Gotenberg down throws clear message
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 210–229 specifies the pipeline stages and node-to-HTML mapping. Lines 390–398 specify Gotenberg endpoints (Chromium for HTML→PDF). Builder decides the HTML template structure, print-optimized CSS implementation, the Gotenberg HTTP client approach (fetch vs axios, multipart construction), and error handling patterns.
**Reviewer Focus:** Validate HTML output includes print CSS with configurable page settings. Verify Gotenberg endpoint is `/forms/chromium/convert/html` (not LibreOffice). Verify error handling for timeout and service unavailability.

### Do NOT Build

- LibreOffice DOCX→PDF endpoint (post-MVP — Prong 2)
- Docxtemplater integration (post-MVP)
- PDF watermarking or digital signatures (post-MVP)
- PDF/A compliance (post-MVP)
- Email renderer (post-MVP)

---

## Prompt 9: BullMQ Document Generation Queue + Processor + Server Action + Status Polling

**Unit:** 4
**Depends on:** 8
**Load context:** `smart-docs.md` lines 399–407 (Generation Flow), `smart-docs.md` lines 390–398 (Backend Requirements), `CLAUDE.md` lines 46–71 (Tech Stack — BullMQ, R2)
**Target files:** `apps/worker/src/processors/document-generation/generate.ts`, `apps/worker/src/queues.ts` (add queue registration), `apps/worker/src/index.ts` (register processor), `apps/web/src/actions/document-generation.ts`, `apps/web/src/lib/queue.ts` (or co-located helper), `apps/web/src/actions/document-generation.test.ts`
**Migration required:** No
**Git:** Commit with message "feat(documents): add document generation pipeline with BullMQ queue [Phase 3D, Prompt 9]"

### Schema Snapshot

```
generated_documents: id (UUIDv7 PK), tenant_id, template_id, source_record_id, file_url (varchar 2048), file_type ('pdf'), generated_by, generated_at, automation_run_id (nullable), ai_drafted (boolean)
document_templates: id, tenant_id, table_id, name, content (JSONB), settings (JSONB), version, environment, created_by, created_at, updated_at
```

### Task

**BullMQ queue registration (`apps/worker/src/queues.ts`):**
Add `document-generation` queue to the existing queue registry. Follow the pattern established by the `notification` queue from 3C.

**BullMQ processor (`apps/worker/src/processors/document-generation/generate.ts`):**
`processDocumentGeneration` job handler. Job data:
```typescript
interface GenerateDocumentJobData {
  tenantId: string;
  templateId: string;
  recordId: string;
  generatedBy: string; // userId
}
```

Pipeline steps:
1. Load template from `document_templates` via `getDocumentTemplate()`
2. Resolve merge tags: call `resolveAndRenderHTML(template.content, recordId, tenantId)` from Unit 3
3. Render to print HTML: call `PDFRenderer.renderToHTML(resolvedHTML, template.settings)` — note: `resolveAndRenderHTML` already produces HTML, so `PDFRenderer.renderToHTML` wraps it in the full HTML document with print CSS
4. Send to Gotenberg: call `GotenbergClient.convertHTMLToPDF(html)`
5. Upload PDF to R2: use `StorageClient` with tenant-scoped path: `documents/{tenantId}/{templateId}/{recordId}/{timestamp}.pdf`
6. Create `generated_documents` row with `file_url`, `file_type: 'pdf'`, `template_id`, `source_record_id`, `generated_by`
7. Return the generated document ID

Error handling:
- Gotenberg timeout/failure: retry up to 3 times (BullMQ `attempts: 3`, `backoff: { type: 'exponential', delay: 5000 }`)
- Template not found: fail immediately (no retry)
- R2 upload failure: retry

**`generateDocument` server action (`apps/web/src/actions/document-generation.ts`):**
1. Validate input with Zod (templateId, recordId required)
2. Get tenant from auth context
3. Verify template exists and belongs to tenant
4. Enqueue `document-generation` job via BullMQ
5. Return the job ID for client-side polling

**`getDocumentGenerationStatus(jobId: string)` server action:**
1. Query BullMQ job by ID
2. Return `{ status: 'waiting' | 'active' | 'completed' | 'failed', result?: { documentId: string, fileUrl: string }, error?: string }`

**Queue helper:** `enqueueDocumentGeneration(opts: GenerateDocumentJobData): Promise<string>` — adds job to the `document-generation` queue and returns the job ID.

**Tests:** Test processor with mocked dependencies (Gotenberg, R2, DB). Test `generateDocument` action validates input and enqueues job. Test `getDocumentGenerationStatus` returns correct status shapes. Test retry behavior on Gotenberg failure.

### Acceptance Criteria

- [ ] [CONTRACT] `processDocumentGeneration` BullMQ processor exported from `apps/worker/src/processors/document-generation/generate.ts`
- [ ] [CONTRACT] `document-generation` BullMQ queue registered in `apps/worker/src/queues.ts`
- [ ] [CONTRACT] `generateDocument` server action exported from `apps/web/src/actions/document-generation.ts`
- [ ] [CONTRACT] `getDocumentGenerationStatus(jobId)` exported from `apps/web/src/actions/document-generation.ts`
- [ ] [CONTRACT] `enqueueDocumentGeneration()` queue helper exported
- [ ] BullMQ processor orchestrates: load template → resolve merge tags → render HTML → Gotenberg → upload to R2 → create `generated_documents` row
- [ ] `generateDocument` server action validates input and enqueues the job
- [ ] Error handling: Gotenberg timeout → job retry (max 3 with exponential backoff)
- [ ] Generated PDF stored in R2 with tenant-scoped path
- [ ] `generated_documents` row includes correct `file_url`, `file_type`, `template_id`, `source_record_id`
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 399–407 specifies the end-to-end generation flow. Lines 390–398 specify Gotenberg endpoints and BullMQ pattern. Builder decides BullMQ job configuration (retries, timeout, concurrency), R2 path structure, error recovery patterns, and how to wire the pipeline steps together.
**Reviewer Focus:** Validate pipeline steps match smart-docs.md §Generation Flow. Verify retry configuration. Verify R2 path includes tenant scoping. Verify `generated_documents` row creation with all required columns.

### Do NOT Build

- Plan limit / quota enforcement for document generation (deferred — no `tenant_plans` table yet)
- Batch generation for multiple records (post-MVP)
- Automation `Generate Document` action integration (Phase 4)
- Real-time job progress via WebSocket (polling is sufficient for MVP)

---

## VERIFY Session Boundary (after Prompts 8–9) — Completes Unit 4

**Scope:** Verify all work from Prompts 8–9 integrates correctly.
**Unit status:** Unit 4 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo test` — all pass
4. `pnpm turbo test -- --coverage` — thresholds met
5. Manual verification: if Gotenberg is available via Docker (`docker-compose` service), test the full pipeline end-to-end — enqueue a job, verify PDF output. If Gotenberg is not available, verify with mocked HTTP.

**Interface contract check:**
- [ ] [CONTRACT] `PDFRenderer` exported from `apps/web/src/lib/editor/pdf-renderer.ts`
- [ ] [CONTRACT] `GotenbergClient` exported from `packages/shared/pdf/gotenberg-client.ts`
- [ ] [CONTRACT] `processDocumentGeneration` processor exported
- [ ] [CONTRACT] `document-generation` queue registered
- [ ] [CONTRACT] `generateDocument` server action exported
- [ ] [CONTRACT] `getDocumentGenerationStatus()` exported
- [ ] [CONTRACT] `enqueueDocumentGeneration()` helper exported

**State file updates:**
- Update TASK-STATUS.md: Unit 4 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 8–9 [Phase 3D, VP-4]", then push branch to origin.

Fix any failures before proceeding to Prompt 10.

---

## — Unit 5: Template Management & Document Generation UI —

### Unit Context

The user-facing surfaces for the complete document workflow: browsing/managing templates, authoring templates in the editor with the merge-tag inserter, selecting a record to generate a document, and viewing/downloading generated documents. Includes the "Generate Document" button on Record View and the template list within workspace documents area.

**Interface Contract:**
Produces: `DocumentTemplateListPage` at route `/app/[tenantSlug]/[workspaceId]/documents`; `DocumentTemplateEditor` combining SmartDocEditor + MergeTagInserter; `TemplateCard`; `GenerateDocumentDialog`; `GenerateDocumentButton` for Record View header; `GeneratedDocumentList`; `useDocumentGeneration(jobId)` hook; routes for documents
Consumes: Data functions and server actions from Unit 1; `SmartDocEditor`, `useSmartDocEditor()` from Unit 2; `MergeTagInserter`, `PreviewToggle` from Unit 3; `generateDocument` action, `getDocumentGenerationStatus()` from Unit 4; existing `RecordViewHeader` from 3A-ii

---

## Prompt 10: Template List Page + Template Editor Page

**Unit:** 5
**Depends on:** Unit 1 complete, Unit 2 complete, Unit 3 complete
**Load context:** `smart-docs.md` lines 99–106 (Template Authoring Mode — editor + inserter layout), `smart-docs.md` lines 369–388 (Template Mapper UI — reference for layout patterns), `GLOSSARY.md` lines 392–409 (Document Template — template list, saved templates per table), `CLAUDE.md` lines 372–388 (Design Philosophy — Wizard Create for templates)
**Target files:** `apps/web/src/app/[tenantSlug]/[workspaceId]/documents/page.tsx`, `apps/web/src/app/[tenantSlug]/[workspaceId]/documents/[templateId]/page.tsx`, `apps/web/src/app/[tenantSlug]/[workspaceId]/documents/new/page.tsx`, `apps/web/src/components/documents/DocumentTemplateEditor.tsx`, `apps/web/src/components/documents/TemplateCard.tsx`
**Migration required:** No
**Git:** Commit with message "feat(documents): add template list and editor pages [Phase 3D, Prompt 10]"

### Schema Snapshot

```
document_templates: id, tenant_id, table_id, name, content (JSONB), settings (JSONB), version, environment, created_by, created_at, updated_at
```

### Task

**Template list page (`documents/page.tsx`):**
Server component that lists all document templates accessible within the workspace. Layout:
1. Page header: "Document Templates" title + "New Template" button
2. Template cards in a grid layout (3 columns desktop, 2 tablet, 1 mobile)
3. Each `TemplateCard` shows: name, table name (which table this template is for), last updated date, creator name, actions dropdown (Edit, Duplicate, Delete)
4. Duplicate action calls `duplicateDocumentTemplate` server action
5. Delete action shows confirmation dialog (shadcn `AlertDialog`), then calls `deleteDocumentTemplate`
6. Empty state: "No document templates yet. Create your first template to generate PDFs from record data."
7. Load templates using `listDocumentTemplates()` — note: this lists per-table, so the page needs to aggregate across tables in the workspace. Add a data function or adjust to support workspace-level listing.

**Template editor page (`documents/[templateId]/page.tsx`):**
1. Load template via `getDocumentTemplate()`
2. Render `DocumentTemplateEditor` with the template's content and settings
3. Page header: template name (editable inline), table name badge, settings gear icon, back button to list

**New template page (`documents/new/page.tsx`):**
Wizard Create flow (per CLAUDE.md Design Philosophy):
1. Step 1: Enter template name
2. Step 2: Select target table (dropdown of workspace tables)
3. Step 3: Creates template via `createDocumentTemplate` and redirects to editor page

**`DocumentTemplateEditor` component:**
Combines SmartDocEditor + MergeTagInserter + PreviewToggle. Layout:
- Top: EditorToolbar + PreviewToggle
- Left (70%): SmartDocEditor content area
- Right (30%): MergeTagInserter sidebar
- Auto-save: debounced 3s on content change via `updateDocumentTemplate` action. Show "Saving..." → "Saved" indicator.

**`TemplateCard` component:**
Card with template name, table badge, updated date, creator avatar/name. Actions dropdown on hover or via kebab menu.

### Acceptance Criteria

- [ ] [CONTRACT] `DocumentTemplateListPage` at route `/app/[tenantSlug]/[workspaceId]/documents`
- [ ] [CONTRACT] `DocumentTemplateEditor` exported from `apps/web/src/components/documents/DocumentTemplateEditor.tsx`
- [ ] [CONTRACT] `TemplateCard` exported from `apps/web/src/components/documents/TemplateCard.tsx`
- [ ] Template list page shows all templates for the workspace with create/duplicate/delete actions
- [ ] Template editor page loads SmartDocEditor with saved content and MergeTagInserter sidebar
- [ ] Auto-save on editor content change (debounced 3s) via `updateDocumentTemplate` action
- [ ] Template creation follows Wizard Create pattern (name → select table → open editor)
- [ ] Delete shows confirmation dialog, blocks if generated documents exist
- [ ] Empty state shown when no templates exist
- [ ] Route: `/app/[tenantSlug]/[workspaceId]/documents/new` — new template wizard
- [ ] Route: `/app/[tenantSlug]/[workspaceId]/documents/[templateId]` — template editor
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 99–106 specifies the editor layout with toolbar, content area, and field picker sidebar. GLOSSARY.md specifies "saved templates per table." CLAUDE.md Design Philosophy specifies Wizard Create pattern. Builder decides component structure, page routing, template list layout, auto-save debounce implementation, and table selector UX.
**Reviewer Focus:** Validate Wizard Create flow matches CLAUDE.md §Design Philosophy. Verify editor layout has toolbar + content + sidebar per smart-docs.md. Verify auto-save with 3s debounce.

### Do NOT Build

- Template settings page (page size, margins — defer to a simple settings modal accessible from the editor header gear icon, minimal implementation)
- Template sharing / permissions (not MVP scope)
- Template categories / tags (not MVP scope)
- AI Draft button (Phase 5)
- Template versioning UI (post-MVP)

---

## Prompt 11: GenerateDocumentDialog + GenerateDocumentButton + GeneratedDocumentList + Record View Integration

**Unit:** 5
**Depends on:** 10, Unit 4 complete
**Load context:** `smart-docs.md` lines 399–407 (Generation Flow — user-facing steps), `GLOSSARY.md` lines 392–409 ("Generate Document" button on Record View)
**Target files:** `apps/web/src/components/documents/GenerateDocumentDialog.tsx`, `apps/web/src/components/documents/GenerateDocumentButton.tsx`, `apps/web/src/components/documents/GeneratedDocumentList.tsx`, `apps/web/src/components/documents/use-document-generation.ts`, `apps/web/src/components/record-view/RecordViewHeader.tsx` (add Generate Document button)
**Migration required:** No
**Git:** Commit with message "feat(documents): add document generation UI and Record View integration [Phase 3D, Prompt 11]"

### Schema Snapshot

```
generated_documents: id, tenant_id, template_id, source_record_id, file_url, file_type, generated_by, generated_at, automation_run_id, ai_drafted
document_templates: id, tenant_id, table_id, name, content, settings, version, environment, created_by, created_at, updated_at
```

### Task

**`GenerateDocumentButton` (`GenerateDocumentButton.tsx`):**
Button component for Record View header. Shows "Generate Document" with a document icon. Only visible when the record's table has at least one template (check via `listDocumentTemplates()`). Clicking opens `GenerateDocumentDialog`.

**`GenerateDocumentDialog` (`GenerateDocumentDialog.tsx`):**
Modal dialog for triggering document generation:
1. Show list of available templates for this record's table
2. User selects a template
3. Optional: show a preview panel (uses PreviewToggle in Preview mode with the current record)
4. "Generate PDF" button → calls `generateDocument` server action → receives job ID
5. Show generation progress using `useDocumentGeneration` hook
6. On completion: show success with download link. On failure: show error with retry option.

**`useDocumentGeneration` hook (`use-document-generation.ts`):**
Polls `getDocumentGenerationStatus(jobId)` every 2 seconds while status is `waiting` or `active`. Returns `{ status, result, error, isLoading }`. Stops polling on `completed` or `failed`.

**`GeneratedDocumentList` (`GeneratedDocumentList.tsx`):**
List of previously generated documents for a record. Shows:
- Template name, generated date, generated by (avatar + name)
- Download button (opens `file_url` in new tab — presigned R2 URL)
- Compact list layout, ordered by `generated_at` desc
- Empty state: "No documents generated yet."

**Record View integration:**
Add `GenerateDocumentButton` to the existing `RecordViewHeader.tsx` component (from 3A-ii). This is a surgical addition — add the button alongside existing header actions. Also add a "Documents" tab to `RecordViewTabs` that shows `GeneratedDocumentList`.

### Acceptance Criteria

- [ ] [CONTRACT] `GenerateDocumentDialog` exported from `apps/web/src/components/documents/GenerateDocumentDialog.tsx`
- [ ] [CONTRACT] `GenerateDocumentButton` exported from `apps/web/src/components/documents/GenerateDocumentButton.tsx`
- [ ] [CONTRACT] `GeneratedDocumentList` exported from `apps/web/src/components/documents/GeneratedDocumentList.tsx`
- [ ] [CONTRACT] `useDocumentGeneration(jobId)` hook exported from `apps/web/src/components/documents/use-document-generation.ts`
- [ ] "Generate Document" button visible in Record View header for records with available templates
- [ ] `GenerateDocumentDialog` allows selecting a template and triggers generation
- [ ] Generation progress shown (loading state → success with download link, or error with retry)
- [ ] Generated documents list visible on Record View with download links and generation metadata
- [ ] `useDocumentGeneration` polls every 2s and stops on completion/failure
- [ ] Button is hidden when no templates exist for the table
- [ ] ESLint and TypeScript compile with zero errors
- [ ] ≥80% line coverage on new files

**RSA Classification:** SH
**RSA Rationale:** `smart-docs.md` lines 399–407 specifies the user-facing generation steps (select template → select record → resolve → generate → store). GLOSSARY.md specifies "Generate Document button on Record View." Builder decides component structure, dialog layout, progress UX (polling vs real-time), and how to integrate the button into the existing RecordViewHeader.
**Reviewer Focus:** Validate "Generate Document" button placement in RecordViewHeader. Verify dialog flow matches smart-docs.md §Generation Flow. Verify polling stops correctly on completion.

### Do NOT Build

- Real-time generation progress via WebSocket (polling is sufficient for MVP)
- Batch generation for multiple records (post-MVP)
- Document sharing / link generation (post-MVP)
- PDF viewer embedded in the app (download only for MVP)
- Template preview in dialog beyond basic info (keep dialog simple)

---

## VERIFY Session Boundary (after Prompts 10–11) — Completes Unit 5

**Scope:** Verify all work from Prompts 10–11 integrates correctly.
**Unit status:** Unit 5 complete — verify contract.

Checks to run in VERIFY context:
1. `pnpm turbo typecheck` — zero errors
2. `pnpm turbo lint` — zero errors
3. `pnpm turbo check:i18n` — no hardcoded English strings (all UI text through i18n)
4. `pnpm turbo test` — all pass
5. `pnpm turbo test -- --coverage` — thresholds met
6. Manual verification: navigate to `/app/{tenant}/{workspace}/documents`, create a template via wizard, edit with merge-tag inserter, navigate to a record's Record View, verify "Generate Document" button appears, verify the dialog opens and shows templates

**Interface contract check:**
- [ ] [CONTRACT] `DocumentTemplateListPage` at route `/app/[tenantSlug]/[workspaceId]/documents`
- [ ] [CONTRACT] Route `/app/[tenantSlug]/[workspaceId]/documents/[templateId]` — editor page
- [ ] [CONTRACT] Route `/app/[tenantSlug]/[workspaceId]/documents/new` — new template wizard
- [ ] [CONTRACT] `DocumentTemplateEditor` exported
- [ ] [CONTRACT] `TemplateCard` exported
- [ ] [CONTRACT] `GenerateDocumentDialog` exported
- [ ] [CONTRACT] `GenerateDocumentButton` exported
- [ ] [CONTRACT] `GeneratedDocumentList` exported
- [ ] [CONTRACT] `useDocumentGeneration()` hook exported

**State file updates:**
- Update TASK-STATUS.md: Unit 5 → `passed-review`
- Update MODIFICATIONS.md: append session block

**Git:** Commit with message "chore(verify): verify prompts 10–11 [Phase 3D, VP-5]", then push branch to origin.

Fix any failures before marking Phase 3D complete.
