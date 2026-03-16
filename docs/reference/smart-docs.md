# EveryStack — Smart Docs & Document Generation

> **Reference doc.** TipTap editor environment 2 (full-featured), Smart Doc field type, Smart Doc views (wiki + template modes), document generation (both prongs), template mapper, wiki architecture, React component structure, JSONB schema, custom nodes, rendering pipelines.
> **Filename note:** This file covers both MVP **Document Templates** (merge-tag TipTap templates → Gotenberg → PDF) and post-MVP **Smart Doc** wiki/template views. The GLOSSARY canonical term for the MVP concept is "Document Template" — not "Smart Doc." File retains `smart-docs.md` name for cross-reference stability (46+ inbound references).
> See `GLOSSARY.md` for concept definitions and MVP scope.
> Cross-references: `data-model.md` (document_templates, generated_documents, smart_doc_content, smart_doc_versions, smart_doc_snapshots, smart_doc_backlinks schema), `communications.md` (TipTap env 1 — chat editor), `automations.md` (Generate Document action), `tables-and-views.md` (Smart Doc view type), `email.md` (Send in email action)
> Last updated: 2026-03-16 — Phase 3D doc prep. Updated Document Generation Data Model: `template_definitions` → `document_templates` (renamed in data-model.md; simpler merge-tag model for MVP). Aligned `generated_documents` columns with GLOSSARY (added `ai_drafted`). Fixed section index ranges for Document Generation and Post-MVP sections. Added `document_templates`, `generated_documents` to cross-reference header.

---

## Section Index

> **For Claude Code:** Use line ranges to load only the sections relevant to your current task.

| Section                          | Lines   | Covers                                                                                                                                                                             |
| -------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Wiki Architecture                | 26–47   | Wiki table_type config, wiki rendering, URL routes, nesting via self-referential parent                                                                                            |
| TipTap Editor Architecture       | 49–229  | Environment 2 (full-featured Smart Doc editor), React component structure, JSONB document schema, custom EveryStack node definitions, rendering pipelines (screen, PDF, portal)    |
| Smart Doc as a Field Type        | 231–294 | Two sub-types (authored vs generated), field configuration, storage, data model (smart_doc_content, versions, snapshots, backlinks)                                                |
| Smart Doc View (Table-Level)     | 296–329 | Wiki mode (two-panel page tree + editor), template mode, contextual access points                                                                                                  |
| Document Generation — Two Prongs | 331–423 | Prong 1: TipTap merge-tag templates → Gotenberg → PDF (MVP), Prong 2: upload template generation (post-MVP), template mapper UI, backend requirements, generation flow, data model |
| Post-MVP Smart Doc Features      | 426–432 | AI content blocks, chart embeds, knowledge base mode, export                                                                                                                       |

---

## Wiki Architecture

When `table_type = wiki`, the table serves as a **base-level knowledge base**. Wiki pages are records. Nesting uses self-referential parent pattern. The wiki table_type is a preset: auto-creates Smart Doc view (wiki mode), Smart Doc field for content, and parent field for nesting.

Use cases: internal SOPs, onboarding docs, team procedures, product knowledge base, client-facing help centers (via portals).

Any table can also add a Smart Doc view for wiki-like functionality scoped to that table's context.

### Wiki Table Config

One `wiki_table_config` per wiki-type table. Required: title_field_id, content_field_id, parent_field_id. Optional: author, status (Draft/Published), icon/emoji, tags, default_page_id.

### Wiki Rendering

Two-panel layout:

- **Left panel:** Page tree sidebar. Collapsible nested list from parent traversal. Icon + title. Drag-and-drop re-parent/reorder. [+ New Page]. Right-click: rename, delete, add child, move.
- **Right panel:** Content area. Editable title + Smart Doc Editor (wiki mode). Full formatting: headings, lists, code blocks, tables, images, callouts, embeds, backlinks (`[[page]]`), auto-generated table of contents.
- **Footer:** "Last edited by [author] · [timestamp] · [status badge]"

Because wiki pages are records, they get: cross-links, portal visibility, doc gen, automations, Command Bar search, comments, attachments — all for free.

---

## TipTap Editor Architecture

EveryStack uses TipTap (ProseMirror-based) for two distinct rich-text environments. Environment 1 (Chat Editor) is in `communications.md`. This covers Environment 2 (Smart Doc Editor).

### Environment 2: Smart Doc Editor (Full-Featured)

True document/content editor. Powers two contexts — wiki/doc editing (record fields) and template authoring (Smart Doc views) — by enabling/disabling extensions per context.

**UX Pattern:**

- **Full toolbar** at top (not floating). Contents vary by context.
- **Slash command menu** (`/`) for block insertion.
- **Floating bubble menu** on text selection for inline formatting.
- **Block handles** on hover for drag-reorder and block actions.
- **Breadcrumb navigation** for wiki contexts.

**Core Extensions (all contexts):**

- StarterKit (bold, italic, strike, code, headings H1–H4, bullet/ordered lists, blockquote, horizontal rule, hard break, history)
- Underline, Highlight, Subscript, Superscript
- Link (preview popup on hover)
- Image (upload to S3/R2, drag-resize, caption, alt text)
- Table (column/row controls, header rows, merge cells)
- CodeBlock (syntax highlighting via lowlight)
- TaskList / TaskItem (checkboxes)
- Callout / Admonition (info, warning, success, error — custom node)
- Placeholder, Typography, CharacterCount
- TextAlign (left, center, right, justify)
- Color / TextStyle
- Mention (`@user`, `@record`, `@page`)
- SlashCommand (custom — `/` triggers block menu)
- DragHandle (custom — block reordering)
- UniqueID (per-block IDs for collaboration)

**Context-Specific Extensions:**

| Feature                         | Wiki Field | Doc Field | Template Authoring |
| ------------------------------- | ---------- | --------- | ------------------ |
| Backlinks (`[[page]]`)          | ✅         | ❌        | ❌                 |
| Table of Contents               | ✅         | ✅        | ✅                 |
| Nested Page Links               | ✅         | ❌        | ❌                 |
| Page status (Draft/Published)   | ✅         | ❌        | ❌                 |
| Version History                 | ✅         | ✅        | ✅                 |
| Collaboration (Yjs/Hocuspocus)  | ✅         | ✅        | ✅                 |
| Placeholder Toolbar (`{field}`) | ❌         | ❌        | ✅                 |
| Field Picker sidebar            | ❌         | ❌        | ✅                 |
| Preview with Sample Data        | ❌         | ❌        | ✅                 |
| Embed blocks (video, iframe)    | ✅         | ✅        | ❌                 |

**Template Authoring Mode (Smart Doc view level):**
Additional toolbar/sidebar shows available fields from table schema and cross-linked tables. Clicking inserts `{field_name}` as styled teal pill node. Distinguishes:

- **Simple fields:** `{field_name}` — text, number, date, etc.
- **Loop fields:** `{#line_items}...{/line_items}` — from linked records.
- **Conditional fields:** `{#if status == "Active"}...{/if}` — conditional blocks.

Preview toggle: **Edit** (pills) → **Preview** (sample data) → **Raw** (`{placeholder}` text).

### React Component Structure

```
src/components/editor/
├── EveryStackEditor.tsx          -- Main editor wrapper
├── extensions/
│   ├── index.ts                  -- Configured extension bundle
│   ├── slash-command/
│   │   ├── SlashCommand.ts       -- TipTap extension
│   │   ├── SlashCommandList.tsx  -- Popup component
│   │   └── commands.ts           -- Block type registry
│   ├── block-handle/
│   │   └── BlockHandle.tsx
│   ├── callout/
│   │   ├── Callout.ts            -- Custom node
│   │   └── CalloutView.tsx       -- React NodeView
│   ├── toggle/
│   │   ├── Toggle.ts
│   │   └── ToggleView.tsx
│   ├── record-ref/
│   │   ├── RecordRef.ts
│   │   └── RecordRefView.tsx     -- Inline chip
│   ├── merge-tag/
│   │   ├── MergeTag.ts
│   │   └── MergeTagView.tsx      -- Teal pill with field icon
│   ├── signature/
│   │   ├── Signature.ts
│   │   └── SignatureView.tsx     -- Canvas signature pad
│   ├── embed/
│   │   ├── Embed.ts
│   │   └── EmbedView.tsx         -- iframe with URL validation
│   ├── file-attachment/
│   │   ├── FileAttachment.ts
│   │   └── FileAttachmentView.tsx
│   └── database-view/
│       ├── DatabaseView.ts
│       └── DatabaseViewEmbed.tsx -- Inline table/kanban embed
├── menus/
│   ├── BubbleToolbar.tsx         -- Floating on selection
│   ├── FloatingPlus.tsx          -- "+" on empty lines
│   └── BlockMenu.tsx             -- Per-block context menu
├── toolbar/
│   ├── EditorToolbar.tsx         -- Top fixed (context-aware)
│   ├── FormatGroup.tsx
│   ├── AlignGroup.tsx
│   ├── InsertGroup.tsx
│   └── HistoryGroup.tsx
├── renderers/
│   ├── PortalRenderer.tsx        -- Read-only via generateHTML()
│   ├── PDFRenderer.ts            -- JSONB → HTML → Gotenberg → PDF
│   └── EmailRenderer.ts          -- JSONB → inline HTML email
└── utils/
    ├── jsonb-helpers.ts
    ├── merge-resolver.ts         -- Resolves {field} tags
    └── text-extractor.ts         -- Plain text for tsvector
```

### TipTap JSONB Document Schema

TipTap's native output is JSON — stored directly in canonical JSONB:

```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "Project Update" }]
    },
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Status is " },
        { "type": "text", "marks": [{ "type": "bold" }], "text": "on track" },
        { "type": "text", "text": " as of today." }
      ]
    },
    {
      "type": "callout",
      "attrs": { "emoji": "⚠️", "color": "yellow" },
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Budget review needed" }] }
      ]
    }
  ]
}
```

### Custom EveryStack Node Definitions

| Node Type           | JSONB `attrs`                               | Behavior                                                                         |
| ------------------- | ------------------------------------------- | -------------------------------------------------------------------------------- |
| `recordRef`         | `{ tableId, recordId, displayText }`        | Inline chip linking to record. Auto-updates displayText on change.               |
| `mergeTag`          | `{ tableId, fieldId, fallback }`            | Template placeholder pill. Resolved at render time. `fallback` for empty fields. |
| `callout`           | `{ emoji, color }`                          | Colored callout (blue/yellow/green/red).                                         |
| `toggle`            | `{ open }`                                  | Collapsible block (Notion-style).                                                |
| `embed`             | `{ src, width, height }`                    | YouTube/Loom/URL via sandboxed iframe.                                           |
| `fileAttachment`    | `{ fileUrl, fileName, fileType, fileSize }` | Download card with icon + name + size.                                           |
| `databaseViewEmbed` | `{ viewId, tableId, mode }`                 | Inline table/kanban. `mode`: live \| snapshot.                                   |
| `signature`         | `{ dataUrl, width, height }`                | Canvas signature capture. Base64 for PDF contracts.                              |

### Rendering Pipelines

Same JSONB renders across four targets:

| Target                 | Pipeline                                   | Notes                                                                                                                 |
| ---------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| **Interactive editor** | JSONB → TipTap (full React)                | Full editing, context-dependent extensions                                                                            |
| **Portal (read-only)** | JSONB → `generateHTML()` → styled HTML     | Lightweight — no TipTap bundle                                                                                        |
| **PDF**                | JSONB → `generateHTML()` → Gotenberg → PDF | Gotenberg uses headless Chromium for HTML→PDF (MVP). LibreOffice endpoint used only for post-MVP DOCX→PDF conversion. |
| **Email**              | JSONB → `EmailRenderer` → inline HTML      | Email-safe, inline styles                                                                                             |

**Node → output mapping:**

| Node        | HTML                           | PDF Notes                 |
| ----------- | ------------------------------ | ------------------------- |
| `heading`   | `<hN>`                         | Native                    |
| `table`     | `<table>`                      | Chromium renders natively |
| `image`     | `<img>`                        | Absolute S3/R2 URL        |
| `callout`   | `<div>` colored                | Custom CSS                |
| `recordRef` | `<a>` link (plain text in PDF) |                           |
| `mergeTag`  | Resolved to field value        | Replaced before HTML      |
| `signature` | `<img>` base64                 | Embedded                  |

---

## Smart Doc as a Field Type

First-class field type alongside text, number, date, select, etc. Any record can have multiple Smart Doc fields.

### Two Sub-types

| Sub-type            | Authoring                              | Editability                                | Purpose                                 |
| ------------------- | -------------------------------------- | ------------------------------------------ | --------------------------------------- |
| **Wiki**            | User-authored                          | Fully editable (collaboration, versioning) | Meeting notes, briefs, documentation    |
| **Template Output** | Generated from Smart Doc view template | **Read-only** — reflects current data      | Invoices, proposals, contracts, reports |

**Wiki fields:** Unlimited per record. Full Smart Doc Editor with Yjs collaboration and version history.

**Template Output fields:** Tied to specific Smart Doc view template. **Live computed** — when referenced fields change, output re-renders automatically. Debounced 2-second BullMQ job for rapid edits.

**Output Actions (template-output fields):**

| Action            | Behavior                                                    |
| ----------------- | ----------------------------------------------------------- |
| **Print**         | Browser print dialog                                        |
| **Send in email** | Compose with PDF attachment. **Creates snapshot.**          |
| **Share link**    | Permission-gated or public token URL. **Creates snapshot.** |
| **Copy**          | Rich text to clipboard                                      |
| **Export**        | DOCX or PDF download. **Creates snapshot.**                 |

**Snapshot on send:** Email/Share/Export freezes version in `smart_doc_snapshots`. Live doc continues updating. Snapshots kept forever (audit trail).

### Field Configuration

- Field type: `smart_doc`
- Sub-type: `wiki` | `template_output`
- Template source (template_output): which Smart Doc view template populates
- Default content (wiki): optional starter content
- Form mode config (wiki): `form_variant` (boolean), `form_max_length` (default 10K chars), `form_placeholder`

**Smart Doc in Forms (simplified):**
When wiki Smart Doc appears in portal/embeddable form:

- **Allowed:** Bold, italic, underline, bullet/numbered lists, links
- **Not allowed:** Headings, images, tables, code blocks, embeds, slash commands
- **Implementation:** Restricted TipTap extension set
- **Max length:** Configurable (default 10K chars). Counter shown >80%.
- **Toolbar:** Minimal — Bold, Italic, Underline, Lists, Link. No slash menu.

### Storage

- **Wiki fields:** TipTap JSON in `records.canonical_data`. >50KB overflows to `smart_doc_content` table.
- **Template output fields:** Always in `smart_doc_content` (generated content can be large).
- **Why TipTap JSON, not HTML:** Lossless round-trip. HTML generated on-demand for export/email/portal.
- **50KB threshold:** ~15K–20K words. Covers 95%+ of docs. Config constant, adjustable.

**Auto-save:** Debounced 3s after last keystroke. Save on blur. "Saving..." → "Saved ✓". No manual save button.

**Version pruning:** 0–30 days: all versions. 30–90 days: daily snapshots. 90+: weekly. Named/system versions exempt. Nightly BullMQ job.

### Data Model

| Entity                | Key Columns                                                                                                                      | Purpose                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `smart_doc_content`   | id, tenant_id, record_id, field_id, content (JSONB), source_view_id (nullable), version                                          | Content storage. Overflow + template outputs. |
| `smart_doc_versions`  | id, smart_doc_content_id, version, content (JSONB), created_by, created_at                                                       | Version history for wiki fields.              |
| `smart_doc_snapshots` | id, smart_doc_content_id, content (JSONB), rendered_html, rendered_pdf_url, action_type, action_metadata, created_by, created_at | Frozen versions on Email/Share/Export.        |
| `smart_doc_backlinks` | source_record_id, source_field_id, target_record_id, target_field_id                                                             | Backlink index for `[[page]]` refs.           |

---

## Smart Doc View (Table-Level)

View type alongside Table, Board, Gantt, etc. Two modes:

**Mode 1: Wiki** — Renders table's records as knowledge base. Two-panel: page tree + editor. Available on any table (not just wiki table_type).

**Mode 2: Template** — Doc gen template. Manager designs layout with placeholder toolbar and field picker. Populates template-output Smart Doc fields on records.

**Template → Record relationship:**

```
Smart Doc View "Invoice Template" (table level, template mode)
  → auto-populates →
Smart Doc field "Invoice" (record level, template_output, read-only)
```

**Automation integration:**

- **Generate Smart Doc** action: use template view → generate for filtered records
- **Smart Doc → DOCX/PDF** action: render field to file for email/attachment
- **Trigger:** "When Smart Doc field updated" (wiki), "When template output regenerated"

### Contextual Access Points

| Surface                         | How Smart Docs Appear                                                        |
| ------------------------------- | ---------------------------------------------------------------------------- |
| **Wiki table type**             | Default view. Every record is a page.                                        |
| **Smart Doc view on any table** | Wiki or template mode.                                                       |
| **Record View**                 | Inline preview (wiki) or rendered doc (template output) with action buttons. |
| **Interface tabs**              | Wiki for documentation alongside data tabs.                                  |
| **Portals**                     | Smart Doc Block — read-only for outputs, optionally editable for wiki.       |
| **Automations**                 | Generate, render to file, field change triggers.                             |
| **Forms**                       | Read-only blocks for instructions. Simplified editor for rich text input.    |

---

## Document Generation — Two Prongs

### Prong 1: TipTap — Smart Doc Templates

TipTap handles all in-platform rich text. Two roles in doc gen:

- **Smart Doc view (template mode):** Manager designs templates at table level. Auto-populates read-only fields. Live computed — auto-syncs on data change.
- **Smart Doc field (wiki):** User-authored, exportable to DOCX/PDF on demand.

### Prong 2: Upload Template Generation — ⚠️ Post-MVP

> **⚠️ Post-MVP.** MVP document generation uses Prong 1 only (TipTap → merge tags → HTML → Gotenberg/Chromium → PDF). The Docxtemplater/DOCX upload path described below is deferred. See `document-designer.md` for the post-MVP Document App type which supersedes this approach with a homegrown DOCX engine.

Handles structured document output: invoices, contracts, proposals, letters.

- Users design templates in Word/Google Docs (familiar tools, full layout control)
- `{field_name}` placeholder syntax
- Template Mapper UI maps text to platform fields
- Backend: load template → pull record JSON → Docxtemplater → populated document
- Output: DOCX (native) or PDF (via Gotenberg)

**Why this approach:** No layout engine to build. Templates preserve formatting (fonts, logos, columns, headers/footers). Docxtemplater supports loops, conditionals, images, HTML injection. Users know Word. Cost: ~$1,500 one-time PRO modules.

**Docxtemplater capabilities:**

- `{placeholder}` text replacement
- `{#loop}...{/loop}` repeating sections
- `{#condition}...{/condition}` conditional content
- Nested loops and conditions

**PRO modules ($1,500 one-time):** HTML module (TipTap rich text injection), Image module (logos, photos), Table module (dynamic rows), Styling module (conditional formatting).

### Template Mapper UI

Interface for converting user-designed DOCX into Docxtemplater-ready template. **Not a doc editor — a field mapping tool.**

**Workflow:**

1. Upload DOCX from Word/Google Docs
2. Platform shows high-fidelity preview (docx-preview)
3. Select text → sidebar shows selection
4. Pick platform field → system writes `{placeholder}` into DOCX XML
5. Modified DOCX saved as reusable template

**DOCX-only for MVP.** Helper tip for Google Docs users: "Download as .docx first."

**UI Design:**

- Two-panel: document preview (left ~62%) + mapping sidebar (right ~38%)
- Field picker: categorized, searchable, collapsible accordions
- Mapping interaction: select text → pick field → add mapping. Removable chips.
- View modes: Edit / Preview (sample data) / Template (`{placeholder}` syntax)

### Backend Requirements

1. **DOCX XML Manipulation:** JSZip to unzip → walk `<w:t>` runs → replace with `{placeholder}` → rezip. Docxtemplater handles split XML runs.
2. **Storage:** Templates in S3/R2. Associated with source tables. Versioning. Library in Documents section.
3. **Dynamic Field Registry:** Pull from workspace data model (not static list).
4. **Docxtemplater Service:** BullMQ job: load template → pull record JSON (resolve cross-links) → run → store generated file → link to record.
5. **PDF Pipeline:** Gotenberg — LibreOffice endpoint for DOCX→PDF (`POST /forms/libreoffice/convert`). Note: HTML→PDF (used by MVP Smart Doc exports) uses the separate Chromium endpoint (`POST /forms/chromium/convert/html`).
6. **docx-preview:** Browser-side DOCX rendering.

### Generation Flow

1. User selects template + source record(s)
2. System resolves all field values including cross-links
3. Loop sections: query linked records (line items, deliverables)
4. Conditional sections: evaluate field conditions
5. Run Docxtemplater with resolved JSON
6. Output DOCX; optionally PDF via Gotenberg
7. Store in S3/R2 linked to source record

### Three Doc Gen Paths

| Path                   | Authoring                   | Engine                           | Output                | Best For                                          |
| ---------------------- | --------------------------- | -------------------------------- | --------------------- | ------------------------------------------------- |
| **Upload DOCX**        | Word/Docs → Template Mapper | Docxtemplater (backend)          | DOCX/PDF file         | Complex layouts: invoices, contracts, letterheads |
| **Smart Doc Template** | TipTap (template mode)      | TipTap re-render (live) + export | Live field + DOCX/PDF | Flowing content: proposals, SOWs, reports         |
| **Wiki Export**        | User-authored rich text     | HTML-to-PDF                      | DOCX/PDF on demand    | Ad-hoc: export any wiki doc                       |

### Data Model

| Entity                 | Key Columns                                                                                                                         | Purpose           |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `document_templates`   | id, tenant_id, table_id, name, content (JSONB — TipTap JSON with merge tags), settings (JSONB), version, created_by, environment, created_at, updated_at | Template registry |
| `generated_documents`  | id, tenant_id, template_id, source_record_id, file_url (S3/R2), file_type (pdf), generated_by, generated_at, automation_run_id (nullable), ai_drafted (boolean) | Output tracking   |

---

## Post-MVP Smart Doc Features

- **AI content blocks** (`{ai:summarize(notes)}`) — AI-generated content injected at generation time
- **Chart embeds** in Smart Docs — live chart blocks with merge field syntax
- **Knowledge base mode** — wiki tables as AI knowledge sources with semantic search
- **Export** from wiki fields (DOCX, PDF, Markdown)
